/**
 * The Route tool's edits (CONTRACTS §16.6): the 3D tab drags tubes, waypoints
 * and branch points, and each gesture becomes one `prism.system.ops.a0`
 * request. Geometry comes from the system bundle's `harnesses[].route`; the
 * document keeps only what the user decided (§2.5): segments, branch points
 * and waypoints.
 *
 * Units: the document and the bundle are nanometres (whole), viewer points are
 * millimetres.
 */
import { newId } from "../model/ids";
import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";

type Harness = SystemDocument["harnesses"][number];
type SegmentNode = Harness["segments"][number]["from"];
type Waypoint = Harness["waypoints"][number];
type PointNm = { xNm: number; yNm: number; zNm: number };
type BundleHarness = NonNullable<SystemBundle["harnesses"]>[number];
export type Route = NonNullable<BundleHarness["route"]>;
export type RouteSegment = Route["segments"][number];

/** What an id in the document, or in a derived route, names. */
export type RouteObject =
  | { harness: string; kind: "segment"; derived: boolean }
  | { harness: string; kind: "waypoint" }
  | { harness: string; kind: "branch-point" }
  | { harness: string; kind: "auto" };

export interface TopologyOps {
  ops: SystemOp[];
  /** A derived segment id (`<harness>/<from>~<to>`) to the stored segment id. */
  segmentIds: Map<string, string>;
  /** A route node id (an end, a branch point, or `auto`) to the document node id. */
  nodeIds: Map<string, string>;
}

export interface WaypointOps {
  ops: SystemOp[];
  id: string;
}

const IDENTITY = (): TopologyOps => ({ ops: [], segmentIds: new Map(), nodeIds: new Map() });
const nodeKey = (node: SegmentNode): string => (node.kind === "end" ? node.end : node.branchPoint);
const whole = (value: number): number => Math.round(value);

function pointNm(point: PointNm): PointNm {
  return { xNm: whole(point.xNm), yNm: whole(point.yNm), zNm: whole(point.zNm) };
}

function pointMm(point: PointNm): [number, number, number] {
  return [point.xNm / 1e6, point.yNm / 1e6, point.zNm / 1e6];
}

function sampleCount(segment: RouteSegment): number {
  return Math.floor(segment.samplesNm.length / 3);
}

function sampleNm(segment: RouteSegment, index: number): PointNm {
  return {
    xNm: segment.samplesNm[index * 3],
    yNm: segment.samplesNm[index * 3 + 1],
    zNm: segment.samplesNm[index * 3 + 2],
  };
}

/** The endpoint sample a node sits at on this segment. */
function endpointNm(segment: RouteSegment, node: string): PointNm | null {
  const count = sampleCount(segment);
  if (!count) return null;
  if (segment.from === node) return sampleNm(segment, 0);
  if (segment.to === node) return sampleNm(segment, count - 1);
  return null;
}

function harnessAt(document: SystemDocument, id: string): Harness {
  const harness = document.harnesses.find((item) => item.id === id);
  if (!harness) throw new Error(`No harness ${id}`);
  return harness;
}

/** The bundle's route for one harness, or null when it has none (§16.6). */
export function routeOf(bundle: SystemBundle | null | undefined, harness: string): Route | null {
  return bundle?.harnesses?.find((item) => item.harness === harness)?.route ?? null;
}

function waypointsOf(harness: Harness, segmentId: string): Waypoint[] {
  return harness.waypoints
    .filter((waypoint) => waypoint.segment === segmentId)
    .sort((a, b) => a.order - b.order);
}

