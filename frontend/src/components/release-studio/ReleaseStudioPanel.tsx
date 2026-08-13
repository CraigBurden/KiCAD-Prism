import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Archive, History, ListRestart, Settings2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cancelPrismJob, jobPipeline, throwIfJobFailed, watchPrismJob } from "@/lib/jobs";
import { cn } from "@/lib/utils";

import * as api from "./api";
import { RunList } from "./RunList";
import { ApprovalList, ReleaseRecordsList, RuleOutcomeList } from "./shared";
import { StageRail } from "./StageRail";
import { DefineConfigStep } from "./steps/DefineConfigStep";
import { InspectOutputsStep } from "./steps/InspectOutputsStep";
import { emptyPipeline, ObserveBuildStep } from "./steps/ObserveBuildStep";
import { SignOffStep } from "./steps/SignOffStep";
import { SelectRevisionStep } from "./steps/SelectRevisionStep";
import type {
    AuditEvent,
    BuildDetail,
    EditableReleaseConfiguration,
    PipelineState,
    ProjectCommit,
    ReleaseCandidate,
    ReleaseConfiguration,
    ReleaseRecord,
    RunStage,
    StageState,
    StudioView,
    VendorProfile,
    VerificationReport,
    WebReleaseShare,
} from "./types";

type Props = {
    projectId: string;
    canMutate: boolean;
    isAdmin?: boolean;
    defaultCommit?: string;
};

export { ApprovalList, RuleOutcomeList };

const FULL_SHA = /^[a-f0-9]{40}$/i;

function resolveCommitSelection(value: string, commits: ProjectCommit[]): string {
    const revision = value.trim();
    if (revision === "HEAD") return commits[0]?.full_hash ?? revision;
    return commits.find((commit) => commit.full_hash === revision || commit.hash === revision)?.full_hash ?? revision;
}

