import assert from "node:assert/strict";
import test from "node:test";

import { dragInViewPlane, isDrag } from "./route-drag.js";

const basis = { right: [1, 0, 0], up: [0, 0, 1] };

test("a drag moves the point across and up the view plane at the screen's scale", () => {
  assert.deepEqual(dragInViewPlane([10, 5, 0], 20, -40, 2, basis), [20, 5, 20]);
});

test("no scale, no move", () => {
  assert.deepEqual(dragInViewPlane([1, 2, 3], 50, 50, 0, basis), [1, 2, 3]);
});

test("under three pixels is a click", () => {
  assert.equal(isDrag([0, 0], [2, 2]), false);
  assert.equal(isDrag([0, 0], [3, 0]), true);
});
