import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

import type { ReleaseCandidate, ReleaseRecord } from "./types";

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

export function RunList({
    mode,
    candidates,
    records,
    selectedBuildId,
    onSelect,
    onSelectRecord,
}: {
    mode: "history" | "library";
    candidates: ReleaseCandidate[];
    records: ReleaseRecord[];
    selectedBuildId: string | null;
    onSelect: (buildId: string) => void;
    onSelectRecord: (record: ReleaseRecord) => void;
}) {
    const releasedBuilds = new Set(records.map((record) => record.build_id));
    const attempts = candidates
        .flatMap((candidate) => {
            const builds = candidate.builds?.length ? candidate.builds : candidate.latest_build ? [candidate.latest_build] : [];
            return builds.map((build) => ({ candidate, build }));
        })
        .sort((left, right) => Date.parse(right.build.completed_at || right.build.started_at || right.candidate.created_at) - Date.parse(left.build.completed_at || left.build.started_at || left.candidate.created_at));

    return (
        <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col border-r">
            <div className="border-b px-3 py-2 text-sm font-medium">
                {mode === "history" ? "Run history" : "Release library"}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {mode === "history" && attempts.length === 0 && <Empty>No runs yet.</Empty>}
                {mode === "history" && attempts.map(({ candidate, build }) => {
                    const active = build.id === selectedBuildId;
                    const released = releasedBuilds.has(build.id);
                    return (
                        <button key={build.id} type="button" onClick={() => onSelect(build.id)} aria-current={active ? "true" : undefined} className={cn("flex w-full flex-col gap-1 border-b px-3 py-2 text-left", active ? "bg-muted" : "hover:bg-muted/40")}>
                            <span className="flex items-center gap-2">
                                <span className="font-mono text-xs">{candidate.commit_sha.slice(0, 8)}</span>
                                <Badge variant={build.status === "failed" ? "destructive" : build.status === "cancelled" || released ? "secondary" : "outline"}>{released ? "released" : build.status}</Badge>
                            </span>
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{candidate.config_key}</span>
                                {candidate.variant && <span>{candidate.variant}</span>}
                                <span className="ml-auto">attempt {build.attempt} {elapsed(build.started_at, build.completed_at)}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">{when(build.completed_at || build.started_at || candidate.created_at)}</span>
                        </button>
                    );
                })}
                {mode === "library" && records.length === 0 && <Empty>No signed releases.</Empty>}
                {mode === "library" && records.map((record) => (
                    <button key={record.id} type="button" onClick={() => onSelectRecord(record)} aria-current={record.build_id === selectedBuildId ? "true" : undefined} className={cn("flex w-full flex-col gap-1 border-b px-3 py-3 text-left hover:bg-muted/40", record.build_id === selectedBuildId && "bg-muted")}>
                        <span className="flex items-center gap-2"><Badge variant="secondary">signed</Badge><span className="truncate font-medium">{record.release_label}</span></span>
                        <span className="font-mono text-xs text-muted-foreground">{record.document_number || "—"} · {record.revision || "—"}</span>
                        <span className="text-xs text-muted-foreground">{when(record.created_at)}</span>
                    </button>
                ))}
            </div>
        </aside>
    );
}

function Empty({ children }: { children: ReactNode }) {
    return <p className="px-3 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export default RunList;