export function ReleaseStudioPanel({
    projectId,
    canMutate,
    isAdmin = false,
    defaultCommit = "HEAD",
}: Props) {
    const [view, setView] = useState<StudioView>(() => {
        if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("build")) return "history";
        return "settings";
    });
    const [stage, setStage] = useState<RunStage>("build");
    // Set when the user opens a specific run, so a newer build does not pull
    // the view out from under someone reading an older release's evidence.
    const pinnedRef = useRef(false);
    // "New release" opens the Source stage so a revision and configuration can
    // be chosen. Building immediately took that choice away and made the button
    // fire an expensive job on a single click.
    const [drafting, setDrafting] = useState(false);
    const draftingRef = useRef(false);
    draftingRef.current = drafting;
    const [commits, setCommits] = useState<ProjectCommit[]>([]);
    const [commitsLoading, setCommitsLoading] = useState(true);
    const [commitSha, setCommitSha] = useState(defaultCommit);
    const [configurations, setConfigurations] = useState<ReleaseConfiguration[] | null>(null);
    const [configKey, setConfigKey] = useState("default");
    const [variant, setVariant] = useState("");
    const [profiles, setProfiles] = useState<VendorProfile[]>([]);
    const [candidates, setCandidates] = useState<ReleaseCandidate[]>([]);
    // The run lives in the URL so it survives a reload and can be shared --
    // an approver following a link must land on the build they were asked
    // about, not on whatever happens to be newest.
    const [selectedBuildId, setSelectedBuildId] = useState<string | null>(() => {
        if (typeof window === "undefined") return null;
        const fromUrl = new URLSearchParams(window.location.search).get("build");
        if (fromUrl) pinnedRef.current = true;
        return fromUrl;
    });
    const selectedBuildIdRef = useRef<string | null>(selectedBuildId);
    selectedBuildIdRef.current = selectedBuildId;
    const detailRequestRef = useRef(0);
    const [detail, setDetail] = useState<BuildDetail | null>(null);
    const [records, setRecords] = useState<ReleaseRecord[]>([]);
    const [shares, setShares] = useState<Record<string, WebReleaseShare[]>>({});
    const [shareUrls, setShareUrls] = useState<Record<string, string>>({});
    const [verification, setVerification] = useState<Record<string, VerificationReport>>({});
    const [audit, setAudit] = useState<AuditEvent[]>([]);
    const [auditOk, setAuditOk] = useState<boolean | null>(null);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [pipeline, setPipeline] = useState<PipelineState | null>(null);
    const [jobStatus, setJobStatus] = useState("");
    const [jobMessage, setJobMessage] = useState("");
    const [jobPercent, setJobPercent] = useState(0);
    const [liveLogs, setLiveLogs] = useState<string[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const activeJobIdRef = useRef<string | null>(activeJobId);
    activeJobIdRef.current = activeJobId;
    const [currentBuildId, setCurrentBuildId] = useState<string | null>(null);
    // Never let a retained response drive a different selected run.
    const selectedDetail = detail?.build.id === selectedBuildId ? detail : null;
    const selectedCommitValid = FULL_SHA.test(commitSha)
        && commits.some((commit) => commit.full_hash === commitSha);

    const refreshDetail = useCallback(async (buildId: string) => {
        const request = ++detailRequestRef.current;
        try {
            const value = await api.getBuild(projectId, buildId);
            if (request === detailRequestRef.current && selectedBuildIdRef.current === buildId) {
                setDetail(value);
            }
            return value;
        } catch (cause) {
            // A selection change invalidates this request. Never surface an
            // old response/error over the newly selected run.
            if (request === detailRequestRef.current && selectedBuildIdRef.current === buildId) {
                throw cause;
            }
            return null;
        }
    }, [projectId]);

    const refresh = useCallback(async (preferredJobId?: string) => {
        try {
            const [nextCandidates, nextRecords, nextProfiles] = await Promise.all([
                api.listCandidates(projectId),
                api.listRecords(projectId),
                api.listVendorProfiles(projectId).catch(() => []),
            ]);
            setCandidates(nextCandidates);
            setRecords(nextRecords);
            setProfiles(nextProfiles);
            const listedShares = await Promise.all(nextRecords.map(async (record) => [record.id, await api.listWebReleases(projectId, record.id).catch(() => [])] as const));
            setShares(Object.fromEntries(listedShares));
            setError("");
            // Follow the newest run unless the user opened a specific one.
            // The old rule was `current ?? newest`, which set the selection
            // once and never advanced it, so a build you had just triggered
            // never became the selected run.
            const preferredBuild = preferredJobId
                ? nextCandidates.flatMap((item) => item.builds?.length ? item.builds : item.latest_build ? [item.latest_build] : [])
                    .find((build) => build.job_id === preferredJobId)
                : null;
            setSelectedBuildId((current) => {
                // A run being composed has no build yet; refreshing must not
                // drop the user onto the newest finished one.
                if (preferredBuild) return preferredBuild.id;
                if (draftingRef.current) return current;
                if (pinnedRef.current && current) return current;
                return current;
            });
            if (preferredBuild) setCurrentBuildId(preferredBuild.id);
            return preferredBuild?.id ?? null;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
            return null;
        }
    }, [projectId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    // Configuration is a revision-scoped input to a new release. It is kept
    // deliberately separate from project history so selecting a commit does
    // not restart candidates, shares, or detail fetches.
    useEffect(() => {
        let cancelled = false;
        setConfigurations(null);
        // HEAD is a moving ref. A release configuration must be read from the
        // exact immutable revision that will be built, never the working tree.
        if (!selectedCommitValid) {
            setConfigurations([]);
            return;
        }
        void api.listConfigurations(projectId, commitSha)
            .then((next) => {
                if (cancelled) return;
                setConfigurations(next);
                setConfigKey((current) => next.some((item) => item.config_key === current) ? current : next[0]?.config_key || "default");
            })
            .catch((cause: unknown) => {
                if (cancelled) return;
                setConfigurations([]);
                setError(cause instanceof Error ? cause.message : String(cause));
            });
        return () => { cancelled = true; };
    }, [projectId, commitSha, selectedCommitValid]);

    useEffect(() => {
        let cancelled = false;
        setCommitsLoading(true);
        void api
            .listProjectCommits(projectId)
            .then((next) => {
                if (cancelled) return;
                setCommits(next);
                setCommitSha((current) => resolveCommitSelection(current, next));
            })
            .catch(() => {
                if (!cancelled) setCommits([]);
            })
            .finally(() => {
                if (!cancelled) setCommitsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    useEffect(() => {
        if (!selectedBuildId) {
            setDetail(null);
            return;
        }
        // Do not render the preceding run while this run's detail is loading.
        // The id guard below is a second line of defence for batched updates.
        setDetail(null);
        void refreshDetail(selectedBuildId).catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : String(cause));
        });
    }, [refreshDetail, selectedBuildId]);

    useEffect(() => {
        if (stage !== "signoff" || !selectedBuildId) return;
        const timer = window.setInterval(() => {
            void refreshDetail(selectedBuildId).catch(() => undefined);
        }, 3000);
        return () => window.clearInterval(timer);
    }, [refreshDetail, selectedBuildId, stage]);

    useEffect(() => {
        const jobId = selectedDetail?.build.job_id;
        if (!jobId || selectedDetail.build.status !== "running" || activeJobIdRef.current === jobId) return;
        const controller = new AbortController();
        setCurrentBuildId(selectedDetail.build.id);
        void watchPrismJob(jobId, {
            signal: controller.signal,
            includeLogs: true,
            onUpdate: (value, logs) => {
                setJobStatus(value.status);
                setJobMessage(value.message);
                setJobPercent(value.percent);
                setLiveLogs(logs);
                const next = jobPipeline(value);
                if (next) setPipeline(next);
            },
        }).then(async () => {
            await refresh(jobId);
            await refreshDetail(selectedDetail.build.id).catch(() => undefined);
        }).catch((cause: unknown) => {
            if (cause instanceof DOMException && cause.name === "AbortError") return;
            setError(cause instanceof Error ? cause.message : String(cause));
        });
        return () => controller.abort();
    }, [refresh, refreshDetail, selectedDetail?.build.id, selectedDetail?.build.job_id, selectedDetail?.build.status]);

    useEffect(() => {
        const auditConfigKey = selectedDetail?.candidate?.config_key || selectedDetail?.configuration?.config_key || "";
        if (!auditConfigKey) return;
        let cancelled = false;
        void Promise.all([
            api.listAudit(projectId, auditConfigKey).catch(() => []),
            api.verifyAudit(projectId, auditConfigKey).catch(() => null),
        ]).then(([events, chain]) => {
            if (cancelled) return;
            setAudit(events.filter((event) => !selectedBuildId || event.subject_id === selectedBuildId));
            setAuditOk(chain?.ok ?? null);
        });
        return () => { cancelled = true; };
    }, [projectId, selectedBuildId, selectedDetail]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        if (selectedBuildId) url.searchParams.set("build", selectedBuildId);
        else url.searchParams.delete("build");
        window.history.replaceState(window.history.state, "", url.toString());
    }, [selectedBuildId]);

    const openRun = useCallback((buildId: string, destination: RunStage = "build") => {
        pinnedRef.current = true;
        // Selecting an already-open library record must retain its detail:
        // React does not rerun the fetch effect for an unchanged build id.
        // Different ids still clear synchronously before their fetch starts.
        if (buildId !== selectedBuildId) {
            setDetail(null);
            setPipeline(null);
            setJobStatus("");
            setJobMessage("");
            setJobPercent(0);
        }
        setStage(destination);
        setSelectedBuildId(buildId);
    }, [selectedBuildId]);

    const run = useCallback(
        async (label: string, action: () => Promise<unknown>, success = "") => {
            const buildId = selectedBuildIdRef.current;
            let completed = false;
            setBusy(label);
            setError("");
            setNotice("");
            try {
                await action();
                // Governance responses alter the current build detail. Fetch
                // it before showing success, otherwise gates read old facts.
                if (buildId && selectedBuildIdRef.current === buildId) await refreshDetail(buildId);
                completed = true;
                if (success) setNotice(success);
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
            } finally {
                // A queued build can fail before a job update reaches us. Its
                // attempt must still enter history and become the selected log.
                await refresh();
                if (!completed && buildId && selectedBuildIdRef.current === buildId) {
                    await refreshDetail(buildId).catch(() => undefined);
                }
                setBusy("");
            }
        },
        [refresh, refreshDetail],
    );

    const handleBuild = () => {
        if (!selectedCommitValid) {
            setError("Choose a listed immutable 40-character commit before building.");
            return;
        }
        return run("build", async () => {
            setView("current");
            setStage("build");
            setPipeline(emptyPipeline());
            setLiveLogs([]);
            // A new run starts with nothing done. Leaving the previous build
            // selected left its finished detail driving the rail, so a build
            // that had only just been queued showed Source, Outputs, Sign-off
            // and Released already ticked -- the last run's state wearing the
            // new run's progress bar. Release the pin too, so refresh() lands
            // on the run being created.
            pinnedRef.current = false;
            setDrafting(false);
            setSelectedBuildId(null);
            setDetail(null);
            const { job } = await api.startBuild(projectId, {
                config_key: configKey,
                commit_sha: commitSha,
                variant: variant.trim(),
            });
            setActiveJobId(job.job_id);
            const finished = await watchPrismJob(job.job_id, {
                includeLogs: true,
                onUpdate: (value, logs) => {
                    setJobStatus(value.status);
                    setJobMessage(value.message);
                    setJobPercent(value.percent);
                    setLiveLogs(logs);
                    const next = jobPipeline(value);
                    if (next) setPipeline(next);
                },
            });
            const next = jobPipeline(finished);
            if (next) setPipeline(next);
            const builtId = await refresh(job.job_id);
            if (builtId) {
                pinnedRef.current = true;
                setCurrentBuildId(builtId);
                setSelectedBuildId(builtId);
            }
            setActiveJobId(null);
            if (finished.status === "completed") setStage("outputs");
            else setStage("build");
            throwIfJobFailed(finished, "The build failed.");
        }, "Build finished.");
    };

    const handleCancel = async () => {
        const jobId = activeJobId ?? selectedDetail?.build.job_id ?? null;
        if (!jobId || busy === "cancel-build") return;
        setBusy("cancel-build");
        setError("");
        try {
            await cancelPrismJob(jobId);
            setJobStatus("cancel_requested");
            setJobMessage("Cancellation requested");
            setNotice("Cancellation requested.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setBusy("");
        }
    };

    const handleSaveConfiguration = async (
        key: string,
        document: EditableReleaseConfiguration,
    ) => {
        setBusy("save-config");
        setError("");
        setNotice("");
        try {
            const saved = await api.saveConfiguration(projectId, key, document, commitSha);
            const nextCommits = await api.listProjectCommits(projectId);
            setCommits(nextCommits);
            setConfigKey(saved.configuration.config_key);
            setCommitSha(saved.commit_sha);
            setConfigurations([saved.configuration]);
            setNotice("Configuration published to the tracked branch and selected.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setBusy("");
        }
    };

    const evaluation = selectedDetail?.evaluation ?? null;
    const openBlockers = useMemo(
        () =>
            (evaluation?.findings ?? []).filter(
                (finding) =>
                    finding.status !== "waived"
                    && (finding.severity === "blocker" || finding.severity === "failure"),
            ),
        [evaluation],
    );

    const selectedCandidate = useMemo(
        () => candidates.find((item) => (item.builds?.length ? item.builds : item.latest_build ? [item.latest_build] : []).some((build) => build.id === selectedBuildId)) ?? selectedDetail?.candidate ?? null,
        [candidates, selectedBuildId, selectedDetail?.candidate],
    );
    const newestBuildId = candidates.flatMap((item) => item.builds?.length ? item.builds : item.latest_build ? [item.latest_build] : [])
        .sort((left, right) => Date.parse(right.completed_at || right.started_at || "") - Date.parse(left.completed_at || left.started_at || ""))[0]?.id ?? null;
    const behind = Boolean(
        selectedBuildId && newestBuildId && selectedBuildId !== newestBuildId,
    );
    const releasedHere = records.filter((record) => record.build_id === selectedBuildId);

    const building = Boolean(activeJobId) || selectedDetail?.build.status === "running" || busy === "build";
    const stageStates = useMemo<Record<RunStage, StageState>>(() => {
        if (drafting) {
            return {
                source: "active", build: "locked", outputs: "locked", signoff: "locked", released: "locked",
            };
        }
        if (building) return { source: "done", build: "active", outputs: "locked", signoff: "locked", released: "locked" };
        const status = selectedDetail?.build.status;
        const built = status === "succeeded";
        if (status === "failed") return { source: "done", build: "failed", outputs: "locked", signoff: "locked", released: "locked" };
        if (status === "cancelled") return { source: "done", build: "cancelled", outputs: "locked", signoff: "locked", released: "locked" };
        if (!built) return { source: selectedCandidate ? "done" : "active", build: "active", outputs: "locked", signoff: "locked", released: "locked" };
        return {
            source: selectedCandidate ? "done" : "pending",
            build: "done",
            outputs: stage === "signoff" || stage === "released" ? "done" : "active",
            signoff: releasedHere.length > 0 ? "done" : stage === "signoff" ? "active" : "locked",
            // The library is project-wide, while its record actions remain
            // record/build-bound. Keep it reachable from an older run.
            released: releasedHere.length > 0 ? "done" : records.length > 0 ? "active" : "locked",
        };
    }, [building, drafting, selectedDetail?.build.status, selectedCandidate, records.length, releasedHere.length, stage]);

    const stageSummaries = useMemo<Partial<Record<RunStage, string>>>(
        () => (building ? { build: "running" } : drafting ? { source: "choose a revision" } : {
            source: selectedCandidate
                ? `${selectedCandidate.commit_sha.slice(0, 8)} · ${selectedCandidate.config_key}`
                : undefined,
            build: selectedDetail ? selectedDetail.build.status : undefined,
            outputs: selectedDetail ? `${selectedDetail.members.length} members` : undefined,
            signoff: selectedDetail
                ? openBlockers.length > 0
                    ? `${openBlockers.length} blocker(s)`
                    : `${selectedDetail.approvals.length} approval(s)`
                : undefined,
            released: releasedHere.length ? `${releasedHere.length} release(s)` : records.length ? `${records.length} in library` : undefined,
        }),
        [building, drafting, selectedCandidate, selectedDetail, openBlockers.length, records.length, releasedHere.length],
    );


    return (
        <div className="flex h-full min-h-0 flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
                <h2 className="text-sm font-semibold">Release Studio</h2>
                <div className="flex items-center gap-1">
                    {([
                        { id: "settings", label: "Settings", icon: Settings2 },
                        { id: "current", label: "Current", icon: ListRestart },
                        { id: "history", label: "History", icon: History },
                        { id: "library", label: "Library", icon: Archive },
                    ] as const).map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => {
                                setView(id);
                                setDrafting(false);
                                if (id === "current") {
                                    setSelectedBuildId(currentBuildId);
                                    setStage(activeJobId ? "build" : "outputs");
                                } else if (id === "history" || id === "library") {
                                    pinnedRef.current = false;
                                    setSelectedBuildId(null);
                                    setDetail(null);
                                    setStage(id === "library" ? "released" : "build");
                                }
                            }}
                            aria-current={view === id ? "page" : undefined}
                            className={cn(
                                "flex items-center gap-1.5 rounded px-3 py-1 text-sm",
                                view === id ? "bg-muted font-medium" : "text-muted-foreground",
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                        </button>
                    ))}
                </div>
                {auditOk !== null && (
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant={auditOk ? "secondary" : "destructive"} size="sm" className="ml-auto gap-1">
                                {auditOk ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                Audit chain {auditOk ? "verified" : "BROKEN"}
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="flex w-full flex-col sm:max-w-lg">
                            <SheetHeader><SheetTitle>Audit chain</SheetTitle></SheetHeader>
                            <div className="mt-4 min-h-0 space-y-2 overflow-y-auto font-mono text-xs">
                                {audit.length === 0 && <p className="font-sans text-sm text-muted-foreground">No events for this build.</p>}
                                {audit.map((event) => <div key={event.id} className="border p-2"><span className="text-muted-foreground">{event.sequence}</span> {event.event_type} <span className="text-muted-foreground">{event.actor}</span></div>)}
                            </div>
                        </SheetContent>
                    </Sheet>
                )}
            </header>

            {error && (
                <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    {error}
                </div>
            )}
            {notice && (
                <div className="border-b border-success/40 bg-success/10 px-4 py-2 text-sm text-success">
                    {notice}
                </div>
            )}

            {view === "settings" ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    <DefineConfigStep
                        configurations={configurations}
                        configKey={configKey}
                        variant={variant}
                        profiles={profiles}
                        commits={commits}
                        commitSha={commitSha}
                        commitsLoading={commitsLoading}
                        canMutate={canMutate}
                        busy={busy}
                        onConfigKey={setConfigKey}
                        onVariant={setVariant}
                        onCommit={setCommitSha}
                        onSave={handleSaveConfiguration}
                        onBuild={() => void handleBuild()}
                    />
                </div>
            ) : (
                <div className="flex min-h-0 flex-1">
                    {(view === "history" || view === "library") && (
                        <RunList
                            mode={view}
                            candidates={candidates}
                            records={records}
                            selectedBuildId={selectedBuildId}
                            onSelect={(buildId) => {
                                setDrafting(false);
                                openRun(buildId);
                            }}
                            onSelectRecord={(record) => {
                                setDrafting(false);
                                openRun(record.build_id, "released");
                            }}
                        />
                    )}

                    {!selectedBuildId && !building && !drafting ? (
                        <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                            Select a run, or start a new release.
                        </div>
                    ) : (
                        <div className="flex min-h-0 flex-1 flex-col">
                            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
                                <span className="font-mono text-sm">
                                    {selectedCandidate?.commit_sha.slice(0, 12)
                                        ?? (building || drafting
                                            ? commitSha.slice(0, 12)
                                            : selectedBuildId)}
                                </span>
                                <Badge variant="outline">
                                    {building
                                        ? "building"
                                        : drafting
                                          ? "new release"
                                          : (selectedDetail?.build.status ?? "loading")}
                                </Badge>
                                {behind && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            pinnedRef.current = false;
                                            if (newestBuildId) openRun(newestBuildId);
                                        }}
                                    >
                                        Jump to latest
                                    </Button>
                                )}
                            </div>
                            <IdentityStrip
                                candidate={selectedCandidate}
                                configuration={drafting ? configurations?.find((item) => item.config_key === configKey) ?? null : selectedDetail?.configuration ?? null}
                                fallbackCommit={commitSha}
                                variant={variant}
                            />
                            <div className="flex min-h-0 flex-1">
                                <div className="w-56 shrink-0 border-r p-2">
                                    <StageRail
                                        stage={stage}
                                        states={stageStates}
                                        summaries={stageSummaries}
                                        onSelect={(next) => {
                                            if (stageStates[next] !== "locked") setStage(next);
                                        }}
                                    />
                                </div>
                                <div className="min-w-0 flex-1 overflow-y-auto p-6">
                                    {stage === "source" && drafting && (
                                        <SelectRevisionStep
                                            commits={commits}
                                            commitSha={commitSha}
                                            loading={commitsLoading}
                                            busy={Boolean(busy)}
                                            configurations={configurations}
                                            configKey={configKey}
                                            variant={variant}
                                            onConfigKey={setConfigKey}
                                            onVariant={setVariant}
                                            actionLabel={
                                                drafting ? "Build this revision" : "Continue"
                                            }
                                            onSelect={(value) => setCommitSha(resolveCommitSelection(value, commits))}
                                            onContinue={() =>
                                                drafting
                                                    ? void handleBuild()
                                                    : setStage("build")
                                            }
                                        />
                                    )}
                                    {stage === "source" && !drafting && selectedDetail && (
                                        <SourceDetails detail={selectedDetail} />
                                    )}
                                    {stage === "build" && (
                                        <ObserveBuildStep
                                            pipeline={pipeline}
                                            jobStatus={jobStatus}
                                            message={jobMessage}
                                            percent={jobPercent}
                                            projectId={projectId}
                                            buildId={selectedBuildId}
                                            liveLogs={liveLogs}
                                            canCancel={Boolean(activeJobId ?? selectedDetail?.build.job_id) && canMutate && (jobStatus || selectedDetail?.build.status) !== "cancel_requested" && selectedDetail?.build.status !== "succeeded" && selectedDetail?.build.status !== "failed" && selectedDetail?.build.status !== "cancelled"}
                                            cancelling={busy === "cancel-build"}
                                            onCancel={() => void handleCancel()}
                                        />
                                    )}
                                    {stage === "outputs" && selectedDetail && (
                                        <InspectOutputsStep
                                            projectId={projectId}
                                            detail={selectedDetail}
                                            profiles={profiles}
                                            busy={busy}
                                            onContinue={() => setStage("signoff")}
                                            onRun={run}
                                        />
                                    )}
                                    {stage === "outputs" && !selectedDetail && <LockedStage />}
                                    {stage === "signoff" && selectedDetail && (
                                        <SignOffStep
                                            projectId={projectId}
                                            detail={selectedDetail}
                                            configuration={selectedDetail.configuration}
                                            canMutate={canMutate}
                                            isAdmin={isAdmin}
                                            busy={busy}
                                            openBlockers={openBlockers}
                                            onRun={run}
                                        />
                                    )}
                                    {stage === "signoff" && !selectedDetail && <LockedStage />}
                                    {stage === "released" && (
                                        <div className="space-y-3">
                                            <h3 className="text-lg font-semibold">Released</h3>
                                            <ReleaseRecordsList
                                                projectId={projectId}
                                                records={records}
                                                shares={shares}
                                                shareUrls={shareUrls}
                                                verification={verification}
                                                canMutate={canMutate}
                                                busy={busy}
                                                profiles={profiles}
                                                vendorReadinessByBuild={selectedDetail ? { [selectedDetail.build.id]: selectedDetail.vendor_readiness } : {}}
                                                onRun={run}
                                                onVerified={(recordId, report) => setVerification((current) => ({ ...current, [recordId]: report }))}
                                                onShared={(recordId, url) => setShareUrls((current) => ({ ...current, [recordId]: url }))}
                                            />
                                        </div>
                                    )}
                                    {stage !== "source" && stage !== "build" && stage !== "outputs" && stage !== "signoff" && stage !== "released" && <LockedStage />}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ReleaseStudioPanel;

function IdentityStrip({
    candidate,
    configuration,
    fallbackCommit,
    variant,
}: {
    candidate: ReleaseCandidate | null;
    configuration: ReleaseConfiguration | null;
    fallbackCommit: string;
    variant: string;
}) {
    const commit = candidate?.commit_sha || fallbackCommit;
    const resolvedVariant = candidate?.variant || variant || configuration?.default_variant || "default";
    return <div aria-label="Release identity" className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2 text-xs">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="rounded border bg-background px-2 py-1 font-mono">{commit.slice(0, 12) || "HEAD"}</span>
        <span className="rounded border bg-background px-2 py-1">{configuration?.config_key || candidate?.config_key || "—"}</span>
        <span className="rounded border bg-background px-2 py-1">{resolvedVariant}</span>
        <span className="rounded border bg-background px-2 py-1">Document {configuration?.document_number || "—"}</span>
        <span className="rounded border bg-background px-2 py-1">Rev {configuration?.revision || "—"}</span>
    </div>;
}

function LockedStage() {
    return <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">This stage is locked until the preceding build evidence is available.</div>;
}

function SourceDetails({ detail }: { detail: BuildDetail }) {
    const source = detail.candidate;
    const configuration = detail.configuration;
    const rows = [
        ["Commit", source?.commit_sha || "—"],
        ["Configuration", source?.config_key || configuration?.config_key || "—"],
        ["Variant", source?.variant || configuration?.default_variant || "default"],
        ["Board", configuration?.board_rel || "—"],
        ["Schematic", configuration?.schematic_rel || "—"],
        ["Jobset", configuration?.jobset_rel || "—"],
    ];
    return <div className="space-y-4"><h3 className="text-lg font-semibold">Source</h3><dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="space-y-1"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="break-all font-mono text-sm">{value}</dd></div>)}</dl></div>;
}
