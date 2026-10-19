import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BOARD_MEMBERS,
  BoardModeController,
  COMMON_MEMBERS,
  DEFAULT_GPU_BUDGET_BYTES,
  createSharedState,
  emphasisChange,
  gpuBudgetBytes,
  installModeMembers,
  isSelectionEcho,
  selectionTarget,
} from "./viewer-controllers.js";
import { InsetViews } from "./inset-view.js";

const NETS = [
  { id: 1, uid: "u-gnd", name: "GND" },
  { id: 2, uid: "u-vbus", name: "VBUS", aliases: ["VBUS_IN"] },
  { id: 3, uid: "u-cc1", name: "CC1" },
];

/**
 * A scene port that records every call as `[name, ...args]`. `state` stands
 * for the scene: its nets, whether a net is lit, and whether isolation is on.
 * Members a test does not define just record and return undefined.
 */
function fakeScene(overrides = {}) {
  const calls = [];
  const scene = { nets: NETS, lit: false, isolating: false, quiet: false, sceneListeners: new Set() };
  const own = {
    nets: () => scene.nets,
    anyEmphasis: () => scene.lit,
    isolating: () => scene.isolating,
    quietly(apply) {
      calls.push(["quietly"]);
      scene.quiet = true;
      try {
        apply();
      } finally {
        scene.quiet = false;
      }
    },
    setHighlightedNetIds(ids) {
      calls.push(["setHighlightedNetIds", [...ids]]);
      scene.lit = ids.size > 0;
    },
    onSceneChange(listener) {
      scene.sceneListeners.add(listener);
      return () => scene.sceneListeners.delete(listener);
    },
    // The viewer's last emitted selection, taken once (main.js's takeEcho).
    takeEcho(selection) {
      const echo = isSelectionEcho(selection, scene.emitted);
      scene.emitted = null;
      return echo;
    },
    ...overrides,
  };
  const port = new Proxy(own, {
    get(target, name) {
      if (name === "then") return undefined;
      if (name in target) return target[name];
      return (...args) => {
        calls.push([name, ...args]);
        // Selections made from the host must run quietly (no echo back to it).
        if (String(name).startsWith("select") || name === "clearSelection") calls.at(-1).push(scene.quiet ? "quiet" : "loud");
        return undefined;
      };
    },
  });
  return { port, calls, scene, names: () => calls.map((call) => call[0]) };
}

// --- Selection -------------------------------------------------------------

test("a host selection resolves to a net by uid, then name or alias, then id; else a feature or a component", () => {
  assert.deepEqual(selectionTarget(NETS, { netUid: "u-vbus", netName: "GND" }), { kind: "net", id: 2 });
  assert.deepEqual(selectionTarget(NETS, { netName: "VBUS_IN" }), { kind: "net", id: 2 });
  assert.deepEqual(selectionTarget(NETS, { netName: "NOPE", netId: 3 }), { kind: "unresolved" });
  assert.deepEqual(selectionTarget(NETS, { netId: "3", featureId: 9 }), { kind: "net", id: 3 });
  assert.deepEqual(selectionTarget(NETS, { featureId: "9", reference: "U1" }), { kind: "feature", id: 9 });
  assert.deepEqual(selectionTarget(NETS, { reference: "U1" }), { kind: "component", reference: "U1" });
  assert.deepEqual(selectionTarget(NETS, { occurrence: "a" }), { kind: "board" });
});

test("board mode selects quietly, at the named occurrence first, and frames", () => {
  const board = new BoardModeController();
  const { port, calls } = fakeScene();
  board.attach(port);
  calls.length = 0;
  board.setSelection({ occurrence: "/a", netName: "CC1" });
  assert.deepEqual(calls, [["quietly"], ["selectOccurrence", "/a", "quiet"], ["selectNet", 3, true, "quiet"]]);
  calls.length = 0;
  board.setSelection({ reference: "R7" });
  assert.deepEqual(calls, [["quietly"], ["selectComponent", "R7", true, "quiet"]]);
  calls.length = 0;
  board.setSelection({ netName: "MISSING" });
  assert.deepEqual(calls, [["quietly"]]);
  calls.length = 0;
  board.setSelection(null);
  assert.deepEqual(calls, [["quietly"], ["clearSelection", "quiet"]]);
});

