// Lowers an analytic pack's slices off the main thread: the WASM work that
// otherwise blocks the page for seconds on a large board. Each worker of the
// pool (analytic-lower-client.js) opens its own copy of the pack once, then
// lowers the slices it is asked for, as often as asked, packs what the
// renderer uploads (analytic-prepare.js), and transfers each slice's cache bytes
// back. One worker stays as the board's pack host: the main thread never
// opens the pack (V2a), and asks the host for what it reads from it.
//
// Messages in: { type: "open", bytes, wasmUrl, wasmModule } once (answered
// with id 0 and the pack's header; `wasmModule`, compiled once by the page,
// spares the worker compiling from `wasmUrl`), then any of
//   { type: "lower", id, keys, toleranceNm, store } -> { id, lowered }, each
//     slice's bytes as `encodeLowered` writes them: the host decodes them as views
//   { type: "step", id, key, copper, mask, store } -> { id, step } (see
//     planOpenings), encoded the same way
// Given `store` (the cache identity of `analytic-lower-cache.js`), a worker then
// writes copies of those bytes into the page's asset cache itself, after
// answering, and lists the keys it wrote in a second answer { id: -id, stored },
// so the page only adopts them (`AssetCache.adopt`).
//   { type: "barrels", id } -> { id, barrels: { floats, words, skipped } }
//   { type: "netIndices", id, count } -> { id, indices }
//   { type: "binding", id, index } -> { id, binding }
// and { type: "close" }, which frees the pack. A failure answers { id, error }.
import init, { AnalyticPack } from "../vendor/prism-kicad-wasm/prism_kicad_analytic.js";

import { lowerPackSlice } from "./analytic-pack.js";
import { ASSET_CACHE_DIRECTORY, fileNameFor } from "./asset-cache.js";
import { encodeLowered, loweredSliceKey } from "./analytic-lower-cache.js";
import { packEdges, planOpenings } from "./analytic-prepare.js";

let ready = null;
let pack = null;
let opened = null;

async function open(bytes, wasmUrl, wasmModule) {
  ready ??= init({ module_or_path: wasmModule || wasmUrl });
  await ready;
  pack = new AnalyticPack(new Uint8Array(bytes));
  return JSON.parse(pack.headerJson());
}

let cacheDirectory = null;

/** Write `bytes` as cache entry `key` of `store`; whether the whole file was written. */
async function storeInCache(store, key, bytes) {
  if (!store || typeof navigator === "undefined" || !navigator.storage?.getDirectory) return false;
  try {
    cacheDirectory ??= navigator.storage.getDirectory().then((root) => root.getDirectoryHandle(ASSET_CACHE_DIRECTORY, { create: true }));
    const name = fileNameFor(loweredSliceKey(store.cacheKey, store.wasmKey, store.toleranceNm, key));
    const handle = await (await cacheDirectory).getFileHandle(name, { create: true });
    const access = await handle.createSyncAccessHandle();
    try {
      access.truncate(0);
      const written = access.write(bytes, { at: 0 });
      access.flush();
      return written === bytes.byteLength;
    } finally {
      access.close();
    }
  } catch {
    return false;
  }
}

/** Store `[key, bytes]` pairs in the cache; `[key, size]` of each file written whole. */
async function storeAll(store, copies) {
  const stored = [];
  for (const [key, bytes] of copies) if (await storeInCache(store, key, bytes)) stored.push([key, bytes.byteLength]);
  return stored;
}

const ANSWERS = {
  lower({ keys, toleranceNm, store }) {
    const lowered = {};
    const transfer = [];
    for (const key of keys) {
      const slice = lowerPackSlice(pack, key, toleranceNm);
      lowered[key] = encodeLowered(Object.assign(slice, packEdges(slice)));
      transfer.push(lowered[key].buffer);
    }
    // Copies to store once the answer is sent (sending moves the originals).
    const copies = store ? keys.map((key) => [key, lowered[key].slice()]) : [];
    return [{ lowered }, transfer, () => storeAll(store, copies)];
  },
  step({ key, copper, mask, store }) {
    const step = encodeLowered(planOpenings(copper, mask));
    const copies = store ? [[key, step.slice()]] : [];
    return [{ step }, [step.buffer], () => storeAll(store, copies)];
  },
  barrels() {
    const records = pack.barrelRecords();
    try {
      const barrels = { floats: new Float32Array(records.floats()), words: new Uint32Array(records.words()), skipped: records.skipped() };
      return [{ barrels }, [barrels.floats.buffer, barrels.words.buffer]];
    } finally {
      records.free();
    }
  },
  netIndices({ count }) {
    const indices = new Uint32Array(pack.operationNetIndices(count));
    return [{ indices }, [indices.buffer]];
  },
  binding({ index }) {
    return [{ binding: JSON.parse(pack.bindingJson(index)) }, []];
  },
};

self.onmessage = async ({ data }) => {
  if (data.type === "open") {
    opened = open(data.bytes, data.wasmUrl, data.wasmModule);
    try {
      self.postMessage({ id: 0, header: await opened });
    } catch (error) {
      self.postMessage({ id: 0, error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (data.type === "close") {
    pack?.free();
    pack = null;
    return;
  }
  const { id } = data;
  let answered = false;
  let stored = [];
  try {
    // Planning a step needs no pack.
    if (data.type !== "step") {
      await opened;
      if (!pack) throw new Error("no pack is open");
    }
    const answer = ANSWERS[data.type];
    if (!answer) throw new Error(`unknown message ${data.type}`);
    const [body, transfer, after] = await answer(data);
    self.postMessage({ id, ...body }, transfer);
    answered = true;
    if (after) stored = await after();
  } catch (error) {
    if (!answered) self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  } finally {
    // A request that asked to cache always hears back, even when it failed:
    // the page releases its surplus workers once every write has settled.
    if (data.store) self.postMessage({ id: -id, stored });
  }
};
