// Placing a system scene's boards and catalog models (System Builder SB3b).
//
// The `prism.system_scene.a0` descriptor (CONTRACTS_P2 §20) places each board
// occurrence by a world matrix in millimetres; an asset (one bundle) draws at
// world · bundleToBoard, scaled to the renderer's metres. Occurrences without
// geometry (restricted, still building, missing, failed) draw as their box.
// Bodies and parts draw a catalog GLB instead, and a child part follows its
// parent's current frame through its own `localMatrix`.

const MM = 0.001; // descriptor millimetres → renderer metres
const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// The assembly explode moves a board this far per unit of `explode.depth`.
export const EXPLODE_GAP_MM = 30;

// Stand-in boxes by why the board has no geometry.
export const STAND_INS = Object.freeze({
  restricted: { color: [0.55, 0.57, 0.6, 1], label: "Restricted" },
  loading: { color: [0.7, 0.76, 0.82, 1], label: "Loading…" },
  building: { color: [0.62, 0.72, 0.84, 1], label: "Building 3D view…" },
  missing: { color: [0.78, 0.76, 0.7, 1], label: "No 3D view" },
  failed: { color: [0.86, 0.6, 0.56, 1], label: "3D view failed" },
  unknown: { color: [0.78, 0.76, 0.7, 1], label: "" },
});

const SCALE_MM = Object.freeze([MM, 0, 0, 0, 0, MM, 0, 0, 0, 0, MM, 0, 0, 0, 0, 1]);

// Column-major product in double precision: placement composes in float64 and is
// narrowed to float32 once, when the occurrence buffer is written.
function mat4Multiply(a, b) {
  const output = new Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      output[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1]
        + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
    }
  }
  return output;
}

function translation([x, y, z]) {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

function scaling([x, y, z]) {
  return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
}

/** An asset occurrence's model matrix in renderer metres: S(1/1000) · world · bundleToBoard. */
export function assetOccurrenceMatrix(worldMatrix, bundleToBoard) {
  return mat4Multiply(SCALE_MM, mat4Multiply(worldMatrix, bundleToBoard));
}

/**
 * A child part's world matrix: its parent's current world matrix (after the
 * assembly explode and any move preview) times its local matrix, both in mm.
 */
export function childWorldMatrix(parentWorldMatrix, localMatrix) {
  return mat4Multiply(parentWorldMatrix, localMatrix || IDENTITY);
}

/** A stand-in's matrix: the unit box mapped onto the occurrence's box (own frame, mm), then placed. */
export function standInMatrix(worldMatrix, boundsMm) {
  const min = boundsMm.minMm;
  const size = boundsMm.maxMm.map((value, index) => Math.max(value - min[index], 0.2));
  return mat4Multiply(SCALE_MM, mat4Multiply(worldMatrix, mat4Multiply(translation(min), scaling(size))));
}

/**
 * The bundle frame's transform into the board frame when the host does not
 * send one: an analytic bundle's runtime frame is metres, the board's own
 * frame is millimetres with its mid-plane at z 0. `bounds` is the board's
 * runtime bounds `[minX, minY, minZ, maxX, maxY, maxZ]`, in metres.
 */
export function bundleToBoardFromBounds(bounds) {
  const minZ = Number(bounds?.[2]) || 0;
  const maxZ = Number(bounds?.[5]) || 0;
  return [
    1000, 0, 0, 0,
    0, 1000, 0, 0,
    0, 0, 1000, 0,
    0, 0, -1000 * (minZ + maxZ) / 2 + 0, 1,
  ];
}

/**
 * Why an occurrence draws as a stand-in, or null when its asset draws it.
 * `state` is the asset's load state here (waiting, loading, loaded, failed).
 */
export function standInKind(occurrence, asset, state) {
  if (occurrence.restricted) return "restricted";
  if (!occurrence.assetId || !asset) return "missing";
  if (state === "loaded") return null;
  if (state === "failed") return "failed";
  // An analytic asset sends no `bundleToBoard`: the board gives it once loaded.
  if (asset.status === "ready") return asset.bundleUrl ? "loading" : "building";
  return STAND_INS[asset.status] ? asset.status : "unknown";
}

/**
 * Whether an asset can be loaded: its bundle is final. `bundleToBoard` may be
 * null for an analytic bundle; the board's runtime bounds give it after the load.
 */
export function assetLoadable(asset) {
  return Boolean(asset && asset.status === "ready" && asset.bundleUrl);
}

/**
 * What a re-read scene means for a board already known by asset id (retro D5):
 * "create" (new, or its bundle URL changed, or it failed: start over), "load"
 * (kept waiting at a stable URL that is now ready: a staged bundle finished),
 * or "keep" (loading, loaded, or still not ready).
 */
export function boardTransition(known, asset) {
  if (!known || known.bundleUrl !== asset.bundleUrl || known.loadState === "failed") return "create";
  if (known.loadState === "waiting" && assetLoadable(asset)) return "load";
  return "keep";
}

/**
 * Occurrences to place: boards, restricted assemblies (one box for a hidden
 * child system), and bodies and parts that carry a catalog model.
 */
export function drawnOccurrences(descriptor) {
  return (descriptor?.occurrences || []).filter((item) => item.kind === "board" || item.kind === "entry" || item.restricted
    || ((item.kind === "body" || item.kind === "part") && item.model != null));
}

/** A board frame's extra translation for an assembly explode, in millimetres. */
export function explodeOffsetMm(explode, amount) {
  if (!explode) return [0, 0, 0];
  const depth = Number(explode.depth) || 0;
  const axis = explode.axis || [0, 0, 0];
  const share = depth * Math.max(0, Math.min(1, Number(amount) || 0)) * EXPLODE_GAP_MM;
  return [0, 1, 2].map((index) => (Number(axis[index]) || 0) * share);
}

/** A world matrix moved by its occurrence's assembly explode: labels, picks, framing and the gizmo follow it. */
export function explodedWorldMatrix(worldMatrix, explode, amount) {
  const offset = explodeOffsetMm(explode, amount);
  if (!offset[0] && !offset[1] && !offset[2]) return worldMatrix;
  const output = [...worldMatrix];
  output[12] += offset[0];
  output[13] += offset[1];
  output[14] += offset[2];
  return output;
}

/**
 * Whether every board whose bundle is ready draws its own geometry, not a box
 * (and at least one does): when the system's first full frame is counted (SB2-30).
 */
export function allReadyBoardsDrawn(placed) {
  if (!placed.length) return false;
  let drawn = 0;
  for (const item of placed) {
    if (!item.standIn) drawn += 1;
    else if (item.standIn === "loading") return false;
  }
  return drawn > 0;
}
