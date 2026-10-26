import { useState, type ReactNode } from "react";
import {
    PackageCheck,
    PanelRightClose,
    PanelRightOpen,
    ShieldAlert,
    ShieldCheck,
    type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { cn } from "@/lib/utils";

import { UnpinnedModelsAck, useModelAcknowledgement } from "../../UnpinnedModels";
import { useCollapsed } from "../../use-collapsed";
import { VendorPackCard, type RunFn } from "../../shared";
import type { BuildDetail, VendorProfile } from "../../types";
import { PackRequirementTiles } from "./PackRequirements";
import { SignOffCards } from "./SignOff";

/** Below this window width the rail starts as its icon strip, so the preview keeps the room. */
const COLLAPSE_BELOW = 1280;

/**
 * Everything a reviewer decides about a finished build, beside its outputs:
 * the electrical checks and unpinned models, Designer and QA sign-off, and
 * the manufacturer pack. It used to stack under the preview and squeeze it.
 */
export function ReleaseChecksRail({
    projectId,
    detail,
    profiles,
    busy,
    onContinue,
    onRun,
    onRefresh,
}: {
    projectId: string;
    detail: BuildDetail;
    profiles: VendorProfile[];
    busy: string;
    onContinue: () => void;
    onRun: RunFn;
    onRefresh?: () => Promise<unknown> | void;
}) {
    const [collapsed, toggle] = useCollapsed("prism.releaseStudio.checksRailCollapsed", COLLAPSE_BELOW);
    const [vendorId, setVendorId] = useState("");
    const approvals = detail.approvals;
    const unpinned = approvals?.unpinned_models ?? [];
    const acknowledgement = useModelAcknowledgement(detail.build.id, unpinned);
    const published = Boolean(approvals?.published);
    const canApprove = Boolean(approvals?.can_approve_designer || approvals?.can_approve_qa);
    const approved = Number(Boolean(approvals?.designer)) + Number(Boolean(approvals?.qa));
    const errors = detail.evidence.reduce((sum, item) => sum + (item.counts.error ?? 0), 0);
    const selectedProfile = profiles.find((profile) => profile.id === vendorId) ?? profiles[0];
    const selectedReadiness = detail.vendor_readiness?.find(
        (item) => (item.vendor_id || item.profile_id) === selectedProfile?.id,
    );

    if (collapsed) {
        return (
            <aside aria-label="Release checks" className="flex w-11 shrink-0 flex-col items-center gap-2 border-l py-2">
                <Button size="icon-sm" variant="ghost" aria-label="Show release checks" title="Show release checks" onClick={() => toggle(false)}>
                    <PanelRightOpen className="h-4 w-4" />
                </Button>
                <StripButton icon={ShieldAlert} label="Checks" count={errors ? String(errors) : ""} tone="destructive" onClick={() => toggle(false)} />
                <StripButton icon={ShieldCheck} label="Approvals" count={published ? "" : `${approved}/2`} tone="warning" onClick={() => toggle(false)} />
                <StripButton icon={PackageCheck} label="Manufacturer" count="" tone="warning" onClick={() => toggle(false)} />
            </aside>
        );
    }

    return (
        <ResizablePanel
            side="right"
            storageKey="prism.releaseStudio.checksRailWidth"
            defaultWidth={300}
            minWidth={248}
            maxWidth={460}
            aria-label="Release checks"
        >
            <div className="flex h-10 shrink-0 items-center gap-2 border-b pl-3 pr-1 text-sm font-medium">
                <span className="flex-1 truncate">Release checks</span>
                <Button size="icon-sm" variant="ghost" aria-label="Hide release checks" title="Hide release checks" onClick={() => toggle(true)}>
                    <PanelRightClose className="h-4 w-4" />
                </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <RailSection icon={ShieldAlert} title="Checks">
                    {detail.evidence.map((item) => (
                        <div key={item.kind} className="flex h-7 items-center gap-2 text-sm">
                            <span className="flex-1">{item.kind.toUpperCase()}</span>
                            {(item.counts.error ?? 0) > 0 ? (
                                <Badge variant="destructive">{item.counts.error} errors</Badge>
                            ) : (
                                <Badge variant="secondary">0 errors</Badge>
                            )}
                            {(item.counts.warning ?? 0) > 0 && (
                                <Badge variant="warning" title={`${item.counts.warning} warnings`}>{item.counts.warning}</Badge>
                            )}
                        </div>
                    ))}
                    {unpinned.length > 0 && (
                        <div className="pt-1">
                            {!published && canApprove ? (
                                <UnpinnedModelsAck
                                    models={unpinned}
                                    checked={acknowledgement.acknowledged}
                                    onCheckedChange={acknowledgement.setAcknowledged}
                                    disabled={Boolean(busy)}
                                    collapsible
                                />
                            ) : (
                                <div className="flex h-7 items-center gap-2 text-sm">
                                    <span className="flex-1 truncate">Unpinned 3D models</span>
                                    <Badge variant="warning">{unpinned.length}</Badge>
                                </div>
                            )}
                        </div>
                    )}
                </RailSection>
                <RailSection icon={ShieldCheck} title="Approvals" aside={published ? "published" : `${approved} of 2`}>
                    {approvals?.blocked_reason && !published ? (
                        <p className="mb-2 flex items-center gap-1.5 truncate text-xs text-warning" title={approvals.blocked_reason}>
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{approvals.blocked_reason}</span>
                        </p>
                    ) : null}
                    <SignOffCards
                        projectId={projectId}
                        buildId={detail.build.id}
                        approvals={approvals}
                        acknowledgement={acknowledgement}
                        busy={busy}
                        onRun={onRun}
                        onRefresh={onRefresh}
                    />
                </RailSection>
                <RailSection icon={PackageCheck} title="Manufacturer">
                    <VendorPackCard
                        projectId={projectId}
                        buildId={detail.build.id}
                        profiles={profiles}
                        busy={busy}
                        readiness={detail.vendor_readiness}
                        vendorId={selectedProfile?.id}
                        onVendorChange={setVendorId}
                    >
                        <PackRequirementTiles profile={selectedProfile} readiness={selectedReadiness} />
                    </VendorPackCard>
                </RailSection>
            </div>
            <div className="flex shrink-0 items-center justify-end border-t p-2">
                <Button size="sm" onClick={onContinue}>Continue</Button>
            </div>
        </ResizablePanel>
    );
}

function RailSection({
    icon: Icon,
    title,
    aside,
    children,
}: {
    icon: LucideIcon;
    title: string;
    aside?: string;
    children: ReactNode;
}) {
    return (
        <section className="border-b px-3 py-2.5">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3 w-3" aria-hidden />
                {title}
                {aside ? <span className="ml-auto font-medium normal-case tracking-normal">{aside}</span> : null}
            </h4>
            {children}
        </section>
    );
}

function StripButton({
    icon: Icon,
    label,
    count,
    tone,
    onClick,
}: {
    icon: LucideIcon;
    label: string;
    count: string;
    tone: "destructive" | "warning";
    onClick: () => void;
}) {
    return (
        <Button size="icon-sm" variant="ghost" className="relative" aria-label={count ? `${label}: ${count}` : label} title={label} onClick={onClick}>
            <Icon className="h-4 w-4" />
            {count ? (
                <span
                    className={cn(
                        "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none",
                        tone === "destructive" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground",
                    )}
                >
                    {count}
                </span>
            ) : null}
        </Button>
    );
}
