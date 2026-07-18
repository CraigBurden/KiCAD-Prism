import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Crosshair, Layers3, Ruler, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
    CameraState,
    ECadViewerElement,
    EcadMeasurementDetail,
    EcadOverlayPrimitive,
    EcadPcbLayerState,
    EcadReviewItemRule,
    EcadReviewPresentation,
} from "@/types/ecad-viewer";
import type {
    ChangeItem,
    GeometryEntry,
    GeometrySnapshot,
} from "./types";

type Domain = "schematic" | "pcb";
type ViewerBlobSource = { filename: string; content: string };

interface SemanticCompositePanelProps {
    projectId: string;
    domain: Domain;
    base: string;
    compare: string;
    geometry: { base: GeometrySnapshot; head: GeometrySnapshot };
    selectedChanges: ChangeItem[];
    visibleChanges: ChangeItem[];
    selectedPage: string | null;
    initialVisibleLayers: string[];
    onVisibleLayersChange: (layers: string[]) => void;
}

const REVIEW_CHANNEL = "semantic-review-selection";

const isAbortError = (error: unknown): boolean =>
    error instanceof DOMException && error.name === "AbortError";

function resolvedThemeColor(token: "--success" | "--destructive" | "--warning"): string {
    const probe = document.createElement("span");
    probe.style.color = `hsl(var(${token}))`;
    probe.style.display = "none";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
}

function resolveReviewPalette() {
    return {
        added: resolvedThemeColor("--success"),
        removed: resolvedThemeColor("--destructive"),
        changed: resolvedThemeColor("--warning"),
    };
}

