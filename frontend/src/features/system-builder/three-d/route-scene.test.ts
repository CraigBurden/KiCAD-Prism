import { describe, expect, it } from "vitest";

import type { SystemBundle, SystemDocument } from "../model/types";
import { dragPreview, harnessScene, previewSegment } from "./route-scene";
import { routeOf } from "../harness/route-edits";

const COMMIT = "c".repeat(40);
const NM = 1e6;
const at = (xNm: number, yNm: number, zNm = 0) => ({ xNm, yNm, zNm });

function line(a: [number, number, number], b: [number, number, number], steps: number): number[] {
  const out: number[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    out.push((a[0] + (b[0] - a[0]) * t) * NM, (a[1] + (b[1] - a[1]) * t) * NM, (a[2] + (b[2] - a[2]) * t) * NM);
  }
  return out;
}

const board = (id: string, label: string) => ({
  id,
  label,
  source: { kind: "board" as const, projectId: "prj_000000000001", track: { kind: "pinned" as const, commit: COMMIT } },
});

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
    harnesses: [{
      id: "har_2",
      label: "H2",
      ends: [
        { id: "end_a", site: { occurrence: "occ_c", connector: "J1" }, contacts: {}, pinMap: [] },
        { id: "end_b", site: { occurrence: "occ_s", connector: "J2" }, contacts: {}, pinMap: [] },
      ],
      links: [],
      wires: [],
      splices: [],
      branchPoints: [{ id: "bp_1", position: at(0, 20 * NM) }],
      segments: [
        { id: "seg_1", from: { kind: "end", end: "end_a" }, to: { kind: "branch-point", branchPoint: "bp_1" } },
        { id: "seg_2", from: { kind: "branch-point", branchPoint: "bp_1" }, to: { kind: "end", end: "end_b" } },
      ],
      coverings: [],
      cables: [],
      looseEnds: [],
      markers: [],
      waypoints: [
        { id: "w1", segment: "seg_1", position: at(0, 6 * NM), order: 0 },
        { id: "w2", segment: "seg_1", position: at(0, 14 * NM), order: 1 },
        { id: "w3", segment: "seg_2", position: at(0, 26 * NM), order: 0 },
      ],
    }],
    exports: [],
    waivers: [],
    layout: {},
  };
}

const riddenEnd = (id: string, exit: [number, number, number], leg: [number, number, number]) => ({
  end: id,
  exit: at(exit[0] * NM, exit[1] * NM, exit[2] * NM),
  outward: { x: 0, y: -1, z: 0 },
  leg: at(leg[0] * NM, leg[1] * NM, leg[2] * NM),
});

function bundle(): SystemBundle {
  return {
    harnesses: [{
      harness: "har_2",
      ends: [],
      wires: [],
      route: {
        derived: false,
        ends: [riddenEnd("end_a", [0, 0, 0], [0, 10, 0]), riddenEnd("end_b", [100, 100, 0], [100, 90, 0])],
        segments: [
          {
            id: "seg_1",
            derived: false,
            from: "end_a",
            to: "bp_1",
            wires: ["w_ex"],
            diameterNm: 3_000_000,
            assumedGauge: false,
            samplesNm: line([0, 10, 0], [0, 20, 0], 4),
            lengthNm: 10 * NM,
            minRadiusAllowedNm: 18_400_000,
            tightBend: { at: at(0, 15 * NM), radiusNm: 7_900_000 },
            clearances: [],
          },
          {
            id: "seg_2",
            derived: false,
            from: "bp_1",
            to: "end_b",
            wires: [],
            diameterNm: 1_000_000,
            assumedGauge: false,
            samplesNm: line([0, 20, 0], [100, 90, 0], 4),
            lengthNm: 120 * NM,
            minRadiusAllowedNm: 6 * NM,
            clearances: [{ occurrence: "occ_c", at: at(10 * NM, 30 * NM), distanceNm: 300_000, neededNm: 2_500_000 }],
          },
        ],
        wires: [],
      },
    }],
  } as unknown as SystemBundle;
}

