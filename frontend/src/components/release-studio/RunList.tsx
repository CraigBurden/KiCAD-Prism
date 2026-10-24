import type { ReactNode } from "react";
import { PanelLeftClose } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ReleaseCandidate } from "./types";

function elapsed(started?: string | null, completed?: string | null): string {
    if (!started || !completed) return "";
    const seconds = (Date.parse(completed) - Date.parse(started)) / 1000;
    if (!Number.isFinite(seconds) || seconds < 0) return "";
    if (seconds < 90) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function when(value?: string | null): string {
    if (!value) return "";
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? "" : at.toLocaleString();
}

const STATUS_DOT: Record<string, string> = {
    succeeded: "bg-success",
    failed: "bg-destructive",
    cancelled: "bg-muted-foreground",
    running: "bg-primary",
    queued: "bg-primary",
};

/** A run's time in one short column: the time today, else the date and time. */
function short(value?: string | null): string {
    if (!value) return "";
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) return "";
    const today = new Date().toDateString() === at.toDateString();
    return today
        ? at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : at.toLocaleDateString([], { day: "2-digit", month: "short" }) + " " + at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function RunList({
    candidates,
    selectedBuildId,
    onSelect,
    onCollapse,
}: {
    candidates: ReleaseCandidate[];
    selectedBuildId: string | null;
    onSelect: (buildId: string) => void;
    onCollapse?: () => void;
}) {
    const attempts = candidates
        .flatMap((candidate) => {
            const builds = candidate.builds?.length ? candidate.builds : candidate.latest_build ? [candidate.latest_build] : [];
            return builds.map((build) => ({ candidate, build }));
        })
        .sort((left, right) => Date.parse(right.build.completed_at || right.build.started_at || right.candidate.created_at) - Date.parse(left.build.completed_at || left.build.started_at || left.candidate.created_at));

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b pl-3 pr-1 text-sm font-medium">
                <span className="flex-1 truncate">Run history</span>
                {onCollapse && (
                    <Button size="icon-sm" variant="ghost" aria-label="Hide run history" title="Hide run history" onClick={onCollapse}>
                        <PanelLeftClose className="h-4 w-4" />
                    </Button>
                )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {attempts.length === 0 && <Empty>No runs yet.</Empty>}
                {attempts.map(({ candidate, build }) => {
                    const active = build.id === selectedBuildId;
                    const at = build.completed_at || build.started_at || candidate.created_at;
                    const summary = [
                        candidate.commit_sha.slice(0, 8),
                        build.status,
                        build.published ? "published" : "",
                        candidate.config_key,
                        candidate.variant,
                        `attempt ${build.attempt}`,
                        elapsed(build.started_at, build.completed_at),
                        when(at),
                    ].filter(Boolean).join(" · ");
                    return (
                        <button
                            key={build.id}
                            type="button"
                            onClick={() => onSelect(build.id)}
                            aria-current={active ? "true" : undefined}
                            aria-label={summary}
                            title={summary}
                            className={cn(
                                "flex h-9 w-full items-center gap-2 border-b px-3 text-left text-xs",
                                active ? "bg-muted shadow-[inset_2px_0_0_hsl(var(--primary))]" : "hover:bg-muted/40",
                            )}
                        >
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[build.status] ?? "bg-muted-foreground")} aria-hidden />
                            <span className="shrink-0 font-mono">{candidate.commit_sha.slice(0, 8)}</span>
                            {build.published && <Badge variant="success" className="h-4 shrink-0 px-1">published</Badge>}
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                {[candidate.config_key, candidate.variant].filter(Boolean).join(" · ")}
                            </span>
                            <span className="shrink-0 font-mono text-muted-foreground">{elapsed(build.started_at, build.completed_at)}</span>
                            <span className="min-w-0 truncate text-right text-muted-foreground">{short(at)}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function Empty({ children }: { children: ReactNode }) {
    return <p className="px-3 py-6 text-sm text-muted-foreground">{children}</p>;
}
