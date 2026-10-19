import { ANALYTIC_BUNDLE_SCHEMA } from "./analytic-scene.js";
import viewerCss from "../styles.css";
import { AssetCache } from "./asset-cache.js";
import { absolutizeAssetPaths, bundleIsFinal } from "./bundle-urls.js";
import { mountStandaloneViewer } from "./main.js";
import { createReloadOwner, runSemanticViewerReload } from "./semantic-viewer-reload.js";
import { BoardModeController, createSharedState, installModeMembers } from "./viewer-controllers.js";

function shellHtml() {
  return `
    <style>
      ${viewerCss}
      #app { grid-template-columns: minmax(0, 1fr) 376px; }
      #app.panel-collapsed { grid-template-columns: minmax(0, 1fr) 46px; }
      #app.workspace-stackup { grid-template-columns: minmax(0, 1fr); }
      #selection-card { display: none !important; }
      #scene-stats {
        position: absolute; top: 12px; right: 12px; z-index: 4; margin: 0; padding: 8px 10px;
        display: grid; grid-template-columns: auto auto; gap: 2px 12px;
        background: rgb(15 20 28 / 0.82); color: #dbe4f0; border-radius: 6px;
        font: 11px/1.4 "SFMono-Regular", Consolas, monospace; font-variant-numeric: tabular-nums;
        pointer-events: none;
      }
      #scene-stats[hidden] { display: none; }
      #scene-stats dt { color: #8a97a8; }
      #scene-stats dd { margin: 0; text-align: right; }
      /* The host renders the PCB controls itself (see getViewState). */
      :host([hide-panel]) #app,
      :host([hide-panel]) #app.panel-collapsed { grid-template-columns: minmax(0, 1fr); }
      :host([hide-panel]) .panel { display: none !important; }
    </style>
    <main id="app">
      <section class="viewport-shell">
        <canvas id="viewport"></canvas>
        <div id="stackup-workspace-view" hidden></div>
        <div id="panel-labels"></div>
        <div id="selection-card" hidden></div>
        <canvas id="axis-gizmo" width="112" height="112" title="Click an axis to align the camera"></canvas>
        <dl id="scene-stats" hidden></dl>
        <div id="fallback" hidden></div>
      </section>
      <aside class="panel">
        <nav class="panel-rail" aria-label="Viewer tools">
          <button class="rail-tab active" data-tab="layers" title="Layers">Layers</button>
          <button class="rail-tab" data-tab="search" title="Search and selection">Find</button>
          <button class="rail-tab" data-tab="view" title="View controls">View</button>
        </nav>
        <div class="panel-drawer">
          <header class="panel-mode-header">
            <div id="mode-switch"></div>
          </header>
          <section class="tab-panel active" data-panel="layers">
            <div class="section-heading"><h2 id="primary-heading">Layers</h2><span id="primary-description">Visibility and compare</span></div>
            <div id="layers"></div>
          </section>
          <section class="tab-panel" data-panel="search">
            <div class="section-heading"><h2>Find</h2><span>Nets, components and pins</span></div>
            <div id="search-controls"></div>
          </section>
          <section class="tab-panel" data-panel="view">
            <div class="section-heading"><h2>View</h2><span>Camera and stackup</span></div>
            <div id="view-controls"></div>
          </section>
        </div>
      </aside>
    </main>
  `;
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}

async function fetchJson(url, timings = null, label = "fetch", signal = undefined) {
  const started = performance.now();
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  const value = await response.json();
  if (timings) {
    timings[`${label}_fetch_parse_ms`] = performance.now() - started;
    timings[`${label}_content_length`] = Number(response.headers.get("content-length") || 0);
  }
  return value;
}

async function loadBundle(bundleUrl, timings, signal) {
  const absoluteBundleUrl = new URL(bundleUrl, document.baseURI).toString();
  const cacheKey = new URL(absoluteBundleUrl).searchParams.get("viewer") || "";
  // SB2-26: a final bundle is read from the browser cache; earlier stages
  // rewrite bundle.json in place, so only a final one is ever stored.
  const cache = AssetCache.open();
  let bundle = await cache.peekJson(absoluteBundleUrl).catch(() => null);
  const cachedBundle = Boolean(bundle);
  if (!bundle) {
    bundle = await fetchJson(absoluteBundleUrl, timings, "bundle", signal);
    if (bundleIsFinal(bundle)) void cache.store(absoluteBundleUrl, new TextEncoder().encode(JSON.stringify(bundle)));
  }
  if (timings) timings.bundle_from_cache = cachedBundle;
  const assetCache = bundleIsFinal(bundle) && cache.enabled ? cache : null;
  // An analytic bundle names the design bundle's members; the viewer builds
  // the scene from the pack (main.js openAnalyticSource). There are no mesh
  // bundles any more (System Builder v2, stage 0).
  if (bundle.schema !== ANALYTIC_BUNDLE_SCHEMA) {
    throw new Error(`Unsupported visualizer bundle schema: ${bundle.schema || "missing"}`);
  }
  const semanticGeometry = { analytic: true, cache_key: bundle.cache_key || "", readiness: bundle.readiness, assets: bundle.assets || {} };
  return {
    bundle,
    topology: {},
    semanticGeometry: absolutizeAssetPaths(semanticGeometry, absoluteBundleUrl, bundle, cacheKey),
    assetCache,
  };
}

