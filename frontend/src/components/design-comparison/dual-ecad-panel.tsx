import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApi, readApiError } from "@/lib/api";
import { CommentForm, type CommentFormSubmitPayload } from "@/components/comment-form";
import type {
    CameraState,
    ECadViewerElement,
    EcadCommentAreaDetail,
    EcadOverlayPrimitive,
    EcadOverlayScene,
} from "@/types/ecad-viewer";
import type { CommentContext, CommentLocation } from "@/types/comments";
import type { ChangeItem, ChangeKind, GeometryEntry, GeometrySnapshot, ViewerSide } from "./types";

type ViewerBlobSource = {
    filename: string;
    content: string;
};

type Domain = "schematic" | "pcb";

interface DualEcadPanelProps {
    projectId: string;
    domain: Domain;
    base: string;
    head: string;
    tipSide: ViewerSide | null;
    geometry: { base: GeometrySnapshot; head: GeometrySnapshot };
    selectedChanges: ChangeItem[];
    visibleChanges: ChangeItem[];
    selectedPage: string | null;
    syncCamera: boolean;
    onToggleSyncCamera: () => void;
}

const isAbortError = (error: unknown): boolean =>
    error instanceof DOMException && error.name === "AbortError";

const buildViewerKey = (domain: Domain, projectId: string, commit: string) =>
    `design-compare:${domain}:${projectId}:${commit}`;

const OVERLAY_CHANNEL = "visual-diff";

const KIND_STYLE: Record<ChangeKind, { stroke: string; fill: string }> = {
    added: { stroke: "#16a34a", fill: "#16a34a40" },
    removed: { stroke: "#dc2626", fill: "#dc262640" },
    changed: { stroke: "#d97706", fill: "#d9770640" },
};

function geometryForChange(
    change: ChangeItem,
    side: ViewerSide,
    domain: Domain,
    geometry: { base: GeometrySnapshot; head: GeometrySnapshot },
): GeometryEntry | undefined {
    if (!change.uuid) return undefined;
    const snapshot = side === "base" ? geometry.base : geometry.head;
    const bucket = domain === "schematic" ? snapshot?.schematic : snapshot?.pcb;
    return bucket?.[change.uuid];
}

function primitivesForChange(
    change: ChangeItem,
    side: ViewerSide,
    domain: Domain,
    geometry: { base: GeometrySnapshot; head: GeometrySnapshot },
    emphasized: boolean,
): EcadOverlayPrimitive[] {
    const style = KIND_STYLE[change.kind];
    const entry = geometryForChange(change, side, domain, geometry);
    const out: EcadOverlayPrimitive[] = [];

    if (entry) {
        const page = entry.page;
        if ((entry.kind === "track" || entry.kind === "wire") && (entry.points?.length ?? 0) >= 2) {
            const points = entry.points!;
            const [originX, originY] = points[0]!;
            out.push({
                id: `${change.id}-${side}`,
                kind: "polyline",
                anchor: { kind: "world", x: originX, y: originY, page },
                points: points.map(([x, y]) => [x - originX, y - originY]),
                stroke: style.stroke,
                strokeWidth: emphasized ? (entry.width ?? 0.25) + 0.15 : entry.width ?? 0.2,
                dash: emphasized ? [1.2, 0.6] : [0.6, 0.6],
                opacity: emphasized ? 1 : 0.65,
                sizing: "world",
                hitPadding: 0.3,
            });
        } else if (entry.kind === "via" && entry.x != null && entry.y != null) {
            out.push({
                id: `${change.id}-${side}`,
                kind: "circle",
                anchor: { kind: "world", x: entry.x, y: entry.y, page },
                radius: entry.radius ?? 0.3,
                stroke: style.stroke,
                fill: style.fill,
                strokeWidth: emphasized ? 0.25 : 0.15,
                opacity: emphasized ? 1 : 0.7,
                sizing: "world",
            });
        } else if ((entry.kind === "footprint" || entry.kind === "symbol") && entry.bounds) {
            out.push({
                id: `${change.id}-${side}`,
                kind: "bbox",
                anchor: { kind: "bbox", bounds: entry.bounds, page },
                stroke: style.stroke,
                fill: emphasized ? style.fill : undefined,
                strokeWidth: emphasized ? 0.3 : 0.15,
                dash: change.kind === "changed" ? [1, 0.6] : undefined,
                opacity: emphasized ? 1 : 0.7,
                sizing: "world",
            });
        }
    } else if (domain === "schematic" && change.category === "nets" && change.net) {
        // Schematic net-level changes have no per-item uuid — resolve via the
        // label/net-name entity anchor instead of exact geometry.
        out.push({
            id: `${change.id}-${side}-net`,
            kind: "bbox",
            anchor: { kind: "entity", net: change.net, page: change.page ?? undefined },
            stroke: style.stroke,
            strokeWidth: emphasized ? 0.3 : 0.15,
            dash: [1, 0.6],
            opacity: emphasized ? 1 : 0.6,
            sizing: "world",
        });
    }

    return out;
}

