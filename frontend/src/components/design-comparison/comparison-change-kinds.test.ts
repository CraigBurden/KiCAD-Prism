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
    return {
        id: `${kind}-1`,
        kind: "changed",
        domain,
        category: "other",
        classification: "primary",
        label: "U1",
        reference: "U1",
        page: domain === "pcb" ? "board.kicad_pcb" : "root.kicad_sch",
        object_kind: kind,
        layers: ["B.Cu"],
        base_item: { source_id: "a", semantic_id: null, layers: ["B.Cu"], parent_source_id: "fp" },
        compare_item: { source_id: "a", semantic_id: null, layers: ["B.Cu"], parent_source_id: "fp" },
        fields: { Position: { old: "1", new: "2" }, Width: { old: "0.2", new: "0.3" } },
        reasons: ["moved"],
        ...overrides,
    } as ChangeItem;
}

const track = change("track", {
    id: "companion-track",
    reference: null,
    layers: ["F.Cu"],
    base_item: { source_id: "t", semantic_id: null, layers: ["F.Cu"] },
    compare_item: { source_id: "t", semantic_id: null, layers: ["F.Cu"] },
} as Partial<ChangeItem>);

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
    ["sheet_pin", "other", "schematic-electrical-exact", "schematic-electrical-exact", null, 1, "electrical", 1, "Width"],
    ["no_connect", "other", "schematic-electrical-exact", "schematic-electrical-exact", null, 2, "documentation", 1, "Width"],
    ["wire", "other", "schematic-net-geometry", "schematic-net-add-remove", null, 1, "documentation", 1, "Width"],
    ["junction", "other", "schematic-net-geometry", "schematic-net-add-remove", null, 1, "documentation", 1, "Width"],
    ["bus", "other", "schematic-electrical-exact", "schematic-electrical-exact", null, 1, "documentation", 1, "Width"],
    ["bus_entry", "other", "schematic-electrical-exact", "schematic-electrical-exact", null, 1, "documentation", 1, "Width"],
    ["label", "other", "schematic-net-geometry", "schematic-net-add-remove", null, 1, "documentation", 1, "Width"],
    ["footprint", "other", "pcb-fabrication-object", "pcb-fabrication-object", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["pad", "components", "pcb-fabrication-object", "pcb-fabrication-object", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["track", "other", "pcb-fabrication-object", "pcb-fabrication-object", "B.Cu,F.Cu", 1, "fabrication", 1, "Position,Width"],
    ["arc", "other", "pcb-fabrication-object", "pcb-fabrication-object", "B.Cu,F.Cu", 1, "fabrication", 1, "Position,Width"],
    ["via", "other", "pcb-fabrication-object", "pcb-fabrication-object", "F.Cu", 1, "fabrication", 1, "Position,Width"],
    ["zone", "components", "pcb-fabrication-object", "pcb-fabrication-object", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["footprint_graphic", "components", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["footprint_text", "components", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["graphic", "other", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["group", "other", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["text", "other", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["image", "other", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["table", "other", "pcb-fabrication-graphic", "pcb-fabrication-graphic", "B.Cu,F.Cu", 2, "fabrication", 1, "Position,Width"],
    ["board_constraint", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["board_default", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["custom_rule", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["drc_exclusion", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["drc_severity", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["erc_exclusion", "rules", "schematic-modified-fallback", "schematic-add-remove-fallback", null, 1, "constraints", 1, "Width"],
    ["erc_pin_rule", "rules", "schematic-modified-fallback", "schematic-add-remove-fallback", null, 1, "constraints", 1, "Width"],
    ["fabrication_output", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["net_class", "rules", "pcb-net-class", "pcb-net-class", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["net_class_assignment", "rules", "pcb-net-class", "pcb-net-class", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["routing_preset", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["teardrop_setting", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
    ["zone_setting", "rules", "pcb-modified-fallback", "pcb-add-remove-fallback", "B.Cu,F.Cu", 1, "constraints", 1, "Position,Width"],
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
                    change(kind, { reference: null, net: "N1", label: "N1", semantic_id: "a" }),
                    change(kind, { id: `${kind}-3`, reference: null, net: "N1", label: "N1", semantic_id: "b" }),
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
        expect(kindNoun("bus_entry")).toBe("bus entry");
        expect(kindNoun("track", 3)).toBe("tracks");
        expect(kindNoun("not_in_table", 2)).toBe("not in tables");
    });

    it("carries only the backend's canonical spellings", () => {
        for (const raw of ["segment", "arc_segment", "drawing", "footprint_zone", "global_label", "hierarchical_label"]) {
            expect(CHANGE_KINDS[raw]).toBeUndefined();
        }
    });
});
