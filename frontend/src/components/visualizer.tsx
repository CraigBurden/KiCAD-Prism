import { useEffect, useState, useCallback, useRef, useLayoutEffect, useMemo } from "react";
import { toast } from "sonner";
import { Cpu, Box, FileText, CircuitBoard, PackageCheck, MessageSquare, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EngineeringBomTable } from "./engineering-bom-table";
import { SelectionInspector } from "./selection-inspector";
import { WebGpu3dTab } from "./webgpu-3d-tab";
import { EcadViewerControls } from "./ecad-viewer-controls";
import { CommentForm } from "./comment-form";
import { CommentCard } from "./comment-card";
import { CommentPanel } from "./comment-panel";
import { fetchApi, readApiError } from "@/lib/api";
import { canWriteCatalog } from "@/lib/roles";
import { crossProbeRequestForSelection, normalizeEcadSelection } from "@/lib/prism-selection";
import { usePrismCrossProbe } from "@/hooks/use-prism-cross-probe";
import type { User } from "@/types/auth";
import type {
    ECadViewerElement,
    EcadCommentAreaDetail,
    EcadOverlayAnchor,
    EcadOverlayHitDetail,
    EcadOverlayPrimitive,
    EcadSemanticSelectionDetail,
} from "@/types/ecad-viewer";
import type { PrismSelection, PrismSemanticIndex } from "@/types/prism-selection";
import type { Comment, CommentContext, CommentLocation, CommentsFile } from "@/types/comments";

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

type EcadViewerWithLegacyLoader = ECadViewerElement & {
    loaded?: boolean;
    load_src?: () => Promise<void>;
};

let ecadViewerLoadSrcGuardInstalled = false;

function ecadViewerHasDomSources(viewer: ECadViewerElement): boolean {
    for (const node of viewer.querySelectorAll("ecad-source")) {
        const source = node as HTMLElement & { src?: string };
        if (source.src) return true;
    }
    for (const node of viewer.querySelectorAll("ecad-blob")) {
        const blob = node as HTMLElement & { filename?: string; content?: string };
        if (blob.filename || blob.content) return true;
    }
    return false;
}

function installEcadViewerLoadSrcGuard(): void {
    if (ecadViewerLoadSrcGuardInstalled) return;
    const ctor = customElements.get("ecad-viewer") as (CustomElementConstructor & {
        prototype: EcadViewerWithLegacyLoader;
    }) | undefined;
    if (!ctor?.prototype.load_src) return;

    ecadViewerLoadSrcGuardInstalled = true;
    const originalLoadSrc = ctor.prototype.load_src;
    ctor.prototype.load_src = async function loadSrcGuard(this: EcadViewerWithLegacyLoader) {
        const windowWithLegacyUrls = window as Window & {
            design_urls?: unknown;
            zip_url?: unknown;
        };
        if (windowWithLegacyUrls.design_urls || windowWithLegacyUrls.zip_url) {
            return originalLoadSrc.call(this);
        }
        if (!ecadViewerHasDomSources(this) && this.loaded) {
            return;
        }
        return originalLoadSrc.call(this);
    };
}

interface PendingCommentElement {
    elementId?: string;
    elementRef?: string;
    elementType?: string;
}

const COMMENTS_OVERLAY_CHANNEL = "comments";

function applyCommentMode(viewer: ECadViewerElement | null, enabled: boolean): void {
    if (!viewer) return;
    viewer.setCommentMode?.(enabled);
    if (enabled) {
        viewer.setAttribute("comment-mode", "true");
    } else {
        viewer.removeAttribute("comment-mode");
    }
}

function worldToViewportScreen(
    viewer: ECadViewerElement | null,
    x: number,
    y: number,
): { x: number; y: number } | null {
    if (!viewer) return null;
    const local = viewer.getScreenLocation(x, y);
    if (!local) return null;
    const rect = viewer.getBoundingClientRect();
    return { x: rect.left + local.x, y: rect.top + local.y };
}

