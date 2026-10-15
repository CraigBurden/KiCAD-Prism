import type { ReactNode } from "react";
import { PanelBottomOpen, Spline } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Finding, SystemDocument, SystemHarness, SystemLink } from "@/types/system";

import { BoardDetail } from "../board-detail";
import { ExportsSection } from "../exports-section";
import { findingsOf, levelCounts } from "../findings";
import { groupFindings } from "../findings-ui";
import { endLabel } from "../link-editor";
import type { PartDetail } from "./part-detail";
import { PartInspector } from "./part-inspector";
import { InspectorFacts } from "./inspector-facts";
import { InspectorHeader } from "./inspector-header";
import { InspectorSection } from "./inspector-section";
import type { WorkspaceSelection } from "./workspace-state";
import { documentIndex } from "../document-index";

interface InspectorProps {
  systemId: string;
  document: SystemDocument;
  canEdit: boolean;
  /** The reader may write the catalog: Convert a pinned module's or part's models (§18.2). */
  canConvertModels?: boolean;
  findings: Finding[];
  selection: WorkspaceSelection | null;
  /** The part picked on the selected board in the 3D view. */
  part?: PartDetail | null;
  onSelect: (selection: WorkspaceSelection | null) => void;
  /** Where the 3D view puts its move, route and trace panels (the large-screen inspector only). */
  slot?: (node: HTMLElement | null) => void;
  /** Opens the tray on the selected link's or harness's rows. */
  onEditRows: () => void;
  /** Opens the 3D view in Route mode on a harness (D-P2-51); absent without WebGPU or edit rights. */
  onEditRoute?: (harnessId: string) => void;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function countSummary(errors: number, warnings: number): ReactNode {
  if (!errors && !warnings) return <span className="text-muted-foreground">None</span>;
  return (
    <span className="inline-flex items-center gap-3 tabular-nums" title={`${plural(errors, "error")} · ${plural(warnings, "warning")}`}>
      {errors > 0 && <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-destructive" aria-hidden />{errors}</span>}
      {warnings > 0 && <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warning" aria-hidden />{warnings}</span>}
    </span>
  );
}

function findingSummary(findings: readonly Finding[]): ReactNode {
  const { errors, warnings } = levelCounts(findings);
  return countSummary(errors, warnings);
}

function FindingList({ findings }: { findings: readonly Finding[] }) {
  const groups = groupFindings(findings);
  if (!groups.length) return null;
  const { errors, warnings } = levelCounts(findings);
  return (
    <InspectorSection title="Findings" count={errors + warnings}>
      <ul className="text-sm">
        {groups.slice(0, 6).map((entry) => (
          <li key={entry.key} className="flex h-8 items-center gap-2 border-b last:border-b-0"
            title={[entry.rule, entry.text, entry.reference, entry.pins.length ? `pins ${entry.pins.join(", ")}` : ""].filter(Boolean).join(" · ")}>
            <span className={cn("size-1.5 shrink-0 rounded-full", entry.level === "error" ? "bg-destructive" : "bg-warning")} aria-label={entry.level} />
            <span className="min-w-0 flex-1 truncate">{entry.text}</span>
            {entry.reference && <span className="shrink-0 font-mono text-xs text-muted-foreground">{entry.reference}</span>}
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{entry.pins.length || ""}</span>
          </li>
        ))}
      </ul>
      {groups.length > 6 && <p className="pt-1 text-xs text-muted-foreground">+{groups.length - 6} in the Findings tray</p>}
    </InspectorSection>
  );
}

function boardsText(total: number | null | undefined, direct: number, subsystems: number): string {
  if (!subsystems || total == null || total === direct) return String(total ?? direct);
  return direct ? `${total} · ${direct} direct` : `${total} in ${subsystems} ${subsystems === 1 ? "subsystem" : "subsystems"}`;
}

function SystemOverview({ document, canEdit, onSelect }: InspectorProps) {
  const { system } = document;
  const kinds = (kind: string) => document.instances.filter((item) => (item.kind ?? "board") === kind).length;
  const counts = document.findingCounts;
  return (
    <div className="space-y-5">
      <InspectorHeader kind="System" title={system.name} subtitle={system.description || undefined} />
      <InspectorFacts rows={[
        // SB2-101: every board, counted through subsystems; the ones placed here directly apart.
        { label: "Boards", value: boardsText(system.boardTotal, kinds("board"), kinds("assembly")) },
        ...(kinds("module") ? [{ label: "Modules", value: String(kinds("module")) }] : []),
        ...(kinds("assembly") ? [{ label: "Subsystems", value: String(kinds("assembly")) }] : []),
        { label: "Connections", value: String(document.links.length + (document.harnesses?.length ?? 0)) },
        { label: "To review", value: document.openReviewCount ? String(document.openReviewCount) : <span className="text-muted-foreground">None</span> },
        { label: "Findings", value: counts ? countSummary(counts.error, counts.warning) : <span className="text-muted-foreground">Not evaluated</span> },
      ]} />
      <ExportsSection document={document} canEdit={canEdit}
        onOpenBoard={(instanceId) => onSelect({ kind: "instance", id: instanceId })} />
    </div>
  );
}

function LinkSummary({ document, link, findings, onEditRows }: { document: SystemDocument; link: SystemLink; findings: Finding[]; onEditRows: () => void }) {
  const own = findingsOf(findings).link(link.id);
  const a = endLabel(document, link, "a");
  const b = endLabel(document, link, "b");
  return (
    <div className="space-y-5">
      <InspectorHeader kind={link.type === "b2b" ? "Board-to-board link" : "Link"} title={link.name || `${a} ↔ ${b}`}
        actions={(
          <Button variant="ghost" size="icon-sm" aria-label="Open its rows" title="Open its rows in the tray" onClick={onEditRows}>
            <PanelBottomOpen className="size-4" />
          </Button>
        )} />
      <InspectorFacts rows={[
        { label: "End A", value: a },
        { label: "End B", value: b },
        { label: "Pins", value: String(link.rows.length) },
        ...(link.type === "b2b" ? [{ label: "Stack height", value: link.stackHeightMm != null ? `${link.stackHeightMm} mm` : <span className="text-muted-foreground">Not set</span> }] : []),
        { label: "Findings", value: findingSummary(own) },
      ]} />
      <FindingList findings={own} />
    </div>
  );
}

function HarnessSummary({ document, harness, findings, onEditRows, onEditRoute }: {
  document: SystemDocument; harness: SystemHarness; findings: Finding[]; onEditRows: () => void; onEditRoute?: (harnessId: string) => void;
}) {
  const own = findingsOf(findings).harness(harness.id);
  const label = (instanceId: string | null | undefined) => (instanceId ? documentIndex(document).instances.get(instanceId)?.label : undefined);
  return (
    <div className="space-y-5">
      <InspectorHeader kind="Harness" title={harness.name}
        actions={(
          <>
            {onEditRoute && (
              <Button variant="ghost" size="icon-sm" aria-label="Edit route" title="Edit its route in 3D" onClick={() => onEditRoute(harness.id)}>
                <Spline className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Open its wires" title="Open its wires in the tray" onClick={onEditRows}>
              <PanelBottomOpen className="size-4" />
            </Button>
          </>
        )} />
      <InspectorFacts rows={[
        { label: "Wires", value: String(harness.wires.length) },
        { label: "Cut length", value: harness.cutLengthMm != null ? `${harness.cutLengthMm} mm` : <span className="text-muted-foreground">From the route</span> },
        { label: "Findings", value: findingSummary(own) },
      ]} />
      <InspectorSection title="Ends" count={harness.ends.length}>
        <ul className="text-sm">
          {harness.ends.map((end) => (
            <li key={end.id} className="flex h-8 items-center gap-2 border-b last:border-b-0">
              <span className="w-14 shrink-0 truncate font-mono text-xs text-muted-foreground">{end.mates?.port?.reference ?? "—"}</span>
              <span className="min-w-0 flex-1 truncate">{label(end.mates?.instanceId) ?? "Free end"}</span>
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground" title="Wires">
                {harness.wires.filter((wire) => wire.from.end === end.id || wire.to.end === end.id).length}
              </span>
            </li>
          ))}
        </ul>
      </InspectorSection>
      <FindingList findings={own} />
    </div>
  );
}

/** The workspace's right column: the selection, or the system when nothing is selected (D-P2-47). */
export function WorkspaceInspector(props: InspectorProps) {
  const { document, selection, findings } = props;
  const index = documentIndex(document);
  const instance = selection?.kind === "instance" ? index.instances.get(selection.id) : undefined;
  const link = selection?.kind === "link" ? index.links.get(selection.id) : undefined;
  const harness = selection?.kind === "harness" ? index.harnesses.get(selection.id) : undefined;
  return (
    <aside className="relative h-full overflow-auto p-4" aria-label="Inspector">
      {props.slot && (
        <div ref={props.slot} aria-label="3D tools"
          className="-mx-4 -mt-4 mb-4 space-y-3 border-b p-4 empty:hidden [&>*]:!w-full [&>*]:!shadow-none" />
      )}
      {instance ? (
        <div className="space-y-5">
          {props.part && <PartInspector part={props.part} />}
          <BoardDetail key={instance.id} systemId={props.systemId} document={document} instance={instance}
            canEdit={props.canEdit} canConvertModels={props.canConvertModels} onConnected={props.onSelect} />
        </div>
      ) : link ? (
        <LinkSummary document={document} link={link} findings={findings} onEditRows={props.onEditRows} />
      ) : harness ? (
        <HarnessSummary document={document} harness={harness} findings={findings} onEditRows={props.onEditRows} onEditRoute={props.onEditRoute} />
      ) : (
        <SystemOverview {...props} />
      )}
    </aside>
  );
}
