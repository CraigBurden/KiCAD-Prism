/**
 * The Route tool's scene (CONTRACTS §16.6): the bundle's routed harnesses as
 * the `prism.system_scene.a0` descriptor's `harnesses` entries, in world mm.
 * Tubes are ready polylines; the viewer only shapes them. A drag preview is
 * computed here from the TypeScript curve twin, never in the viewer.
 */
import type { SystemBundle, SystemDocument } from "../model/types";
import { curve } from "../placement/harness-curves";
import { routeOf, type Route, type RouteSegment } from "../harness/route-edits";

export interface SceneRouteSegment {
  id: string;
  /** Flat `[x, y, z, …]`, millimetres. */
  samplesMm: number[];
  radiusMm: number;
  selected?: boolean;
  preview?: boolean;
}

export interface SceneRouteHandle {
  id: string;
  kind: "waypoint" | "branch-point" | "auto";
  positionMm: [number, number, number];
  selected?: boolean;
}

export interface SceneRouteFlag {
  id: string;
  kind: "bend" | "clearance";
  atMm: [number, number, number];
  label: string;
}

export interface SceneHarnessRoute {
  harness: string;
  segments: SceneRouteSegment[];
  handles: SceneRouteHandle[];
  flags: SceneRouteFlag[];
}

/**
 * A drag's previewed segments (`dragPreview`), drawn translucent beside the
 * segments as they are until the edit saves.
 */
export interface RoutePreview {
  harness: string;
  segments: { segmentId: string; samplesMm: number[] }[];
}

type Point = { xNm: number; yNm: number; zNm: number };

type MovedNode = { id: string; positionMm: readonly number[] };

const MIN_RADIUS_MM = 0.6;
const mm = (nm: number): number => nm / 1e6;
const pointMm = (point: Point): [number, number, number] => [mm(point.xNm), mm(point.yNm), mm(point.zNm)];
const mm1 = (nm: number): string => (nm / 1e6).toFixed(1);

const addScaled = (point: readonly number[], axis: readonly number[], scale: number): number[] =>
  [0, 1, 2].map((index) => point[index] + axis[index] * scale);

/** An end's head, as v1 `_head`: exit, half boot, leg, half boot on (the boot is exit → leg). */
function head(route: Route, end: string): number[][] | null {
  const posed = route.ends.find((item) => item.end === end);
  if (!posed) return null;
  const exit = pointMm(posed.exit);
  const outward = [posed.outward.x, posed.outward.y, posed.outward.z];
  const leg = pointMm(posed.leg);
  const half = Math.hypot(leg[0] - exit[0], leg[1] - exit[1], leg[2] - exit[2]) / 2;
  return [exit, addScaled(exit, outward, half), leg, addScaled(leg, outward, half)];
}

/** The node's point: an end's head, or a branch point's position (or the drag's moved node). */
function side(route: Route, segment: RouteSegment, node: string, moved?: MovedNode | null): number[][] {
  const posed = head(route, node);
  if (posed) return posed;
  if (moved && moved.id === node) return [[...moved.positionMm]];
  const count = Math.floor(segment.samplesNm.length / 3);
  const index = segment.from === node ? 0 : count - 1;
  return [[mm(segment.samplesNm[index * 3]), mm(segment.samplesNm[index * 3 + 1]), mm(segment.samplesNm[index * 3 + 2])]];
}

/**
 * The control points of a segment's preview: the from side's head, the
 * waypoints in order, then the to side's head reversed. `movedNode` replaces a
 * branch point's stored endpoint while it is dragged.
 */
export function previewSegment(route: Route, segmentId: string, middle: number[][], movedNode?: MovedNode | null): number[][] {
  const segment = route.segments.find((item) => item.id === segmentId);
  if (!segment) throw new Error(`No segment ${segmentId}`);
  const from = side(route, segment, segment.from, movedNode);
  const to = side(route, segment, segment.to, movedNode).reverse();
  return [...from, ...middle, ...to];
}

function curved(segment: RouteSegment, points: number[][]): number[] {
  const movable = points.map(() => false);
  return curve(points, movable, mm(segment.diameterNm)).samplesMm.flat();
}

function samplesOf(route: Route, segment: RouteSegment, middle: number[][], movedNode?: MovedNode | null): number[] {
  return curved(segment, previewSegment(route, segment.id, middle, movedNode));
}

/** Stored waypoints of a segment in `order`. */
function orderedWaypoints(document: SystemDocument, harness: string, segmentId: string) {
  const stored = document.harnesses.find((item) => item.id === harness);
  return [...(stored?.waypoints ?? [])]
    .filter((waypoint) => waypoint.segment === segmentId)
    .sort((a, b) => a.order - b.order);
}

/** Stored waypoints of a segment in `order`, in millimetres. */
function waypointsMm(document: SystemDocument, harness: string, segmentId: string): number[][] {
  return orderedWaypoints(document, harness, segmentId).map((waypoint) => pointMm(waypoint.position));
}

