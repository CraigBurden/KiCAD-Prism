import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, Check, Circle, Loader2, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type {
    PipelineJob,
    PipelineState,
    PipelineStep,
    PipelineStepStatus,
} from "../types";

export function ObserveBuildStep({
    pipeline,
    jobStatus,
    message,
    percent,
    liveLogs = [],
    canCancel = false,
    cancelling = false,
    onCancel,
    projectId,
    buildId,
}: {
    pipeline: PipelineState | null;
    jobStatus: string;
    message: string;
    percent: number;
    liveLogs?: string[];
    canCancel?: boolean;
    cancelling?: boolean;
    onCancel?: () => void;
    projectId?: string;
    buildId?: string | null;
}) {
    const jobs = useMemo(() => pipeline?.jobs ?? [], [pipeline]);
    const [selectedId, setSelectedId] = useState(
        jobs.find((job) => job.status === "failure" || job.status === "in_progress")?.id
            ?? jobs[0]?.id
            ?? "",
    );
    const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0];
    const [openStep, setOpenStep] = useState<string | null>(
        selected?.steps.find((step) => step.status === "failure" || step.status === "in_progress")?.id ?? null,
    );
    const logRef = useRef<HTMLPreElement>(null);
    const live = jobStatus === "queued" || jobStatus === "running" || jobStatus === "cancel_requested";

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [liveLogs]);

    useEffect(() => {
        const focus = jobs.find((job) => job.status === "failure")
            ?? jobs.find((job) => job.status === "in_progress");
        if (focus && !jobs.some((job) => job.id === selectedId)) setSelectedId(focus.id);
        const step = focus?.steps.find((item) => item.status === "failure")
            ?? focus?.steps.find((item) => item.status === "in_progress");
        if (step && !jobs.flatMap((job) => job.steps).some((item) => item.id === openStep)) setOpenStep(step.id);
    }, [jobs, openStep, selectedId]);

    // Live logs are only the worker stdout for this attempt. Reopening a
    // finished run does not replay them; they were never stored for the UI.
    if (jobs.length === 0 && projectId && buildId) {
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Build</h3>
                <p className="text-sm text-muted-foreground">
                    Live logs are shown while a run is in progress. This attempt has finished; step status is kept on the pipeline rail.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="text-lg font-semibold">Build</h3>
                    <p className="text-sm text-muted-foreground">
                        {jobStatus ? `Run ${jobStatus}` : "Waiting for the worker."}
                        {message ? ` — ${message}` : ""}
                    </p>
                    <div
                        className="h-1.5 overflow-hidden bg-muted"
                        role="progressbar"
                        aria-label="Release build progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(percent || 0)}
                    >
                        <div
                            className="h-full bg-primary transition-[width] duration-300"
                            style={{ width: `${Math.max(0, Math.min(100, percent || 0))}%` }}
                        />
                    </div>
                    <p className="text-xs tabular-nums text-muted-foreground">{Math.round(percent || 0)}%</p>
                </div>
                {canCancel && onCancel && (
                    <Button className="ml-auto" size="sm" variant="destructive" disabled={cancelling} onClick={onCancel}>
                        {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-3 w-3 fill-current" />}
                        Cancel build
                    </Button>
                )}
            </div>
            <div className="grid min-h-[28rem] grid-cols-1 border lg:grid-cols-[16rem_minmax(0,1fr)]">
                <nav className="border-b lg:border-b-0 lg:border-r">
                    {jobs.length === 0 && (
                        <p className="p-3 text-sm text-muted-foreground">Queued…</p>
                    )}
                    {jobs.map((job) => (
                        <button
                            key={job.id}
                            type="button"
                            onClick={() => setSelectedId(job.id)}
                            className={cn(
                                "flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0",
                                selected?.id === job.id ? "bg-muted" : "hover:bg-muted/40",
                            )}
                        >
                            <StatusIcon status={job.status} />
                            <span className="flex-1 truncate">{job.name}</span>
                            <Duration steps={job.steps} />
                        </button>
                    ))}
                </nav>
                <div className="p-3">
                    {!selected && <p className="text-sm text-muted-foreground">Select a job.</p>}
                    {selected && (
                        <ol className="space-y-1">
                            {selected.steps.map((step) => {
                                const open = openStep === step.id;
                                return (
                                    <li key={step.id} className="border">
                                        <button
                                            type="button"
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                                            onClick={() => setOpenStep(open ? null : step.id)}
                                        >
                                            <StatusIcon status={step.status} />
                                            <span className="flex-1">{step.name}</span>
                                            {typeof step.elapsed_ms === "number" && (
                                                <span className="text-xs text-muted-foreground">
                                                    {(step.elapsed_ms / 1000).toFixed(1)}s
                                                </span>
                                            )}
                                        </button>
                                        {open && (step.log || step.message) && (
                                            <pre className="max-h-64 overflow-auto border-t bg-muted/30 p-2 text-xs">
                                                {step.message ? `${step.message}\n` : ""}
                                                {step.log}
                                            </pre>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>
            </div>
            {(liveLogs.length > 0 || live) && (
                <div className="overflow-hidden rounded-md border bg-muted/30">
                    <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
                        {live && <Loader2 className="h-3 w-3 animate-spin" />}
                        <span className="font-mono">live.log</span>
                        <span className="ml-auto tabular-nums">{Math.round(percent || 0)}%</span>
                    </div>
                    <pre
                        ref={logRef}
                        aria-label="Live build log"
                        className="h-72 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5"
                    >
                        {liveLogs.join("\n") || "Waiting for worker output…"}
                    </pre>
                </div>
            )}
        </div>
    );
}

function StatusIcon({ status }: { status: PipelineStepStatus }) {
    if (status === "in_progress") {
        return <Loader2 className="h-4 w-4 animate-spin text-warning" aria-label="in progress" />;
    }
    if (status === "success") {
        return <Check className="h-4 w-4 text-success" aria-label="success" />;
    }
    if (status === "failure") {
        return <X className="h-4 w-4 text-destructive" aria-label="failure" />;
    }
    if (status === "cancelled") {
        return <Ban className="h-4 w-4 text-warning" aria-label="cancelled" />;
    }
    return <Circle className="h-3 w-3 text-muted-foreground" aria-label={status} />;
}

function Duration({ steps }: { steps: PipelineStep[] }) {
    const total = steps.reduce((sum, step) => sum + (step.elapsed_ms ?? 0), 0);
    if (!total) return null;
    return <span className="text-xs text-muted-foreground">{(total / 1000).toFixed(0)}s</span>;
}

export function emptyPipeline(): PipelineState {
    const queued = (id: string, name: string, steps: Array<[string, string]>): PipelineJob => ({
        id,
        name,
        status: "queued",
        steps: steps.map(([stepId, stepName]) => ({ id: stepId, name: stepName, status: "queued" })),
    });
    return {
        jobs: [
            queued("closure", "Closure", [["closure", "Materialize input closure"]]),
            queued("checks", "Checks", [["drc", "DRC"], ["erc", "ERC"], ["board_stats", "Board stats"]]),
            queued("assembly", "Assembly", [
                ["positions", "Positions"],
                ["bom", "Bill of materials"],
                ["cruncher-assembly", "Assembly views"],
            ]),
            queued("artwork", "Artwork", [["gerbers", "Gerbers"], ["drill", "Drill"], ["schematic_pdf", "Schematic PDF"]]),
            queued("documents", "Documents", [
                ["documents-cover", "Cover page"],
                ["documents-fabrication", "Fabrication drawings"],
                ["documents-impedance", "Controlled impedance table"],
                ["documents-stackup", "Append manufacturer stackup"],
                ["documents-assembly", "Assembly drawings"],
                ["documents-testpoint", "Testpoint drawings"],
                ["documents-drill", "Drill drawing"],
                ["documents-bom", "Bill of materials PDF"],
                ["documents", "Finish documentation"],
            ]),
            queued("package", "Package", [["package", "Canonicalize, fingerprint, record"]]),
        ],
    };
}
