import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import { ThreeDPane } from "./three-d-pane";

vi.mock("@/lib/api", () => ({
  fetchJson: vi.fn(async () => ({ status: "ready", bundle_url: "/api/projects/prj_1/webgpu-3d/bundle.json" })),
}));

const COMMIT = "b".repeat(40);
const NM = 1e6;
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const at = (xNm: number, yNm: number, zNm = 0) => ({ xNm, yNm, zNm });
const end = (id: string) => ({ id, site: { occurrence: "occ_c", connector: "J1" }, contacts: {}, pinMap: [] });

/** A straight segment's samples, `steps + 1` of them, in millimetres. */
function line(a: [number, number, number], b: [number, number, number], steps: number): number[] {
  const out: number[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    out.push((a[0] + (b[0] - a[0]) * t) * NM, (a[1] + (b[1] - a[1]) * t) * NM, (a[2] + (b[2] - a[2]) * t) * NM);
  }
  return out;
}

const riddenEnd = (id: string, exit: [number, number, number], leg: [number, number, number]) => ({
  end: id,
  exit: at(exit[0] * NM, exit[1] * NM, exit[2] * NM),
  outward: { x: 0, y: -1, z: 0 },
  leg: at(leg[0] * NM, leg[1] * NM, leg[2] * NM),
});

/** A harness with one stored segment, one branch point and one waypoint. */
function storedDocument(): SystemDocument {
  return {
    schema: "prism.system.v2", name: "Stack", sheets: [], subPorts: [], dismissedSuggestions: [], bodyConnectors: [], mates: [], exports: [], waivers: [], layout: {},
    occurrences: [{ id: "occ_c", label: "Carrier", source: { kind: "board", projectId: "prj_1", track: { kind: "pinned", commit: COMMIT } } }],
    harnesses: [{
      id: "har_1", label: "H1", ends: [end("end_a"), end("end_b")], links: [], wires: [], splices: [], coverings: [], cables: [], looseEnds: [], markers: [],
      branchPoints: [{ id: "bp_1", position: at(0, 20 * NM) }],
      segments: [
        { id: "seg_1", from: { kind: "end", end: "end_a" }, to: { kind: "branch-point", branchPoint: "bp_1" } },
        { id: "seg_2", from: { kind: "branch-point", branchPoint: "bp_1" }, to: { kind: "end", end: "end_b" } },
      ],
      waypoints: [{ id: "w1", segment: "seg_1", position: at(0, 13 * NM), order: 0 }],
    }],
  } as unknown as SystemDocument;
}

function storedBundle(): SystemBundle {
  return {
    occurrences: [],
    placement: {
      occurrences: [{ occurrence: "occ_c", pose: { translation: at(0, 0, 0), rotation: IDENTITY }, source: "default", root: true }],
      mates: [],
    },
    harnesses: [{
      harness: "har_1", ends: [], wires: [],
      route: {
        derived: false,
        ends: [riddenEnd("end_a", [0, 0, 0], [0, 10, 0]), riddenEnd("end_b", [0, 40, 0], [0, 30, 0])],
        segments: [
          {
            id: "seg_1", derived: false, from: "end_a", to: "bp_1", wires: ["w_ex"], diameterNm: 3_000_000, assumedGauge: true,
            samplesNm: line([0, 10, 0], [0, 20, 0], 4), lengthNm: 10 * NM, minRadiusAllowedNm: 18 * NM,
            tightBend: { at: at(0, 18 * NM), radiusNm: 8 * NM },
            clearances: [{ occurrence: "occ_c", at: at(0, 15 * NM), distanceNm: 300_000, neededNm: 2_500_000 }],
          },
          {
            id: "seg_2", derived: false, from: "bp_1", to: "end_b", wires: [], diameterNm: 3_000_000, assumedGauge: false,
            samplesNm: line([0, 20, 0], [0, 30, 0], 4), lengthNm: 10 * NM, minRadiusAllowedNm: 18 * NM, clearances: [],
          },
        ],
        wires: [],
      },
    }],
  } as unknown as SystemBundle;
}

