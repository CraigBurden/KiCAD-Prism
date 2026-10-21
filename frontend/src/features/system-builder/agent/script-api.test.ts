import { afterEach, describe, expect, it, vi } from "vitest";

import type { SystemBundle, SystemDocument, SystemOp, SystemRecord } from "../model/types";
import { createScriptApi, resolvePads, type ScriptDeps } from "./script-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    route: {
      derived: true,
      ends: [
        { end: "end_a", exit: { xNm: 0, yNm: 0, zNm: 0 }, outward: { x: 0, y: 0, z: 1 }, leg: { xNm: 0, yNm: 0, zNm: 10e6 } },
        { end: "end_b", exit: { xNm: 100e6, yNm: 0, zNm: 0 }, outward: { x: 0, y: 0, z: -1 }, leg: { xNm: 100e6, yNm: 0, zNm: 10e6 } },
      ],
      segments: [{
        id: "har_h/end_a~end_b",
        derived: true,
        from: "end_a",
        to: "end_b",
        wires: ["link_h:1"],
        diameterNm: 2_400_000,
        assumedGauge: false,
        samplesNm: [0, 0, 10e6, 50e6, 0, 60e6, 100e6, 0, 10e6],
        lengthNm: 182_400_000,
        minRadiusAllowedNm: 14_400_000,
        clearances: [],
      }],
      wires: [{ wire: "link_h:1", lengthNm: 182_400_000 }],
    },
  }],
  findings: [
    {
      code: "harness-bend-tight",
      severity: "warning",
      subject: "segment:har_h/end_a~end_b",
      message: "The bend is tighter than the minimum radius.",
      objects: ["har_h"],
      waived: false,
    },
    {
      code: "wire-gauge-unknown",
      severity: "info",
      subject: "harness:har_h",
      message: "Wires have no gauge.",
      objects: ["har_h"],
      waived: false,
    },
  ],
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

  it("returns the harness outputs index from the API", async () => {
    const answer = {
      state: "ready",
      sheets: 3,
      files: [{ name: "harness.pdf", title: "Harness drawing", contentType: "application/pdf" }],
    };
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", mock);
    const { api } = harness();
    await expect(api.harnessOutputs("har_h")).resolves.toEqual(answer);
    expect(mock.mock.calls[0][0]).toBe("/api/systems/sys_a/harnesses/har_h/outputs");
    expect(() => api.harnessOutputs("har_none")).toThrow("No harness har_none");
  });

  it("returns the ICD index from the API", async () => {
    const answer = {
      state: "ready",
      sheets: 2,
      files: [{ name: "icd.pdf", title: "Interface control document", contentType: "application/pdf" }],
    };
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", mock);
    const { api } = harness();
    await expect(api.icd()).resolves.toEqual(answer);
    expect(mock.mock.calls[0][0]).toBe("/api/systems/sys_a/icd");
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

  it("describes the bundle route and only its §16.6 findings", () => {
    const { api } = harness();
    const described = api.describeRoute("har_h");
    expect(described.route?.derived).toBe(true);
    expect(described.route?.segments.map((segment) => segment.id)).toEqual(["har_h/end_a~end_b"]);
    expect(described.findings.map((finding) => finding.code)).toEqual(["harness-bend-tight"]);
    expect(() => api.describeRoute("har_none")).toThrow("No harness har_none");
  });

  it("adds a waypoint after storing the derived tree", async () => {
    const { api, sent } = harness();
    const result = await api.addWaypoint({
      harness: "har_h",
      segment: "har_h/end_a~end_b",
      position: { xNm: 0, yNm: 50e6, zNm: 0 },
      order: 0,
    });
    expect(result.id).toMatch(/^wpt_/);
    expect(result.version).toBe(6);
    expect(sent[0].expect).toBe(5);
    expect(sent[0].ops.map((op) => op.kind)).toEqual(["add-segment", "add-waypoint"]);
    expect(sent[0].ops[1]).toMatchObject({ kind: "add-waypoint", waypoint: { id: result.id, order: 0 } });
  });

  it("stores the topology and returns the new segment ids", async () => {
    const { api, sent } = harness();
    const stored = await api.storeTopology("har_h");
    expect(stored.version).toBe(6);
    expect(Object.keys(stored.segments)).toEqual(["har_h/end_a~end_b"]);
    expect(stored.segments["har_h/end_a~end_b"]).toMatch(/^seg_/);
    expect(sent[0].ops.map((op) => op.kind)).toEqual(["add-segment"]);
  });

  it("refuses to store a topology that is already stored", async () => {
    const route = HARNESS_BUNDLE.harnesses![0].route;
    const storedBundle = {
      ...HARNESS_BUNDLE,
      harnesses: [{ ...HARNESS_BUNDLE.harnesses![0], route: { ...route, derived: false } }],
    } as unknown as SystemBundle;
    const { api } = setup(5, { document: harnessDocument(), bundle: storedBundle });
    await expect(api.storeTopology("har_h")).rejects.toThrow("The topology is already stored");
  });

  it("moves and removes stored waypoints and branch points", async () => {
    const storedDocument: SystemDocument = {
      ...harnessDocument(),
      harnesses: [{
        ...HARNESS,
        segments: [
          { id: "seg_1", from: { kind: "end", end: "end_a" }, to: { kind: "branch-point", branchPoint: "bp_1" } },
          { id: "seg_2", from: { kind: "branch-point", branchPoint: "bp_1" }, to: { kind: "end", end: "end_b" } },
        ],
        waypoints: [{ id: "w1", segment: "seg_1", position: { xNm: 0, yNm: 6e6, zNm: 0 }, order: 0 }],
      }],
    };
    const route = HARNESS_BUNDLE.harnesses![0].route!;
    const storedBundle = {
      ...HARNESS_BUNDLE,
      harnesses: [{
        ...HARNESS_BUNDLE.harnesses![0],
        route: {
          ...route,
          derived: false,
          segments: [
            { ...route.segments[0], id: "seg_1", from: "end_a", to: "bp_1", derived: false },
            { ...route.segments[0], id: "seg_2", from: "bp_1", to: "end_b", derived: false },
          ],
        },
      }],
    } as unknown as SystemBundle;
    const { api, sent } = setup(5, { document: storedDocument, bundle: storedBundle });
    const moved = await api.moveWaypoint({ harness: "har_h", waypoint: "w1", position: { xNm: 5e6, yNm: 8e6, zNm: 0 } });
    expect(moved.version).toBe(6);
    expect(sent[0].ops[0]).toMatchObject({ kind: "replace-waypoint", waypoint: { id: "w1", position: { xNm: 5e6, yNm: 8e6, zNm: 0 } } });
    await api.removeWaypoint({ harness: "har_h", waypoint: "w1" });
    expect(sent[1].ops[0]).toMatchObject({ kind: "remove-waypoint", id: "w1" });
    await api.setBranchPoint({ harness: "har_h", branchPoint: "bp_1", position: { xNm: 1e6, yNm: 2e6, zNm: 0 } });
    expect(sent[2].ops[0]).toMatchObject({ kind: "replace-branch-point", branchPoint: { id: "bp_1", position: { xNm: 1e6, yNm: 2e6, zNm: 0 } } });
  });
});
