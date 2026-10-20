/**
 * Schematic geometry (CONTRACTS §14.2, §14.4): pure functions over integer
 * nanometres in sheet coordinates, KiCad's: x to the right, y down. A sheet
 * symbol is a rectangle anchored at its top-left corner; its pins sit on the
 * border, each at an edge and an offset from that edge's top or left end.
 *
 * Nothing here reads the document or the bundle; `scene.ts` feeds it.
 */
import type { Edge, PortPlacement, SchematicPoint } from "../model/types";

export const GRID_NM = 1_270_000;
export const PIN_GRID_NM = 2_540_000;
export const SHEET_LONG_SIDE_NM = 50_800_000;
export const PIN_SPACING_NM = 5_080_000;
export const SHEET_CORNER_NM = 10_160_000;
export const HARNESS_SIZE: Size = { widthNm: 30_480_000, heightNm: 20_320_000 };
/** A harness block is small; its pins keep this much from each corner. */
export const HARNESS_CORNER_NM = 5_080_000;
export const STUB_NM = 5_080_000;
/** Gap between symbols placed by default (§14.2). */
export const SYMBOL_GAP_NM = 25_400_000;

export interface Size {
  widthNm: number;
  heightNm: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  w: number;
  h: number;
}

export const EDGES: readonly Edge[] = ["left", "top", "right", "bottom"];

/** Outward unit normal of an edge, on screen (y down). */
export const NORMAL: Record<Edge, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

export function snap(value: number, grid = GRID_NM): number {
  return Math.round(value / grid) * grid;
}

function ceilTo(value: number, grid: number): number {
  return Math.ceil(value / grid) * grid;
}

/** An edge's length: left and right run along the height. */
export function edgeLength(edge: Edge, size: Size): number {
  return edge === "left" || edge === "right" ? size.heightNm : size.widthNm;
}

/**
 * Where the ray from the rectangle's centre at `angleDeg` (counter-clockwise
 * from +x, +y up, as the bundle gives it) leaves the rectangle.
 */
export function castAngle(angleDeg: number, size: Size): PortPlacement {
  const radians = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = -Math.sin(radians); // the screen's y grows down
  const hw = size.widthNm / 2;
  const hh = size.heightNm / 2;
  const tx = Math.abs(dx) < 1e-12 ? Infinity : hw / Math.abs(dx);
  const ty = Math.abs(dy) < 1e-12 ? Infinity : hh / Math.abs(dy);
  if (tx <= ty) {
    const y = hh + dy * tx;
    return { edge: dx > 0 ? "right" : "left", offsetNm: y };
  }
  const x = hw + dx * ty;
  return { edge: dy > 0 ? "bottom" : "top", offsetNm: x };
}

export interface AngledPort {
  key: string;
  /** Absent: no placement in the bundle; spread along the left edge. */
  angleDeg?: number;
}

/** Each port's edge for a rectangle of this aspect; the same at any scale. */
function edgesByAngle(ports: readonly AngledPort[], size: Size): Map<string, PortPlacement> {
  const out = new Map<string, PortPlacement>();
  for (const port of ports) {
    if (port.angleDeg !== undefined) out.set(port.key, castAngle(port.angleDeg, size));
  }
  return out;
}

/**
 * Spread ports along one edge to `spacing`, keeping their order: first forward
 * from the near corner, then back from the far one, so none leaves the edge
 * (§14.2). Offsets are snapped to the pin grid. When the edge is too short for
 * them all, the forward pass wins and the drawing clamps (§2.8).
 */
export function spreadAlongEdge(offsets: readonly number[], length: number, corner: number, spacing = PIN_SPACING_NM): number[] {
  const low = Math.min(corner, length / 2);
  const high = Math.max(length - corner, length / 2);
  const out: number[] = [];
  let last = -Infinity;
  for (const offset of offsets) {
    const value = ceilTo(Math.max(offset, last + spacing, low) - PIN_GRID_NM / 2, PIN_GRID_NM);
    out.push(value);
    last = value;
  }
  let next = Math.floor(high / PIN_GRID_NM) * PIN_GRID_NM + spacing;
  for (let index = out.length - 1; index >= 0; index -= 1) {
    out[index] = Math.min(out[index], next - spacing);
    next = out[index];
  }
  return out;
}

