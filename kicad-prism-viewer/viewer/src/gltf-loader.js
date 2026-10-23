import { WebIO } from "@gltf-transform/core";
import {
  EXTMeshFeatures,
  EXTMeshoptCompression,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

const io = new WebIO()
  .registerExtensions([EXTMeshFeatures, EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });

export async function loadGltf(url, options = {}) {
  await MeshoptDecoder.ready;
  // `fetchBytes` (SB2-26) serves bundle assets from the browser cache when it holds them.
  let bytes;
  if (options.fetchBytes) {
    bytes = new Uint8Array(await options.fetchBytes(url));
  } else {
    const response = await fetch(url, { cache: options.fetchCache || "no-store" });
    if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  const document = await io.readBinary(bytes);
  const primitives = [];
  const componentFeatures = options.componentFeatures || new Map();
  const componentNodeCounts = new Map();

  function visit(node, inheritedDesignator = "") {
    const isComponentRoot = componentFeatures.has(node.getName());
    if (isComponentRoot) {
      componentNodeCounts.set(
        node.getName(),
        (componentNodeCounts.get(node.getName()) || 0) + 1,
      );
    }
    const designator = isComponentRoot ? node.getName() : inheritedDesignator;
    const mesh = node.getMesh();
    if (mesh) {
      const matrix = node.getWorldMatrix();
      for (const primitive of mesh.listPrimitives()) {
        const positionAccessor = primitive.getAttribute("POSITION");
        const normalAccessor = primitive.getAttribute("NORMAL");
        const netAccessor = primitive.getAttribute("_FEATURE_ID_0");
        const objectAccessor = primitive.getAttribute("_FEATURE_ID_1");
        const indices = primitive.getIndices()?.getArray();
        if (!positionAccessor || !indices) continue;
        const count = positionAccessor.getCount();
        const position = new Float32Array(count * 3);
        const normal = new Float32Array(count * 3);
        const netId = new Uint32Array(count);
        const objectFeatureId = new Uint32Array(count);
        const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
        const value = [];
        const featureId = componentFeatures.get(designator)?.featureId || options.defaultFeatureId || 0;
        for (let index = 0; index < count; index += 1) {
          positionAccessor.getElement(index, value);
          transformPoint(position, index * 3, value, matrix);
          bounds[0] = Math.min(bounds[0], position[index * 3]);
          bounds[1] = Math.min(bounds[1], position[index * 3 + 1]);
          bounds[2] = Math.min(bounds[2], position[index * 3 + 2]);
          bounds[3] = Math.max(bounds[3], position[index * 3]);
          bounds[4] = Math.max(bounds[4], position[index * 3 + 1]);
          bounds[5] = Math.max(bounds[5], position[index * 3 + 2]);
          if (normalAccessor) {
            normalAccessor.getElement(index, value);
            transformNormal(normal, index * 3, value, matrix);
          } else {
            normal.set([0, 0, 1], index * 3);
          }
          netId[index] = Number(netAccessor?.getScalar(index) || 0);
          objectFeatureId[index] = objectAccessor
            ? Number(objectAccessor.getScalar(index) || 0)
            : Number(featureId);
        }
        const material = primitive.getMaterial();
        primitives.push({
          position,
          normal,
          netId,
          objectFeatureId,
          indices,
          designator,
          nodeName: node.getName(),
          meshName: mesh.getName(),
          bounds,
          material: material
            ? {
                name: material.getName(),
                baseColor: material.getBaseColorFactor(),
                metallic: material.getMetallicFactor(),
                roughness: material.getRoughnessFactor(),
                emissive: material.getEmissiveFactor(),
              }
            : { baseColor: options.baseColor || [0.55, 0.58, 0.64, 1], metallic: 0.05, roughness: 0.72, emissive: [0, 0, 0] },
        });
      }
    }
    for (const child of node.listChildren()) visit(child, designator);
  }

  for (const scene of document.getRoot().listScenes()) {
    for (const child of scene.listChildren()) visit(child);
  }
  return { byteLength: bytes.byteLength, primitives, componentNodeCounts };
}

function transformPoint(output, offset, point, matrix) {
  const x = matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12];
  const y = matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13];
  const z = matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14];
  output[offset] = x;
  output[offset + 1] = -z;
  output[offset + 2] = y;
}

function transformNormal(output, offset, normal, matrix) {
  const x = matrix[0] * normal[0] + matrix[4] * normal[1] + matrix[8] * normal[2];
  const y = matrix[1] * normal[0] + matrix[5] * normal[1] + matrix[9] * normal[2];
  const z = matrix[2] * normal[0] + matrix[6] * normal[1] + matrix[10] * normal[2];
  const size = Math.hypot(x, y, z) || 1;
  output[offset] = x / size;
  output[offset + 1] = -z / size;
  output[offset + 2] = y / size;
}

/**
 * Component models for instancing (SB2-86): every distinct model once, in its
 * own frame, with the placements that draw it. Models are identical when their
 * vertices, feature ids, indices and material are; a placement is the node's
 * world transform (with the axis turn `transformPoint` applies) as three rows,
 * its component feature id, and its exact bounds in the board frame.
 */