function nearestSample(segment: RouteSegment, point: readonly number[]): number {
  const count = Math.floor(segment.samplesNm.length / 3);
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < count; index += 1) {
    const distance = Math.hypot(
      mm(segment.samplesNm[index * 3]) - point[0],
      mm(segment.samplesNm[index * 3 + 1]) - point[1],
      mm(segment.samplesNm[index * 3 + 2]) - point[2],
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

/** Waypoints with a dropped point inserted where the tube was picked. */
function dropped(segment: RouteSegment, existing: number[][], pickMm: readonly number[], pointMmNew: readonly number[]): number[][] {
  const pick = nearestSample(segment, pickMm);
  const ordered = existing
    .map((point, index) => ({ point, index, sample: nearestSample(segment, point) }))
    .sort((a, b) => a.sample - b.sample || a.index - b.index);
  const place = ordered.filter((item) => item.sample < pick).length;
  ordered.splice(place, 0, { point: [...pointMmNew], index: -1, sample: pick });
  return ordered.map((item) => item.point);
}

/** The drag a route gesture reports (`prism-semantic-viewer:harness-drag`), with its harness. */
export interface RouteDrag {
  harness: string;
  target: { kind: string; id: string };
  /** Where the press happened, millimetres. */
  fromMm: readonly number[];
  /** The pointer now, millimetres. */
  pointMm: readonly number[];
}

/**
 * The segments a drag previews, with their curve samples in millimetres: the
 * dropped tube's segment, the waypoint's, or every segment touching a moved
 * branch point or the automatic breakout.
 */
export function dragPreview(
  document: SystemDocument,
  bundle: SystemBundle | null | undefined,
  drag: RouteDrag,
): { segmentId: string; samplesMm: number[] }[] {
  const route = routeOf(bundle, drag.harness);
  if (!route) return [];
  const { kind, id } = drag.target;
  if (kind === "segment") {
    const segment = route.segments.find((item) => item.id === id);
    if (!segment) return [];
    const middle = dropped(segment, waypointsMm(document, drag.harness, id), drag.fromMm, drag.pointMm);
    return [{ segmentId: id, samplesMm: samplesOf(route, segment, middle) }];
  }
  if (kind === "waypoint") {
    const stored = document.harnesses.find((item) => item.id === drag.harness)?.waypoints.find((item) => item.id === id);
    if (!stored) return [];
    const segment = route.segments.find((item) => item.id === stored.segment);
    if (!segment) return [];
    const middle = waypointsMm(document, drag.harness, stored.segment);
    const index = orderedWaypoints(document, drag.harness, stored.segment).findIndex((item) => item.id === id);
    if (index >= 0) middle[index] = [...drag.pointMm];
    return [{ segmentId: segment.id, samplesMm: samplesOf(route, segment, middle) }];
  }
  const moved: MovedNode = { id, positionMm: drag.pointMm };
  return route.segments.flatMap((segment) =>
    segment.from === id || segment.to === id
      ? [{
          segmentId: segment.id,
          samplesMm: samplesOf(route, segment, waypointsMm(document, drag.harness, segment.id), moved),
        }]
      : [],
  );
}

function segmentSelected(selected: ReadonlySet<string>, harness: string, segment: RouteSegment): boolean {
  return selected.has(segment.id) || selected.has(harness) || segment.wires.some((wire) => selected.has(wire));
}

/** Every routed harness as the viewer's descriptor part, in document order. */
export function harnessScene(
  document: SystemDocument,
  bundle: SystemBundle | null | undefined,
  selected: ReadonlySet<string> = new Set(),
  preview: RoutePreview | null = null,
): SceneHarnessRoute[] {
  const labels = new Map((document.occurrences ?? []).map((item) => [item.id, item.label]));
  const out: SceneHarnessRoute[] = [];
  for (const harness of document.harnesses ?? []) {
    const route = routeOf(bundle, harness.id);
    if (!route) continue;
    const entry: SceneHarnessRoute = { harness: harness.id, segments: [], handles: [], flags: [] };
    const previews = new Map(
      preview?.harness === harness.id ? preview.segments.map((item) => [item.segmentId, item.samplesMm]) : [],
    );
    for (const segment of route.segments) {
      const radiusMm = Math.max(mm(segment.diameterNm / 2), MIN_RADIUS_MM);
      entry.segments.push({
        id: segment.id,
        samplesMm: segment.samplesNm.map(mm),
        radiusMm,
        ...(segmentSelected(selected, harness.id, segment) ? { selected: true } : {}),
      });
      const previewed = previews.get(segment.id);
      if (previewed) entry.segments.push({ id: `${segment.id}:preview`, samplesMm: previewed, radiusMm, preview: true });
      if (segment.tightBend) {
        entry.flags.push({
          id: `${segment.id}:bend`,
          kind: "bend",
          atMm: pointMm(segment.tightBend.at),
          label: `R ${mm1(segment.tightBend.radiusNm)} mm < ${mm1(segment.minRadiusAllowedNm)}`,
        });
      }
      for (const clearance of segment.clearances) {
        entry.flags.push({
          id: `${segment.id}:clearance:${clearance.occurrence}`,
          kind: "clearance",
          atMm: pointMm(clearance.at),
          label: `${mm1(clearance.distanceNm)} mm to ${labels.get(clearance.occurrence) ?? clearance.occurrence}, needs ${mm1(clearance.neededNm)}`,
        });
      }
      const count = Math.floor(segment.samplesNm.length / 3);
      for (const [node, index] of [[segment.from, 0], [segment.to, count - 1]] as const) {
        if (route.ends.some((end) => end.end === node)) continue;
        if (entry.handles.some((handle) => handle.id === node)) continue;
        entry.handles.push({
          id: node,
          kind: node === "auto" ? "auto" : "branch-point",
          positionMm: pointMm({
            xNm: segment.samplesNm[index * 3],
            yNm: segment.samplesNm[index * 3 + 1],
            zNm: segment.samplesNm[index * 3 + 2],
          }),
          ...(selected.has(node) ? { selected: true } : {}),
        });
      }
    }
    for (const waypoint of harness.waypoints) {
      entry.handles.push({
        id: waypoint.id,
        kind: "waypoint",
        positionMm: pointMm(waypoint.position),
        ...(selected.has(waypoint.id) ? { selected: true } : {}),
      });
    }
    out.push(entry);
  }
  return out;
}
