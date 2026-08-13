import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, ListRestart, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelPrismJob, jobPipeline, throwIfJobFailed, watchPrismJob } from "@/lib/jobs";
import { cn } from "@/lib/utils";

import * as api from "./api";
import { RunList } from "./RunList";
import { StageRail } from "./StageRail";
import { InspectOutputsStep } from "./steps/InspectOutputsStep";
import { emptyPipeline, ObserveBuildStep } from "./steps/ObserveBuildStep";
import { PublishStep } from "./steps/PublishStep";
import { IdentityStep } from "./steps/IdentityStep";
import { ManufacturingStep } from "./steps/ManufacturingStep";
import { SourceStep } from "./steps/SourceStep";
import type {
    BuildDetail,
    ManufacturingChoices,
    PipelineState,
    ProjectCommit,
    ReleaseCandidate,
    ReleaseConfiguration,
    ReleaseIdentity,
    ReleaseManufacturing,
    ReleaseSource,
    RunStage,
    StageState,
    StudioView,
    VendorProfile,
} from "./types";

type Props = {
    projectId: string;
    canMutate: boolean;
    defaultCommit?: string;
};

const FULL_SHA = /^[a-f0-9]{40}$/i;

function resolveCommitSelection(value: string, commits: ProjectCommit[]): string {
    const revision = value.trim();
    if (revision === "HEAD") return commits[0]?.full_hash ?? revision;
    return commits.find((commit) => commit.full_hash === revision || commit.hash === revision)?.full_hash ?? revision;
}

