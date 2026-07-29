import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { AlertCircle, Layers3, Loader2, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewerOverlayRail } from "@/components/viewer-overlay-rail";
import { cn } from "@/lib/utils";
import type {
    ECadViewerElement,
    EcadComparisonSession,
    EcadDocumentComparisonPreparation,
    EcadPcbLayerState,
    EcadTransitionTraceDetail,
} from "@/types/ecad-viewer";
import {
    ComparisonPcbLayersPanel,
    ComparisonPcbLayersToggle,
} from "./comparison-pcb-layers-panel";
import {
    resolveNativeSelection,
    type ComparisonSelection,
} from "./comparison-selection-bridge";
import { ChangeStatusLegend } from "./change-status";
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
import {
    logComparisonDebug,
    logComparisonDebugError,
} from "./comparison-debug-log";
import { buildDiffResolutionReport } from "./diff-resolution-report";

type ComparisonPresentationShellProps = {
    projectId: string;
    domain: ComparisonDomain;
    base: string;
    compare: string;
    presentationMode: ComparisonPresentationMode;
    documentDiff: KiCadProjectDiffBundle;
    files: DesignCompareResult["files"];
    selection: ComparisonSelection;
    previewSelection?: ComparisonSelection;
    reviewGroups: Array<{ id: string; changes: ChangeItem[] }>;
    initialVisibleLayers: string[];
    onVisibleLayersChange: (layers: string[]) => void;
    rightRailTab?: "layers" | "discussion" | null;
    onRightRailTabChange?: (
        tab: "layers" | "discussion" | null,
    ) => void;
    discussionContent?: ReactNode;
    discussionCount?: number;
};

type SessionPhase = "waiting-layout" | "loading" | "ready" | "error";
type OldNewSide = "base" | "compare";
const ignoreRightRailChange = () => undefined;

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

