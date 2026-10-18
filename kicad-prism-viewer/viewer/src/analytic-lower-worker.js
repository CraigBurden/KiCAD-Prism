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
//   { type: "lower", id, keys, toleranceNm } -> { id, lowered }, each slice's bytes as
//     `encodeLowered` writes them: the host decodes them as views and caches them as they are
//   { type: "step", id, copper, mask } -> { id, step } (see planOpenings), encoded the same way
//   { type: "barrels", id } -> { id, barrels: { floats, words, skipped } }
//   { type: "netIndices", id, count } -> { id, indices }
//   { type: "binding", id, index } -> { id, binding }
// and { type: "close" }, which frees the pack. A failure answers { id, error }.
import init, { AnalyticPack } from "../vendor/prism-kicad-wasm/prism_kicad_analytic.js";

import { lowerPackSlice } from "./analytic-pack.js";
import { encodeLowered } from "./analytic-lower-cache.js";
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

const ANSWERS = {
  lower({ keys, toleranceNm }) {
    const lowered = {};
    const transfer = [];
    for (const key of keys) {
      const slice = lowerPackSlice(pack, key, toleranceNm);
      lowered[key] = encodeLowered(Object.assign(slice, packEdges(slice)));
      transfer.push(lowered[key].buffer);
    }
    return [{ lowered }, transfer];
  },
  step({ copper, mask }) {
    const step = encodeLowered(planOpenings(copper, mask));
    return [{ step }, [step.buffer]];
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
  try {
    // Planning a step needs no pack.
    if (data.type !== "step") {
      await opened;
      if (!pack) throw new Error("no pack is open");
    }
    const answer = ANSWERS[data.type];
    if (!answer) throw new Error(`unknown message ${data.type}`);
    const [body, transfer] = answer(data);
    self.postMessage({ id, ...body }, transfer);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
