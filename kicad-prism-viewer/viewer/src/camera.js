import {
  add,
  boundsCenter,
  boundsRadius,
  clamp,
  cross,
  lookAt,
  mat4Multiply,
  mix,
  normalize,
  orthographic,
  perspective,
  scale,
} from "./math.js";

export class CameraController {
  constructor(bounds) {
    const center = boundsCenter(bounds);
    const radius = boundsRadius(bounds);
    this.focus = [...center];
    this.targetFocus = [...center];
    this.azimuth = -0.62;
    this.targetAzimuth = this.azimuth;
    this.polar = 0.72;
    this.targetPolar = this.polar;
    this.distance = radius * 2.8;
    this.targetDistance = this.distance;
    this.orthoScale = radius * 2.15;
    this.targetOrthoScale = this.orthoScale;
    this.sceneRadius = radius;
    this.fov = Math.PI / 4;
  }

  update(dt) {
    const amount = 1 - Math.exp(-dt * 14);
    this.focus = this.focus.map((value, index) => mix(value, this.targetFocus[index], amount));
    this.azimuth = mixAngle(this.azimuth, this.targetAzimuth, amount);
    this.polar = mixAngle(this.polar, this.targetPolar, amount);
    this.distance = mix(this.distance, this.targetDistance, amount);
    this.orthoScale = mix(this.orthoScale, this.targetOrthoScale, amount);
    // Within a hair of the target (far below a pixel) the easing lands, so
    // a still view stops redrawing instead of creeping on for seconds.
    if (this.settled()) this.snap();
  }

  settled() {
    const scale = Math.max(this.distance, 1e-9);
    const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
    return this.focus.every((value, index) => near(value, this.targetFocus[index], 1e-5 * scale))
      && Math.abs(Math.atan2(Math.sin(this.targetAzimuth - this.azimuth), Math.cos(this.targetAzimuth - this.azimuth))) <= 1e-5
      && Math.abs(Math.atan2(Math.sin(this.targetPolar - this.polar), Math.cos(this.targetPolar - this.polar))) <= 1e-5
      && near(this.distance, this.targetDistance, 1e-5 * scale)
      && near(this.orthoScale, this.targetOrthoScale, 1e-5 * Math.max(this.orthoScale, 1e-9));
  }

  snap() {
    this.focus = [...this.targetFocus];
    this.azimuth = this.targetAzimuth;
    this.polar = this.targetPolar;
    this.distance = this.targetDistance;
    this.orthoScale = this.targetOrthoScale;
  }

  basis() {
    const sine = Math.sin(this.polar);
    const cosine = Math.cos(this.polar);
    const back = normalize([
      sine * Math.sin(this.azimuth),
      -sine * Math.cos(this.azimuth),
      cosine,
    ]);
    const right = normalize([Math.cos(this.azimuth), Math.sin(this.azimuth), 0]);
    const up = normalize(cross(back, right));
    return { right, up, back };
  }

  matrix(width, height, orthographicMode = false, scaleMultiplier = 1) {
    const aspect = Math.max(0.01, width / Math.max(1, height));
    const { up, back } = this.basis();
    const eye = add(this.focus, scale(back, this.distance));
    const view = lookAt(eye, this.focus, up);
    const projection = orthographicMode
      ? orthographic(
          this.orthoScale * scaleMultiplier * aspect,
          this.orthoScale * scaleMultiplier,
          -this.sceneRadius * 40,
          this.sceneRadius * 40,
        )
      : perspective(
          this.fov,
          aspect,
          Math.max(this.sceneRadius * 0.0005, this.distance - this.sceneRadius * 3.5),
          this.distance + this.sceneRadius * 4.5,
        );
    return mat4Multiply(projection, view);
  }

