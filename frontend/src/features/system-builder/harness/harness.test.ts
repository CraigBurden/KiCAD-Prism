import { describe, expect, it } from "vitest";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import {
  addBranchPointOps,
  addCableOps,
  addCoveringOps,
  addLooseEndOps,
  addMarkerOps,
  addSpliceOps,
  addWireOps,
  autoLayoutOps,
  canvasOps,
  confirmWireOps,
  linkJoining,
  removeWireOps,
  setEndOps,
  setWireOps,
} from "./harness-edits";
import { buildBom } from "./harness-format";
import { CARD_HEADER, CARD_WIDTH, NM_PER_PX, ROW, STRIP, assignLanes, layoutHarness, terminalPoint } from "./harness-layout";
import { buildHarnessView, type HarnessView } from "./harness-view";

const COMMIT = "c".repeat(40);

const board = (id: string, label: string) => ({
  id,
  label,
  source: { kind: "board" as const, projectId: "prj_000000000001", track: { kind: "pinned" as const, commit: COMMIT } },
});

const pins = [
  { pad: "1", net: "/PWR/VCC", nets: ["/PWR/VCC"], pinName: "VCC", power: true },
  { pad: "2", net: "/SIG/A", nets: ["/SIG/A"], pinName: "A", power: false },
  { pad: "3", net: "/SIG/B", nets: ["/SIG/B"], pinName: "B", power: false },
  { pad: "4", net: "/SIG/C", nets: ["/SIG/C"], pinName: "C", power: false },
];

function document(): SystemDocument {
  return {
    schema: "prism.system.v2",
    name: "Stack",
    sheets: [],
    occurrences: [board("occ_a", "Carrier"), board("occ_b", "SoM")],
    subPorts: [],
    dismissedSuggestions: [],
    bodyConnectors: [],
    mates: [],
    harnesses: [{
      id: "har_h",
      label: "H1",
      ends: [
        { id: "end_a", site: { occurrence: "occ_a", connector: "J1" }, contacts: {}, pinMap: [] },
        { id: "end_b", site: { occurrence: "occ_b", connector: "J2" }, contacts: {}, pinMap: [] },
      ],
      links: [{ id: "link_1", a: { occurrence: "occ_a", connector: "J1" }, b: { occurrence: "occ_b", connector: "J2" }, unmapped: ["3"] }],
      wires: [{
        id: "w_ex",
        from: { kind: "contact", end: "end_a", cavity: "1" },
        to: { kind: "contact", end: "end_b", cavity: "1" },
        link: "link_1",
        colour: "red",
        route: [],
      }],
      splices: [{ id: "spl_1", method: "crimp", confirmed: true }],
      branchPoints: [{ id: "bp_1" }],
      segments: [{ id: "seg_1", from: { kind: "end", end: "end_a" }, to: { kind: "branch-point", branchPoint: "bp_1" } }],
      coverings: [],
      cables: [],
      looseEnds: [{ id: "pt_1", kind: "pigtail" }],
      markers: [],
      waypoints: [],
    }],
    exports: [],
    waivers: [],
    layout: {},
  };
}

const BUNDLE: SystemBundle = {
  schema: "prism.system_bundle.a0",
  documentSha256: "d".repeat(64),
  occurrences: [
    { occurrence: "occ_a", state: "ready", connectors: [{ refdes: "J1", value: "QTH-060", candidate: true, pins }] },
    { occurrence: "occ_b", state: "ready", connectors: [{ refdes: "J2", value: "QTH-060", candidate: true, pins }] },
  ],
  nets: [{ id: "net_vcc", name: "/PWR/VCC", names: ["/PWR/VCC"], boardNets: [], pins: [] }],
  mates: [],
  links: [{
    harness: "har_h",
    link: "link_1",
    wires: [
      { a: "1", b: "1", rule: "explicit", suggested: false },
      { a: "2", b: "2", rule: "net-name", suggested: false },
      { a: "3", b: "3", rule: "net-name", suggested: false },
    ],
    unmappedA: ["4"],
    unmappedB: [],
  }],
  splices: [],
  harnesses: [{
    harness: "har_h",
    ends: [
      { end: "end_a", occurrence: "occ_a", connector: "J1", cavities: [] },
      { end: "end_b", occurrence: "occ_b", connector: "J2", cavities: [] },
    ],
    wires: [
      {
        id: "w_ex",
        origin: "explicit",
        link: "link_1",
        from: { kind: "contact", end: "end_a", cavity: "1", pad: "1" },
        to: { kind: "contact", end: "end_b", cavity: "1", pad: "1" },
        colour: "red",
        suggested: false,
      },
      {
        id: "link_1:2",
        origin: "default",
        link: "link_1",
        from: { kind: "contact", end: "end_a", cavity: "2", pad: "2" },
        to: { kind: "contact", end: "end_b", cavity: "2", pad: "2" },
        suggested: false,
      },
      {
        id: "link_1:3",
        origin: "default",
        link: "link_1",
        from: { kind: "contact", end: "end_a", cavity: "3", pad: "3" },
        to: { kind: "contact", end: "end_b", cavity: "3", pad: "3" },
        suggested: false,
      },
    ],
    route: {
      derived: true,
      ends: [],
      segments: [],
      wires: [
        { wire: "w_ex", lengthNm: 182_400_000 },
        { wire: "link_1:2", lengthNm: 1_000_000_000 },
      ],
    },
  }],
  suggestions: [],
  findings: [{
    code: "wire-gauge-unknown",
    severity: "info",
    subject: "harness:har_h",
    message: "Wires have no gauge.",
    objects: ["har_h"],
    waived: false,
  }],
  placement: { occurrences: [], mates: [] },
};

