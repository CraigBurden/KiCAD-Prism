import assert from "node:assert/strict";
import test from "node:test";

import { RING_SEGMENTS, packTubes, rmfNormals, tangents, tubeVertexCount, tubeVertices } from "./tube-mesh.js";

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test("packs samples in metres, a segment record per tube and the index buffer", () => {
  const tubes = [
    { samplesMm: [0, 0, 0, 10, 0, 0, 20, 0, 0], radiusMm: 1.5 },
    { samplesMm: [0, 0, 0], radiusMm: 1 }, // one sample: skipped
    { samplesMm: [0, 0, 5, 0, 10, 5], radiusMm: 2 },
  ];
  const packed = packTubes(tubes);
  assert.deepEqual(packed.kept, [0, 2]);
  assert.equal(packed.sampleCount, 5);
  assert.equal(packed.vertexCount, tubeVertexCount(3) + tubeVertexCount(2));
  assert.equal(packed.indexCount, (2 * RING_SEGMENTS * 6 + 2 * RING_SEGMENTS * 3) + (1 * RING_SEGMENTS * 6 + 2 * RING_SEGMENTS * 3));
  assert.deepEqual([...packed.samples.slice(4, 7)].map((v) => Math.round(v * 1e6) / 1e6), [0.01, 0, 0]);
  const f32 = new Float32Array(packed.segments.buffer);
  assert.deepEqual([...packed.segments.slice(0, 4)], [0, 3, 0, 0]);
  assert.deepEqual([...packed.segments.slice(8, 12)], [3, 2, tubeVertexCount(3), 1]);
  assert.ok(near(f32[4], 0.0015, 1e-9) && near(f32[12], 0.002, 1e-9));
  assert.ok(Math.max(...packed.indices.slice(0, packed.indexCount)) < packed.vertexCount);
});

test("rotation-minimising normals are unit, perpendicular and do not twist on a straight run", () => {
  const line = [[0, 0, 0], [1, 2, 3], [2, 4, 6], [3, 6, 9]];
  const normals = rmfNormals(line);
  const t = tangents(line);
  normals.forEach((n, i) => {
    assert.ok(near(length(n), 1, 1e-12));
    assert.ok(near(dot(n, t[i]), 0, 1e-12));
    assert.ok(near(dot(n, normals[0]), 1, 1e-12), "no twist");
  });
});

test("on a planar arc the frame stays in the plane's normal (no twist about the tangent)", () => {
  const arc = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 39) * Math.PI;
    return [Math.cos(a) * 50, Math.sin(a) * 50, 0];
  });
  const normals = rmfNormals(arc);
  // The first normal is ±z (perpendicular to the tangent, crossed with the least aligned axis);
  // a rotation-minimising frame keeps it there all the way round.
  const z = Math.abs(normals[0][2]);
  for (const n of normals) assert.ok(near(Math.abs(n[2]), z, 1e-6));
});

test("ring vertices sit one radius from their sample, with outward normals; caps face along the tube", () => {
  const points = [[0, 0, 0], [10, 0, 0], [20, 5, 0]];
  const vertices = tubeVertices(points, 2);
  assert.equal(vertices.length, tubeVertexCount(3));
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < RING_SEGMENTS; j += 1) {
      const v = vertices[i * RING_SEGMENTS + j];
      const offset = v.position.map((c, k) => c - points[i][k]);
      assert.ok(near(length(offset), 2, 1e-9));
      assert.ok(near(dot(offset, v.normal), 2, 1e-9));
    }
  }
  assert.deepEqual(vertices.at(-2).normal.map((c) => c + 0), [-1, 0, 0]);
  assert.deepEqual(vertices.at(-2).position, [0, 0, 0]);
});
