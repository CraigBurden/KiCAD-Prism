// The board clip (V2a): KiCad's 3D view draws nothing beyond the board's
// outline, so copper, mask, paste and silkscreen drawn there (text off the
// edge, a fabrication table) are discarded by the analytic shaders
// (`outsideBoard`). The clip is the board body's outline rasterised on the CPU,
// even-odd, from its lowered contour edges: no GPU pipeline compiles for it.

/** The clip's longer side, in texels (about 0.2 mm on a 300 mm board). */
export const BOARD_CLIP_PIXELS = 1536;

/**
 * Rasterise `edges` (the board body's contour edges: x0, y0, x1, y1 per edge,
 * board millimetres, y down) into a mask, 1 inside the board and 0 outside,
 * one byte per texel, rows along +y. Returns `{ data, width, height,
 * originMm, pitchMm }`, or null without edges.
 */
export function rasterizeBoardClip(edges, maxPixels = BOARD_CLIP_PIXELS) {
  if (!edges || edges.length < 12) return null;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 3 < edges.length; i += 4) {
    x0 = Math.min(x0, edges[i], edges[i + 2]);
    x1 = Math.max(x1, edges[i], edges[i + 2]);
    y0 = Math.min(y0, edges[i + 1], edges[i + 3]);
    y1 = Math.max(y1, edges[i + 1], edges[i + 3]);
  }
  const pad = 1;
  [x0, y0, x1, y1] = [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  const pitch = Math.max(Math.max(x1 - x0, y1 - y0) / maxPixels, 0.02);
  const width = Math.max(1, Math.ceil((x1 - x0) / pitch));
  const height = Math.max(1, Math.ceil((y1 - y0) / pitch));
  const data = new Uint8Array(width * height);
  // Edges by the rows they span, so each row tests only its own.
  const rows = Array.from({ length: height }, () => []);
  for (let i = 0; i + 3 < edges.length; i += 4) {
    const [ax, ay, bx, by] = [edges[i], edges[i + 1], edges[i + 2], edges[i + 3]];
    if (ay === by) continue;
    const first = Math.max(0, Math.ceil((Math.min(ay, by) - y0) / pitch - 0.5));
    const last = Math.min(height - 1, Math.floor((Math.max(ay, by) - y0) / pitch - 0.5));
    for (let row = first; row <= last; row += 1) rows[row].push(i);
  }
  const crossings = [];
  for (let row = 0; row < height; row += 1) {
    const y = y0 + (row + 0.5) * pitch;
    crossings.length = 0;
    for (const i of rows[row]) {
      const [ax, ay, bx, by] = [edges[i], edges[i + 1], edges[i + 2], edges[i + 3]];
      // Half-open in y, so a vertex shared by two edges counts once.
      if ((ay <= y) === (by <= y)) continue;
      crossings.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
    crossings.sort((a, b) => a - b);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil((crossings[k] - x0) / pitch - 0.5));
      const to = Math.min(width - 1, Math.floor((crossings[k + 1] - x0) / pitch - 0.5));
      if (to >= from) data.fill(1, row * width + from, row * width + to + 1);
    }
  }
  return { data, width, height, originMm: [x0, y0], pitchMm: pitch };
}
