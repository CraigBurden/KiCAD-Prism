import { useEffect, useState } from "react";
import { Check, CircleDot, Loader2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoldToConfirmButton } from "@/components/ui/hold-to-confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import * as api from "../api";
import { outcomeTone } from "../flow";
import {
    ApprovalList,
    FindingList,
    RuleOutcomeList,
    WaiverApproval,
    WaiverComposer,
    type RunFn,
} from "../shared";
import type {
    BuildDetail,
    Finding,
} from "../types";

/** One gate in the sign-off sequence.
 *
 * These are not peer tabs. Policy evaluation produces blockers, blockers are
 * cleared by waivers, clean findings let roles sign, and signatures unlock the
 * release. Tabs hid that dependency, so the screen could not answer the one
 * question it exists for: why can I not release yet?
 */
function Gate({
    index,
    title,
    status,
    state,
    defaultOpen,
    children,
}: {
    index: number;
    title: string;
    status: string;
    state: "done" | "active" | "pending";
    /** Open on arrival when this gate has something the reader must act on.
     *  A gate that is merely "done" stays shut; one holding open blockers or
     *  awaiting a signature does not make the reader hunt for it. */
    defaultOpen?: boolean;
    children?: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen ?? state === "active");
    const Icon = state === "done" ? Check : CircleDot;
    return (
        <section className="border">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
            >
                <Icon
                    className={cn(
                        "h-4 w-4 shrink-0",
                        state === "done"
                            ? "text-success"
                            : state === "active"
                              ? "text-foreground"
                              : "text-muted-foreground",
                    )}
                />
                <span className="font-mono text-xs text-muted-foreground">{index}</span>
                <span className="flex-1 text-sm font-medium">{title}</span>
                <span className="text-xs text-muted-foreground">{status}</span>
            </button>
            {open && children && <div className="space-y-3 border-t px-3 py-3">{children}</div>}
        </section>
    );
}

