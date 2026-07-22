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
import type { ChangeItem, KiCadProjectDiffBundle } from "./types";

class FakeEcadViewer extends HTMLElement {
    static instances: FakeEcadViewer[] = [];
    static replaceSourcesImplementation:
        | ((request: { revisionKey: string }) => Promise<void>)
        | null = null;

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
    readonly setViewportInsets = vi.fn();
    readonly resize = vi.fn();
    readonly abortDocumentComparisonLoad = vi.fn();
    readonly selectDocumentDiff = vi.fn(async () => ({
        status: "applied" as const,
        requestId: 1,
        clickToFrameMs: 0,
        paintCount: 0,
        parserCount: 0,
    }));
    readonly previewDocumentDiff = vi.fn();
    readonly setRevisionDiffPresentation = vi.fn();
    readonly selectRevisionDiff = vi.fn(async () => false);
    readonly previewRevisionDiff = vi.fn();
    readonly replaceSources = vi.fn(
        async (request: { revisionKey: string }) => {
            await FakeEcadViewer.replaceSourcesImplementation?.(request);
        },
    );
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
    FakeEcadViewer.replaceSourcesImplementation = null;
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
    it("mounts only the composite host in composite mode", async () => {
        render(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="composite"
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances).toHaveLength(1);
            expect(
                FakeEcadViewer.instances[0]?.loadDocumentComparison,
            ).toHaveBeenCalledTimes(1);
        });
    });

    it("does not reload Composite when selection changes on the same document", async () => {
        const change: ChangeItem = {
            id: "changed-r5",
            kind: "changed",
            domain: "schematic",
            category: "components",
            label: "R5",
            page: "main.kicad_sch",
        };
        const groups = [{ id: "component-r5", changes: [change] }];
        const diff: KiCadProjectDiffBundle = {
            ...documentDiff,
            navigation: {
                [change.id]: {
                    documentPath: "main.kicad_sch",
                    changeId: "/r5",
                    changeIds: ["/r5"],
                },
            },
        };
        const view = render(
            <ComparisonPresentationShell
                {...shellProps}
                documentDiff={diff}
                presentationMode="composite"
                selection={{ kind: "group", id: "component-r5" }}
                reviewGroups={groups}
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances[0]?.loadDocumentComparison)
                .toHaveBeenCalledTimes(1);
        });
        view.rerender(
            <ComparisonPresentationShell
                {...shellProps}
                documentDiff={diff}
                presentationMode="composite"
                selection={{ kind: "item", id: change.id }}
                reviewGroups={groups}
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances[0]?.loadDocumentComparison)
                .toHaveBeenCalledTimes(1);
        });
    });

    it("keeps visited presentation hosts mounted across mode switches", async () => {
        const view = render(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="composite"
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances).toHaveLength(1);
            expect(FakeEcadViewer.instances[0]?.loadDocumentComparison)
                .toHaveBeenCalledTimes(1);
        });
        const composite = FakeEcadViewer.instances[0]!;

        view.rerender(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="side-by-side"
            />,
        );
        await waitFor(() => {
            expect(FakeEcadViewer.instances).toHaveLength(3);
            expect(composite.setActive).toHaveBeenLastCalledWith(false);
        });

        view.rerender(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="composite"
            />,
        );
        await waitFor(() => {
            expect(FakeEcadViewer.instances).toHaveLength(3);
            expect(composite.setActive).toHaveBeenLastCalledWith(true);
        });
    });

    it("mounts and loads exactly two hosts in side-by-side mode", async () => {
        render(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="side-by-side"
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances).toHaveLength(2);
            expect(FakeEcadViewer.instances[0]?.replaceSources).toHaveBeenCalledTimes(1);
            expect(FakeEcadViewer.instances[1]?.replaceSources).toHaveBeenCalledTimes(1);
            expect(
                FakeEcadViewer.instances[0]?.dataset.ecadReadyRevision,
            ).toBe("project:base-revision:schematic");
            expect(
                FakeEcadViewer.instances[1]?.dataset.ecadReadyRevision,
            ).toBe("project:compare-revision:schematic");
        });

        const camera: CameraState = { x: 12, y: 24, zoom: 3, rotation: 0 };
        FakeEcadViewer.instances[0]?.dispatchEvent(
            new CustomEvent("camerachange", { detail: camera }),
        );
        await waitFor(() => {
            expect(
                FakeEcadViewer.instances[1]?.cameraAssignments,
            ).toContainEqual(camera);
        });
    });

    it("cross-probes a selected difference in both side-by-side panes", async () => {
        const selectedChange: ChangeItem = {
            id: "changed-r5",
            kind: "changed",
            domain: "schematic",
            category: "components",
            label: "R5",
            page: "main.kicad_sch",
            oldGeometry: {
                kind: "symbol",
                bounds: [10, 20, 4, 6],
            },
            geometry: {
                kind: "symbol",
                bounds: [30, 40, 4, 6],
            },
        };
        render(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="side-by-side"
                selection={{ kind: "item", id: selectedChange.id }}
                reviewGroups={[{ id: "component-r5", changes: [selectedChange] }]}
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances[0]?.focusBBox)
                .toHaveBeenCalledWith(10, 20, 4, 6);
            expect(FakeEcadViewer.instances[1]?.focusBBox)
                .toHaveBeenCalledWith(30, 40, 4, 6);
        });
    });

    it("installs all side-relative label targets in revision panes", async () => {
        const labelChange: ChangeItem = {
            id: "pf-01-count",
            kind: "changed",
            domain: "schematic",
            category: "nets",
            label: "PF_01",
            net: "PF_01",
            page: "main.kicad_sch",
            reasons: ["label-count-changed"],
            details: {
                labelInstances: { old: 2, new: 0 },
                visualTargets: [
                    {
                        side: "reference",
                        status: "removed",
                        sourceId: "label-a",
                        page: "main.kicad_sch",
                        role: "label",
                    },
                    {
                        side: "reference",
                        status: "removed",
                        sourceId: "label-b",
                        page: "main.kicad_sch",
                        role: "label",
                    },
                ],
            },
        };
        const diff: KiCadProjectDiffBundle = {
            ...documentDiff,
            navigation: {
                [labelChange.id]: {
                    documentPath: "main.kicad_sch",
                    changeId: "/label-a",
                    changeIds: ["/label-a", "/label-b"],
                },
            },
        };
        render(
            <ComparisonPresentationShell
                {...shellProps}
                documentDiff={diff}
                presentationMode="side-by-side"
                selection={{ kind: "group", id: "net-pf-01" }}
                reviewGroups={[{ id: "net-pf-01", changes: [labelChange] }]}
            />,
        );

        await waitFor(() => {
            expect(
                FakeEcadViewer.instances[0]?.setRevisionDiffPresentation,
            ).toHaveBeenCalledWith(expect.objectContaining({
                context: "SCH",
                targets: [expect.objectContaining({
                    id: "net-pf-01",
                    visuals: [
                        expect.objectContaining({ sourceId: "label-a", status: "removed" }),
                        expect.objectContaining({ sourceId: "label-b", status: "removed" }),
                    ],
                })],
            }));
            expect(
                FakeEcadViewer.instances[1]?.setRevisionDiffPresentation,
            ).toHaveBeenCalledWith(expect.objectContaining({ targets: [] }));
            expect(FakeEcadViewer.instances[0]?.selectRevisionDiff)
                .toHaveBeenCalledWith("net-pf-01", { focus: true });
        });
    });

    it("reuses one mounted host when toggling New to Old", async () => {
        const view = render(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="old-new"
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances).toHaveLength(1);
            expect(FakeEcadViewer.instances[0]?.replaceSources).toHaveBeenCalledWith(
                expect.objectContaining({ revisionKey: "project:compare-revision:schematic" }),
            );
        });

        view.getByRole("button", { name: /Old/ }).click();
        await waitFor(() => {
            expect(FakeEcadViewer.instances).toHaveLength(1);
            expect(FakeEcadViewer.instances[0]?.replaceSources).toHaveBeenLastCalledWith(
                expect.objectContaining({ revisionKey: "project:base-revision:schematic" }),
            );
        });
    });

    it("does not paint the previous Old/New revision while replacement is pending", async () => {
        let releaseBase!: () => void;
        const basePending = new Promise<void>((resolve) => {
            releaseBase = resolve;
        });
        FakeEcadViewer.replaceSourcesImplementation = async (request) => {
            if (request.revisionKey.includes("base-revision")) {
                await basePending;
            }
        };
        const view = render(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="old-new"
            />,
        );
        await waitFor(() => {
            expect(FakeEcadViewer.instances[0]?.dataset.ecadReadyRevision)
                .toBe("project:compare-revision:schematic");
        });
        const viewer = FakeEcadViewer.instances[0]!;
        viewer.showPage.mockClear();
        viewer.setRevisionDiffPresentation.mockClear();

        view.getByRole("button", { name: /Old/ }).click();
        await waitFor(() => {
            expect(viewer.replaceSources).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    revisionKey: "project:base-revision:schematic",
                }),
            );
        });
        expect(viewer.showPage).not.toHaveBeenCalled();
        expect(viewer.setRevisionDiffPresentation).not.toHaveBeenCalled();

        releaseBase();
        await waitFor(() => {
            expect(viewer.dataset.ecadReadyRevision)
                .toBe("project:base-revision:schematic");
            expect(viewer.showPage).toHaveBeenCalledWith("main.kicad_sch");
        });
    });

    it("does not replace Old/New sources when selection changes", async () => {
        const change: ChangeItem = {
            id: "changed-r5",
            kind: "changed",
            domain: "schematic",
            category: "components",
            label: "R5",
            page: "main.kicad_sch",
        };
        const groups = [{ id: "component-r5", changes: [change] }];
        const view = render(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="old-new"
                selection={{ kind: "group", id: "component-r5" }}
                reviewGroups={groups}
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances[0]?.replaceSources)
                .toHaveBeenCalledTimes(1);
        });
        view.rerender(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="old-new"
                selection={{ kind: "item", id: change.id }}
                reviewGroups={groups}
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances[0]?.replaceSources)
                .toHaveBeenCalledTimes(1);
        });
    });

    it("does not ask an absent side to show a compare-only schematic", async () => {
        const compareOnlyDiff: KiCadProjectDiffBundle = {
            ...documentDiff,
            project: {
                documents: [{
                    path: "Subsheets/USB.kicad_sch",
                    docType: "kicad_sch",
                    changes: [],
                }],
            },
        };
        render(
            <ComparisonPresentationShell
                {...shellProps}
                presentationMode="side-by-side"
                documentDiff={compareOnlyDiff}
                files={{
                    base: [{ filename: "main.kicad_sch", path: "main.kicad_sch" }],
                    head: [{
                        filename: "USB.kicad_sch",
                        path: "Subsheets/USB.kicad_sch",
                    }],
                }}
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances[0]?.showPage).not.toHaveBeenCalled();
            expect(FakeEcadViewer.instances[1]?.showPage)
                .toHaveBeenCalledWith("Subsheets/USB.kicad_sch");
            expect(FakeEcadViewer.instances[0]?.setRevisionDiffPresentation)
                .toHaveBeenCalledWith(null);
        });
        expect(
            document.body.textContent,
        ).toContain("Not present in the base revision");
        expect(FakeEcadViewer.instances[0]?.setActive)
            .toHaveBeenLastCalledWith(false);
    });

    it("uses the resolved sheet hierarchy instead of raw source presence", async () => {
        Object.defineProperty(FakeEcadViewer.prototype, "getSchematicPages", {
            configurable: true,
            value: function getSchematicPages(this: FakeEcadViewer) {
                const side = FakeEcadViewer.instances.indexOf(this);
                const filename = side === 0
                    ? "main.kicad_sch"
                    : "Subsheets/USB.kicad_sch";
                return [{
                    projectPath: filename,
                    sheetPath: filename,
                    filename,
                    depth: 0,
                    active: true,
                }];
            },
        });
        const compareOnlyDiff: KiCadProjectDiffBundle = {
            ...documentDiff,
            project: {
                documents: [{
                    path: "Subsheets/USB.kicad_sch",
                    docType: "kicad_sch",
                    changes: [],
                }],
            },
        };
        try {
            render(
                <ComparisonPresentationShell
                    {...shellProps}
                    presentationMode="side-by-side"
                    documentDiff={compareOnlyDiff}
                    files={{
                        base: [
                            { filename: "main.kicad_sch", path: "main.kicad_sch" },
                            {
                                filename: "USB.kicad_sch",
                                path: "Subsheets/USB.kicad_sch",
                            },
                        ],
                        head: [{
                            filename: "USB.kicad_sch",
                            path: "Subsheets/USB.kicad_sch",
                        }],
                    }}
                />,
            );

            await waitFor(() => {
                expect(document.body.textContent)
                    .toContain("Not present in the base revision");
                expect(FakeEcadViewer.instances[0]?.showPage).not.toHaveBeenCalled();
                expect(FakeEcadViewer.instances[1]?.showPage)
                    .toHaveBeenCalledWith("Subsheets/USB.kicad_sch");
            });
        } finally {
            delete (FakeEcadViewer.prototype as unknown as {
                getSchematicPages?: unknown;
            }).getSchematicPages;
        }
    });

    it("loads the explicit page child of a multi-page selection", async () => {
        const change: ChangeItem = {
            id: "multi-page-net",
            kind: "changed",
            domain: "schematic",
            category: "nets",
            label: "VCC",
            net: "VCC",
        };
        const multiPageDiff: KiCadProjectDiffBundle = {
            ...documentDiff,
            project: {
                documents: [
                    { path: "one.kicad_sch", docType: "kicad_sch", changes: [] },
                    { path: "two.kicad_sch", docType: "kicad_sch", changes: [] },
                ],
            },
            navigation: {
                [change.id]: {
                    documentPath: "one.kicad_sch",
                    changeId: "/wire-one",
                    changeIds: ["/wire-one"],
                    documents: [
                        {
                            documentPath: "one.kicad_sch",
                            changeId: "/wire-one",
                            changeIds: ["/wire-one"],
                        },
                        {
                            documentPath: "two.kicad_sch",
                            changeId: "/wire-two",
                            changeIds: ["/wire-two"],
                        },
                    ],
                },
            },
        };
        render(
            <ComparisonPresentationShell
                {...shellProps}
                documentDiff={multiPageDiff}
                files={{
                    base: [
                        { filename: "one.kicad_sch", path: "one.kicad_sch" },
                        { filename: "two.kicad_sch", path: "two.kicad_sch" },
                    ],
                    head: [
                        { filename: "one.kicad_sch", path: "one.kicad_sch" },
                        { filename: "two.kicad_sch", path: "two.kicad_sch" },
                    ],
                }}
                presentationMode="composite"
                selection={{
                    kind: "item",
                    id: change.id,
                    documentPath: "two.kicad_sch",
                }}
                reviewGroups={[{ id: "net-vcc", changes: [change] }]}
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances[0]?.loadDocumentComparison)
                .toHaveBeenCalledWith(
                    expect.objectContaining({ documentPath: "two.kicad_sch" }),
                );
        });
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
                FakeEcadViewer.instances[0]?.setPcbLayerVisibility,
            ).toHaveBeenCalledWith("F.Cu", false);
            expect(
                FakeEcadViewer.instances[1]?.setPcbLayerVisibility,
            ).toHaveBeenCalledWith("F.Cu", false);
        });
        expect(FakeEcadViewer.instances[0]?.layers).toMatchObject([
            { name: "F.Cu", visible: false },
            { name: "B.Cu", visible: true },
        ]);
        expect(FakeEcadViewer.instances[1]?.layers).toMatchObject([
            { name: "F.Cu", visible: false },
            { name: "B.Cu", visible: true },
        ]);
    });

    it("overlays the shared PCB rail and insets only the compare pane", async () => {
        const originalRect = HTMLElement.prototype.getBoundingClientRect;
        const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect")
            .mockImplementation(function measuredRect(this: HTMLElement) {
                if (this.getAttribute("aria-label") === "Comparison tools") {
                    return {
                        x: 0,
                        y: 0,
                        width: 320,
                        height: 600,
                        top: 0,
                        right: 320,
                        bottom: 600,
                        left: 0,
                        toJSON: () => ({}),
                    };
                }
                return originalRect.call(this);
            });
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
        const onRailChange = vi.fn();
        const view = render(
            <ComparisonPresentationShell
                {...shellProps}
                domain="pcb"
                presentationMode="side-by-side"
                documentDiff={pcbDocumentDiff}
                files={{
                    base: [{ filename: "board.kicad_pcb", path: "board.kicad_pcb" }],
                    head: [{ filename: "board.kicad_pcb", path: "board.kicad_pcb" }],
                }}
                rightRailTab="layers"
                onRightRailTabChange={onRailChange}
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances).toHaveLength(2);
            expect(FakeEcadViewer.instances[0]?.setViewportInsets)
                .toHaveBeenLastCalledWith(expect.objectContaining({ right: 0 }));
            expect(FakeEcadViewer.instances[1]?.setViewportInsets)
                .toHaveBeenLastCalledWith(expect.objectContaining({ right: 320 }));
        });
        const resizeCounts = FakeEcadViewer.instances.map(
            (viewer) => viewer.resize.mock.calls.length,
        );

        view.rerender(
            <ComparisonPresentationShell
                {...shellProps}
                domain="pcb"
                presentationMode="side-by-side"
                documentDiff={pcbDocumentDiff}
                files={{
                    base: [{ filename: "board.kicad_pcb", path: "board.kicad_pcb" }],
                    head: [{ filename: "board.kicad_pcb", path: "board.kicad_pcb" }],
                }}
                rightRailTab={null}
                onRightRailTabChange={onRailChange}
            />,
        );

        await waitFor(() => {
            expect(FakeEcadViewer.instances[1]?.setViewportInsets)
                .toHaveBeenLastCalledWith(expect.objectContaining({ right: 0 }));
        });
        expect(FakeEcadViewer.instances.map(
            (viewer) => viewer.resize.mock.calls.length,
        )).toEqual(resizeCounts);
        rectSpy.mockRestore();
    });
});