test("the host echoing the viewer's own selection changes nothing, once", () => {
  // A pad click emits a terminal; the host sends back its reference and pin only.
  const pad = { kind: "terminal", reference: "R16", pin: "2", netName: "VBUS", netCode: 4, featureId: 1073742000 };
  assert.equal(isSelectionEcho({ reference: "R16", pin: "2" }, pad), true);
  assert.equal(isSelectionEcho({ reference: "R16" }, pad), false, "the part is a new selection");
  assert.equal(isSelectionEcho({ reference: "R16", pin: "1" }, pad), false);
  // A net under the host's own uid, by name or code.
  const net = { kind: "net", netName: "GND", netUid: "GND", netCode: 1 };
  assert.equal(isSelectionEcho({ netName: "GND", netUid: "net:ccdd", netCode: 1 }, net), true);
  assert.equal(isSelectionEcho({ netCode: 1 }, net), true);
  assert.equal(isSelectionEcho({ netName: "VBUS" }, net), false);
  assert.equal(isSelectionEcho({ occurrence: "/a", netName: "GND" }, net), false);
  assert.equal(isSelectionEcho(null, net), false);

  const board = new BoardModeController();
  const { port, calls, scene } = fakeScene();
  board.attach(port);
  calls.length = 0;
  scene.emitted = pad;
  board.setSelection({ reference: "R16", pin: "2" });
  assert.deepEqual(calls, [], "the echo leaves the pad's net probe and the camera alone");
  // The same request again is the host's own: it selects and frames.
  board.setSelection({ reference: "R16", pin: "2" });
  assert.deepEqual(calls, [["quietly"], ["selectComponent", "R16", true, "quiet"]]);
});

// --- Nets ------------------------------------------------------------------

test("highlighting the first net probes like a net click; clearing the last restores the view", () => {
  const board = new BoardModeController();
  const { port, calls, scene } = fakeScene();
  board.attach(port);
  calls.length = 0;
  board.setHighlightedNets([{ netUid: "u-gnd" }, { netName: "VBUS_IN" }, { netName: "unknown" }]);
  assert.deepEqual(calls, [["setHighlightedNetIds", [1, 2]], ["showNetProbe"]]);
  calls.length = 0;
  board.setHighlightedNets([{ netName: "CC1" }]);
  assert.deepEqual(calls, [["setHighlightedNetIds", [3]]]);
  calls.length = 0;
  scene.isolating = true;
  board.setHighlightedNets([{ netName: "GND" }]);
  assert.deepEqual(calls, [["setHighlightedNetIds", [1]], ["isolateLitNets"]]);
  calls.length = 0;
  board.setHighlightedNets(null);
  assert.deepEqual(calls, [["setHighlightedNetIds", []], ["restoreVisibility"]]);
});

test("emphasis changes are enter, leave or none", () => {
  assert.equal(emphasisChange(false, true), "enter");
  assert.equal(emphasisChange(true, false), "leave");
  assert.equal(emphasisChange(true, true), null);
  assert.equal(emphasisChange(false, false), null);
});

// --- Insets ----------------------------------------------------------------

function insetScene() {
  // U1 on top: a body feature and two pads; pad 2 carries no designator
  // (footprint fallback), pad 1 resolves through the topology.
  const features = new Map([
    [10, { id: 10, kind: "component", designator: "U1", bounds: [0.001, -0.004, 0.0008, 0.003, -0.002, 0.0016] }],
    [11, { id: 11, kind: "pad", sourceUid: "pad-uuid-1", bounds: [0.001, -0.004, 0.0008, 0.0015, -0.0035, 0.0008] }],
    [12, { id: 12, kind: "pad", sourceUid: "Pkg:SOT23:pad:1:2", bounds: [0.0025, -0.0025, 0.0008, 0.003, -0.002, 0.0008] }],
    [13, { id: 13, kind: "pad", sourceUid: "Pkg:SOT23:pad:7:2", bounds: [0.05, -0.05, 0.0008, 0.051, -0.049, 0.0008] }],
  ]);
  return {
    scene: {
      features,
      componentFeatures: new Map([["U1", { featureId: 10, footprint: "Pkg:SOT23" }], ["J9", { featureId: 99, footprint: "X" }]]),
      runtimeBounds: [0, -0.01, -0.0008, 0.01, 0, 0.0008],
    },
    topology: {
      terminals: [{ designator: "U1", pin: "1", pcb_pad_id: "obj-1" }],
      physical_objects: [
        { uid: "obj-1", source_ids: ["pad-uuid-1"] },
        { uid: "body-j9", kind: "footprint_body", designator: "J9", bbox_mm: [5, 6, 7, 9], layer: "B.Cu" },
      ],
    },
  };
}

