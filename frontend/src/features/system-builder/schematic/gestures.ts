/**
 * The root sheet's pointer gestures, as pure functions: what a pointer hit,
 * what a drag box selects, and the layout override a drag in progress makes.
 * The canvas keeps the gesture's state and draws the result.
 */
import type { SystemBundle, SystemDocument } from "../model/types";
import { dragRoute, movePort, moveSymbols, resizeSymbol, withFollowingRoutes, type Layout } from "./edits";
import {
  boundsOf,
  rectContains,
  rectTouchesRoute,
  rectsTouch,
  resize,
  slidePort,
  type Handle,
  type Point,
  type Rect,
} from "./geometry";
import type { Scene, SceneOptions } from "./scene";

export type Drag =
  | { kind: "pan"; last: Point }
  | { kind: "box"; start: Point; current: Point }
  | { kind: "move"; ids: string[]; start: Point; active: boolean; screen: Point }
  | { kind: "port"; item: string; key: string; active: boolean; screen: Point }
  | { kind: "resize"; item: string; handle: Handle }
  | { kind: "segment"; id: string; index: number; active: boolean; screen: Point };

/** The tagged element under the pointer (`data-hit`, see sheet-svg). */
export function hitOf(target: EventTarget | null): { hit: string; id: string; key: string } | null {
  const element = (target as Element | null)?.closest?.("[data-hit]");
  if (!element) return null;
  return { hit: element.getAttribute("data-hit") ?? "", id: element.getAttribute("data-id") ?? "", key: element.getAttribute("data-key") ?? "" };
}

/** KiCad's drag selection (§14.3): a window takes what it encloses, a crossing what it touches. */
export function boxSelection(scene: Scene, rect: Rect, mode: "window" | "crossing"): Set<string> {
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

export function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * The layout override a layout drag makes with the pointer at `at`, with the
 * stored routes that follow it; `null` when the drag changes nothing (a pin
 * dropped on a taken spot keeps its last good place).
 */
export function dragLayout(
  drag: Drag,
  at: Point,
  document: SystemDocument,
  bundle: SystemBundle | undefined,
  base: Scene,
  options: SceneOptions,
): Layout | null {
  const symbolOf = (id: string) => base.symbols.find((item) => item.id === id);
  let next: Layout | null = null;
  if (drag.kind === "move") {
    next = moveSymbols(document, base, drag.ids, { x: at.x - drag.start.x, y: at.y - drag.start.y });
  } else if (drag.kind === "port") {
    const symbol = symbolOf(drag.item);
    if (!symbol) return null;
    const others = symbol.ports.filter((port) => port.key !== drag.key);
    const placed = slidePort(symbol.rect, { widthNm: symbol.rect.w, heightNm: symbol.rect.h }, at, others, symbol.corner);
    if (!placed) return null;
    next = movePort(document, base, drag.item, drag.key, placed);
  } else if (drag.kind === "resize") {
    const symbol = symbolOf(drag.item);
    if (!symbol) return null;
    const ports = Object.fromEntries(symbol.ports.map((port) => [port.key, { edge: port.edge, offsetNm: port.offsetNm }]));
    const resized = resize(symbol.rect, drag.handle, at, ports, symbol.corner);
    next = resizeSymbol(document, base, drag.item, resized.rect, resized.ports);
  } else if (drag.kind === "segment") {
    return dragRoute(document, base, drag.id, drag.index, at);
  }
  return next && withFollowingRoutes(document, bundle, base, next, options);
}
