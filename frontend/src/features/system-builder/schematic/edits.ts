/**
 * Root-sheet gestures as layout overrides and ops (CONTRACTS §14.3). A
 * gesture builds an override while it runs (the canvas draws it through
 * `buildScene`), and on release becomes one request: one undo step.
 */
import { newId } from "../model/ids";
import type {
  Occurrence,
  PortPlacement,
  SchematicPlacement,
  SubPort,
  SystemBundle,
  SystemDocument,
  SystemOp,
} from "../model/types";
import {
  GRID_NM,
  PIN_GRID_NM,
  SYMBOL_GAP_NM,
  dragSegment,
  followEnds,
  fromPoints,
  snap,
  toPoints,
  type Point,
  type Rect,
} from "./geometry";
import { buildScene, type Scene, type SceneOptions } from "./scene";

export type Layout = SystemDocument["layout"];

const BLANK: SchematicPlacement = { xNm: 0, yNm: 0, rotationDeg: 0, mirror: false };

/** The placement an item has now: its stored entry, or where the defaults put it. */
export function placementOf(document: SystemDocument, scene: Scene, id: string, override: Layout = {}): SchematicPlacement {
  const stored = override[id] ?? document.layout[id];
  if (stored) return stored;
  const symbol = scene.symbols.find((item) => item.id === id);
  return symbol ? { ...BLANK, xNm: symbol.rect.x, yNm: symbol.rect.y } : { ...BLANK };
}

/** Symbols moved by a snapped delta; their pins' stored routes follow. */
export function moveSymbols(document: SystemDocument, scene: Scene, ids: readonly string[], delta: Point): Layout {
  const dx = snap(delta.x, GRID_NM);
  const dy = snap(delta.y, GRID_NM);
  const override: Layout = {};
  for (const id of ids) {
    const placement = placementOf(document, scene, id);
    override[id] = { ...placement, xNm: placement.xNm + dx, yNm: placement.yNm + dy };
  }
  return override;
}

/** One pin moved along its symbol's border. */
export function movePort(document: SystemDocument, scene: Scene, item: string, key: string, port: PortPlacement): Layout {
  const placement = placementOf(document, scene, item);
  return { [item]: { ...placement, ports: { ...placement.ports, [key]: port } } };
}

/**
 * A symbol resized: its new rectangle and every pin's placement, stored so
 * no pin jumps to a default spread for the new size (§14.4).
 */
export function resizeSymbol(document: SystemDocument, scene: Scene, item: string, rect: Rect, ports: Record<string, PortPlacement>): Layout {
  const placement = placementOf(document, scene, item);
  return {
    [item]: {
      ...placement,
      xNm: rect.x,
      yNm: rect.y,
      size: { widthNm: rect.w, heightNm: rect.h },
      ports: { ...placement.ports, ...ports },
    },
  };
}

/** A connection's route with one segment dragged; an auto-route becomes stored. */
export function dragRoute(document: SystemDocument, scene: Scene, connection: string, segment: number, pointer: Point): Layout {
  const drawn = scene.connections.find((item) => item.id === connection);
  if (!drawn || drawn.points.length < 2) return {};
  const placement = placementOf(document, scene, connection);
  const points = dragSegment(drawn.points, segment, pointer);
  return points.length >= 2 ? { [connection]: { ...placement, route: fromPoints(points) as SchematicPlacement["route"] } } : {};
}

/**
 * Add the stored routes that must follow an override (KiCad's drag): any
 * connection whose route is stored and whose pins the override moved.
 */
