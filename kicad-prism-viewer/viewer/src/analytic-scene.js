import { kicadCopperColor } from "./bundle-geometry.js";

// The board scene of an analytic bundle (ADR amendment V2 §2.1): what the
// mesh path read from its scene manifest, derived from the design bundle's
// members instead. The materialization pack's header gives the stack (layer
// names, order, thicknesses), the nets and the components; the `stackup`
// projection gives the mask and silkscreen colours. Nothing is fetched or
// parsed here: callers pass the opened header and the stackup document.

/** `bundle.json` schema of an analytic bundle, served for one design bundle. */
export const ANALYTIC_BUNDLE_SCHEMA = "prism.viewer_3d.analytic.a0";

// Display colours of the board layers other than copper, as the mesh compiler gave them
// (topology_compiler/pcb_extract.py); copper takes KiCad's (`kicadCopperColor`).
const LAYER_COLORS = {
  "F.SilkS": "#f2f2f2",
  "B.SilkS": "#dddddd",
  "F.Mask": "#316d4f",
  "B.Mask": "#275840",
  "F.Paste": "#c5cbd3",
  "B.Paste": "#aeb7c2",
};
const BOARD_COLOR = "#2f6b4f";
// KiCad's named mask colours, as the stackup projection spells them.
const MASK_COLORS = {
  green: "#316d4f",
  red: "#a5272a",
  blue: "#1f4f8a",
  yellow: "#c9a227",
  white: "#e6e6e6",
  black: "#1a1a1a",
  purple: "#5b2d7a",
};

// The pack's slice roles, in the mesh manifest's spelling.
const ROLE = { conductor: "copper", dielectric: "dielectric", solder_mask: "soldermask", silkscreen: "silkscreen", paste: "paste" };
const MATERIAL = { copper: "copper", dielectric: "FR4", soldermask: "soldermask", silkscreen: "ink", paste: "paste" };

function maskColor(stackup, side) {
  const named = String(stackup?.maskColors?.[side] || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(named)) return named;
  return MASK_COLORS[named.toLowerCase()] || (side === "back" ? LAYER_COLORS["B.Mask"] : LAYER_COLORS["F.Mask"]);
}

/**
 * The scene layers of a pack's stack: one per slice, top to bottom, in the
 * runtime frame (millimetres, z up, the board's mid-plane at 0). Ids count
 * from 1 in stack order. Copper takes the mesh path's per-layer colour so the
 * layer view and toggles look as before.
 */
export function analyticLayers(header, stackup = null) {
  const slices = [...(header?.stack?.slices || [])].sort((a, b) => a.order - b.order);
  const thickness = (slice) => Number(slice.thickness_nm || 0) / 1e6;
  const total = slices.reduce((sum, slice) => sum + thickness(slice), 0);
  let top = total / 2;
  let inner = 0;
  const layers = [];
  for (const slice of slices) {
    const role = ROLE[slice.role];
    const height = thickness(slice);
    const centre = top - height / 2;
    top -= height;
    if (!role) continue;
    const name = String(slice.kicad_layer || slice.key);
    let color = LAYER_COLORS[name];
    // Copper in KiCad's own layer colours.
    if (role === "copper") color = kicadCopperColor(name, name === "F.Cu" || name === "B.Cu" ? 0 : inner++);
    if (role === "soldermask") color = maskColor(stackup, slice.side === "back" ? "back" : "front");
    if (role === "dielectric") color = slice.color || BOARD_COLOR;
    layers.push({
      id: layers.length + 1,
      uid: `layer_${slice.key}`,
      name,
      role,
      z_mm: +centre.toFixed(6) || 0,
      thickness_mm: +height.toFixed(6),
      material: slice.material_name || MATERIAL[role],
      color: color || "#8a8a8a",
      visibility_group: role === "dielectric" ? "board" : role,
      stack_index: slice.order,
      side: slice.side || null,
      sliceKey: slice.key,
    });
  }
  return layers;
}

/**
 * The board's extent in millimetres, `[minX, minY, maxX, maxY]` in KiCad's
 * frame (y down), from the chunk directory: the board body's (dielectric)
 * chunks, so text drawn outside the outline does not widen it; every chunk
 * when the pack has no dielectric.
 */
export function analyticBoundsMm(header) {
  const chunks = header?.chunks || [];
  const body = chunks.filter((chunk) => String(chunk.slice_key || "").startsWith("dielectric"));
  let bounds = null;
  for (const chunk of body.length ? body : chunks) {
    const b = chunk.bounds;
    if (!b) continue;
    const next = [b.min_x_nm, b.min_y_nm, b.max_x_nm, b.max_y_nm].map((value) => Number(value) / 1e6);
    bounds = bounds
      ? [Math.min(bounds[0], next[0]), Math.min(bounds[1], next[1]), Math.max(bounds[2], next[2]), Math.max(bounds[3], next[3])]
      : next;
  }
  return bounds;
}

/**
 * First feature id of the analytic components (one each, in header order), and
 * of the features a click on a pack operation makes (`ANALYTIC_OPERATION_FEATURES`
 * plus its index, below 2^32). Components count from 1: their ids index the
 * renderer's hidden-feature mask (DNP, hidden parts), which is as long as the
 * largest id, so they stay small and dense; nothing else in an analytic scene
 * takes a low id.
 */
export const ANALYTIC_COMPONENT_FEATURES = 1;
export const ANALYTIC_OPERATION_FEATURES = 0x40000000;