/** Room an edge needs for `count` pins (§14.2). */
export function neededLength(count: number, corner: number): number {
  return count === 0 ? 0 : 2 * corner + (count - 1) * PIN_SPACING_NM;
}

/**
 * A board sheet's default size (§14.2): the outline's aspect with the longer
 * side 50.8 mm, grown evenly until each edge fits its pins. Without an outline
 * it is square.
 */
export function defaultSheetSize(outline: Size | undefined, ports: readonly AngledPort[]): Size {
  const aspect = outline && outline.widthNm > 0 && outline.heightNm > 0 ? outline.widthNm / outline.heightNm : 1;
  const base: Size = aspect >= 1
    ? { widthNm: SHEET_LONG_SIDE_NM, heightNm: SHEET_LONG_SIDE_NM / aspect }
    : { widthNm: SHEET_LONG_SIDE_NM * aspect, heightNm: SHEET_LONG_SIDE_NM };
  const counts: Record<Edge, number> = { left: 0, right: 0, top: 0, bottom: 0 };
  for (const placed of edgesByAngle(ports, base).values()) counts[placed.edge] += 1;
  counts.left += ports.filter((port) => port.angleDeg === undefined).length;
  const grow = Math.max(
    1,
    neededLength(Math.max(counts.left, counts.right), SHEET_CORNER_NM) / base.heightNm,
    neededLength(Math.max(counts.top, counts.bottom), SHEET_CORNER_NM) / base.widthNm,
  );
  return {
    widthNm: Math.max(2 * SHEET_CORNER_NM, ceilTo(base.widthNm * grow, PIN_GRID_NM)),
    heightNm: Math.max(2 * SHEET_CORNER_NM, ceilTo(base.heightNm * grow, PIN_GRID_NM)),
  };
}

/**
 * Default pin placements (§14.2): each port where its angle leaves the
 * rectangle, then spread per edge; ports without an angle are spread evenly
 * down the left edge in the order given, after any angled ones there.
 */
export function defaultPorts(ports: readonly AngledPort[], size: Size, corner = SHEET_CORNER_NM): Record<string, PortPlacement> {
  const cast = edgesByAngle(ports, size);
  const byEdge: Record<Edge, { key: string; offset: number }[]> = { left: [], right: [], top: [], bottom: [] };
  for (const [key, placed] of cast) byEdge[placed.edge].push({ key, offset: placed.offsetNm });
  const unplaced = ports.filter((port) => port.angleDeg === undefined);
  const out: Record<string, PortPlacement> = {};
  for (const edge of EDGES) {
    const items = byEdge[edge].sort((a, b) => a.offset - b.offset || (a.key < b.key ? -1 : 1));
    if (edge === "left") {
      for (const port of unplaced) items.push({ key: port.key, offset: Infinity });
    }
    const length = edgeLength(edge, size);
    const spread = spreadAlongEdge(items.map((item) => (Number.isFinite(item.offset) ? item.offset : 0)), length, corner);
    items.forEach((item, index) => {
      out[item.key] = { edge, offsetNm: spread[index] };
    });
  }
  return out;
}

/** An offset as drawn: clamped to the edge, clear of the corners where it can be (§2.8). */
export function clampOffset(placement: PortPlacement, size: Size, corner = SHEET_CORNER_NM): number {
  const length = edgeLength(placement.edge, size);
  const low = Math.min(corner, length / 2);
  const high = Math.max(length - corner, length / 2);
  return Math.min(Math.max(placement.offsetNm, low), high);
}

/** A pin's point on the border, in sheet coordinates. */
export function portPoint(origin: Point, size: Size, placement: PortPlacement, corner = SHEET_CORNER_NM): Point {
  const offset = clampOffset(placement, size, corner);
  switch (placement.edge) {
    case "left":
      return { x: origin.x, y: origin.y + offset };
    case "right":
      return { x: origin.x + size.widthNm, y: origin.y + offset };
    case "top":
      return { x: origin.x + offset, y: origin.y };
    case "bottom":
      return { x: origin.x + offset, y: origin.y + size.heightNm };
  }
}

