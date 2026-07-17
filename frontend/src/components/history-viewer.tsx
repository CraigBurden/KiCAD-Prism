import { useCallback, useEffect, useMemo, useState } from "react";
import {
    GitCommit,
    Tag,
    Eye,
    Check,
    Copy,
    User,
    Clock,
    Calendar,
    ChevronDown,
    ChevronRight,
    FileText,
    Plus,
    Minus,
    RefreshCw,
    Loader2,
    CircuitBoard,
    Cpu,
    Settings,
    FileCode,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DesignComparisonWorkspace } from "./design-comparison/design-comparison-workspace";
import { fetchJson } from "@/lib/api";
import { CATEGORY_META, type Category } from "@/lib/diff-grouping";

interface Release {
    tag: string;
    commit_hash: string;
    full_hash: string;
    date: string;
    message: string;
}

interface KicadChanges {
    sch: number;
    pcb: number;
    pro: number;
    other: number;
}

interface Commit {
    hash: string;
    full_hash: string;
    author: string;
    email: string;
    date: string;
    message: string;
    kicad_changes?: KicadChanges;
}

interface ReleasesResponse {
    releases: Release[];
}

interface CommitsResponse {
    commits: Commit[];
}

/** Cheap, regex-based approximation of per-category added/removed counts for
    a single .kicad_sch/.kicad_pcb file — see backend git_service.py. Not a
    real item-level diff (no per-item identity / click-to-navigate); that
    lives in the future Design Comparison workspace. */
type SemanticBuckets = Partial<Record<Category, { added: number; removed: number }>>;

interface CommitFile {
    path: string;
    filename: string;
    status: "added" | "removed" | "modified" | "renamed";
    additions: number | null;
    deletions: number | null;
    semantic_buckets?: SemanticBuckets;
}

interface CommitSummary {
    files: CommitFile[];
}

interface HistoryViewerProps {
    projectId: string;
    branchRef?: string | null;
    onViewCommit: (commitHash: string) => void;
    canCompareDiffs: boolean;
}

function formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
}

const STATUS_COLOR: Record<string, string> = {
    added: "text-green-500",
    removed: "text-red-500",
    modified: "text-amber-500",
    renamed: "text-blue-500",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
    added:    <Plus className="h-3 w-3" />,
    removed:  <Minus className="h-3 w-3" />,
    modified: <RefreshCw className="h-3 w-3" />,
    renamed:  <RefreshCw className="h-3 w-3" />,
};

// Sort rank for the file list inside an expanded commit. Lower rank = shown
// first. Schematic and PCB files lead, followed by project, libraries, then
// everything else. Within a rank, original order is preserved (stable sort).
function fileSortRank(filename: string): number {
    if (filename.endsWith(".kicad_sch")) return 0;
    if (filename.endsWith(".kicad_pcb")) return 1;
    if (filename.endsWith(".kicad_pro")) return 2;
    if (filename.endsWith(".kicad_sym") || filename.endsWith(".kicad_mod")) return 3;
    return 4;
}

// File-type icon picker. Returns the icon + a colour class so KiCad files
// stand out from generic ones in the file list.
function fileTypeIcon(filename: string): { Icon: typeof FileText; color: string } {
    if (filename.endsWith(".kicad_sch")) return { Icon: CircuitBoard, color: "text-blue-500" };
    if (filename.endsWith(".kicad_pcb")) return { Icon: Cpu, color: "text-emerald-500" };
    if (filename.endsWith(".kicad_pro")) return { Icon: Settings, color: "text-violet-500" };
    if (filename.endsWith(".kicad_sym") || filename.endsWith(".kicad_mod")) {
        return { Icon: FileCode, color: "text-cyan-500" };
    }
    return { Icon: FileText, color: "text-muted-foreground" };
}

