import assert from "node:assert/strict";
import test from "node:test";

import { advanceHarnessDrag, beginHarnessDrag, settleHarnessDrag } from "./harness-drag.js";

const basis = { right: [1, 0, 0], up: [0, 0, 1] };
const press = () => beginHarnessDrag({
  harness: "H1",
  target: { kind: "segment", id: "s1" },
  fromMm: [10, 0, 0],
  startPx: [100, 100],
  basis,
  pxPerMm: 2,
});

test("a press is a click until it moves past three pixels", () => {
  const drag = press();
  assert.equal(advanceHarnessDrag(drag, [102, 102]), null);
  assert.equal(drag.moved, false);
});

test("crossing the threshold reports start, later moves report move", () => {
  const drag = press();
  const started = advanceHarnessDrag(drag, [103, 100]);
  assert.equal(started.phase, "start");
  assert.equal(started.drag.moved, true);
  // 3 px right at 2 px/mm is 1.5 mm across the view's right axis.
  assert.deepEqual(started.drag.pointMm, [11.5, 0, 0]);
  const moved = advanceHarnessDrag(started.drag, [100, 96]);
  assert.equal(moved.phase, "move");
  assert.deepEqual(moved.drag.pointMm, [10, 0, 2]);
});

test("settling reports the start point, target and last point", () => {
  const shown = advanceHarnessDrag(press(), [120, 140]);
  assert.deepEqual(settleHarnessDrag(shown.drag), {
    harness: "H1",
    target: { kind: "segment", id: "s1" },
    fromMm: [10, 0, 0],
    pointMm: [20, 0, -20],
  });
});