export class PrismSemanticViewerElement extends HTMLElement {
  static get observedAttributes() {
    return ["bundle-url", "workspace"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.reloadOwner = createReloadOwner();
    this.reloadQueued = false;
    this.reloadSource = null;
    // AC-30: one controller for the element's whole life. It holds what the
    // host asked for and replays it onto every scene a reload mounts.
    this.modes = Object.freeze({ board: new BoardModeController(createSharedState()) });
    /** The controller with a mounted scene, or null between mounts. */
    this.mounted = null;
  }

  /** The controller common members go to. */
  get activeMode() {
    return this.mounted ?? this.modes.board;
  }

  detachModes() {
    this.modes.board.detach();
    this.mounted = null;
  }

  connectedCallback() {
    this.queueReload();
  }

  disconnectedCallback() {
    this.reloadOwner.cancel();
    this.detachModes();
    this.reloadSource = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.isConnected || oldValue === newValue) return;
    if (name === "workspace") {
      this.modes.board.setWorkspace(this.workspace);
      return;
    }
    this.queueReload();
  }

  get workspace() {
    return this.getAttribute("workspace") === "stackup" ? "stackup" : "pcb";
  }

  queueReload() {
    const source = this.getAttribute("bundle-url");
    if (!source || source === this.reloadSource) return;
    this.reloadSource = source;
    if (this.reloadQueued) return;
    this.reloadQueued = true;
    queueMicrotask(() => {
      this.reloadQueued = false;
      if (this.isConnected) void this.reload();
    });
  }

  async reload() {
    const bundleUrl = this.getAttribute("bundle-url");
    const attempt = this.reloadOwner.begin();
    this.detachModes();
    if (!bundleUrl) {
      this.shadowRoot.innerHTML = `<style>:host{display:block;height:100%;font:14px system-ui;color:#94a3b8}</style><div>Semantic bundle URL is missing.</div>`;
      return;
    }
    await runSemanticViewerReload(this, attempt, { owner: this.reloadOwner, bundleUrl, loadBundle });
  }

  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(`prism-semantic-viewer:${name}`, { bubbles: true, composed: true, detail }));
  }

  renderLoading() {
    this.shadowRoot.innerHTML = `<style>:host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}</style><div style="display:grid;place-items:center;height:100%">Loading semantic visualizer...</div>`;
  }

  renderShell() {
    this.shadowRoot.innerHTML = shellHtml();
  }

  renderError(error) {
    console.error(error);
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}
        .error{height:100%;display:grid;place-items:center;padding:24px}
        pre{max-width:100%;white-space:pre-wrap;color:#fecaca;background:#111827;border:1px solid #374151;padding:16px}
      </style>
      <div class="error"><pre>${escapeHtml(error?.stack || error?.message || String(error))}</pre></div>
    `;
  }

  mountViewer({ topology, semanticGeometry, readiness, assetCache = null, signal }) {
    // Callbacks are bound to this attempt: a superseded mount that is still
    // booting must not report selection or performance for the newer load.
    return mountStandaloneViewer({
      root: this.shadowRoot,
      topology,
      semanticGeometry,
      readiness,
      workspaceScope: "3d",
      assetCache,
      isActive: () => this.getAttribute("active") === "true",
      onSelectionChange: (selection) => {
        if (signal.aborted) return;
        this.dispatchEvent(new CustomEvent("prism-semantic-viewer:selectionchange", {
          bubbles: true,
          composed: true,
          detail: { selection },
        }));
      },
      onContextMenu: (detail) => {
        if (signal.aborted) return;
        this.dispatchEvent(new CustomEvent("prism-semantic-viewer:contextmenu", {
          bubbles: true,
          composed: true,
          detail,
        }));
      },
      onViewStateChange: (detail) => {
        if (signal.aborted) return;
        this.emitViewState(detail);
      },
      onPerformanceEvent: (detail) => {
        if (signal.aborted) return;
        console.info("[prism-3d-perf]", detail);
        this.dispatchEvent(new CustomEvent("prism-semantic-viewer:performance", {
          bubbles: true,
          composed: true,
          detail,
        }));
      },
    });
  }

  /** runSemanticViewerReload's hand-off: the board scene it mounted, now this element's. */
  publishController(port) {
    this.mounted = this.modes.board;
    this.mounted.attach(port, { workspace: this.workspace });
    const viewState = this.getViewState();
    if (viewState) this.emitViewState(viewState);
  }

  emitViewState(detail) {
    this.dispatchEvent(new CustomEvent("prism-semantic-viewer:viewstatechange", {
      bubbles: true,
      composed: true,
      detail,
    }));
  }

  emitReady(detail) {
    console.info("[prism-3d-perf]", detail);
    this.dispatchEvent(new CustomEvent("prism-semantic-viewer:ready", {
      bubbles: true,
      composed: true,
      detail,
    }));
  }

  emitError(error) {
    this.dispatchEvent(new CustomEvent("prism-semantic-viewer:error", { bubbles: true, detail: { error } }));
  }
}

// AC-30: the board and common members, routed to the controller.
installModeMembers(PrismSemanticViewerElement.prototype);

export function definePrismSemanticViewer() {
  if (!customElements.get("prism-semantic-viewer")) {
    customElements.define("prism-semantic-viewer", PrismSemanticViewerElement);
  }
}
