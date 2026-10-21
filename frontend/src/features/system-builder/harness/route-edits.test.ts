import { describe, expect, it } from "vitest";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import {
  addWaypointOps,
  moveWaypointOps,
  objectAt,
  removeBranchPointOps,
  removeWaypointOps,
  routeOf,
  setBranchPointOps,
  storeTopologyOps,
  straightenOps,
} from "./route-edits";

const COMMIT = "c".repeat(40);
const NM = 1e6;

const board = (id: string, label: string) => ({
  id,
  label,
  source: { kind: "board" as const, projectId: "prj_000000000001", track: { kind: "pinned" as const, commit: COMMIT } },
});

const at = (xNm: number, yNm: number, zNm = 0) => ({ xNm, yNm, zNm });

/** A straight segment's samples, `steps + 1` of them, from `a` to `b` in millimetres. */
function line(a: [number, number, number], b: [number, number, number], steps: number): number[] {
  const out: number[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    out.push(
      (a[0] + (b[0] - a[0]) * t) * NM,
      (a[1] + (b[1] - a[1]) * t) * NM,
      (a[2] + (b[2] - a[2]) * t) * NM,
    );
  }
  return out;
}

const end = (id: string, occurrence: string, connector: string) => ({ id, site: { occurrence, connector }, contacts: {}, pinMap: [] });

function harness(id: string, ends: string[], extra: Partial<SystemDocument["harnesses"][number]> = {}): SystemDocument["harnesses"][number] {
  return {
    id,
    label: id.toUpperCase(),
    ends: ends.map((item, index) => end(item, index % 2 === 0 ? "occ_c" : "occ_s", index === 2 ? "J3" : "J1")),
    links: [],
    wires: [],
    splices: [],
    branchPoints: [],
    segments: [],
    coverings: [],
    cables: [],
    looseEnds: [],
    markers: [],
    waypoints: [],
    ...extra,
  };
}

function document(): SystemDocument {
  return {
    schema: "prism.system.v2",
    name: "Stack",
    sheets: [],
    occurrences: [board("occ_c", "Carrier"), board("occ_s", "SoM")],
    subPorts: [],
    dismissedSuggestions: [],
    bodyConnectors: [],
    mates: [],
    harnesses: [
      harness("har_1", ["end_a", "end_b"]),
      harness("har_auto", ["end_a", "end_b", "end_c"]),
      harness("har_2", ["end_a", "end_b"], {
        branchPoints: [{ id: "bp_1", position: at(0, 20 * NM) }],
        segments: [
          { id: "seg_1", from: { kind: "end", end: "end_a" }, to: { kind: "branch-point", branchPoint: "bp_1" } },
          { id: "seg_2", from: { kind: "branch-point", branchPoint: "bp_1" }, to: { kind: "end", end: "end_b" } },
        ],
        waypoints: [
          { id: "w1", segment: "seg_1", position: at(0, 6 * NM), order: 0 },
          { id: "w2", segment: "seg_1", position: at(0, 14 * NM), order: 1 },
          { id: "w3", segment: "seg_2", position: at(0, 26 * NM), order: 0 },
        ],
      }),
    ],
    exports: [],
    waivers: [],
    layout: {},
  };
}

function riddenEnd(id: string, exit: [number, number, number], leg: [number, number, number]) {
  return {
    end: id,
    exit: at(exit[0] * NM, exit[1] * NM, exit[2] * NM),
    outward: { x: 0, y: -1, z: 0 },
    leg: at(leg[0] * NM, leg[1] * NM, leg[2] * NM),
  };
}

