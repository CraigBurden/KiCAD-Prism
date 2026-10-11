/*
    Inset views (IN-60, IN-61): a small view of the loaded board through a
    camera of its own, for the Visualizer's PCB/schematic insets.

    The camera is the 2D inset camera from ecad-viewer, in KiCad board
    millimetres (x right, y down), plus a tilt:

      center    [x, y] mm shown at the middle of the inset
      zoom      CSS pixels per mm
      rotation  radians, clockwise on screen
      mirror    view from below (bottom side), mirrored like KiCad's flip
      tilt      radians the view leans back from straight down (0 = top view)

    With tilt 0 the projection is orthographic straight down, so a board
    point lands exactly where the 2D inset puts it and leaders stay right.
    Tilt keeps the projection orthographic: one scale, no foreshortening of
    the leader geometry beyond the lean itself.

    The runtime frame is metres: x = board right, y = board up (KiCad y
    negated), z = stackup up.
*/

import { boundsRadius, lookAt, mat4Multiply, orthographic } from "./math.js";

/** KiCad millimetres (y down) to runtime metres (y up). */
export function mmToRuntime(x, y, z = 0) {
  return [x / 1000, -y / 1000, z];
}

/**
 * Camera basis for an inset view: screen right, screen up and back (towards
 * the eye), in runtime metres. See the header for the conventions.
 */
export function insetBasis({ rotation = 0, mirror = false, tilt = 0 }) {
  // Straight down: right = +x, up = +y, back = +z. From below the board
  // mirrors left to right: right = -x, back = -z.
  const r0 = mirror ? [-1, 0, 0] : [1, 0, 0];
  const u0 = [0, 1, 0];
  const b0 = mirror ? [0, 0, -1] : [0, 0, 1];
  // Content turns clockwise on screen: the camera's right and up turn the
  // other way about the view axis.
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  const r1 = r0.map((v, i) => c * v + s * u0[i]);
  const u1 = u0.map((v, i) => -s * r0[i] + c * v);
  // Lean back about screen right: the eye moves towards screen-down.
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const back = b0.map((v, i) => ct * v - st * u1[i]);
  const up = u1.map((v, i) => st * b0[i] + ct * v);
  return { right: r1, up, back };
}

/**
 * projection · view for an inset of `width`×`height` CSS pixels. `radius` is
 * the scene radius in metres (depth range); `focusZ` the height the view
 * pivots about (the board surface on the inset's side).
 */
export function insetMatrix(view, width, height, radius, focusZ = 0) {
  const { up, back } = insetBasis(view);
  const focus = mmToRuntime(view.center[0], view.center[1], focusZ);
  const distance = radius * 3;
  const eye = focus.map((v, i) => v + back[i] * distance);
  const metresPerPixel = 1 / (view.zoom * 1000);
  const projection = orthographic(
    width * metresPerPixel,
    height * metresPerPixel,
    -radius * 40,
    radius * 40,
  );
  return mat4Multiply(projection, lookAt(eye, focus, up));
}

/** A runtime point (metres) to inset CSS pixels, or null behind the eye. */
export function projectInset(matrix, width, height, point) {
  const [x, y, z] = point;
  const cx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
  const cy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
  const cw = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  if (!(cw > 0)) return null;
  return [((cx / cw + 1) / 2) * width, ((1 - cy / cw) / 2) * height];
}

/**
 * The world box of a feature (runtime metres, [x0,y0,z0,x1,y1,z1]) as a KiCad
 * millimetre box {x, y, w, h} and its side.
 */
export function runtimeBoundsToMm(bounds) {
  const x0 = bounds[0] * 1000;
  const x1 = bounds[3] * 1000;
  const y0 = -bounds[4] * 1000;
  const y1 = -bounds[1] * 1000;
  return {
    box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    bottom: bounds[2] + bounds[5] < 0,
  };
}

/** The board surface on one side as a runtime height (`focusZ`), from the board's runtime bounds; 0 without them. */
export function insetSurfaceZ(runtimeBounds, bottom) {
  if (!runtimeBounds) return 0;
  return bottom ? runtimeBounds[2] : runtimeBounds[5];
}

/** Inset CSS pixels of a KiCad-mm point on the inset's surface, through the inset camera over a board of these bounds. */
export function projectInsetPoint(runtimeBounds, view, width, height, pointMm) {
  const radius = boundsRadius(runtimeBounds);
  const matrix = insetMatrix(view, width, height, radius, view.focusZ ?? 0);
  return projectInset(matrix, width, height, mmToRuntime(pointMm[0], pointMm[1], view.focusZ ?? 0));
}

/** A KiCad-mm box {x,y,w,h} from [x0,y0,x1,y1]. */
const boxFromMm = ([x0, y0, x1, y1]) => ({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) });
const boxCentre = (box) => [box.x + box.w / 2, box.y + box.h / 2];

