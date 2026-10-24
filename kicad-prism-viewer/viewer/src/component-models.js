// Component models into draws (SB2-86). Instancing pays only for models placed
// several times; a part placed once or twice is cheaper baked into the board
// frame and merged by material, as before. Instanced models that share every
// placement (the primitives of one part model, one per material) merge into one
// draw per material, so a board keeps to a few hundred draws.

import { mergePrimitivesByMaterial } from "./bundle-geometry.js";

export const MIN_INSTANCES = 4;

/**
 * Split `loadGltfModels` models into instanced draws `{primitive, placements}`
 * and baked primitives (board frame, merged by material).
 */
export function componentDraws(models, minInstances = MIN_INSTANCES) {
  const groups = new Map();
  const baked = [];
  for (const model of models) {
    if (model.placements.length < minInstances) {
      for (const placement of model.placements) baked.push(bake(model.primitive, placement));
      continue;
    }
    const key = `${model.placements.map((placement) => placement.node).join(",")}|${JSON.stringify(model.primitive.material)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(model);
  }
  const instanced = [...groups.values()].map((group) => ({
    primitive: concatenate(group.map((model) => model.primitive)),
    placements: group[0].placements,
  }));
  return { instanced, baked: mergePrimitivesByMaterial(baked) };
}

/** A model at one placement, in the board frame, as the flattening loader produced it. */
export function bake(primitive, placement) {
  const { rows, featureId, bounds } = placement;
  const count = primitive.position.length / 3;
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const objectFeatureId = new Uint32Array(count);
  for (let index = 0; index < count; index += 1) {
    const at = index * 3;
    const [x, y, z] = [primitive.position[at], primitive.position[at + 1], primitive.position[at + 2]];
    const [nx, ny, nz] = [primitive.normal[at], primitive.normal[at + 1], primitive.normal[at + 2]];
    let size = 0;
    for (let axis = 0; axis < 3; axis += 1) {
      const r = axis * 4;
      position[at + axis] = rows[r] * x + rows[r + 1] * y + rows[r + 2] * z + rows[r + 3];
      normal[at + axis] = rows[r] * nx + rows[r + 1] * ny + rows[r + 2] * nz;
      size += normal[at + axis] ** 2;
    }
    size = Math.sqrt(size) || 1;
    for (let axis = 0; axis < 3; axis += 1) normal[at + axis] /= size;
    objectFeatureId[index] = primitive.objectFeatureId[index] || featureId || 0;
  }
  return {
    position,
    normal,
    netId: primitive.netId,
    objectFeatureId,
    indices: primitive.indices,
    material: primitive.material,
    bounds: [...bounds],
  };
}

/** Primitives drawn at the same placements, as one. */
function concatenate(primitives) {
  if (primitives.length === 1) return primitives[0];
  const vertexCount = primitives.reduce((sum, item) => sum + item.position.length / 3, 0);
  const indexCount = primitives.reduce((sum, item) => sum + item.indices.length, 0);
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const netId = new Uint32Array(vertexCount);
  const objectFeatureId = new Uint32Array(vertexCount);
  const indices = new Uint32Array(indexCount);
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const item of primitives) {
    position.set(item.position, vertexOffset * 3);
    normal.set(item.normal, vertexOffset * 3);
    netId.set(item.netId, vertexOffset);
    objectFeatureId.set(item.objectFeatureId, vertexOffset);
    for (let index = 0; index < item.indices.length; index += 1) indices[indexOffset + index] = item.indices[index] + vertexOffset;
    for (let axis = 0; axis < 3; axis += 1) {
      bounds[axis] = Math.min(bounds[axis], item.bounds[axis]);
      bounds[axis + 3] = Math.max(bounds[axis + 3], item.bounds[axis + 3]);
    }
    vertexOffset += item.position.length / 3;
    indexOffset += item.indices.length;
  }
  return { position, normal, netId, objectFeatureId, indices, material: primitives[0].material, bounds };
}