export function SignOffStep({
    projectId,
    detail,
    configuration,
    canMutate,
    isAdmin,
    busy,
    openBlockers,
    onRun,
}: {
    projectId: string;
    detail: BuildDetail;
    /** The selected build's committed identity; config fallback supports old detail payloads. */
    configuration?: BuildDetail["configuration"];
    canMutate: boolean;
    isAdmin: boolean;
    busy: string;
    openBlockers: Finding[];
    onRun: RunFn;
}) {
    const evaluation = detail.evaluation;
    const committedConfiguration = detail.configuration ?? configuration;
    const [label, setLabel] = useState("");
    const [overrideBlockers, setOverrideBlockers] = useState(false);
    const [overrideReason, setOverrideReason] = useState("");
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [rescinds, setRescinds] = useState<Record<string, string>>({});

    // Once the blockers are gone an override is not just unnecessary, the
    // backend refuses it -- so leaving the flag set strands the user on an
    // error they cannot clear from a control that is no longer on screen.
    useEffect(() => {
        if (openBlockers.length === 0) {
            setOverrideBlockers(false);
            setOverrideReason("");
        }
    }, [openBlockers.length]);

    const released = false;
    const approvals = detail.approvals ?? [];
    const waivers = detail.waivers ?? [];
    const waived = waivers.filter((waiver) => waiver.status === "approved").length;
    const evaluated = Boolean(evaluation);
    const evaluationFresh = detail.evaluation_fresh !== false;
    const unsupported = (evaluation?.rule_outcomes ?? []).filter((item) => item.outcome === "unsupported");
    const clear = evaluated && evaluationFresh && openBlockers.length === 0 && unsupported.length === 0;
    // A count of approvals says nothing about whether the *right* ones exist.
    // The policy requires specific (role, domain) pairs, and until now the
    // first a user heard of a missing one was the refusal at release time.
    // The backend explicitly distinguishes an empty resolved policy from a
    // policy it could not resolve. Preserve a narrow legacy fallback for old
    // detail payloads that supplied an array but no availability field.
    const approvalCoverageAvailable = detail.required_approvals_available
        ?? Array.isArray(detail.required_approvals);
    const required = Array.isArray(detail.required_approvals) ? detail.required_approvals : [];
    const missing = required.filter((entry) => !entry.satisfied);
    // An explicitly empty server requirement set is a valid policy outcome.
    // Only an absent field (legacy/unavailable coverage) must lock signing.
    const signed = approvalCoverageAvailable && required.every((entry) => entry.satisfied);

    // Waivers are applied *during evaluation* (policy._apply_waivers), so
    // approving one never changes the findings already stored against this
    // build. Without this, a user could approve every waiver and watch the
    // blocker count sit unchanged with nothing telling them why.
    // Re-evaluating is the documented cheap path: no KiCad step re-runs and
    // manifest_digest does not move.
    const runThenReevaluate: RunFn = (label, action, success) =>
        onRun(
            label,
            async () => {
                const result = await action();
                await api.evaluateBuild(projectId, detail.build.id);
                return result;
            },
            success,
        );

    const sign = () =>
        void onRun(
            "release",
            () =>
                api.createRelease(projectId, detail.build.id, {
                    release_label: label.trim(),
                    override_blockers: overrideBlockers,
                    override_reason: overrideReason.trim(),
                }),
            overrideBlockers
                ? "Release created and signed over open blockers."
                : "Release created and signed.",
        );

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">Sign-off</h3>
                {evaluation && (
                    <Badge className={outcomeTone(evaluation.outcome)}>{evaluation.outcome}</Badge>
                )}
                {evaluation?.policy_binding_digest && (
                    <span className="font-mono text-xs text-muted-foreground">
                        policy {evaluation.policy_binding_digest.slice(0, 12)}
                    </span>
                )}
            </div>

            <Gate
                index={1}
                title="Check against policy"
                state={evaluated && evaluationFresh ? "done" : "active"}
                defaultOpen={!evaluated || !evaluationFresh}
                status={
                    !evaluated
                        ? "not evaluated"
                        : !evaluationFresh
                          ? "stale evaluation"
                        : evaluated
                        ? `${openBlockers.length} blocker(s), ${evaluation?.findings.length ?? 0} finding(s)`
                        : "not evaluated"
                }
            >
                {canMutate && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(busy)}
                        onClick={() =>
                            void onRun("evaluate", () =>
                                api.evaluateBuild(projectId, detail.build.id),
                            )
                        }
                    >
                        {busy === "evaluate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Re-evaluate
                    </Button>
                )}
                {evaluation && <RuleOutcomeList outcomes={evaluation.rule_outcomes} />}
                {evaluation && <FindingList findings={evaluation.findings} />}
                {!evaluationFresh && (
                    <p className="text-sm text-destructive">Evaluation is stale; re-evaluate before approvals or release.{detail.evaluation_fresh_error ? ` ${detail.evaluation_fresh_error}` : ""}</p>
                )}
            </Gate>

            <Gate
                index={2}
                title="Clear exceptions"
                state={clear ? "done" : evaluated ? "active" : "pending"}
                defaultOpen={openBlockers.length > 0}
                status={
                    openBlockers.length === 0
                        ? waived > 0
                            ? `${waived} waived`
                            : "nothing to clear"
                        : `${openBlockers.length} blocker(s) open`
                }
            >
                {waivers.map((waiver) => (
                    <div
                        key={waiver.id}
                        className="flex flex-wrap items-center gap-2 border px-3 py-2 text-sm"
                    >
                        <Badge variant="outline">{waiver.rule_id}</Badge>
                        <Badge variant="secondary">{waiver.status}</Badge>
                        <span className="text-muted-foreground">{waiver.reason}</span>
                        {canMutate && waiver.status === "proposed" && (
                            <WaiverApproval
                                projectId={projectId}
                                waiver={waiver}
                                busy={busy}
                                onRun={runThenReevaluate}
                            />
                        )}
                    </div>
                ))}
                {canMutate && openBlockers.length > 0 && (
                    <WaiverComposer
                        projectId={projectId}
                        buildId={detail.build.id}
                        findings={openBlockers}
                        busy={busy}
                        onRun={onRun}
                    />
                )}
            </Gate>

            <Gate
                index={3}
                title="Collect sign-off"
                state={signed ? "done" : clear ? "active" : "pending"}
                status={
                    !approvalCoverageAvailable
                        ? "policy unavailable"
                        : required.length > 0
                        ? `${required.length - missing.length} of ${required.length} required`
                        : "no approvals required"
                }
            >
                {/* One card per (role, domain) the policy demands. Typing the
                    role and domain by hand invited exactly the mistake it
                    produced in practice: an approval recorded as
                    "manufacturing for bare_board", which satisfied nothing and
                    could not be withdrawn. Here the pair is fixed by the
                    policy and the card only asks for what the approver adds. */}
                {required.map((entry) => {
                    const key = `${entry.role}:${entry.domain}`;
                    const given = approvals.find(
                        (approval) =>
                            approval.role === entry.role
                            && (approval.domains || []).includes(entry.domain as never)
                            && approval.decision === "approved"
                            && approval.invalidations.length === 0
                            && approval.evaluation_id === evaluation?.id
                            && approval.policy_binding_digest === evaluation?.policy_binding_digest,
                    );
                    return (
                        <div
                            key={key}
                            className={cn(
                                "space-y-2 rounded border p-3",
                                entry.satisfied && "border-success/40 bg-success/10",
                            )}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                {entry.satisfied ? (
                                    <Check className="h-4 w-4 text-success" />
                                ) : (
                                    <CircleDot className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-medium">{entry.role}</span>
                                <Badge variant="outline">{entry.domain}</Badge>
                                {entry.satisfied && given && (
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        approved by {given.approver}
                                    </span>
                                )}
                            </div>
                            {entry.satisfied ? (
                                <>
                                    {given?.note && <p className="text-xs">{given.note}</p>}
                                    {given?.exception_kind && (
                                        <p className="text-xs text-warning">
                                            Exception ({given.exception_kind}):{" "}
                                            {given.exception_reason}
                                        </p>
                                    )}
                                    {canMutate && given && (
                                        <div className="flex flex-wrap items-end gap-2">
                                            <div className="flex-1 space-y-1">
                                                <Label
                                                    htmlFor={`rs-rescind-${key}`}
                                                    className="text-xs"
                                                >
                                                    Reason to rescind
                                                </Label>
                                                <Input
                                                    id={`rs-rescind-${key}`}
                                                    value={rescinds[key] ?? ""}
                                                    onChange={(event) =>
                                                        setRescinds((current) => ({
                                                            ...current,
                                                            [key]: event.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                    Boolean(busy) || !(rescinds[key] ?? "").trim()
                                                }
                                                onClick={() =>
                                                    void onRun("rescind", () =>
                                                        api.rescindApproval(
                                                            projectId,
                                                            detail.build.id,
                                                            given.id,
                                                            (rescinds[key] ?? "").trim(),
                                                        ),
                                                    )
                                                }
                                            >
                                                Rescind
                                            </Button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                canMutate && evaluation && evaluationFresh && (entry.can_current_user_approve ?? true) ? (
                                    <div className="space-y-2">
                                        <Label htmlFor={`rs-note-${key}`} className="sr-only">
                                            Note for {entry.role}
                                        </Label>
                                        <Textarea
                                            id={`rs-note-${key}`}
                                            value={notes[key] ?? ""}
                                            onChange={(event) =>
                                                setNotes((current) => ({
                                                    ...current,
                                                    [key]: event.target.value,
                                                }))
                                            }
                                            rows={2}
                                            placeholder="Note (optional)"
                                        />
                                        <Button
                                            size="sm"
                                            disabled={Boolean(busy) || !(entry.can_current_user_approve ?? true)}
                                            onClick={() =>
                                                void onRun("approval", async () => {
                                                    const latest = await api.getBuild(projectId, detail.build.id);
                                                    if (latest.evaluation_fresh === false || !latest.evaluation) {
                                                        throw new Error("Evaluation changed. Re-evaluate before approving.");
                                                    }
                                                    if (latest.evaluation.id !== evaluation?.id) {
                                                        throw new Error("Evaluation changed. Review the refreshed sign-off before approving.");
                                                    }
                                                    return api.createApproval(projectId, detail.build.id, {
                                                        role: entry.role,
                                                        domains: [entry.domain],
                                                        note: notes[key] ?? "",
                                                        evaluation_id: latest.evaluation.id,
                                                    });
                                                })
                                            }
                                        >
                                            Approve as {entry.role}
                                        </Button>
                                    </div>
                                ) : <p className="text-xs text-muted-foreground">{!evaluationFresh ? "Re-evaluation is required before approval." : "Not eligible to approve this required role/domain."}</p>
                            )}
                        </div>
                    );
                })}

                {/* Anything recorded outside the policy's requirements -- an
                    extra domain, or a role the policy dropped -- still belongs
                    on screen so it can be accounted for. */}
                {approvals.some(
                    (approval) =>
                        !required.some(
                            (entry) =>
                                entry.role === approval.role
                                && (approval.domains || []).includes(entry.domain as never),
                        ),
                ) && (
                    <div className="space-y-1">
                        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Other approvals on this build
                        </h5>
                        <ApprovalList
                            approvals={approvals.filter(
                                (approval) =>
                                    !required.some(
                                        (entry) =>
                                            entry.role === approval.role
                                            && (approval.domains || []).includes(
                                                entry.domain as never,
                                            ),
                                    ),
                            )}
                        />
                    </div>
                )}

                {!approvalCoverageAvailable && (
                    <p className="text-sm text-destructive">Required approval policy is unavailable; signing remains locked.</p>
                )}
            </Gate>

            <Gate
                index={4}
                title="Issue signed release"
                state={released ? "done" : (clear && signed) || (isAdmin && overrideBlockers) ? "active" : "pending"}
                defaultOpen
                status={
                    released ? "released"
                        : unsupported.length > 0
                          ? `${unsupported.length} unsupported rule(s)`
                        : openBlockers.length > 0
                          ? `blocked by ${openBlockers.length} open blocker(s)`
                          : "ready"
                }
            >
                {(openBlockers.length > 0 || unsupported.length > 0) && (
                    <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                        {unsupported.length > 0 ? "Unsupported policy evidence blocks release." : `${openBlockers.length} unwaived blocking finding(s).`}
                    </div>
                )}
                {canMutate && isAdmin && (openBlockers.length > 0 || unsupported.length > 0 || overrideBlockers) && (
                    <div className="space-y-2 border border-warning/40 bg-warning/10 px-3 py-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <input
                                type="checkbox"
                                checked={overrideBlockers}
                                onChange={(event) => setOverrideBlockers(event.target.checked)}
                                aria-label="Release over open blockers"
                            />
                            Release over open blockers (administrative override)
                        </label>
                        {overrideBlockers && (
                            <div className="space-y-1">
                                <Label htmlFor="rs-override-reason">Override reason</Label>
                                <Input
                                    id="rs-override-reason"
                                    value={overrideReason}
                                    onChange={(event) => setOverrideReason(event.target.value)}
                                />
                            </div>
                        )}
                    </div>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                        <Label htmlFor="rs-label">Release label</Label>
                        <Input
                            id="rs-label"
                            value={label}
                            onChange={(event) => setLabel(event.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Document number</Label><div aria-label="Document number" className="flex h-9 items-center rounded border bg-muted/30 px-3 text-sm">{committedConfiguration?.document_number || "—"}</div>
                    </div>
                    <div className="space-y-1">
                        <Label>Revision</Label><div aria-label="Revision" className="flex h-9 items-center rounded border bg-muted/30 px-3 text-sm">{committedConfiguration?.revision || "—"}</div>
                    </div>
                </div>
                {canMutate && (
                    <HoldToConfirmButton
                        className="w-full whitespace-nowrap sm:w-auto"
                        variant="default"
                        disabled={
                            Boolean(busy)
                            || !label.trim()
                            || (!clear && !overrideBlockers)
                            || !signed
                            || (overrideBlockers && !overrideReason.trim())
                        }
                        onConfirm={sign}
                        holdingLabel="Keep holding to sign…"
                    >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {overrideBlockers ? "Override and release" : "Sign and release"}
                    </HoldToConfirmButton>
                )}
            </Gate>
        </div>
    );
}

export default SignOffStep;
