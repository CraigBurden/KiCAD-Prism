import assert from "node:assert/strict";
import test from "node:test";

import { Renderer } from "./renderer.js";

// The flat layer view draws mesh copper; analytic slices never draw there.
test("the flat layer view keeps mesh copper the analytic board covers in 3D", () => {
  const renderer = Object.create(Renderer.prototype);
  Object.assign(renderer, {
    showPlaceholders: true,
    analytic: { coversLayer: () => true, coversRole: () => true },
  });
  const copper = { kind: "copper", layerId: 4, tileId: "layer-4-tile-0-0" };
  const layers = new Set([4]);
  const visible = (compareMode) => renderer.visible(copper, 0, layers, true, true, 1, compareMode, new Set());
  assert.equal(visible(false), false);
  assert.equal(visible(true), true);
  assert.equal(renderer.visible({ ...copper, layerId: 26 }, 0, layers, true, true, 1, true), false);
});

// An analytic board has no mesh copper: the 2D view draws its slices, each layer shifted to its cell.
test("the 2D view lays each analytic copper layer flat at its place in the grid", () => {
  const renderer = Object.create(Renderer.prototype);
  const heights = new Map([[1, 0.0008], [2, -0.0008]]);
  renderer.analytic = { layerZ: (id) => heights.get(id) ?? null };
  const offsets = new Map([[1, [-0.03, 0, 0]], [2, [0.03, 0, 0]]]);
  const plan = renderer.analyticFlatLayers({ compareMode: true, visibleLayers: new Set([1, 2, 7]), compareOffsets: offsets });
  assert.deepEqual(plan, [{ layerId: 1, offset: [-0.03, 0, 0], z: 0.0008 }, { layerId: 2, offset: [0.03, 0, 0], z: -0.0008 }]);
  assert.deepEqual(renderer.analyticFlatLayers({ compareMode: false, visibleLayers: new Set([1]) }), []);

});