function buildScene(
    domain: Domain,
    side: ViewerSide,
    visibleChanges: ChangeItem[],
    emphasizedIds: Set<string>,
    geometry: { base: GeometrySnapshot; head: GeometrySnapshot },
    page: string | null,
): EcadOverlayScene {
    const primitives = visibleChanges.flatMap((change) =>
        primitivesForChange(change, side, domain, geometry, emphasizedIds.has(change.id)),
    );
    return {
        context: domain === "schematic" ? "SCH" : "PCB",
        placement: "foreground",
        visible: true,
        primitives,
        page: domain === "schematic" && page ? page : undefined,
    };
}

type EcadViewerHostProps = {
    viewerKey: string;
    sources: ViewerBlobSource[];
    setViewerRef: (node: ECadViewerElement | null) => void;
};

function EcadViewerHost({ viewerKey, sources, setViewerRef }: EcadViewerHostProps) {
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
            hostRef.current.dataset.ecadReadyRevision = "";
            await hostRef.current.replaceSources({
                revisionKey: viewerKey,
                sources: [rootSource],
            });
        };

        replaceReadyRef.current = replaceRoot();
        return () => { cancelled = true; };
    }, [rootSource, viewerKey]);

    useEffect(() => {
        if (!appendedSources.length) return;
        if (hostRef.current) hostRef.current.dataset.ecadReadyRevision = "";
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
            if (!cancelled) hostRef.current?.setActive(true);
        });
        return () => { cancelled = true; };
    }, []);

    return (
        <ecad-viewer
            ref={attachViewerRef}
            style={{ width: "100%", height: "100%" }}
            show-header="false"
            show-selection-panel="false"
            source-mode="host"
        />
    );
}

function useEcadSources(projectId: string, domain: Domain, commit: string): {
    sources: ViewerBlobSource[];
    loaded: boolean;
} {
    const [sources, setSources] = useState<ViewerBlobSource[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setLoaded(false);
        setSources([]);
        const controller = new AbortController();
        const { signal } = controller;
        const baseUrl = `/api/projects/${projectId}`;
        const q = `commit=${encodeURIComponent(commit)}`;

        const load = async () => {
            try {
                const supportRes = await fetch(`${baseUrl}/viewer/support-files?${q}`, { signal });
                const support: ViewerBlobSource[] = supportRes.ok
                    ? ((await supportRes.json()) as { files?: ViewerBlobSource[] }).files ?? []
                    : [];

                if (domain === "schematic") {
                    const [schRes, subsheetsRes] = await Promise.allSettled([
                        fetch(`${baseUrl}/schematic?${q}`, { signal }),
                        fetch(`${baseUrl}/schematic/subsheets?${q}`, { signal }),
                    ]);

                    const collected: ViewerBlobSource[] = [];
                    if (schRes.status === "fulfilled" && schRes.value.ok) {
                        collected.push({ filename: "root.kicad_sch", content: await schRes.value.text() });
                    }
                    collected.push(...support);

                    if (subsheetsRes.status === "fulfilled" && subsheetsRes.value.ok) {
                        const data = await subsheetsRes.value.json() as { files?: Array<{ name?: string; path?: string; url: string }> };
                        if (data.files?.length) {
                            const results = await Promise.allSettled(data.files.map(async (f) => {
                                const cRes = await fetch(f.url, { signal });
                                if (!cRes.ok) throw new Error(`Failed to load subsheet: ${f.url}`);
                                let filename = f.name || f.path || f.url.split("/").pop() || "subsheet.kicad_sch";
                                if (!filename.endsWith(".kicad_sch")) filename += ".kicad_sch";
                                if (!filename.includes("/") && f.url.includes("Subsheets")) filename = `Subsheets/${filename}`;
                                return { filename, content: await cRes.text() };
                            }));
                            for (const r of results) {
                                if (r.status === "fulfilled") collected.push(r.value);
                            }
                        }
                    }
                    if (!signal.aborted) setSources(collected);
                } else {
                    const pcbRes = await fetch(`${baseUrl}/pcb?${q}`, { signal });
                    const collected: ViewerBlobSource[] = [];
                    if (pcbRes.ok) {
                        collected.push({ filename: "board.kicad_pcb", content: await pcbRes.text() });
                    }
                    collected.push(...support);
                    if (!signal.aborted) setSources(collected);
                }
            } catch (err) {
                if (!isAbortError(err)) {
                    console.error("Failed to load design comparison sources", err);
                    if (!signal.aborted) setSources([]);
                }
            } finally {
                if (!signal.aborted) setLoaded(true);
            }
        };

        void load();
        return () => controller.abort();
    }, [projectId, domain, commit]);

    return { sources, loaded };
}