export function withFollowingRoutes(
  document: SystemDocument,
  bundle: SystemBundle | undefined,
  before: Scene,
  override: Layout,
  options: SceneOptions = {},
): Layout {
  const after = buildScene(document, bundle, { ...options, override });
  const pin = (scene: Scene, item: string, key: string) =>
    scene.symbols.find((symbol) => symbol.id === item)?.ports.find((port) => port.key === key)?.point;
  const out: Layout = { ...override };
  for (const connection of after.connections) {
    const stored = out[connection.id]?.route ?? document.layout[connection.id]?.route;
    if (!stored) continue;
    const a = pin(after, connection.a.item, connection.a.key);
    const b = pin(after, connection.b.item, connection.b.key);
    const a0 = pin(before, connection.a.item, connection.a.key);
    const b0 = pin(before, connection.b.item, connection.b.key);
    if (!a || !b || !a0 || !b0) continue;
    if (a.x === a0.x && a.y === a0.y && b.x === b0.x && b.y === b0.y) continue;
    const points = followEnds(toPoints(stored), a, b);
    if (points.length < 2) continue;
    out[connection.id] = { ...(out[connection.id] ?? document.layout[connection.id] ?? BLANK), route: fromPoints(points) as SchematicPlacement["route"] };
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** `set-layout` for each entry the override changes. */
export function layoutOps(document: SystemDocument, override: Layout): SystemOp[] {
  return Object.entries(override)
    .filter(([item, placement]) => !same(document.layout[item], placement))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([item, placement]) => ({ kind: "set-layout", item, placement }));
}

// ------------------------------------------------------------------ objects

export interface PinRef {
  item: string;
  key: string;
}

/** A B2B mate between two whole connectors (§2.4), drawn on the root sheet. */
export function mateOps(a: PinRef, b: PinRef, id = newId("mate")): SystemOp[] {
  return [{
    kind: "add-mate",
    mate: {
      id,
      a: { occurrence: a.item, connector: a.key },
      b: { occurrence: b.item, connector: b.key },
      orientation: { quarterTurns: 0, flip: false },
      rows: {},
    },
  }];
}

/**
 * A harness link between two connectors (§3.2 `connect-harness`): it joins
 * the block either connector already belongs to, or a new one.
 */
export function harnessOps(document: SystemDocument, a: PinRef, b: PinRef, ids = { harness: newId("har"), a: newId("end"), b: newId("end"), link: newId("link") }): SystemOp[] {
  const blockOf = (pin: PinRef) =>
    document.harnesses.find((harness) => harness.ends.some((end) => end.site?.occurrence === pin.item && end.site.connector === pin.key));
  const existing = blockOf(a) ?? blockOf(b);
  const label = `H${document.harnesses.length + 1}`;
  return [{
    kind: "connect-harness",
    ...(existing ? { harness: existing.id } : { newHarness: { id: ids.harness, label } }),
    newEnds: { a: ids.a, b: ids.b },
    link: {
      id: ids.link,
      a: { occurrence: a.item, connector: a.key },
      b: { occurrence: b.item, connector: b.key },
      unmapped: [],
    },
  }];
}

/** Can these two pins be joined by `kind`? A reason when not. */
export function connectRefusal(document: SystemDocument, kind: "mate" | "harness", a: PinRef, b: PinRef): string | null {
  if (a.item === b.item && a.key === b.key) return "Pick a different connector.";
  const occurrences = new Set(document.occurrences.map((item) => item.id));
  if (!occurrences.has(a.item) || !occurrences.has(b.item)) return "Connect two board connectors.";
  const mated = (pin: PinRef) =>
    document.mates.some((mate) => (mate.a.occurrence === pin.item && mate.a.connector === pin.key) || (mate.b.occurrence === pin.item && mate.b.connector === pin.key));
  const harnessed = (pin: PinRef) =>
    document.harnesses.some((harness) => harness.ends.some((end) => end.site?.occurrence === pin.item && end.site.connector === pin.key));
  if (kind === "mate") {
    if (a.item === b.item) return "A board cannot mate with itself.";
    if (mated(a) || mated(b)) return "A connector mates with one connector only.";
    if (harnessed(a) || harnessed(b)) return "That connector already goes to a harness.";
  } else {
    if (mated(a) || mated(b)) return "That connector is already mated.";
    const blockOf = (pin: PinRef) =>
      document.harnesses.find((harness) => harness.ends.some((end) => end.site?.occurrence === pin.item && end.site.connector === pin.key))?.id;
    const blockA = blockOf(a);
    const blockB = blockOf(b);
    if (blockA && blockB && blockA !== blockB) return "Those connectors belong to different harnesses.";
  }
  return null;
}

/** Remove the selected objects in one request; cascades are the server's (§3.2). */
export function removeOps(document: SystemDocument, selected: readonly string[]): SystemOp[] {
  const ids = new Set(selected);
  const ops: SystemOp[] = [];
  for (const occurrence of document.occurrences) if (ids.has(occurrence.id)) ops.push({ kind: "remove-occurrence", id: occurrence.id });
  for (const harness of document.harnesses) {
    if (ids.has(harness.id)) {
      ops.push({ kind: "remove-harness", id: harness.id });
      continue;
    }
    for (const end of harness.ends) {
      if (ids.has(end.id) && !(end.site && ids.has(end.site.occurrence))) ops.push({ kind: "remove-end", harness: harness.id, id: end.id });
    }
  }
  const goneOccurrences = new Set<string>();
  for (const occurrence of document.occurrences) if (ids.has(occurrence.id)) goneOccurrences.add(occurrence.id);
  for (const mate of document.mates) {
    if (ids.has(mate.id) && !goneOccurrences.has(mate.a.occurrence) && !goneOccurrences.has(mate.b.occurrence)) {
      ops.push({ kind: "remove-mate", id: mate.id });
    }
  }
  return ops;
}

export interface NewBoard {
  label: string;
  projectId: string;
  track: { kind: "followed"; branch: string; commit: string } | { kind: "pinned"; commit: string };
}

/** Place a new symbol `item` to the right of what is drawn, level with its top (§14.3). */
export function nextSlotOp(scene: Scene, item: string): SystemOp {
  const placed = scene.symbols;
  const right = placed.length ? Math.max(...placed.map((symbol) => symbol.rect.x + symbol.rect.w)) + SYMBOL_GAP_NM : 0;
  const top = placed.length ? Math.min(...placed.map((symbol) => symbol.rect.y)) : 0;
  return { kind: "set-layout", item, placement: { ...BLANK, xNm: snap(right, PIN_GRID_NM), yNm: snap(top, PIN_GRID_NM) } };
}

/**
 * "Add board" (§14.3): the occurrence, its position to the right of what is
 * drawn, and a copy of the sub-ports of the first occurrence of the same
 * project (new ids; a copy, not a link).
 */
export function addBoardOps(document: SystemDocument, scene: Scene, board: NewBoard, makeId: typeof newId = newId): { ops: SystemOp[]; occurrence: string } {
  const id = makeId("occ");
  const occurrence: Occurrence = {
    id,
    label: board.label,
    source: { kind: "board", projectId: board.projectId, track: board.track },
  };
  const ops: SystemOp[] = [
    { kind: "add-occurrence", occurrence },
    nextSlotOp(scene, id),
  ];
  const sibling = [...document.occurrences]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .find((item) => item.source.kind === "board" && item.source.projectId === board.projectId);
  if (sibling) {
    for (const subPort of document.subPorts.filter((item) => item.occurrence === sibling.id)) {
      const copy: SubPort = { id: makeId("sub"), occurrence: id, connector: subPort.connector, name: subPort.name, pins: [...subPort.pins] };
      if (subPort.suggestion) copy.suggestion = subPort.suggestion;
      ops.push({ kind: "add-sub-port", subPort: copy });
    }
  }
  return { ops, occurrence: id };
}

/** Rename an occurrence or a harness block. */
export function renameOps(document: SystemDocument, id: string, label: string): SystemOp[] {
  const occurrence = document.occurrences.find((item) => item.id === id);
  if (occurrence) return [{ kind: "replace-occurrence", occurrence: { ...occurrence, label } }];
  const harness = document.harnesses.find((item) => item.id === id);
  if (harness) return [{ kind: "replace-harness", harness: { id: harness.id, label, ...(harness.sheet ? { sheet: harness.sheet } : {}) } }];
  return [];
}