// Small chip indicating that a commit (or file) touched N items of a given
// kind. Renders nothing when count is 0 so rows without that kind of change
// stay compact.
function KicadChip({ icon: Icon, label, count, color }: {
    icon: typeof FileText; label: string; count: number; color: string;
}) {
    if (count <= 0) return null;
    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-medium leading-none ${color}`}
            title={`${count} ${label.toLowerCase()} file${count > 1 ? "s" : ""} changed`}
        >
            <Icon className="h-3 w-3" />
            {count > 1 ? <span className="font-mono">{count}</span> : null}
        </span>
    );
}

// Renders the lightweight semantic bucket counts for one file (e.g.
// "Components +2", "Nets +5 -1") using the shared category taxonomy from
// diff-grouping.ts so labelling stays consistent with the future Design
// Comparison workspace.
function SemanticBucketChips({ buckets }: { buckets: SemanticBuckets }) {
    const entries = (Object.entries(buckets) as [Category, { added: number; removed: number }][])
        .filter(([, b]) => b.added > 0 || b.removed > 0)
        .sort((a, b) => CATEGORY_META[a[0]].order - CATEGORY_META[b[0]].order);

    if (entries.length === 0) return null;

    return (
        <div className="ml-9 flex items-center gap-3 flex-wrap text-[11px] pb-1">
            {entries.map(([category, b]) => (
                <span key={category} className="inline-flex items-center gap-1 text-muted-foreground">
                    <span className="uppercase tracking-wider text-[10px] text-muted-foreground/70">
                        {CATEGORY_META[category].label}
                    </span>
                    {b.added > 0 && <span className="text-green-500 font-medium">+{b.added}</span>}
                    {b.removed > 0 && <span className="text-red-500 font-medium">−{b.removed}</span>}
                </span>
            ))}
        </div>
    );
}

interface CommitItemProps {
    commit: Commit;
    projectId: string;
    onViewCommit: (hash: string) => void;
    isSelected: boolean;
    onSelect: () => void;
    selectable: boolean;
}

function CommitItem({ commit, projectId, onViewCommit, isSelected, onSelect, selectable }: CommitItemProps) {
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [summary, setSummary] = useState<CommitSummary | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(commit.full_hash);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.warn("Failed to copy commit hash", error);
        }
    };

    const loadSummary = useCallback(async () => {
        if (summary || summaryLoading) return;
        setSummaryLoading(true);
        setSummaryError(null);
        try {
            const data = await fetchJson<CommitSummary>(
                `/api/projects/${projectId}/commits/${commit.full_hash}/summary`,
                {},
                "Failed to load commit summary"
            );
            setSummary(data);
        } catch (e) {
            setSummaryError(e instanceof Error ? e.message : "Failed to load");
        } finally {
            setSummaryLoading(false);
        }
    }, [projectId, commit.full_hash, summary, summaryLoading]);

    const handleExpand = () => {
        const next = !expanded;
        setExpanded(next);
        if (next) loadSummary();
    };

    return (
        <div className={`border rounded-lg transition-colors ${isSelected ? 'bg-primary/5 border-primary/50' : 'hover:bg-muted/50'}`}>
            <div className="flex items-start gap-3 p-4">
                <div className="flex-shrink-0 mt-1 flex items-center justify-center">
                    {selectable ? (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={onSelect}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                        />
                    ) : (
                        <GitCommit className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                        <button
                            className="text-sm font-medium leading-relaxed text-left hover:underline flex items-center gap-1.5 min-w-0"
                            onClick={handleExpand}
                        >
                            {expanded
                                ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                            <span className="truncate">{(commit.message || "").split('\n')[0]}</span>
                        </button>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                                {commit.hash}
                            </code>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={handleCopy}
                                title="Copy full hash"
                            >
                                {copied ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                    <Copy className="h-3 w-3" />
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => onViewCommit(commit.full_hash)}
                                title="View this version"
                            >
                                <Eye className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {commit.author || "Unknown"}
                        </div>
                        {commit.kicad_changes && (
                            <div className="flex items-center gap-1">
                                <KicadChip icon={CircuitBoard} label="Schematic" count={commit.kicad_changes.sch} color="text-blue-500" />
                                <KicadChip icon={Cpu} label="PCB" count={commit.kicad_changes.pcb} color="text-emerald-500" />
                                <KicadChip icon={Settings} label="Project" count={commit.kicad_changes.pro} color="text-violet-500" />
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(commit.date)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Expandable file summary */}
            {expanded && (
                <div className="border-t px-4 py-3 space-y-1">
                    {summaryLoading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading changes…
                        </div>
                    )}
                    {summaryError && (
                        <p className="text-xs text-destructive py-1">{summaryError}</p>
                    )}
                    {summary && summary.files.length === 0 && (
                        <p className="text-xs text-muted-foreground py-1">No tracked files changed</p>
                    )}
                    {summary?.files
                        .slice()
                        .sort((a, b) => fileSortRank(a.filename) - fileSortRank(b.filename))
                        .map((file) => {
                            const { Icon: TypeIcon, color: typeColor } = fileTypeIcon(file.filename);
                            return (
                                <div key={file.path} className="space-y-0.5">
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className={`flex items-center gap-1 shrink-0 ${STATUS_COLOR[file.status] ?? "text-muted-foreground"}`}>
                                            {STATUS_ICON[file.status]}
                                        </span>
                                        <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${typeColor}`} />
                                        <span className="font-medium truncate" title={file.path}>{file.filename}</span>
                                        <span className="text-muted-foreground truncate hidden sm:block" title={file.path}>
                                            {file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : ""}
                                        </span>
                                        {(file.additions !== null || file.deletions !== null) && (
                                            <span className="ml-auto shrink-0 flex items-center gap-1.5 font-mono text-[10px]">
                                                {file.additions !== null && file.additions > 0 && (
                                                    <span className="text-green-500">+{file.additions}</span>
                                                )}
                                                {file.deletions !== null && file.deletions > 0 && (
                                                    <span className="text-red-500">-{file.deletions}</span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    {file.semantic_buckets && <SemanticBucketChips buckets={file.semantic_buckets} />}
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}

export function HistoryViewer({ projectId, branchRef, onViewCommit, canCompareDiffs }: HistoryViewerProps) {
    const [releases, setReleases] = useState<Release[]>([]);
    const [commits, setCommits] = useState<Commit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCommits, setSelectedCommits] = useState<string[]>([]);
    const [showDiff, setShowDiff] = useState(false);

    // Filter commits to find selected ones and determining newer/older
    const diffPair = useMemo(() => {
        if (selectedCommits.length !== 2) return null;

        // Commits are already sorted by date (newest first)
        const c1Index = commits.findIndex(c => c.full_hash === selectedCommits[0]);
        const c2Index = commits.findIndex(c => c.full_hash === selectedCommits[1]);

        if (c1Index === -1 || c2Index === -1) return null;

        // Smaller index = Newer commit
        const newerIndex = Math.min(c1Index, c2Index);
        const olderIndex = Math.max(c1Index, c2Index);

        return {
            newer: commits[newerIndex],
            older: commits[olderIndex]
        };
    }, [commits, selectedCommits]);

    const handleSelectCommit = (hash: string) => {
        if (!canCompareDiffs) {
            return;
        }
        setSelectedCommits(prev => {
            if (prev.includes(hash)) {
                return prev.filter(h => h !== hash);
            }
            if (prev.length >= 2) {
                // Remove oldest selection (first one added? or just FIFO)
                // Let's just create a new array with the new one
                return [prev[1], hash];
            }
            return [...prev, hash];
        });
    };

    useEffect(() => {
        if (!canCompareDiffs) {
            setSelectedCommits([]);
        }
    }, [canCompareDiffs]);

    useEffect(() => {
        const currentHashes = new Set(commits.map((commit) => commit.full_hash));
        setSelectedCommits((previous) => previous.filter((hash) => currentHashes.has(hash)).slice(-2));
    }, [commits]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);

        const fetchHistory = async () => {
            const refQuery = branchRef ? `?ref=${encodeURIComponent(branchRef)}` : "";
            const [releasesResult, commitsResult] = await Promise.allSettled([
                fetchJson<ReleasesResponse>(
                    `/api/projects/${projectId}/releases${refQuery}`,
                    { signal: controller.signal },
                    "Failed to load releases"
                ),
                fetchJson<CommitsResponse>(
                    `/api/projects/${projectId}/commits${refQuery}`,
                    { signal: controller.signal },
                    "Failed to load commits"
                ),
            ]);

            if (controller.signal.aborted) {
                return;
            }

            if (releasesResult.status === "fulfilled") {
                setReleases(releasesResult.value.releases || []);
            } else {
                setReleases([]);
            }

            if (commitsResult.status === "fulfilled") {
                setCommits(commitsResult.value.commits || []);
            } else {
                setCommits([]);
            }

            if (releasesResult.status === "rejected" && commitsResult.status === "rejected") {
                const releaseMessage =
                    releasesResult.reason instanceof Error ? releasesResult.reason.message : "Failed to load releases";
                const commitMessage =
                    commitsResult.reason instanceof Error ? commitsResult.reason.message : "Failed to load commits";
                setError(`${releaseMessage}. ${commitMessage}`);
            } else if (releasesResult.status === "rejected") {
                const releaseMessage =
                    releasesResult.reason instanceof Error ? releasesResult.reason.message : "Failed to load releases";
                setError(releaseMessage);
            } else if (commitsResult.status === "rejected") {
                const commitMessage =
                    commitsResult.reason instanceof Error ? commitsResult.reason.message : "Failed to load commits";
                setError(commitMessage);
            } else {
                setError(null);
            }

            setLoading(false);
        };

        fetchHistory().catch((err: unknown) => {
            if (controller.signal.aborted) {
                return;
            }
            if (err instanceof DOMException && err.name === "AbortError") {
                return;
            }
            console.error("Failed to fetch history", err);
            setError("Failed to load history");
            setLoading(false);
        });

        return () => controller.abort();
    }, [projectId, branchRef]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-500">
                    {error}
                </div>
            )}

            {/* Design Comparison Workspace */}
            {showDiff && diffPair && (
                <DesignComparisonWorkspace
                    projectId={projectId}
                    base={diffPair.older.full_hash}
                    head={diffPair.newer.full_hash}
                    branchTipSha={commits[0]?.full_hash ?? null}
                    onClose={() => {
                        setShowDiff(false);
                    }}
                />
            )}

            {/* Releases Section */}
            {releases.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Tag className="h-5 w-5" />
                        Releases
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {releases.map((release) => (
                            <div
                                key={release.tag}
                                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Tag className="h-4 w-4 text-green-500" />
                                        <span className="font-semibold">{release.tag}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <code className="text-xs bg-muted px-2 py-1 rounded">
                                            {release.commit_hash}
                                        </code>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => onViewCommit(release.full_hash)}
                                            title="View this release"
                                        >
                                            <Eye className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                    {release.message || "No description"}
                                </p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(release.date)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Commits Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <GitCommit className="h-5 w-5" />
                        Commits
                    </h3>
                    {canCompareDiffs && selectedCommits.length === 2 && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                    setShowDiff(true);
                                }}
                            >
                                <Eye className="h-4 w-4 mr-2" />
                                Compare Selected ({selectedCommits.length})
                            </Button>
                        </div>
                    )}
                </div>

                {commits.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No commits found
                    </p>
                ) : (
                    <div className="space-y-3">
                        {commits.map((commit) => (
                            <CommitItem
                                key={commit.full_hash}
                                commit={commit}
                                projectId={projectId}
                                onViewCommit={onViewCommit}
                                isSelected={selectedCommits.includes(commit.full_hash)}
                                onSelect={() => handleSelectCommit(commit.full_hash)}
                                selectable={canCompareDiffs}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
