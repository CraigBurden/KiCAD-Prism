import { describe, expect, it } from "vitest";
import { filterBomRows } from "./bom-panel";
import {
    groupChanges,
    readInitialUrlState,
} from "./design-comparison-workspace";
import { reviewPresentations } from "./semantic-composite-panel";
import type { ChangeItem, BomDiff } from "./types";
import type { Comment } from "@/types/comments";

const change = (
    id: string,
    kind: ChangeItem["kind"],
    source: string,
): ChangeItem => ({
    id,
    kind,
    domain: "pcb",
    category: "components",
    classification: "primary",
    label: "U1",
    reference: "U1",
    semantic_id: "cmp:u1",
    source_id_base: kind === "added" ? null : source,
    source_id_compare: kind === "removed" ? null : source,
});

describe("semantic comparison state", () => {
    it("hydrates the shareable semantic URL state", () => {
        expect(readInitialUrlState(
            "?diff=pcb&item=track-1&secondary=1&layers=F.Cu,B.Cu",
        )).toEqual({
            activeTab: "pcb",
            selectedChangeId: "track-1",
            showSecondary: true,
            layers: ["F.Cu", "B.Cu"],
        });
    });

    it("deduplicates members into one stable semantic group and counts open threads", () => {
        const comments = [{
            id: "c1",
            status: "OPEN",
            semanticItemId: "pcb:components:cmp:u1",
        }] as Comment[];
        const groups = groupChanges(
            [change("semantic", "changed", "uuid-1"), change("geometry", "changed", "uuid-1")],
            comments,
        );
        expect(groups).toHaveLength(1);
        expect(groups[0]?.id).toBe("pcb:components:cmp:u1");
        expect(groups[0]?.changes).toHaveLength(2);
        expect(groups[0]?.unresolvedCount).toBe(1);
    });

    it("builds one semantic composite without an old-mode selector", () => {
        const presentations = reviewPresentations(
            "pcb",
            [change("removed", "removed", "old-uuid"), change("added", "added", "new-uuid")],
            { added: "green", removed: "red", changed: "amber" },
        );
        expect(presentations.compare.defaultStyle).toEqual({
            colorMode: "monochrome",
            opacity: 0.28,
        });
        expect(presentations.base.defaultStyle).toEqual({
            visibility: "hidden",
            opacity: 0,
        });
        expect(presentations.compare.rules?.[0]?.style.tint).toBe("green");
        expect(presentations.base.rules?.[0]?.style.tint).toBe("red");
    });
});

describe("BOM filters", () => {
    const bom: BomDiff = {
        summary: { added: 1, removed: 0, changed: 0 },
        fields: ["Reference", "Value", "Tolerance"],
        changes: [
            {
                ref: "R1",
                status: "added",
                new: { Reference: "R1", Value: "10k", Tolerance: "1%" },
            },
            {
                ref: "R2",
                status: "unchanged",
                old: { Reference: "R2", Value: "1k", Tolerance: "5%" },
                new: { Reference: "R2", Value: "1k", Tolerance: "5%" },
            },
        ],
    };

    it("combines status, unchanged, search, and engineering-field filters", () => {
        const statuses = new Set<"added" | "removed" | "changed">(["added"]);
        expect(filterBomRows(bom, statuses, false, "", "Tolerance", "")).toHaveLength(1);
        expect(filterBomRows(bom, statuses, true, "R2", "Tolerance", "5%"))
            .toEqual([bom.changes[1]]);
        expect(filterBomRows(bom, statuses, true, "", "Tolerance", "0.1%"))
            .toHaveLength(0);
    });
});