test("insets frame a part and anchor on its pad, from the topology or the nearest footprint pad", () => {
  const board = new BoardModeController();
  const data = insetScene();
  const { port } = fakeScene({ insetBoard: () => data });
  assert.equal(board.insetTarget("U1", "1"), null);
  board.attach(port);
  const viaTopology = board.insetTarget("U1", "1");
  assert.deepEqual(viaTopology.focus, { x: 1, y: 2, w: 2, h: 2 });
  assert.deepEqual(viaTopology.anchor, [1.25, 3.75]);
  assert.equal(viaTopology.pin, "1");
  assert.equal(viaTopology.bottom, false);
  assert.equal(viaTopology.surfaceZ, 0.0008);
  const viaFootprint = board.insetTarget("U1", 2);
  assert.equal(viaFootprint.pin, "2");
  assert.deepEqual(viaFootprint.anchor, [2.75, 2.25]);
  const noPad = board.insetTarget("U1", "5");
  assert.equal(noPad.pin, null);
  assert.deepEqual(noPad.anchor, [2, 3]);
  // A part without a drawn feature falls back to its footprint body, here on the bottom.
  const body = board.insetTarget("J9");
  assert.deepEqual(body.focus, { x: 5, y: 6, w: 2, h: 3 });
  assert.equal(body.bottom, true);
  assert.equal(body.surfaceZ, -0.0008);
  assert.equal(board.insetTarget("NOPE"), null);
  assert.equal(board.insetSurfaceZ(true), -0.0008);
  assert.equal(board.insetSurfaceZ(false), 0.0008);
});

test("inset calls answer their defaults until a board is mounted", async () => {
  const board = new BoardModeController();
  assert.equal(board.renderInset({}, {}, "a"), false);
  assert.equal(board.insetReady(), false);
  assert.equal(board.insetSurfaceZ(true), 0);
  assert.equal(board.projectInset({ center: [0, 0], zoom: 1 }, 10, 10, [0, 0]), null);
  assert.equal(board.insetStats(), null);
  assert.equal(board.insetSettings({}), null);
  assert.equal(await board.gpuIdle(), undefined);
  board.releaseInset("a");
});

test("inset hosts' scene listeners survive reloads and hear each mount", () => {
  const board = new BoardModeController();
  let heard = 0;
  const off = board.onSceneChange(() => {
    heard += 1;
  });
  const first = fakeScene();
  board.attach(first.port);
  assert.equal(heard, 1);
  for (const listener of first.scene.sceneListeners) listener();
  assert.equal(heard, 2);
  const second = fakeScene();
  board.attach(second.port);
  // The old scene no longer reaches the host; the new one does.
  assert.equal(first.scene.sceneListeners.size, 0);
  assert.ok(first.names().includes("dispose"));
  assert.equal(heard, 3);
  for (const listener of second.scene.sceneListeners) listener();
  assert.equal(heard, 4);
  off();
  for (const listener of second.scene.sceneListeners) listener();
  assert.equal(heard, 4);
  board.releaseInset(7);
  assert.deepEqual(second.calls.at(-1), ["releaseInset", "7"]);
});

test("recent insets stay listed for their TTL", () => {
  const views = new InsetViews(3000);
  views.record("a", "A", 1000);
  views.record("b", "B", 2500);
  assert.deepEqual(views.active(3500), ["A", "B"]);
  assert.deepEqual(views.active(4200), ["B"]);
  assert.equal(views.size, 1);
  views.release("b");
  assert.deepEqual(views.active(4200), []);
});

// --- Replay ----------------------------------------------------------------