/**
 * A component's extent as a scene feature's `boundsMm` (x, board y, height
 * up the stack, millimetres, the stack centred on 0): its body bounds placed
 * by its affine, from its side's outer face up by its body height (1 mm when
 * the footprint names none). Null without body bounds; the parts' models
 * widen it when they load.
 */
export function componentBoundsMm(component, boardThicknessMm) {
  const body = component?.body_bounds;
  const affine = component?.affine;
  if (!body || !affine) return null;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of [[body.min_x_nm, body.min_y_nm], [body.max_x_nm, body.min_y_nm], [body.min_x_nm, body.max_y_nm], [body.max_x_nm, body.max_y_nm]]) {
    const bx = (affine.m11 * x + affine.m12 * y + Number(affine.tx_nm)) / 1e6;
    const by = (affine.m21 * x + affine.m22 * y + Number(affine.ty_nm)) / 1e6;
    [x0, y0, x1, y1] = [Math.min(x0, bx), Math.min(y0, by), Math.max(x1, bx), Math.max(y1, by)];
  }
  const height = component.body_height_nm ? Number(component.body_height_nm) / 1e6 : 1;
  const face = boardThicknessMm / 2;
  const [low, high] = component.side === "back" ? [-face - height, -face] : [face, face + height];
  return [x0, y0, low, x1, y1, high];
}

/**
 * A scene manifest for the board viewer, in the shape the mesh path's scene
 * manifest has (`prism.semantic_gltf_a0`): layers, nets, components and the
 * glTF-frame bounding box, with no tiles, barrels or object features. The
 * analytic renderer draws the board; picks resolve through the pack.
 */
export function analyticSceneManifest(header, stackup = null) {
  const layers = analyticLayers(header, stackup);
  const nets = [{ id: 0, uid: "", name: "", netClass: "" }];
  for (const net of header?.nets || []) {
    if (!net?.name) continue;
    nets.push({ id: nets.length, uid: String(net.key || net.name), name: String(net.name), netClass: String(net.net_class || ""), aliases: [] });
  }
  const thickness = Number(header?.stack?.board_thickness_nm || 0) / 1e6;
  const components = (header?.components || []).map((component, index) => ({
    id: index + 1,
    // Each its own feature: the parts' GLB nodes take it, and a click or a cross-probe selects it.
    featureId: ANALYTIC_COMPONENT_FEATURES + index,
    uid: String(component.source_uid || ""),
    designator: String(component.refdes || ""),
    footprint: String(component.footprint || ""),
    side: component.side || null,
    nodeIndex: null,
    meshNames: [],
    boundsMm: componentBoundsMm(component, thickness),
  }));
  const extent = analyticBoundsMm(header);
  // glTF frame, metres: x right, y up the stack, z down the board (as the mesh manifest's bbox).
  const bbox = extent
    ? { min: [extent[0] / 1000, -thickness / 2000, extent[1] / 1000], max: [extent[2] / 1000, thickness / 2000, extent[3] / 1000] }
    : null;
  return {
    schema: "prism.analytic_scene.a0",
    bbox,
    // The parts' GLB is KiCad's, whose board runs from 0 up to its thickness; this board is centred.
    componentsZOffsetMm: -thickness / 2,
    layers,
    copperLayerIds: layers.filter((layer) => layer.role === "copper").map((layer) => layer.id),
    nets,
    objectFeatures: [],
    components,
    tiles: [],
    barrels: [],
  };
}

// The mesh compiler's mask and paste looks (topology_compiler/board_looks.py): linear RGBA.
const MASK_LOOKS = {
  green: [0.06, 0.16, 0.11, 0.83],
  red: [0.52, 0.05, 0.05, 0.83],
  blue: [0.05, 0.12, 0.42, 0.83],
  black: [0.05, 0.05, 0.05, 0.85],
  white: [0.9, 0.9, 0.9, 0.83],
  purple: [0.3, 0.1, 0.4, 0.83],
  yellow: [0.7, 0.62, 0.1, 0.83],
};
const PASTE_LOOK = [0.62, 0.63, 0.65, 1.0];
const SILK_LOOK = [0.9, 0.9, 0.88, 1.0];

const linear = (channel) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

/** A KiCad mask colour (a name or `#RRGGBB[AA]`) as linear RGBA; green when unknown. */
export function maskLook(color) {
  const value = String(color || "").trim().toLowerCase();
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(value);
  if (hex) {
    const channels = [0, 2, 4].map((at) => parseInt(hex[1].slice(at, at + 2), 16));
    const alpha = hex[2] ? parseInt(hex[2], 16) / 255 : MASK_LOOKS.green[3];
    return [...channels.map((channel) => +linear(channel).toFixed(4)), +alpha.toFixed(4)];
  }
  return [...(MASK_LOOKS[value] || MASK_LOOKS.green)];
}

/**
 * The renderer's `stackupLooks` for an analytic board, from the `stackup`
 * projection: the mask per side, the paste and the silkscreen. The mesh path
 * read the same from its compiler's `board_looks`.
 */
export function analyticBoardLooks(stackup) {
  const front = stackup?.maskColors?.front || "";
  return {
    soldermask: { front: maskLook(front), back: maskLook(stackup?.maskColors?.back || front) },
    paste: [...PASTE_LOOK],
    silkscreen: [...SILK_LOOK],
  };
}
