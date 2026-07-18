import { useEffect, useMemo, useRef, useState } from "react";
import {
    AlertCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircuitBoard,
    Cpu,
    FileText,
    Layers3,
    Loader2,
    MessageSquare,
    Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchApi, readApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CATEGORY_META, mergedKind, type Category, type DiffKind } from "@/lib/diff-grouping";
import { SemanticCompositePanel } from "./semantic-composite-panel";
import { BomPanel } from "./bom-panel";
import { StackupPanel } from "./stackup-panel";
import { ComparisonDiscussionRail } from "./comparison-discussion-rail";
import type { Comment, CommentsFile } from "@/types/comments";
import type {
    ChangeItem,
    ChangeKind,
    DesignCompareJobStatus,
    DesignCompareResult,
    RouteMetrics,
} from "./types";

type WorkspaceTab = "sch" | "pcb" | "bom" | "stackup";

interface DesignComparisonWorkspaceProps {
    projectId: string;
    base: string;
    head: string;
    branchTipSha: string | null;
    canComment: boolean;
    onClose: () => void;
}

interface ChangeGroup {
    id: string;
    category: Category;
    kind: DiffKind;
    label: string;
    classification: "primary" | "secondary";
    unresolvedCount: number;
    changes: ChangeItem[];
}

interface SemanticFocus {
    semanticId?: string | null;
    reference?: string | null;
    net?: string | null;
}

const STATUS_META: Array<{
    id: ChangeKind;
    label: string;
    marker: string;
}> = [
    { id: "added", label: "Added", marker: "bg-success" },
    { id: "changed", label: "Modified", marker: "bg-warning" },
    { id: "removed", label: "Removed", marker: "bg-destructive" },
];

function normalizeCategory(category: string): Category {
    if (category === "board") return "other";
    return category in CATEGORY_META ? (category as Category) : "other";
}

export function groupChanges(changes: ChangeItem[], comments: Comment[]): ChangeGroup[] {
    const buckets = new Map<string, ChangeGroup>();
    for (const change of changes) {
        const category = normalizeCategory(change.category);
        const identity =
            change.semantic_id
            ?? change.reference
            ?? change.net
            ?? change.geometry?.semantic_id
            ?? change.oldGeometry?.semantic_id
            ?? change.id;
        const key = `${change.domain}:${category}:${identity}`;
        const existing = buckets.get(key);
        if (existing) {
            existing.changes.push(change);
            if (change.classification !== "secondary") existing.classification = "primary";
        } else {
            buckets.set(key, {
                id: key,
                category,
                kind: change.kind,
                label: change.label,
                classification: change.classification ?? "primary",
                unresolvedCount: comments.filter((comment) => (
                    comment.status === "OPEN" && comment.semanticItemId === key
                )).length,
                changes: [change],
            });
        }
    }
    const groups = [...buckets.values()];
    for (const group of groups) {
        group.kind = mergedKind(group.changes.map((change) => change.kind));
        if (group.changes.length > 1) {
            group.label = `${group.label} — ${group.changes.length} changes`;
        }
    }
    return groups.sort((left, right) => {
        const categoryOrder = CATEGORY_META[left.category].order - CATEGORY_META[right.category].order;
        return categoryOrder || left.label.localeCompare(right.label);
    });
}

export function readInitialUrlState(search = window.location.search) {
    const params = new URLSearchParams(search);
    const rawTab = params.get("diff");
    const activeTab: WorkspaceTab =
        rawTab === "pcb" || rawTab === "bom" || rawTab === "stackup"
            ? rawTab
            : "sch";
    return {
        activeTab,
        selectedChangeId: params.get("item"),
        showSecondary: params.get("secondary") === "1",
        layers: (params.get("layers") ?? "").split(",").filter(Boolean),
    };
}