const viewOf = (doc = document()): HarnessView => buildHarnessView(doc, BUNDLE, "har_h")!;

function addWire(op: SystemOp) {
  if (op.kind !== "add-wire") throw new Error(`Expected add-wire, got ${op.kind}`);
  return op.wire;
}

describe("buildHarnessView", () => {
  it("puts side A left, names pins by net leaf, and marks open stubs", () => {
    const view = viewOf();
    expect(view.ends.map((end) => [end.id, end.side])).toEqual([["end_a", "left"], ["end_b", "right"]]);
    expect(view.ends[0].pins.map((pin) => pin.name)).toEqual(["VCC", "A", "B", "C"]);
    expect(view.ends[0].pins.find((pin) => pin.pad === "4")).toMatchObject({ open: true, wired: false });
    expect(view.ends[0].pins.find((pin) => pin.pad === "1")).toMatchObject({ open: false, wired: true });
    expect(view.wires.map((wire) => [wire.id, wire.origin])).toEqual([["w_ex", "explicit"], ["link_1:2", "default"], ["link_1:3", "default"]]);
    expect(view.wires.map((wire) => wire.routeLengthNm)).toEqual([182_400_000, 1_000_000_000, undefined]);
    expect(view.findings.map((finding) => finding.code)).toEqual(["wire-gauge-unknown"]);
  });
});

describe("wire lengths", () => {
  it("totals a BOM row only when every wire of it has a length", () => {
    const rows = buildBom(viewOf()).find((section) => section.title === "Wire")!.rows;
    expect(rows).toEqual([
      { label: "no gauge AWG · no colour", count: 2 },
      { label: "no gauge AWG · red · 182 mm", count: 1 },
    ]);
  });
});

describe("linkJoining", () => {
  it("returns the one link between the two sites, in either order", () => {
    const view = viewOf();
    expect(linkJoining(view, "end_a", "end_b")).toBe("link_1");
    expect(linkJoining(view, "end_b", "end_a")).toBe("link_1");
    expect(linkJoining(view, "end_a", "end_a")).toBeUndefined();
  });

  it("refuses to choose between two links joining the same sites", () => {
    const view = viewOf();
    const twice = { ...view, harness: { ...view.harness, links: [...view.harness.links, { ...view.harness.links[0], id: "link_2" }] } };
    expect(linkJoining(twice, "end_a", "end_b")).toBeUndefined();
  });
});

describe("addWireOps", () => {
  it("fills link for two contacts and strips the view's pad", () => {
    const view = viewOf();
    const ops = addWireOps(view, view.wires[1].from, view.wires[1].to, { gaugeAwg: "24", colour: "blue" }, "wire_new");
    expect(ops).toEqual([{
      kind: "add-wire",
      harness: "har_h",
      wire: {
        id: "wire_new",
        from: { kind: "contact", end: "end_a", cavity: "2" },
        to: { kind: "contact", end: "end_b", cavity: "2" },
        link: "link_1",
        gaugeAwg: "24",
        colour: "blue",
        route: [],
      },
    }]);
  });

  it("allows a second wire from a cavity an explicit wire already reaches", () => {
    const view = viewOf();
    const op = addWireOps(view, { kind: "contact", end: "end_a", cavity: "1" }, { kind: "splice", splice: "spl_1" }, {})[0];
    expect(addWire(op)).toMatchObject({ from: { kind: "contact", end: "end_a", cavity: "1" }, to: { kind: "splice", splice: "spl_1" }, route: [] });
    expect(addWire(op)).not.toHaveProperty("link");
  });

  it("refuses the same terminal twice and two pins on one connector", () => {
    const view = viewOf();
    expect(() => addWireOps(view, view.wires[1].from, view.wires[1].from, {})).toThrow("A wire needs two different ends");
    expect(() => addWireOps(view, view.wires[0].from, { kind: "contact", end: "end_a", cavity: "2" }, {})).toThrow(
      "Both pins are on the same connector",
    );
  });
});

