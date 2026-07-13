import { useEffect, useState, useCallback, useRef, useLayoutEffect, useMemo } from "react";
import { toast } from "sonner";
import { Cpu, Box, FileText, MessageSquarePlus, MessageSquare, GitBranch, CircuitBoard, Link2, Copy, Check, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CommentOverlay } from "./comment-overlay";
import { CommentForm } from "./comment-form";
import { CommentPanel } from "./comment-panel";
import { EngineeringBomTable } from "./engineering-bom-table";
import { SelectionInspector } from "./selection-inspector";
import { WebGpu3dTab } from "./webgpu-3d-tab";
import { fetchApi, readApiError } from "@/lib/api";
import { canWriteCatalog } from "@/lib/roles";
import { crossProbeRequestForSelection, normalizeEcadSelection } from "@/lib/prism-selection";
import { usePrismCrossProbe } from "@/hooks/use-prism-cross-probe";
import type { User } from "@/types/auth";
import type { Comment, CommentContext } from "@/types/comments";
import type {
    ECadViewerElement,
    KiCanvasSelectDetail,
} from "@/types/ecad-viewer";
import type { PrismSelection, PrismSemanticIndex } from "@/types/prism-selection";

interface VisualizerProps {
    projectId: string;
    user: User | null;
    commit?: string | null;
}

type VisualizerTab = "sch" | "pcb" | "3d" | "bom" | "assembly";

interface CommentsSourceUrls {
    project_id: string;
    project_name: string;
    base_url: string;
    list_url: string;
    patch_url_template: string;
    reply_url_template: string;
    delete_url_template: string;
}

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
    sources: ViewerBlobSource[],
) => {
    const signature = sources
        .map(({ filename, content }) => `${filename}:${content.length}`)
        .join("|");
    return `${kind}:${projectId}:${commit ?? "latest"}:${signature}`;
};

type EcadViewerHostProps = {
    viewerKey: string;
    sources: ViewerBlobSource[];
    setViewerRef: (node: ECadViewerElement | null) => void;
};

