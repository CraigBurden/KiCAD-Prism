import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_HARNESS_COLOR,
  PREVIEW_ALPHA,
  SELECTED_HARNESS_COLOR,
  harnessOverlayItems,
  harnessSignature,
  harnessTubes,
} from "./harness-descriptor.js";

test("shapes descriptor segments into tubes, with the amber default and flags", () => {
  const tubes = harnessTubes([{
    harness: "H1",
    segments: [
      { id: "s1", samplesMm: [0, 0, 0, 10, 0, 0], radiusMm: 2 },
      { id: "short", samplesMm: [0, 0, 0], radiusMm: 2 },
      { id: "bad", samplesMm: [0, 1, 2, 3], radiusMm: 2 },
      { id: "red", samplesMm: [0, 0, 0, 0, 10, 0], radiusMm: 1, color: [1, 0, 0, 0.5], selected: true, preview: true },
    ],
  }]);
  assert.deepEqual(tubes.map((tube) => tube.id), ["s1", "red"]);
  assert.equal(tubes[0].harness, "H1");
  assert.deepEqual(tubes[0].color, DEFAULT_HARNESS_COLOR);
  assert.deepEqual(tubes[1].color, [1, 0, 0, 0.5]);
  assert.equal(tubes[1].selected, true);
  assert.equal(tubes[1].preview, true);
  assert.equal(PREVIEW_ALPHA, 0.45);
  assert.deepEqual(SELECTED_HARNESS_COLOR, [0.22, 0.74, 0.97, 1]);
});

test("drops harnesses and segments that are not drawable", () => {
  assert.deepEqual(harnessTubes(null), []);
  assert.deepEqual(harnessTubes([{ harness: "H", segments: [{ samplesMm: [0, 0, 0, 1, 1, 1], radiusMm: 0 }] }]), []);
  assert.deepEqual(harnessTubes([{ segments: [{ samplesMm: [0, 0, 0, 1, 1, 1], radiusMm: 1 }] }]), []);
});

test("collects handles and flags in world mm, normalising their kinds", () => {
  const { handles, flags } = harnessOverlayItems([{
    harness: "H1",
    handles: [
      { id: "w", kind: "waypoint", positionMm: [1, 2, 3], selected: true },
      { id: "b", kind: "branch-point", positionMm: [4, 5, 6] },
      { id: "a", kind: "auto", positionMm: [7, 8, 9] },
      { id: "odd", kind: "splice", positionMm: [0, 0, 0] },
      { id: "none" },
    ],
    flags: [
      { id: "f1", kind: "bend", atMm: [1, 2, 3], label: "Bend 4 mm" },
      { id: "f2", kind: "clearance", atMm: [2, 3, 4], label: "Clearance" },
      { id: "f3", kind: "other", atMm: [0, 0, 0], label: "no" },
    ],
  }]);
  assert.deepEqual(handles.map((handle) => [handle.id, handle.kind]), [
    ["w", "waypoint"], ["b", "branch-point"], ["a", "auto"], ["odd", "waypoint"],
  ]);
  assert.equal(handles[0].selected, true);
  assert.deepEqual(handles[2].positionMm, [7, 8, 9]);
  assert.deepEqual(flags.map((flag) => [flag.id, flag.kind, flag.label]), [
    ["f1", "bend", "Bend 4 mm"], ["f2", "clearance", "Clearance"],
  ]);
});

test("the signature changes with the harnesses or their visibility", () => {
  const harnesses = [{ harness: "H1", segments: [] }];
  assert.equal(harnessSignature(true, harnesses), harnessSignature(true, [...harnesses]));
  assert.notEqual(harnessSignature(true, harnesses), harnessSignature(false, harnesses));
  assert.notEqual(harnessSignature(true, harnesses), harnessSignature(true, [{ harness: "H1", segments: [], handles: [] }]));
});
