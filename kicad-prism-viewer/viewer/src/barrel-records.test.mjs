import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BARREL_INPUT_WGSL,
  BARREL_INSTANCE_LAYOUT,
  BARREL_INSTANCE_STRIDE,
  BARREL_RECORD_STRIDE,
  BARREL_STORAGE_WGSL,
  barrelRuntime,
  packBarrelInstances,
  packBarrels,
} from "./barrel-records.js";

const RECORDS = [
  { centerMm: [12.5, 7.25], drillWidthMm: 0.3, drillHeightMm: 0.4, outerWidthMm: 0.6, outerHeightMm: 0.5, startZMm: 0.8175, endZMm: -0.8175, netId: 7, objectFeatureId: 42, startLayerId: 1, endLayerId: 4 },
  { centerMm: [-3, 0.1], drillWidthMm: 1.1, drillHeightMm: 1.1, outerWidthMm: 1.7, outerHeightMm: 1.7, startZMm: 0.3, endZMm: 0.1, startLayerId: 2, endLayerId: 3 },
];

// The bytes the renderer (40-byte) and occurrences.js (48-byte) packers wrote
// for RECORDS before AC-30 moved both here.
const LEGACY_INSTANCES = "cdcc4c3c6891edbb52491d3952499d397f4d563a7f4d56ba070000002a0000000100000004000000"
  + "a69b44bb17b7d1b8e02d103a89d25e3a52499d3917b7d13800000000000000000200000003000000";
const LEGACY_STORAGE = "cdcc4c3c6891edbb52491d3952499d397f4d563a7f4d56ba0000000000000000070000002a0000000100000004000000"
  + "a69b44bb17b7d1b8e02d103a89d25e3a52499d3917b7d138000000000000000000000000000000000200000003000000";

const close = (actual, expected) => actual.forEach((value, index) =>
  assert.ok(Math.abs(value - expected[index]) < 1e-12, `${index}: ${value} ≠ ${expected[index]}`));
const hex = (buffer) => Buffer.from(buffer).toString("hex");

test("both layouts pack the bytes the renderer and occurrence packers wrote", () => {
  assert.equal(hex(packBarrelInstances(RECORDS)), LEGACY_INSTANCES);
  assert.equal(hex(packBarrels(RECORDS)), LEGACY_STORAGE);
});

test("barrels convert from KiCad mm (y down) to runtime metres (y up) once", () => {
  const barrel = barrelRuntime(RECORDS[0]);
  assert.equal(barrel.x, 0.0125);
  assert.equal(barrel.y, -0.00725);
  assert.equal(barrel.drillRadius, 0.15 / 1000);
  assert.equal(barrel.outerRadius, 0.3 / 1000);
  assert.equal(barrel.startZ, 0.8175 / 1000);
  assert.equal(barrel.endZ, -0.8175 / 1000);
  assert.deepEqual([barrel.netId, barrel.objectId, barrel.startLayerId, barrel.endLayerId], [7, 42, 1, 4]);
  const bare = barrelRuntime(RECORDS[1]);
  assert.deepEqual([bare.netId, bare.objectId], [0, 0]);
});

test("the two layouts agree field by field", () => {
  const instances = new DataView(packBarrelInstances(RECORDS));
  const storage = new DataView(packBarrels(RECORDS));
  const idsAt = Object.fromEntries(BARREL_INSTANCE_LAYOUT.attributes.map((item) => [item.shaderLocation, item.offset]));
  for (let index = 0; index < RECORDS.length; index += 1) {
    const a = index * BARREL_INSTANCE_STRIDE;
    const b = index * BARREL_RECORD_STRIDE;
    for (let word = 0; word < 6; word += 1) {
      assert.equal(instances.getFloat32(a + word * 4, true), storage.getFloat32(b + word * 4, true));
    }
    for (let word = 0; word < 4; word += 1) {
      assert.equal(instances.getUint32(a + idsAt[5] + word * 4, true), storage.getUint32(b + 32 + word * 4, true));
    }
  }
});

