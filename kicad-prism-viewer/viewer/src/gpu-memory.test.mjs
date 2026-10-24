import assert from "node:assert/strict";
import test from "node:test";

import { Renderer } from "./renderer.js";

const buffer = (size) => ({ size });

test("the GPU memory breakdown adds up to gpuMemoryBytes", () => {
  const renderer = Object.create(Renderer.prototype);
  Object.assign(renderer, {
    canvas: { width: 10, height: 10 },
    entries: [
      { kind: "copper", layerId: 0, vertexAllocation: buffer(400), indexAllocation: buffer(120) },
      { kind: "copper", layerId: 0, vertexAllocation: buffer(40), indexAllocation: buffer(12) },
      { kind: "board", boardRole: "soldermask", vertexAllocation: buffer(80), indexAllocation: buffer(24) },
      { kind: "component", vertexAllocation: buffer(800), indexAllocation: buffer(240) },
    ],
    barrels: { vertexBuffer: buffer(64), indexBuffer: buffer(16), instanceBuffer: buffer(32) },
    occurrenceBuffer: buffer(256),
    argsBuffer: buffer(20),
  });
  const breakdown = renderer.gpuMemoryBreakdown();
  assert.deepEqual(breakdown.geometry, { "copper:0": 572, "board:soldermask": 104, component: 1040 });
  assert.equal(breakdown.vertex, 1320);
  assert.equal(breakdown.index, 396);
  assert.equal(breakdown.barrels, 112);
  assert.equal(breakdown.occurrences, 276);
  assert.equal(breakdown.vertex + breakdown.index + breakdown.barrels + breakdown.occurrences + breakdown.targets,
    renderer.gpuMemoryBytes());
});

test("indices are 16-bit when every vertex fits, padded to four bytes", async () => {
  const { packIndices, primitiveGpuBytes } = await import("./renderer.js");
  const small = packIndices(new Uint32Array([0, 1, 2]), 3);
  assert.equal(small.format, "uint16");
  assert.deepEqual([...small.indices], [0, 1, 2, 0]);
  assert.equal(small.indices.byteLength % 4, 0);
  const edge = packIndices([0, 65535, 1, 2], 65536);
  assert.equal(edge.format, "uint16");
  assert.equal(edge.indices[1], 65535);
  const large = packIndices([0, 65536, 1], 65537);
  assert.equal(large.format, "uint32");
  assert.equal(large.indices[1], 65536);
  assert.equal(primitiveGpuBytes(3, 3), 3 * 20 + 8);
  assert.equal(primitiveGpuBytes(65537, 3), 65537 * 20 + 12);
});

test("normals pack to snorm8 within one step of the unit vector", async () => {
  const { packNormal } = await import("./renderer.js");
  const out = new Int8Array(8);
  packNormal(out, 4, [0, 0, 0, 0.6, -0.8, 0], 3);
  assert.deepEqual([...out.slice(4)], [76, -102, 0, 0]);
  packNormal(out, 0, [1, -1, 0], 0);
  assert.deepEqual([...out.slice(0, 4)], [127, -127, 0, 0]);
  packNormal(out, 0, [2, -2, Number.NaN], 0);
  assert.deepEqual([...out.slice(0, 4)], [127, -127, 0, 0]);
});

test("positions quantise to unorm16 within the primitive's bounds, within half a step", async () => {
  const { packPosition, quantisationOf } = await import("./renderer.js");
  // A 100 mm tile (runtime metres), 35 um thick.
  const position = new Float32Array([0.01, 0.02, 0.0016, 0.11, 0.07, 0.001635, 0.0634567, 0.0412345, 0.0016175]);
  const quant = quantisationOf(position);
  assert.deepEqual(quant.min.map((v) => +v.toFixed(7)), [0.01, 0.02, 0.0016]);
  const out = new Uint16Array(12);
  for (let vertex = 0; vertex < 3; vertex += 1) packPosition(out, vertex * 4, position, vertex * 3, quant);
  assert.deepEqual([...out.slice(0, 4)], [0, 0, 0, 0]);
  assert.deepEqual([...out.slice(4, 8)], [65535, 65535, 65535, 0]);
  for (let axis = 0; axis < 3; axis += 1) {
    const back = quant.min[axis] + (out[8 + axis] / 65535) * quant.size[axis];
    const step = quant.size[axis] / 65535;
    assert.ok(Math.abs(back - position[6 + axis]) <= step / 2 + 1e-12, `axis ${axis}`);
  }
  assert.ok(quant.size[0] / 65535 < 1.6e-6, "about 1.5 um across a 100 mm tile");
  // A flat primitive keeps a unit extent on its flat axis instead of dividing by zero.
  assert.deepEqual(quantisationOf(new Float32Array([0, 0, 1, 1, 0, 1])).size, [1, 1, 1]);
});
