import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeEcadViewer } from "@/test/fake-ecad-viewer";
import type { EcadInsetScene3D, EcadPcbViewState } from "@/types/ecad-viewer";

import { EcadViewer, EcadViewerPair } from "./ecad-viewer";

const root = { filename: "root.kicad_sch", content: "(kicad_sch)" };
const sub = { filename: "Subsheets/a.kicad_sch", content: "(kicad_sch a)" };
const project = { filename: "board.kicad_pro", content: "{}" };
const layout = { filename: "frame.kicad_wks", content: "(kicad_wks)" };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const pcbState = (layers: EcadPcbViewState["layers"]): EcadPcbViewState => ({
    layers,
    objectOpacity: { tracks: 1, vias: 1, pads: 1, zones: 1 },
    objectVisibility: {
        references: true, values: true, footprintText: true, hiddenText: false,
        padNumbers: true, padNetNames: true, trackNetNames: true,
    },
    highlightTracks: false,
});

// Every adapter a test makes lets go of its element afterwards, so no re-read outlives the test.
const made: Array<{ dispose(): void }> = [];
function track<T extends { dispose(): void }>(adapter: T): T {
    made.push(adapter);
    return adapter;
}

afterEach(() => {
    made.splice(0).forEach((adapter) => adapter.dispose());
    vi.useRealTimers();
});

describe("EcadViewer readiness", () => {
    it("loads the root, waits for paint, and reports ready once", async () => {
        const element = fakeEcadViewer();
        const viewer = track(new EcadViewer("sch"));
        const ready = vi.fn();
        viewer.on("ready", ready);
        viewer.attach(element);
        viewer.load("rev-1", [root]);
        expect(viewer.isReady("rev-1")).toBe(false);
        await settle();
        expect(element.replaceSources).toHaveBeenCalledWith({ revisionKey: "rev-1", sources: [root] });
        expect(viewer.isReady("rev-1")).toBe(true);
        expect(viewer.getSnapshot().generation).toBe(1);
        expect(ready).toHaveBeenCalledWith({ revisionKey: "rev-1" });
    });

    it("loads the project, page layout and other sheets with the root, in one call", async () => {
        // The element does not repaint for appended sources: a root painted
        // ahead of its .kicad_pro kept KiCad's default title block and stale
        // DNP marks until a variant switch repainted it.
        const element = fakeEcadViewer();
        const viewer = track(new EcadViewer("sch"));
        viewer.attach(element);
        viewer.load("rev-1", [root, project, layout, sub]);
        await settle();
        expect(element.replaceSources).toHaveBeenCalledTimes(1);
        expect(element.replaceSources).toHaveBeenCalledWith({ revisionKey: "rev-1", sources: [root, project, layout, sub] });
        expect(element.appendSources).not.toHaveBeenCalled();
        expect(viewer.isReady("rev-1")).toBe(true);
        expect(viewer.getSnapshot().generation).toBe(1);
    });

    it("ignores a repeated load and reloads everything when a source changes", async () => {
        const element = fakeEcadViewer();
        const viewer = track(new EcadViewer("sch"));
        viewer.attach(element);
        const sources = [root, sub];
        viewer.load("rev-1", sources);
        viewer.load("rev-1", sources);
        await settle();
        expect(element.replaceSources).toHaveBeenCalledTimes(1);
        const next = { ...sub, content: "(kicad_sch b)" };
        viewer.load("rev-1", [root, next]);
        expect(viewer.isReady("rev-1")).toBe(false);
        await settle();
        expect(element.replaceSources).toHaveBeenCalledTimes(2);
        expect(element.replaceSources).toHaveBeenLastCalledWith({ revisionKey: "rev-1", sources: [root, next] });
        expect(element.appendSources).not.toHaveBeenCalled();
        expect(viewer.getSnapshot().generation).toBe(2);
    });

    it("retries a failed paint a frame later, and reports a second failure", async () => {
        const element = fakeEcadViewer();
        const onLoadError = vi.fn();
        const viewer = track(new EcadViewer("sch", { onLoadError }));
        element.replaceSources.mockRejectedValueOnce(new Error("Image not ready"));
        viewer.attach(element);
        viewer.load("rev-1", [root]);
        await vi.waitFor(() => expect(viewer.isReady("rev-1")).toBe(true));
        expect(element.replaceSources).toHaveBeenCalledTimes(2);
        expect(onLoadError).not.toHaveBeenCalled();

        element.replaceSources.mockRejectedValue(new Error("broken"));
        viewer.load("rev-2", [root]);
        await vi.waitFor(() => expect(onLoadError).toHaveBeenCalledWith(expect.objectContaining({ message: "broken" })));
        expect(viewer.isReady("rev-2")).toBe(false);
    });

    it("drops a load whose element went away", async () => {
        const element = fakeEcadViewer();
        const viewer = track(new EcadViewer("sch"));
        const ready = vi.fn();
        viewer.on("ready", ready);
        viewer.attach(element);
        viewer.load("rev-1", [root, sub]);
        viewer.attach(null);
        await settle();
        expect(ready).not.toHaveBeenCalled();
        expect(viewer.getSnapshot().readyRevision).toBeNull();
    });

    it("reports only the newest of two overlapping loads ready", async () => {
        const element = fakeEcadViewer();
        const viewer = track(new EcadViewer("sch"));
        const ready = vi.fn();
        viewer.on("ready", ready);
        viewer.attach(element);
        viewer.load("rev-1", [root, sub]);
        viewer.load("rev-2", [root, sub]);
        await settle();
        expect(ready).toHaveBeenCalledTimes(1);
        expect(ready).toHaveBeenCalledWith({ revisionKey: "rev-2" });
        expect(viewer.isReady("rev-2")).toBe(true);
    });
});

