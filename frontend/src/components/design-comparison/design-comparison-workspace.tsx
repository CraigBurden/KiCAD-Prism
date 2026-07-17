import { useEffect, useMemo, useRef, useState } from "react";
import {
    AlertCircle,
    ChevronRight,
    Cpu,
    CircuitBoard,
    FileText,
    Layers3,
    Loader2,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApi, readApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CATEGORY_META, mergedKind, type Category, type DiffKind } from "@/lib/diff-grouping";
import { DualEcadPanel } from "./dual-ecad-panel";
import { BomPanel } from "./bom-panel";
import { StackupPanel } from "./stackup-panel";
import type { ChangeItem, DesignCompareJobStatus, DesignCompareResult, ViewerSide } from "./types";

type WorkspaceTab = "sch" | "pcb" | "bom" | "stackup";
type ChangeFilter = "all" | "added" | "changed" | "removed";

interface DesignComparisonWorkspaceProps {
    projectId: string;
    base: string;
    head: string;
    branchTipSha: string | null;
    onClose: () => void;
}

interface ChangeGroup {
    id: string;
    category: Category;
    kind: DiffKind;
    label: string;
    changes: ChangeItem[];
}

function normalizeCategory(category: string): Category {
    return category in CATEGORY_META ? (category as Category) : "other";
}

/** Groups changes by category, sub-grouping "nets" by net key (matching the
 * shared taxonomy from `@/lib/diff-grouping`) so many track/wire changes on
 * the same net collapse into one entry, mirroring the history-viewer summary
 * chips. Labels reuse the backend's per-change label (already descriptive)
 * rather than re-deriving them, since ChangeItem doesn't carry the raw
 * component/net field shape `categorise()` expects. */
function groupChanges(changes: ChangeItem[]): ChangeGroup[] {
    const buckets = new Map<string, ChangeGroup>();
    for (const change of changes) {
        const category = normalizeCategory(change.category);
        const netKey = category === "nets" ? (change.net ?? change.geometry?.net ?? change.oldGeometry?.net) : undefined;
        const subKey = netKey || change.id;
        const bucketKey = `${change.domain}:${category}:${subKey}`;
        let bucket = buckets.get(bucketKey);
        if (!bucket) {
            bucket = { id: bucketKey, category, kind: change.kind, label: "", changes: [] };
            buckets.set(bucketKey, bucket);
        }
        bucket.changes.push(change);
    }

    const groups = Array.from(buckets.values());
    for (const group of groups) {
        group.kind = mergedKind(group.changes.map((c) => c.kind));
        if (group.changes.length === 1) {
            group.label = group.changes[0]!.label;
        } else {
            const netLabel = group.changes[0]!.net ?? group.changes[0]!.label;
            group.label = `${netLabel} — ${group.changes.length} changes`;
        }
    }

    groups.sort((a, b) => {
        const orderDiff = CATEGORY_META[a.category].order - CATEGORY_META[b.category].order;
        if (orderDiff !== 0) return orderDiff;
        return a.label.localeCompare(b.label);
    });
    return groups;
}

const KIND_DOT: Record<DiffKind, string> = {
    added: "bg-green-500",
    removed: "bg-red-500",
    changed: "bg-amber-500",
};

const FILTERS: { id: ChangeFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "added", label: "Added" },
    { id: "changed", label: "Modified" },
    { id: "removed", label: "Removed" },
];

