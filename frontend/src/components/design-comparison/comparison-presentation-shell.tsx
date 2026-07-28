import {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { AlertCircle, Layers3, Loader2, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
    ECadViewerElement,
    EcadDocumentComparisonPreparation,
    EcadPcbLayerState,
    EcadRevisionDiffPresentationRequest,
    EcadTransitionTraceDetail,
} from "@/types/ecad-viewer";
import {
    ComparisonPcbLayersPanel,
    ComparisonPcbLayersToggle,
} from "./comparison-pcb-layers-panel";
import { ViewerOverlayRail } from "@/components/viewer-overlay-rail";
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
    if (!documentPath) return false;
    return sources.some((source) => sameDocument(source.path, documentPath));
}

function resolvedViewerDocuments(
    viewer: ECadViewerElement,
): string[] | null {
    if (typeof viewer.getSchematicPages !== "function") return null;
    return viewer.getSchematicPages().flatMap((page) =>
        [page.projectPath, page.filename].filter(
            (value): value is string => Boolean(value),
        ),
    );
}

function resolvedRevisionHasDocument(
    resolvedDocuments: string[] | null,
    sources: DesignCompareResult["files"]["base"],
    documentPath: string | null,
): boolean {
    if (!documentPath) return false;
    if (resolvedDocuments !== null) {
        return resolvedDocuments.some((path) => sameDocument(path, documentPath));
    }
    return revisionHasDocument(sources, documentPath);
}

function buildRevisionDiffPresentation(
    groups: Array<{ id: string; changes: ChangeItem[] }>,
    documentDiff: KiCadProjectDiffBundle,
    documentPath: string,
    side: "reference" | "comparison",
    context: "SCH" | "PCB",
): EcadRevisionDiffPresentationRequest {
    const targets = groups.flatMap((group) => {
        const visuals = group.changes.flatMap((change) => {
            const navigation = documentDiff.navigation[change.id];
            const paths = navigation?.documents?.map((entry) => entry.documentPath)
                ?? (navigation ? [navigation.documentPath] : []);
            if (paths.length && !paths.some((path) => sameDocument(path, documentPath))) {
                return [];
            }
            const explicit = change.details?.visualTargets
                ?.filter((target) => target.side === side)
                .filter((target) =>
                    target.page
                        ? sameDocument(target.page, documentPath)
                        // A source without a page is safe only when navigation
                        // identifies one unambiguous document. Do not install it
                        // on every pane of a multi-page logical net.
                        : paths.length === 1
                            && sameDocument(paths[0], documentPath),
                )
                .map((target) => ({
                    sourceId: target.sourceId,
                    parentSourceId: target.parentSourceId,
                    status: target.status,
                    bounds:
                        side === "reference"
                            ? change.oldGeometry?.bounds
                            : change.geometry?.bounds,
                    routing: target.role === "wire",
                })) ?? [];
            if (explicit.length) return explicit;

            const applicable = side === "reference"
                ? change.kind !== "added"
                : change.kind !== "removed";
            if (!applicable) return [];
            const sourceId = side === "reference"
                ? change.source_id_base ?? change.base_item?.source_id
                : change.source_id_compare ?? change.compare_item?.source_id;
            if (!sourceId) return [];
            const geometry = side === "reference"
                ? change.oldGeometry
                : change.geometry;
            return [{
                sourceId,
                parentSourceId:
                    side === "reference"
                        ? change.base_item?.parent_source_id
                        : change.compare_item?.parent_source_id,
                status:
                    change.kind === "added"
                        ? "added" as const
                        : change.kind === "removed"
                            ? "removed" as const
                            : "modified" as const,
                bounds: geometry?.bounds,
                routing: ["wire", "track", "arc", "via"].includes(
                    geometry?.kind ?? "",
                ),
            }];
        });
        return visuals.length
            ? [{ id: group.id, label: group.id, visuals }]
            : [];
    });
    return { context, targets };
}

