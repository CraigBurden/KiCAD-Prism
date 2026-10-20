import { describe, expect, it } from "vitest";

import type { SystemDocument } from "../model/types";
import { matesOf, poseOps, positioningMateOps, storedPose } from "./pose-edits";

const COMMIT = "a".repeat(40);
const source = { kind: "board" as const, projectId: "prj_1", track: { kind: "pinned" as const, commit: COMMIT } };
const DOCUMENT = {
  occurrences: [
    { id: "occ_a", label: "A", source, pose: { translation: { xNm: 1, yNm: 2, zNm: 3 }, rotation: { x: 0, y: 0, z: 0, w: 1 } } },
    { id: "occ_b", label: "B", source, positioningMate: "mate_1" },
  ],
  mates: [
    { id: "mate_1", a: { occurrence: "occ_a", connector: "J1" }, b: { occurrence: "occ_b", connector: "J2" } },
    { id: "mate_2", a: { occurrence: "occ_c", connector: "J1" }, b: { occurrence: "occ_d", connector: "J2" } },
  ],
} as unknown as SystemDocument;

describe("pose edits", () => {
  it("stores whole nanometres and a canonical rotation", () => {
    expect(storedPose({ translationMm: [1.2345678, -2, 0], rotation: [0, 0, -1, 0] })).toEqual({
      translation: { xNm: 1_234_568, yNm: -2_000_000, zNm: 0 },
      rotation: { x: 0, y: 0, z: 1, w: 0 },
    });
  });

  it("replaces the occurrence with its new pose, keeping the rest", () => {
    const [op] = poseOps(DOCUMENT, "occ_a", { translationMm: [10, 0, 0], rotation: [0, 0, 0, 1] });
    expect(op).toEqual({
      kind: "replace-occurrence",
      occurrence: { id: "occ_a", label: "A", source, pose: { translation: { xNm: 10_000_000, yNm: 0, zNm: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } } },
    });
  });

  it("drops the pose to send a board back to its default slot", () => {
    const [op] = poseOps(DOCUMENT, "occ_a", null);
    expect(op).toEqual({ kind: "replace-occurrence", occurrence: { id: "occ_a", label: "A", source } });
  });

  it("sets and clears the positioning mate", () => {
    expect(positioningMateOps(DOCUMENT, "occ_a", "mate_1")[0]).toMatchObject({ occurrence: { id: "occ_a", positioningMate: "mate_1" } });
    expect(positioningMateOps(DOCUMENT, "occ_b", null)[0]).toEqual({ kind: "replace-occurrence", occurrence: { id: "occ_b", label: "B", source } });
  });

  it("lists the mates with an end on an occurrence", () => {
    expect(matesOf(DOCUMENT, "occ_b").map((mate) => mate.id)).toEqual(["mate_1"]);
  });

  it("refuses an unknown occurrence", () => {
    expect(() => poseOps(DOCUMENT, "occ_x", null)).toThrow("No occurrence occ_x");
  });
});
