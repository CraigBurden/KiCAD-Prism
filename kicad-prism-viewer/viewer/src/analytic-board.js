import {
  analyticWasmKey,
  analyticWasmUrl,
  BARREL_WORDS,
  composeFieldRasters,
  DEFAULT_TOLERANCE_NM,
  gridFieldRasters,
  denseOperationValues,
  openAnalyticPack,
  operationCount,
  operationNetIds,
  planBarrels,
  planBoardSlices,
  planWalls,
  valueRange,
} from "./analytic-pack.js";
import { lowerSlicesInWorkers, sliceWeights } from "./analytic-lower-client.js";
import { BOARD_RECORD_KEY, boardRecord, decodeLowered, loweredSliceKey, markLoweringCached, readLowered, writeLowered } from "./analytic-lower-cache.js";
import { rasterizeBoardClip } from "./analytic-clip.js";
import { maskSteps, stepKey } from "./analytic-prepare.js";
import { ANALYTIC_OPERATION_FEATURES } from "./analytic-scene.js";
import { AnalyticRenderer } from "./analytic-renderer.js";

/**
 * Height of the loaded copper geometry above the manifest's centred stackup
 * frame, in world metres, from a resident copper mesh's middle height. A
 * flat mesh has a degenerate z extent, which `quantisationOf` stores as size
 * 1; its plane is then `quantMin`. Zero when no copper is resident.
 */
export function copperZOffset(entries, layers, boardZOffsetMm = 0) {
  const byId = new Map((layers || []).map((layer) => [Number(layer.id), layer]));
  for (const entry of entries || []) {
    const layer = byId.get(Number(entry.layerId));
    if (entry.kind !== "copper" || !layer || !entry.quantMin || !entry.quantSize) continue;
    const flat = entry.quantSize[2] === 1;
    const middle = entry.quantMin[2] + (flat ? 0 : entry.quantSize[2] / 2);
    return middle - Number(layer.z_mm || 0) / 1000;
  }
  // No mesh copper (a bundle built for the analytic board has none): the
  // manifest states the same shift, from the stackup the compiler used.
  return Number(boardZOffsetMm || 0) / 1000;
}

/**
 * The world height of the face a layer's mesh copper shows, before the
 * layer's exploded offset, or null when none of its copper is resident. A
 * flat mesh lies on `quantMin`; an extruded one shows its top face, or its
 * underside on the bottom layer. Analytic copper drawn there replaces the
 * mesh face exactly, so it meets the substrate, mask and barrels as it does.
 */
export function copperPlane(entries, layerId, bottom = false) {
  for (const entry of entries || []) {
    if (entry.kind !== "copper" || Number(entry.layerId) !== Number(layerId)) continue;
    if (!entry.quantMin || !entry.quantSize) continue;
    if (entry.quantSize[2] === 1 || bottom) return entry.quantMin[2];
    return entry.quantMin[2] + entry.quantSize[2];
  }
  return null;
}

/**
 * Open `bytes` (a kicad_monkey materialization pack) and draw the board from
 * it on `renderer`: dielectrics with their walls, copper, barrels and drill
 * walls, solder mask, paste and silkscreen, in place of the mesh layers they
 * replace. `colorFor(layer)` gives each copper layer's linear RGBA.
 */