function revisionSelectionId(
    selection: ComparisonSelection,
    groups: Array<{ id: string; changes: ChangeItem[] }>,
): string | null {
    if (!selection) return null;
    if (selection.kind === "group") return selection.id;
    return groups.find((group) =>
        group.changes.some((change) => change.id === selection.id),
    )?.id ?? null;
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

async function selectRevisionViewer(
    viewer: ECadViewerElement | null,
    targetId: string | null,
    bounds?: [number, number, number, number],
    uuid?: string | null,
): Promise<boolean> {
    if (!viewer) return false;
    if (targetId && viewer.selectRevisionDiff) {
        const applied = await viewer.selectRevisionDiff(targetId, { focus: true });
        if (applied) return true;
    }
    if (!bounds && !uuid) return false;
    await focusRevisionViewer(viewer, bounds, uuid);
    return true;
}

function viewerState(viewer: ECadViewerElement | null) {
    return {
        connected: viewer?.isConnected ?? false,
        isReady: viewer?.isReady ?? false,
        activePage: viewer?.getActiveSchematicPage?.() ?? null,
        camera: viewer?.camera ?? null,
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
    const [toggleViewer, setToggleViewer] =
        useState<ECadViewerElement | null>(null);
    const [oldNewSide, setOldNewSide] = useState<OldNewSide>("compare");
    const [preparation, setPreparation] =
        useState<EcadDocumentComparisonPreparation | null>(null);
    const [selectionPending, setSelectionPending] = useState(false);
    const [selectionDiagnostic, setSelectionDiagnostic] =
        useState<string | null>(null);
    const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
    const [dismissedBanner, setDismissedBanner] = useState<string | null>(null);
    const [diagnosticsDismissed, setDiagnosticsDismissed] = useState(false);
    const [sidePageReadyPath, setSidePageReadyPath] =
        useState<string | null>(null);
    const [togglePageReadyPath, setTogglePageReadyPath] =
        useState<string | null>(null);
    const [baseResolvedDocuments, setBaseResolvedDocuments] =
        useState<string[] | null>(null);
    const [compareResolvedDocuments, setCompareResolvedDocuments] =
        useState<string[] | null>(null);
    const [rightRailInset, setRightRailInset] = useState(0);
    const [pcbLayers, setPcbLayers] = useState<EcadPcbLayerState[]>([]);
    const showLayers = rightRailTab === "layers";

    const compositeGenerationRef = useRef(0);
    const baseGenerationRef = useRef(0);
    const compareGenerationRef = useRef(0);
    const toggleGenerationRef = useRef(0);
    const pageGenerationRef = useRef(0);
    const togglePageGenerationRef = useRef(0);
    const selectionGenerationRef = useRef(0);
    const cameraSyncSuppressedRef = useRef(false);
    const lastCompositeSelectionKeyRef = useRef<string | null>(null);
    const lastSideSelectionKeyRef = useRef<string | null>(null);
    const lastToggleSelectionKeyRef = useRef<string | null>(null);
    const previousPresentationRef =
        useRef<ComparisonPresentationMode>(presentationMode);
    const compositeViewerRef = useRef<ECadViewerElement | null>(null);
    const baseViewerRef = useRef<ECadViewerElement | null>(null);
    const compareViewerRef = useRef<ECadViewerElement | null>(null);
    const toggleViewerRef = useRef<ECadViewerElement | null>(null);
    const mountedModesRef = useRef(new Set<ComparisonPresentationMode>());
    mountedModesRef.current.add(presentationMode);

    const allChanges = useMemo(
        () => selectedChanges(selection, reviewGroups),
        [reviewGroups, selection],
    );
    const previewChanges = useMemo(
        () => selectedChanges(previewSelection, reviewGroups),
        [previewSelection, reviewGroups],
    );
    const selectionKey = useMemo(
        () =>
            selection
                ? `${selection.kind}:${selection.id}:${selection.documentPath ?? "default"}:${allChanges
                    .map((change) => change.id)
                    .join(",")}`
                : "none",
        [allChanges, selection],
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
    // A domain with nothing changed in it still has a document worth looking
    // at. `activeDocument` comes from the diff bundle, which lists only what
    // changed, so an untouched schematic used to replace the entire panel with
    // "No schematic document for this comparison" — the reviewer could not open
    // the schematic at all on a PCB-only commit. The revision's own root
    // document is the fallback.
    const documentPath =
        activeDocument?.path
        ?? baseSources.rootName
        ?? compareSources.rootName
        ?? null;
    const baseHasDocument = domain !== "schematic" || resolvedRevisionHasDocument(
        baseResolvedDocuments,
        files.base,
        documentPath,
    );
    const compareHasDocument = domain !== "schematic" || resolvedRevisionHasDocument(
        compareResolvedDocuments,
        files.head,
        documentPath,
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
    const compositeHostKey =
        `${projectId}:composite:${domain}:${base}:${compare}`;
    const baseHostKey = `${projectId}:base:${domain}:${base}`;
    const compareHostKey = `${projectId}:compare:${domain}:${compare}`;
    const toggleHostKey =
        `${projectId}:toggle:${domain}:${base}:${compare}`;
    const comparisonKey = `${projectId}:${base}:${compare}:${domain}`;

    useEffect(() => {
        setDiagnosticsDismissed(false);
        setDismissedBanner(null);
    }, [comparisonKey, documentPath]);

    const oneSidedSheetNotice = useMemo(() => {
        if (baseMissingRoot && !compareMissingRoot) {
            return `${baseSources.rootName} is missing from the base revision.`;
        }
        if (compareMissingRoot && !baseMissingRoot) {
            return `${compareSources.rootName} is missing from the compare revision.`;
        }
        if (!documentPath || domain !== "schematic") return null;
        const matches = (path: string) =>
            path === documentPath
            || path.endsWith(`/${documentPath}`)
            || documentPath.endsWith(`/${path}`);
        const inBase = files.base.some((file) => matches(file.path));
        const inHead = files.head.some((file) => matches(file.path));
        if (inHead && !inBase) {
            return `${documentPath} exists only in the compare revision.`;
        }
        if (inBase && !inHead) {
            return `${documentPath} exists only in the base revision.`;
        }
        return null;
    }, [
        baseMissingRoot,
        baseSources.rootName,
        compareMissingRoot,
        compareSources.rootName,
        documentPath,
        domain,
        files.base,
        files.head,
    ]);

    const attachHost = useCallback(
        (
            slot: ComparisonHostSlot,
            key: string,
            setter: (viewer: ECadViewerElement | null) => void,
            ref: { current: ECadViewerElement | null },
            viewer: ECadViewerElement | null,
        ) => {
            ref.current = viewer;
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
                compositeViewerRef,
                viewer,
            ),
        [attachHost, compositeHostKey],
    );
    const attachBase = useCallback(
        (viewer: ECadViewerElement | null) =>
            attachHost(
                "base",
                baseHostKey,
                setBaseViewer,
                baseViewerRef,
                viewer,
            ),
        [attachHost, baseHostKey],
    );
    const attachCompare = useCallback(
        (viewer: ECadViewerElement | null) =>
            attachHost(
                "compare",
                compareHostKey,
                setCompareViewer,
                compareViewerRef,
                viewer,
            ),
        [attachHost, compareHostKey],
    );
    const attachToggle = useCallback(
        (viewer: ECadViewerElement | null) =>
            attachHost(
                "toggle",
                toggleHostKey,
                setToggleViewer,
                toggleViewerRef,
                viewer,
            ),
        [attachHost, toggleHostKey],
    );

    useEffect(() => {
        const viewers: Array<[
            ComparisonHostSlot,
            ECadViewerElement | null,
        ]> = [
            ["composite", compositeViewer],
            ["base", baseViewer],
            ["compare", compareViewer],
            ["toggle", toggleViewer],
        ];
        const cleanups: Array<() => void> = [];
        for (const [slot, viewer] of viewers) {
            if (!viewer) continue;
            const listener = ((event: CustomEvent<EcadTransitionTraceDetail>) => {
                logComparisonDebug("viewer.transition", {
                    slot,
                    presentationMode,
                    oldNewSide: slot === "toggle" ? oldNewSide : null,
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
    }, [
        baseViewer,
        compareViewer,
        compositeViewer,
        oldNewSide,
        presentationMode,
        toggleViewer,
    ]);

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
    const markToggleLayout = useCallback(
        (key: string) =>
            dispatch({ type: "layout-ready", slot: "toggle", key }),
        [],
    );

    useEffect(() => {
        const previous = previousPresentationRef.current;
        previousPresentationRef.current = presentationMode;
        if (previous === presentationMode) return;

        logComparisonDebug("presentation.transition", {
            from: previous,
            to: presentationMode,
            domain,
            documentPath,
            selectionKey,
            lifecycle,
        });

        selectionGenerationRef.current += 1;
        cameraSyncSuppressedRef.current = false;
        setSelectionPending(false);
        setSelectionDiagnostic(null);
        setDismissedBanner(null);
        setDiagnosticsDismissed(false);
        setPreparation(null);
        setSidePageReadyPath(null);
        setTogglePageReadyPath(null);

        if (previous === "composite") {
            compositeViewerRef.current?.abortDocumentComparisonLoad?.();
        }
    }, [documentPath, domain, lifecycle, presentationMode, selectionKey]);

    useEffect(() => {
        if (
            presentationMode !== "composite"
            || !compositeViewer
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
        logComparisonDebug("host.composite.load.start", {
            generation,
            documentPath: activeDocument.path,
            baseRevisionKey,
            compareRevisionKey,
        });

        if (typeof compositeViewer.loadDocumentComparison !== "function") {
            dispatch({
                type: "transition",
                slot: "composite",
                key: compositeHostKey,
                phase: "error",
                error:
                    "This ecad-viewer build does not expose loadDocumentComparison. Rebuild and sync frontend/public/ecad-viewer.js from the feature branch.",
            });
            return;
        }

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
                activeSheetPath: activeDocument.path,
            })
            .then((next) => {
                if (
                    cancelled
                    || generation !== compositeGenerationRef.current
                ) {
                    return;
                }
                setPreparation(next);
                logComparisonDebug("host.composite.load.ready", {
                    generation,
                    documentPath: next.document.path,
                    missingReference: next.missingReference ?? false,
                    missingComparison: next.missingComparison ?? false,
                    targetCount: next.targets.size,
                    viewerState: viewerState(compositeViewer),
                });
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
                logComparisonDebugError(
                    "host.composite.load.failed",
                    caught,
                    {
                        generation,
                        documentPath: activeDocument.path,
                        viewerState: viewerState(compositeViewer),
                    },
                );
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
        presentationMode,
        sourcesReady,
    ]);

    useEffect(() => {
        if (
            presentationMode !== "side-by-side"
            || !baseViewer
            || !lifecycle.base.layoutReady
            || !sourcesReady
        ) {
            return;
        }
        const generation = ++baseGenerationRef.current;
        let cancelled = false;
        setBaseResolvedDocuments(null);
        dispatch({
            type: "transition",
            slot: "base",
            key: baseHostKey,
            phase: "loading",
        });
        logComparisonDebug("host.revision.load.start", {
            slot: "base",
            generation,
            revisionKey: baseRevisionKey,
            sourceCount: baseSources.sources.length,
        });
        if (baseMissingRoot) {
            dispatch({
                type: "transition",
                slot: "base",
                key: baseHostKey,
                phase: "error",
                error: `${baseSources.rootName} is missing from the base revision.`,
            });
            return;
        }
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
                setBaseResolvedDocuments(resolvedViewerDocuments(baseViewer));
                dispatch({
                    type: "transition",
                    slot: "base",
                    key: baseHostKey,
                    phase: "ready",
                });
                logComparisonDebug("host.revision.load.ready", {
                    slot: "base",
                    generation,
                    revisionKey: baseRevisionKey,
                    viewerState: viewerState(baseViewer),
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
                logComparisonDebugError("host.revision.load.failed", caught, {
                    slot: "base",
                    generation,
                    revisionKey: baseRevisionKey,
                    viewerState: viewerState(baseViewer),
                });
            });
        return () => {
            cancelled = true;
        };
    }, [
        baseHostKey,
        baseMissingRoot,
        baseRevisionKey,
        baseSources.rootName,
        baseSources.sources,
        baseViewer,
        lifecycle.base.layoutReady,
        presentationMode,
        sourcesReady,
    ]);

    useEffect(() => {
        if (
            presentationMode !== "side-by-side"
            || !compareViewer
            || !lifecycle.compare.layoutReady
            || !sourcesReady
        ) {
            return;
        }
        const generation = ++compareGenerationRef.current;
        let cancelled = false;
        setCompareResolvedDocuments(null);
        dispatch({
            type: "transition",
            slot: "compare",
            key: compareHostKey,
            phase: "loading",
        });
        logComparisonDebug("host.revision.load.start", {
            slot: "compare",
            generation,
            revisionKey: compareRevisionKey,
            sourceCount: compareSources.sources.length,
        });
        if (compareMissingRoot) {
            dispatch({
                type: "transition",
                slot: "compare",
                key: compareHostKey,
                phase: "error",
                error: `${compareSources.rootName} is missing from the compare revision.`,
            });
            return;
        }
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
                setCompareResolvedDocuments(resolvedViewerDocuments(compareViewer));
                dispatch({
                    type: "transition",
                    slot: "compare",
                    key: compareHostKey,
                    phase: "ready",
                });
                logComparisonDebug("host.revision.load.ready", {
                    slot: "compare",
                    generation,
                    revisionKey: compareRevisionKey,
                    viewerState: viewerState(compareViewer),
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
                logComparisonDebugError("host.revision.load.failed", caught, {
                    slot: "compare",
                    generation,
                    revisionKey: compareRevisionKey,
                    viewerState: viewerState(compareViewer),
                });
            });
        return () => {
            cancelled = true;
        };
    }, [
        compareHostKey,
        compareMissingRoot,
        compareRevisionKey,
        compareSources.rootName,
        compareSources.sources,
        compareViewer,
        lifecycle.compare.layoutReady,
        presentationMode,
        sourcesReady,
    ]);

    useEffect(() => {
        if (
            presentationMode !== "old-new"
            || !toggleViewer
            || !lifecycle.toggle.layoutReady
            || !sourcesReady
        ) {
            return;
        }
        const generation = ++toggleGenerationRef.current;
        let cancelled = false;
        const revisionKey =
            oldNewSide === "base" ? baseRevisionKey : compareRevisionKey;
        const sources =
            oldNewSide === "base"
                ? baseSources.sources
                : compareSources.sources;
        const missing =
            oldNewSide === "base" ? baseMissingRoot : compareMissingRoot;
        const rootName =
            oldNewSide === "base"
                ? baseSources.rootName
                : compareSources.rootName;
        delete toggleViewer.dataset.ecadReadyRevision;
        dispatch({
            type: "transition",
            slot: "toggle",
            key: toggleHostKey,
            phase: "loading",
        });
        logComparisonDebug("host.toggle.load.start", {
            generation,
            side: oldNewSide,
            revisionKey,
            sourceCount: sources.length,
        });
        if (missing) {
            dispatch({
                type: "transition",
                slot: "toggle",
                key: toggleHostKey,
                phase: "error",
                error: `${rootName} is missing from the ${oldNewSide} revision.`,
            });
            return;
        }
        void toggleViewer
            .replaceSources({ revisionKey, sources })
            .then(() => toggleViewer.ready)
            .then(() => {
                if (
                    cancelled
                    || generation !== toggleGenerationRef.current
                ) {
                    return;
                }
                toggleViewer.dataset.ecadReadyRevision = revisionKey;
                const resolvedDocuments = resolvedViewerDocuments(toggleViewer);
                if (oldNewSide === "base") {
                    setBaseResolvedDocuments(resolvedDocuments);
                } else {
                    setCompareResolvedDocuments(resolvedDocuments);
                }
                dispatch({
                    type: "transition",
                    slot: "toggle",
                    key: toggleHostKey,
                    phase: "ready",
                });
                logComparisonDebug("host.toggle.load.ready", {
                    generation,
                    side: oldNewSide,
                    revisionKey,
                    viewerState: viewerState(toggleViewer),
                });
            })
            .catch((caught) => {
                if (
                    cancelled
                    || generation !== toggleGenerationRef.current
                ) {
                    return;
                }
                dispatch({
                    type: "transition",
                    slot: "toggle",
                    key: toggleHostKey,
                    phase: "error",
                    error:
                        caught instanceof Error
                            ? caught.message
                            : "Failed to load revision",
                });
                logComparisonDebugError("host.toggle.load.failed", caught, {
                    generation,
                    side: oldNewSide,
                    revisionKey,
                    viewerState: viewerState(toggleViewer),
                });
            });
        return () => {
            cancelled = true;
        };
    }, [
        baseMissingRoot,
        baseRevisionKey,
        baseSources.rootName,
        baseSources.sources,
        compareMissingRoot,
        compareRevisionKey,
        compareSources.rootName,
        compareSources.sources,
        lifecycle.toggle.layoutReady,
        oldNewSide,
        presentationMode,
        sourcesReady,
        toggleHostKey,
        toggleViewer,
    ]);

    const sideReady =
        lifecycle.base.phase === "ready"
        && lifecycle.compare.phase === "ready";
    const sideSettled =
        (lifecycle.base.phase === "ready" || lifecycle.base.phase === "error")
        && (lifecycle.compare.phase === "ready"
            || lifecycle.compare.phase === "error");
    const toggleReady = lifecycle.toggle.phase === "ready";
    const activeToggleRevisionKey = oldNewSide === "base"
        ? baseRevisionKey
        : compareRevisionKey;
    const toggleRevisionReady = toggleReady
        && toggleViewer?.dataset.ecadReadyRevision === activeToggleRevisionKey;
    const toggleSettled =
        lifecycle.toggle.phase === "ready" || lifecycle.toggle.phase === "error";

    useEffect(() => {
        const generation = ++pageGenerationRef.current;
        setSidePageReadyPath(domain === "pcb" ? documentPath : null);
        if (
            presentationMode !== "side-by-side"
            || domain !== "schematic"
            || !documentPath
            || !sideReady
            || !baseViewer
            || !compareViewer
        ) {
            return;
        }
        let cancelled = false;
        logComparisonDebug("page.side-by-side.start", {
            generation,
            documentPath,
            base: viewerState(baseViewer),
            compare: viewerState(compareViewer),
        });
        if (!baseHasDocument) {
            logComparisonDebug("page.side-by-side.absent", {
                side: "base",
                documentPath,
            });
        }
        if (!compareHasDocument) {
            logComparisonDebug("page.side-by-side.absent", {
                side: "compare",
                documentPath,
            });
        }
        void Promise.allSettled([
            baseHasDocument
                ? baseViewer.showPage?.(documentPath)
                : Promise.resolve(),
            compareHasDocument
                ? compareViewer.showPage?.(documentPath)
                : Promise.resolve(),
        ])
            .then((results) => {
                if (
                    !cancelled
                    && generation === pageGenerationRef.current
                ) {
                    const failures = results.flatMap((result, index) =>
                        result.status === "rejected"
                            ? [{
                                  side: index === 0 ? "base" : "compare",
                                  error:
                                      result.reason instanceof Error
                                          ? {
                                                name: result.reason.name,
                                                message: result.reason.message,
                                            }
                                          : String(result.reason),
                              }]
                            : [],
                    );
                    logComparisonDebug("page.side-by-side.complete", {
                        generation,
                        documentPath,
                        failures,
                        base: viewerState(baseViewer),
                        compare: viewerState(compareViewer),
                    });
                    if (failures.length) {
                        setSelectionDiagnostic(
                            failures.length === 2
                                ? "This sheet could not be resolved in either revision."
                                : `This sheet could not be resolved in the ${failures[0]!.side} revision.`,
                        );
                    }
                    setSidePageReadyPath(documentPath);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [
        baseViewer,
        baseHasDocument,
        compareViewer,
        compareHasDocument,
        documentPath,
        domain,
        oldNewSide,
        presentationMode,
        sideReady,
    ]);

    useEffect(() => {
        const generation = ++togglePageGenerationRef.current;
        setTogglePageReadyPath(domain === "pcb" ? documentPath : null);
        if (
            presentationMode !== "old-new"
            || domain !== "schematic"
            || !documentPath
            || !toggleRevisionReady
            || !toggleViewer
        ) {
            return;
        }
        let cancelled = false;
        const activeSideHasDocument =
            oldNewSide === "base" ? baseHasDocument : compareHasDocument;
        logComparisonDebug("page.toggle.start", {
            generation,
            side: oldNewSide,
            documentPath,
            viewerState: viewerState(toggleViewer),
        });
        if (!activeSideHasDocument) {
            logComparisonDebug("page.toggle.absent", {
                generation,
                side: oldNewSide,
                documentPath,
            });
            setTogglePageReadyPath(documentPath);
            return;
        }
        void toggleViewer.showPage?.(documentPath)
            .then(() => {
                if (
                    !cancelled
                    && generation === togglePageGenerationRef.current
                ) {
                    logComparisonDebug("page.toggle.complete", {
                        generation,
                        side: oldNewSide,
                        documentPath,
                        viewerState: viewerState(toggleViewer),
                    });
                    setTogglePageReadyPath(documentPath);
                }
            })
            .catch((caught) => {
                if (
                    !cancelled
                    && generation === togglePageGenerationRef.current
                ) {
                    logComparisonDebugError("page.toggle.failed", caught, {
                        generation,
                        side: oldNewSide,
                        documentPath,
                        viewerState: viewerState(toggleViewer),
                    });
                    setSelectionDiagnostic(
                        caught instanceof Error
                            ? caught.message
                            : "This sheet is missing from the selected revision.",
                    );
                    setTogglePageReadyPath(documentPath);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [
        documentPath,
        domain,
        baseHasDocument,
        compareHasDocument,
        oldNewSide,
        presentationMode,
        toggleRevisionReady,
        toggleViewer,
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
            logComparisonDebug("selection.composite.unresolved", {
                selection,
                selectionKey,
                documentPath,
                selectedChanges: allChanges.map((change) => ({
                    id: change.id,
                    category: change.category,
                    reasons: change.reasons,
                    visualTargets: change.details?.visualTargets,
                })),
            });
            setSelectionPending(false);
            setSelectionDiagnostic(null);
            setSelectionNotice(
                selection
                    ? "This is a derived connectivity change with no standalone KiCad object to highlight."
                    : null,
            );
            return;
        }
        setSelectionPending(true);
        setSelectionDiagnostic(null);
        setSelectionNotice(null);
        logComparisonDebug("selection.composite.start", {
            generation,
            selection,
            nativeSelection,
            selectionKey,
            documentPath,
            viewerState: viewerState(compositeViewer),
        });
        void compositeViewer
            .selectDocumentDiff(nativeSelection)
            .then((frame) => {
                if (generation !== selectionGenerationRef.current) return;
                logComparisonDebug("selection.composite.complete", {
                    generation,
                    selection,
                    nativeSelection,
                    frame: {
                        status: frame.status,
                        requestId: frame.requestId,
                        clickToFrameMs: frame.clickToFrameMs,
                        paintCount: frame.paintCount,
                        parserCount: frame.parserCount,
                        targetId: frame.target?.id,
                        sourceIds: frame.target?.sourceIds,
                        bounds: frame.target?.bounds,
                    },
                    viewerState: viewerState(compositeViewer),
                });
                if (frame.status === "missing") {
                    setSelectionDiagnostic(
                        "The selected native item could not be resolved.",
                    );
                }
            })
            .catch((caught) => {
                if (generation === selectionGenerationRef.current) {
                    logComparisonDebugError(
                        "selection.composite.failed",
                        caught,
                        {
                            generation,
                            selection,
                            nativeSelection,
                            documentPath,
                            viewerState: viewerState(compositeViewer),
                        },
                    );
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

    useEffect(() => {
        if (
            presentationMode !== "composite"
            || !compositeViewer
            || !preparation
            || preparation.document.path !== documentPath
        ) {
            return;
        }
        if (!previewSelection) {
            compositeViewer.previewDocumentDiff?.(null);
            return;
        }
        const nativePreview = resolveNativeSelection(
            preparation,
            documentDiff,
            previewSelection,
            previewChanges,
        );
        compositeViewer.previewDocumentDiff?.(nativePreview);
        return () => compositeViewer.previewDocumentDiff?.(null);
    }, [
        compositeViewer,
        documentDiff,
        documentPath,
        preparation,
        presentationMode,
        previewChanges,
        previewSelection,
    ]);

    const sidePageReady =
        domain === "pcb" || sidePageReadyPath === documentPath;
    const togglePageReady =
        domain === "pcb" || togglePageReadyPath === documentPath;

    useEffect(() => {
        if (presentationMode !== "side-by-side" || !sideReady || !sidePageReady) {
            return;
        }
        const id = revisionSelectionId(previewSelection, reviewGroups);
        baseViewer?.previewRevisionDiff?.(id);
        compareViewer?.previewRevisionDiff?.(id);
        return () => {
            baseViewer?.previewRevisionDiff?.(null);
            compareViewer?.previewRevisionDiff?.(null);
        };
    }, [
        baseViewer,
        compareViewer,
        presentationMode,
        previewSelection,
        reviewGroups,
        sidePageReady,
        sideReady,
    ]);

    useEffect(() => {
        if (
            presentationMode !== "old-new"
            || !toggleRevisionReady
            || !togglePageReady
        ) {
            return;
        }
        const id = revisionSelectionId(previewSelection, reviewGroups);
        toggleViewer?.previewRevisionDiff?.(id);
        return () => toggleViewer?.previewRevisionDiff?.(null);
    }, [
        presentationMode,
        previewSelection,
        reviewGroups,
        togglePageReady,
        toggleRevisionReady,
        toggleViewer,
    ]);

    useEffect(() => {
        if (
            presentationMode !== "side-by-side"
            || !sideReady
            || !sidePageReady
            || !documentPath
        ) {
            return;
        }
        const context = domain === "pcb" ? "PCB" : "SCH";
        baseViewer?.setRevisionDiffPresentation?.(
            baseHasDocument
                ? buildRevisionDiffPresentation(
                      reviewGroups,
                      documentDiff,
                      documentPath,
                      "reference",
                      context,
                  )
                : null,
        );
        compareViewer?.setRevisionDiffPresentation?.(
            compareHasDocument
                ? buildRevisionDiffPresentation(
                      reviewGroups,
                      documentDiff,
                      documentPath,
                      "comparison",
                      context,
                  )
                : null,
        );
    }, [
        baseViewer,
        baseHasDocument,
        compareViewer,
        compareHasDocument,
        documentDiff,
        documentPath,
        domain,
        presentationMode,
        reviewGroups,
        sidePageReady,
        sideReady,
    ]);

    useEffect(() => {
        if (
            presentationMode !== "old-new"
            || !toggleRevisionReady
            || !togglePageReady
            || !toggleViewer
            || !documentPath
        ) {
            return;
        }
        const activeSideHasDocument =
            oldNewSide === "base" ? baseHasDocument : compareHasDocument;
        toggleViewer.setRevisionDiffPresentation?.(
            activeSideHasDocument
                ? buildRevisionDiffPresentation(
                      reviewGroups,
                      documentDiff,
                      documentPath,
                      oldNewSide === "base" ? "reference" : "comparison",
                      domain === "pcb" ? "PCB" : "SCH",
                  )
                : null,
        );
    }, [
        baseHasDocument,
        compareHasDocument,
        documentDiff,
        documentPath,
        domain,
        oldNewSide,
        presentationMode,
        reviewGroups,
        togglePageReady,
        toggleRevisionReady,
        toggleViewer,
    ]);

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
        const targetId = revisionSelectionId(selection, reviewGroups);
        if (!focus && !targetId) {
            logComparisonDebug("selection.side-by-side.unresolved", {
                selection,
                selectionKey,
                documentPath,
                focus,
                targetId,
            });
            setSelectionPending(false);
            setSelectionDiagnostic(null);
            setSelectionNotice(
                selection
                    ? "This is a derived connectivity change with no standalone KiCad object to highlight."
                    : null,
            );
            return;
        }
        cameraSyncSuppressedRef.current = true;
        setSelectionPending(true);
        setSelectionDiagnostic(null);
        setSelectionNotice(null);
        logComparisonDebug("selection.side-by-side.start", {
            generation,
            selection,
            selectionKey,
            documentPath,
            targetId,
            focus,
            base: viewerState(baseViewer),
            compare: viewerState(compareViewer),
        });
        void Promise.all([
            selectRevisionViewer(
                baseViewer,
                targetId,
                focus?.baseBounds,
                focus?.baseUuid,
            ),
            selectRevisionViewer(
                compareViewer,
                targetId,
                focus?.compareBounds,
                focus?.compareUuid,
            ),
        ])
            .then((applied) => {
                if (generation === selectionGenerationRef.current) {
                    logComparisonDebug("selection.side-by-side.complete", {
                        generation,
                        selection,
                        targetId,
                        applied: { base: applied[0], compare: applied[1] },
                        base: viewerState(baseViewer),
                        compare: viewerState(compareViewer),
                    });
                }
                if (
                    generation === selectionGenerationRef.current
                    && selection
                    && !applied.some(Boolean)
                ) {
                    setSelectionNotice(
                        "This is a derived connectivity change with no standalone KiCad object to highlight.",
                    );
                }
            })
            .catch((caught) => {
                if (generation === selectionGenerationRef.current) {
                    logComparisonDebugError(
                        "selection.side-by-side.failed",
                        caught,
                        {
                            generation,
                            selection,
                            targetId,
                            focus,
                            base: viewerState(baseViewer),
                            compare: viewerState(compareViewer),
                        },
                    );
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
        reviewGroups,
        selection,
        selectionKey,
        sidePageReady,
        sideReady,
    ]);

    useEffect(() => {
        if (
            presentationMode !== "old-new"
            || !toggleRevisionReady
            || !togglePageReady
            || !toggleViewer
        ) {
            return;
        }
        const generation = ++selectionGenerationRef.current;
        const applicationKey =
            `${oldNewSide}:${baseRevisionKey}:${compareRevisionKey}:${documentPath}:${selectionKey}`;
        if (lastToggleSelectionKeyRef.current === applicationKey) return;
        lastToggleSelectionKeyRef.current = applicationKey;
        const focus = resolveComparisonFocus(allChanges);
        const targetId = revisionSelectionId(selection, reviewGroups);
        if (!focus && !targetId) {
            logComparisonDebug("selection.toggle.unresolved", {
                selection,
                selectionKey,
                documentPath,
                side: oldNewSide,
                focus,
                targetId,
            });
            setSelectionPending(false);
            setSelectionDiagnostic(null);
            setSelectionNotice(
                selection
                    ? "This is a derived connectivity change with no standalone KiCad object to highlight."
                    : null,
            );
            return;
        }
        setSelectionPending(true);
        setSelectionDiagnostic(null);
        setSelectionNotice(null);
        const bounds =
            oldNewSide === "base" ? focus?.baseBounds : focus?.compareBounds;
        const uuid =
            oldNewSide === "base" ? focus?.baseUuid : focus?.compareUuid;
        logComparisonDebug("selection.toggle.start", {
            generation,
            selection,
            selectionKey,
            documentPath,
            side: oldNewSide,
            targetId,
            bounds,
            uuid,
            viewerState: viewerState(toggleViewer),
        });
        void selectRevisionViewer(toggleViewer, targetId, bounds, uuid)
            .then((applied) => {
                if (generation === selectionGenerationRef.current) {
                    logComparisonDebug("selection.toggle.complete", {
                        generation,
                        selection,
                        side: oldNewSide,
                        targetId,
                        applied,
                        viewerState: viewerState(toggleViewer),
                    });
                }
                if (
                    generation === selectionGenerationRef.current
                    && selection
                    && !applied
                ) {
                    setSelectionNotice(
                        "This is a derived connectivity change with no standalone KiCad object to highlight.",
                    );
                }
            })
            .catch((caught) => {
                if (generation === selectionGenerationRef.current) {
                    logComparisonDebugError(
                        "selection.toggle.failed",
                        caught,
                        {
                            generation,
                            selection,
                            side: oldNewSide,
                            targetId,
                            bounds,
                            uuid,
                            viewerState: viewerState(toggleViewer),
                        },
                    );
                    setSelectionDiagnostic(
                        caught instanceof Error
                            ? caught.message
                            : "Focus failed",
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
        baseRevisionKey,
        compareRevisionKey,
        documentPath,
        oldNewSide,
        presentationMode,
        reviewGroups,
        selection,
        selectionKey,
        togglePageReady,
        toggleRevisionReady,
        toggleViewer,
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
        if (presentationMode === "old-new") {
            return toggleViewer ? [toggleViewer] : [];
        }
        return [baseViewer, compareViewer].filter(
            (viewer): viewer is ECadViewerElement => Boolean(viewer),
        );
    }, [
        baseViewer,
        compareViewer,
        compositeViewer,
        presentationMode,
        toggleViewer,
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
                : presentationMode === "old-new"
                    ? toggleRevisionReady
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
        toggleRevisionReady,
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
    const toggleError = lifecycle.toggle.error;
    const activeError =
        sourceError
        ?? (presentationMode === "composite"
            ? compositeError
            : presentationMode === "old-new"
                ? toggleError
                : sideError)
        ?? selectionDiagnostic;
    const bannerMessage = activeError ?? selectionNotice ?? oneSidedSheetNotice;
    const showBanner =
        Boolean(bannerMessage) && bannerMessage !== dismissedBanner;
    const bannerIsError = Boolean(activeError);
    const loading =
        baseSources.loading
        || compareSources.loading
        || (presentationMode === "composite"
            ? lifecycle.composite.phase !== "ready"
                && lifecycle.composite.phase !== "error"
            : presentationMode === "old-new"
                ? !toggleSettled || (toggleRevisionReady && !togglePageReady)
                : !sideSettled || (sideReady && !sidePageReady));
    const diagnostics =
        preparation?.diagnostics.length
        ?? documentDiff.diagnostics.length;

    // There is deliberately no `!activeDocument` branch here any more. That
    // asked the diff bundle whether this domain had changed, and replaced the
    // whole panel when it had not — so a PCB-only commit made the schematic
    // unopenable. Whether a document exists is a question about the revisions,
    // which is what the check below asks.
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

    return (
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-muted/20 px-3 py-2 text-xs">
                {presentationMode === "composite" ? (
                    <span className="mr-auto inline-flex items-center gap-3">
                        <ChangeStatusLegend />
                    </span>
                ) : presentationMode === "side-by-side" ? (
                    // Nothing to say here: the revision pair is already named in
                    // the workspace header directly above this bar.
                    <span className="mr-auto" />
                ) : (
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
                                onClick={() => {
                                    logComparisonDebug("control.old-new.click", {
                                        from: oldNewSide,
                                        to: "base",
                                        documentPath,
                                        selectionKey,
                                        viewerState: viewerState(toggleViewer),
                                    });
                                    setOldNewSide("base");
                                }}
                                aria-pressed={oldNewSide === "base"}
                            >
                                Old
                            </Button>
                            <Button
                                variant={oldNewSide === "compare" ? "secondary" : "ghost"}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                    logComparisonDebug("control.old-new.click", {
                                        from: oldNewSide,
                                        to: "compare",
                                        documentPath,
                                        selectionKey,
                                        viewerState: viewerState(toggleViewer),
                                    });
                                    setOldNewSide("compare");
                                }}
                                aria-pressed={oldNewSide === "compare"}
                            >
                                New
                            </Button>
                        </div>
                        <span className="mr-auto" />
                    </>
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
                    {mountedModesRef.current.has("composite") && (
                        <div
                            className={cn(
                                "absolute inset-0",
                                presentationMode !== "composite"
                                && "invisible pointer-events-none",
                            )}
                            aria-hidden={presentationMode !== "composite"}
                        >
                            <ComparisonViewerHost
                                key={compositeHostKey}
                                viewerKey={compositeHostKey}
                                active={presentationMode === "composite"}
                                onViewer={attachComposite}
                                onLayoutReady={markCompositeLayout}
                                viewportInsets={{ right: rightRailInset }}
                            />
                        </div>
                    )}

                    {mountedModesRef.current.has("side-by-side") && (
                        <div
                            className={cn(
                                "absolute inset-0 grid min-h-0 grid-cols-2 divide-x",
                                presentationMode !== "side-by-side"
                                && "invisible pointer-events-none",
                            )}
                            aria-hidden={presentationMode !== "side-by-side"}
                        >
                            <div className="relative flex min-h-0 min-w-0 flex-col">
                                <div className="shrink-0 border-b bg-muted/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Base
                                </div>
                                <div className="relative min-h-0 flex-1">
                                    <div
                                        className={cn(
                                            "absolute inset-0",
                                            !baseHasDocument
                                            && "invisible pointer-events-none",
                                        )}
                                        aria-hidden={!baseHasDocument}
                                    >
                                        <ComparisonViewerHost
                                            key={baseHostKey}
                                            viewerKey={baseHostKey}
                                            active={
                                                presentationMode === "side-by-side"
                                                && baseHasDocument
                                            }
                                            onViewer={attachBase}
                                            onLayoutReady={markBaseLayout}
                                        />
                                    </div>
                                    {!baseHasDocument && documentPath && (
                                        <MissingRevisionPane
                                            side="base"
                                            documentPath={documentPath}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="relative flex min-h-0 min-w-0 flex-col">
                                <div className="shrink-0 border-b bg-muted/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Compare
                                </div>
                                <div className="relative min-h-0 flex-1">
                                    <div
                                        className={cn(
                                            "absolute inset-0",
                                            !compareHasDocument
                                            && "invisible pointer-events-none",
                                        )}
                                        aria-hidden={!compareHasDocument}
                                    >
                                        <ComparisonViewerHost
                                            key={compareHostKey}
                                            viewerKey={compareHostKey}
                                            active={
                                                presentationMode === "side-by-side"
                                                && compareHasDocument
                                            }
                                            onViewer={attachCompare}
                                            onLayoutReady={markCompareLayout}
                                            viewportInsets={{ right: rightRailInset }}
                                        />
                                    </div>
                                    {!compareHasDocument && documentPath && (
                                        <MissingRevisionPane
                                            side="compare"
                                            documentPath={documentPath}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {mountedModesRef.current.has("old-new") && (
                        <div
                            className={cn(
                                "absolute inset-0",
                                presentationMode !== "old-new"
                                && "invisible pointer-events-none",
                            )}
                            aria-hidden={presentationMode !== "old-new"}
                        >
                            <div
                                className={cn(
                                    "absolute inset-0",
                                    (oldNewSide === "base"
                                        ? !baseHasDocument
                                        : !compareHasDocument)
                                    && "invisible pointer-events-none",
                                )}
                                aria-hidden={
                                    oldNewSide === "base"
                                        ? !baseHasDocument
                                        : !compareHasDocument
                                }
                            >
                                <ComparisonViewerHost
                                    key={toggleHostKey}
                                    viewerKey={toggleHostKey}
                                    active={
                                        presentationMode === "old-new"
                                        && (oldNewSide === "base"
                                            ? baseHasDocument
                                            : compareHasDocument)
                                    }
                                    onViewer={attachToggle}
                                    onLayoutReady={markToggleLayout}
                                    viewportInsets={{ right: rightRailInset }}
                                />
                            </div>
                            {documentPath
                                && !(oldNewSide === "base"
                                    ? baseHasDocument
                                    : compareHasDocument) && (
                                <MissingRevisionPane
                                    side={oldNewSide}
                                    documentPath={documentPath}
                                />
                            )}
                        </div>
                    )}

                    {(loading || selectionPending) && (
                        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                            <div className="inline-flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {loading
                                    ? presentationMode === "composite"
                                        ? "Preparing native comparison…"
                                        : presentationMode === "old-new"
                                            ? "Loading revision…"
                                            : "Loading side-by-side revisions…"
                                    : "Focusing change…"}
                            </div>
                        </div>
                    )}

                    {showBanner && bannerMessage && (
                        <div
                            className={cn(
                                "absolute inset-x-3 bottom-3 flex items-start gap-2 rounded border bg-background/95 p-3 text-xs shadow-sm",
                                bannerIsError
                                    ? "border-destructive/30 text-destructive"
                                    : "border-warning/30 text-warning text-warning",
                            )}
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1 break-words">
                                {bannerMessage}
                            </span>
                            <button
                                type="button"
                                className={cn(
                                    "shrink-0 rounded p-0.5 transition-colors",
                                    bannerIsError
                                        ? "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                                        : "text-warning/70 hover:bg-warning/10 hover:text-warning text-warning/70 hover:text-warning",
                                )}
                                aria-label="Dismiss warning"
                                onClick={() =>
                                    setDismissedBanner(bannerMessage)
                                }
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
                                ? <span className="rounded-full bg-muted px-1.5 text-[10px]">{discussionCount}</span>
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
