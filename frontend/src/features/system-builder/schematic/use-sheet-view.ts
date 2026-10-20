/**
 * A sheet canvas's viewport, shared by the root sheet and board sheets: the
 * first size fits the drawing, after which the view is the user's; scroll
 * pans, pinch or Ctrl/⌘ + scroll zooms at the cursor; `fit` shows it all.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import { useCommittedRef } from "@/hooks/use-committed-ref";

import type { Point, Rect } from "./geometry";
import { fitView, panBy, zoomAt, type View } from "./viewport";

const DEFAULT_VIEW: View = { x: 0, y: 0, scale: 6 };
/** Room round a fitted drawing; the tool palette sits over the bottom edge. */
const FIT_MARGIN_PX = 72;

export function useSheetView(container: RefObject<HTMLDivElement | null>, bounds: Rect) {
  const size = useRef({ width: 0, height: 0 });
  const [view, setView] = useState<View | null>(null);
  const boundsRef = useCommittedRef(bounds);
  const current = view ?? DEFAULT_VIEW;
  const currentRef = useCommittedRef(current);

  // The canvas's size, from the browser (an external lifecycle).
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const first = size.current.width === 0;
      size.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      if (first && size.current.width > 0) setView(fitView(boundsRef.current, size.current.width, size.current.height, FIT_MARGIN_PX));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [container, boundsRef]);

  // React's wheel listener is passive, so this one is attached by hand.
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
  }, [container, currentRef]);

  const fit = () => {
    if (size.current.width > 0) setView(fitView(boundsRef.current, size.current.width, size.current.height, FIT_MARGIN_PX));
  };
  const screenPoint = (event: { clientX: number; clientY: number }): Point => {
    const box = container.current?.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  };
  return { view: current, setView, fit, screenPoint };
}

/** Pan as KiCad does: right or middle drag (Alt + left drag for trackpads). */
export function isPanButton(event: { button: number; altKey: boolean }): boolean {
  return event.button === 2 || event.button === 1 || (event.button === 0 && event.altKey);
}

/** Keep the pointer's events while a gesture runs; a pointer the browser no longer tracks cannot be captured, and the gesture still works without it. */
export function capture(event: ReactPointerEvent<Element>) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Not an active pointer (a synthetic event); nothing to capture.
  }
}