// The caller attaches the result (`renderer.setAnalytic(state.analytic)`) once it knows the load is
// still current: lowering is asynchronous, and attaching a stale board would destroy the current one.
export async function attachAnalyticPack({
  renderer, layers, colorFor, bytes, wasm, toleranceNm, nets = [], features = [], boardZOffsetMm = 0,
  pack: openPack = null, cache = null, pool = null, netIds: knownNetIds = null,
}) {
  // Milliseconds per phase, reported in the stats: where a large board's load goes.
  const timings = {};
  let mark = performance.now();
  const lap = (name) => {
    const now = performance.now();
    timings[name] = Math.round(now - mark);
    mark = now;
  };
  // The caller may have opened the pack already (`pack`): in the bundle viewer it is
  // the pool's host worker's (`hostedPack`), and this thread never opens it.
  const pack = openPack || await openAnalyticPack(bytes, { wasm });
  // Whatever no worker gave is lowered on this thread, from a pack opened here only then.
  let local = pack.lowerSlice ? pack : null;
  const localPack = async () => (local ??= await openAnalyticPack(bytes, { wasm }));
  lap("open");
  const zOffset = copperZOffset(renderer.entries, layers, boardZOffsetMm);
  const { planned, unmatched } = planBoardSlices(pack.header, layers, zOffset);
  const byId = new Map(layers.map((layer) => [Number(layer.id), layer]));
  const started = performance.now();
  // The WASM lowering runs in a worker so a large board does not freeze the page;
  // whatever the worker cannot give is lowered here, as before.
  const keys = [...new Set(planned.map((slice) => slice.key))];
  const tolerance = toleranceNm ?? DEFAULT_TOLERANCE_NM;
  const lowered = new Map();
  const cacheIdentity = cache ? { cacheKey: cache.cacheKey, wasmKey: analyticWasmKey(), toleranceNm: tolerance } : null;
  if (cacheIdentity) {
    const pending = keys.filter((key) => !lowered.has(key));
    for (const [key, value] of await readLowered(cache.store, cacheIdentity, pending)) lowered.set(key, value);
    timings.cached = keys.filter((key) => lowered.has(key)).length;
  }
  const missing = keys.filter((key) => !lowered.has(key));
  const weights = sliceWeights(pack.header);
  // The workers write what they lower into the cache themselves: this thread adopts it.
  const adopted = new Set();
  const store = cacheIdentity && typeof cache.store.adopt === "function" && cache.store.enabled !== false
    ? {
      identity: cacheIdentity,
      writes: [],
      adopt(key, size) {
        cache.store.adopt(loweredSliceKey(cacheIdentity.cacheKey, cacheIdentity.wasmKey, cacheIdentity.toleranceNm, key), size);
        adopted.add(key);
      },
    }
    : null;
  const fromWorkers = !missing.length ? new Map()
    : pool ? await pool.lower(missing, tolerance, weights, store)
    : await lowerSlicesInWorkers(bytes, missing, tolerance, wasm ?? analyticWasmUrl(), { weights });
  timings.lowerIn = !missing.length ? "none" : fromWorkers ? "workers" : "main";
  // Workers send each slice's cache bytes: views over them draw, and the same bytes are stored.
  const fresh = new Map();
  for (const key of missing) {
    const sent = fromWorkers?.get(key);
    fresh.set(key, sent || (await localPack()).lowerSlice(key, toleranceNm));
    lowered.set(key, sent ? decodeLowered(sent) : fresh.get(key));
  }
  const slices = planned.map((slice) => ({
    ...slice,
    color: slice.role === "copper" ? colorFor(byId.get(slice.layerId)) : slice.color || [1, 1, 1, 1],
    lowered: lowered.get(slice.key),
  }));
  // The conformal masks' steps, planned in the workers and cached with the slices.
  const steps = maskSteps(slices);
  const stepKeys = steps.map(([mask, copper]) => stepKey(mask, copper));
  const storedSteps = cacheIdentity ? await readLowered(cache.store, cacheIdentity, stepKeys) : new Map();
  const unplanned = steps.filter((_, index) => !storedSteps.has(stepKeys[index]));
  const fromPool = unplanned.length && pool
    ? await pool.steps(unplanned.map(([mask, copper]) => [copper.lowered, mask.lowered]), store, unplanned.map(([mask, copper]) => stepKey(mask, copper)))
    : [];
  const freshSteps = new Map();
  unplanned.forEach(([mask, copper], index) => { if (fromPool[index]) freshSteps.set(stepKey(mask, copper), fromPool[index]); });
  steps.forEach(([mask], index) => {
    const sent = freshSteps.get(stepKeys[index]);
    mask.step = storedSteps.get(stepKeys[index]) || (sent && decodeLowered(sent)) || null;
  });
  timings.steps = `${storedSteps.size} cached, ${freshSteps.size} in workers, ${steps.length - storedSteps.size - freshSteps.size} here`;
  // With a store the workers cache what they lowered and planned; this thread, what it lowered itself.
  const fromWorker = (key) => Boolean(fromWorkers?.get(key)) || freshSteps.has(key);
  const toWrite = new Map([...fresh, ...freshSteps].filter(([key]) => !(store && fromWorker(key))));
  const written = cacheIdentity && toWrite.size ? writeLowered(cache.store, cacheIdentity, toWrite) : Promise.resolve();
  const lowerMs = performance.now() - started;
  lap("lower");
  // Compiled off the frame since boot (main.js); a no-op once they are cached.
  await AnalyticRenderer.prewarm(renderer);
  const analytic = new AnalyticRenderer(renderer);
  analytic.setSlices(slices);
  lap("slices");
  // Barrels and drill walls from the pack's holes replace the bundle's mesh barrels.
  // Castellated holes are cut by the board's outline (any dielectric's).
  const outline = slices.find((slice) => slice.role === "dielectric" && slice.lowered?.contourEdges?.length)?.lowered.contourEdges;
  // The board clip, from the same outline (V2a; analytic-clip.js).
  const clipMask = rasterizeBoardClip(outline);
  const barrels = await pack.barrels();
  analytic.setBarrels(planBarrels(pack.header, barrels, slices, outline));
  analytic.setBoardClipMask(clipMask);
  lap("barrels");
  // A hit is a barrel only if the pack has one for that operation; overlays also carry plane values.
  const barrelOperations = new Set();
  for (let index = 0; index < barrels.words.length; index += BARREL_WORDS) barrelOperations.add(barrels.words[index]);
  analytic.edgePlated = Boolean(pack.header.stack?.edge_plating);
  analytic.setWalls(planWalls(slices, lowered, layers, zOffset));
  lap("walls");
  // Net glow and isolation read each operation's viewer net.
  // Per pack, not per slice: a later phase passes the first one's.
  const netIndices = knownNetIds ? null : await pack.netIndices?.();
  const netIds = knownNetIds || operationNetIds(netIndices ? { header: pack.header, netIndices: () => netIndices } : pack, nets);
  analytic.setOperationNets(netIds);
  lap("nets");
  // With the board's record, every slice and step stored: say so, for the next open.
  let cacheWrites = Promise.resolve();
  if (cacheIdentity) {
    const record = netIndices ? writeLowered(cache.store, cacheIdentity, new Map([[BOARD_RECORD_KEY, boardRecord(pack.header, barrels, netIndices)]])) : Promise.resolve();
    // Complete only once every slice and step the workers made is adopted.
    const workerKeys = store ? [...fresh.keys(), ...freshSteps.keys()].filter(fromWorker) : [];
    cacheWrites = Promise.all([written, record, ...(store?.writes || [])]).then(() => {
      if (workerKeys.every((key) => adopted.has(key))) return markLoweringCached(cache.store, cacheIdentity);
      return undefined;
    });
  }
  const featuresBySource = new Map();
  for (const feature of features || []) {
    if (!feature?.sourceUid) continue;
    if (!featuresBySource.has(feature.sourceUid)) featuresBySource.set(feature.sourceUid, []);
    featuresBySource.get(feature.sourceUid).push(feature);
  }
  lap("features");
  if (local && local !== pack) local.free();
  // `cacheWrites` settles once the cache holds this board (the workers' writes included).
  return { cacheWrites, pack, analytic, unmatched, lowerMs, timings, zOffset, operations: operationCount(pack.header), overlay: null, netIds, featuresBySource, barrelOperations, lowered };
}