function normalizedPath(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function sameDocument(left?: string | null, right?: string | null): boolean {
    if (!left || !right) return true;
    const a = normalizedPath(left);
    const b = normalizedPath(right);
    return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

function revisionHasDocument(
    sources: DesignCompareResult["files"]["base"],
    documentPath: string | null,
): boolean {
    return Boolean(
        documentPath
        && sources.some((source) => sameDocument(source.path, documentPath)),
    );
}

function viewerState(viewer: ECadViewerElement | null) {
    return {
        connected: viewer?.isConnected ?? false,
        isReady: viewer?.isReady ?? false,
        activePage: viewer?.getActiveSchematicPage?.() ?? null,
        camera: viewer?.camera ?? null,
    };
}

function diffForDocument(
    documentDiff: KiCadProjectDiffBundle,
    documentPath: string | null,
    domain: ComparisonDomain,
): KiCadProjectDiffBundle["project"] {
    if (!documentPath) return documentDiff.project;
    if (
        documentDiff.project.documents.some((document) =>
            sameDocument(document.path, documentPath),
        )
    ) {
        return documentDiff.project;
    }
    return {
        documents: [{
            path: documentPath,
            docType: domain === "pcb" ? "kicad_pcb" : "kicad_sch",
            changes: [],
        }],
    };
}

function MissingRevisionPane({
    side,
    documentPath,
}: {
    side: "base" | "compare";
    documentPath: string;
}) {
    const opposite = side === "base" ? "compare" : "base";
    return (
        <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-background p-8 text-center"
            role="status"
        >
            <div className="max-w-sm">
                <AlertCircle className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" />
                <h3 className="text-sm font-medium">
                    Not present in the {side} revision
                </h3>
                <p className="mt-2 break-words text-xs text-muted-foreground">
                    {documentPath} exists only in the {opposite} revision.
                </p>
            </div>
        </div>
    );
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
    previewSelection = null,
    reviewGroups,
    initialVisibleLayers,
    onVisibleLayersChange,
    rightRailTab = null,
    onRightRailTabChange = ignoreRightRailChange,
    discussionContent = null,
    discussionCount = 0,
}: ComparisonPresentationShellProps) {
    const [primaryViewer, setPrimaryViewer] =
        useState<ECadViewerElement | null>(null);
    const [secondaryViewer, setSecondaryViewer] =
        useState<ECadViewerElement | null>(null);
    const [primaryLayoutReady, setPrimaryLayoutReady] = useState(false);
    const [secondaryLayoutReady, setSecondaryLayoutReady] = useState(false);
    const [session, setSession] = useState<EcadComparisonSession | null>(null);
    const [sessionPhase, setSessionPhase] =
        useState<SessionPhase>("waiting-layout");
    const [presentationSwitching, setPresentationSwitching] = useState(false);
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [preparation, setPreparation] =
        useState<EcadDocumentComparisonPreparation | null>(null);
    const [oldNewSide, setOldNewSide] = useState<OldNewSide>("compare");
    const [selectionPending, setSelectionPending] = useState(false);
    const [selectionDiagnostic, setSelectionDiagnostic] =
        useState<string | null>(null);
    const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
    const [dismissedBanner, setDismissedBanner] = useState<string | null>(null);
    const [diagnosticsDismissed, setDiagnosticsDismissed] = useState(false);
    const [rightRailInset, setRightRailInset] = useState(0);
    const [pcbLayers, setPcbLayers] = useState<EcadPcbLayerState[]>([]);

    const sessionGenerationRef = useRef(0);
    const presentationGenerationRef = useRef(0);
    const selectionGenerationRef = useRef(0);
    const lastSelectionKeyRef = useRef<string | null>(null);
    const cameraSyncSuppressedRef = useRef(false);
    const mountedSecondaryRef = useRef(false);
    const sessionRef = useRef<EcadComparisonSession | null>(null);
    if (presentationMode === "side-by-side") {
        mountedSecondaryRef.current = true;
    }

    const allChanges = useMemo(
        () => selectedChanges(selection, reviewGroups),
        [reviewGroups, selection],
    );
    const previewChanges = useMemo(
        () => selectedChanges(previewSelection, reviewGroups),
        [previewSelection, reviewGroups],
    );
    const activeDocument = useMemo(
        () => resolveSelectedDocument(
            domain,
            documentDiff,
            allChanges,
            selection?.documentPath,
        ),
        [allChanges, documentDiff, domain, selection?.documentPath],
    );
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
    const documentPath =
        activeDocument?.path
        ?? baseSources.rootName
        ?? compareSources.rootName
        ?? null;
    const comparisonDiff = useMemo(
        () => diffForDocument(documentDiff, documentPath, domain),
        [documentDiff, documentPath, domain],
    );
    const baseMissingRoot = useMemo(
        () =>
            !baseSources.loading
            && !baseSources.sources.some(
                (source) => source.filename === baseSources.rootName,
            ),
        [baseSources.loading, baseSources.rootName, baseSources.sources],
    );
    const compareMissingRoot = useMemo(
        () =>
            !compareSources.loading
            && !compareSources.sources.some(
                (source) => source.filename === compareSources.rootName,
            ),
        [compareSources.loading, compareSources.rootName, compareSources.sources],
    );
    const sourcesReady =
        !baseSources.loading
        && !compareSources.loading
        && (!baseMissingRoot || !compareMissingRoot);
    const baseRevisionKey = revisionSourceKey(projectId, base, domain);
    const compareRevisionKey = revisionSourceKey(projectId, compare, domain);
    const comparisonKey = `${projectId}:${base}:${compare}:${domain}`;
    const primaryHostKey = `${comparisonKey}:primary`;
    const secondaryHostKey = `${comparisonKey}:secondary`;
    const selectionKey = useMemo(
        () =>
            selection
                ? `${selection.kind}:${selection.id}:${selection.documentPath ?? "default"}:${allChanges
                    .map((change) => change.id)
                    .join(",")}`
                : "none",
        [allChanges, selection],
    );

    const baseHasDocument = preparation
        ? !preparation.missingReference
        : revisionHasDocument(files.base, documentPath);
    const compareHasDocument = preparation
        ? !preparation.missingComparison
        : revisionHasDocument(files.head, documentPath);
    const showLayers = rightRailTab === "layers";
    const oneSidedSheetNotice = documentPath && baseHasDocument !== compareHasDocument
        ? `${documentPath} exists only in the ${
            baseHasDocument ? "base" : "compare"
        } revision.`
        : null;

    const attachPrimary = useCallback((viewer: ECadViewerElement | null) => {
        setPrimaryViewer(viewer);
        setPrimaryLayoutReady(false);
    }, []);
    const attachSecondary = useCallback((viewer: ECadViewerElement | null) => {
        setSecondaryViewer(viewer);
        setSecondaryLayoutReady(false);
    }, []);

    useEffect(() => {
        setDismissedBanner(null);
        setDiagnosticsDismissed(false);
    }, [comparisonKey, documentPath]);

    useEffect(() => {
        const cleanups: Array<() => void> = [];
        for (const [slot, viewer] of [
            ["primary", primaryViewer],
            ["secondary", secondaryViewer],
        ] as const) {
            if (!viewer) continue;
            const listener = ((event: CustomEvent<EcadTransitionTraceDetail>) => {
                logComparisonDebug("viewer.transition", {
                    slot,
                    presentationMode,
                    oldNewSide,
                    viewer: event.detail,
                });
            }) as EventListener;
            viewer.addEventListener("ecad-viewer:transition-trace", listener);
            cleanups.push(() =>
                viewer.removeEventListener(
                    "ecad-viewer:transition-trace",
                    listener,
                ),
            );
        }
        return () => cleanups.forEach((cleanup) => cleanup());
    }, [oldNewSide, presentationMode, primaryViewer, secondaryViewer]);

    useEffect(() => {
        if (
            !primaryViewer
            || !primaryLayoutReady
            || !sourcesReady
            || !documentPath
        ) {
            setSessionPhase("waiting-layout");
            return;
        }
        if (typeof primaryViewer.prepareComparison !== "function") {
            setSessionPhase("error");
            setSessionError(
                "This ecad-viewer build does not expose prepareComparison. Rebuild and sync the viewer bundle.",
            );
            return;
        }
        const generation = ++sessionGenerationRef.current;
        let cancelled = false;
        let created: EcadComparisonSession | null = null;
        sessionRef.current?.dispose();
        sessionRef.current = null;
        setSession(null);
        setPreparation(null);
        setSessionError(null);
        setSessionPhase("loading");
        lastSelectionKeyRef.current = null;
        logComparisonDebug("session.prepare.start", {
            generation,
            comparisonKey,
            documentPath,
            baseRevisionKey,
            compareRevisionKey,
        });
        void primaryViewer.prepareComparison({
            comparisonKey,
            reference: {
                revisionKey: baseRevisionKey,
                sources: baseSources.sources,
            },
            comparison: {
                revisionKey: compareRevisionKey,
                sources: compareSources.sources,
            },
            diff: comparisonDiff,
            diffFormat: "prism",
            documentPath,
            activeSheetPath: documentPath,
        }).then((next) => {
            created = next;
            if (cancelled || generation !== sessionGenerationRef.current) {
                next.dispose();
                return;
            }
            sessionRef.current = next;
            setSession(next);
            setPreparation(next.preparation);
            setSessionPhase("ready");
            logComparisonDebug("session.prepare.ready", {
                generation,
                documentPath,
                metrics: next.getMetrics(),
                viewerState: viewerState(primaryViewer),
            });
            logComparisonDebug(
                "session.prepare.resolution",
                buildDiffResolutionReport(next.preparation),
            );
        }).catch((caught) => {
            if (
                cancelled
                || generation !== sessionGenerationRef.current
                || isAbortError(caught)
            ) {
                return;
            }
            setSessionPhase("error");
            setSessionError(
                caught instanceof Error
                    ? caught.message
                    : "Failed to prepare comparison session",
            );
            logComparisonDebugError("session.prepare.failed", caught, {
                generation,
                documentPath,
                viewerState: viewerState(primaryViewer),
            });
        });
        return () => {
            cancelled = true;
            created?.dispose();
            primaryViewer.abortDocumentComparisonLoad?.();
        };
    }, [
        baseRevisionKey,
        baseSources.sources,
        compareRevisionKey,
        compareSources.sources,
        comparisonDiff,
        comparisonKey,
        documentPath,
        primaryLayoutReady,
        primaryViewer,
        sourcesReady,
    ]);

    useEffect(() => {
        if (
            !session
            || sessionPhase !== "ready"
            || !primaryViewer
            || !primaryLayoutReady
            || (
                presentationMode === "side-by-side"
                && (!secondaryViewer || !secondaryLayoutReady)
            )
        ) {
            return;
        }
        const generation = ++presentationGenerationRef.current;
        let cancelled = false;
        setPresentationSwitching(true);
        setSessionError(null);
        const operation =
            presentationMode === "composite"
                ? session.setPresentation("composite", primaryViewer)
                    .then((primary) => ({ primary, secondary: null }))
                : presentationMode === "old-new"
                    ? session.setPresentation(
                        oldNewSide === "base" ? "reference" : "comparison",
                        primaryViewer,
                    ).then((primary) => ({ primary, secondary: null }))
                    : Promise.all([
                        session.setPresentation("reference", primaryViewer),
                        session.setPresentation("comparison", secondaryViewer!),
                    ]).then(([primary, secondary]) => ({ primary, secondary }));
        void operation.then((result) => {
            if (cancelled || generation !== presentationGenerationRef.current) {
                return;
            }
            setPreparation(session.preparation);
            setPresentationSwitching(false);
            logComparisonDebug("session.presentation.ready", {
                generation,
                presentationMode,
                oldNewSide,
                primary: {
                    switchMs: result.primary.switchMs,
                    parserCount: result.primary.parserCount,
                    paintCount: result.primary.paintCount,
                },
                secondary: result.secondary
                    ? {
                          switchMs: result.secondary.switchMs,
                          parserCount: result.secondary.parserCount,
                          paintCount: result.secondary.paintCount,
                      }
                    : null,
                metrics: session.getMetrics(),
            });
        }).catch((caught) => {
            if (
                cancelled
                || generation !== presentationGenerationRef.current
                || isAbortError(caught)
            ) {
                return;
            }
            setPresentationSwitching(false);
            setSessionError(
                caught instanceof Error
                    ? caught.message
                    : "Failed to switch comparison presentation",
            );
            logComparisonDebugError("session.presentation.failed", caught, {
                generation,
                presentationMode,
                oldNewSide,
            });
        });
        return () => {
            cancelled = true;
        };
    }, [
        oldNewSide,
        presentationMode,
        primaryLayoutReady,
        primaryViewer,
        secondaryLayoutReady,
        secondaryViewer,
        session,
        sessionPhase,
    ]);

    useEffect(() => {
        if (
            !session
            || sessionPhase !== "ready"
            || presentationSwitching
            || !primaryViewer
        ) {
            return;
        }
        const applicationKey =
            `${presentationMode}:${oldNewSide}:${documentPath}:${selectionKey}`;
        if (lastSelectionKeyRef.current === applicationKey) return;
        lastSelectionKeyRef.current = applicationKey;
        const nativeSelection = resolveNativeSelection(
            session.preparation,
            documentDiff,
            selection,
            allChanges,
        );
        if (!nativeSelection) {
            setSelectionDiagnostic(null);
            setSelectionNotice(
                selection
                    ? "This is a derived connectivity change with no standalone KiCad object to highlight."
                    : null,
            );
            return;
        }
        const viewers =
            presentationMode === "side-by-side"
                ? [
                    ...(baseHasDocument ? [primaryViewer] : []),
                    ...(compareHasDocument && secondaryViewer
                        ? [secondaryViewer]
                        : []),
                ]
                : presentationMode === "old-new"
                    ? (
                        oldNewSide === "base"
                            ? baseHasDocument
                            : compareHasDocument
                    )
                        ? [primaryViewer]
                        : []
                    : [primaryViewer];
        const generation = ++selectionGenerationRef.current;
        cameraSyncSuppressedRef.current =
            presentationMode === "side-by-side";
        setSelectionPending(true);
        setSelectionDiagnostic(null);
        setSelectionNotice(null);
        void Promise.all(
            viewers.map((viewer) => viewer.selectDocumentDiff(nativeSelection)),
        ).then((frames) => {
            if (generation !== selectionGenerationRef.current) return;
            if (selection && frames.every((frame) => frame.status === "missing")) {
                setSelectionNotice(
                    "This is a derived connectivity change with no standalone KiCad object to highlight.",
                );
            }
            logComparisonDebug("session.selection.complete", {
                generation,
                presentationMode,
                oldNewSide,
                nativeSelection,
                frames: frames.map((frame) => ({
                    status: frame.status,
                    clickToFrameMs: frame.clickToFrameMs,
                    paintCount: frame.paintCount,
                    parserCount: frame.parserCount,
                    bounds: frame.target?.bounds,
                })),
            });
        }).catch((caught) => {
            if (generation !== selectionGenerationRef.current) return;
            setSelectionDiagnostic(
                caught instanceof Error ? caught.message : "Selection failed",
            );
            logComparisonDebugError("session.selection.failed", caught, {
                generation,
                presentationMode,
                nativeSelection,
            });
        }).finally(() => {
            if (generation !== selectionGenerationRef.current) return;
            cameraSyncSuppressedRef.current = false;
            setSelectionPending(false);
        });
    }, [
        allChanges,
        baseHasDocument,
        compareHasDocument,
        documentDiff,
        documentPath,
        oldNewSide,
        presentationMode,
        presentationSwitching,
        primaryViewer,
        secondaryViewer,
        selection,
        selectionKey,
        session,
        sessionPhase,
    ]);

    useEffect(() => {
        if (
            !session
            || sessionPhase !== "ready"
            || presentationSwitching
            || !primaryViewer
        ) {
            return;
        }
        const nativePreview = previewSelection
            ? resolveNativeSelection(
                session.preparation,
                documentDiff,
                previewSelection,
                previewChanges,
            )
            : null;
        const viewers =
            presentationMode === "side-by-side" && secondaryViewer
                ? [primaryViewer, secondaryViewer]
                : [primaryViewer];
        for (const viewer of viewers) {
            viewer.previewDocumentDiff?.(nativePreview);
        }
        return () => {
            for (const viewer of viewers) {
                viewer.previewDocumentDiff?.(null);
            }
        };
    }, [
        documentDiff,
        presentationMode,
        presentationSwitching,
        previewChanges,
        previewSelection,
        primaryViewer,
        secondaryViewer,
        session,
        sessionPhase,
    ]);

    useComparisonCameraSync(
        primaryViewer,
        secondaryViewer,
        presentationMode === "side-by-side"
            && sessionPhase === "ready"
            && !presentationSwitching,
        cameraSyncSuppressedRef,
    );

    const activeLayerViewers = useCallback((): ECadViewerElement[] => {
        if (presentationMode === "side-by-side") {
            return [primaryViewer, secondaryViewer].filter(
                (viewer): viewer is ECadViewerElement => Boolean(viewer),
            );
        }
        return primaryViewer ? [primaryViewer] : [];
    }, [presentationMode, primaryViewer, secondaryViewer]);

    useEffect(() => {
        if (domain !== "pcb") {
            setPcbLayers([]);
            return;
        }
        const viewers = activeLayerViewers();
        if (
            sessionPhase !== "ready"
            || presentationSwitching
            || !viewers.length
        ) {
            return;
        }
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
            viewer.addEventListener("ecad-viewer:view-state-change", refresh);
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
        presentationSwitching,
        sessionPhase,
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
    const activeError = sourceError ?? sessionError ?? selectionDiagnostic;
    const bannerMessage = activeError ?? selectionNotice ?? oneSidedSheetNotice;
    const showBanner =
        Boolean(bannerMessage) && bannerMessage !== dismissedBanner;
    const loading =
        baseSources.loading
        || compareSources.loading
        || sessionPhase === "waiting-layout"
        || sessionPhase === "loading"
        || presentationSwitching;
    const diagnostics =
        preparation?.diagnostics.length ?? documentDiff.diagnostics.length;

    if (baseMissingRoot && compareMissingRoot) {
        return (
            <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-background p-8 text-center">
                <AlertCircle className="mb-3 h-10 w-10 text-muted-foreground/60" />
                <h3 className="text-sm font-medium">
                    Document missing in both revisions
                </h3>
                <p className="mt-2 max-w-md text-xs text-muted-foreground">
                    {baseSources.rootName} is not present in base or compare.
                    Pick another revision pair or switch tabs.
                </p>
            </section>
        );
    }

    const primaryActive =
        presentationMode !== "side-by-side"
        || baseHasDocument;
    const secondaryActive =
        presentationMode === "side-by-side"
        && compareHasDocument;
    const primaryInset =
        presentationMode === "side-by-side" ? 0 : rightRailInset;

    return (
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-muted/20 px-3 py-2 text-xs">
                {presentationMode === "composite" ? (
                    <span className="mr-auto inline-flex items-center gap-3">
                        <ChangeStatusLegend />
                    </span>
                ) : presentationMode === "old-new" ? (
                    <>
                        <div
                            className="flex items-center gap-0.5 rounded-md border bg-background p-0.5"
                            role="group"
                            aria-label="Revision side"
                        >
                            <Button
                                variant={oldNewSide === "base" ? "secondary" : "ghost"}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setOldNewSide("base")}
                                aria-pressed={oldNewSide === "base"}
                            >
                                Old
                            </Button>
                            <Button
                                variant={oldNewSide === "compare" ? "secondary" : "ghost"}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setOldNewSide("compare")}
                                aria-pressed={oldNewSide === "compare"}
                            >
                                New
                            </Button>
                        </div>
                        <span className="mr-auto" />
                    </>
                ) : (
                    <span className="mr-auto" />
                )}
                {domain === "pcb" && (
                    <ComparisonPcbLayersToggle
                        open={showLayers}
                        onClick={() => onRightRailTabChange(
                            showLayers ? null : "layers",
                        )}
                    />
                )}
            </div>

            <div className="relative min-h-0 min-w-0 flex-1">
                <div
                    className={cn(
                        "absolute inset-0 grid min-h-0",
                        presentationMode === "side-by-side"
                            ? "grid-cols-2 divide-x"
                            : "grid-cols-1",
                    )}
                >
                    <div className="relative flex min-h-0 min-w-0 flex-col">
                        {presentationMode === "side-by-side" && (
                            <div className="shrink-0 border-b bg-muted/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Base
                            </div>
                        )}
                        <div className="relative min-h-0 flex-1">
                            <ComparisonViewerHost
                                key={primaryHostKey}
                                viewerKey={primaryHostKey}
                                active={primaryActive}
                                onViewer={attachPrimary}
                                onLayoutReady={() => setPrimaryLayoutReady(true)}
                                viewportInsets={{ right: primaryInset }}
                            />
                            {presentationMode === "side-by-side"
                                && !baseHasDocument
                                && documentPath && (
                                <MissingRevisionPane
                                    side="base"
                                    documentPath={documentPath}
                                />
                            )}
                            {presentationMode === "old-new"
                                && oldNewSide === "base"
                                && !baseHasDocument
                                && documentPath && (
                                <MissingRevisionPane
                                    side="base"
                                    documentPath={documentPath}
                                />
                            )}
                            {presentationMode === "old-new"
                                && oldNewSide === "compare"
                                && !compareHasDocument
                                && documentPath && (
                                <MissingRevisionPane
                                    side="compare"
                                    documentPath={documentPath}
                                />
                            )}
                        </div>
                    </div>

                    {mountedSecondaryRef.current && (
                        <div
                            className={cn(
                                "relative min-h-0 min-w-0 flex-col",
                                presentationMode === "side-by-side"
                                    ? "flex"
                                    : "hidden",
                            )}
                        >
                            <div className="shrink-0 border-b bg-muted/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Compare
                            </div>
                            <div className="relative min-h-0 flex-1">
                                <ComparisonViewerHost
                                    key={secondaryHostKey}
                                    viewerKey={secondaryHostKey}
                                    active={secondaryActive}
                                    onViewer={attachSecondary}
                                    onLayoutReady={() =>
                                        setSecondaryLayoutReady(true)}
                                    viewportInsets={{ right: rightRailInset }}
                                />
                                {!compareHasDocument && documentPath && (
                                    <MissingRevisionPane
                                        side="compare"
                                        documentPath={documentPath}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {(loading || selectionPending) && (
                    <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                        <div className="inline-flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {loading
                                ? sessionPhase === "loading"
                                    ? "Preparing comparison session…"
                                    : "Switching comparison view…"
                                : "Focusing change…"}
                        </div>
                    </div>
                )}

                {showBanner && bannerMessage && (
                    <div
                        className={cn(
                            "absolute inset-x-3 bottom-3 flex items-start gap-2 rounded border bg-background/95 p-3 text-xs shadow-sm",
                            activeError
                                ? "border-destructive/30 text-destructive"
                                : "border-warning/30 text-warning",
                        )}
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 break-words">
                            {bannerMessage}
                        </span>
                        <button
                            type="button"
                            className="shrink-0 rounded p-0.5 transition-colors hover:bg-muted"
                            aria-label="Dismiss warning"
                            onClick={() => setDismissedBanner(bannerMessage)}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

                {presentationMode === "composite"
                    && !!diagnostics
                    && !showBanner
                    && !diagnosticsDismissed && (
                    <div className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded border bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
                        <span>
                            {diagnostics} unresolved native{" "}
                            {diagnostics === 1 ? "item" : "items"}
                        </span>
                        <button
                            type="button"
                            className="rounded p-0.5 transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="Dismiss unresolved items notice"
                            onClick={() => setDiagnosticsDismissed(true)}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}

                <ViewerOverlayRail
                    activeTab={rightRailTab}
                    tabs={[
                        ...(domain === "pcb"
                            ? [{
                                  id: "layers" as const,
                                  label: "Layers",
                                  icon: <Layers3 className="mr-1.5 size-3.5" />,
                              }]
                            : []),
                        {
                            id: "discussion" as const,
                            label: "Discussion",
                            icon: <MessageSquare className="mr-1.5 size-3.5" />,
                            badge: discussionCount > 0
                                ? (
                                    <span className="rounded-full bg-muted px-1.5 text-[10px]">
                                        {discussionCount}
                                    </span>
                                )
                                : null,
                        },
                    ]}
                    onTabChange={onRightRailTabChange}
                    onClose={() => onRightRailTabChange(null)}
                    onVisibleWidthChange={setRightRailInset}
                    ariaLabel="Comparison tools"
                    className="w-80"
                >
                    {rightRailTab === "layers" && domain === "pcb" ? (
                        <ComparisonPcbLayersPanel
                            open
                            onOpenChange={(open) => {
                                if (!open) onRightRailTabChange(null);
                            }}
                            layers={pcbLayers}
                            onToggleVisibility={toggleLayer}
                            onApplyPreset={applyPreset}
                            onHighlight={highlightLayer}
                            embedded
                        />
                    ) : discussionContent}
                </ViewerOverlayRail>
            </div>
        </section>
    );
}
