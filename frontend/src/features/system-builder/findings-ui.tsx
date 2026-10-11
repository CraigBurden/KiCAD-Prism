import { useState } from "react";
import { ChevronDown, CircleAlert, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Finding } from "@/types/system";

import { findingDetail, levelCounts, worstLevel, type FindingLevel } from "./findings";
import { comparePads } from "./pads";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Icon and count for a list entry: errors win over warnings; info never shows. */
export function FindingCountBadge({ findings }: { findings: readonly Finding[] }) {
  const level = worstLevel(findings);
  if (!level) return null;
  const counts = levelCounts(findings);
  const count = level === "error" ? counts.errors : counts.warnings;
  const Icon = level === "error" ? CircleAlert : TriangleAlert;
  return (
    <Badge variant={level === "error" ? "destructive" : "warning"} className="shrink-0 tabular-nums"
      aria-label={plural(count, level)} title={plural(count, level)}>
      <Icon aria-hidden /> {count}
    </Badge>
  );
}

const RULE_TEXT: Record<string, string> = {
  row_duplicate: "Duplicate row",
  pin_fanout: "Pin used by several links",
  port_not_exposed: "Connector is not a port",
  pin_absent: "Pad does not exist",
  source_unavailable: "Board source unavailable",
  pcb_out_of_sync: "PCB net differs from the schematic",
  pin_net_ambiguous: "Pin carries several nets",
  open_review: "Open review",
  net_name_mismatch: "Joined nets share no name",
  power_meets_signal: "Power net meets a signal net",
  mate_mismatch: "Mated connectors do not line up",
  harness_collision: "Harness runs through a board",
  length_mismatch: "Cut length differs from the estimate",
  child_revision_unreleased: "Subsystem revision is not released",
  child_advance_blocked: "Subsystem update blocked by hierarchy limits",
  export_unresolved: "Export does not resolve",
  mating_stale: "Connector moved since its mating frame was confirmed",
  mate_pair_unknown: "Catalog does not list these parts as mating",
  mate_pin_mismatch: "Harness part pins do not land on connector pads",
  harness_tight_bend: "Harness bends tighter than its minimum radius",
  subport_pad_absent: "Sub-port names a pad the connector no longer has",
  part_collision: "Bodies intersect in 3D",
  net_meets_no_net: "Named net meets a pin on no net",
};

export function findingText(finding: Pick<Finding, "name">): string {
  return RULE_TEXT[finding.name] ?? finding.name.replace(/_/g, " ");
}

function netsText(nets: string[]): string {
  return nets.length ? nets.join(" | ") : "no net";
}

/**
 * SB2-112: where a finding is and what it saw, for one line: the pins (`J3 4 ↔ J7 4` for a join,
 * else `J7 · 18`) and the nets (`VCC ↔ no net`, or a PCB net that differs: `A ≠ PCB B`).
 */
export function findingFacts(finding: Finding): { pins: string; nets: string } {
  const { far, nets: seen } = findingDetail(finding);
  const pins = far
    ? `${[finding.reference, finding.pin].filter(Boolean).join(" ")} ↔ ${[far.reference, far.pin].filter(Boolean).join(" ")}`
    : [finding.reference, finding.pin].filter(Boolean).join(" · ");
  const nets = seen?.kind === "join" ? `${netsText(seen.a)} ↔ ${netsText(seen.b)}`
    : seen?.kind === "pcb" ? `${netsText(seen.schematic)} ≠ PCB ${netsText(seen.pcb)}`
      : seen ? netsText(seen.nets) : "";
  return { pins, nets };
}

export interface FindingGroup {
  key: string;
  level: FindingLevel;
  rule: string;
  text: string;
  reference: string | null;
  pins: string[];
}

/** One line per (rule, connector), listing the pins, so 43 findings read as one. */
export function groupFindings(findings: readonly Finding[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();
  for (const finding of findings) {
    if (finding.severity === "info") continue;
    const key = [finding.severity, finding.rule, finding.instanceId, finding.reference].join("|");
    const entry = groups.get(key) ?? {
      key, level: finding.severity, rule: finding.rule, text: findingText(finding), reference: finding.reference, pins: [],
    };
    if (finding.pin && !entry.pins.includes(finding.pin)) entry.pins.push(finding.pin);
    groups.set(key, entry);
  }
  return [...groups.values()]
    .map((entry) => ({ ...entry, pins: entry.pins.sort(comparePads) }))
    .sort((a, b) => (a.level === b.level ? a.rule.localeCompare(b.rule) : a.level === "error" ? -1 : 1));
}

/** A compact summary of findings, expandable to one line per rule and connector. */
export function FindingsAlert({ findings, title }: { findings: readonly Finding[]; title?: string }) {
  const [open, setOpen] = useState(false);
  const level = worstLevel(findings);
  if (!level) return null;
  const { errors, warnings } = levelCounts(findings);
  const summary = [errors ? plural(errors, "error") : null, warnings ? plural(warnings, "warning") : null].filter(Boolean).join(", ");
  const Icon = level === "error" ? CircleAlert : TriangleAlert;
  const groups = groupFindings(findings);
  return (
    <Alert variant={level === "error" ? "destructive" : "warning"}>
      <Icon />
      <AlertTitle>{title ? `${title}: ${summary}` : summary}</AlertTitle>
      <AlertDescription>
        <Collapsible open={open} onOpenChange={setOpen} className="w-full">
          <div className="flex w-full items-center gap-2">
            <p className={open ? "min-w-0 flex-1" : "min-w-0 flex-1 truncate"}>
              {open ? null : <>
              {groups.slice(0, 2).map((entry) => `${entry.text}${entry.reference ? ` on ${entry.reference}` : ""}`).join(" · ")}
              {groups.length > 2 && ` · ${groups.length - 2} more`}</>}
            </p>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs">
                {open ? "Hide" : "Details"}
                <ChevronDown className={open ? "ml-1 h-3 w-3 rotate-180" : "ml-1 h-3 w-3"} />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <ul className="mt-2 w-full space-y-1.5" aria-label="Findings">
              {groups.map((entry) => (
                <li key={entry.key} className="flex items-baseline gap-2">
                  <Badge variant={entry.level === "error" ? "destructive" : "warning"} className="h-5 px-1.5 font-mono text-[10px]">
                    {entry.rule}
                  </Badge>
                  <span className="min-w-0 text-foreground">
                    {entry.text}
                    {entry.reference && <span className="text-muted-foreground"> · {entry.reference}</span>}
                    {entry.pins.length > 0 && (
                      <span className="text-muted-foreground">
                        {" "}· {entry.pins.length === 1 ? "pin" : "pins"} <span className="font-mono">{entry.pins.join(", ")}</span>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </AlertDescription>
    </Alert>
  );
}