/**
 * The viewer feature an operation came from (by its binding's source uid,
 * preferring one on the operation's net), or 0: what a click on it selects.
 */
export async function analyticFeatureId(state, operationIndex) {
  const source = (await state.pack.binding(operationIndex))?.source_uid;
  const candidates = source ? state.featuresBySource?.get(source) || [] : [];
  const net = state.netIds?.[operationIndex] || 0;
  const feature = candidates.find((item) => Number(item.netId) === net) || candidates[0];
  return feature ? Number(feature.id) : 0;
}

/**
 * What a click on pack operation `operationIndex` selects, as a scene
 * feature id, from the operation's binding (V2a): a footprint's own graphics
 * select its component (its feature in `scene.componentFeatures`); a pad
 * selects its terminal (reference, pad and net); any other copper (a track,
 * a via, a zone) its net. The terminal or net feature is made here, once, as
 * `ANALYTIC_OPERATION_FEATURES` plus the index. 0 when the operation names
 * nothing a selection can hold.
 */
export async function analyticOperationFeature(state, operationIndex, scene) {
  const id = ANALYTIC_OPERATION_FEATURES + operationIndex;
  if (scene.features.has(id)) return id;
  const binding = await state.pack.binding(operationIndex);
  if (!binding) return 0;
  const reference = String(binding.refdes || "");
  const pad = String(binding.pad_number || "");
  if (reference && !pad) return Number(scene.componentFeatures.get(reference)?.featureId || 0);
  const netId = Number(state.netIds?.[operationIndex] || 0);
  if (!pad && !netId) return 0;
  scene.features.set(id, {
    id,
    kind: String(binding.source_kind || "copper"),
    ...(reference ? { designator: reference } : {}),
    ...(pad ? { padNumber: pad } : {}),
    netId,
    sourceUid: String(binding.source_uid || ""),
    bounds: null,
  });
  return id;
}