/**
 * Where a dragged pin lands (§14.4): on the nearest edge to the pointer,
 * snapped to the pin grid and clear of the corners, so dragging past a corner
 * moves it onto the next edge. `null` when another pin already holds that spot.
 */
export function slidePort(
  origin: Point,
  size: Size,
  pointer: Point,
  others: readonly PortPlacement[],
  corner = SHEET_CORNER_NM,
): PortPlacement | null {
  const local = { x: pointer.x - origin.x, y: pointer.y - origin.y };
  const distance: Record<Edge, number> = {
    left: Math.abs(local.x),
    right: Math.abs(size.widthNm - local.x),
    top: Math.abs(local.y),
    bottom: Math.abs(size.heightNm - local.y),
  };
  // Outside the rectangle along one axis, the nearest edge is the one on that side.
  if (local.y >= 0 && local.y <= size.heightNm) {
    if (local.x < 0) distance.left = -1;
    if (local.x > size.widthNm) distance.right = -1;
  }
  if (local.x >= 0 && local.x <= size.widthNm) {
    if (local.y < 0) distance.top = -1;
    if (local.y > size.heightNm) distance.bottom = -1;
  }
  const edge = EDGES.reduce((best, candidate) => (distance[candidate] < distance[best] ? candidate : best), EDGES[0]);
  const along = edge === "left" || edge === "right" ? local.y : local.x;
  const placed: PortPlacement = { edge, offsetNm: snap(along, PIN_GRID_NM) };
  const length = edgeLength(edge, size);
  const low = ceilTo(Math.min(corner, length / 2), PIN_GRID_NM);
  const high = Math.floor(Math.max(length - corner, length / 2) / PIN_GRID_NM) * PIN_GRID_NM;
  placed.offsetNm = Math.min(Math.max(placed.offsetNm, low), Math.max(low, high));
  const taken = others.some((other) => other.edge === placed.edge && clampOffset(other, size, corner) === placed.offsetNm);
  return taken ? null : placed;
}

/** Which corner a resize handle drags. */
export type Handle = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/**
 * Resize from a handle (§14.4): the opposite corner stays and the size snaps
 * to the pin grid. Pins keep their place on the sheet, so a moving left or top
 * edge shifts the offsets of the pins on the edges crossing it. The size never
 * drops below what keeps every pin clear of the corners.
 */
export function resize(
  rect: Rect,
  handle: Handle,
  pointer: Point,
  ports: Record<string, PortPlacement>,
  corner = SHEET_CORNER_NM,
): { rect: Rect; ports: Record<string, PortPlacement> } {
  const movesLeft = handle.endsWith("left");
  const movesTop = handle.startsWith("top");
  const along = (horizontal: boolean) => {
    const offsets: number[] = [];
    for (const port of Object.values(ports)) {
      if ((port.edge === "top" || port.edge === "bottom") === horizontal) offsets.push(port.offsetNm);
    }
    return offsets;
  };
  const floor = (offsets: number[], fromStart: boolean, current: number) => {
    if (offsets.length === 0) return 2 * corner;
    // From the start, the nearest pin must keep `corner` from the new start;
    // from the end, the furthest pin must keep `corner` from the new end.
    return fromStart ? current - Math.min(...offsets) + corner : Math.max(...offsets) + corner;
  };
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  const wanted = {
    w: snap(movesLeft ? right - pointer.x : pointer.x - rect.x, PIN_GRID_NM),
    h: snap(movesTop ? bottom - pointer.y : pointer.y - rect.y, PIN_GRID_NM),
  };
  const w = Math.max(wanted.w, 2 * corner, ceilTo(floor(along(true), movesLeft, rect.w), PIN_GRID_NM));
  const h = Math.max(wanted.h, 2 * corner, ceilTo(floor(along(false), movesTop, rect.h), PIN_GRID_NM));
  const dx = movesLeft ? w - rect.w : 0;
  const dy = movesTop ? h - rect.h : 0;
  const moved: Record<string, PortPlacement> = {};
  for (const [key, port] of Object.entries(ports)) {
    const horizontal = port.edge === "top" || port.edge === "bottom";
    moved[key] = { ...port, offsetNm: port.offsetNm + (horizontal ? dx : dy) };
  }
  return { rect: { x: movesLeft ? right - w : rect.x, y: movesTop ? bottom - h : rect.y, w, h }, ports: moved };
}