function useReviewPalette() {
    const [palette, setPalette] = useState(resolveReviewPalette);
    useEffect(() => {
        const observer = new MutationObserver(() => setPalette(resolveReviewPalette()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);
    return palette;
}

function buildViewerKey(domain: Domain, projectId: string, commit: string) {
    return `semantic-review:${domain}:${projectId}:${commit}`;
}

function useEcadSources(projectId: string, domain: Domain, commit: string) {
    const [sources, setSources] = useState<ViewerBlobSource[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        setSources([]);
        setLoaded(false);
        setError(null);

        const load = async () => {
            try {
                const root = `/api/projects/${projectId}`;
                const query = `commit=${encodeURIComponent(commit)}`;
                const supportResponse = await fetch(`${root}/viewer/support-files?${query}`, { signal });
                const support: ViewerBlobSource[] = supportResponse.ok
                    ? ((await supportResponse.json()) as { files?: ViewerBlobSource[] }).files ?? []
                    : [];
                const collected: ViewerBlobSource[] = [];

                if (domain === "pcb") {
                    const response = await fetch(`${root}/pcb?${query}`, { signal });
                    if (!response.ok) throw new Error(`PCB source failed (${response.status})`);
                    collected.push({ filename: "board.kicad_pcb", content: await response.text() });
                } else {
                    const [rootResponse, subsheetsResponse] = await Promise.all([
                        fetch(`${root}/schematic?${query}`, { signal }),
                        fetch(`${root}/schematic/subsheets?${query}`, { signal }),
                    ]);
                    if (!rootResponse.ok) {
                        throw new Error(`Schematic source failed (${rootResponse.status})`);
                    }
                    collected.push({
                        filename: "root.kicad_sch",
                        content: await rootResponse.text(),
                    });
                    if (subsheetsResponse.ok) {
                        const manifest = (await subsheetsResponse.json()) as {
                            files?: Array<{ name?: string; path?: string; url: string }>;
                        };
                        const settled = await Promise.allSettled(
                            (manifest.files ?? []).map(async (file) => {
                                const response = await fetch(file.url, { signal });
                                if (!response.ok) throw new Error(file.url);
                                return {
                                    filename:
                                        file.path
                                        ?? file.name
                                        ?? file.url.split("/").pop()
                                        ?? "subsheet.kicad_sch",
                                    content: await response.text(),
                                };
                            }),
                        );
                        for (const item of settled) {
                            if (item.status === "fulfilled") collected.push(item.value);
                        }
                    }
                }
                collected.push(...support);
                if (!signal.aborted) setSources(collected);
            } catch (caught) {
                if (!isAbortError(caught) && !signal.aborted) {
                    setError(caught instanceof Error ? caught.message : "Failed to load revision");
                }
            } finally {
                if (!signal.aborted) setLoaded(true);
            }
        };

        void load();
        return () => controller.abort();
    }, [projectId, domain, commit]);

    return { sources, loaded, error };
}

function EcadViewerHost({
    revisionKey,
    sources,
    setViewer,
    onReady,
}: {
    revisionKey: string;
    sources: ViewerBlobSource[];
    setViewer: (viewer: ECadViewerElement | null) => void;
    onReady: (revisionKey: string) => void;
}) {
    const ref = useRef<ECadViewerElement | null>(null);

    const attach = useCallback(
        (viewer: ECadViewerElement | null) => {
            ref.current = viewer;
            setViewer(viewer);
        },
        [setViewer],
    );

    useLayoutEffect(() => {
        const viewer = ref.current;
        if (!viewer || !sources.length) return;
        let cancelled = false;
        void (async () => {
            await customElements.whenDefined("ecad-viewer");
            if (cancelled || !ref.current) return;
            await ref.current.replaceSources({ revisionKey, sources: [sources[0]!] });
            if (sources.length > 1 && !cancelled && ref.current) {
                await ref.current.appendSources({ revisionKey, sources: sources.slice(1) });
            }
            if (!cancelled && ref.current) {
                ref.current.setActive(true);
                await ref.current.ready;
                if (!cancelled) onReady(revisionKey);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [revisionKey, sources, onReady]);

    return (
        <ecad-viewer
            ref={attach}
            style={{ width: "100%", height: "100%" }}
            show-header="false"
            show-selection-panel="false"
            source-mode="host"
        />
    );
}

function sourceId(change: ChangeItem, side: "base" | "compare") {
    if (side === "base") {
        return change.source_id_base ?? change.base_item?.source_id ?? (
            change.kind === "removed" ? change.uuid : null
        );
    }
    return change.source_id_compare ?? change.compare_item?.source_id ?? (
        change.kind !== "removed" ? change.uuid : null
    );
}

export function reviewPresentations(
    domain: Domain,
    changes: ChangeItem[],
    palette: { added: string; removed: string; changed: string },
): { base: EcadReviewPresentation; compare: EcadReviewPresentation } {
    const context = domain === "schematic" ? "SCH" : "PCB";
    const compareRules: EcadReviewItemRule[] = [];
    const baseRules: EcadReviewItemRule[] = [];
    for (const change of changes) {
        const compareId = sourceId(change, "compare");
        const baseId = sourceId(change, "base");
        if (compareId && change.kind !== "removed") {
            compareRules.push({
                uuid: compareId,
                page: change.page ?? undefined,
                inheritChildren: true,
                style: {
                    colorMode: "tint",
                    tint: change.kind === "added" ? palette.added : palette.changed,
                    opacity: 1,
                },
            });
        }
        if (baseId && change.kind !== "added") {
            baseRules.push({
                uuid: baseId,
                page: change.page ?? undefined,
                inheritChildren: true,
                style: {
                    visibility: "visible",
                    colorMode: "tint",
                    tint: palette.removed,
                    opacity: change.kind === "changed" ? 0.78 : 0.95,
                },
            });
        }
    }
    return {
        compare: {
            context,
            background: "transparent",
            defaultStyle: { colorMode: "monochrome", opacity: 0.28 },
            rules: compareRules,
        },
        base: {
            context,
            background: "themed",
            defaultStyle: { visibility: "hidden", opacity: 0 },
            rules: baseRules,
        },
    };
}

function entryPrimitive(
    id: string,
    entry: GeometryEntry,
    color: string,
): EcadOverlayPrimitive | null {
    const anchorPage = entry.page;
    if ((entry.kind === "track" || entry.kind === "wire") && (entry.points?.length ?? 0) >= 2) {
        const [originX, originY] = entry.points![0]!;
        return {
            id,
            kind: "polyline",
            anchor: { kind: "world", x: originX, y: originY, page: anchorPage },
            points: entry.points!.map(([x, y]) => [x - originX, y - originY]),
            stroke: color,
            strokeWidth: (entry.width ?? 0.2) + 0.14,
            dash: [1, 0.55],
            lineCap: "square",
            hitPadding: 0.4,
            sizing: "world",
        };
    }
    if (entry.kind === "arc" && entry.points?.length === 3) {
        const [originX, originY] = entry.points[0]!;
        return {
            id,
            kind: "arc",
            anchor: { kind: "world", x: originX, y: originY, page: anchorPage },
            start: [0, 0],
            mid: [entry.points[1]![0] - originX, entry.points[1]![1] - originY],
            end: [entry.points[2]![0] - originX, entry.points[2]![1] - originY],
            stroke: color,
            strokeWidth: (entry.width ?? 0.2) + 0.14,
            dash: [1, 0.55],
            sizing: "world",
        };
    }
    if (entry.kind === "zone" && (entry.points?.length ?? 0) >= 3) {
        const [originX, originY] = entry.points![0]!;
        return {
            id,
            kind: "polygon",
            anchor: { kind: "world", x: originX, y: originY, page: anchorPage },
            points: entry.points!.map(([x, y]) => [x - originX, y - originY]),
            stroke: color,
            fill: "rgba(0, 0, 0, 0)",
            hatch: { spacing: 1.2, angleDeg: 45, width: 0.12 },
            strokeWidth: 0.2,
            sizing: "world",
        };
    }
    const source = entry.source_id;
    if (source) {
        return {
            id,
            kind: "bbox",
            anchor: { kind: "source-item", uuid: source, page: anchorPage },
            stroke: color,
            strokeWidth: 0.24,
            dash: [1, 0.55],
            padding: 0.6,
            sizing: "world",
        };
    }
    if (entry.bounds) {
        return {
            id,
            kind: "bbox",
            anchor: { kind: "bbox", bounds: entry.bounds, page: anchorPage },
            stroke: color,
            strokeWidth: 0.24,
            dash: [1, 0.55],
            padding: 0.6,
            sizing: "world",
        };
    }
    return null;
}

export function SemanticCompositePanel({
    projectId,
    domain,
    base,
    compare,
    selectedChanges,
    visibleChanges,
    selectedPage,
    initialVisibleLayers,
    onVisibleLayersChange,
}: SemanticCompositePanelProps) {
    const palette = useReviewPalette();
    const [baseViewer, setBaseViewer] = useState<ECadViewerElement | null>(null);
    const [compareViewer, setCompareViewer] = useState<ECadViewerElement | null>(null);
    const [baseReadyRevision, setBaseReadyRevision] = useState<string | null>(null);
    const [compareReadyRevision, setCompareReadyRevision] = useState<string | null>(null);
    const [measurementEnabled, setMeasurementEnabled] = useState(false);
    const [measurement, setMeasurement] = useState<EcadMeasurementDetail | null>(null);
    const [showLayers, setShowLayers] = useState(false);
    const [pcbLayers, setPcbLayers] = useState<EcadPcbLayerState[]>([]);
    const baseSources = useEcadSources(projectId, domain, base);
    const compareSources = useEcadSources(projectId, domain, compare);
    const initialLayerSelection = initialVisibleLayers.join(",");
    const baseRevisionKey = buildViewerKey(domain, projectId, base);
    const compareRevisionKey = buildViewerKey(domain, projectId, compare);
    const presentations = useMemo(
        () => reviewPresentations(domain, visibleChanges, palette),
        [domain, visibleChanges, palette],
    );

    useEffect(() => {
        if (!compareViewer || compareReadyRevision !== compareRevisionKey) return;
        let cancelled = false;
        void (async () => {
            await compareViewer.ready;
            if (!cancelled) await compareViewer.setReviewPresentation(presentations.compare);
        })();
        return () => {
            cancelled = true;
            void compareViewer.clearReviewPresentation();
        };
    }, [
        compareViewer,
        compareReadyRevision,
        compareRevisionKey,
        presentations.compare,
    ]);

    useEffect(() => {
        if (!baseViewer || baseReadyRevision !== baseRevisionKey) return;
        let cancelled = false;
        void (async () => {
            await baseViewer.ready;
            if (!cancelled) await baseViewer.setReviewPresentation(presentations.base);
        })();
        return () => {
            cancelled = true;
            void baseViewer.clearReviewPresentation();
        };
    }, [baseViewer, baseReadyRevision, baseRevisionKey, presentations.base]);

    useEffect(() => {
        if (
            !compareViewer
            || !baseViewer
            || compareReadyRevision !== compareRevisionKey
            || baseReadyRevision !== baseRevisionKey
        ) return;
        let applying = false;
        const synchronize = (event: Event) => {
            if (applying) return;
            const camera = (event as CustomEvent<CameraState>).detail;
            if (!camera) return;
            applying = true;
            baseViewer.camera = camera;
            applying = false;
        };
        compareViewer.addEventListener("camerachange", synchronize as EventListener);
        if (compareViewer.camera) baseViewer.camera = compareViewer.camera;
        return () => compareViewer.removeEventListener("camerachange", synchronize as EventListener);
    }, [
        baseViewer,
        compareViewer,
        baseReadyRevision,
        compareReadyRevision,
        baseRevisionKey,
        compareRevisionKey,
    ]);

    useEffect(() => {
        if (
            domain !== "pcb"
            || !compareViewer
            || compareReadyRevision !== compareRevisionKey
        ) return;
        const refresh = () => {
            const layers = compareViewer.getPcbViewState?.()?.layers ?? [];
            setPcbLayers(layers);
        };
        let cancelled = false;
        void (async () => {
            await compareViewer.ready;
            if (cancelled) return;
            if (initialLayerSelection) {
                const visible = new Set(initialLayerSelection.split(","));
                for (const layer of compareViewer.getPcbViewState?.()?.layers ?? []) {
                    compareViewer.setPcbLayerVisibility?.(layer.name, visible.has(layer.name));
                    baseViewer?.setPcbLayerVisibility?.(layer.name, visible.has(layer.name));
                }
            }
            refresh();
        })();
        compareViewer.addEventListener("ecad-viewer:view-state-change", refresh);
        return () => {
            cancelled = true;
            compareViewer.removeEventListener("ecad-viewer:view-state-change", refresh);
        };
    }, [
        domain,
        compareViewer,
        baseViewer,
        initialLayerSelection,
        compareReadyRevision,
        compareRevisionKey,
    ]);

    useEffect(() => {
        if (
            !selectedPage
            || domain !== "schematic"
            || compareReadyRevision !== compareRevisionKey
            || baseReadyRevision !== baseRevisionKey
        ) return;
        void compareViewer?.showPage?.(selectedPage);
        void baseViewer?.showPage?.(selectedPage);
    }, [
        selectedPage,
        domain,
        baseViewer,
        compareViewer,
        baseReadyRevision,
        compareReadyRevision,
        baseRevisionKey,
        compareRevisionKey,
    ]);

    useEffect(() => {
        const primitives = selectedChanges
            .map((change) => {
                const entry = change.oldGeometry ?? change.geometry;
                return entry ? entryPrimitive(`selected-${change.id}`, entry, palette.removed) : null;
            })
            .filter((primitive): primitive is EcadOverlayPrimitive => primitive !== null);
        baseViewer?.setOverlayScene(REVIEW_CHANNEL, {
            context: domain === "schematic" ? "SCH" : "PCB",
            placement: "foreground",
            visible: true,
            primitives,
            page: domain === "schematic" ? selectedPage ?? undefined : undefined,
        });
        return () => baseViewer?.clearOverlayScene(REVIEW_CHANNEL);
    }, [baseViewer, domain, selectedChanges, selectedPage, palette.removed]);

    useEffect(() => {
        const change = selectedChanges.find((candidate) => (
            sourceId(candidate, "compare")
            || sourceId(candidate, "base")
            || candidate.geometry?.bounds
            || candidate.oldGeometry?.bounds
        ));
        if (!change) return;
        if (
            compareReadyRevision !== compareRevisionKey
            || baseReadyRevision !== baseRevisionKey
        ) return;
        let cancelled = false;
        void (async () => {
            if (domain === "schematic" && selectedPage) {
                await Promise.all([
                    compareViewer?.showPage?.(selectedPage),
                    baseViewer?.showPage?.(selectedPage),
                ]);
                if (cancelled) return;
            }
            if (selectedChanges.length === 1) {
                const selected = selectedChanges[0]!;
                const compareId = sourceId(selected, "compare");
                if (compareId && compareViewer?.focusItem) {
                    await compareViewer.ready;
                    if (!cancelled) {
                        await compareViewer.focusItem(compareId, {
                            select: false,
                            pad: 28,
                        });
                        return;
                    }
                }
                const baseId = sourceId(selected, "base");
                if (baseId && baseViewer?.focusItem) {
                    await baseViewer.ready;
                    if (!cancelled) {
                        await baseViewer.focusItem(baseId, {
                            select: false,
                            pad: 28,
                        });
                        if (baseViewer.camera && compareViewer) {
                            compareViewer.camera = baseViewer.camera;
                        }
                        return;
                    }
                }
            }
            const compareBounds = selectedChanges
                .map((candidate) => candidate.geometry?.bounds)
                .filter((bounds): bounds is [number, number, number, number] => Boolean(bounds));
            const baseBounds = selectedChanges
                .map((candidate) => candidate.oldGeometry?.bounds)
                .filter((bounds): bounds is [number, number, number, number] => Boolean(bounds));
            const union = (
                bounds: Array<[number, number, number, number]>,
            ): [number, number, number, number] | null => {
                if (!bounds.length) return null;
                const minX = Math.min(...bounds.map((item) => item[0]));
                const minY = Math.min(...bounds.map((item) => item[1]));
                const maxX = Math.max(...bounds.map((item) => item[0] + item[2]));
                const maxY = Math.max(...bounds.map((item) => item[1] + item[3]));
                return [minX, minY, maxX - minX, maxY - minY];
            };
            const compareUnion = union(compareBounds);
            if (compareUnion && compareViewer?.focusBBox) {
                await compareViewer.ready;
                if (!cancelled) {
                    await compareViewer.focusBBox(...compareUnion);
                    return;
                }
            }
            const baseUnion = union(baseBounds);
            if (baseUnion && baseViewer?.focusBBox) {
                await baseViewer.ready;
                if (!cancelled) {
                    await baseViewer.focusBBox(...baseUnion);
                    if (baseViewer.camera && compareViewer) compareViewer.camera = baseViewer.camera;
                    return;
                }
            }
            const compareId = sourceId(change, "compare");
            if (compareId && compareViewer?.focusItem) {
                await compareViewer.ready;
                if (!cancelled) await compareViewer.focusItem(compareId, { select: false, pad: 28 });
                return;
            }
            const baseId = sourceId(change, "base");
            if (baseId && baseViewer?.focusItem) {
                await baseViewer.ready;
                if (!cancelled) {
                    await baseViewer.focusItem(baseId, { select: false, pad: 28 });
                    if (baseViewer.camera && compareViewer) compareViewer.camera = baseViewer.camera;
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [
        selectedChanges,
        baseViewer,
        compareViewer,
        baseReadyRevision,
        compareReadyRevision,
        baseRevisionKey,
        compareRevisionKey,
        domain,
        selectedPage,
    ]);

    useEffect(() => {
        if (!compareViewer) return;
        const handleMeasurement = (event: Event) => {
            setMeasurement((event as CustomEvent<EcadMeasurementDetail>).detail);
        };
        compareViewer.addEventListener("ecad-viewer:measurement", handleMeasurement as EventListener);
        return () => compareViewer.removeEventListener("ecad-viewer:measurement", handleMeasurement as EventListener);
    }, [compareViewer]);

    const setMeasurementMode = () => {
        const enabled = !measurementEnabled;
        setMeasurementEnabled(enabled);
        compareViewer?.setMeasurementMode(enabled);
        if (!enabled) {
            compareViewer?.clearMeasurement();
            setMeasurement(null);
        }
    };

    const applyLayerPreset = (
        preset: "front" | "back" | "copper" | "all",
    ) => {
        compareViewer?.applyPcbLayerPreset?.(preset);
        baseViewer?.applyPcbLayerPreset?.(preset);
        window.setTimeout(() => {
            const layers = compareViewer?.getPcbViewState?.()?.layers ?? [];
            setPcbLayers(layers);
            onVisibleLayersChange(
                layers.filter((layer) => layer.visible).map((layer) => layer.name),
            );
        }, 0);
    };

    const setOnlyLayer = (name: string) => {
        const next = pcbLayers.map((layer) => {
            const visible = layer.name === name;
            compareViewer?.setPcbLayerVisibility?.(layer.name, visible);
            baseViewer?.setPcbLayerVisibility?.(layer.name, visible);
            return { ...layer, visible };
        });
        setPcbLayers(next);
        onVisibleLayersChange([name]);
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
                <div className="mr-auto flex min-w-0 items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                        Added
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden />
                        Removed / previous
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-warning" aria-hidden />
                        Modified
                    </span>
                    <span className="hidden text-muted-foreground lg:inline">
                        Unchanged compare content is subdued
                    </span>
                </div>
                {domain === "pcb" && (
                    <>
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
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => applyLayerPreset("all")}
                        >
                            All
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => applyLayerPreset("copper")}
                        >
                            Copper
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => applyLayerPreset("front")}
                        >
                            Front
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => applyLayerPreset("back")}
                        >
                            Back
                        </Button>
                    </>
                )}
                <Button
                    variant={measurementEnabled ? "secondary" : "outline"}
                    size="sm"
                    className="h-8"
                    onClick={setMeasurementMode}
                    aria-pressed={measurementEnabled}
                >
                    <Ruler className="mr-2 h-3.5 w-3.5" />
                    Measure
                </Button>
                {measurement && (
                    <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs tabular-nums">
                        <Crosshair className="h-3.5 w-3.5 text-muted-foreground" />
                        {measurement.distance.toFixed(3)} mm
                        <span className="text-muted-foreground">
                            Δ {measurement.deltaX.toFixed(3)}, {measurement.deltaY.toFixed(3)}
                        </span>
                        <button
                            type="button"
                            className="rounded p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => {
                                compareViewer?.clearMeasurement();
                                setMeasurement(null);
                            }}
                            aria-label="Clear measurement"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
                {compareSources.error || baseSources.error ? (
                    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-destructive">
                        {compareSources.error ?? baseSources.error}
                    </div>
                ) : !compareSources.loaded || !baseSources.loaded ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Loading native revision graphics…
                    </div>
                ) : !compareSources.sources.length || !baseSources.sources.length ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        This domain is not present in both revisions.
                    </div>
                ) : (
                    <>
                        <div className="absolute inset-0">
                            <EcadViewerHost
                                revisionKey={baseRevisionKey}
                                sources={baseSources.sources}
                                setViewer={setBaseViewer}
                                onReady={setBaseReadyRevision}
                            />
                        </div>
                        <div className="absolute inset-0 z-10 bg-transparent">
                            <EcadViewerHost
                                revisionKey={compareRevisionKey}
                                sources={compareSources.sources}
                                setViewer={setCompareViewer}
                                onReady={setCompareReadyRevision}
                            />
                        </div>
                    </>
                )}

                {showLayers && domain === "pcb" && pcbLayers.length > 0 && (
                    <div className="absolute right-3 top-3 z-20 max-h-[70%] w-56 overflow-auto rounded-md border bg-popover p-2 text-popover-foreground shadow-lg">
                        <div className="mb-2 flex items-center justify-between px-1">
                            <span className="text-xs font-semibold">Visible layers</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setShowLayers(false)}
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <div className="space-y-0.5">
                            {pcbLayers.map((layer) => (
                                <div
                                    key={layer.name}
                                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                                >
                                    <input
                                        type="checkbox"
                                        checked={layer.visible}
                                        onChange={(event) => {
                                            compareViewer?.setPcbLayerVisibility?.(layer.name, event.target.checked);
                                            baseViewer?.setPcbLayerVisibility?.(layer.name, event.target.checked);
                                            const next = pcbLayers.map((candidate) =>
                                                candidate.name === layer.name
                                                    ? { ...candidate, visible: event.target.checked }
                                                    : candidate
                                            );
                                            setPcbLayers(next);
                                            onVisibleLayersChange(
                                                next.filter((candidate) => candidate.visible).map((candidate) => candidate.name),
                                            );
                                        }}
                                        className="accent-primary"
                                        aria-label={`Show ${layer.name}`}
                                    />
                                    <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-sm border"
                                        style={{ backgroundColor: layer.color }}
                                        aria-hidden
                                    />
                                    <span className="min-w-0 flex-1 truncate">{layer.name}</span>
                                    <button
                                        type="button"
                                        className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        onClick={() => setOnlyLayer(layer.name)}
                                        aria-label={`Show only ${layer.name}`}
                                    >
                                        Only
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
