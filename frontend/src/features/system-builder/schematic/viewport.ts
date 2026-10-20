/**
 * The canvas viewport: which part of the sheet is on screen. The sheet is in
 * nanometres; the view keeps its origin in nanometres and a scale in screen
 * pixels per millimetre, so zoom levels read like KiCad's.
 */
import type { Point, Rect } from "./geometry";

export interface View {
  /** Sheet point at the canvas's top-left corner, nanometres. */
  x: number;
  y: number;
  /** Screen pixels per millimetre. */
  scale: number;
}

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 80;
const NM_PER_MM = 1_000_000;

export function toSheet(view: View, screen: Point): Point {
  return { x: view.x + (screen.x / view.scale) * NM_PER_MM, y: view.y + (screen.y / view.scale) * NM_PER_MM };
}

export function toScreen(view: View, sheet: Point): Point {
  return { x: ((sheet.x - view.x) / NM_PER_MM) * view.scale, y: ((sheet.y - view.y) / NM_PER_MM) * view.scale };
}

/** Zoom by `factor` keeping the sheet point under `screen` where it is. */
export function zoomAt(view: View, screen: Point, factor: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
  const anchor = toSheet(view, screen);
  return {
    scale,
    x: anchor.x - (screen.x / scale) * NM_PER_MM,
    y: anchor.y - (screen.y / scale) * NM_PER_MM,
  };
}

export function panBy(view: View, dxPx: number, dyPx: number): View {
  return { ...view, x: view.x - (dxPx / view.scale) * NM_PER_MM, y: view.y - (dyPx / view.scale) * NM_PER_MM };
}

/** The view that shows `bounds` in a `width` × `height` canvas with a margin. */
export function fitView(bounds: Rect, width: number, height: number, marginPx = 48): View {
  if (bounds.w <= 0 && bounds.h <= 0) return { x: -10 * NM_PER_MM, y: -10 * NM_PER_MM, scale: 6 };
  const usableW = Math.max(1, width - 2 * marginPx);
  const usableH = Math.max(1, height - 2 * marginPx);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(usableW / (bounds.w / NM_PER_MM || 1), usableH / (bounds.h / NM_PER_MM || 1))));
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  return { scale, x: cx - (width / 2 / scale) * NM_PER_MM, y: cy - (height / 2 / scale) * NM_PER_MM };
}