function DifferencesPane({
    groups,
    statuses,
    onToggleStatus,
    search,
    onSearchChange,
    showSecondary,
    onShowSecondaryChange,
    selectedChangeId,
    onSelectChange,
    onPrevious,
    onNext,
    routeMetrics,
}: {
    groups: ChangeGroup[];
    statuses: Set<ChangeKind>;
    onToggleStatus: (kind: ChangeKind) => void;
    search: string;
    onSearchChange: (value: string) => void;
    showSecondary: boolean;
    onShowSecondaryChange: (value: boolean) => void;
    selectedChangeId: string | null;
    onSelectChange: (change: ChangeItem) => void;
    onPrevious: () => void;
    onNext: () => void;
    routeMetrics?: { base?: RouteMetrics; compare?: RouteMetrics } | null;
}) {
    const selectedGroup = groups.find((group) =>
        group.changes.some((change) => change.id === selectedChangeId)
    );
    const byCategory = useMemo(() => {
        const result = new Map<Category, ChangeGroup[]>();
        for (const group of groups) {
            const list = result.get(group.category) ?? [];
            list.push(group);
            result.set(group.category, list);
        }
        return result;
    }, [groups]);

    return (
        <aside className="flex h-full w-80 shrink-0 flex-col border-r bg-background max-md:w-64">
            <div className="space-y-2 border-b p-2">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search changes, nets, references…"
                        className="pl-8"
                    />
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {STATUS_META.map((status) => (
                        <Button
                            key={status.id}
                            variant={statuses.has(status.id) ? "secondary" : "outline"}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => onToggleStatus(status.id)}
                            aria-pressed={statuses.has(status.id)}
                        >
                            <span className={cn("mr-1.5 h-2 w-2 rounded-full", status.marker)} />
                            {status.label}
                        </Button>
                    ))}
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-muted-foreground hover:text-foreground">
                    <input
                        type="checkbox"
                        checked={showSecondary}
                        onChange={(event) => onShowSecondaryChange(event.target.checked)}
                        className="accent-primary"
                    />
                    Show secondary graphics and generated noise
                </label>
            </div>

            <div className="flex items-center justify-between border-b px-2 py-1.5">
                <span className="text-[11px] text-muted-foreground">
                    {groups.length} group{groups.length === 1 ? "" : "s"}
                </span>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onPrevious}
                        disabled={!groups.length}
                        aria-label="Previous change"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onNext}
                        disabled={!groups.length}
                        aria-label="Next change"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-2">
                {!groups.length ? (
                    <p className="px-3 py-10 text-center text-xs text-muted-foreground">
                        No differences match these filters.
                    </p>
                ) : (
                    [...byCategory.entries()]
                        .sort(([left], [right]) => CATEGORY_META[left].order - CATEGORY_META[right].order)
                        .map(([category, categoryGroups]) => (
                            <section key={category} className="mb-3">
                                <h3 className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {CATEGORY_META[category].label}
                                </h3>
                                <div className="space-y-0.5">
                                    {categoryGroups.map((group) => {
                                        const expanded = selectedGroup?.id === group.id;
                                        const status = STATUS_META.find((item) => item.id === group.kind)!;
                                        return (
                                            <div key={group.id}>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        "flex w-full items-center gap-2 border-l-2 px-2 py-2 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                        expanded
                                                            ? "border-primary bg-accent text-accent-foreground"
                                                            : "border-transparent",
                                                    )}
                                                    onClick={() => onSelectChange(group.changes[0]!)}
                                                >
                                                    {expanded
                                                        ? <ChevronDown className="h-3 w-3 shrink-0" />
                                                        : <ChevronRight className="h-3 w-3 shrink-0" />}
                                                    <span className={cn("h-2 w-2 shrink-0 rounded-full", status.marker)} />
                                                    <span className="min-w-0 flex-1 truncate">{group.label}</span>
                                                    {group.classification === "secondary" && (
                                                        <span className="rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground">
                                                            secondary
                                                        </span>
                                                    )}
                                                    {!!group.unresolvedCount && (
                                                        <span className="rounded-full bg-destructive/15 px-1.5 text-[9px] text-destructive">
                                                            {group.unresolvedCount}
                                                        </span>
                                                    )}
                                                </button>
                                                {expanded && (
                                                    <div className="ml-5 border-l py-1 pl-2">
                                                        {group.changes.map((change) => (
                                                            <button
                                                                key={change.id}
                                                                type="button"
                                                                onClick={() => onSelectChange(change)}
                                                                className={cn(
                                                                    "block w-full truncate rounded px-2 py-1.5 text-left text-[11px] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                                    selectedChangeId === change.id && "bg-primary/10 text-primary",
                                                                )}
                                                            >
                                                                {change.geometry?.kind
                                                                    ?? change.oldGeometry?.kind
                                                                    ?? change.label}
                                                                {change.layers?.length
                                                                    ? ` · ${change.layers.join(", ")}`
                                                                    : ""}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        ))
                )}
            </div>

            {selectedGroup && (
                <div className="max-h-48 overflow-auto border-t bg-muted/10 p-3 text-xs">
                    <div className="font-medium">{selectedGroup.label}</div>
                    {routeMetrics && (
                        <div className="mt-2 rounded border bg-background/60 p-2">
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 tabular-nums">
                                <span className="text-muted-foreground">Routing</span>
                                <span className="text-muted-foreground">Base</span>
                                <span className="text-muted-foreground">Compare</span>
                                <span>Length</span>
                                <span>{routeMetrics.base?.centerline_length_mm.toFixed(3) ?? "—"} mm</span>
                                <span>{routeMetrics.compare?.centerline_length_mm.toFixed(3) ?? "—"} mm</span>
                                <span>Vias</span>
                                <span>{routeMetrics.base?.via_count ?? "—"}</span>
                                <span>{routeMetrics.compare?.via_count ?? "—"}</span>
                                <span>Barrel</span>
                                <span>
                                    {routeMetrics.base?.via_barrel_length_mm?.toFixed(3) ?? "N/A"}
                                </span>
                                <span>
                                    {routeMetrics.compare?.via_barrel_length_mm?.toFixed(3) ?? "N/A"}
                                </span>
                            </div>
                            <p className="mt-1.5 text-[10px] text-muted-foreground">
                                Propagation delay is not available; Prism does not estimate it.
                            </p>
                        </div>
                    )}
                    {Object.entries(
                        selectedGroup.changes.find((change) => change.id === selectedChangeId)?.fields ?? {},
                    ).map(([field, value]) => (
                        <div key={field} className="mt-2 grid grid-cols-[5rem_1fr] gap-2">
                            <span className="text-muted-foreground">{field}</span>
                            <span className="break-words font-mono text-[10px]">
                                {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </aside>
    );
}

export function DesignComparisonWorkspace({
    projectId,
    base,
    head,
    branchTipSha,
    canComment,
    onClose,
}: DesignComparisonWorkspaceProps) {
    const initial = useMemo(readInitialUrlState, []);
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<DesignCompareJobStatus | null>(null);
    const [result, setResult] = useState<DesignCompareResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>(initial.activeTab);
    const [statuses, setStatuses] = useState<Set<ChangeKind>>(
        () => new Set(["added", "changed", "removed"]),
    );
    const [search, setSearch] = useState("");
    const [showSecondary, setShowSecondary] = useState(initial.showSecondary);
    const [selectedChangeId, setSelectedChangeId] = useState<string | null>(
        initial.selectedChangeId,
    );
    const [selectedPage, setSelectedPage] = useState<string | null>(null);
    const [visibleLayers, setVisibleLayers] = useState<string[]>(initial.layers);
    const [comments, setComments] = useState<Comment[]>([]);
    const [showDiscussion, setShowDiscussion] = useState(
        () => !window.matchMedia("(max-width: 1023px)").matches,
    );
    const jobIdRef = useRef<string | null>(null);
    const semanticFocusRef = useRef<SemanticFocus | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            try {
                const response = await fetchApi(`/api/projects/${projectId}/design-compare`, {
                    method: "POST",
                    body: JSON.stringify({ base, head, include_unchanged: true }),
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(await readApiError(response, "Failed to start semantic comparison"));
                }
                const data = (await response.json()) as { job_id: string };
                jobIdRef.current = data.job_id;
                setJobId(data.job_id);
            } catch (caught) {
                if (caught instanceof DOMException && caught.name === "AbortError") return;
                setError(caught instanceof Error ? caught.message : "Failed to start semantic comparison");
            }
        })();
        return () => controller.abort();
    }, [projectId, base, head]);

    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            const params = new URLSearchParams({ base, compare: head });
            const response = await fetchApi(
                `/api/projects/${projectId}/comparison-comments?${params}`,
                { signal: controller.signal },
            );
            if (!response.ok) return;
            const payload = (await response.json()) as CommentsFile;
            if (!controller.signal.aborted) setComments(payload.comments ?? []);
        })();
        return () => controller.abort();
    }, [projectId, base, head]);

    useEffect(() => {
        if (!jobId || result) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const poll = async () => {
            try {
                const response = await fetchApi(`/api/projects/${projectId}/design-compare/${jobId}/status`);
                if (!response.ok) throw new Error(await readApiError(response, "Failed to poll comparison"));
                const status = (await response.json()) as DesignCompareJobStatus;
                if (cancelled) return;
                setJobStatus(status);
                if (status.status === "failed") {
                    setError(status.message || "Semantic comparison failed");
                } else if (status.status === "completed") {
                    const resultResponse = await fetchApi(
                        `/api/projects/${projectId}/design-compare/${jobId}`,
                    );
                    if (!resultResponse.ok) {
                        throw new Error(await readApiError(resultResponse, "Failed to load comparison"));
                    }
                    if (!cancelled) setResult((await resultResponse.json()) as DesignCompareResult);
                } else {
                    timer = setTimeout(poll, 800);
                }
            } catch (caught) {
                if (!cancelled) {
                    setError(caught instanceof Error ? caught.message : "Failed to load semantic comparison");
                }
            }
        };
        void poll();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [jobId, projectId, result]);

    useEffect(() => {
        return () => {
            const id = jobIdRef.current;
            if (id) void fetchApi(`/api/projects/${projectId}/design-compare/${id}`, { method: "DELETE" });
        };
    }, [projectId]);

    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("section", "history");
        url.searchParams.set("base", base);
        url.searchParams.set("compare", head);
        url.searchParams.set("view", "semantic");
        url.searchParams.set("diff", activeTab);
        if (selectedChangeId) url.searchParams.set("item", selectedChangeId);
        else url.searchParams.delete("item");
        if (showSecondary) url.searchParams.set("secondary", "1");
        else url.searchParams.delete("secondary");
        if (visibleLayers.length) url.searchParams.set("layers", visibleLayers.join(","));
        else url.searchParams.delete("layers");
        window.history.replaceState(window.history.state, "", url);
    }, [base, head, activeTab, selectedChangeId, showSecondary, visibleLayers]);

    useEffect(() => {
        const handlePopState = () => {
            const next = readInitialUrlState();
            setActiveTab(next.activeTab);
            setSelectedChangeId(next.selectedChangeId);
            setShowSecondary(next.showSecondary);
            setVisibleLayers(next.layers);
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    const domain = activeTab === "pcb" ? "pcb" : "schematic";
    const domainChanges = useMemo(() => {
        if (!result) return [];
        return activeTab === "sch"
            ? result.schematic.changes
            : activeTab === "pcb"
                ? result.pcb.changes
                : [];
    }, [result, activeTab]);
    const filteredChanges = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return domainChanges.filter((change) => {
            if (!statuses.has(change.kind)) return false;
            if (!showSecondary && change.classification === "secondary") return false;
            if (!query) return true;
            return [
                change.label,
                change.reference,
                change.net,
                change.category,
                ...(change.layers ?? []),
            ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
        });
    }, [domainChanges, statuses, showSecondary, search]);
    const groups = useMemo(
        () => groupChanges(filteredChanges, comments),
        [filteredChanges, comments],
    );
    const selectedChange = useMemo(
        () => domainChanges.find((change) => change.id === selectedChangeId) ?? null,
        [domainChanges, selectedChangeId],
    );
    const selectedGroupChanges = useMemo(
        () => groups.find((group) =>
            group.changes.some((change) => change.id === selectedChangeId)
        )?.changes ?? (selectedChange ? [selectedChange] : []),
        [groups, selectedChange, selectedChangeId],
    );
    const selectedGroup = useMemo(
        () => groups.find((group) =>
            group.changes.some((change) => change.id === selectedChangeId)
        ) ?? null,
        [groups, selectedChangeId],
    );
    const selectedRouteMetrics = useMemo(() => {
        if (activeTab !== "pcb" || !selectedChange?.net || !result?.pcb.route_metrics) {
            return null;
        }
        return {
            base: result.pcb.route_metrics.base[selectedChange.net],
            compare: result.pcb.route_metrics.compare[selectedChange.net],
        };
    }, [activeTab, result, selectedChange]);

    const selectChange = (change: ChangeItem) => {
        semanticFocusRef.current = {
            semanticId: change.semantic_id,
            reference: change.reference,
            net: change.net,
        };
        setSelectedChangeId(change.id);
        setSelectedPage(change.page ?? null);
    };

    useEffect(() => {
        // Preserve a deep-linked semantic item while the asynchronous comparison
        // manifest is still loading. Clearing it against an empty domain would
        // lose the exact page/object focus before the result becomes available.
        if (!result) return;
        const current = domainChanges.find((change) => change.id === selectedChangeId);
        if (current) {
            semanticFocusRef.current = {
                semanticId: current.semantic_id,
                reference: current.reference,
                net: current.net,
            };
            setSelectedPage(current.page ?? null);
            return;
        }
        const focus = semanticFocusRef.current;
        const counterpart = focus
            ? domainChanges.find((change) => (
                (focus.semanticId && change.semantic_id === focus.semanticId)
                || (focus.reference && change.reference === focus.reference)
                || (focus.net && change.net === focus.net)
            ))
            : null;
        if (counterpart) {
            setSelectedChangeId(counterpart.id);
            setSelectedPage(counterpart.page ?? null);
        } else {
            setSelectedChangeId(null);
            setSelectedPage(null);
        }
    }, [activeTab, domainChanges, result, selectedChangeId]);

    const navigate = (direction: -1 | 1) => {
        if (!groups.length) return;
        const current = groups.findIndex((group) =>
            group.changes.some((change) => change.id === selectedChangeId)
        );
        const next = current < 0
            ? 0
            : (current + direction + groups.length) % groups.length;
        selectChange(groups[next]!.changes[0]!);
    };

    const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof Cpu; badge?: number }> = [
        {
            id: "sch",
            label: "Schematic",
            icon: Cpu,
            badge: result
                ? result.schematic.summary.added
                    + result.schematic.summary.removed
                    + result.schematic.summary.changed
                : undefined,
        },
        {
            id: "pcb",
            label: "PCB",
            icon: CircuitBoard,
            badge: result
                ? result.pcb.summary.added + result.pcb.summary.removed + result.pcb.summary.changed
                : undefined,
        },
        {
            id: "bom",
            label: "BOM",
            icon: FileText,
            badge: result?.bom
                ? result.bom.summary.added + result.bom.summary.removed + result.bom.summary.changed
                : undefined,
        },
        { id: "stackup", label: "Stackup", icon: Layers3, badge: result?.stackup.changed ? 1 : undefined },
    ];

    const branchTipLabel = branchTipSha === head
        ? "Compare revision is branch tip"
        : branchTipSha === base
            ? "Base revision is branch tip"
            : null;

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex h-[96vh] w-[98vw] max-w-none flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <DialogTitle>Semantic design review</DialogTitle>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="rounded border bg-muted px-2 py-1 font-mono">
                                Base {base.slice(0, 10)}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5" />
                            <span className="rounded border bg-primary/10 px-2 py-1 font-mono text-primary">
                                Compare {head.slice(0, 10)}
                            </span>
                            {branchTipLabel && (
                                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary">
                                    {branchTipLabel}
                                </span>
                            )}
                        </div>
                    </div>
                    <DialogDescription className="sr-only">
                        Compare schematic, PCB, BOM, and stackup changes between two immutable revisions.
                    </DialogDescription>
                </DialogHeader>

                {result ? (
                    <div className="flex min-h-0 flex-1 flex-col">
                        <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b bg-muted/20 px-2 py-1">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <Button
                                        key={tab.id}
                                        variant={activeTab === tab.id ? "secondary" : "ghost"}
                                        size="sm"
                                        onClick={() => setActiveTab(tab.id)}
                                        className="h-8 text-xs"
                                        aria-pressed={activeTab === tab.id}
                                    >
                                        <Icon className="mr-2 h-3.5 w-3.5" />
                                        {tab.label}
                                        {!!tab.badge && (
                                            <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                                                {tab.badge}
                                            </span>
                                        )}
                                    </Button>
                                );
                            })}
                            <Button
                                variant={showDiscussion ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setShowDiscussion((value) => !value)}
                                className="ml-auto h-8 text-xs"
                                aria-pressed={showDiscussion}
                            >
                                <MessageSquare className="mr-2 h-3.5 w-3.5" />
                                Discussion
                                {!!comments.filter((comment) => comment.status === "OPEN").length && (
                                    <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px]">
                                        {comments.filter((comment) => comment.status === "OPEN").length}
                                    </span>
                                )}
                            </Button>
                        </nav>

                        <div className="flex min-h-0 flex-1">
                            {(activeTab === "sch" || activeTab === "pcb") && (
                                <>
                                    <DifferencesPane
                                        groups={groups}
                                        statuses={statuses}
                                        onToggleStatus={(kind) => {
                                            setStatuses((current) => {
                                                const next = new Set(current);
                                                if (next.has(kind)) next.delete(kind);
                                                else next.add(kind);
                                                return next;
                                            });
                                        }}
                                        search={search}
                                        onSearchChange={setSearch}
                                        showSecondary={showSecondary}
                                        onShowSecondaryChange={setShowSecondary}
                                        selectedChangeId={selectedChangeId}
                                        onSelectChange={selectChange}
                                        onPrevious={() => navigate(-1)}
                                        onNext={() => navigate(1)}
                                        routeMetrics={selectedRouteMetrics}
                                    />
                                    <SemanticCompositePanel
                                        projectId={projectId}
                                        domain={domain}
                                        base={base}
                                        compare={head}
                                        geometry={result.geometry}
                                        selectedChanges={selectedGroupChanges}
                                        visibleChanges={filteredChanges}
                                        selectedPage={selectedPage}
                                        initialVisibleLayers={visibleLayers}
                                        onVisibleLayersChange={setVisibleLayers}
                                    />
                                </>
                            )}
                            {activeTab === "bom" && <BomPanel bom={result.bom} />}
                            {activeTab === "stackup" && <StackupPanel stackup={result.stackup} />}
                            {showDiscussion && (
                                <ComparisonDiscussionRail
                                    projectId={projectId}
                                    base={base}
                                    compare={head}
                                    domain={activeTab === "pcb" || activeTab === "stackup" ? "PCB" : "SCH"}
                                    anchor={selectedGroup
                                        ? {
                                            id: selectedGroup.id,
                                            label: selectedGroup.label,
                                            page: selectedChange?.page,
                                        }
                                        : null}
                                    comments={comments}
                                    canComment={canComment}
                                    onCommentsChange={setComments}
                                    onClose={() => setShowDiscussion(false)}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
                        {error ? (
                            <div className="max-w-md text-center text-destructive">
                                <AlertCircle className="mx-auto mb-4 h-10 w-10" />
                                <h3 className="text-base font-semibold">Semantic comparison failed</h3>
                                <p className="mt-2 text-sm">{error}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-center">
                                <Loader2 className="h-9 w-9 animate-spin text-primary" />
                                <div>
                                    <h3 className="text-sm font-medium">
                                        {jobStatus?.message || "Starting semantic comparison…"}
                                    </h3>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Source files are read from immutable Git objects; the checkout is unchanged.
                                    </p>
                                </div>
                                {jobStatus?.percent != null && (
                                    <div className="h-1.5 w-64 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full bg-primary transition-all"
                                            style={{ width: `${jobStatus.percent}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
