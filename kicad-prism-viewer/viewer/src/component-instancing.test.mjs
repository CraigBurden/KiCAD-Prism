import assert from "node:assert/strict";
import test from "node:test";

import { placedBounds, placementRows } from "./gltf-loader.js";
import { INSTANCED_SHADERS, PLACEMENT_STRIDE } from "./renderer.js";

// The point a column-major glTF matrix and the loader's axis turn give (`transformPoint`).
function turned(m, [x, y, z]) {
  const X = m[0] * x + m[4] * y + m[8] * z + m[12];
  const Y = m[1] * x + m[5] * y + m[9] * z + m[13];
  const Z = m[2] * x + m[6] * y + m[10] * z + m[14];
  return [X, -Z, Y];
}

test("placement rows place a vertex where the flattening loader put it", () => {
  // 90° about Y, then a translation, as a footprint rotation in the GLB frame.
  const m = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0.012, 0.0016, -0.03, 1];
  const rows = placementRows(m);
  for (const point of [[0.001, 0.0005, 0.002], [-0.0015, 0, 0.0007]]) {
    const placed = [0, 1, 2].map((axis) => rows[axis * 4] * point[0] + rows[axis * 4 + 1] * point[1] + rows[axis * 4 + 2] * point[2] + rows[axis * 4 + 3]);
    turned(m, point).forEach((value, axis) => assert.ok(Math.abs(value - placed[axis]) < 1e-12));
  }
});

test("placed bounds are the exact box of the placed vertices", () => {
  const rows = placementRows([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1]);
  const bounds = placedBounds(new Float32Array([0, 0, 0, 1, 2, 3]), rows);
  assert.deepEqual(bounds, [10, -33, 20, 11, -30, 22]);
});

test("the component shaders read placements and split the instance index", () => {
  assert.equal(PLACEMENT_STRIDE, 64);
  for (const key of ["component", "componentInstanced", "componentPick", "componentPickInstanced"]) {
    assert.match(INSTANCED_SHADERS[key], /@binding\(8\) var<storage, read> placements/);
    assert.match(INSTANCED_SHADERS[key], /select\(placement\.ids\.x, input\.objectId/);
  }
  assert.match(INSTANCED_SHADERS.componentInstanced, /instance % draw\.placement\.y/);
  assert.match(INSTANCED_SHADERS.componentInstanced, /instance \/ draw\.placement\.y/);
  assert.match(INSTANCED_SHADERS.cull, /\(kind & 7u\) == 6u/);
});

test("models placed often are instanced and merged per shared placements; the rest bake in", async () => {
  const { componentDraws } = await import("./component-models.js");
  const tri = (z) => ({
    position: new Float32Array([0, 0, z, 1, 0, z, 0, 1, z]), normal: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    netId: new Uint32Array(3), objectFeatureId: new Uint32Array(3), indices: new Uint32Array([0, 1, 2]),
    bounds: [0, 0, z, 1, 1, z],
  });
  const at = (node, x) => ({ node, featureId: node + 10, designator: `R${node}`, rows: [1, 0, 0, x, 0, 1, 0, 0, 0, 0, 1, 0], bounds: [x, 0, 0, x + 1, 1, 0] });
  const red = { baseColor: [1, 0, 0, 1] };
  const four = [0, 1, 2, 3].map((node) => at(node, node));
  const models = [
    { primitive: { ...tri(0), material: red }, placements: four },
    { primitive: { ...tri(1), material: red }, placements: four }, // the same part's other primitive
    { primitive: { ...tri(2), material: { baseColor: [0, 0, 1, 1] } }, placements: four },
    { primitive: { ...tri(3), material: red }, placements: [at(9, 5)] }, // placed once
  ];
  const { instanced, baked } = componentDraws(models, 4);
  assert.equal(instanced.length, 2); // red (two primitives merged) and blue
  const merged = instanced.find((draw) => draw.primitive.material === red);
  assert.equal(merged.primitive.position.length, 18);
  assert.deepEqual([...merged.primitive.indices], [0, 1, 2, 3, 4, 5]);
  assert.equal(merged.placements.length, 4);
  assert.equal(baked.length, 1);
  assert.equal(baked[0].position[0], 5); // moved to its placement
  assert.equal(baked[0].objectFeatureId[0], 19); // its component's feature
});

test("the camera's destination view is the view at its targets, and the lead goes one step further", async () => {
  const { CameraController } = await import("./camera.js");
  const camera = new CameraController([0, 0, 0, 0.1, 0.08, 0.002]);
  assert.equal(camera.moving(), false);
  const still = camera.matrix(800, 600);
  assert.deepEqual(camera.targetMatrix(800, 600), still);
  camera.targetDistance = camera.distance / 2;
  camera.targetFocus = [0.02, 0.01, 0];
  assert.equal(camera.moving(), true);
  const destination = camera.targetMatrix(800, 600);
  const before = [camera.focus, camera.distance];
  camera.snap();
  assert.deepEqual(destination, camera.matrix(800, 600));
  // targetMatrix leaves the camera where it was.
  const again = new CameraController([0, 0, 0, 0.1, 0.08, 0.002]);
  again.targetDistance = again.distance / 2;
  again.targetMatrix(800, 600, false, 1);
  assert.equal(again.distance, before[1]);
});
