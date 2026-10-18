import assert from "node:assert/strict";
import test from "node:test";

import { decodeLowered, encodeLowered, loweredSliceKey, readLowered, writeLowered } from "./analytic-lower-cache.js";
import { lowerSlicesInWorkers, MAX_LOWER_WORKERS, shareSlices, sliceWeights, workerCount } from "./analytic-lower-client.js";

test("slices are shared by weight, heaviest first, each group in load order", () => {
  const weights = new Map([["copper.front", 26100], ["copper.back", 10618], ["mask.front", 6040], ["mask.back", 5000], ["silk", 10]]);
  const groups = shareSlices(["mask.front", "copper.front", "copper.back", "mask.back", "silk"], weights, 3);
  assert.deepEqual(groups, [["copper.front"], ["copper.back", "silk"], ["mask.front", "mask.back"]]);
  assert.deepEqual(shareSlices(["a", "b"], new Map(), 4), [["a"], ["b"]]);
});

test("the pool is bounded by cores, slices and the cap", () => {
  assert.equal(workerCount(29, 10), MAX_LOWER_WORKERS);
  assert.equal(workerCount(2, 10), 2);
  assert.equal(workerCount(29, 4), 3);
  assert.equal(workerCount(5, 1), 1);
});

test("weights add up the chunk directory per slice", () => {
  const weights = sliceWeights({ chunks: [
    { slice_key: "copper.front", operation_count: 4 },
    { slice_key: "copper.front", operation_count: 6 },
    { slice_key: "mask.front", operation_count: 1 },
  ] });
  assert.deepEqual([...weights], [["copper.front", 10], ["mask.front", 1]]);
});

test("without a worker (Node), the pool hands lowering back to the caller", async () => {
  assert.equal(await lowerSlicesInWorkers(new Uint8Array(4), ["copper.front"], 1000, "x.wasm"), null);
});

const SLICE = {
  shapes: new Uint32Array([1, 2, 3]),
  subtractShapes: 1,
  fanVertices: new Float32Array([0.5, -1.25, 3]),
  covers: new Uint32Array([]),
  contourEdges: new Float32Array([1, 2]),
  stats: { operations: 3, degraded: false },
};

test("a lowered slice round-trips through its cache bytes", () => {
  const bytes = encodeLowered(SLICE);
  assert.equal(bytes.length % 4, 0);
  const back = decodeLowered(bytes);
  assert.deepEqual(back, SLICE);
  assert.ok(back.shapes instanceof Uint32Array && back.fanVertices instanceof Float32Array);
  assert.equal(decodeLowered(new Uint8Array(16)), null, "foreign bytes are a miss");
});

test("cached slices are read back by bundle key, WASM and tolerance", async () => {
  const files = new Map();
  const store = { read: async (key) => files.get(key) ?? null, write: async (key, bytes) => void files.set(key, bytes) };
  const identity = { cacheKey: "bundle1", wasmKey: "abcd", toleranceNm: 1000 };
  await writeLowered(store, identity, new Map([["copper.front", SLICE]]));
  assert.deepEqual([...files.keys()], [loweredSliceKey("bundle1", "abcd", 1000, "copper.front")]);
  const hits = await readLowered(store, identity, ["copper.front", "copper.back"]);
  assert.deepEqual([...hits.keys()], ["copper.front"]);
  assert.equal((await readLowered(store, { ...identity, wasmKey: "ffff" }, ["copper.front"])).size, 0, "another WASM misses");
  assert.equal((await readLowered(null, identity, ["copper.front"])).size, 0, "no cache, no hits");
});
