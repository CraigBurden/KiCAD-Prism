#!/usr/bin/env node
// VT-00 pixel-diff and frame-time runner for <prism-semantic-viewer>.
// Usage and the meaning of each number: see README.md next to this file.
import { readFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildElement } from "./build-element.mjs";
import { launchChrome } from "./chrome.mjs";
import { diffImages, encodePng } from "./image.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const options = parseArgs(process.argv.slice(2));
if (options.help || !options.boards.length || !options.builds.length) {
  process.stdout.write(readFileSync(join(here, "README.md"), "utf8"));
  process.exit(options.help ? 0 : 2);
}

const outDir = resolve(options.out || join(here, "out", new Date().toISOString().replace(/[:.]/g, "-")));
mkdirSync(outDir, { recursive: true });
const buildDir = mkdtempSync(join(tmpdir(), "vt-builds-"));

const log = (...parts) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...parts);

const summary = { startedAt: new Date().toISOString(), options: { ...options }, builds: {}, boards: {}, diffs: [], perf: [], loads: [], failures: [] };

try {
  for (const build of options.builds) {
    log(`build ${build.name} ← ${build.spec}`);
    summary.builds[build.name] = buildElement(build.spec, join(buildDir, `${build.name}.js`));
  }
  for (const board of options.boards) {
    const bundle = JSON.parse(readFileSync(join(board.dir, "bundle.json"), "utf8"));
    summary.boards[board.name] = {
      dir: board.dir,
      project: bundle.project_name,
      generator: bundle.generator?.build ?? null,
      generatedAt: bundle.generated_at ?? null,
    };
  }

  const server = await serve({ builds: buildDir, boards: options.boards });
  const chrome = await launchChrome({ headless: !options.headed });
  const captures = new Map(); // `${board}/${build}/${view}/${rep}` → image
  try {
    for (const board of options.boards) {
      for (let rep = 0; rep < options.repeat; rep += 1) {
        for (const build of options.builds) {
          await runOne({ chrome, server, board, build, rep, captures });
        }
      }
      if (options.perf) for (const build of options.builds) await runOne({ chrome, server, board, build, rep: "perf", captures });
      compare(board, captures);
      for (const key of [...captures.keys()]) if (key.startsWith(`${board.name}/`)) captures.delete(key);
    }
  } finally {
    await chrome.close();
    server.close();
  }
} catch (error) {
  summary.failures.push(`error: ${error.message}`);
  console.error(error);
} finally {
  rmSync(buildDir, { recursive: true, force: true });
  summary.finishedAt = new Date().toISOString();
  writeFileSync(join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  report();
  process.exitCode = summary.failures.length ? 1 : 0;
}

async function runOne({ chrome, server, board, build, rep, captures }) {
  const label = `${board.name}/${build.name}#${rep}`;
  const page = await chrome.newPage({ width: options.width, height: options.height, deviceScaleFactor: options.scale });
  try {
    if (options.warm && rep !== "perf") {
      // Prime: one load in this page's context fills the OPFS cache (the bundle
      // and the analytic board's lowered slices); the measured load follows.
      await page.goto(`${server.origin}/harness/harness.html?build=${encodeURIComponent(build.name)}`);
      await waitFor(page, "window.__vtElementLoaded === true", 30000, `${label}: element module (prime)`);
      await page.evaluate(`window.__vtProbe.mount(${JSON.stringify(`/bundles/${board.name}/bundle.json`)}, ${JSON.stringify({ width: options.width, height: options.height })})`);
      await settle(page, `${label} prime`);
      await sleep(1500); // the cache writes finish in the background
    }
    const started = Date.now();
    await page.goto(`${server.origin}/harness/harness.html?build=${encodeURIComponent(build.name)}`);
    await waitFor(page, "window.__vtElementLoaded === true", 30000, `${label}: element module`);
    await page.evaluate(`window.__vtProbe.mount(${JSON.stringify(`/bundles/${board.name}/bundle.json`)}, ${JSON.stringify({ width: options.width, height: options.height })})`);
    log(`${label} ready in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    if (options.load && rep !== "perf") {
      await settle(page, `${label} load`);
      const times = await page.evaluate("window.__vtProbe.loadTimes()");
      const bytes = page.bytesLoaded ?? null;
      summary.loads.push({ board: board.name, build: build.name, rep, ...times, bytes });
      log(`${label}: ready ${times.readyMs} ms, first drawn ${times.firstDrawnMs} ms, components ${times.componentsMs} ms, last change ${times.lastChangeMs} ms`);
    }
    // Perf gets a load of its own, so the orbit starts from the loaded camera.
    if (rep === "perf") {
      await settle(page, `${label} perf`);
      const perf = await page.evaluate(`window.__vtProbe.orbit(${JSON.stringify({ orbitMs: options.orbitMs })})`);
      summary.perf.push({ board: board.name, build: build.name, ...perf });
      log(`${label}: interval p50 ${perf.intervalP50Ms} / p95 ${perf.intervalP95Ms} ms, cpu p95 ${perf.cpuP95Ms} ms, gpu submit p95 ${perf.gpuSubmitP95Ms} ms`);
    }
    for (const view of rep === "perf" ? [] : options.views) {
      await page.evaluate(`window.__vtProbe.applyView(${JSON.stringify(view)})`);
      const settled = await settle(page, `${label} ${view}`);
      const frame = await page.evaluate("window.__vtProbe.capture()");
      if (!frame) throw new Error(`${label} ${view}: no rendered frame to capture`);
      const image = { width: frame.width, height: frame.height, data: new Uint8Array(Buffer.from(frame.rgba, "base64")) };
      captures.set(`${board.name}/${build.name}/${view}/${rep}`, image);
      const file = join(outDir, board.name, `${build.name}-${view}-${rep}.png`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, encodePng(image));
      log(`${label} ${view}: ${frame.hash} after ${settled.toFixed(1)} s`);
    }
    if (page.errors.length) summary.failures.push(`${label}: page errors: ${[...new Set(page.errors)].slice(0, 5).join(" | ")}`);
  } finally {
    await page.close();
  }
}

// Settled: no request in flight for 1 s, and the last `stableFrames` rendered
// frames identical over at least 1 s (the viewer redraws once a second when
// idle, so a run of identical frames spans an idle refresh).
async function settle(page, label) {
  const started = Date.now();
  for (;;) {
    const status = await page.evaluate("window.__vtProbe.frameStatus()");
    if (page.networkIdle(1000) && status.stable >= options.stableFrames && status.stableMs >= 1000) return (Date.now() - started) / 1000;
    if (Date.now() - started > options.timeoutMs) {
      const pending = [...page.inflight].map((id) => page.urls?.get(id) || id).slice(0, 8).join(", ");
      throw new Error(`${label}: did not settle in ${options.timeoutMs / 1000} s (in flight ${page.inflight.size}: ${pending}; stable ${status.stable}/${options.stableFrames}, frames ${status.frames})`);
    }
    await sleep(250);
  }
}

function compare(board, captures) {
  const [reference, ...others] = options.builds;
  for (const view of options.views) {
    const strict = options.strict.includes(view);
    const record = (kind, a, b, image) => {
      const left = captures.get(a);
      const right = captures.get(b);
      if (!left || !right) return;
      const result = diffImages(left, right, { tolerance: options.tolerance });
      const entry = { board: board.name, view, kind, a, b, comparable: result.comparable, pixels: result.pixels ?? null, maxDelta: result.maxDelta ?? null, bbox: result.bbox ?? null, strict };
      if (result.comparable && result.pixels) {
        const file = join(outDir, board.name, `diff-${image}.png`);
        writeFileSync(file, encodePng(result.image));
        entry.diffImage = file;
      }
      summary.diffs.push(entry);
      if (!result.comparable) summary.failures.push(`${a} vs ${b}: ${result.reason}`);
      else if (strict && result.pixels > options.maxPx) summary.failures.push(`${a} vs ${b}: ${result.pixels} px differ (max ${options.maxPx})`);
    };
    // Noise floor: the same build loaded twice.
    for (const build of options.builds) {
      for (let rep = 1; rep < options.repeat; rep += 1) {
        record("noise", `${board.name}/${build.name}/${view}/0`, `${board.name}/${build.name}/${view}/${rep}`, `noise-${build.name}-${view}-0-${rep}`);
      }
    }
    // Each other build against the reference, load for load.
    for (const build of others) {
      for (let rep = 0; rep < options.repeat; rep += 1) {
        record("build", `${board.name}/${reference.name}/${view}/${rep}`, `${board.name}/${build.name}/${view}/${rep}`, `${reference.name}-vs-${build.name}-${view}-${rep}`);
      }
    }
  }
}

function report() {
  console.log("\nboard      view       kind   pair                                            px      maxΔ");
  for (const entry of summary.diffs) {
    const pair = `${entry.a.split("/").slice(1).join("/")} ↔ ${entry.b.split("/").slice(1).join("/")}`;
    console.log(`${entry.board.padEnd(10)} ${entry.view.padEnd(10)} ${entry.kind.padEnd(6)} ${pair.padEnd(47)} ${String(entry.pixels ?? "n/a").padStart(7)} ${String(entry.maxDelta ?? "").padStart(5)}${entry.strict ? "  strict" : ""}`);
  }
  if (summary.loads.length) {
    console.log("\nboard      build        rep  ready ms  first ms  parts ms  last ms     MB");
    for (const l of summary.loads) {
      console.log(`${l.board.padEnd(10)} ${l.build.padEnd(12)} ${String(l.rep).padStart(3)} ${String(l.readyMs).padStart(9)} ${String(l.firstDrawnMs).padStart(9)} ${String(l.componentsMs).padStart(9)} ${String(l.lastChangeMs).padStart(8)} ${l.bytes === null ? "" : (l.bytes / 1e6).toFixed(1).padStart(6)}`);
    }
  }
  if (summary.perf.length) {
    console.log("\nboard      build        frames  int p50  int p95  cpu p95  gpu p50  gpu p95  tris       MB");
    for (const p of summary.perf) {
      console.log(`${p.board.padEnd(10)} ${p.build.padEnd(12)} ${String(p.frames).padStart(6)} ${String(p.intervalP50Ms).padStart(8)} ${String(p.intervalP95Ms).padStart(8)} ${String(p.cpuP95Ms).padStart(8)} ${String(p.gpuSubmitP50Ms).padStart(8)} ${String(p.gpuSubmitP95Ms).padStart(8)} ${String(p.triangles).padStart(10)} ${String(p.gpuMemoryMB).padStart(6)}`);
    }
  }
  console.log(`\n${summary.failures.length ? "FAIL" : "PASS"} — ${outDir}`);
  for (const failure of summary.failures) console.log(`  ${failure}`);
}

function serve({ builds, boards }) {
  const roots = new Map([["harness", here], ["builds", builds], ...boards.map((board) => [`bundles/${board.name}`, board.dir])]);
  const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".bin": "application/octet-stream", ".css": "text/css", ".wasm": "application/wasm" };
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "");
    const prefix = [...roots.keys()].filter((key) => path === key || path.startsWith(`${key}/`)).sort((a, b) => b.length - a.length)[0];
    if (!prefix) return void response.writeHead(404).end();
    const root = roots.get(prefix);
    const file = resolve(root, path.slice(prefix.length + 1));
    if (!(file === root || file.startsWith(root + sep)) || !existsSync(file) || !statSync(file).isFile()) return void response.writeHead(404).end();
    response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(readFileSync(file));
  });
  return new Promise((resolveServer) => server.listen(0, "127.0.0.1", () => {
    resolveServer({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
  }));
}

async function waitFor(page, expression, timeoutMs, label) {
  const started = Date.now();
  while (!(await page.evaluate(expression))) {
    if (Date.now() - started > timeoutMs) throw new Error(`${label}: timed out after ${timeoutMs / 1000} s; ${page.errors.join(" | ")}`);
    await sleep(200);
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

// A board directory is the one holding bundle.json, or a parent with exactly
// one such child (the semantic-visualizer layout: <revision>/<generator>/bundle.json).
function bundleDir(path) {
  const dir = resolve(path);
  if (existsSync(join(dir, "bundle.json"))) return dir;
  const children = readdirSync(dir).filter((name) => existsSync(join(dir, name, "bundle.json")));
  if (children.length === 1) return join(dir, children[0]);
  throw new Error(`${path}: no bundle.json (or more than one generator directory)`);
}

function parseArgs(argv) {
  const parsed = {
    boards: [],
    builds: [],
    views: ["default", "exploded", "top"],
    strict: ["default", "exploded", "top"],
    repeat: 2,
    perf: false,
    load: false,
    warm: false,
    orbitMs: 4000,
    width: 1280,
    height: 800,
    scale: 1,
    tolerance: 0,
    maxPx: 0,
    stableFrames: 3,
    timeoutMs: 240000,
    headed: false,
    out: null,
    help: false,
  };
  const named = (value, flag) => {
    const at = value.indexOf("=");
    if (at <= 0) throw new Error(`${flag} expects name=value, got ${value}`);
    return [value.slice(0, at), value.slice(at + 1)];
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = () => argv[++i];
    if (flag === "--board") { const [name, path] = named(value(), flag); parsed.boards.push({ name, dir: bundleDir(path) }); }
    else if (flag === "--build") { const [name, spec] = named(value(), flag); parsed.builds.push({ name, spec }); }
    else if (flag === "--views") parsed.views = value().split(",").filter(Boolean);
    else if (flag === "--strict") parsed.strict = value().split(",").filter(Boolean);
    else if (flag === "--repeat") parsed.repeat = Math.max(1, Number(value()));
    else if (flag === "--perf") parsed.perf = true;
    else if (flag === "--load") parsed.load = true;
    else if (flag === "--warm") parsed.warm = true;
    else if (flag === "--orbit-ms") parsed.orbitMs = Number(value());
    else if (flag === "--size") [parsed.width, parsed.height] = value().split("x").map(Number);
    else if (flag === "--scale") parsed.scale = Number(value());
    else if (flag === "--tolerance") parsed.tolerance = Number(value());
    else if (flag === "--max-px") parsed.maxPx = Number(value());
    else if (flag === "--timeout") parsed.timeoutMs = Number(value()) * 1000;
    else if (flag === "--headed") parsed.headed = true;
    else if (flag === "--out") parsed.out = value();
    else if (flag === "--help" || flag === "-h") parsed.help = true;
    else throw new Error(`unknown option ${flag}`);
  }
  // Axis views move the camera for good, so they go after the others.
  const moves = (view) => (view === "top" || view === "bottom" ? 1 : 0);
  parsed.views.sort((a, b) => moves(a) - moves(b));
  return parsed;
}
