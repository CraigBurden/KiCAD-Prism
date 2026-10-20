/**
 * `window.prismSystemBuilder` (CONTRACTS §14.6): the schematic for scripts
 * and agents, by meaning (connectors, pads, nets, patterns), never by
 * rectangle. Every write builds one `prism.system.ops.a0` request through the
 * same session as the UI, carrying the version the script last read.
 */
import { acceptOps, groupOps } from "../board/board-edits";
import { buildBoardScene } from "../board/board-scene";
import { subPortMembers } from "../board/grouping";
import { newId } from "../model/ids";
import type { BundleSuggestion, Edge, SystemBundle, SystemDocument, SystemOp, SystemRecord } from "../model/types";
import { harnessOps, mateOps, movePort as movePortLayout, resizeSymbol, connectRefusal, layoutOps, moveSymbols } from "../schematic/edits";
import { PIN_GRID_NM, GRID_NM, clampOffset, edgeLength, resize, snap } from "../schematic/geometry";
import { buildScene, naturalCompare, type Scene } from "../schematic/scene";

export interface ScriptDeps {
  record: () => SystemRecord | undefined;
  bundle: () => SystemBundle | undefined;
  /** Apply one request, refused as stale when the system is not at `expectVersion`. */
  apply: (ops: SystemOp[], expectVersion: number) => Promise<SystemRecord>;
  reload: () => Promise<SystemRecord>;
  undo: () => Promise<SystemRecord | undefined>;
  open: (sheet: string | null) => void;
  select: (ids: string[]) => void;
  unfold: (occurrence: string, connector: string, unfolded: boolean) => void;
  isUnfolded: (occurrence: string, connector: string) => boolean;
}

export interface PinRefIn {
  occurrence: string;
  connector: string;
}

function fail(message: string): never {
  throw new Error(message);
}

/** The pads of one connector that a selector names (§14.6): pads, net names, or a pattern over pin nets. */
export function resolvePads(
  bundle: SystemBundle | undefined,
  occurrence: string,
  connector: string,
  selector: { pads?: string[]; nets?: string[]; netPattern?: string },
): string[] {
  const found = bundle?.occurrences.find((item) => item.occurrence === occurrence)?.connectors.find((item) => item.refdes === connector);
  if (!found) fail(`${occurrence}/${connector} is not in the system bundle (is the board's bundle built?)`);
  const pins = found.pins;
  let pads: string[];
  if (selector.pads) {
    const known = new Set(pins.map((pin) => pin.pad));
    const unknown = selector.pads.filter((pad) => !known.has(pad));
    if (unknown.length) fail(`${connector} has no pad ${unknown.join(", ")}`);
    pads = [...selector.pads];
  } else if (selector.nets) {
    const wanted = new Set(selector.nets);
    pads = pins.flatMap((pin) => (pin.nets.some((net) => wanted.has(net)) || (pin.net !== undefined && wanted.has(pin.net)) ? [pin.pad] : []));
  } else if (selector.netPattern) {
    const pattern = new RegExp(selector.netPattern);
    pads = pins.flatMap((pin) => (pin.nets.some((net) => pattern.test(net)) ? [pin.pad] : []));
    pads.sort(naturalCompare);
  } else {
    fail("Name pads, nets or a netPattern");
  }
  if (!pads.length) fail(`Nothing on ${connector} matches`);
  return pads;
}

