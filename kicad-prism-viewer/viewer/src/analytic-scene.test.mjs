import assert from "node:assert/strict";
import test from "node:test";

import { analyticBoundsMm, analyticLayers, analyticSceneManifest, loweringOrder } from "./analytic-scene.js";

// The stack of a two-layer board as a bundle's pack records it (USB-PD-Trigger-Board).
const HEADER = {
  stack: {
    board_thickness_nm: 1600000,
    slices: [
      { key: "mask.front", kicad_layer: "F.Mask", order: 0, role: "solder_mask", side: "front", thickness_nm: 10000 },
      { key: "copper.front", kicad_layer: "F.Cu", order: 1, role: "conductor", thickness_nm: 35000 },
      { key: "dielectric.1", kicad_layer: "dielectric 1", order: 2, role: "dielectric", thickness_nm: 1510000, material_name: "FR4" },
      { key: "copper.back", kicad_layer: "B.Cu", order: 3, role: "conductor", thickness_nm: 35000 },
      { key: "mask.back", kicad_layer: "B.Mask", order: 4, role: "solder_mask", side: "back", thickness_nm: 10000 },
    ],
  },
  chunks: [
    { bounds: { min_x_nm: 100000000, min_y_nm: 90000000, max_x_nm: 140000000, max_y_nm: 120000000 } },
    { bounds: { min_x_nm: 110000000, min_y_nm: 80000000, max_x_nm: 150000000, max_y_nm: 110000000 } },
  ],
  nets: [{ key: "", name: "" }, { key: "GND", name: "GND", net_class: "Default" }],
  components: [{ refdes: "R15", source_uid: "0a68adf0", footprint: "R_0603", side: "front" }],
};

test("layers follow the stack, centred on the board's mid-plane", () => {
  const layers = analyticLayers(HEADER);
  assert.deepEqual(layers.map((layer) => [layer.id, layer.name, layer.role]), [
    [1, "F.Mask", "soldermask"],
    [2, "F.Cu", "copper"],
    [3, "dielectric 1", "dielectric"],
    [4, "B.Cu", "copper"],
    [5, "B.Mask", "soldermask"],
  ]);
  assert.deepEqual(layers.map((layer) => layer.z_mm), [0.795, 0.7725, 0, -0.7725, -0.795]);
  assert.equal(layers[1].thickness_mm, 0.035);
  assert.equal(layers[2].material, "FR4");
});

test("copper keeps the mesh path's colours and masks take the stackup's", () => {
  const inner = { ...HEADER, stack: { slices: [
    { key: "copper.front", kicad_layer: "F.Cu", order: 0, role: "conductor", thickness_nm: 35000 },
    { key: "copper.in1", kicad_layer: "In1.Cu", order: 1, role: "conductor", thickness_nm: 35000 },
    { key: "copper.in2", kicad_layer: "In2.Cu", order: 2, role: "conductor", thickness_nm: 35000 },
    { key: "copper.back", kicad_layer: "B.Cu", order: 3, role: "conductor", thickness_nm: 35000 },
  ] } };
  assert.deepEqual(analyticLayers(inner).map((layer) => layer.color), ["#df342b", "#269e4d", "#93612f", "#245fd3"]);
  const red = analyticLayers(HEADER, { maskColors: { front: "Red", back: "#123456" } });
  assert.equal(red[0].color, "#a5272a");
  assert.equal(red[4].color, "#123456");
});

test("the manifest has the mesh scene's shape", () => {
  const manifest = analyticSceneManifest(HEADER);
  assert.deepEqual(analyticBoundsMm(HEADER), [100, 80, 150, 120]);
  assert.deepEqual(manifest.bbox, { min: [0.1, -0.0008, 0.08], max: [0.15, 0.0008, 0.12] });
  assert.deepEqual(manifest.copperLayerIds, [2, 4]);
  assert.deepEqual(manifest.nets.map((net) => [net.id, net.name]), [[0, ""], [1, "GND"]]);
  assert.deepEqual(manifest.components.map((c) => [c.designator, c.uid]), [["R15", "0a68adf0"]]);
  assert.deepEqual([manifest.tiles, manifest.barrels, manifest.objectFeatures], [[], [], []]);
});

test("the outer copper and masks are lowered first, inner copper last", () => {
  const header = { stack: { slices: [
    { key: "silk.front", order: 0, role: "silkscreen" },
    { key: "mask.front", order: 1, role: "solder_mask" },
    { key: "copper.front", order: 2, role: "conductor" },
    { key: "dielectric.1", order: 3, role: "dielectric" },
    { key: "copper.in1", order: 4, role: "conductor" },
    { key: "dielectric.2", order: 5, role: "dielectric" },
    { key: "copper.back", order: 6, role: "conductor" },
    { key: "mask.back", order: 7, role: "solder_mask" },
  ] } };
  assert.deepEqual(loweringOrder(header), [
    "mask.front", "copper.front", "copper.back", "mask.back",
    "silk.front", "dielectric.1", "dielectric.2",
    "copper.in1",
  ]);
});
