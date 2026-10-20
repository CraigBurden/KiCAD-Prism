/**
 * `window.prismSystemBuilder` (CONTRACTS §14.6): the schematic and the
 * placement for scripts and agents, by meaning (connectors, pads, nets, patterns), never by
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
import { eulerDegrees, rotationFromEuler } from "../placement/poses";
import { poseOps, positioningMateOps } from "../three-d/pose-edits";
import { manualMapOps, orientationOps, rowNameOps, spacerOps, stackHeightOps } from "../b2b/mate-edits";
import { buildMateView } from "../b2b/mate-view";
import { publishSystem } from "../model/api";
import { exportAt, pinNameOps, renameExportOps, toggleExportOps } from "../publish/export-edits";
import { addCableOps, addLooseEndOps, addSpliceOps, addWireOps, removeWireOps, setEndOps, setWireOps } from "../harness/harness-edits";
import { buildHarnessView, type PartRef, type TerminalView } from "../harness/harness-view";

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
  openMate: (mate: string) => void;
  openHarness: (harness: string) => void;
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
  const harnessView = (harness: string) => buildHarnessView(document(), deps.bundle(), harness) ?? fail(`No harness ${harness}`);

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

    /** Where every occurrence sits (§8.9), in millimetres and degrees (turns about x, then y, then z). */
    describePlacement() {
      const doc = document();
      const placement = deps.bundle()?.placement ?? fail("The system bundle has not placed the boards yet");
      const labels = new Map(doc.occurrences.map((item) => [item.id, item.label]));
      return {
        occurrences: placement.occurrences.map((item) => ({
          occurrence: item.occurrence,
          label: labels.get(item.occurrence) ?? item.occurrence,
          translationMm: [item.pose.translation.xNm / 1e6, item.pose.translation.yNm / 1e6, item.pose.translation.zNm / 1e6],
          rotationDeg: eulerDegrees([item.pose.rotation.x, item.pose.rotation.y, item.pose.rotation.z, item.pose.rotation.w]),
          source: item.source,
          root: item.root,
          positioningMate: item.positioningMate ?? null,
          movable: item.root,
        })),
        mates: placement.mates,
      };
    },

    /** Move a free board or a group's root (a mated board follows its mate; move its root instead). */
    async setPose(input: { occurrence: string; translationMm: [number, number, number]; rotationDeg?: [number, number, number] }) {
      const placed = deps.bundle()?.placement?.occurrences.find((item) => item.occurrence === input.occurrence);
      if (placed && !placed.root) fail(`${input.occurrence} is placed by mate ${placed.positioningMate ?? "?"}; move its group's root instead`);
      if (input.translationMm.length !== 3 || input.translationMm.some((value) => !Number.isFinite(value))) fail("translationMm needs three numbers");
      return write(poseOps(document(), input.occurrence, { translationMm: input.translationMm, rotation: rotationFromEuler(input.rotationDeg ?? [0, 0, 0]) }));
    },

    /** Drop a board's stored pose: it takes its slot in the default row. */
    async resetPose(occurrence: string) {
      return write(poseOps(document(), occurrence, null));
    },

    /** Choose which mate positions an occurrence; null goes back to the automatic choice. */
    async setPositioningMate(input: { occurrence: string; mate: string | null }) {
      if (input.mate && !document().mates.some((mate) => mate.id === input.mate && (mate.a.occurrence === input.occurrence || mate.b.occurrence === input.occurrence))) {
        fail(`${input.mate} is not a mate of ${input.occurrence}`);
      }
      return write(positioningMateOps(document(), input.occurrence, input.mate));
    },

    /** A B2B mate as its tab shows it (§15.2): sides, rows with both nets, notes, pads landed. */
    describeMate(mate: string) {
      const view = buildMateView(document(), deps.bundle(), mate) ?? fail(`No mate ${mate}`);
      return {
        mate: view.id,
        a: view.a,
        b: view.b,
        source: view.source,
        orientation: view.orientation,
        stackHeightMm: view.stackHeightNm === null ? null : view.stackHeightNm / 1e6,
        heightSource: view.heightSource,
        spacerMm: view.spacerNm / 1e6,
        landed: view.landed,
        total: view.total,
        rows: view.rows,
      };
    },

    /** Turn, flip, stack height (null: from clearance) and spacer of a mate, in one request. */
    async setMate(input: { mate: string; quarterTurns?: number; flip?: boolean; stackHeightMm?: number | null; spacerMm?: number }) {
      let doc = document();
      const ops: SystemOp[] = [];
      const step = (next: SystemOp[]) => {
        ops.splice(0, ops.length, ...next);
        doc = { ...doc, mates: doc.mates.map((item) => (item.id === input.mate ? (next[0] as { mate: typeof item }).mate : item)) };
      };
      if (input.quarterTurns !== undefined || input.flip !== undefined) step(orientationOps(doc, input.mate, input));
      if (input.stackHeightMm !== undefined) step(stackHeightOps(doc, input.mate, input.stackHeightMm));
      if (input.spacerMm !== undefined) step(spacerOps(doc, input.mate, input.spacerMm));
      return write(ops);
    },

    /** A mapping row's system name, by its side A pad; empty clears it. */
    async nameMateRow(input: { mate: string; pad: string; name: string }) {
      return write(rowNameOps(document(), input.mate, input.pad, input.name));
    },

    /** Replace a mate's derived mapping with pairs; null goes back to geometry. */
    async setManualMap(input: { mate: string; pairs: { a: string; b: string }[] | null }) {
      return write(manualMapOps(document(), input.mate, input.pairs));
    },

    /** View only: open a mate's B2B tab beside the 3D tab. */
    openMate(mate: string) {
      if (!document().mates.some((item) => item.id === mate)) fail(`No mate ${mate}`);
      deps.openMate(mate);
    },

    /** View only: open a harness tab. */
    openHarness(harness: string) {
      if (!document().harnesses.some((item) => item.id === harness)) fail(`No harness ${harness}`);
      deps.openHarness(harness);
    },

    /** A harness as its tab shows it (§16.5), as plain data. */
    describeHarness(harness: string) {
      const view = harnessView(harness);
      return {
        id: view.id,
        label: view.label,
        ends: view.ends.map((end) => ({
          id: end.id,
          title: end.title,
          subtitle: end.subtitle,
          side: end.side,
          attached: end.attached,
          occurrence: end.occurrence ?? null,
          connector: end.connector ?? null,
          mpn: end.mpn ?? null,
          housing: end.housing ?? null,
          housingResolved: end.housingResolved ?? null,
          contacts: end.contacts,
          pinMap: end.pinMap,
          pins: end.pins,
        })),
        wires: view.wires,
        splices: view.splices,
        looseEnds: view.looseEnds,
        cables: view.cables,
        coverings: view.coverings,
        branchPoints: view.branchPoints,
        segments: view.segments,
        findings: view.findings,
        pending: view.pending,
      };
    },

    /** A wire between two terminals; `link` fills when one link joins their sites. */
    async addWire(input: { harness: string; from: TerminalView; to: TerminalView; gaugeAwg?: string; colour?: string; label?: string }) {
      const view = harnessView(input.harness);
      const id = newId("wire");
      return { id, ...(await write(addWireOps(view, input.from, input.to, { gaugeAwg: input.gaugeAwg, colour: input.colour, label: input.label }, id))) };
    },

    /** Change a wire; a default wire id `<link>:<pad>` becomes explicit. */
    async setWire(input: {
      harness: string;
      wire: string;
      gaugeAwg?: string | null;
      colour?: string | null;
      label?: string | null;
      lengthNm?: number | null;
    }) {
      const view = harnessView(input.harness);
      const changes: { gaugeAwg?: string | null; colour?: string | null; label?: string | null; lengthNm?: number | null } = {};
      if (input.gaugeAwg !== undefined) changes.gaugeAwg = input.gaugeAwg;
      if (input.colour !== undefined) changes.colour = input.colour;
      if (input.label !== undefined) changes.label = input.label;
      if (input.lengthNm !== undefined) changes.lengthNm = input.lengthNm;
      // A default wire becomes a new explicit wire; its id is returned.
      const explicit = view.wires.find((wire) => wire.id === input.wire)?.origin === "explicit";
      const id = explicit ? input.wire : newId("wire");
      return { id, ...(await write(setWireOps(view, input.wire, changes, id))) };
    },

    /** Remove an explicit wire, or a default wire's pin from its link. */
    async removeWire(input: { harness: string; wire: string }) {
      return write(removeWireOps(harnessView(input.harness), input.wire));
    },

    /** An end's housing, contacts and pin map in one request. */
    async setEnd(input: {
      harness: string;
      end: string;
      housing?: PartRef | null;
      contacts?: Record<string, PartRef>;
      pinMap?: { cavity: string; pad: string }[];
    }) {
      const view = harnessView(input.harness);
      const changes: { housing?: PartRef | null; contacts?: Record<string, PartRef>; pinMap?: { cavity: string; pad: string }[] } = {};
      if (input.housing !== undefined) changes.housing = input.housing;
      if (input.contacts !== undefined) changes.contacts = input.contacts;
      if (input.pinMap !== undefined) changes.pinMap = input.pinMap;
      return write(setEndOps(view, input.end, changes));
    },

    /** Add a crimp splice, placed by auto-layout. */
    async addSplice(input: { harness: string }) {
      const view = harnessView(input.harness);
      const id = newId("spl");
      return { id, ...(await write(addSpliceOps(document(), view, undefined, id))) };
    },

    /** Add a pigtail, placed by auto-layout. */
    async addLooseEnd(input: { harness: string }) {
      const view = harnessView(input.harness);
      const id = newId("pt");
      return { id, ...(await write(addLooseEndOps(document(), view, undefined, id))) };
    },

    /** Bind wires into a cable, with an optional catalog cable part. */
    async addCable(input: { harness: string; wires: string[]; part?: PartRef }) {
      const id = newId("cab");
      return { id, ...(await write(addCableOps(harnessView(input.harness), input.wires, input.part, id))) };
    },

    /**
     * Export a connector, or one of its occurrence-level sub-ports by id, under
     * `name` (default its refdes or sub-port name); renames an existing export (§15.4).
     */
    async setExport(input: PinRefIn & { subPort?: string; name?: string }) {
      const doc = document();
      const site = { occurrence: input.occurrence, connector: input.connector, subPort: input.subPort };
      const existing = exportAt(doc, site);
      if (existing) {
        if (!input.name) return { id: existing.id, version: read().version };
        const result = await write(renameExportOps(doc, existing, input.name));
        return { id: existing.id, ...result };
      }
      const ops = toggleExportOps(doc, site);
      const added = ops[0];
      if (added.kind !== "add-export") fail("Could not export that site");
      if (input.name) added.export.name = input.name.trim();
      const result = await write(ops);
      return { id: added.export.id, ...result };
    },

    async removeExport(id: string) {
      if (!document().exports.some((item) => item.id === id)) fail(`No export ${id}`);
      return write([{ kind: "remove-export", id }]);
    },

    /** Name one pin of an export in the published interface; empty clears it. */
    async namePin(input: { export: string; pad: string; name: string }) {
      const item = document().exports.find((candidate) => candidate.id === input.export) ?? fail(`No export ${input.export}`);
      return write(pinNameOps(item, input.pad, input.name));
    },

    /** Publish the system at the version last read (§11.2); refusals throw with their code. */
    async publish(input: { identity?: "in-house" | "bought-out"; ipn?: string; manufacturer?: string; mpn?: string; changeSummary: string }) {
      const record = read();
      return publishSystem(record.systemId, lastRead ?? record.version, input);
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
