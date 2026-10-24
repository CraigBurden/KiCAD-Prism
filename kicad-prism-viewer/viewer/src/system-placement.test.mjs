import assert from "node:assert/strict";
import test from "node:test";

import { INSTANCED_SHADERS } from "./renderer.js";
import { transformBounds, transformPoint } from "./occurrences.js";
import {
  allReadyBoardsDrawn,
  assetLoadable,
  assetOccurrenceMatrix,
  boardTransition,
  bundleToBoardFromBounds,
  childWorldMatrix,
  drawnOccurrences,
  EXPLODE_GAP_MM,
  explodeOffsetMm,
  explodedWorldMatrix,
  standInKind,
  standInMatrix,
} from "./system-placement.js";

const translate = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
// bundleToBoard (CONTRACTS_P2 §20.2): metres → mm, lowered by the mid-plane height (0.8 mm here).
const BUNDLE_TO_BOARD = [1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 1000, 0, 0, 0, -0.8, 1];

test("an asset occurrence maps bundle metres through the board frame to world metres", () => {
  const model = assetOccurrenceMatrix(translate(100, 50, 0), BUNDLE_TO_BOARD);
  // A point 10 mm right, 0.8 mm up in the bundle (on the mid-plane) lands 10 mm right of the pose, at z 0.
  const point = transformPoint(model, [0.01, 0, 0.0008]);
  [0.11, 0.05, 0].forEach((value, index) => assert.ok(Math.abs(point[index] - value) < 1e-12, `${point}`));
});

test("a stand-in is the unit box mapped onto the occurrence box, then placed", () => {
  const matrix = standInMatrix(translate(-41.8, 246.4, 0), { minMm: [41.8, -246.4, -0.99], maxMm: [341.8, -46.4, 0.99] });
  const world = transformBounds(matrix, [0, 0, 0, 1, 1, 1]);
  const expected = [0, 0, -0.00099, 0.3, 0.2, 0.00099];
  world.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-12, `${world}`));
});

test("an analytic bundle's frame is metres, lowered by its runtime mid-plane", () => {
  // Runtime z runs from −1.6 mm to +0.8 mm: the board's middle sits at −0.4 mm.
  const bundleToBoard = bundleToBoardFromBounds([-0.05, -0.03, -0.0016, 0.05, 0.03, 0.0008]);
  assert.deepEqual(bundleToBoard, [1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0.4, 1]);
  // A point on the board's mid-plane lands on the occurrence's plane.
  const model = assetOccurrenceMatrix(translate(10, 20, 0), bundleToBoard);
  const point = transformPoint(model, [0.01, 0, -0.0004]);
  [0.02, 0.02, 0].forEach((value, index) => assert.ok(Math.abs(point[index] - value) < 1e-12, `${point}`));
  // No bounds: the board's own plane, unscaled height.
  assert.deepEqual(bundleToBoardFromBounds(null), [1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 1]);
});

test("why an occurrence is a stand-in", () => {
  const board = { kind: "board", restricted: false, assetId: "sba_1" };
  const ready = { assetId: "sba_1", status: "ready", bundleUrl: "/b.json", bundleToBoard: BUNDLE_TO_BOARD };
  assert.equal(standInKind({ ...board, restricted: true, assetId: null }, null, undefined), "restricted");
  assert.equal(standInKind(board, ready, "loaded"), null);
  assert.equal(standInKind(board, ready, "loading"), "loading");
  assert.equal(standInKind(board, ready, "failed"), "failed");
  assert.equal(standInKind(board, { ...ready, bundleToBoard: null }, "waiting"), "loading", "an analytic bundle: the board gives the frame");
  assert.equal(standInKind(board, { ...ready, bundleUrl: null }, "waiting"), "building", "no bundle yet");
  assert.equal(standInKind(board, { ...ready, status: "building" }, "waiting"), "building");
  assert.equal(standInKind(board, { ...ready, status: "missing" }, "waiting"), "missing");
  assert.equal(standInKind(board, { ...ready, status: "failed" }, "waiting"), "failed");
  assert.equal(standInKind({ ...board, assetId: null }, null, undefined), "missing");
});

test("boards, restricted child systems and model bodies/parts are drawn; open assemblies are only groups", () => {
  const descriptor = { occurrences: [
    { path: "/a", kind: "assembly", restricted: false },
    { path: "/a/b", kind: "board", restricted: false },
    { path: "/c", kind: "assembly", restricted: true },
    { path: "/d", kind: "body", model: { glbKey: "k" } },
    { path: "/d/e", kind: "part", parent: "/d", localMatrix: translate(1, 2, 3), model: { glbKey: "k" } },
    { path: "/f", kind: "body" },
    { path: "/g", kind: "part", parent: "/d" },
    // A placed published entry is placed even while it draws nothing itself: its contents are its children.
    { path: "/h", kind: "entry", group: true },
    { path: "/h/i", kind: "board", parent: "/h", localMatrix: translate(5, 0, 0) },
  ] };
  assert.deepEqual(drawnOccurrences(descriptor).map((item) => item.path), ["/a/b", "/c", "/d", "/d/e", "/h", "/h/i"]);
});

