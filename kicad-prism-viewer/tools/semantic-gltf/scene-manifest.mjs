// The scene manifest: the one place that decides what the viewer reads.
//
// Two producers feed it. The Python lane hands over a semantic input document
// (pipeline/topology_compiler/semantic_gltf.py) whose records already use the
// viewer's field names; the Rust lane hands over prism.semantic_mesh_pack.v1
// (native/prism-kicad-native/src/mesh_pack.rs), whose layers are adapted here.
// Every manifest is checked against scene-manifest.schema.json, plus the
// cross-references a schema cannot express, before it is written.

import fs from "node:fs";

export const SCENE_MANIFEST_SCHEMA = "prism.semantic_gltf_a0";
export const MESH_PACK_SCHEMA = "prism.semantic_mesh_pack.v1";

const SCHEMA = JSON.parse(fs.readFileSync(new URL("./scene-manifest.schema.json", import.meta.url), "utf8"));

const ANALYSIS = {
  featureKey: "objectFeatureId",
  netKey: "netId",
  resultBinding: "geometryRevision + objectFeatureId",
};

function copperLayerIds(layers) {
  return layers
    .filter((layer) => layer.role === "copper" || String(layer.name || "").endsWith(".Cu"))
    .map((layer) => Number(layer.id));
}

/** The manifest for a Python semantic input; tiles are added with addTiles. */
export function manifestFromSemanticInput(input, { tileSize, clipper, bbox }) {
  const layers = input.layers || [];
  return {
    schema: SCENE_MANIFEST_SCHEMA,
    version: 0,
    tileSizeMm: tileSize,
    geometryRevision: input.geometryRevision,
    coordinateSystem: input.coordinateSystem,
    layers,
    nets: input.nets || [],
    objectFeatures: input.objectFeatures || [],
    components: input.components || [],
    barrels: input.barrels || [],
    geometryCompiler: input.geometryCompiler || null,
    clipper,
    copperLayerIds: copperLayerIds(layers),
    bbox,
    tiles: [],
    netToTiles: {},
    analysis: { ...ANALYSIS },
  };
}

/** A Rust mesh-pack layer in the viewer's field names. */
function layerFromMeshPack(layer) {
  return {
    uid: layer.uid,
    name: layer.name,
    role: layer.role,
    z_mm: layer.zMm,
    thickness_mm: layer.thicknessMm,
    material: layer.material,
    color: layer.color,
    visibility_group: layer.visibilityGroup,
    stack_index: layer.stackIndex,
    epsilon_r: layer.epsilonR ?? null,
    loss_tangent: layer.lossTangent ?? null,
    id: layer.id,
  };
}

/** The manifest for a Rust mesh pack; tiles are added with addTiles. */
export function manifestFromMeshPack(pack, { tileSize, meshoptLevel }) {
  if (pack.schema !== MESH_PACK_SCHEMA) throw new Error(`expected ${MESH_PACK_SCHEMA}, got ${pack.schema}`);
  const layers = (pack.layers || []).map(layerFromMeshPack);
  return {
    schema: SCENE_MANIFEST_SCHEMA,
    version: 0,
    tileSizeMm: tileSize,
    geometryRevision: pack.geometryRevision,
    coordinateSystem: pack.coordinateSystem,
    layers,
    nets: pack.nets || [],
    objectFeatures: pack.objectFeatures || [],
    components: [],
    barrels: pack.barrels || [],
    geometryCompiler: {
      compilerVersion: "prism-native-semantic-pack-v1",
      sourceGeometryRevision: pack.sourceGeometryRevision,
      analyticContractRevision: pack.analyticContractRevision,
      kicadMonkeyRevision: pack.kicadMonkeyRevision,
      meshoptLevel,
    },
    clipper: {
      protocolVersion: 1,
      requested: "native-packed",
      backend: "native-analytic",
      native: null,
      stats: {
        direct_operations: Number(pack.metrics?.directOperations || 0),
        native_boolean_jobs: Number(pack.metrics?.geometerOperations || 0),
      },
    },
    nativeMeshPack: {
      schema: pack.schema,
      sourceDigest: pack.sourceDigest,
      metrics: pack.metrics || {},
    },
    copperLayerIds: copperLayerIds(layers),
    bbox: pack.bbox,
    tiles: [],
    netToTiles: {},
    analysis: { ...ANALYSIS },
  };
}

/**
 * The face each packed tile is drawn by, from its layer's surfaceSign (the
 * stackup frame decides it; see stackup_frame.rs).
 */
export function meshPackTileSurfaceSign(pack, tile) {
  const layer = (pack.layers || []).find((item) => Number(item.id) === Number(tile.layerId));
  if (!layer) throw new Error(`mesh pack tile ${tile.id} names unknown layer ${tile.layerId}`);
  if (layer.surfaceSign !== 1 && layer.surfaceSign !== -1) {
    throw new Error(`mesh pack layer ${layer.name} has no surfaceSign; rebuild prism-kicad-native`);
  }
  return layer.surfaceSign;
}