interface ViewerSideColumnProps {
    label: string;
    sha: string;
    accent: "old" | "new";
    domain: Domain;
    viewerKey: string;
    sources: ViewerBlobSource[];
    loaded: boolean;
    setViewerRef: (node: ECadViewerElement | null) => void;
    isTip: boolean;
    focused: boolean;
    onFocusChange: (focused: boolean) => void;
}

function ViewerSideColumn({
    label,
    sha,
    accent,
    sources,
    loaded,
    viewerKey,
    setViewerRef,
    isTip,
    focused,
    onFocusChange,
}: ViewerSideColumnProps) {
    return (
        <div className="relative flex h-full min-w-0 flex-1 flex-col border-r last:border-r-0">
            <div
                className={`flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-xs font-semibold ${
                    accent === "old" ? "bg-red-500/10 text-red-700" : "bg-green-500/10 text-green-700"
                }`}
            >
                <span className="uppercase tracking-wide">{label}</span>
                <code className="rounded bg-background/70 px-1.5 py-0.5 font-mono text-[10px]">{sha.slice(0, 7)}</code>
                {isTip && (
                    <span
                        className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                        title="Comments can be added on this revision"
                    >
                        Tip · press C to comment
                    </span>
                )}
            </div>
            <div
                className="min-h-0 flex-1 outline-none"
                tabIndex={0}
                onFocus={() => onFocusChange(true)}
                onBlur={() => onFocusChange(false)}
                data-focused={focused}
            >
                {loaded ? (
                    sources.length > 0 ? (
                        <EcadViewerHost viewerKey={viewerKey} sources={sources} setViewerRef={setViewerRef} />
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            No source found for this revision.
                        </div>
                    )
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Loading…
                    </div>
                )}
            </div>
        </div>
    );
}

