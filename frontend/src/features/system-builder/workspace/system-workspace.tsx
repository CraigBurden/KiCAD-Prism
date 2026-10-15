import { Suspense, lazy, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { ResizablePanel } from "@/components/ui/resizable-panel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { canWriteCatalog } from "@/lib/roles";

import { AddBoardDialog, addBoards } from "../add-board-dialog";
import { AddPartDialog } from "../add-part-dialog";
import { AddSubsystemDialog } from "../subsystem-detail";
import type { SystemTabProps } from "../system-tab-content";
import type { SystemTab } from "../system-tabs";
import { useSystemSession } from "../session/use-system-session";
import { IcdView } from "./icd-view";
import type { PartDetail } from "./part-detail";
import { rootInstanceOf } from "./use-viewer-selection-sync";
import { webgpuAvailable } from "../scene-3d-model";
import { useValidation } from "./use-validation";
import { WorkspaceInspector } from "./workspace-inspector";
import { WorkspaceOutline, type AddKind } from "./workspace-outline";
import { migrateLegacyTab, type TrayTab, type WorkspaceSelection, type WorkspaceState, type WorkspaceView } from "./workspace-state";
import { WorkspaceTopBar } from "./workspace-top-bar";
import { WorkspaceTray } from "./workspace-tray";

// The canvas library and the viewer load only when their view opens.
const DiagramTab = lazy(() => import("../diagram-tab").then((module) => ({ default: module.DiagramTab })));
const Scene3dTab = lazy(() => import("../scene-3d-tab").then((module) => ({ default: module.Scene3dTab })));

interface WorkspaceProps extends Omit<SystemTabProps, "onNavigate"> {
  state: WorkspaceState;
  importing: boolean;
  onState: (next: WorkspaceState) => void;
  onImporting: (open: boolean) => void;
  onBack: () => void;
}

const LARGE = "(min-width: 1024px)";

/** Whether the outline and the inspector are columns (`lg` and up) rather than sheets. */
function useLargeScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia?.(LARGE);
      query?.addEventListener("change", onChange);
      return () => query?.removeEventListener("change", onChange);
    },
    () => window.matchMedia?.(LARGE).matches ?? true,
  );
}

function Loading({ what }: { what: string }) {
  return <div className="p-6 text-sm text-muted-foreground">Loading {what}…</div>;
}

/**
 * The System Builder workspace (PLAN M8, D-P2-47): a top bar, the outline, the
 * view in the centre, the inspector, and the tray that holds what used to be
 * the Connections, Changes and History tabs.
 */
