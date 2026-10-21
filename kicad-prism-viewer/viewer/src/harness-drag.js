// The Route tool's drag state machine (System Builder 4c): a press remembers
// where it started; it becomes a drag only once the pointer moves past the
// click threshold, and then reports `start` once and `move` on every further
// move. Pure, so main.js only projects and dispatches.

import { dragInViewPlane, isDrag } from "./route-drag.js";

/**
 * A pending press on a tube or handle. `target` is `{kind, id}`; `fromMm` is
 * the picked tube point or the handle's position, in world mm; `basis` is the
 * camera's `{right, up}` and `pxPerMm` the scale there.
 */
export function beginHarnessDrag({ harness, target, fromMm, startPx, basis, pxPerMm }) {
  return {
    harness,
    target: { kind: target.kind, id: target.id },
    fromMm: [...fromMm],
    pointMm: [...fromMm],
    startPx: [...startPx],
    basis: { right: [...basis.right], up: [...basis.up] },
    pxPerMm,
    moved: false,
  };
}

/**
 * Advance a pending press to `nowPx`: null while it is still a click; otherwise
 * `{drag, phase}` where `phase` is `start` on the move that crosses the
 * threshold and `move` after that.
 */
export function advanceHarnessDrag(drag, nowPx, thresholdPx = 3) {
  if (!drag) return null;
  if (!drag.moved && !isDrag(drag.startPx, nowPx, thresholdPx)) return null;
  const pointMm = dragInViewPlane(
    drag.fromMm,
    nowPx[0] - drag.startPx[0],
    nowPx[1] - drag.startPx[1],
    drag.pxPerMm,
    drag.basis,
  );
  return {
    drag: { ...drag, moved: true, pointMm },
    phase: drag.moved ? "move" : "start",
  };
}

/** What an `end` or `cancel` reports for the drag's last point. */
export function settleHarnessDrag(drag) {
  return {
    harness: drag.harness,
    target: drag.target,
    fromMm: [...drag.fromMm],
    pointMm: [...drag.pointMm],
  };
}
