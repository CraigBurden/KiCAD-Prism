import { describe, expect, it } from "vitest";

import { semanticCategory } from "./comparison-change-facts";
import { CHANGE_KINDS, kindNoun } from "./comparison-change-kinds";
import { layerFocusForChanges } from "./comparison-layer-focus";
import { propertyDeltas } from "./comparison-property-model";
import { groupChanges } from "./comparison-review-groups";
import { prepareChangesForReview } from "./comparison-review-noise";
import { recommendPresentationForChange } from "./comparison-review-policy";
import { reviewImpactForGroup } from "./comparison-review-queue";
import type { ChangeItem } from "./types";

function change(kind: string, overrides: Partial<ChangeItem> = {}): ChangeItem {
    const domain = CHANGE_KINDS[kind]!.domain === "schematic" ? "schematic" : "pcb";
    const page = domain === "pcb" ? "board.kicad_pcb" : "root.kicad_sch";
    return {
        id: `${kind}-1`,
        kind: "changed",
        domain,
        category: "other",
        classification: "primary",
        label: "U1",
        reference: "U1",
        page,
        objectKind: kind,
        base: { sourceId: "a", documentPath: page, layers: ["B.Cu"], parentSourceId: "fp" },
        head: { sourceId: "a", documentPath: page, layers: ["B.Cu"], parentSourceId: "fp" },
        fields: { Position: { old: "1", new: "2" }, Width: { old: "0.2", new: "0.3" } },
        reasons: ["moved"],
        details: {},
        ...overrides,
    };
}

const track = change("track", {
    id: "companion-track",
    reference: undefined,
    base: { sourceId: "t", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
    head: { sourceId: "t", documentPath: "board.kicad_pcb", layers: ["F.Cu"] },
});

/**
 * What the review modules answer for one modified change of a kind, captured
 * before the kind table replaced their own kind sets. A new kind adds a row.
 *
 * Columns: semantic category, presentation rule when modified and when added,
 * comparison-side focus layers next to an F.Cu track, groups formed by two
 * same-net changes without a RefDes, review impact, whether a layout-only
 * edit survives noise suppression, and the property rows shown.
 */
const EXPECTED: Array<[
    kind: string,
    category: string,
    modifiedRule: string,
    addedRule: string,
    focus: string | null,
    netGroups: number,
    impact: string,
    layoutKept: number,
    fields: string,
]> = [
    ["symbol", "other", "schematic-component-geometry", "schematic-component-add-remove", null, 1, "documentation", 1, "Width"],
    ["pin", "other", "schematic-electrical-exact", "schematic-electrical-exact", null, 1, "documentation", 0, "Width"],
    ["sheet", "other", "schematic-electrical-exact", "schematic-electrical-exact", null, 1, "documentation", 1, "Width"],
    ["sheet-pin", "other", "schematic-electrical-exact", "schematic-electrical-exact", null, 1, "electrical", 1, "Width"],
    ["no-connect", "other", "schematic-electrical-exact", "schematic-electrical-exact", null, 2, "documentation", 1, "Width"],
    ["wire", "other", "schematic-net-geometry", "schematic-net-add-remove", null, 1, "documentation", 1, "Width"],
    ["junction", "other", "schematic-net-geometry", "schematic-net-add-remove", null, 1, "documentation", 1, "Width"],
    ["bus", "other", "schematic-electrical-exact", "schematic-electrical-exact", null, 1, "documentation", 1, "Width"],
    ["bus-entry", "other", "schematic-electrical-exact", "schematic-electrical-exact", null, 1, "documentation", 1, "Width"],
    ["label", "other", "schematic-net-geometry", "schematic-net-add-remove", null, 1, "documentation", 1, "Width"],
    ["footprint", "other", "pcb-fabrication-object", "pcb-fabrication-object", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["pad", "components", "pcb-fabrication-object", "pcb-fabrication-object", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["track", "other", "pcb-fabrication-object", "pcb-fabrication-object", "B.Cu,F.Cu", 1, "fabrication", 1, "Position,Width"],
    ["arc", "other", "pcb-fabrication-object", "pcb-fabrication-object", "B.Cu,F.Cu", 1, "fabrication", 1, "Position,Width"],
    ["via", "other", "pcb-fabrication-object", "pcb-fabrication-object", "F.Cu", 1, "fabrication", 1, "Position,Width"],
    ["zone", "components", "pcb-fabrication-object", "pcb-fabrication-object", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["footprint-graphic", "components", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["footprint-text", "components", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["graphic", "other", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["group", "other", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["text", "other", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["image", "other", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["table", "other", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["board-constraint", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["board-default", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["custom-rule", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["drc-exclusion", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["drc-severity", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["erc-exclusion", "rules", "schematic-modified-fallback", "schematic-add-remove-fallback", null, 1, "constraints", 1, "Width"],
    ["erc-pin-rule", "rules", "schematic-modified-fallback", "schematic-add-remove-fallback", null, 1, "constraints", 1, "Width"],
    ["fabrication-output", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["net-class", "rules", "pcb-net-class", "pcb-net-class", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["net-class-assignment", "rules", "pcb-net-class", "pcb-net-class", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["routing-preset", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["teardrop-setting", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["zone-setting", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
];

describe("change-kind table", () => {
    it("has one expectation row per kind", () => {
        expect(EXPECTED.map(([kind]) => kind)).toEqual(Object.keys(CHANGE_KINDS));
    });

    it.each(EXPECTED)(
        "%s reads the same in every review module",
        (kind, category, modifiedRule, addedRule, focus, netGroups, impact, layoutKept, fields) => {
            const modified = change(kind);
            const groups = groupChanges([modified, change(kind, { id: `${kind}-2` })]);
            const focused = layerFocusForChanges([modified, track]);
            expect({
                category: semanticCategory(modified),
                modifiedRule: recommendPresentationForChange(modified).rule,
                addedRule: recommendPresentationForChange(change(kind, { kind: "added" })).rule,
                focus: focused ? [...focused.comparison].sort().join(",") : null,
                netGroups: groupChanges([
                    change(kind, { reference: undefined, net: "N1", label: "N1", semanticId: "a" }),
                    change(kind, { id: `${kind}-3`, reference: undefined, net: "N1", label: "N1", semanticId: "b" }),
                ]).length,
                impact: reviewImpactForGroup(groups[0]!),
                layoutKept: prepareChangesForReview([
                    change(kind, { fields: { Position: { old: "1", new: "2" } } }),
                ]).changes.length,
                fields: propertyDeltas([modified]).map((delta) => delta.label).join(","),
            }).toEqual({ category, modifiedRule, addedRule, focus, netGroups, impact, layoutKept, fields });
            expect(groups).toHaveLength(1);
        },
    );

    it("names kinds with the reviewer noun", () => {
        expect(kindNoun("bus-entry")).toBe("bus entry");
        expect(kindNoun("track", 3)).toBe("tracks");
        expect(kindNoun("not_in_table", 2)).toBe("not in tables");
    });

    it("carries only the parser's canonical kinds, not its form names (CANONICAL_KINDS in ecad-parse.mjs)", () => {
        for (const raw of ["segment", "arc_segment", "drawing", "footprint_zone", "global_label", "hierarchical_label"]) {
            expect(CHANGE_KINDS[raw]).toBeUndefined();
        }
    });
});
