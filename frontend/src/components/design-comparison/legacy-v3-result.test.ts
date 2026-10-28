import { describe, expect, it } from "vitest";
import { readLegacyResult, type LegacyResult } from "./legacy-v3-result";
import type { KiCadProjectDiffBundle } from "./types";

const projectDiff: KiCadProjectDiffBundle = {
    schema: "prism.kicad_project_diff_v1",
    provider: "prism-semantic",
    project: { documents: [] },
    navigation: {},
    diagnostics: [],
};

function legacy(overrides: Partial<LegacyResult> = {}): LegacyResult {
    return {
        schema: "prism.semantic_comparison_v3",
        schematic: { changes: [] },
        pcb: { changes: [] },
        bom: null,
        stackup: null,
        document_diff: projectDiff,
        ...overrides,
    };
}

describe("readLegacyResult", () => {
    it("reads an object change's sides, positions and fields", () => {
        const result = readLegacyResult(legacy({
            pcb: {
                changes: [{
                    id: "pcb-changed-b",
                    kind: "changed",
                    domain: "pcb",
                    category: "components",
                    label: "R1",
                    object_kind: "footprint_text",
                    reference: "R1",
                    page: "board.kicad_pcb",
                    base_item: {
                        source_id: "old-uuid",
                        parent_source_id: "fp",
                        page: "board.kicad_pcb",
                        layer: "F.SilkS",
                        layers: ["F.SilkS"],
                    },
                    compare_item: {
                        source_id: "new-uuid",
                        page: "board.kicad_pcb",
                        layers: ["F.Fab", "B.Fab"],
                    },
                    position_base: [1.5, 2.25],
                    position_compare: [101.6, 0.0000004],
                    reasons: ["moved"],
                    fields: {
                        Position: { old: "1.5, 2.25", new: "101.6, 0" },
                        Locked: { old: true, new: null },
                    },
                }],
            },
        }));
        const [change] = result.pcb.changes;
        expect(change).toEqual({
            id: "pcb-changed-b",
            domain: "pcb",
            kind: "changed",
            category: "components",
            classification: "primary",
            label: "R1",
            objectKind: "footprint-text",
            reference: "R1",
            page: "board.kicad_pcb",
            reasons: ["moved"],
            fields: {
                Position: { old: "1.5, 2.25", new: "101.6, 0" },
                Locked: { old: true },
            },
            details: {},
            base: {
                sourceId: "old-uuid",
                parentSourceId: "fp",
                documentPath: "board.kicad_pcb",
                layer: "F.SilkS",
                layers: ["F.SilkS"],
                at: { xNm: 1_500_000, yNm: 2_250_000 },
            },
            head: {
                sourceId: "new-uuid",
                documentPath: "board.kicad_pcb",
                layers: ["B.Fab", "F.Fab"],
                // 0.0000004 mm is 0.4 nm, rounded half up to 0.
                at: { xNm: 101_600_000, yNm: 0 },
            },
        });
        expect(result.counts.pcb).toEqual({ added: 0, removed: 0, changed: 1 });
    });

    it("gives an added object no base and a removed one no head", () => {
        const item = { source_id: "u", page: "a.kicad_sch", layers: [] };
        const result = readLegacyResult(legacy({
            schematic: {
                changes: [
                    {
                        id: "sch-removed-1", kind: "removed", domain: "schematic",
                        category: "symbols", base_item: item, compare_item: item,
                    },
                    {
                        id: "sch-added-1", kind: "added", domain: "schematic",
                        category: "symbols", base_item: item, compare_item: item,
                    },
                ],
            },
        }));
        // Sorted by id, as compare writes them.
        const [added, removed] = result.schematic.changes;
        expect(added.id).toBe("sch-added-1");
        expect(added.base).toBeUndefined();
        expect(added.head?.sourceId).toBe("u");
        expect(added.reasons).toEqual(["object-added"]);
        expect(removed.head).toBeUndefined();
        expect(removed.base?.sourceId).toBe("u");
        expect(removed.reasons).toEqual(["object-removed"]);
    });

    it("reads visual targets, and a structure change's sides from them", () => {
        const result = readLegacyResult(legacy({
            schematic: {
                changes: [{
                    id: "sch-net-changed-net:1",
                    kind: "changed",
                    domain: "schematic",
                    category: "nets",
                    label: "Net VBUS",
                    net: "VBUS",
                    source_id_base: "label-old",
                    reasons: ["connectivity-changed"],
                    details: {
                        connectivity: { addedTerminals: ["U2.1", "J1.4"], removedTerminals: [] },
                        visualTargets: [
                            {
                                side: "reference", sourceId: "label-old", kind: "label",
                                role: "label", documentPath: "root.kicad_sch",
                                at: [10, 20], sheetPath: "/",
                            },
                            {
                                side: "comparison", sourceId: "pin-1", kind: "pin",
                                role: "terminal", page: "root.kicad_sch", reference: "J1",
                            },
                            // `pin` is not a drawing role: the kind carries it.
                            { side: "comparison", sourceId: "pin-2", kind: "pin", role: "pin" },
                            { side: "comparison", sourceId: "", kind: "wire", role: "wire" },
                        ],
                    },
                }],
            },
        }));
        const [change] = result.schematic.changes;
        expect(change.details).toEqual({
            connectivity: { addedTerminals: ["J1.4", "U2.1"], removedTerminals: [] },
            targets: [
                {
                    side: "base", sourceId: "label-old", kind: "label", role: "label",
                    documentPath: "root.kicad_sch", at: { xNm: 10_000_000, yNm: 20_000_000 },
                    sheetPath: "/",
                },
                {
                    side: "head", sourceId: "pin-1", kind: "pin", role: "terminal",
                    documentPath: "root.kicad_sch", reference: "J1",
                },
                { side: "head", sourceId: "pin-2", kind: "pin" },
            ],
        });
        expect(change.base).toEqual({
            sourceId: "label-old",
            documentPath: "root.kicad_sch",
            layers: [],
            at: { xNm: 10_000_000, yNm: 20_000_000 },
        });
        expect(change.head).toBeUndefined();
    });

    it("reads the BOM, stackup and route metrics in the contract's units", () => {
        const result = readLegacyResult(legacy({
            pcb: {
                changes: [],
                route_metrics: {
                    base: {
                        VBUS: {
                            centerline_length_mm: 12.3456,
                            via_count: 2,
                            used_layers: ["F.Cu", "B.Cu"],
                            via_barrel_length_mm: null,
                        },
                    },
                    compare: {
                        VBUS: {
                            centerline_length_mm: 1,
                            via_count: 0,
                            used_layers: [],
                            via_barrel_length_mm: 1.6,
                        },
                    },
                },
            },
            bom: {
                fields: ["Value"],
                changes: [
                    { ref: "R2", status: "added", new: { Value: "1k" } },
                    { ref: "C1", status: "removed", old: { Value: "1u" } },
                ],
                summary: { added: 1, removed: 1 },
            },
            stackup: {
                present: true,
                changed: true,
                base: [
                    { name: "F.Cu", type: "copper", thickness: 0.035, material: null },
                    { name: "core", type: "core", thickness: 0, epsilon_r: 4.5, loss_tangent: 0 },
                ],
                head: [],
                base_settings: { copper_finish: "ENIG", dielectric_constraints: false },
                head_settings: null,
            },
        }));
        expect(result.routeMetrics).toEqual({
            base: {
                VBUS: { routeLengthNm: 12_345_600, viaCount: 2, usedLayers: ["B.Cu", "F.Cu"] },
            },
            head: {
                VBUS: {
                    routeLengthNm: 1_000_000,
                    viaCount: 0,
                    usedLayers: [],
                    viaBarrelLengthNm: 1_600_000,
                },
            },
        });
        expect(result.bom.changes.map((row) => row.ref)).toEqual(["C1", "R2"]);
        expect(result.bom.summary).toEqual({ added: 1, removed: 1, changed: 0 });
        expect(result.counts.bom).toEqual(result.bom.summary);
        expect(result.stackup).toEqual({
            present: true,
            changed: true,
            base: [
                { name: "F.Cu", type: "copper", thicknessNm: 35_000 },
                // A zero thickness is unknown (stackup D3); zero loss is kept.
                { name: "core", type: "core", epsilonR: 4.5, lossTangent: 0 },
            ],
            head: [],
            baseSettings: { copperFinish: "ENIG", dielectricConstraints: false },
            headSettings: {},
        });
        expect(result.projectDiff).toBe(projectDiff);
    });
});
