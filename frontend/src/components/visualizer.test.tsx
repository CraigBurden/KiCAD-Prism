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

// A pending answer settles at once in these tests; the polling window itself
// is covered by lib/api-design-data.test.ts.
vi.mock("@/lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/api")>();
    return {
        ...actual,
        fetchDesignJson: (
            input: Parameters<typeof actual.fetchDesignJson>[0],
            init?: Parameters<typeof actual.fetchDesignJson>[1],
            options?: Parameters<typeof actual.fetchDesignJson>[2],
        ) => actual.fetchDesignJson(input, init, { ...options, pendingTimeoutMs: 0 }),
        fetchDesignText: (
            input: Parameters<typeof actual.fetchDesignText>[0],
            init?: Parameters<typeof actual.fetchDesignText>[1],
            options?: Parameters<typeof actual.fetchDesignText>[2],
        ) => actual.fetchDesignText(input, init, { ...options, pendingTimeoutMs: 0 }),
    };
});

// Registers the fake as <ecad-viewer>.
fakeEcadViewer();

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
});

const pending = () => json({ status: "pending", members: ["projections/project.json"], retryAfterSeconds: 1 }, 202);

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

    it("asks for the board only once the schematic on screen has loaded", async () => {
        const order: string[] = [];
        let releaseSchematic: () => void = () => {};
        const schematicHeld = new Promise<void>((resolve) => { releaseSchematic = resolve; });
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            const path = new URL(url, "http://prism.test").pathname;
            order.push(path);
            if (path.endsWith("/schematic")) {
                await schematicHeld;
            }
            return serve(url);
        }));
        renderVisualizer();
        await waitFor(() => expect(order.some((path) => path.endsWith("/schematic"))).toBe(true));
        expect(order.some((path) => path.endsWith("/pcb"))).toBe(false);

        await act(async () => releaseSchematic());
        await waitFor(() => expect(order.some((path) => path.endsWith("/pcb"))).toBe(true));
    });

    it("asks for the board at once when the board tab is the one shown", async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => serve(String(input)));
        vi.stubGlobal("fetch", fetchMock);
        renderVisualizer("pcb");
        await waitFor(() => expect(fetchMock.mock.calls.some(([input]) =>
            new URL(String(input), "http://prism.test").pathname.endsWith("/pcb"))).toBe(true));
        expect(fetchMock.mock.calls.some(([input]) =>
            new URL(String(input), "http://prism.test").pathname.endsWith("/schematic"))).toBe(false);
    });

    it("reads only the status of the assembly page before its tab opens", async () => {
        const cancel = vi.fn(async () => {});
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (new URL(url, "http://prism.test").pathname.endsWith("/ibom")) {
                const response = new Response("<html>bom</html>", { headers: { "Content-Type": "text/html" } });
                Object.defineProperty(response, "body", { value: { cancel } });
                return response;
            }
            return serve(url);
        }));
        renderVisualizer();
        await waitFor(() => expect(cancel).toHaveBeenCalled());
    });

    it("says a failed bundle once, in the view, not again in the index banner", async () => {
        const failed = () => json({ status: "failed", members: ["projections/project.json"], detail: "member-schema-invalid" }, 422);
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            const path = new URL(url, "http://prism.test").pathname;
            if (path.endsWith("/schematic") || path.endsWith("/schematic/subsheets") || path.endsWith("/semantic-index/identity")) {
                return failed();
            }
            return serve(url);
        }));
        renderVisualizer();
        await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
        expect(screen.getAllByText("Design data could not be built")).toHaveLength(1);
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

    it("uses each inlined subsheet's content without a per-sheet read", async () => {
        const sub = { filename: "Subsheets/power.kicad_sch", content: "(kicad_sch power)" };
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            const path = new URL(url, "http://prism.test").pathname;
            if (path.endsWith("/schematic/subsheets")) {
                return json({ files: [{ name: sub.filename, url: "/files/Subsheets/power.kicad_sch", content: sub.content }] });
            }
            if (path.endsWith("/files/Subsheets/power.kicad_sch")) return new Response("unexpected read", { status: 500 });
            return serve(url);
        });
        vi.stubGlobal("fetch", fetchMock);
        renderVisualizer();
        await waitFor(() => expect(viewers()).toHaveLength(1));
        const [sch] = viewers();
        await waitFor(() => expect(sch.replaceSources).toHaveBeenCalledWith({
            revisionKey: "schematic:p1:latest",
            sources: [{ filename: "root.kicad_sch", content: "(kicad_sch root)" }, sub],
        }));
        expect(fetchMock.mock.calls.some(([input]) =>
            String(input).endsWith("/files/Subsheets/power.kicad_sch"),
        )).toBe(false);
    });

    it("reads only the subsheets the hierarchy did not inline", async () => {
        const inline = { filename: "Subsheets/filter.kicad_sch", content: "(kicad_sch filter)" };
        const fetched = { filename: "Subsheets/power.kicad_sch", content: "(kicad_sch power)" };
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            const path = new URL(url, "http://prism.test").pathname;
            if (path.endsWith("/schematic/subsheets")) {
                return json({ files: [
                    { name: inline.filename, url: "/files/Subsheets/filter.kicad_sch", content: inline.content },
                    { name: fetched.filename, url: "/files/Subsheets/power.kicad_sch" },
                ] });
            }
            if (path.endsWith("/files/Subsheets/power.kicad_sch")) return new Response(fetched.content);
            return serve(url);
        });
        vi.stubGlobal("fetch", fetchMock);
        renderVisualizer();
        await waitFor(() => expect(viewers()).toHaveLength(1));
        const [sch] = viewers();
        await waitFor(() => expect(sch.replaceSources).toHaveBeenCalledWith({
            revisionKey: "schematic:p1:latest",
            sources: [{ filename: "root.kicad_sch", content: "(kicad_sch root)" }, inline, fetched],
        }));
        expect(fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.includes("/files/")))
            .toEqual([expect.stringContaining("/files/Subsheets/power.kicad_sch")]);
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

describe("Visualizer while design data is still building", () => {
    it("shows pending, never an empty board, while the PCB source builds", async () => {
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const path = new URL(String(input), "http://prism.test").pathname;
            if (path.endsWith("/pcb")) return pending();
            if (path.endsWith("/semantic-index/identity")) return pending();
            return serve(String(input));
        }));

        renderVisualizer("pcb");
        await waitFor(() => expect(screen.getAllByText("Preparing design data…").length).toBeGreaterThan(0));

        expect(screen.queryByText("No PCB files found.")).toBeNull();
        expect(screen.queryByText("Design data could not be built")).toBeNull();
        expect(screen.getAllByRole("button", { name: "Check again" }).length).toBeGreaterThan(0);
    });

    it("shows a pending semantic index as pending with Check again, not a failure", async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const path = new URL(String(input), "http://prism.test").pathname;
            if (path.endsWith("/semantic-index/identity")) return pending();
            return serve(String(input));
        });
        vi.stubGlobal("fetch", fetchMock);

        renderVisualizer();
        await waitFor(() => expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy());
        expect(screen.getAllByText("Preparing design data…").length).toBeGreaterThan(0);
        expect(screen.queryByText("Design data could not be built")).toBeNull();

        const reads = fetchMock.mock.calls.filter(([input]) =>
            String(input).endsWith("/semantic-index/identity"),
        ).length;
        fireEvent.click(screen.getByRole("button", { name: "Check again" }));
        await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) =>
            String(input).endsWith("/semantic-index/identity"),
        ).length).toBeGreaterThan(reads));
    });
});
