import { operationCount } from "./analytic-pack.js";

// Runs analytic-lower-worker.js for one load: a pool of workers, each lowering
// a share of the slices (ADR amendment V2 §7: a large board's lowering is
// seconds of WASM on one thread). The worker bundle is served beside the
// element bundle with the element's own cache key; where no worker can start
// (Node tests, the standalone IIFE build, a missing file), callers lower on
// the main thread instead.

/** File name the served worker bundle has next to the element bundle. */
export const ANALYTIC_LOWER_WORKER_NAME = "prism-semantic-viewer-lower.js";
/** At most this many lowering workers; each holds its own copy of the pack. */
// Three is fastest on EDA-04903 (an M2 Pro, 6 performance cores): each worker
// opens its own copy of the pack (about 0.16 s), and more workers than three
// spend longer opening than they save lowering (0.5 s of WASM in all).
export const MAX_LOWER_WORKERS = 3;

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

const compiled = new Map();

/**
 * The analytic WASM compiled once per page (off the main thread, as it
 * streams in) and shared with every worker of every board, or null where it
 * cannot be: each worker then compiles it from the URL itself.
 */
export function compiledWasm(wasmUrl) {
  if (!compiled.has(wasmUrl)) {
    const compile = typeof WebAssembly?.compileStreaming === "function" && typeof fetch === "function"
      ? WebAssembly.compileStreaming(fetch(wasmUrl)).catch(() => null)
      : Promise.resolve(null);
    compiled.set(wasmUrl, compile);
  }
  return compiled.get(wasmUrl);
}

/**
 * A pool of lowering workers over one pack, started as soon as the pack's
 * bytes arrive. One of them stays as the board's pack host (`release`).
 * `start` returns null where no worker can start.
 */
export class LowerPool {
  static start(bytes, wasmUrl, count = workerCount(MAX_LOWER_WORKERS)) {
    const url = workerUrl();
    if (!url || typeof wasmUrl !== "string") return null;
    const members = [];
    const module = compiledWasm(wasmUrl);
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
        stop(member, "worker failed");
      };
      // Resolves to the pack's header, or null when the worker could not open it.
      member.opened = new Promise((resolve) => member.pending.set(0, (data) => resolve(data.error ? null : data.header)));
      const copy = (bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).slice();
      void module.then((wasmModule) => worker.postMessage({ type: "open", bytes: copy.buffer, wasmUrl, wasmModule }, [copy.buffer]));
      members.push(member);
    }
    return members.length ? new LowerPool(members) : null;
  }

  constructor(members) {
    this.members = members;
    this.nextId = 1;
  }

  /** The pack's header, from the first worker that opened it; null when none could. */
  async header() {
    for (const member of this.members) {
      const header = await member.opened;
      if (header && member.alive) return header;
    }
    return null;
  }

  /** The worker that answers questions about the pack: the first that opened it. */
  async host() {
    for (const member of this.members) if ((await member.opened) && member.alive) return member;
    return null;
  }

  /** Ask `member` (by default the host) one message; resolves to its answer, or rejects with its error. */
  async ask(type, payload = {}, transfer = [], member = null) {
    const target = member || await this.host();
    if (!target) throw new Error("no lowering worker has the pack open");
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      target.pending.set(id, (data) => (data.error ? reject(new Error(data.error)) : resolve(data)));
      target.worker.postMessage({ type, id, ...payload }, transfer);
    });
  }

  /**
   * Plan mask steps (see `planOpenings`) across the workers: `pairs` of
   * `[copper, mask]` lowered slices, copied to the workers. Resolves to the
   * steps' bytes in order (as `lower` gives slices), or null for any a worker
   * could not plan. With `store` and `keys` (each step's cache key), the
   * workers cache them as `lower` does.
   */
  async steps(pairs, store = null, keys = []) {
    const live = [];
    for (const member of this.members) if ((await member.opened) && member.alive) live.push(member);
    // Copies of just the arrays planning reads: a view would clone its whole buffer.
    const fields = (lowered, names) => Object.fromEntries(names.map((name) => [name, ArrayBuffer.isView(lowered[name]) ? lowered[name].slice() : lowered[name]]));
    const copperFields = ["shapes", "subtractShapes", "contourEdges", "contourEdgeOperations", "outlineEdges", "outlineShapes"];
    return Promise.all(pairs.map(([copper, mask], index) => {
      if (!live.length) return null;
      const payload = { key: keys[index], store: store?.identity ?? null, copper: fields(copper, copperFields), mask: fields(mask, ["shapes", "subtractShapes"]) };
      const member = live[index % live.length];
      if (store) store.writes.push(this.stored(member, this.nextId, store));
      return this.ask("step", payload, [], member).then((data) => data.step, () => null);
    }));
  }

  /**
   * The keys `member` stored in the cache for its answer `id` (its second
   * answer, `-id`), adopted through `store`, with their sizes as stored.
   */
  stored(member, id, store) {
    return new Promise((resolve) => member.pending.set(-id, (data) => {
      for (const [key, bytes] of data.stored || []) store.adopt(key, bytes);
      resolve();
    }));
  }

  /** Stop every worker but the host, which keeps the pack open for later questions. */
  async release() {
    const host = await this.host();
    for (const member of this.members) if (member !== host) stop(member, "worker released");
    this.members = host ? [host] : [];
  }

  /**
   * Lower `keys` across the workers that opened the pack: a Map of each slice's
   * bytes (`encodeLowered`'s; `decodeLowered` reads them), or null when none could.
   * Given `store` (`{ identity, adopt(key, bytes), writes }`), the workers then
   * write each slice into the asset cache themselves; `adopt` hears of each
   * they wrote, and `writes` gets a promise per worker that settles when its
   * writes are done.
   */
  async lower(keys, toleranceNm, weights = new Map(), store = null) {
    if (!keys.length) return new Map();
    const opened = await Promise.all(this.members.map((member) => member.opened));
    const live = this.members.filter((member, index) => opened[index] && member.alive);
    if (!live.length) return null;
    const groups = shareSlices(keys, weights, live.length);
    const results = await Promise.all(groups.map((group, index) => new Promise((resolve) => {
      const member = live[index];
      const id = this.nextId++;
      if (store) store.writes.push(this.stored(member, id, store));
      member.pending.set(id, (data) => resolve(data.error ? null : new Map(Object.entries(data.lowered))));
      member.worker.postMessage({ type: "lower", id, keys: group, toleranceNm, store: store?.identity ?? null });
    })));
    if (results.every((result) => result === null)) return null;
    const lowered = new Map();
    for (const result of results) for (const [key, value] of result || []) lowered.set(key, value);
    return lowered;
  }

  close() {
    for (const member of this.members) stop(member, "worker closed");
    this.members = [];
  }
}

