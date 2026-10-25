import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { fetchApi, fetchJson, readApiError } from "@/lib/api";
import { usePoll } from "@/lib/server-state";

interface DesignBundleCounts {
    complete: number;
    building: number;
    queued: number;
    failed: number;
}

/** A stored bundle whose stages finished with a failed or partial stage. */
interface IncompleteRevision {
    commit: string | null;
    revisionKey: string;
    failedStages: string[];
    partialStages: string[];
    /** The failed stages' errors; empty for a bundle built before they were recorded. */
    reason?: string;
}

/** A bundle whose build failed outright, with the job's error. */
interface FailedBuild {
    commit: string | null;
    revisionKey: string;
    reason: string;
}

interface DesignBundleStatus {
    bundles: DesignBundleCounts;
    aliases: number;
    storedBytes: number;
    /** Stored bundles with a failed stage, and with only partial ones. */
    incomplete?: { failed: number; partial: number };
    /** The newest incomplete revisions (at most 20). */
    incompleteRevisions?: IncompleteRevision[];
    /** The newest failed builds (at most 20). */
    failedBuilds?: FailedBuild[];
}

interface CommitsResponse {
    commits: Array<{ full_hash: string }>;
    /** The checkout's HEAD, which a Type-2 subproject's filtered list may not contain. */
    head?: string | null;
}

interface DesignDataSectionProps {
    projectId: string;
    /** Whether the viewer may queue a rebuild. */
    canEdit: boolean;
}

type Scope = "commit" | "project";

const STATUS_POLL_MS = 5000;

/** ``load`` reports its own failure as "status unavailable". */
const ignorePollError = () => {};

/**
 * The Design data block of Project settings: how much parsed design data Prism
 * holds for this project's commits and tags, and the two manual rebuilds.
 */
export function DesignDataSection({ projectId, canEdit }: DesignDataSectionProps) {
    const [status, setStatus] = useState<DesignBundleStatus | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    // "Rebuild for HEAD" targets the checkout, not the branch ref History
    // lists. Git resolves HEAD when the commits request names no ref.
    const [headSha, setHeadSha] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const data = await fetchJson<DesignBundleStatus>(
                    `/api/projects/${projectId}/design-bundles`,
                    { signal },
                );
                setStatus(data);
                setUnavailable(false);
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }
                setStatus(null);
                setUnavailable(true);
            }
        },
        [projectId],
    );

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [load]);

    // While a build is queued or running, keep the counts current so the line
    // settles to the outcome instead of saying "building" until reopened.
    const building = status !== null && status.bundles.building + status.bundles.queued > 0;
    usePoll(building, load, { intervalMs: STATUS_POLL_MS, onError: ignorePollError });

    useEffect(() => {
        const controller = new AbortController();
        fetchJson<CommitsResponse>(
            `/api/projects/${projectId}/commits?limit=1&offset=0&include_total=false`,
            { signal: controller.signal },
        )
            .then((data) => {
                if (!controller.signal.aborted) setHeadSha(data.head ?? null);
            })
            .catch(() => {
                if (!controller.signal.aborted) setHeadSha(null);
            });
        return () => controller.abort();
    }, [projectId]);

    const rebuild = async (scope: Scope) => {
        setBusy(true);
        try {
            const response = await fetchApi(
                `/api/projects/${projectId}/design-bundles/regenerate`,
                { method: "POST", body: JSON.stringify({ scope }) },
            );
            if (!response.ok) {
                // The one error body: 409 carries the active-build message.
                toast.error(await readApiError(response, "Could not queue the rebuild"));
                return;
            }
            toast.success("Rebuild queued");
            await load();
        } catch {
            toast.error("Could not queue the rebuild");
        } finally {
            setBusy(false);
        }
    };

    const summary: string[] = [];
    if (status) {
        const { complete, building, queued, failed } = status.bundles;
        summary.push(`${complete} stored`, `${status.aliases} reused`);
        if (building + queued > 0) {
            summary.push(`${building + queued} building`);
        }
        if (failed > 0) {
            summary.push(`${failed} failed`);
        }
        const incomplete = (status.incomplete?.failed ?? 0) + (status.incomplete?.partial ?? 0);
        if (incomplete > 0) {
            summary.push(`${incomplete} incomplete`);
        }
    }
    const incompleteRevisions = status?.incompleteRevisions ?? [];
    const failedBuilds = status?.failedBuilds ?? [];

    return (
        <section className="space-y-2">
            <h3 className="text-sm font-medium">Design data</h3>
            <p className="text-xs text-muted-foreground">
                Prism keeps parsed design data for each branch's recent commits and every tag, and
                reuses it across commits that leave the design unchanged.
            </p>

            {status && <p className="text-sm">{summary.join(" · ")}</p>}
            {incompleteRevisions.length > 0 && (
                <ul className="space-y-1" aria-label="Incomplete design data">
                    {incompleteRevisions.map((revision) => (
                        <li
                            key={revision.revisionKey}
                            className="flex min-w-0 items-center gap-2"
                        >
                            <span
                                className="truncate font-mono text-xs text-muted-foreground"
                                title={revision.commit ?? undefined}
                            >
                                {revision.commit ? revision.commit.slice(0, 8) : "—"}
                            </span>
                            {revision.failedStages.map((stage) => (
                                <Badge key={`failed-${stage}`} variant="destructive">
                                    {stage} failed
                                </Badge>
                            ))}
                            {revision.partialStages.map((stage) => (
                                <Badge key={`partial-${stage}`} variant="warning">
                                    {stage} partial
                                </Badge>
                            ))}
                            {revision.reason && <FailureReason reason={revision.reason} />}
                        </li>
                    ))}
                </ul>
            )}
            {failedBuilds.length > 0 && (
                <ul className="space-y-1" aria-label="Failed design data builds">
                    {failedBuilds.map((build) => (
                        <li key={build.revisionKey} className="flex min-w-0 items-center gap-2">
                            <span
                                className="truncate font-mono text-xs text-muted-foreground"
                                title={build.commit ?? undefined}
                            >
                                {build.commit ? build.commit.slice(0, 8) : "—"}
                            </span>
                            <Badge variant="destructive">build failed</Badge>
                            {build.reason && <FailureReason reason={build.reason} />}
                        </li>
                    ))}
                </ul>
            )}
            {unavailable && (
                <p className="text-sm text-muted-foreground">Design data status unavailable</p>
            )}

            {canEdit && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => rebuild("commit")}
                    >
                        Rebuild for HEAD
                    </Button>
                    {headSha && (
                        <span
                            className="font-mono text-xs text-muted-foreground"
                            title={`The checkout's HEAD is ${headSha}`}
                        >
                            {headSha.slice(0, 8)}
                        </span>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setConfirmOpen(true)}
                    >
                        Rebuild all
                    </Button>
                </div>
            )}

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Rebuild all design data?"
                description="Every stored design bundle and reuse record for this project is dropped, then rebuilt from scratch. Readers fall back until the rebuilds finish."
                confirmLabel="Rebuild all"
                destructive={false}
                busy={busy}
                onConfirm={() => {
                    setConfirmOpen(false);
                    rebuild("project");
                }}
            />
        </section>
    );
}

/** Why a revision's design data failed: one truncated line, the whole text on hover. */
function FailureReason({ reason }: { reason: string }) {
    return (
        <span className="min-w-0 truncate text-xs text-muted-foreground" title={reason}>
            {reason}
        </span>
    );
}
