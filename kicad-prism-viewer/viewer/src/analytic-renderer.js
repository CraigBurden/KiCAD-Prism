import {
  ABSENT_VALUE,
  ANALYTIC_ARROW_SHADER,
  ANALYTIC_BARREL_SHADER,
  ANALYTIC_SHADER,
  ANALYTIC_WALL_SHADER,
  BARREL_INSTANCE_BYTES,
  BARREL_VIEW_BYTES,
  GHOST_VERTICES,
  WALL_INSTANCE_BYTES,
  BATCH_WORDS,
  COVER_WORDS,
  OVERLAY_FIELD,
  OVERLAY_NONE,
  OVERLAY_VALUES,
  PALETTE_BYTES,
  SHAPE_WORDS,
  SLICE_UNIFORM_BYTES,
  STENCIL_STEPS,
} from "./analytic-shaders.js";
import { DEFAULT_ANALYTIC_STYLE, RAMP_SIZE, resolveStyle, sampleColormap } from "./analytic-colormaps.js";
import { plainSlab, planOpenings, withPackedEdges } from "./analytic-prepare.js";

const BLEND = {
  color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
};

/** `values` with every non-finite entry replaced by the absent sentinel. */
export function withSentinels(values) {
  const out = Float32Array.from(values);
  for (let index = 0; index < out.length; index += 1) if (!Number.isFinite(out[index])) out[index] = ABSENT_VALUE;
  return out;
}

/**
 * The analytic pipeline family: draws stack slices of a kicad_monkey
 * materialization pack, lowered by `analytic-pack.js`, into the renderer's
 * pass after its opaque geometry, and colours them from simulation results.
 *
 * A slice is `{ key, layerId, z, color, outer, bottom, lowered, bounds }`: `z` in
 * world metres before the layer's exploded offset, `color` linear RGBA, and
 * `bounds` the slice's board-millimetre extent. Without the stencil feature
 * only add shapes draw (no subtracts, no regions); `stats().degraded` says so.
 */
/** Pixels a slice's scissor reaches past its projected extent (MSAA, dilated shapes, wall shading). */
const SCISSOR_MARGIN_PX = 2;

/** How far (mm) a conformal mask's step stands off its copper, clearing the copper's wall. */
export const STEP_CLEARANCE_MM = 0.0005;

/** The viewer's board-layer role of an analytic slice role. */
const BOARD_ROLE = { mask: "soldermask", silk: "silkscreen", paste: "paste" };

/**
 * Whether `hidden` (a set of "role:side" keys, as `boardLayerKey` makes)
 * hides `slice`: a side's solder mask, silkscreen or paste.
 */
export function hiddenBoardLayer(hidden, slice) {
  const role = BOARD_ROLE[slice.role];
  return Boolean(hidden?.size && role) && hidden.has(boardLayerKey(role, slice.faceDown ? "back" : "front"));
}

/**
 * `looks` with the solder mask and paste the stackup states (`semantic_geometry.board_looks`)
 * filled in where no mesh layer gave one; the materials match the mesh mask's.
 */
export function withStackupLooks(looks, stackup) {
  const mask = stackup?.soldermask?.front;
  if (!looks.soldermask && mask?.length >= 3) looks.soldermask = { color: mask, metallic: 0, roughness: 0.6 };
  if (!looks.paste && stackup?.paste?.length >= 3) looks.paste = { color: stackup.paste, metallic: 0, roughness: 0.45 };
  if (!looks.silkscreen && stackup?.silkscreen?.length >= 3) looks.silkscreen = { color: stackup.silkscreen, metallic: 0, roughness: 0.8 };
  return looks;
}

/** The key a side's board layer is hidden by: "soldermask:front", "paste:back", ... */
export function boardLayerKey(role, side) {
  return `${role}:${side}`;
}

/**
 * GPU bytes of field textures kept for overlays shown lately, so switching
 * back is free (the overlay shown always stays, whatever its size).
 */
export const FIELD_CACHE_BYTES = 128 * 1048576;

/**
 * Field textures by raster (its values array), least recently used first
 * out once over `budget` bytes; the rasters of the overlay in force are
 * never dropped (`trim` runs after they are all touched).
 */
export class FieldTextureCache {
  constructor(budget) {
    this.budget = budget;
    this.entries = new Map();
    this.generation = 0;
  }

  texture(raster, make) {
    const key = raster.values;
    let entry = this.entries.get(key);
    if (entry) this.entries.delete(key);
    else entry = { texture: make(), bytes: raster.width * raster.height * 4 };
    entry.used = this.generation;
    this.entries.set(key, entry);
    return entry.texture;
  }

  bytes() {
    let bytes = 0;
    for (const entry of this.entries.values()) bytes += entry.bytes;
    return bytes;
  }

  trim() {
    let bytes = this.bytes();
    for (const [key, entry] of this.entries) {
      if (bytes <= this.budget) break;
      if (entry.used === this.generation) continue;
      entry.texture.destroy();
      bytes -= entry.bytes;
      this.entries.delete(key);
    }
    this.generation += 1;
  }

  clear() {
    for (const entry of this.entries.values()) entry.texture.destroy();
    this.entries.clear();
  }
}

/** Below this many pixels tall, a slab's shape walls are not drawn. */
export const WALL_MIN_PIXELS = 0.3;


// The bind group layout and shader module, one per device: every analytic
// renderer of the device shares them, so cached pipelines fit any of them.
const SHARED = new WeakMap();
// Compiled pipeline sets per device, by format, samples and stencil.
const PIPELINES = new WeakMap();

