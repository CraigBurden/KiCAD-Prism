import { describe, expect, it } from "vitest";
import { groupChanges } from "./comparison-review-groups";
import {
    reviewImpactCounts,
    reviewImpactForGroup,
    reviewStatusCounts,
} from "./comparison-review-queue";
import type { ChangeItem } from "./types";

/**
 * How grouped review items are owned, counted and ordered.
 *
 * These drive `groupChanges` only to get a realistic group to ask about — the
 * subject is what the queue then says about it. The rules that decide what
 * shares a group, and which parser events survive to be grouped at all, are
 * covered by `comparison-review-groups.test.ts`.
 */

type ChangeSpec = Partial<ChangeItem> & { layers?: string[] };

function schematicChange(overrides: ChangeSpec = {}): ChangeItem {
    const { layers, ...rest } = overrides;
    const sideLayers = layers ?? [];
    return {
        id: "change-1",
        kind: "changed",
        domain: "schematic",
        category: "components",
        classification: "primary",
        label: "U1",
        reference: "U1",
        semanticId: "cmp:u1",
        objectKind: "symbol",
        page: "main.kicad_sch",
        reasons: ["properties-changed"],
        fields: {},
        details: {},
        base: { sourceId: "base-1", documentPath: "main.kicad_sch", layers: sideLayers },
        head: { sourceId: "head-1", documentPath: "main.kicad_sch", layers: sideLayers },
        ...rest,
    };
}

describe("review ownership and counts", () => {
    it("assigns deterministic engineering ownership to review groups", () => {
        const footprintRotation = groupChanges([schematicChange({
            domain: "pcb",
            category: "components",
            objectKind: "footprint",
            reasons: ["rotated"],
            layers: ["B.Cu"],
        })])[0]!;
        const netRename = groupChanges([schematicChange({
            domain: "pcb",
            category: "nets",
            reference: undefined,
            objectKind: "track",
            net: "PMOD_A4",
            reasons: ["net-changed"],
            fields: { Net: { old: "PMOD_A3", new: "PMOD_A4" } },
        })])[0]!;
        const boardOutline = groupChanges([schematicChange({
            domain: "pcb",
            category: "graphics",
            reference: undefined,
            objectKind: "graphic",
            layers: ["Edge.Cuts"],
            reasons: ["moved"],
        })])[0]!;
        const constraint = groupChanges([schematicChange({
            domain: "pcb",
            category: "rules",
            reference: undefined,
            objectKind: "board_constraint",
        })])[0]!;

        expect(reviewImpactForGroup(footprintRotation)).toBe("fabrication");
        expect(reviewImpactForGroup(netRename)).toBe("electrical");
        expect(reviewImpactForGroup(boardOutline)).toBe("mechanical");
        expect(reviewImpactForGroup(constraint)).toBe("constraints");
    });

    it("counts review items, not parser events, per status", () => {
        const groups = groupChanges([
            schematicChange({ id: "a", semanticId: "cmp:u1" }),
            // Same component: one review item, so one modification counted.
            schematicChange({ id: "b", semanticId: "cmp:u1" }),
            schematicChange({
                id: "c",
                kind: "added",
                label: "R7",
                reference: "R7",
                semanticId: "cmp:r7",
            }),
        ]);

        expect(reviewStatusCounts(groups)).toEqual({
            added: 1,
            changed: 1,
            removed: 0,
        });
    });

    it("orders owner counts by how much work each discipline is owed", () => {
        const groups = groupChanges([
            schematicChange({
                id: "outline",
                domain: "pcb",
                category: "graphics",
                reference: undefined,
                objectKind: "graphic",
                semanticId: "gfx:outline",
                layers: ["Edge.Cuts"],
                reasons: ["moved"],
            }),
            schematicChange({
                id: "fp-1",
                domain: "pcb",
                category: "components",
                objectKind: "footprint",
                semanticId: "fp:u1",
                reasons: ["rotated"],
                layers: ["F.Cu"],
            }),
            schematicChange({
                id: "fp-2",
                domain: "pcb",
                category: "components",
                label: "R7",
                reference: "R7",
                objectKind: "footprint",
                semanticId: "fp:r7",
                reasons: ["moved"],
                layers: ["F.Cu"],
            }),
        ]);

        expect(reviewImpactCounts(groups)).toEqual([
            { impact: "fabrication", count: 2 },
            { impact: "mechanical", count: 1 },
        ]);
    });
});
