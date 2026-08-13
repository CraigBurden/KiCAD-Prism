import { useEffect, useState } from "react";
import {
    CheckCircle2,
    Copy,
    Download,
    FileCheck2,
    HelpCircle,
    ShieldX,
    XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import * as api from "./api";
import { DOCUMENT_ORDER, outcomeTone, shortDigest } from "./flow";
import type {
    Approval,
    DocumentSheet,
    Finding,
    ReleaseMember,
    ReleaseRecord,
    RuleOutcome,
    VendorProfile,
    VerificationReport,
    Waiver,
    WebReleaseShare,
    VendorReadiness,
} from "./types";

function revokeObjectUrl(url: string) {
    if (url && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(url);
    }
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
                            <p className="mt-1 text-xs text-warning">
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

export function orderedSheets(sheets: DocumentSheet[]): DocumentSheet[] {
    return [...sheets].sort((left, right) => {
        const leftIndex = DOCUMENT_ORDER.indexOf(left.key as (typeof DOCUMENT_ORDER)[number]);
        const rightIndex = DOCUMENT_ORDER.indexOf(right.key as (typeof DOCUMENT_ORDER)[number]);
        const leftRank = leftIndex === -1 ? DOCUMENT_ORDER.length : leftIndex;
        const rightRank = rightIndex === -1 ? DOCUMENT_ORDER.length : rightIndex;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return left.key.localeCompare(right.key);
    });
}

export function DocumentSheetPreview({
    projectId,
    buildId,
    sheet,
}: {
    projectId: string;
    buildId: string;
    sheet: DocumentSheet;
}) {
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        let revoked = false;
        let created = "";
        setUrl("");
        setError("");
        void Promise.resolve(api.sheetObjectUrl(projectId, buildId, sheet.key))
            .then((objectUrl) => {
                if (!objectUrl) return;
                if (revoked) {
                    revokeObjectUrl(objectUrl);
                    return;
                }
                created = objectUrl;
                setUrl(objectUrl);
            })
            .catch((cause: unknown) => {
                if (!revoked) setError(cause instanceof Error ? cause.message : String(cause));
            });
        return () => {
            revoked = true;
            revokeObjectUrl(created);
        };
    }, [projectId, buildId, sheet.key]);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold capitalize">{sheet.key.replace(/-/g, " ")}</h3>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        void api.downloadFile(
                            api.downloadUrl(
                                projectId,
                                `builds/${encodeURIComponent(buildId)}/sheets/${encodeURIComponent(sheet.key)}.pdf`,
                            ),
                            `${sheet.key}.pdf`,
                        )
                    }
                >
                    <Download className="mr-1 h-3 w-3" /> Download PDF
                </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {url && (
                <iframe title={sheet.key} src={url} className="h-[70vh] w-full border bg-preview-surface" />
            )}
        </div>
    );
}

function previewKind(mediaType: string, path: string): "pdf" | "image" | "text" | "none" {
    const type = (mediaType || "").toLowerCase();
    if (type === "application/pdf") return "pdf";
    if (type.startsWith("image/")) return "image";
    if (
        type.startsWith("text/")
        || type === "application/json"
        || type === "application/vnd.gerber"
        || /\.(gbr|g[a-z0-9]{2}|drl|csv|json|txt)$/i.test(path)
    ) {
        return "text";
    }
    return "none";
}

export function MemberViewer({
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
    const [objectUrl, setObjectUrl] = useState("");
    const [text, setText] = useState("");
    const [failure, setFailure] = useState("");
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
                    revokeObjectUrl(url);
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
                if (!revoked) setFailure(cause instanceof Error ? cause.message : String(cause));
            });
        return () => {
            revoked = true;
            revokeObjectUrl(created);
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
                    This member type has no in-app preview. Download it to inspect the released bytes.
                </p>
            )}
            {!failure && kind === "pdf" && objectUrl && (
                <iframe title={member.path} src={objectUrl} className="h-[70vh] w-full border" />
            )}
            {!failure && kind === "image" && objectUrl && (
                <img alt={member.path} src={objectUrl} className="max-h-[70vh] w-full border bg-preview-surface object-contain" />
            )}
            {!failure && kind === "text" && text && (
                <pre className="max-h-[70vh] overflow-auto border bg-muted/40 p-2 text-xs">{text}</pre>
            )}
        </div>
    );
}

