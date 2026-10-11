import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeSemanticViewer } from "@/test/fake-semantic-viewer";
import type { PrismSystemSceneMoveState } from "@/types/prism-semantic-viewer";
import type { SystemScene } from "@/types/system";

import { SemanticViewer } from "./semantic-viewer";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => vi.useRealTimers());

describe("SemanticViewer lifecycle", () => {
    it("waits for the element's definition before driving it, and drops commands without an element", async () => {
        let define!: () => void;
        const defined = new Promise<void>((resolve) => { define = resolve; });
        const viewer = new SemanticViewer(() => defined);
        const scene = { occurrences: [] } as unknown as SystemScene;
        viewer.setSystemScene(scene);
        const element = fakeSemanticViewer();
        viewer.attach(element);
        viewer.setSystemScene(scene);
        await settle();
        expect(element.setSystemScene).not.toHaveBeenCalled();
        define();
        await settle();
        expect(element.setSystemScene).toHaveBeenCalledTimes(1);
        expect(element.setSystemScene).toHaveBeenCalledWith(scene);
    });

    it("resolves what the emphasis lit, or null with no element", async () => {
        const viewer = new SemanticViewer(() => Promise.resolve());
        expect(await viewer.setNetEmphasis([])).toBeNull();
        const element = fakeSemanticViewer();
        element.setNetEmphasis.mockReturnValue([{ key: "g1", color: "#14ff33", lit: 3, unresolved: [] }]);
        viewer.attach(element);
        expect(await viewer.setNetEmphasis([{ key: "g1", members: [] }])).toEqual([{ key: "g1", color: "#14ff33", lit: 3, unresolved: [] }]);
    });

    it("stops listening to an element it no longer holds, and keeps its subscribers", () => {
        const viewer = new SemanticViewer();
        const move = vi.fn();
        viewer.on("move", move);
        const first = fakeSemanticViewer();
        const second = fakeSemanticViewer();
        viewer.attach(first);
        viewer.attach(second);
        const state = { phase: "mode", allowed: true, enabled: true, space: "world", dragging: false, target: null } satisfies PrismSystemSceneMoveState;
        first.move(state);
        second.move(state);
        expect(move).toHaveBeenCalledTimes(1);
        expect(move).toHaveBeenCalledWith(state);
        expect(viewer.getSnapshot().element).toBe(second);
    });
});

describe("SemanticViewer reports", () => {
    it("decodes the selection, the view state and the error into the snapshot", () => {
        const viewer = new SemanticViewer();
        const element = fakeSemanticViewer();
        viewer.attach(element);
        const selected = vi.fn();
        viewer.on("selection", selected);
        const pick = { kind: "net" as const, sourceContext: "3D" as const, netName: "/SPI_SCK", occurrence: "/sin_OBC" };
        element.pick(pick);
        expect(selected).toHaveBeenCalledWith(pick);
        expect(viewer.getSnapshot().selection).toBe(pick);

        const viewState = { mode: "3d", layers: [], showBoard: true, showComponents: true, showPlaceholders: true,
            realisticColors: false, separation: 0, isolateNet: true, hasNet: true } as const;
        element.emit("prism-semantic-viewer:viewstatechange", viewState);
        expect(viewer.getSnapshot().viewState).toBe(viewState);

        element.emit("prism-semantic-viewer:error", { error: "no adapter" });
        expect(viewer.getSnapshot().error).toBe("no adapter");
        element.emit("prism-semantic-viewer:error", { error: { message: "device lost" } });
        expect(viewer.getSnapshot().error).toBe("device lost");
        element.emit("prism-semantic-viewer:error", {});
        expect(viewer.getSnapshot().error).toBe("The 3D view could not start");
    });

    it("relays the emphasis report and harness state", () => {
        const viewer = new SemanticViewer();
        const element = fakeSemanticViewer();
        viewer.attach(element);
        const emphasis = vi.fn();
        const harness = vi.fn();
        viewer.on("emphasis", emphasis);
        viewer.on("harness", harness);
        const results = [{ key: "g1", color: "#fff", lit: 1, unresolved: [] }];
        element.emit("prism-semantic-viewer:emphasis", { results });
        const picked = { phase: "select" as const, harness: { id: "shn_1", level: null, name: "H" }, segment: null,
            pointMm: null, autoMm: null, node: null, editable: true };
        element.harness(picked);
        expect(emphasis).toHaveBeenCalledWith(results);
        expect(harness).toHaveBeenCalledWith(picked);
    });
});

