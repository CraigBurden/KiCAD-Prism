/**
 * The harness tab's canvas (CONTRACTS §16.5): pan and zoom over the block,
 * drag a pin to a terminal to wire it, drag a card or node to place it, and
 * add nodes from the keyboard at the pointer. A gesture draws through a
 * preview layout while it runs and is sent as one request when it ends.
 */
import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import type { SystemDocument } from "../model/types";
import { PaperGrid } from "../schematic/canvas-overlays";
import { hitAt, hitOf, toggled } from "../schematic/gestures";
import { capture, isPanButton, useSheetView } from "../schematic/use-sheet-view";
import { panBy, toSheet } from "../schematic/viewport";
import { EndCard } from "./end-card";
import { CableLayer, boundWireIds } from "./harness-cables";
import { moveTo, pointNm, previewLayout, terminalAt } from "./harness-gestures";
import {
  NM_PER_PX,
  layoutHarness,
  terminalPoint,
  type HarnessLayout,
  type Point,
} from "./harness-layout";
import { NodeLayer } from "./harness-nodes";
import type { HarnessView, TerminalView } from "./harness-view";
import { WireLayer } from "./harness-wires";

export type InsertKind = "splice" | "pigtail" | "branch";

interface Props {
  document: SystemDocument;
  view: HarnessView;
  layout: HarnessLayout;
  canEdit: boolean;
  xray: boolean;
  labels: boolean;
  selected: ReadonlySet<string>;
  onSelect: (ids: Set<string>) => void;
  /** A wire was dropped from `from` onto `to`. */
  onWire: (from: TerminalView, to: TerminalView) => void;
  /** A card (its top-left) or node (its centre) was dropped here, in canvas px. */
  onMove: (id: string, at: Point) => void;
  onInsert: (kind: InsertKind, atNm: { xNm: number; yNm: number }) => void;
  onCable: () => void;
  onCovering: () => void;
  onMarker: () => void;
  onDelete: () => void;
  /** An end card was double-clicked. */
  onOpenEnd: (id: string) => void;
  onToggleXray: () => void;
  onToggleLabels: () => void;
}

type Drag =
  | { kind: "pan"; last: Point }
  | { kind: "wire"; from: TerminalView; fromPoint: Point; pointer: Point }
  | { kind: "move"; id: string; grab: Point; point: Point; screen: Point; active: boolean };

/** One canvas pixel is 0.1 mm, the layout's unit (§16.5). */
const SCALE_PER_PX = NM_PER_PX / 1e6;
const THRESHOLD_PX = 3;

/** A drop back on the pin the drag started from is a click, not a wire. */
function sameTerminal(a: TerminalView, b: TerminalView): boolean {
  if (a.kind === "contact" && b.kind === "contact") return a.end === b.end && a.cavity === b.cavity;
  if (a.kind === "splice" && b.kind === "splice") return a.splice === b.splice;
  if (a.kind === "loose" && b.kind === "loose") return a.looseEnd === b.looseEnd;
  return false;
}