export function VendorPackCard({
    projectId,
    buildId,
    recordId,
    profiles,
    busy,
    readiness = [],
    vendorId: controlledVendorId,
    onVendorChange,
}: {
    projectId: string;
    buildId: string;
    recordId?: string;
    profiles: VendorProfile[];
    busy: string;
    readiness?: VendorReadiness[];
    vendorId?: string;
    onVendorChange?: (vendorId: string) => void;
}) {
    const [uncontrolledVendorId, setUncontrolledVendorId] = useState(profiles[0]?.id ?? "");
    const vendorId = controlledVendorId ?? uncontrolledVendorId;
    const selected = profiles.find((profile) => profile.id === vendorId) ?? profiles[0];
    const readinessForSelected = readiness.find((item) => (item.vendor_id || item.profile_id) === selected?.id);
    // A signed record is not evidence that a manufacturer-specific pack is
    // complete. The build-scoped readiness response is the only authority.
    const ready = readinessForSelected?.ready === true;
    if (!selected) return null;

    return (
        <div className="space-y-2 rounded-md border p-3">
            <h4 className="text-sm font-semibold">Download for manufacturer</h4>
            <div className="flex flex-wrap items-end gap-2">
                <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">Manufacturer</span>
                    <select
                        aria-label="Manufacturer"
                        className="flex h-9 min-w-48 border border-input bg-background px-3 text-sm"
                        value={selected.id}
                        onChange={(event) => {
                            setUncontrolledVendorId(event.target.value);
                            onVendorChange?.(event.target.value);
                        }}
                    >
                        {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                                {profile.title}
                            </option>
                        ))}
                    </select>
                </label>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy) || !ready}
                    onClick={() =>
                        void api.downloadFile(
                            recordId
                                ? api.recordVendorPackUrl(projectId, recordId, selected.id)
                                : api.vendorPackUrl(projectId, buildId, selected.id),
                            selected.pack_filename,
                        )
                    }
                >
                    <Download className="mr-1 h-3 w-3" /> Download {selected.pack_filename}
                </Button>
            </div>
            <p className={cn("text-xs", ready ? "text-muted-foreground" : "text-destructive")}>
                {ready ? selected.description : `Incomplete: ${(readinessForSelected?.missing_requirements ?? []).join(", ") || "manufacturer pack is not ready"}`}
            </p>
        </div>
    );
}

