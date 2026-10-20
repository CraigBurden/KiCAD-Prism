/**
 * The root sheet canvas (CONTRACTS §14.3): pan and zoom, KiCad selection,
 * moving symbols, sliding pins, resizing sheets, editing routes, and drawing
 * mates and harness links. A gesture draws through a layout override while it
 * runs and is sent as one request when it ends.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";

import { useCommittedRef } from "@/hooks/use-committed-ref";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import { CanvasHints, GestureOverlay, PaperGrid } from "./canvas-overlays";
import { connectRefusal, harnessOps, layoutOps, mateOps, removeOps, type Layout, type PinRef } from "./edits";
import { normalizeRect, selectionMode, type Handle, type Point } from "./geometry";
import { boxSelection, dragLayout, hitOf, toggled, type Drag } from "./gestures";
import { buildScene } from "./scene";
import { COLOURS, SheetSvg } from "./sheet-svg";
import { fitView, panBy, toSheet, zoomAt, type View } from "./viewport";

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
}

/** What the page may ask of the canvas. */
export interface RootSheetHandle {
  /** Show the whole sheet. */
  fit: () => void;
}

const THRESHOLD_PX = 3;
const DEFAULT_VIEW: View = { x: 0, y: 0, scale: 6 };
/** Room round a fitted sheet; the tool palette sits over the bottom edge. */
const FIT_MARGIN_PX = 72;

export const RootSheetCanvas = forwardRef<RootSheetHandle, Props>(function RootSheetCanvas(
  { document, bundle, projectNames, selected, onSelect, canEdit, apply, tool, onToolChange },
  handle,
) {
  const container = useRef<HTMLDivElement>(null);
  const size = useRef({ width: 0, height: 0 });
  const [view, setView] = useState<View | null>(null);
  const [override, setOverride] = useState<Layout | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [connectFrom, setConnectFrom] = useState<PinRef | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);

  const options = useMemo(() => ({ projectNames }), [projectNames]);
  const base = useMemo(() => buildScene(document, bundle, options), [document, bundle, options]);
  const scene = useMemo(() => (override ? buildScene(document, bundle, { ...options, override }) : base), [override, document, bundle, options, base]);

  const baseRef = useCommittedRef(base);

  // The canvas's size, from the browser (an external lifecycle).
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const first = size.current.width === 0;
      size.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      // The first size shows the whole sheet; after that the view is the user's.
      if (first && size.current.width > 0) setView(fitView(baseRef.current.bounds, size.current.width, size.current.height, FIT_MARGIN_PX));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [baseRef]);

  const current = view ?? DEFAULT_VIEW;
  const currentRef = useCommittedRef(current);
  const fit = () => {
    if (size.current.width > 0) setView(fitView(baseRef.current.bounds, size.current.width, size.current.height, FIT_MARGIN_PX));
  };
  useImperativeHandle(handle, () => ({ fit }));

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
    const next = dragLayout(drag, at, document, bundle, base, options);
    if (next) setOverride(next);
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
    if (event.key === "Home" || event.key === "f") fit();
  };

  const selectedPorts = useMemo(() => new Set(connectFrom ? [`${connectFrom.item}\u0000${connectFrom.key}`] : []), [connectFrom]);
  const resizable = useMemo(
    () => new Set(canEdit && tool === "select" ? [...selected].filter((id) => scene.symbols.some((symbol) => symbol.id === id)) : []),
    [canEdit, tool, selected, scene],
  );

  const transform = `scale(${current.scale}) translate(${-current.x / 1e6} ${-current.y / 1e6})`;

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
        <PaperGrid view={current} />
        <g transform={transform}>
          <SheetSvg scene={scene} selected={selected} selectedPorts={selectedPorts} resizable={resizable} />
          <GestureOverlay scene={scene} connectFrom={connectFrom} pointer={pointer} drag={drag} kind={tool === "mate" ? "mate" : "harness"} />
        </g>
      </svg>
      <CanvasHints empty={scene.symbols.length === 0} tool={tool} connectFrom={connectFrom} document={document} />
    </div>
  );
});
