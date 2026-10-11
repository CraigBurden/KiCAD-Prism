import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  addTiles,
  manifestFromMeshPack,
  meshPackTileSurfaceSign,
  sceneManifestProblems,
} from "./scene-manifest.mjs";

// Layers and barrels exactly as the Rust lane writes them (mesh_pack.rs tests
// regenerate these), so a renamed or missing Rust field fails here.
const TESTDATA = new URL("../../native/prism-kicad-native/src/testdata/", import.meta.url);
const readGolden = async (name) => JSON.parse(await fs.readFile(new URL(name, TESTDATA), "utf8"));

async function meshPack() {
  const layers = await readGolden("mesh-pack-layers.json");
  const barrels = await readGolden("mesh-pack-barrels.json");
  const copper = layers.filter((layer) => layer.role === "copper");
  const net = (id, name) => ({
    id, uid: name ? `net_${id}` : "", name, netClass: name ? "Default" : "", aliases: [],
    metrics: { traceLengthMm: 0, layers: [], objectCounts: {} }, boundsMm: null, layerBoundsMm: {},
  });
  const feature = (id, kind, layerId) => ({
    id, sourceUid: id ? `feature-${id}` : "", netId: id ? 1 : 0, layerId, layerIds: layerId ? [layerId] : [],
    kind, boundsMm: [0, 0, 0, 0, 0, 0], footprintUid: null, componentRef: null, padNumber: null,
  });
  return {
    schema: "prism.semantic_mesh_pack.v1",
    version: 1,
    geometryRevision: "pack-fixture",
    sourceGeometryRevision: "pack-fixture",
    sourceDigest: "digest",
    kicadMonkeyRevision: "rev",
    analyticContractRevision: "2",
    tileSizeMm: 20,
    meshToleranceMm: 0.005,
    meshoptLevel: "low",
    coordinateSystem: { units: "mm", upAxis: "z", sourceXAxis: "x", sourceYAxis: "-y", sourceToScene: "x,-y,z" },
    board: {},
    layers,
    nets: [net(0, ""), net(1, "GND")],
    objectFeatures: [feature(0, "none", 0), ...[1, 2, 3].map((id) => feature(id, "via", copper[0].id))],
    barrels: barrels.map((barrel) => ({ ...barrel, netId: 1 })),
    bbox: { min: [0, 0, 0], max: [0.001, 0.001, 0.001] },
    tiles: [{
      id: `${copper.at(-1).id}:0:0`, path: "tile.bin", layerId: copper.at(-1).id, layerName: copper.at(-1).name,
      tile: [0, 0], boundsMm: [0, 0, 20, 20], netIds: [1], vertexCount: 3, indexCount: 3, bytes: 0,
    }],
    stats: {},
    diagnostics: [],
    metrics: { directOperations: 1, geometerOperations: 0 },
  };
}

/** One PRSMTL01 tile: a triangle on net 1, feature 1. */
function packedTile() {
  const header = Buffer.alloc(24);
  header.write("PRSMTL01", 0, "ascii");
  header.writeUInt32LE(1, 8);
  header.writeUInt32LE(3, 12);
  header.writeUInt32LE(3, 16);
  const positions = new Float32Array([0, 0, 0, 0.01, 0, 0, 0, 0, 0.01]);
  const ids = new Uint32Array([1, 1, 1]);
  const indices = new Uint32Array([0, 1, 2]);
  return Buffer.concat([header, ...[positions, ids, ids, indices].map((array) => Buffer.from(array.buffer))]);
}

test("a Rust mesh pack and one packed tile become a checked manifest", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "scene-manifest-"));
  const pack = await meshPack();
  await fs.writeFile(path.join(root, "tile.bin"), packedTile());
  await fs.writeFile(path.join(root, "pack.json"), JSON.stringify(pack));
  await run(process.execPath, [
    path.resolve("tools/semantic-gltf/build.mjs"),
    path.join(root, "pack.json"),
    path.join(root, "scene"),
  ], { PRISM_SEMANTIC_GLTF_WORKERS: "1" });
  const manifest = JSON.parse(await fs.readFile(path.join(root, "scene", "scene.manifest.json"), "utf8"));
  assert.deepEqual(sceneManifestProblems(manifest), []);
  // Layers reach the viewer under the names it reads (z_mm, not zMm).
  const fCu = manifest.layers.find((layer) => layer.name === "F.Cu");
  assert.equal(fCu.z_mm, pack.layers.find((layer) => layer.name === "F.Cu").zMm);
  assert.equal(fCu.stack_index, 1);
  assert.deepEqual(manifest.copperLayerIds, pack.layers.filter((layer) => layer.role === "copper").map((layer) => layer.id));
  for (const barrel of manifest.barrels) {
    assert.ok(Number.isFinite(barrel.startZMm) && Number.isFinite(barrel.endZMm), barrel.sourceUid);
  }
  assert.equal(manifest.tiles.length, 1);
  assert.deepEqual(manifest.netToTiles, { 1: [manifest.tiles[0].id] });
  const glb = await fs.readFile(path.join(root, "scene", manifest.tiles[0].path));
  assert.equal(glb.subarray(0, 4).toString("ascii"), "glTF");
});

test("packed tiles are drawn by the face their layer's stackup frame names", async () => {
  const pack = await meshPack();
  const bottom = pack.layers.filter((layer) => layer.role === "copper").at(-1);
  assert.equal(meshPackTileSurfaceSign(pack, { id: "t", layerId: bottom.id }), -1);
  const { surfaceSign, ...unsigned } = bottom;
  assert.equal(surfaceSign, -1);
  assert.throws(
    () => meshPackTileSurfaceSign({ ...pack, layers: [unsigned] }, { id: "t", layerId: bottom.id }),
    /no surfaceSign/,
  );
});

test("a barrel without a finite span is rejected, as the viewer would draw it at NaN", async () => {
  const pack = await meshPack();
  const { startZMm, ...unspanned } = pack.barrels[0];
  const manifest = addTiles(manifestFromMeshPack({ ...pack, barrels: [unspanned, { ...pack.barrels[1], endZMm: NaN }] }, {
    tileSize: 20,
    meshoptLevel: "low",
  }), []);
  const problems = sceneManifestProblems(manifest);
  assert.ok(problems.includes("manifest.barrels[0]: missing startZMm"), problems.join("\n"));
  assert.ok(problems.some((problem) => problem.startsWith("manifest.barrels[1].endZMm: expected number")), problems.join("\n"));
});

test("cross-references are checked: dense features, known layers and nets", async () => {
  const pack = await meshPack();
  const manifest = addTiles(manifestFromMeshPack({
    ...pack,
    objectFeatures: pack.objectFeatures.map((feature) => (feature.id === 2 ? { ...feature, id: 7, netId: 9 } : feature)),
  }, { tileSize: 20, meshoptLevel: "low" }), [
    { id: "99:0:0", path: "a.glb", layerId: 99, tile: [0, 0], boundsMm: [0, 0, 1, 1], netIds: [1, 5], bytes: 1 },
  ]);
  assert.deepEqual(sceneManifestProblems(manifest), [
    "objectFeatures[2]: id 7 is not its index",
    "objectFeatures[2]: unknown net 9",
    "tiles[0]: unknown layer 99",
    "tiles[0]: unknown net 5",
  ]);
});

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: { ...process.env, ...env } });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))));
  });
}
