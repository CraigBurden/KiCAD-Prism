/**
 * The harness canvas's gestures as data (CONTRACTS §16.5): what a pointer hit
 * names as a terminal, where an object lands in nanometres, and the layout a
 * drag in progress previews. The canvas keeps the gesture's state; this module
 * only turns the document and the pointer into values.
 */
import type { SystemDocument } from "../model/types";
import { NM_PER_PX, type Point } from "./harness-layout";
import type { HarnessView, TerminalView } from "./harness-view";

export interface CanvasHit {
  hit: string;
  id: string;
  key: string;
}

/**
 * A pin dot on an end (`key` is its cavity), or the wire dot at the centre of a
 * splice or loose end (`key` is `node`). Anything else is not a terminal.
 */
export function terminalAt(view: HarnessView, hit: CanvasHit | null): TerminalView | null {
  if (hit?.hit !== "pin") return null;
  if (hit.key === "node") {
    if (view.splices.some((splice) => splice.id === hit.id)) return { kind: "splice", splice: hit.id };
    if (view.looseEnds.some((loose) => loose.id === hit.id)) return { kind: "loose", looseEnd: hit.id };
    return null;
  }
  const end = view.ends.find((item) => item.id === hit.id);
  const pin = end?.pins.find((row) => row.cavity === hit.key);
  return pin ? { kind: "contact", end: hit.id, cavity: hit.key, ...(pin.pad ? { pad: pin.pad } : {}) } : null;
}

/** A point on the tab's canvas in the document's nanometres (`canvas` is in nm, §2.8). */
export function pointNm(point: Point): { xNm: number; yNm: number } {
  return { xNm: Math.round(point.x * NM_PER_PX), yNm: Math.round(point.y * NM_PER_PX) };
}

/** An object being dragged: a card's top-left, or a node's centre. */
export interface MovingObject {
  id: string;
  point: Point;
}

/** `document.layout` with the dragged object's canvas overridden. */
export function previewLayout(document: SystemDocument, move: MovingObject | null): SystemDocument["layout"] {
  if (!move) return document.layout;
  const placement = document.layout[move.id] ?? { xNm: 0, yNm: 0, rotationDeg: 0, mirror: false };
  return { ...document.layout, [move.id]: { ...placement, canvas: pointNm(move.point) } };
}

/** The point a moving object's anchor sits at, given the pointer and where the drag grabbed it. */
export function moveTo(pointer: Point, grab: Point): Point {
  return { x: pointer.x - grab.x, y: pointer.y - grab.y };
}

/** The object a selection's first id names, for the inspector's Remove button. */
export type ObjectKind = "splice" | "loose" | "branch" | "cable" | "covering" | "segment";

export function objectKind(view: HarnessView, id: string): ObjectKind | null {
  if (view.splices.some((item) => item.id === id)) return "splice";
  if (view.looseEnds.some((item) => item.id === id)) return "loose";
  if (view.branchPoints.some((item) => item.id === id)) return "branch";
  if (view.cables.some((item) => item.id === id)) return "cable";
  if (view.coverings.some((item) => item.id === id)) return "covering";
  if (view.segments.some((item) => item.id === id)) return "segment";
  return null;
}

/** The `remove-*` op a selection id names, or null for an object with none. */
export function removeObjectOp(view: HarnessView, id: string) {
  switch (objectKind(view, id)) {
    case "splice":
      return { kind: "remove-splice", harness: view.id, id } as const;
    case "loose":
      return { kind: "remove-loose-end", harness: view.id, id } as const;
    case "branch":
      return { kind: "remove-branch-point", harness: view.id, id } as const;
    case "cable":
      return { kind: "remove-cable", harness: view.id, id } as const;
    case "covering":
      return { kind: "remove-covering", harness: view.id, id } as const;
    case "segment":
      return { kind: "remove-segment", harness: view.id, id } as const;
    default:
      return null;
  }
}
