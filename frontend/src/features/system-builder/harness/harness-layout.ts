/**
 * The harness tab's canvas (stage 4b, CONTRACTS §16.5): ends as cards, nodes in
 * a middle column, and the paths wires and segments draw between them. Canvas
 * units are pixels; a stored `layout[id].canvas` is in nanometres.
 */
import type { SystemDocument } from "../model/types";
import type { HarnessView, TerminalView } from "./harness-view";

export interface Point {
  x: number;
  y: number;
}

export const NM_PER_PX = 100_000;
export const CARD_WIDTH = 280;
export const CARD_HEADER = 74;
export const ROW = 30;
export const STRIP = 6;

const LEFT_X = 40;
const RIGHT_X = LEFT_X + CARD_WIDTH + 520;
const COLUMN_TOP = 80;
const CARD_GAP = 40;
const NODE_X = LEFT_X + CARD_WIDTH + 260;
const NODE_TOP = 120;
const NODE_STEP = 70;
const STUB = 24;
const PADDING = 80;

export interface PlacedEnd {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  side: "left" | "right";
  pins: { cavity: string; pad: string; point: Point; rowY: number }[];
}

export interface PlacedNode {
  id: string;
  kind: "splice" | "loose" | "branch-point";
  point: Point;
}

export interface HarnessLayout {
  ends: PlacedEnd[];
  nodes: PlacedNode[];
  wires: { id: string; points: Point[] }[];
  segments: { id: string; points: Point[] }[];
  width: number;
  height: number;
}

interface TerminalPoint {
  point: Point;
  /** The side of the card it leaves, or null for a node. */
  side: "left" | "right" | null;
}

const cardHeight = (pins: number) => CARD_HEADER + ROW * Math.max(1, pins) + 16;

const stripX = (end: PlacedEnd) => (end.side === "left" ? end.x + end.width + STRIP : end.x - STRIP);

const middleY = (end: PlacedEnd) => end.y + end.height / 2;

function resolveTerminal(ends: PlacedEnd[], nodes: PlacedNode[], terminal: TerminalView): TerminalPoint | null {
  if (terminal.kind === "splice") {
    const node = nodes.find((item) => item.id === terminal.splice);
    return node ? { point: node.point, side: null } : null;
  }
  if (terminal.kind === "loose") {
    const node = nodes.find((item) => item.id === terminal.looseEnd);
    return node ? { point: node.point, side: null } : null;
  }
  const end = ends.find((item) => item.id === terminal.end);
  if (!end) return null;
  const row = end.pins.find((pin) => pin.cavity === terminal.cavity);
  return {
    point: row ? row.point : { x: stripX(end), y: middleY(end) },
    side: end.side,
  };
}

/** The terminal's point on the canvas, or null when the block does not hold it. */
export function terminalPoint(placed: HarnessLayout, terminal: TerminalView): Point | null {
  return resolveTerminal(placed.ends, placed.nodes, terminal)?.point ?? null;
}

/** Move a point clear of its card; a node has no stub. */
function stub(terminal: TerminalPoint): Point {
  if (terminal.side === "left") return { x: terminal.point.x + STUB, y: terminal.point.y };
  if (terminal.side === "right") return { x: terminal.point.x - STUB, y: terminal.point.y };
  return terminal.point;
}

function dedupe(points: Point[]): Point[] {
  return points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
}

function segmentPoint(ends: PlacedEnd[], nodes: PlacedNode[], node: { kind: "end"; end: string } | { kind: "branch-point"; branchPoint: string }): Point | null {
  if (node.kind === "end") {
    const end = ends.find((item) => item.id === node.end);
    return end ? { x: stripX(end), y: middleY(end) } : null;
  }
  return nodes.find((item) => item.id === node.branchPoint)?.point ?? null;
}

export function layoutHarness(view: HarnessView, layout: SystemDocument["layout"]): HarnessLayout {
  const cursors = { left: COLUMN_TOP, right: COLUMN_TOP };
  const ends: PlacedEnd[] = view.ends.map((end) => {
    const height = cardHeight(end.pins.length);
    const side = end.side;
    const autoX = side === "left" ? LEFT_X : RIGHT_X;
    const autoY = cursors[side];
    cursors[side] += height + CARD_GAP;
    const canvas = layout[end.id]?.canvas;
    const x = canvas ? canvas.xNm / NM_PER_PX : autoX;
    const y = canvas ? canvas.yNm / NM_PER_PX : autoY;
    const placed: PlacedEnd = {
      id: end.id,
      x,
      y,
      width: CARD_WIDTH,
      height,
      side,
      pins: end.pins.map((pin, index) => {
        const rowY = y + CARD_HEADER + ROW / 2 + index * ROW;
        return { cavity: pin.cavity, pad: pin.pad, point: { x: side === "left" ? x + CARD_WIDTH + STRIP : x - STRIP, y: rowY }, rowY };
      }),
    };
    return placed;
  });

  const nodeSpecs = [
    ...view.splices.map((splice) => ({ id: splice.id, kind: "splice" as const })),
    ...view.branchPoints.map((point) => ({ id: point.id, kind: "branch-point" as const })),
    ...view.looseEnds.map((loose) => ({ id: loose.id, kind: "loose" as const })),
  ];
  const nodes: PlacedNode[] = nodeSpecs.map((spec, index) => {
    const canvas = layout[spec.id]?.canvas;
    return {
      id: spec.id,
      kind: spec.kind,
      point: canvas
        ? { x: canvas.xNm / NM_PER_PX, y: canvas.yNm / NM_PER_PX }
        : { x: NODE_X, y: NODE_TOP + index * NODE_STEP },
    };
  });

  const wires = view.wires.flatMap((wire) => {
    const from = resolveTerminal(ends, nodes, wire.from);
    const to = resolveTerminal(ends, nodes, wire.to);
    if (!from || !to) return [];
    const s0 = stub(from);
    const s1 = stub(to);
    const mx = (s0.x + s1.x) / 2;
    const points = dedupe([from.point, s0, { x: mx, y: s0.y }, { x: mx, y: s1.y }, s1, to.point]);
    return [{ id: wire.id, points }];
  });

  const segments = view.segments.flatMap((segment) => {
    const from = segmentPoint(ends, nodes, segment.from);
    const to = segmentPoint(ends, nodes, segment.to);
    return from && to ? [{ id: segment.id, points: [from, to] }] : [];
  });

  let maxX = 0;
  let maxY = 0;
  for (const end of ends) {
    maxX = Math.max(maxX, end.x + end.width);
    maxY = Math.max(maxY, end.y + end.height);
  }
  for (const node of nodes) {
    maxX = Math.max(maxX, node.point.x);
    maxY = Math.max(maxY, node.point.y);
  }
  for (const path of [...wires, ...segments]) {
    for (const point of path.points) {
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return { ends, nodes, wires, segments, width: maxX + PADDING, height: maxY + PADDING };
}