  /**
   * Where the camera is heading (SB2-87): the view at its targets, and a lead
   * view one more step along the same move (`lead` = 1 doubles the remaining
   * offset). Loading for these as well keeps a move's destination resident
   * before the camera gets there.
   */
  targetMatrix(width, height, orthographicMode = false, lead = 0) {
    const ahead = (value, target) => target + (target - value) * lead;
    const saved = [this.focus, this.azimuth, this.polar, this.distance, this.orthoScale];
    this.focus = this.focus.map((value, index) => ahead(value, this.targetFocus[index]));
    const turn = (value, target) => target + Math.atan2(Math.sin(target - value), Math.cos(target - value)) * lead;
    this.azimuth = turn(this.azimuth, this.targetAzimuth);
    this.polar = turn(this.polar, this.targetPolar);
    this.distance = Math.max(this.sceneRadius * 0.001, ahead(this.distance, this.targetDistance));
    this.orthoScale = Math.max(this.sceneRadius * 0.001, ahead(this.orthoScale, this.targetOrthoScale));
    const matrix = this.matrix(width, height, orthographicMode);
    [this.focus, this.azimuth, this.polar, this.distance, this.orthoScale] = saved;
    return matrix;
  }

  /** True while the camera is still easing towards its targets. */
  moving() {
    const near = (a, b) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-4);
    return !(this.focus.every((value, index) => near(value, this.targetFocus[index]))
      && near(this.azimuth, this.targetAzimuth) && near(this.polar, this.targetPolar)
      && near(this.distance, this.targetDistance) && near(this.orthoScale, this.targetOrthoScale));
  }

  /**
   * Free orbit: the polar angle wraps instead of stopping at straight above or
   * below, so a drag rolls over either pole (the view turns upside down, as in
   * KiCad). The up vector stays perpendicular to the view at any angle.
   */
  orbit(dx, dy) {
    // Upside down, turning about the board normal reads mirrored; follow the mouse.
    const sign = Math.sin(this.targetPolar) < 0 ? -1 : 1;
    this.targetAzimuth -= sign * dx * 0.006;
    this.targetPolar = wrapAngle(this.targetPolar - dy * 0.006);
  }

  /** True while the camera looks at the board from below. */
  isBelow() {
    return Math.cos(this.targetPolar) < 0;
  }

  pan(dx, dy, viewportHeight, orthographicMode = false) {
    const { right, up } = this.basis();
    const worldPerPixel = orthographicMode
      ? this.targetOrthoScale / Math.max(1, viewportHeight)
      : (2 * this.targetDistance * Math.tan(this.fov / 2)) / Math.max(1, viewportHeight);
    const movement = add(scale(right, -dx * worldPerPixel), scale(up, dy * worldPerPixel));
    this.targetFocus = add(this.targetFocus, movement);
  }

  dolly(delta, orthographicMode = false) {
    const factor = Math.exp(delta * 0.0032);
    if (orthographicMode) {
      this.targetOrthoScale = clamp(
        this.targetOrthoScale * factor,
        this.sceneRadius * 0.008,
        this.sceneRadius * 24,
      );
    } else {
      this.targetDistance = clamp(
        this.targetDistance * factor,
        this.sceneRadius * 0.01,
        this.sceneRadius * 48,
      );
    }
  }

  frame(bounds) {
    if (!bounds) return;
    const radius = boundsRadius(bounds);
    this.targetFocus = boundsCenter(bounds);
    this.targetDistance = Math.max(radius * 2.8, this.sceneRadius * 0.02);
    this.targetOrthoScale = Math.max(radius * 2.15, this.sceneRadius * 0.02);
  }

  setFocus(point) {
    this.targetFocus = [...point];
  }

  setAxis(axis, opposite = false) {
    if (axis === "z") {
      this.targetAzimuth = 0;
      this.targetPolar = opposite ? Math.PI - 0.015 : 0.015;
    } else if (axis === "x") {
      this.targetAzimuth = opposite ? -Math.PI / 2 : Math.PI / 2;
      this.targetPolar = Math.PI / 2;
    } else {
      this.targetAzimuth = opposite ? 0 : Math.PI;
      this.targetPolar = Math.PI / 2;
    }
  }

  rotateZ(direction = 1) {
    this.targetAzimuth += direction * Math.PI / 2;
  }

  flip() {
    this.targetPolar = wrapAngle(Math.PI - this.targetPolar);
  }
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function mixAngle(current, target, amount) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * amount;
}