function DifferencesPane({
    groups,
    filter,
    onFilterChange,
    summary,
    selectedGroupId,
    onSelectGroup,
    onAlsoOnPage,
    currentPage,
}: {
    groups: ChangeGroup[];
    filter: ChangeFilter;
    onFilterChange: (filter: ChangeFilter) => void;
    summary: { added: number; removed: number; changed: number };
    selectedGroupId: string | null;
    onSelectGroup: (group: ChangeGroup) => void;
    onAlsoOnPage: (page: string) => void;
    currentPage: string | null;
}) {
    const byCategory = useMemo(() => {
        const out = new Map<Category, ChangeGroup[]>();
        for (const group of groups) {
            const list = out.get(group.category) ?? [];
            list.push(group);
            out.set(group.category, list);
        }
        return out;
    }, [groups]);

    return (
        <div className="flex h-full w-80 shrink-0 flex-col border-r">
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b p-2">
                {FILTERS.map((f) => {
                    const count = f.id === "all"
                        ? summary.added + summary.removed + summary.changed
                        : summary[f.id as keyof typeof summary] ?? 0;
                    return (
                        <Button
                            key={f.id}
                            variant={filter === f.id ? "secondary" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onFilterChange(f.id)}
                        >
                            {f.label}
                            <span className="ml-1.5 text-[10px] text-muted-foreground">{count}</span>
                        </Button>
                    );
                })}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
                {groups.length === 0 ? (
                    <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                        No changes match the selected filter
                    </p>
                ) : (
                    Array.from(byCategory.entries())
                        .sort(([a], [b]) => CATEGORY_META[a].order - CATEGORY_META[b].order)
                        .map(([category, categoryGroups]) => (
                            <div key={category} className="mb-3">
                                <h4 className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {CATEGORY_META[category].label}
                                </h4>
                                <div className="space-y-0.5">
                                    {categoryGroups.map((group) => {
                                        const singleChange = group.changes.length === 1 ? group.changes[0] : null;
                                        const otherPages = singleChange?.alsoOnPages?.filter((p) => p && p !== currentPage) ?? [];
                                        return (
                                            <div key={group.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectGroup(group)}
                                                    className={cn(
                                                        "flex w-full items-center gap-2 rounded-none border-l-2 px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent",
                                                        selectedGroupId === group.id
                                                            ? "border-primary bg-accent text-accent-foreground"
                                                            : "border-transparent",
                                                    )}
                                                >
                                                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", KIND_DOT[group.kind])} />
                                                    <span className="min-w-0 flex-1 truncate">{group.label}</span>
                                                    {group.changes.length > 1 && (
                                                        <span className="shrink-0 text-[10px] text-muted-foreground">
                                                            {group.changes.length}
                                                        </span>
                                                    )}
                                                </button>
                                                {otherPages.length > 0 && (
                                                    <div className="ml-6 mt-0.5 flex flex-wrap gap-1 pb-1">
                                                        <span className="text-[10px] text-muted-foreground">Also on:</span>
                                                        {otherPages.map((page) => (
                                                            <button
                                                                key={page}
                                                                type="button"
                                                                onClick={() => onAlsoOnPage(page)}
                                                                className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                            >
                                                                <ChevronRight className="h-2.5 w-2.5" />
                                                                {page}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                )}
            </div>
        </div>
    );
}

export function DesignComparisonWorkspace({ projectId, base, head, branchTipSha, onClose }: DesignComparisonWorkspaceProps) {
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<DesignCompareJobStatus | null>(null);
    const [result, setResult] = useState<DesignCompareResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<WorkspaceTab>("sch");
    const [filter, setFilter] = useState<ChangeFilter>("all");
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedPage, setSelectedPage] = useState<string | null>(null);
    const [syncCamera, setSyncCamera] = useState(true);

    const jobIdRef = useRef<string | null>(null);

    // Start the comparison job on mount.
    useEffect(() => {
        const controller = new AbortController();
        const startJob = async () => {
            try {
                const response = await fetchApi(`/api/projects/${projectId}/design-compare`, {
                    method: "POST",
                    body: JSON.stringify({ base, head }),
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error(await readApiError(response, "Failed to start design comparison"));
                const data = await response.json() as { job_id: string };
                jobIdRef.current = data.job_id;
                setJobId(data.job_id);
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setError(err instanceof Error ? err.message : "Failed to start design comparison");
            }
        };
        void startJob();
        return () => controller.abort();
    }, [projectId, base, head]);

    // Poll job status until completed/failed.
    useEffect(() => {
        if (!jobId || result) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const poll = async () => {
            try {
                const response = await fetchApi(`/api/projects/${projectId}/design-compare/${jobId}/status`);
                if (!response.ok) throw new Error(await readApiError(response, "Failed to poll comparison status"));
                const data = await response.json() as DesignCompareJobStatus;
                if (cancelled) return;
                setJobStatus(data);
                if (data.status === "failed") {
                    setError(data.message || "Design comparison failed");
                    return;
                }
                if (data.status === "completed") {
                    const resultResponse = await fetchApi(`/api/projects/${projectId}/design-compare/${jobId}`);
                    if (!resultResponse.ok) throw new Error(await readApiError(resultResponse, "Failed to load comparison result"));
                    if (cancelled) return;
                    setResult(await resultResponse.json() as DesignCompareResult);
                    return;
                }
                timer = setTimeout(poll, 1000);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load design comparison");
            }
        };

        void poll();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [jobId, projectId, result]);

    // Clean up the backend job on unmount.
    useEffect(() => {
        return () => {
            const id = jobIdRef.current;
            if (id) void fetchApi(`/api/projects/${projectId}/design-compare/${id}`, { method: "DELETE" });
        };
    }, [projectId]);

    // Reset selection state when switching domain tabs.
    useEffect(() => {
        setSelectedGroupId(null);
        setSelectedPage(null);
        setFilter("all");
    }, [activeTab]);

    const tipSide: ViewerSide | null = useMemo(() => {
        if (!branchTipSha) return null;
        if (branchTipSha === head) return "head";
        if (branchTipSha === base) return "base";
        return null;
    }, [branchTipSha, base, head]);

    const domain: "schematic" | "pcb" = activeTab === "pcb" ? "pcb" : "schematic";
    const domainChanges = useMemo(() => {
        if (!result) return [];
        return activeTab === "sch" ? result.schematic.changes : activeTab === "pcb" ? result.pcb.changes : [];
    }, [result, activeTab]);

    const domainSummary = useMemo(() => {
        if (!result) return { added: 0, removed: 0, changed: 0 };
        return activeTab === "sch" ? result.schematic.summary : activeTab === "pcb" ? result.pcb.summary : { added: 0, removed: 0, changed: 0 };
    }, [result, activeTab]);

    const filteredChanges = useMemo(() => {
        if (filter === "all") return domainChanges;
        return domainChanges.filter((c) => c.kind === filter);
    }, [domainChanges, filter]);

    const groups = useMemo(() => groupChanges(filteredChanges), [filteredChanges]);

    const selectedGroup = useMemo(
        () => groups.find((g) => g.id === selectedGroupId) ?? null,
        [groups, selectedGroupId],
    );
    const selectedChanges = selectedGroup?.changes ?? [];

    const handleSelectGroup = (group: ChangeGroup) => {
        setSelectedGroupId((prev) => (prev === group.id ? null : group.id));
        const page = group.changes.find((c) => c.page)?.page;
        if (page) setSelectedPage(page);
    };

    const tabs: { id: WorkspaceTab; label: string; icon: typeof Cpu; badge?: number }[] = [
        { id: "sch", label: "Schematic", icon: Cpu, badge: result ? result.schematic.summary.added + result.schematic.summary.removed + result.schematic.summary.changed : undefined },
        { id: "pcb", label: "PCB", icon: CircuitBoard, badge: result ? result.pcb.summary.added + result.pcb.summary.removed + result.pcb.summary.changed : undefined },
        { id: "bom", label: "BOM", icon: FileText, badge: result?.bom ? result.bom.summary.added + result.bom.summary.removed + result.bom.summary.changed : undefined },
        { id: "stackup", label: "Stackup", icon: Layers3, badge: result?.stackup.changed ? 1 : undefined },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="flex h-[95vh] w-[98vw] flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
                <div className="flex shrink-0 items-center justify-between border-b p-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold">Design Comparison</h2>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="rounded border border-red-200 bg-red-100 px-2 py-0.5 text-red-700">
                                {base.slice(0, 7)} (Old)
                            </span>
                            <span>vs</span>
                            <span className="rounded border border-green-200 bg-green-100 px-2 py-0.5 text-green-700">
                                {head.slice(0, 7)} (New)
                            </span>
                            {tipSide && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    Branch tip: {tipSide === "head" ? "New" : "Old"}
                                </span>
                            )}
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {result ? (
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b bg-muted/20 px-2 py-1">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <Button
                                        key={tab.id}
                                        variant={activeTab === tab.id ? "secondary" : "ghost"}
                                        size="sm"
                                        onClick={() => setActiveTab(tab.id)}
                                        className="h-8 text-xs"
                                    >
                                        <Icon className="mr-2 h-3 w-3" />
                                        {tab.label}
                                        {!!tab.badge && (
                                            <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                                                {tab.badge}
                                            </span>
                                        )}
                                    </Button>
                                );
                            })}
                        </div>

                        <div className="flex min-h-0 flex-1">
                            {(activeTab === "sch" || activeTab === "pcb") && (
                                <>
                                    <DifferencesPane
                                        groups={groups}
                                        filter={filter}
                                        onFilterChange={setFilter}
                                        summary={domainSummary}
                                        selectedGroupId={selectedGroupId}
                                        onSelectGroup={handleSelectGroup}
                                        onAlsoOnPage={setSelectedPage}
                                        currentPage={selectedPage}
                                    />
                                    <DualEcadPanel
                                        projectId={projectId}
                                        domain={domain}
                                        base={base}
                                        head={head}
                                        tipSide={tipSide}
                                        geometry={result.geometry}
                                        selectedChanges={selectedChanges}
                                        visibleChanges={filteredChanges}
                                        selectedPage={selectedPage}
                                        syncCamera={syncCamera}
                                        onToggleSyncCamera={() => setSyncCamera((v) => !v)}
                                    />
                                </>
                            )}
                            {activeTab === "bom" && <BomPanel bom={result.bom} />}
                            {activeTab === "stackup" && <StackupPanel stackup={result.stackup} />}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col p-8">
                        {error ? (
                            <div className="text-center text-destructive">
                                <AlertCircle className="mx-auto mb-4 h-12 w-12" />
                                <h3 className="text-lg font-bold">Comparison Failed</h3>
                                <p>{error}</p>
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <h3 className="text-lg font-medium">
                                    {jobStatus?.message || "Starting design comparison…"}
                                </h3>
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
            </div>
        </div>
    );
}
