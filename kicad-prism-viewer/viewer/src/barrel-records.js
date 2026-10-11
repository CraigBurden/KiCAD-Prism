/**
 * Barrel records: the conductive spans of vias and plated holes (AC-30).
 *
 * The bundle manifest lists barrels in KiCad millimetres (y down). The GPU
 * reads them in runtime metres (y up) through one of two layouts:
 *
 * - the one-board pipelines take them as a per-instance vertex buffer
 *   (`BARREL_INSTANCE_LAYOUT`, 40 bytes, declared by `BARREL_INPUT_WGSL`);
 * - the instanced pipelines read them from a storage buffer
 *   (`BARREL_RECORD_STRIDE`, 48 bytes: WGSL aligns the `vec4u` to 16, so the
 *   `vec2f` span is followed by 8 bytes of padding; `BARREL_STORAGE_WGSL`).
 *
 * Both layouts carry the same fields, converted once by `barrelRuntime`.
 */

/** A barrel in runtime units: centre (m, y up), drill and outer radius (m), z span (m), and its ids. */
export function barrelRuntime(record) {
  return {
    x: record.centerMm[0] / 1000,
    y: -record.centerMm[1] / 1000,
    drillRadius: Math.min(record.drillWidthMm, record.drillHeightMm) / 2000,
    outerRadius: Math.max(record.outerWidthMm, record.outerHeightMm) / 2000,
    startZ: record.startZMm / 1000,
    endZ: record.endZMm / 1000,
    netId: record.netId || 0,
    objectId: record.objectFeatureId || 0,
    startLayerId: record.startLayerId || 0,
    endLayerId: record.endLayerId || 0,
  };
}

// Field offsets shared by both layouts: dimensions (x, y, drill, outer) then span (start, end).
const DIMENSIONS_OFFSET = 0;
const SPAN_OFFSET = 16;

/** The one-board per-instance vertex layout (shader locations 3, 4 and 5 of `BARREL_INPUT_WGSL`). */
export const BARREL_INSTANCE_STRIDE = 40;
const INSTANCE_IDS_OFFSET = 24;
export const BARREL_INSTANCE_LAYOUT = Object.freeze({
  arrayStride: BARREL_INSTANCE_STRIDE,
  stepMode: "instance",
  attributes: Object.freeze([
    Object.freeze({ shaderLocation: 3, offset: DIMENSIONS_OFFSET, format: "float32x4" }),
    Object.freeze({ shaderLocation: 4, offset: SPAN_OFFSET, format: "float32x2" }),
    Object.freeze({ shaderLocation: 5, offset: INSTANCE_IDS_OFFSET, format: "uint32x4" }),
  ]),
});

/** The instanced storage layout: dimensions vec4f, span vec2f (+pad), ids vec4u. */
export const BARREL_RECORD_STRIDE = 48;
const RECORD_IDS_OFFSET = 32;

/** The one-board vertex input: the unit-cylinder vertex (locations 0–2) and the barrel instance (3–5). */
export const BARREL_INPUT_WGSL = `struct Input {
  @location(0) unit: vec3f,
  @location(1) normal: vec3f,
  @location(2) radiusMix: f32,
  @location(3) dimensions: vec4f,
  @location(4) span: vec2f,
  @location(5) ids: vec4u,
};`;

/** The instanced pipelines' barrel record, bound at group 0 binding 6. */
export const BARREL_STORAGE_WGSL = `struct Barrel {
  dimensions: vec4f,
  span: vec2f,
  ids: vec4u,
};
@group(0) @binding(6) var<storage, read> barrels: array<Barrel>;`;

function writeBarrels(records, stride, idsOffset, minimumCount) {
  const data = new ArrayBuffer(Math.max(minimumCount, records.length) * stride);
  const view = new DataView(data);
  records.forEach((record, index) => {
    const offset = index * stride;
    const barrel = barrelRuntime(record);
    view.setFloat32(offset + DIMENSIONS_OFFSET, barrel.x, true);
    view.setFloat32(offset + DIMENSIONS_OFFSET + 4, barrel.y, true);
    view.setFloat32(offset + DIMENSIONS_OFFSET + 8, barrel.drillRadius, true);
    view.setFloat32(offset + DIMENSIONS_OFFSET + 12, barrel.outerRadius, true);
    view.setFloat32(offset + SPAN_OFFSET, barrel.startZ, true);
    view.setFloat32(offset + SPAN_OFFSET + 4, barrel.endZ, true);
    view.setUint32(offset + idsOffset, barrel.netId, true);
    view.setUint32(offset + idsOffset + 4, barrel.objectId, true);
    view.setUint32(offset + idsOffset + 8, barrel.startLayerId, true);
    view.setUint32(offset + idsOffset + 12, barrel.endLayerId, true);
  });
  return data;
}

/** Pack barrels for the one-board instance vertex buffer (`BARREL_INSTANCE_LAYOUT`). */
export function packBarrelInstances(records) {
  return writeBarrels(records, BARREL_INSTANCE_STRIDE, INSTANCE_IDS_OFFSET, 0);
}

/** Pack barrels for the instanced storage buffer (`BARREL_STORAGE_WGSL`); never empty, as a binding needs bytes. */
export function packBarrels(records) {
  return writeBarrels(records, BARREL_RECORD_STRIDE, RECORD_IDS_OFFSET, 1);
}