function publishCommentsOverlay(
    viewer: ECadViewerElement | null,
    context: CommentContext,
    comments: Comment[],
    activePage?: string | null,
): void {
    if (!viewer) return;

    const filtered = comments.filter((comment) => {
        if (comment.context !== context) return false;
        if (context === "SCH" && activePage && comment.location.page) {
            return comment.location.page === activePage;
        }
        return true;
    });

    const primitives: EcadOverlayPrimitive[] = [];
    for (const comment of filtered) {
        const page = comment.location.page;
        const anchor: EcadOverlayAnchor = comment.elementId
            ? { kind: "source-item", uuid: comment.elementId, page }
            : { kind: "world", x: comment.location.x, y: comment.location.y, page };

        primitives.push({
            id: comment.id,
            kind: "marker",
            anchor,
            glyph: "comment",
            sizing: "screen",
            radius: 10,
            fill: "#facc1580",
            stroke: "#ca8a04",
            interactive: true,
            metadata: { commentId: comment.id },
            accessibilityLabel: comment.content.slice(0, 80),
        });

                if (comment.location.bounds) {
            primitives.push({
                id: `${comment.id}-area`,
                kind: "bbox",
                anchor: { kind: "bbox", bounds: comment.location.bounds, page },
                stroke: "#ca8a04",
                dash: [2, 1.5],
                strokeWidth: 0.15,
                interactive: true,
                metadata: { commentId: comment.id },
                sizing: "world",
            });
        }
    }

    viewer.setOverlayScene(COMMENTS_OVERLAY_CHANNEL, {
        context,
        placement: "foreground",
        visible: true,
        primitives,
    });
}

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
            installEcadViewerLoadSrcGuard();
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

    useEffect(() => {
        void customElements.whenDefined("ecad-viewer").then(() => {
            installEcadViewerLoadSrcGuard();
        });
    }, []);

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
    const [activeSchematicPage, setActiveSchematicPage] = useState<string | null>(null);

    // Comment collaboration state
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentMode, setCommentMode] = useState(false);
    const [showCommentForm, setShowCommentForm] = useState(false);
    const [showCommentPanel, setShowCommentPanel] = useState(false);
    const [pendingLocation, setPendingLocation] = useState<CommentLocation | null>(null);
    const [pendingContext, setPendingContext] = useState<CommentContext | null>(null);
    const [pendingElement, setPendingElement] = useState<PendingCommentElement | null>(null);
    const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
    const [commentCardScreenPosition, setCommentCardScreenPosition] = useState<{ x: number; y: number } | null>(null);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const lastSelectionRef = useRef<EcadSemanticSelectionDetail | null>(null);

    const {
        selection: globalSelection,
        select: selectGlobal,
        clear: clearGlobalSelection,
        registerClient,
    } = usePrismCrossProbe(semanticIndex);
    const canImportLibraryComponent = canWriteCatalog(user?.role);
    const canModifyComments = user?.role === "admin" || user?.role === "designer";

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
                const [ibomRes, supportRes, commentsRes] = await Promise.all([
                    fetch(appendCommit(`${baseUrl}/ibom`), { signal }),
                    fetch(appendCommit(`${baseUrl}/viewer/support-files`), { signal }),
                    fetchApi(`${baseUrl}/comments`, { signal }),
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
                if (commentsRes.ok) {
                    const payload = await commentsRes.json() as CommentsFile;
                    setComments(payload.comments ?? []);
                } else {
                    setComments([]);
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
        setComments([]);
        setCommentMode(false);
        setShowCommentForm(false);
        setPendingLocation(null);
        setPendingContext(null);
        setPendingElement(null);
        setSelectedCommentId(null);
        setCommentCardScreenPosition(null);
        lastSelectionRef.current = null;
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
            lastSelectionRef.current = detail;
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

    // Track the active schematic page so comment overlay filtering can match
    // comments to the currently visible sheet.
    useEffect(() => {
        const viewer = schematicViewerElement;
        if (!viewer) {
            setActiveSchematicPage(null);
            return;
        }
        const refresh = () => {
            const active = viewer.getActiveSchematicPage?.();
            setActiveSchematicPage(active?.filename ?? active?.page ?? null);
        };
        refresh();
        viewer.addEventListener("ecad-viewer:view-state-change", refresh);
        return () => viewer.removeEventListener("ecad-viewer:view-state-change", refresh);
    }, [schematicViewerElement]);

    // Publish comment markers to the ecad-viewer overlay layer. This never
    // touches replaceSources/appendSources - overlays are a separate render pass.
    useEffect(() => {
        if (activeTab === "sch") {
            publishCommentsOverlay(schematicViewerElement, "SCH", comments, activeSchematicPage);
            pcbViewerElement?.clearOverlayScene(COMMENTS_OVERLAY_CHANNEL);
        } else if (activeTab === "pcb") {
            publishCommentsOverlay(pcbViewerElement, "PCB", comments);
            schematicViewerElement?.clearOverlayScene(COMMENTS_OVERLAY_CHANNEL);
        } else {
            schematicViewerElement?.clearOverlayScene(COMMENTS_OVERLAY_CHANNEL);
            pcbViewerElement?.clearOverlayScene(COMMENTS_OVERLAY_CHANNEL);
        }
    }, [activeTab, activeSchematicPage, comments, pcbViewerElement, schematicViewerElement]);

    // Mirror comment mode onto whichever viewer is currently active.
    useEffect(() => {
        applyCommentMode(schematicViewerElement, commentMode && activeTab === "sch");
        applyCommentMode(pcbViewerElement, commentMode && activeTab === "pcb");
    }, [activeTab, commentMode, pcbViewerElement, schematicViewerElement]);

    const openCommentCardForOverlayHit = useCallback((event: Event) => {
        const detail = (event as CustomEvent<EcadOverlayHitDetail>).detail;
        if (detail.channelId !== COMMENTS_OVERLAY_CHANNEL) return;
        const metadata = detail.metadata as { commentId?: string } | null | undefined;
        const commentId = metadata?.commentId ?? detail.primitiveId.replace(/-area$/, "");
        if (!commentId) return;
        const viewer = detail.context === "SCH" ? schematicViewerRef.current : pcbViewerRef.current;
        setSelectedCommentId(commentId);
        setCommentCardScreenPosition(
            worldToViewportScreen(viewer, detail.resolvedAnchor.x, detail.resolvedAnchor.y),
        );
    }, []);

    const handleCommentAreaEvent = useCallback((event: Event) => {
        const detail = (event as CustomEvent<EcadCommentAreaDetail>).detail;
        setCommentMode(false);
        setPendingContext(detail.context);
        setPendingLocation({
            x: detail.x,
            y: detail.y,
            layer: detail.layer ?? "",
            page: detail.page,
            bounds: detail.bounds,
        });
        setPendingElement(null);
        setShowCommentForm(true);
    }, []);

    useEffect(() => {
        const schematicViewer = schematicViewerElement;
        const pcbViewer = pcbViewerElement;
        if (!schematicViewer && !pcbViewer) return;

        schematicViewer?.addEventListener("ecad-viewer:overlay-click", openCommentCardForOverlayHit as EventListener);
        pcbViewer?.addEventListener("ecad-viewer:overlay-click", openCommentCardForOverlayHit as EventListener);
        schematicViewer?.addEventListener("ecad-viewer:comment-area", handleCommentAreaEvent as EventListener);
        pcbViewer?.addEventListener("ecad-viewer:comment-area", handleCommentAreaEvent as EventListener);

        return () => {
            schematicViewer?.removeEventListener("ecad-viewer:overlay-click", openCommentCardForOverlayHit as EventListener);
            pcbViewer?.removeEventListener("ecad-viewer:overlay-click", openCommentCardForOverlayHit as EventListener);
            schematicViewer?.removeEventListener("ecad-viewer:comment-area", handleCommentAreaEvent as EventListener);
            pcbViewer?.removeEventListener("ecad-viewer:comment-area", handleCommentAreaEvent as EventListener);
        };
    }, [handleCommentAreaEvent, openCommentCardForOverlayHit, pcbViewerElement, schematicViewerElement]);

    const submitComment = useCallback(async (content: string) => {
        if (!pendingLocation || !pendingContext) return;
        setIsSubmittingComment(true);
        try {
            const response = await fetchApi(`/api/projects/${projectId}/comments`, {
                method: "POST",
                body: JSON.stringify({
                    context: pendingContext,
                    location: pendingLocation,
                    content,
                    author: user?.name,
                    elementId: pendingElement?.elementId,
                    elementRef: pendingElement?.elementRef,
                    elementType: pendingElement?.elementType,
                }),
            });
            if (!response.ok) throw new Error(await readApiError(response, "Failed to post comment"));
            const created = await response.json() as Comment;
            setComments((prev) => [...prev, created]);
            setShowCommentForm(false);
            setPendingLocation(null);
            setPendingContext(null);
            setPendingElement(null);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to post comment");
        } finally {
            setIsSubmittingComment(false);
        }
    }, [pendingContext, pendingElement, pendingLocation, projectId, user?.name]);

    const resolveComment = useCallback(async (commentId: string, resolved: boolean) => {
        try {
            const response = await fetchApi(`/api/projects/${projectId}/comments/${commentId}`, {
                method: "PATCH",
                body: JSON.stringify({ status: resolved ? "RESOLVED" : "OPEN" }),
            });
            if (!response.ok) throw new Error(await readApiError(response, "Failed to update comment"));
            const updated = await response.json() as Comment;
            setComments((prev) => prev.map((entry) => (entry.id === commentId ? updated : entry)));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update comment");
        }
    }, [projectId]);

    const replyToComment = useCallback(async (commentId: string, content: string) => {
        try {
            const response = await fetchApi(`/api/projects/${projectId}/comments/${commentId}/replies`, {
                method: "POST",
                body: JSON.stringify({ content, author: user?.name }),
            });
            if (!response.ok) throw new Error(await readApiError(response, "Failed to add reply"));
            const payload = await response.json() as { comment: Comment };
            setComments((prev) => prev.map((entry) => (entry.id === commentId ? payload.comment : entry)));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to add reply");
        }
    }, [projectId, user?.name]);

    const deleteComment = useCallback(async (commentId: string) => {
        try {
            const response = await fetchApi(`/api/projects/${projectId}/comments/${commentId}`, {
                method: "DELETE",
            });
            if (!response.ok) throw new Error(await readApiError(response, "Failed to delete comment"));
            setComments((prev) => prev.filter((entry) => entry.id !== commentId));
            setSelectedCommentId((current) => (current === commentId ? null : current));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete comment");
        }
    }, [projectId]);

    const handleCommentClick = useCallback((comment: Comment) => {
        const targetTab: VisualizerTab = comment.context === "SCH" ? "sch" : "pcb";
        setActiveTab((current) => (current === targetTab ? current : targetTab));
        const viewer = targetTab === "sch" ? schematicViewerRef.current : pcbViewerRef.current;
        if (viewer) {
            if (comment.location.page) viewer.switchPage(comment.location.page);
            viewer.zoomToLocation(comment.location.x, comment.location.y);
        }
        setSelectedCommentId(comment.id);
        setCommentCardScreenPosition(
            worldToViewportScreen(viewer, comment.location.x, comment.location.y),
        );
    }, []);

    const selectedComment = useMemo(
        () => comments.find((entry) => entry.id === selectedCommentId) ?? null,
        [comments, selectedCommentId],
    );

    useEffect(() => {
        const handleKeyboard = (event: KeyboardEvent) => {
            const target = event.target;
            if (event.defaultPrevented || document.querySelector('[role="dialog"][data-state="open"]')) return;
            if (
                target instanceof HTMLInputElement
                || target instanceof HTMLTextAreaElement
                || (target instanceof HTMLElement && target.isContentEditable)
            ) return;

            if (event.key === "Escape") {
                clearGlobalSelection();
                setSelectionInspectorOpen(false);
                setCommentMode(false);
                setShowCommentForm(false);
                setSelectedCommentId(null);
                lastSelectionRef.current = null;
                return;
            }
            if (
                canModifyComments
                && (activeTab === "sch" || activeTab === "pcb")
                && event.key.toLowerCase() === "c"
                && !event.metaKey
                && !event.ctrlKey
                && !event.altKey
            ) {
                const selection = lastSelectionRef.current;
                if (selection && selection.x !== undefined && selection.y !== undefined) {
                    setCommentMode(false);
                    setPendingContext(activeTab === "sch" ? "SCH" : "PCB");
                    setPendingLocation({
                        x: selection.x,
                        y: selection.y,
                        layer: selection.layer ?? "",
                        page: selection.page,
                        // Element comments use marker-at-center only; do not
                        // treat the selected item bbox as an area comment.
                    });
                    setPendingElement({
                        elementId: selection.uuid,
                        elementRef: selection.reference,
                        elementType: selection.itemType,
                    });
                    setShowCommentForm(true);
                } else {
                    setCommentMode(true);
                }
                event.preventDefault();
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
                if (event.altKey && (event.key === "Backspace" || event.key === "Delete")) {
                    const handled = schematicViewerRef.current?.navigateSchematicParent?.();
                    if (handled) event.preventDefault();
                    return;
                }
            }
        };
        // Capture before the embedded canvas can consume bracket/backspace keys.
        // ecad-viewer still receives every key Prism does not handle.
        window.addEventListener("keydown", handleKeyboard, true);
        return () => window.removeEventListener("keydown", handleKeyboard, true);
    }, [activeTab, canModifyComments, clearGlobalSelection]);

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
                {(activeTab === "sch" || activeTab === "pcb") && canModifyComments && (
                    <Button
                        variant={commentMode ? "default" : "ghost"}
                        size="sm"
                        className={
                            commentMode
                                ? "h-8 text-xs bg-warning text-warning-foreground hover:bg-warning/90"
                                : "h-8 text-xs"
                        }
                        aria-pressed={commentMode}
                        onClick={() => setCommentMode((enabled) => !enabled)}
                    >
                        <MessageSquarePlus className="mr-2 h-3 w-3" />
                        Commenting Mode
                        <span
                            className={
                                commentMode
                                    ? "ml-2 rounded bg-warning-foreground/15 px-1 text-[10px]"
                                    : "ml-2 rounded bg-muted px-1 text-[10px] text-muted-foreground"
                            }
                        >
                            C
                        </span>
                    </Button>
                )}
                <Button
                    variant={showCommentPanel ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setShowCommentPanel((open) => !open)}
                    className="text-xs h-8"
                    aria-pressed={showCommentPanel}
                >
                    <MessageSquare className="w-3 h-3 mr-2" />
                    Comments
                    {comments.length > 0 && (
                        <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                            {comments.length}
                        </span>
                    )}
                </Button>
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
                                    <div className="min-h-0 min-w-0 flex-1">
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
                                    <div className="min-h-0 min-w-0 flex-1">
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
                {showCommentPanel && (
                    <CommentPanel
                        comments={comments}
                        onClose={() => setShowCommentPanel(false)}
                        onResolve={(commentId, resolved) => void resolveComment(commentId, resolved)}
                        onReply={replyToComment}
                        onDelete={deleteComment}
                        onCommentClick={handleCommentClick}
                        canModify={canModifyComments}
                        highlightedId={selectedCommentId}
                    />
                )}
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

            <CommentForm
                isOpen={showCommentForm}
                onClose={() => {
                    setShowCommentForm(false);
                    setPendingLocation(null);
                    setPendingContext(null);
                    setPendingElement(null);
                }}
                onSubmit={(content) => void submitComment(content)}
                location={pendingLocation}
                context={pendingContext ?? "SCH"}
                isSubmitting={isSubmittingComment}
            />

            {selectedComment && (
                <CommentCard
                    comment={selectedComment}
                    screenPosition={commentCardScreenPosition}
                    canModify={canModifyComments}
                    onClose={() => setSelectedCommentId(null)}
                    onResolve={(commentId, resolved) => void resolveComment(commentId, resolved)}
                    onReply={replyToComment}
                    onDelete={deleteComment}
                />
            )}
        </div>
    );
}