describe("setWireOps", () => {
  it("replaces an explicit wire, merging fields and keeping the route", () => {
    const view = viewOf();
    const ops = setWireOps(view, "w_ex", { gaugeAwg: "22", colour: null, label: "PWR" });
    expect(ops[0]).toMatchObject({ kind: "replace-wire", harness: "har_h" });
    const wire = ops[0].kind === "replace-wire" ? ops[0].wire : undefined;
    expect(wire).toMatchObject({ id: "w_ex", gaugeAwg: "22", label: "PWR", link: "link_1", route: [] });
    expect(wire).not.toHaveProperty("colour");
  });

  it("makes a default wire explicit with the changes", () => {
    const ops = setWireOps(viewOf(), "link_1:2", { colour: "green", label: null }, "wire_def");
    expect(ops).toEqual([{
      kind: "add-wire",
      harness: "har_h",
      wire: {
        id: "wire_def",
        from: { kind: "contact", end: "end_a", cavity: "2" },
        to: { kind: "contact", end: "end_b", cavity: "2" },
        link: "link_1",
        colour: "green",
        route: [],
      },
    }]);
  });
});

describe("confirmWireOps", () => {
  it("confirms a default wire and leaves an explicit one alone", () => {
    const view = viewOf();
    const ops = confirmWireOps(view, "link_1:3", "wire_confirmed");
    expect(ops).toHaveLength(1);
    expect(addWire(ops[0])).toMatchObject({ id: "wire_confirmed", from: { kind: "contact", end: "end_a", cavity: "3" }, link: "link_1", route: [] });
    expect(confirmWireOps(view, "w_ex")).toEqual([]);
  });
});

describe("removeWireOps", () => {
  it("removes an explicit wire", () => {
    expect(removeWireOps(viewOf(), "w_ex")).toEqual([{ kind: "remove-wire", harness: "har_h", id: "w_ex" }]);
  });

  it("clears a default wire's side A pad into the link's unmapped, sorted", () => {
    const doc = document();
    const ops = removeWireOps(viewOf(doc), "link_1:2");
    expect(ops).toEqual([{
      kind: "replace-link",
      harness: "har_h",
      link: { ...doc.harnesses[0].links[0], unmapped: ["2", "3"] },
    }]);
  });
});