export function ReleaseRecordsList({
    projectId,
    records,
    shares,
    shareUrls,
    verification,
    canMutate,
    busy,
    profiles,
    vendorReadinessByBuild = {},
    onRun,
    onVerified,
    onShared,
}: {
    projectId: string;
    records: ReleaseRecord[];
    shares: Record<string, WebReleaseShare[]>;
    shareUrls: Record<string, string>;
    verification: Record<string, VerificationReport>;
    canMutate: boolean;
    busy: string;
    profiles: VendorProfile[];
    /** Only build details supply vendor readiness; unknown records stay locked. */
    vendorReadinessByBuild?: Record<string, VendorReadiness[] | undefined>;
    onRun: (label: string, action: () => Promise<unknown>, success?: string) => Promise<void>;
    onVerified: (recordId: string, report: VerificationReport) => void;
    onShared: (recordId: string, url: string) => void;
}) {
    if (records.length === 0) {
        return <p className="text-sm text-muted-foreground">No signed releases yet.</p>;
    }
    return (
        <div className="space-y-3">
            {records.map((record) => {
                const report = verification[record.id];
                return (
                    <div key={record.id} className="space-y-2 rounded-md border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{record.release_label}</span>
                            <Badge variant="outline">{record.revision || "—"}</Badge>
                            <span className="font-mono text-xs text-muted-foreground">
                                {record.commit_sha.slice(0, 12)}
                            </span>
                            <div className="ml-auto flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        void api.downloadFile(
                                            api.downloadUrl(
                                                projectId,
                                                `records/${encodeURIComponent(record.id)}/release-archive`,
                                            ),
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
                                        void api.verifyRecord(projectId, record.id).then((result) => {
                                            onVerified(record.id, result);
                                        })
                                    }
                                >
                                    <FileCheck2 className="mr-1 h-3 w-3" /> Verify
                                </Button>
                                {canMutate && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            void onRun(`share-${record.id}`, async () => {
                                                const result = await api.createWebRelease(projectId, record.id);
                                                const absolute = new URL(result.url, window.location.origin).toString();
                                                onShared(record.id, absolute);
                                                await navigator.clipboard.writeText(absolute);
                                            }, "Public release link copied.")
                                        }
                                    >
                                        <Copy className="mr-1 h-3 w-3" /> Share
                                    </Button>
                                )}
                            </div>
                        </div>
                        <VendorPackCard
                            projectId={projectId}
                            buildId=""
                            recordId={record.id}
                            profiles={profiles}
                            busy={busy}
                            readiness={vendorReadinessByBuild[record.build_id]}
                        />
                        {shareUrls[record.id] && (
                            <div className="break-all border bg-muted/40 px-3 py-2 font-mono text-xs">
                                {shareUrls[record.id]}
                            </div>
                        )}
                        {(shares[record.id] ?? []).map((share) => (
                            <div key={share.id} className="flex flex-wrap items-center gap-2 text-xs">
                                <Badge variant={share.status === "active" ? "secondary" : "outline"}>
                                    {share.status}
                                </Badge>
                                <span className="text-muted-foreground">
                                    created by {share.created_by || "unknown"}
                                </span>
                                {canMutate && share.status === "active" && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="ml-auto h-7 text-destructive"
                                        disabled={Boolean(busy)}
                                        onClick={() =>
                                            void onRun(
                                                `revoke-share-${share.id}`,
                                                () => api.revokeWebRelease(projectId, share.id),
                                                "Public release link revoked.",
                                            )
                                        }
                                    >
                                        <ShieldX className="mr-1 h-3 w-3" /> Revoke
                                    </Button>
                                )}
                            </div>
                        ))}
                        {report && (
                            <div
                                className={cn(
                                    "rounded border px-3 py-2 text-xs",
                                    report.ok
                                        ? "border-success/40 bg-success/10"
                                        : "border-destructive/40 bg-destructive/10",
                                )}
                            >
                                <div className="mb-1 font-semibold">{report.ok ? "VERIFIED" : "REJECTED"}</div>
                                <ul className="space-y-0.5">
                                    {report.checks.map((check, index) => (
                                        <li key={index} className="flex items-start gap-1">
                                            {check.ok ? (
                                                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" />
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
        </div>
    );
}

export type RunFn = (label: string, action: () => Promise<unknown>, success?: string) => Promise<void>;

export function WaiverApproval({
    projectId,
    waiver,
    busy,
    onRun,
}: {
    projectId: string;
    waiver: Waiver;
    busy: string;
    onRun: RunFn;
}) {
    const [claiming, setClaiming] = useState(false);
    const [exceptionReason, setExceptionReason] = useState("");
    const approve = (exception?: { exception_kind: "self_approval"; exception_reason: string }) =>
        void onRun("waiver", () => api.transitionWaiver(projectId, waiver.id, "approve", "", exception));

    if (claiming) {
        return (
            <div className="ml-auto flex w-full flex-col gap-2 sm:w-80">
                <textarea
                    value={exceptionReason}
                    onChange={(event) => setExceptionReason(event.target.value)}
                    placeholder="Why is no second approver available?"
                    rows={2}
                    className="border bg-background p-2 text-sm"
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
            <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => approve()}>
                Approve waiver
            </Button>
            <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => setClaiming(true)}>
                Self-approve…
            </Button>
        </div>
    );
}

export function WaiverComposer({
    projectId,
    buildId,
    findings,
    busy,
    onRun,
}: {
    projectId: string;
    /** Waivers bind to the build they were raised against, so an accepted
     *  exception does not travel to the next release unexamined. */
    buildId: string;
    findings: Finding[];
    busy: string;
    onRun: RunFn;
}) {
    const [selected, setSelected] = useState(findings[0]?.finding_key ?? "");
    const [reason, setReason] = useState("");
    const finding = findings.find((item) => item.finding_key === selected) ?? findings[0];
    return (
        <div className="space-y-2 rounded-md border p-3">
            <h4 className="text-sm font-semibold">Propose a waiver</h4>
            <select
                className="w-full border bg-background px-2 py-1 text-sm"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
            >
                {findings.map((item) => (
                    <option key={item.finding_key} value={item.finding_key}>
                        {/* The rule and subject alone read as a category, so several
                            distinct findings looked like the same entry. The message
                            is what tells them apart. */}
                        {item.rule_id} — {item.subject}
                        {item.message ? ` · ${item.message}` : ""}
                    </option>
                ))}
            </select>
            <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                className="w-full border bg-background p-2 text-sm"
                placeholder="Why this finding is accepted"
            />
            <Button
                size="sm"
                disabled={Boolean(busy) || !reason.trim() || !finding}
                onClick={() =>
                    void onRun("waiver", () =>
                        api.createWaiver(projectId, buildId, {
                            rule_id: finding.rule_id,
                            domain: finding.domain,
                            reason: reason.trim(),
                            finding_key: finding.finding_key,
                            subject_pattern: finding.subject,
                        }),
                    )
                }
            >
                Propose waiver
            </Button>
        </div>
    );
}
