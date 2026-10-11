import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BaseEdge,
  ConnectionMode,
  EdgeLabelRenderer,
  Handle,
  Panel,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { Cable, ChevronDown, Layers, LayoutGrid, Lock, RectangleHorizontal, Share2, Spline } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { putLayout, type LayoutPositions } from "@/lib/systems-api";
import type { SystemHierarchy } from "@/types/system";
import { cn } from "@/lib/utils";

import {
  ADD_END_HANDLE,
  HEADER_HEIGHT,
  NODE_WIDTH,
  ROW_HEIGHT,
  buildDiagram,
  connectionIntent,
  handleId,
  nextLinkMode,
  subsystemContents,
  type DiagramEdgeData,
  type DiagramNodeData,
  type HarnessNodeData,
  type InsideEntry,
  type LinkMode,
} from "./diagram-model";
import { DiagramLegend } from "./diagram-legend";
import { DiagramZoomControls } from "./diagram-zoom-controls";
import { BLOCK_STYLE, CONNECTION_STYLE, blockKind } from "./kind-style";
import { wirePoints } from "./system-layout";
import type { SystemTabProps } from "./system-tab-content";
import { TONE_BADGE, boardStatus } from "./system-format";
import { releaseChain } from "./release-chain";
import { sessionReads } from "./session/session-reads";
import { useSessionRead, useSystemSession } from "./session/use-system-session";
import { FloatingToolbar } from "./workspace/floating-toolbar";
import { ToolbarButton } from "./workspace/toolbar-button";

type BoardNode = Node<DiagramNodeData & { height: number; onToggle: (id: string) => void; inside?: InsideEntry[] }, "board">;
type WireEdge = Edge<DiagramEdgeData & { hovered: boolean }, "wire">;
type CanvasNode = BoardNode | HarnessNode;
type HarnessNode = Node<HarnessNodeData & { height: number; onOpen: (id: string) => void }, "harness">;

