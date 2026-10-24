import assert from "node:assert/strict";
import test from "node:test";

import { AssetCache, CACHE_MAX_AGE_MS, assetCacheKey, fileNameFor, planPrune } from "./asset-cache.js";

const ASSET = "http://localhost:5191/api/projects/prj_0cf4/webgpu-3d/assets/c8c3abc7/kicad-build_3181d3fa";

test("only bundle assets have cache keys, named by bundle fingerprints and file", () => {
  assert.equal(assetCacheKey(`${ASSET}/tiles/f-cu/0_0.glb`), "prj_0cf4/c8c3abc7/kicad-build_3181d3fa/tiles/f-cu/0_0.glb");
  assert.equal(assetCacheKey(`${ASSET}/bundle.json?viewer=v7`), "prj_0cf4/c8c3abc7/kicad-build_3181d3fa/bundle.json?viewer=v7");
  assert.equal(assetCacheKey("/api/projects/prj_0cf4/webgpu-3d/assets/a/b/board.glb"), "prj_0cf4/a/b/board.glb");
  assert.equal(assetCacheKey("http://localhost/api/projects/prj_0cf4/webgpu-3d/status"), null);
  assert.equal(assetCacheKey("http://localhost/api/jobs/job_1/artifact"), null);
  assert.equal(assetCacheKey(`${ASSET}/../escape.glb`), null, "URL parsing resolves dot segments out of the asset path");
  assert.equal(assetCacheKey("not a url \u0000"), null);
});

test("file names are flat and safe", () => {
  const name = fileNameFor("prj_0cf4/c8c3/build/tiles/f-cu/0_0.glb?viewer=v7");
  assert.doesNotMatch(name, /[/\\]/);
  assert.notEqual(name, ".");
  assert.notEqual(name, "..");
});

test("pruning drops entries unused for 30 days, then the least recently used over the cap", () => {
  const now = 1_800_000_000_000;
  const day = 24 * 60 * 60 * 1000;
  const entries = {
    stale: { bytes: 10, lastUsed: now - CACHE_MAX_AGE_MS - 1 },
    old: { bytes: 40, lastUsed: now - 20 * day },
    mid: { bytes: 40, lastUsed: now - 2 * day },
    fresh: { bytes: 40, lastUsed: now },
    undated: { bytes: 1 },
  };
  assert.deepEqual(planPrune(entries, now, { maxBytes: 1000 }).sort(), ["stale", "undated"]);
  assert.deepEqual(planPrune(entries, now, { maxBytes: 85 }).sort(), ["old", "stale", "undated"]);
  assert.deepEqual(planPrune({}, now), []);
});

test("without OPFS the cache passes through to the network", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ schema: "x" }), { status: 200 });
  };
  try {
    const cache = new AssetCache();
    assert.equal(await cache.ready, null);
    assert.equal(cache.enabled, false);
    assert.deepEqual(await cache.fetchJson(`${ASSET}/bundle.json`), { schema: "x" });
    assert.equal(await cache.peekJson(`${ASSET}/bundle.json`), null);
    assert.equal(calls, 1);
    assert.equal(cache.summary().misses + cache.summary().bypassed, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});
