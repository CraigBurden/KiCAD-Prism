import assert from "node:assert/strict";
import test from "node:test";

const {
  DEFAULT_MOVE_SNAP, axisAmount, canonicalPose, moveDescriptor, moveTarget, normalizeMoveSnap, poseMatrix,
  rigidInverse, ringRotation, rotatePoseAbout, screenAngle, snapSteps, snapTo, translatePose,
} = await import("./move-gizmo.js");

const close = (actual, expected, tolerance = 1e-9) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= tolerance, `${actual} != ${expected}`));
};
const S = Math.SQRT1_2;
const apply = (m, p) => [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);

test("a pose matrix rotates, then translates, column-major", () => {
  const m = poseMatrix({ translationMm: [10, 20, 30], rotation: [0, 0, S, S] }); // 90° about z
  close(apply(m, [1, 0, 0]), [10, 21, 30]);
  close(m.slice(12, 15), [10, 20, 30]);
});

test("the rigid inverse undoes the matrix", () => {
  const m = poseMatrix({ translationMm: [5, -7, 2], rotation: [0.1, -0.2, 0.3, Math.sqrt(0.86)] });
  close(apply(rigidInverse(m), apply(m, [3, 4, 5])), [3, 4, 5], 1e-6); // the quaternion is rounded to 1e-9
});

test("canonical poses keep w non-negative and round float noise", () => {
  assert.deepEqual(canonicalPose({ translationMm: [1e-12, -0, 2], rotation: [0, 0, -2, -2] }),
    { translationMm: [0, 0, 2], rotation: [0, 0, 0.707106781, 0.707106781] });
});

test("snapping rounds to the step", () => {
  assert.equal(snapTo(12.4, 1), 12);
  assert.equal(snapTo(-7.6, 1), -8);
  assert.equal(snapTo(0.26, 0.1).toFixed(1), "0.3");
  assert.equal(snapTo(Math.PI / 5, Math.PI / 12), Math.PI / 6); // 36° snaps to 30° in 15° steps
});

test("snapping uses the host's steps, with Shift giving a tenth and one degree", () => {
  assert.deepEqual({ ...DEFAULT_MOVE_SNAP }, { mm: 0.5, deg: 15 });
  assert.deepEqual(snapSteps(DEFAULT_MOVE_SNAP), { mm: 0.5, deg: 15, fineMm: 0.05, fineDeg: 1 });
  assert.deepEqual(snapSteps({ mm: 2, deg: 5 }), { mm: 2, deg: 5, fineMm: 0.2, fineDeg: 1 });
  // Custom steps reach snapTo unchanged: 1.1 mm rounds to 1.4 mm, 8° to 10°.
  assert.ok(Math.abs(snapTo(1.1, snapSteps({ mm: 0.7 }).mm) - 1.4) < 1e-9);
  assert.ok(Math.abs(snapTo(8, snapSteps({ mm: 2, deg: 5 }).deg) - 10) < 1e-9);
  assert.equal(snapTo(0.26, snapSteps({ mm: 0.5 }).fineMm).toFixed(2), "0.25");
});

test("an unusable snap keeps the last usable steps", () => {
  assert.deepEqual(normalizeMoveSnap({ mm: 2, deg: 5 }), { mm: 2, deg: 5 });
  for (const bad of [0, -1, Number.NaN, null, undefined, "x"]) {
    assert.deepEqual(normalizeMoveSnap({ mm: bad, deg: bad }, { mm: 1, deg: 30 }), { mm: 1, deg: 30 });
  }
});

test("a pointer drag converts to millimetres along the axis's screen direction", () => {
  // The axis shows as 4 px per mm, pointing right and down.
  const axis = [4 * S, 4 * S];
  assert.ok(Math.abs(axisAmount([40 * S, 40 * S], axis) - 10) < 1e-9);
  assert.ok(Math.abs(axisAmount([40 * S, -40 * S], axis)) < 1e-9, "across the axis moves nothing");
  assert.equal(axisAmount([10, 10], [0, 0]), 0, "an axis pointing at the viewer cannot be dragged");
});

