import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
    CameraState,
    EcadDocumentComparisonPreparation,
    EcadPcbLayerState,
} from "@/types/ecad-viewer";
import {
    comparisonLifecycleReducer,
    createComparisonLifecycleState,
} from "./comparison-lifecycle";
import { ComparisonPresentationShell } from "./comparison-presentation-shell";
import type { KiCadProjectDiffBundle } from "./types";

class FakeEcadViewer extends HTMLElement {
    static instances: FakeEcadViewer[] = [];

    readonly ready = Promise.resolve();
    readonly isReady = true;
    readonly cameraAssignments: CameraState[] = [];
    readonly layers: EcadPcbLayerState[] = [
        {
            name: "F.Cu",
            color: "#ff0000",
            visible: true,
            highlighted: false,
        },
        {
            name: "B.Cu",
            color: "#0000ff",
            visible: true,
            highlighted: false,
        },
    ];
    readonly setActive = vi.fn();
    readonly abortDocumentComparisonLoad = vi.fn();
    readonly selectDocumentDiff = vi.fn(async () => ({
        status: "applied" as const,
        requestId: 1,
        clickToFrameMs: 0,
        paintCount: 0,
        parserCount: 0,
    }));
    readonly replaceSources = vi.fn(async () => undefined);
    readonly showPage = vi.fn(async () => undefined);
    readonly focusBBox = vi.fn(async () => null);
    readonly focusItem = vi.fn(async () => null);
    readonly getPcbViewState = vi.fn(() => ({
        layers: this.layers,
        objectOpacity: {
            tracks: 1,
            vias: 1,
            pads: 1,
            zones: 1,
        },
        objectVisibility: {
            references: true,
            values: true,
            footprintText: true,
            hiddenText: true,
        },
        highlightTracks: false,
    }));
    readonly setPcbLayerVisibility = vi.fn(
        (name: string, visible: boolean) => {
            const layer = this.layers.find((candidate) => candidate.name === name);
            if (!layer) return false;
            layer.visible = visible;
            return true;
        },
    );

    private cameraState: CameraState | null = null;

    constructor() {
        super();
        FakeEcadViewer.instances.push(this);
    }

    override get clientWidth(): number {
        return 800;
    }

    override get clientHeight(): number {
        return 600;
    }

    get camera(): CameraState | null {
        return this.cameraState;
    }

    set camera(value: CameraState | null) {
        this.cameraState = value;
        if (value) {
            this.cameraAssignments.push(value);
            this.dispatchEvent(
                new CustomEvent("camerachange", { detail: value }),
            );
        }
    }

    readonly loadDocumentComparison = vi.fn(
        async (
            request: { documentPath?: string },
        ): Promise<EcadDocumentComparisonPreparation> => ({
            comparisonKey: "comparison",
            context: request.documentPath?.endsWith(".kicad_pcb")
                ? "PCB"
                : "SCH",
            document: {
                path: request.documentPath ?? "main.kicad_sch",
                docType: request.documentPath?.endsWith(".kicad_pcb")
                    ? "kicad_pcb"
                    : "kicad_sch",
                changes: [],
            },
            targets: new Map(),
            diagnostics: [],
            prepareMs: 1,
            sourceCacheHit: false,
        }),
    );
}

const documentDiff: KiCadProjectDiffBundle = {
    schema: "prism.kicad_project_diff_v1",
    provider: "prism-semantic",
    project: {
        documents: [{
            path: "main.kicad_sch",
            docType: "kicad_sch",
            changes: [],
        }],
    },
    navigation: {},
    diagnostics: [],
};

const shellProps = {
    projectId: "project",
    domain: "schematic" as const,
    base: "base-revision",
    compare: "compare-revision",
    documentDiff,
    files: {
        base: [{ filename: "main.kicad_sch", path: "main.kicad_sch" }],
        head: [{ filename: "main.kicad_sch", path: "main.kicad_sch" }],
    },
    selection: null,
    reviewGroups: [],
    initialVisibleLayers: [],
    onVisibleLayersChange: vi.fn(),
};

beforeAll(() => {
    if (!customElements.get("ecad-viewer")) {
        customElements.define("ecad-viewer", FakeEcadViewer);
    }
});

