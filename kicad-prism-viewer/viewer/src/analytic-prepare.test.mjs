import assert from "node:assert/strict";
import test from "node:test";

import { maskSteps, packEdges, plainSlab, planOpenings, recordBounds } from "./analytic-prepare.js";
import { COVER_WORDS, EDGE_SKIRT, EDGE_SUBTRACT, EDGE_WORDS, SHAPE_WORDS } from "./analytic-shaders.js";

/** Shape records with an identity affine over the given local boxes. */
function shapes(boxes) {
  const words = new Uint32Array(boxes.length * SHAPE_WORDS);
  const floats = new Float32Array(words.buffer);
  boxes.forEach(([x0, y0, x1, y1], i) => {
    floats.set([1, 0, 0, 1, 0, 0, x0, y0, x1, y1], i * SHAPE_WORDS + 4);
  });
  return words;
}

/** A small deterministic generator, so the boards below are the same every run. */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function boxesOn(rand, count, size, span) {
  return Array.from({ length: count }, () => {
    const [x, y] = [rand() * span, rand() * span];
    return [x, y, x + rand() * size, y + rand() * size];
  });
}

// The renderer's planning before V2a moved it here: string-keyed 1 mm cells.
function referenceOpenings(copper, mask) {
  const openings = mask.shapes.subarray(0, mask.subtractShapes * SHAPE_WORDS);
  const base = copper.shapes.length / SHAPE_WORDS;
  const cells = new Map();
  const cell = (x, y) => `${Math.floor(x)},${Math.floor(y)}`;
  const boxes = [];
  for (let i = 0; i < openings.length / SHAPE_WORDS; i += 1) {
    const box = recordBounds(openings, i);
    boxes.push(box);
    for (let x = Math.floor(box[0]); x <= Math.floor(box[2]); x += 1) {
      for (let y = Math.floor(box[1]); y <= Math.floor(box[3]); y += 1) {
        const key = cell(x, y);
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(i);
      }
    }
  }
  const indices = [];
  const ranges = [];
  const reach = (box) => {
    const found = new Set();
    for (let x = Math.floor(box[0]); x <= Math.floor(box[2]); x += 1) {
      for (let y = Math.floor(box[1]); y <= Math.floor(box[3]); y += 1) {
        for (const i of cells.get(cell(x, y)) || []) {
          const b = boxes[i];
          if (b[0] <= box[2] && box[0] <= b[2] && b[1] <= box[3] && box[1] <= b[3]) found.add(i);
        }
      }
    }
    ranges.push(indices.length, found.size);
    for (const i of found) indices.push(base + i);
  };
  const grow = (box) => [box[0] - 0.05, box[1] - 0.05, box[2] + 0.05, box[3] + 0.05];
  for (let i = copper.subtractShapes; i < base; i += 1) reach(grow(recordBounds(copper.shapes, i)));
  const shapeCount = base - copper.subtractShapes;
  const edges = copper.contourEdges;
  for (let e = 0; e + 3 < edges.length; e += 4) reach(grow([Math.min(edges[e], edges[e + 2]), Math.min(edges[e + 1], edges[e + 3]), Math.max(edges[e], edges[e + 2]), Math.max(edges[e + 1], edges[e + 3])]));
  return { shapeCuts: ranges.slice(0, shapeCount * 2), edgeCuts: ranges.slice(shapeCount * 2), cutIndices: indices };
}

test("mask openings match the cell search they replace, order included", () => {
  const rand = random(7);
  const copperBoxes = boxesOn(rand, 400, 3, 40);
  const copper = {
    shapes: shapes(copperBoxes),
    subtractShapes: 20,
    contourEdges: new Float32Array(boxesOn(rand, 60, 4, 40).flat()),
    contourEdgeOperations: new Uint32Array(60),
  };
  const maskBoxes = boxesOn(rand, 300, 1.5, 40);
  const mask = { shapes: shapes(maskBoxes), subtractShapes: 250 };
  const planned = planOpenings(copper, mask);
  const reference = referenceOpenings(copper, mask);
  const expected = packEdges({ ...copper, shapeCuts: new Uint32Array(reference.shapeCuts), edgeCuts: new Uint32Array(reference.edgeCuts), cutIndices: new Uint32Array(reference.cutIndices) });
  assert.ok(reference.cutIndices.length > 200, `the board has enough overlap to be a test (${reference.cutIndices.length})`);
  assert.deepEqual(planned.cutWords, expected.cutWords);
  assert.deepEqual(planned.edgeWords, expected.edgeWords);
  assert.equal(planned.shapes.length, copper.shapes.length + 250 * SHAPE_WORDS);
});

