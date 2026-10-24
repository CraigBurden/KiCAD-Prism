// Route mode bends a harness by dragging it. A press on a tube (or on a
// handle) and a drag move the point in the plane facing the camera through
// where it started, at the screen's scale there. Pure, for tests.

/** A world point (mm) `startMm` moved by a screen drag of (dx, dy) px, `pxPerMm` at that point. */
export function dragInViewPlane(startMm, dx, dy, pxPerMm, { right, up }) {
  if (!(pxPerMm > 0)) return [...startMm];
  const across = dx / pxPerMm;
  const rise = -dy / pxPerMm; // screen y grows downward
  return startMm.map((value, k) => value + right[k] * across + up[k] * rise);
}

/** Whether a press moved far enough to be a drag rather than a click. */
export function isDrag(start, now, thresholdPx = 3) {
  return Math.hypot(now[0] - start[0], now[1] - start[1]) >= thresholdPx;
}
