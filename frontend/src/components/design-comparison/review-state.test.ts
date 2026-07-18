import { describe, expect, it } from "vitest";
import { filterBomRows } from "./bom-panel";
import {
    groupChanges,
    readInitialUrlState,
} from "./design-comparison-workspace";
import {
    revisionSourceKey,
    resolveNativeSelection,
    resolveSelectedDocument,
} from "./native-document-comparison-panel";
import type {
    ChangeItem,
    BomDiff,
    KiCadProjectDiffBundle,
} from "./types";
import type { EcadDocumentComparisonPreparation } from "@/types/ecad-viewer";
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

    it("keeps PCB and schematic snapshots distinct at the same revision", () => {
        expect(revisionSourceKey("project", "abc123", "pcb")).toBe(
            "project:abc123:pcb",
        );
        expect(revisionSourceKey("project", "abc123", "schematic")).toBe(
            "project:abc123:schematic",
        );
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

    it("resolves a selected Prism row to its native document and target", () => {
        const bundle: KiCadProjectDiffBundle = {
            schema: "prism.kicad_project_diff_v1",
            provider: "prism-semantic",
            project: {
                documents: [
                    {
                        path: "processor.kicad_sch",
                        docType: "kicad_sch",
                        changes: [],
                    },
                ],
            },
            navigation: {
                first: {
                    documentPath: "processor.kicad_sch",
                    changeId: "/uuid-1",
                },
                second: {
                    documentPath: "processor.kicad_sch",
                    changeId: "/uuid-2",
                },
            },
            diagnostics: [],
        };
        const changes = [
            { ...change("first", "changed", "uuid-1"), domain: "schematic" as const },
            { ...change("second", "changed", "uuid-2"), domain: "schematic" as const },
        ];
        const targets = new Map([
            [
                "group:net:modified:VCC",
                {
                    id: "net:modified:VCC",
                    kind: "group" as const,
                    category: "modified" as const,
                    label: "VCC",
                    memberIds: ["/uuid-1", "/uuid-2"],
                    sourceIds: ["uuid-1", "uuid-2"],
                    bounds: [10, 10, 14, 11] as [number, number, number, number],
                },
            ],
        ]);
        const preparation: EcadDocumentComparisonPreparation = {
            comparisonKey: "comparison",
            context: "SCH",
            document: bundle.project.documents[0]!,
            targets,
            diagnostics: [],
            prepareMs: 10,
            sourceCacheHit: false,
        };

        expect(resolveSelectedDocument("schematic", bundle, changes)?.path)
            .toBe("processor.kicad_sch");
        expect(resolveNativeSelection(
            preparation,
            bundle,
            { kind: "group", id: "processor-group" },
            changes,
        )).toEqual({ kind: "group", id: "net:modified:VCC" });
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
