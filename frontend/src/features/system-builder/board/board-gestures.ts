/**
 * Board-sheet gestures as pure functions: which wires a drag box picks
 * (KiCad's window and crossing), and the interior a drag of the board symbol,
 * a pin or a label makes (§14.3).
 */
import type { Interior, SystemDocument } from "../model/types";
import { GRID_NM, boundsOf, rectContains, rectTouchesRoute, slidePort, snap, type Point, type Rect } from "../schematic/geometry";
import { wireKey, type BoardScene } from "./board-scene";

export type BoardDrag =
  | { kind: "pan"; last: Point }
  | { kind: "box"; start: Point; current: Point }
  | { kind: "symbol"; start: Point; active: boolean; screen: Point }
  | { kind: "pin"; refdes: string; active: boolean; screen: Point }
  | { kind: "label"; refdes: string; active: boolean; screen: Point };

export function boxWires(scene: BoardScene, rect: Rect, mode: "window" | "crossing"): Set<string> {
  const out = new Set<string>();
  for (const connector of scene.connectors) {
    for (const wire of connector.wires) {
      const path = [wire.tap, wire.start, wire.end];
      if (mode === "window" ? rectContains(rect, boundsOf(path)) : rectTouchesRoute(rect, path)) out.add(wireKey(wire.connector, wire.pad));
    }
  }
  return out;
}

/** The stored interior, or an empty one. */
export function storedInterior(document: SystemDocument, occurrence: string): Interior {
  return document.layout[occurrence]?.interior ?? {};
}

/** The interior a layout drag makes with the pointer at `at`; `null` when nothing changes. */
export function interiorDrag(drag: BoardDrag, at: Point, scene: BoardScene, stored: Interior): Interior | null {
  if (drag.kind === "symbol") {
    const { symbol } = scene;
    const dx = snap(at.x - drag.start.x, GRID_NM);
    const dy = snap(at.y - drag.start.y, GRID_NM);
    return { ...stored, symbol: { xNm: symbol.x + dx, yNm: symbol.y + dy, widthNm: symbol.w, heightNm: symbol.h } };
  }
  if (drag.kind === "pin") {
    const others = scene.connectors.flatMap((item) => (item.refdes === drag.refdes ? [] : [{ edge: item.edge, offsetNm: item.offsetNm }]));
    const placed = slidePort(scene.symbol, { widthNm: scene.symbol.w, heightNm: scene.symbol.h }, at, others, scene.corner);
    return placed ? { ...stored, pins: { ...stored.pins, [drag.refdes]: placed } } : null;
  }
  if (drag.kind === "label") {
    const connector = scene.connectors.find((item) => item.refdes === drag.refdes);
    if (!connector) return null;
    return { ...stored, labels: { ...stored.labels, [drag.refdes]: { xNm: snap(at.x, GRID_NM), yNm: snap(at.y, GRID_NM), rotationDeg: connector.label.rotationDeg } } };
  }
  return null;
}