function EcadViewerHost({ viewerKey, sources, setViewerRef }: EcadViewerHostProps) {
    const hostRef = useRef<ECadViewerElement | null>(null);

    const attachViewerRef = useCallback((node: ECadViewerElement | null) => {
        hostRef.current = node;
        setViewerRef(node);
    }, [setViewerRef]);

    useLayoutEffect(() => {
        const viewer = hostRef.current;
        if (!viewer || sources.length === 0) return;

        let cancelled = false;

        const hydrateViewer = async () => {
            await customElements.whenDefined("ecad-blob");
            if (cancelled || !hostRef.current) return;

            const activeViewer = hostRef.current;
            activeViewer.querySelectorAll("ecad-blob").forEach((blob) => blob.remove());

            for (const source of sources) {
                const blob = document.createElement("ecad-blob") as HTMLElement & {
                    filename?: string;
                    content?: string;
                };
                blob.filename = source.filename;
                blob.content = source.content;
                activeViewer.appendChild(blob);
            }

            const viewerWithLoader = activeViewer as ECadViewerElement & {
                load_src?: () => Promise<void> | void;
            };
            if (typeof viewerWithLoader.load_src === "function") {
                await viewerWithLoader.load_src();
            }
        };

        void hydrateViewer();

        return () => {
            cancelled = true;
        };
    }, [sources, viewerKey]);

    return (
        <ecad-viewer
            ref={attachViewerRef}
            style={{ width: "100%", height: "100%" }}
            show-header="true"
            header-sections="beginning,end"
            show-selection-panel="false"
            key={viewerKey}
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

    const [comments, setComments] = useState<Comment[]>([]);
    const [activePage, setActivePage] = useState<string>("root.kicad_sch");
    const [commentMode, setCommentMode] = useState(false);
    const [showCommentForm, setShowCommentForm] = useState(false);
    const [showCommentPanel, setShowCommentPanel] = useState(false);
    const [pendingLocation, setPendingLocation] = useState<{ x: number, y: number, layer: string } | null>(null);
    const [pendingContext, setPendingContext] = useState<CommentContext>("PCB");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isPushingComments, setIsPushingComments] = useState(false);
    const [pushMessage, setPushMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [showPushDialog, setShowPushDialog] = useState(false);
    const [commentsSourceUrls, setCommentsSourceUrls] = useState<CommentsSourceUrls | null>(null);
    const [isUrlsPopoverOpen, setIsUrlsPopoverOpen] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const canModifyComments = user?.role === "admin" || user?.role === "designer";
    const {
        selection: globalSelection,
        select: selectGlobal,
        clear: clearGlobalSelection,
        registerClient,
    } = usePrismCrossProbe(semanticIndex);
    const activeCommentContext: CommentContext | null = activeTab === "sch" ? "SCH" : activeTab === "pcb" ? "PCB" : null;
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

    const applyCommentModeToViewer = useCallback((viewer: ECadViewerElement | null, enabled: boolean) => {
        if (!viewer) return;
        if (viewer.setCommentMode) {
            viewer.setCommentMode(enabled);
            return;
        }

        if (enabled) {
            viewer.setAttribute("comment-mode", "true");
        } else {
            viewer.removeAttribute("comment-mode");
        }
    }, []);

    const copyToClipboard = async (label: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedField(label);
            setTimeout(() => setCopiedField(null), 1400);
        } catch (error) {
            console.warn("Failed to copy URL", error);
        }
    };

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
                const [ibomRes, commentsRes] = await Promise.allSettled([
                    fetch(appendCommit(`${baseUrl}/ibom`), { signal }),
                    fetch(`/api/projects/${projectId}/comments`, { signal }),
                ]);

                if (ibomRes.status === "fulfilled" && ibomRes.value.ok) {
                    setIbomUrl(appendCommit(`${baseUrl}/ibom`));
                } else {
                    setIbomUrl(null);
                }

                // Handle Comments
                if (commentsRes.status === "fulfilled" && commentsRes.value.ok) {
                    const cData = await commentsRes.value.json();
                    if (signal.aborted) return;
                    setComments(cData.comments || []);
                } else {
                    setComments([]);
                }

                try {
                    const sourceResponse = await fetch(`/api/projects/${projectId}/comments/source-urls`, { signal });

                    if (sourceResponse.ok) {
                        const sourceData = await sourceResponse.json();
                        if (signal.aborted) return;
                        setCommentsSourceUrls(sourceData);
                    } else {
                        setCommentsSourceUrls(null);
                    }
                } catch (sourceError) {
                    if (!isAbortError(sourceError)) {
                        console.warn("Failed to load comments source URLs", sourceError);
                    }
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
        const controller = new AbortController();
        setSemanticIndex(null);
        setSemanticIndexLoading(true);
        setSemanticIndexError(null);
        fetch(appendCommit(`/api/projects/${projectId}/semantic-index`), {
            signal: controller.signal,
            credentials: "include",
        })
            .then(async (response) => {
                if (!response.ok) {
                    const payload = await response.json().catch(() => null) as { detail?: string } | null;
                    throw new Error(payload?.detail || "Semantic index is unavailable");
                }
                return response.json() as Promise<PrismSemanticIndex>;
            })
            .then((payload) => {
                if (!controller.signal.aborted) setSemanticIndex(payload);
            })
            .catch((error: unknown) => {
                if (!isAbortError(error) && !controller.signal.aborted) {
                    setSemanticIndexError(error instanceof Error ? error.message : "Semantic index is unavailable");
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setSemanticIndexLoading(false);
            });
        return () => controller.abort();
    }, [appendCommit, projectId, semanticIndexRetryToken]);

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
        setPcbContent(null);
        setIbomUrl(null);
        setSemanticIndex(null);
        setSemanticIndexLoading(true);
        setSemanticIndexError(null);
        setSelectionInspectorOpen(false);
        setThreeDActivated(false);
        setComments([]);
        setCommentsSourceUrls(null);
        setActivePage("root.kicad_sch");
        setCommentMode(false);
        setShowCommentForm(false);
        setShowCommentPanel(false);
        setPendingLocation(null);
        setPendingContext("PCB");
        setIsSubmittingComment(false);
        setIsPushingComments(false);
        setPushMessage(null);
        setShowPushDialog(false);
        setIsUrlsPopoverOpen(false);
        setCopiedField(null);
        clearGlobalSelection();
    }, [clearGlobalSelection, commit, projectId]);

    useEffect(() => {
        if (activeTab === "3d") setThreeDActivated(true);
    }, [activeTab]);

    // Event Listeners for ecad-viewer
    useEffect(() => {
        const schematicViewer = schematicViewerElement;
        const pcbViewer = pcbViewerElement;

        if (!schematicViewer && !pcbViewer) return;

        const handleCommentClick = (e: CustomEvent) => {
            if (!canModifyComments) {
                return;
            }
            if (activeCommentContext !== "SCH" && activeCommentContext !== "PCB") {
                return;
            }

            const detail = e.detail;
            setPendingLocation({
                x: detail.worldX,
                y: detail.worldY,
                layer: detail.layer || "F.Cu",
            });
            setPendingContext(activeCommentContext);
            setShowCommentForm(true);
        };

        const handleSheetLoad = (e: CustomEvent) => {
            if (typeof e.detail === 'string') setActivePage(e.detail);
            else if (e.detail?.filename) setActivePage(e.detail.filename);
            else if (e.detail?.sheetName) setActivePage(e.detail.sheetName);
        };

        // Add listeners to both viewers
        if (schematicViewer) {
            schematicViewer.addEventListener("ecad-viewer:comment:click", handleCommentClick as EventListener);
            schematicViewer.addEventListener("kicanvas:sheet:loaded", handleSheetLoad as EventListener);
        }

        if (pcbViewer) {
            pcbViewer.addEventListener("ecad-viewer:comment:click", handleCommentClick as EventListener);
            pcbViewer.addEventListener("kicanvas:sheet:loaded", handleSheetLoad as EventListener);
        }

        return () => {
            if (schematicViewer) {
                schematicViewer.removeEventListener("ecad-viewer:comment:click", handleCommentClick as EventListener);
                schematicViewer.removeEventListener("kicanvas:sheet:loaded", handleSheetLoad as EventListener);
            }
            if (pcbViewer) {
                pcbViewer.removeEventListener("ecad-viewer:comment:click", handleCommentClick as EventListener);
                pcbViewer.removeEventListener("kicanvas:sheet:loaded", handleSheetLoad as EventListener);
            }
        };
    }, [activeCommentContext, canModifyComments, schematicViewerElement, pcbViewerElement]);

    // Toggle Comment Mode
    const toggleCommentMode = () => {
        if (!canModifyComments) {
            return;
        }
        setCommentMode((previous) => {
            const next = !previous;
            applyCommentModeToViewer(schematicViewerRef.current, next);
            applyCommentModeToViewer(pcbViewerRef.current, next);
            return next;
        });
    };

    useEffect(() => {
        applyCommentModeToViewer(schematicViewerElement, commentMode);
        applyCommentModeToViewer(pcbViewerElement, commentMode);
    }, [commentMode, schematicViewerElement, pcbViewerElement, applyCommentModeToViewer]);

    useEffect(() => {
        if (!commentMode) return;

        if (activeTab === "sch") {
            applyCommentModeToViewer(schematicViewerRef.current, true);
            return;
        }

        if (activeTab === "pcb") {
            applyCommentModeToViewer(pcbViewerRef.current, true);
        }
    }, [activeTab, commentMode, applyCommentModeToViewer]);

    useEffect(() => {
        schematicViewerRef.current?.setCrossProbeEnabled(true);
        pcbViewerRef.current?.setCrossProbeEnabled(true);
    }, [schematicViewerElement, pcbViewerElement]);

    useEffect(() => {
        const schematicViewer = schematicViewerElement;
        const pcbViewer = pcbViewerElement;
        if (!schematicViewer && !pcbViewer) return;

        const handleSelection = (fallbackSourceContext: "SCH" | "PCB", event: Event) => {
            const detail = (event as CustomEvent<KiCanvasSelectDetail>).detail;
            if (!detail?.item) {
                clearGlobalSelection();
                return;
            }
            const normalized = normalizeEcadSelection(
                detail,
                fallbackSourceContext,
                semanticIndex?.sourceRevisionKey ?? commit ?? undefined,
            );
            if (normalized) selectGlobal(normalized);
        };

        const onSchematicSelect = (event: Event) => handleSelection("SCH", event);
        const onPcbSelect = (event: Event) => handleSelection("PCB", event);

        schematicViewer?.addEventListener("kicanvas:select", onSchematicSelect as EventListener);
        pcbViewer?.addEventListener("kicanvas:select", onPcbSelect as EventListener);

        return () => {
            schematicViewer?.removeEventListener("kicanvas:select", onSchematicSelect as EventListener);
            pcbViewer?.removeEventListener("kicanvas:select", onPcbSelect as EventListener);
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
                viewer.clearCrossProbe?.();
                return;
            }
            if (typeof viewer.requestCrossProbe !== "function") return;
            const request = crossProbeRequestForSelection(selection, targetContext, semanticIndex);
            const result = viewer.requestCrossProbe(request);
            if (!result.resolved && selection.kind === "terminal") {
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
            if (event.defaultPrevented || document.querySelector('[role="dialog"][data-state="open"]')) return;
            const target = event.target;
            if (
                target instanceof HTMLInputElement
                || target instanceof HTMLTextAreaElement
                || (target instanceof HTMLElement && target.isContentEditable)
            ) return;

            if (event.key === "Escape") {
                setCommentMode(false);
                applyCommentModeToViewer(schematicViewerRef.current, false);
                applyCommentModeToViewer(pcbViewerRef.current, false);
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
                if (event.altKey && (event.key === "Backspace" || event.key === "Delete")) {
                    const handled = schematicViewerRef.current?.navigateSchematicParent?.();
                    if (handled) event.preventDefault();
                    return;
                }
            }
            if (
                event.key.toLocaleLowerCase() === "c"
                && !event.metaKey
                && !event.ctrlKey
                && !event.altKey
                && canModifyComments
                && activeCommentContext
            ) {
                setCommentMode(true);
                applyCommentModeToViewer(schematicViewerRef.current, true);
                applyCommentModeToViewer(pcbViewerRef.current, true);
            }
        };
        // Capture before the embedded canvas can consume bracket/backspace keys.
        // ecad-viewer still receives every key Prism does not handle.
        window.addEventListener("keydown", handleKeyboard, true);
        return () => window.removeEventListener("keydown", handleKeyboard, true);
    }, [activeCommentContext, activeTab, applyCommentModeToViewer, canModifyComments, clearGlobalSelection]);

    // Submit Comment
    const handleSubmitComment = async (content: string) => {
        if (!pendingLocation || !canModifyComments) return;
        setIsSubmittingComment(true);
        try {
            const location = { ...pendingLocation, page: pendingContext === "SCH" ? activePage : "" };
            const response = await fetchApi(`/api/projects/${projectId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    context: pendingContext,
                    location,
                    content,
                    author: user?.name || "anonymous"
                })
            });

            if (response.ok) {
                const newComment = await response.json();
                setComments(prev => [...prev, newComment]);
                setShowCommentForm(false);
                setPendingLocation(null);
                // Turn off comment mode after posting? User might want to post multiple. Keep it on.
            }
        } catch (err) {
            console.error("Create comment failed", err);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    // Navigate to Comment
    const handleCommentNavigate = (comment: Comment) => {
        // Force switch to appropriate tab if in 3D/iBom
        if (comment.context === "SCH" && activeTab !== "sch") {
            setActiveTab("sch");
        } else if (comment.context === "PCB" && activeTab !== "pcb") {
            setActiveTab("pcb");
        }

        // Get the appropriate viewer
        const viewer = comment.context === "SCH" ? schematicViewerRef.current : pcbViewerRef.current;
        if (!viewer) return;

        if (comment.context === "SCH" && comment.location.page) {
            viewer.switchPage(comment.location.page);
        }

        if (viewer.zoomToLocation) {
            viewer.zoomToLocation(comment.location.x, comment.location.y);
        }
    };

    // Resolving/Replying
    const handleResolveComment = async (commentId: string, resolved: boolean) => {
        if (!canModifyComments) return;
        const response = await fetchApi(`/api/projects/${projectId}/comments/${commentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: resolved ? "RESOLVED" : "OPEN" })
        });
        if (response.ok) {
            const updated = await response.json();
            setComments(prev => prev.map(c => c.id === commentId ? updated : c));
        }
    };

    const handleReplyComment = async (commentId: string, content: string) => {
        if (!canModifyComments) return;
        const response = await fetchApi(`/api/projects/${projectId}/comments/${commentId}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content,
                author: user?.name || "anonymous"
            })
        });
        if (response.ok) {
            const data = await response.json();
            setComments(prev => prev.map(c => c.id === commentId ? data.comment : c));
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!canModifyComments) return;
        try {
            const response = await fetchApi(`/api/projects/${projectId}/comments/${commentId}`, {
                method: "DELETE",
            });
            if (response.ok) {
                setComments(prev => prev.filter(c => c.id !== commentId));
            }
        } catch (err) {
            console.error("Failed to delete comment", err);
        }
    };

    // Export comments.json artifact from DB snapshot
    const handlePushComments = async () => {
        if (!canModifyComments) return;
        setIsPushingComments(true);
        setPushMessage(null);

        try {
            const response = await fetchApi(`/api/projects/${projectId}/comments/push`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });

            const data = await response.json();

            if (response.ok) {
                const artifactPath = data.comments_path ? ` (${data.comments_path})` : "";
                setPushMessage({ type: "success", text: `${data.message || "Generated comments artifact."}${artifactPath}` });
                setShowPushDialog(false);
            } else {
                setPushMessage({ type: "error", text: data.detail || "Failed to generate comments artifact." });
            }
        } catch (err: any) {
            setPushMessage({ type: "error", text: err.message || "Network error while generating comments artifact." });
        } finally {
            setIsPushingComments(false);
            // Clear message after 5 seconds
            setTimeout(() => setPushMessage(null), 5000);
        }
    };

    // Filtering comments for Overlay
    const overlayComments = comments.filter(c => {
        if (!activeCommentContext) return false;

        // Must match context
        if (c.context !== activeCommentContext) return false;

        // If SCH, match page
        if (activeCommentContext === "SCH") {
            const norm = (p: string) => p ? p.split('/').pop() || p : "";
            const cPage = norm(c.location.page || "");
            const aPage = norm(activePage);
            // Root handling
            const isRootC = cPage === "root.kicad_sch" || cPage === "root";
            const isRootA = aPage === "root.kicad_sch" || aPage === "root";

            if (isRootA && isRootC) return true;
            return cPage === aPage;
        }
        return true;
    });

    const shouldShowOverlay =
        (activeTab === "sch" && Boolean(schematicContent && schematicViewerElement)) ||
        (activeTab === "pcb" && Boolean(pcbContent && pcbViewerElement));
    const schematicSources = useMemo<ViewerBlobSource[]>(
        () => (schematicContent
            ? [{ filename: "root.kicad_sch", content: schematicContent }, ...subsheets]
            : []),
        [schematicContent, subsheets],
    );
    const pcbSources = useMemo<ViewerBlobSource[]>(
        () => (pcbContent
            ? [{ filename: "board.kicad_pcb", content: pcbContent }]
            : []),
        [pcbContent],
    );
    const schematicViewerKey = buildViewerKey("schematic", projectId, commit, schematicSources);
    const pcbViewerKey = buildViewerKey("pcb", projectId, commit, pcbSources);

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

                {/* Comment Controls */}
                {(activeTab === "sch" || activeTab === "pcb") && (
                    <>
                        <Popover open={isUrlsPopoverOpen} onOpenChange={setIsUrlsPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-8"
                                    aria-label="Show KiCad comments REST URLs"
                                >
                                    <Link2 className="w-3 h-3 mr-2" />
                                    REST URLs
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" side="bottom" className="w-[520px] max-w-[calc(100vw-2rem)] p-3">
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-sm font-medium">KiCad Comments REST URLs</p>
                                        <p className="text-xs text-muted-foreground">
                                            Copy these into KiCad Comments Source Settings.
                                        </p>
                                    </div>
                                    {commentsSourceUrls ? (
                                        <div className="space-y-2">
                                            {[
                                                { label: "List URL", value: commentsSourceUrls.list_url },
                                                { label: "Patch URL Template", value: commentsSourceUrls.patch_url_template },
                                                { label: "Reply URL Template", value: commentsSourceUrls.reply_url_template },
                                                { label: "Delete URL Template", value: commentsSourceUrls.delete_url_template },
                                            ].map((entry) => (
                                                <div key={entry.label} className="rounded border bg-muted/30 p-2">
                                                    <div className="mb-1 text-[11px] font-medium text-muted-foreground">{entry.label}</div>
                                                    <div className="flex items-start gap-2">
                                                        <code className="flex-1 break-all rounded bg-background px-2 py-1 text-[11px]">{entry.value}</code>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 shrink-0"
                                                            onClick={() => copyToClipboard(entry.label, entry.value)}
                                                        >
                                                            {copiedField === entry.label ? (
                                                                <>
                                                                    <Check className="h-3 w-3 mr-1" />
                                                                    Copied
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Copy className="h-3 w-3 mr-1" />
                                                                    Copy
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">Loading URL helpers...</p>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button
                            variant={commentMode ? "default" : "ghost"}
                            size="sm"
                            onClick={toggleCommentMode}
                            disabled={!canModifyComments}
                            className="h-8 text-xs"
                        >
                            <MessageSquarePlus className="w-3 h-3 mr-2" />
                            {commentMode ? "Commenting Mode" : "Add Comment"}
                        </Button>
                        <Button
                            variant={showCommentPanel ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setShowCommentPanel(!showCommentPanel)}
                            className="text-xs h-8 ml-1"
                        >
                            <MessageSquare className="w-3 h-3 mr-2" />
                            Comments
                            <span className="ml-1 bg-muted-foreground/20 px-1 rounded-full text-[10px]">
                                {comments.length}
                            </span>
                        </Button>
                        {canModifyComments && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowPushDialog(true)}
                                className="text-xs h-8 ml-1"
                                title="Generate comments.json artifact from DB"
                            >
                                <GitBranch className="w-3 h-3 mr-2" />
                                Generate JSON
                            </Button>
                        )}
                    </>
                )}
            </div>

            {/* Push Message Feedback */}
            {pushMessage && (
                <div className={`px-4 py-2 text-sm border-b ${pushMessage.type === "success"
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-destructive/20 bg-destructive/10 text-destructive"
                    }`}>
                    {pushMessage.text}
                    <button
                        onClick={() => setPushMessage(null)}
                        className="ml-2 text-xs underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Generate comments.json Dialog */}
            <Dialog open={showPushDialog} onOpenChange={setShowPushDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Generate Comments Artifact</DialogTitle>
                        <DialogDescription>
                            This writes the latest DB comments to `.comments/comments.json`. Push to remote is handled by your Git workflow.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPushDialog(false)} disabled={isPushingComments}>
                            Cancel
                        </Button>
                        <Button onClick={handlePushComments} disabled={isPushingComments}>
                            {isPushingComments ? "Generating..." : "Generate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Content Area */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="relative min-w-0 flex-1 overflow-hidden">
                    {/* Schematic View - always mounted after first visit */}
                    <div aria-hidden={activeTab !== "sch"} className={`absolute inset-0 z-10 transition-opacity duration-200 ${activeTab === "sch" ? "visible pointer-events-auto opacity-100" : "invisible pointer-events-none opacity-0"}`}>
                        {schematicContentLoaded ? (
                            schematicSources.length > 0 ? (
                                <EcadViewerHost
                                    viewerKey={schematicViewerKey}
                                    sources={schematicSources}
                                    setViewerRef={setSchematicViewerRef}
                                />
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
                                <EcadViewerHost
                                    viewerKey={pcbViewerKey}
                                    sources={pcbSources}
                                    setViewerRef={setPcbViewerRef}
                                />
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

                    {shouldShowOverlay ? (
                        <CommentOverlay
                            comments={overlayComments}
                            viewerRef={activeTab === "sch" ? schematicViewerRef : pcbViewerRef}
                            onPinClick={() => setShowCommentPanel(true)}
                        />
                    ) : null}

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
                                onRetry={() => setSemanticIndexRetryToken((token) => token + 1)}
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

                    {showCommentPanel && (
                        <div className="absolute inset-y-0 right-0 z-50 animate-in slide-in-from-right">
                            <CommentPanel
                                comments={comments}
                                onClose={() => setShowCommentPanel(false)}
                                onResolve={handleResolveComment}
                                onReply={handleReplyComment}
                                onDelete={handleDeleteComment}
                                onCommentClick={handleCommentNavigate}
                                canModify={canModifyComments}
                            />
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

            {/* Modals */}
            <CommentForm
                isOpen={showCommentForm}
                onClose={() => setShowCommentForm(false)}
                onSubmit={handleSubmitComment}
                location={pendingLocation}
                context={pendingContext}
                isSubmitting={isSubmittingComment}
            />
        </div>
    );
}
