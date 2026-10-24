/**
 * Gerber and drill files in the output trees open in the Gerber viewer.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetsPortal } from "./assets-portal";

vi.mock("@/components/fabrication-viewer/fabrication-dialog", () => ({
    FabricationDialog: ({ source, focusFile, title, onClose }: {
        source: { viewUrl: string };
        focusFile?: string;
        title: string;
        onClose: () => void;
    }) => (
        <div data-testid="dialog" data-url={source.viewUrl} data-focus={focusFile ?? ""} data-title={title}>
            <button onClick={onClose}>Close viewer</button>
        </div>
    ),
}));

const file = (path: string, isDir = false) => ({
    name: path.split("/").pop()!,
    path,
    size: isDir ? 0 : 1200,
    modified_date: "",
    type: isDir ? "folder" : path.split(".").pop()!,
    is_dir: isDir,
});

const MANUFACTURING = [
    file("gerbers", true),
    file("gerbers/board-F_Cu.gtl"),
    file("gerbers/board-job.gbrjob"),
    file("gerbers/board.drl"),
    file("docs", true),
    file("docs/fab-notes.pdf"),
    file("docs/logo.gif"),
];

beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
        ok: true,
        json: async () => (String(url).includes("type=manufacturing") ? MANUFACTURING : []),
    })));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

async function openTree(commit?: string) {
    render(<AssetsPortal projectId="p1" commit={commit} />);
    fireEvent.click(await screen.findByRole("button", { name: "Expand gerbers" }));
}

describe("AssetsPortal fabrication entry points", () => {
    it("offers the viewer on a folder that holds Gerbers, not on one that does not", async () => {
        await openTree();
        expect(screen.getByRole("button", { name: "Open gerbers in the Gerber viewer" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Open docs in the Gerber viewer" })).not.toBeInTheDocument();
    });

    it("opens the folder as a package", async () => {
        await openTree();
        fireEvent.click(screen.getByRole("button", { name: "Open gerbers in the Gerber viewer" }));
        const dialog = await screen.findByTestId("dialog");
        expect(dialog).toHaveAttribute("data-url", expect.stringContaining("type=manufacturing&folder=gerbers"));
        expect(dialog).toHaveAttribute("data-focus", "");
        expect(dialog).toHaveAttribute("data-title", "gerbers");
    });

    it("opens a clicked Gerber on that layer, and a drill file too", async () => {
        await openTree();
        fireEvent.click(screen.getByRole("button", { name: "Open board-F_Cu.gtl in the Gerber viewer" }));
        expect(await screen.findByTestId("dialog")).toHaveAttribute("data-focus", "board-F_Cu.gtl");
        fireEvent.click(screen.getByText("Close viewer"));
        fireEvent.click(screen.getByRole("button", { name: "Open board.drl in the Gerber viewer" }));
        expect(await screen.findByTestId("dialog")).toHaveAttribute("data-focus", "board.drl");
    });

    it("does not offer the viewer on the job file or on unrelated files", async () => {
        await openTree();
        expect(screen.queryByRole("button", { name: "Open board-job.gbrjob in the Gerber viewer" })).not.toBeInTheDocument();
        expect(screen.getByText("board-job.gbrjob")).toBeInTheDocument();
    });

    it("looks at the commit the portal is showing", async () => {
        await openTree("c".repeat(40));
        fireEvent.click(screen.getByRole("button", { name: "Open gerbers in the Gerber viewer" }));
        expect(await screen.findByTestId("dialog")).toHaveAttribute("data-url", expect.stringContaining(`commit=${"c".repeat(40)}`));
    });

    it("closes", async () => {
        await openTree();
        fireEvent.click(screen.getByRole("button", { name: "Open gerbers in the Gerber viewer" }));
        fireEvent.click(await screen.findByText("Close viewer"));
        await waitFor(() => expect(screen.queryByTestId("dialog")).not.toBeInTheDocument());
    });
});