/** Terminate `member`'s worker and settle everything still waiting on it, cache writes included. */
function stop(member, reason) {
  member.alive = false;
  member.worker.terminate();
  const waiting = [...member.pending.values()];
  member.pending.clear();
  for (const settle of waiting) settle({ error: reason });
}

/**
 * The board's pack as the main thread uses it, held by `pool`'s host worker
 * (V2a: the main thread never opens the pack): the header, and the barrels,
 * every operation's net and one operation's binding, each a promise. `free`
 * stops the pool. Null when no worker could open the pack.
 */
export async function hostedPack(pool) {
  const header = await pool.header();
  if (!header) return null;
  const count = operationCount(header);
  return {
    header,
    hosted: true,
    async barrels() {
      return (await pool.ask("barrels")).barrels;
    },
    async netIndices() {
      return (await pool.ask("netIndices", { count })).indices;
    },
    async binding(index) {
      return (await pool.ask("binding", { index })).binding;
    },
    free() {
      pool.close();
    },
  };
}

/**
 * The board's pack from its cached record (`boardRecord`): header, barrels
 * and nets at once, with no pack opened anywhere; one operation's binding
 * (a click) comes from `pool`'s host worker, which opens the pack meanwhile.
 */
export function storedPack(record, pool) {
  return {
    header: record.header,
    hosted: true,
    async barrels() {
      return { floats: record.barrelFloats, words: record.barrelWords, skipped: record.barrelSkipped };
    },
    async netIndices() {
      return record.netIndices;
    },
    async binding(index) {
      if (!pool) throw new Error("no worker holds the pack");
      return (await pool.ask("binding", { index })).binding;
    },
    free() {
      pool?.close();
    },
  };
}

/**
 * Lower `keys` of the pack `bytes` in a pool of workers for this call only,
 * `weights` (slice key to operation count) balancing them. Resolves to a Map
 * of key to each slice's bytes (see `LowerPool.lower`) with whatever the workers gave, or null when no
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
