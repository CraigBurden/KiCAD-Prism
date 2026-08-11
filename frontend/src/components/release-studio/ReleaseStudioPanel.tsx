import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    Download,
    FileCheck2,
    HelpCircle,
    Loader2,
    PlayCircle,
    ShieldCheck,
    XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { throwIfJobFailed, watchPrismJob } from "@/lib/jobs";
import { cn } from "@/lib/utils";

import * as api from "./api";
import type {
    Approval,
    AuditEvent,
    BuildDetail,
    Finding,
    ReleaseCandidate,
    ReleaseConfiguration,
    ReleaseMember,
    ReleaseRecord,
    RuleOutcome,
    VerificationReport,
    Waiver,
} from "./types";

type Props = {
    projectId: string;
    canMutate: boolean;
    defaultCommit?: string;
};

const DEFAULT_CONFIG = "default";

function shortDigest(value: string | null | undefined): string {
    if (!value) return "—";
    return value.length > 16 ? `${value.slice(0, 12)}…` : value;
}

/**
 * `unsupported` gets its own colour deliberately: a rule whose projection was
 * missing has not passed, and the report must never let the two read alike.
 */
function outcomeTone(outcome: string): string {
    switch (outcome) {
        case "pass":
            return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
        case "blocker":
        case "failure":
            return "bg-red-500/15 text-red-600 dark:text-red-400";
        case "warning":
            return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
        case "unsupported":
            return "bg-violet-500/15 text-violet-600 dark:text-violet-400";
        default:
            return "bg-muted text-muted-foreground";
    }
}

