import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { inflateQuantityPack, quantityPackItems, quantityPackNets, quantityPackOverlay, readQuantityPack } from "./quantity-pack.js";

/** A pack laid out as sim-worker writes one: blocks at 8-aligned offsets of the data. */
function pack(header, blocks) {
  const data = [];
  let length = 0;
  const offsets = blocks.map((block) => {
    const pad = (8 - (length % 8)) % 8;
    if (pad) data.push(new Uint8Array(pad));
    length += pad;
    const offset = length;
    const bytes = new Uint8Array(block.buffer, block.byteOffset, block.byteLength);
    data.push(bytes);
    length += bytes.length;
    return offset;
  });
  const json = new TextEncoder().encode(JSON.stringify(header(offsets)));
  const head = new Uint8Array(Math.ceil((12 + json.length) / 8) * 8);
  head.set(new TextEncoder().encode("PRSQPK01"));
  new DataView(head.buffer).setUint32(8, json.length, true);
  head.set(json, 12);
  return deflateSync(Buffer.concat([head, ...data]));
}

const geometry = { bundle_sha256: "a".repeat(64), board_id: "main", materialization_schema: "kicad_monkey.materialization.a0" };
const gnd = new Float32Array([0.001, NaN, 0.002]);
const rail = new Float32Array([3.29, 3.3]);
const voltage = pack(([a, b, indices, values]) => ({
  schema: "prism.sim.quantity-pack",
  version: "a0",
  geometry,
  quantity: { name: "voltage_v", unit: "V" },
  value_range: { min: 0.001, max: 3.3 },
  grid: {
    origin_x_m: 0.1, origin_y_m: 0.2, dx_m: 1e-3, dy_m: 1e-3,
    nets: [
      { net: "GND", value_range: { min: 0.001, max: 0.002 }, rasters: [{ slice_key: "copper.back", ix0: 0, iy0: 2, nx: 3, ny: 1, offset: a }] },
      { net: "+3V3", value_range: { min: 3.29, max: 3.3 }, rasters: [{ slice_key: "copper.front", ix0: 5, iy0: 2, nx: 2, ny: 1, offset: b }] },
    ],
  },
  items: { count: 2, indices_offset: indices, values_offset: values, value_range: { min: 0.0015, max: 3.295 } },
}), [gnd, rail, new Uint32Array([7, 12]), new Float32Array([0.0015, 3.295])]);

test("a pack inflates and reads its header, nets and per-operation values", async () => {
  const read = readQuantityPack(await inflateQuantityPack(voltage));
  assert.equal(read.dataStart % 8, 0);
  assert.deepEqual(quantityPackNets(read), ["GND", "+3V3"]);
  const items = quantityPackItems(read);
  assert.deepEqual(Object.keys(items), ["7", "12"]);
  assert.equal(items[12], Math.fround(3.295));
});

test("a net's overlay views its rasters in place, with its own range and the barrel values", async () => {
  const read = readQuantityPack(await inflateQuantityPack(voltage));
  const overlay = quantityPackOverlay(read, { net: "+3V3" });
  assert.equal(overlay.kind, "field_grid");
  assert.equal(overlay.grid.net, "+3V3");
  assert.deepEqual(overlay.range, [3.29, 3.3]);
  const [slice] = overlay.grid.slices;
  assert.equal(slice.slice_key, "copper.front");
  assert.equal(slice.values.buffer, read.buffer, "a view, not a copy");
  assert.deepEqual([...slice.values], [...rail]);
  assert.equal(overlay.values[7], Math.fround(0.0015));
  const first = quantityPackOverlay(read);
  assert.equal(first.grid.net, "GND");
  assert.ok(Number.isNaN(first.grid.slices[0].values[1]));
  assert.throws(() => quantityPackOverlay(read, { net: "+5V" }), /no rasters for net \+5V/);
});

test("a pack without rasters is per-operation values, and other bytes are refused", async () => {
  const current = pack(([indices, values]) => ({
    schema: "prism.sim.quantity-pack",
    version: "a0",
    geometry,
    quantity: { name: "via_current_a", unit: "A" },
    items: { count: 1, indices_offset: indices, values_offset: values, value_range: { min: 0.4, max: 0.4 } },
  }), [new Uint32Array([3]), new Float32Array([0.4])]);
  const overlay = quantityPackOverlay(readQuantityPack(await inflateQuantityPack(current)));
  assert.deepEqual(overlay, { kind: "operation_values", quantity: "via_current_a", units: "A", values: { 3: Math.fround(0.4) }, range: [0.4, 0.4] });
  assert.throws(() => readQuantityPack(new ArrayBuffer(16)), /not a quantity pack/);
});

test("a field that does not follow nets is one entry without a net", async () => {
  const temperature = pack(([a]) => ({
    schema: "prism.sim.quantity-pack",
    version: "a0",
    geometry,
    quantity: { name: "temperature_c", unit: "degC" },
    grid: { origin_x_m: 0, origin_y_m: 0, dx_m: 1e-3, dy_m: 1e-3, nets: [{ value_range: { min: 25, max: 61 }, rasters: [{ slice_key: "copper.front", ix0: 0, iy0: 0, nx: 2, ny: 1, offset: a }] }] },
  }), [new Float32Array([25, 61])]);
  const read = readQuantityPack(await inflateQuantityPack(temperature));
  assert.deepEqual(quantityPackNets(read), [null]);
  const overlay = quantityPackOverlay(read);
  assert.equal(overlay.grid.net, null);
  assert.deepEqual(overlay.range, [25, 61]);
  assert.deepEqual([...overlay.grid.slices[0].values], [25, 61]);
});
