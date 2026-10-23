import { fetchChecked } from "@/lib/api";

/**
 * A run's `prism.sim.quantity-pack` artifacts (prism-sim-studio sim-adr-0018):
 * every field of one quantity in one zlib file. Inflated, it is the 8 bytes
 * `PRSQPK01`, a little-endian uint32 header length, the JSON header, zero
 * padding to a multiple of 8, then the data: each net's raster per copper
 * slice (float32, NaN off the net's copper) and the per-operation values
 * (uint32 operation indices, float32 values), at 8-aligned offsets. Views
 * of the rasters go to the viewer as they are, uncopied.
 *
 * The viewer's harness reads packs with `kicad-prism-viewer/viewer/src/quantity-pack.js`;
 * the two follow the same contract.
 */

const MAGIC = "PRSQPK01";

interface Range { min: number; max: number }

export interface PackRaster { slice_key: string; ix0: number; iy0: number; nx: number; ny: number; offset: number; value_range?: Range }
/** A net's rasters; a field that does not follow nets (a temperature) is one entry without a net. */
export interface PackNet { net?: string; value_range?: Range; rasters: PackRaster[] }
export interface PackHeader {
    schema: "prism.sim.quantity-pack";
    quantity: { name: string; unit: string };
    value_range?: Range;
    grid?: { origin_x_m: number; origin_y_m: number; dx_m: number; dy_m: number; nets: PackNet[] };
    items?: {
        count: number;
        indices_offset: number;
        values_offset: number;
        value_range?: Range;
        /** Per item, the slices its via's busiest barrel segment joins (uint8 index pairs into `slices`). */
        spans?: { slices: string[]; offset: number };
    };
}

export interface QuantityPack { header: PackHeader; buffer: ArrayBuffer; dataStart: number }

export interface PackGridSlice { slice_key: string; ix0: number; iy0: number; nx: number; ny: number; values: Float32Array }
export interface PackGrid {
    origin_x_m: number;
    origin_y_m: number;
    dx_m: number;
    dy_m: number;
    net: string | null;
    slices: PackGridSlice[];
}

/** An inflated pack's header and where its data starts. */
export function readQuantityPack(buffer: ArrayBuffer): QuantityPack {
    const bytes = new Uint8Array(buffer);
    const magic = new TextDecoder().decode(bytes.subarray(0, 8));
    if (magic !== MAGIC) throw new Error(`not a quantity pack (${JSON.stringify(magic)})`);
    const length = new DataView(buffer).getUint32(8, true);
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + length))) as PackHeader;
    if (header.schema !== "prism.sim.quantity-pack") throw new Error(`unexpected schema ${String(header.schema)}`);
    return { header, buffer, dataStart: Math.ceil((12 + length) / 8) * 8 };
}

/** The inflated bytes of a pack as written (zlib, RFC 1950). */
export async function inflate(compressed: ArrayBuffer): Promise<ArrayBuffer> {
    const body = new Response(compressed).body;
    if (!body) throw new Error("empty result file");
    return new Response(body.pipeThrough(new DecompressionStream("deflate"))).arrayBuffer();
}

/** Net keys with rasters, in the pack's order; null for a field that does not follow nets. */
export function packNets(pack: QuantityPack): (string | null)[] {
    return (pack.header.grid?.nets ?? []).map((net) => net.net ?? null);
}

/** `net`'s rasters as views of the pack (the first entry when `net` is null or absent from it). */
export function packGrid(pack: QuantityPack, net: string | null): PackGrid | null {
    const grid = pack.header.grid;
    if (!grid?.nets.length) return null;
    const chosen = (net ? grid.nets.find((item) => item.net === net) : undefined) ?? grid.nets[0];
    return {
        origin_x_m: grid.origin_x_m,
        origin_y_m: grid.origin_y_m,
        dx_m: grid.dx_m,
        dy_m: grid.dy_m,
        net: chosen.net ?? null,
        slices: chosen.rasters.map((raster) => ({
            slice_key: raster.slice_key,
            ix0: raster.ix0,
            iy0: raster.iy0,
            nx: raster.nx,
            ny: raster.ny,
            values: new Float32Array(pack.buffer, pack.dataStart + raster.offset, raster.nx * raster.ny),
        })),
    };
}

/** A net's own colour range (rails and returns differ by volts), else the pack's. */
export function packRange(pack: QuantityPack, net: string | null): [number, number] | null {
    const own = pack.header.grid?.nets.find((item) => (item.net ?? null) === net)?.value_range;
    const range = own ?? pack.header.value_range;
    return range ? [range.min, range.max] : null;
}

/** The per-operation values: indices and values as views, and each item's busiest span when the pack has them. */
export function packItems(pack: QuantityPack): { indices: Uint32Array; values: Float32Array; spans: [string, string][] | null } | null {
    const items = pack.header.items;
    if (!items) return null;
    const indices = new Uint32Array(pack.buffer, pack.dataStart + items.indices_offset, items.count);
    const values = new Float32Array(pack.buffer, pack.dataStart + items.values_offset, items.count);
    let spans: [string, string][] | null = null;
    if (items.spans) {
        const pairs = new Uint8Array(pack.buffer, pack.dataStart + items.spans.offset, items.count * 2);
        const names = items.spans.slices;
        spans = Array.from({ length: items.count }, (_, k) => [names[pairs[2 * k]] ?? "", names[pairs[2 * k + 1]] ?? ""]);
    }
    return { indices, values, spans };
}

/** The per-operation values as `{ index: value }`, as the viewer's overlays take them. */
export function packValues(pack: QuantityPack): Record<number, number> | null {
    const items = packItems(pack);
    if (!items) return null;
    const out: Record<number, number> = {};
    items.indices.forEach((index, k) => { out[index] = items.values[k]; });
    return out;
}

/** Packs of the runs on screen, fetched and inflated once each. */
const cache = new Map<string, Promise<QuantityPack>>();
const KEPT = 32;

export function packOf(base: string, path: string): Promise<QuantityPack> {
    const key = `${base}/${path}`;
    let pack = cache.get(key);
    if (!pack) {
        pack = (async () => {
            const response = await fetchChecked(`${base}/files/${path}`, undefined, "Cannot load the result");
            return readQuantityPack(await inflate(await response.arrayBuffer()));
        })();
        pack.catch(() => cache.delete(key));
        cache.set(key, pack);
        // Oldest first: a few runs' packs, not a session's.
        while (cache.size > KEPT) cache.delete(cache.keys().next().value as string);
    }
    return pack;
}
