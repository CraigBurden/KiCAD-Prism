import { describe, expect, it } from "vitest";

import type { SystemBundle, SystemDocument } from "../model/types";
import { matrix, rotate } from "../placement/poses";
import { addBodyConnectorOps, addBodyOps, bodyLabel, faceFramePose, nextRefdes } from "./body-edits";
import type { CatalogComponent } from "@/types/catalog";

import { alignmentMatrix, partModel, transformedBounds } from "./part-models";
import { partHit } from "./part-search";
import { bodyConnectorFrame, buildSceneDescriptor } from "./scene-descriptor";

const round = (values: readonly number[]) => values.map((value) => Math.round(value * 1e6) / 1e6 + 0);

const frame = { translation: { xNm: 30_000_000, yNm: 0, zNm: 7_500_000 }, rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 } };
const DOCUMENT = {
  occurrences: [{ id: "occ_box", label: "Fan 4010", source: { kind: "body", componentId: "cmp_fan", revisionId: "rev_2" } }],
  bodyConnectors: [{ id: "bc_1", occurrence: "occ_box", refdes: "J1", part: { componentId: "cmp_phr4" }, frame, quarterTurns: 1 }],
  mates: [],
} as unknown as SystemDocument;
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const BUNDLE = {
  placement: {
    occurrences: [{ occurrence: "occ_box", pose: { translation: { xNm: 100_000_000, yNm: 0, zNm: 0 }, rotation: IDENTITY }, source: "default", root: true }],
    mates: [],
  },
} as unknown as SystemBundle;

describe("part models", () => {
  it("aligns a model like the backend: rotate, then offset", () => {
    const m = alignmentMatrix({ offsetMm: [1, 2, 3], rotationDeg: [0, 0, 90], scale: 1 });
    expect(round(m)).toEqual([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]);
    // A quarter turn about z swaps the box's x and y extents.
    const box = transformedBounds(m, { minMm: [0, 0, 0], maxMm: [10, 4, 2] });
    expect([round(box.minMm), round(box.maxMm)]).toEqual([[-3, 2, 3], [1, 12, 5]]);
  });

  it("takes the first converted model, else none", () => {
    expect(partModel([])).toBeNull();
    expect(partModel([{ glb: null, alignment: { offsetMm: [0, 0, 0], rotationDeg: [0, 0, 0], scale: 1 } }])).toBeNull();
    expect(partModel([{ glb: { key: "k", bounds: { minMm: [0, 0, 0], maxMm: [1, 1, 1] } }, alignment: { offsetMm: [0, 0, 0], rotationDeg: [0, 0, 0], scale: 1 } }]))
      .toMatchObject({ glbKey: "k", boundsMm: { minMm: [0, 0, 0], maxMm: [1, 1, 1] } });
  });
});

describe("part search", () => {
  it("names a hit by its value, not its catalog name (the MPN)", () => {
    const hit = partHit({ id: "cmp_hdr", revision_id: "rev_1", name: "HDR-1X04-254", value: "Header 1x04", mpn: "HDR-1X04-254", missing_assets: [] } as unknown as CatalogComponent);
    expect(hit).toMatchObject({ componentId: "cmp_hdr", revisionId: "rev_1", name: "Header 1x04", mpn: "HDR-1X04-254", noModel: false });
  });
});

describe("scene descriptor bodies", () => {
  const models = new Map([
    ["cmp_fan@rev_2", { glbKey: "fan", matrixMm: alignmentMatrix(), boundsMm: { minMm: [-20, -20, 0] as [number, number, number], maxMm: [20, 20, 10] as [number, number, number] } }],
    ["cmp_phr4", null],
  ]);
  const scene = buildSceneDescriptor(DOCUMENT, BUNDLE, new Map(), models);

  it("draws a body's model and lets its faces be picked", () => {
    const body = scene.occurrences.find((item) => item.path === "occ_box")!;
    expect(body).toMatchObject({ kind: "body", pickSurface: true, movable: true, model: { glbKey: "fan" }, assetId: null });
    expect(scene.assets).toEqual([]);
  });

  it("draws each body connector as a child at its turned mating frame", () => {
    const part = scene.occurrences.find((item) => item.path === "occ_box/J1")!;
    expect(part).toMatchObject({ kind: "part", parent: "occ_box", movable: false, model: null });
    expect(part.localMatrix).toEqual(matrix(bodyConnectorFrame(DOCUMENT.bodyConnectors[0])));
    // The stored frame's +z (the face normal) is kept; a quarter turn turns x about it.
    const turned = bodyConnectorFrame(DOCUMENT.bodyConnectors[0]);
    expect(round(rotate(turned.rotation, [0, 0, 1]))).toEqual(round(rotate([0, Math.SQRT1_2, 0, Math.SQRT1_2], [0, 0, 1])));
    expect(round(turned.translationMm)).toEqual([30, 0, 7.5]);
  });
});

describe("body edits", () => {
  it("adds a body pinned at its revision with a unique label", () => {
    const { ops, occurrence } = addBodyOps(DOCUMENT, { componentId: "cmp_fan", revisionId: "rev_2", name: "Fan 4010" });
    expect(ops[0]).toMatchObject({ kind: "add-occurrence", occurrence: { id: occurrence, label: "Fan 4010 2", source: { kind: "body", componentId: "cmp_fan", revisionId: "rev_2" } } });
    expect(bodyLabel(DOCUMENT, "  ")).toBe("Body");
  });

  it("names the next connector and refuses a taken one", () => {
    expect(nextRefdes(DOCUMENT, "occ_box")).toBe("J2");
    const part = { componentId: "cmp_phr4", revisionId: "rev_1", name: "PHR-4" };
    expect(() => addBodyConnectorOps(DOCUMENT, { body: "occ_box", refdes: "J1", part, frame: { translationMm: [0, 0, 0], rotation: [0, 0, 0, 1] }, quarterTurns: 0 })).toThrow(/already/);
    const [op] = addBodyConnectorOps(DOCUMENT, { body: "occ_box", refdes: "J2", part, frame: { translationMm: [1.5, 0, 10], rotation: [0, 0, 0, 1] }, quarterTurns: 5 });
    expect(op).toMatchObject({
      kind: "add-body-connector",
      bodyConnector: { occurrence: "occ_box", refdes: "J2", part: { componentId: "cmp_phr4", revisionId: "rev_1" }, quarterTurns: 1, frame: { translation: { xNm: 1_500_000, yNm: 0, zNm: 10_000_000 } } },
    });
  });

  it("carries a face pick into the body's frame, +z along the outward normal", () => {
    // The body sits at x = 100, turned a quarter about z; the pick is on its top face.
    const bodyPose = { translationMm: [100, 0, 0] as [number, number, number], rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] as [number, number, number, number] };
    const pose = faceFramePose(bodyPose, [100, 5, 10], [0, 0, 1]);
    expect(round(pose.translationMm)).toEqual([5, 0, 10]);
    expect(round(rotate(pose.rotation, [0, 0, 1]))).toEqual([0, 0, 1]);
    // A side face: the body's local +x face.
    const side = faceFramePose({ translationMm: [0, 0, 0], rotation: [0, 0, 0, 1] }, [20, 3, 5], [1, 0, 0]);
    expect(round(rotate(side.rotation, [0, 0, 1]))).toEqual([1, 0, 0]);
    expect(round(side.translationMm)).toEqual([20, 3, 5]);
  });
});
