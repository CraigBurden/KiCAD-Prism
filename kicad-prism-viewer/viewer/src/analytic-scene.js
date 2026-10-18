// The board scene of an analytic bundle (ADR amendment V2 §2.1): what the
// mesh path read from its scene manifest, derived from the design bundle's
// members instead. The materialization pack's header gives the stack (layer
// names, order, thicknesses), the nets and the components; the `stackup`
// projection gives the mask and silkscreen colours. Nothing is fetched or
// parsed here: callers pass the opened header and the stackup document.

/** `bundle.json` schema of an analytic bundle, served for one design bundle. */
export const ANALYTIC_BUNDLE_SCHEMA = "prism.viewer_3d.analytic.a0";

// Display colours, as the mesh compiler gave them (topology_compiler/pcb_extract.py).
const LAYER_COLORS = {
  "F.Cu": "#df342b",
  "B.Cu": "#245fd3",
  "F.SilkS": "#f2f2f2",
  "B.SilkS": "#dddddd",
  "F.Mask": "#316d4f",
  "B.Mask": "#275840",
  "F.Paste": "#c5cbd3",
  "B.Paste": "#aeb7c2",
};
const INNER_LAYER_COLORS = ["#269e4d", "#93612f", "#159eb7", "#7047b8", "#b58b24", "#a34f76"];
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
    if (role === "copper" && !color) color = INNER_LAYER_COLORS[inner++ % INNER_LAYER_COLORS.length];
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
  const components = (header?.components || []).map((component, index) => ({
    id: index + 1,
    featureId: 0,
    uid: String(component.source_uid || ""),
    designator: String(component.refdes || ""),
    footprint: String(component.footprint || ""),
    side: component.side || null,
    nodeIndex: null,
    meshNames: [],
  }));
  const extent = analyticBoundsMm(header);
  const thickness = Number(header?.stack?.board_thickness_nm || 0) / 1e6;
  // glTF frame, metres: x right, y up the stack, z down the board (as the mesh manifest's bbox).
  const bbox = extent
    ? { min: [extent[0] / 1000, -thickness / 2000, extent[1] / 1000], max: [extent[2] / 1000, thickness / 2000, extent[3] / 1000] }
    : null;
  return {
    schema: "prism.analytic_scene.a0",
    bbox,
    layers,
    copperLayerIds: layers.filter((layer) => layer.role === "copper").map((layer) => layer.id),
    nets,
    objectFeatures: [],
    components,
    tiles: [],
    barrels: [],
  };
}

/**
 * The order in which to lower a pack's slices so the board shows soonest:
 * the outer copper and mask first (what the default view sees), then the
 * dielectrics, paste and silkscreen, then the inner copper.
 */
export function loweringOrder(header) {
  const slices = [...(header?.stack?.slices || [])].sort((a, b) => a.order - b.order);
  const conductors = slices.filter((slice) => slice.role === "conductor");
  const outer = new Set([conductors[0]?.key, conductors[conductors.length - 1]?.key].filter(Boolean));
  const rank = (slice) => {
    if (outer.has(slice.key) || slice.role === "solder_mask") return 0;
    if (slice.role === "conductor") return 2;
    return 1;
  };
  return slices.map((slice, index) => ({ key: slice.key, rank: rank(slice), index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.key);
}

/**
 * The slices of the first frame, as a Set: the outer copper, the masks, and
 * the topmost dielectric (the board body the clip is drawn from; V2a).
 */
export function firstPhaseKeys(header) {
  const slices = [...(header?.stack?.slices || [])].sort((a, b) => a.order - b.order);
  const conductors = slices.filter((slice) => slice.role === "conductor");
  const keys = new Set([conductors[0]?.key, conductors[conductors.length - 1]?.key].filter(Boolean));
  for (const slice of slices) if (slice.role === "solder_mask") keys.add(slice.key);
  const body = slices.find((slice) => slice.role === "dielectric");
  if (body) keys.add(body.key);
  return keys;
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
