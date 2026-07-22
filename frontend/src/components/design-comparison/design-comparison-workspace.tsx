import {
    Profiler,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ProfilerOnRenderCallback,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
    AlertCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircuitBoard,
    Columns2,
    Cpu,
    FileText,
    Layers3,
    Loader2,
    MessageSquare,
    Search,
    Square,
    ToggleLeft,
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
import { ComparisonPresentationShell } from "./comparison-presentation-shell";
import type { ComparisonSelection } from "./comparison-selection-bridge";
import {
    logComparisonDebug,
    startComparisonDebugSession,
} from "./comparison-debug-log";
import {
    applyWorkspaceComparisonParams,
    readComparisonUrlState,
    type ComparisonPresentationMode,
    type ComparisonUrlTab,
} from "./comparison-url";
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
    SemanticChangeGroup,
} from "./types";

const DIFFERENCES_PAGE_SIZE = 25;

type WorkspaceTab = ComparisonUrlTab;
export type PresentationMode = ComparisonPresentationMode;

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

const NET_REASON_CODES = new Set([
    "connectivity-changed",
    "net-renamed",
    "label-count-changed",
]);

function semanticCategory(change: ChangeItem): Category {
    if (
        change.net
        || change.reasons?.some((reason) => NET_REASON_CODES.has(reason))
    ) {
        return "nets";
    }
    return normalizeCategory(change.category);
}

