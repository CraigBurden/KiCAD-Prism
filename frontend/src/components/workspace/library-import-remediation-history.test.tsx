import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./catalog-client");
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import * as catalog from "./catalog-client";
import type { CatalogMetadataField, ProjectComponentImportProposal } from "@/types/catalog";
import { LibraryImportRemediationGrid } from "./library-import-remediation-grid";

// The remediation grid's staged edits: per-keystroke commits, fill-down,
// undo/redo from the toolbar and the keyboard, and save wiping history.

function proposal(id: string, reference: string, mpn: string): ProjectComponentImportProposal {
    return {
        id, session_id: "s1", dedupe_key: id, component_uid: id, reference, status: "candidate",
        accepted_component_id: "",
        metadata: { value: "10k", manufacturer: "Yageo", manufacturer_part_number: mpn, description: "Resistor", datasheet: "", footprint: "R_0402" },
        assets: [], provenance: [], findings: [],
    };
}

const PROPOSALS = [proposal("p1", "R1", "RC0402"), proposal("p2", "R2", "RC0603")];

afterEach(() => vi.clearAllMocks());

function renderGrid(onRefresh = vi.fn()) {
    render(
        <LibraryImportRemediationGrid sessionId="s1" proposals={PROPOSALS} canWrite onShowDetailView={vi.fn()} onRefresh={onRefresh} />,
    );
}

const input = (column: string, reference: string) =>
    screen.getByRole("textbox", { name: `${column} for ${reference}` }) as HTMLInputElement;
const undoButton = () => screen.getByRole("button", { name: "Undo" });
const redoButton = () => screen.getByRole("button", { name: "Redo" });

describe("remediation grid staged history", () => {
    it("undoes and redoes each keystroke from the toolbar and the keyboard", () => {
        renderGrid();
        expect(undoButton()).toBeDisabled();
        fireEvent.change(input("Datasheet", "R1"), { target: { value: "h" } });
        fireEvent.change(input("Datasheet", "R1"), { target: { value: "ht" } });
        expect(screen.getByRole("button", { name: /Save edits \(1\)/ })).toBeEnabled();

        fireEvent.click(undoButton());
        expect(input("Datasheet", "R1").value).toBe("h");
        fireEvent.keyDown(input("Datasheet", "R1"), { key: "z", ctrlKey: true });
        expect(input("Datasheet", "R1").value).toBe("");
        expect(undoButton()).toBeDisabled();

        fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true });
        expect(input("Datasheet", "R1").value).toBe("h");
        fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
        expect(input("Datasheet", "R1").value).toBe("ht");
        expect(redoButton()).toBeDisabled();
    });

    it("fills a value down every visible row as one undo step", () => {
        renderGrid();
        fireEvent.change(input("Datasheet", "R1"), { target: { value: "https://x.test/d.pdf" } });
        const fill = screen.getAllByTitle("Fill this value down into selected rows");
        // Columns are value, manufacturer, mpn, description, datasheet, package.
        fireEvent.click(fill[4]);
        expect(input("Datasheet", "R2").value).toBe("https://x.test/d.pdf");

        fireEvent.click(undoButton());
        expect(input("Datasheet", "R2").value).toBe("");
        expect(input("Datasheet", "R1").value).toBe("https://x.test/d.pdf");
    });

    it("saves with mod+s and wipes the history", async () => {
        vi.mocked(catalog.saveProposalDrafts).mockResolvedValue(undefined as never);
        const onRefresh = vi.fn();
        renderGrid(onRefresh);
        fireEvent.change(input("Datasheet", "R1"), { target: { value: "https://x.test/d.pdf" } });

        fireEvent.keyDown(document.body, { key: "s", ctrlKey: true });
        await waitFor(() => expect(onRefresh).toHaveBeenCalled());
        expect(catalog.saveProposalDrafts).toHaveBeenCalledWith("s1", {
            p1: { metadata_overrides: { datasheet: "https://x.test/d.pdf" } },
        });
        expect(undoButton()).toBeDisabled();
        expect(redoButton()).toBeDisabled();
    });
});

const APPROVAL: CatalogMetadataField = {
    id: "field-1", key: "approval_ref", label: "Approval Ref", description: "", group: "custom", type: "text",
    unit: "", enum_values: [], storage_kind: "extra", storage_key: "approval_ref", built_in: false, required: true,
    display_order: 100, archived: false, created_by: "", updated_by: "", created_at: "", updated_at: "",
};

describe("remediation grid custom fields (D43)", () => {
    const withFields = (scanned: Record<string, string>) => PROPOSALS.map((row) => ({
        ...row,
        metadata: { ...row.metadata, datasheet: "https://x.test/d.pdf", fields: scanned },
        assets: [
            { asset_type: "symbol" as const, filename: "R.kicad_sym", sha256: "a", size_bytes: 1, target_library: "L", target_name: "R", source_path: "R.kicad_sym" },
            { asset_type: "footprint" as const, filename: "R.kicad_mod", sha256: "b", size_bytes: 1, target_library: "L", target_name: "R", source_path: "R.kicad_mod" },
        ],
    }));

    it("shows an editable, flagged column that blocks import until filled, then sends it with the symbol's fields", async () => {
        vi.mocked(catalog.bulkAcceptProposals).mockResolvedValue({ accepted: 1, failed: 0, results: [] } as never);
        render(
            <LibraryImportRemediationGrid
                sessionId="s1" proposals={withFields({ Tolerance: "1%" })} customFields={[APPROVAL]}
                canWrite onShowDetailView={vi.fn()} onRefresh={vi.fn()}
            />,
        );
        expect(screen.getByRole("button", { name: /Import all ready \(0\)/ })).toBeDisabled();
        expect(input("Approval Ref", "R1")).toHaveAttribute("aria-invalid", "true");

        fireEvent.change(input("Approval Ref", "R1"), { target: { value: "QA-7" } });
        fireEvent.click(screen.getByRole("button", { name: /Import all ready \(1\)/ }));

        await waitFor(() => expect(catalog.bulkAcceptProposals).toHaveBeenCalled());
        const [, items] = vi.mocked(catalog.bulkAcceptProposals).mock.calls[0];
        expect(items).toEqual([
            expect.objectContaining({
                proposal_id: "p1",
                metadata_overrides: expect.objectContaining({ extra_fields: { Tolerance: "1%", approval_ref: "QA-7" } }),
            }),
        ]);
    });

    it("saves an edited custom value in the draft's extra_fields", async () => {
        vi.mocked(catalog.saveProposalDrafts).mockResolvedValue(undefined as never);
        const onRefresh = vi.fn();
        render(
            <LibraryImportRemediationGrid
                sessionId="s1" proposals={withFields({})} customFields={[APPROVAL]}
                canWrite onShowDetailView={vi.fn()} onRefresh={onRefresh}
            />,
        );
        fireEvent.change(input("Approval Ref", "R2"), { target: { value: "QA-8" } });
        fireEvent.keyDown(document.body, { key: "s", ctrlKey: true });

        await waitFor(() => expect(onRefresh).toHaveBeenCalled());
        expect(catalog.saveProposalDrafts).toHaveBeenCalledWith("s1", {
            p2: { metadata_overrides: { extra_fields: { approval_ref: "QA-8" } } },
        });
    });
});
