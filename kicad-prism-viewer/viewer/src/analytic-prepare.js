// What the analytic renderer uploads, prepared from lowered slices without a
// GPU (V2a): pure functions of the lowered arrays, so the lowering workers run
// them and the lowered-slice cache keeps their output. The main thread then
// only creates buffers; a board opened again prepares nothing.

import { COVER_WORDS, EDGE_SKIRT, EDGE_SUBTRACT, EDGE_WORDS, SHAPE_WORDS } from "./analytic-shaders.js";

/** A shape record's bounds on the board (millimetres): its local bounds through its affine. */
export function recordBounds(words, index) {
  const f = new Float32Array(words.buffer, words.byteOffset + index * SHAPE_WORDS * 4, SHAPE_WORDS);
  const [m11, m12, m21, m22, tx, ty] = [f[4], f[5], f[6], f[7], f[8], f[9]];
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of [[f[10], f[11]], [f[12], f[11]], [f[10], f[13]], [f[12], f[13]]]) {
    const bx = m11 * x + m12 * y + tx;
    const by = m21 * x + m22 * y + ty;
    box[0] = Math.min(box[0], bx);
    box[1] = Math.min(box[1], by);
    box[2] = Math.max(box[2], bx);
    box[3] = Math.max(box[3], by);
  }
  return box;
}

/**
 * What a slab's walls need. The region edges they rise from, `EDGE_WORDS`
 * words each: the adding regions' contour edges (a subtracting region's
 * edges bound nothing drawn), each with its holes' range; then each add
 * shape's outline skirt, tagged with the shape. And the cuts: each add
 * shape's holes' range, then the hole records the ranges name. Returns
 * `{ edgeWords, cutWords, regionEdges, skirtEdges }`.
 */
export function packEdges(lowered) {
  const edges = lowered.contourEdges || new Float32Array(0);
  const operations = lowered.contourEdgeOperations || new Uint32Array(0);
  const shapeCuts = lowered.shapeCuts || new Uint32Array(0);
  const edgeCuts = lowered.edgeCuts || new Uint32Array(0);
  const indices = lowered.cutIndices || new Uint32Array(0);
  // Ranges point past the shapes' ranges, into the records that follow them.
  const base = shapeCuts.length;
  const cutWords = new Uint32Array(Math.max(1, base + indices.length));
  for (let i = 0; i < base; i += 2) {
    cutWords[i] = shapeCuts[i] + base;
    cutWords[i + 1] = shapeCuts[i + 1];
  }
  cutWords.set(indices, base);
  const outlines = lowered.outlineEdges || new Float32Array(0);
  const shapes = lowered.outlineShapes || new Uint32Array(0);
  const count = Math.min(edges.length / 4, operations.length);
  const edgeWords = new Uint32Array(Math.max(1, count + shapes.length) * EDGE_WORDS);
  const bits = new Uint32Array(edges.buffer, edges.byteOffset, edges.length);
  let kept = 0;
  for (let edge = 0; edge < count; edge += 1) {
    if (operations[edge] & EDGE_SUBTRACT) continue;
    const at = kept * EDGE_WORDS;
    edgeWords[at] = bits[edge * 4];
    edgeWords[at + 1] = bits[edge * 4 + 1];
    edgeWords[at + 2] = bits[edge * 4 + 2];
    edgeWords[at + 3] = bits[edge * 4 + 3];
    edgeWords[at + 4] = operations[edge];
    edgeWords[at + 5] = (edgeCuts[edge * 2] ?? 0) + base;
    edgeWords[at + 6] = edgeCuts[edge * 2 + 1] ?? 0;
    kept += 1;
  }
  const regionEdges = kept;
  const outlineBits = new Uint32Array(outlines.buffer, outlines.byteOffset, outlines.length);
  for (let edge = 0; edge < shapes.length; edge += 1) {
    const at = kept * EDGE_WORDS;
    edgeWords[at] = outlineBits[edge * 4];
    edgeWords[at + 1] = outlineBits[edge * 4 + 1];
    edgeWords[at + 2] = outlineBits[edge * 4 + 2];
    edgeWords[at + 3] = outlineBits[edge * 4 + 3];
    edgeWords[at + 4] = (EDGE_SKIRT | shapes[edge]) >>> 0;
    kept += 1;
  }
  return { edgeWords, cutWords, regionEdges, skirtEdges: kept - regionEdges };
}