function sharedFor(device) {
  let shared = SHARED.get(device);
  if (!shared) {
    shared = {
      layout: device.createBindGroupLayout({
        label: "analytic",
        entries: [
          { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
          { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
          { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
          { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
          { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
          { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "unfilterable-float" } },
          { binding: 6, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
          { binding: 7, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
          { binding: 8, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
          { binding: 9, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
          { binding: 10, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
          { binding: 11, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "uint" } },
        ],
      }),
      module: device.createShaderModule({ label: "analytic", code: ANALYTIC_SHADER }),
    };
    SHARED.set(device, shared);
  }
  return shared;
}

function pipelineContext(renderer) {
  const shared = sharedFor(renderer.device);
  return {
    device: renderer.device,
    depthFormat: renderer.depthFormat,
    stencil: renderer.stencil,
    samples: renderer.sampleCount || 1,
    layout: shared.layout,
    module: shared.module,
  };
}

function pipelineKey(renderer) {
  return `${renderer.format}|${renderer.sampleCount || 1}|${renderer.depthFormat}|${renderer.stencil ? 1 : 0}`;
}

function pipelineCache(device) {
  let byKey = PIPELINES.get(device);
  if (!byKey) {
    byKey = new Map();
    PIPELINES.set(device, byKey);
  }
  return byKey;
}

function cachedPipelines(renderer) {
  return pipelineCache(renderer.device).get(pipelineKey(renderer))?.ready || null;
}

function storePipelines(renderer, pipelines) {
  const byKey = pipelineCache(renderer.device);
  const key = pipelineKey(renderer);
  if (!byKey.get(key)?.ready) byKey.set(key, { ready: pipelines, promise: Promise.resolve(pipelines) });
  return pipelines;
}

/**
 * Every analytic pipeline for `format` (`pick`: the 1-sample id variants),
 * each made by `create` from its descriptor: createRenderPipeline, or
 * createRenderPipelineAsync for a prewarm (then the values are promises).
 */
function pipelineSet(context, format, pick, create) {
    const layout = context.device.createPipelineLayout({ bindGroupLayouts: [context.layout] });
    const make = (name, vertex, fragment, step, buffers = [], blended = false, cullMode = "none") => {
      const plan = STENCIL_STEPS[step];
      const depthStencil = {
        format: context.depthFormat,
        depthWriteEnabled: plan.depth,
        depthCompare: plan.depth || plan.depthTest ? "greater" : "always",
      };
      if (context.stencil) {
        Object.assign(depthStencil, {
          stencilFront: plan.face,
          stencilBack: plan.face,
          stencilReadMask: plan.read,
          stencilWriteMask: plan.write,
        });
      }
      return create({
        label: `analytic-${name}${pick ? "-pick" : ""}`,
        layout,
        vertex: { module: context.module, entryPoint: vertex, buffers },
        fragment: {
          module: context.module,
          entryPoint: pick ? `${fragment}_pick` : fragment,
          ...(pick ? {} : { constants: { SAMPLES: context.samples } }),
          targets: [{ format, writeMask: plan.color ? GPUColorWrite.ALL : 0, ...(blended && !pick ? { blend: BLEND } : {}) }],
        },
        primitive: { topology: "triangle-list", cullMode },
        depthStencil,
        multisample: { count: pick ? 1 : context.samples },
      });
    };
    const fanBuffers = [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] }];
    return {
      shapeMask: make("shape-mask", "vs_shape", "fs_shape_mask", "shapeMask"),
      shapeAdd: make("shape", "vs_shape", "fs_shape", "shapeAdd"),
      fan: make("fan", "vs_fan", "fs_plain_mask", "fan", fanBuffers),
      coverSubtract: make("cover-subtract", "vs_cover", "fs_plain_mask", "coverSubtract"),
      coverMark: make("cover-mark", "vs_cover", "fs_plain_mask", "coverMark"),
      coverAdd: make("cover", "vs_cover", "fs_cover", "coverAdd"),
      coverClear: make("cover-clear", "vs_cover", "fs_plain_mask", "coverClear"),
      clear: make("clear", "vs_clear", "fs_plain_mask", "clear"),
      // A slab's side walls: its regions' edges, and its shapes' outline skirts.
      regionWall: make("region-wall", "vs_region_wall", "fs_region_wall", "solid"),
      skirt: make("skirt", "vs_skirt", "fs_skirt", "solid"),
      // Board layers other than copper are never picked.
      ...(pick ? {} : {
        shapeLay: make("shape-lay", "vs_shape", "fs_shape_mask", "shapeLay"),
        coverLay: make("cover-lay", "vs_cover", "fs_cover_mask", "coverLay"),
        shapeBlend: make("shape-blend", "vs_shape", "fs_shape", "shapeBlend", [], true),
        coverBlend: make("cover-blend", "vs_cover", "fs_cover", "coverBlend", [], true),
        tintCovered: make("tint-covered", "vs_clear", "fs_tint_covered", "tintCovered", [], true),
        tintPlain: make("tint-plain", "vs_clear", "fs_tint_plain", "tintPlain", [], true),
        // The conformal mask (see `encodeConformal`).
        footShape: make("foot-shape", "vs_shape", "fs_shape_mask", "footShape"),
        footCover: make("foot-cover", "vs_cover", "fs_cover_mask", "footCover"),
        tintHigh: make("tint-high", "vs_clear", "fs_tint_covered", "tintHigh", [], true),
        tintLow: make("tint-low", "vs_clear", "fs_tint_plain", "tintLow", [], true),
        regionStep: make("region-step", "vs_region_step", "fs_region_step", "coat"),
        step: make("step", "vs_step", "fs_step", "coat"),
        clearLay: make("clear-lay", "vs_clear", "fs_plain_mask", "clearLay"),
        clearFoot: make("clear-foot", "vs_clear", "fs_plain_mask", "clearFoot"),
        shapeOnFoot: make("shape-on-foot", "vs_shape", "fs_shape", "shapeOnFoot", [], true),
        shapeOffFoot: make("shape-off-foot", "vs_shape", "fs_shape", "shapeOffFoot", [], true),
        coverOnFoot: make("cover-on-foot", "vs_cover", "fs_cover", "coverOnFoot", [], true),
        coverOffFoot: make("cover-off-foot", "vs_cover", "fs_cover", "coverOffFoot", [], true),
      }),
    };
}

export class AnalyticRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.device = renderer.device;
    this.stencil = renderer.stencil;
    // The host's colour samples; picking draws one.
    this.samples = renderer.sampleCount || 1;
    this.slices = [];
    // The board's outside faces' heights, and the last view's eye (see `behindBoard`).
    this.skin = null;
    this.eye = null;
    this.viewMatrix = null;
    this.extent = null;
    this.overlay = { mode: OVERLAY_NONE, range: [0, 1] };
    const shared = sharedFor(this.device);
    this.layout = shared.layout;
    this.module = shared.module;
    // The board clip (setBoardClipMask); a 1×1 stand-in until there is one.
    this.boardClip = null;
    this.emptyClip = this.device.createTexture({ label: "analytic-clip-none", size: [1, 1], format: "r8uint", usage: GPUTextureUsage.TEXTURE_BINDING });
    // The overlay's colours (see analytic-colormaps.js), before any pipeline binds them.
    this.palette = this.device.createBuffer({ label: "analytic-palette", size: PALETTE_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.style = resolveStyle(DEFAULT_ANALYTIC_STYLE);
    this.writePalette();
    // Compiled once per device and format (see `AnalyticRenderer.prewarm`).
    this.pipelines = cachedPipelines(renderer) || storePipelines(renderer, {
      color: this.makePipelines(renderer.format, false),
      pick: this.makePipelines("rg32uint", true),
    });
    this.emptyValues = this.buffer(new Float32Array([ABSENT_VALUE]), GPUBufferUsage.STORAGE, "analytic-values-empty");
    this.valuesBuffer = this.emptyValues;
    this.emptyField = this.fieldTexture(1, 1, new Float32Array([ABSENT_VALUE]));
    this.uniformScratch = new ArrayBuffer(SLICE_UNIFORM_BYTES);
    // Each operation's viewer net id (0 for none), for net glow and isolation.
    this.netsBuffer = this.buffer(new Uint32Array(1), GPUBufferUsage.STORAGE, "analytic-nets");
    this.fieldCache = new FieldTextureCache(FIELD_CACHE_BYTES);
    this.makeBarrelPipelines();
    this.makeArrowPipeline();
  }

  /** The globals the shaders read: a system scene asset's own (its view times its model), else the renderer's. */
  globals() {
    return this.renderer.analyticGlobalBuffer || this.renderer.globalBuffer;
  }

  makeArrowPipeline() {
    this.arrowLayout = this.device.createBindGroupLayout({
      label: "analytic-arrows",
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      ],
    });
    // Per layer, 1 while this frame drew its copper (see encodeInto).
    this.drawnLayers = new Uint32Array(256);
    this.drawnLayersBuffer = this.buffer(this.drawnLayers, GPUBufferUsage.STORAGE, "analytic-drawn-layers");
    const module = this.device.createShaderModule({ label: "analytic-arrows", code: ANALYTIC_ARROW_SHADER });
    this.arrowPipeline = this.device.createRenderPipeline({
      label: "analytic-arrow",
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.arrowLayout] }),
      vertex: { module, entryPoint: "vs_arrow" },
      fragment: { module, entryPoint: "fs_arrow", targets: [{ format: this.renderer.format, blend: BLEND }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      // Over the copper they lie on, never hiding each other: drawn in order.
      depthStencil: { format: this.renderer.depthFormat, depthWriteEnabled: false, depthCompare: "greater-equal" },
      multisample: { count: this.samples },
    });
    this.arrows = null;
  }

  /** The palette's ramps and outline from `this.style`. */
  writePalette() {
    const data = new Float32Array(PALETTE_BYTES / 4);
    data.set(sampleColormap(this.style.fieldColormap, RAMP_SIZE), 0);
    data.set(sampleColormap(this.style.arrowColormap, RAMP_SIZE), RAMP_SIZE * 4);
    data.set(this.style.arrowOutline, 2 * RAMP_SIZE * 4);
    this.device.queue.writeBuffer(this.palette, 0, data);
    this.renderer.invalidate?.();
  }

  /** Change how overlays look (see DEFAULT_ANALYTIC_STYLE); returns the style in force. */
  setStyle(style) {
    this.style = resolveStyle(style, this.style);
    this.writePalette();
    return this.style;
  }

  /** Current arrows `{ data, count }` (see `planArrows`), or null to clear. */
  setArrows(arrows) {
    this.arrows?.buffer.destroy();
    this.arrows = arrows?.count
      ? { buffer: this.buffer(new Uint8Array(arrows.data), GPUBufferUsage.STORAGE, "analytic-arrows"), count: arrows.count }
      : null;
    if (this.arrows) {
      this.arrows.bindGroup = this.device.createBindGroup({
        layout: this.arrowLayout,
        entries: [
          { binding: 0, resource: { buffer: this.globals() } },
          { binding: 1, resource: { buffer: this.arrows.buffer } },
          { binding: 2, resource: { buffer: this.layerOffsets } },
          { binding: 3, resource: { buffer: this.palette } },
          { binding: 4, resource: { buffer: this.drawnLayersBuffer } },
        ],
      });
    }
    this.renderer.invalidate?.();
  }

  /** The arrows into an open colour pass: outlines, then the arrows. */
  encodeArrows(pass) {
    if (!this.arrows) return 0;
    // Only on copper this frame drew: none float over hidden layers.
    this.device.queue.writeBuffer(this.drawnLayersBuffer, 0, this.drawnLayers);
    pass.setPipeline(this.arrowPipeline);
    pass.setBindGroup(0, this.arrows.bindGroup);
    pass.draw(9, 2 * this.arrows.count);
    return 1;
  }

  makeBarrelPipelines() {
    const all = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    this.barrelLayout = this.device.createBindGroupLayout({
      label: "analytic-barrels",
      entries: [
        { binding: 0, visibility: all, buffer: { type: "uniform" } },
        { binding: 1, visibility: all, buffer: { type: "uniform" } },
        { binding: 2, visibility: all, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
        { binding: 4, visibility: all, buffer: { type: "read-only-storage" } },
        // Nets and their emphasis: the vertex stage reads them too (ghost barrels, vs_ghost).
        { binding: 5, visibility: all, buffer: { type: "read-only-storage" } },
        { binding: 6, visibility: all, buffer: { type: "read-only-storage" } },
        { binding: 7, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    const module = this.device.createShaderModule({ label: "analytic-barrels", code: ANALYTIC_BARREL_SHADER });
    const layout = this.device.createPipelineLayout({ bindGroupLayouts: [this.barrelLayout] });
    const make = (format, pick) => this.device.createRenderPipeline({
      label: `analytic-barrel${pick ? "-pick" : ""}`,
      layout,
      vertex: { module, entryPoint: "vs_barrel", constants: { PICK_PASS: pick ? 1 : 0 } },
      fragment: { module, entryPoint: pick ? "fs_barrel_pick" : "fs_barrel", targets: [{ format }], constants: { PICK_PASS: pick ? 1 : 0 } },
      // The box's triangles face inward: only its far side draws, once per
      // pixel of its silhouette, also with the eye inside it. The fragment
      // writes the tube's own depth.
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: { format: this.renderer.depthFormat, depthWriteEnabled: true, depthCompare: "greater" },
      multisample: { count: pick ? 1 : this.samples },
    });
    this.barrelPipelines = { color: make(this.renderer.format, false), pick: make("rg32uint", true) };
    // Ghost barrels: translucent strips facing the eye, after the opaque geometry, writing no depth.
    this.ghostPipeline = this.device.createRenderPipeline({
      label: "analytic-ghost-barrel",
      layout,
      vertex: { module, entryPoint: "vs_ghost" },
      fragment: { module, entryPoint: "fs_ghost", targets: [{ format: this.renderer.format, blend: BLEND }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: this.renderer.depthFormat, depthWriteEnabled: false, depthCompare: "greater" },
      multisample: { count: this.samples },
    });
    this.barrelView = this.device.createBuffer({ label: "analytic-barrel-view", size: BARREL_VIEW_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.layerOffsets = this.device.createBuffer({ label: "analytic-layer-offsets", size: 256 * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.viewScratch = new ArrayBuffer(BARREL_VIEW_BYTES);
    this.barrels = null;
    const wallModule = this.device.createShaderModule({ label: "analytic-walls", code: ANALYTIC_WALL_SHADER });
    const wall = (blended) => this.device.createRenderPipeline({
      label: `analytic-wall${blended ? "-blend" : ""}`,
      layout,
      vertex: { module: wallModule, entryPoint: "vs_wall" },
      fragment: { module: wallModule, entryPoint: "fs_wall", targets: [{ format: this.renderer.format, ...(blended ? { blend: BLEND } : {}) }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: this.renderer.depthFormat, depthWriteEnabled: true, depthCompare: "greater" },
      multisample: { count: this.samples },
    });
    this.wallPipelines = { opaque: wall(false), blend: wall(true) };
    this.walls = null;
  }

  /** Side walls of the dielectric slabs, `{ data, count }` (see `planWalls`). */
  setWalls({ data, count }) {
    this.walls?.buffer.destroy();
    this.walls = count ? { buffer: this.buffer(new Uint8Array(data), GPUBufferUsage.STORAGE, "analytic-walls"), count, bindGroup: null } : null;
    if (this.walls) this.walls.bindGroup = this.wallBindGroup();
    this.renderer.invalidate?.();
  }

  wallBindGroup() {
    return this.device.createBindGroup({
      layout: this.barrelLayout,
      entries: [
        { binding: 0, resource: { buffer: this.globals() } },
        { binding: 1, resource: { buffer: this.barrelView } },
        { binding: 2, resource: { buffer: this.walls.buffer } },
        { binding: 3, resource: { buffer: this.valuesBuffer } },
        { binding: 4, resource: { buffer: this.layerOffsets } },
        { binding: 5, resource: { buffer: this.netsBuffer } },
        { binding: 6, resource: { buffer: this.renderer.netMaskBuffer } },
        { binding: 7, resource: { buffer: this.palette } },
      ],
    });
  }

  encodeWalls(pass, blended) {
    if (!this.walls) return 0;
    pass.setPipeline(blended ? this.wallPipelines.blend : this.wallPipelines.opaque);
    pass.setBindGroup(0, this.walls.bindGroup);
    pass.draw(6, this.walls.count);
    return 1;
  }

  /**
   * The frame's shared view: camera, barrel and wall colours, and the
   * layers' exploded offsets, for the barrel and wall pipelines.
   */
  writeView(matrix, layerOffsets, context = {}) {
    const offsets = new Float32Array(256);
    if (layerOffsets) offsets.set(layerOffsets.subarray ? layerOffsets.subarray(0, 256) : layerOffsets.slice(0, 256));
    this.device.queue.writeBuffer(this.layerOffsets, 0, offsets);
    const floats = new Float32Array(this.viewScratch);
    const words = new Uint32Array(this.viewScratch);
    floats.fill(0);
    this.eye = viewEye(matrix);
    this.viewMatrix = matrix;
    floats.set(this.eye, 0);
    floats.set(this.renderer.barrelColor || [0.55, 0.35, 0.16, 1], 4);
    // The board's edge in its laminate's stackup colour.
    const laminate = this.laminateColor() || this.boardLooks().substrate?.color || [0.3, 0.32, 0.25, 1];
    const wallOpacity = (context.boardOpacity ?? 1) * (0.15 + 0.85 * (context.assemblyOpacity ?? 1));
    floats.set([...laminate.slice(0, 3), wallOpacity], 8);
    const barrelValues = this.overlay.mode === OVERLAY_VALUES
      || (this.overlay.mode === OVERLAY_FIELD && this.valuesBuffer !== this.emptyValues);
    words[12] = barrelValues ? 1 : 0;
    words[13] = context.isolateNet ? 1 : 0;
    words[14] = this.boardShown(context) ? 1 : 0;
    // Solid: shown, opaque, and not separated (the viewer then hides inner copper).
    words[15] = this.boardShown(context) && (context.boardOpacity ?? 1) >= 0.999 && this.renderer.innerCopperMode !== "all" ? 1 : 0;
    floats.set(this.overlay.range, 16);
    // Separated: any layer lifted off its place (see `ghosted` in the barrel shader).
    this.separated = Boolean(layerOffsets) && Array.prototype.some.call(layerOffsets, (offset) => Math.abs(offset) > 1e-12);
    words[18] = this.separated ? 1 : 0;
    // A plated edge (the stackup's edge_plating) is copper, as the barrels are.
    floats.set(this.edgePlated ? [...(this.renderer.barrelColor || [0.55, 0.35, 0.16]).slice(0, 3), wallOpacity] : [...laminate.slice(0, 3), wallOpacity], 20);
    floats.set([...(this.boardLooks().soldermask?.color || [0.06, 0.16, 0.11]).slice(0, 3), 1], 24);
    this.device.queue.writeBuffer(this.barrelView, 0, this.viewScratch);
  }

  /**
   * Draw barrels from `{ data, count }` (see `planBarrels`): while set, they
   * replace the renderer's mesh barrels.
   */
  setBarrels({ data, count, skipped = 0 }) {
    this.barrels?.buffer.destroy();
    this.barrels = count
      ? { buffer: this.buffer(new Uint8Array(data), GPUBufferUsage.STORAGE, "analytic-barrels"), count, skipped, bindGroup: null }
      : null;
    if (this.barrels) this.barrels.bindGroup = this.barrelBindGroup();
    this.renderer.invalidate?.();
  }

  hasBarrels() {
    return Boolean(this.barrels);
  }

  barrelBindGroup() {
    return this.device.createBindGroup({
      layout: this.barrelLayout,
      entries: [
        { binding: 0, resource: { buffer: this.globals() } },
        { binding: 1, resource: { buffer: this.barrelView } },
        { binding: 2, resource: { buffer: this.barrels.buffer } },
        { binding: 3, resource: { buffer: this.valuesBuffer } },
        { binding: 4, resource: { buffer: this.layerOffsets } },
        { binding: 5, resource: { buffer: this.netsBuffer } },
        { binding: 6, resource: { buffer: this.renderer.netMaskBuffer } },
        { binding: 7, resource: { buffer: this.palette } },
      ],
    });
  }

  /**
   * Draw the barrels into an open pass, for the view `matrix` (the frame's
   * view-projection) and the layers' exploded `layerOffsets`.
   */
  encodeBarrels(pass, layerOffsets, matrix, pick = false) {
    if (!this.barrels) return 0;
    if (matrix) this.writeView(matrix, layerOffsets, this.context);
    pass.setPipeline(pick ? this.barrelPipelines.pick : this.barrelPipelines.color);
    pass.setBindGroup(0, this.barrels.bindGroup);
    pass.draw(36, this.barrels.count);
    return 1;
  }

  /**
   * Draw the barrels a separated stack shows as ghosts (low translucent
   * tubes; see `vs_ghost`), after the opaque geometry. Nothing while the
   * stack is together: every barrel is then exact.
   */
  encodeGhostBarrels(pass) {
    if (!this.barrels || !this.separated) return 0;
    pass.setPipeline(this.ghostPipeline);
    pass.setBindGroup(0, this.barrels.bindGroup);
    pass.draw(GHOST_VERTICES, this.barrels.count);
    return 1;
  }

  buffer(data, usage, label) {
    const size = Math.max(16, Math.ceil(data.byteLength / 4) * 4);
    const buffer = this.device.createBuffer({ label, size, usage: usage | GPUBufferUsage.COPY_DST });
    if (data.byteLength) this.device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  fieldTexture(width, height, values) {
    const texture = this.device.createTexture({
      label: "analytic-field",
      size: [width, height],
      format: "r32float",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.device.queue.writeTexture({ texture }, values, { bytesPerRow: width * 4 }, [width, height]);
    return texture;
  }

  makePipelines(format, pick) {
    return pipelineSet(pipelineContext(this.renderer), format, pick, (descriptor) => this.device.createRenderPipeline(descriptor));
  }

  /**
   * Compile the analytic pipelines off the frame, once per device and format
   * (V2a): started at boot, they compile while the pack is fetched, opened and
   * lowered, instead of at the first frame. Resolves when they are ready;
   * later renderers take them from the cache.
   */
  static prewarm(renderer) {
    const key = pipelineKey(renderer);
    const byKey = pipelineCache(renderer.device);
    const held = byKey.get(key);
    if (held) return held.promise;
    const context = pipelineContext(renderer);
    const create = (descriptor) => renderer.device.createRenderPipelineAsync(descriptor);
    const settle = async (set) => Object.fromEntries(await Promise.all(Object.entries(set).map(async ([name, pipeline]) => [name, await pipeline])));
    const entry = { ready: null, promise: null };
    entry.promise = Promise.all([
      settle(pipelineSet(context, renderer.format, false, create)),
      settle(pipelineSet(context, "rg32uint", true, create)),
    ]).then(([color, pick]) => {
      entry.ready = { color, pick };
      return entry.ready;
    }).catch(() => {
      byKey.delete(key);
      return null;
    });
    byKey.set(key, entry);
    return entry.promise;
  }

  /** Replace the drawn slices. */
  setSlices(slices) {
    this.releaseSlices();
    const shared = new Map();
    this.slices = slices.map((slice) => this.uploadSlice(slice, shared));
    this.makePlainSlabs(shared);
    this.makeTwins();
    // The board's extent in the world (before exploded offsets), for how big
    // a slab's walls can look (see `wallPixels`).
    const zs = slices.map((slice) => slice.z);
    const xs = slices.flatMap((slice) => [slice.bounds[0], slice.bounds[2]]);
    const ys = slices.flatMap((slice) => [slice.bounds[1], slice.bounds[3]]);
    this.extent = slices.length
      ? [[Math.min(...xs) / 1000, -Math.max(...ys) / 1000, Math.min(...zs)], [Math.max(...xs) / 1000, -Math.min(...ys) / 1000, Math.max(...zs)]]
      : null;
    const skins = slices.filter((slice) => slice.skin);
    this.skin = skins.length === 2
      ? { top: Math.max(...skins.map((slice) => slice.z)), bottom: Math.min(...skins.map((slice) => slice.z)) }
      : null;
    this.renderer.invalidate?.();
  }

  /**
   * The conformal mask's extra drawings of uploaded slices, each sharing
   * its slice's buffers with a uniform of its own: per mask, its face over
   * laminate (`low`) and its side's outer copper at the mask's face, grown
   * by the coat (`foot`, the footprint the mask rises over); per silkscreen,
   * its face over laminate.
   */
  makeTwins() {
    this.twinBuffers?.forEach((buffer) => buffer.destroy());
    this.twinBuffers = [];
    const twin = (slice, changes) => {
      const gpu = {
        ...slice,
        ...changes,
        uniform: this.device.createBuffer({ label: `analytic-twin-${slice.key}`, size: SLICE_UNIFORM_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
        field: null,
      };
      gpu.bindGroup = this.bindGroup(gpu);
      return gpu;
    };
    this.twins = new Map();
    for (const slice of this.slices) {
      if (slice.zLow === undefined || (slice.role !== "mask" && slice.role !== "silk")) continue;
      const entry = { low: twin(slice, { z: slice.zLow }) };
      const copper = slice.role === "mask" && this.slices.find((other) => other.role === "copper" && other.mark && other.faceDown === slice.faceDown);
      if (copper) {
        // Its slab runs from the laminate to the mask's outer face, so its step
        // covers the copper's whole coated wall; its cuts are the mask's
        // openings. It stands a hair off the copper (STEP_CLEARANCE_MM), not a
        // coat's width: the raised mask then lies exactly over the copper,
        // with no translucent band to see the bare wall through.
        const openings = this.uploadOpenings(copper, slice, slice.step);
        const laminate = slice.faceDown ? copper.zTop : copper.zBottom;
        entry.foot = twin(copper, {
          role: "footprint", z: slice.z, dilate: STEP_CLEARANCE_MM, mark: false, walls: false,
          zTop: Math.max(slice.z, laminate), zBottom: Math.min(slice.z, laminate), ...openings,
        });
      }
      this.twins.set(slice, entry);
    }
  }

  /**
   * Upload a mask's step around `copper` (see `planOpenings`): `step` as the
   * workers prepared it, or planned here.
   */
  uploadOpenings(copper, mask, step = null) {
    const planned = step || planOpenings(copper.lowered, mask.lowered);
    const uploaded = this.uploadEdges(planned, `${copper.key}-step`);
    const shapeBuffer = this.buffer(planned.shapes, GPUBufferUsage.STORAGE, `analytic-step-shapes-${copper.key}`);
    this.twinBuffers.push(shapeBuffer, uploaded.edges, uploaded.cuts);
    return { ...uploaded, shapes: shapeBuffer };
  }

  uploadSlice(slice, shared = new Map()) {
    const { lowered } = slice;
    const usage = GPUBufferUsage.STORAGE;
    // Slices lowered once (a dielectric's two faces) share their buffers.
    if (!shared.has(lowered)) {
      shared.set(lowered, {
        shapes: this.buffer(lowered.shapes, usage, `analytic-shapes-${slice.key}`),
        covers: this.buffer(lowered.covers, usage, `analytic-covers-${slice.key}`),
        fans: lowered.fanVertices.length ? this.buffer(lowered.fanVertices, GPUBufferUsage.VERTEX, `analytic-fans-${slice.key}`) : null,
        ...this.uploadEdges(lowered, slice.key),
      });
    }
    const gpu = {
      ...slice,
      ...shared.get(lowered),
      uniform: this.device.createBuffer({ label: `analytic-slice-${slice.key}`, size: SLICE_UNIFORM_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
      shapeCount: lowered.shapes.length / SHAPE_WORDS,
      subtractShapes: lowered.subtractShapes,
      batches: [],
      field: null,
    };
    for (let offset = 0; offset < lowered.batches.length; offset += BATCH_WORDS) {
      const [subtract, firstVertex, vertexCount, firstCover, coverCount] = lowered.batches.subarray(offset, offset + BATCH_WORDS);
      gpu.batches.push({ subtract: subtract === 1, firstVertex, vertexCount, firstCover, coverCount });
    }
    gpu.bindGroup = this.bindGroup(gpu);
    return gpu;
  }

  /** A slab's walls and cuts (see `packEdges`), packed by the workers or here. */
  uploadEdges(lowered, key) {
    const { edgeWords, cutWords, regionEdges, skirtEdges } = withPackedEdges(lowered);
    return {
      edges: this.buffer(edgeWords, GPUBufferUsage.STORAGE, `analytic-edges-${key}`),
      regionEdges,
      skirtEdges,
      cuts: this.buffer(cutWords, GPUBufferUsage.STORAGE, `analytic-cuts-${key}`),
    };
  }

  bindGroup(slice) {
    return this.device.createBindGroup({
      layout: this.layout,
      entries: [
        { binding: 0, resource: { buffer: this.globals() } },
        { binding: 1, resource: { buffer: slice.uniform } },
        { binding: 2, resource: { buffer: slice.shapes } },
        { binding: 3, resource: { buffer: slice.covers } },
        { binding: 4, resource: { buffer: this.valuesBuffer } },
        { binding: 5, resource: (slice.field?.texture || this.emptyField).createView() },
        { binding: 6, resource: { buffer: this.netsBuffer } },
        { binding: 7, resource: { buffer: this.renderer.netMaskBuffer } },
        { binding: 8, resource: { buffer: slice.edges } },
        { binding: 9, resource: { buffer: slice.cuts } },
        { binding: 10, resource: { buffer: this.palette } },
        { binding: 11, resource: (this.boardClip?.texture || this.emptyClip).createView() },
      ],
    });
  }

  /**
   * Clip copper, mask, paste and silkscreen to the board, as KiCad's 3D view
   * does (V2a): `mask` is rasterizeBoardClip's (analytic-clip.js), or null for
   * no clip. The shaders discard what lies over no board (`outsideBoard`).
   */
  setBoardClipMask(mask) {
    if (!mask) {
      this.setBoardClip(null);
      return null;
    }
    // A texel next to the board counts as board (outsideBoard): dilate once
    // here, padded by a texel, so the shader looks up one texel, not nine.
    const { data, width, height } = dilateClip(mask);
    const originMm = [mask.originMm[0] - mask.pitchMm, mask.originMm[1] - mask.pitchMm];
    // writeTexture wants rows of a multiple of 256 bytes.
    const stride = Math.ceil(width / 256) * 256;
    const rows = stride === width ? data : new Uint8Array(stride * height);
    if (rows !== data) for (let row = 0; row < height; row += 1) rows.set(data.subarray(row * width, (row + 1) * width), row * stride);
    const texture = this.device.createTexture({ label: "analytic-clip", size: [width, height], format: "r8uint", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.device.queue.writeTexture({ texture }, rows, { bytesPerRow: stride }, [width, height]);
    this.setBoardClip({ texture, originMm, pitchMm: mask.pitchMm, width, height });
    return this.boardClip;
  }

  /** Use `clip` (or none) and rebind every slice to it. */
  setBoardClip(clip) {
    if (this.boardClip && this.boardClip !== clip) this.boardClip.texture.destroy();
    this.boardClip = clip;
    for (const slice of this.slices) {
      slice.bindGroup = this.bindGroup(slice);
      if (slice.plain) slice.plain.bindGroup = this.bindGroup(slice.plain);
    }
    this.renderer.invalidate?.();
  }

  /** Whether analytic copper replaces the mesh copper of `layerId`. */
  coversLayer(layerId) {
    return this.slices.some((slice) => slice.role !== undefined ? slice.role === "copper" && slice.layerId === Number(layerId) : slice.layerId === Number(layerId));
  }

  /** Whether analytic slices replace the mesh board layers of `boardRole`. */
  coversRole(boardRole) {
    const role = { substrate: "dielectric", soldermask: "mask", silkscreen: "silk", paste: "paste" }[boardRole];
    return Boolean(role) && this.slices.some((slice) => slice.role === role);
  }

  /**
   * Colour every drawn operation from `values` (one per operation index,
   * NaN where a value is absent) through the colormap over `range`.
   */
  setOperationValues(values, range) {
    this.clearOverlay();
    this.valuesBuffer = this.buffer(withSentinels(values), GPUBufferUsage.STORAGE, "analytic-values");
    this.overlay = { mode: OVERLAY_VALUES, range };
    this.rebind();
  }

  /**
   * Colour slices from field rasters: `rasters` maps a slice key to
   * `{ originMm: [x, y], pitchMm, width, height, values }` (row-major from
   * the origin; `pitchMm` is one pitch or `[x, y]` pitches,
   * and optional per-operation `values` colour the barrels,
   * the origin, +x then +y in KiCad's frame, NaN where absent).
   */
  setFieldRasters(rasters, range, values = null) {
    this.clearOverlay(false);
    // Per-operation values still colour what the rasters cannot: the barrels.
    if (values) this.valuesBuffer = this.buffer(withSentinels(values), GPUBufferUsage.STORAGE, "analytic-values");
    for (const slice of this.slices) {
      const raster = rasters.get(slice.key);
      if (!raster) continue;
      // A slab's two faces share one texture; a raster shown lately keeps its own.
      const texture = this.fieldCache.texture(raster, () => this.fieldTexture(raster.width, raster.height, withSentinels(raster.values)));
      slice.field = { ...raster, texture };
    }
    this.fieldCache.trim();
    this.overlay = { mode: OVERLAY_FIELD, range };
    this.rebind();
  }

  clearOverlay(rebind = true) {
    if (this.valuesBuffer !== this.emptyValues) this.valuesBuffer.destroy();
    this.valuesBuffer = this.emptyValues;
    // The field textures stay in the cache (they are its to drop).
    for (const slice of this.slices) slice.field = null;
    this.overlay = { mode: OVERLAY_NONE, range: [0, 1] };
    if (rebind) this.rebind();
  }

  /** Each operation's viewer net id (0 where it has none), for net glow and isolation. */
  setOperationNets(netIds) {
    this.netsBuffer.destroy();
    this.netsBuffer = this.buffer(netIds.length ? netIds : new Uint32Array(1), GPUBufferUsage.STORAGE, "analytic-nets");
    this.rebind();
  }

  rebind() {
    this.boundNetMask = this.renderer.netMaskBuffer;
    for (const slice of this.slices) {
      slice.bindGroup = this.bindGroup(slice);
      if (slice.plain) slice.plain.bindGroup = this.bindGroup(slice.plain);
    }
    for (const entry of this.twins?.values() || []) for (const twin of Object.values(entry)) twin.bindGroup = this.bindGroup(twin);
    if (this.barrels) this.barrels.bindGroup = this.barrelBindGroup();
    if (this.walls) this.walls.bindGroup = this.wallBindGroup();
    this.renderer.invalidate?.();
  }

  writeSlice(slice, layerOffsets, look = null) {
    const floats = new Float32Array(this.uniformScratch);
    const words = new Uint32Array(this.uniformScratch);
    floats.fill(0);
    floats.set(look?.color || slice.color, 0);
    const [a, b] = slice.offsetLayers || [slice.layerId, slice.layerId];
    floats[4] = slice.z + 0.5 * ((layerOffsets?.[a] || 0) + (layerOffsets?.[b] || 0));
    // The 2D view: the layer laid flat (z to 0) at its place in the grid.
    const flat = this.context?.flat?.get(slice.layerId);
    if (flat) {
      floats[4] = slice.z - flat.z;
      floats[44] = flat.offset[0] || 0;
      floats[45] = flat.offset[1] || 0;
    }
    const copper = slice.role === undefined || slice.role === "copper";
    words[5] = copper ? this.overlay.mode : 0;
    // Copper glows with its nets; it hides off the lit nets under net isolation,
    // or on inner layers the renderer shows only where lit.
    const context = this.context || {};
    const isolate = context.isolateNet || (!slice.outer && this.renderer.innerCopperMode === "lit");
    words[7] = copper ? 2 | (isolate ? 1 : 0) : 0;
    const field = copper ? slice.field : null;
    words[6] = field ? 1 : 0;
    if (field) {
      floats.set(field.originMm, 8);
      const [pitchX, pitchY] = Array.isArray(field.pitchMm) ? field.pitchMm : [field.pitchMm, field.pitchMm];
      floats[10] = pitchX;
      floats[11] = pitchY;
      words[12] = field.width;
      words[13] = field.height;
    }
    floats.set(this.overlay.range, 16);
    floats.set(slice.bounds, 20);
    floats.set([look?.metallic ?? 0, look?.roughness ?? 0.72, slice.faceDown ?? slice.bottom ? -1 : 1, copper ? 1 : 0], 24);
    if (slice.zTop !== undefined) {
      const lift = floats[4] - slice.z;
      floats.set([slice.zBottom + lift, slice.zTop + lift], 28);
    }
    words[30] = slice.subtractShapes || 0;
    floats[31] = slice.dilate || 0;
    if (this.eye) floats.set(this.eye, 32);
    const clip = slice.role !== "dielectric" ? this.boardClip : null;
    if (clip) {
      floats.set(clip.originMm, 36);
      floats[38] = clip.pitchMm;
      floats[39] = clip.pitchMm;
      words[40] = clip.width;
      words[41] = clip.height;
      words[42] = 1;
    }
    this.device.queue.writeBuffer(slice.uniform, 0, this.uniformScratch);
  }

  /**
   * Each layer's current mesh copper colour and material, so the analytic
   * copper follows the viewer's copper colouring as the mesh would.
   */
  copperLooks() {
    const looks = new Map();
    for (const entry of this.renderer.entries || []) {
      const layerId = Number(entry.layerId);
      if (entry.kind !== "copper" || looks.has(layerId)) continue;
      const color = entry.color || entry.material?.baseColor;
      looks.set(layerId, {
        color: color && color.length < 4 ? [...color, 1] : color,
        metallic: entry.material?.metallic || 0,
        roughness: entry.material?.roughness ?? 0.72,
      });
    }
    // An analytic-only board's copper follows the viewer's colours (main.js `applyCopperColors`).
    for (const [layerId, color] of this.renderer.copperColors || []) {
      if (!looks.has(layerId)) looks.set(layerId, { color: color.length < 4 ? [...color, 1] : color, metallic: 0, roughness: 0.72 });
    }
    return looks;
  }

  /**
   * The mesh board layers' colour and material by role (substrate, solder
   * mask, silkscreen, paste), so analytic layers follow the viewer's colours.
   * Without a mesh mask (the Rust board body has none), the mask and paste
   * take the stackup's colours from the bundle (`renderer.stackupLooks`).
   */
  boardLooks() {
    const looks = {};
    for (const entry of this.renderer.entries || []) {
      if (entry.kind !== "board" || looks[entry.boardRole]) continue;
      const color = entry.color || entry.material?.baseColor;
      looks[entry.boardRole] = {
        color: color && color.length < 4 ? [...color, 1] : color,
        metallic: entry.material?.metallic || 0,
        roughness: entry.material?.roughness ?? 0.72,
      };
    }
    return withStackupLooks(looks, this.renderer.stackupLooks);
  }

  /** The laminate's colour from the stackup (its first dielectric's), if any. */
  laminateColor() {
    return this.slices.find((slice) => slice.role === "dielectric" && slice.color)?.color || null;
  }

  /** A slice's look for this frame: the copper's, or its board layer's with the opacity rules of the mesh. */
  lookFor(slice, copper, board, context) {
    if (slice.role === undefined || slice.role === "copper") return copper.get(slice.layerId);
    const opacity = context.boardOpacity ?? 1;
    const of = (role, alpha) => {
      const look = board[role];
      if (!look) return null;
      const color = look.color || [1, 1, 1, 1];
      return { ...look, color: [color[0], color[1], color[2], alpha(Number.isFinite(color[3]) ? color[3] : 1)] };
    };
    // An opened stackup keeps its dielectrics as faint slabs, so the spread copper reads clearly.
    if (slice.role === "dielectric") {
      const alpha = opacity * (0.15 + 0.85 * (context.assemblyOpacity ?? 1));
      // In its stackup colour, lit as the mesh substrate.
      if (slice.color) return { ...(board.substrate || { metallic: 0, roughness: 0.72 }), color: [...slice.color.slice(0, 3), alpha] };
      return of("substrate", () => alpha);
    }
    // Mask and silkscreen belong to the assembled board: they fade out as the
    // stackup opens (`assemblyOpacity`), so they never cover the spread copper.
    const assembled = context.assemblyOpacity ?? 1;
    if (slice.role === "mask") return of("soldermask", (a) => Math.min(a, 0.72) * opacity * assembled);
    if (slice.role === "silk") return of("silkscreen", (a) => Math.min(a, 0.92) * opacity * assembled);
    return of("paste", (a) => a);
  }

  /** Draw every slice into an open pass; `pick` selects the pick variants. */
  encodeInto(pass, layerOffsets, visibleLayers, pick = false, context = {}) {
    this.context = context;
    // The renderer replaces its emphasis mask buffer when it grows.
    if (this.renderer.netMaskBuffer !== this.boundNetMask) this.rebind();
    if (context.matrix) this.writeView(context.matrix, layerOffsets, context);
    const pipelines = pick ? this.pipelines.pick : this.pipelines.color;
    const copper = this.copperLooks();
    const board = this.boardLooks();
    const boardShown = this.boardShown(context);
    const solid = boardShown && (context.boardOpacity ?? 1) >= 0.999;
    let drawn = 0;
    if (!pick) this.drawnLayers.fill(0);
    for (const slice of this.slices) {
      const isCopper = slice.role === undefined || slice.role === "copper";
      if (isCopper ? visibleLayers && !visibleLayers.has(slice.layerId) : pick || slice.role !== "dielectric" || !solid) continue;
      if (isCopper && !slice.outer && slice.role !== undefined && this.renderer.innerCopperMode === "none") continue;
      // A solid board that is not separated shows only its outside faces
      // (the viewer then draws inner copper only when lit, if at all).
      if (slice.role === "dielectric" && !slice.skin && this.renderer.innerCopperMode !== "all") continue;
      if (this.behindBoard(slice, context)) continue;
      this.encodeSlice(pass, pipelines, slice, "opaque", layerOffsets, this.lookFor(slice, copper, board, context));
      // The face arrows lie on: the top one, the underside on the bottom layer.
      if (!pick && isCopper && slice.face === (slice.bottom ? "bottom" : "top")) this.drawnLayers[slice.layerId] = 1;
      drawn += 1;
    }
    if (solid && !pick) drawn += this.encodeWalls(pass, false);
    // The base pipelines compare against reference 1.
    if (this.stencil) pass.setStencilReference(1);
    return drawn;
  }

  /** A copper layer's height (world metres, the middle of its faces); null when no slice draws it. */
  layerZ(layerId) {
    const zs = this.slices.filter((slice) => (slice.role === undefined || slice.role === "copper") && slice.layerId === layerId).map((slice) => slice.z);
    return zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : null;
  }

  boardShown(context) {
    return (context.showBoard ?? true) && !context.panelLayer;
  }

  /**
   * Whether a solid board that is not separated hides the slice from the
   * eye: from above its top face, everything facing down lies behind the
   * board, and from below its bottom face everything facing up. Such slices
   * are not drawn at all (their stencil passes would cost the same).
   */
  behindBoard(slice, context) {
    if (!this.skin || !this.eye || this.renderer.innerCopperMode === "all") return false;
    if (!this.boardShown(context) || (context.boardOpacity ?? 1) < 0.999) return false;
    const [, , z, w] = this.eye;
    // A perspective eye is a point; an orthographic one the view direction.
    const above = w ? z > this.skin.top : z < 0;
    const below = w ? z < this.skin.bottom : z > 0;
    return slice.faceDown ? above : below;
  }

  /**
   * Draw the blended board layers, after the opaque geometry and before the
   * mesh's own blended entries: a fading board's dielectrics and walls, the
   * solder mask (tinted over outer copper), paste and silkscreen.
   */
  encodeBlended(pass, layerOffsets, visibleLayers, context = {}) {
    if (!this.stencil) return 0;
    this.context = context;
    const copper = this.copperLooks();
    const board = this.boardLooks();
    const boardShown = this.boardShown(context);
    const fading = boardShown && (context.boardOpacity ?? 1) < 0.999;
    let drawn = 0;
    const draw = (slice, mode) => {
      if (this.behindBoard(slice, context)) return;
      this.encodeSlice(pass, this.pipelines.color, slice, mode, layerOffsets, this.lookFor(slice, copper, board, context));
      drawn += 1;
    };
    for (const slice of this.slices) if (fading && slice.role === "dielectric") draw(slice, "blend");
    if (fading) drawn += this.encodeWalls(pass, true);
    const assembled = boardShown && (context.assemblyOpacity ?? 1) > 0.01;
    // Each side's mask coats its copper, its silkscreen printed on it; the
    // viewer hides any side's mask, silkscreen or paste on its own.
    const shown = (slice) => !hiddenBoardLayer(context.hiddenBoardLayers, slice);
    const printed = new Set();
    for (const mask of this.slices) {
      if (mask.role !== "mask" || !assembled || !shown(mask) || this.behindBoard(mask, context)) continue;
      const twins = this.twins.get(mask);
      if (!twins?.foot) {
        draw(mask, "mask");
        continue;
      }
      const silks = this.slices.filter((slice) => slice.role === "silk" && slice.faceDown === mask.faceDown && shown(slice) && !this.behindBoard(slice, context));
      for (const silk of silks) printed.add(silk);
      drawn += this.encodeConformal(pass, mask, twins, silks, layerOffsets, (slice) => this.lookFor(slice, copper, board, context));
    }
    for (const slice of this.slices) {
      if (slice.role === "paste" && shown(slice) && !context.hidePaste && !context.panelLayer && (!visibleLayers || visibleLayers.has(slice.offsetLayers?.[0]))) draw(slice, "blend");
    }
    for (const slice of this.slices) if (slice.role === "silk" && assembled && shown(slice) && !printed.has(slice)) draw(slice, "blend");
    pass.setStencilReference(1);
    return drawn;
  }

  encodeSlice(pass, pipelines, face, mode, layerOffsets, look) {
    const slice = this.drawnSlice(face);
    // Only where the slice can be: its stencil steps cover the whole viewport otherwise.
    // (A pick draws everything: its view may not be this frame's.)
    const rect = pipelines === this.pipelines.pick ? undefined : this.sliceRect(slice, layerOffsets);
    if (rect === null) return;
    if (rect) pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
    this.encodeSliceIn(pass, pipelines, slice, mode, layerOffsets, look);
    if (rect) pass.setScissorRect(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height);
  }

  /**
   * The viewport pixels `slice` can cover in this frame (its board extent
   * between its lowest and highest face, lifted by its layers' offsets,
   * projected, grown by SCISSOR_MARGIN_PX): `{ x, y, width, height }`;
   * `undefined` for the whole viewport (no viewport or view known, or a
   * corner behind the eye); null when it lies off screen.
   */
  sliceRect(slice, layerOffsets) {
    const viewport = this.viewport;
    const matrix = this.viewMatrix;
    // A flat (2D) layer is moved in the shader; it takes the whole viewport.
    if (!viewport || !matrix || !slice.bounds || this.context?.flat) return undefined;
    const [a, b] = slice.offsetLayers || [slice.layerId, slice.layerId];
    const lift = 0.5 * ((layerOffsets?.[a] || 0) + (layerOffsets?.[b] || 0));
    const zs = [slice.z, slice.zBottom ?? slice.z, slice.zTop ?? slice.z, slice.zLow ?? slice.z].map((z) => z + lift);
    const [x0, y0, x1, y1] = slice.bounds;
    let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const x of [x0 / 1000, x1 / 1000]) {
      for (const y of [-y0 / 1000, -y1 / 1000]) {
        for (const z of [Math.min(...zs), Math.max(...zs)]) {
          const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
          if (!(w > 1e-9)) return undefined;
          const px = viewport.x + ((matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w + 1) * 0.5 * viewport.width;
          const py = viewport.y + (1 - (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w) * 0.5 * viewport.height;
          left = Math.min(left, px);
          right = Math.max(right, px);
          top = Math.min(top, py);
          bottom = Math.max(bottom, py);
        }
      }
    }
    const x = Math.max(viewport.x, Math.floor(left - SCISSOR_MARGIN_PX));
    const y = Math.max(viewport.y, Math.floor(top - SCISSOR_MARGIN_PX));
    const xEnd = Math.min(viewport.x + viewport.width, Math.ceil(right + SCISSOR_MARGIN_PX));
    const yEnd = Math.min(viewport.y + viewport.height, Math.ceil(bottom + SCISSOR_MARGIN_PX));
    if (xEnd <= x || yEnd <= y) return null;
    return { x, y, width: xEnd - x, height: yEnd - y };
  }

  encodeSliceIn(pass, pipelines, slice, mode, layerOffsets, look) {
    this.writeSlice(slice, layerOffsets, look);
    pass.setBindGroup(0, slice.bindGroup);
    if (this.stencil) this.encodeStencilled(pass, pipelines, slice, mode);
    else this.encodeAddsOnly(pass, pipelines, slice);
    if (mode === "opaque" && slice.walls) this.encodeSlabWalls(pass, pipelines, slice);
  }

  /**
   * The most pixels a wall of `height` metres spans anywhere on the board
   * in the current view: a vertical segment that tall, projected at the
   * board's corners and at its nearest point to the eye.
   */
  wallPixels(height) {
    const matrix = this.viewMatrix;
    const canvas = this.renderer.canvas;
    if (!matrix || !this.extent || !canvas) return Infinity;
    const [lo, hi] = this.extent;
    const points = [];
    for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) points.push([x, y, z]);
    if (this.eye?.[3]) points.push(this.eye.slice(0, 3).map((value, axis) => Math.min(hi[axis], Math.max(lo[axis], value / this.eye[3]))));
    const project = ([x, y, z]) => {
      const clip = [0, 1, 2, 3].map((row) => matrix[row] * x + matrix[4 + row] * y + matrix[8 + row] * z + matrix[12 + row]);
      return clip[3] > 1e-9 ? [clip[0] / clip[3], clip[1] / clip[3]] : null;
    };
    let most = 0;
    for (const point of points) {
      const a = project(point);
      const b = project([point[0], point[1], point[2] + height]);
      if (!a || !b) return Infinity;
      most = Math.max(most, Math.hypot((b[0] - a[0]) * canvas.width / 2, (b[1] - a[1]) * canvas.height / 2));
    }
    return most;
  }

  /**
   * A copper slab's side walls: its regions' edges and its shapes' exact
   * walls. The shapes' walls are left out while no wall of the slab can
   * span a third of a pixel (an overview), where they would only shade
   * edges by a hair; the regions' walls cost next to nothing.
   */
  encodeSlabWalls(pass, pipelines, slice) {
    if (this.stencil) pass.setStencilReference(0);
    if (slice.regionEdges) {
      pass.setPipeline(pipelines.regionWall);
      pass.draw(6, slice.regionEdges, 0, 0);
    }
    if (slice.skirtEdges && this.wallPixels(slice.zTop - slice.zBottom) >= WALL_MIN_PIXELS) {
      pass.setPipeline(pipelines.skirt);
      // Each skirt edge: its skirt quad and its ring (see the shader).
      pass.draw(12, slice.skirtEdges, 0, slice.regionEdges);
    }
  }

  encodeAddsOnly(pass, pipelines, slice) {
    const adds = slice.shapeCount - slice.subtractShapes;
    if (!adds) return;
    pass.setPipeline(pipelines.shapeAdd);
    pass.draw(6, adds, 0, slice.subtractShapes);
  }

  /**
   * One slice through the stencil plan. `mode` "opaque" colours and marks
   * (outer copper sets bit 0, dielectric clears it); "blend" colours blended
   * and leaves bit 0; "mask" lays the mask down uncoloured, then tints it.
   */
  encodeStencilled(pass, pipelines, slice, mode = "opaque") {
    const step = (name, reference = STENCIL_STEPS[name].reference) => {
      pass.setPipeline(pipelines[name]);
      pass.setStencilReference(reference);
    };
    this.encodeFill(pass, slice, step, mode);
    if (mode === "mask") {
      step("tintCovered");
      pass.draw(6);
      step("tintPlain");
      pass.draw(6);
    }
    step("clear");
    pass.draw(6);
  }

  /**
   * A slice's shapes and regions through the stencil plan, by `mode`:
   * "opaque", "blend", "mask" (laid down uncoloured), "footprint" (bit 1,
   * no subtracts), "onFoot" and "offFoot" (blended, on or off bit 1).
   */
  encodeFill(pass, slice, step, mode) {
    const footprint = mode === "footprint";
    if (slice.subtractShapes && !footprint) {
      step("shapeMask");
      pass.draw(6, slice.subtractShapes, 0, 0);
    }
    if (!footprint) this.encodeBatches(pass, slice, true, step, mode);
    const adds = slice.shapeCount - slice.subtractShapes;
    if (adds) {
      // Outer copper marks bit 0, as the mesh copper does for the mask.
      if (mode === "opaque") step("shapeAdd", slice.mark ? 0x21 : 0x20);
      else step({ mask: "shapeLay", blend: "shapeBlend", footprint: "footShape", onFoot: "shapeOnFoot", offFoot: "shapeOffFoot" }[mode]);
      pass.draw(6, adds, 0, slice.subtractShapes);
    }
    this.encodeBatches(pass, slice, false, step, mode);
  }

  /**
   * One side's solder mask, conformal: over its copper at the face the
   * stackup gives it, over bare laminate one copper thickness lower, and
   * coating the copper's walls; then that side's silkscreen on it. Bit 1
   * holds the copper's footprint at the mask's face.
   */
  encodeConformal(pass, mask, { low, foot }, silks, layerOffsets, lookOf) {
    // One rect around everything the side draws, its stencil cleanup with
    // it: the stencil outside it is never touched.
    const parts = [mask, low, foot, ...silks, ...silks.map((silk) => this.twins.get(silk)?.low).filter(Boolean)];
    const rect = unionRect(parts.map((part) => this.sliceRect(part, layerOffsets)));
    if (rect === null) return 0;
    if (rect) pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
    const drawn = this.encodeConformalIn(pass, mask, { low, foot }, silks, layerOffsets, lookOf);
    if (rect) pass.setScissorRect(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height);
    return drawn;
  }

  encodeConformalIn(pass, mask, { low, foot }, silks, layerOffsets, lookOf) {
    const pipelines = this.pipelines.color;
    // The steps' pipelines run the coat plan.
    const plan = (name) => STENCIL_STEPS[name === "step" || name === "regionStep" ? "coat" : name];
    const step = (name, reference = plan(name).reference) => {
      pass.setPipeline(pipelines[name]);
      pass.setStencilReference(reference);
    };
    const use = (slice, look) => {
      this.writeSlice(slice, layerOffsets, look);
      pass.setBindGroup(0, slice.bindGroup);
    };
    const maskLook = lookOf(mask);
    // The footprint (its colour the mask's, for the walls' coat).
    use(foot, maskLook);
    this.encodeFill(pass, foot, step, "footprint");
    // The mask over copper.
    use(mask, maskLook);
    this.encodeFill(pass, mask, step, "mask");
    step("tintHigh");
    pass.draw(6);
    // Its step down from copper to laminate, outside its openings.
    pass.setBindGroup(0, foot.bindGroup);
    if (foot.regionEdges) {
      step("regionStep");
      pass.draw(6, foot.regionEdges, 0, 0);
    }
    if (foot.skirtEdges && this.wallPixels(foot.zTop - foot.zBottom) >= WALL_MIN_PIXELS) {
      step("step");
      pass.draw(12, foot.skirtEdges, 0, foot.regionEdges);
    }
    pass.setBindGroup(0, mask.bindGroup);
    step("clearLay");
    pass.draw(6);
    // The mask over laminate.
    use(low, maskLook);
    this.encodeFill(pass, low, step, "mask");
    step("tintLow");
    pass.draw(6);
    step("clearLay");
    pass.draw(6);
    // Silkscreen on the mask: on the copper, then off it.
    for (const silk of silks) {
      const look = lookOf(silk);
      use(silk, look);
      this.encodeFill(pass, silk, step, "onFoot");
      step("clear");
      pass.draw(6);
      const flat = this.twins.get(silk)?.low;
      if (!flat) continue;
      use(flat, look);
      this.encodeFill(pass, flat, step, "offFoot");
      step("clear");
      pass.draw(6);
    }
    pass.setBindGroup(0, mask.bindGroup);
    step("clearFoot");
    pass.draw(6);
    pass.setStencilReference(1);
    return 1 + silks.length;
  }

  encodeBatches(pass, slice, subtract, step, mode = "opaque") {
    const last = slice.batches.findLast((batch) => !batch.subtract);
    for (const batch of slice.batches) {
      if (batch.subtract !== subtract || !slice.fans) continue;
      step("fan");
      pass.setVertexBuffer(0, slice.fans);
      pass.draw(batch.vertexCount, 1, batch.firstVertex, 0);
      if (!subtract && mode === "opaque" && (slice.mark || slice.role === "dielectric")) {
        // Outer copper marks bit 0 for the mask; a dielectric face nearer than any copper clears it.
        step("coverMark", slice.mark ? 0x41 : 0x40);
        pass.draw(6, batch.coverCount, 0, batch.firstCover);
      }
      const cover = { opaque: "coverAdd", blend: "coverBlend", mask: "coverLay", footprint: "footCover", onFoot: "coverOnFoot", offFoot: "coverOffFoot" }[mode];
      step(subtract ? "coverSubtract" : cover);
      pass.draw(6, batch.coverCount, 0, batch.firstCover);
      // The slice's closing clear clears bit 6 after the last batch (a
      // footprint has none: it clears its own).
      if (!subtract && (batch !== last || mode === "footprint")) {
        step("coverClear");
        pass.draw(6, batch.coverCount, 0, batch.firstCover);
      }
    }
  }

  gpuMemoryBytes() {
    let bytes = this.valuesBuffer === this.emptyValues ? 0 : this.valuesBuffer.size;
    if (this.barrels) bytes += this.barrels.count * BARREL_INSTANCE_BYTES;
    if (this.walls) bytes += this.walls.count * WALL_INSTANCE_BYTES;
    // A slab's faces share their buffers: each counts once.
    const buffers = new Set();
    for (const slice of this.slices.flatMap((slice) => (slice.plain ? [slice, slice.plain] : [slice]))) {
      for (const buffer of [slice.shapes, slice.covers, slice.fans, slice.uniform, slice.edges, slice.cuts]) if (buffer) buffers.add(buffer);
    }
    for (const buffer of buffers) bytes += buffer.size;
    return bytes + this.fieldCache.bytes();
  }

  stats() {
    return {
      slices: this.slices.map((slice) => ({
        key: slice.key,
        role: slice.role || "copper",
        face: slice.face,
        layerId: slice.layerId,
        z: slice.z,
        shapes: slice.shapeCount,
        subtractShapes: slice.subtractShapes,
        regionBatches: slice.batches.length,
        fanVertices: slice.lowered.fanVertices.length / 2,
        covers: slice.lowered.covers.length / COVER_WORDS,
        approximations: slice.lowered.stats,
      })),
      overlay: this.overlay.mode,
      barrels: this.barrels ? { count: this.barrels.count, skipped: this.barrels.skipped } : null,
      walls: this.walls?.count || 0,
      gpuMemoryBytes: this.gpuMemoryBytes(),
      degraded: !this.stencil,
    };
  }

  /**
   * Each dielectric face's plain slab (`plainSlab`): what a separated stack
   * draws in its place. Faces lowered once share theirs, as they share
   * their buffers.
   */
  makePlainSlabs(shared) {
    const plains = new Map();
    for (const slice of this.slices) {
      if (slice.role !== "dielectric" || !slice.lowered) continue;
      if (!plains.has(slice.lowered)) plains.set(slice.lowered, plainSlab(slice.lowered));
      const plain = plains.get(slice.lowered);
      if (plain) slice.plain = this.uploadSlice({ ...slice, lowered: plain, plain: null }, shared);
    }
  }

  /** The slice a face draws: a separated stack's laminate as its plain slab. */
  drawnSlice(slice) {
    return this.separated && slice.plain ? slice.plain : slice;
  }

  releaseSlices() {
    for (const entry of this.twins?.values() || []) for (const twin of Object.values(entry)) twin.uniform.destroy();
    this.twinBuffers?.forEach((buffer) => buffer.destroy());
    this.twinBuffers = [];
    this.twins = new Map();
    const buffers = new Set();
    for (const slice of this.slices.flatMap((slice) => (slice.plain ? [slice, slice.plain] : [slice]))) {
      for (const buffer of [slice.shapes, slice.covers, slice.fans, slice.uniform, slice.edges, slice.cuts]) if (buffer) buffers.add(buffer);
    }
    for (const buffer of buffers) buffer.destroy();
    this.fieldCache?.clear();
    this.slices = [];
  }

  destroy() {
    this.releaseSlices();
    this.barrels?.buffer.destroy();
    this.walls?.buffer.destroy();
    this.arrows?.buffer.destroy();
    this.drawnLayersBuffer.destroy();
    this.palette.destroy();
    this.netsBuffer.destroy();
    this.barrelView.destroy();
    this.layerOffsets.destroy();
    if (this.valuesBuffer !== this.emptyValues) this.valuesBuffer.destroy();
    this.emptyValues.destroy();
    this.emptyField.destroy();
    this.boardClip?.texture.destroy();
    this.emptyClip.destroy();
  }
}

/**
 * A board clip mask grown by one texel in every direction (8-neighbourhood)
 * and padded by one texel each side: texel (i, j) is set when any texel of
 * the original within one step of (i - 1, j - 1) is.
 */
export function dilateClip({ data, width, height }) {
  const w = width + 2;
  const h = height + 2;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!data[y * width + x]) continue;
      // Original (x, y) is padded (x + 1, y + 1): it marks padded x..x+2, y..y+2.
      for (let dy = 0; dy < 3; dy += 1) out.fill(1, (y + dy) * w + x, (y + dy) * w + x + 3);
    }
  }
  return { data: out, width: w, height: h };
}

/**
 * The rect covering `rects` (sliceRect results): undefined when any is the
 * whole viewport, null when all lie off screen.
 */
export function unionRect(rects) {
  let out = null;
  for (const rect of rects) {
    if (rect === undefined) return undefined;
    if (!rect) continue;
    if (!out) {
      out = { ...rect };
      continue;
    }
    const x = Math.min(out.x, rect.x);
    const y = Math.min(out.y, rect.y);
    out = { x, y, width: Math.max(out.x + out.width, rect.x + rect.width) - x, height: Math.max(out.y + out.height, rect.y + rect.height) - y };
  }
  return out;
}

/**
 * The camera of view-projection `matrix` (column-major) in homogeneous world
 * coordinates: the eye point with w = 1 for a perspective view; for an
 * orthographic one, the view direction (into the scene) with w = 0.
 */
export function viewEye(matrix) {
  const inverse = invert4(Array.from(matrix, Number));
  if (!inverse) return [0, 0, -1, 0];
  const apply = (v) => [0, 1, 2, 3].map((row) => inverse[row] * v[0] + inverse[4 + row] * v[1] + inverse[8 + row] * v[2] + inverse[12 + row] * v[3]);
  const eye = apply([0, 0, 1, 0]);
  const length = Math.hypot(eye[0], eye[1], eye[2]);
  if (Math.abs(eye[3]) > 1e-9 * Math.max(length, 1e-30)) return [eye[0] / eye[3], eye[1] / eye[3], eye[2] / eye[3], 1];
  // Orthographic: from the near plane (depth 1, reversed) to the far one (0).
  const near = apply([0, 0, 1, 1]);
  const far = apply([0, 0, 0, 1]);
  const direction = [0, 1, 2].map((axis) => far[axis] / far[3] - near[axis] / near[3]);
  const norm = Math.hypot(...direction) || 1;
  return [...direction.map((value) => value / norm), 0];
}

function invert4(m) {
  const inv = new Array(16);
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
  const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  if (!det) return null;
  return inv.map((value) => value / det);
}
