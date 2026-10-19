import assert from "node:assert/strict";
import test from "node:test";
import { CameraController } from "./camera.js";

test("the camera's easing lands on its target instead of creeping on", () => {
  const camera = new CameraController([-0.05, -0.04, -0.001, 0.05, 0.04, 0.001]);
  camera.targetAzimuth += 0.8;
  camera.targetDistance *= 0.5;
  camera.targetFocus = [0.01, 0.002, 0];
  let frames = 0;
  while (frames < 10000 && (camera.azimuth !== camera.targetAzimuth || camera.distance !== camera.targetDistance || camera.focus.some((v, i) => v !== camera.targetFocus[i]))) {
    camera.update(1 / 120);
    frames += 1;
  }
  // At 120 frames a second it is there in about a second.
  assert.ok(frames < 150, `${frames} frames`);
});

test("the camera snaps across the angle wrap", () => {
  const camera = new CameraController([-1, -1, -1, 1, 1, 1]);
  camera.azimuth = Math.PI - 1e-7;
  camera.targetAzimuth = -Math.PI + 1e-7;
  camera.update(1 / 60);
  assert.equal(camera.azimuth, camera.targetAzimuth);
});
