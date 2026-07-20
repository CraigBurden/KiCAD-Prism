import {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
    ECadViewerElement,
    EcadDocumentComparisonPreparation,
    EcadPcbLayerState,
} from "@/types/ecad-viewer";
import {
    ComparisonPcbLayersPanel,
    ComparisonPcbLayersToggle,
} from "./comparison-pcb-layers-panel";
import {
    comparisonLifecycleReducer,
    createComparisonLifecycleState,
    type ComparisonHostSlot,
} from "./comparison-lifecycle";
import {
    resolveComparisonFocus,
    resolveNativeSelection,
    type ComparisonSelection,
} from "./comparison-selection-bridge";
import { ComparisonViewerHost } from "./comparison-viewer-host";
import {
    resolveSelectedDocument,
    revisionSourceKey,
    selectedChanges,
    useRevisionSources,
    type ComparisonDomain,
} from "./revision-sources";
import type {
    ChangeItem,
    DesignCompareResult,
    KiCadProjectDiffBundle,
} from "./types";
import type { ComparisonPresentationMode } from "./comparison-url";
import { useComparisonCameraSync } from "./use-comparison-camera-sync";

type ComparisonPresentationShellProps = {
    projectId: string;
    domain: ComparisonDomain;
    base: string;
    compare: string;
    presentationMode: ComparisonPresentationMode;
    documentDiff: KiCadProjectDiffBundle;
    files: DesignCompareResult["files"];
    selection: ComparisonSelection;
    reviewGroups: Array<{ id: string; changes: ChangeItem[] }>;
    initialVisibleLayers: string[];
    onVisibleLayersChange: (layers: string[]) => void;
};

type PresentationLayerProps = {
    active: boolean;
    children: ReactNode;
};

function PresentationLayer({ active, children }: PresentationLayerProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (ref.current) ref.current.inert = !active;
    }, [active]);
    return (
        <div
            ref={ref}
            aria-hidden={!active}
            className={cn(
                "absolute inset-0 flex min-h-0 min-w-0 flex-col",
                active
                    ? "visible"
                    : "invisible pointer-events-none",
            )}
        >
            {children}
        </div>
    );
}

