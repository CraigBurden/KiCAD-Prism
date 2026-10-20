import { describe, expect, it } from "vitest";

import type { SystemBundle, SystemDocument } from "../model/types";
import { addEntryOps } from "./body-edits";
import { entryPartRefs, frozenPartRef, type EntryContents } from "./entry-contents";
import { buildSceneDescriptor, sceneMembers } from "./scene-descriptor";

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const at = (xNm: number) => ({ translation: { xNm, yNm: 0, zNm: 0 }, rotation: IDENTITY });

const CHILD: EntryContents = {
  document: {
    occurrences: [
      { id: "occ_card", label: "Card", source: { kind: "board", projectId: "prj_card", track: { kind: "pinned", commit: "c0ffee" } } },
      { id: "occ_box", label: "Box", source: { kind: "body", componentId: "cmp_box", revisionId: "rev_b1" } },
      { id: "occ_hidden", label: "Hidden", source: { kind: "redacted" } },
    ],
    bodyConnectors: [{ id: "bc_1", occurrence: "occ_box", refdes: "J1", part: { componentId: "cmp_hdr" }, frame: at(0), quarterTurns: 0 }],
    mates: [],
  } as unknown as SystemDocument,
  bundle: {
    placement: {
      occurrences: [
        { occurrence: "occ_card", pose: at(5_000_000), source: "stored", root: true, bounds: { min: { xNm: 0, yNm: 0, zNm: -800_000 }, max: { xNm: 60_000_000, yNm: 30_000_000, zNm: 800_000 } } },
        { occurrence: "occ_box", pose: at(80_000_000), source: "default", root: true },
        { occurrence: "occ_hidden", pose: at(0), source: "default", root: true },
      ],
      mates: [],
    },
  } as unknown as SystemBundle,
  parts: { parts: [{ ref: "cmp_box@rev_b1", componentId: "cmp_box", revisionId: "rev_b1" }, { ref: "cmp_hdr", componentId: "cmp_hdr", revisionId: "rev_h7" }] },
};

const PARENT = {
  occurrences: [{ id: "occ_unit", label: "Unit", source: { kind: "entry", componentId: "cmp_unit", revisionId: "rev_u1" } }],
  bodyConnectors: [],
  mates: [],
} as unknown as SystemDocument;
const PARENT_BUNDLE = {
  placement: { occurrences: [{ occurrence: "occ_unit", pose: at(100_000_000), source: "default", root: true, bounds: { min: { xNm: 0, yNm: 0, zNm: 0 }, max: { xNm: 1, yNm: 1, zNm: 1 } } }], mates: [] },
} as unknown as SystemBundle;

describe("placed entries", () => {
  it("pins an entry's parts to the revisions its child was built from", () => {
    expect(frozenPartRef(CHILD, { componentId: "cmp_hdr" })).toEqual({ componentId: "cmp_hdr", revisionId: "rev_h7" });
    expect(entryPartRefs(CHILD)).toEqual([{ componentId: "cmp_box", revisionId: "rev_b1" }, { componentId: "cmp_hdr", revisionId: "rev_h7" }]);
  });

  it("asks for the entry's boards' 3D bundles too", () => {
    expect(sceneMembers(PARENT, new Map([["occ_unit", CHILD]])).map((member) => member.key)).toEqual(["prj_card@c0ffee"]);
  });

  it("draws an entry as a box until its contents load", () => {
    const scene = buildSceneDescriptor(PARENT, PARENT_BUNDLE, new Map(), new Map(), new Map([["occ_unit", null]]));
    expect(scene.occurrences).toHaveLength(1);
    expect(scene.occurrences[0]).toMatchObject({ path: "occ_unit", kind: "entry", movable: true });
    expect(scene.occurrences[0].group).toBeUndefined();
  });

  it("draws an entry's contents as its children where the child placed them", () => {
    const models = new Map([["cmp_hdr@rev_h7", { glbKey: "hdr", matrixMm: [], boundsMm: { minMm: [0, 0, 0] as [number, number, number], maxMm: [1, 1, 1] as [number, number, number] } }]]);
    const scene = buildSceneDescriptor(PARENT, PARENT_BUNDLE, new Map(), models, new Map([["occ_unit", CHILD]]));
    const byPath = new Map(scene.occurrences.map((item) => [item.path, item]));
    expect(byPath.get("occ_unit")).toMatchObject({ kind: "entry", group: true });
    const card = byPath.get("occ_unit/occ_card")!;
    expect(card).toMatchObject({ kind: "board", parent: "occ_unit", movable: false, assetId: "occurrence:occ_unit/occ_card" });
    expect(card.localMatrix?.slice(12, 15)).toEqual([5, 0, 0]);
    expect(byPath.get("occ_unit/occ_box")).toMatchObject({ kind: "body", parent: "occ_unit" });
    expect(byPath.get("occ_unit/occ_box/J1")).toMatchObject({ kind: "part", parent: "occ_unit/occ_box", model: { glbKey: "hdr" } });
    // A board hidden from the reader draws nothing.
    expect(byPath.has("occ_unit/occ_hidden")).toBe(false);
    expect(scene.assets.map((asset) => asset.assetId)).toEqual(["occurrence:occ_unit/occ_card"]);
  });

  it("places a published system as an entry at its revision", () => {
    const { ops, occurrence } = addEntryOps(PARENT, { componentId: "cmp_unit", revisionId: "rev_u2", name: "Unit" });
    expect(ops[0]).toMatchObject({ kind: "add-occurrence", occurrence: { id: occurrence, label: "Unit 2", source: { kind: "entry", componentId: "cmp_unit", revisionId: "rev_u2" } } });
  });
});