// ------------------------------------------------------------------ routes

export interface Terminal {
  point: Point;
  edge: Edge;
}

function stub(terminal: Terminal): Point {
  const normal = NORMAL[terminal.edge];
  return { x: terminal.point.x + normal.x * STUB_NM, y: terminal.point.y + normal.y * STUB_NM };
}

function segmentHitsRect(a: Point, b: Point, rect: Rect): boolean {
  // Orthogonal segments only; touching the border does not count.
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return maxX > rect.x && minX < rect.x + rect.w && maxY > rect.y && minY < rect.y + rect.h;
}

function crossings(points: readonly Point[], obstacles: readonly Rect[]): number {
  let count = 0;
  for (let index = 1; index < points.length; index += 1) {
    for (const rect of obstacles) if (segmentHitsRect(points[index - 1], points[index], rect)) count += 1;
  }
  return count;
}

function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.abs(points[index].x - points[index - 1].x) + Math.abs(points[index].y - points[index - 1].y);
  }
  return total;
}

/**
 * The default route (§14.2): out from each pin along its edge's normal by
 * 5.08 mm, then at most two bends between the stubs, preferring a path that
 * crosses no symbol, then the shorter one. When each of those crosses a
 * symbol, a detour round the symbols in the way is tried as well.
 */
export function autoRoute(a: Terminal, b: Terminal, obstacles: readonly Rect[] = []): Point[] {
  const sa = stub(a);
  const sb = stub(b);
  const midX = snap((sa.x + sb.x) / 2);
  const midY = snap((sa.y + sb.y) / 2);
  const middles: Point[][] = [
    [{ x: sb.x, y: sa.y }],
    [{ x: sa.x, y: sb.y }],
    [{ x: midX, y: sa.y }, { x: midX, y: sb.y }],
    [{ x: sa.x, y: midY }, { x: sb.x, y: midY }],
  ];
  // When every path with two bends crosses a symbol, detour round the ones in
  // the way: out past their top, bottom, left or right side.
  const blocking = obstacles.filter((rect) => middles.some((middle) => crossings([sa, ...middle, sb], [rect]) > 0));
  if (blocking.length) {
    const gap = 2 * STUB_NM;
    const top = snap(Math.min(...blocking.map((rect) => rect.y)) - gap);
    const bottom = snap(Math.max(...blocking.map((rect) => rect.y + rect.h)) + gap);
    const left = snap(Math.min(...blocking.map((rect) => rect.x)) - gap);
    const right = snap(Math.max(...blocking.map((rect) => rect.x + rect.w)) + gap);
    for (const y of [top, bottom]) middles.push([{ x: sa.x, y }, { x: sb.x, y }]);
    for (const x of [left, right]) middles.push([{ x, y: sa.y }, { x, y: sb.y }]);
  }
  let best: Point[] | null = null;
  let bestScore = Infinity;
  for (const middle of middles) {
    const path = simplifyRoute([a.point, sa, ...middle, sb, b.point]);
    // The stubs leave the symbols they start on; only the part between them is checked.
    const score = crossings([sa, ...middle, sb], obstacles) * 1e15 + pathLength(path);
    if (score < bestScore) {
      best = path;
      bestScore = score;
    }
  }
  return best ?? [a.point, b.point];
}

/** A stored route is minimal (§14.4): no zero-length segments, collinear runs merged. */
export function simplifyRoute(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last && last.x === point.x && last.y === point.y) continue;
    out.push(point);
    while (out.length >= 3) {
      const [p, q, r] = out.slice(-3);
      const collinear = (p.x === q.x && q.x === r.x) || (p.y === q.y && q.y === r.y);
      if (!collinear) break;
      out.splice(out.length - 2, 1);
    }
  }
  return out;
}

/**
 * Drag one segment of an orthogonal route (§14.3): a horizontal segment moves
 * vertically, a vertical one horizontally, and its neighbours stretch. The
 * end segments are never moved off their pins: dragging one inserts a bend.
 */
