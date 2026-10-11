import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Activity, Box, Cable, Keyboard, Loader2, Maximize, MousePointer2, Move3d, Search, Spline, Tag } from "lucide-react";

import { DesignSearchField } from "@/components/design-search-field";
import { Semantic3dControls } from "@/components/semantic-3d-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { selectionFromDesignSearchHit, type DesignSearchHit } from "@/lib/design-search";
import { SemanticViewer, useSemanticViewer } from "@/lib/semantic-viewer";
import { useCommittedRef } from "@/hooks/use-committed-ref";
import { cn } from "@/lib/utils";
import type { PrismSystemViewerSelection } from "@/types/prism-semantic-viewer";
import type { SystemScene } from "@/types/system";

import { CollisionCheckButton } from "./collision-check-button";
import { sessionReads } from "./session/session-reads";
import { useSessionRead, useSystemSession } from "./session/use-system-session";
import { StepExportButton } from "./step-export-button";
import { drawnBoards, failedNotice, names, scenePollDelay, summarizeScene, webgpuAvailable } from "./scene-3d-model";
import { HarnessPanel } from "./scene-harness-panel";
import { MovePanel } from "./scene-move-panel";
import { TRACE_KEY, emphasisSets, netBoards, traceSet } from "./scene-net-model";
import { NetPanel } from "./scene-net-panel";
import { hitOccurrence, searchBoards, type SceneSearchHit, type SearchableBoard } from "./scene-search";
import { TraceCard } from "./scene-trace-card";
import { useBoardIndexes, type BoardIndexState } from "./use-board-indexes";
import { useHarnessNodes } from "./use-harness-nodes";
import { useMoveMode } from "./use-move-mode";
import { useNetHighlight } from "./use-net-highlight";
import { useSystemNetIndex } from "./use-system-net-index";
import { useTracedNet } from "./use-traced-net";
import { FloatingToolbar } from "./workspace/floating-toolbar";
import type { PartDetail } from "./workspace/part-detail";
import { ToolbarButton } from "./workspace/toolbar-button";
import { useViewerSelectionSync } from "./workspace/use-viewer-selection-sync";
import type { SystemTabProps } from "./system-tab-content";



function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "error"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs",
        tone === "info" && "border-border bg-muted/40 text-muted-foreground",
        tone === "warning" && "border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
        tone === "error" && "border-destructive/40 bg-destructive/5 text-destructive",
      )}
    >
      {children}
    </p>
  );
}

/** Whether the search is open, and whether it has been: the system nets are read once it first opens (SB2-98). */
function useSearchOpen() {
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const openSearch = () => {
    setSearching(true);
    setSearched(true);
  };
  return { searching, searched, setSearching, openSearch };
}

/** The scene, read on open and when the scene key moves (SB2-98), and again while bundles build or boxes are unknown. */
function useSystemScene(enabled: boolean) {
  const { session } = useSystemSession();
  const spec = sessionReads.scene();
  const read = useSessionRead(enabled ? spec : null);
  const scene = read.data ?? null;
  useEffect(() => {
    const delay = scene ? scenePollDelay(scene) : null;
    if (!delay) return;
    const timer = setTimeout(() => session.refresh(spec.key), delay);
    return () => clearTimeout(timer);
  }, [scene, session, spec.key]);
  const error = read.error ? (read.error instanceof Error ? read.error.message : "Could not load the 3D scene") : null;
  return { scene, error };
}