/**
 * Apply a synthetic or engine result to an attached pack:
 *   { kind: "operation_values", quantity, units, values, range? }
 *     `values` per operation index (array) or { index: value };
 *   { kind: "field_tiles", quantity, units, tiles, range? }
 *     tiles on the materialization's tile grid (see composeFieldRasters);
 *   { kind: "field_grid", quantity, units, grid, range? }
 *     a prism.sim.field grid document with float32 `values` per slice
 *     (see gridFieldRasters), and optional per-operation `values` that
 *     colour what a slice raster cannot (the via barrels);
 *   null clears it.
 */
export function applyAnalyticOverlay(state, overlay) {
  if (!overlay) {
    state.analytic.clearOverlay();
    state.overlay = null;
    return null;
  }
  if (overlay.kind === "operation_values") {
    const values = denseOperationValues(overlay.values, state.operations);
    const range = overlay.range || valueRange(values);
    state.analytic.setOperationValues(values, range);
    state.overlay = { ...overlay, values, range };
  } else if (overlay.kind === "field_tiles") {
    const rasters = composeFieldRasters(overlay.tiles);
    const range = overlay.range || valueRange([...rasters.values()].flatMap((raster) => [...valueRange(raster.values)]));
    state.analytic.setFieldRasters(rasters, range);
    state.overlay = { ...overlay, range, slices: [...rasters.keys()] };
  } else if (overlay.kind === "field_grid") {
    const rasters = gridFieldRasters(overlay.grid);
    const range = overlay.range || valueRange([...rasters.values()].flatMap((raster) => [...valueRange(raster.values)]));
    const values = overlay.values ? denseOperationValues(overlay.values, state.operations) : null;
    state.analytic.setFieldRasters(rasters, range, values);
    state.overlay = { kind: overlay.kind, quantity: overlay.quantity, units: overlay.units, range, slices: [...rasters.keys()], barrels: values, net: overlay.grid?.net ?? null };
  } else {
    throw new TypeError(`unknown analytic overlay kind ${overlay.kind}`);
  }
  return { kind: overlay.kind, range: state.overlay.range };
}

/**
 * A field raster's value at a board point in millimetres, as the fragment
 * shader samples it: bilinear inside the raster, nearest where a neighbour
 * holds no value (NaN there when `strict`). NaN off the raster.
 */
