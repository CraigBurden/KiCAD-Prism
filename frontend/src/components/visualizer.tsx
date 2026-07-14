import { useEffect, useState, useCallback, useRef, useLayoutEffect, useMemo } from "react";
import { toast } from "sonner";
import { Cpu, Box, FileText, CircuitBoard, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EngineeringBomTable } from "./engineering-bom-table";
import { SelectionInspector } from "./selection-inspector";
import { WebGpu3dTab } from "./webgpu-3d-tab";
import { EcadViewerControls } from "./ecad-viewer-controls";
import { fetchApi, readApiError } from "@/lib/api";
import { canWriteCatalog } from "@/lib/roles";
import { crossProbeRequestForSelection, normalizeEcadSelection } from "@/lib/prism-selection";
import { usePrismCrossProbe } from "@/hooks/use-prism-cross-probe";
import type { User } from "@/types/auth";
import type { ECadViewerElement, EcadSemanticSelectionDetail } from "@/types/ecad-viewer";
import type { PrismSelection, PrismSemanticIndex } from "@/types/prism-selection";

interface VisualizerProps {
    projectId: string;
    user: User | null;
    commit?: string | null;
}

type VisualizerTab = "sch" | "pcb" | "3d" | "bom" | "assembly";

const isAbortError = (error: unknown): boolean =>
    error instanceof DOMException && error.name === "AbortError";

type ViewerBlobSource = {
    filename: string;
    content: string;
};

const buildViewerKey = (
    kind: "schematic" | "pcb",
    projectId: string,
    commit: string | null | undefined,
) => `${kind}:${projectId}:${commit ?? "latest"}`;

type EcadViewerHostProps = {
    viewerKey: string;
    sources: ViewerBlobSource[];
    active: boolean;
    setViewerRef: (node: ECadViewerElement | null) => void;
};

function EcadViewerHost({ viewerKey, sources, active, setViewerRef }: EcadViewerHostProps) {
    const hostRef = useRef<ECadViewerElement | null>(null);
    const replaceReadyRef = useRef<Promise<void>>(Promise.resolve());
    const rootSource = sources[0];
    const appendedSources = useMemo(() => sources.slice(1), [sources]);

    const attachViewerRef = useCallback((node: ECadViewerElement | null) => {
        hostRef.current = node;
        setViewerRef(node);
    }, [setViewerRef]);

    useLayoutEffect(() => {
        const viewer = hostRef.current;
        if (!viewer || !rootSource) return;

        let cancelled = false;

        const replaceRoot = async () => {
            await customElements.whenDefined("ecad-viewer");
            if (cancelled || !hostRef.current) return;
            await hostRef.current.replaceSources({
                revisionKey: viewerKey,
                sources: [rootSource],
            });
        };

        replaceReadyRef.current = replaceRoot();

        return () => {
            cancelled = true;
        };
    }, [rootSource, viewerKey]);

    useEffect(() => {
        if (!appendedSources.length) return;
        let cancelled = false;
        const appendRemainingSources = async () => {
            await replaceReadyRef.current;
            if (cancelled || !hostRef.current) return;
            await hostRef.current.appendSources({
                revisionKey: viewerKey,
                sources: appendedSources,
            });
        };
        void appendRemainingSources();
        return () => { cancelled = true; };
    }, [appendedSources, viewerKey]);

    useEffect(() => {
        let cancelled = false;
        void customElements.whenDefined("ecad-viewer").then(() => {
            if (!cancelled) hostRef.current?.setActive(active);
        });
        return () => { cancelled = true; };
    }, [active]);

    return (
        <ecad-viewer
            ref={attachViewerRef}
            style={{ width: "100%", height: "100%" }}
            show-header="false"
            show-selection-panel="false"
        />
    );
}

