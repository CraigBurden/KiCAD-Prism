import assert from "node:assert/strict";
import test from "node:test";

import { featureMaskCapacityFor } from "./feature-visibility.js";
import { ANALYTIC_COMPONENT_FEATURES, analyticBoundsMm, analyticLayers, analyticSceneManifest, componentBoundsMm } from "./analytic-scene.js";

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

test("copper takes KiCad's layer colours and masks take the stackup's", () => {
  const inner = { ...HEADER, stack: { slices: [
    { key: "copper.front", kicad_layer: "F.Cu", order: 0, role: "conductor", thickness_nm: 35000 },
    { key: "copper.in1", kicad_layer: "In1.Cu", order: 1, role: "conductor", thickness_nm: 35000 },
    { key: "copper.in2", kicad_layer: "In2.Cu", order: 2, role: "conductor", thickness_nm: 35000 },
    { key: "copper.back", kicad_layer: "B.Cu", order: 3, role: "conductor", thickness_nm: 35000 },
  ] } };
  assert.deepEqual(analyticLayers(inner).map((layer) => layer.color), ["#c83434", "#7fc87f", "#ce7d2c", "#4d7fc4"]);
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

test("each component is its own feature, placed by its affine on its side", () => {
  const rotated = { m11: 0, m12: -1, m21: 1, m22: 0, tx_nm: 10_000_000, ty_nm: 20_000_000 };
  const body = { min_x_nm: -2_000_000, min_y_nm: -1_000_000, max_x_nm: 2_000_000, max_y_nm: 1_000_000 };
  const header = { ...HEADER, components: [
    { refdes: "U1", source_uid: "u1", footprint: "QFN", side: "front", affine: rotated, body_bounds: body, body_height_nm: 900_000 },
    { refdes: "C1", source_uid: "c1", footprint: "0402", side: "back", affine: { ...rotated, m12: 0, m21: 0, m11: 1, m22: 1 }, body_bounds: body },
    { refdes: "TP1", source_uid: "tp1", footprint: "TP", side: "front", affine: rotated },
  ] };
  const components = analyticSceneManifest(header).components;
  assert.deepEqual(components.map((c) => c.featureId), [0, 1, 2].map((i) => ANALYTIC_COMPONENT_FEATURES + i));
  // Rotated a quarter turn: 2 mm across, 4 mm along, about (10, 20); 0.9 mm up from the top face.
  assert.deepEqual(components[0].boundsMm.map((v) => +v.toFixed(3)), [9, 18, 0.8, 11, 22, 1.7]);
  // The back side hangs below, 1 mm by default.
  assert.deepEqual(components[1].boundsMm.map((v) => +v.toFixed(3)), [8, 19, -1.8, 12, 21, -0.8]);
  assert.equal(components[2].boundsMm, null, "no body, no bounds until the models load");
  assert.equal(componentBoundsMm(null, 1.6), null);
  // KiCad's parts GLB puts the board's bottom at 0; this board is centred, so the parts come down half of it.
  assert.equal(analyticSceneManifest(header).componentsZOffsetMm, -0.8);
});

test("hiding every part keeps the renderer's mask one word per part", () => {
  // The mask is as long as the largest hidden id; a large base id once asked for gigabytes (DNP hiding in the tab).
  const components = Array.from({ length: 300 }, (_, i) => ({ refdes: `R${i}`, source_uid: `r${i}`, side: "front" }));
  const ids = analyticSceneManifest({ ...HEADER, components }).components.map((c) => c.featureId);
  assert.ok(Math.min(...ids) > 0, "0 is no feature");
  assert.equal(featureMaskCapacityFor(ids), 512);
});
