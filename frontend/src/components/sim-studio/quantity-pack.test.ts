import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { packOverlay } from "./run-overlay";
import { inflate, packGrid, packItems, packNets, packRange, readQuantityPack } from "./quantity-pack";

/** A pack laid out as sim-worker writes one: blocks at 8-aligned offsets of the data. */
function pack(header: (offsets: number[]) => object, blocks: ArrayBufferView[]): ArrayBuffer {
    const parts: Uint8Array[] = [];
    let length = 0;
    const offsets = blocks.map((block) => {
        const pad = (8 - (length % 8)) % 8;
        parts.push(new Uint8Array(pad));
        length += pad;
        const offset = length;
        const bytes = new Uint8Array(block.buffer, block.byteOffset, block.byteLength);
        parts.push(bytes);
        length += bytes.length;
        return offset;
    });
    const json = new TextEncoder().encode(JSON.stringify(header(offsets)));
    const head = new Uint8Array(Math.ceil((12 + json.length) / 8) * 8);
    head.set(new TextEncoder().encode("PRSQPK01"));
    new DataView(head.buffer).setUint32(8, json.length, true);
    head.set(json, 12);
    const whole = deflateSync(Buffer.concat([head, ...parts]));
    return whole.buffer.slice(whole.byteOffset, whole.byteOffset + whole.byteLength);
}

const gnd = new Float32Array([0.001, NaN, 0.002]);
const rail = new Float32Array([3.29, 3.3]);
const voltage = pack(([a, b, indices, values]) => ({
    schema: "prism.sim.quantity-pack",
    version: "a0",
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

describe("quantity packs", () => {
    it("inflate and read each net's rasters in place, with the net's own range", async () => {
        const read = readQuantityPack(await inflate(voltage));
        expect(packNets(read)).toEqual(["GND", "+3V3"]);
        const grid = packGrid(read, "+3V3");
        expect(grid?.net).toBe("+3V3");
        expect(grid?.slices[0].values.buffer).toBe(read.buffer);
        expect([...(grid?.slices[0].values ?? [])]).toEqual([...rail]);
        expect(packRange(read, "+3V3")).toEqual([3.29, 3.3]);
        expect(packGrid(read, null)?.net).toBe("GND");
    });

    it("give the barrels their per-operation values and the via table its spans", async () => {
        const read = readQuantityPack(await inflate(voltage));
        const overlay = packOverlay(read, "GND");
        expect(overlay.overlay.kind).toBe("field_grid");
        expect(overlay.range).toEqual([0.001, 0.002]);
        expect(overlay.count).toBe(2);
        const current = pack(([indices, values, spans]) => ({
            schema: "prism.sim.quantity-pack",
            version: "a0",
            quantity: { name: "via_current_a", unit: "A" },
            items: { count: 2, indices_offset: indices, values_offset: values, spans: { slices: ["copper.front", "copper.in1"], offset: spans } },
        }), [new Uint32Array([3, 9]), new Float32Array([0.5, 1.25]), new Uint8Array([0, 1, 1, 0])]);
        const items = packItems(readQuantityPack(await inflate(current)));
        expect([...(items?.indices ?? [])]).toEqual([3, 9]);
        expect(items?.spans).toEqual([["copper.front", "copper.in1"], ["copper.in1", "copper.front"]]);
        expect(packOverlay(readQuantityPack(await inflate(current)), null).overlay.kind).toBe("operation_values");
    });

    it("refuse other bytes", () => {
        expect(() => readQuantityPack(new ArrayBuffer(16))).toThrow(/not a quantity pack/);
    });
});
