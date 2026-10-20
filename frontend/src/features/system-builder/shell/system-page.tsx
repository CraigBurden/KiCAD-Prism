/**
 * `/system/:systemId`: one system's editor (ADR §2.7, CONTRACTS §14). A row
 * of tabs over one or two panes side by side, with selection shared between
 * them: the schematic (root and board sheets), 3D, Review, and one tab per
 * opened B2B mate. Harness tabs follow in stage 4.
 *
 * The open tab, the pane beside it and the open B2B tabs live in the URL
 * (`?tab=…&beside=…&b2b=…`), so a link reopens the same view.
 */
import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowUp, Boxes, Cable, Maximize, MousePointer2, Plus, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useWorkspaceData, workspaceSessionKey } from "@/hooks/use-workspace-data";
import { canManageProjects } from "@/lib/roles";
import type { User } from "@/types/auth";

import type { SystemDocument, SystemOp } from "../model/types";
import { useScriptApi } from "../agent/use-script-api";
import { BoardSheetCanvas, type BoardSheetHandle } from "../board/board-sheet-canvas";
import { readUnfolded, writeUnfolded } from "../board/unfolded-store";
import { ReviewPane } from "../review/review-pane";
import { addBoardOps, nextSlotOp, type NewBoard } from "../schematic/edits";
import { AddBodyDialog } from "../three-d/add-body-dialog";
import { addEntryOps } from "../three-d/body-edits";
import type { PartHit } from "../three-d/part-search";
import { RootSheetCanvas, type RootSheetHandle, type Tool } from "../schematic/root-sheet-canvas";
import { buildScene } from "../schematic/scene";
import { SelectionPanel } from "../schematic/selection-panel";
import { useSystemSession } from "../session/use-system-session";
import { B2bPane } from "../b2b/b2b-pane";
import { mateTitle } from "../b2b/mate-view";
import { ThreeDPane } from "../three-d/three-d-pane";
import { AddBoardDialog } from "./add-board-dialog";
import { SystemHeader } from "./system-header";
import { ViewTabs } from "./view-tabs";

const TABS = ["schematic", "3d", "review"] as const;
type FixedTab = (typeof TABS)[number];
/** A fixed tab, or a B2B mate's tab: `b2b:<mate id>`. */
type TabId = FixedTab | `b2b:${string}`;
const TAB_LABEL: Record<FixedTab, string> = { schematic: "Schematic", "3d": "3D", review: "Review" };

const mateOfTab = (tab: TabId | null) => (tab?.startsWith("b2b:") ? tab.slice(4) : null);

/** The tab a URL value names, when it is fixed or an open B2B tab. */
const asTab = (value: string | null, open: readonly string[], fallback: TabId | null): TabId | null => {
  if ((TABS as readonly string[]).includes(value ?? "")) return value as TabId;
  const mate = value?.startsWith("b2b:") ? value.slice(4) : null;
  return mate && open.includes(mate) ? (value as TabId) : fallback;
};

/**
 * A finding's objects as the root sheet can show them: a harness's links,
 * wires and other contents are drawn as their block (ends are drawn).
 */
export function drawnSelection(document: SystemDocument, ids: ReadonlySet<string>): Set<string> {
  const out = new Set(ids);
  for (const harness of document.harnesses) {
    const inside = [harness.links, harness.wires, harness.splices, harness.cables, harness.markers].some((items) => items.some((item) => ids.has(item.id)));
    if (inside) out.add(harness.id);
  }
  return out;
}

/** Run an undo or redo, reporting a refusal. */
const run = (work: Promise<unknown> | undefined) =>
  void work?.catch((error: unknown) => toast.error(error instanceof Error ? error.message : String(error)));