/** Report the part, pad or board net picked on a board to the workspace inspector (PLAN M8). */
function usePartReport(
  viewer: SemanticViewer,
  scene: SystemScene | null,
  indexes: ReadonlyMap<string, BoardIndexState>,
  selection: PrismSystemViewerSelection | null,
  onPart: ((part: PartDetail | null) => void) | undefined,
) {
  const occurrence = selection && selection.kind !== "board" ? selection.occurrence : undefined;
  const board = occurrence ? scene?.occurrences.find((item) => item.path === occurrence) : undefined;
  const index = board?.assetId ? indexes.get(board.assetId) ?? null : null;
  useEffect(() => {
    if (!onPart) return;
    if (!selection || selection.kind === "board" || !occurrence || !board) {
      onPart(null);
      return;
    }
    onPart({
      selection: { ...selection, occurrence },
      boardName: board.displayPath,
      index,
      clear: () => {
        viewer.select({ kind: "board", sourceContext: "3D", occurrence });
      },
    });
  }, [viewer, selection, occurrence, board, index, onPart]);
  // Leaving the 3D view drops the part.
  useEffect(() => () => onPart?.(null), [onPart]);
}

/**
 * CONTRACTS_P2 §20.6 / SB2-31e.2: the board 3D tab with every board of the
 * system (D-P2-25). The 3D tab's own viewer, left rail (a Layers section per
 * board) and the workspace inspector (PLAN M8: no overlay inspector), a search over
 * every board, and the system nets. Restricted boards and boards still
 * building are boxes. Without WebGPU, the 2D diagram with a notice.
 */
