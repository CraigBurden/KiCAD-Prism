import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useVirtualViewport } from "@/hooks/use-virtual-viewport";
import { Input } from "@/components/ui/input";
import { proposeRename, unwaiveFinding, waiveFinding, waiveFindings, withdrawRename } from "@/lib/systems-api";
import { cn } from "@/lib/utils";
import type { Finding, FindingWaiver, NetRename, Severity, SystemDocument } from "@/types/system";

import { documentIndex } from "../document-index";
import { findingDetail, findingTarget, findingsOf } from "../findings";
import { findingFacts, findingText } from "../findings-ui";
import { endLabel } from "../link-editor";
import type { Mutate } from "../use-system-mutation";
import { findingKeys } from "./finding-keys";
import { RenamePopover, renameSides, type RenameSide } from "./rename-popover";
import type { WorkspaceSelection } from "./workspace-state";

/**
 * SB2-100: the Findings tray. Findings group by rule, with counts; a group opens on demand; the
 * list is virtualised. Warnings and info can be waived with a note (D-P2-56); waived findings
 * and waivers whose finding is gone list apart at the end.
 */
const ROW_HEIGHT = 32;
const OVERSCAN = 8;
/** Groups this small, or a list this short, start open. */
const OPEN_GROUP = 8;
const OPEN_TOTAL = 30;
const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
const WAIVABLE = new Set<Severity>(["warning", "info"]);
const TONE: Record<Severity, string> = { error: "text-destructive", warning: "text-warning", info: "text-muted-foreground" };

type Row =
  | { kind: "group"; key: string; severity: Severity; rule: string; text: string; count: number; open: boolean; members: Finding[] }
  | { kind: "place"; key: string; place: string; count: number; open: boolean; members: Finding[] }
  | { kind: "finding"; key: string; finding: Finding; nested?: boolean }
  | { kind: "waived-header"; key: string; count: number; open: boolean }
  | { kind: "waiver"; key: string; waiver: FindingWaiver; finding: Finding | null }
  | { kind: "renames-header"; key: string; count: number; open: boolean }
  | { kind: "rename"; key: string; rename: NetRename };

interface FindingsTrayProps {
  systemId: string;
  document: SystemDocument;
  etag: string;
  canEdit: boolean;
  run: Mutate;
  onSelect: (selection: WorkspaceSelection) => void;
}

export function findingPlace(document: SystemDocument, finding: Finding): string {
  const index = documentIndex(document);
  if (finding.linkId) {
    const link = index.links.get(finding.linkId);
    return link ? link.name || `${endLabel(document, link, "a")} ↔ ${endLabel(document, link, "b")}` : "";
  }
  return (finding.instanceId && index.instances.get(finding.instanceId)?.label) || "";
}

/** Whether the filter matches the finding's place, pins and nets, its rule or the rule's label. */
function matches(document: SystemDocument, finding: Finding, query: string): boolean {
  if (!query) return true;
  const facts = findingFacts(finding);
  return [findingPlace(document, finding), facts.pins, facts.nets, finding.rule, findingText(finding)]
    .join(" ").toLowerCase().includes(query);
}

/** The catalog page of a SYS-V14 finding's subsystem or module, where its revision is released. */
function catalogHref(document: SystemDocument, finding: Finding): string | null {
  if (finding.rule !== "SYS-V14" || !finding.instanceId) return null;
  const componentId = documentIndex(document).instances.get(finding.instanceId)?.catalog?.componentId;
  return componentId ? `/?section=library-manager&libraryView=catalog&catalogSelection=${encodeURIComponent(componentId)}` : null;
}

