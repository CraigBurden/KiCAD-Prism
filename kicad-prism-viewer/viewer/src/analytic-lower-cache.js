// Lowered analytic slices kept between loads (ADR amendment V2 §7: a board
// opened again shows in ≤ 0.5 s). A lowered slice is a pure function of the
// pack, the WASM that lowered it and the tolerance, and a pack never changes
// for a bundle key, so `cacheKey` (the bundle key) names it for good. Slices
// live in the viewer's OPFS asset cache (asset-cache.js), which prunes by age
// and size; without OPFS every call misses and lowering runs as before.

const MAGIC = 0x4c534c50; // "PLSL", little endian
const KINDS = { Uint32Array, Float32Array };

/** The cache entry, among the slices, of what the main thread reads from the pack (see `boardRecord`). */
export const BOARD_RECORD_KEY = ".board";

/**
 * What the main thread reads from a pack, as one cache entry: the header,
 * the barrels and every operation's net index. A board opened again reads it
 * here instead of waiting for a worker to open the pack.
 */
export function boardRecord(header, barrels, netIndices) {
  return { header, barrelFloats: barrels.floats, barrelWords: barrels.words, barrelSkipped: barrels.skipped, netIndices };
}

/** The cache entry name of one slice. */
export function loweredSliceKey(cacheKey, wasmKey, toleranceNm, sliceKey) {
  return `analytic-lowered-a1/${cacheKey}/${wasmKey}/${toleranceNm}/${sliceKey}`;
}

/** A lowered slice as one byte string: a JSON header, then each typed array 4-byte aligned. */
export function encodeLowered(lowered) {
  const fields = [];
  const arrays = [];
  for (const [name, value] of Object.entries(lowered)) {
    if (!ArrayBuffer.isView(value)) continue;
    const kind = value.constructor.name;
    if (!KINDS[kind]) throw new TypeError(`cannot cache a ${kind} (${name})`);
    fields.push({ name, kind, length: value.length });
    arrays.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  const rest = Object.fromEntries(Object.entries(lowered).filter(([, value]) => !ArrayBuffer.isView(value)));
  const head = new TextEncoder().encode(JSON.stringify({ fields, rest }));
  const headPadded = Math.ceil(head.length / 4) * 4;
  const total = 8 + headPadded + arrays.reduce((sum, bytes) => sum + Math.ceil(bytes.length / 4) * 4, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, head.length, true);
  out.set(head, 8);
  let at = 8 + headPadded;
  for (const bytes of arrays) {
    out.set(bytes, at);
    at += Math.ceil(bytes.length / 4) * 4;
  }
  return out;
}

/**
 * The inverse of `encodeLowered`; null for bytes it did not write. The arrays
 * are views over `bytes` (each 4-byte aligned): nothing is copied, and the
 * same bytes can go to the cache as they are.
 */
export function decodeLowered(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data.length < 8) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== MAGIC) return null;
  const headLength = view.getUint32(4, true);
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(data.subarray(8, 8 + headLength)));
  } catch {
    return null;
  }
  const lowered = { ...header.rest };
  let at = 8 + Math.ceil(headLength / 4) * 4;
  for (const { name, kind, length } of header.fields) {
    const Kind = KINDS[kind];
    if (!Kind) return null;
    const byteLength = length * Kind.BYTES_PER_ELEMENT;
    if (at + byteLength > data.length) return null;
    if ((data.byteOffset + at) % Kind.BYTES_PER_ELEMENT) return null;
    lowered[name] = new Kind(data.buffer, data.byteOffset + at, length);
    at += Math.ceil(byteLength / 4) * 4;
  }
  return lowered;
}

/**
 * Read every cached slice of `keys`: a Map of key to lowered slice, holding
 * only the hits. `cache` is an AssetCache (or anything with `read(key)`); a
 * missing cache or key gives no hit.
 */
export async function readLowered(cache, { cacheKey, wasmKey, toleranceNm }, keys) {
  const hits = new Map();
  if (!cache?.read || !cacheKey) return hits;
  await Promise.all(keys.map(async (key) => {
    try {
      const bytes = await cache.read(loweredSliceKey(cacheKey, wasmKey, toleranceNm, key));
      const lowered = bytes ? decodeLowered(bytes) : null;
      if (lowered) hits.set(key, lowered);
    } catch {
      // A broken entry is a miss.
    }
  }));
  return hits;
}

/**
 * Store lowered slices in the background, each a slice or its bytes as
 * `encodeLowered` (in a worker) already wrote them; failures are ignored.
 */
export function writeLowered(cache, { cacheKey, wasmKey, toleranceNm }, lowered) {
  if (!cache?.write || !cacheKey) return Promise.resolve();
  return Promise.all([...lowered].map(([key, value]) =>
    cache.write(loweredSliceKey(cacheKey, wasmKey, toleranceNm, key), value instanceof Uint8Array ? value : encodeLowered(value)).catch(() => undefined),
  )).then(() => undefined);
}

/** The cache entry that says every slice of a bundle is stored (written after a full load). */
export function completeKey(cacheKey, wasmKey, toleranceNm) {
  return `analytic-lowered-a1/${cacheKey}/${wasmKey}/${toleranceNm}/.complete`;
}

/** Whether a full load of this bundle stored every slice, so no lowering worker is needed. */
export async function isLoweringCached(cache, { cacheKey, wasmKey, toleranceNm }) {
  if (!cache?.read || !cacheKey) return false;
  try {
    return Boolean(await cache.read(completeKey(cacheKey, wasmKey, toleranceNm)));
  } catch {
    return false;
  }
}

/** Record that every slice of a bundle is stored, once their writes are done. */
export async function markLoweringCached(cache, { cacheKey, wasmKey, toleranceNm }, writes = Promise.resolve()) {
  if (!cache?.write || !cacheKey) return;
  await writes;
  await cache.write(completeKey(cacheKey, wasmKey, toleranceNm), new Uint8Array([1])).catch(() => undefined);
}
