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
    file("gerbers/drill-data", true),
    file("gerbers/drill-data/board-PTH.drl"),
    file("gerbers/drill-data/board-PTH-drl_map.gbr"),
    file("fab", true),
    file("fab/v2", true),
    file("fab/v2/board-B_Cu.gbl"),
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

    it("offers the viewer on a folder whose layers are in a subfolder", async () => {
        await openTree();
        expect(screen.getByRole("button", { name: "Open fab in the Gerber viewer" })).toBeInTheDocument();
    });

    it("does not offer a drill map, which is a drawing and not a layer", async () => {
        await openTree();
        fireEvent.click(screen.getByRole("button", { name: "Expand drill-data" }));
        expect(screen.getByRole("button", { name: "Open board-PTH.drl in the Gerber viewer" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Open board-PTH-drl_map.gbr in the Gerber viewer" })).not.toBeInTheDocument();
    });

    it("opens a whole output folder from its header, and only one that holds layers", async () => {
        await openTree();
        expect(screen.queryByRole("button", { name: "Open Design Outputs in the Gerber viewer" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Open Manufacturing Outputs in the Gerber viewer" }));
        const dialog = await screen.findByTestId("dialog");
        expect(dialog).toHaveAttribute("data-url", expect.stringContaining("type=manufacturing&folder="));
        expect(dialog).toHaveAttribute("data-url", expect.not.stringContaining("folder=gerbers"));
        expect(dialog).toHaveAttribute("data-title", "Manufacturing Outputs");
    });

    it("closes", async () => {
        await openTree();
        fireEvent.click(screen.getByRole("button", { name: "Open gerbers in the Gerber viewer" }));
        fireEvent.click(await screen.findByText("Close viewer"));
        await waitFor(() => expect(screen.queryByTestId("dialog")).not.toBeInTheDocument());
    });
});
