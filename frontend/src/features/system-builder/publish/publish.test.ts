import { describe, expect, it } from "vitest";

import type { SystemBundle, SystemDocument } from "../model/types";
import { exportAt, exportLabel, exportPins, pinNameOps, renameExportOps, toggleExportOps, type Export } from "./export-edits";
import { defaultIdentity, interfaceSummary, publishChecks, stepRow } from "./publish-checks";

const MODULE = {
  occurrences: [{ id: "occ_box", label: "Brick", source: { kind: "body", componentId: "cmp_box", revisionId: "rev_1" } }],
  subPorts: [{ id: "sub_ctl", occurrence: "occ_box", connector: "J1", name: "CTL", pins: ["3", "4"] }],
  exports: [] as Export[],
  mates: [],
  bodyConnectors: [],
} as unknown as SystemDocument;

const pin = (pad: string, pinName?: string, power = false) => ({ pad, nets: [], ...(pinName ? { pinName } : {}), power });
const BUNDLE = {
  occurrences: [{ occurrence: "occ_box", state: "ready", connectors: [{ refdes: "J1", pins: [pin("1", "Pin_1", true), pin("2", "Pin_2", true), pin("3"), pin("4")] }] }],
  nets: [{ id: "net_v", name: "VOUT", pins: [{ occurrence: "occ_box", connector: "J1", pad: "1" }, { occurrence: "occ_box", connector: "J1", pad: "2" }] }],
  findings: [],
} as unknown as SystemBundle;

const withExport = (document: SystemDocument, item: Export): SystemDocument => ({ ...document, exports: [...document.exports, item] });

describe("exports", () => {
  it("exports a connector under its refdes and a sub-port under its name, then stops", () => {
    const [connector] = toggleExportOps(MODULE, { occurrence: "occ_box", connector: "J1" }, () => "exp_1");
    expect(connector).toEqual({ kind: "add-export", export: { id: "exp_1", name: "J1", site: { occurrence: "occ_box", connector: "J1" }, pinNames: {} } });
    const [subPort] = toggleExportOps(MODULE, { occurrence: "occ_box", connector: "J1", subPort: "sub_ctl" }, () => "exp_2");
    expect(subPort).toMatchObject({ export: { name: "CTL", site: { subPort: { kind: "occurrence", id: "sub_ctl" } } } });

    const exported = withExport(MODULE, (connector as { export: Export }).export);
    expect(exportAt(exported, { occurrence: "occ_box", connector: "J1" })?.id).toBe("exp_1");
    // The whole connector and its sub-port are different sites.
    expect(exportAt(exported, { occurrence: "occ_box", connector: "J1", subPort: "sub_ctl" })).toBeUndefined();
    expect(toggleExportOps(exported, { occurrence: "occ_box", connector: "J1" })).toEqual([{ kind: "remove-export", id: "exp_1" }]);
    // A second export of the same name is made unique.
    expect(toggleExportOps(exported, { occurrence: "occ_box", connector: "J1", subPort: "sub_ctl" }, () => "exp_3")[0]).toMatchObject({ export: { name: "CTL" } });
  });

  it("renames an export and names its pins, falling back to the board's pin names", () => {
    const item: Export = { id: "exp_1", name: "J1", site: { occurrence: "occ_box", connector: "J1" }, pinNames: { "1": "VOUT" } };
    const document = withExport(MODULE, item);
    expect(renameExportOps(document, item, " Power ")).toEqual([{ kind: "replace-export", export: { ...item, name: "Power" } }]);
    expect(renameExportOps(document, item, "J1")).toEqual([]);
    expect(pinNameOps(item, "2", "VOUT")).toEqual([{ kind: "replace-export", export: { ...item, pinNames: { "1": "VOUT", "2": "VOUT" } } }]);
    expect(pinNameOps(item, "1", "")).toEqual([{ kind: "replace-export", export: { ...item, pinNames: {} } }]);

    const pins = exportPins(document, BUNDLE, item);
    expect(pins.map((row) => [row.pad, row.name, row.signal, row.power])).toEqual([
      ["1", "VOUT", "VOUT", true],
      ["2", "Pin_2", "VOUT", true],
      ["3", "3", null, false],
      ["4", "4", null, false],
    ]);
  });

  it("lists a sub-port's export by its members, in the sub-port's order", () => {
    const item: Export = { id: "exp_2", name: "CTL", site: { occurrence: "occ_box", connector: "J1", subPort: { kind: "occurrence", id: "sub_ctl" } }, pinNames: {} };
    const document = withExport(MODULE, item);
    expect(exportLabel(document, item)).toBe("CTL{3 4}");
    expect(exportPins(document, BUNDLE, item).map((row) => row.pad)).toEqual(["3", "4"]);
  });
});

describe("publish checks", () => {
  const item: Export = { id: "exp_1", name: "OUT", site: { occurrence: "occ_box", connector: "J1" }, pinNames: { "1": "VOUT", "2": "VOUT", "3": "GND", "4": "GND" } };

  it("offers bought-out for a module and in-house when boards are placed", () => {
    expect(defaultIdentity(MODULE)).toBe("bought-out");
    const withBoard = { ...MODULE, occurrences: [...MODULE.occurrences, { id: "occ_b", label: "B", source: { kind: "board" } }] } as unknown as SystemDocument;
    expect(defaultIdentity(withBoard)).toBe("in-house");
  });

  it("says what blocks a publish, in the server's order", () => {
    const empty = publishChecks(MODULE, BUNDLE, "bought-out", false);
    expect(empty.map((check) => [check.key, check.ok])).toEqual([["exports", false], ["bundle", true], ["errors", true], ["entries", true], ["body", true]]);

    const missingModel = { ...BUNDLE, findings: [{ code: "body-model-missing", subject: "occurrence:occ_box", severity: "warning", waived: false }] } as unknown as SystemBundle;
    expect(stepRow(MODULE, missingModel).ok).toBe(false);
    const erroring = { ...BUNDLE, findings: [{ code: "mate-unresolved", subject: "mate:m", severity: "error", waived: false }] } as unknown as SystemBundle;
    const checks = publishChecks(withExport(MODULE, item), erroring, "in-house", true);
    expect(checks.find((check) => check.key === "errors")).toMatchObject({ ok: false, detail: "1 unwaived error(s): mate-unresolved" });
    expect(checks.find((check) => check.key === "bundle")).toMatchObject({ ok: false, detail: "Building…" });
    expect(checks.some((check) => check.key === "body")).toBe(false);
  });

  it("summarises the interface by its exports' pin names", () => {
    expect(interfaceSummary(withExport(MODULE, item), BUNDLE)).toEqual(["OUT: VOUT, GND"]);
  });
});
