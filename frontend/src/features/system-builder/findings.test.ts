import { describe, expect, it } from "vitest";

import type { Finding } from "@/types/system";

import { findingDetail, findingTarget, findingsOf, levelCounts, worstLevel } from "./findings";

const finding = (patch: Partial<Finding>): Finding => ({
  rule: "SYS-V03", name: "pin_absent", severity: "error", instanceId: null, linkId: null, rowId: null,
  end: null, reference: null, pin: null, detail: null, redacted: false, ...patch,
});
const stamp = { id: "w1", note: "accepted", by: "user:a", at: "" };

describe("findingsOf: open versus waived (SB2-100)", () => {
  const waivedRow = finding({ severity: "warning", linkId: "L1", rowId: "r1", instanceId: "sin_A", key: "k-waived", waived: stamp });
  const waivedHarness = finding({ severity: "warning", key: "k-h", detail: { harnessId: "shn_1" }, waived: stamp });
  const findings = [
    finding({ instanceId: "sin_A" }),
    finding({ severity: "warning", linkId: "L1", rowId: "r1", instanceId: "sin_A" }),
    finding({ linkId: "L1" }),
    finding({ linkId: "L2", rowId: "r1" }),
    finding({ severity: "info", detail: { harnessId: "shn_1" } }),
    waivedRow,
    waivedHarness,
  ];
  const index = findingsOf(findings);

  it("is built once per report", () => {
    expect(findingsOf(findings)).toBe(index);
    expect(findingsOf([...findings])).not.toBe(index);
  });

  it("keeps waived findings out of every lookup and count", () => {
    expect(index.open).toHaveLength(5);
    expect(index.open).not.toContain(waivedRow);
    expect([index.errors, index.warnings]).toEqual([3, 1]);
    expect(index.instance("sin_A")).toHaveLength(2);
    expect(index.link("L1")).toHaveLength(2);
    expect(index.row("L1", "r1")).toHaveLength(1);
    expect(index.row("L2", "r1")).toHaveLength(1);
    expect(index.harness("shn_1").map((item) => item.severity)).toEqual(["info"]);
  });

  it("finds a waiver's finding by its key", () => {
    expect(index.waived("k-waived")).toBe(waivedRow);
    expect(index.waived("k-h")).toBe(waivedHarness);
    expect(index.waived("gone")).toBeNull();
  });

  it("answers an empty lookup with one shared empty list", () => {
    expect(index.link("nope")).toEqual([]);
    expect(index.link("nope")).toBe(index.instance("nope"));
  });
});

describe("severity rollups", () => {
  it("counts errors and warnings, and errors win", () => {
    const mixed = [finding({ severity: "warning" }), finding({ severity: "info" }), finding({})];
    expect(levelCounts(mixed)).toEqual({ errors: 1, warnings: 1 });
    expect(worstLevel(mixed)).toBe("error");
    expect(worstLevel([finding({ severity: "warning" })])).toBe("warning");
    expect(worstLevel([finding({ severity: "info" })])).toBeNull();
    expect(worstLevel([])).toBeNull();
  });
});

describe("collisions (SYS-V22)", () => {
  const side = (occurrence: string, reference: string | null) => ({ occurrence, reference, label: "OBC" });
  const open = finding({ rule: "SYS-V22", severity: "warning", key: "c1", instanceId: "sin_A",
    detail: { a: side("/sin_A", "U1"), b: side("/sin_B", null), atMm: [0, 0, 0], pairs: [] } });
  const waived = finding({ rule: "SYS-V22", severity: "warning", key: "c2", waived: stamp, detail: { a: side("/sin_A", "U2") } });
  const index = findingsOf([open, waived, finding({})]);

  it("lists every collision, waived or not, and finds one by key", () => {
    expect(index.collisions).toEqual([open, waived]);
    expect(index.collision("c2")).toBe(waived);
    expect(index.collision("nope")).toBeNull();
  });

  it("decodes both colliding parts", () => {
    expect(findingDetail(open).collision).toEqual([{ occurrence: "/sin_A", reference: "U1" }, { occurrence: "/sin_B", reference: null }]);
    expect(findingDetail(finding({ detail: { a: side("/x", "U1") } })).collision).toEqual([]);
  });
});

describe("findingDetail", () => {
  it("decodes a join, its far pin and both nets", () => {
    const join = finding({ rule: "SYS-V09", detail: { referenceB: "J7", pinB: "4", netA: ["/VCC"], netB: null, rename: { name: "VCC" } } });
    expect(findingDetail(join)).toEqual({
      harnessId: null, far: { reference: "J7", pin: "4" }, nets: { kind: "join", a: ["/VCC"], b: [] },
      rename: { name: "VCC" }, collision: [],
    });
    expect(findingDetail(join)).toBe(findingDetail(join));
  });

  it("decodes a PCB difference, a net list, and nothing", () => {
    expect(findingDetail(finding({ detail: { schematic: ["/A"], pcb: ["/B"] } })).nets).toEqual({ kind: "pcb", schematic: ["/A"], pcb: ["/B"] });
    expect(findingDetail(finding({ detail: { nets: ["/A", 3] } })).nets).toEqual({ kind: "list", nets: ["/A"] });
    expect(findingDetail(finding({ detail: null }))).toEqual({ harnessId: null, far: null, nets: null, rename: null, collision: [] });
  });
});

describe("findingTarget", () => {
  it("goes to the harness, the collision, the link row, or the board", () => {
    expect(findingTarget(finding({ linkId: "L1", detail: { harnessId: "shn_1" } }))).toEqual({ kind: "harness", id: "shn_1" });
    expect(findingTarget(finding({ rule: "SYS-V22", key: "c1", instanceId: "sin_A" }))).toEqual({ kind: "collision", id: "c1" });
    expect(findingTarget(finding({ linkId: "L1", rowId: "r1", instanceId: "sin_A" }))).toEqual({ kind: "link", id: "L1", row: "r1" });
    expect(findingTarget(finding({ linkId: "L1" }))).toEqual({ kind: "link", id: "L1" });
    expect(findingTarget(finding({ instanceId: "sin_A" }))).toEqual({ kind: "instance", id: "sin_A" });
    expect(findingTarget(finding({}))).toBeNull();
  });
});