/** A lowered slice with its packed edges (see `packEdges`), packing them if it has none. */
export function withPackedEdges(lowered) {
  return lowered.edgeWords ? lowered : Object.assign(lowered, packEdges(lowered));
}


/**
 * For a mask's step around its side's outer `copper` (both lowered): the
 * copper's shapes with the mask's opening shapes after them, and the edges
 * and cuts (`packEdges`) that list, per copper shape and region edge, the
 * openings that reach it, by bounds grown by `growMm`. Returns
 * `{ shapes, edgeWords, cutWords, regionEdges, skirtEdges }`.
 */
export function planOpenings(copper, mask, growMm = 0.05) {
  const openings = mask.shapes.subarray(0, mask.subtractShapes * SHAPE_WORDS);
  const base = copper.shapes.length / SHAPE_WORDS;
  const shapes = new Uint32Array(copper.shapes.length + openings.length);
  shapes.set(copper.shapes);
  shapes.set(openings, copper.shapes.length);
  const count = openings.length / SHAPE_WORDS;
  const boxes = new Float64Array(count * 4);
  let [gx0, gy0, gx1, gy1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i += 1) {
    const box = recordBounds(openings, i);
    boxes.set(box, i * 4);
    gx0 = Math.min(gx0, box[0]);
    gy0 = Math.min(gy0, box[1]);
    gx1 = Math.max(gx1, box[2]);
    gy1 = Math.max(gy1, box[3]);
  }
  // Openings by 1 mm cell of the board, as a counting sort: `starts` per
  // cell into `members`. Cells are walked x outer, y inner, so each shape's
  // openings come in the order a cell-by-cell search finds them.
  const [ox, oy] = [Math.floor(gx0), Math.floor(gy0)];
  const columns = count ? Math.floor(gx1) - ox + 1 : 0;
  const rows = count ? Math.floor(gy1) - oy + 1 : 0;
  const cellOf = (value, origin, size) => Math.min(size - 1, Math.max(0, Math.floor(value) - origin));
  const starts = new Uint32Array(columns * rows + 1);
  const visit = (i, each) => {
    const [x0, x1] = [cellOf(boxes[i * 4], ox, columns), cellOf(boxes[i * 4 + 2], ox, columns)];
    const [y0, y1] = [cellOf(boxes[i * 4 + 1], oy, rows), cellOf(boxes[i * 4 + 3], oy, rows)];
    for (let x = x0; x <= x1; x += 1) for (let y = y0; y <= y1; y += 1) each(x * rows + y);
  };
  for (let i = 0; i < count; i += 1) visit(i, (cell) => { starts[cell + 1] += 1; });
  for (let cell = 0; cell < columns * rows; cell += 1) starts[cell + 1] += starts[cell];
  const members = new Uint32Array(starts[columns * rows]);
  const fill = starts.slice(0, columns * rows);
  for (let i = 0; i < count; i += 1) visit(i, (cell) => { members[fill[cell]++] = i; });
  const indices = [];
  const ranges = [];
  const seen = new Uint32Array(count);
  let stamp = 0;
  const reach = (bx0, by0, bx1, by1) => {
    const first = indices.length;
    stamp += 1;
    if (count && Math.floor(bx1) >= ox && Math.floor(bx0) <= ox + columns - 1 && Math.floor(by1) >= oy && Math.floor(by0) <= oy + rows - 1) {
      const [x0, x1] = [cellOf(bx0, ox, columns), cellOf(bx1, ox, columns)];
      const [y0, y1] = [cellOf(by0, oy, rows), cellOf(by1, oy, rows)];
      for (let x = x0; x <= x1; x += 1) {
        for (let y = y0; y <= y1; y += 1) {
          const cell = x * rows + y;
          for (let m = starts[cell]; m < starts[cell + 1]; m += 1) {
            const i = members[m];
            if (seen[i] === stamp) continue;
            seen[i] = stamp;
            if (boxes[i * 4] <= bx1 && bx0 <= boxes[i * 4 + 2] && boxes[i * 4 + 1] <= by1 && by0 <= boxes[i * 4 + 3]) indices.push(base + i);
          }
        }
      }
    }
    ranges.push(first, indices.length - first);
  };
  for (let i = copper.subtractShapes; i < base; i += 1) {
    const box = recordBounds(copper.shapes, i);
    reach(box[0] - growMm, box[1] - growMm, box[2] + growMm, box[3] + growMm);
  }
  const shapeCount = base - copper.subtractShapes;
  const edges = copper.contourEdges || new Float32Array(0);
  for (let e = 0; e + 3 < edges.length; e += 4) {
    reach(Math.min(edges[e], edges[e + 2]) - growMm, Math.min(edges[e + 1], edges[e + 3]) - growMm,
      Math.max(edges[e], edges[e + 2]) + growMm, Math.max(edges[e + 1], edges[e + 3]) + growMm);
  }
  const packed = packEdges({
    ...copper,
    shapeCuts: new Uint32Array(ranges.slice(0, shapeCount * 2)),
    edgeCuts: new Uint32Array(ranges.slice(shapeCount * 2)),
    cutIndices: new Uint32Array(indices),
  });
  return { shapes, ...packed };
}