export function ReleaseStudioPanel({ projectId, canMutate, defaultCommit = "HEAD" }: Props) {
    const [candidates, setCandidates] = useState<ReleaseCandidate[]>([]);
    const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
    const [detail, setDetail] = useState<BuildDetail | null>(null);
    const [records, setRecords] = useState<ReleaseRecord[]>([]);
    const [waivers, setWaivers] = useState<Waiver[]>([]);
    const [audit, setAudit] = useState<AuditEvent[]>([]);
    const [auditOk, setAuditOk] = useState<boolean | null>(null);
    const [verification, setVerification] = useState<Record<string, VerificationReport>>({});
    const [busy, setBusy] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [notice, setNotice] = useState<string>("");
    const [commit, setCommit] = useState(defaultCommit);
    const [variant, setVariant] = useState("");
    const [jobStatus, setJobStatus] = useState<string>("");
    const [configurations, setConfigurations] = useState<ReleaseConfiguration[] | null>(null);

    const refresh = useCallback(async () => {
        try {
            const [nextConfigurations, nextCandidates, nextRecords, nextWaivers, nextAudit, chain] =
                await Promise.all([
                    api.listConfigurations(projectId),
                    api.listCandidates(projectId),
                    api.listRecords(projectId),
                    api.listWaivers(projectId, DEFAULT_CONFIG),
                    api.listAudit(projectId, DEFAULT_CONFIG),
                    api.verifyAudit(projectId, DEFAULT_CONFIG).catch(() => null),
                ]);
            setConfigurations(nextConfigurations);
            setCandidates(nextCandidates);
            setRecords(nextRecords);
            setWaivers(nextWaivers);
            setAudit(nextAudit);
            setAuditOk(chain ? chain.ok : null);
            setError("");
            const firstBuild = nextCandidates.find((item) => item.latest_build)?.latest_build;
            setSelectedBuildId((current) => current ?? firstBuild?.id ?? null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        }
    }, [projectId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        if (!selectedBuildId) {
            setDetail(null);
            return;
        }
        let cancelled = false;
        void api
            .getBuild(projectId, selectedBuildId)
            .then((value) => {
                if (!cancelled) setDetail(value);
            })
            .catch((cause: unknown) => {
                if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
            });
        return () => {
            cancelled = true;
        };
    }, [projectId, selectedBuildId, busy]);

    const run = useCallback(
        async (label: string, action: () => Promise<unknown>, success = "") => {
            setBusy(label);
            setError("");
            setNotice("");
            try {
                await action();
                if (success) setNotice(success);
                await refresh();
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
            } finally {
                setBusy("");
            }
        },
        [refresh],
    );

    const handleBuild = () =>
        run("build", async () => {
            const { job } = await api.startBuild(projectId, {
                config_key: DEFAULT_CONFIG,
                commit_sha: commit.trim() || "HEAD",
                variant: variant.trim(),
            });
            setJobStatus("queued");
            const finished = await watchPrismJob(job.job_id, {
                onUpdate: (value) => setJobStatus(value.status),
            });
            setJobStatus("");
            // `watchPrismJob` resolves on any terminal status, so without this a
            // failed build reports "Build finished." and the operator sees the
            // button return to idle with nothing else changed.
            throwIfJobFailed(finished, "The build failed.");
        }, "Build finished.");

    const evaluation = detail?.evaluation ?? null;
    const openBlockers = useMemo(
        () =>
            (evaluation?.findings ?? []).filter(
                (finding) => finding.status !== "waived"
                    && (finding.severity === "blocker" || finding.severity === "failure"),
            ),
        [evaluation],
    );

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Release Studio</h2>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        Turn an exact commit into a verified, approved, immutable manufacturing
                        release whose provenance can be audited offline.
                    </p>
                </div>
                {auditOk !== null && (
                    <Badge variant={auditOk ? "secondary" : "destructive"} className="gap-1">
                        {auditOk ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        Audit chain {auditOk ? "verified" : "BROKEN"}
                    </Badge>
                )}
            </header>

            {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}
            {notice && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                    {notice}
                </div>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">New candidate</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="rs-commit">Commit</Label>
                        <Input
                            id="rs-commit"
                            value={commit}
                            onChange={(event) => setCommit(event.target.value)}
                            className="w-56 font-mono text-xs"
                            placeholder="HEAD or a full SHA"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="rs-variant">Variant</Label>
                        <Input
                            id="rs-variant"
                            value={variant}
                            onChange={(event) => setVariant(event.target.value)}
                            className="w-44"
                            placeholder="(default)"
                        />
                    </div>
                    {canMutate && (
                        <Button
                            onClick={handleBuild}
                            disabled={Boolean(busy) || configurations?.length === 0}
                        >
                            {busy === "build" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <PlayCircle className="mr-2 h-4 w-4" />
                            )}
                            Build
                        </Button>
                    )}
                    {jobStatus && (
                        <span className="text-xs text-muted-foreground">Job: {jobStatus}</span>
                    )}
                    {configurations?.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                            This project has no release configuration. Commit one to{" "}
                            <code className="font-mono">
                                .prism/release-studio/configurations/{DEFAULT_CONFIG}.yaml
                            </code>{" "}
                            to enable builds.
                        </span>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Candidates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {candidates.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No candidates yet. Build one from a commit above.
                        </p>
                    )}
                    {candidates.map((candidate) => {
                        const build = candidate.latest_build;
                        const active = build?.id === selectedBuildId;
                        return (
                            <button
                                key={candidate.id}
                                type="button"
                                onClick={() => build && setSelectedBuildId(build.id)}
                                className={cn(
                                    "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                                    active ? "border-primary bg-primary/5" : "hover:bg-muted",
                                )}
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs">
                                        {candidate.commit_sha.slice(0, 10)}
                                    </span>
                                    <Badge variant="outline">{candidate.variant || "default"}</Badge>
                                    <Badge variant="secondary">{candidate.status}</Badge>
                                    {!candidate.hermetic && (
                                        <Badge variant="destructive" className="gap-1">
                                            <AlertTriangle className="h-3 w-3" /> non-hermetic
                                        </Badge>
                                    )}
                                    {build && (
                                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                                            manifest {shortDigest(build.manifest_digest)}
                                        </span>
                                    )}
                                </div>
                                {!candidate.hermetic && candidate.non_hermetic_reasons?.length > 0 && (
                                    <ul className="mt-1 list-disc pl-5 text-xs text-destructive">
                                        {candidate.non_hermetic_reasons.slice(0, 3).map((reason) => (
                                            <li key={reason}>{reason}</li>
                                        ))}
                                    </ul>
                                )}
                            </button>
                        );
                    })}
                </CardContent>
            </Card>

            {detail && (
                <BuildDetailView
                    projectId={projectId}
                    detail={detail}
                    canMutate={canMutate}
                    waivers={waivers}
                    busy={busy}
                    openBlockers={openBlockers}
                    onRun={run}
                />
            )}

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Releases</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {records.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nothing released yet.</p>
                    )}
                    {records.map((record) => {
                        const report = verification[record.id];
                        return (
                            <div key={record.id} className="rounded-md border p-3 text-sm space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold">{record.release_label}</span>
                                    {record.revision && <Badge variant="outline">rev {record.revision}</Badge>}
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {record.commit_sha.slice(0, 10)} · dossier {shortDigest(record.dossier_digest)}
                                    </span>
                                    <div className="ml-auto flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                void api.downloadFile(
                                                    api.downloadUrl(projectId, `records/${record.id}/release-archive`),
                                                    `${record.release_label}-release.tar.gz`,
                                                )
                                            }
                                        >
                                            <Download className="mr-1 h-3 w-3" /> Archive
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                void run(`verify-${record.id}`, async () => {
                                                    const result = await api.verifyRecord(projectId, record.id);
                                                    setVerification((current) => ({
                                                        ...current,
                                                        [record.id]: result,
                                                    }));
                                                })
                                            }
                                        >
                                            <FileCheck2 className="mr-1 h-3 w-3" /> Verify
                                        </Button>
                                    </div>
                                </div>
                                {report && (
                                    <div
                                        className={cn(
                                            "rounded border px-3 py-2 text-xs",
                                            report.ok
                                                ? "border-emerald-500/40 bg-emerald-500/10"
                                                : "border-destructive/40 bg-destructive/10",
                                        )}
                                    >
                                        <div className="mb-1 font-semibold">
                                            {report.ok ? "VERIFIED" : "REJECTED"}
                                        </div>
                                        <ul className="space-y-0.5">
                                            {report.checks.map((check, index) => (
                                                <li key={index} className="flex items-start gap-1">
                                                    {check.ok ? (
                                                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                                                    ) : (
                                                        <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                                                    )}
                                                    <span>{check.message}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Audit trail</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
                        {audit.map((event) => (
                            <div key={event.id} className="flex gap-2">
                                <span className="w-10 shrink-0 text-muted-foreground">
                                    #{event.sequence}
                                </span>
                                <span className="w-44 shrink-0">{event.event_type}</span>
                                <span className="w-32 shrink-0 truncate">{event.actor || "—"}</span>
                                <span className="truncate text-muted-foreground">
                                    {shortDigest(event.event_hash)}
                                </span>
                            </div>
                        ))}
                        {audit.length === 0 && (
                            <p className="font-sans text-sm text-muted-foreground">No events yet.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

type DetailProps = {
    projectId: string;
    detail: BuildDetail;
    canMutate: boolean;
    waivers: Waiver[];
    busy: string;
    openBlockers: Finding[];
    onRun: (label: string, action: () => Promise<unknown>, success?: string) => Promise<void>;
};

function BuildDetailView({
    projectId,
    detail,
    canMutate,
    waivers,
    busy,
    openBlockers,
    onRun,
}: DetailProps) {
    const [role, setRole] = useState("pcb_design");
    const [domains, setDomains] = useState<string>("bare_board");
    const [exceptionReason, setExceptionReason] = useState("");
    const [label, setLabel] = useState("");
    const [revision, setRevision] = useState("A");
    // Track the member by path rather than by object so the viewer follows the
    // same file across a refresh that replaces the member rows.
    const [viewedMemberPath, setViewedMemberPath] = useState("");
    const build = detail.build;
    const evaluation = detail.evaluation;
    const viewedMember = detail.members.find((item) => item.path === viewedMemberPath) ?? null;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    Build
                    <Badge variant={build.status === "succeeded" ? "secondary" : "destructive"}>
                        {build.status}
                    </Badge>
                    <span className="font-mono text-xs font-normal text-muted-foreground">
                        manifest {shortDigest(build.manifest_digest)} · dossier{" "}
                        {shortDigest(build.dossier_digest)}
                    </span>
                    <div className="ml-auto flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                void api.downloadFile(
                                    api.downloadUrl(projectId, `builds/${build.id}/dossier`),
                                    `dossier-${build.id}.tar.gz`,
                                )
                            }
                        >
                            <Download className="mr-1 h-3 w-3" /> Dossier
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                void api.downloadFile(
                                    api.downloadUrl(projectId, `builds/${build.id}/build-evidence`),
                                    `evidence-${build.id}.tar.gz`,
                                )
                            }
                        >
                            <Download className="mr-1 h-3 w-3" /> Evidence
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="evaluation">
                    <TabsList>
                        <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
                        <TabsTrigger value="members">Members ({detail.members.length})</TabsTrigger>
                        <TabsTrigger value="evidence">Evidence</TabsTrigger>
                        <TabsTrigger value="approvals">Approvals</TabsTrigger>
                        <TabsTrigger value="waivers">Waivers</TabsTrigger>
                        <TabsTrigger value="release">Release</TabsTrigger>
                    </TabsList>

                    <TabsContent value="evaluation" className="space-y-3 pt-4">
                        <div className="flex items-center gap-2">
                            <Badge className={outcomeTone(evaluation?.outcome ?? "")}>
                                {evaluation?.outcome ?? "not evaluated"}
                            </Badge>
                            {canMutate && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={Boolean(busy)}
                                    onClick={() =>
                                        void onRun("evaluate", () =>
                                            api.evaluateBuild(projectId, build.id, DEFAULT_CONFIG),
                                        )
                                    }
                                >
                                    Re-evaluate
                                </Button>
                            )}
                            <span className="text-xs text-muted-foreground">
                                Re-evaluating runs no KiCad step and leaves the manifest untouched.
                            </span>
                        </div>

                        {evaluation && (
                            <>
                                <RuleOutcomeList outcomes={evaluation.rule_outcomes} />
                                <Separator />
                                <FindingList findings={evaluation.findings} />
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="members" className="space-y-3 pt-4">
                        {viewedMember && (
                            <MemberViewer
                                projectId={projectId}
                                buildId={detail.build.id}
                                member={viewedMember}
                                onClose={() => setViewedMemberPath("")}
                            />
                        )}
                        <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-background">
                                    <tr className="border-b text-left text-muted-foreground">
                                        <th className="py-1">Path</th>
                                        <th>Domains</th>
                                        <th>Canonicalizer</th>
                                        <th className="text-right">Released digest</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detail.members.map((member) => (
                                        <tr
                                            key={member.id}
                                            className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                                            onClick={() => setViewedMemberPath(member.path)}
                                        >
                                            <td className="py-1 font-mono">{member.path}</td>
                                            <td>
                                                {member.domains.map((domain) => (
                                                    <Badge key={domain} variant="outline" className="mr-1">
                                                        {domain}
                                                    </Badge>
                                                ))}
                                            </td>
                                            <td className="text-muted-foreground">{member.canonicalizer}</td>
                                            <td className="text-right font-mono">
                                                {shortDigest(member.released_digest)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </TabsContent>

                    <TabsContent value="evidence" className="space-y-2 pt-4">
                        {detail.evidence.length === 0 && (
                            <p className="text-sm text-muted-foreground">No DRC/ERC evidence captured.</p>
                        )}
                        {detail.evidence.map((item) => (
                            <div key={item.kind} className="rounded-md border p-3 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold uppercase">{item.kind}</span>
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {shortDigest(item.report_digest)}
                                    </span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {Object.entries(item.counts).map(([severity, count]) => (
                                        <Badge
                                            key={severity}
                                            variant={
                                                severity === "error" && count > 0 ? "destructive" : "outline"
                                            }
                                        >
                                            {severity}: {count}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </TabsContent>

                    <TabsContent value="approvals" className="space-y-3 pt-4">
                        <ApprovalList approvals={detail.approvals} />
                        {canMutate && (
                            <div className="rounded-md border p-3 space-y-2">
                                <div className="flex flex-wrap gap-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="rs-role">Role</Label>
                                        <Input
                                            id="rs-role"
                                            value={role}
                                            onChange={(event) => setRole(event.target.value)}
                                            className="w-44"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="rs-domains">Domains (comma separated)</Label>
                                        <Input
                                            id="rs-domains"
                                            value={domains}
                                            onChange={(event) => setDomains(event.target.value)}
                                            className="w-64"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rs-exception">
                                        Self-approval / emergency reason (only if you authored this candidate)
                                    </Label>
                                    <Textarea
                                        id="rs-exception"
                                        value={exceptionReason}
                                        onChange={(event) => setExceptionReason(event.target.value)}
                                        rows={2}
                                    />
                                </div>
                                <Button
                                    size="sm"
                                    disabled={Boolean(busy)}
                                    onClick={() =>
                                        void onRun(
                                            "approve",
                                            () =>
                                                api.createApproval(projectId, build.id, {
                                                    role,
                                                    domains: domains
                                                        .split(",")
                                                        .map((item) => item.trim())
                                                        .filter(Boolean),
                                                    decision: "approved",
                                                    exception_kind: exceptionReason.trim()
                                                        ? "self_approval"
                                                        : null,
                                                    exception_reason: exceptionReason.trim() || null,
                                                }),
                                            "Approval recorded.",
                                        )
                                    }
                                >
                                    Approve
                                </Button>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="waivers" className="space-y-2 pt-4">
                        {waivers.length === 0 && (
                            <p className="text-sm text-muted-foreground">No waivers.</p>
                        )}
                        {waivers.map((waiver) => (
                            <div
                                key={waiver.id}
                                className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"
                            >
                                <Badge variant="outline">{waiver.rule_id}</Badge>
                                <Badge variant="secondary">{waiver.status}</Badge>
                                <span className="text-muted-foreground">{waiver.reason}</span>
                                <span className="text-xs text-muted-foreground">
                                    owner {waiver.owner}
                                    {waiver.approver ? ` · approved by ${waiver.approver}` : ""}
                                    {waiver.expires_at ? ` · expires ${waiver.expires_at}` : ""}
                                </span>
                                {waiver.exception_kind && (
                                    <span className="text-xs text-amber-600 dark:text-amber-500">
                                        self-approved · {waiver.exception_reason}
                                    </span>
                                )}
                                {canMutate && waiver.status === "proposed" && (
                                    <WaiverApproval
                                        projectId={projectId}
                                        waiver={waiver}
                                        busy={busy}
                                        onRun={onRun}
                                    />
                                )}
                            </div>
                        ))}
                        {canMutate && openBlockers.length > 0 && (
                            <WaiverComposer
                                projectId={projectId}
                                findings={openBlockers}
                                busy={busy}
                                onRun={onRun}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="release" className="space-y-3 pt-4">
                        {openBlockers.length > 0 && (
                            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                                {openBlockers.length} unwaived blocking finding(s). Release is refused
                                until each is resolved or waived.
                            </div>
                        )}
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="rs-label">Release label</Label>
                                <Input
                                    id="rs-label"
                                    value={label}
                                    onChange={(event) => setLabel(event.target.value)}
                                    className="w-56"
                                    placeholder="REL-0001"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="rs-revision">Revision</Label>
                                <Input
                                    id="rs-revision"
                                    value={revision}
                                    onChange={(event) => setRevision(event.target.value)}
                                    className="w-24"
                                />
                            </div>
                            {canMutate && (
                                <Button
                                    disabled={Boolean(busy) || !label.trim()}
                                    onClick={() =>
                                        void onRun(
                                            "release",
                                            () =>
                                                api.createRelease(projectId, build.id, {
                                                    release_label: label.trim(),
                                                    document_number: "",
                                                    revision: revision.trim(),
                                                }),
                                            "Release created and signed.",
                                        )
                                    }
                                >
                                    <ShieldCheck className="mr-2 h-4 w-4" /> Sign and release
                                </Button>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

export function RuleOutcomeList({ outcomes }: { outcomes: RuleOutcome[] }) {
    if (outcomes.length === 0) return null;
    return (
        <div className="space-y-1">
            <h4 className="text-sm font-semibold">Rules</h4>
            {outcomes.map((outcome) => (
                <div key={outcome.rule_id} className="flex items-center gap-2 text-sm">
                    <Badge className={outcomeTone(outcome.outcome)}>
                        {outcome.outcome === "unsupported" && (
                            <HelpCircle className="mr-1 h-3 w-3" />
                        )}
                        {outcome.outcome}
                    </Badge>
                    <span className="font-mono text-xs">{outcome.rule_id}</span>
                    {outcome.unsupported_reason && (
                        <span className="text-xs text-muted-foreground">
                            — {outcome.unsupported_reason}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

export function FindingList({ findings }: { findings: Finding[] }) {
    if (findings.length === 0) {
        return <p className="text-sm text-muted-foreground">No findings.</p>;
    }
    const byDomain = findings.reduce<Record<string, Finding[]>>((accumulator, finding) => {
        (accumulator[finding.domain] ??= []).push(finding);
        return accumulator;
    }, {});
    return (
        <div className="space-y-3">
            {Object.entries(byDomain).map(([domain, items]) => (
                <div key={domain} className="space-y-1">
                    <h4 className="text-sm font-semibold capitalize">{domain.replace("_", " ")}</h4>
                    {items.map((finding) => (
                        <div key={finding.id ?? finding.finding_key} className="rounded border p-2 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className={outcomeTone(finding.severity)}>{finding.severity}</Badge>
                                {finding.status === "waived" && (
                                    <Badge variant="outline">waived</Badge>
                                )}
                                <span className="font-mono text-xs">{finding.rule_id}</span>
                                <span className="text-xs text-muted-foreground">{finding.subject}</span>
                            </div>
                            <p className="mt-1 text-xs">{finding.message}</p>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export function ApprovalList({ approvals }: { approvals: Approval[] }) {
    if (approvals.length === 0) {
        return <p className="text-sm text-muted-foreground">No approvals yet.</p>;
    }
    return (
        <div className="space-y-2">
            {approvals.map((approval) => {
                const invalidation = approval.invalidations?.[0];
                return (
                    <div key={approval.id} className="rounded-md border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={invalidation ? "destructive" : "secondary"}>
                                {invalidation ? "invalidated" : approval.decision}
                            </Badge>
                            <span className="font-semibold">{approval.role}</span>
                            {approval.domains.map((domain) => (
                                <Badge key={domain} variant="outline">
                                    {domain}
                                </Badge>
                            ))}
                            <span className="text-xs text-muted-foreground">
                                by {approval.approver}
                            </span>
                            {approval.carried_from_approval_id && (
                                <Badge variant="outline">carried forward</Badge>
                            )}
                        </div>
                        {approval.exception_kind && (
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                Exception ({approval.exception_kind}): {approval.exception_reason}
                            </p>
                        )}
                        {invalidation && (
                            <p className="mt-1 text-xs text-destructive">
                                Stale <strong>{invalidation.stale_component}</strong> binding
                                {invalidation.changed_domains.length > 0 &&
                                    ` — changed: ${invalidation.changed_domains.join(", ")}`}
                                . {invalidation.reason}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/** Media types this panel can render in place; everything else is a download. */
function previewKind(mediaType: string, path: string): "pdf" | "image" | "text" | "none" {
    const type = (mediaType || "").toLowerCase();
    if (type === "application/pdf") return "pdf";
    if (type.startsWith("image/")) return "image";
    if (
        type.startsWith("text/")
        || type === "application/json"
        // Gerber and Excellon are plain text with vendor media types, and being
        // able to read the released artwork header is most of the point.
        || type === "application/vnd.gerber"
        || /\.(gbr|g[a-z0-9]{2}|drl|csv|json|txt)$/i.test(path)
    ) {
        return "text";
    }
    return "none";
}

/**
 * Render one released member inside Prism.
 *
 * The bytes come from the digest-checked member route, so what is displayed is
 * the released artefact itself rather than a re-derived preview.
 */
function MemberViewer({
    projectId,
    buildId,
    member,
    onClose,
}: {
    projectId: string;
    buildId: string;
    member: ReleaseMember;
    onClose: () => void;
}) {
    const [objectUrl, setObjectUrl] = useState<string>("");
    const [text, setText] = useState<string>("");
    const [failure, setFailure] = useState<string>("");
    const kind = previewKind(member.media_type, member.path);

    useEffect(() => {
        let revoked = false;
        let created = "";
        setObjectUrl("");
        setText("");
        setFailure("");
        if (kind === "none") return undefined;

        void api
            .memberObjectUrl(projectId, buildId, member.path)
            .then(async ({ url }) => {
                if (revoked) {
                    URL.revokeObjectURL(url);
                    return;
                }
                created = url;
                if (kind === "text") {
                    const body = await (await fetch(url)).text();
                    if (!revoked) setText(body);
                } else {
                    setObjectUrl(url);
                }
            })
            .catch((cause: unknown) => {
                if (!revoked) {
                    setFailure(cause instanceof Error ? cause.message : String(cause));
                }
            });

        return () => {
            revoked = true;
            if (created) URL.revokeObjectURL(created);
        };
    }, [projectId, buildId, member.path, kind]);

    return (
        <div className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm">{member.path}</span>
                <Badge variant="outline">{member.media_type || "unknown"}</Badge>
                <span className="font-mono text-xs text-muted-foreground">
                    {shortDigest(member.released_digest)}
                </span>
                <div className="ml-auto flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            void api.downloadFile(
                                api.downloadUrl(
                                    projectId,
                                    `builds/${encodeURIComponent(buildId)}/members/`
                                        + `${member.path.split("/").map(encodeURIComponent).join("/")}`
                                        + "?disposition=attachment",
                                ),
                                member.path.split("/").pop() ?? "member",
                            )
                        }
                    >
                        Download
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>

            {failure && <p className="text-sm text-destructive">{failure}</p>}

            {!failure && kind === "none" && (
                <p className="text-sm text-muted-foreground">
                    This member type has no in-app preview. Download it to inspect the
                    released bytes.
                </p>
            )}
            {!failure && kind === "pdf" && objectUrl && (
                <iframe title={member.path} src={objectUrl} className="h-[70vh] w-full rounded border" />
            )}
            {!failure && kind === "image" && objectUrl && (
                <img
                    alt={member.path}
                    src={objectUrl}
                    className="max-h-[70vh] w-full rounded border bg-white object-contain"
                />
            )}
            {!failure && kind === "text" && text && (
                <pre className="max-h-[70vh] overflow-auto rounded border bg-muted/40 p-2 text-xs">
                    {text}
                </pre>
            )}
        </div>
    );
}

/**
 * Approving a waiver you raised yourself is possible only as a named exception
 * with a written reason, which the audit chain records. The reason field is
 * revealed rather than always present so the ordinary two-person path stays the
 * obvious one and the exception stays a deliberate act.
 */
function WaiverApproval({
    projectId,
    waiver,
    busy,
    onRun,
}: {
    projectId: string;
    waiver: Waiver;
    busy: string;
    onRun: DetailProps["onRun"];
}) {
    const [claiming, setClaiming] = useState(false);
    const [exceptionReason, setExceptionReason] = useState("");

    const approve = (exception?: { exception_kind: "self_approval"; exception_reason: string }) =>
        void onRun("waiver", () =>
            api.transitionWaiver(projectId, waiver.id, "approve", "", exception),
        );

    if (claiming) {
        return (
            <div className="ml-auto flex w-full flex-col gap-2 sm:w-80">
                <Textarea
                    value={exceptionReason}
                    onChange={(event) => setExceptionReason(event.target.value)}
                    placeholder="Why is no second approver available?"
                    rows={2}
                    className="text-sm"
                />
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(busy) || !exceptionReason.trim()}
                        onClick={() =>
                            approve({
                                exception_kind: "self_approval",
                                exception_reason: exceptionReason.trim(),
                            })
                        }
                    >
                        Record exception and approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setClaiming(false)}>
                        Cancel
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="ml-auto flex gap-2">
            <Button
                size="sm"
                variant="outline"
                disabled={Boolean(busy)}
                onClick={() => approve()}
            >
                Approve waiver
            </Button>
            <Button
                size="sm"
                variant="ghost"
                disabled={Boolean(busy)}
                onClick={() => setClaiming(true)}
            >
                Self-approve…
            </Button>
        </div>
    );
}

function WaiverComposer({
    projectId,
    findings,
    busy,
    onRun,
}: {
    projectId: string;
    findings: Finding[];
    busy: string;
    onRun: DetailProps["onRun"];
}) {
    const [selected, setSelected] = useState(findings[0]?.finding_key ?? "");
    const [reason, setReason] = useState("");
    const finding = findings.find((item) => item.finding_key === selected) ?? findings[0];

    return (
        <div className="rounded-md border p-3 space-y-2">
            <h4 className="text-sm font-semibold">Propose a waiver</h4>
            <select
                className="w-full rounded border bg-background px-2 py-1 text-sm"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
            >
                {findings.map((item) => (
                    <option key={item.finding_key} value={item.finding_key}>
                        {item.rule_id} — {item.subject}
                    </option>
                ))}
            </select>
            <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                placeholder="Why is this acceptable to manufacture?"
            />
            <Button
                size="sm"
                disabled={Boolean(busy) || !reason.trim() || !finding}
                onClick={() =>
                    void onRun(
                        "waiver",
                        () =>
                            api.createWaiver(projectId, {
                                config_key: DEFAULT_CONFIG,
                                rule_id: finding.rule_id,
                                domain: finding.domain,
                                reason: reason.trim(),
                                finding_key: finding.finding_key,
                            }),
                        "Waiver proposed. It needs a second person to approve it.",
                    )
                }
            >
                Propose waiver
            </Button>
        </div>
    );
}

export default ReleaseStudioPanel;
