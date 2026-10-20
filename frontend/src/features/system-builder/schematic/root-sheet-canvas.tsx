/**
 * The root sheet canvas (CONTRACTS §14.3): pan and zoom, KiCad selection,
 * moving symbols, sliding pins, resizing sheets, editing routes, and drawing
 * mates and harness links. A gesture draws through a layout override while it
 * runs and is sent as one request when it ends.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";

import { useCommittedRef } from "@/hooks/use-committed-ref";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import {
  boundsOf,
  normalizeRect,
  rectContains,
  rectTouchesRoute,
  rectsTouch,
  resize,
  selectionMode,
  slidePort,
  type Handle,
  type Point,
  type Rect,
} from "./geometry";
import {
  connectRefusal,
  dragRoute,
  harnessOps,
  layoutOps,
  mateOps,
  movePort,
  moveSymbols,
  removeOps,
  resizeSymbol,
  withFollowingRoutes,
  type Layout,
  type PinRef,
} from "./edits";
import { buildScene, type Scene } from "./scene";
import { COLOURS, SheetSvg } from "./sheet-svg";
import { fitView, panBy, toSheet, toScreen, zoomAt, type View } from "./viewport";

export type Tool = "select" | "mate" | "harness";

interface Props {
  document: SystemDocument;
  bundle?: SystemBundle;
  projectNames?: Record<string, string>;
  selected: ReadonlySet<string>;
  onSelect: (ids: Set<string>) => void;
  canEdit: boolean;
  apply: (ops: SystemOp[]) => Promise<unknown>;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  /** Bumped by the toolbar's Fit button. */
  fitRequest?: number;
}

type Drag =
  | { kind: "pan"; last: Point }
  | { kind: "box"; start: Point; current: Point }
  | { kind: "move"; ids: string[]; start: Point; active: boolean; screen: Point }
  | { kind: "port"; item: string; key: string; active: boolean; screen: Point }
  | { kind: "resize"; item: string; handle: Handle }
  | { kind: "segment"; id: string; index: number; active: boolean; screen: Point };

const THRESHOLD_PX = 3;
const DEFAULT_VIEW: View = { x: 0, y: 0, scale: 6 };

function hitOf(target: EventTarget | null): { hit: string; id: string; key: string } | null {
  const element = (target as Element | null)?.closest?.("[data-hit]");
  if (!element) return null;
  return { hit: element.getAttribute("data-hit") ?? "", id: element.getAttribute("data-id") ?? "", key: element.getAttribute("data-key") ?? "" };
}

function boxSelection(scene: Scene, rect: Rect, mode: "window" | "crossing"): Set<string> {
  const out = new Set<string>();
  for (const symbol of scene.symbols) {
    if (mode === "window" ? rectContains(rect, symbol.rect) : rectsTouch(rect, symbol.rect)) out.add(symbol.id);
  }
  for (const connection of scene.connections) {
    if (connection.points.length < 2) continue;
    if (mode === "window" ? rectContains(rect, boundsOf(connection.points)) : rectTouchesRoute(rect, connection.points)) out.add(connection.id);
  }
  return out;
}