export function SystemWorkspace({ state, importing, onState, onImporting, onBack, ...props }: WorkspaceProps) {
  const { systemId, document, canEdit } = props;
  const { findings } = useValidation(document);
  const { busy, edit } = useSystemSession();
  const [adding, setAdding] = useState<AddKind | null>(null);
  const [sheet, setSheet] = useState<"outline" | "inspector" | null>(null);
  const [takeRequest, setTakeRequest] = useState(0);
  const [part, setPart] = useState<PartDetail | null>(null);
  const [routeRequest, setRouteRequest] = useState(0);
  const [inspectorSlot, setInspectorSlot] = useState<HTMLElement | null>(null);
  const [netsSlot, setNetsSlot] = useState<HTMLElement | null>(null);
  const large = useLargeScreen();
  // Without WebGPU the Diagram stands in for the 3D view (SB2-65).
  const [has3d] = useState(webgpuAvailable);
  // An empty system has nothing to draw in 3D: it opens on the Diagram, where boards are added and connected (SB2-118).
  const shown = state.view === "3d" && (!has3d || document.instances.length === 0) ? "diagram" : state.view;

  const update = (patch: Partial<WorkspaceState>) => onState({ ...state, ...patch });
  const select = (selection: WorkspaceSelection | null) => {
    setSheet(null);
    // SB2-112: a row to show opens the link's rows in the tray, in the same update.
    update(selection?.row || selection?.edit ? { selection, tray: "connections" } : { selection });
  };
  const setTray = (tray: TrayTab | null) => {
    if (tray !== "history") setTakeRequest(0);
    update({ tray });
  };
  // The components that still speak in old tabs (the diagram, Changes, import) navigate through this.
  const onNavigate = (tab: SystemTab, params: Record<string, string> = {}) => {
    const migrated = migrateLegacyTab(new URLSearchParams({ tab, ...params }));
    if (!migrated) return;
    if (migrated.importing) onImporting(true);
    onState({
      view: tab === "diagram" ? "diagram" : state.view,
      tray: migrated.state.tray ?? state.tray,
      selection: migrated.state.selection ?? state.selection,
    });
  };
  const tabProps: SystemTabProps = { ...props, onNavigate, selection: state.selection, onSelect: select, onPart: setPart,
    inspectorSlot: large ? inspectorSlot : null, netsSlot: state.tray === "nets" ? netsSlot : null, onOpenTray: setTray, routeRequest };
  // The picked part shows while its board (or the subsystem holding it) is the selection.
  const shownPart = part && state.selection?.kind === "instance" && rootInstanceOf(part.selection.occurrence) === state.selection.id ? part : null;

  const outline = (
    <WorkspaceOutline document={document} findings={findings} selection={state.selection} canEdit={canEdit}
      onSelect={select} onAdd={setAdding} />
  );
  const inspector = (slot?: (node: HTMLElement | null) => void) => (
    <WorkspaceInspector slot={slot} systemId={systemId} document={document} canEdit={canEdit} findings={findings}
      canConvertModels={canWriteCatalog(props.user?.role)}
      selection={state.selection} part={shownPart} onSelect={select}
      onEditRows={() => { setSheet(null); update({ tray: "connections" }); }}
      onEditRoute={has3d && canEdit ? (harnessId) => {
        setSheet(null);
        setRouteRequest((count) => count + 1);
        onState({ ...state, view: "3d", selection: { kind: "harness", id: harnessId } });
      } : undefined} />
  );

  const view = (current: WorkspaceView) => {
    switch (current) {
      case "diagram":
        return <Suspense fallback={<Loading what="the diagram" />}><DiagramTab {...tabProps} /></Suspense>;
      case "icd":
        return <IcdView systemId={systemId} />;
      default:
        return <Suspense fallback={<Loading what="the 3D view" />}><Scene3dTab {...tabProps} /></Suspense>;
    }
  };

  return (
    <div className="flex h-app-viewport flex-col bg-background">
      <WorkspaceTopBar document={document} view={shown} canEdit={canEdit} has3d={has3d}
        onBack={onBack} onView={(next) => update({ view: next })}
        onFindings={() => setTray("findings")} onHistory={() => setTray("history")}
        onTakeSnapshot={() => { setTakeRequest((count) => count + 1); update({ tray: "history" }); }}
        onOutline={() => setSheet("outline")} onInspector={() => setSheet("inspector")} />
      <div className="flex min-h-0 flex-1">
        <ResizablePanel side="left" storageKey="prism.system-workspace.outline-width" defaultWidth={256} minWidth={200} maxWidth={480}
          aria-label="Outline panel" className="hidden lg:flex">
          {outline}
        </ResizablePanel>
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="relative min-h-0 flex-1 overflow-hidden">{view(shown)}</main>
          <WorkspaceTray {...tabProps} tab={state.tray} findings={findings} selection={state.selection}
            importing={importing} takeRequest={takeRequest} onTab={setTray} onSelect={select} onImporting={onImporting}
            view={shown} onNetsSlot={setNetsSlot} />
        </div>
        <ResizablePanel side="right" storageKey="prism.system-workspace.inspector-width" defaultWidth={352} minWidth={280} maxWidth={720}
          aria-label="Inspector panel" className="hidden lg:flex">
          {inspector(setInspectorSlot)}
        </ResizablePanel>
      </div>

      <Sheet open={sheet !== null} onOpenChange={(open) => { if (!open) setSheet(null); }}>
        <SheetContent side={sheet === "outline" ? "left" : "right"} className="w-[22rem] p-0">
          <SheetHeader className="sr-only"><SheetTitle>{sheet === "outline" ? "Outline" : "Details"}</SheetTitle></SheetHeader>
          {sheet === "outline" ? outline : inspector()}
        </SheetContent>
      </Sheet>

      {(adding === "subsystem" || adding === "module") && (
        <AddSubsystemDialog
          kind={adding === "module" ? "module" : "assembly"}
          existingLabels={document.instances.map((instance) => instance.label)}
          busy={busy === "add"}
          onClose={() => setAdding(null)}
          onSubmit={async (value) => {
            const created = await edit("add", (system) => system.addCatalogInstance(adding === "module" ? "module" : "assembly", value),
              `Added ${value.label}`);
            if (created) {
              setAdding(null);
              select({ kind: "instance", id: created.body.id });
            }
          }}
        />
      )}
      {adding === "part" && (
        <AddPartDialog
          existingLabels={document.instances.map((instance) => instance.label)}
          busy={busy === "add"}
          onClose={() => setAdding(null)}
          onSubmit={async (value) => {
            const created = await edit("add", (system) => system.addCatalogInstance("part", value), `Added ${value.label}`);
            if (created) {
              setAdding(null);
              select({ kind: "instance", id: created.body.id });
            }
          }}
        />
      )}
      {adding === "board" && (
        <AddBoardDialog
          user={props.user}
          existingLabels={document.instances.map((instance) => instance.label)}
          busy={busy === "add"}
          onClose={() => setAdding(null)}
          onSubmit={async (boards) => {
            const outcome = await edit("add", (system) => addBoards(system, boards),
              boards.length === 1 ? `Added ${boards[0].label.trim()}` : undefined);
            if (!outcome) return boards.map((board) => ({ board, error: "Not added" }));
            if (boards.length > 1 && outcome.added.length) toast.success(`Added ${outcome.added.length} of ${boards.length} boards`);
            if (!outcome.failures.length) {
              setAdding(null);
              if (outcome.added.length === 1) select({ kind: "instance", id: outcome.added[0] });
            }
            return outcome.failures;
          }}
        />
      )}
    </div>
  );
}