export function sampleFieldRaster(field, boardMm, strict = false) {
  const [pitchX, pitchY] = Array.isArray(field.pitchMm) ? field.pitchMm : [field.pitchMm, field.pitchMm];
  const u = (boardMm[0] - field.originMm[0]) / pitchX - 0.5;
  const v = (boardMm[1] - field.originMm[1]) / pitchY - 0.5;
  const at = (i, j) => (i < 0 || j < 0 || i >= field.width || j >= field.height ? NaN : field.values[j * field.width + i]);
  const [i, j] = [Math.floor(u), Math.floor(v)];
  const [fx, fy] = [u - i, v - j];
  const s00 = at(i, j), s10 = at(i + 1, j), s01 = at(i, j + 1), s11 = at(i + 1, j + 1);
  if ([s00, s10, s01, s11].every(Number.isFinite)) {
    return (s00 * (1 - fx) + s10 * fx) * (1 - fy) + (s01 * (1 - fx) + s11 * fx) * fy;
  }
  return strict ? NaN : at(Math.floor(u + 0.5), Math.floor(v + 0.5));
}

/** The value of the texel nearest a board point (mm) within `reach` texels, or NaN. */
export function nearestFieldValue(field, boardMm, reach) {
  const [pitchX, pitchY] = Array.isArray(field.pitchMm) ? field.pitchMm : [field.pitchMm, field.pitchMm];
  const u = (boardMm[0] - field.originMm[0]) / pitchX - 0.5;
  const v = (boardMm[1] - field.originMm[1]) / pitchY - 0.5;
  let best = NaN;
  let bestDistance = Infinity;
  for (let j = Math.floor(v) - reach + 1; j <= Math.floor(v) + reach; j += 1) {
    for (let i = Math.floor(u) - reach + 1; i <= Math.floor(u) + reach; i += 1) {
      if (i < 0 || j < 0 || i >= field.width || j >= field.height) continue;
      const value = field.values[j * field.width + i];
      const distance = (i - u) ** 2 + (j - v) ** 2;
      if (Number.isFinite(value) && distance < bestDistance) [best, bestDistance] = [value, distance];
    }
  }
  return best;
}

/**
 * The copper slices a field relief can raise: those with a raster, one per
 * layer (its top face), with how many raster cells hold a value.
 */
export function reliefSlices(state) {
  const byLayer = new Map();
  for (const slice of state.analytic.slices) {
    if (!slice.field || !(slice.role === undefined || slice.role === "copper")) continue;
    const held = byLayer.get(slice.layerId);
    if (!held || slice.z > held.z) byLayer.set(slice.layerId, slice);
  }
  return [...byLayer.values()].map((slice) => ({
    slice,
    key: slice.key,
    layerId: slice.layerId,
    cells: slice.field.values.reduce((count, value) => count + (Number.isFinite(value) ? 1 : 0), 0),
  }));
}

/** A viewer net id by name or alias, as `operationNetIds` matches them; 0 when unknown. */
export function netIdByName(nets, name) {
  if (!name) return 0;
  const net = (nets || []).find((item) => item?.name === name) || (nets || []).find((item) => (item?.aliases || []).includes(name));
  return net ? Number(net.id) || 0 : 0;
}

/** Bytes per arrow (see ANALYTIC_ARROW_SHADER). */
const ARROW_BYTES = 48;
/** Arrows across the board's longer side. */
export const ARROWS_ACROSS = 70;
/** Arrows lie this far off their copper face (m), toward the eye side. */
const ARROW_LIFT_M = 2e-6;

/** Arrows are sized and coloured against this quantile of the field's size. */
export const ARROW_REFERENCE_QUANTILE = 0.95;

/**
 * Arrows for a vector field on the copper faces: `rastersX` and `rastersY`
 * map slice keys to rasters (as `gridFieldRasters` gives) of the field's
 * board-frame components. On a lattice `spacingMm` apart (the board's longer
 * side over ARROWS_ACROSS by default), each copper face gets an arrow where
 * the field has a value, pointing along it. Its size is read against
 * `reference`, the ARROW_REFERENCE_QUANTILE of the sampled sizes, so a few
 * hot spots at pad edges do not shrink every other arrow: the length grows
 * with the square root of size / reference from ARROW_MIN_LENGTH to full at
 * the reference (`minLength` its share at zero, `width` the half width's
 * share of the spacing, `density` arrows across the board's longer side),
 * and the colour (the instance's `dir.w`, clamped to 1) is
 * size / reference. Sizes below `floor` of the reference (copper carrying no
 * current) get none. World frame: metres, board Y flipped.
 */