test("a board mount gets the host's workspace, hidden parts, budget, selection and lit nets", () => {
  const board = new BoardModeController();
  board.setHiddenComponents(["R1", "R2"]);
  board.setGpuBudget(-5);
  board.setSelection({ reference: "U1" });
  board.setHighlightedNets([{ netName: "GND" }]);
  board.setWorkspace("pcb");
  const { port, calls } = fakeScene();
  board.attach(port, { workspace: "stackup" });
  assert.deepEqual(calls, [
    ["setWorkspace", "stackup"],
    ["setHiddenComponents", ["R1", "R2"]],
    ["setGpuBudget", DEFAULT_GPU_BUDGET_BYTES],
    ["quietly"],
    ["selectComponent", "U1", true, "quiet"],
    ["setHighlightedNetIds", [1]],
    ["showNetProbe"],
  ]);
});

test("a fresh board mount without host state is only told its workspace", () => {
  const board = new BoardModeController();
  const { port, calls } = fakeScene();
  board.attach(port);
  assert.deepEqual(calls, [["setWorkspace", "pcb"]]);
});

test("detach disposes the scene and keeps the host's state for the next mount", () => {
  const board = new BoardModeController();
  const first = fakeScene();
  board.attach(first.port);
  board.detach();
  assert.equal(board.port, null);
  assert.deepEqual(first.calls.at(-1), ["dispose"]);
  board.setHiddenComponents(["R1"]);
  const second = fakeScene();
  board.attach(second.port);
  assert.deepEqual(second.names(), ["setWorkspace", "setHiddenComponents"]);
  assert.throws(() => board.attach(null), TypeError);
});

test("the GPU budget falls back to 1.5 GB for anything that is not a positive number", () => {
  assert.equal(gpuBudgetBytes(2e9), 2e9);
  assert.equal(gpuBudgetBytes("5"), 5);
  for (const bad of [0, -1, Number.NaN, Infinity, "x", null, undefined]) assert.equal(gpuBudgetBytes(bad), DEFAULT_GPU_BUDGET_BYTES);
});

// --- The mode interfaces ---------------------------------------------------

test("every member the element exposes belongs to exactly one interface and exists on the controller", () => {
  const all = [...COMMON_MEMBERS, ...BOARD_MEMBERS];
  assert.equal(new Set(all).size, all.length);
  for (const name of all) assert.equal(typeof BoardModeController.prototype[name], "function", name);
});

test("an element routes its members to the controller, which keeps calls for the next mount", async () => {
  class Element {
    constructor() {
      this.modes = { board: new BoardModeController(createSharedState()) };
      this.mounted = null;
    }

    get activeMode() {
      return this.mounted ?? this.modes.board;
    }
  }
  installModeMembers(Element.prototype);
  const element = new Element();
  for (const name of [...COMMON_MEMBERS, ...BOARD_MEMBERS]) assert.equal(typeof element[name], "function", name);
  // Nothing mounted: every member answers its default.
  assert.equal(element.getViewState(), null);
  assert.deepEqual(element.getComponentReferences(), []);
  assert.equal(await element.pickAt(0, 0), null);
  element.setHiddenComponents(["R1"]);
  element.setSelection({ reference: "R1" });
  // A board mounts: it gets what the host set meanwhile.
  const board = fakeScene();
  element.mounted = element.modes.board;
  element.modes.board.attach(board.port);
  assert.deepEqual(board.names(), ["setWorkspace", "setHiddenComponents", "quietly", "selectComponent"]);
});

test("Prism's d.ts declares each member under the interface that has it", () => {
  // The host's types (frontend/src/types/prism-semantic-viewer.d.ts) declare
  // the members Prism calls; every one must be a member here, or Prism would
  // call a member that is a no-op.
  const dts = readFileSync(new URL("../../../frontend/src/types/prism-semantic-viewer.d.ts", import.meta.url), "utf8");
  const declared = (name) => {
    const body = new RegExp(`export interface ${name} \\{\\n([\\s\\S]*?)\\n\\}`).exec(dts)?.[1];
    assert.ok(body, name);
    return [...body.matchAll(/^ {4}(\w+)\(/gm)].map((match) => match[1]);
  };
  const tables = { PrismSemanticViewerCommon: COMMON_MEMBERS, PrismSemanticBoardMode: BOARD_MEMBERS };
  for (const [name, members] of Object.entries(tables)) {
    const names = declared(name);
    assert.ok(names.length > 5, name);
    for (const member of names) assert.ok(members.includes(member), `${name}.${member}`);
  }
  assert.match(dts, /interface PrismSemanticViewerElement\s+extends HTMLElement, PrismSemanticViewerCommon, PrismSemanticBoardMode \{\}/);
});
