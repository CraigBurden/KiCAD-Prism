import { describe, expect, it } from "vitest";

import type { SystemBundle, SystemDocument } from "../model/types";
import { boxWires, interiorDrag } from "./board-gestures";
import { buildBoardScene } from "./board-scene";

const DOCUMENT = {
  occurrences: [{ id: "occ_c", label: "C", source: { kind: "board", projectId: "prj_000000000001", track: { kind: "pinned", commit: "e".repeat(40) } } }],
  subPorts: [],
  layout: {},
} as unknown as SystemDocument;
const pin = (pad: string, net: string) => ({ pad, net, nets: [net], power: false });
const BUNDLE = {
  occurrences: [{
    occurrence: "occ_c", state: "ready",
    connectors: [{ refdes: "J1", value: "", candidate: true, placement: { angleDeg: 180, side: "top" }, pins: [pin("1", "A"), pin("2", "B"), pin("3", "C")] }],
  }],
  suggestions: [],
} as unknown as SystemBundle;

describe("boxWires", () => {
  const scene = buildBoardScene(DOCUMENT, BUNDLE, "occ_c", { unfolded: new Set(["J1"]) })!;
  const [w1, w2] = scene.connectors[0].wires;

  it("takes only enclosed wires with a window and touched ones with a crossing", () => {
    // A box round wire 2's far half: it encloses nothing and touches wire 2 only.
    const box = { x: w2.end.x, y: w2.end.y - 500_000, w: (w2.start.x - w2.end.x) / 2, h: 1_000_000 };
    expect([...boxWires(scene, box, "window")]).toEqual([]);
    expect([...boxWires(scene, box, "crossing")]).toEqual(["J1\u00002"]);
    const all = { x: w1.end.x - 1, y: w1.tap.y - 1_000_000, w: w1.tap.x - w1.end.x + 2, h: 20_000_000 };
    expect([...boxWires(scene, all, "window")].sort()).toEqual(["J1\u00001", "J1\u00002", "J1\u00003"]);
  });
});

describe("interiorDrag", () => {
  const scene = buildBoardScene(DOCUMENT, BUNDLE, "occ_c")!;

  it("moves the board symbol by a snapped delta", () => {
    const next = interiorDrag({ kind: "symbol", start: { x: 0, y: 0 }, active: true, screen: { x: 0, y: 0 } }, { x: 2_000_000, y: 0 }, scene, {});
    expect(next?.symbol).toMatchObject({ xNm: 2_540_000, yNm: 0, widthNm: scene.symbol.w });
  });

  it("slides a pin onto the nearest edge and moves a label onto the grid", () => {
    const pinned = interiorDrag({ kind: "pin", refdes: "J1", active: true, screen: { x: 0, y: 0 } }, { x: 20_000_000, y: -1_000_000 }, scene, {});
    expect(pinned?.pins?.J1).toEqual({ edge: "top", offsetNm: 20_320_000 });
    const labelled = interiorDrag({ kind: "label", refdes: "J1", active: true, screen: { x: 0, y: 0 } }, { x: -30_000_000, y: 5_100_000 }, scene, {});
    expect(labelled?.labels?.J1).toEqual({ xNm: -30_480_000, yNm: 5_080_000, rotationDeg: 180 });
  });
});
