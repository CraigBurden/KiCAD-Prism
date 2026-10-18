import assert from "node:assert/strict";
import test from "node:test";

import { rasterizeBoardClip } from "./analytic-clip.js";

const loop = (points) => points.flatMap((point, index) => [...point, ...points[(index + 1) % points.length]]);

test("a board with a cutout is inside around it and outside in it and beyond", () => {
  const edges = new Float32Array([
    ...loop([[0, 0], [10, 0], [10, 10], [0, 10]]),
    ...loop([[4, 4], [4, 6], [6, 6], [6, 4]]),
  ]);
  const clip = rasterizeBoardClip(edges, 120);
  const at = (x, y) => {
    const col = Math.floor((x - clip.originMm[0]) / clip.pitchMm);
    const row = Math.floor((y - clip.originMm[1]) / clip.pitchMm);
    return clip.data[row * clip.width + col];
  };
  assert.equal(clip.pitchMm, 0.1);
  assert.equal(at(1, 1), 1);
  assert.equal(at(9.5, 5), 1);
  assert.equal(at(5, 5), 0, "the cutout");
  assert.equal(at(-0.5, 5), 0, "beyond the edge");
  assert.equal(at(10.5, 10.5), 0);
});

test("no outline, no clip", () => {
  assert.equal(rasterizeBoardClip(null), null);
  assert.equal(rasterizeBoardClip(new Float32Array(8)), null);
});