/** Add built tile records (in order) and index them by net. */
export function addTiles(manifest, tiles) {
  for (const tile of tiles) {
    manifest.tiles.push(tile);
    for (const netId of tile.netIds) {
      if (!netId) continue;
      (manifest.netToTiles[String(netId)] ||= []).push(tile.id);
    }
  }
  return manifest;
}

const TYPE_CHECKS = {
  object: (value) => value !== null && typeof value === "object" && !Array.isArray(value),
  array: Array.isArray,
  number: (value) => typeof value === "number" && Number.isFinite(value),
  integer: (value) => Number.isInteger(value),
  string: (value) => typeof value === "string",
  boolean: (value) => typeof value === "boolean",
  null: (value) => value === null,
};

function resolve(schema) {
  if (!schema.$ref) return schema;
  const name = schema.$ref.replace(/^#\/\$defs\//, "");
  const target = SCHEMA.$defs[name];
  if (!target) throw new Error(`scene manifest schema has no $defs/${name}`);
  return target;
}

// The subset of JSON Schema the manifest schema uses. A number must be finite:
// JSON cannot carry NaN, so a NaN here would reach the viewer as null.
function check(value, rawSchema, where, problems) {
  if (problems.length >= 20) return;
  const schema = resolve(rawSchema);
  if ("const" in schema && value !== schema.const) {
    problems.push(`${where}: expected ${JSON.stringify(schema.const)}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    problems.push(`${where}: ${JSON.stringify(value)} is not one of ${schema.enum.join(", ")}`);
    return;
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => TYPE_CHECKS[type](value))) {
      problems.push(`${where}: expected ${types.join(" or ")}, got ${value === null ? "null" : typeof value === "number" ? value : typeof value}`);
      return;
    }
  }
  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) problems.push(`${where}: ${value} < ${schema.minimum}`);
    if (schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum) problems.push(`${where}: ${value} <= ${schema.exclusiveMinimum}`);
  }
  if (typeof value === "string" && schema.minLength != null && value.length < schema.minLength) {
    problems.push(`${where}: shorter than ${schema.minLength}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) problems.push(`${where}: fewer than ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) problems.push(`${where}: more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, index) => check(item, schema.items, `${where}[${index}]`, problems));
  } else if (TYPE_CHECKS.object(value)) {
    for (const key of schema.required || []) {
      if (!(key in value)) problems.push(`${where}: missing ${key}`);
    }
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (key in value) check(value[key], child, `${where}.${key}`, problems);
    }
    if (TYPE_CHECKS.object(schema.additionalProperties)) {
      for (const [key, child] of Object.entries(value)) {
        if (!schema.properties || !(key in schema.properties)) {
          check(child, schema.additionalProperties, `${where}.${key}`, problems);
        }
      }
    }
  }
}

/** The manifest's problems: schema violations, then broken cross-references. */
export function sceneManifestProblems(manifest) {
  const problems = [];
  check(manifest, SCHEMA, "manifest", problems);
  if (problems.length) return problems;
  const layerIds = new Set(manifest.layers.map((layer) => layer.id));
  const netIds = new Set(manifest.nets.map((net) => net.id));
  const featureCount = manifest.objectFeatures.length;
  if (manifest.nets[0].id !== 0) problems.push("nets[0]: the null net must come first");
  manifest.objectFeatures.forEach((feature, index) => {
    if (feature.id !== index) problems.push(`objectFeatures[${index}]: id ${feature.id} is not its index`);
    if (!netIds.has(feature.netId)) problems.push(`objectFeatures[${index}]: unknown net ${feature.netId}`);
  });
  manifest.barrels.forEach((barrel, index) => {
    for (const key of ["startLayerId", "endLayerId"]) {
      if (!layerIds.has(barrel[key])) problems.push(`barrels[${index}].${key}: unknown layer ${barrel[key]}`);
    }
    if (barrel.objectFeatureId >= featureCount) problems.push(`barrels[${index}]: unknown feature ${barrel.objectFeatureId}`);
    if (!netIds.has(barrel.netId)) problems.push(`barrels[${index}]: unknown net ${barrel.netId}`);
  });
  manifest.tiles.forEach((tile, index) => {
    if (!layerIds.has(tile.layerId)) problems.push(`tiles[${index}]: unknown layer ${tile.layerId}`);
    for (const netId of tile.netIds) {
      if (!netIds.has(netId)) problems.push(`tiles[${index}]: unknown net ${netId}`);
    }
  });
  for (const id of manifest.copperLayerIds) {
    if (!layerIds.has(id)) problems.push(`copperLayerIds: unknown layer ${id}`);
  }
  return problems.slice(0, 20);
}

/** Throw unless the manifest is one the viewer can read. */
export function validateSceneManifest(manifest) {
  const problems = sceneManifestProblems(manifest);
  if (problems.length) {
    throw new Error(`invalid scene manifest:\n  ${problems.join("\n  ")}`);
  }
  return manifest;
}