export function Visualizer({ projectId, user, commit }: VisualizerProps) {
    const [schematicViewerElement, setSchematicViewerElement] = useState<ECadViewerElement | null>(null);
    const [pcbViewerElement, setPcbViewerElement] = useState<ECadViewerElement | null>(null);
    const schematicViewerRef = useRef<ECadViewerElement | null>(null);
    const pcbViewerRef = useRef<ECadViewerElement | null>(null);

    // Callback refs to sync state and refs
    const setSchematicViewerRef = useCallback((node: ECadViewerElement | null) => {
        schematicViewerRef.current = node;
        setSchematicViewerElement(node);
    }, []);

    const setPcbViewerRef = useCallback((node: ECadViewerElement | null) => {
        pcbViewerRef.current = node;
        setPcbViewerElement(node);
    }, []);

    const [activeTab, setActiveTab] = useState<VisualizerTab>("sch");
    const [threeDActivated, setThreeDActivated] = useState(false);
    const [schematicContent, setSchematicContent] = useState<string | null>(null);
    const [subsheets, setSubsheets] = useState<{ filename: string, content: string }[]>([]);
    const [viewerSupportFiles, setViewerSupportFiles] = useState<ViewerBlobSource[]>([]);
    const [pcbContent, setPcbContent] = useState<string | null>(null);
    const [ibomUrl, setIbomUrl] = useState<string | null>(null);
    const [schematicContentLoaded, setSchematicContentLoaded] = useState(false);
    const [pcbContentLoaded, setPcbContentLoaded] = useState(false);
    const [semanticIndex, setSemanticIndex] = useState<PrismSemanticIndex | null>(null);
    const [semanticIndexLoading, setSemanticIndexLoading] = useState(true);
    const [semanticIndexError, setSemanticIndexError] = useState<string | null>(null);
    const [semanticIndexRetryToken, setSemanticIndexRetryToken] = useState(0);
    const [selectionInspectorOpen, setSelectionInspectorOpen] = useState(false);
    const [componentImportPending, setComponentImportPending] = useState(false);

    const {
        selection: globalSelection,
        select: selectGlobal,
        clear: clearGlobalSelection,
        registerClient,
    } = usePrismCrossProbe(semanticIndex);
    const canImportLibraryComponent = canWriteCatalog(user?.role);

    const handleImportSelectedComponent = useCallback(async () => {
        if (!globalSelection || globalSelection.kind === "net" || componentImportPending) return;
        setComponentImportPending(true);
        try {
            const isComponent = globalSelection.kind === "component";
            const response = await fetchApi("/api/catalog/import-sessions/projects", {
                method: "POST",
                body: JSON.stringify({
                    scope: "component",
                    project_id: projectId,
                    source_revision: commit || "",
                    selection: {
                        component_uid: globalSelection.componentUid || "",
                        reference: globalSelection.reference,
                        schematic_uuid: isComponent && globalSelection.sourceContext === "SCH"
                            ? globalSelection.uuid || globalSelection.anchor?.uuid || ""
                            : "",
                        pcb_footprint_uuid: isComponent && globalSelection.sourceContext === "PCB"
                            ? globalSelection.uuid || globalSelection.anchor?.uuid || ""
                            : "",
                    },
                }),
            });
            if (!response.ok) throw new Error(await readApiError(response, "Failed to stage component import"));
            const session = await response.json() as { id: string };
            toast.success(`${globalSelection.reference} queued for Library Manager import`, {
                action: {
                    label: "Open Import Center",
                    onClick: () => window.location.assign(`/?section=library-manager&libraryView=imports&session=${encodeURIComponent(session.id)}`),
                },
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to stage component import");
        } finally {
            setComponentImportPending(false);
        }
    }, [commit, componentImportPending, globalSelection, projectId]);

    const appendCommit = useCallback((url: string) => {
        if (!commit) return url;
        return `${url}${url.includes("?") ? "&" : "?"}commit=${encodeURIComponent(commit)}`;
    }, [commit]);

    // Initial Data Fetch
    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        const fetchData = async () => {
            const baseUrl = `/api/projects/${projectId}`;

            try {
                const [ibomRes, supportRes] = await Promise.all([
                    fetch(appendCommit(`${baseUrl}/ibom`), { signal }),
                    fetch(appendCommit(`${baseUrl}/viewer/support-files`), { signal }),
                ]);

                if (ibomRes.ok) {
                    setIbomUrl(appendCommit(`${baseUrl}/ibom`));
                } else {
                    setIbomUrl(null);
                }
                if (supportRes.ok) {
                    const payload = await supportRes.json() as { files?: ViewerBlobSource[] };
                    setViewerSupportFiles(payload.files ?? []);
                } else {
                    setViewerSupportFiles([]);
                }

            } catch (err) {
                if (!isAbortError(err)) {
                    console.error("Error loading visualizer data", err);
                }
            } finally {
                // SCH/PCB source loading is intentionally independent of these helpers.
            }
        };

        void fetchData();
        return () => controller.abort();
    }, [projectId, appendCommit]);

    useEffect(() => {
        if (semanticIndex) return;
        const controller = new AbortController();
        setSemanticIndexLoading(true);
        setSemanticIndexError(null);
        // The compact identity artifact is generated independently from 3D
        // assets and loaded in the background. It never gates SCH/PCB source
        // rendering, but is ready before the first normal selection whenever
        // generation completes quickly.
        fetch(appendCommit(`/api/projects/${projectId}/semantic-index/identity`), {
            signal: controller.signal,
            credentials: "include",
        })
            .then(async (response) => {
                if (!response.ok) {
                    const payload = await response.json().catch(() => null) as { detail?: string } | null;
                    throw new Error(payload?.detail || "Semantic identity index is unavailable");
                }
                return response.json() as Promise<PrismSemanticIndex>;
            })
            .then((payload) => {
                if (!controller.signal.aborted) setSemanticIndex(payload);
            })
            .catch((error: unknown) => {
                if (!isAbortError(error) && !controller.signal.aborted) {
                    setSemanticIndexError(error instanceof Error ? error.message : "Semantic identity index is unavailable");
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setSemanticIndexLoading(false);
            });
        return () => controller.abort();
    }, [appendCommit, projectId, semanticIndex, semanticIndexRetryToken]);

    const generateSemanticIdentity = useCallback(async () => {
        setSemanticIndexLoading(true);
        setSemanticIndexError(null);
        try {
            const response = await fetchApi(`/api/projects/${projectId}/semantic-index/generate`, {
                method: "POST",
                body: JSON.stringify({ commit: commit ?? null, force: false }),
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, "Failed to generate semantic identity index"));
            }
            setSemanticIndexRetryToken((token) => token + 1);
        } catch (error) {
            setSemanticIndexError(error instanceof Error ? error.message : "Failed to generate semantic identity index");
            setSemanticIndexLoading(false);
        }
    }, [commit, projectId]);

    // Lazy load schematic content when schematic tab is first accessed
    useEffect(() => {
        if (activeTab === "sch" && !schematicContentLoaded) {
            const controller = new AbortController();
            const signal = controller.signal;

            const loadSchematic = async () => {
                try {
                    const baseUrl = `/api/projects/${projectId}`;

                    const [schRes, subsheetsRes] = await Promise.allSettled([
                        fetch(appendCommit(`${baseUrl}/schematic`), { signal }),
                        fetch(appendCommit(`${baseUrl}/schematic/subsheets`), { signal })
                    ]);

                    // Handle Schematic
                    if (schRes.status === "fulfilled" && schRes.value.ok) {
                        const schematicText = await schRes.value.text();
                        if (signal.aborted) return;
                        setSchematicContent(schematicText);
                    } else {
                        console.error("Schematic not found");
                        setSchematicContent(null);
                    }

                    // Handle Subsheets
                    if (subsheetsRes.status === "fulfilled" && subsheetsRes.value.ok) {
                        const data = await subsheetsRes.value.json();
                        if (signal.aborted) return;
                        if (data.files?.length) {
                            const subsheetResults = await Promise.allSettled(data.files.map(async (f: any) => {
                                const cRes = await fetch(f.url, { signal });
                                if (!cRes.ok) {
                                    throw new Error(`Failed to load subsheet: ${f.url}`);
                                }
                                let filename = f.name || f.path || f.url.split("/")?.pop() || "subsheet.kicad_sch";
                                if (!filename.endsWith('.kicad_sch')) filename += '.kicad_sch';
                                if (!filename.includes("/") && f.url.includes("Subsheets")) filename = `Subsheets/${filename}`;
                                return { filename, content: await cRes.text() };
                            }));

                            if (signal.aborted) return;

                            const loadedSubsheets = subsheetResults
                                .filter((result): result is PromiseFulfilledResult<{ filename: string; content: string }> => result.status === "fulfilled")
                                .map((result) => result.value);
                            setSubsheets(loadedSubsheets);

                            subsheetResults
                                .filter((result): result is PromiseRejectedResult => result.status === "rejected")
                                .forEach((result) => {
                                    console.warn("Failed to load one subsheet", result.reason);
                                });
                        }
                    } else {
                        setSubsheets([]);
                    }
                } catch (err) {
                    if (!isAbortError(err)) {
                        console.error("Error loading schematic content", err);
                    }
                } finally {
                    if (!signal.aborted) {
                        setSchematicContentLoaded(true);
                    }
                }
            };

            void loadSchematic();
            return () => controller.abort();
        }
    }, [activeTab, schematicContentLoaded, projectId, appendCommit]);

    // Lazy load PCB content when PCB tab is first accessed
    useEffect(() => {
        if (activeTab === "pcb" && !pcbContentLoaded) {
            const controller = new AbortController();
            const signal = controller.signal;

            const loadPcb = async () => {
                try {
                    const baseUrl = `/api/projects/${projectId}`;
                    const pcbRes = await fetch(appendCommit(`${baseUrl}/pcb`), { signal });

                    if (pcbRes.ok) {
                        const pcbText = await pcbRes.text();
                        if (signal.aborted) return;
                        setPcbContent(pcbText);
                    } else {
                        console.error("PCB not found");
                        setPcbContent(null);
                    }
                } catch (err) {
                    if (!isAbortError(err)) {
                        console.error("Error loading PCB content", err);
                    }
                } finally {
                    if (!signal.aborted) {
                        setPcbContentLoaded(true);
                    }
                }
            };

            void loadPcb();
            return () => controller.abort();
        }
    }, [activeTab, pcbContentLoaded, projectId, appendCommit]);

    // Reset lazy loading flags when project changes
    useEffect(() => {
        setSchematicContentLoaded(false);
        setPcbContentLoaded(false);
        setSchematicContent(null);
        setSubsheets([]);
        setViewerSupportFiles([]);
        setPcbContent(null);
        setIbomUrl(null);
        setSemanticIndex(null);
        setSemanticIndexLoading(true);
        setSemanticIndexError(null);
        setSelectionInspectorOpen(false);
        setThreeDActivated(false);
        clearGlobalSelection();
    }, [clearGlobalSelection, commit, projectId]);

    useEffect(() => {
        if (activeTab === "3d") setThreeDActivated(true);
    }, [activeTab]);

    useEffect(() => {
        const schematicViewer = schematicViewerElement;
        const pcbViewer = pcbViewerElement;
        if (!schematicViewer && !pcbViewer) return;

        const handleSelection = (event: Event) => {
            const detail = (event as CustomEvent<EcadSemanticSelectionDetail>).detail;
            const normalized = normalizeEcadSelection(
                detail,
                semanticIndex?.sourceRevisionKey ?? commit ?? undefined,
            );
            if (normalized) selectGlobal(normalized);
        };

        schematicViewer?.addEventListener("ecad-viewer:selection", handleSelection as EventListener);
        pcbViewer?.addEventListener("ecad-viewer:selection", handleSelection as EventListener);

        return () => {
            schematicViewer?.removeEventListener("ecad-viewer:selection", handleSelection as EventListener);
            pcbViewer?.removeEventListener("ecad-viewer:selection", handleSelection as EventListener);
        };
    }, [clearGlobalSelection, commit, pcbViewerElement, schematicViewerElement, selectGlobal, semanticIndex?.sourceRevisionKey]);

    useEffect(() => {
        const applySelection = (
            viewer: ECadViewerElement | null,
            targetContext: "SCH" | "PCB",
            selection: PrismSelection | null,
        ) => {
            if (!viewer) return;
            if (!selection) {
                viewer.clearSelection();
                return;
            }
            // Keep ecad-viewer cross-probing component-focused. Net selections
            // still flow through the Visualizer bus to the semantic sidebar and
            // 3D viewer, but compiling a whole schematic/PCB net highlight here
            // is expensive and duplicates the 3D isolation workflow.
            if (selection.kind === "net") {
                viewer.clearSelection();
                return;
            }
            if (typeof viewer.requestCrossProbe !== "function") return;
            const request = crossProbeRequestForSelection(selection, targetContext, semanticIndex);
            const resolved = viewer.requestCrossProbe(request);
            if (!resolved && selection.kind === "terminal") {
                viewer.requestCrossProbe({
                    sourceContext: selection.sourceContext,
                    targetContext,
                    mode: "select",
                    kind: "designator",
                    value: selection.reference,
                    designator: selection.reference,
                    pin: selection.pin,
                });
            }
        };

        const unregisterSchematic = registerClient({
            id: "visualizer-schematic",
            context: "SCH",
            revisionKey: semanticIndex?.sourceRevisionKey ?? commit ?? undefined,
            isReady: () => Boolean(schematicViewerRef.current && schematicContent),
            applySelection: (selection) => applySelection(schematicViewerRef.current, "SCH", selection),
        });
        const unregisterPcb = registerClient({
            id: "visualizer-pcb",
            context: "PCB",
            revisionKey: semanticIndex?.sourceRevisionKey ?? commit ?? undefined,
            isReady: () => Boolean(pcbViewerRef.current && pcbContent),
            applySelection: (selection) => applySelection(pcbViewerRef.current, "PCB", selection),
        });
        return () => {
            unregisterSchematic();
            unregisterPcb();
        };
    }, [commit, pcbContent, pcbViewerElement, registerClient, schematicContent, schematicViewerElement, semanticIndex]);

    useEffect(() => {
        if (globalSelection) setSelectionInspectorOpen(true);
    }, [globalSelection]);

    useEffect(() => {
        const handleKeyboard = (event: KeyboardEvent) => {
            const target = event.target;
            const openDialog = document.querySelector('[role="dialog"][data-state="open"]');
            if (event.defaultPrevented || (openDialog && target instanceof Node && openDialog.contains(target))) return;
            if (
                target instanceof HTMLInputElement
                || target instanceof HTMLTextAreaElement
                || (target instanceof HTMLElement && target.isContentEditable)
            ) return;

            if (event.key === "Escape") {
                clearGlobalSelection();
                setSelectionInspectorOpen(false);
                return;
            }
            if (activeTab === "sch") {
                const bracketDirection = event.key === "[" || event.code === "BracketLeft"
                    ? -1
                    : event.key === "]" || event.code === "BracketRight"
                        ? 1
                        : null;
                if (bracketDirection) {
                    const handled = schematicViewerRef.current?.navigateSchematicPage?.(
                        bracketDirection,
                    );
                    if (handled) event.preventDefault();
                    return;
                }
                // macOS reports Option+Delete inconsistently across browsers:
                // usually Backspace, occasionally Delete or a legacy keyCode.
                const parentShortcut = event.getModifierState("Alt") && (
                    event.key === "Backspace"
                    || event.key === "Delete"
                    || event.key === "Del"
                    || event.code === "Backspace"
                    || event.code === "Delete"
                    || event.keyCode === 8
                    || event.keyCode === 46
                );
                if (parentShortcut) {
                    const handled = schematicViewerRef.current?.navigateSchematicParent?.();
                    if (handled) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                    }
                    return;
                }
            }
        };
        // Capture before the embedded canvas can consume bracket/backspace keys.
        // ecad-viewer still receives every key Prism does not handle.
        window.addEventListener("keydown", handleKeyboard, true);
        return () => window.removeEventListener("keydown", handleKeyboard, true);
    }, [activeTab, clearGlobalSelection]);

    const schematicRootSource = useMemo<ViewerBlobSource | null>(
        () => (schematicContent ? { filename: "root.kicad_sch", content: schematicContent } : null),
        [schematicContent],
    );
    const schematicSources = useMemo<ViewerBlobSource[]>(
        () => (schematicRootSource ? [schematicRootSource, ...viewerSupportFiles, ...subsheets] : []),
        [schematicRootSource, subsheets, viewerSupportFiles],
    );
    const pcbSources = useMemo<ViewerBlobSource[]>(
        () => (pcbContent
            ? [{ filename: "board.kicad_pcb", content: pcbContent }, ...viewerSupportFiles]
            : []),
        [pcbContent, viewerSupportFiles],
    );
    const schematicViewerKey = buildViewerKey("schematic", projectId, commit);
    const pcbViewerKey = buildViewerKey("pcb", projectId, commit);

    // Tab Config
    const tabs: { id: VisualizerTab; label: string; icon: any }[] = [
        { id: "sch", label: "Schematic", icon: Cpu },
        { id: "pcb", label: "PCB", icon: CircuitBoard },
        { id: "3d", label: "3D", icon: Box },
        { id: "bom", label: "BOM", icon: FileText },
        { id: "assembly", label: "Assembly Assistant", icon: PackageCheck },
    ];

    return (
        <div className="relative flex h-full min-h-0 flex-col bg-background">
            {/* Toolbar */}
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b bg-muted/20 px-2 py-1">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <Button
                            key={tab.id}
                            variant={activeTab === tab.id ? "secondary" : "ghost"}
                            size="sm"
                            data-visualizer-tab={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="text-xs h-8"
                        >
                            <Icon className="w-3 h-3 mr-2" />
                            {tab.label}
                        </Button>
                    );
                })}
                <div className="flex-1" />
            </div>

            {/* Content Area */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="relative min-w-0 flex-1 overflow-hidden">
                    {/* Schematic View - always mounted after first visit */}
                    <div aria-hidden={activeTab !== "sch"} className={`absolute inset-0 z-10 transition-opacity duration-200 ${activeTab === "sch" ? "visible pointer-events-auto opacity-100" : "invisible pointer-events-none opacity-0"}`}>
                        {schematicContentLoaded ? (
                            schematicSources.length > 0 ? (
                                <div className="flex h-full min-w-0">
                                    <EcadViewerControls context="SCH" viewer={schematicViewerElement} />
                                    <div className="min-w-0 flex-1">
                                        <EcadViewerHost
                                            viewerKey={schematicViewerKey}
                                            sources={schematicSources}
                                            active={activeTab === "sch"}
                                            setViewerRef={setSchematicViewerRef}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground">
                                    <p>No schematic files found.</p>
                                </div>
                            )
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                                <p>Loading schematic…</p>
                            </div>
                        )}
                    </div>

                    {/* PCB View - always mounted after first visit */}
                    <div aria-hidden={activeTab !== "pcb"} className={`absolute inset-0 z-10 transition-opacity duration-200 ${activeTab === "pcb" ? "visible pointer-events-auto opacity-100" : "invisible pointer-events-none opacity-0"}`}>
                        {pcbContentLoaded ? (
                            pcbSources.length > 0 ? (
                                <div className="flex h-full min-w-0">
                                    <EcadViewerControls context="PCB" viewer={pcbViewerElement} />
                                    <div className="min-w-0 flex-1">
                                        <EcadViewerHost
                                            viewerKey={pcbViewerKey}
                                            sources={pcbSources}
                                            active={activeTab === "pcb"}
                                            setViewerRef={setPcbViewerRef}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground">
                                    <p>No PCB files found.</p>
                                </div>
                            )
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                                <p>Open the PCB tab to load the board source.</p>
                            </div>
                        )}
                    </div>

                    {threeDActivated && (
                        <div aria-hidden={activeTab !== "3d"} className={`absolute inset-0 bg-background transition-opacity duration-200 ${activeTab === "3d" ? "visible z-20 pointer-events-auto opacity-100" : "invisible z-0 pointer-events-none opacity-0"}`}>
                            <WebGpu3dTab
                                projectId={projectId}
                                commit={commit}
                                user={user}
                                active={activeTab === "3d"}
                                selection={globalSelection}
                                onSelection={selectGlobal}
                                onClearSelection={clearGlobalSelection}
                            />
                        </div>
                    )}

                    {activeTab === "bom" && (
                        <div className="absolute inset-0 z-20 bg-background">
                            <EngineeringBomTable
                                semanticIndex={semanticIndex}
                                loading={semanticIndexLoading}
                                error={semanticIndexError}
                                selection={globalSelection}
                                onSelection={selectGlobal}
                                onRetry={() => void generateSemanticIdentity()}
                            />
                        </div>
                    )}

                    {activeTab === "assembly" && (
                        <div className="absolute inset-0 z-20 bg-background">
                            {ibomUrl ? (
                                <iframe
                                    title="Assembly Assistant"
                                    src={ibomUrl}
                                    className="h-full w-full border-0 bg-background"
                                    sandbox="allow-scripts allow-same-origin allow-downloads"
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
                                    No interactive assembly HTML was found for this revision.
                                </div>
                            )}
                        </div>
                    )}

                </div>
                <SelectionInspector
                    open={selectionInspectorOpen}
                    selection={globalSelection}
                    semanticIndex={semanticIndex}
                    onOpenChange={setSelectionInspectorOpen}
                    onClear={clearGlobalSelection}
                    onImportComponent={globalSelection?.kind === "net" ? undefined : handleImportSelectedComponent}
                    canImportComponent={canImportLibraryComponent}
                    importingComponent={componentImportPending}
                />
            </div>
        </div>
    );
}
