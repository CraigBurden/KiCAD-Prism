/**
 * `/system/:systemId`: one system's editor (ADR §2.7, CONTRACTS §14). A row
 * of tabs over one or two panes side by side, with selection shared between
 * them: the schematic (root and board sheets), 3D and Review. Harness and B2B
 * tabs follow in later stages.
 *
 * The open tab and the pane beside it live in the URL (`?tab=…&beside=…`),
 * so a link reopens the same view.
 */
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUp, Cable, Columns2, Maximize, MousePointer2, Plus, Redo2, Undo2, Unplug, X } from "lucide-react";
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
import { addBoardOps, type NewBoard } from "../schematic/edits";
import { RootSheetCanvas, type RootSheetHandle, type Tool } from "../schematic/root-sheet-canvas";
import { buildScene } from "../schematic/scene";
import { SelectionPanel } from "../schematic/selection-panel";
import { useSystemSession } from "../session/use-system-session";
import { ThreeDPane } from "../three-d/three-d-pane";
import { AddBoardDialog } from "./add-board-dialog";

const TABS = ["schematic", "3d", "review"] as const;
type TabId = (typeof TABS)[number];
const TAB_LABEL: Record<TabId, string> = { schematic: "Schematic", "3d": "3D", review: "Review" };

const asTab = (value: string | null, fallback: TabId | null): TabId | null =>
  (TABS as readonly string[]).includes(value ?? "") ? (value as TabId) : fallback;

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
  const tab = asTab(params.get("tab"), "schematic") as TabId;
  const beside = asTab(params.get("beside"), null);
  const sheet = params.get("sheet");
  const { session, state } = useSystemSession(systemId, user?.email ?? "");
  const { projects } = useWorkspaceData({ sessionKey: workspaceSessionKey(user) });
  const projectNames = useMemo(() => Object.fromEntries(projects.map((project) => [project.id, project.display_name || project.name])), [projects]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [tool, setTool] = useState<Tool>("select");
  const canvas = useRef<RootSheetHandle>(null);
  const boardCanvas = useRef<BoardSheetHandle>(null);
  const [addingBoard, setAddingBoard] = useState(false);
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

  const setView = (next: { tab?: TabId; beside?: TabId | null }) => {
    const out = new URLSearchParams(params);
    const nextTab = next.tab ?? tab;
    const nextBeside = next.beside === undefined ? beside : next.beside;
    out.set("tab", nextTab);
    if (nextBeside && nextBeside !== nextTab) out.set("beside", nextBeside);
    else out.delete("beside");
    setParams(out, { replace: true });
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
              <SelectionPanel key={`${single}:${record?.version}`} document={document} id={single} canEdit={canEdit} apply={apply} onRemoved={() => setSelected(new Set())} projectNames={projectNames} />
            </div>
          )}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/95 p-1 text-zinc-100 shadow-xl" role="toolbar" aria-label="Schematic tools">
            <ToolButton active={tool === "select"} onClick={() => setTool("select")} icon={MousePointer2} label="Select" />
            {canEdit && <ToolButton active={tool === "mate"} onClick={() => setTool("mate")} icon={Unplug} label="Mate" />}
            {canEdit && <ToolButton active={tool === "harness"} onClick={() => setTool("harness")} icon={Cable} label="Harness (H)" />}
            {canEdit && <ToolButton active={false} onClick={() => setAddingBoard(true)} icon={Plus} label="Add board" />}
            <ToolButton active={false} onClick={() => canvas.current?.fit()} icon={Maximize} label="Fit" />
          </div>
        </div>
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
      />
    );
  };

  return (
    <div className="flex h-app-viewport flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Button variant="ghost" size="icon" asChild aria-label="Back to the workspace">
          <Link to={record?.folderId ? `/?folder=${encodeURIComponent(record.folderId)}` : "/"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">Systems /</span>
        <span className="truncate text-sm font-semibold">{record?.name ?? "…"}</span>
        {record && (
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            v{record.version} · {state.saving ? "saving…" : "saved"}
          </span>
        )}
        <BundleChip state={state} />
        <span className="flex-1" />
        {canEdit && (
          <>
            <Button variant="ghost" size="icon" aria-label="Undo" title="Undo (⌘Z)" disabled={!state.undoStack.length || state.saving} onClick={() => run(session?.undo())}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!state.redoStack.length || state.saving} onClick={() => run(session?.redo())}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </header>
      <nav className="flex h-10 shrink-0 items-end gap-1 border-b px-2" aria-label="Views">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setView({ tab: id, beside: beside === id ? null : beside })}
            className={`flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-sm ${id === tab ? "bg-muted font-medium" : id === beside ? "bg-muted/50" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            aria-current={id === tab ? "page" : undefined}
          >
            {TAB_LABEL[id]}
            {id === "review" && openFindings > 0 && <span className="rounded-full bg-amber-500/20 px-1.5 text-[11px] text-amber-600">{openFindings}</span>}
          </button>
        ))}
        <span className="flex-1" />
        {beside ? (
          <Button variant="ghost" size="sm" onClick={() => setView({ beside: null })}>
            <X className="mr-1 h-3.5 w-3.5" /> Close {TAB_LABEL[beside]}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setView({ beside: TABS.find((id) => id !== tab && id !== "3d") ?? null })} title="Open another view beside this one">
            <Columns2 className="mr-1 h-3.5 w-3.5" /> Side by side
          </Button>
        )}
      </nav>
      <main className="flex min-h-0 flex-1">
        <section className="min-w-0 flex-1" aria-label={TAB_LABEL[tab]}>{pane(tab)}</section>
        {beside && (
          <section className="min-w-0 flex-1 border-l" aria-label={TAB_LABEL[beside]}>{pane(beside)}</section>
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

function BundleChip({ state }: { state: ReturnType<typeof useSystemSession>["state"] }) {
  const answer = state.bundleAnswer;
  if (!answer) return null;
  if (answer.state === "failed") {
    return <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive" title={answer.error}>bundle failed</span>;
  }
  if (answer.state === "building" || state.bundleStale) {
    return <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">checking…</span>;
  }
  if (answer.pending.length) {
    return <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground" title="Boards whose design bundle is still building">{answer.pending.length} board(s) building</span>;
  }
  return null;
}
