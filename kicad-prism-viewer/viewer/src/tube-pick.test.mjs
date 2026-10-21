import assert from "node:assert/strict";
import { test } from "node:test";

import { arcTo, pickTube } from "./tube-pick.js";

// A top-down orthographic view: 2 px per mm, z ignored.
const project = (p) => [p[0] * 2, p[1] * 2];
const pxPerMm = () => 2;
const tubes = [
  { samplesMm: [0, 0, 0, 50, 0, 0, 100, 0, 0], radiusMm: 1 },
  { samplesMm: [0, 20, 5, 100, 20, 5], radiusMm: 3 },
];

test("picks the nearest tube within its drawn radius plus slack", () => {
  const hit = pickTube(tubes, [150, 4], project, pxPerMm);
  assert.equal(hit.index, 0);
  assert.equal(hit.sample, 1);
  assert.ok(Math.abs(hit.t - 0.5) < 1e-9);
  assert.deepEqual(hit.pointMm, [75, 0, 0]);
  // 3 mm radius = 6 px plus 5 px slack reaches 11 px off the second tube's line.
  assert.equal(pickTube(tubes, [100, 50], project, pxPerMm).index, 1);
  assert.equal(pickTube(tubes, [100, 60], project, pxPerMm)?.index, undefined);
});

test("skips spans behind the camera", () => {
  const hidden = (p) => (p[0] > 60 ? null : project(p));
  assert.equal(pickTube(tubes.slice(0, 1), [150, 0], hidden, pxPerMm), null);
});

test("arc length to a hit", () => {
  assert.equal(arcTo(tubes[0].samplesMm, 1, 0.5), 75);
  assert.equal(arcTo(tubes[0].samplesMm, 0, 0), 0);
});