export function createScriptApi(deps: ScriptDeps) {
  let lastRead: number | undefined;
  const read = () => {
    const record = deps.record() ?? fail("The system is not loaded yet");
    lastRead ??= record.version;
    return record;
  };
  const write = async (ops: SystemOp[]) => {
    if (!ops.length) fail("Nothing to change");
    read();
    const next = await deps.apply(ops, lastRead as number);
    lastRead = next.version;
    return { version: next.version };
  };
  const document = (): SystemDocument => read().document;
  const rootScene = (): Scene => buildScene(document(), deps.bundle());

  return {
    /** The system as read; re-reads, so later writes build on it. */
    async system() {
      const record = await deps.reload();
      lastRead = record.version;
      return { systemId: record.systemId, version: record.version, document: record.document };
    },

    bundle(): SystemBundle | undefined {
      return deps.bundle();
    },

    /** The root sheet (no argument) or a board occurrence's sheet, as data. */
    describeSheet(sheet?: string) {
      const doc = document();
      if (!sheet) {
        const scene = rootScene();
        return {
          sheet: "root",
          symbols: scene.symbols.map((symbol) => ({
            id: symbol.id,
            kind: symbol.kind,
            label: symbol.label,
            state: symbol.state,
            rect: { xNm: symbol.rect.x, yNm: symbol.rect.y, widthNm: symbol.rect.w, heightNm: symbol.rect.h },
            pins: symbol.ports.map((port) => ({ key: port.key, edge: port.edge, offsetNm: port.offsetNm, xNm: port.point.x, yNm: port.point.y, missing: port.missing, connected: port.connected })),
          })),
          connections: scene.connections.map((connection) => ({
            id: connection.id,
            kind: connection.kind,
            harness: connection.harness,
            a: connection.a,
            b: connection.b,
            route: connection.points.map((point) => ({ xNm: point.x, yNm: point.y })),
            stored: connection.stored,
            dangling: connection.dangling,
          })),
        };
      }
      const unfolded = new Set<string>();
      for (const connector of deps.bundle()?.occurrences.find((item) => item.occurrence === sheet)?.connectors ?? []) {
        if (deps.isUnfolded(sheet, connector.refdes)) unfolded.add(connector.refdes);
      }
      const scene = buildBoardScene(doc, deps.bundle(), sheet, { unfolded }) ?? fail(`${sheet} is not a board occurrence`);
      return {
        sheet,
        label: scene.label,
        state: scene.state,
        connectors: scene.connectors.map((connector) => ({
          refdes: connector.refdes,
          edge: connector.edge,
          unfolded: connector.unfolded,
          label: connector.label.text,
          pins: connector.pins.map((pin) => ({ pad: pin.pad, net: pin.net, nets: pin.nets, power: pin.power })),
          subPorts: connector.subPorts.map((subPort) => ({ id: subPort.id, name: subPort.name, pins: subPort.pins, members: subPortMembers(subPort, connector.pins), suggestion: subPort.suggestion })),
          suggestions: connector.suggestions.map((item) => ({ key: item.key, name: item.name, source: item.source, pins: item.pins })),
        })),
      };
    },

    /** Group pads as an occurrence-level sub-port (§14.3 G). */
    async createSubPort(input: PinRefIn & { pads?: string[]; nets?: string[]; netPattern?: string; name: string; id?: string }) {
      const pads = resolvePads(deps.bundle(), input.occurrence, input.connector, input);
      return write(groupOps(input.occurrence, input.connector, pads, input.name, input.id ?? newId("sub")));
    },

    /** Accept bundle suggestions: some keys, or "all", on one connector or the whole board. */
    async acceptSuggestions(input: { occurrence: string; connector?: string; keys?: string[] | "all" }) {
      const all = (deps.bundle()?.suggestions ?? []).filter(
        (item: BundleSuggestion) => item.occurrence === input.occurrence && (!input.connector || item.connector === input.connector),
      );
      const keys = input.keys ?? "all";
      const wanted = new Set(keys === "all" ? [] : keys);
      const chosen = keys === "all" ? all : all.filter((item) => wanted.has(item.key));
      if (keys !== "all") {
        const found = new Set(chosen.map((item) => item.key));
        const missing = keys.filter((key) => !found.has(key));
        if (missing.length) fail(`No open suggestion ${missing.join(", ")}`);
      }
      return write(acceptOps(input.occurrence, chosen));
    },

    /** Move a sheet pin on the root sheet (§14.4: snapped, clear of corners, not onto another pin). */
    async movePort(input: { item: string; key: string; edge: Edge; offsetNm: number }) {
      const scene = rootScene();
      const symbol = scene.symbols.find((item) => item.id === input.item) ?? fail(`No symbol ${input.item} on the root sheet`);
      if (!symbol.ports.some((port) => port.key === input.key)) fail(`${input.item} has no pin ${input.key}`);
      const size = { widthNm: symbol.rect.w, heightNm: symbol.rect.h };
      const offsetNm = clampOffset({ edge: input.edge, offsetNm: snap(input.offsetNm, PIN_GRID_NM) }, size, symbol.corner);
      if (Math.abs(offsetNm - snap(input.offsetNm, PIN_GRID_NM)) > 0 && edgeLength(input.edge, size) > 0) {
        fail(`Offset ${input.offsetNm} leaves the edge or enters a corner; nearest allowed is ${offsetNm}`);
      }
      const taken = symbol.ports.some((port) => port.key !== input.key && port.edge === input.edge && port.offsetNm === offsetNm);
      if (taken) fail(`Another pin already sits at ${input.edge} ${offsetNm}`);
      return write(layoutOps(document(), movePortLayout(document(), scene, input.item, input.key, { edge: input.edge, offsetNm })));
    },

    /** Resize a sheet symbol, no smaller than its pins allow (§14.4). */
    async resizeSheet(input: { item: string; widthNm: number; heightNm: number }) {
      const scene = rootScene();
      const symbol = scene.symbols.find((item) => item.id === input.item) ?? fail(`No symbol ${input.item} on the root sheet`);
      const ports = Object.fromEntries(symbol.ports.map((port) => [port.key, { edge: port.edge, offsetNm: port.offsetNm }]));
      const resized = resize(symbol.rect, "bottom-right", { x: symbol.rect.x + input.widthNm, y: symbol.rect.y + input.heightNm }, ports, symbol.corner);
      return write(layoutOps(document(), resizeSymbol(document(), scene, input.item, resized.rect, resized.ports)));
    },

    /** Place a symbol at a point (snapped to the 1.27 mm grid). */
    async place(input: { item: string; xNm: number; yNm: number }) {
      const scene = rootScene();
      const symbol = scene.symbols.find((item) => item.id === input.item) ?? fail(`No symbol ${input.item} on the root sheet`);
      const delta = { x: snap(input.xNm, GRID_NM) - symbol.rect.x, y: snap(input.yNm, GRID_NM) - symbol.rect.y };
      return write(layoutOps(document(), moveSymbols(document(), scene, [input.item], delta)));
    },

    /** A B2B mate or a harness link between two connectors. */
    async connect(input: { a: PinRefIn; b: PinRefIn; kind: "mate" | "harness" }) {
      const a = { item: input.a.occurrence, key: input.a.connector };
      const b = { item: input.b.occurrence, key: input.b.connector };
      const refusal = connectRefusal(document(), input.kind, a, b);
      if (refusal) fail(refusal);
      return write(input.kind === "mate" ? mateOps(a, b) : harnessOps(document(), a, b));
    },

    /** Any request, as is. */
    async apply(ops: SystemOp[]) {
      return write(ops);
    },

    async undo() {
      const next = await deps.undo();
      if (next) lastRead = next.version;
      return next ? { version: next.version } : null;
    },

    /** View only: open a board's sheet (or the root with no argument), select objects, unfold a connector. */
    open(sheet?: string) {
      deps.open(sheet ?? null);
    },
    select(ids: string[]) {
      deps.select(ids);
    },
    unfold(input: PinRefIn & { unfolded?: boolean }) {
      deps.unfold(input.occurrence, input.connector, input.unfolded ?? true);
    },
  };
}

export type PrismSystemBuilder = ReturnType<typeof createScriptApi>;

declare global {
  interface Window {
    prismSystemBuilder?: PrismSystemBuilder;
  }
}