function bundle(): SystemBundle {
  return {
    harnesses: [
      {
        harness: "har_1",
        ends: [],
        wires: [],
        route: {
          derived: true,
          ends: [riddenEnd("end_a", [0, 0, 0], [0, 10, 0]), riddenEnd("end_b", [100, 100, 0], [100, 90, 0])],
          segments: [{
            id: "har_1/end_a~end_b",
            derived: true,
            from: "end_a",
            to: "end_b",
            wires: ["w_ex"],
            diameterNm: 2_400_000,
            assumedGauge: false,
            samplesNm: line([0, 10, 0], [100, 90, 0], 10),
            lengthNm: 130 * NM,
            minRadiusAllowedNm: 14 * NM,
            clearances: [],
          }],
          wires: [],
        },
      },
      {
        harness: "har_auto",
        ends: [],
        wires: [],
        route: {
          derived: true,
          ends: [
            riddenEnd("end_a", [0, 0, 0], [0, 10, 0]),
            riddenEnd("end_b", [50, 50, 0], [50, 40, 0]),
            riddenEnd("end_c", [100, 100, 0], [100, 90, 0]),
          ],
          segments: [
            { id: "har_auto/end_a~auto", derived: true, from: "end_a", to: "auto", wires: [], diameterNm: 2_400_000, assumedGauge: false, samplesNm: line([0, 10, 0], [50, 60, 0], 4), lengthNm: 70 * NM, minRadiusAllowedNm: 14 * NM, clearances: [] },
            { id: "har_auto/auto~end_b", derived: true, from: "auto", to: "end_b", wires: [], diameterNm: 2_400_000, assumedGauge: false, samplesNm: line([50, 60, 0], [50, 40, 0], 2), lengthNm: 20 * NM, minRadiusAllowedNm: 14 * NM, clearances: [] },
            { id: "har_auto/auto~end_c", derived: true, from: "auto", to: "end_c", wires: [], diameterNm: 2_400_000, assumedGauge: false, samplesNm: line([50, 60, 0], [100, 90, 0], 4), lengthNm: 70 * NM, minRadiusAllowedNm: 14 * NM, clearances: [] },
          ],
          wires: [],
        },
      },
      {
        harness: "har_2",
        ends: [],
        wires: [],
        route: {
          derived: false,
          ends: [riddenEnd("end_a", [0, 0, 0], [0, 10, 0]), riddenEnd("end_b", [100, 100, 0], [100, 90, 0])],
          segments: [
            { id: "seg_1", derived: false, from: "end_a", to: "bp_1", wires: ["w_ex"], diameterNm: 3_000_000, assumedGauge: false, samplesNm: line([0, 10, 0], [0, 20, 0], 4), lengthNm: 10 * NM, minRadiusAllowedNm: 18 * NM, clearances: [] },
            { id: "seg_2", derived: false, from: "bp_1", to: "end_b", wires: [], diameterNm: 3_000_000, assumedGauge: false, samplesNm: line([0, 20, 0], [100, 90, 0], 4), lengthNm: 120 * NM, minRadiusAllowedNm: 18 * NM, clearances: [] },
          ],
          wires: [],
        },
      },
    ],
  } as unknown as SystemBundle;
}

const addSegment = (op: SystemOp) => {
  if (op.kind !== "add-segment") throw new Error(`Expected add-segment, got ${op.kind}`);
  return op.segment;
};
const addWaypoint = (op: SystemOp) => {
  if (op.kind !== "add-waypoint") throw new Error(`Expected add-waypoint, got ${op.kind}`);
  return op.waypoint;
};

describe("routeOf", () => {
  it("finds the bundle's route or says there is none", () => {
    expect(routeOf(bundle(), "har_1")?.derived).toBe(true);
    expect(routeOf(bundle(), "har_none")).toBeNull();
    expect(routeOf(null, "har_1")).toBeNull();
  });
});

