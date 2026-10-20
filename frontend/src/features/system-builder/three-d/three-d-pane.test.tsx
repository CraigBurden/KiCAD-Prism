import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import { ThreeDPane } from "./three-d-pane";

vi.mock("@/lib/api", () => ({
  fetchJson: vi.fn(async () => ({ status: "ready", bundle_url: "/api/projects/prj_1/webgpu-3d/bundle.json" })),
}));

const COMMIT = "b".repeat(40);
const source = (projectId: string) => ({ kind: "board" as const, projectId, track: { kind: "pinned" as const, commit: COMMIT } });
const DOCUMENT = {
  schema: "prism.system.v2", name: "S", sheets: [], subPorts: [], dismissedSuggestions: [], bodyConnectors: [], harnesses: [], exports: [], waivers: [], layout: {},
  occurrences: [{ id: "occ_c", label: "Carrier", source: source("prj_1") }, { id: "occ_s", label: "SoM", source: source("prj_2") }],
  mates: [{ id: "mate_1", a: { occurrence: "occ_c", connector: "J202" }, b: { occurrence: "occ_s", connector: "J1" }, orientation: { quarterTurns: 0, flip: false }, rows: {} }],
} as unknown as SystemDocument;
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const BUNDLE = {
  placement: {
    occurrences: [
      { occurrence: "occ_c", pose: { translation: { xNm: 0, yNm: 0, zNm: 0 }, rotation: IDENTITY }, source: "default", root: true },
      { occurrence: "occ_s", pose: { translation: { xNm: 0, yNm: 0, zNm: 7e6 }, rotation: IDENTITY }, source: "mate", root: false, positioningMate: "mate_1" },
    ],
    mates: [{ mate: "mate_1", driving: true, stackHeightNm: 7e6, heightSource: "stack-height", frameA: { translation: { xNm: 0, yNm: 0, zNm: 0 }, rotation: IDENTITY } }],
  },
} as unknown as SystemBundle;

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

function setup() {
  const apply = vi.fn<(ops: SystemOp[]) => Promise<unknown>>(async () => undefined);
  const onSelect = vi.fn();
  const view = render(<ThreeDPane document={DOCUMENT} bundle={BUNDLE} projectNames={{ prj_1: "carrier" }} selected={new Set(["occ_s"])} onSelect={onSelect} canEdit busy={false} apply={apply} />);
  return { apply, onSelect, view };
}

describe("ThreeDPane", () => {
  it("hands the viewer the placed scene and shows the other pane's selection", async () => {
    setup();
    await vi.waitFor(() => expect(viewer().calls.setSystemScene?.length).toBeGreaterThan(0));
    const scene = viewer().calls.setSystemScene!.at(-1)![0] as { occurrences: { path: string; movable: boolean }[] };
    expect(scene.occurrences.map((item) => [item.path, item.movable])).toEqual([["occ_c", true], ["occ_s", false]]);
    await vi.waitFor(() => expect(viewer().calls.setSelection).toContainEqual([{ occurrence: "occ_s" }]));
    expect(viewer().getAttribute("move-allowed")).toBe("true");
  });

  it("selects the occurrence the viewer picked", () => {
    const { onSelect } = setup();
    emit("prism-semantic-viewer:selectionchange", { selection: { kind: "board", sourceContext: "3D", occurrence: "occ_c" } });
    expect(onSelect).toHaveBeenCalledWith(new Set(["occ_c"]));
    emit("prism-semantic-viewer:selectionchange", { selection: null });
    expect(onSelect).toHaveBeenLastCalledWith(new Set());
  });

  it("stores a committed drag as the occurrence's pose", async () => {
    const { apply } = setup();
    const pose = { translationMm: [12, 0, 0], rotation: [0, 0, 0, 1] };
    emit("prism-semantic-viewer:move", {
      phase: "commit", allowed: true, enabled: true, space: "world", dragging: false,
      target: { occurrence: "occ_c", instanceId: "occ_c", displayPath: "Carrier", kind: "board", restricted: false, pose, source: "manual", unsaved: true },
    });
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply.mock.calls[0][0]).toEqual([{ kind: "replace-occurrence", occurrence: expect.objectContaining({ id: "occ_c", pose: { translation: { xNm: 12_000_000, yNm: 0, zNm: 0 }, rotation: IDENTITY } }) }]);
  });

  it("shows how a mated board is placed and offers its positioning mate", () => {
    setup();
    // In "Placed by" and as the dropdown's option.
    expect(screen.getAllByText("J202 ↔ J1")).toHaveLength(2);
    expect(screen.getByRole("option", { name: "J202 ↔ J1" })).toBeInTheDocument();
    expect(screen.getByText("7.00 mm")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("passes the explode to the viewer", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Assembly explode"), { target: { value: "60" } });
    await vi.waitFor(() => expect(viewer().calls.setAssemblyExplode).toContainEqual([0.6]));
  });
});