export function Scene3dTab(props: SystemTabProps) {
  const { systemId, document, canEdit, selection: workspaceSelection = null, onSelect, onPart } = props;
  const { etag } = useSystemSession();
  const { inspectorSlot = null, netsSlot = null, onOpenTray, routeRequest = 0 } = props;
  const supported = webgpuAvailable();
  // SB2-98: the scene and the system nets are re-read when what they depend on changes, not every version.
  const netsKey = document.netsKey ?? etag ?? "";
  const { scene, error } = useSystemScene(supported);
  // The element, its reports and the selection both ways (lib/semantic-viewer.ts).
  const [viewer] = useState(() => new SemanticViewer());
  const { element, selection, viewState, error: viewerError } = useSemanticViewer(viewer);
  const [leftInset, setLeftInset] = useState(0);
  const [stats, setStats] = useState(false);
  const [labels, setLabels] = useState(true);
  const [harnesses, setHarnesses] = useState(true);
  const { searching, searched, setSearching, openSearch } = useSearchOpen();
  const [scopeOpen, setScopeOpen] = useState(false);
  const moving = useMoveMode(viewer, scene);
  const { move } = moving;
  const route = useHarnessNodes(viewer, scene);
  const nets = useNetHighlight(systemId, netsKey);
  const { highlighted } = nets;
  const reportSelection = useViewerSelectionSync(viewer, scene, document, workspaceSelection, onSelect);
  // What the viewer lit, as it reports it.
  const reportEmphasis = useCommittedRef(nets.report);
  useEffect(() => {
    const off = viewer.on("emphasis", (results) => reportEmphasis.current(results));
    return () => off();
  }, [reportEmphasis, viewer]);
  // The workspace inspector shows what is picked (PLAN M8): the viewer only reports it.
  const indexes = useBoardIndexes(scene);
  usePartReport(viewer, scene, indexes, selection, onPart);
  const { traced, light } = useTracedNet(selection);
  // The clicked trace's system net lights first, in the selection green (D-P2-28).
  const tracedNet = traced?.net && !traced.waiting ? traced.net : null;
  const traceEmphasis = useMemo(() => (tracedNet ? traceSet(tracedNet) : null), [tracedNet]);

  useEffect(() => {
    if (element && scene) viewer.setSystemScene(scene);
  }, [element, scene, viewer]);

  // The inspector's Edit route (D-P2-51): Route mode once the scene is in the viewer.
  useEffect(() => {
    if (element && scene && routeRequest) viewer.requestMoveMode(true, { route: true });
  }, [element, scene, routeRequest, viewer]);

  // The net added last is framed once, so a few-millimetre trace is not lost in the whole system.
  const framedNet = useRef<string | null>(null);
  useEffect(() => {
    if (!element) return;
    void viewer.setNetEmphasis([...(traceEmphasis ? [traceEmphasis] : []), ...emphasisSets(highlighted)]).then((report) => {
      if (report) reportEmphasis.current(report);
      // As the board 3D tab frames a selected net: close, on the first board it reaches.
      const newest = highlighted.at(-1) ?? null;
      if (newest && newest.groupId !== framedNet.current) {
        viewer.frameNetEmphasis(newest.groupId, netBoards(newest).boards[0]?.occurrence ?? null);
      }
      framedNet.current = newest?.groupId ?? null;
    });
  }, [element, highlighted, reportEmphasis, traceEmphasis, viewer]);

  const boards = useMemo(() => (scene ? drawnBoards(scene) : []), [scene]);
  const searchable = useMemo<SearchableBoard[]>(() => boards.flatMap((board) => {
    const index = board.assetId ? indexes.get(board.assetId)?.index : null;
    return index ? [{ occurrence: board.path, name: board.displayPath, index }] : [];
  }), [boards, indexes]);
  // SB2-33: search every board or one; a net crossing boards is one result for its system net.
  const systemNets = useSystemNetIndex(searched);
  const [searchBoard, setSearchBoard] = useState<string | null>(null);
  const scope = searchBoard && boards.some((board) => board.path === searchBoard) ? searchBoard : null;
  const search = useCallback(
    (query: string) => searchBoards(searchable, query, { board: scope, systemNets }),
    [searchable, scope, systemNets],
  );
  const pick = (picked: DesignSearchHit, options?: { additive: boolean }) => {
    const hit = picked as SceneSearchHit;
    // Shift adds a system net to the highlighted set, in the next colour (D-P2-19).
    if (options?.additive && hit.systemNet) {
      void nets.add(hit.systemNet);
      onOpenTray?.("nets");
      return;
    }
    const occurrence = hit.target?.occurrence ?? hitOccurrence(hit);
    const picked3d = hit.target ? null : selectionFromDesignSearchHit(hit, "3D", null);
    const selection = hit.target
      ? { kind: "net" as const, sourceContext: "3D" as const, netName: hit.target.net, occurrence }
      : picked3d?.kind === "component" ? { ...picked3d, occurrence } : null;
    if (!selection) return;
    // A net selection traces its system net (SB2-32).
    viewer.select(selection);
    reportSelection(selection);
  };

  if (!supported) {
    return (
      // The workspace shows the Diagram instead (SB2-65); this only guards a direct mount.
      <div className="p-4"><Notice tone="warning">The 3D view needs WebGPU.</Notice></div>
    );
  }

  const summary = scene ? summarizeScene(scene) : null;
  // The move, route and trace panels: the top of the inspector on large screens, over the view otherwise.
  const movePanel = move?.enabled && !move.route && (move.target || !route.state) ? (
    <MovePanel
      key={moving.epoch}
      state={move}
      busy={moving.busy}
      onPreview={(pose) => viewer.previewPose(pose)}
      onSave={(target) => void moving.savePose(target)}
      onCancel={() => viewer.cancelMove()}
      moved={moving.moved}
      onRevert={() => void moving.revert()}
      onDefault={(target) => void moving.backToDefault(target)}
      onResetAll={() => moving.setConfirmReset(true)}
      onSpace={(space) => viewer.setMoveSpace(space)}
      mate={moving.mate}
      stackSize={moving.stack?.members.length ?? 0}
      pending={moving.pending}
      onBreakMate={() => void moving.breakMate()}
      onMoveWithStack={() => void moving.moveWithStack()}
      onCancelPending={moving.cancelPending}
      onSnapBack={(target) => void moving.snapBack(target)}
    />
  ) : null;
  const routePanel = route.state ? (
    <HarnessPanel
      state={route.state}
      moving={Boolean(move?.enabled)}
      busy={route.busy}
      counts={route.counts}
      onPinned={(pinned) => void route.setPinned(pinned)}
      onRemove={() => void route.remove()}
    />
  ) : null;
  const traceCard = traced ? (
    <div className="w-80 rounded-md border bg-background/95 p-3 shadow-sm">
      <TraceCard
        key={`${traced.origin}\n${traced.boardNet}`}
        traced={traced}
        result={nets.results.get(TRACE_KEY)}
        onLight={light}
        onFrameBoard={(occurrence) => {
          if (!viewer.frameNetEmphasis(TRACE_KEY, occurrence)) viewer.frameBoard(occurrence);
        }}
        onFrameHop={(hop) => viewer.frameParts([hop.from, hop.to].flatMap((end) => (
          end.occurrence && end.reference ? [{ occurrence: end.occurrence, reference: end.reference }] : [])))}
      />
    </div>
  ) : null;
  // Route mode with no harness picked yet: say what to do (D-P2-51).
  const routeHint = move?.route && !route.state ? (
    <p className="flex items-center gap-2 rounded-md border bg-background/95 px-3 py-2 text-sm text-muted-foreground shadow-sm">
      <Spline className="size-4 shrink-0 text-kind-harness" aria-hidden /> Drag a harness to bend it
    </p>
  ) : null;
  const tools = movePanel || routeHint || routePanel || traceCard ? <>{movePanel}{routeHint}{routePanel}{traceCard}</> : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SceneNotices error={error} viewerError={viewerError} summary={summary} />

      <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/20" style={themeBridge(leftInset)}>
        {/* React 18 does not map className onto custom elements: size it with a style. */}
        <prism-semantic-viewer
          ref={viewer.attach} mode="system" hide-panel="true" active="true" move-allowed={canEdit ? "true" : "false"}
          style={{ position: "absolute", inset: 0, display: "block" }}
        />
        <Semantic3dControls viewer={element} onVisibleWidthChange={setLeftInset} />

        <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-wrap items-start gap-2" style={{ left: leftInset + 12 }}>
          {/* Collapsed to a button until used (M9): the field stays mounted so / and ⌘F still reach it. */}
          <FloatingToolbar label="Search" className={cn("min-w-0", searching && "w-[30rem] max-w-full")}>
            <div className="flex min-w-0 flex-1 items-center gap-0.5"
              onFocusCapture={openSearch}
              onBlurCapture={(event) => {
                if (scopeOpen || event.currentTarget.contains(event.relatedTarget as Node)) return;
                if (!event.currentTarget.querySelector("input")?.value) setSearching(false);
              }}>
              {!searching && (
                <ToolbarButton title="Search parts and nets (/)" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                  openSearch();
                  requestAnimationFrame(() => window.document.querySelector<HTMLInputElement>("[data-scene-search] input")?.focus());
                }}>
                  <Search className="size-4" aria-hidden />
                </ToolbarButton>
              )}
              <span className="flex shrink-0 items-center gap-1 px-1.5 text-xs text-muted-foreground" title={summary ? sceneTitle(summary) : undefined}>
                <Box className="size-3.5" aria-hidden />{summary?.boards ?? "…"}
                {summary && summary.building.length > 0 && <Loader2 className="size-3 animate-spin" aria-label="Building" />}
              </span>
              <div data-scene-search className={searching ? "flex min-w-0 flex-1 items-center gap-0.5" : "sr-only"}>
                <Select value={scope ?? "all"} open={scopeOpen} onOpenChange={setScopeOpen}
                  onValueChange={(value) => setSearchBoard(value === "all" ? null : value)}>
                  <SelectTrigger className="h-7 w-28 shrink-0 border-0 bg-transparent text-xs shadow-none" aria-label="Search on">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All boards</SelectItem>
                    {boards.map((board) => (
                      <SelectItem key={board.path} value={board.path}>{board.displayPath}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="min-w-0 flex-1">
                  <DesignSearchField semanticIndex={null} search={search} loading={boards.length > 0 && !searchable.length} onPick={pick} inline />
                </div>
              </div>
            </div>
          </FloatingToolbar>
          <div className="flex-1" />
          {canEdit && (
            <FloatingToolbar label="Mode" className="shrink-0">
              <ToolbarButton active={!move?.enabled} title="Select" onClick={() => viewer.setMoveMode(false)}>
                <MousePointer2 className="size-3.5" aria-hidden /> Select
              </ToolbarButton>
              <ToolbarButton active={Boolean(move?.enabled && !move.route)} title="Move boards (M)" aria-label="Move"
                onClick={() => viewer.setMoveMode(true, { route: false })}>
                <Move3d className="size-3.5" aria-hidden /> Move
              </ToolbarButton>
              {(scene?.harnesses?.length ?? 0) > 0 && (
                <ToolbarButton active={Boolean(move?.route)} title="Edit harness routes: drag a harness to bend it (Alt: a breakout)"
                  aria-label="Route" onClick={() => viewer.setMoveMode(true, { route: true })}>
                  <Spline className="size-3.5 text-kind-harness" aria-hidden /> Route
                </ToolbarButton>
              )}
            </FloatingToolbar>
          )}
        </div>

        {inspectorSlot ? createPortal(tools, inspectorSlot) : (tools && (
          <div className="absolute top-16 z-10 flex max-h-[calc(100%-5rem)] flex-col gap-2 overflow-y-auto" style={{ left: leftInset + 12 }}>{tools}</div>
        ))}
        {netsSlot && createPortal(
          <NetPanel
            embedded
            systemId={systemId}
            highlighted={highlighted}
            results={nets.results}
            adding={nets.adding}
            onAdd={(net) => void nets.add(net)}
            onRemove={nets.remove}
            onFrame={(groupId, occurrence) => viewer.frameNetEmphasis(groupId, occurrence ?? null)}
            isolated={Boolean(viewState?.isolateNet)}
            onIsolate={(next) => viewer.setNetIsolation(next)}
            onClear={nets.clear}
            onClose={() => onOpenTray?.(null)}
          />,
          netsSlot,
        )}
        {!scene && !error && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading the system scene…</span>
          </div>
        )}

        <FloatingToolbar label="View" className="absolute bottom-3 right-3">
          <ToolbarButton active={Boolean(netsSlot) || highlighted.length > 0} title="System nets" onClick={() => onOpenTray?.(netsSlot ? null : "nets")}>
            <Spline className="size-4" aria-hidden />{highlighted.length > 0 && <span className="text-[11px] tabular-nums">{highlighted.length}</span>}
          </ToolbarButton>
          <ToolbarButton title="Fit all (Home)" onClick={() => viewer.frameAll()}><Maximize className="size-4" aria-hidden /></ToolbarButton>
          <CollisionCheckButton systemId={systemId} document={document} />
          <StepExportButton systemId={systemId} version={document.system.version} />
          <ToolbarButton active={labels} title="Board names" onClick={() => { setLabels(!labels); viewer.setLabelsVisible(!labels); }}>
            <Tag className="size-4" aria-hidden />
          </ToolbarButton>
          {(scene?.harnesses?.length ?? 0) > 0 && (
            <ToolbarButton active={harnesses} title="Harnesses" onClick={() => { setHarnesses(!harnesses); viewer.setHarnessesVisible(!harnesses); }}>
              <Cable className="size-4" aria-hidden />
            </ToolbarButton>
          )}
          <ToolbarButton active={stats} title="Statistics (`)" onClick={() => { setStats(!stats); viewer.setStatsOverlay(!stats); }}>
            <Activity className="size-4" aria-hidden />
          </ToolbarButton>
          <ToolbarButton title="Keyboard shortcuts (?)" onClick={() => viewer.toggleHelp()}>
            <Keyboard className="size-4" aria-hidden />
          </ToolbarButton>
        </FloatingToolbar>
      </div>
      <ConfirmDialog
        open={nets.confirmLarge !== null}
        onOpenChange={(open) => { if (!open) nets.cancelLarge(); }}
        title={`Highlight ${nets.confirmLarge?.name ?? "this net"}?`}
        description={`It has ${nets.confirmLarge?.pinCount ?? 0} pins, so it lights a lot of copper on every board it reaches (usually a ground or supply).`}
        confirmLabel="Highlight"
        destructive={false}
        busy={nets.adding !== null}
        onConfirm={() => { if (nets.confirmLarge) void nets.add(nets.confirmLarge, true); }}
      />
      <ConfirmDialog
        open={moving.confirmReset}
        onOpenChange={moving.setConfirmReset}
        title="Reset every board's position?"
        description="Every board you or others moved goes back to the default side-by-side row. Earlier snapshots keep the positions they froze."
        confirmLabel="Reset positions"
        busy={moving.busy}
        onConfirm={() => void moving.resetAll()}
      />
    </div>
  );
}