export function HarnessCanvas({
  document,
  view,
  layout,
  canEdit,
  xray,
  labels,
  selected,
  onSelect,
  onWire,
  onMove,
  onInsert,
  onCable,
  onCovering,
  onMarker,
  onDelete,
  onOpenEnd,
  onToggleXray,
  onToggleLabels,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const pointer = useRef<Point | null>(null);
  const bounds = useMemo(() => ({ x: 0, y: 0, w: layout.width * NM_PER_PX, h: layout.height * NM_PER_PX }), [layout.width, layout.height]);
  const { view: camera, setView, screenPoint } = useSheetView(container, bounds);
  const moving = useMemo(
    () => (drag?.kind === "move" && drag.active ? { id: drag.id, point: drag.point } : null),
    [drag],
  );
  const placed = useMemo(() => layoutHarness(view, previewLayout(document, moving)), [view, document, moving]);
  const hidden = useMemo(() => (xray ? new Set<string>() : boundWireIds(view)), [xray, view]);

  const pointOf = (event: { clientX: number; clientY: number }): Point => {
    const screen = screenPoint(event);
    const sheet = toSheet(camera, screen);
    return { x: sheet.x / NM_PER_PX, y: sheet.y / NM_PER_PX };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    container.current?.focus();
    const screen = screenPoint(event);
    if (isPanButton(event)) {
      capture(event);
      setDrag({ kind: "pan", last: screen });
      return;
    }
    if (event.button !== 0) return;
    const at = pointOf(event);
    pointer.current = at;
    const hit = hitOf(event.target);
    if (!hit) {
      if (!event.shiftKey) onSelect(new Set());
      return;
    }
    if (hit.hit === "pin") {
      const terminal = terminalAt(view, hit);
      if (!terminal) return;
      onSelect(event.shiftKey ? toggled(selected, hit.id) : new Set([hit.id]));
      if (!canEdit) return;
      capture(event);
      setDrag({ kind: "wire", from: terminal, fromPoint: terminalPoint(placed, terminal) ?? at, pointer: at });
      return;
    }
    if (hit.hit === "wire" || hit.hit === "segment") {
      onSelect(event.shiftKey ? toggled(selected, hit.id) : new Set([hit.id]));
      return;
    }
    if (hit.hit !== "card" && hit.hit !== "node") {
      if (!event.shiftKey) onSelect(new Set());
      return;
    }
    onSelect(event.shiftKey ? toggled(selected, hit.id) : new Set([hit.id]));
    if (!canEdit) return;
    const anchor = hit.hit === "card" ? placed.ends.find((end) => end.id === hit.id) : placed.nodes.find((node) => node.id === hit.id);
    if (!anchor) return;
    const origin = "point" in anchor ? anchor.point : { x: anchor.x, y: anchor.y };
    capture(event);
    setDrag({ kind: "move", id: hit.id, grab: { x: at.x - origin.x, y: at.y - origin.y }, point: origin, screen, active: false });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const screen = screenPoint(event);
    const at = pointOf(event);
    pointer.current = at;
    if (!drag) return;
    if (drag.kind === "pan") {
      setView(panBy(camera, screen.x - drag.last.x, screen.y - drag.last.y));
      setDrag({ ...drag, last: screen });
      return;
    }
    if (drag.kind === "wire") {
      setDrag({ ...drag, pointer: at });
      return;
    }
    if (!drag.active) {
      if (Math.hypot(screen.x - drag.screen.x, screen.y - drag.screen.y) < THRESHOLD_PX) return;
      setDrag({ ...drag, active: true, point: moveTo(at, drag.grab) });
      return;
    }
    setDrag({ ...drag, point: moveTo(at, drag.grab) });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const ended = drag;
    setDrag(null);
    if (!ended || ended.kind === "pan") return;
    if (ended.kind === "move") {
      if (ended.active && canEdit) onMove(ended.id, ended.point);
      return;
    }
    const target = terminalAt(view, hitAt(event));
    if (target && !sameTerminal(ended.from, target)) onWire(ended.from, target);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      onSelect(new Set());
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && !event.altKey) {
      if (!canEdit) return;
      event.preventDefault();
      onDelete();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const at = pointer.current ?? { x: layout.width / 2, y: layout.height / 2 };
    switch (event.key.toLowerCase()) {
      case "s":
        if (canEdit) onInsert("splice", pointNm(at));
        break;
      case "p":
        if (canEdit) onInsert("pigtail", pointNm(at));
        break;
      case "j":
        if (canEdit) onInsert("branch", pointNm(at));
        break;
      case "a":
        if (canEdit) onCable();
        break;
      case "b":
        if (canEdit) onCovering();
        break;
      case "m":
        if (canEdit) onMarker();
        break;
      case "x":
        onToggleXray();
        break;
      case "l":
        onToggleLabels();
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={container}
      tabIndex={0}
      role="application"
      aria-label={`Harness ${view.label} canvas`}
      data-testid="harness-canvas"
      className="relative h-full w-full overflow-hidden outline-none"
      style={{ background: "#fbfaf7", cursor: drag?.kind === "pan" ? "grabbing" : drag?.kind === "wire" ? "crosshair" : "default", touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onDoubleClick={(event) => {
        // The pointer is captured during a press, so the hit comes from the point, not the target.
        const hit = hitAt(event);
        if (hit?.hit === "card") onOpenEnd(hit.id);
      }}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg width="100%" height="100%" className="absolute inset-0 select-none">
        <PaperGrid view={camera} />
        <g transform={`scale(${camera.scale}) translate(${-camera.x / 1e6} ${-camera.y / 1e6}) scale(${SCALE_PER_PX})`}>
          <WireLayer view={view} placed={placed} labels={labels} selected={selected} hidden={hidden} />
          <CableLayer view={view} placed={placed} xray={xray} />
          <NodeLayer view={view} placed={placed} selected={selected} />
          {placed.ends.map((end) => {
            const item = view.ends.find((candidate) => candidate.id === end.id);
            return item ? <EndCard key={end.id} end={item} placed={end} selected={selected.has(end.id)} /> : null;
          })}
          {drag?.kind === "wire" && (
            <line
              x1={drag.fromPoint.x}
              y1={drag.fromPoint.y}
              x2={drag.pointer.x}
              y2={drag.pointer.y}
              stroke="#0ea5e9"
              strokeWidth={1.6}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          )}
        </g>
      </svg>
      {view.pending && (
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-amber-100 px-2 py-1 text-xs text-amber-900 shadow">
          Building the wire list…
        </div>
      )}
      <div className="pointer-events-none absolute right-3 top-3 text-[11px] text-[#64748b]">
        Drag pin → pin to wire · S splice · P pigtail · J branch point
      </div>
    </div>
  );
}