/**
 * The conformal mask steps a board draws: each mask with a lower face
 * (`zLow`) and its side's outer copper (the copper slice that marks the
 * stencil, on the same face side), as `[mask, copper]` pairs of slices.
 */
export function maskSteps(slices) {
  const pairs = [];
  for (const mask of slices) {
    if (mask.role !== "mask" || mask.zLow === undefined) continue;
    const copper = slices.find((other) => other.role === "copper" && other.mark && other.faceDown === mask.faceDown);
    if (copper) pairs.push([mask, copper]);
  }
  return pairs;
}

/** The cache name of a mask step's openings (see `planOpenings`). */
export function stepKey(mask, copper) {
  return `step:${mask.key}:${copper.key}`;
}

/**
 * A dielectric slice as a plain slab: its regions' contours (the board
 * outline and cutouts) with no drill holes, as one stencil fan from the
 * first contour point and one cover over the contours' bounds. A separated
 * stack draws its laminate so (V2a, maintainer 2026-10-19): the vias there
 * are ghost tubes, and the holes' tiled fill cost most of an exploded frame.
 * Null for a slice with no contour.
 */
export function plainSlab(lowered) {
  const edges = lowered.contourEdges || new Float32Array(0);
  const operations = lowered.contourEdgeOperations || new Uint32Array(0);
  const kept = [];
  for (let e = 0; e < operations.length && e * 4 + 3 < edges.length; e += 1) {
    if (!(operations[e] & EDGE_SUBTRACT)) kept.push(e);
  }
  if (!kept.length) return null;
  const [px, py] = [edges[kept[0] * 4], edges[kept[0] * 4 + 1]];
  const fanVertices = new Float32Array(kept.length * 6);
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const contourEdges = new Float32Array(kept.length * 4);
  const contourEdgeOperations = new Uint32Array(kept.length);
  kept.forEach((e, i) => {
    const [x0, y0, x1, y1] = edges.subarray(e * 4, e * 4 + 4);
    fanVertices.set([px, py, x0, y0, x1, y1], i * 6);
    contourEdges.set([x0, y0, x1, y1], i * 4);
    contourEdgeOperations[i] = operations[e];
    bounds[0] = Math.min(bounds[0], x0, x1);
    bounds[1] = Math.min(bounds[1], y0, y1);
    bounds[2] = Math.max(bounds[2], x0, x1);
    bounds[3] = Math.max(bounds[3], y0, y1);
  });
  // The cover: the region's operation, no flags, then its bounds as float bits.
  const covers = new Uint32Array(COVER_WORDS);
  covers[0] = operations[kept[0]];
  covers.set(new Uint32Array(Float32Array.from(bounds).buffer), 2);
  return withPackedEdges({
    shapes: new Uint32Array(0),
    subtractShapes: 0,
    fanVertices,
    covers,
    batches: new Uint32Array([0, 0, kept.length * 3, 0, 1]),
    contourEdges,
    contourEdgeOperations,
  });
}