function sceneTitle(summary: ReturnType<typeof summarizeScene>): string {
  return [`${summary.boards} board${summary.boards === 1 ? "" : "s"}`,
    summary.restricted.length ? `${summary.restricted.length} restricted` : "",
    summary.building.length ? `${summary.building.length} building` : "",
    summary.failed.length ? `${summary.failed.length} failed` : ""].filter(Boolean).join(" · ");
}

/** The app's tokens for the viewer's shadow tree, as the board 3D tab passes them (see webgpu-3d-tab.tsx). */
function themeBridge(leftInset: number): CSSProperties {
  return {
    "--prism-shell": "hsl(var(--background))",
    "--prism-panel": "hsl(var(--card))",
    "--prism-panel-raised": "hsl(var(--muted))",
    "--prism-control": "hsl(var(--secondary))",
    "--prism-control-hover": "hsl(var(--accent))",
    "--prism-foreground": "hsl(var(--foreground))",
    "--prism-muted": "hsl(var(--muted-foreground))",
    "--prism-border": "hsl(var(--border))",
    "--prism-primary": "hsl(var(--primary))",
    "--prism-primary-foreground": "hsl(var(--primary-foreground))",
    "--prism-viewport-inset-left": `${leftInset}px`,
  } as CSSProperties;
}

