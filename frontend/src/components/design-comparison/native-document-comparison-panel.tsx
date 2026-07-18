import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AlertCircle, Layers3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
    ECadViewerElement,
    EcadDocumentComparisonPreparation,
    EcadPcbLayerState,
} from "@/types/ecad-viewer";
import type {
    ChangeItem,
    DesignCompareResult,
    KiCadDocumentDiff,
    KiCadProjectDiffBundle,
    SourceFileRef,
} from "./types";

type Domain = "schematic" | "pcb";
type ViewerBlobSource = { filename: string; content: string };

interface NativeDocumentComparisonPanelProps {
    projectId: string;
    domain: Domain;
    base: string;
    compare: string;
    documentDiff: KiCadProjectDiffBundle;
    files: DesignCompareResult["files"];
    selection: { kind: "item" | "group"; id: string } | null;
    reviewGroups: Array<{ id: string; changes: ChangeItem[] }>;
    initialVisibleLayers: string[];
    onVisibleLayersChange: (layers: string[]) => void;
}

const isAbortError = (error: unknown): boolean =>
    error instanceof DOMException && error.name === "AbortError";

function rootSchematicPath(files: SourceFileRef[]): string {
    const project = files.find((file) => file.path.endsWith(".kicad_pro"));
    if (project) {
        const expected = project.path.replace(/\.kicad_pro$/, ".kicad_sch");
        if (files.some((file) => file.path === expected)) return expected;
    }
    return files.find((file) => file.path.endsWith(".kicad_sch"))?.path
        ?? "root.kicad_sch";
}

function sourceNameForDomain(
    domain: Domain,
    files: SourceFileRef[],
): string {
    if (domain === "schematic") return rootSchematicPath(files);
    return files.find((file) => file.path.endsWith(".kicad_pcb"))?.path
        ?? "board.kicad_pcb";
}

function encodeAssetPath(path: string): string {
    return path
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
}

export function revisionSourceKey(
    projectId: string,
    commit: string,
    domain: Domain,
): string {
    return `${projectId}:${commit}:${domain}`;
}

function useRevisionSources(
    projectId: string,
    domain: Domain,
    commit: string,
    files: SourceFileRef[],
) {
    const [sources, setSources] = useState<ViewerBlobSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [resolvedKey, setResolvedKey] = useState<string | null>(null);
    const requestKey = revisionSourceKey(projectId, commit, domain);
    const rootName = useMemo(
        () => sourceNameForDomain(domain, files),
        [domain, files],
    );

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        setResolvedKey(null);
        setSources([]);
        setLoading(true);
        setError(null);

        void (async () => {
            try {
                const root = `/api/projects/${projectId}`;
                const query = `commit=${encodeURIComponent(commit)}`;
                const supportResponse = await fetch(
                    `${root}/viewer/support-files?${query}`,
                    { signal },
                );
                const support: ViewerBlobSource[] = supportResponse.ok
                    ? ((await supportResponse.json()) as {
                          files?: ViewerBlobSource[];
                      }).files ?? []
                    : [];
                const extension =
                    domain === "pcb" ? ".kicad_pcb" : ".kicad_sch";
                const sourcePaths = [...new Set(
                    files
                        .map((file) => file.path)
                        .filter((path) => path.endsWith(extension)),
                )];
                if (!sourcePaths.includes(rootName)) {
                    sourcePaths.unshift(rootName);
                }
                const settled = await Promise.allSettled(
                    sourcePaths.map(async (path) => {
                        const response = await fetch(
                            `${root}/asset/${encodeAssetPath(path)}?${query}`,
                            { signal },
                        );
                        if (!response.ok) {
                            throw new Error(
                                `${path} failed (${response.status})`,
                            );
                        }
                        return {
                            filename: path,
                            content: await response.text(),
                        };
                    }),
                );
                const collected = settled.flatMap((item) =>
                    item.status === "fulfilled" ? [item.value] : []
                );
                if (!collected.some((source) => source.filename === rootName)) {
                    const failure = settled[sourcePaths.indexOf(rootName)];
                    throw new Error(
                        failure?.status === "rejected"
                            && failure.reason instanceof Error
                            ? failure.reason.message
                            : `Revision does not contain ${rootName}`,
                    );
                }
                collected.push(...support);
                if (!signal.aborted) setSources(collected);
            } catch (caught) {
                if (!signal.aborted && !isAbortError(caught)) {
                    setError(
                        caught instanceof Error
                            ? caught.message
                            : "Failed to load revision",
                    );
                }
            } finally {
                if (!signal.aborted) {
                    setResolvedKey(requestKey);
                    setLoading(false);
                }
            }
        })();
        return () => controller.abort();
    }, [commit, domain, files, projectId, requestKey, rootName]);

    const isCurrent = resolvedKey === requestKey;
    return {
        sources: isCurrent ? sources : [],
        loading: loading || !isCurrent,
        error: isCurrent ? error : null,
    };
}