test("a child part's world matrix is its parent's current world matrix times its local matrix", () => {
  const parent = translate(10, 20, 30);
  const local = translate(1, 2, 3);
  const world = childWorldMatrix(parent, local);
  assert.deepEqual(world.slice(12, 15), [11, 22, 33]);
  // A point 1 mm along the child's x lands 1 mm right of its origin.
  const point = transformPoint(world, [1, 0, 0]);
  [12, 22, 33].forEach((value, index) => assert.ok(Math.abs(point[index] - value) < 1e-12, `${point}`));
  // No local matrix: the parent's own world matrix.
  assert.deepEqual(childWorldMatrix(parent, null), parent);
});

test("instanced shaders number occurrences scene-wide; the one-board shaders are untouched", () => {
  for (const name of ["main", "pick", "barrel", "barrelPick", "box", "boxPick"]) {
    const code = INSTANCED_SHADERS[name];
    assert.match(code, /occurrenceBase: u32/, name);
    assert.match(code, /output\.occurrence = index \+ 1u \+ globals\.occurrenceBase;/, name);
    assert.doesNotMatch(code, /output\.occurrence = index \+ 1u;/, name);
  }
});

test("the first frame counts once every ready board draws its own geometry", async () => {
  const drawn = allReadyBoardsDrawn;
  assert.equal(drawn([]), false, "nothing placed yet");
  assert.equal(drawn([{ standIn: null }, { standIn: "loading" }]), false, "a ready bundle still loading");
  assert.equal(drawn([{ standIn: null }, { standIn: "restricted" }, { standIn: "failed" }]), true, "boxes that stay boxes don't wait");
  assert.equal(drawn([{ standIn: "building" }]), false, "no board drawn at all");
});

test("a staged bundle that turns ready at the same URL loads (retro D5)", () => {
  const url = "/api/projects/p/webgpu-3d/assets/s/b/bundle.json";
  const frame = [1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 1000, 0, 0, 0, -0.8, 1];
  const missing = { status: "missing", bundleUrl: null, bundleToBoard: null };
  const building = { status: "building", bundleUrl: url, bundleToBoard: null };
  const ready = { status: "ready", bundleUrl: url, bundleToBoard: frame };
  assert.equal(boardTransition(undefined, missing), "create");
  assert.equal(assetLoadable(missing), false);
  // missing → building: the URL appears, so the board starts over (and waits).
  assert.equal(boardTransition({ bundleUrl: null, loadState: "waiting" }, building), "create");
  assert.equal(assetLoadable(building), false);
  assert.equal(boardTransition({ bundleUrl: url, loadState: "waiting" }, building), "keep");
  // building → ready at the same URL: load the board kept waiting (it used to stay a box).
  assert.equal(boardTransition({ bundleUrl: url, loadState: "waiting" }, ready), "load");
  assert.equal(boardTransition({ bundleUrl: url, loadState: "loading" }, ready), "keep");
  assert.equal(boardTransition({ bundleUrl: url, loadState: "loaded" }, ready), "keep");
  // A failed load retries from scratch; a new bundle URL replaces the board.
  assert.equal(boardTransition({ bundleUrl: url, loadState: "failed" }, ready), "create");
  assert.equal(boardTransition({ bundleUrl: url, loadState: "loaded" }, { ...ready, bundleUrl: `${url}?v=2` }), "create");
});

test("an analytic asset is loadable without a bundle-to-board frame", () => {
  // The host sends analytic bundles with `bundleToBoard: null`; the board's
  // runtime bounds derive it after the load.
  assert.equal(assetLoadable({ status: "ready", bundleUrl: "/b.json", bundleToBoard: null }), true);
  assert.equal(assetLoadable({ status: "building", bundleUrl: "/b.json", bundleToBoard: null }), false);
  assert.equal(assetLoadable({ status: "ready", bundleUrl: null, bundleToBoard: null }), false);
  assert.equal(boardTransition(
    { bundleUrl: "/b.json", loadState: "waiting" },
    { status: "ready", bundleUrl: "/b.json", bundleToBoard: null },
  ), "load");
});

test("an assembly explode offsets along its axis by depth, amount and the gap", () => {
  assert.deepEqual(explodeOffsetMm(null, 1), [0, 0, 0]);
  assert.deepEqual(explodeOffsetMm({ axis: [0, 0, 1], depth: 1 }, 0), [0, 0, 0]);
  assert.deepEqual(explodeOffsetMm({ axis: [0, 0, 1], depth: 1 }, 1), [0, 0, EXPLODE_GAP_MM]);
  assert.deepEqual(explodeOffsetMm({ axis: [1, 0, 0], depth: 2 }, 0.5), [EXPLODE_GAP_MM, 0, 0]);
  assert.deepEqual(explodeOffsetMm({ axis: [0, 1, 0], depth: 1 }, 2), [0, EXPLODE_GAP_MM, 0], "amount is clamped");
  const world = translate(10, 20, 30);
  const moved = explodedWorldMatrix(world, { axis: [0, 0, 1], depth: 1 }, 1);
  assert.deepEqual(moved.slice(12, 15), [10, 20, 30 + EXPLODE_GAP_MM]);
  assert.equal(explodedWorldMatrix(world, null, 1), world, "no explode: the same matrix");
});