describe("EcadViewer state", () => {
    it("stops re-reading the board when it lets go of the element", async () => {
        vi.useFakeTimers();
        const element = fakeEcadViewer({ pcb: pcbState([]) });
        const viewer = track(new EcadViewer("pcb", { whenDefined: () => new Promise(() => {}) }));
        viewer.attach(element);
        await vi.advanceTimersByTimeAsync(300);
        expect(vi.getTimerCount()).toBe(1);
        viewer.attach(null);
        expect(vi.getTimerCount()).toBe(0);
        const reads = vi.mocked(element.getPcbViewState!).mock.calls.length;
        await vi.advanceTimersByTimeAsync(10_000);
        expect(vi.mocked(element.getPcbViewState!).mock.calls.length).toBe(reads);

        viewer.attach(element);
        expect(vi.getTimerCount()).toBe(1);
        viewer.dispose();
        expect(vi.getTimerCount()).toBe(0);
        expect(viewer.getSnapshot().element).toBeNull();
    });

    it("drops the re-read of a replaced element", async () => {
        vi.useFakeTimers();
        const viewer = track(new EcadViewer("pcb", { whenDefined: () => new Promise(() => {}) }));
        const first = fakeEcadViewer({ pcb: pcbState([]) });
        viewer.attach(first);
        viewer.attach(fakeEcadViewer({ pcb: pcbState([]) }));
        expect(vi.getTimerCount()).toBe(1);
        const reads = vi.mocked(first.getPcbViewState!).mock.calls.length;
        await vi.advanceTimersByTimeAsync(10_000);
        expect(vi.mocked(first.getPcbViewState!).mock.calls.length).toBe(reads);
    });

    it("re-reads the board until its layers appear (the first view-state reports none)", async () => {
        vi.useFakeTimers();
        const state = pcbState([]);
        const element = fakeEcadViewer({ pcb: state });
        const viewer = track(new EcadViewer("pcb", { whenDefined: () => new Promise(() => {}) }));
        viewer.attach(element);
        expect(viewer.getSnapshot().pcbViewState?.layers).toEqual([]);
        state.layers.push({ name: "F.Cu", color: "#c83434", visible: true, highlighted: false });
        await vi.advanceTimersByTimeAsync(150);
        expect(viewer.getSnapshot().pcbViewState?.layers).toHaveLength(1);
        const reads = vi.mocked(element.getPcbViewState!).mock.calls.length;
        await vi.advanceTimersByTimeAsync(1500);
        expect(vi.mocked(element.getPcbViewState!).mock.calls.length).toBe(reads);
    });

    it("gives up re-reading after the viewer retry window (40 tries, 150 ms apart)", async () => {
        vi.useFakeTimers();
        const element = fakeEcadViewer({ pcb: pcbState([]) });
        const viewer = track(new EcadViewer("pcb", { whenDefined: () => new Promise(() => {}) }));
        viewer.attach(element);
        await vi.advanceTimersByTimeAsync(150 * 60);
        // One read on attach, then one per try.
        expect(vi.mocked(element.getPcbViewState!).mock.calls.length).toBe(1 + 40);
    });

    it("mirrors the modes and the measure points from the element's events", () => {
        const element = fakeEcadViewer({ insets: true, measure: true });
        const viewer = track(new EcadViewer("pcb"));
        viewer.attach(element);
        const changes = vi.fn();
        viewer.subscribe(changes);
        expect(viewer.getSnapshot()).toMatchObject({ insetsAvailable: true, insetMode: false, measureAvailable: true, measureMode: false });
        element.setInsetMode!(true);
        element.setMeasureMode!(true);
        const measured = { phase: "placing" as const, measurement: null, hover: null };
        element.measure(measured);
        expect(viewer.getSnapshot()).toMatchObject({ insetMode: true, measureMode: true, measureState: measured });
        element.setMeasureMode!(false);
        expect(viewer.getSnapshot().measureState).toBeNull();
        expect(changes).toHaveBeenCalled();
    });

    it("reports what an older element lacks", () => {
        const viewer = track(new EcadViewer("pcb"));
        viewer.attach(fakeEcadViewer());
        expect(viewer.getSnapshot()).toMatchObject({ insetsAvailable: false, measureAvailable: false });
        viewer.setInsetMode(true);
    });

    it("keeps the active page while the element reports the same one", () => {
        const pages = [{ projectPath: "/root", sheetPath: "/", filename: "root.kicad_sch", depth: 0, active: true }];
        const element = fakeEcadViewer({ pages });
        const viewer = track(new EcadViewer("sch"));
        viewer.attach(element);
        const first = viewer.getSnapshot().activePage;
        expect(first).toEqual({ projectPath: "/root", filename: "root.kicad_sch", page: undefined });
        element.emit("ecad-viewer:view-state-change");
        expect(viewer.getSnapshot().activePage).toBe(first);
        expect(viewer.getSnapshot().schematicPages).toBe(pages);
    });

    it("keeps subscribers across an element swap and decodes the event", () => {
        const viewer = track(new EcadViewer("sch"));
        const selection = vi.fn();
        viewer.on("selection", selection);
        const first = fakeEcadViewer();
        viewer.attach(first);
        const second = fakeEcadViewer();
        viewer.attach(second);
        first.emit("ecad-viewer:selection", { sourceContext: "SCH", itemType: "old" });
        second.emit("ecad-viewer:selection", { sourceContext: "SCH", itemType: "symbol" });
        expect(selection).toHaveBeenCalledTimes(1);
        expect(selection).toHaveBeenCalledWith({ sourceContext: "SCH", itemType: "symbol" });
    });
});