export function SystemPage({ user }: { user: User | null }) {
  const { systemId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openMates = (params.get("b2b") ?? "").split(",").filter(Boolean);
  const tab = asTab(params.get("tab"), openMates, "schematic") as TabId;
  const beside = asTab(params.get("beside"), openMates, null);
  const sheet = params.get("sheet");
  const { session, state } = useSystemSession(systemId, user?.email ?? "");
  const { projects } = useWorkspaceData({ sessionKey: workspaceSessionKey(user) });
  const projectNames = useMemo(() => Object.fromEntries(projects.map((project) => [project.id, project.display_name || project.name])), [projects]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [tool, setTool] = useState<Tool>("select");
  const canvas = useRef<RootSheetHandle>(null);
  const boardCanvas = useRef<BoardSheetHandle>(null);
  const [addingBoard, setAddingBoard] = useState(false);
  const [placingSystem, setPlacingSystem] = useState(false);
  // The B2B tab's selected row, lit on both boards in the 3D tab.
  const [lit, setLit] = useState<{ key: string; members: { occurrence: string; net: string }[]; parts: { occurrence: string; reference: string }[] } | null>(null);
  // Unfolded connectors per board: per user and system, in browser storage (§14.1).
  const [unfoldedMap, setUnfoldedMap] = useState<Record<string, Set<string>>>({});
  const unfoldedFor = (occurrence: string) => unfoldedMap[occurrence] ?? readUnfolded(systemId, occurrence);
  const setUnfoldedFor = (occurrence: string, next: Set<string>) => {
    writeUnfolded(systemId, occurrence, next);
    setUnfoldedMap((current) => ({ ...current, [occurrence]: next }));
  };

  const record = state.record;
  const document = record?.document;
  const canEdit = canManageProjects(user?.role) && Boolean(record);
  const findings = state.bundle?.findings ?? [];
  const openFindings = findings.filter((finding) => !finding.waived && finding.severity !== "info").length;

  const apply = (ops: SystemOp[]) => {
    if (!session) return Promise.reject(new Error("The system is not loaded yet"));
    return session.apply(ops);
  };

  useScriptApi(session, state, {
    open: (occurrence) => openSheet(occurrence),
    select: (ids) => setSelected(new Set(ids)),
    unfold: (occurrence, connector, unfolded) => {
      const next = new Set(unfoldedFor(occurrence));
      if (unfolded) next.add(connector);
      else next.delete(connector);
      setUnfoldedFor(occurrence, next);
    },
    isUnfolded: (occurrence, connector) => unfoldedFor(occurrence).has(connector),
    openMate: (mate) => openMate(mate),
  });

  useHotkeys([
    { combo: "mod+z", handler: () => run(session?.undo()) },
    { combo: "mod+shift+z", handler: () => run(session?.redo()) },
  ], { enabled: canEdit });

  const openSheet = (occurrence: string | null) => {
    const out = new URLSearchParams(params);
    if (occurrence) out.set("sheet", occurrence);
    else out.delete("sheet");
    setParams(out);
    if (occurrence) setSelected(new Set());
  };

  const setView = (next: { tab?: TabId; beside?: TabId | null; mates?: string[] }) => {
    const out = new URLSearchParams(params);
    const nextTab = next.tab ?? tab;
    const nextBeside = next.beside === undefined ? beside : next.beside;
    const mates = next.mates ?? openMates;
    out.set("tab", nextTab);
    if (nextBeside && nextBeside !== nextTab) out.set("beside", nextBeside);
    else out.delete("beside");
    if (mates.length) out.set("b2b", mates.join(","));
    else out.delete("b2b");
    setParams(out, { replace: true });
  };

  /** Open a mate's B2B tab beside the 3D tab (mockup 04). */
  const openMate = (mate: string) => {
    const mates = openMates.includes(mate) ? openMates : [...openMates, mate];
    setView({ tab: `b2b:${mate}`, beside: "3d", mates });
  };
  const closeMate = (mate: string) => {
    const mates = openMates.filter((item) => item !== mate);
    const gone = (id: TabId | null) => id === `b2b:${mate}`;
    setView({ tab: gone(tab) ? (gone(beside) ? "schematic" : beside ?? "schematic") : tab, beside: gone(beside) || gone(tab) ? null : beside, mates });
    setLit(null);
  };
  const tabLabel = (id: TabId) => {
    const mate = mateOfTab(id);
    return mate ? `B2B ${document ? mateTitle(document, mate) : mate}` : TAB_LABEL[id as FixedTab];
  };

  const addBoard = async (board: NewBoard) => {
    if (!document) return;
    const scene = buildScene(document, state.bundle, { projectNames });
    const { ops, occurrence } = addBoardOps(document, scene, board);
    await apply(ops);
    setAddingBoard(false);
    setSelected(new Set([occurrence]));
    // After the new document has drawn, so the fit includes the new board.
    requestAnimationFrame(() => canvas.current?.fit());
  };

  const placeSystem = async (system: PartHit) => {
    if (!document) return;
    const scene = buildScene(document, state.bundle, { projectNames });
    const { ops, occurrence } = addEntryOps(document, system);
    await apply([...ops, nextSlotOp(scene, occurrence)]);
    setPlacingSystem(false);
    setSelected(new Set([occurrence]));
    requestAnimationFrame(() => canvas.current?.fit());
  };

  if (state.loadError) {
    return (
      <div className="flex h-app-viewport flex-col items-center justify-center gap-3 bg-background text-sm">
        <p className="text-destructive">{state.loadError}</p>
        <Button variant="outline" onClick={() => navigate("/")}>Back to the workspace</Button>
      </div>
    );
  }

  const single = selected.size === 1 ? [...selected][0] : null;
  const pane = (id: TabId) => {
    if (!document) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
    const sheetOccurrence = sheet ? document.occurrences.find((item) => item.id === sheet) : undefined;
    if (id === "schematic" && sheetOccurrence) {
      return (
        <div className="relative flex h-full flex-col">
          <div className="flex h-8 shrink-0 items-center gap-1.5 border-b bg-[#f5f4ef] px-3 text-xs text-zinc-600">
            <button type="button" className="hover:underline" onClick={() => openSheet(null)}>{record?.name ?? "Root"}</button>
            <span>›</span>
            <span className="font-medium text-zinc-900">{sheetOccurrence.label}</span>
            <span className="ml-2 text-zinc-500">Alt/⌥+Backspace to leave</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <BoardSheetCanvas
              ref={boardCanvas}
              key={sheetOccurrence.id}
              unfolded={unfoldedFor(sheetOccurrence.id)}
              onUnfoldedChange={(next) => setUnfoldedFor(sheetOccurrence.id, next)}
              document={document}
              bundle={state.bundle}
              occurrence={sheetOccurrence.id}
              canEdit={canEdit}
              apply={apply}
              onLeave={() => openSheet(null)}
            />
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/95 p-1 text-zinc-100 shadow-xl" role="toolbar" aria-label="Sheet tools">
              <ToolButton active={false} onClick={() => openSheet(null)} icon={ArrowUp} label="Up (⌥⌫)" />
              <ToolButton active={false} onClick={() => boardCanvas.current?.fit()} icon={Maximize} label="Fit" />
            </div>
          </div>
        </div>
      );
    }
    if (id === "schematic") {
      return (
        <div className="relative h-full">
          <RootSheetCanvas
            document={document}
            bundle={state.bundle}
            projectNames={projectNames}
            selected={selected}
            onSelect={setSelected}
            canEdit={canEdit}
            apply={apply}
            tool={tool}
            onToolChange={setTool}
            ref={canvas}
            onEnter={(occurrence) => openSheet(occurrence)}
          />
          {single && (
            <div className="absolute right-3 top-3">
              <SelectionPanel key={`${single}:${record?.version}`} document={document} id={single} canEdit={canEdit} apply={apply} onRemoved={() => setSelected(new Set())} projectNames={projectNames} onOpenMate={openMate} />
            </div>
          )}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/95 p-1 text-zinc-100 shadow-xl" role="toolbar" aria-label="Schematic tools">
            <ToolButton active={tool === "select"} onClick={() => setTool("select")} icon={MousePointer2} label="Select" />
            {canEdit && <ToolButton active={tool === "mate"} onClick={() => setTool("mate")} icon={Unplug} label="Mate" />}
            {canEdit && <ToolButton active={tool === "harness"} onClick={() => setTool("harness")} icon={Cable} label="Harness (H)" />}
            {canEdit && <ToolButton active={false} onClick={() => setAddingBoard(true)} icon={Plus} label="Add board" />}
            {canEdit && <ToolButton active={false} onClick={() => setPlacingSystem(true)} icon={Boxes} label="Place system" />}
            <ToolButton active={false} onClick={() => canvas.current?.fit()} icon={Maximize} label="Fit" />
          </div>
        </div>
      );
    }
    const mate = mateOfTab(id);
    if (mate) {
      return (
        <B2bPane
          key={mate}
          document={document}
          bundle={state.bundle ?? null}
          mate={mate}
          canEdit={canEdit}
          busy={state.saving}
          apply={apply}
          onRow={(row, view) => {
            if (!row) return setLit(null);
            const members = [
              ...(row.aNet ? [{ occurrence: view.a.occurrence, net: row.aNet }] : []),
              ...(row.bNet ? [{ occurrence: view.b.occurrence, net: row.bNet }] : []),
            ];
            setLit({ key: `b2b:${mate}:${row.aPad ?? ""}:${row.bPad ?? ""}`, members, parts: [{ occurrence: view.a.occurrence, reference: view.a.connector }, { occurrence: view.b.occurrence, reference: view.b.connector }] });
          }}
        />
      );
    }
    if (id === "review") {
      return (
        <ReviewPane
          document={document}
          answer={state.bundleAnswer}
          findings={findings}
          stale={state.bundleStale}
          canEdit={canEdit}
          apply={apply}
          onSelect={(ids) => {
            setSelected(drawnSelection(document, ids));
            if (tab !== "schematic" && beside !== "schematic") setView({ beside: "schematic" });
          }}
        />
      );
    }
    return (
      <ThreeDPane
        document={document}
        bundle={state.bundle ?? null}
        projectNames={projectNames}
        selected={selected}
        onSelect={setSelected}
        canEdit={canEdit}
        busy={state.saving}
        apply={apply}
        lit={lit}
        onOpenMate={openMate}
      />
    );
  };

  return (
    <div className="flex h-app-viewport flex-col bg-background text-foreground">
      <SystemHeader
        name={record?.name}
        folderId={record?.folderId}
        version={record?.version}
        state={state}
        canEdit={canEdit}
        onUndo={() => run(session?.undo())}
        onRedo={() => run(session?.redo())}
      />
      <ViewTabs
        tabs={[...TABS, ...openMates.map((mate) => `b2b:${mate}` as TabId)].map((id) => ({
          id,
          label: tabLabel(id),
          b2b: Boolean(mateOfTab(id)),
          count: id === "review" ? openFindings : 0,
        }))}
        tab={tab}
        beside={beside}
        besideLabel={beside ? tabLabel(beside) : null}
        onPick={(id) => setView({ tab: id as TabId, beside: beside === id ? null : beside })}
        onClose={(id) => closeMate(mateOfTab(id as TabId) as string)}
        onCloseBeside={() => setView({ beside: null })}
        onSideBySide={() => setView({ beside: TABS.find((id) => id !== tab && id !== "3d") ?? null })}
      />
      <main className="flex min-h-0 flex-1">
        <section className="min-w-0 flex-1" aria-label={tabLabel(tab)}>{pane(tab)}</section>
        {beside && (
          <section className="min-w-0 flex-1 border-l" aria-label={tabLabel(beside)}>{pane(beside)}</section>
        )}
      </main>
      {addingBoard && (
        <AddBoardDialog
          projects={projects}
          existingLabels={document?.occurrences.map((item) => item.label) ?? []}
          onClose={() => setAddingBoard(false)}
          onAdd={addBoard}
        />
      )}
      {placingSystem && <AddBodyDialog adding="entry" onClose={() => setPlacingSystem(false)} onAdd={placeSystem} />}
    </div>
  );
}

function ToolButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Plus; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs ${active ? "bg-white/15 text-white" : "text-zinc-300 hover:bg-white/10"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