function selectedChanges(
    selection: NativeDocumentComparisonPanelProps["selection"],
    groups: NativeDocumentComparisonPanelProps["reviewGroups"],
): ChangeItem[] {
    if (!selection) return [];
    if (selection.kind === "group") {
        return (
            groups.find((group) => group.id === selection.id)?.changes ?? []
        );
    }
    return groups
        .flatMap((group) => group.changes)
        .filter((change) => change.id === selection.id);
}

export function resolveSelectedDocument(
    domain: Domain,
    documentDiff: KiCadProjectDiffBundle,
    changes: ChangeItem[],
): KiCadDocumentDiff | null {
    const expectedType = domain === "pcb" ? "kicad_pcb" : "kicad_sch";
    const selectedPath = changes
        .map((change) => documentDiff.navigation[change.id]?.documentPath)
        .find(Boolean);
    return (
        documentDiff.project.documents.find(
            (document) => document.path === selectedPath,
        )
        ?? documentDiff.project.documents.find(
            (document) => document.docType === expectedType,
        )
        ?? null
    );
}

export function resolveNativeSelection(
    preparation: EcadDocumentComparisonPreparation,
    documentDiff: KiCadProjectDiffBundle,
    selection: NativeDocumentComparisonPanelProps["selection"],
    changes: ChangeItem[],
): { kind: "change" | "group"; id: string } | null {
    const changeIds = changes
        .map((change) => documentDiff.navigation[change.id])
        .filter(
            (
                entry,
            ): entry is { documentPath: string; changeId: string } =>
                Boolean(
                    entry
                    && entry.documentPath === preparation.document.path,
                ),
        )
        .map((entry) => entry.changeId);
    if (!changeIds.length) return null;
    if (selection?.kind === "group") {
        const group = [...preparation.targets.values()].find(
            (target) =>
                target.kind === "group"
                && changeIds.every((id) => target.memberIds.includes(id)),
        );
        if (group) return { kind: "group", id: group.id };
    }
    return { kind: "change", id: changeIds[0]! };
}