export function groupChanges(
    changes: ChangeItem[],
    comments: Comment[] = [],
): ChangeGroup[] {
    const buckets = new Map<string, ChangeGroup>();
    for (const change of changes) {
        const category = semanticCategory(change);
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
                unresolvedCount: comments.filter(
                    (comment) =>
                        comment.status === "OPEN"
                        && comment.semanticItemId === key,
                ).length,
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

function hydrateServerGroups(
    changes: ChangeItem[],
    serverGroups: SemanticChangeGroup[],
    comments: Comment[],
): ChangeGroup[] {
    const visible = new Map(changes.map((change) => [change.id, change]));
    const hydrated: ChangeGroup[] = [];
    const consumed = new Set<string>();
    for (const serverGroup of serverGroups) {
        const members = serverGroup.members
            .map((id) => visible.get(id))
            .filter((change): change is ChangeItem => Boolean(change));
        if (!members.length) continue;
        members.forEach((change) => consumed.add(change.id));
        const first = members[0]!;
        const category = members.some((change) => semanticCategory(change) === "nets")
            ? "nets"
            : normalizeCategory(serverGroup.category);
        const identity = first.semantic_id ?? first.reference ?? first.net ?? serverGroup.id;
        const id = `${first.domain}:${category}:${identity}`;
        hydrated.push({
            id,
            category,
            kind: serverGroup.status,
            label: serverGroup.label,
            classification: serverGroup.classification,
            unresolvedCount: comments.filter(
                (comment) => comment.status === "OPEN" && comment.semanticItemId === id,
            ).length,
            changes: members,
        });
    }
    hydrated.push(
        ...groupChanges(
            changes.filter((change) => !consumed.has(change.id)),
            comments,
        ),
    );
    return hydrated.sort((left, right) => {
        const classOrder = left.classification === right.classification
            ? 0
            : left.classification === "primary" ? -1 : 1;
        return classOrder
            || CATEGORY_META[left.category].order - CATEGORY_META[right.category].order
            || left.label.localeCompare(right.label);
    });
}

function changeSummary(change: ChangeItem): string {
    const details = change.details;
    const reason = change.reasons?.[0];
    if (
        (reason === "object-added" || reason === "object-removed")
        && details?.netInstances
    ) {
        return `Instances ${details.netInstances.old} → ${details.netInstances.new}`;
    }
    if (reason === "instance-replaced") return "Instance replaced (same RefDes)";
    if (reason === "instance-count-changed" && details?.instanceCount) {
        return `Instances ${details.instanceCount.old} → ${details.instanceCount.new}`;
    }
    if (reason === "label-count-changed" && details?.labelInstances) {
        return `Labels ${details.labelInstances.old} → ${details.labelInstances.new}`;
    }
    if (reason === "sheet-changed" && details?.sheetChange) {
        return `Sheet ${details.sheetChange.old ?? "—"} → ${details.sheetChange.new ?? "—"}`;
    }
    if (reason === "connectivity-changed" && details?.connectivity) {
        const added = details.connectivity.addedTerminals.map((value) => `+${value}`);
        const removed = details.connectivity.removedTerminals.map((value) => `−${value}`);
        return [...added, ...removed].join(", ") || "Connectivity changed";
    }
    if (reason === "net-renamed") {
        const value = change.fields?.name;
        if (value && typeof value === "object") {
            return `Net ${String(value.old ?? "—")} → ${String(value.new ?? "—")}`;
        }
    }
    const firstField = Object.entries(change.fields ?? {})[0];
    if (firstField) {
        const [field, value] = firstField;
        if (value && typeof value === "object") {
            return `${field}: ${String(value.old ?? "—")} → ${String(value.new ?? "—")}`;
        }
    }
    if (change.kind === "added") return "Added";
    if (change.kind === "removed") return "Removed";
    return "Modified";
}

export function readInitialUrlState(
    search: string | URLSearchParams = window.location.search,
) {
    const state = readComparisonUrlState(search);
    return {
        activeTab: state.diff,
        presentationMode: state.presentationMode,
        selectedChangeId: state.item,
        showSecondary: state.showSecondary,
        layers: state.layers,
    };
}

function DifferencesPane({
    groups,
    totalGroups,
    page,
    pageSize,
    onPageChange,
    statuses,
    onToggleStatus,
    search,
    onSearchChange,
    showSecondary,
    onShowSecondaryChange,
    selectedChangeId,
    selectedGroupId,
    selectedDocumentPath,
    documentDiff,
    onSelectChange,
    onSelectGroup,
    onPreviewChange,
    onPrevious,
    onNext,
    routeMetrics,
}: {
    groups: ChangeGroup[];
    totalGroups: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    statuses: Set<ChangeKind>;
    onToggleStatus: (kind: ChangeKind) => void;
    search: string;
    onSearchChange: (value: string) => void;
    showSecondary: boolean;
    onShowSecondaryChange: (value: boolean) => void;
    selectedChangeId: string | null;
    selectedGroupId: string | null;
    selectedDocumentPath?: string;
    documentDiff: DesignCompareResult["document_diff"];
    onSelectChange: (change: ChangeItem, documentPath?: string) => void;
    onSelectGroup: (group: ChangeGroup) => void;
    onPreviewChange: (selection: ComparisonSelection) => void;
    onPrevious: () => void;
    onNext: () => void;
    routeMetrics?: { base?: RouteMetrics; compare?: RouteMetrics } | null;
}) {
    const paneRef = useRef<HTMLElement | null>(null);
    const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize));
    const selectedGroup = groups.find((group) =>
        group.changes.some((change) => change.id === selectedChangeId)
    );
    const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
        () => new Set(),
    );
    useEffect(() => {
        if (!selectedGroup) return;
        setExpandedGroupIds((current) => {
            if (current.has(selectedGroup.id)) return current;
            const next = new Set(current);
            next.add(selectedGroup.id);
            return next;
        });
    }, [selectedGroup]);
    useEffect(() => {
        if (!selectedChangeId && !selectedGroupId) return;
        const frame = requestAnimationFrame(() => {
            const rows = paneRef.current?.querySelectorAll<HTMLElement>(
                "[data-change-id], [data-group-id]",
            );
            const row = [...(rows ?? [])].find(
                (candidate) =>
                    candidate.dataset.changeId === selectedChangeId
                    || candidate.dataset.groupId === selectedGroupId,
            );
            row?.scrollIntoView({ block: "nearest" });
        });
        return () => cancelAnimationFrame(frame);
    }, [selectedChangeId, selectedGroupId, groups]);
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
        <aside ref={paneRef} className="flex h-full w-80 shrink-0 flex-col border-r bg-background max-md:w-64">
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
                    {totalGroups} group{totalGroups === 1 ? "" : "s"}
                    {totalPages > 1 && (
                        <span className="ml-1">
                            · page {page + 1}/{totalPages}
                        </span>
                    )}
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
                        .map(([category, categoryGroups]) => {
                            const secondaryCategory = categoryGroups.every(
                                (group) => group.classification === "secondary",
                            );
                            return (
                            <details key={category} className="mb-3" open={!secondaryCategory}>
                                <summary className="mb-1 cursor-pointer px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    {secondaryCategory
                                        ? "Physical / Graphics"
                                        : CATEGORY_META[category].label}
                                </summary>
                                <div className="space-y-0.5">
                                    {categoryGroups.map((group) => {
                                        const expanded = expandedGroupIds.has(group.id);
                                        const selected = selectedGroupId === group.id
                                            || selectedGroup?.id === group.id;
                                        const status = STATUS_META.find((item) => item.id === group.kind)!;
                                        const primaryChange = group.changes[0]!;
                                        return (
                                            <div key={group.id}>
                                                <button
                                                    type="button"
                                                    data-group-id={group.id}
                                                    className={cn(
                                                        "flex w-full items-center gap-2 border-l-2 px-2 py-2 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                        selected
                                                            ? "border-primary bg-accent text-accent-foreground"
                                                            : "border-transparent",
                                                    )}
                                                    onClick={() => {
                                                        setExpandedGroupIds((current) => {
                                                            const next = new Set(current);
                                                            if (next.has(group.id)) next.delete(group.id);
                                                            else next.add(group.id);
                                                            return next;
                                                        });
                                                        onSelectGroup(group);
                                                    }}
                                                    onMouseEnter={() =>
                                                        onPreviewChange({ kind: "group", id: group.id })
                                                    }
                                                    onMouseLeave={() => onPreviewChange(null)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "ArrowUp") {
                                                            event.preventDefault();
                                                            onPrevious();
                                                        } else if (event.key === "ArrowDown") {
                                                            event.preventDefault();
                                                            onNext();
                                                        }
                                                    }}
                                                    aria-expanded={expanded}
                                                >
                                                    {expanded
                                                        ? <ChevronDown className="h-3 w-3 shrink-0" />
                                                        : <ChevronRight className="h-3 w-3 shrink-0" />}
                                                    <span
                                                        className={cn(
                                                            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-primary-foreground",
                                                            status.marker,
                                                        )}
                                                        aria-label={status.label}
                                                    >
                                                        {group.kind === "added" ? "A" : group.kind === "removed" ? "R" : "M"}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="truncate font-medium">{group.label}</span>
                                                            {primaryChange.page && (
                                                                <span className="max-w-20 truncate rounded bg-muted px-1 text-[9px] text-muted-foreground">
                                                                    {primaryChange.page.split("/").at(-1)}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                                                            {changeSummary(primaryChange)}
                                                        </span>
                                                    </span>
                                                    {group.unresolvedCount > 0 && (
                                                        <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1 text-[9px] text-muted-foreground">
                                                            <MessageSquare className="h-2.5 w-2.5" />
                                                            {group.unresolvedCount}
                                                        </span>
                                                    )}
                                                    {group.classification === "secondary" && (
                                                        <span className="rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground">
                                                            secondary
                                                        </span>
                                                    )}
                                                </button>
                                                {expanded && (
                                                    <div className="ml-5 border-l py-1 pl-2">
                                                        {group.changes.map((change) => {
                                                            const navigation =
                                                                documentDiff.navigation[change.id];
                                                            const pageTargets = [
                                                                ...new Map(
                                                                    (
                                                                        navigation?.documents
                                                                        ?? (navigation
                                                                            ? [navigation]
                                                                            : [])
                                                                    ).map((entry) => [
                                                                        entry.documentPath,
                                                                        entry,
                                                                    ]),
                                                                ).values(),
                                                            ];
                                                            return (
                                                                <div key={change.id}>
                                                                    <button
                                                                        type="button"
                                                                        data-change-id={change.id}
                                                                        onClick={() => onSelectChange(change)}
                                                                        onMouseEnter={() =>
                                                                            onPreviewChange({ kind: "item", id: change.id })
                                                                        }
                                                                        onMouseLeave={() => onPreviewChange(null)}
                                                                        className={cn(
                                                                            "block w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                                            selectedChangeId === change.id && "bg-primary/10 text-primary",
                                                                        )}
                                                                        aria-current={
                                                                            selectedChangeId === change.id
                                                                                ? "true"
                                                                                : undefined
                                                                        }
                                                                    >
                                                                        <span className="block truncate font-medium">
                                                                            {change.label}
                                                                        </span>
                                                                        <span className="block truncate text-[10px] text-muted-foreground">
                                                                            {changeSummary(change)}
                                                                        </span>
                                                                    </button>
                                                                    {pageTargets.length > 1 && (
                                                                        <div className="ml-2 border-l pl-2">
                                                                            {pageTargets.map((target) => {
                                                                                const active =
                                                                                    selectedChangeId === change.id
                                                                                    && selectedDocumentPath === target.documentPath;
                                                                                return (
                                                                                    <button
                                                                                        key={target.documentPath}
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            onSelectChange(
                                                                                                change,
                                                                                                target.documentPath,
                                                                                            )
                                                                                        }
                                                                                        onMouseEnter={() =>
                                                                                            onPreviewChange({
                                                                                                kind: "item",
                                                                                                id: change.id,
                                                                                                documentPath: target.documentPath,
                                                                                            })
                                                                                        }
                                                                                        onMouseLeave={() => onPreviewChange(null)}
                                                                                        className={cn(
                                                                                            "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                                                            active && "bg-primary/10 text-primary",
                                                                                        )}
                                                                                        aria-current={active ? "page" : undefined}
                                                                                    >
                                                                                        <FileText className="h-3 w-3 shrink-0" />
                                                                                        <span className="truncate">
                                                                                            {target.documentPath.split("/").at(-1)}
                                                                                        </span>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </details>
                            );
                        })
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-2 py-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={page <= 0}
                        onClick={() => onPageChange(page - 1)}
                    >
                        Previous page
                    </Button>
                    <span className="text-[10px] text-muted-foreground">
                        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalGroups)}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={page >= totalPages - 1}
                        onClick={() => onPageChange(page + 1)}
                    >
                        Next page
                    </Button>
                </div>
            )}

            {selectedGroup && (
                <div className="max-h-48 overflow-auto border-t bg-muted/10 p-3 text-xs">
                    <div className="font-medium">{selectedGroup.label}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                        {changeSummary(
                            selectedGroup.changes.find(
                                (change) => change.id === selectedChangeId,
                            ) ?? selectedGroup.changes[0]!,
                        )}
                    </div>
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
                            </div>
                        </div>
                    )}
                    {!!Object.keys(
                        selectedGroup.changes.find((change) => change.id === selectedChangeId)?.fields ?? {},
                    ).length && (
                        <div className="mt-2 overflow-hidden rounded border bg-background/60">
                            <div className="grid grid-cols-[minmax(4rem,1fr)_1fr_1fr] border-b px-2 py-1 text-[10px] font-medium text-muted-foreground">
                                <span>Field</span><span>Old</span><span>New</span>
                            </div>
                            {Object.entries(
                                selectedGroup.changes.find((change) => change.id === selectedChangeId)?.fields ?? {},
                            ).map(([field, value]) => {
                                const delta = value && typeof value === "object" ? value : null;
                                return (
                                    <div key={field} className="grid grid-cols-[minmax(4rem,1fr)_1fr_1fr] gap-2 border-b px-2 py-1.5 last:border-0">
                                        <span className="truncate text-muted-foreground">{field}</span>
                                        <span className="break-words font-mono text-[10px]">{String(delta?.old ?? "—")}</span>
                                        <span className="break-words font-mono text-[10px]">{String(delta?.new ?? "—")}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {(() => {
                        const details = selectedGroup.changes.find(
                            (change) => change.id === selectedChangeId,
                        )?.details?.connectivity;
                        if (!details) return null;
                        return (
                            <div className="mt-2 space-y-1 font-mono text-[10px]">
                                {details.addedTerminals.map((terminal) => (
                                    <div key={`add-${terminal}`} className="text-success">+ {terminal}</div>
                                ))}
                                {details.removedTerminals.map((terminal) => (
                                    <div key={`remove-${terminal}`} className="text-destructive">− {terminal}</div>
                                ))}
                            </div>
                        );
                    })()}
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
    const [searchParams, setSearchParams] = useSearchParams();
    const initial = useMemo(
        () => readInitialUrlState(searchParams),
        [searchParams],
    );
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<DesignCompareJobStatus | null>(null);
    const [result, setResult] = useState<DesignCompareResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>(initial.activeTab);
    const [presentationMode, setPresentationMode] = useState<PresentationMode>(
        initial.presentationMode,
    );
    const [statuses, setStatuses] = useState<Set<ChangeKind>>(
        () => new Set(["added", "changed", "removed"]),
    );
    const [search, setSearch] = useState("");
    const [showSecondary, setShowSecondary] = useState(initial.showSecondary);
    const [selectedChangeId, setSelectedChangeId] = useState<string | null>(
        initial.selectedChangeId,
    );
    const [reviewSelection, setReviewSelection] = useState<ComparisonSelection>(
        initial.selectedChangeId
            ? { kind: "item", id: initial.selectedChangeId }
            : null,
    );
    const [visibleLayers, setVisibleLayers] = useState<string[]>(initial.layers);
    const [differencesPage, setDifferencesPage] = useState(0);
    const [comments, setComments] = useState<Comment[]>([]);
    const [comparisonRightRailTab, setComparisonRightRailTab] = useState<
        "layers" | "discussion" | null
    >(() => window.matchMedia("(max-width: 1023px)").matches
        ? null
        : "discussion");
    const showDiscussion = comparisonRightRailTab === "discussion";
    const [previewSelection, setPreviewSelection] =
        useState<ComparisonSelection>(null);
    const jobIdRef = useRef<string | null>(null);
    const semanticFocusRef = useRef<SemanticFocus | null>(null);
    const logRenderPerformance = useCallback<ProfilerOnRenderCallback>(
        (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
            if (phase !== "mount" && actualDuration < 4) return;
            logComparisonDebug("performance.react", {
                id,
                phase,
                actualDurationMs: Number(actualDuration.toFixed(3)),
                baseDurationMs: Number(baseDuration.toFixed(3)),
                startTimeMs: Number(startTime.toFixed(3)),
                commitTimeMs: Number(commitTime.toFixed(3)),
            });
        },
        [],
    );

    useEffect(() => {
        if (activeTab !== "pcb" && comparisonRightRailTab === "layers") {
            setComparisonRightRailTab(null);
        }
    }, [activeTab, comparisonRightRailTab]);

    useEffect(() => {
        startComparisonDebugSession({ projectId, base, compare: head });
        logComparisonDebug("workspace.mount", {
            base,
            compare: head,
        });
    }, [projectId, base, head]);

    useEffect(() => {
        logComparisonDebug("workspace.state", {
            activeTab,
            presentationMode,
            selectedChangeId,
            selectionKind: reviewSelection?.kind ?? null,
            selectionId: reviewSelection?.id ?? null,
            differencesPage,
        });
    }, [
        activeTab,
        differencesPage,
        presentationMode,
        reviewSelection,
        selectedChangeId,
    ]);

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
        setSearchParams(
            (current) => {
                const next = applyWorkspaceComparisonParams(current, {
                    base,
                    compare: head,
                    activeTab,
                    presentationMode,
                    selectedChangeId,
                    showSecondary,
                    visibleLayers,
                });
                return next.toString() === current.toString() ? current : next;
            },
            { replace: true },
        );
    }, [
        base,
        head,
        activeTab,
        presentationMode,
        selectedChangeId,
        showSecondary,
        visibleLayers,
        setSearchParams,
    ]);

    useEffect(() => {
        const next = readComparisonUrlState(searchParams);
        if (!next.base || !next.compare) return;
        setActiveTab((current) => (current === next.diff ? current : next.diff));
        setPresentationMode((current) =>
            current === next.presentationMode ? current : next.presentationMode,
        );
        setSelectedChangeId((current) =>
            current === next.item ? current : next.item,
        );
        setShowSecondary((current) =>
            current === next.showSecondary ? current : next.showSecondary,
        );
        setVisibleLayers((current) => {
            if (
                current.length === next.layers.length
                && current.every((layer, index) => layer === next.layers[index])
            ) {
                return current;
            }
            return next.layers;
        });
    }, [searchParams]);

    const handleClose = () => {
        onClose();
    };

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
                change.page,
                changeSummary(change),
                ...(change.reasons ?? []),
                ...Object.keys(change.fields ?? {}),
                ...(change.layers ?? []),
            ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
        });
    }, [domainChanges, statuses, showSecondary, search]);
    const domainServerGroups = useMemo(
        () => activeTab === "sch"
            ? result?.schematic.groups ?? []
            : activeTab === "pcb"
                ? result?.pcb.groups ?? []
                : [],
        [activeTab, result],
    );
    const groups = useMemo(
        () => hydrateServerGroups(filteredChanges, domainServerGroups, comments),
        [filteredChanges, domainServerGroups, comments],
    );
    const paginatedGroups = useMemo(
        () => groups.slice(
            differencesPage * DIFFERENCES_PAGE_SIZE,
            (differencesPage + 1) * DIFFERENCES_PAGE_SIZE,
        ),
        [differencesPage, groups],
    );
    const navigationGroups = useMemo(
        () => hydrateServerGroups(domainChanges, domainServerGroups, comments),
        [domainChanges, domainServerGroups, comments],
    );

    useEffect(() => {
        setDifferencesPage(0);
    }, [search, showSecondary, statuses, activeTab]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(groups.length / DIFFERENCES_PAGE_SIZE));
        if (differencesPage >= totalPages) {
            setDifferencesPage(Math.max(0, totalPages - 1));
        }
    }, [differencesPage, groups.length]);

    useEffect(() => {
        if (!selectedChangeId) return;
        const index = groups.findIndex((group) =>
            group.changes.some((change) => change.id === selectedChangeId),
        );
        if (index < 0) return;
        const selectedPage = Math.floor(index / DIFFERENCES_PAGE_SIZE);
        setDifferencesPage((current) =>
            current === selectedPage ? current : selectedPage,
        );
    }, [groups, selectedChangeId]);

    const selectedChange = useMemo(
        () => domainChanges.find((change) => change.id === selectedChangeId) ?? null,
        [domainChanges, selectedChangeId],
    );
    const selectedReviewGroup = useMemo(
        () => navigationGroups.find((group) =>
            group.id === (reviewSelection?.kind === "group" ? reviewSelection.id : "")
            || group.changes.some((change) => change.id === selectedChangeId),
        ) ?? null,
        [navigationGroups, reviewSelection, selectedChangeId],
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

    const selectChange = (change: ChangeItem, documentPath?: string) => {
        logComparisonDebug("difference.click", {
            target: "item",
            activeTab,
            presentationMode,
            change: {
                id: change.id,
                kind: change.kind,
                category: change.category,
                classification: change.classification,
                label: change.label,
                reference: change.reference,
                net: change.net,
                page: change.page,
                reasons: change.reasons ?? [],
                sourceIdBase: change.source_id_base,
                sourceIdCompare: change.source_id_compare,
                visualTargets: change.details?.visualTargets ?? [],
            },
            navigation: result?.document_diff.navigation[change.id] ?? null,
            requestedDocumentPath: documentPath ?? null,
        });
        semanticFocusRef.current = {
            semanticId: change.semantic_id,
            reference: change.reference,
            net: change.net,
        };
        setSelectedChangeId(change.id);
        setReviewSelection({ kind: "item", id: change.id, documentPath });
    };

    const selectGroup = (group: ChangeGroup) => {
        const change = group.changes[0];
        if (!change) return;
        logComparisonDebug("difference.click", {
            target: "group",
            activeTab,
            presentationMode,
            group: {
                id: group.id,
                category: group.category,
                kind: group.kind,
                classification: group.classification,
                label: group.label,
                memberIds: group.changes.map((member) => member.id),
            },
            primaryChange: {
                id: change.id,
                page: change.page,
                reasons: change.reasons ?? [],
                reference: change.reference,
                net: change.net,
                visualTargets: change.details?.visualTargets ?? [],
            },
            navigation: result?.document_diff.navigation[change.id] ?? null,
        });
        semanticFocusRef.current = {
            semanticId: change.semantic_id,
            reference: change.reference,
            net: change.net,
        };
        setSelectedChangeId(change.id);
        setReviewSelection({ kind: "group", id: group.id });
    };

    useEffect(() => {
        if (!result) return;
        const current = domainChanges.find((change) => change.id === selectedChangeId);
        if (current) {
            semanticFocusRef.current = {
                semanticId: current.semantic_id,
                reference: current.reference,
                net: current.net,
            };
            const validGroupSelection = reviewSelection?.kind === "group"
                && groups.some((group) => (
                    group.id === reviewSelection.id
                    && group.changes.some((change) => change.id === current.id)
                ));
            if (
                !validGroupSelection
                && (
                    reviewSelection?.kind !== "item"
                    || reviewSelection.id !== current.id
                )
            ) {
                setReviewSelection({ kind: "item", id: current.id });
            }
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
            setReviewSelection({ kind: "item", id: counterpart.id });
        } else {
            setSelectedChangeId(null);
            setReviewSelection(null);
        }
    }, [activeTab, domainChanges, groups, result, reviewSelection, selectedChangeId]);

    const navigate = (direction: -1 | 1) => {
        if (!groups.length) return;
        const current = groups.findIndex((group) =>
            group.changes.some((change) => change.id === selectedChangeId)
        );
        const next = current < 0
            ? 0
            : (current + direction + groups.length) % groups.length;
        selectGroup(groups[next]!);
        const nextPage = Math.floor(next / DIFFERENCES_PAGE_SIZE);
        if (nextPage !== differencesPage) setDifferencesPage(nextPage);
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

    const chooseTab = (next: WorkspaceTab) => {
        logComparisonDebug("control.tab.click", {
            from: activeTab,
            to: next,
            presentationMode,
            selectedChangeId,
        });
        setActiveTab(next);
    };

    const choosePresentationMode = (next: PresentationMode) => {
        logComparisonDebug("control.presentation.click", {
            from: presentationMode,
            to: next,
            activeTab,
            selectedChangeId,
        });
        setPresentationMode(next);
    };

    return (
        <Dialog open onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="flex h-[96vh] w-[98vw] max-w-none flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <DialogTitle>Design comparison</DialogTitle>
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
                                        onClick={() => chooseTab(tab.id)}
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
                            {(activeTab === "sch" || activeTab === "pcb") && (
                                <div
                                    className="ml-2 flex items-center gap-0.5 rounded-md border bg-background p-0.5"
                                    role="group"
                                    aria-label="Presentation mode"
                                >
                                    <Button
                                        variant={presentationMode === "composite" ? "secondary" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => choosePresentationMode("composite")}
                                        aria-pressed={presentationMode === "composite"}
                                    >
                                        <Square className="mr-1.5 h-3.5 w-3.5" />
                                        Composite
                                    </Button>
                                    <Button
                                        variant={presentationMode === "side-by-side" ? "secondary" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => choosePresentationMode("side-by-side")}
                                        aria-pressed={presentationMode === "side-by-side"}
                                    >
                                        <Columns2 className="mr-1.5 h-3.5 w-3.5" />
                                        Side by side
                                    </Button>
                                    <Button
                                        variant={presentationMode === "old-new" ? "secondary" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => choosePresentationMode("old-new")}
                                        aria-pressed={presentationMode === "old-new"}
                                    >
                                        <ToggleLeft className="mr-1.5 h-3.5 w-3.5" />
                                        Old / New
                                    </Button>
                                </div>
                            )}
                            <Button
                                variant={showDiscussion ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setComparisonRightRailTab((tab) =>
                                    tab === "discussion" ? null : "discussion"
                                )}
                                className="ml-auto h-8 text-xs"
                                aria-pressed={showDiscussion}
                            >
                                <MessageSquare className="mr-2 h-3.5 w-3.5" />
                                Discussion
                                {comments.some((comment) => comment.status === "OPEN") && (
                                    <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px]">
                                        {comments.filter((comment) => comment.status === "OPEN").length}
                                    </span>
                                )}
                            </Button>
                        </nav>

                        <div className="flex min-h-0 flex-1">
                            {(activeTab === "sch" || activeTab === "pcb") && (
                                <>
                                    <Profiler
                                        id="differences-pane"
                                        onRender={logRenderPerformance}
                                    >
                                        <DifferencesPane
                                            groups={paginatedGroups}
                                            totalGroups={groups.length}
                                            page={differencesPage}
                                            pageSize={DIFFERENCES_PAGE_SIZE}
                                            onPageChange={setDifferencesPage}
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
                                            selectedGroupId={
                                                reviewSelection?.kind === "group"
                                                    ? reviewSelection.id
                                                    : null
                                            }
                                            selectedDocumentPath={
                                                reviewSelection?.documentPath
                                            }
                                            documentDiff={result.document_diff}
                                            onSelectChange={selectChange}
                                            onSelectGroup={selectGroup}
                                            onPreviewChange={setPreviewSelection}
                                            onPrevious={() => navigate(-1)}
                                            onNext={() => navigate(1)}
                                            routeMetrics={selectedRouteMetrics}
                                        />
                                    </Profiler>
                                    {result.document_diff ? (
                                        <Profiler
                                            id="comparison-presentation"
                                            onRender={logRenderPerformance}
                                        >
                                            <ComparisonPresentationShell
                                                key={`${domain}:${base}:${head}`}
                                                projectId={projectId}
                                                domain={domain}
                                                base={base}
                                                compare={head}
                                                presentationMode={presentationMode}
                                                documentDiff={result.document_diff}
                                                files={result.files}
                                                reviewGroups={navigationGroups}
                                                selection={reviewSelection}
                                                previewSelection={previewSelection}
                                                initialVisibleLayers={visibleLayers}
                                                onVisibleLayersChange={setVisibleLayers}
                                                rightRailTab={comparisonRightRailTab}
                                                onRightRailTabChange={setComparisonRightRailTab}
                                                discussionCount={comments.filter((comment) => comment.status === "OPEN").length}
                                                discussionContent={(
                                                    <ComparisonDiscussionRail
                                                        projectId={projectId}
                                                        base={base}
                                                        compare={head}
                                                        domain={activeTab === "pcb" ? "PCB" : "SCH"}
                                                        anchor={selectedReviewGroup
                                                            ? {
                                                                id: selectedReviewGroup.id,
                                                                label: selectedReviewGroup.label,
                                                                page: selectedChange?.page,
                                                            }
                                                            : null}
                                                        comments={comments}
                                                        canComment={canComment}
                                                        onCommentsChange={setComments}
                                                        onClose={() => setComparisonRightRailTab(null)}
                                                        embedded
                                                    />
                                                )}
                                            />
                                        </Profiler>
                                    ) : (
                                        <div className="flex min-w-0 flex-1 items-center justify-center p-8 text-center">
                                            <div className="max-w-sm text-sm text-muted-foreground">
                                                <AlertCircle className="mx-auto mb-3 h-8 w-8 text-warning" />
                                                This result predates native document comparison.
                                                Reopen the comparison to rebuild it.
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            {activeTab === "bom" && <BomPanel bom={result.bom} />}
                            {activeTab === "stackup" && <StackupPanel stackup={result.stackup} />}
                            {showDiscussion
                                && (activeTab === "bom" || activeTab === "stackup") && (
                                <ComparisonDiscussionRail
                                    projectId={projectId}
                                    base={base}
                                    compare={head}
                                    domain={activeTab === "stackup" ? "PCB" : "SCH"}
                                    anchor={selectedReviewGroup
                                        ? {
                                            id: selectedReviewGroup.id,
                                            label: selectedReviewGroup.label,
                                            page: selectedChange?.page,
                                        }
                                        : null}
                                    comments={comments}
                                    canComment={canComment}
                                    onCommentsChange={setComments}
                                    onClose={() => setComparisonRightRailTab(null)}
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