describe("storeTopologyOps", () => {
  it("stores a derived segment with fresh ids and end nodes", () => {
    const result = storeTopologyOps(document(), bundle(), "har_1");
    expect(result.ops).toHaveLength(1);
    const segment = addSegment(result.ops[0]);
    expect(segment.id).toMatch(/^seg_/);
    expect(segment).toMatchObject({ from: { kind: "end", end: "end_a" }, to: { kind: "end", end: "end_b" } });
    expect(result.segmentIds.get("har_1/end_a~end_b")).toBe(segment.id);
    expect(result.nodeIds.get("end_a")).toBe("end_a");
  });

  it("maps the automatic breakout to a new branch point at its endpoint", () => {
    const result = storeTopologyOps(document(), bundle(), "har_auto");
    expect(result.ops.map((op) => op.kind)).toEqual(["add-branch-point", "add-segment", "add-segment", "add-segment"]);
    const added = result.ops[0];
    if (added.kind !== "add-branch-point") throw new Error("Expected add-branch-point");
    expect(added.branchPoint.id).toMatch(/^bp_/);
    expect(added.branchPoint.position).toEqual(at(50 * NM, 60 * NM));
    expect(result.nodeIds.get("auto")).toBe(added.branchPoint.id);
    const first = addSegment(result.ops[1]);
    expect(first.from).toEqual({ kind: "end", end: "end_a" });
    expect(first.to).toEqual({ kind: "branch-point", branchPoint: added.branchPoint.id });
    expect(result.ops.slice(1).map((op) => addSegment(op).id)).toEqual([...result.segmentIds.values()]);
  });

  it("needs nothing for a stored route, and refuses without one", () => {
    expect(storeTopologyOps(document(), bundle(), "har_2").ops).toEqual([]);
    expect(() => storeTopologyOps(document(), bundle(), "har_missing")).toThrow("Nothing to route yet");
  });
});

describe("addWaypointOps", () => {
  it("inserts and renumbers on a stored segment", () => {
    const result = addWaypointOps(document(), bundle(), "har_2", "seg_1", at(0, 13 * NM), [0, 13, 0]);
    expect(result.id).toMatch(/^wpt_/);
    expect(result.ops.map((op) => op.kind)).toEqual(["replace-waypoint", "add-waypoint"]);
    const shifted = result.ops[0];
    if (shifted.kind !== "replace-waypoint") throw new Error("Expected replace-waypoint");
    expect(shifted.waypoint).toMatchObject({ id: "w2", segment: "seg_1", order: 2 });
    expect(addWaypoint(result.ops[1])).toMatchObject({ id: result.id, segment: "seg_1", position: at(0, 13 * NM), order: 1 });
  });

  it("goes first when dropped before every existing waypoint", () => {
    const result = addWaypointOps(document(), bundle(), "har_2", "seg_1", at(0, 2 * NM), [0, 2, 0]);
    expect(result.ops.map((op) => op.kind)).toEqual(["replace-waypoint", "replace-waypoint", "add-waypoint"]);
    expect(addWaypoint(result.ops[2]).order).toBe(0);
  });

  it("stores a derived tree first and points the waypoint at the new segment", () => {
    const result = addWaypointOps(document(), bundle(), "har_1", "har_1/end_a~end_b", at(0, 50 * NM), [0, 50, 0]);
    expect(result.ops.map((op) => op.kind)).toEqual(["add-segment", "add-waypoint"]);
    const segment = addSegment(result.ops[0]);
    expect(addWaypoint(result.ops[1])).toMatchObject({ segment: segment.id, order: 0 });
  });

  it("refuses when the harness has no route", () => {
    expect(() => addWaypointOps(document(), bundle(), "har_missing", "seg_1", at(0, 0), [0, 0, 0])).toThrow("Nothing to route yet");
  });
});