/** CONTRACTS_P2 §17: a harness node, one row per end with its mating block as a cap on the port. */
function HarnessNodeView({ id, data, isConnectable, selected }: NodeProps<HarnessNode>) {
  const { harness, rows, height, onOpen } = data;
  return (
    <div className={cn("relative rounded-xl border-2 border-dashed bg-card text-card-foreground shadow-sm",
      BLOCK_STYLE.harness.border, selected && "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background")}
      style={{ width: NODE_WIDTH, height }} data-kind="harness">
      <div className={cn("flex items-center gap-2 rounded-t-[10px] border-b px-3", BLOCK_STYLE.harness.tint)} style={{ height: HEADER_HEIGHT }}>
        <Cable className="h-4 w-4 shrink-0 text-kind-harness" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{harness.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            <span className="font-medium text-kind-harness">Harness</span> · {harness.ends.length} {harness.ends.length === 1 ? "end" : "ends"} · {harness.wires.length} {harness.wires.length === 1 ? "wire" : "wires"}
          </p>
        </div>
        <button type="button" className="nodrag nopan shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
          aria-label={`Edit harness ${harness.name}`} onClick={(event) => {
            event.stopPropagation();
            onOpen(id);
          }}>
          Edit
        </button>
      </div>
      {rows.map((row, index) => (
        <div key={row.endId} className={cn("absolute inset-x-0 flex items-center gap-2 px-3 text-xs", index > 0 && "border-t border-border/50")}
          style={{ top: HEADER_HEIGHT + index * ROW_HEIGHT, height: ROW_HEIGHT }}
          title={row.partner ? `${row.label} mates ${row.partner}` : `${row.label} mates nothing yet: drag it to a port`}>
          <span className="shrink-0 font-semibold">{row.label}</span>
          <span className="shrink-0 rounded border bg-muted px-1 text-[10px] text-muted-foreground" data-testid="mating-cap">{row.block}</span>
          <span className="min-w-0 flex-1 truncate text-right text-[11px] text-muted-foreground">
            {row.partner ? `↔ ${row.partner}` : "not mated"}
          </span>
          {(["l", "r"] as const).map((side) => (
            <Handle key={side} id={handleId(side, row.endId)} type="source" position={side === "l" ? Position.Left : Position.Right}
              isConnectable={isConnectable && !row.partner} className={HANDLE_CLASS}
              aria-label={`${harness.name} ${row.label} ${side === "l" ? "left" : "right"}`} />
          ))}
        </div>
      ))}
      <div className="absolute inset-x-0 flex items-center justify-center border-t text-[11px] text-muted-foreground"
        style={{ top: HEADER_HEIGHT + rows.length * ROW_HEIGHT, height: ROW_HEIGHT }} title="Drag to a port to add an end">
        + Add an end: drag to a port
        {(["l", "r"] as const).map((side) => (
          <Handle key={side} id={handleId(side, ADD_END_HANDLE)} type="source" position={side === "l" ? Position.Left : Position.Right}
            isConnectable={isConnectable} className={HANDLE_CLASS} aria-label={`${harness.name} add end ${side === "l" ? "left" : "right"}`} />
        ))}
      </div>
    </div>
  );
}

const HANDLE_CLASS = "!h-2 !w-2 !min-h-0 !min-w-0 !border !border-background !bg-primary";

function SubsystemContents({ inside, top }: { inside: InsideEntry[]; top: number }) {
  return (
    <div className="nodrag absolute inset-x-0 z-10 border border-dashed bg-muted/80 p-2 text-[11px] text-muted-foreground shadow-sm"
      style={{ top }} aria-label="Subsystem contents">
      {inside.length === 0 ? <p>Nothing you can see.</p> : inside.map((entry) => (
        <p key={entry.path} className="flex items-center gap-1 truncate" style={{ paddingLeft: `${(entry.depth - 2) * 10}px` }}>
          {entry.kind === "assembly" ? <Layers className="h-3 w-3 shrink-0" aria-hidden /> : <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />}
          {entry.restricted && <Lock className="h-3 w-3 shrink-0" aria-label="restricted" />}
          {entry.label}
        </p>
      ))}
    </div>
  );
}

function BoardNodeView({ id, data, isConnectable, selected }: NodeProps<BoardNode>) {
  const { instance, rows, hiddenCount, expanded, height, onToggle, inside } = data;
  const status = boardStatus(instance);
  const subsystem = instance.kind === "assembly";
  const openInside = subsystem ? instance.catalog?.findingCounts : null;
  const [open, setOpen] = useState(false);
  const kind = blockKind(instance);
  const style = BLOCK_STYLE[kind];
  const newer = kind !== "board" ? releaseChain(instance.catalog).newerReleased : null;
  const subtitle = kind !== "board"
    ? [instance.projectName, instance.catalog?.version ? `v${instance.catalog.version}` : null,
      newer ? `v${newer} released` : null].filter(Boolean).join(" · ")
    : instance.projectName ?? status.label;
  return (
    <div className={cn("relative rounded-md bg-card text-card-foreground shadow-sm",
      subsystem ? "border-4 border-double" : "border-2", style.border,
      selected && "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background")}
      style={{ width: NODE_WIDTH, height }} data-kind={kind}>
      <div className={cn("flex items-center gap-2 rounded-t-[4px] border-b px-3", style.tint)} style={{ height: HEADER_HEIGHT }}>
        {instance.restricted
          ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="restricted" />
          : <style.icon className={cn("h-4 w-4 shrink-0", style.text)} aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{instance.label}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className={cn("shrink-0 font-medium", style.text)}>{style.label}</span>
            <span className="min-w-0 truncate">· {subtitle || status.label}</span>
            {subsystem && (
              <button type="button" className="nodrag nopan shrink-0 hover:text-foreground"
                aria-expanded={open} aria-label={`What is inside ${instance.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen((value) => !value);
                }}>
                · inside <ChevronDown className={cn("inline h-3 w-3", open && "rotate-180")} />
              </button>
            )}
          </p>
        </div>
        {status.tone !== "ok" && (
          <Badge variant={TONE_BADGE[status.tone]} className="h-5 shrink-0 px-1.5 text-[10px]" title={status.detail}>{status.label}</Badge>
        )}
        {openInside && openInside.error + openInside.warning > 0 && (
          // SB2-117: what the subsystem's snapshot still has open.
          <Badge variant={openInside.error ? "destructive" : "warning"} className="h-5 shrink-0 px-1.5 text-[10px] tabular-nums"
            title={`Open inside: ${openInside.error} errors · ${openInside.warning} warnings`}>
            {openInside.error || openInside.warning} inside
          </Badge>
        )}
      </div>
      {rows.length === 0 && (
        <p className="px-3 text-[11px] text-muted-foreground" style={{ lineHeight: `${ROW_HEIGHT}px` }}>
          {instance.restricted ? "Restricted" : instance.interface?.status === "ready" ? "No links yet" : status.label}
        </p>
      )}
      {rows.map((row, index) => {
        const top = HEADER_HEIGHT + index * ROW_HEIGHT;
        return (
          <div key={row.portKey ?? "restricted"}
            className={cn("absolute inset-x-0 flex items-center gap-2 px-3 text-xs", index > 0 && "border-t border-border/50")}
            style={{ top, height: ROW_HEIGHT }}
            title={row.orphan ? "This linked port is no longer exposed at the baseline"
              : row.exportName ? `Exported to parent systems as ${row.exportName}` : row.partners.join(", ") || undefined}>
            <span className={cn("shrink-0 font-mono", row.linked || row.exportName ? "font-semibold" : "text-muted-foreground", row.orphan && "text-warning")}>
              {row.reference}
            </span>
            {row.partners.length > 0 && (
              <span className="min-w-0 flex-1 truncate text-right text-[11px] text-muted-foreground">
                ↔ {row.partners.join(", ")}
              </span>
            )}
            {row.exportName && (
              <span className="flex min-w-0 flex-1 items-center justify-end gap-1 truncate text-[11px] text-primary">
                <Share2 className="h-3 w-3 shrink-0" aria-hidden /> {row.exportName}
              </span>
            )}
            {(["l", "r"] as const).map((side) => (
              <Handle
                key={side}
                id={handleId(side, row.portKey)}
                type="source"
                position={side === "l" ? Position.Left : Position.Right}
                isConnectable={isConnectable && row.portKey !== null && !row.orphan}
                className={HANDLE_CLASS}
                aria-label={`${instance.label} ${row.reference} ${side === "l" ? "left" : "right"}`}
              />
            ))}
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <button type="button" onClick={() => onToggle(id)}
          className="nodrag absolute inset-x-0 bottom-0 flex h-7 items-center justify-center gap-1 border-t text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground">
          {expanded ? "Hide unlinked ports" : `${hiddenCount} unlinked ${hiddenCount === 1 ? "port" : "ports"}`}
          <ChevronDown className={cn("h-3 w-3", expanded && "rotate-180")} />
        </button>
      )}
      {subsystem && open && <SubsystemContents inside={inside ?? []} top={height + 4} />}
    </div>
  );
}

function WireEdgeView({ id, sourceX, sourceY, targetX, targetY, data, selected }: EdgeProps<WireEdge>) {
  const points = wirePoints(data!.wire, { x: sourceX, y: sourceY }, { x: targetX, y: targetY });
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const middle = points.length === 4 ? { x: points[1].x, y: (points[1].y + points[2].y) / 2 } : { x: (sourceX + targetX) / 2, y: sourceY };
  const active = selected || data!.hovered;
  const kind = CONNECTION_STYLE[data!.b2b ? "b2b" : data!.harnessId || data!.harness ? "harness" : "link"];
  return (
    <>
      {active && <BaseEdge id={`${id}-halo`} path={path} style={{ strokeWidth: kind.width + 6, stroke: kind.stroke, strokeOpacity: 0.25 }} />}
      <BaseEdge id={id} path={path} interactionWidth={14}
        style={{ strokeWidth: kind.width + (active ? 1 : 0), stroke: kind.stroke, strokeOpacity: active ? 1 : 0.85 }} />
      {active && (
        <EdgeLabelRenderer>
          <div className="nodrag nopan pointer-events-none absolute border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-sm"
            style={{ transform: `translate(-50%, -120%) translate(${middle.x}px, ${middle.y}px)` }}>
            {data!.label}{data!.b2b ? " · board-to-board" : ""}{data!.harness ? ` · harness ${data!.harness}` : ""}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// SB2-99: memoised, so a node or edge whose props are unchanged skips its render.
const NODE_TYPES = { board: memo(BoardNodeView), harness: memo(HarnessNodeView) };
const EDGE_TYPES = { wire: memo(WireEdgeView) };
const NO_OCCURRENCES: SystemHierarchy["occurrences"] = [];

interface NodeOverride {
  position?: { x: number; y: number };
  measured?: { width?: number; height?: number };
  selected?: boolean;
  dragging?: boolean;
}

/** Fold React Flow's node changes into per-node overrides of the derived nodes. */
export function applyOverrides(current: Record<string, NodeOverride>, changes: NodeChange[]): Record<string, NodeOverride> {
  const next = { ...current };
  for (const change of changes) {
    if (!("id" in change)) {
      continue;
    }
    const entry = { ...next[change.id] };
    if (change.type === "position") {
      if (change.position) entry.position = change.position;
      entry.dragging = change.dragging;
    } else if (change.type === "dimensions") {
      if (change.dimensions) entry.measured = change.dimensions;
    } else if (change.type === "select") {
      entry.selected = change.selected;
    } else {
      continue;
    }
    next[change.id] = entry;
  }
  return next;
}

export function DiagramTab({ systemId, document, canEdit, onNavigate, selection = null, onSelect }: SystemTabProps) {
  const { session, edit } = useSystemSession();
  const [overrides, setOverrides] = useState<Record<string, NodeOverride>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [mode, setMode] = useState<LinkMode>(null);
  const hasSubsystems = document.instances.some((instance) => instance.kind === "assembly");
  // Subsystem contents come from the hierarchy, re-read when the system moves on.
  const tree = useSessionRead(hasSubsystems ? sessionReads.hierarchy() : null).data;
  // The saved layout is a separate, unversioned read (§1 invariant 6).
  const layoutRead = sessionReads.layout();
  const layout = useSessionRead(layoutRead).data;

  // SB2-99: the layout and the model are rebuilt only when the document, positions or expansion
  // change, and each node's and edge's data object stays the same otherwise; with memoised node and
  // edge views, a selection change re-renders only what it (de)selects.
  const positions = layout ?? null;
  const live = useMemo(() => {
    if (!positions) return null;
    // Positions being dragged count as placed, so wires re-route while dragging.
    const placed: LayoutPositions = { ...positions };
    for (const [id, extra] of Object.entries(overrides)) {
      if (extra.position) placed[id] = extra.position;
    }
    return placed;
  }, [positions, overrides]);
  const diagram = useMemo(() => (live ? buildDiagram(document, live, expanded) : null), [document, live, expanded]);
  const toggle = useCallback((id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);
  const navigate = useRef(onNavigate);
  useEffect(() => {
    navigate.current = onNavigate;
  }, [onNavigate]);
  const openHarness = useCallback((id: string) => navigate.current("connectivity", { harness: id }), []);
  const occurrences = tree?.occurrences ?? NO_OCCURRENCES;
  const boardData = useMemo(() => new Map((diagram?.nodes ?? []).map((node) => [node.id, {
    ...node.data, height: node.height, onToggle: toggle,
    inside: node.data.instance.kind === "assembly" ? subsystemContents(occurrences, node.id) : undefined,
  }])), [diagram, toggle, occurrences]);
  const harnessData = useMemo(() => new Map((diagram?.harnesses ?? []).map((node) => [node.id,
    { ...node.data, height: node.height, onOpen: openHarness }])), [diagram, openHarness]);
  const edgeData = useMemo(() => new Map((diagram?.edges ?? []).map((edge) => [edge.id,
    { plain: { ...edge.data, hovered: false }, hovered: { ...edge.data, hovered: true } }])), [diagram]);

  if (!diagram) {
    return <div className="p-6 text-sm text-muted-foreground">Loading diagram…</div>;
  }

  const boardNodes: BoardNode[] = diagram.nodes.map((node) => {
    const extra = overrides[node.id] ?? {};
    return {
      id: node.id,
      type: "board",
      position: node.position,
      data: boardData.get(node.id)!,
      measured: extra.measured,
      // In the workspace the selection is the URL's (SB2-61); alone, the canvas keeps its own.
      selected: onSelect ? selection?.kind === "instance" && selection.id === node.id : extra.selected,
      dragging: extra.dragging,
      width: NODE_WIDTH,
      height: node.height,
    };
  });
  const harnessNodes: HarnessNode[] = diagram.harnesses.map((node) => {
    const extra = overrides[node.id] ?? {};
    return {
      id: node.id, type: "harness", position: node.position,
      data: harnessData.get(node.id)!,
      measured: extra.measured, dragging: extra.dragging, width: NODE_WIDTH, height: node.height,
      selected: onSelect ? selection?.kind === "harness" && selection.id === node.id : extra.selected,
    };
  });
  const nodes: CanvasNode[] = [...boardNodes, ...harnessNodes];
  const edges: WireEdge[] = diagram.edges.map((edge) => ({
    id: edge.id,
    type: "wire",
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle,
    data: hovered === edge.id ? edgeData.get(edge.id)!.hovered : edgeData.get(edge.id)!.plain,
    selected: Boolean(onSelect && selection && (edge.data.harnessId
      ? selection.kind === "harness" && selection.id === edge.data.harnessId
      : selection.kind === "link" && selection.id === edge.id)),
  }));

  const savePositions = (positions: LayoutPositions) =>
    putLayout(systemId, positions)
      .then((saved) => {
        session.store(layoutRead.key, saved);
        setOverrides({});
      })
      .catch(() => toast.error("Could not save the layout"));

  const saveLayout = (moved: CanvasNode) => {
    void savePositions(Object.fromEntries(nodes.map((node) => [node.id, node.id === moved.id ? moved.position : node.position])));
  };

  const connect = (connection: Connection) => {
    const intent = connectionIntent(connection, document, mode);
    if (intent.kind === "error") {
      toast.error(intent.error);
      return;
    }
    setMode(null);
    if (intent.kind === "harness") {
      void edit("harness", (system) => system.createHarness({ name: "Harness", ends: [intent.a, intent.b], identity: true }),
        "Harness created").then((created) => created && openHarness(created.body.id));
      return;
    }
    if (intent.kind === "add_end") {
      void edit("harness", (system) => system.addHarnessEnd(intent.harnessId, intent.port), "End added");
      return;
    }
    if (intent.kind === "mate_end") {
      void edit("harness", (system) => system.updateHarnessEnd(intent.harnessId, intent.endId, { mates: intent.port }), "End mated");
      return;
    }
    const type = mode === "b2b" ? "b2b" : undefined;
    void edit("link", (system) => system.createLink({ a: intent.a, b: intent.b, type }),
      type === "b2b" ? "Board-to-board link created" : "Link created").then((created) => {
      if (created) {
        onNavigate("connectivity", { link: created.body.id });
      }
    });
  };

  const dark = typeof window !== "undefined" && window.document.documentElement.classList.contains("dark");
  const arranged = Object.keys(positions ?? {}).length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Shortcuts fire only while the diagram has focus and no text field is active (§16.2). */}
      <div className="min-h-0 flex-1 outline-none" data-testid="system-diagram" tabIndex={0}
        role="application" aria-label="System diagram"
        onKeyDown={(event) => {
          if (!canEdit) return;
          const target = event.target as HTMLElement;
          const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
          setMode((current) => nextLinkMode(event.key, current, typing));
        }}>
        {document.instances.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Empty</p>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            colorMode={dark ? "dark" : "light"}
            connectionMode={ConnectionMode.Loose}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable
            onNodesChange={(changes) => setOverrides((current) => applyOverrides(current, changes))}
            onNodeDragStop={(_event, node) => saveLayout(node)}
            onConnect={connect}
            onEdgeClick={(_event, edge) => {
              const harnessId = edge.data?.harnessId;
              if (onSelect) onSelect(harnessId ? { kind: "harness", id: harnessId } : { kind: "link", id: edge.id });
              else if (harnessId) openHarness(harnessId);
              else onNavigate("connectivity", { link: edge.id });
            }}
            onNodeClick={onSelect ? (_event, node) => onSelect({ kind: node.type === "harness" ? "harness" : "instance", id: node.id }) : undefined}
            onPaneClick={onSelect ? () => onSelect(null) : undefined}
            onEdgeMouseEnter={(_event, edge) => setHovered(edge.id)}
            onEdgeMouseLeave={() => setHovered(null)}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.2}
          >
            <Background gap={16} />
            <Panel position="bottom-left"><DiagramZoomControls /></Panel>
            <Panel position="bottom-right"><DiagramLegend document={document} /></Panel>
            {canEdit && (
              <Panel position="top-right">
                <FloatingToolbar label="Draw">
                  <ToolbarButton active={mode === null} title="Draw a link (drag between two ports)" aria-label="Link" onClick={() => setMode(null)}>
                    <Spline className="size-3.5" aria-hidden /> Link
                  </ToolbarButton>
                  <ToolbarButton active={mode === "b2b"} title="Draw a board-to-board mate (B; Esc cancels)" aria-label="Board-to-board"
                    onClick={() => setMode((current) => (current === "b2b" ? null : "b2b"))}>
                    <RectangleHorizontal className="size-3.5 text-kind-board" aria-hidden /> B2B
                  </ToolbarButton>
                  <ToolbarButton active={mode === "harness"} title="Draw a harness (H; Esc cancels)" aria-label="Harness"
                    onClick={() => setMode((current) => (current === "harness" ? null : "harness"))}>
                    <Cable className="size-3.5 text-kind-harness" aria-hidden /> Harness
                  </ToolbarButton>
                  {arranged && (
                    <>
                      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
                      <ToolbarButton title="Auto-arrange: discard the saved arrangement" onClick={() => void savePositions({})}>
                        <LayoutGrid className="size-4" aria-hidden />
                      </ToolbarButton>
                    </>
                  )}
                </FloatingToolbar>
              </Panel>
            )}
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