function shortSha(sha: string): string {
    return sha.slice(0, 10);
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

async function focusRevisionViewer(
    viewer: ECadViewerElement | null,
    bounds?: [number, number, number, number],
    uuid?: string | null,
): Promise<void> {
    if (!viewer) return;
    if (bounds) {
        const [x, y, w, h] = bounds;
        await viewer.focusBBox?.(x, y, w, h);
    } else if (uuid) {
        await viewer.focusItem?.(uuid, { select: true });
    }
}

export function ComparisonPresentationShell({
    projectId,
    domain,
    base,
    compare,
    presentationMode,
    documentDiff,
    files,
    selection,
    reviewGroups,
    initialVisibleLayers,
    onVisibleLayersChange,
}: ComparisonPresentationShellProps) {
    const [lifecycle, dispatch] = useReducer(
        comparisonLifecycleReducer,
        undefined,
        createComparisonLifecycleState,
    );
    const [compositeViewer, setCompositeViewer] =
        useState<ECadViewerElement | null>(null);
    const [baseViewer, setBaseViewer] =
        useState<ECadViewerElement | null>(null);
    const [compareViewer, setCompareViewer] =
        useState<ECadViewerElement | null>(null);
    const [preparation, setPreparation] =
        useState<EcadDocumentComparisonPreparation | null>(null);
    const [selectionPending, setSelectionPending] = useState(false);
    const [selectionDiagnostic, setSelectionDiagnostic] =
        useState<string | null>(null);
    const [sidePageReadyPath, setSidePageReadyPath] =
        useState<string | null>(null);
    const [showLayers, setShowLayers] = useState(false);
    const [pcbLayers, setPcbLayers] = useState<EcadPcbLayerState[]>([]);

    const compositeGenerationRef = useRef(0);
    const baseGenerationRef = useRef(0);
    const compareGenerationRef = useRef(0);
    const pageGenerationRef = useRef(0);
    const selectionGenerationRef = useRef(0);
    const cameraSyncSuppressedRef = useRef(false);
    const lastCompositeSelectionKeyRef = useRef<string | null>(null);
    const lastSideSelectionKeyRef = useRef<string | null>(null);
    const previousPresentationRef =
        useRef<ComparisonPresentationMode>(presentationMode);

    const allChanges = useMemo(
        () => selectedChanges(selection, reviewGroups),
        [reviewGroups, selection],
    );
    const selectionKey = useMemo(
        () =>
            selection
                ? `${selection.kind}:${selection.id}:${allChanges
                    .map((change) => change.id)
                    .join(",")}`
                : "none",
        [allChanges, selection],
    );
    const activeDocument = useMemo(
        () => resolveSelectedDocument(domain, documentDiff, allChanges),
        [allChanges, documentDiff, domain],
    );
    const documentPath = activeDocument?.path ?? null;

    const baseSources = useRevisionSources(
        projectId,
        domain,
        base,
        files.base,
    );
    const compareSources = useRevisionSources(
        projectId,
        domain,
        compare,
        files.head,
    );
    const sourcesReady =
        !baseSources.loading
        && !compareSources.loading
        && baseSources.sources.length > 0
        && compareSources.sources.length > 0;

    const baseRevisionKey = revisionSourceKey(projectId, base, domain);
    const compareRevisionKey = revisionSourceKey(projectId, compare, domain);
    const compositeHostKey =
        `${projectId}:composite:${domain}:${base}:${compare}`;
    const baseHostKey = `${projectId}:base:${domain}:${base}`;
    const compareHostKey = `${projectId}:compare:${domain}:${compare}`;
    const comparisonKey = `${projectId}:${base}:${compare}:${domain}`;

    const attachHost = useCallback(
        (
            slot: ComparisonHostSlot,
            key: string,
            setter: (viewer: ECadViewerElement | null) => void,
            viewer: ECadViewerElement | null,
        ) => {
            setter(viewer);
            dispatch(
                viewer
                    ? { type: "attach", slot, key }
                    : { type: "detach", slot },
            );
        },
        [],
    );
    const attachComposite = useCallback(
        (viewer: ECadViewerElement | null) =>
            attachHost(
                "composite",
                compositeHostKey,
                setCompositeViewer,
                viewer,
            ),
        [attachHost, compositeHostKey],
    );
    const attachBase = useCallback(
        (viewer: ECadViewerElement | null) =>
            attachHost("base", baseHostKey, setBaseViewer, viewer),
        [attachHost, baseHostKey],
    );
    const attachCompare = useCallback(
        (viewer: ECadViewerElement | null) =>
            attachHost(
                "compare",
                compareHostKey,
                setCompareViewer,
                viewer,
            ),
        [attachHost, compareHostKey],
    );
    const markCompositeLayout = useCallback(
        (key: string) =>
            dispatch({ type: "layout-ready", slot: "composite", key }),
        [],
    );
    const markBaseLayout = useCallback(
        (key: string) =>
            dispatch({ type: "layout-ready", slot: "base", key }),
        [],
    );
    const markCompareLayout = useCallback(
        (key: string) =>
            dispatch({ type: "layout-ready", slot: "compare", key }),
        [],
    );

    useEffect(() => {
        const previous = previousPresentationRef.current;
        previousPresentationRef.current = presentationMode;
        if (previous !== presentationMode) {
            selectionGenerationRef.current += 1;
            cameraSyncSuppressedRef.current = false;
            setSelectionPending(false);
            setSelectionDiagnostic(null);
        }
        if (
            previous === "composite"
            && presentationMode === "side-by-side"
            && lifecycle.composite.phase === "ready"
        ) {
            compositeViewer?.abortDocumentComparisonLoad?.();
        }
    }, [
        compositeViewer,
        lifecycle.composite.phase,
        presentationMode,
    ]);

    useEffect(() => {
        if (
            !compositeViewer
            || !lifecycle.composite.layoutReady
            || !activeDocument
            || !sourcesReady
        ) {
            return;
        }
        const generation = ++compositeGenerationRef.current;
        let cancelled = false;
        lastCompositeSelectionKeyRef.current = null;
        setPreparation(null);
        dispatch({
            type: "transition",
            slot: "composite",
            key: compositeHostKey,
            phase: "loading",
        });

        void compositeViewer
            .loadDocumentComparison({
                comparisonKey,
                reference: {
                    revisionKey: baseRevisionKey,
                    sources: baseSources.sources,
                },
                comparison: {
                    revisionKey: compareRevisionKey,
                    sources: compareSources.sources,
                },
                diff: documentDiff.project,
                documentPath: activeDocument.path,
            })
            .then((next) => {
                if (
                    cancelled
                    || generation !== compositeGenerationRef.current
                ) {
                    return;
                }
                setPreparation(next);
                dispatch({
                    type: "transition",
                    slot: "composite",
                    key: compositeHostKey,
                    phase: "ready",
                });
            })
            .catch((caught) => {
                if (
                    cancelled
                    || generation !== compositeGenerationRef.current
                    || isAbortError(caught)
                ) {
                    return;
                }
                dispatch({
                    type: "transition",
                    slot: "composite",
                    key: compositeHostKey,
                    phase: "error",
                    error:
                        caught instanceof Error
                            ? caught.message
                            : "Failed to prepare native comparison",
                });
            });

        return () => {
            cancelled = true;
            compositeViewer.abortDocumentComparisonLoad?.();
        };
    }, [
        activeDocument,
        baseRevisionKey,
        baseSources.sources,
        compareRevisionKey,
        compareSources.sources,
        comparisonKey,
        compositeHostKey,
        compositeViewer,
        documentDiff.project,
        lifecycle.composite.layoutReady,
        sourcesReady,
    ]);

    useEffect(() => {
        if (
            !baseViewer
            || !lifecycle.base.layoutReady
            || !sourcesReady
        ) {
            return;
        }
        const generation = ++baseGenerationRef.current;
        let cancelled = false;
        dispatch({
            type: "transition",
            slot: "base",
            key: baseHostKey,
            phase: "loading",
        });
        void baseViewer
            .replaceSources({
                revisionKey: baseRevisionKey,
                sources: baseSources.sources,
            })
            .then(() => baseViewer.ready)
            .then(() => {
                if (cancelled || generation !== baseGenerationRef.current) {
                    return;
                }
                baseViewer.dataset.ecadReadyRevision = baseRevisionKey;
                dispatch({
                    type: "transition",
                    slot: "base",
                    key: baseHostKey,
                    phase: "ready",
                });
            })
            .catch((caught) => {
                if (cancelled || generation !== baseGenerationRef.current) {
                    return;
                }
                dispatch({
                    type: "transition",
                    slot: "base",
                    key: baseHostKey,
                    phase: "error",
                    error:
                        caught instanceof Error
                            ? caught.message
                            : "Failed to load base revision",
                });
            });
        return () => {
            cancelled = true;
        };
    }, [
        baseHostKey,
        baseRevisionKey,
        baseSources.sources,
        baseViewer,
        lifecycle.base.layoutReady,
        sourcesReady,
    ]);

    useEffect(() => {
        if (
            !compareViewer
            || !lifecycle.compare.layoutReady
            || !sourcesReady
        ) {
            return;
        }
        const generation = ++compareGenerationRef.current;
        let cancelled = false;
        dispatch({
            type: "transition",
            slot: "compare",
            key: compareHostKey,
            phase: "loading",
        });
        void compareViewer
            .replaceSources({
                revisionKey: compareRevisionKey,
                sources: compareSources.sources,
            })
            .then(() => compareViewer.ready)
            .then(() => {
                if (
                    cancelled
                    || generation !== compareGenerationRef.current
                ) {
                    return;
                }
                compareViewer.dataset.ecadReadyRevision = compareRevisionKey;
                dispatch({
                    type: "transition",
                    slot: "compare",
                    key: compareHostKey,
                    phase: "ready",
                });
            })
            .catch((caught) => {
                if (
                    cancelled
                    || generation !== compareGenerationRef.current
                ) {
                    return;
                }
                dispatch({
                    type: "transition",
                    slot: "compare",
                    key: compareHostKey,
                    phase: "error",
                    error:
                        caught instanceof Error
                            ? caught.message
                            : "Failed to load compare revision",
                });
            });
        return () => {
            cancelled = true;
        };
    }, [
        compareHostKey,
        compareRevisionKey,
        compareSources.sources,
        compareViewer,
        lifecycle.compare.layoutReady,
        sourcesReady,
    ]);

    const sideReady =
        lifecycle.base.phase === "ready"
        && lifecycle.compare.phase === "ready";

    useEffect(() => {
        const generation = ++pageGenerationRef.current;
        setSidePageReadyPath(domain === "pcb" ? documentPath : null);
        if (
            domain !== "schematic"
            || !documentPath
            || !sideReady
            || !baseViewer
            || !compareViewer
        ) {
            return;
        }
        let cancelled = false;
        void Promise.all([
            baseViewer.showPage?.(documentPath),
            compareViewer.showPage?.(documentPath),
        ])
            .then(() => {
                if (
                    !cancelled
                    && generation === pageGenerationRef.current
                ) {
                    setSidePageReadyPath(documentPath);
                }
            })
            .catch((caught) => {
                if (
                    !cancelled
                    && generation === pageGenerationRef.current
                ) {
                    dispatch({
                        type: "transition",
                        slot: "compare",
                        key: compareHostKey,
                        phase: "error",
                        error:
                            caught instanceof Error
                                ? caught.message
                                : "Failed to open schematic page",
                    });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [
        baseViewer,
        compareHostKey,
        compareViewer,
        documentPath,
        domain,
        sideReady,
    ]);

    useEffect(() => {
        if (
            presentationMode !== "composite"
            || !compositeViewer
            || !preparation
            || preparation.document.path !== documentPath
        ) {
            return;
        }
        const generation = ++selectionGenerationRef.current;
        const applicationKey =
            `${comparisonKey}:${preparation.document.path}:${selectionKey}`;
        if (lastCompositeSelectionKeyRef.current === applicationKey) return;
        lastCompositeSelectionKeyRef.current = applicationKey;
        const nativeSelection = resolveNativeSelection(
            preparation,
            documentDiff,
            selection,
            allChanges,
        );
        if (!nativeSelection) {
            setSelectionPending(false);
            setSelectionDiagnostic(
                selection
                    ? "This semantic change has no native source object yet."
                    : null,
            );
            return;
        }
        setSelectionPending(true);
        setSelectionDiagnostic(null);
        void compositeViewer
            .selectDocumentDiff(nativeSelection)
            .then((frame) => {
                if (generation !== selectionGenerationRef.current) return;
                if (frame.status === "missing") {
                    setSelectionDiagnostic(
                        "The selected native item could not be resolved.",
                    );
                }
            })
            .catch((caught) => {
                if (generation === selectionGenerationRef.current) {
                    setSelectionDiagnostic(
                        caught instanceof Error
                            ? caught.message
                            : "Selection failed",
                    );
                }
            })
            .finally(() => {
                if (generation === selectionGenerationRef.current) {
                    setSelectionPending(false);
                }
            });
    }, [
        allChanges,
        comparisonKey,
        compositeViewer,
        documentDiff,
        documentPath,
        preparation,
        presentationMode,
        selection,
        selectionKey,
    ]);

    const sidePageReady =
        domain === "pcb" || sidePageReadyPath === documentPath;

    useEffect(() => {
        if (
            presentationMode !== "side-by-side"
            || !sideReady
            || !sidePageReady
        ) {
            return;
        }
        const generation = ++selectionGenerationRef.current;
        const applicationKey =
            `${baseRevisionKey}:${compareRevisionKey}:${documentPath}:${selectionKey}`;
        if (lastSideSelectionKeyRef.current === applicationKey) return;
        lastSideSelectionKeyRef.current = applicationKey;
        const focus = resolveComparisonFocus(allChanges);
        if (!focus) {
            setSelectionPending(false);
            setSelectionDiagnostic(
                selection
                    ? "This semantic change has no geometry to focus yet."
                    : null,
            );
            return;
        }
        cameraSyncSuppressedRef.current = true;
        setSelectionPending(true);
        setSelectionDiagnostic(null);
        void Promise.all([
            focusRevisionViewer(
                baseViewer,
                focus.baseBounds,
                focus.baseUuid,
            ),
            focusRevisionViewer(
                compareViewer,
                focus.compareBounds,
                focus.compareUuid,
            ),
        ])
            .catch((caught) => {
                if (generation === selectionGenerationRef.current) {
                    setSelectionDiagnostic(
                        caught instanceof Error
                            ? caught.message
                            : "Focus failed",
                    );
                }
            })
            .finally(() => {
                if (generation === selectionGenerationRef.current) {
                    cameraSyncSuppressedRef.current = false;
                    setSelectionPending(false);
                }
            });
    }, [
        allChanges,
        baseRevisionKey,
        baseViewer,
        compareRevisionKey,
        compareViewer,
        documentPath,
        presentationMode,
        selection,
        selectionKey,
        sidePageReady,
        sideReady,
    ]);

    useComparisonCameraSync(
        baseViewer,
        compareViewer,
        presentationMode === "side-by-side" && sideReady,
        cameraSyncSuppressedRef,
    );

    const activeLayerViewers = useCallback((): ECadViewerElement[] => {
        if (presentationMode === "composite") {
            return compositeViewer ? [compositeViewer] : [];
        }
        return [baseViewer, compareViewer].filter(
            (viewer): viewer is ECadViewerElement => Boolean(viewer),
        );
    }, [
        baseViewer,
        compareViewer,
        compositeViewer,
        presentationMode,
    ]);

    useEffect(() => {
        if (domain !== "pcb") {
            setPcbLayers([]);
            return;
        }
        const viewers = activeLayerViewers();
        const activeReady =
            presentationMode === "composite"
                ? lifecycle.composite.phase === "ready"
                : sideReady;
        if (!activeReady || !viewers.length) return;

        if (initialVisibleLayers.length) {
            const visible = new Set(initialVisibleLayers);
            for (const viewer of viewers) {
                for (const layer of viewer.getPcbViewState?.()?.layers ?? []) {
                    viewer.setPcbLayerVisibility?.(
                        layer.name,
                        visible.has(layer.name),
                    );
                }
            }
        }
        const refresh = () =>
            setPcbLayers(viewers[0]?.getPcbViewState?.()?.layers ?? []);
        refresh();
        for (const viewer of viewers) {
            viewer.addEventListener(
                "ecad-viewer:view-state-change",
                refresh,
            );
        }
        return () => {
            for (const viewer of viewers) {
                viewer.removeEventListener(
                    "ecad-viewer:view-state-change",
                    refresh,
                );
            }
        };
    }, [
        activeLayerViewers,
        domain,
        initialVisibleLayers,
        lifecycle.composite.phase,
        presentationMode,
        sideReady,
    ]);

    const toggleLayer = (name: string, visible: boolean) => {
        for (const viewer of activeLayerViewers()) {
            viewer.setPcbLayerVisibility?.(name, visible);
        }
        const next = pcbLayers.map((layer) =>
            layer.name === name ? { ...layer, visible } : layer,
        );
        setPcbLayers(next);
        onVisibleLayersChange(
            next.filter((layer) => layer.visible).map((layer) => layer.name),
        );
    };
    const applyPreset = (
        preset: Parameters<
            NonNullable<ECadViewerElement["applyPcbLayerPreset"]>
        >[0],
    ) => {
        const viewers = activeLayerViewers();
        for (const viewer of viewers) {
            viewer.applyPcbLayerPreset?.(preset);
        }
        const next = viewers[0]?.getPcbViewState?.()?.layers ?? [];
        setPcbLayers(next);
        onVisibleLayersChange(
            next.filter((layer) => layer.visible).map((layer) => layer.name),
        );
    };
    const highlightLayer = (name: string | null) => {
        for (const viewer of activeLayerViewers()) {
            viewer.setPcbLayerHighlight?.(name);
        }
    };

    const sourceError = baseSources.error ?? compareSources.error;
    const compositeError = lifecycle.composite.error;
    const sideError = lifecycle.base.error ?? lifecycle.compare.error;
    const activeError =
        sourceError
        ?? (presentationMode === "composite" ? compositeError : sideError)
        ?? selectionDiagnostic;
    const loading =
        baseSources.loading
        || compareSources.loading
        || (presentationMode === "composite"
            ? lifecycle.composite.phase !== "ready"
            : !sideReady || !sidePageReady);
    const diagnostics =
        preparation?.diagnostics.length
        ?? documentDiff.diagnostics.length;

    if (!activeDocument) {
        return (
            <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-background p-8 text-center text-sm text-muted-foreground">
                No native {domain === "pcb" ? "PCB" : "schematic"} document
                differences are available.
            </section>
        );
    }

    return (
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-muted/20 px-3 py-2 text-xs">
                {presentationMode === "composite" ? (
                    <>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="font-semibold text-success">A</span>
                            Added
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="font-semibold text-destructive">R</span>
                            Removed
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="font-semibold text-warning">M</span>
                            Modified
                        </span>
                        <span className="mr-auto text-muted-foreground">
                            Unchanged compare content is monochrome
                        </span>
                    </>
                ) : (
                    <>
                        <span className="rounded border bg-muted px-2 py-0.5 font-mono">
                            Base {shortSha(base)}
                        </span>
                        <span className="text-muted-foreground">vs</span>
                        <span className="rounded border bg-primary/10 px-2 py-0.5 font-mono text-primary">
                            Compare {shortSha(compare)}
                        </span>
                        <span className="mr-auto text-muted-foreground">
                            Cameras stay linked while you pan and zoom
                        </span>
                    </>
                )}
                {domain === "pcb" && (
                    <ComparisonPcbLayersToggle
                        open={showLayers}
                        onClick={() => setShowLayers((value) => !value)}
                    />
                )}
            </div>

            <div className="flex min-h-0 flex-1">
                <div className="relative min-h-0 min-w-0 flex-1">
                    <PresentationLayer
                        active={presentationMode === "composite"}
                    >
                        <ComparisonViewerHost
                            key={compositeHostKey}
                            viewerKey={compositeHostKey}
                            active={presentationMode === "composite"}
                            onViewer={attachComposite}
                            onLayoutReady={markCompositeLayout}
                        />
                    </PresentationLayer>

                    <PresentationLayer
                        active={presentationMode === "side-by-side"}
                    >
                        <div className="grid h-full min-h-0 grid-cols-2 divide-x">
                            <div className="relative flex min-h-0 min-w-0 flex-col">
                                <div className="shrink-0 border-b bg-muted/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Base
                                </div>
                                <div className="relative min-h-0 flex-1">
                                    <ComparisonViewerHost
                                        key={baseHostKey}
                                        viewerKey={baseHostKey}
                                        active={
                                            presentationMode
                                            === "side-by-side"
                                        }
                                        onViewer={attachBase}
                                        onLayoutReady={markBaseLayout}
                                    />
                                </div>
                            </div>
                            <div className="relative flex min-h-0 min-w-0 flex-col">
                                <div className="shrink-0 border-b bg-muted/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Compare
                                </div>
                                <div className="relative min-h-0 flex-1">
                                    <ComparisonViewerHost
                                        key={compareHostKey}
                                        viewerKey={compareHostKey}
                                        active={
                                            presentationMode
                                            === "side-by-side"
                                        }
                                        onViewer={attachCompare}
                                        onLayoutReady={markCompareLayout}
                                    />
                                </div>
                            </div>
                        </div>
                    </PresentationLayer>

                    {(loading || selectionPending) && (
                        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                            <div className="inline-flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {loading
                                    ? presentationMode === "composite"
                                        ? "Preparing native comparison…"
                                        : "Loading side-by-side revisions…"
                                    : "Focusing change…"}
                            </div>
                        </div>
                    )}

                    {activeError && (
                        <div className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded border border-destructive/30 bg-background/95 p-3 text-xs text-destructive shadow-sm">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{activeError}</span>
                        </div>
                    )}

                    {presentationMode === "composite"
                        && !!diagnostics
                        && !activeError && (
                        <div className="absolute bottom-3 right-3 rounded border bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
                            {diagnostics} unresolved native{" "}
                            {diagnostics === 1 ? "item" : "items"}
                        </div>
                    )}
                </div>

                {domain === "pcb" && (
                    <ComparisonPcbLayersPanel
                        open={showLayers}
                        onOpenChange={setShowLayers}
                        layers={pcbLayers}
                        onToggleVisibility={toggleLayer}
                        onApplyPreset={applyPreset}
                        onHighlight={highlightLayer}
                    />
                )}
            </div>
        </section>
    );
}