/** Why some boards are boxes, missing or failed; nothing when every board is drawn. */
function SceneNotices({ error, viewerError, summary }: {
  error: string | null;
  viewerError: string | null;
  summary: ReturnType<typeof summarizeScene> | null;
}) {
  return (error || viewerError || (summary && (summary.restricted.length || summary.building.length || summary.missing.length
        || summary.failed.length || summary.unplaced.length))) ? (
        <div className="flex flex-col gap-1.5 border-b px-4 py-2 md:px-6">
          {error && <Notice tone="error">{error}</Notice>}
          {viewerError && <Notice tone="error">The 3D view could not start: {viewerError}</Notice>}
          {summary && summary.restricted.length > 0 && (
            <Notice>
              {summary.restricted.length === 1
                ? `${names(summary.restricted)} is restricted: drawn as a grey box showing only its size.`
                : `${names(summary.restricted)} are restricted: drawn as grey boxes showing only their size.`}
            </Notice>
          )}
          {summary && summary.building.length > 0 && (
            <Notice>
              Generating the 3D view of {names(summary.building)};{" "}
              {summary.building.length === 1 ? "it is drawn as a box" : "they are drawn as boxes"} until ready.
            </Notice>
          )}
          {summary && summary.missing.length > 0 && (
            <Notice>{names(summary.missing)} {summary.missing.length === 1 ? "has" : "have"} no 3D view yet. A designer opening this tab generates it.</Notice>
          )}
          {summary && summary.failed.map(({ occurrence, error: reason }) => (
            <Notice key={occurrence.path} tone="error">
              {failedNotice(occurrence.displayPath, reason)}
            </Notice>
          ))}
          {summary && summary.unplaced.length > 0 && (
            <Notice>{names(summary.unplaced)} {summary.unplaced.length === 1 ? "is" : "are"} not shown yet: the board outline is still being read.</Notice>
          )}
        </div>
      ) : null;
}