describe("end and canvas edits", () => {
  it("replaces an end with the full document end; null drops the housing", () => {
    const view = viewOf();
    const ops = setEndOps(view, "end_a", { housing: null, contacts: { "1": { componentId: "cmp_contact" } }, pinMap: [{ cavity: "1", pad: "1" }] });
    expect(ops[0]).toEqual({
      kind: "replace-end",
      harness: "har_h",
      end: { id: "end_a", site: { occurrence: "occ_a", connector: "J1" }, contacts: { "1": { componentId: "cmp_contact" } }, pinMap: [{ cavity: "1", pad: "1" }] },
    });
  });

  it("keeps an existing route when placing an object on the canvas", () => {
    const doc = document();
    const route = [{ xNm: 1, yNm: 2 }, { xNm: 3, yNm: 4 }] as const;
    doc.layout.end_a = { xNm: 100, yNm: 200, rotationDeg: 0, mirror: false, route: [...route] };
    expect(canvasOps(doc, "end_a", { xNm: 5 * NM_PER_PX, yNm: 6 * NM_PER_PX })).toEqual([{
      kind: "set-layout",
      item: "end_a",
      placement: {
        xNm: 100,
        yNm: 200,
        rotationDeg: 0,
        mirror: false,
        route: [...route],
        canvas: { xNm: 500_000, yNm: 600_000 },
      },
    }]);
  });

  it("places a new object from a blank placement", () => {
    expect(canvasOps(document(), "spl_new", { xNm: NM_PER_PX, yNm: 2 * NM_PER_PX })).toEqual([{
      kind: "set-layout",
      item: "spl_new",
      placement: { xNm: 0, yNm: 0, rotationDeg: 0, mirror: false, canvas: { xNm: 100_000, yNm: 200_000 } },
    }]);
  });

  it("adds nodes with their canvas", () => {
    const doc = document();
    const view = viewOf(doc);
    const at = { xNm: 3 * NM_PER_PX, yNm: 4 * NM_PER_PX };
    expect(addSpliceOps(doc, view, at, "spl_new").map((op) => op.kind)).toEqual(["add-splice", "set-layout"]);
    expect(addLooseEndOps(doc, view, at, "pt_new")[0]).toMatchObject({ kind: "add-loose-end", looseEnd: { id: "pt_new", kind: "pigtail" } });
    expect(addBranchPointOps(doc, view, at, "bp_new")[0]).toMatchObject({ kind: "add-branch-point", branchPoint: { id: "bp_new" } });
  });

  it("clears only the canvas of ends and nodes", () => {
    const doc = document();
    doc.layout.end_a = { xNm: 1, yNm: 2, rotationDeg: 90, mirror: true, canvas: { xNm: 10, yNm: 20 } };
    doc.layout.spl_1 = { xNm: 3, yNm: 4, rotationDeg: 0, mirror: false, canvas: { xNm: 30, yNm: 40 } };
    doc.layout.bp_1 = { xNm: 5, yNm: 6, rotationDeg: 0, mirror: false };
    const ops = autoLayoutOps(doc, viewOf(doc));
    expect(ops.map((op) => op.kind === "set-layout" ? op.item : "")).toEqual(["end_a", "spl_1"]);
    expect(ops[0]).toEqual({ kind: "set-layout", item: "end_a", placement: { xNm: 1, yNm: 2, rotationDeg: 90, mirror: true } });
  });
});

describe("cables and coverings", () => {
  it("makes a default wire explicit and binds conductors in order", () => {
    const ops = addCableOps(viewOf(), ["w_ex", "link_1:2"], { componentId: "cmp_cable" }, "cab_1");
    expect(ops.map((op) => op.kind)).toEqual(["add-wire", "add-cable"]);
    const made = addWire(ops[0]);
    expect(made.id).not.toBe("link_1:2");
    expect(made).toMatchObject({ from: { kind: "contact", end: "end_a", cavity: "2" }, link: "link_1", route: [] });
    expect(ops[1]).toEqual({
      kind: "add-cable",
      harness: "har_h",
      cable: {
        id: "cab_1",
        part: { componentId: "cmp_cable" },
        conductors: [
          { name: "red", wire: "w_ex", drain: false },
          { name: "C2", wire: made.id, drain: false },
        ],
      },
    });
  });

  it("refuses a cable of fewer than two wires", () => {
    expect(() => addCableOps(viewOf(), ["w_ex"])).toThrow("Select two or more wires");
  });

  it("covers a known segment only", () => {
    expect(addCoveringOps(viewOf(), "seg_1", "cov_1")).toEqual([{
      kind: "add-covering",
      harness: "har_h",
      covering: { id: "cov_1", segment: "seg_1", kind: "heat-shrink" },
    }]);
    expect(() => addCoveringOps(viewOf(), "seg_missing")).toThrow("Pick a segment of this harness");
  });
});

describe("addMarkerOps", () => {
  it("names an explicit wire by its label, or its id", () => {
    expect(addMarkerOps(viewOf(), "w_ex", "mkr_1")).toEqual([{
      kind: "add-marker",
      harness: "har_h",
      marker: { id: "mkr_1", wire: "w_ex", kind: "label", text: "w_ex" },
    }]);
  });

  it("makes a default wire explicit first, and the marker names the new wire", () => {
    const ops = addMarkerOps(viewOf(), "link_1:2", "mkr_2");
    expect(ops.map((op) => op.kind)).toEqual(["add-wire", "add-marker"]);
    const made = addWire(ops[0]);
    expect(ops[1]).toMatchObject({ kind: "add-marker", marker: { id: "mkr_2", wire: made.id, kind: "label", text: "link_1:2" } });
  });
});