/** A derived single segment between the two ends (nothing stored yet). */
function derivedDocument(): SystemDocument {
  const document = storedDocument();
  document.harnesses[0].branchPoints = [];
  document.harnesses[0].segments = [];
  document.harnesses[0].waypoints = [];
  return document;
}

function derivedBundle(): SystemBundle {
  const bundle = storedBundle();
  const route = bundle.harnesses![0].route!;
  route.derived = true;
  route.segments = [{
    id: "har_1/end_a~end_b", derived: true, from: "end_a", to: "end_b", wires: [], diameterNm: 3_000_000, assumedGauge: false,
    samplesNm: line([0, 10, 0], [0, 30, 0], 8), lengthNm: 20 * NM, minRadiusAllowedNm: 18 * NM, clearances: [],
  }];
  return bundle;
}

/** A stand-in for the viewer element: records what the pane asks of it. */
class FakeViewer extends HTMLElement {
  calls: Record<string, unknown[][]> = {};
  record = (name: string) => (...args: unknown[]) => {
    (this.calls[name] ??= []).push(args);
  };
  setSystemScene = this.record("setSystemScene");
  setMoveSnap = this.record("setMoveSnap");
  setAssemblyExplode = this.record("setAssemblyExplode");
  setLabelsVisible = this.record("setLabelsVisible");
  setShowComponents = this.record("setShowComponents");
  setSeparation = this.record("setSeparation");
  setSelection = this.record("setSelection");
  setMoveMode = this.record("setMoveMode");
  setRouteMode = this.record("setRouteMode");
  cancelMove = this.record("cancelMove");
  frameAll = this.record("frameAll");
}

beforeAll(() => {
  if (!customElements.get("prism-semantic-viewer")) customElements.define("prism-semantic-viewer", FakeViewer);
});

const viewer = () => document.querySelector("prism-semantic-viewer") as unknown as FakeViewer;
const emit = (type: string, detail: unknown) => act(() => {
  viewer().dispatchEvent(new CustomEvent(type, { detail }));
});

interface Setup {
  derived?: boolean;
  initial?: string[];
}

function setup({ derived = false, initial = [] }: Setup = {}) {
  const apply = vi.fn<(ops: SystemOp[]) => Promise<unknown>>(async () => undefined);
  const onSelect = vi.fn();
  const document = derived ? derivedDocument() : storedDocument();
  const bundle = derived ? derivedBundle() : storedBundle();
  function Pane() {
    const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));
    return (
      <ThreeDPane
        document={document}
        bundle={bundle}
        projectNames={{ prj_1: "carrier" }}
        selected={selected}
        onSelect={(ids) => { onSelect(ids); setSelected(ids); }}
        canEdit
        busy={false}
        apply={apply}
      />
    );
  }
  render(<Pane />);
  return { apply, onSelect };
}

const drag = (phase: string, target: { kind: string; id: string }, pointMm: [number, number, number], fromMm: [number, number, number] = [0, 3, 0]) => ({
  type: "drag", phase, harness: "har_1", target, fromMm, pointMm,
});

const select = (target: { kind: string; id: string }, shiftKey = false) => ({
  type: "select", harness: "har_1", shiftKey, pointMm: [0, 15, 0], ...target,
});

