import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import * as api from "../../api";
import type { ReleaseEvidence, ReleaseMember } from "../../types";

export function EvidenceWarnings({
    projectId,
    buildId,
    members,
    warnings,
    evidence,
}: {
    projectId: string;
    buildId: string;
    members: ReleaseMember[];
    warnings?: string[];
    evidence: ReleaseEvidence[];
}) {
    const groups = groupedWarningLines(warnings ?? []);
    const electrical = evidence.filter((item) => Object.keys(item.counts).length > 0);
    if (electrical.length === 0 && groups.length === 0) {
        return <p className="text-sm text-muted-foreground">No DRC or ERC evidence</p>;
    }

    return (
        <div className="space-y-2" aria-label="Build warnings">
            {electrical.map((item) => (
                <ElectricalEvidenceCard
                    key={item.kind}
                    projectId={projectId}
                    buildId={buildId}
                    members={members}
                    item={item}
                />
            ))}
            {groups.map((group) => (
                <WarningGroupCard key={group.label} group={group} />
            ))}
        </div>
    );
}

function ElectricalEvidenceCard({
    projectId,
    buildId,
    members,
    item,
}: {
    projectId: string;
    buildId: string;
    members: ReleaseMember[];
    item: ReleaseEvidence;
}) {
    const [open, setOpen] = useState(true);
    const [violations, setViolations] = useState<ElectricalViolation[] | null>(null);
    const [loadError, setLoadError] = useState("");
    const reportPath = evidenceReportPath(members, item.kind);

    useEffect(() => {
        if (!reportPath) {
            setViolations([]);
            setLoadError("");
            return;
        }
        let cancelled = false;
        setViolations(null);
        setLoadError("");
        void api.memberJson(projectId, buildId, reportPath)
            .then((payload) => {
                if (!cancelled) setViolations(collectViolations(payload));
            })
            .catch((cause: unknown) => {
                if (!cancelled) {
                    setViolations([]);
                    setLoadError(cause instanceof Error ? cause.message : String(cause));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [projectId, buildId, reportPath]);

    const grouped = groupedElectrical(violations ?? []);

    return (
        <Collapsible open={open} onOpenChange={setOpen} className="border">
            <CollapsibleTrigger
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
                aria-label={`${item.kind.toUpperCase()} details`}
            >
                <Badge variant="outline">{item.kind.toUpperCase()}</Badge>
                {Object.entries(item.counts).map(([severity, count]) => (
                    <Badge
                        key={severity}
                        variant={severity === "error" && count > 0 ? "destructive" : "secondary"}
                    >
                        {severityLabel(severity)}: {count}
                    </Badge>
                ))}
                <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted-foreground", open && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="max-h-80 space-y-3 overflow-y-auto border-t px-3 py-2">
                    {violations === null && (
                        <p className="text-sm text-muted-foreground">Loading violations…</p>
                    )}
                    {loadError && <p className="text-sm text-destructive">{loadError}</p>}
                    {violations && grouped.length === 0 && !loadError && (
                        <p className="text-sm text-muted-foreground">No violations listed</p>
                    )}
                    {grouped.map((group) => (
                        <div key={`${group.severity}-${group.type}`}>
                            <p className="text-xs font-medium">
                                {group.title}
                                <span className="ml-1 text-muted-foreground">
                                    ({group.descriptions.length} {severityLabel(group.severity).toLowerCase()}
                                    {group.descriptions.length === 1 ? "" : "s"})
                                </span>
                            </p>
                            <ul className="mt-1 space-y-0.5 text-sm">
                                {group.descriptions.map((description, index) => (
                                    <li key={`${group.type}-${index}`} className="break-words text-muted-foreground">
                                        {description}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

function WarningGroupCard({ group }: { group: { label: string; items: string[] } }) {
    const [open, setOpen] = useState(true);
    const title = humanizeType(group.label);
    return (
        <Collapsible open={open} onOpenChange={setOpen} className="border">
            <CollapsibleTrigger
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
                aria-label={`${title} details`}
            >
                <Badge variant="outline">{title}</Badge>
                <Badge variant="secondary">
                    {group.items.length} warning{group.items.length === 1 ? "" : "s"}
                </Badge>
                <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted-foreground", open && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <ul className="max-h-80 space-y-1 overflow-y-auto border-t px-3 py-2 text-sm">
                    {group.items.map((item, index) => (
                        <li key={`${group.label}-${index}`} className="break-words text-muted-foreground">
                            {item}
                        </li>
                    ))}
                </ul>
            </CollapsibleContent>
        </Collapsible>
    );
}

type ElectricalViolation = {
    type: string;
    severity: string;
    description: string;
};

function evidenceReportPath(members: ReleaseMember[], kind: ReleaseEvidence["kind"]): string | undefined {
    const reportKind = `${kind}_report`;
    return members.find((member) => member.member_kind === reportKind)?.path
        ?? members.find((member) => member.path.endsWith(`evidence/${kind}.json`))?.path;
}

function collectViolations(report: unknown): ElectricalViolation[] {
    if (!report || typeof report !== "object") return [];
    const payload = report as Record<string, unknown>;
    const items: ElectricalViolation[] = [];
    const push = (value: unknown) => {
        if (!value || typeof value !== "object") return;
        const row = value as Record<string, unknown>;
        if (row.excluded || row.ignored || row.waived) return;
        const type = String(row.type || "other");
        items.push({
            type,
            severity: String(row.severity || "unknown").trim().toLowerCase() || "unknown",
            description: String(row.description || type || "Violation"),
        });
    };
    for (const key of ["violations", "unconnected_items", "schematic_parity"]) {
        const list = payload[key];
        if (Array.isArray(list)) list.forEach(push);
    }
    const sheets = payload.sheets;
    if (Array.isArray(sheets)) {
        for (const sheet of sheets) {
            if (sheet && typeof sheet === "object") {
                const list = (sheet as { violations?: unknown }).violations;
                if (Array.isArray(list)) list.forEach(push);
            }
        }
    }
    return items;
}

function groupedElectrical(items: ElectricalViolation[]): {
    severity: string;
    type: string;
    title: string;
    descriptions: string[];
}[] {
    const groups = new Map<string, { severity: string; type: string; title: string; descriptions: string[] }>();
    for (const item of items) {
        const key = `${item.severity}\0${item.type}`;
        const existing = groups.get(key);
        if (existing) existing.descriptions.push(item.description);
        else {
            groups.set(key, {
                severity: item.severity,
                type: item.type,
                title: humanizeType(item.type),
                descriptions: [item.description],
            });
        }
    }
    const rank = ["error", "warning", "exclusion", "unknown"];
    return [...groups.values()].sort((left, right) => {
        const leftRank = rank.indexOf(left.severity);
        const rightRank = rank.indexOf(right.severity);
        if (leftRank !== rightRank) return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
        return left.title.localeCompare(right.title);
    });
}

function humanizeType(type: string): string {
    const cleaned = type.replace(/[_-]+/g, " ").trim();
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "Other";
}

function severityLabel(severity: string): string {
    return severity ? severity.charAt(0).toUpperCase() + severity.slice(1) : severity;
}

const ELECTRICAL_SUMMARY = /^(DRC|ERC):\s*\d+\s+error-severity/i;

function shortenWarning(text: string): string {
    const match = text.match(/(\S+\.(?:step|wrl|stp|iges))\s+resolves outside/i);
    if (match) return `${match[1]} is outside the closure`;
    return text;
}

function groupedWarningLines(warnings: string[]): { label: string; items: string[] }[] {
    const groups = new Map<string, string[]>();
    for (const warning of warnings) {
        if (ELECTRICAL_SUMMARY.test(warning)) continue;
        const colon = warning.indexOf(":");
        const label = colon > 0 ? warning.slice(0, colon).trim() : "warning";
        const rest = colon > 0 ? warning.slice(colon + 1).trim() : warning;
        const key = label.toLowerCase();
        const items = groups.get(key);
        const item = shortenWarning(rest);
        if (items) items.push(item);
        else groups.set(key, [item]);
    }
    return [...groups.entries()].map(([label, items]) => ({ label, items }));
}