test("a mask with no openings reaches nothing", () => {
  const copper = { shapes: shapes([[0, 0, 1, 1]]), subtractShapes: 0, contourEdges: new Float32Array(0), contourEdgeOperations: new Uint32Array(0) };
  const planned = planOpenings(copper, { shapes: new Uint32Array(0), subtractShapes: 0 });
  assert.deepEqual([...planned.cutWords], [2, 0]);
});

test("packed edges keep adding regions' edges, then the shapes' outline skirts", () => {
  const edges = new Float32Array([0, 0, 1, 0, 1, 0, 1, 1, 5, 5, 6, 5]);
  const packed = packEdges({
    contourEdges: edges,
    contourEdgeOperations: new Uint32Array([3, (EDGE_SUBTRACT | 4) >>> 0, 5]),
    edgeCuts: new Uint32Array([0, 1, 1, 0, 1, 2]),
    shapeCuts: new Uint32Array([0, 2]),
    cutIndices: new Uint32Array([9, 8, 7]),
    outlineEdges: new Float32Array([2, 2, 3, 3]),
    outlineShapes: new Uint32Array([1]),
  });
  assert.equal(packed.regionEdges, 2);
  assert.equal(packed.skirtEdges, 1);
  assert.deepEqual([...packed.cutWords], [2, 2, 9, 8, 7]);
  const words = packed.edgeWords;
  assert.deepEqual([...words.subarray(4, 7)], [3, 2, 1]);
  assert.deepEqual([...words.subarray(EDGE_WORDS + 4, EDGE_WORDS + 7)], [5, 3, 2]);
  assert.equal(words[2 * EDGE_WORDS + 4], (EDGE_SKIRT | 1) >>> 0);
});

test("each mask with a lower face steps over its side's marking copper", () => {
  const slices = [
    { key: "mask.front", role: "mask", zLow: 1, faceDown: false },
    { key: "copper.front", role: "copper", mark: true, faceDown: false },
    { key: "copper.back", role: "copper", mark: true, faceDown: true },
    { key: "mask.back", role: "mask", zLow: -1, faceDown: true },
    { key: "mask.flat", role: "mask", faceDown: false },
  ];
  assert.deepEqual(maskSteps(slices).map(([mask, copper]) => [mask.key, copper.key]), [["mask.front", "copper.front"], ["mask.back", "copper.back"]]);
});

test("a plain slab is its outline and cutouts as one fan and one cover, without holes", () => {
  // A 10 x 6 board with a square cutout (clockwise), and a subtracting region's edge to drop.
  const square = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y0, x1, y1, x1, y1, x0, y1, x0, y1, x0, y0];
  const contourEdges = new Float32Array([...square(0, 0, 10, 6), ...square(4, 2, 6, 4), 1, 1, 2, 2]);
  const plain = plainSlab({
    shapes: new Uint32Array(SHAPE_WORDS * 3),
    subtractShapes: 3,
    contourEdges,
    contourEdgeOperations: new Uint32Array([7, 7, 7, 7, 7, 7, 7, 7, (EDGE_SUBTRACT | 9) >>> 0]),
  });
  assert.equal(plain.subtractShapes, 0);
  assert.equal(plain.shapes.length, 0);
  assert.equal(plain.fanVertices.length, 8 * 6, "one triangle per kept edge");
  assert.deepEqual([...plain.fanVertices.subarray(0, 2)], [0, 0], "fanned from the first point");
  assert.deepEqual([...plain.batches], [0, 0, 24, 0, 1]);
  assert.equal(plain.covers.length, COVER_WORDS);
  assert.equal(plain.covers[0], 7);
  assert.deepEqual([...new Float32Array(plain.covers.buffer, 8, 4)], [0, 0, 10, 6]);
  assert.equal(plain.regionEdges, 8);
  assert.equal(plainSlab({ contourEdges: new Float32Array(0), contourEdgeOperations: new Uint32Array(0) }), null);
});
