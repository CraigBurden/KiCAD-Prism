import { describe, expect, it } from "vitest";
import type {
    ChangeItem,
    DesignCompareResult,
} from "./design-comparison/types";
import { buildHistoryReviewSummary } from "./history-review-summary";

function resultWith(
    schematic: ChangeItem[],
    pcb: ChangeItem[] = [],
): DesignCompareResult {
    return {
        base: "base",
        head: "compare",
        files: { base: [], head: [] },
        schematic: {
            pages: [],
            changes: schematic,
            groups: [],
            summary: { added: 0, removed: 0, changed: schematic.length },
        },
        pcb: {
            changes: pcb,
            groups: [],
            summary: { added: 0, removed: 0, changed: pcb.length },
        },
        bom: null,
        stackup: { base: [], head: [], changed: false, present: false },
        document_diff: {
            schema: "prism.kicad_project_diff_v1",
            provider: "prism-semantic",
            project: { documents: [] },
            navigation: {},
            diagnostics: [],
        },
    };
}

describe("history review summary", () => {
    it("individualises a value-only component change with old/new evidence", () => {
        const summary = buildHistoryReviewSummary(resultWith([{
            id: "component-c102",
            kind: "changed",
            domain: "schematic",
            category: "components",
            classification: "primary",
            label: "C102",
            reference: "C102",
            page: "power.kicad_sch",
            fields: { Value: { old: "100 nF", new: "1 µF" } },
            reasons: ["symbol-fields-changed"],
        }]));

        expect(summary.entries).toEqual([expect.objectContaining({
            changeId: "component-c102",
            section: "components",
            label: "C102",
            page: "power.kicad_sch",
            evidence: ["Value: 100 nF → 1 µF"],
        })]);
    });

    it("orders components naturally before supporting design changes", () => {
        const changes: ChangeItem[] = [
            {
                id: "net-vcc",
                kind: "changed",
                domain: "schematic",
                category: "nets",
                classification: "primary",
                label: "VCC",
                net: "VCC",
                reasons: ["connectivity-changed"],
            },
            ...["C20", "C3"].map((reference): ChangeItem => ({
                id: `component-${reference}`,
                kind: "added",
                domain: "schematic",
                category: "components",
                classification: "primary",
                label: reference,
                reference,
            })),
        ];

        expect(buildHistoryReviewSummary(resultWith(changes)).entries.map(
            (entry) => `${entry.section}:${entry.label}`,
        )).toEqual([
            "components:C3",
            "components:C20",
            "nets:VCC",
        ]);
    });

    it("keeps one-sided component targets navigable", () => {
        const summary = buildHistoryReviewSummary(resultWith([{
            id: "component-r8-removed",
            kind: "removed",
            domain: "schematic",
            category: "components",
            classification: "primary",
            label: "R8",
            reference: "R8",
            base_item: { path: "analog.kicad_sch", reference: "R8" },
            compare_item: null,
        }]));

        expect(summary.entries[0]).toEqual(expect.objectContaining({
            changeId: "component-r8-removed",
            kind: "removed",
            page: "analog.kicad_sch",
            evidence: ["Removed from the design"],
        }));
    });

    it("consolidates schematic, footprint, and footprint-text evidence by designator", () => {
        const schematic: ChangeItem = {
            id: "schematic-r110",
            kind: "changed",
            domain: "schematic",
            category: "components",
            classification: "primary",
            label: "R110",
            reference: "R110",
            page: "bank8_configuration.kicad_sch",
            fields: { Value: { old: "10k", new: "5.1k" } },
        };
        const pcb = ["footprint", "footprint_text"].map((objectKind): ChangeItem => ({
            id: `pcb-r110-${objectKind}`,
            kind: "changed",
            domain: "pcb",
            category: "components",
            classification: "primary",
            label: "R110",
            reference: "R110",
            object_kind: objectKind,
            page: "cynthion.kicad_pcb",
            fields: { Text: { old: "10k", new: "5.1k" } },
        }));

        const summary = buildHistoryReviewSummary(resultWith([schematic], pcb));

        expect(summary.entries).toHaveLength(1);
        expect(summary.entries[0]).toEqual(expect.objectContaining({
            changeId: "schematic-r110",
            domain: "schematic",
            domains: ["schematic", "pcb"],
            label: "R110",
            page: "bank8_configuration.kicad_sch",
            evidence: ["Value: 10k → 5.1k", "Text: 10k → 5.1k"],
        }));
    });

    it("puts the component value first in compact review evidence", () => {
        const summary = buildHistoryReviewSummary(resultWith([{
            id: "component-r110",
            kind: "changed",
            domain: "schematic",
            category: "components",
            classification: "primary",
            label: "R110",
            reference: "R110",
            fields: {
                Description: { old: "10K resistor", new: "5.1K resistor" },
                Value: { old: "10k", new: "5.1k" },
                "Part Number": { old: "OLD", new: "NEW" },
            },
        }]));

        expect(summary.entries[0]?.evidence).toEqual([
            "Value: 10k → 5.1k",
            "Description: 10K resistor → 5.1K resistor",
            "Part Number: OLD → NEW",
        ]);
    });
});
