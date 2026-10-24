import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import * as api from "../../api";
import type { useModelAcknowledgement } from "../../UnpinnedModels";
import type { RunFn } from "../../shared";
import type { ApprovalState, ReviewSlot } from "../../types";

/** Designer and QA sign-off. The unpinned-model acknowledgement is the caller's. */
export function SignOffCards({
    projectId,
    buildId,
    approvals,
    acknowledgement,
    busy,
    onRun,
    onRefresh,
}: {
    projectId: string;
    buildId: string;
    approvals?: ApprovalState;
    acknowledgement: ReturnType<typeof useModelAcknowledgement>;
    busy: string;
    onRun: RunFn;
    onRefresh?: () => Promise<unknown> | void;
}) {
    const published = Boolean(approvals?.published);
    const electrical = approvals?.electrical_errors ?? [];
    const shared = {
        electrical,
        published,
        busy,
        onRun,
        onRefresh,
        projectId,
        buildId,
        acknowledgement: acknowledgement.satisfied ? "given" as const : "missing" as const,
        acknowledgedModels: acknowledgement.keys,
    };
    return (
        <div className="space-y-2">
            <SignOffCard
                label="Designer"
                slot="designer"
                decision={approvals?.designer ?? null}
                canApprove={Boolean(approvals?.can_approve_designer)}
                canWithdraw={Boolean(approvals?.can_withdraw && approvals.designer && !published)}
                {...shared}
            />
            <SignOffCard
                label="QA"
                slot="qa"
                decision={approvals?.qa ?? null}
                canApprove={Boolean(approvals?.can_approve_qa)}
                canWithdraw={Boolean(approvals?.can_withdraw && approvals.qa && !published)}
                {...shared}
            />
            {approvals?.published ? (
                <p
                    className="truncate text-xs text-muted-foreground"
                    title={`Published ${approvals.published.tag} by ${approvals.published.published_by}`}
                >
                    Published {approvals.published.tag} by {approvals.published.published_by}
                </p>
            ) : null}
        </div>
    );
}

function SignOffCard({
    label,
    slot,
    decision,
    canApprove,
    canWithdraw,
    electrical,
    published,
    busy,
    projectId,
    buildId,
    onRun,
    onRefresh,
    acknowledgement,
    acknowledgedModels,
}: {
    label: string;
    slot: ReviewSlot;
    decision: ApprovalState["designer"];
    canApprove: boolean;
    canWithdraw: boolean;
    electrical: string[];
    published: boolean;
    busy: string;
    projectId: string;
    buildId: string;
    onRun: RunFn;
    onRefresh?: () => Promise<unknown> | void;
    acknowledgement: "given" | "missing";
    acknowledgedModels: string[];
}) {
    const [note, setNote] = useState("");
    const approved = Boolean(decision);
    const overrideRequired = electrical.length > 0;
    const runDecision = (withdraw: boolean) => {
        void onRun(withdraw ? `withdraw-${slot}` : `approve-${slot}`, async () => {
            if (withdraw) {
                await api.withdrawApproval(projectId, buildId, { slot, note });
            } else {
                await api.approveBuild(projectId, buildId, {
                    slot,
                    note,
                    acknowledged_models: acknowledgedModels,
                });
            }
            setNote("");
            await onRefresh?.();
        });
    };

    return (
        <div
            className={cn(
                "flex min-w-0 flex-col gap-2 border bg-muted/20 px-3 py-2",
                approved && "border-success/50 bg-success/10",
            )}
        >
            <div className="flex min-w-0 items-center gap-2">
                <span className="text-sm font-medium">{label}</span>
                {approved ? (
                    <>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                        <span className="text-sm font-medium text-success">Approved</span>
                        <span className="min-w-0 truncate text-xs text-muted-foreground">{decision?.actor}</span>
                    </>
                ) : (
                    <Badge variant="outline">Pending</Badge>
                )}
            </div>
            {approved && decision?.note ? (
                <p className="truncate text-xs text-muted-foreground">{decision.note}</p>
            ) : null}
            {!published && canApprove && (
                <div className="flex items-center gap-2">
                    <Input
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder={overrideRequired ? "Override note" : "Note"}
                        aria-label={`${label} note`}
                        aria-required={overrideRequired}
                        className="h-7"
                    />
                    <Button
                        size="xs"
                        disabled={
                            Boolean(busy)
                            || (overrideRequired && !note.trim())
                            || acknowledgement === "missing"
                        }
                        aria-label={`Approve ${label}`}
                        onClick={() => runDecision(false)}
                    >
                        Approve
                    </Button>
                </div>
            )}
            {!published && canWithdraw && (
                <div className="flex items-center gap-2">
                    <Input
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Withdrawal note"
                        aria-label={`Withdraw ${label} note`}
                        className="h-7"
                    />
                    <Button
                        size="xs"
                        variant="outline"
                        disabled={Boolean(busy) || !note.trim()}
                        aria-label={`Withdraw ${label}`}
                        onClick={() => runDecision(true)}
                    >
                        Withdraw
                    </Button>
                </div>
            )}
        </div>
    );
}
