import assert from "node:assert/strict";
import test from "node:test";

import { LowerPool } from "./analytic-lower-client.js";

// The pool releases its surplus workers once every cache write has settled,
// so a request that asked to cache must hear back however it ends.

test("a lowering that fails still acknowledges its cache writes", async () => {
  const posted = [];
  globalThis.self = { postMessage: (message) => posted.push(message) };
  try {
    await import("./analytic-lower-worker.js");
    // No pack is open: the request fails before lowering anything.
    await globalThis.self.onmessage({ data: { type: "lower", id: 7, keys: ["copper.front"], toleranceNm: 1000, store: { cacheKey: "k" } } });
    assert.equal(posted.length, 2);
    assert.equal(posted[0].id, 7);
    assert.match(posted[0].error, /no pack is open/);
    assert.deepEqual(posted[1], { id: -7, stored: [] });

    // Without a cache to write there is no second answer.
    posted.length = 0;
    await globalThis.self.onmessage({ data: { type: "barrels", id: 8 } });
    assert.deepEqual(posted.map((message) => message.id), [8]);
  } finally {
    delete globalThis.self;
  }
});

/** A worker that opens the pack and then answers lowering with `answer(id)`'s messages. */
function fakeWorkers(answer) {
  const started = [];
  class FakeWorker {
    constructor() {
      this.terminated = false;
      started.push(this);
    }
    postMessage(message) {
      if (this.terminated) return;
      const replies = message.type === "open" ? [{ id: 0, header: { chunks: [] } }] : answer(message);
      queueMicrotask(() => {
        for (const reply of replies) if (!this.terminated) this.onmessage?.({ data: reply });
      });
    }
    terminate() {
      this.terminated = true;
    }
  }
  return { FakeWorker, started };
}

async function withWorkers(answer, body) {
  const { FakeWorker, started } = fakeWorkers(answer);
  const saved = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  try {
    const pool = LowerPool.start(new Uint8Array(8), "pack.wasm", 3);
    assert.ok(pool, "the pool starts with a Worker");
    await body(pool, started);
  } finally {
    globalThis.Worker = saved;
  }
}

test("surplus workers are released after a lowering that failed", async () => {
  await withWorkers((message) => [{ id: message.id, error: "lowering failed" }, { id: -message.id, stored: [] }], async (pool, started) => {
    const store = { identity: { cacheKey: "k" }, adopt: () => {}, writes: [] };
    assert.equal(await pool.lower(["a", "b", "c"], 1000, new Map(), store), null);
    assert.equal(store.writes.length, 3);
    await Promise.all(store.writes);
    await pool.release();
    assert.deepEqual(started.map((worker) => worker.terminated), [false, true, true]);
  });
});

test("stopping the pool settles every write still waiting on a worker", async () => {
  // These workers answer the lowering but never report their cache writes.
  await withWorkers((message) => [{ id: message.id, lowered: {} }], async (pool, started) => {
    const store = { identity: { cacheKey: "k" }, adopt: () => {}, writes: [] };
    await pool.lower(["a", "b", "c"], 1000, new Map(), store);
    const settled = Promise.all(store.writes).then(() => "settled");
    await pool.release();
    pool.close();
    assert.equal(await Promise.race([settled, new Promise((resolve) => setTimeout(resolve, 50, "hung"))]), "settled");
    assert.ok(started.every((worker) => worker.terminated));
  });
});