/** The nearest sample index of a point along a segment. */
function nearestSample(segment: RouteSegment, point: readonly number[]): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < sampleCount(segment); index += 1) {
    const sample = sampleNm(segment, index);
    const distance = Math.hypot(sample.xNm / 1e6 - point[0], sample.yNm / 1e6 - point[1], sample.zNm / 1e6 - point[2]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

/** `add-branch-point` for the automatic breakout, at the segment endpoint that meets it. */
function autoPoint(route: Route): PointNm | null {
  for (const segment of route.segments) {
    const at = endpointNm(segment, "auto");
    if (at) return at;
  }
  return null;
}

function nodeOf(route: Route, node: string, nodeIds: Map<string, string>): SegmentNode {
  if (route.ends.some((end) => end.end === node)) return { kind: "end", end: node };
  return { kind: "branch-point", branchPoint: nodeIds.get(node) ?? node };
}

/**
 * Store the derived tree as document segments and branch points (§16.6, drag a
 * tube). Every derived segment gets a fresh id; the automatic breakout gets a
 * branch point. A stored route needs nothing.
 */
export function storeTopologyOps(document: SystemDocument, bundle: SystemBundle | null | undefined, harness: string): TopologyOps {
  const route = routeOf(bundle, harness);
  if (!route) throw new Error("Nothing to route yet");
  if (!route.derived) return IDENTITY();
  harnessAt(document, harness);
  const ops: SystemOp[] = [];
  const nodeIds = new Map<string, string>();
  for (const end of route.ends) nodeIds.set(end.end, end.end);
  const auto = autoPoint(route);
  if (auto) {
    const id = newId("bp");
    nodeIds.set("auto", id);
    ops.push({ kind: "add-branch-point", harness, branchPoint: { id, position: auto } });
  }
  for (const segment of route.segments) {
    for (const node of [segment.from, segment.to]) if (!nodeIds.has(node)) nodeIds.set(node, node);
  }
  const segmentIds = new Map<string, string>();
  for (const segment of route.segments) {
    const id = newId("seg");
    segmentIds.set(segment.id, id);
    ops.push({
      kind: "add-segment",
      harness,
      segment: { id, from: nodeOf(route, segment.from, nodeIds), to: nodeOf(route, segment.to, nodeIds) },
    });
  }
  return { ops, segmentIds, nodeIds };
}

/** Replace the waypoints whose order shifted, then add the new one at `index`. */
function insertWaypointOps(
  harness: string,
  segment: string,
  existing: Waypoint[],
  id: string,
  position: PointNm,
  index: number,
): SystemOp[] {
  const place = Math.max(0, Math.min(index, existing.length));
  const sequence: (Waypoint | { id: string; position: PointNm })[] = [
    ...existing.slice(0, place),
    { id, position },
    ...existing.slice(place),
  ];
  const ops: SystemOp[] = [];
  sequence.forEach((waypoint, order) => {
    if (waypoint.id === id) return;
    const stored = waypoint as Waypoint;
    if (stored.order !== order) ops.push({ kind: "replace-waypoint", harness, waypoint: { ...stored, order } });
  });
  ops.push({ kind: "add-waypoint", harness, waypoint: { id, segment, position, order: place } });
  return ops;
}

/** A new waypoint on a segment at an explicit place in its order (script API). */
export function addWaypointAtOps(
  document: SystemDocument,
  bundle: SystemBundle | null | undefined,
  harness: string,
  segmentId: string,
  position: PointNm,
  index?: number,
): WaypointOps {
  const topology = storeTopologyOps(document, bundle, harness);
  const segment = topology.segmentIds.get(segmentId) ?? segmentId;
  const existing = waypointsOf(harnessAt(document, harness), segment);
  const id = newId("wpt");
  return {
    ops: [...topology.ops, ...insertWaypointOps(harness, segment, existing, id, pointNm(position), index ?? existing.length)],
    id,
  };
}

/**
 * A new waypoint where the user dropped a dragged tube: the order follows the
 * nearest sample of `pickMm` along the segment, and the segment's waypoints are
 * renumbered. A derived tree is stored first.
 */
export function addWaypointOps(
  document: SystemDocument,
  bundle: SystemBundle | null | undefined,
  harness: string,
  segmentId: string,
  positionNm: PointNm,
  pickMm: readonly number[],
): WaypointOps {
  const route = routeOf(bundle, harness);
  if (!route) throw new Error("Nothing to route yet");
  const routeSegment = route.segments.find((item) => item.id === segmentId);
  if (!routeSegment) throw new Error(`No segment ${segmentId}`);
  const topology = storeTopologyOps(document, bundle, harness);
  const segment = topology.segmentIds.get(segmentId) ?? segmentId;
  const existing = waypointsOf(harnessAt(document, harness), segment)
    .map((waypoint, index) => ({ waypoint, index, sample: nearestSample(routeSegment, pointMm(waypoint.position)) }))
    .sort((a, b) => a.sample - b.sample || a.index - b.index);
  const pick = nearestSample(routeSegment, pickMm);
  const place = existing.filter((item) => item.sample < pick).length;
  const id = newId("wpt");
  return {
    ops: [
      ...topology.ops,
      ...insertWaypointOps(harness, segment, existing.map((item) => item.waypoint), id, pointNm(positionNm), place),
    ],
    id,
  };
}

/** Move a stored waypoint, keeping its segment and order. */
export function moveWaypointOps(document: SystemDocument, harness: string, waypointId: string, positionNm: PointNm): SystemOp[] {
  const waypoint = harnessAt(document, harness).waypoints.find((item) => item.id === waypointId);
  if (!waypoint) throw new Error(`No waypoint ${waypointId}`);
  return [{ kind: "replace-waypoint", harness, waypoint: { ...waypoint, position: pointNm(positionNm) } }];
}

function storedBranchPoint(document: SystemDocument, harness: string, id: string) {
  return harnessAt(document, harness).branchPoints.find((item) => item.id === id);
}

/** Move a branch point; `auto` on a derived tree stores the tree and pins the new point. */
export function setBranchPointOps(
  document: SystemDocument,
  bundle: SystemBundle | null | undefined,
  harness: string,
  nodeId: string,
  positionNm: PointNm,
): SystemOp[] {
  const stored = storedBranchPoint(document, harness, nodeId);
  if (stored) return [{ kind: "replace-branch-point", harness, branchPoint: { ...stored, position: pointNm(positionNm) } }];
  if (nodeId === "auto") {
    const topology = storeTopologyOps(document, bundle, harness);
    const id = topology.nodeIds.get("auto");
    const added = topology.ops.find(
      (op): op is Extract<SystemOp, { kind: "add-branch-point" }> => op.kind === "add-branch-point" && op.branchPoint.id === id,
    );
    if (!added) throw new Error("Nothing to route yet");
    added.branchPoint.position = pointNm(positionNm);
    return topology.ops;
  }
  throw new Error(`No branch point ${nodeId}`);
}

export function removeWaypointOps(document: SystemDocument, harness: string, id: string): SystemOp[] {
  if (!harnessAt(document, harness).waypoints.some((item) => item.id === id)) throw new Error(`No waypoint ${id}`);
  return [{ kind: "remove-waypoint", harness, id }];
}

/** Waypoints of a segment from `start` towards its other node. */
function waypointsFrom(harness: Harness, segment: Harness["segments"][number], start: string): Waypoint[] {
  const ordered = waypointsOf(harness, segment.id);
  return nodeKey(segment.from) === start ? ordered : [...ordered].reverse();
}

function otherNode(segment: Harness["segments"][number], branchPoint: string): SegmentNode {
  return nodeKey(segment.from) === branchPoint ? segment.to : segment.from;
}

/**
 * Delete a branch point of degree two: the segments join into one and their
 * waypoints are re-added in order along it (§16.6). A junction of three or more
 * is moved instead.
 */
export function removeBranchPointOps(document: SystemDocument, harness: string, id: string): SystemOp[] {
  const stored = harnessAt(document, harness);
  const touching = stored.segments.filter((segment) => nodeKey(segment.from) === id || nodeKey(segment.to) === id);
  if (touching.length !== 2) throw new Error("A branch point joining three or more segments can't be deleted — move it instead");
  const [first, second] = touching;
  const from = otherNode(first, id);
  const to = otherNode(second, id);
  const segmentId = newId("seg");
  const ops: SystemOp[] = [
    { kind: "remove-branch-point", harness, id },
    { kind: "add-segment", harness, segment: { id: segmentId, from, to } },
  ];
  const keep = [
    ...waypointsFrom(stored, first, nodeKey(from)),
    ...waypointsFrom(stored, second, id),
  ];
  keep.forEach((waypoint, order) => {
    ops.push({
      kind: "add-waypoint",
      harness,
      waypoint: { id: newId("wpt"), segment: segmentId, position: waypoint.position, order },
    });
  });
  return ops;
}

/** Straighten a segment: drop every waypoint that bends it. */
export function straightenOps(document: SystemDocument, harness: string, segmentId: string): SystemOp[] {
  const waypoints = waypointsOf(harnessAt(document, harness), segmentId);
  if (!waypoints.length) throw new Error("This segment has no bends");
  return waypoints.map((waypoint) => ({ kind: "remove-waypoint", harness, id: waypoint.id }));
}

/** Which harness an id belongs to and what kind it is; null when it names nothing (§16.6). */
export function objectAt(document: SystemDocument, bundle: SystemBundle | null | undefined, id: string): RouteObject | null {
  for (const harness of document.harnesses) {
    if (harness.waypoints.some((item) => item.id === id)) return { harness: harness.id, kind: "waypoint" };
    if (harness.branchPoints.some((item) => item.id === id)) return { harness: harness.id, kind: "branch-point" };
    if (harness.segments.some((item) => item.id === id)) return { harness: harness.id, kind: "segment", derived: false };
  }
  for (const harness of document.harnesses) {
    const route = routeOf(bundle, harness.id);
    if (!route) continue;
    if (route.segments.some((item) => item.id === id)) return { harness: harness.id, kind: "segment", derived: route.derived };
    if (id === "auto" && route.segments.some((item) => item.from === "auto" || item.to === "auto")) {
      return { harness: harness.id, kind: "auto" };
    }
  }
  return null;
}
