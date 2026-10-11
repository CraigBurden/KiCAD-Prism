import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./catalog-client");
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import * as catalog from "./catalog-client";
import type { ProjectComponentImportProposal } from "@/types/catalog";
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
