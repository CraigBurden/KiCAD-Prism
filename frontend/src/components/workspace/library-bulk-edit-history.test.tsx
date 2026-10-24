import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./catalog-client");
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import * as catalog from "./catalog-client";
import { LibraryBulkEditWorkspace } from "./library-bulk-edit-workspace";

// Bulk edit's staged edits: undo and redo from the toolbar and from the
// keyboard while focus is in the grid, and paste from the active cell.

const FIELD = {
    id: "f1", key: "value", label: "Value", description: "", group: "core",
    type: "text", unit: "", enum_values: [], storage_kind: "column",
    storage_key: "value", built_in: true, required: false, display_order: 1,
    archived: false,
};

const COMPONENTS = [
    { id: "c1", name: "R1", mpn: "RC0402", value: "10k", workflow_stage: "open", revision: 1, revision_id: "r1", extra: {} },
    { id: "c2", name: "R2", mpn: "RC0603", value: "1k", workflow_stage: "open", revision: 1, revision_id: "r2", extra: {} },
];

beforeEach(() => {
    vi.mocked(catalog.listMetadataFields).mockResolvedValue({ items: [FIELD] } as never);
    vi.mocked(catalog.getMetadataGridPreferences).mockResolvedValue(
        { visible: ["value"], order: ["value"], widths: {}, pinned: [] },
    );
    vi.mocked(catalog.listCategories).mockResolvedValue({ categories: [] });
    vi.mocked(catalog.getMetadataGrid).mockResolvedValue(
        { items: COMPONENTS, total: 2, page: 1, page_size: 100, pages: 1, schema: "v1", fields: [FIELD] } as never,
    );
    vi.mocked(catalog.saveMetadataGridPreferences).mockResolvedValue({});
});
afterEach(() => vi.clearAllMocks());

const undoButton = () => screen.getByRole("button", { name: "Undo metadata edit" });
const redoButton = () => screen.getByRole("button", { name: "Redo metadata edit" });
const stagedCount = () => screen.getByRole("button", { name: /staged components/ }).getAttribute("aria-label");

async function renderGrid() {
    render(<LibraryBulkEditWorkspace user={{ id: "u1", email: "a@b.c", role: "admin" } as never} />);
    await waitFor(() => expect(screen.getByRole("gridcell", { name: "Value: 10k" })).toBeInTheDocument());
}

async function editFirstCell(value: string) {
    fireEvent.focus(screen.getByRole("gridcell", { name: "Value: 10k" }));
    const editor = await screen.findByRole("textbox", { name: "Value" });
    fireEvent.change(editor, { target: { value } });
    fireEvent.blur(editor);
}

describe("bulk edit staged history", () => {
    it("undoes and redoes a committed cell from the toolbar", async () => {
        await renderGrid();
        expect(undoButton()).toBeDisabled();
        await editFirstCell("22k");
        await waitFor(() => expect(stagedCount()).toContain("1 staged components"));
        expect(undoButton()).toBeEnabled();
        expect(redoButton()).toBeDisabled();

        fireEvent.click(undoButton());
        expect(stagedCount()).toContain("0 staged components");
        expect(undoButton()).toBeDisabled();
        expect(redoButton()).toBeEnabled();

        fireEvent.click(redoButton());
        expect(stagedCount()).toContain("1 staged components");
        expect(redoButton()).toBeDisabled();
    });

    it("undoes with the keyboard while focus is in the grid, but not from the search box", async () => {
        await renderGrid();
        await editFirstCell("22k");
        await waitFor(() => expect(stagedCount()).toContain("1 staged components"));

        fireEvent.keyDown(screen.getByRole("textbox", { name: "Search components" }), { key: "z", ctrlKey: true });
        expect(stagedCount()).toContain("1 staged components");

        fireEvent.keyDown(screen.getByRole("gridcell", { name: "Value: 1k" }), { key: "z", ctrlKey: true });
        expect(stagedCount()).toContain("0 staged components");

        fireEvent.keyDown(screen.getByRole("gridcell", { name: "Value: 1k" }), { key: "z", ctrlKey: true, shiftKey: true });
        expect(stagedCount()).toContain("1 staged components");

        fireEvent.click(undoButton());
        fireEvent.keyDown(screen.getByRole("gridcell", { name: "Value: 1k" }), { key: "y", ctrlKey: true });
        expect(stagedCount()).toContain("1 staged components");
    });

    it("pastes a column of values down from the active cell as one undo step", async () => {
        await renderGrid();
        fireEvent.focus(screen.getByRole("gridcell", { name: "Value: 10k" }));
        await screen.findByRole("textbox", { name: "Value" });

        fireEvent.paste(screen.getByRole("grid"), {
            clipboardData: { getData: () => "47k\n4k7\n" },
        });
        expect(stagedCount()).toContain("2 staged components");
        expect(screen.getByRole("gridcell", { name: "Value: 4k7" })).toBeInTheDocument();

        fireEvent.click(undoButton());
        expect(stagedCount()).toContain("0 staged components");
        expect(undoButton()).toBeDisabled();
    });
});
