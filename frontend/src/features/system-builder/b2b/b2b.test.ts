import { describe, expect, it } from "vitest";

import type { SystemBundle, SystemDocument } from "../model/types";
import { manualMapOps, orientationOps, parsePairs, rowNameOps, spacerOps, stackHeightOps } from "./mate-edits";
import { buildMateView, mateTitle } from "./mate-view";

const COMMIT = "e".repeat(40);
const source = (projectId: string) => ({ kind: "board" as const, projectId, track: { kind: "pinned" as const, commit: COMMIT } });
const MATE = {
  id: "mate_1",
  a: { occurrence: "occ_c", connector: "J202" },
  b: { occurrence: "occ_s", connector: "J1" },
  orientation: { quarterTurns: 0, flip: false },
  rows: { "2": { netLabel: "SCL" } },
};
const DOCUMENT = {
  occurrences: [{ id: "occ_c", label: "Carrier", source: source("prj_c") }, { id: "occ_s", label: "SoM", source: source("prj_s") }],
  mates: [MATE],
} as unknown as SystemDocument;

const pin = (pad: string, net: string, power = false) => ({ pad, net, nets: [net], power });
const BUNDLE = {
  occurrences: [
    { occurrence: "occ_c", connectors: [{ refdes: "J202", value: "QTH-060", pins: [pin("1", "+20V_VSYS", true), pin("2", "/SOM/FC2_SCL"), pin("3", "/X")] }] },
    { occurrence: "occ_s", connectors: [{ refdes: "J1", value: "QSH-060", pins: [pin("1", "+20V0", true), pin("2", "/GPIO_65"), pin("4", "/Y")] }] },
  ],
  nets: [
    { id: "net_p", name: "+20V_VSYS", pins: [{ occurrence: "occ_c", connector: "J202", pad: "1" }, { occurrence: "occ_s", connector: "J1", pad: "1" }] },
    { id: "net_s", name: "/SOM/FC2_SCL", pins: [{ occurrence: "occ_c", connector: "J202", pad: "2" }, { occurrence: "occ_s", connector: "J1", pad: "2" }] },
  ],
  mates: [{ mate: "mate_1", source: "geometry", pairs: [{ a: "1", b: "1" }, { a: "2", b: "2" }], unmappedA: ["3"], unmappedB: ["4"] }],
  findings: [
    { code: "power-net-conflict", severity: "warning", subject: "net:net_p", message: "", objects: [], waived: false },
    { code: "net-name-conflict", severity: "warning", subject: "net:net_s", message: "", objects: [], waived: false },
  ],
  placement: { occurrences: [], mates: [{ mate: "mate_1", driving: true, stackHeightNm: 15_000_000, heightSource: "clearance" }] },
} as unknown as SystemBundle;

describe("buildMateView", () => {
  const view = buildMateView(DOCUMENT, BUNDLE, "mate_1")!;

  it("names both sides and counts the pads that land", () => {
    expect(view.a).toEqual({ occurrence: "occ_c", label: "Carrier", connector: "J202", value: "QTH-060" });
    expect([view.landed, view.total, view.source]).toEqual([2, 3, "geometry"]);
    expect([view.stackHeightNm, view.heightSource]).toEqual([15_000_000, "clearance"]);
  });

  it("lists pairs then pads without a partner, with both nets and the findings' notes", () => {
    expect(view.rows.map((row) => [row.aPad, row.bPad])).toEqual([["1", "1"], ["2", "2"], ["3", null], [null, "4"]]);
    expect(view.rows[0]).toMatchObject({ aNet: "+20V_VSYS", bNet: "+20V0", power: true, netId: "net_p", notes: ["power nets differ"] });
    expect(view.rows[1]).toMatchObject({ systemName: "/SOM/FC2_SCL", label: "SCL", notes: ["names differ"] });
    expect(view.rows[2].notes).toEqual(["no partner"]);
  });

  it("is null for a mate the document lacks, and pending before the bundle", () => {
    expect(buildMateView(DOCUMENT, BUNDLE, "mate_x")).toBeNull();
    expect(buildMateView(DOCUMENT, null, "mate_1")).toMatchObject({ source: "pending", rows: [], landed: 0 });
  });

  it("titles the tab by its connectors", () => {
    expect(mateTitle(DOCUMENT, "mate_1")).toBe("J202 ↔ J1");
  });
});

describe("mate edits", () => {
  const mateIn = (ops: ReturnType<typeof orientationOps>) => (ops[0] as unknown as { mate: typeof MATE & Record<string, unknown> }).mate;

  it("turns and flips", () => {
    expect(mateIn(orientationOps(DOCUMENT, "mate_1", { quarterTurns: 5 })).orientation).toEqual({ quarterTurns: 1, flip: false });
    expect(mateIn(orientationOps(DOCUMENT, "mate_1", { flip: true })).orientation).toEqual({ quarterTurns: 0, flip: true });
  });

  it("states or clears the stack height", () => {
    expect(mateIn(stackHeightOps(DOCUMENT, "mate_1", 7.5)).stackHeightNm).toBe(7_500_000);
    expect(mateIn(stackHeightOps(DOCUMENT, "mate_1", null))).not.toHaveProperty("stackHeightNm");
    expect(() => stackHeightOps(DOCUMENT, "mate_1", -1)).toThrow();
  });

  it("sets a spacer along the mating axis and drops a zero one", () => {
    expect(mateIn(spacerOps(DOCUMENT, "mate_1", 2)).offset).toEqual({ translation: { xNm: 0, yNm: 0, zNm: 2_000_000 }, rotation: { x: 0, y: 0, z: 0, w: 1 } });
    expect(mateIn(spacerOps(DOCUMENT, "mate_1", 0))).not.toHaveProperty("offset");
  });

  it("names a row and clears the name", () => {
    expect(mateIn(rowNameOps(DOCUMENT, "mate_1", "3", " RESET ")).rows).toEqual({ "2": { netLabel: "SCL" }, "3": { netLabel: "RESET" } });
    expect(mateIn(rowNameOps(DOCUMENT, "mate_1", "2", "")).rows).toEqual({});
  });

  it("sets the manual map in A order, and goes back to geometry", () => {
    expect(mateIn(manualMapOps(DOCUMENT, "mate_1", [{ a: "10", b: "9" }, { a: "2", b: "1" }])).manualMap).toEqual([{ a: "2", b: "1" }, { a: "10", b: "9" }]);
    expect(mateIn(manualMapOps(DOCUMENT, "mate_1", null))).not.toHaveProperty("manualMap");
  });

  it("reads pairs from text and refuses a pad named twice", () => {
    expect(parsePairs("1 2\n3:4  # note\n\n5-6\n7,8")).toEqual([{ a: "1", b: "2" }, { a: "3", b: "4" }, { a: "5", b: "6" }, { a: "7", b: "8" }]);
    expect(() => parsePairs("1 2\n1 3")).toThrow(/paired twice/);
    expect(() => parsePairs("1 2 3")).toThrow(/two pads/);
  });
});
