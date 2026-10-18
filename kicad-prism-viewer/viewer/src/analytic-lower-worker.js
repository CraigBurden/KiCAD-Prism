// Lowers an analytic pack's slices off the main thread: the WASM work that
// otherwise blocks the page for seconds on a large board. Each worker of the
// pool (analytic-lower-client.js) opens its own copy of the pack once, then
// lowers the slices it is asked for, as often as asked, and transfers the
// typed arrays back; the host keeps its pack for the cheap queries.
//
// Messages in: { type: "open", bytes, wasmUrl } once, then
// { type: "lower", id, keys, toleranceNm }; { type: "close" } frees the pack.
// Out: { id, lowered } or { id, error }; "open" answers with id 0.
import init, { AnalyticPack } from "../vendor/prism-kicad-wasm/prism_kicad_analytic.js";

import { loweredBuffers, lowerPackSlice } from "./analytic-pack.js";

let ready = null;
let pack = null;
let opened = null;

async function open(bytes, wasmUrl) {
  ready ??= init({ module_or_path: wasmUrl });
  await ready;
  pack = new AnalyticPack(new Uint8Array(bytes));
}

self.onmessage = async ({ data }) => {
  if (data.type === "open") {
    opened = open(data.bytes, data.wasmUrl);
    try {
      await opened;
      self.postMessage({ id: 0 });
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
  const { id, keys, toleranceNm } = data;
  try {
    await opened;
    if (!pack) throw new Error("no pack is open");
    const lowered = {};
    const transfer = [];
    for (const key of keys) {
      lowered[key] = lowerPackSlice(pack, key, toleranceNm);
      transfer.push(...loweredBuffers(lowered[key]));
    }
    self.postMessage({ id, lowered }, transfer);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
