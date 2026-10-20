import { describe, expect, it } from "vitest";

import type { SchematicPoint, SystemBundle, SystemDocument } from "../model/types";
import {
  addBoardOps,
  connectRefusal,
  harnessOps,
  layoutOps,
  moveSymbols,
  removeOps,
  withFollowingRoutes,
} from "./edits";
import { buildScene } from "./scene";

const COMMIT = "b".repeat(40);
const board = (id: string, label: string, projectId = "prj_000000000001") => ({
  id,
  label,
  source: { kind: "board" as const, projectId, track: { kind: "pinned" as const, commit: COMMIT } },
});
const emptyHarness = { links: [], wires: [], splices: [], branchPoints: [], segments: [], coverings: [], cables: [], looseEnds: [], markers: [], waypoints: [] };

function document(): SystemDocument {
  return {
    schema: "prism.system.v2",
    name: "Stack",
    sheets: [],
    occurrences: [board("occ_a", "A"), board("occ_b", "B", "prj_000000000002")],
    subPorts: [{ id: "sub_fan", occurrence: "occ_a", connector: "J2", name: "FAN", pins: ["3", "4"], suggestion: "family:FAN" }],
    dismissedSuggestions: [],
    bodyConnectors: [],
    mates: [{ id: "mate_x", a: { occurrence: "occ_a", connector: "J1" }, b: { occurrence: "occ_b", connector: "J1" }, orientation: { quarterTurns: 0, flip: false }, rows: {} }],
    harnesses: [{ id: "har_h", label: "H1", ends: [{ id: "end_1", site: { occurrence: "occ_a", connector: "J2" }, contacts: {}, pinMap: [] }], ...emptyHarness }],
    exports: [],
    waivers: [],
    layout: {
      occ_a: { xNm: 0, yNm: 0, rotationDeg: 0, mirror: false },
      occ_b: { xNm: 101_600_000, yNm: 0, rotationDeg: 0, mirror: false },
    },
  };
}

const BUNDLE = {
  occurrences: [
    { occurrence: "occ_a", state: "ready", connectors: [{ refdes: "J1", value: "", candidate: true, placement: { angleDeg: 0, side: "top" }, pins: [] }, { refdes: "J2", value: "", candidate: true, placement: { angleDeg: 180, side: "top" }, pins: [] }] },
    { occurrence: "occ_b", state: "ready", connectors: [{ refdes: "J1", value: "", candidate: true, placement: { angleDeg: 180, side: "top" }, pins: [] }] },
  ],
} as unknown as SystemBundle;

describe("moving symbols", () => {
  it("snaps the move to the grid and makes one set-layout per moved symbol", () => {
    const doc = document();
    const scene = buildScene(doc, BUNDLE);
    const override = moveSymbols(doc, scene, ["occ_b"], { x: 2_000_000, y: -600_000 });
    expect(override.occ_b).toMatchObject({ xNm: 101_600_000 + 2_540_000, yNm: 0 });
    expect(layoutOps(doc, override)).toEqual([{ kind: "set-layout", item: "occ_b", placement: override.occ_b }]);
  });

  it("drags a stored route along with the pins it ends on", () => {
    const doc = document();
    const scene = buildScene(doc, BUNDLE);
    const mate = scene.connections.find((item) => item.id === "mate_x");
    const route = mate?.points.map((point) => ({ xNm: point.x, yNm: point.y })) as [SchematicPoint, SchematicPoint];
    doc.layout.mate_x = { xNm: 0, yNm: 0, rotationDeg: 0, mirror: false, route };
    const stored = buildScene(doc, BUNDLE);
    const override = withFollowingRoutes(doc, BUNDLE, stored, moveSymbols(doc, stored, ["occ_b"], { x: 0, y: 10_160_000 }));
    const moved = override.mate_x?.route ?? [];
    const pinB = buildScene(doc, BUNDLE, { override }).symbols.find((item) => item.id === "occ_b")?.ports[0].point;
    expect(moved[moved.length - 1]).toEqual({ xNm: pinB?.x, yNm: pinB?.y });
    expect(moved[0]).toEqual(route[0]);
  });
});

describe("connecting", () => {
  it("joins the harness block a connector already belongs to", () => {
    const ops = harnessOps(document(), { item: "occ_a", key: "J2" }, { item: "occ_b", key: "J5" }, { harness: "har_new", a: "end_a", b: "end_b", link: "link_1" });
    expect(ops[0]).toMatchObject({ kind: "connect-harness", harness: "har_h", newEnds: { a: "end_a", b: "end_b" } });
    expect(ops[0]).not.toHaveProperty("newHarness");
  });

  it("creates a block when neither connector has one", () => {
    const ops = harnessOps(document(), { item: "occ_a", key: "J9" }, { item: "occ_b", key: "J5" }, { harness: "har_new", a: "end_a", b: "end_b", link: "link_1" });
    expect(ops[0]).toMatchObject({ newHarness: { id: "har_new", label: "H2" } });
  });

  it("refuses what the document cannot hold", () => {
    const doc = document();
    expect(connectRefusal(doc, "mate", { item: "occ_a", key: "J1" }, { item: "occ_b", key: "J7" })).toMatch(/one connector only/);
    expect(connectRefusal(doc, "mate", { item: "occ_a", key: "J2" }, { item: "occ_b", key: "J7" })).toMatch(/harness/);
    expect(connectRefusal(doc, "harness", { item: "occ_a", key: "J1" }, { item: "occ_b", key: "J7" })).toMatch(/mated/);
    expect(connectRefusal(doc, "mate", { item: "occ_a", key: "J5" }, { item: "occ_a", key: "J6" })).toMatch(/itself/);
    expect(connectRefusal(doc, "harness", { item: "occ_a", key: "J5" }, { item: "occ_b", key: "J7" })).toBeNull();
  });
});

describe("removing", () => {
  it("leaves cascades to the server: a removed board takes its mate with it", () => {
    expect(removeOps(document(), ["occ_b", "mate_x"])).toEqual([{ kind: "remove-occurrence", id: "occ_b" }]);
    expect(removeOps(document(), ["mate_x", "end_1"])).toEqual([
      { kind: "remove-end", harness: "har_h", id: "end_1" },
      { kind: "remove-mate", id: "mate_x" },
    ]);
  });
});

describe("adding a board", () => {
  it("places it to the right and copies the sub-ports of the same project's first occurrence", () => {
    const doc = document();
    const scene = buildScene(doc, BUNDLE);
    let counter = 0;
    const makeId = ((prefix: string) => `${prefix}_new${(counter += 1)}`) as never;
    const { ops, occurrence } = addBoardOps(doc, scene, { label: "A2", projectId: "prj_000000000001", track: { kind: "pinned", commit: COMMIT } }, makeId);
    expect(occurrence).toBe("occ_new1");
    expect(ops.map((op) => op.kind)).toEqual(["add-occurrence", "set-layout", "add-sub-port"]);
    expect(ops[2]).toEqual({
      kind: "add-sub-port",
      subPort: { id: "sub_new2", occurrence: "occ_new1", connector: "J2", name: "FAN", pins: ["3", "4"], suggestion: "family:FAN" },
    });
    const right = Math.max(...scene.symbols.map((symbol) => symbol.rect.x + symbol.rect.w));
    expect((ops[1] as { placement: { xNm: number } }).placement.xNm).toBeGreaterThan(right);
  });
});