export function NativeDocumentComparisonPanel({
    projectId,
    domain,
    base,
    compare,
    documentDiff,
    files,
    selection,
    reviewGroups,
    initialVisibleLayers,
    onVisibleLayersChange,
}: NativeDocumentComparisonPanelProps) {
    const [viewer, setViewer] = useState<ECadViewerElement | null>(null);
    const [preparation, setPreparation] =
        useState<EcadDocumentComparisonPreparation | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectionPending, setSelectionPending] = useState(false);
    const [selectionDiagnostic, setSelectionDiagnostic] =
        useState<string | null>(null);
    const [showLayers, setShowLayers] = useState(false);
    const [pcbLayers, setPcbLayers] = useState<EcadPcbLayerState[]>([]);
    const generationRef = useRef(0);
    const selectionRequestRef = useRef(0);
    const allChanges = useMemo(
        () => selectedChanges(selection, reviewGroups),
        [reviewGroups, selection],
    );
    const activeDocument = useMemo(
        () => resolveSelectedDocument(domain, documentDiff, allChanges),
        [allChanges, documentDiff, domain],
    );
    const referenceSources = useRevisionSources(
        projectId,
        domain,
        base,
        files.base,
    );
    const comparisonSources = useRevisionSources(
        projectId,
        domain,
        compare,
        files.head,
    );

    const attachViewer = useCallback((node: ECadViewerElement | null) => {
        setViewer(node);
    }, []);

    useLayoutEffect(() => {
        if (
            !viewer
            || !activeDocument
            || referenceSources.loading
            || comparisonSources.loading
            || !referenceSources.sources.length
            || !comparisonSources.sources.length
        ) {
            return;
        }
        const generation = ++generationRef.current;
        setError(null);
        setPreparation(null);
        void (async () => {
            try {
                await customElements.whenDefined("ecad-viewer");
                const next = await viewer.loadDocumentComparison({
                    comparisonKey: `${projectId}:${base}:${compare}:${domain}`,
                    reference: {
                        revisionKey: revisionSourceKey(
                            projectId,
                            base,
                            domain,
                        ),
                        sources: referenceSources.sources,
                    },
                    comparison: {
                        revisionKey: revisionSourceKey(
                            projectId,
                            compare,
                            domain,
                        ),
                        sources: comparisonSources.sources,
                    },
                    diff: documentDiff.project,
                    documentPath: activeDocument.path,
                });
                if (generation === generationRef.current) {
                    setPreparation(next);
                }
            } catch (caught) {
                if (generation === generationRef.current) {
                    setError(
                        caught instanceof Error
                            ? caught.message
                            : "Failed to prepare native comparison",
                    );
                }
            }
        })();
    }, [
        activeDocument,
        base,
        compare,
        comparisonSources.loading,
        comparisonSources.sources,
        documentDiff.project,
        domain,
        projectId,
        referenceSources.loading,
        referenceSources.sources,
        viewer,
    ]);

    useEffect(() => {
        if (!viewer || !preparation || !activeDocument) return;
        if (preparation.document.path !== activeDocument.path) return;
        const selectionRequest = ++selectionRequestRef.current;
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
        const generation = generationRef.current;
        setSelectionPending(true);
        setSelectionDiagnostic(null);
        void viewer
            .selectDocumentDiff(nativeSelection)
            .then((frame) => {
                if (
                    generation !== generationRef.current
                    || selectionRequest !== selectionRequestRef.current
                ) {
                    return;
                }
                if (frame.status === "missing") {
                    setSelectionDiagnostic(
                        "The selected native item could not be resolved.",
                    );
                }
                if (
                    frame.status === "applied"
                    && (frame.paintCount > 0 || frame.parserCount > 0)
                ) {
                    console.warn(
                        "[ecad-perf] warm selection violated retained-scene contract",
                        frame,
                    );
                }
            })
            .catch((caught) => {
                if (
                    generation === generationRef.current
                    && selectionRequest === selectionRequestRef.current
                ) {
                    setSelectionDiagnostic(
                        caught instanceof Error
                            ? caught.message
                            : "Selection failed",
                    );
                }
            })
            .finally(() => {
                if (
                    generation === generationRef.current
                    && selectionRequest === selectionRequestRef.current
                ) {
                    setSelectionPending(false);
                }
            });
    }, [
        activeDocument,
        allChanges,
        documentDiff,
        preparation,
        selection,
        viewer,
    ]);

    useEffect(() => {
        if (!viewer || domain !== "pcb" || !preparation) return;
        const refresh = () =>
            setPcbLayers(viewer.getPcbViewState?.()?.layers ?? []);
        if (initialVisibleLayers.length) {
            const visible = new Set(initialVisibleLayers);
            for (const layer of viewer.getPcbViewState?.()?.layers ?? []) {
                viewer.setPcbLayerVisibility?.(
                    layer.name,
                    visible.has(layer.name),
                );
            }
        }
        refresh();
        viewer.addEventListener("ecad-viewer:view-state-change", refresh);
        return () =>
            viewer.removeEventListener(
                "ecad-viewer:view-state-change",
                refresh,
            );
    }, [domain, initialVisibleLayers, preparation, viewer]);

    const toggleLayer = (name: string, visible: boolean) => {
        viewer?.setPcbLayerVisibility?.(name, visible);
        const next = pcbLayers.map((layer) =>
            layer.name === name ? { ...layer, visible } : layer,
        );
        setPcbLayers(next);
        onVisibleLayersChange(
            next.filter((layer) => layer.visible).map((layer) => layer.name),
        );
    };

    const loading =
        referenceSources.loading
        || comparisonSources.loading
        || (!preparation && !error);
    const sourceError = referenceSources.error ?? comparisonSources.error;
    const diagnostics =
        preparation?.diagnostics.length
        ?? documentDiff.diagnostics.length;

    return (
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-muted/20 px-3 py-2 text-xs">
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
                {domain === "pcb" && (
                    <Button
                        variant={showLayers ? "secondary" : "outline"}
                        size="sm"
                        className="h-8"
                        onClick={() => setShowLayers((value) => !value)}
                        aria-expanded={showLayers}
                    >
                        <Layers3 className="mr-2 h-3.5 w-3.5" />
                        Layers
                    </Button>
                )}
            </div>

            {showLayers && domain === "pcb" && (
                <div className="max-h-40 shrink-0 overflow-y-auto border-b bg-muted/10 px-3 py-2">
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {pcbLayers.map((layer) => (
                            <label
                                key={layer.name}
                                className="inline-flex items-center gap-2 text-xs"
                            >
                                <input
                                    type="checkbox"
                                    checked={layer.visible}
                                    onChange={(event) =>
                                        toggleLayer(
                                            layer.name,
                                            event.target.checked,
                                        )
                                    }
                                />
                                {layer.name}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="relative min-h-0 flex-1">
                {activeDocument ? (
                    <ecad-viewer
                        ref={attachViewer}
                        className="block h-full w-full"
                        show-header="false"
                        show-selection-panel="false"
                        source-mode="host"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                        No native {domain === "pcb" ? "PCB" : "schematic"}{" "}
                        document differences are available.
                    </div>
                )}

                {(loading || selectionPending) && activeDocument && (
                    <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                        <div className="inline-flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {loading
                                ? "Preparing native comparison…"
                                : "Focusing change…"}
                        </div>
                    </div>
                )}

                {(error || sourceError || selectionDiagnostic) && (
                    <div className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded border border-destructive/30 bg-background/95 p-3 text-xs text-destructive shadow-sm">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                            {error ?? sourceError ?? selectionDiagnostic}
                        </span>
                    </div>
                )}

                {!!diagnostics && !error && !sourceError && (
                    <div className="absolute bottom-3 right-3 rounded border bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
                        {diagnostics} unresolved native{" "}
                        {diagnostics === 1 ? "item" : "items"}
                    </div>
                )}
            </div>
        </section>
    );
}
