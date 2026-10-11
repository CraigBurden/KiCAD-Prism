import { Archive, ArrowLeft, Camera, GitBranch, ListTree, PanelRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SystemDocument } from "@/types/system";

import { shortSha, timeAgo } from "../system-format";
import { sessionReads } from "../session/session-reads";
import { useSessionRead } from "../session/use-system-session";
import { WORKSPACE_VIEWS, type WorkspaceView } from "./workspace-state";

interface TopBarProps {
  document: SystemDocument;
  view: WorkspaceView;
  canEdit: boolean;
  onBack: () => void;
  onView: (view: WorkspaceView) => void;
  onFindings: () => void;
  onHistory: () => void;
  onTakeSnapshot: () => void;
  /** Below `lg` the outline and the inspector are sheets these open. */
  onOutline: () => void;
  onInspector: () => void;
  /** False without WebGPU: the 3D view is unavailable and the Diagram stands in. */
  has3d: boolean;
}


/** SB2-117: open errors and warnings inside the subsystems, as their pinned snapshots froze them. */
export function childFindingCounts(document: SystemDocument): { error: number; warning: number } {
  const total = { error: 0, warning: 0 };
  for (const instance of document.instances) {
    const found = instance.kind === "assembly" ? instance.catalog?.findingCounts : null;
    if (found) {
      total.error += found.error;
      total.warning += found.warning;
    }
  }
  return total;
}

/** The workspace's top bar (PLAN M8): the system, the view switch, its state and Take snapshot. */
export function WorkspaceTopBar({ document, view, canEdit, onBack, onView, onFindings, onHistory, onTakeSnapshot, onOutline, onInspector, has3d }: TopBarProps) {
  const { system } = document;
  const counts = document.findingCounts;
  const inChildren = childFindingCounts(document);
  // SB2-98: edits leave the git link and latest snapshot alone; the session re-reads them after a snapshot, publish or git action.
  const repository = useSessionRead(sessionReads.repository()).data ?? null;
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:gap-3 md:gap-5 md:px-4">
      <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to the workspace"><ArrowLeft className="size-4" /></Button>
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onOutline} aria-label="Outline"><ListTree className="size-4" /></Button>
      <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none">
        <span className="hidden text-sm text-muted-foreground sm:inline">Systems</span>
        <span className="hidden text-sm text-muted-foreground sm:inline">/</span>
        <h1 className="truncate text-base font-semibold">{system.name}</h1>
        {system.archivedAt && (
          <Badge variant="secondary" title="Kept because parent systems or the catalog still reference it"><Archive /> Archived · read-only</Badge>
        )}
      </div>
      <div role="tablist" aria-label="View" className="flex shrink-0 gap-0.5 rounded-md border p-0.5">
        {WORKSPACE_VIEWS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => onView(item.id)}
            disabled={item.id === "3d" && !has3d} title={item.id === "3d" && !has3d ? "Needs WebGPU, which this browser does not provide" : undefined}
            className={cn("rounded px-2 py-1 text-xs disabled:opacity-40 sm:px-3",
              view === item.id ? "bg-accent font-semibold" : "text-muted-foreground enabled:hover:text-foreground")}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="hidden flex-1 md:block" />
      <div className="hidden items-center gap-4 text-xs text-muted-foreground md:flex">
        <button type="button" onClick={onFindings} className="flex items-center gap-1.5 hover:text-foreground" aria-label="Open the findings">
          {counts ? (
            <>
              <span className={cn("size-1.5 rounded-full", counts.error ? "bg-destructive" : counts.warning ? "bg-warning" : "bg-success")} />
              <span className="text-foreground">{counts.error} {counts.error === 1 ? "error" : "errors"}</span>
              <span>· {counts.warning} {counts.warning === 1 ? "warning" : "warnings"}</span>
            </>
          ) : <span>Not evaluated</span>}
        </button>
        {inChildren.error + inChildren.warning > 0 && (
          <span className={cn("hidden lg:inline", inChildren.error && "text-destructive")}
            title="Open in the subsystems' snapshots this system uses; open a subsystem to see them">
            + {inChildren.error ? `${inChildren.error} ${inChildren.error === 1 ? "error" : "errors"}` : `${inChildren.warning} ${inChildren.warning === 1 ? "warning" : "warnings"}`} in subsystems
          </span>
        )}
        {repository?.git && (
          <button type="button" onClick={onHistory} className="hidden items-center gap-1.5 hover:text-foreground xl:flex" title={repository.git.url}>
            <GitBranch className="size-3.5" />
            <span className="font-mono text-foreground">{repository.git.branch}</span>
            {repository.git.tip && <span className="font-mono">@ {shortSha(repository.git.tip)}</span>}
            {repository.git.outsideCommit && <span className="text-warning">changed outside Prism</span>}
          </button>
        )}
        {repository?.snapshot && (
          <button type="button" onClick={onHistory} className="hidden items-center gap-1.5 hover:text-foreground lg:flex"
            title="Last snapshot" aria-label={`Last snapshot ${repository.snapshot.name}, ${timeAgo(repository.snapshot.createdAt)}`}>
            <Camera className="size-3.5" />
            {repository.snapshot.name} · {timeAgo(repository.snapshot.createdAt)}
          </button>
        )}
      </div>
      {canEdit && <Button size="sm" onClick={onTakeSnapshot}><Camera className="size-4" /> <span className="hidden sm:inline">Take snapshot</span></Button>}
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onInspector} aria-label="Details"><PanelRight className="size-4" /></Button>
    </header>
  );
}