describe("the Route tool", () => {
  it("turns route mode on and off from the toolbar", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Route \(R\)/ }));
    await vi.waitFor(() => expect(viewer().calls.setRouteMode).toContainEqual([true]));
    fireEvent.click(screen.getByRole("button", { name: /Route \(R\)/ }));
    await vi.waitFor(() => expect(viewer().calls.setRouteMode?.at(-1)).toEqual([false]));
  });

  it("selects the tube the viewer picked, and Shift adds to the selection", () => {
    const { onSelect } = setup();
    emit("prism-semantic-viewer:harness-select", select({ kind: "segment", id: "seg_1" }));
    expect(onSelect).toHaveBeenCalledWith(new Set(["seg_1"]));
    emit("prism-semantic-viewer:harness-select", select({ kind: "waypoint", id: "w1" }, true));
    expect(onSelect).toHaveBeenLastCalledWith(new Set(["seg_1", "w1"]));
  });

  it("stores a dropped tube as one add-waypoint request", async () => {
    const { apply } = setup();
    emit("prism-semantic-viewer:harness-drag", drag("start", { kind: "segment", id: "seg_1" }, [0, 3, 0]));
    emit("prism-semantic-viewer:harness-drag", drag("move", { kind: "segment", id: "seg_1" }, [0, 12, 0]));
    emit("prism-semantic-viewer:harness-drag", drag("end", { kind: "segment", id: "seg_1" }, [0, 12, 0]));
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    const ops = apply.mock.calls[0][0];
    const added = ops.find((op) => op.kind === "add-waypoint");
    expect(added).toMatchObject({ kind: "add-waypoint", harness: "har_1", waypoint: { segment: "seg_1", position: at(0, 12 * NM) } });
  });

  it("stores a derived tree before adding a waypoint to its segment", async () => {
    const { apply } = setup({ derived: true });
    emit("prism-semantic-viewer:harness-drag", drag("start", { kind: "segment", id: "har_1/end_a~end_b" }, [0, 20, 0]));
    emit("prism-semantic-viewer:harness-drag", drag("end", { kind: "segment", id: "har_1/end_a~end_b" }, [0, 20, 0]));
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply.mock.calls[0][0].map((op) => op.kind)).toEqual(["add-segment", "add-waypoint"]);
  });

  it("moves a dragged waypoint with replace-waypoint", async () => {
    const { apply } = setup({ initial: ["w1"] });
    emit("prism-semantic-viewer:harness-drag", drag("start", { kind: "waypoint", id: "w1" }, [0, 13, 0], [0, 13, 0]));
    emit("prism-semantic-viewer:harness-drag", drag("move", { kind: "waypoint", id: "w1" }, [2, 13, 0], [0, 13, 0]));
    emit("prism-semantic-viewer:harness-drag", drag("end", { kind: "waypoint", id: "w1" }, [2, 13, 0], [0, 13, 0]));
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply.mock.calls[0][0]).toEqual([
      { kind: "replace-waypoint", harness: "har_1", waypoint: { id: "w1", segment: "seg_1", position: at(2 * NM, 13 * NM), order: 0 } },
    ]);
  });

  it("sends nothing when a drag is cancelled", () => {
    const { apply } = setup();
    emit("prism-semantic-viewer:harness-drag", drag("start", { kind: "segment", id: "seg_1" }, [0, 3, 0]));
    emit("prism-semantic-viewer:harness-drag", drag("cancel", { kind: "segment", id: "seg_1" }, [0, 3, 0]));
    expect(apply).not.toHaveBeenCalled();
  });

  it("shows the selected waypoint and commits a typed Z on Enter", async () => {
    const { apply } = setup();
    emit("prism-semantic-viewer:harness-select", select({ kind: "waypoint", id: "w1" }));
    expect(screen.getByRole("group", { name: "Route" })).toBeInTheDocument();
    const z = screen.getByLabelText("Z");
    expect(z).toHaveValue("0.00");
    fireEvent.change(z, { target: { value: "16" } });
    fireEvent.keyDown(z, { key: "Enter" });
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply.mock.calls[0][0]).toEqual([
      { kind: "replace-waypoint", harness: "har_1", waypoint: { id: "w1", segment: "seg_1", position: at(0, 13 * NM, 16 * NM), order: 0 } },
    ]);
  });

  it("straightens the selected segment by removing its waypoints", async () => {
    const { apply } = setup();
    emit("prism-semantic-viewer:harness-select", select({ kind: "segment", id: "seg_1" }));
    fireEvent.click(screen.getByRole("button", { name: "Straighten segment" }));
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply.mock.calls[0][0]).toEqual([{ kind: "remove-waypoint", harness: "har_1", id: "w1" }]);
  });

  it("hides the tubes from the View card's Harnesses toggle", async () => {
    setup();
    await vi.waitFor(() => expect(viewer().calls.setSystemScene?.length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Harnesses" }));
    await vi.waitFor(() => {
      const scene = viewer().calls.setSystemScene!.at(-1)![0] as { showHarnesses: boolean };
      expect(scene.showHarnesses).toBe(false);
    });
  });
});
