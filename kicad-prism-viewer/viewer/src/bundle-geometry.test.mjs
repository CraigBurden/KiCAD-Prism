import assert from "node:assert/strict";
import test from "node:test";

import { copperLayerColor, kicadCopperColor } from "./bundle-geometry.js";

test("copper takes KiCad's default layer colours by name", () => {
  assert.equal(kicadCopperColor("F.Cu"), "#c83434");
  assert.equal(kicadCopperColor("In1.Cu"), "#7fc87f");
  assert.equal(kicadCopperColor("In10.Cu"), "#ed7c33");
  assert.equal(kicadCopperColor("In30.Cu"), "#f2eda1");
  assert.equal(kicadCopperColor("B.Cu"), "#4d7fc4");
  // An inner layer named otherwise takes the colour of its place.
  assert.equal(kicadCopperColor("Power", 1), "#ce7d2c");
});

test("a layer's own colour wins over KiCad's", () => {
  const copper = [{ name: "F.Cu" }, { name: "In1.Cu" }, { name: "B.Cu" }];
  assert.deepEqual(copperLayerColor({ name: "In1.Cu" }, copper), [127 / 255, 200 / 255, 127 / 255, 1]);
  assert.deepEqual(copperLayerColor({ name: "In1.Cu", color: "#ff0000" }, copper), [1, 0, 0, 1]);
});
