import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import { HarnessPane } from "./harness-pane";

const COMMIT = "c".repeat(40);
const board = (id: string, label: string) => ({
  id,
  label,
  source: { kind: "board" as const, projectId: "prj_000000000001", track: { kind: "pinned" as const, commit: COMMIT } },
});

const PINS = [
  { pad: "1", net: "/PWR/VCC", nets: ["/PWR/VCC"], pinName: "VCC", power: true },
  { pad: "2", net: "/SIG/A", nets: ["/SIG/A"], pinName: "A", power: false },
  { pad: "3", net: "/SIG/B", nets: ["/SIG/B"], pinName: "B", power: false },
  { pad: "4", net: "/SIG/C", nets: ["/SIG/C"], pinName: "C", power: false },
];

function systemDocument(): SystemDocument {
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
        lengthNm: 190_000_000,
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
    { occurrence: "occ_a", state: "ready", connectors: [{ refdes: "J1", value: "QTH-060", candidate: true, pins: PINS }] },
    { occurrence: "occ_b", state: "ready", connectors: [{ refdes: "J2", value: "QTH-060", candidate: true, pins: PINS }] },
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
        { wire: "link_1:2", lengthNm: 100_000_000 },
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

beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => undefined;
  // jsdom has no PointerEvent; without one, fireEvent drops button and coordinates.
  if (!("PointerEvent" in globalThis)) {
    class PointerEventStub extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    (globalThis as { PointerEvent?: unknown }).PointerEvent = PointerEventStub;
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Harness({ apply, canEdit = true }: { apply: (ops: SystemOp[]) => Promise<unknown>; canEdit?: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  return (
    <HarnessPane
      document={systemDocument()}
      bundle={BUNDLE}
      systemId="sys_a"
      harness="har_h"
      canEdit={canEdit}
      busy={false}
      apply={apply}
      selected={selected}
      onSelect={setSelected}
    />
  );
}

const mockApply = () => vi.fn<(ops: SystemOp[]) => Promise<undefined>>(async () => undefined);
const canvas = () => screen.getByTestId("harness-canvas");
const selectWire = (id: string) => fireEvent.pointerDown(screen.getByTestId(`wire-hit-${id}`), { button: 0, clientX: 0, clientY: 0, pointerId: 1 });

describe("HarnessPane", () => {
  it("renders end titles, pin names and the default wires", () => {
    render(<Harness apply={mockApply()} />);
    expect(screen.getByText("J1 · Carrier")).toBeTruthy();
    expect(screen.getByText("J2 · SoM")).toBeTruthy();
    expect(screen.getAllByText("VCC").length).toBe(2);
    const wire = screen.getByTestId("wire-link_1:2");
    expect(wire.getAttribute("stroke-dasharray")).toBe("7 4");
  });

  it("selects a wire and shows its inspector", () => {
    render(<Harness apply={mockApply()} />);
    selectWire("w_ex");
    expect(screen.getByText(/explicit wire/)).toBeTruthy();
    expect(screen.getByLabelText("Gauge")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove wire" })).toBeTruthy();
  });

  it("sets an explicit wire's gauge with replace-wire", async () => {
    const apply = mockApply();
    render(<Harness apply={apply} />);
    selectWire("w_ex");
    fireEvent.change(screen.getByLabelText("Gauge"), { target: { value: "22" } });
    fireEvent.blur(screen.getByLabelText("Gauge"));
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    const ops = apply.mock.calls[0][0];
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: "replace-wire", wire: { id: "w_ex", gaugeAwg: "22", colour: "red" } });
  });

  it("makes a default wire explicit when its gauge changes", async () => {
    const apply = mockApply();
    render(<Harness apply={apply} />);
    selectWire("link_1:2");
    fireEvent.change(screen.getByLabelText("Gauge"), { target: { value: "24" } });
    fireEvent.blur(screen.getByLabelText("Gauge"));
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    const ops = apply.mock.calls[0][0];
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: "add-wire", wire: { gaugeAwg: "24", from: { kind: "contact", end: "end_a", cavity: "2" } } });
  });

  it("removes a default wire by unmapping its side A pad", async () => {
    const apply = mockApply();
    render(<Harness apply={apply} />);
    selectWire("link_1:2");
    fireEvent.click(screen.getByRole("button", { name: "Remove wire" }));
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    const ops = apply.mock.calls[0][0];
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: "replace-link", link: { unmapped: ["2", "3"] } });
  });

  it("adds a splice and its canvas with S", async () => {
    const apply = mockApply();
    render(<Harness apply={apply} />);
    fireEvent.keyDown(canvas(), { key: "s" });
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    const ops = apply.mock.calls[0][0];
    expect(ops.map((op) => op.kind)).toEqual(["add-splice", "set-layout"]);
    expect(ops[0]).toMatchObject({ kind: "add-splice", splice: { method: "crimp", confirmed: true } });
    expect(ops[1]).toMatchObject({ kind: "set-layout", placement: { canvas: expect.objectContaining({ xNm: expect.any(Number) }) } });
  });

  it("opens the end dialog on double-click", () => {
    render(<Harness apply={mockApply()} />);
    fireEvent.doubleClick(screen.getByText("J1 · Carrier"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText("Housing not chosen")).toBeTruthy();
  });

  it("opens the end dialog from the inspector", () => {
    render(<Harness apply={mockApply()} />);
    const card = screen.getByText("J1 · Carrier").closest("g") as Element;
    fireEvent.pointerDown(card, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Edit end…" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("lists the wires in the Wires dialog", async () => {
    render(<Harness apply={mockApply()} />);
    fireEvent.click(screen.getByRole("button", { name: "Wires" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("w_ex")).toBeTruthy();
    expect(screen.getByText("link_1:2")).toBeTruthy();
    expect(screen.getByText("J1 · Carrier · cavity 1 · pad 1 · VCC")).toBeTruthy();
  });

  it("opens the Outputs dialog from the toolbar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ state: "building", files: [], sheets: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(<Harness apply={mockApply()} />);
    fireEvent.click(screen.getByRole("button", { name: "Outputs" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("The system is still building — outputs follow when it is ready")).toBeTruthy();
  });

  it("shows a wire's length: typed, else the 3D route, else an em dash", async () => {
    render(<Harness apply={mockApply()} />);
    fireEvent.click(screen.getByRole("button", { name: "Wires" }));
    const typed = screen.getByText("w_ex").closest("tr") as HTMLElement;
    expect(within(typed).getByText("190")).toBeTruthy();
    expect(within(typed).getByText("typed")).toBeTruthy();
    const routed = screen.getByText("link_1:2").closest("tr") as HTMLElement;
    expect(within(routed).getByText("100")).toBeTruthy();
    expect(within(routed).queryByText("typed")).toBeNull();
    const none = screen.getByText("link_1:3").closest("tr") as HTMLElement;
    expect(within(none).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("reads the route length in the wire inspector and keeps the override", () => {
    render(<Harness apply={mockApply()} />);
    selectWire("w_ex");
    expect(screen.getByText("182.4 mm · from the 3D route")).toBeTruthy();
    expect((screen.getByLabelText("Length") as HTMLInputElement).value).toBe("190");
  });
});
