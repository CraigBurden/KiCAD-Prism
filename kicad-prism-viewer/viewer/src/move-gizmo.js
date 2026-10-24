// Move mode for the system scene (System Builder SB2-29): the pose arithmetic
// behind the gizmo and the numeric panel, kept free of the DOM and WebGPU so it
// can be tested on its own.
//
// Poses follow CONTRACTS_P2 §14: millimetres, `T·R`, unit quaternions
// `[x, y, z, w]` with `w ≥ 0`, column-major 4×4 matrices. A move acts on a
// top-level instance of the system (a board, or a child system as one rigid
// group), so its pose is in the world frame.

import { cross, dot, normalize, quatAxis, quatMultiply, quatRotate } from "./math.js";

// Snapping: the host may set its own steps (setMoveSnap); Shift uses the fine
// ones, a tenth of the translation step and one degree.
export const DEFAULT_MOVE_SNAP = Object.freeze({ mm: 0.5, deg: 15 });

export const AXES = Object.freeze([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);

/** The four steps a drag snaps to: the set steps and their Shift (fine) ones. */
export function snapSteps(snap = DEFAULT_MOVE_SNAP) {
  const mm = Number(snap?.mm) > 0 ? Number(snap.mm) : DEFAULT_MOVE_SNAP.mm;
  const deg = Number(snap?.deg) > 0 ? Number(snap.deg) : DEFAULT_MOVE_SNAP.deg;
  return { mm, deg, fineMm: mm / 10, fineDeg: 1 };
}

/** A host's snap as positive steps, keeping `fallback` for anything unusable. */
export function normalizeMoveSnap(snap, fallback = DEFAULT_MOVE_SNAP) {
  const base = snapSteps(fallback);
  return {
    mm: Number(snap?.mm) > 0 ? Number(snap.mm) : base.mm,
    deg: Number(snap?.deg) > 0 ? Number(snap.deg) : base.deg,
  };
}

function clean(value) {
  return Math.round(value * 1e9) / 1e9 + 0;
}

/** §14.1 canonical form: normalised rotation with `w ≥ 0`, values rounded to 1e-9. */
export function canonicalPose(pose) {
  const size = Math.hypot(...pose.rotation) || 1;
  const unit = pose.rotation.map((value) => value / size);
  const leading = [unit[3], unit[0], unit[1], unit[2]].find((value) => Math.abs(value) > 1e-12) ?? 1;
  return {
    translationMm: pose.translationMm.map(clean),
    rotation: unit.map((value) => clean(leading < 0 ? -value : value)),
  };
}

/** Column-major 4×4 of `T·R` (the same as the server's `poses.matrix`). */
export function poseMatrix(pose) {
  const [x, y, z, w] = pose.rotation;
  const [tx, ty, tz] = pose.translationMm;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    tx, ty, tz, 1,
  ];
}

function multiply(a, b) {
  const out = new Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1]
        + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

/** The inverse of a rotation-plus-translation matrix: `Rᵀ`, `−Rᵀ·t`. */
export function rigidInverse(m) {
  const out = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
  for (let row = 0; row < 3; row += 1) {
    out[12 + row] = -(out[row] * m[12] + out[4 + row] * m[13] + out[8 + row] * m[14]);
  }
  return out;
}

export function snapTo(value, step) {
  return step > 0 ? Math.round(value / step) * step : value;
}

/** Millimetres along an axis for a pointer movement, given the axis's on-screen vector per millimetre. */
export function axisAmount(deltaPx, axisPxPerMm) {
  const lengthSquared = axisPxPerMm[0] ** 2 + axisPxPerMm[1] ** 2;
  if (lengthSquared < 1e-9) return 0;
  return (deltaPx[0] * axisPxPerMm[0] + deltaPx[1] * axisPxPerMm[1]) / lengthSquared;
}

/** Signed screen angle from `a` to `b` around `center`, in radians (y points down: clockwise is positive). */
export function screenAngle(center, a, b) {
  const from = Math.atan2(a[1] - center[1], a[0] - center[0]);
  const to = Math.atan2(b[1] - center[1], b[0] - center[0]);
  let angle = to - from;
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * The rotation about `axis` that a screen-space turn of `angle` means. A
 * positive rotation about an axis pointing at the viewer turns
 * counter-clockwise on screen, which is a negative screen angle with y down.
 * `toViewer` is the camera's back vector.
 */
export function ringRotation(axis, toViewer, angle) {
  return dot(axis, toViewer) >= 0 ? -angle : angle;
}

/** The pose's own axes in the world: the gizmo's "local" space. */
export function localAxes(pose) {
  return AXES.map((axis) => quatRotate(pose.rotation, axis));
}

export function translatePose(pose, axis, amountMm) {
  return {
    translationMm: pose.translationMm.map((value, index) => value + axis[index] * amountMm),
    rotation: [...pose.rotation],
  };
}

/** Turn a pose by `angle` (radians) about a world axis through `pivotMm`. */
export function rotatePoseAbout(pose, axis, angle, pivotMm) {
  const turn = quatAxis(axis, angle);
  const offset = pose.translationMm.map((value, index) => value - pivotMm[index]);
  const moved = quatRotate(turn, offset);
  return {
    translationMm: moved.map((value, index) => value + pivotMm[index]),
    rotation: quatMultiply(turn, pose.rotation),
  };
}

/**
 * The occurrence that moves when `key` is selected: a board, or the child
 * system it is in. A flat descriptor (every occurrence its own board) names
 * the occurrence itself; a nested one moves its top-level instance.
 */
export function moveTarget(descriptor, key) {
  if (key == null) return null;
  const items = descriptor?.occurrences || [];
  // A system scene since SB3b lists occurrences flat, with no depth.
  if (!items.some((item) => item.depth != null)) {
    return items.find((item) => item.path === String(key)) ?? null;
  }
  const top = `/${String(key).split("/")[1] || ""}`;
  return items.find((item) => item.path === top && item.depth === 1) ?? null;
}

/**
 * The descriptor with the occurrence at `path` posed at `pose` (source
 * "manual"): its world matrix and those of everything inside it move together.
 * Only top-level occurrences move, so a pose is its world matrix.
 */
export function moveDescriptor(descriptor, path, pose) {
  const target = descriptor.occurrences.find((item) => item.path === path);
  // A nested descriptor only moves its top-level instances; a flat one has none.
  if (!target || (target.depth != null && target.depth !== 1)) return descriptor;
  const world = poseMatrix(pose);
  const delta = multiply(world, rigidInverse(target.worldMatrix));
  const inside = `${path}/`;
  return {
    ...descriptor,
    occurrences: descriptor.occurrences.map((item) => {
      if (item.path === path) {
        return { ...item, pose: { ...canonicalPose(pose), source: "manual" }, worldMatrix: world };
      }
      if (item.path.startsWith(inside)) return { ...item, worldMatrix: multiply(delta, item.worldMatrix) };
      return item;
    }),
  };
}

/** A unit vector perpendicular to `axis`, for drawing its rotation ring. */
export function perpendicular(axis) {
  const helper = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return normalize(cross(axis, helper));
}