describe("EcadViewerPair linking", () => {
    it("enables insets, gives the board the 3D scene and links the two as peers", () => {
        const inset3d = {} as EcadInsetScene3D;
        const pair = track(new EcadViewerPair({ inset3d }));
        const sch = fakeEcadViewer();
        const pcb = fakeEcadViewer();
        pair.sch.attach(sch);
        expect(sch.enableInsets).toHaveBeenCalled();
        expect(sch.setInsetPeer).not.toHaveBeenCalled();
        pair.pcb.attach(pcb);
        expect(pcb.setInset3D).toHaveBeenCalledWith(inset3d);
        expect(sch.setInsetPeer).toHaveBeenLastCalledWith(pcb);
        expect(pcb.setInsetPeer).toHaveBeenLastCalledWith(sch);

        pair.pcb.attach(null);
        expect(pcb.setInset3D).toHaveBeenLastCalledWith(null);
        expect(sch.setInsetPeer).toHaveBeenLastCalledWith(null);
        expect(pcb.setInsetPeer).toHaveBeenLastCalledWith(null);
    });

    it("tells one handler which element fired", () => {
        const pair = track(new EcadViewerPair());
        const sch = fakeEcadViewer({ insets: true });
        const pcb = fakeEcadViewer({ insets: true });
        pair.sch.attach(sch);
        pair.pcb.attach(pcb);
        const handler = vi.fn();
        const off = pair.on("inset-mode", handler);
        sch.setInsetMode!(true);
        pcb.setInsetMode!(false);
        expect(handler.mock.calls).toEqual([[{ on: true }, "sch"], [{ on: false }, "pcb"]]);
        off();
        sch.setInsetMode!(false);
        expect(handler).toHaveBeenCalledTimes(2);
    });
});
