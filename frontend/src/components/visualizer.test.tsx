import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeEcadViewer, fakeEcadViewer } from "@/test/fake-ecad-viewer";

import { Visualizer } from "./visualizer";

// The comment socket and the WebGPU tab are other modules' concerns.
vi.mock("@/features/live-comments/use-live-comments", () => {
    const live = { comments: [], setComments: () => {}, refresh: () => {}, status: "live", error: null, hasLoaded: true };
    return { useLiveComments: () => live };
});
vi.mock("./webgpu-3d-tab", () => ({ WebGpu3dTab: () => <div data-testid="webgpu-3d-tab" /> }));

// Registers the fake as <ecad-viewer>.
fakeEcadViewer();

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
});

function serve(url: string): Response {
    const path = new URL(url, "http://prism.test").pathname;
    if (path.endsWith("/schematic")) return new Response("(kicad_sch root)");
    if (path.endsWith("/schematic/subsheets")) return json({ files: [] });
    if (path.endsWith("/pcb")) return new Response("(kicad_pcb board)");
    if (path.endsWith("/viewer/support-files")) return json({ files: [] });
    if (path.endsWith("/comments/mention-candidates")) return json([]);
    return json({ detail: "not here" }, 404);
}

const viewers = () => [...document.querySelectorAll("ecad-viewer")].filter((node) => node instanceof FakeEcadViewer);

function renderVisualizer(tab?: string) {
    return render(
        <MemoryRouter initialEntries={[tab ? `/?tab=${tab}` : "/"]}>
            <Visualizer projectId="p1" user={null} />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => serve(String(input))));
});
afterEach(() => vi.unstubAllGlobals());

describe("Visualizer through the ecad-viewer adapter", () => {
    it("loads the schematic into its element and parses the board only on its first visit", async () => {
        renderVisualizer();
        await waitFor(() => expect(viewers()).toHaveLength(1));
        const [sch] = viewers();
        await waitFor(() => expect(sch.replaceSources).toHaveBeenCalledWith({
            revisionKey: "schematic:p1:latest",
            sources: [{ filename: "root.kicad_sch", content: "(kicad_sch root)" }],
        }));
        expect(sch.enableInsets).toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: /^PCB/ }));
        await waitFor(() => expect(viewers()).toHaveLength(2));
        const pcb = viewers().find((node) => node !== sch)!;
        await waitFor(() => expect(pcb.replaceSources).toHaveBeenCalledWith({
            revisionKey: "pcb:p1:latest",
            sources: [{ filename: "board.kicad_pcb", content: "(kicad_pcb board)" }],
        }));
        // Each serves the other's insets; the board gets the 3D tab for its own.
        expect(sch.setInsetPeer).toHaveBeenLastCalledWith(pcb);
        expect(pcb.setInsetPeer).toHaveBeenLastCalledWith(sch);
        expect(pcb.setInset3D).toHaveBeenCalledWith(expect.objectContaining({ load: expect.any(Function) }));
        expect(screen.queryByTestId("webgpu-3d-tab")).toBeNull();
    });

    it("hands the schematic its project, page layout and subsheets with the root, in one load", async () => {
        // Support files arriving after the sheet would reload the whole design.
        const project = { filename: "board.kicad_pro", content: "{}" };
        const layout = { filename: "frame.kicad_wks", content: "(kicad_wks)" };
        const sub = { filename: "Subsheets/power.kicad_sch", content: "(kicad_sch power)" };
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            const path = new URL(url, "http://prism.test").pathname;
            if (path.endsWith("/viewer/support-files")) return json({ files: [project, layout] });
            if (path.endsWith("/schematic/subsheets")) {
                return json({ files: [{ name: sub.filename, url: "/files/Subsheets/power.kicad_sch" }] });
            }
            if (path.endsWith("/files/Subsheets/power.kicad_sch")) return new Response(sub.content);
            return serve(url);
        }));
        renderVisualizer();
        await waitFor(() => expect(viewers()).toHaveLength(1));
        const [sch] = viewers();
        await waitFor(() => expect(sch.replaceSources).toHaveBeenCalled());
        expect(sch.replaceSources).toHaveBeenCalledTimes(1);
        expect(sch.replaceSources).toHaveBeenCalledWith({
            revisionKey: "schematic:p1:latest",
            sources: [{ filename: "root.kicad_sch", content: "(kicad_sch root)" }, project, layout, sub],
        });
        expect(sch.appendSources).not.toHaveBeenCalled();
    });

    it("mounts the board when schematic insets turn on", async () => {
        renderVisualizer();
        await waitFor(() => expect(viewers()).toHaveLength(1));
        act(() => viewers()[0].emit("ecad-viewer:inset-mode", { on: true }));
        await waitFor(() => expect(viewers()).toHaveLength(2));
    });

    it("inspects what the schematic selects, and Escape drops it from the element too", async () => {
        renderVisualizer();
        await waitFor(() => expect(viewers()).toHaveLength(1));
        const [sch] = viewers();
        await waitFor(() => expect(sch.replaceSources).toHaveBeenCalled());
        act(() => sch.emit("ecad-viewer:selection", {
            sourceContext: "SCH", itemType: "symbol", reference: "U7", uuid: "u-7", x: 10, y: 20,
        }));
        expect(await screen.findAllByText("U7")).not.toHaveLength(0);

        fireEvent.keyDown(window, { key: "Escape" });
        await waitFor(() => expect(sch.clearSelection).toHaveBeenCalledWith({ keepHighlights: true }));
    });

    it("opens the 3D tab in the background when a PCB inset asks for the 3D board", async () => {
        renderVisualizer("pcb");
        await waitFor(() => expect(viewers()).toHaveLength(1));
        const [pcb] = viewers();
        const scene = pcb.setInset3D.mock.calls[0]?.[0];
        expect(scene).toBeTruthy();
        act(() => scene!.load());
        expect(await screen.findByTestId("webgpu-3d-tab")).toBeTruthy();
    });
});