export function ReleaseStudioPanel({
    projectId,
    canMutate,
    defaultCommit = "HEAD",
}: Props) {
    const [view, setView] = useState<StudioView>(() => {
        if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("build")) return "history";
        return "current";
    });
    const [stage, setStage] = useState<RunStage>("source");
    // Set when the user opens a specific run, so a newer build does not pull
    // the view out from under someone reading an older release's evidence.
    const pinnedRef = useRef(false);
    // "New release" opens the Source stage so a revision and configuration can
    // be chosen. Building immediately took that choice away and made the button
    // fire an expensive job on a single click.
    const [drafting, setDrafting] = useState(() => {
        if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("build")) return false;
        return true;
    });
    const draftingRef = useRef(false);
    draftingRef.current = drafting;
    const [commits, setCommits] = useState<ProjectCommit[]>([]);
    const [commitsLoading, setCommitsLoading] = useState(true);
    const [commitSha, setCommitSha] = useState(defaultCommit);
    const [variant, setVariant] = useState("");
    const [bomPreset, setBomPreset] = useState("");
    const [source, setSource] = useState<ReleaseSource | null>(null);
    const [ipc, setIpc] = useState<ManufacturingChoices>({ manufacturing: [], assembly: [] });
    const [identity, setIdentity] = useState<ReleaseIdentity>(() => ({
        tag: "",
        document_name: "",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
    }));
    const [manufacturing, setManufacturing] = useState<ReleaseManufacturing>({
        manufacturing_ipc_class: "IPC-6012 Class 2",
        assembly_ipc_class: "IPC-A-610 Class 2",
        solder_mask_colour: "",
        silkscreen_colour: "",
        via_treatment: "",
        vendors: [],
    });
    const [impedanceCsv, setImpedanceCsv] = useState("");
    const [stackupName, setStackupName] = useState("");
    const [stackupB64, setStackupB64] = useState("");
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
            const [nextCandidates, nextProfiles] = await Promise.all([
                api.listCandidates(projectId),
                api.listVendorProfiles(projectId).catch(() => []),
            ]);
            setCandidates(nextCandidates);
            setProfiles(nextProfiles);
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
        if (!selectedCommitValid) {
            setSource(null);
            return;
        }
        void api.getSource(projectId, commitSha)
            .then((next) => {
                if (cancelled) return;
                setSource(next.source);
                setIpc(next.ipc);
                setVariant(next.source.variant || next.source.variants[0] || "default");
                setBomPreset(next.source.default_bom_preset || "");
                setManufacturing((current) => current.vendors.length ? current : { ...current, vendors: profiles.map((item) => item.id) });
            })
            .catch((cause: unknown) => {
                if (cancelled) return;
                setSource(null);
                setError(cause instanceof Error ? cause.message : String(cause));
            });
        return () => { cancelled = true; };
    }, [projectId, commitSha, selectedCommitValid, profiles]);

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
        if (stage !== "publish" || !selectedBuildId) return;
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
            setLiveLogs([]);
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
            // that had only just been queued showed Source, Outputs, and
            // Publish already ticked -- the last run's state wearing the
            // new run's progress bar. Release the pin too, so refresh() lands
            // on the run being created.
            pinnedRef.current = false;
            setDrafting(false);
            setSelectedBuildId(null);
            setDetail(null);
            const { job } = await api.startBuild(projectId, {
                commit_sha: commitSha,
                variant: variant.trim(),
                board: source?.board,
                schematic: source?.schematic,
                bom_preset: bomPreset,
                identity,
                manufacturing,
                impedance_csv: impedanceCsv,
                stackup_pdf_b64: stackupB64,
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

    const selectedCandidate = useMemo(
        () => candidates.find((item) => (item.builds?.length ? item.builds : item.latest_build ? [item.latest_build] : []).some((build) => build.id === selectedBuildId)) ?? selectedDetail?.candidate ?? null,
        [candidates, selectedBuildId, selectedDetail?.candidate],
    );
    const newestBuildId = candidates.flatMap((item) => item.builds?.length ? item.builds : item.latest_build ? [item.latest_build] : [])
        .sort((left, right) => Date.parse(right.completed_at || right.started_at || "") - Date.parse(left.completed_at || left.started_at || ""))[0]?.id ?? null;
    const behind = Boolean(
        selectedBuildId && newestBuildId && selectedBuildId !== newestBuildId,
    );

    const building = Boolean(activeJobId) || selectedDetail?.build.status === "running" || busy === "build";
    const stageStates = useMemo<Record<RunStage, StageState>>(() => {
        const locked = { source: "locked", identity: "locked", manufacturing: "locked", build: "locked", outputs: "locked", publish: "locked" } as const;
        if (drafting) {
            const draft: Record<RunStage, StageState> = { ...locked, source: stage === "source" ? "active" : "done" };
            if (stage === "identity") draft.identity = "active";
            else if (stage !== "source") draft.identity = "done";
            if (stage === "manufacturing") draft.manufacturing = "active";
            else if (stage === "build" || stage === "outputs" || stage === "publish") draft.manufacturing = "done";
            return draft;
        }
        if (building) return { ...locked, source: "done", identity: "done", manufacturing: "done", build: "active" };
        const status = selectedDetail?.build.status;
        const built = status === "succeeded";
        if (status === "failed") return { ...locked, source: "done", identity: "done", manufacturing: "done", build: "failed" };
        if (status === "cancelled") return { ...locked, source: "done", identity: "done", manufacturing: "done", build: "cancelled" };
        if (!built) return { ...locked, source: selectedCandidate ? "done" : "active", build: "active" };
        return {
            source: "done",
            identity: "done",
            manufacturing: "done",
            build: "done",
            outputs: stage === "publish" ? "done" : "active",
            publish: stage === "publish" ? "active" : "pending",
        };
    }, [building, drafting, selectedDetail?.build.status, selectedCandidate, stage]);

    const stageSummaries = useMemo<Partial<Record<RunStage, string>>>(
        () => (building ? { build: "running" } : drafting ? { source: "choose a revision" } : {
            source: selectedCandidate
                ? `${selectedCandidate.commit_sha.slice(0, 8)} · ${selectedCandidate.config_key}`
                : undefined,
            build: selectedDetail ? selectedDetail.build.status : undefined,
            outputs: selectedDetail ? `${selectedDetail.members.length} members` : undefined,
            publish: selectedDetail?.forge?.name,
        }),
        [building, drafting, selectedCandidate, selectedDetail],
    );

    return (
        <div className="flex h-full min-h-0 flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
                <div className="flex items-center gap-1">
                    {([
                        { id: "settings", label: "New release", icon: Settings2 },
                        { id: "current", label: "Current", icon: ListRestart },
                        { id: "history", label: "History", icon: History },
                    ] as const).map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => {
                                setView(id);
                                if (id === "settings") {
                                    setDrafting(true);
                                    setView("current");
                                    setStage("source");
                                    setSelectedBuildId(null);
                                    setDetail(null);
                                    return;
                                }
                                setDrafting(false);
                                if (id === "current") {
                                    setSelectedBuildId(currentBuildId);
                                    setStage(activeJobId ? "build" : "outputs");
                                } else if (id === "history") {
                                    pinnedRef.current = false;
                                    setSelectedBuildId(null);
                                    setDetail(null);
                                    setStage("build");
                                }
                            }}
                            aria-current={(view === id || (id === "settings" && drafting && !selectedBuildId)) ? "page" : undefined}
                            className={cn(
                                "flex items-center gap-1.5 rounded px-3 py-1 text-sm",
                                view === id || (id === "settings" && drafting && !selectedBuildId) ? "bg-muted font-medium" : "text-muted-foreground",
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                        </button>
                    ))}
                </div>
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

            {view === "settings" ? null : (
                <div className="flex min-h-0 flex-1">
                    {view === "history" && (
                        <RunList
                            candidates={candidates}
                            selectedBuildId={selectedBuildId}
                            onSelect={(buildId) => {
                                setDrafting(false);
                                openRun(buildId);
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
                                configuration={selectedDetail?.configuration ?? null}
                                identity={identity}
                                fallbackCommit={commitSha}
                                variant={variant}
                            />
                            <div className="flex min-h-0 flex-1">
                                <div className="w-56 shrink-0 border-r p-3">
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
                                        <SourceStep
                                            commits={commits}
                                            commitSha={commitSha}
                                            commitsLoading={commitsLoading}
                                            source={source}
                                            variant={variant}
                                            bomPreset={bomPreset}
                                            canMutate={canMutate}
                                            busy={busy}
                                            onCommit={(value) => setCommitSha(resolveCommitSelection(value, commits))}
                                            onBoard={(value) => setSource((current) => current ? { ...current, board: value } : current)}
                                            onSchematic={(value) => setSource((current) => current ? { ...current, schematic: value } : current)}
                                            onVariant={setVariant}
                                            onBomPreset={setBomPreset}
                                            onContinue={() => {
                                                if (!source) return;
                                                void api.saveSourceDefaults(projectId, {
                                                    board: source.board,
                                                    schematic: source.schematic,
                                                    variant,
                                                    bom_preset: bomPreset,
                                                }).catch((cause: unknown) => {
                                                    setError(cause instanceof Error ? cause.message : String(cause));
                                                }).finally(() => setStage("identity"));
                                            }}
                                        />
                                    )}
                                    {stage === "identity" && drafting && (
                                        <IdentityStep
                                            projectId={projectId}
                                            identity={identity}
                                            canMutate={canMutate}
                                            busy={busy}
                                            onChange={setIdentity}
                                            onContinue={() => setStage("manufacturing")}
                                        />
                                    )}
                                    {stage === "manufacturing" && drafting && (
                                        <ManufacturingStep
                                            projectId={projectId}
                                            manufacturing={manufacturing}
                                            ipc={ipc}
                                            profiles={profiles}
                                            canMutate={canMutate}
                                            busy={busy}
                                            impedanceCsv={impedanceCsv}
                                            stackupName={stackupName}
                                            onChange={setManufacturing}
                                            onImpedanceCsv={setImpedanceCsv}
                                            onStackup={(file) => {
                                                setStackupName(file?.name ?? "");
                                                if (!file) {
                                                    setStackupB64("");
                                                    return;
                                                }
                                                void file.arrayBuffer().then((buffer) => {
                                                    const bytes = new Uint8Array(buffer);
                                                    let binary = "";
                                                    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
                                                    setStackupB64(btoa(binary));
                                                });
                                            }}
                                            onBuild={() => void handleBuild()}
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
                                            onContinue={() => setStage("publish")}
                                            onRun={run}
                                        />
                                    )}
                                    {stage === "outputs" && !selectedDetail && <LockedStage />}
                                    {stage === "publish" && selectedDetail && (
                                        <PublishStep
                                            projectId={projectId}
                                            detail={selectedDetail}
                                            identity={identity}
                                            canMutate={canMutate}
                                            busy={busy}
                                            onRun={run}
                                        />
                                    )}
                                    {stage === "publish" && !selectedDetail && <LockedStage />}
                                    {stage !== "source" && stage !== "identity" && stage !== "manufacturing" && stage !== "build" && stage !== "outputs" && stage !== "publish" && <LockedStage />}
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
    identity,
    fallbackCommit,
    variant,
}: {
    candidate: ReleaseCandidate | null;
    configuration: ReleaseConfiguration | null;
    identity: ReleaseIdentity;
    fallbackCommit: string;
    variant: string;
}) {
    const commit = candidate?.commit_sha || fallbackCommit;
    const resolvedVariant = candidate?.variant || variant || configuration?.default_variant || "default";
    return (
        <div
            aria-label="Release identity"
            className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5 text-xs leading-none"
        >
            <History className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="inline-flex items-center rounded border bg-background px-2.5 py-1.5 font-mono leading-none">
                {commit.slice(0, 12) || "HEAD"}
            </span>
            <span className="inline-flex items-center rounded border bg-background px-2.5 py-1.5 leading-none">
                {resolvedVariant}
            </span>
            <span className="inline-flex items-center rounded border bg-background px-2.5 py-1.5 leading-none">
                Document Name {identity.document_name || configuration?.document_number || "—"}
            </span>
            <span className="inline-flex items-center rounded border bg-background px-2.5 py-1.5 leading-none">
                Rev {identity.tag || configuration?.revision || "—"}
            </span>
        </div>
    );
}

function LockedStage() {
    return <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">This stage is locked until the preceding build evidence is available.</div>;
}

function SourceDetails({ detail }: { detail: BuildDetail }) {
    const source = detail.candidate;
    const configuration = detail.configuration;
    const rows = [
        ["Commit", source?.commit_sha || "—"],
        ["Board", configuration?.board_rel || "—"],
        ["Schematic", configuration?.schematic_rel || "—"],
        ["Variant", source?.variant || configuration?.default_variant || "default"],
    ];
    return <div className="space-y-4"><h3 className="text-lg font-semibold">Source</h3><dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="space-y-1"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="break-all font-mono text-sm">{value}</dd></div>)}</dl></div>;
}