export function dragSegment(points: readonly Point[], index: number, to: Point): Point[] {
  if (index < 0 || index >= points.length - 1) return [...points];
  const a = points[index];
  const b = points[index + 1];
  const horizontal = a.y === b.y;
  const next = points.map((point) => ({ ...point }));
  const value = snap(horizontal ? to.y : to.x);
  if (index === 0 || index === points.length - 2) {
    // Keep the pin's point: replace the segment with a jog through the new line.
    const moved = horizontal ? [{ x: a.x, y: value }, { x: b.x, y: value }] : [{ x: value, y: a.y }, { x: value, y: b.y }];
    next.splice(index + 1, 0, ...moved);
    return simplifyRoute(next);
  }
  if (horizontal) {
    next[index].y = value;
    next[index + 1].y = value;
  } else {
    next[index].x = value;
    next[index + 1].x = value;
  }
  return simplifyRoute(next);
}

/**
 * Move one end of a stored orthogonal route to `to`, as KiCad's drag does
 * (§14.3): the first segment keeps its direction and its neighbour stretches.
 * A two-point route gains a Z so it stays orthogonal.
 */
export function followEnd(points: readonly Point[], which: "start" | "end", to: Point): Point[] {
  const route = (which === "end" ? [...points].reverse() : [...points]).map((point) => ({ ...point }));
  if (route.length < 2) return [to];
  const [from, next] = route;
  const horizontal = from.y === next.y;
  if (route.length === 2) {
    const far = route[1];
    if (to.x === far.x || to.y === far.y) {
      route[0] = to;
    } else if (horizontal) {
      const middle = snap((to.x + far.x) / 2);
      route.splice(0, 1, to, { x: middle, y: to.y }, { x: middle, y: far.y });
    } else {
      const middle = snap((to.y + far.y) / 2);
      route.splice(0, 1, to, { x: to.x, y: middle }, { x: far.x, y: middle });
    }
  } else {
    route[0] = to;
    if (horizontal) route[1].y = to.y;
    else route[1].x = to.x;
  }
  const out = simplifyRoute(route);
  return which === "end" ? out.reverse() : out;
}

/** Follow both ends: a route whose ends moved together moves whole. */
export function followEnds(points: readonly Point[], start: Point, end: Point): Point[] {
  if (points.length < 2) return [start, end];
  const first = points[0];
  const last = points[points.length - 1];
  const dx = start.x - first.x;
  const dy = start.y - first.y;
  if (dx === end.x - last.x && dy === end.y - last.y) return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
  let out = [...points];
  if (start.x !== first.x || start.y !== first.y) out = followEnd(out, "start", start);
  const tail = out[out.length - 1];
  if (end.x !== tail.x || end.y !== tail.y) out = followEnd(out, "end", end);
  return out;
}

/** The middle of a route's longest segment: where a connection's mark sits. */
export function routeMidpoint(points: readonly Point[]): { point: Point; horizontal: boolean } {
  let best = 0;
  let bestLength = -1;
  for (let index = 1; index < points.length; index += 1) {
    const length = Math.abs(points[index].x - points[index - 1].x) + Math.abs(points[index].y - points[index - 1].y);
    if (length > bestLength) {
      best = index;
      bestLength = length;
    }
  }
  const a = points[Math.max(0, best - 1)];
  const b = points[best] ?? a;
  return { point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, horizontal: a.y === b.y };
}

export function toPoints(route: readonly SchematicPoint[]): Point[] {
  return route.map((point) => ({ x: point.xNm, y: point.yNm }));
}

export function fromPoints(points: readonly Point[]): SchematicPoint[] {
  return points.map((point) => ({ xNm: Math.round(point.x), yNm: Math.round(point.y) }));
}

// --------------------------------------------------------------- selection

/** KiCad's drag selection (§14.3): left to right is a window, right to left a crossing. */
export function selectionMode(start: Point, end: Point): "window" | "crossing" {
  return end.x >= start.x ? "window" : "crossing";
}

export function normalizeRect(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export function rectsTouch(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

/** Bounding box of a polyline. */
export function boundsOf(points: readonly Point[]): Rect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Does a crossing rectangle touch an orthogonal polyline? */
export function rectTouchesRoute(rect: Rect, points: readonly Point[]): boolean {
  for (let index = 1; index < points.length; index += 1) {
    if (rectsTouch(rect, boundsOf([points[index - 1], points[index]]))) return true;
  }
  return false;
}