describe("SemanticViewer selection in", () => {
    it("a host selection reaches the element and the snapshot, and is not reported back", () => {
        const viewer = new SemanticViewer();
        const element = fakeSemanticViewer();
        viewer.attach(element);
        const selected = vi.fn();
        viewer.on("selection", selected);

        viewer.select({ kind: "net", sourceContext: "3D", netName: "CAN0_N", occurrence: "/sin_OBC" });
        expect(element.setSelection).toHaveBeenLastCalledWith({ occurrence: "/sin_OBC", netName: "CAN0_N" });
        viewer.select({ kind: "board", sourceContext: "3D", occurrence: "/sin_OBC" });
        expect(element.setSelection).toHaveBeenLastCalledWith({ occurrence: "/sin_OBC" });
        expect(viewer.getSnapshot().selection).toEqual({ kind: "board", sourceContext: "3D", occurrence: "/sin_OBC" });
        expect(selected).not.toHaveBeenCalled();
    });

    it("shows a board, a part pair and nothing, dropping a harness pick first", async () => {
        const viewer = new SemanticViewer(() => Promise.resolve());
        const element = fakeSemanticViewer();
        viewer.attach(element);
        viewer.show({ type: "board", path: "/sin_OBC" });
        await settle();
        expect(element.selectHarness).toHaveBeenLastCalledWith(null);
        expect(element.setSelection).toHaveBeenLastCalledWith({ occurrence: "/sin_OBC" });
        expect(element.frameBoard).toHaveBeenCalledWith("/sin_OBC");
        const parts = [{ occurrence: "/sin_OBC", reference: "J1" }, { occurrence: "/sin_PAY", reference: null }];
        viewer.show({ type: "parts", parts });
        await settle();
        expect(element.setSelection).toHaveBeenLastCalledWith(null);
        expect(element.frameParts).toHaveBeenCalledWith(parts);
        viewer.show({ type: "clear" });
        await settle();
        expect(element.setSelection).toHaveBeenLastCalledWith(null);
        expect(viewer.getSnapshot().selection).toBeNull();
    });

    it("picks a harness once its tube is drawn, every 400 ms", async () => {
        vi.useFakeTimers();
        const viewer = new SemanticViewer(() => Promise.resolve());
        const element = fakeSemanticViewer();
        element.harnessesDrawn = false;
        viewer.attach(element);
        viewer.show({ type: "harness", id: "shn_1" });
        await vi.advanceTimersByTimeAsync(0);
        expect(element.selectHarness).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(800);
        expect(element.selectHarness).toHaveBeenCalledTimes(3);
        element.harnessesDrawn = true;
        await vi.advanceTimersByTimeAsync(400);
        expect(element.selectHarness).toHaveBeenCalledTimes(4);
        await vi.advanceTimersByTimeAsync(4000);
        expect(element.selectHarness).toHaveBeenCalledTimes(4);
    });

    it("gives up after 15 retries", async () => {
        vi.useFakeTimers();
        const viewer = new SemanticViewer(() => Promise.resolve());
        const element = fakeSemanticViewer();
        element.harnessesDrawn = false;
        viewer.attach(element);
        viewer.show({ type: "harness", id: "shn_1" });
        await vi.advanceTimersByTimeAsync(20_000);
        expect(element.selectHarness).toHaveBeenCalledTimes(16);
    });

    it("stops retrying when the selection moved on, another show replaced it, or the element went away", async () => {
        vi.useFakeTimers();
        const viewer = new SemanticViewer(() => Promise.resolve());
        const element = fakeSemanticViewer();
        element.harnessesDrawn = false;
        viewer.attach(element);

        let current = true;
        viewer.show({ type: "harness", id: "shn_1" }, () => current);
        await vi.advanceTimersByTimeAsync(400);
        current = false;
        await vi.advanceTimersByTimeAsync(4000);
        expect(element.selectHarness).toHaveBeenCalledTimes(2);

        element.selectHarness.mockClear();
        viewer.show({ type: "harness", id: "shn_1" });
        await vi.advanceTimersByTimeAsync(0);
        viewer.show({ type: "harness", id: "shn_2" });
        await vi.advanceTimersByTimeAsync(4000);
        expect(element.selectHarness.mock.calls.filter(([id]) => id === "shn_1")).toHaveLength(1);

        element.selectHarness.mockClear();
        viewer.show({ type: "harness", id: "shn_3" });
        await vi.advanceTimersByTimeAsync(0);
        viewer.attach(null);
        await vi.advanceTimersByTimeAsync(4000);
        expect(element.selectHarness).toHaveBeenCalledTimes(1);
    });
});