test("ring drags turn the right way whichever side the camera is on", () => {
  // Screen y points down: from right (1, 0) to bottom (0, 1) is a quarter turn clockwise.
  const angle = screenAngle([0, 0], [1, 0], [0, 1]);
  assert.ok(Math.abs(angle - Math.PI / 2) < 1e-12);
  // Looking down +z (camera above): clockwise on screen is a negative turn about +z.
  assert.equal(ringRotation([0, 0, 1], [0, 0, 1], angle), -angle);
  assert.equal(ringRotation([0, 0, 1], [0, 0, -1], angle), angle);
});

test("rotating about a pivot keeps the pivot still", () => {
  const pose = { translationMm: [100, 0, 0], rotation: [0, 0, 0, 1] };
  const pivot = [150, 20, 0];
  const turned = rotatePoseAbout(pose, [0, 0, 1], Math.PI / 2, pivot);
  const before = rigidInverse(poseMatrix(pose));
  const local = apply(before, pivot); // the pivot in the board's own frame
  close(apply(poseMatrix(turned), local), pivot);
  close(turned.rotation, [0, 0, S, S]);
});

test("translating moves along a world axis", () => {
  assert.deepEqual(translatePose({ translationMm: [1, 2, 3], rotation: [0, 0, 0, 1] }, [0, 1, 0], 5).translationMm, [1, 7, 3]);
});

const descriptor = {
  occurrences: [
    { path: "/a", depth: 1, kind: "board", worldMatrix: poseMatrix({ translationMm: [0, 0, 0], rotation: [0, 0, 0, 1] }),
      pose: { translationMm: [0, 0, 0], rotation: [0, 0, 0, 1], source: "default" } },
    { path: "/g", depth: 1, kind: "assembly", worldMatrix: poseMatrix({ translationMm: [100, 0, 0], rotation: [0, 0, 0, 1] }),
      pose: { translationMm: [100, 0, 0], rotation: [0, 0, 0, 1], source: "default" } },
    { path: "/g/b", depth: 2, kind: "board", worldMatrix: poseMatrix({ translationMm: [110, 5, 0], rotation: [0, 0, 0, 1] }),
      pose: { translationMm: [10, 5, 0], rotation: [0, 0, 0, 1], source: "default" } },
  ],
};

test("selecting inside a child system moves the whole child system", () => {
  assert.equal(moveTarget(descriptor, "/g/b").path, "/g");
  assert.equal(moveTarget(descriptor, "/a").path, "/a");
  assert.equal(moveTarget(descriptor, null), null);
});

test("moving a child system carries its members as a rigid group", () => {
  const moved = moveDescriptor(descriptor, "/g", { translationMm: [200, 50, 0], rotation: [0, 0, S, S] });
  const group = moved.occurrences.find((item) => item.path === "/g");
  const member = moved.occurrences.find((item) => item.path === "/g/b");
  assert.equal(group.pose.source, "manual");
  close(group.worldMatrix.slice(12, 15), [200, 50, 0]);
  // The member's (10, 5) offset inside the group turns with it: (−5, 10) from the group's origin.
  close(member.worldMatrix.slice(12, 15), [195, 60, 0]);
  assert.deepEqual(member.pose, descriptor.occurrences[2].pose, "a member's own pose is frozen in its snapshot");
  assert.equal(moved.occurrences[0], descriptor.occurrences[0], "other boards are untouched");
  assert.equal(moveDescriptor(descriptor, "/g/b", { translationMm: [0, 0, 0], rotation: [0, 0, 0, 1] }), descriptor,
    "only top-level occurrences move");
});

test("a flat system scene moves the occurrence the selection names", () => {
  const flat = {
    occurrences: [
      { path: "occ_a", kind: "board", movable: true, worldMatrix: poseMatrix({ translationMm: [0, 0, 0], rotation: [0, 0, 0, 1] }) },
      { path: "occ_b", kind: "board", movable: false, worldMatrix: poseMatrix({ translationMm: [50, 0, 0], rotation: [0, 0, 0, 1] }) },
    ],
  };
  assert.equal(moveTarget(flat, "occ_a").path, "occ_a");
  assert.equal(moveTarget(flat, "occ_b").path, "occ_b");
  assert.equal(moveTarget(flat, "occ_missing"), null);
  const moved = moveDescriptor(flat, "occ_a", { translationMm: [5, 6, 7], rotation: [0, 0, 0, 1] });
  assert.deepEqual(moved.occurrences[0].worldMatrix.slice(12, 15), [5, 6, 7]);
  assert.equal(moved.occurrences[1], flat.occurrences[1]);
});