export function DualEcadPanel({
    projectId,
    domain,
    base,
    head,
    tipSide,
    geometry,
    selectedChanges,
    visibleChanges,
    selectedPage,
    syncCamera,
    onToggleSyncCamera,
}: DualEcadPanelProps) {
    const [baseViewer, setBaseViewerState] = useState<ECadViewerElement | null>(null);
    const [headViewer, setHeadViewerState] = useState<ECadViewerElement | null>(null);
    const baseViewerRef = useRef<ECadViewerElement | null>(null);
    const headViewerRef = useRef<ECadViewerElement | null>(null);
    const [focusedSide, setFocusedSide] = useState<ViewerSide | null>(null);

    const setBaseViewer = useCallback((node: ECadViewerElement | null) => {
        baseViewerRef.current = node;
        setBaseViewerState(node);
    }, []);
    const setHeadViewer = useCallback((node: ECadViewerElement | null) => {
        headViewerRef.current = node;
        setHeadViewerState(node);
    }, []);
    const handleFocusChange = useCallback((side: ViewerSide, focused: boolean) => {
        setFocusedSide((prev) => {
            if (focused) return side;
            return prev === side ? null : prev;
        });
    }, []);

    const { sources: baseSources, loaded: baseLoaded } = useEcadSources(projectId, domain, base);
    const { sources: headSources, loaded: headLoaded } = useEcadSources(projectId, domain, head);

    const baseViewerKey = buildViewerKey(domain, projectId, base);
    const headViewerKey = buildViewerKey(domain, projectId, head);

    // -- Camera sync -----------------------------------------------------
    const syncingRef = useRef(false);
    useEffect(() => {
        if (!baseViewer || !headViewer) return;

        const propagate = (target: ECadViewerElement) => (event: Event) => {
            if (!syncCamera || syncingRef.current) return;
            const detail = (event as CustomEvent<CameraState>).detail;
            if (!detail) return;
            syncingRef.current = true;
            try {
                target.camera = detail;
            } finally {
                syncingRef.current = false;
            }
        };

        const fromBase = propagate(headViewer);
        const fromHead = propagate(baseViewer);
        baseViewer.addEventListener("camerachange", fromBase as EventListener);
        headViewer.addEventListener("camerachange", fromHead as EventListener);
        return () => {
            baseViewer.removeEventListener("camerachange", fromBase as EventListener);
            headViewer.removeEventListener("camerachange", fromHead as EventListener);
        };
    }, [baseViewer, headViewer, syncCamera]);

    // -- Monochrome native colours so overlay primitives read clearly ---
    useEffect(() => {
        baseViewer?.setColorMode?.("monochrome");
        return () => baseViewer?.setColorMode?.("normal");
    }, [baseViewer]);
    useEffect(() => {
        headViewer?.setColorMode?.("monochrome");
        return () => headViewer?.setColorMode?.("normal");
    }, [headViewer]);

    // -- Overlay scene: diff primitives on both sides --------------------
    useEffect(() => {
        if (!baseViewer && !headViewer) return;
        const emphasizedIds = new Set(selectedChanges.map((c) => c.id));
        const baseScene = buildScene(domain, "base", visibleChanges, emphasizedIds, geometry, selectedPage);
        const headScene = buildScene(domain, "head", visibleChanges, emphasizedIds, geometry, selectedPage);
        baseViewer?.setOverlayScene(OVERLAY_CHANNEL, baseScene);
        headViewer?.setOverlayScene(OVERLAY_CHANNEL, headScene);
        return () => {
            baseViewer?.clearOverlayScene(OVERLAY_CHANNEL);
            headViewer?.clearOverlayScene(OVERLAY_CHANNEL);
        };
    }, [baseViewer, headViewer, domain, visibleChanges, selectedChanges, geometry, selectedPage]);

    // -- PCB layer isolation when a change carries explicit layers -------
    const layerSnapshotRef = useRef<{ base: Map<string, boolean>; head: Map<string, boolean> } | null>(null);
    useEffect(() => {
        if (domain !== "pcb") return;
        const wantedLayers = selectedChanges.flatMap((c) => c.layers ?? []);
        if (wantedLayers.length === 0 || (!baseViewer && !headViewer)) {
            const snapshot = layerSnapshotRef.current;
            if (snapshot) {
                for (const [name, visible] of snapshot.base) baseViewer?.setPcbLayerVisibility?.(name, visible);
                for (const [name, visible] of snapshot.head) headViewer?.setPcbLayerVisibility?.(name, visible);
                layerSnapshotRef.current = null;
            }
            return;
        }

        const wanted = new Set([...wantedLayers, "Edge.Cuts"]);
        if (!layerSnapshotRef.current) {
            const baseMap = new Map<string, boolean>();
            const headMap = new Map<string, boolean>();
            for (const layer of baseViewer?.getPcbViewState?.()?.layers ?? []) baseMap.set(layer.name, layer.visible);
            for (const layer of headViewer?.getPcbViewState?.()?.layers ?? []) headMap.set(layer.name, layer.visible);
            layerSnapshotRef.current = { base: baseMap, head: headMap };
        }
        for (const layer of baseViewer?.getPcbViewState?.()?.layers ?? []) {
            baseViewer?.setPcbLayerVisibility?.(layer.name, wanted.has(layer.name));
        }
        for (const layer of headViewer?.getPcbViewState?.()?.layers ?? []) {
            headViewer?.setPcbLayerVisibility?.(layer.name, wanted.has(layer.name));
        }
    }, [domain, selectedChanges, baseViewer, headViewer]);

    useEffect(() => {
        return () => {
            const snapshot = layerSnapshotRef.current;
            if (!snapshot) return;
            for (const [name, visible] of snapshot.base) baseViewerRef.current?.setPcbLayerVisibility?.(name, visible);
            for (const [name, visible] of snapshot.head) headViewerRef.current?.setPcbLayerVisibility?.(name, visible);
        };
    }, []);

    // -- Sheet navigation --------------------------------------------------
    useEffect(() => {
        if (domain !== "schematic" || !selectedPage) return;
        const apply = async (viewer: ECadViewerElement | null) => {
            if (!viewer) return;
            if (viewer.showPage) await viewer.showPage(selectedPage);
            else viewer.switchPage(selectedPage);
        };
        void apply(baseViewer);
        void apply(headViewer);
    }, [domain, selectedPage, baseViewer, headViewer]);

    // -- Minimal comment support on the branch-tip side only ---------------
    const [showCommentForm, setShowCommentForm] = useState(false);
    const [pendingLocation, setPendingLocation] = useState<CommentLocation | null>(null);
    const [pendingContext, setPendingContext] = useState<CommentContext | null>(null);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    const tipViewer = tipSide === "base" ? baseViewer : tipSide === "head" ? headViewer : null;

    useEffect(() => {
        if (!tipSide || focusedSide !== tipSide || !tipViewer) return;
        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== "c" || event.metaKey || event.ctrlKey || event.altKey) return;
            const target = event.target;
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
            tipViewer.setCommentMode?.(true);
        };
        window.addEventListener("keydown", handleKeydown);
        return () => window.removeEventListener("keydown", handleKeydown);
    }, [tipSide, focusedSide, tipViewer]);

    const handleCommentArea = useCallback((event: Event) => {
        const detail = (event as CustomEvent<EcadCommentAreaDetail>).detail;
        setPendingContext(detail.context);
        setPendingLocation({
            x: detail.x,
            y: detail.y,
            layer: detail.layer ?? "",
            page: detail.page,
            bounds: detail.bounds,
        });
        setShowCommentForm(true);
    }, []);

    useEffect(() => {
        if (!tipViewer) return;
        tipViewer.addEventListener("ecad-viewer:comment-area", handleCommentArea as EventListener);
        return () => tipViewer.removeEventListener("ecad-viewer:comment-area", handleCommentArea as EventListener);
    }, [tipViewer, handleCommentArea]);

    const submitComment = useCallback(async (payload: CommentFormSubmitPayload) => {
        if (!pendingLocation || !pendingContext) return;
        setIsSubmittingComment(true);
        try {
            const changeId = selectedChanges[0]?.id;
            const response = await fetchApi(`/api/projects/${projectId}/comments`, {
                method: "POST",
                body: JSON.stringify({
                    context: pendingContext,
                    location: pendingLocation,
                    content: payload.content,
                    elementType: "design-comparison",
                    metadata: {
                        source: "design-comparison",
                        compareBase: base,
                        compareHead: head,
                        changeId: changeId ?? null,
                    },
                    commentClass: payload.commentClass,
                    severity: payload.severity,
                    mentions: payload.mentions,
                }),
            });
            if (!response.ok) throw new Error(await readApiError(response, "Failed to post comment"));
            tipViewer?.setCommentMode?.(false);
            setShowCommentForm(false);
            setPendingLocation(null);
            setPendingContext(null);
            toast.success("Comment added");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to post comment");
        } finally {
            setIsSubmittingComment(false);
        }
    }, [pendingLocation, pendingContext, projectId, base, head, selectedChanges, tipViewer]);

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b bg-muted/20 px-3 py-1.5">
                <span className="text-xs text-muted-foreground">
                    {selectedChanges.length > 0
                        ? `Highlighting ${selectedChanges.length} selected change${selectedChanges.length === 1 ? "" : "s"}`
                        : `Showing ${visibleChanges.length} visible change${visibleChanges.length === 1 ? "" : "s"}`}
                </span>
                <Button
                    variant={syncCamera ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={onToggleSyncCamera}
                    aria-pressed={syncCamera}
                >
                    {syncCamera ? <Link2 className="mr-2 h-3 w-3" /> : <Unlink className="mr-2 h-3 w-3" />}
                    {syncCamera ? "Cameras synced" : "Cameras independent"}
                </Button>
            </div>
            <div className="flex min-h-0 flex-1">
                <ViewerSideColumn
                    label="Old"
                    sha={base}
                    accent="old"
                    domain={domain}
                    viewerKey={baseViewerKey}
                    sources={baseSources}
                    loaded={baseLoaded}
                    setViewerRef={setBaseViewer}
                    isTip={tipSide === "base"}
                    focused={focusedSide === "base"}
                    onFocusChange={(focused) => handleFocusChange("base", focused)}
                />
                <ViewerSideColumn
                    label="New"
                    sha={head}
                    accent="new"
                    domain={domain}
                    viewerKey={headViewerKey}
                    sources={headSources}
                    loaded={headLoaded}
                    setViewerRef={setHeadViewer}
                    isTip={tipSide === "head"}
                    focused={focusedSide === "head"}
                    onFocusChange={(focused) => handleFocusChange("head", focused)}
                />
            </div>

            <CommentForm
                isOpen={showCommentForm}
                onClose={() => {
                    setShowCommentForm(false);
                    setPendingLocation(null);
                    setPendingContext(null);
                    tipViewer?.setCommentMode?.(false);
                }}
                onSubmit={(payload) => void submitComment(payload)}
                location={pendingLocation}
                context={pendingContext ?? "SCH"}
                isSubmitting={isSubmittingComment}
            />
        </div>
    );
}