function WaivePopover({ onWaive, label = "Waive" }: { onWaive: (note: string) => Promise<boolean>; label?: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const save = async () => {
    if (await onWaive(note.trim())) {
      setOpen(false);
      setNote("");
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="shrink-0 text-right text-xs text-muted-foreground hover:text-foreground hover:underline">{label}</button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <Textarea aria-label="Why this is acceptable" placeholder="Why this is acceptable" value={note} rows={3}
          onChange={(event) => setNote(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" disabled={!note.trim()} onClick={() => void save()}>Waive</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FindingsTray({ systemId, document, etag, canEdit, run, onSelect }: FindingsTrayProps) {
  const report = document.validation;
  const findings = report?.findings;
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const { height, scrollTop, viewportRef, onScroll } = useVirtualViewport();

  const [filter, setFilter] = useState("");
  const rows = useMemo<Row[]>(() => {
    if (!findings) return [];
    const query = filter.trim().toLowerCase();
    const index = findingsOf(findings);
    const open = index.open.filter((finding) => matches(document, finding, query));
    const groups = new Map<string, Finding[]>();
    for (const finding of [...open].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      || a.rule.localeCompare(b.rule))) {
      const key = `${finding.severity}|${finding.rule}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(finding);
    }
    const out: Row[] = [];
    for (const [key, members] of groups) {
      const startsOpen = Boolean(query) || open.length <= OPEN_TOTAL || members.length <= OPEN_GROUP;
      const isOpen = startsOpen !== toggled.has(key);
      const [first] = members;
      out.push({ kind: "group", key, severity: first.severity, rule: first.rule, text: findingText(first), count: members.length,
        open: isOpen, members });
      if (!isOpen) continue;
      const keys = findingKeys(members);
      // SB2-113: a large group splits by place (a link, a harness or a board), the unit an EE triages.
      const places = new Map<string, number[]>();
      members.forEach((finding, index) => {
        const place = findingPlace(document, finding);
        (places.get(place) ?? places.set(place, []).get(place)!).push(index);
      });
      if (members.length <= OPEN_GROUP || places.size < 2) {
        members.forEach((finding, index) => out.push({ kind: "finding", key: `${key}#${keys[index]}`, finding }));
        continue;
      }
      for (const [place, indexes] of [...places].sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0]))) {
        const placeKey = `${key}/${place}`;
        const placeOpen = toggled.has(placeKey);
        out.push({ kind: "place", key: placeKey, place, count: indexes.length, open: placeOpen,
          members: indexes.map((index) => members[index]) });
        if (placeOpen) {
          indexes.forEach((index) => out.push({ kind: "finding", key: `${placeKey}#${keys[index]}`, finding: members[index], nested: true }));
        }
      }
    }
    const waivers = report?.waivers ?? [];
    if (waivers.length) {
      const isOpen = !toggled.has("waived");
      out.push({ kind: "waived-header", key: "waived", count: waivers.length, open: isOpen });
      if (isOpen) {
        for (const waiver of waivers) {
          out.push({ kind: "waiver", key: `waiver#${waiver.id}`, waiver, finding: index.waived(waiver.findingKey) });
        }
      }
    }
    // SB2-106 (P2 §23): open net rename proposals, each until its board's commit carries the name.
    const renames = document.renames ?? [];
    if (renames.length) {
      const isOpen = !toggled.has("renames");
      out.push({ kind: "renames-header", key: "renames", count: renames.length, open: isOpen });
      if (isOpen) renames.forEach((rename) => out.push({ kind: "rename", key: `rename#${rename.id}`, rename }));
    }
    return out;
  }, [findings, report?.waivers, document, toggled, filter]);

  if (!report || !findings) return <p className="p-4 text-sm text-muted-foreground">Loading findings…</p>;
  if (!findings.length && !report.waivers?.length && !document.renames?.length) {
    return <p className="p-4 text-sm text-muted-foreground">No findings</p>;
  }

  const toggle = (key: string) => setToggled((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const waive = async (finding: Finding, note: string) =>
    Boolean(finding.key && await run("waive", () => waiveFinding(systemId, etag, finding.key!, note), "Finding waived"));
  const waiveAll = async (members: Finding[], note: string) => {
    const keys = members.flatMap((finding) => (finding.key && WAIVABLE.has(finding.severity) ? [finding.key] : []));
    return Boolean(keys.length && await run("waive", () => waiveFindings(systemId, etag, keys, note),
      `${keys.length} ${keys.length === 1 ? "finding" : "findings"} waived`));
  };
  const unwaive = (waiver: FindingWaiver) =>
    void run("unwaive", () => unwaiveFinding(systemId, etag, waiver.id), "Waiver removed");
  const propose = async (side: RenameSide, name: string, note: string) => Boolean(await run("rename",
    () => proposeRename(systemId, etag, { instanceId: side.instanceId, net: side.net, name, ...(note ? { note } : {}) }),
    `Rename proposed to ${side.board}`));
  const withdraw = (rename: NetRename) =>
    void run("rename", () => withdrawRename(systemId, etag, rename.id), "Proposal withdrawn");
  const boards = documentIndex(document).instances;

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);

  const render = (row: Row) => {
    if (row.kind === "group" || row.kind === "waived-header" || row.kind === "renames-header") {
      const Icon = row.open ? ChevronDown : ChevronRight;
      const waivable = row.kind === "group" && canEdit && WAIVABLE.has(row.severity);
      return (
        <div className="flex h-full items-center gap-2 border-b bg-muted/40 pr-4 text-xs font-medium hover:bg-muted">
          <button type="button" aria-expanded={row.open} onClick={() => toggle(row.key)}
            className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-left">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            {row.kind === "group" ? (
              <>
                <span className={cn("w-16 shrink-0 font-mono font-bold", TONE[row.severity])}>{row.rule}</span>
                <span className="min-w-0 flex-1 truncate">{row.text}</span>
              </>
            ) : <span className="min-w-0 flex-1 truncate">{row.kind === "waived-header" ? "Waived" : "Rename proposals"}</span>}
            <span className="shrink-0 tabular-nums text-muted-foreground">{row.count}</span>
          </button>
          {waivable && <WaivePopover label="Waive all" onWaive={(note) => waiveAll(row.members, note)} />}
        </div>
      );
    }
    if (row.kind === "place") {
      const Icon = row.open ? ChevronDown : ChevronRight;
      const waivable = canEdit && row.members.some((finding) => WAIVABLE.has(finding.severity));
      return (
        <div className="flex h-full items-center gap-3 border-b pl-6 pr-4 text-sm">
          <button type="button" aria-expanded={row.open} onClick={() => toggle(row.key)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{row.place || "System"}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{row.count}</span>
          </button>
          {waivable && <WaivePopover label="Waive all" onWaive={(note) => waiveAll(row.members, note)} />}
        </div>
      );
    }
    if (row.kind === "finding") {
      const { finding } = row;
      const to = findingTarget(finding);
      const facts = findingFacts(finding);
      const catalog = catalogHref(document, finding);
      return (
        <div className={cn("flex h-full items-center gap-3 border-b pr-4 text-sm", row.nested ? "pl-14" : "pl-9")}
          title={[findingText(finding), facts.nets].filter(Boolean).join("\n")}>
          <span className={cn("min-w-0 truncate", facts.nets ? "w-48 shrink-0" : "flex-1")}>{findingPlace(document, finding)}</span>
          <span className="w-36 shrink-0 truncate font-mono text-xs">{facts.pins}</span>
          {facts.nets && <span className="hidden min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground md:block">{facts.nets}</span>}
          {catalog ? <a className="w-14 shrink-0 text-right text-xs text-primary hover:underline" href={catalog}>Catalog</a>
            : finding.rule === "SYS-V09" ? <RenameSlot finding={finding} document={document} canEdit={canEdit} onPropose={propose} />
              : null}
          {canEdit && WAIVABLE.has(finding.severity) && finding.key
            ? <span className="w-12 shrink-0 text-right"><WaivePopover onWaive={(note) => waive(finding, note)} /></span>
            : <span className="w-12 shrink-0" />}
          {to ? (
            <button type="button" className="w-12 shrink-0 text-right text-xs text-primary hover:underline" onClick={() => onSelect(to)}>Show</button>
          ) : <span className="w-12 shrink-0" />}
        </div>
      );
    }
    if (row.kind === "rename") {
      const { rename } = row;
      return (
        <div className="flex h-full items-center gap-3 border-b pl-9 pr-4 text-sm" title={rename.note ?? undefined}>
          <span className="w-24 shrink-0 truncate">{boards.get(rename.instanceId)?.label ?? "?"}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs">
            {rename.net ?? "Restricted"}{rename.name ? <span className="text-primary"> → {rename.name}</span> : null}
          </span>
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {rename.rows === null ? "" : `${rename.rows} ${rename.rows === 1 ? "row" : "rows"}`}
          </span>
          {canEdit && !rename.redacted
            ? <button type="button" className="w-16 shrink-0 text-right text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => withdraw(rename)}>Withdraw</button>
            : <span className="w-16 shrink-0" />}
        </div>
      );
    }
    const { waiver, finding } = row;
    return (
      <div className="flex h-full items-center gap-3 border-b pl-9 pr-4 text-sm" title={waiver.note ?? undefined}>
        <span className="w-16 shrink-0 font-mono text-xs font-bold text-muted-foreground">{waiver.rule}</span>
        <span className="w-40 shrink-0 truncate">{finding ? findingPlace(document, finding) : "No longer raised"}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{waiver.note ?? "Restricted"}</span>
        <span className="hidden w-32 shrink-0 truncate text-xs text-muted-foreground md:block">{waiver.by.replace(/^user:/, "")}</span>
        {canEdit && !waiver.redacted
          ? <button type="button" className="w-14 shrink-0 text-right text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => unwaive(waiver)}>Unwaive</button>
          : <span className="w-14 shrink-0" />}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-1.5">
        <Input aria-label="Filter findings" placeholder="Filter: board, link, pin, net" value={filter} className="h-7 text-xs"
          onChange={(event) => setFilter(event.target.value)} />
      </div>
    <div ref={viewportRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto">
      <ul aria-label="Findings" className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
        {rows.slice(first, last).map((row, index) => (
          <li key={row.key} className="absolute inset-x-0" style={{ top: (first + index) * ROW_HEIGHT, height: ROW_HEIGHT }}>
            {render(row)}
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}

/** A SYS-V09 row's rename: "→ NAME" once proposed (P2 §23.4), else the action for editors. */
function RenameSlot({ finding, document, canEdit, onPropose }: {
  finding: Finding;
  document: SystemDocument;
  canEdit: boolean;
  onPropose: (side: RenameSide, name: string, note: string) => Promise<boolean>;
}) {
  const proposed = findingDetail(finding).rename;
  if (proposed) {
    return <span className="w-14 shrink-0 truncate text-right font-mono text-xs text-primary" title="Rename proposed">→ {proposed.name}</span>;
  }
  const sides = canEdit ? renameSides(document, finding) : [];
  return sides.length ? <RenamePopover sides={sides} onPropose={onPropose} /> : <span className="w-14 shrink-0" />;
}
