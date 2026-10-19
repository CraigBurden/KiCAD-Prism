/**
 * Simulation results as the analytic board draws them: a
 * `prism.sim.quantity-pack` (prism-sim-studio, sim-adr-0018) holds every
 * field of one quantity of a run. Inflated, it is the 8 bytes `PRSQPK01`, a
 * little-endian uint32 header length, the JSON header, zero padding to a
 * multiple of 8, then the data. The header gives each net's raster per
 * copper slice (float32, NaN off the net's copper) and the per-operation
 * values (uint32 operation indices, float32 values) at 8-aligned offsets of
 * the data, so the overlay takes typed-array views of them, uncopied, and
 * the renderer uploads the rasters as they are.
 */

const MAGIC = "PRSQPK01";

/** The inflated bytes of a pack as written (zlib, RFC 1950). */
export async function inflateQuantityPack(compressed) {
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Response(stream).arrayBuffer();
}

/** An inflated pack's header and where its data starts in `buffer`. */
export function readQuantityPack(buffer) {
  const bytes = new Uint8Array(buffer);
  const magic = new TextDecoder().decode(bytes.subarray(0, 8));
  if (magic !== MAGIC) throw new Error(`not a quantity pack (${JSON.stringify(magic)})`);
  const length = new DataView(buffer).getUint32(8, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + length)));
  if (header.schema !== "prism.sim.quantity-pack") throw new Error(`unexpected schema ${header.schema}`);
  const dataStart = Math.ceil((12 + length) / 8) * 8;
  return { header, buffer, dataStart };
}

/** Net keys a pack has rasters for, in its order; null for a field that does not follow nets. */
export function quantityPackNets(pack) {
  return (pack.header.grid?.nets || []).map((net) => net.net ?? null);
}

/** The per-operation values: `{ index: value }`, or null when the pack has none. */
export function quantityPackItems(pack) {
  const items = pack.header.items;
  if (!items) return null;
  const indices = new Uint32Array(pack.buffer, pack.dataStart + items.indices_offset, items.count);
  const values = new Float32Array(pack.buffer, pack.dataStart + items.values_offset, items.count);
  const out = {};
  for (let k = 0; k < items.count; k += 1) out[indices[k]] = values[k];
  return out;
}

const range = (r) => (r ? [r.min, r.max] : undefined);

/**
 * The pack as an analytic overlay (`applyAnalyticOverlay`): the rasters of
 * `net` (the first entry when omitted; a field that does not follow nets,
 * such as a temperature, is one entry without a net) on their slices, with the per-operation
 * values colouring what no raster covers, the via barrels; a pack without
 * rasters is per-operation values alone. The range is the net's own.
 */
export function quantityPackOverlay(pack, { net } = {}) {
  const { header } = pack;
  const values = quantityPackItems(pack);
  const quantity = header.quantity.name;
  const units = header.quantity.unit;
  if (!header.grid) {
    return { kind: "operation_values", quantity, units, values: values || {}, range: range(header.items?.value_range) };
  }
  const chosen = net ? header.grid.nets.find((item) => item.net === net) : header.grid.nets[0];
  if (!chosen) throw new Error(`the ${quantity} pack has no rasters for net ${net}`);
  const slices = chosen.rasters.map((raster) => ({
    slice_key: raster.slice_key,
    ix0: raster.ix0,
    iy0: raster.iy0,
    nx: raster.nx,
    ny: raster.ny,
    values: new Float32Array(pack.buffer, pack.dataStart + raster.offset, raster.nx * raster.ny),
  }));
  const { origin_x_m, origin_y_m, dx_m, dy_m } = header.grid;
  return {
    kind: "field_grid",
    quantity,
    units,
    grid: { origin_x_m, origin_y_m, dx_m, dy_m, net: chosen.net ?? null, slices },
    ...(values ? { values } : {}),
    range: range(chosen.value_range),
  };
}