describe("layoutHarness", () => {
  it("auto-places ends in two columns and nodes between", () => {
    const placed = layoutHarness(viewOf(), {});
    const height = CARD_HEADER + ROW * 4 + 16;
    expect(placed.ends[0]).toMatchObject({ id: "end_a", x: 40, y: 80, width: CARD_WIDTH, height, side: "left" });
    expect(placed.ends[1]).toMatchObject({ id: "end_b", x: 40 + CARD_WIDTH + 520, y: 80, side: "right" });
    expect(placed.ends[0].pins.map((pin) => pin.point.x)).toEqual(Array(4).fill(40 + CARD_WIDTH + STRIP));
    expect(placed.ends[0].pins[0].rowY).toBe(80 + CARD_HEADER + ROW / 2);
    expect(placed.ends[1].pins[0].point.x).toBe(40 + CARD_WIDTH + 520 - STRIP);
    expect(placed.nodes.map((node) => [node.id, node.kind])).toEqual([["spl_1", "splice"], ["bp_1", "branch-point"], ["pt_1", "loose"]]);
    expect(placed.nodes.map((node) => node.point)).toEqual([
      { x: 580, y: 120 },
      { x: 580, y: 190 },
      { x: 580, y: 260 },
    ]);
    expect(placed.width).toBe(40 + CARD_WIDTH + 520 + CARD_WIDTH + 80);
    expect(placed.height).toBe(80 + height + 80);
  });

  it("draws a wire through both stubs and the middle column", () => {
    const placed = layoutHarness(viewOf(), {});
    expect(placed.wires.find((wire) => wire.id === "link_1:2")?.points).toEqual([
      { x: 326, y: 199 },
      { x: 350, y: 199 },
      { x: 580, y: 199 },
      { x: 810, y: 199 },
      { x: 834, y: 199 },
    ]);
    expect(placed.segments).toEqual([{ id: "seg_1", points: [{ x: 326, y: 185 }, { x: 453, y: 185 }, { x: 453, y: 190 }, { x: 580, y: 190 }] }]);
  });

  it("gives every wire across a gap its own lane, ordered so none cross", () => {
    const at = (x: number, y: number) => ({ x, y });
    const lanes = assignLanes([
      { id: "fall_top", a: at(100, 10), b: at(300, 50) },
      { id: "fall_low", a: at(100, 20), b: at(300, 60) },
      { id: "rise_top", a: at(100, 70), b: at(300, 30) },
      { id: "rise_low", a: at(100, 80), b: at(300, 40) },
      { id: "flat", a: at(100, 90), b: at(300, 90) },
      // Drawn right to left: read left to right it falls from 15 to 55.
      { id: "reversed", a: at(300, 55), b: at(100, 15) },
    ]);
    expect(lanes.has("flat")).toBe(false);
    const order = [...lanes.entries()].sort((p, q) => p[1] - q[1]).map(([id]) => id);
    expect(order).toEqual(["fall_low", "reversed", "fall_top", "rise_top", "rise_low"]);
    const xs = [...lanes.values()].sort((p, q) => p - q);
    expect(new Set(xs).size).toBe(5);
    expect(xs[0]).toBeGreaterThanOrEqual(116);
    expect(xs[4]).toBeLessThanOrEqual(284);
  });

  it("lets a canvas placement override the auto position", () => {
    const placed = layoutHarness(viewOf(), {
      end_b: { xNm: 0, yNm: 0, rotationDeg: 0, mirror: false, canvas: { xNm: 100 * NM_PER_PX, yNm: 200 * NM_PER_PX } },
      spl_1: { xNm: 0, yNm: 0, rotationDeg: 0, mirror: false, canvas: { xNm: 50 * NM_PER_PX, yNm: 60 * NM_PER_PX } },
    });
    expect(placed.ends[1]).toMatchObject({ x: 100, y: 200 });
    expect(placed.nodes[0].point).toEqual({ x: 50, y: 60 });
  });
});

describe("terminalPoint", () => {
  it("finds pin rows, strip middles and nodes", () => {
    const placed = layoutHarness(viewOf(), {});
    expect(terminalPoint(placed, { kind: "contact", end: "end_a", cavity: "1" })).toEqual({ x: 326, y: 169 });
    expect(terminalPoint(placed, { kind: "contact", end: "end_a", cavity: "9" })).toEqual({ x: 326, y: 185 });
    expect(terminalPoint(placed, { kind: "splice", splice: "spl_1" })).toEqual({ x: 580, y: 120 });
    expect(terminalPoint(placed, { kind: "loose", looseEnd: "pt_1" })).toEqual({ x: 580, y: 260 });
    expect(terminalPoint(placed, { kind: "contact", end: "end_missing", cavity: "1" })).toBeNull();
  });
});