/** sourceUid → feature, pads by footprint and number, and footprint bodies by designator; built once per scene. */
const insetIndexes = new WeakMap();

function insetIndexFor(scene, topology) {
  const known = insetIndexes.get(scene);
  if (known) return known;
  const bySource = new Map();
  const padsByFootprintPin = new Map();
  for (const feature of scene.features.values()) {
    if (feature.sourceUid) bySource.set(String(feature.sourceUid), feature);
    if (feature.kind !== "pad") continue;
    // "<footprint lib:name>:pad:<index>:<number>" when the pad carries no designator.
    const match = /^(.*):pad:\d+:(.+)$/.exec(String(feature.sourceUid || ""));
    if (!match) continue;
    const key = `${match[1]}\u0000${match[2]}`;
    if (!padsByFootprintPin.has(key)) padsByFootprintPin.set(key, []);
    padsByFootprintPin.get(key).push(feature);
  }
  const bodies = new Map();
  for (const item of topology?.physical_objects || []) {
    if (item.kind === "footprint_body" && item.designator && item.bbox_mm?.length === 4) bodies.set(item.designator, item);
  }
  const objects = new Map((topology?.physical_objects || []).map((item) => [item.uid, item]));
  const index = { bySource, padsByFootprintPin, bodies, objects };
  insetIndexes.set(scene, index);
  return index;
}

/**
 * A component (and optionally one of its pads) as an inset target, in KiCad
 * millimetres: the box to frame, the anchor point, and the side. `scene` is
 * the board's indexed scene (features, componentFeatures, runtimeBounds) and
 * `topology` its topology. Pads come from the topology (terminal → PCB pad →
 * feature); bundles without pad ids fall back to the footprint's pad of that
 * number nearest the part. Null when the part is unknown or has no extent.
 */
export function insetTarget({ scene, topology }, reference, pin) {
  const ref = String(reference);
  const component = scene.componentFeatures.get(ref);
  if (!component) return null;
  const index = insetIndexFor(scene, topology);
  const feature = scene.features.get(Number(component.featureId));
  const body = index.bodies.get(ref);
  let focus = feature?.bounds ? runtimeBoundsToMm(feature.bounds).box : body ? boxFromMm(body.bbox_mm.map(Number)) : null;
  let bottom = feature?.bounds ? runtimeBoundsToMm(feature.bounds).bottom : String(body?.layer || "").startsWith("B.");
  let pad = null;
  if (pin != null && pin !== "") {
    const terminal = (topology?.terminals || []).find((t) => t.designator === ref && String(t.pin) === String(pin));
    const object = terminal?.pcb_pad_id ? index.objects.get(terminal.pcb_pad_id) : null;
    pad = object?.source_ids?.[0] ? index.bySource.get(String(object.source_ids[0])) || null : null;
    if (!pad) {
      const candidates = index.padsByFootprintPin.get(`${component.footprint}\u0000${pin}`) || [];
      const near = focus ? boxCentre(focus) : null;
      let best = Infinity;
      for (const candidate of candidates) {
        const c = boxCentre(runtimeBoundsToMm(candidate.bounds).box);
        const d = near ? Math.hypot(c[0] - near[0], c[1] - near[1]) : 0;
        if (d < best) [best, pad] = [d, candidate];
      }
    }
  }
  const padBox = pad?.bounds ? runtimeBoundsToMm(pad.bounds).box : null;
  if (!focus && padBox) {
    focus = padBox;
    bottom = runtimeBoundsToMm(pad.bounds).bottom;
  }
  if (!focus) return null;
  return {
    reference: ref,
    pin: pad ? String(pin) : null,
    focus,
    anchor: boxCentre(padBox || focus),
    anchorBox: padBox,
    bottom,
    surfaceZ: insetSurfaceZ(scene.runtimeBounds, bottom),
  };
}

/** Insets drawn recently, by key, so the copper they show stays loaded; an inset not drawn for `ttlMs` lapses. */
export class InsetViews {
  #views = new Map();

  constructor(ttlMs = 3000) {
    this.ttlMs = ttlMs;
  }

  get size() {
    return this.#views.size;
  }

  /** The inset `key` was just drawn through `matrix`. */
  record(key, matrix, at) {
    this.#views.set(key, { matrix, at });
  }

  release(key) {
    this.#views.delete(key);
  }

  clear() {
    this.#views.clear();
  }

  /** The matrices of insets drawn within the TTL; older ones are dropped. */
  active(now) {
    const views = [];
    for (const [key, entry] of this.#views) {
      if (now - entry.at > this.ttlMs) this.#views.delete(key);
      else views.push(entry.matrix);
    }
    return views;
  }
}