export function RootSheetCanvas({ document, bundle, projectNames, selected, onSelect, canEdit, apply, tool, onToolChange, fitRequest = 0 }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View | null>(null);
  const [override, setOverride] = useState<Layout | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [connectFrom, setConnectFrom] = useState<PinRef | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  // The Fit request last honoured; a new one drops the user's view (below).
  const [fittedFor, setFittedFor] = useState(fitRequest);

  const options = useMemo(() => ({ projectNames }), [projectNames]);
  const base = useMemo(() => buildScene(document, bundle, options), [document, bundle, options]);
  const scene = useMemo(() => (override ? buildScene(document, bundle, { ...options, override }) : base), [override, document, bundle, options, base]);

  // The canvas's size, from the browser (an external lifecycle).
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Until the user pans or zooms, the view fits the sheet; a Fit request
  // (the toolbar, or F) returns to that.
  if (fittedFor !== fitRequest) {
    setFittedFor(fitRequest);
    setView(null);
  }
  const current = view ?? (size.width > 0 ? fitView(base.bounds, size.width, size.height) : DEFAULT_VIEW);
  const currentRef = useCommittedRef(current);

  // Wheel: pinch or Ctrl/⌘ zooms at the cursor, plain scroll pans. React's
  // wheel listener is passive, so this one is attached by hand.
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      const at = { x: event.clientX - box.left, y: event.clientY - box.top };
      setView((previous) => {
        const from = previous ?? currentRef.current;
        return event.ctrlKey || event.metaKey ? zoomAt(from, at, Math.exp(-event.deltaY * 0.01)) : panBy(from, -event.deltaX, -event.deltaY);
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [currentRef]);

  const screenPoint = (event: { clientX: number; clientY: number }): Point => {
    const box = container.current?.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  };

  const commit = async (ops: SystemOp[], keep: Layout | null) => {
    if (!ops.length) {
      setOverride(null);
      return;
    }
    setOverride(keep);
    try {
      await apply(ops);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setOverride(null);
    }
  };

  const connect = (from: PinRef, to: PinRef) => {
    const kind = tool === "mate" ? "mate" : "harness";
    const refusal = connectRefusal(document, kind, from, to);
    setConnectFrom(null);
    if (refusal) {
      toast.error(refusal);
      return;
    }
    void commit(kind === "mate" ? mateOps(from, to) : harnessOps(document, from, to), null);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    container.current?.focus();
    const screen = screenPoint(event);
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ kind: "pan", last: screen });
      return;
    }
    if (event.button !== 0) return;
    const at = toSheet(current, screen);
    const hit = hitOf(event.target);
    const isOccurrencePort = hit?.hit === "port" && document.occurrences.some((item) => item.id === hit.id);

    if (tool !== "select") {
      if (!canEdit) return;
      if (isOccurrencePort && hit) {
        const pin = { item: hit.id, key: hit.key };
        if (connectFrom) connect(connectFrom, pin);
        else setConnectFrom(pin);
      } else {
        setConnectFrom(null);
      }
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    if (hit?.hit === "handle" && canEdit) {
      setDrag({ kind: "resize", item: hit.id, handle: hit.key as Handle });
      return;
    }
    if (hit?.hit === "port") {
      if (!selected.has(hit.id)) onSelect(new Set([hit.id]));
      if (canEdit) setDrag({ kind: "port", item: hit.id, key: hit.key, active: false, screen });
      return;
    }
    if (hit?.hit === "segment") {
      onSelect(event.shiftKey ? toggled(selected, hit.id) : new Set([hit.id]));
      if (canEdit) setDrag({ kind: "segment", id: hit.id, index: Number(hit.key), active: false, screen });
      return;
    }
    if (hit?.hit === "symbol") {
      let next: Set<string>;
      if (event.shiftKey) next = toggled(selected, hit.id);
      else next = selected.has(hit.id) ? new Set(selected) : new Set([hit.id]);
      onSelect(next);
      const ids = [...next].filter((id) => scene.symbols.some((symbol) => symbol.id === id));
      if (canEdit && next.has(hit.id)) setDrag({ kind: "move", ids, start: at, active: false, screen });
      return;
    }
    if (!event.shiftKey) onSelect(new Set());
    setDrag({ kind: "box", start: at, current: at });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const screen = screenPoint(event);
    const at = toSheet(current, screen);
    if (tool !== "select") setPointer(at);
    if (!drag) return;
    if (drag.kind === "pan") {
      setView(panBy(current, screen.x - drag.last.x, screen.y - drag.last.y));
      setDrag({ ...drag, last: screen });
      return;
    }
    if (drag.kind === "box") {
      setDrag({ ...drag, current: at });
      return;
    }
    if ("active" in drag && !drag.active) {
      if (Math.hypot(screen.x - drag.screen.x, screen.y - drag.screen.y) < THRESHOLD_PX) return;
      setDrag({ ...drag, active: true });
    }
    let next: Layout | null = null;
    if (drag.kind === "move") {
      next = moveSymbols(document, base, drag.ids, { x: at.x - drag.start.x, y: at.y - drag.start.y });
    } else if (drag.kind === "port") {
      const symbol = base.symbols.find((item) => item.id === drag.item);
      if (!symbol) return;
      const others = symbol.ports.filter((port) => port.key !== drag.key);
      const placed = slidePort(symbol.rect, { widthNm: symbol.rect.w, heightNm: symbol.rect.h }, at, others, symbol.corner);
      if (!placed) return; // that spot is taken: keep the last good one
      next = movePort(document, base, drag.item, drag.key, placed);
    } else if (drag.kind === "resize") {
      const symbol = base.symbols.find((item) => item.id === drag.item);
      if (!symbol) return;
      const ports = Object.fromEntries(symbol.ports.map((port) => [port.key, { edge: port.edge, offsetNm: port.offsetNm }]));
      const resized = resize(symbol.rect, drag.handle, at, ports, symbol.corner);
      next = resizeSymbol(document, base, drag.item, resized.rect, resized.ports);
    } else if (drag.kind === "segment") {
      next = dragRoute(document, base, drag.id, drag.index, at);
    }
    if (next) setOverride(drag.kind === "segment" ? next : withFollowingRoutes(document, bundle, base, next, options));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const ended = drag;
    setDrag(null);
    if (!ended) return;
    if (ended.kind === "box") {
      const rect = normalizeRect(ended.start, ended.current);
      if (rect.w > 0 || rect.h > 0) {
        const picked = boxSelection(scene, rect, selectionMode(ended.start, ended.current));
        onSelect(event.shiftKey ? new Set([...selected, ...picked]) : picked);
      }
      return;
    }
    if (ended.kind === "pan") return;
    if ("active" in ended && !ended.active) {
      setOverride(null);
      return;
    }
    if (override) void commit(layoutOps(document, override), override);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setConnectFrom(null);
      setDrag(null);
      setOverride(null);
      if (tool !== "select") onToolChange("select");
      else onSelect(new Set());
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && !event.altKey && canEdit && selected.size) {
      event.preventDefault();
      const ops = removeOps(document, [...selected]);
      if (ops.length) {
        void commit(ops, null);
        onSelect(new Set());
      }
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "h" || event.key === "H") onToolChange(tool === "harness" ? "select" : "harness");
    if (event.key === "Home" || event.key === "f") setView(null);
  };

  const selectedPorts = useMemo(() => new Set(connectFrom ? [`${connectFrom.item}\u0000${connectFrom.key}`] : []), [connectFrom]);
  const resizable = useMemo(
    () => new Set(canEdit && tool === "select" ? [...selected].filter((id) => scene.symbols.some((symbol) => symbol.id === id)) : []),
    [canEdit, tool, selected, scene],
  );

  const grid = 2.54 * current.scale; // px between grid dots
  const origin = toScreen(current, { x: 0, y: 0 });
  const transform = `scale(${current.scale}) translate(${-current.x / 1e6} ${-current.y / 1e6})`;
  const band = connectFrom && pointer
    ? { from: scene.symbols.find((symbol) => symbol.id === connectFrom.item)?.ports.find((port) => port.key === connectFrom.key)?.point, to: pointer }
    : null;
  const box = drag?.kind === "box" ? normalizeRect(drag.start, drag.current) : null;
  const crossing = drag?.kind === "box" && selectionMode(drag.start, drag.current) === "crossing";

  return (
    <div
      ref={container}
      tabIndex={0}
      role="application"
      aria-label="System schematic, root sheet"
      className="relative h-full w-full overflow-hidden outline-none"
      style={{ background: COLOURS.paper, cursor: tool === "select" ? (drag?.kind === "pan" ? "grabbing" : "default") : "crosshair", touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        setDrag(null);
        setOverride(null);
      }}
      onKeyDown={onKeyDown}
    >
      <svg width="100%" height="100%" className="absolute inset-0 select-none" data-testid="root-sheet">
        <defs>
          <pattern id="sb-grid" width={grid} height={grid} patternUnits="userSpaceOnUse" x={origin.x % grid} y={origin.y % grid}>
            <circle cx={0.75} cy={0.75} r={Math.min(0.9, Math.max(0.4, grid / 30))} fill={COLOURS.grid} />
          </pattern>
        </defs>
        {grid >= 6 && <rect width="100%" height="100%" fill="url(#sb-grid)" />}
        <g transform={transform}>
          <SheetSvg scene={scene} selected={selected} selectedPorts={selectedPorts} resizable={resizable} />
          {band?.from && (
            <line
              x1={band.from.x / 1e6}
              y1={band.from.y / 1e6}
              x2={band.to.x / 1e6}
              y2={band.to.y / 1e6}
              stroke={tool === "mate" ? COLOURS.bus : COLOURS.harness}
              strokeWidth={0.3}
              strokeDasharray="1 0.6"
              pointerEvents="none"
            />
          )}
          {box && (
            <rect
              x={box.x / 1e6}
              y={box.y / 1e6}
              width={box.w / 1e6}
              height={box.h / 1e6}
              fill={crossing ? "rgba(0,160,0,0.06)" : "rgba(47,155,255,0.08)"}
              stroke={crossing ? "#00a000" : COLOURS.select}
              strokeWidth={0.15}
              strokeDasharray={crossing ? "0.8 0.5" : undefined}
              pointerEvents="none"
            />
          )}
        </g>
      </svg>
      {scene.symbols.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm" style={{ color: COLOURS.muted }}>
          No boards yet. Use Add board to place one.
        </div>
      )}
      {tool !== "select" && (
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-xs text-white">
          {connectFrom ? `From ${labelOf(document, connectFrom)}: click the other connector` : tool === "mate" ? "Mate: click a connector" : "Harness: click a connector"} · Esc to stop
        </div>
      )}
    </div>
  );
}

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function labelOf(document: SystemDocument, pin: PinRef): string {
  const label = document.occurrences.find((item) => item.id === pin.item)?.label ?? pin.item;
  return `${label}.${pin.key}`;
}