test("an empty list packs no instances but one zeroed storage record", () => {
  assert.equal(packBarrelInstances([]).byteLength, 0);
  const storage = packBarrels([]);
  assert.equal(storage.byteLength, BARREL_RECORD_STRIDE);
  assert.ok(new Uint8Array(storage).every((byte) => byte === 0));
});

test("the vertex layout matches the WGSL vertex input", () => {
  assert.equal(BARREL_INSTANCE_LAYOUT.arrayStride, BARREL_INSTANCE_STRIDE);
  assert.equal(BARREL_INSTANCE_LAYOUT.stepMode, "instance");
  const formats = { "float32x4": "vec4f", "float32x2": "vec2f", "uint32x4": "vec4u" };
  for (const { shaderLocation, format } of BARREL_INSTANCE_LAYOUT.attributes) {
    assert.match(BARREL_INPUT_WGSL, new RegExp(`@location\\(${shaderLocation}\\) \\w+: ${formats[format]},`));
  }
  const last = BARREL_INSTANCE_LAYOUT.attributes.at(-1);
  assert.equal(last.offset + 16, BARREL_INSTANCE_STRIDE);
});

test("the storage stride is the WGSL size of struct Barrel", () => {
  // vec4f (16) + vec2f (8, then 8 padding to the vec4u's 16-byte alignment) + vec4u (16).
  assert.match(BARREL_STORAGE_WGSL, /dimensions: vec4f,\n  span: vec2f,\n  ids: vec4u,/);
  assert.match(BARREL_STORAGE_WGSL, /@binding\(6\) var<storage, read> barrels: array<Barrel>;/);
  assert.equal(BARREL_RECORD_STRIDE, 16 + 16 + 16);
});

test("barrel records pack into the storage layout (ids at byte 32)", () => {
  const data = packBarrels([{
    centerMm: [10, 20], drillWidthMm: 0.4, drillHeightMm: 0.6, outerWidthMm: 0.8, outerHeightMm: 0.7,
    startZMm: -0.8, endZMm: 0.8, netId: 7, objectFeatureId: 9, startLayerId: 1, endLayerId: 4,
  }]);
  assert.equal(data.byteLength, BARREL_RECORD_STRIDE);
  const f32 = new Float32Array(data);
  const u32 = new Uint32Array(data);
  close([f32[0], f32[1], f32[2], f32[3], f32[4], f32[5]].map((v) => Math.fround(v)),
    [0.01, -0.02, 0.0002, 0.0004, -0.0008, 0.0008].map((v) => Math.fround(v)));
  assert.deepEqual([...u32.slice(8, 12)], [7, 9, 1, 4]);
});

test("Rust mesh-pack barrels pack a finite span from their start to their end layer", () => {
  // Written by the native crate's barrel test (mesh_pack.rs), so the reader is
  // checked against what the Rust lane actually emits.
  const records = JSON.parse(readFileSync(
    new URL("../../native/prism-kicad-native/src/testdata/mesh-pack-barrels.json", import.meta.url), "utf8"));
  assert.ok(records.length > 0);
  const f32 = new Float32Array(packBarrels(records));
  const u32 = new Uint32Array(f32.buffer);
  const stride = BARREL_RECORD_STRIDE / 4;
  records.forEach((record, index) => {
    const [startZ, endZ] = [f32[index * stride + 4], f32[index * stride + 5]];
    assert.ok(Number.isFinite(startZ) && Number.isFinite(endZ), `${record.sourceUid}: ${startZ}..${endZ}`);
    assert.equal(startZ, Math.fround(record.startZMm / 1000));
    assert.equal(endZ, Math.fround(record.endZMm / 1000));
    // The start layer is the top of the span.
    assert.ok(startZ > endZ, record.sourceUid);
    assert.deepEqual([...u32.slice(index * stride + 10, index * stride + 12)], [record.startLayerId, record.endLayerId]);
  });
});