export function planArrows(slices, rastersX, rastersY, { spacingMm = null, floor = 1e-3, density = ARROWS_ACROSS, width = 0.07, minLength = 0.3 } = {}) {
  const faces = slices.filter((slice) => slice.role === "copper" && rastersX.has(slice.key) && rastersY.has(slice.key)
    && slice.face === (slice.bottom ? "bottom" : "top"));
  if (!faces.length) return { data: new ArrayBuffer(0), count: 0, spacingMm: 0, max: 0, reference: 0 };
  const bounds = faces.reduce((b, f) => [Math.min(b[0], f.bounds[0]), Math.min(b[1], f.bounds[1]), Math.max(b[2], f.bounds[2]), Math.max(b[3], f.bounds[3])],
    [Infinity, Infinity, -Infinity, -Infinity]);
  const spacing = spacingMm || Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]) / density;
  const samples = [];
  for (const face of faces) {
    const [fx, fy] = [rastersX.get(face.key), rastersY.get(face.key)];
    const [x0, y0, x1, y1] = face.bounds;
    // On the board's lattice, so arrows of different layers line up.
    for (let x = bounds[0] + Math.ceil((x0 - bounds[0]) / spacing) * spacing + spacing / 2; x <= x1; x += spacing) {
      for (let y = bounds[1] + Math.ceil((y0 - bounds[1]) / spacing) * spacing + spacing / 2; y <= y1; y += spacing) {
        // Only where copper surrounds the point: never off an edge.
        const jx = sampleFieldRaster(fx, [x, y], true);
        const jy = sampleFieldRaster(fy, [x, y], true);
        const size = Math.hypot(jx, jy);
        if (size > 0) samples.push({ face, x, y, jx, jy, size });
      }
    }
  }
  const sizes = samples.map((s) => s.size).sort((a, b) => a - b);
  const max = sizes.length ? sizes[sizes.length - 1] : 0;
  const reference = sizes.length ? sizes[Math.min(sizes.length - 1, Math.floor(ARROW_REFERENCE_QUANTILE * sizes.length))] : 0;
  const kept = samples.filter((s) => s.size >= floor * reference);
  const data = new ArrayBuffer(kept.length * ARROW_BYTES);
  const floats = new Float32Array(data);
  const words = new Uint32Array(data);
  kept.forEach((s, i) => {
    const at = i * (ARROW_BYTES / 4);
    const [a, b] = s.face.offsetLayers || [s.face.layerId, s.face.layerId];
    const lift = s.face.bottom ? -ARROW_LIFT_M : ARROW_LIFT_M;
    const share = Math.min(1, s.size / reference);
    const length = 0.9 * spacing * (minLength + (1 - minLength) * Math.sqrt(share)) / 1000;
    // Board Y runs down; the world's runs up.
    floats.set([s.x / 1000, -s.y / 1000, s.face.z + lift, width * spacing / 1000, s.jx / s.size, -s.jy / s.size, length, share], at);
    words.set([a, b, 0, 0], at + 8);
  });
  return { data, count: kept.length, spacingMm: spacing, max, reference };
}

/**
 * Show a vector result as arrows on the copper: `{ quantity, units, x, y }`
 * with `x` and `y` `prism.sim.field` grid documents of its components (see
 * `gridFieldRasters`); null clears them.
 */
export function applyAnalyticVectors(state, vectors) {
  if (!vectors) {
    state.analytic.setArrows(null);
    state.vectors = null;
    state.vectorInput = null;
    return null;
  }
  const style = state.analytic.style;
  const arrows = planArrows(state.analytic.slices, gridFieldRasters(vectors.x), gridFieldRasters(vectors.y),
    { density: style.arrowDensity, width: style.arrowWidth, minLength: style.arrowMinLength });
  state.analytic.setArrows(arrows);
  state.vectorInput = vectors;
  state.vectors = { quantity: vectors.quantity, units: vectors.units, max: arrows.max, reference: arrows.reference, spacingMm: arrows.spacingMm };
  return { count: arrows.count, max: arrows.max, reference: arrows.reference, spacingMm: arrows.spacingMm };
}