export async function loadGltfModels(url, options = {}) {
  await MeshoptDecoder.ready;
  let bytes;
  if (options.fetchBytes) {
    bytes = new Uint8Array(await options.fetchBytes(url));
  } else {
    const response = await fetch(url, { cache: options.fetchCache || "no-store" });
    if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  const document = await io.readBinary(bytes);
  const componentFeatures = options.componentFeatures || new Map();
  const componentNodeCounts = new Map();
  const models = new Map();
  const local = new Map(); // a glTF primitive's model, read once even when nodes share it
  let nextNode = 0;

  function modelOf(primitive) {
    if (local.has(primitive)) return local.get(primitive);
    const positionAccessor = primitive.getAttribute("POSITION");
    const indices = primitive.getIndices()?.getArray();
    if (!positionAccessor || !indices) {
      local.set(primitive, null);
      return null;
    }
    const normalAccessor = primitive.getAttribute("NORMAL");
    const netAccessor = primitive.getAttribute("_FEATURE_ID_0");
    const objectAccessor = primitive.getAttribute("_FEATURE_ID_1");
    const count = positionAccessor.getCount();
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    const netId = new Uint32Array(count);
    const objectFeatureId = new Uint32Array(count);
    const value = [];
    for (let index = 0; index < count; index += 1) {
      positionAccessor.getElement(index, value);
      position.set(value.slice(0, 3), index * 3);
      if (normalAccessor) {
        normalAccessor.getElement(index, value);
        normal.set(value.slice(0, 3), index * 3);
      } else {
        normal.set([0, 1, 0], index * 3); // +Y in the GLB frame is the board's +Z
      }
      netId[index] = Number(netAccessor?.getScalar(index) || 0);
      objectFeatureId[index] = Number(objectAccessor?.getScalar(index) || 0);
    }
    const material = materialOf(primitive.getMaterial(), options);
    const key = [
      hashWords(position), hashWords(normal), hashWords(netId), hashWords(objectFeatureId), hashWords(indices),
      count, indices.length, JSON.stringify(material),
    ].join(":");
    const existing = models.get(key);
    let model = existing;
    if (!existing || !sameModel(existing.primitive, position, normal, netId, objectFeatureId, indices)) {
      // A hash collision (never seen) only costs sharing: the model draws on its own.
      model = {
        primitive: { position, normal, netId, objectFeatureId, indices: Uint32Array.from(indices), material, bounds: null },
        placements: [],
      };
      models.set(existing ? `${key}:${models.size}` : key, model);
    }
    local.set(primitive, model);
    return model;
  }

  function visit(node, inheritedDesignator = "") {
    const isComponentRoot = componentFeatures.has(node.getName());
    if (isComponentRoot) componentNodeCounts.set(node.getName(), (componentNodeCounts.get(node.getName()) || 0) + 1);
    const designator = isComponentRoot ? node.getName() : inheritedDesignator;
    const mesh = node.getMesh();
    if (mesh) {
      const rows = placementRows(node.getWorldMatrix());
      rows[11] += Number(options.zOffset || 0);
      const featureId = Number(componentFeatures.get(designator)?.featureId || options.defaultFeatureId || 0);
      const nodeIndex = nextNode++;
      for (const primitive of mesh.listPrimitives()) {
        const model = modelOf(primitive);
        if (!model) continue;
        const bounds = placedBounds(model.primitive.position, rows);
        model.placements.push({ rows, featureId, designator, bounds, node: nodeIndex });
        const union = model.primitive.bounds;
        model.primitive.bounds = union
          ? [Math.min(union[0], bounds[0]), Math.min(union[1], bounds[1]), Math.min(union[2], bounds[2]),
            Math.max(union[3], bounds[3]), Math.max(union[4], bounds[4]), Math.max(union[5], bounds[5])]
          : [...bounds];
      }
    }
    for (const child of node.listChildren()) visit(child, designator);
  }

  for (const scene of document.getRoot().listScenes()) {
    for (const child of scene.listChildren()) visit(child);
  }
  return { byteLength: bytes.byteLength, models: [...models.values()], componentNodeCounts };
}

/** A node's world matrix (column-major) as three rows in the board frame: x, −z, y, as `transformPoint` turns them. */
export function placementRows(m) {
  return [
    m[0], m[4], m[8], m[12],
    -m[2], -m[6], -m[10], -m[14],
    m[1], m[5], m[9], m[13],
  ];
}

/** Exact bounds of a model's vertices at a placement. */
export function placedBounds(position, rows) {
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let index = 0; index < position.length; index += 3) {
    const x = position[index];
    const y = position[index + 1];
    const z = position[index + 2];
    for (let axis = 0; axis < 3; axis += 1) {
      const r = axis * 4;
      const value = rows[r] * x + rows[r + 1] * y + rows[r + 2] * z + rows[r + 3];
      if (value < bounds[axis]) bounds[axis] = value;
      if (value > bounds[axis + 3]) bounds[axis + 3] = value;
    }
  }
  return bounds;
}

function materialOf(material, options) {
  return material
    ? {
        name: material.getName(),
        baseColor: material.getBaseColorFactor(),
        metallic: material.getMetallicFactor(),
        roughness: material.getRoughnessFactor(),
        emissive: material.getEmissiveFactor(),
      }
    : { baseColor: options.baseColor || [0.55, 0.58, 0.64, 1], metallic: 0.05, roughness: 0.72, emissive: [0, 0, 0] };
}

// FNV-1a over the 32-bit words of a typed array (16-bit index arrays hash per element).
function hashWords(array) {
  const words = array.BYTES_PER_ELEMENT === 4 ? new Uint32Array(array.buffer, array.byteOffset, array.length) : array;
  let hash = 0x811c9dc5;
  for (let index = 0; index < words.length; index += 1) {
    hash ^= words[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function sameModel(primitive, position, normal, netId, objectFeatureId, indices) {
  const same = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
  return same(primitive.position, position) && same(primitive.normal, normal) && same(primitive.netId, netId)
    && same(primitive.objectFeatureId, objectFeatureId) && same(primitive.indices, indices);
}
