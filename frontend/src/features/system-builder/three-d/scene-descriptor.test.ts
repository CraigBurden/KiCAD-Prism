import { describe, expect, it } from "vitest";

import type { SystemBundle, SystemDocument } from "../model/types";
import { buildSceneDescriptor, memberKey, sceneMembers } from "./scene-descriptor";

const COMMIT = "c".repeat(40);
const board = (id: string, label: string, projectId: string) => ({
  id, label, source: { kind: "board" as const, projectId, track: { kind: "pinned" as const, commit: COMMIT } },
});
const DOCUMENT = {
  schema: "prism.system.v2",
  name: "Stack",
  sheets: [],
  occurrences: [
    board("occ_carrier", "Carrier", "prj_carrier"),
    board("occ_som", "SoM", "prj_som"),
    board("occ_twin", "SoM 2", "prj_som"),
    { id: "occ_hidden", label: "Hidden", source: { kind: "redacted" } },
  ],
  subPorts: [],
  dismissedSuggestions: [],
  bodyConnectors: [],
  mates: [{ id: "mate_1", a: { occurrence: "occ_carrier", connector: "J202" }, b: { occurrence: "occ_som", connector: "J1" }, orientation: { quarterTurns: 0, flip: false }, rows: {} }],
  harnesses: [],
  exports: [],
  waivers: [],
  layout: {},
} as unknown as SystemDocument;

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const at = (xNm: number, zNm = 0) => ({ translation: { xNm, yNm: 0, zNm }, rotation: IDENTITY });
// The carrier's J202 faces up; its frame turned so its +z is world +z.
const BUNDLE = {
  placement: {
    occurrences: [
      { occurrence: "occ_carrier", pose: at(0), source: "default", root: true,
        bounds: { min: { xNm: -50e6, yNm: -40e6, zNm: -0.8e6 }, max: { xNm: 50e6, yNm: 40e6, zNm: 0.8e6 } } },
      { occurrence: "occ_som", pose: at(10e6, 5e6), source: "mate", root: false, positioningMate: "mate_1" },
      { occurrence: "occ_twin", pose: at(150e6), source: "default", root: true },
      { occurrence: "occ_hidden", pose: at(300e6), source: "default", root: true },
    ],
    mates: [{ mate: "mate_1", driving: true, frameA: at(10e6, 0.8e6), frameB: { translation: { xNm: 10e6, yNm: 0, zNm: 5e6 }, rotation: { x: 1, y: 0, z: 0, w: 0 } } }],
  },
} as unknown as SystemBundle;

describe("buildSceneDescriptor", () => {
  const assets = new Map([
    [memberKey("prj_carrier", COMMIT), { status: "ready" as const, bundleUrl: "https://prism/carrier/bundle.json" }],
    [memberKey("prj_som", COMMIT), { status: "building" as const, bundleUrl: null }],
  ]);
  const scene = buildSceneDescriptor(DOCUMENT, BUNDLE, assets);
  const byPath = new Map(scene.occurrences.map((item) => [item.path, item]));

  it("places each occurrence at its bundle pose in millimetres", () => {
    expect(byPath.get("occ_som")!.pose).toEqual({ translationMm: [10, 0, 5], rotation: [0, 0, 0, 1], source: "auto" });
    expect(byPath.get("occ_som")!.worldMatrix.slice(12)).toEqual([10, 0, 5, 1]);
    expect(byPath.get("occ_carrier")!.boundsMm).toEqual({ minMm: [-50, -40, -0.8], maxMm: [50, 40, 0.8] });
  });

  it("gives every board occurrence its own asset, sharing the member's bundle", () => {
    expect(byPath.get("occ_som")!.assetId).not.toEqual(byPath.get("occ_twin")!.assetId);
    const assetOf = (path: string) => scene.assets.find((asset) => asset.assetId === byPath.get(path)!.assetId)!;
    expect(assetOf("occ_carrier")).toMatchObject({ status: "ready", bundleUrl: "https://prism/carrier/bundle.json", bundleToBoard: null });
    expect(assetOf("occ_twin")).toMatchObject({ status: "building", bundleUrl: null });
  });

  it("lets the gizmo move only roots and free boards", () => {
    expect(byPath.get("occ_carrier")!.movable).toBe(true);
    expect(byPath.get("occ_som")!.movable).toBe(false);
    expect([byPath.get("occ_carrier")!.pose.source, byPath.get("occ_som")!.pose.source]).toEqual(["default", "auto"]);
  });

  it("explodes a mated board along its parent connector's axis", () => {
    expect(byPath.get("occ_carrier")!.explode).toBeNull();
    expect(byPath.get("occ_som")!.explode).toEqual({ axis: [0, 0, 1], depth: 1 });
  });

  it("marks a board the reader cannot see as restricted, with no asset", () => {
    expect(byPath.get("occ_hidden")).toMatchObject({ restricted: true, assetId: null });
  });

  it("draws nothing before the bundle has placed the boards", () => {
    expect(buildSceneDescriptor(DOCUMENT, null, assets).occurrences).toEqual([]);
  });
});

describe("sceneMembers", () => {
  it("lists each project and commit once", () => {
    expect(sceneMembers(DOCUMENT).map((item) => item.key)).toEqual([memberKey("prj_carrier", COMMIT), memberKey("prj_som", COMMIT)]);
  });
});