/**
 * Change how result overlays look (see DEFAULT_ANALYTIC_STYLE): colour ramps
 * apply at once; arrows are re-laid when their density, width or shortest
 * length changes. Returns the style in force.
 */
export function applyAnalyticStyle(state, style) {
  const before = state.analytic.style;
  const after = state.analytic.setStyle(style);
  const relaid = ["arrowDensity", "arrowWidth", "arrowMinLength"].some((key) => before[key] !== after[key]);
  if (relaid && state.vectorInput) applyAnalyticVectors(state, state.vectorInput);
  return after;
}

/** The stack slice an operation was materialized on (its chunk's), or null. */
export function operationSliceKey(header, operationIndex) {
  for (const chunk of header?.chunks || []) {
    const first = Number(chunk.first_operation_index);
    if (operationIndex >= first && operationIndex < first + Number(chunk.operation_count || 0)) return chunk.slice_key;
  }
  return null;
}

/**
 * Where a world ray meets a copper slice that carries a field raster with a
 * value there: `{ value, sliceKey, boardMm, world }`, or null. World units
 * are metres with board Y flipped, as the analytic shaders place copper.
 * Given `sliceKey` (the slice the GPU pick hit), only that slice is read, at
 * its face nearest the eye; otherwise the first slice along the ray. Given
 * `layers` (a set of layer ids), slices on other layers are skipped. With
 * `reach` (texels), a slice with no value at the point takes its nearest
 * value within that many texels: copper smaller than a texel (a BGA pad)
 * still stops the ray.
 */
export function fieldAlongRay(state, ray, layerOffsets, sliceKey = null, layers = null, reach = 0) {
  let best = null;
  for (const slice of state.analytic.slices) {
    if (!slice.field || Math.abs(ray.direction[2]) < 1e-12) continue;
    if (sliceKey && slice.key !== sliceKey) continue;
    if (layers && !layers.has(Number(slice.layerId))) continue;
    const [a, b] = slice.offsetLayers || [slice.layerId, slice.layerId];
    const z = slice.z + 0.5 * ((layerOffsets?.[a] || 0) + (layerOffsets?.[b] || 0));
    const t = (z - ray.origin[2]) / ray.direction[2];
    if ((!sliceKey && !(t > 0)) || (best && t >= best.t)) continue;
    const world = [ray.origin[0] + t * ray.direction[0], ray.origin[1] + t * ray.direction[1], z];
    const boardMm = [world[0] * 1000, -world[1] * 1000];
    let value = sampleFieldRaster(slice.field, boardMm);
    if (!Number.isFinite(value) && reach > 0) value = nearestFieldValue(slice.field, boardMm, reach);
    if (Number.isFinite(value)) best = { t, value, sliceKey: slice.key, boardMm, world };
  }
  return best && { value: best.value, sliceKey: best.sliceKey, boardMm: best.boardMm, world: best.world };
}

/**
 * What lies under an analytic pick: the operation, its binding, and its
 * value: the operation's own for per-operation overlays, or the field at
 * `field` (from `fieldAlongRay`) for raster overlays.
 */
export async function describeAnalyticHit(state, operationIndex, field = null) {
  const overlay = state.overlay;
  // A via barrel has its own value; the copper reads the raster.
  const own = overlay?.kind === "operation_values" ? overlay.values[operationIndex] : overlay?.barrels?.[operationIndex];
  const barrel = !(overlay?.kind === "operation_values") && Number.isFinite(own)
    && (!state.barrelOperations || state.barrelOperations.has(operationIndex));
  const value = overlay?.kind === "operation_values" || barrel ? own : field?.value;
  if (barrel) field = { ...field, sliceKey: "via barrel" };
  return {
    operationIndex,
    featureId: (await analyticFeatureId(state, operationIndex)) || null,
    binding: await state.pack.binding(operationIndex),
    ...(Number.isFinite(value) ? { value, quantity: overlay.quantity, units: overlay.units } : {}),
    ...(field ? { sliceKey: field.sliceKey, boardMm: field.boardMm, world: field.world } : {}),
  };
}
