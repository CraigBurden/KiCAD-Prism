import { describe, expect, it, vi } from "vitest";

import type { SystemBundle, SystemDocument, SystemOp, SystemRecord } from "../model/types";
import { createScriptApi, resolvePads, type ScriptDeps } from "./script-api";

const COMMIT = "f".repeat(40);
const DOCUMENT: SystemDocument = {
  schema: "prism.system.v2",
  name: "Stack",
  sheets: [],
  occurrences: [
    { id: "occ_c", label: "Carrier", source: { kind: "board", projectId: "prj_000000000001", track: { kind: "pinned", commit: COMMIT } } },
    { id: "occ_s", label: "SoM", source: { kind: "board", projectId: "prj_000000000002", track: { kind: "pinned", commit: COMMIT } } },
  ],
  subPorts: [],
  dismissedSuggestions: [],
  bodyConnectors: [],
  mates: [{ id: "mate_x", a: { occurrence: "occ_c", connector: "J202" }, b: { occurrence: "occ_s", connector: "J1" }, orientation: { quarterTurns: 0, flip: false }, rows: {} }],
  harnesses: [],
  exports: [],
  waivers: [],
  layout: { occ_c: { xNm: 0, yNm: 0, rotationDeg: 0, mirror: false } },
};
const pin = (pad: string, net: string, power = false) => ({ pad, net, nets: [net], power });
const BUNDLE = {
  occurrences: [
    { occurrence: "occ_c", state: "ready", connectors: [
      { refdes: "J2201", value: "", candidate: true, placement: { angleDeg: 180, side: "top" }, pins: [pin("1", "GND", true), pin("2", "+5V0", true), pin("3", "/SOM/FAN_TACH_3V3"), pin("4", "/SOM/FAN_PWM_3V3")] },
      { refdes: "J202", value: "", candidate: true, placement: { angleDeg: 270, side: "top" }, pins: [pin("1", "A")] },
      { refdes: "J203", value: "", candidate: true, placement: { angleDeg: 200, side: "top" }, pins: [pin("1", "GND", true)] },
    ] },
    { occurrence: "occ_s", state: "ready", connectors: [{ refdes: "J1", value: "", candidate: true, placement: { angleDeg: 270, side: "bottom" }, pins: [pin("1", "A")] }] },
  ],
  suggestions: [
    { occurrence: "occ_c", connector: "J2201", key: "power", name: "Power", source: "power", pins: ["1", "2"] },
    { occurrence: "occ_c", connector: "J2201", key: "family:FAN", name: "FAN", source: "family", pins: ["3", "4"] },
  ],
  placement: {
    occurrences: [
      { occurrence: "occ_c", pose: { translation: { xNm: 0, yNm: 0, zNm: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }, source: "default", root: true },
      { occurrence: "occ_s", pose: { translation: { xNm: 5e6, yNm: 0, zNm: 7e6 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }, source: "mate", root: false, positioningMate: "mate_x" },
    ],
    mates: [{ mate: "mate_x", driving: true }],
  },
} as unknown as SystemBundle;

const HARNESS: SystemDocument["harnesses"][number] = {
  id: "har_h",
  label: "H1",
  ends: [
    { id: "end_a", site: { occurrence: "occ_c", connector: "J2201" }, contacts: { "1": { componentId: "cmp_contact" } }, pinMap: [] },
    { id: "end_b", site: { occurrence: "occ_s", connector: "J1" }, contacts: {}, pinMap: [] },
  ],
  links: [{ id: "link_h", a: { occurrence: "occ_c", connector: "J2201" }, b: { occurrence: "occ_s", connector: "J1" }, unmapped: [] }],
  wires: [],
  splices: [{ id: "spl_1", method: "crimp", confirmed: true }],
  branchPoints: [{ id: "bp_1" }],
  segments: [],
  coverings: [],
  cables: [],
  looseEnds: [{ id: "pt_1", kind: "pigtail" }],
  markers: [],
  waypoints: [],
};

const harnessDocument = (): SystemDocument => ({ ...DOCUMENT, harnesses: [HARNESS] });

const HARNESS_BUNDLE = {
  ...BUNDLE,
  harnesses: [{
    harness: "har_h",
    ends: [
      { end: "end_a", occurrence: "occ_c", connector: "J2201", cavities: [] },
      { end: "end_b", occurrence: "occ_s", connector: "J1", cavities: [] },
    ],
    wires: [
      {
        id: "link_h:1",
        origin: "default",
        link: "link_h",
        from: { kind: "contact", end: "end_a", cavity: "1", pad: "1" },
        to: { kind: "contact", end: "end_b", cavity: "1", pad: "1" },
        suggested: false,
      },
      {
        id: "link_h:2",
        origin: "default",
        link: "link_h",
        from: { kind: "contact", end: "end_a", cavity: "2", pad: "2" },
        to: { kind: "contact", end: "end_b", cavity: "2", pad: "2" },
        suggested: false,
      },
    ],
  }],
} as unknown as SystemBundle;

function setup(version = 5, chosen: { document?: SystemDocument; bundle?: SystemBundle } = {}) {
  const initial = chosen.document ?? DOCUMENT;
  let current: SystemRecord = { systemId: "sys_a", name: "Stack", folderId: null, version, document: initial, redacted: false, createdBy: "", createdAt: "", updatedAt: "" };
  const sent: { ops: SystemOp[]; expect: number }[] = [];
  const unfolded = new Set<string>();
  const deps: ScriptDeps = {
    record: () => current,
    bundle: () => chosen.bundle ?? BUNDLE,
    apply: vi.fn(async (ops: SystemOp[], expect: number) => {
      sent.push({ ops, expect });
      if (expect !== current.version) throw Object.assign(new Error("stale"), { status: 412 });
      current = { ...current, version: current.version + 1 };
      return current;
    }),
    reload: vi.fn(async () => current),
    undo: vi.fn(async () => undefined),
    open: vi.fn(),
    select: vi.fn(),
    unfold: vi.fn((occurrence: string, connector: string, on: boolean) => (on ? unfolded.add(`${occurrence}/${connector}`) : unfolded.delete(`${occurrence}/${connector}`))),
    isUnfolded: (occurrence, connector) => unfolded.has(`${occurrence}/${connector}`),
    openMate: vi.fn(),
    openHarness: vi.fn(),
  };
  return { api: createScriptApi(deps), deps, sent, bump: () => (current = { ...current, version: current.version + 1 }) };
}

describe("resolvePads", () => {
  it("resolves nets and patterns to pads through the bundle, and refuses an empty match", () => {
    expect(resolvePads(BUNDLE, "occ_c", "J2201", { netPattern: "FAN_" })).toEqual(["3", "4"]);
    expect(resolvePads(BUNDLE, "occ_c", "J2201", { nets: ["GND", "+5V0"] })).toEqual(["1", "2"]);
    expect(() => resolvePads(BUNDLE, "occ_c", "J2201", { netPattern: "NOPE" })).toThrow(/Nothing on J2201/);
    expect(() => resolvePads(BUNDLE, "occ_c", "J2201", { pads: ["9"] })).toThrow(/no pad 9/);
  });
});

describe("window.prismSystemBuilder", () => {
  it("groups by net pattern in one request on the version it read", async () => {
    const { api, sent } = setup();
    await api.createSubPort({ occurrence: "occ_c", connector: "J2201", netPattern: "FAN_", name: "FAN", id: "sub_fan" });
    expect(sent).toEqual([{ expect: 5, ops: [{ kind: "add-sub-port", subPort: { id: "sub_fan", occurrence: "occ_c", connector: "J2201", name: "FAN", pins: ["3", "4"] } }] }]);
  });

  it("fails like the UI when the system moved on since the script read it, until system() re-reads", async () => {
    const { api, bump } = setup();
    await api.acceptSuggestions({ occurrence: "occ_c", keys: ["power"] });
    bump();
    await expect(api.acceptSuggestions({ occurrence: "occ_c", keys: ["family:FAN"] })).rejects.toMatchObject({ status: 412 });
    const read = await api.system();
    expect(read.version).toBe(7);
    await expect(api.acceptSuggestions({ occurrence: "occ_c", keys: ["family:FAN"] })).resolves.toEqual({ version: 8 });
  });

  it("accepts all suggestions on a board", async () => {
    const { api, sent } = setup();
    await api.acceptSuggestions({ occurrence: "occ_c", keys: "all" });
    expect(sent[0].ops.map((op) => (op as { subPort: { suggestion: string } }).subPort.suggestion)).toEqual(["power", "family:FAN"]);
    await expect(api.acceptSuggestions({ occurrence: "occ_c", keys: ["nope"] })).rejects.toThrow(/No open suggestion nope/);
  });

  it("refuses connections the document cannot hold and builds the ones it can", async () => {
    const { api, sent } = setup();
    await expect(api.connect({ kind: "mate", a: { occurrence: "occ_c", connector: "J202" }, b: { occurrence: "occ_s", connector: "J1" } })).rejects.toThrow(/one connector only/);
    await api.connect({ kind: "harness", a: { occurrence: "occ_c", connector: "J2201" }, b: { occurrence: "occ_c", connector: "J203" } });
    expect(sent[0].ops[0].kind).toBe("connect-harness");
  });

  it("describes a board sheet by meaning, with the view's unfolded state", () => {
    const { api } = setup();
    api.unfold({ occurrence: "occ_c", connector: "J2201" });
    const sheet = api.describeSheet("occ_c");
    const j2201 = sheet.connectors?.find((item) => item.refdes === "J2201");
    expect(j2201).toMatchObject({ unfolded: true, label: "J2201{4}" });
    expect(j2201?.suggestions.map((item) => item.key)).toEqual(["power", "family:FAN"]);
    const root = api.describeSheet();
    expect(root.symbols?.map((item) => item.id)).toEqual(["occ_c", "occ_s"]);
    expect(root.connections?.[0]).toMatchObject({ id: "mate_x", kind: "mate" });
  });

  it("moves a pin by edge and offset, refusing another pin's spot", async () => {
    const { api, sent } = setup();
    const pins = api.describeSheet().symbols?.find((item) => item.id === "occ_c")?.pins ?? [];
    const j202 = pins.find((item) => item.key === "J202")!;
    const j2201 = pins.find((item) => item.key === "J2201")!;
    await expect(api.movePort({ item: "occ_c", key: "J203", edge: j202.edge, offsetNm: j202.offsetNm })).rejects.toThrow(/Another pin/);
    await api.movePort({ item: "occ_c", key: "J2201", edge: "top", offsetNm: 20_320_000 });
    expect(sent[0].ops[0]).toMatchObject({ kind: "set-layout", item: "occ_c", placement: { ports: { J2201: { edge: "top", offsetNm: 20_320_000 } } } });
    expect(j2201.edge).toBe("left");
  });

  it("describes the placement and moves only a root or free board", async () => {
    const { api, sent } = setup();
    const placement = api.describePlacement();
    expect(placement.occurrences[1]).toMatchObject({ occurrence: "occ_s", label: "SoM", translationMm: [5, 0, 7], rotationDeg: [0, 0, 0], movable: false, positioningMate: "mate_x" });
    await expect(api.setPose({ occurrence: "occ_s", translationMm: [0, 0, 0] })).rejects.toThrow(/placed by mate mate_x/);
    await api.setPose({ occurrence: "occ_c", translationMm: [10, 20, 0], rotationDeg: [0, 0, 90] });
    expect(sent[0].ops[0]).toMatchObject({ kind: "replace-occurrence", occurrence: { id: "occ_c", pose: { translation: { xNm: 10_000_000, yNm: 20_000_000, zNm: 0 } } } });
    const rotation = (sent[0].ops[0] as { occurrence: { pose: { rotation: { z: number; w: number } } } }).occurrence.pose.rotation;
    expect(rotation.z).toBeCloseTo(Math.SQRT1_2);
    expect(rotation.w).toBeCloseTo(Math.SQRT1_2);
  });

  it("sets the positioning mate only to a mate of the occurrence", async () => {
    const { api, sent } = setup();
    await expect(api.setPositioningMate({ occurrence: "occ_s", mate: "mate_nope" })).rejects.toThrow(/not a mate of occ_s/);
    await api.setPositioningMate({ occurrence: "occ_s", mate: "mate_x" });
    expect(sent[0].ops[0]).toMatchObject({ kind: "replace-occurrence", occurrence: { id: "occ_s", positioningMate: "mate_x" } });
  });
});

describe("harness script API", () => {
  const harness = () => setup(5, { document: harnessDocument(), bundle: HARNESS_BUNDLE });

  function plainJson(value: unknown): boolean {
    if (typeof value === "function") return false;
    if (Array.isArray(value)) return value.every(plainJson);
    if (value && typeof value === "object") return Object.values(value).every(plainJson);
    return true;
  }

  it("describes the harness as its tab shows it, as plain JSON", () => {
    const { api } = harness();
    const view = api.describeHarness("har_h");
    expect(view).toMatchObject({ id: "har_h", label: "H1", pending: false });
    expect(view.ends.map((end) => [end.id, end.side, end.title])).toEqual([
      ["end_a", "left", "J2201 · Carrier"],
      ["end_b", "right", "J1 · SoM"],
    ]);
    expect(view.ends[0].pins.find((pin) => pin.pad === "1")).toMatchObject({ name: "GND", cavity: "1", wired: true });
    expect(view.wires.map((wire) => [wire.id, wire.origin, wire.link])).toEqual([
      ["link_h:1", "default", "link_h"],
      ["link_h:2", "default", "link_h"],
    ]);
    expect(view.splices.map((splice) => splice.id)).toEqual(["spl_1"]);
    expect(view.looseEnds.map((loose) => loose.id)).toEqual(["pt_1"]);
    expect(plainJson(view)).toBe(true);
  });

  it("adds a wire and fills the link joining its two sites", async () => {
    const { api, sent } = harness();
    await api.addWire({
      harness: "har_h",
      from: { kind: "contact", end: "end_a", cavity: "3" },
      to: { kind: "contact", end: "end_b", cavity: "3" },
      gaugeAwg: "24",
      colour: "blue",
      label: "FAN",
    });
    expect(sent[0].ops[0]).toMatchObject({
      kind: "add-wire",
      harness: "har_h",
      wire: {
        from: { kind: "contact", end: "end_a", cavity: "3" },
        to: { kind: "contact", end: "end_b", cavity: "3" },
        link: "link_h",
        gaugeAwg: "24",
        colour: "blue",
        label: "FAN",
      },
    });
  });

  it("makes a default wire explicit when it is set", async () => {
    const { api, sent } = harness();
    await api.setWire({ harness: "har_h", wire: "link_h:1", gaugeAwg: "26", colour: "green" });
    expect(sent[0].ops[0]).toMatchObject({
      kind: "add-wire",
      harness: "har_h",
      wire: {
        from: { kind: "contact", end: "end_a", cavity: "1" },
        to: { kind: "contact", end: "end_b", cavity: "1" },
        link: "link_h",
        gaugeAwg: "26",
        colour: "green",
      },
    });
  });

  it("removes a default wire by unmapping its side A pad", async () => {
    const { api, sent } = harness();
    await api.removeWire({ harness: "har_h", wire: "link_h:2" });
    expect(sent[0].ops).toEqual([{
      kind: "replace-link",
      harness: "har_h",
      link: { ...HARNESS.links[0], unmapped: ["2"] },
    }]);
  });
});