describe("harnessScene", () => {
  it("converts a route to tubes, handles and flags in millimetres", () => {
    const entry = harnessScene(document(), bundle(), new Set())[0];
    expect(entry.segments.map((segment) => [segment.id, segment.radiusMm, segment.samplesMm.slice(0, 3)])).toEqual([
      ["seg_1", 1.5, [0, 10, 0]],
      ["seg_2", 0.6, [0, 20, 0]],
    ]);
    expect(entry.handles).toEqual([
      { id: "bp_1", kind: "branch-point", positionMm: [0, 20, 0] },
      { id: "w1", kind: "waypoint", positionMm: [0, 6, 0] },
      { id: "w2", kind: "waypoint", positionMm: [0, 14, 0] },
      { id: "w3", kind: "waypoint", positionMm: [0, 26, 0] },
    ]);
    expect(entry.flags.map((flag) => [flag.kind, flag.label, flag.atMm])).toEqual([
      ["bend", "R 7.9 mm < 18.4", [0, 15, 0]],
      ["clearance", "0.3 mm to Carrier, needs 2.5", [10, 30, 0]],
    ]);
  });

  it("selects a segment by itself, its harness or one of its wires", () => {
    const bySegment = harnessScene(document(), bundle(), new Set(["seg_1"]))[0];
    expect(bySegment.segments.map((segment) => segment.selected ?? false)).toEqual([true, false]);
    const byHarness = harnessScene(document(), bundle(), new Set(["har_2"]))[0];
    expect(byHarness.segments.every((segment) => segment.selected)).toBe(true);
    const byWire = harnessScene(document(), bundle(), new Set(["w_ex"]))[0];
    expect(byWire.segments.map((segment) => segment.selected ?? false)).toEqual([true, false]);
    const byWaypoint = harnessScene(document(), bundle(), new Set(["w1"]))[0];
    expect(byWaypoint.handles.find((handle) => handle.id === "w1")?.selected).toBe(true);
    expect(byWaypoint.handles.find((handle) => handle.id === "w2")?.selected).toBeUndefined();
  });

  it("draws previewed segments translucent beside the segments as they are", () => {
    const samplesMm = [0, 20, 0, 8, 40, 0, 100, 90, 0, 100, 100, 0];
    const entry = harnessScene(document(), bundle(), new Set(), { harness: "har_2", segments: [{ segmentId: "seg_2", samplesMm }] })[0];
    const ids = entry.segments.map((segment) => segment.id);
    expect(ids).toContain("seg_2");
    expect(entry.segments.find((segment) => segment.id === "seg_2:preview")).toMatchObject({ preview: true, samplesMm });
    expect(entry.segments.find((segment) => segment.id === "seg_2")?.preview).toBeUndefined();
  });

  it("leaves harnesses without a route out", () => {
    const doc = document();
    doc.harnesses[0] = { ...doc.harnesses[0], id: "har_none" };
    expect(harnessScene(doc, bundle())).toEqual([]);
  });
});

describe("previewSegment", () => {
  it("passes through the waypoints and the moved branch point", () => {
    const route = routeOf(bundle(), "har_2")!;
    const points = previewSegment(route, "seg_1", [[5, 15, 0], [0, 16, 0]], { id: "bp_1", positionMm: [0, 30, 0] });
    expect(points).toContainEqual([5, 15, 0]);
    expect(points).toContainEqual([0, 16, 0]);
    expect(points[points.length - 1]).toEqual([0, 30, 0]);
    expect(points.slice(0, 4)).toEqual([[0, 0, 0], [0, -5, 0], [0, 10, 0], [0, 5, 0]]);
  });

  it("refuses an unknown segment", () => {
    expect(() => previewSegment(routeOf(bundle(), "har_2")!, "seg_none", [])).toThrow("No segment seg_none");
  });
});

describe("dragPreview", () => {
  const near = (samples: number[], point: number[]) =>
    samples.some((_, index) => index % 3 === 0 && Math.hypot(samples[index] - point[0], samples[index + 1] - point[1], samples[index + 2] - point[2]) < 1e-6);

  it("drops a new waypoint into a segment's order", () => {
    const [segment] = dragPreview(document(), bundle(), {
      harness: "har_2",
      target: { kind: "segment", id: "seg_1" },
      fromMm: [0, 13, 0],
      pointMm: [8, 12, 0],
    });
    expect(segment.segmentId).toBe("seg_1");
    expect(near(segment.samplesMm, [8, 12, 0])).toBe(true);
  });

  it("moves a waypoint and every segment of a moved branch point", () => {
    const [waypoint] = dragPreview(document(), bundle(), {
      harness: "har_2",
      target: { kind: "waypoint", id: "w2" },
      fromMm: [0, 14, 0],
      pointMm: [8, 14, 0],
    });
    expect(waypoint.segmentId).toBe("seg_1");
    expect(near(waypoint.samplesMm, [8, 14, 0])).toBe(true);
    const touched = dragPreview(document(), bundle(), {
      harness: "har_2",
      target: { kind: "branch-point", id: "bp_1" },
      fromMm: [0, 20, 0],
      pointMm: [0, 30, 0],
    });
    expect(touched.map((segment) => segment.segmentId)).toEqual(["seg_1", "seg_2"]);
    expect(touched.every((segment) => near(segment.samplesMm, [0, 30, 0]))).toBe(true);
  });

  it("has nothing to preview without a route", () => {
    expect(dragPreview(document(), null, { harness: "har_2", target: { kind: "segment", id: "seg_1" }, fromMm: [0, 0, 0], pointMm: [0, 0, 0] })).toEqual([]);
  });
});