beforeEach(() => {
    FakeEcadViewer.instances = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL | Request) => {
            const url = String(input);
            if (url.includes("/viewer/support-files")) {
                return new Response(JSON.stringify({ files: [] }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            return new Response("(kicad_sch)", { status: 200 });
        }),
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("comparison lifecycle", () => {
    it("rejects stale layout readiness after a host key changes", () => {
        let state = createComparisonLifecycleState();
        state = comparisonLifecycleReducer(state, {
            type: "attach",
            slot: "base",
            key: "base:a",
        });
        state = comparisonLifecycleReducer(state, {
            type: "attach",
            slot: "base",
            key: "base:b",
        });
        state = comparisonLifecycleReducer(state, {
            type: "layout-ready",
            slot: "base",
            key: "base:a",
        });
        expect(state.base).toMatchObject({
            key: "base:b",
            phase: "waiting-layout",
            layoutReady: false,
        });
    });
});

describe("ComparisonPresentationShell", () => {
    it("retains all hosts and does not reload them when presentation changes", async () => {
        const view = render(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="composite"
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances).toHaveLength(3);
            expect(
                FakeEcadViewer.instances[0]?.loadDocumentComparison,
            ).toHaveBeenCalledTimes(1);
            expect(
                FakeEcadViewer.instances[1]?.replaceSources,
            ).toHaveBeenCalledTimes(1);
            expect(
                FakeEcadViewer.instances[2]?.replaceSources,
            ).toHaveBeenCalledTimes(1);
        });
        const originalInstances = [...FakeEcadViewer.instances];

        view.rerender(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="side-by-side"
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances).toEqual(originalInstances);
            expect(originalInstances[0]?.setActive).toHaveBeenLastCalledWith(
                false,
            );
            expect(originalInstances[1]?.setActive).toHaveBeenLastCalledWith(
                true,
            );
            expect(originalInstances[2]?.setActive).toHaveBeenLastCalledWith(
                true,
            );
        });
        expect(
            originalInstances[0]?.loadDocumentComparison,
        ).toHaveBeenCalledTimes(1);
        expect(originalInstances[1]?.replaceSources).toHaveBeenCalledTimes(1);
        expect(originalInstances[2]?.replaceSources).toHaveBeenCalledTimes(1);

        const camera: CameraState = {
            x: 12,
            y: 24,
            zoom: 3,
            rotation: 0,
        };
        originalInstances[1]?.dispatchEvent(
            new CustomEvent("camerachange", { detail: camera }),
        );
        expect(originalInstances[2]?.cameraAssignments).toContainEqual(
            camera,
        );
        expect(originalInstances[1]?.cameraAssignments).toHaveLength(0);
    });

    it("applies URL layer visibility to both active PCB panes", async () => {
        const pcbDocumentDiff: KiCadProjectDiffBundle = {
            ...documentDiff,
            project: {
                documents: [{
                    path: "board.kicad_pcb",
                    docType: "kicad_pcb",
                    changes: [],
                }],
            },
        };
        render(
            <ComparisonPresentationShell
                {...shellProps}
                domain="pcb"
                presentationMode="side-by-side"
                documentDiff={pcbDocumentDiff}
                files={{
                    base: [{
                        filename: "board.kicad_pcb",
                        path: "board.kicad_pcb",
                    }],
                    head: [{
                        filename: "board.kicad_pcb",
                        path: "board.kicad_pcb",
                    }],
                }}
                initialVisibleLayers={["B.Cu"]}
            />,
        );

        await waitFor(() => {
            expect(
                FakeEcadViewer.instances[1]?.setPcbLayerVisibility,
            ).toHaveBeenCalledWith("F.Cu", false);
            expect(
                FakeEcadViewer.instances[2]?.setPcbLayerVisibility,
            ).toHaveBeenCalledWith("F.Cu", false);
        });
        expect(FakeEcadViewer.instances[1]?.layers).toMatchObject([
            { name: "F.Cu", visible: false },
            { name: "B.Cu", visible: true },
        ]);
        expect(FakeEcadViewer.instances[2]?.layers).toMatchObject([
            { name: "F.Cu", visible: false },
            { name: "B.Cu", visible: true },
        ]);
    });
});
