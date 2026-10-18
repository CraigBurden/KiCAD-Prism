// Runs analytic-lower-worker.js for one load: a pool of workers, each lowering
// a share of the slices (ADR amendment V2 §7: a large board's lowering is
// seconds of WASM on one thread). The worker bundle is served beside the
// element bundle with the element's own cache key; where no worker can start
// (Node tests, the standalone IIFE build, a missing file), callers lower on
// the main thread instead.

/** File name the served worker bundle has next to the element bundle. */
export const ANALYTIC_LOWER_WORKER_NAME = "prism-semantic-viewer-lower.js";
/** At most this many lowering workers; each holds its own copy of the pack. */
export const MAX_LOWER_WORKERS = 6;

function workerUrl() {
  if (typeof Worker === "undefined") return null;
  try {
    const element = new URL(import.meta.url);
    const key = element.searchParams.get("v");
    return new URL(`${ANALYTIC_LOWER_WORKER_NAME}${key ? `?v=${key}` : ""}`, element);
  } catch {
    return null;
  }
}

/** How many workers to start for `count` slices on this machine. */
export function workerCount(count, cores = globalThis.navigator?.hardwareConcurrency || 4) {
  return Math.max(1, Math.min(MAX_LOWER_WORKERS, Math.max(1, cores - 1), count));
}

/**
 * Split `keys` into `n` groups of about equal work, heaviest first
 * (longest-processing-time): `weights` maps a slice key to its operation
 * count. Keys with no weight count as one. Groups keep `keys`' order inside.
 */
export function shareSlices(keys, weights, n) {
  const groups = Array.from({ length: Math.max(1, n) }, () => ({ keys: [], load: 0 }));
  const position = new Map(keys.map((key, index) => [key, index]));
  const heavy = [...keys].sort((a, b) => (weights.get(b) || 1) - (weights.get(a) || 1) || position.get(a) - position.get(b));
  for (const key of heavy) {
    const lightest = groups.reduce((best, group) => (group.load < best.load ? group : best), groups[0]);
    lightest.keys.push(key);
    lightest.load += weights.get(key) || 1;
  }
  return groups.filter((group) => group.keys.length)
    .map((group) => group.keys.sort((a, b) => position.get(a) - position.get(b)));
}

/** Operations per slice key, from a pack header's chunk directory. */
export function sliceWeights(header) {
  const weights = new Map();
  for (const chunk of header?.chunks || []) {
    weights.set(chunk.slice_key, (weights.get(chunk.slice_key) || 0) + Number(chunk.operation_count || 0));
  }
  return weights;
}

/**
 * A pool of lowering workers over one pack, started as soon as the pack's
 * bytes arrive so the workers open it while the main thread does. It serves
 * every phase of a load (V2 §7: outer layers first, then the rest) without
 * opening the pack again. `start` returns null where no worker can start.
 */
export class LowerPool {
  static start(bytes, wasmUrl, count = workerCount(MAX_LOWER_WORKERS)) {
    const url = workerUrl();
    if (!url || typeof wasmUrl !== "string") return null;
    const members = [];
    for (let index = 0; index < count; index += 1) {
      let worker;
      try {
        worker = new Worker(url, { type: "module", name: `analytic-lower-${index}` });
      } catch {
        break;
      }
      const member = { worker, pending: new Map(), alive: true };
      worker.onmessage = ({ data }) => {
        const settle = member.pending.get(data.id);
        member.pending.delete(data.id);
        settle?.(data);
      };
      worker.onerror = (event) => {
        event.preventDefault?.();
        member.alive = false;
        for (const settle of member.pending.values()) settle({ error: "worker failed" });
        member.pending.clear();
      };
      member.opened = new Promise((resolve) => member.pending.set(0, (data) => resolve(!data.error)));
      const copy = (bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).slice();
      worker.postMessage({ type: "open", bytes: copy.buffer, wasmUrl }, [copy.buffer]);
      members.push(member);
    }
    return members.length ? new LowerPool(members) : null;
  }

  constructor(members) {
    this.members = members;
    this.nextId = 1;
  }

  /** Lower `keys` across the workers that opened the pack: a Map of what they gave, or null when none could. */
  async lower(keys, toleranceNm, weights = new Map()) {
    if (!keys.length) return new Map();
    const opened = await Promise.all(this.members.map((member) => member.opened));
    const live = this.members.filter((member, index) => opened[index] && member.alive);
    if (!live.length) return null;
    const groups = shareSlices(keys, weights, live.length);
    const results = await Promise.all(groups.map((group, index) => new Promise((resolve) => {
      const member = live[index];
      const id = this.nextId++;
      member.pending.set(id, (data) => resolve(data.error ? null : new Map(Object.entries(data.lowered))));
      member.worker.postMessage({ type: "lower", id, keys: group, toleranceNm });
    })));
    if (results.every((result) => result === null)) return null;
    const lowered = new Map();
    for (const result of results) for (const [key, value] of result || []) lowered.set(key, value);
    return lowered;
  }

  close() {
    for (const member of this.members) member.worker.terminate();
    this.members = [];
  }
}

/**
 * Lower `keys` of the pack `bytes` in a pool of workers for this call only,
 * `weights` (slice key to operation count) balancing them. Resolves to a Map
 * of key to lowered slice with whatever the workers gave, or null when no
 * worker could start (the caller then lowers on the main thread).
 */
export async function lowerSlicesInWorkers(bytes, keys, toleranceNm, wasmUrl, { weights = new Map(), workers } = {}) {
  if (!keys.length) return new Map();
  const pool = LowerPool.start(bytes, wasmUrl, workers ?? workerCount(keys.length));
  if (!pool) return null;
  try {
    return await pool.lower(keys, toleranceNm, weights);
  } finally {
    pool.close();
  }
}