describe("waypoint and branch point moves", () => {
  it("moves a waypoint keeping its segment and order", () => {
    const ops = moveWaypointOps(document(), "har_2", "w1", at(5 * NM, 8 * NM));
    expect(ops).toEqual([{ kind: "replace-waypoint", harness: "har_2", waypoint: { id: "w1", segment: "seg_1", position: at(5 * NM, 8 * NM), order: 0 } }]);
  });

  it("moves a stored branch point", () => {
    const ops = setBranchPointOps(document(), bundle(), "har_2", "bp_1", at(1 * NM, 2 * NM));
    expect(ops[0]).toMatchObject({ kind: "replace-branch-point", branchPoint: { id: "bp_1", position: at(1 * NM, 2 * NM) } });
  });

  it("stores the tree and pins its automatic breakout", () => {
    const ops = setBranchPointOps(document(), bundle(), "har_auto", "auto", at(7 * NM, 70 * NM));
    expect(ops[0]).toMatchObject({ kind: "add-branch-point", branchPoint: { position: at(7 * NM, 70 * NM) } });
    expect(ops.filter((op) => op.kind === "add-segment")).toHaveLength(3);
  });

  it("removes a waypoint, and a segment without bends refuses to straighten", () => {
    expect(removeWaypointOps(document(), "har_2", "w1")).toEqual([{ kind: "remove-waypoint", harness: "har_2", id: "w1" }]);
    expect(straightenOps(document(), "har_2", "seg_1").map((op) => op.kind)).toEqual(["remove-waypoint", "remove-waypoint"]);
    expect(() => straightenOps(document(), "har_2", "seg_none")).toThrow("This segment has no bends");
  });
});

describe("removeBranchPointOps", () => {
  it("joins the two segments and re-adds their waypoints in order", () => {
    const ops = removeBranchPointOps(document(), "har_2", "bp_1");
    expect(ops.map((op) => op.kind)).toEqual(["remove-branch-point", "add-segment", "add-waypoint", "add-waypoint", "add-waypoint"]);
    const joined = addSegment(ops[1]);
    expect(joined).toMatchObject({ from: { kind: "end", end: "end_a" }, to: { kind: "end", end: "end_b" } });
    const waypoints = ops.slice(2).map((op) => addWaypoint(op));
    expect(waypoints.map((waypoint) => waypoint.order)).toEqual([0, 1, 2]);
    expect(waypoints.map((waypoint) => waypoint.position)).toEqual([at(0, 6 * NM), at(0, 14 * NM), at(0, 26 * NM)]);
    expect(waypoints.every((waypoint) => waypoint.segment === joined.id && waypoint.id.startsWith("wpt_"))).toBe(true);
  });

  it("refuses a junction of three or more segments", () => {
    const doc = document();
    doc.harnesses[2].segments.push({ id: "seg_3", from: { kind: "branch-point", branchPoint: "bp_1" }, to: { kind: "end", end: "end_b" } });
    expect(() => removeBranchPointOps(doc, "har_2", "bp_1")).toThrow(
      "A branch point joining three or more segments can't be deleted — move it instead",
    );
  });

  it("walks a segment stored the other way round", () => {
    const doc = document();
    doc.harnesses[2].segments[0] = { id: "seg_1", from: { kind: "branch-point", branchPoint: "bp_1" }, to: { kind: "end", end: "end_a" } };
    const waypoints = removeBranchPointOps(doc, "har_2", "bp_1").slice(2).map((op) => addWaypoint(op));
    expect(waypoints.map((waypoint) => waypoint.position)).toEqual([at(0, 14 * NM), at(0, 6 * NM), at(0, 26 * NM)]);
  });
});

describe("objectAt", () => {
  it("names the harness and kind of each route id", () => {
    expect(objectAt(document(), bundle(), "seg_1")).toEqual({ harness: "har_2", kind: "segment", derived: false });
    expect(objectAt(document(), bundle(), "har_1/end_a~end_b")).toEqual({ harness: "har_1", kind: "segment", derived: true });
    expect(objectAt(document(), bundle(), "w1")).toEqual({ harness: "har_2", kind: "waypoint" });
    expect(objectAt(document(), bundle(), "bp_1")).toEqual({ harness: "har_2", kind: "branch-point" });
    expect(objectAt(document(), bundle(), "auto")).toEqual({ harness: "har_auto", kind: "auto" });
    expect(objectAt(document(), bundle(), "nope")).toBeNull();
  });
});
