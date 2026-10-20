import { describe, expect, it } from "vitest";

import type { SystemBundle, SystemDocument } from "../model/types";
import { acceptOps, dismissOps, groupOps, groupRefusal, interiorOps, orderedPads } from "./board-edits";
import { LABEL_DISTANCE_NM, buildBoardScene } from "./board-scene";

const COMMIT = "d".repeat(40);
const DOCUMENT: SystemDocument = {
  schema: "prism.system.v2",
  name: "Stack",
  sheets: [],
  occurrences: [{ id: "occ_c", label: "Carrier", source: { kind: "board", projectId: "prj_000000000001", track: { kind: "pinned", commit: COMMIT } } }],
  subPorts: [{ id: "sub_fan", occurrence: "occ_c", connector: "J2201", name: "FAN", pins: ["3", "4"] }],
  dismissedSuggestions: [],
  bodyConnectors: [],
  mates: [],
  harnesses: [],
  exports: [],
  waivers: [],
  layout: {},
};

const pin = (pad: string, net: string, power = false) => ({ pad, net, nets: [net], power });
const BUNDLE = {
  occurrences: [{
    occurrence: "occ_c",
    state: "ready",
    outline: { widthNm: 100_000_000, heightNm: 100_000_000 },
    connectors: [
      { refdes: "J2201", value: "BM04B", candidate: true, placement: { angleDeg: 180, side: "top" },
        pins: [pin("1", "GND", true), pin("2", "+5V0", true), pin("3", "/SOM/FAN_TACH_3V3"), pin("4", "/SOM/FAN_PWM_3V3"), pin("MP", "GND", true)] },
      { refdes: "J9", value: "X", candidate: true, placement: { angleDeg: 0, side: "bottom" }, pins: [pin("1", "A")] },
    ],
  }],
  suggestions: [{ occurrence: "occ_c", connector: "J2201", key: "power", name: "Power", source: "power", pins: ["1", "2", "MP"] }],
} as unknown as SystemBundle;

describe("buildBoardScene", () => {
  it("draws each connector's bus to its label, named in bus-group form", () => {
    const scene = buildBoardScene(DOCUMENT, BUNDLE, "occ_c")!;
    const j2201 = scene.connectors.find((item) => item.refdes === "J2201")!;
    expect(j2201.edge).toBe("left");
    expect(j2201.label.text).toBe("J2201{FAN{TACH PWM} 1 2 MP}");
    expect(j2201.label.point).toEqual({ x: j2201.pin.x - LABEL_DISTANCE_NM, y: j2201.pin.y });
    expect(j2201.bus).toEqual([j2201.pin, j2201.label.point]);
    expect(j2201.suggestions.map((item) => item.key)).toEqual(["power"]);
    expect(scene.connectors.find((item) => item.refdes === "J9")).toMatchObject({ edge: "right", back: true, label: { text: "J9{1}" } });
  });

  it("breaks an unfolded connector out into one wire per pad with its net and groups", () => {
    const scene = buildBoardScene(DOCUMENT, BUNDLE, "occ_c", { unfolded: new Set(["J2201"]) })!;
    const wires = scene.connectors.find((item) => item.refdes === "J2201")!.wires;
    expect(wires.map((wire) => [wire.pad, wire.netLabel, wire.groups])).toEqual([
      ["1", "GND", []],
      ["2", "+5V0", []],
      ["3", "FAN_TACH_3V3", ["FAN"]],
      ["4", "FAN_PWM_3V3", ["FAN"]],
      ["MP", "GND", []],
    ]);
    // Wires leave the spine away from the board (left edge: towards −x), one row apart.
    expect(wires[0].end.x).toBeLessThan(wires[0].start.x);
    expect(wires[1].tap.y - wires[0].tap.y).toBe(2_540_000);
  });

  it("uses a stored interior: symbol place, pin placement and a moved label", () => {
    const interior = {
      symbol: { xNm: 10_160_000, yNm: 0, widthNm: 50_800_000, heightNm: 50_800_000 },
      pins: { J9: { edge: "top" as const, offsetNm: 20_320_000 } },
      labels: { J9: { xNm: 40_000_000, yNm: -20_000_000, rotationDeg: 90 } },
    };
    const scene = buildBoardScene(DOCUMENT, BUNDLE, "occ_c", { interior })!;
    const j9 = scene.connectors.find((item) => item.refdes === "J9")!;
    expect(j9.pin).toEqual({ x: 30_480_000, y: 0 });
    expect(j9.label).toMatchObject({ stored: true, rotationDeg: 90, point: { x: 40_000_000, y: -20_000_000 } });
    expect(j9.bus[0]).toEqual(j9.pin);
    expect(j9.bus[j9.bus.length - 1]).toEqual(j9.label.point);
  });

  it("is null for anything but a board", () => {
    expect(buildBoardScene(DOCUMENT, BUNDLE, "occ_missing")).toBeNull();
  });
});

describe("board edits", () => {
  it("groups pads in natural order under one connector", () => {
    expect(groupOps("occ_c", "J2201", orderedPads(["4", "3"]), "FAN", "sub_x")).toEqual([
      { kind: "add-sub-port", subPort: { id: "sub_x", occurrence: "occ_c", connector: "J2201", name: "FAN", pins: ["3", "4"] } },
    ]);
    expect(groupRefusal(DOCUMENT, "occ_c", "J2201", ["1"], "FAN")).toMatch(/already has/);
    expect(groupRefusal(DOCUMENT, "occ_c", null, ["1"], "X")).toMatch(/one connector/);
    expect(groupRefusal(DOCUMENT, "occ_c", "J2201", ["1", "2"], "PWR")).toBeNull();
  });

  it("accepts and dismisses suggestions", () => {
    const [suggestion] = BUNDLE.suggestions;
    expect(acceptOps("occ_c", [suggestion], () => "sub_p")).toEqual([
      { kind: "add-sub-port", subPort: { id: "sub_p", occurrence: "occ_c", connector: "J2201", name: "Power", pins: ["1", "2", "MP"], suggestion: "power" } },
    ]);
    expect(dismissOps(suggestion)).toEqual([{ kind: "dismiss-suggestion", suggestion: { occurrence: "occ_c", connector: "J2201", key: "power" } }]);
  });

  it("stores the interior in the occurrence's layout entry", () => {
    const [op] = interiorOps(DOCUMENT, "occ_c", { labels: { J9: { xNm: 1, yNm: 2, rotationDeg: 0 } } });
    expect(op).toEqual({ kind: "set-layout", item: "occ_c", placement: { xNm: 0, yNm: 0, rotationDeg: 0, mirror: false, interior: { labels: { J9: { xNm: 1, yNm: 2, rotationDeg: 0 } } } } });
  });
});
