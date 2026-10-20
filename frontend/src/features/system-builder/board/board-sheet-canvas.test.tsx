import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import { BoardSheetCanvas } from "./board-sheet-canvas";

const DOCUMENT = {
  schema: "prism.system.v2", name: "S", sheets: [], subPorts: [], dismissedSuggestions: [], bodyConnectors: [], mates: [], harnesses: [], exports: [], waivers: [], layout: {},
  occurrences: [{ id: "occ_c", label: "Carrier", source: { kind: "board", projectId: "prj_000000000001", track: { kind: "pinned", commit: "a".repeat(40) } } }],
} as unknown as SystemDocument;
const pin = (pad: string, net: string, power = false) => ({ pad, net, nets: [net], power });
const BUNDLE = {
  occurrences: [{ occurrence: "occ_c", state: "ready", connectors: [{ refdes: "J2201", value: "", candidate: true, placement: { angleDeg: 180, side: "top" },
    pins: [pin("1", "GND", true), pin("3", "/SOM/FAN_TACH_3V3"), pin("4", "/SOM/FAN_PWM_3V3")] }] }],
  suggestions: [],
} as unknown as SystemBundle;

beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => undefined;
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

const wire = (pad: string) => document.querySelector(`[data-hit="wire"][data-id="J2201"][data-key="${pad}"] polyline`) as Element;

describe("BoardSheetCanvas", () => {
  it("groups selected wires with G as a proposed sub-port and folds on request", async () => {
    const apply = vi.fn<(ops: SystemOp[]) => Promise<undefined>>(async () => undefined);
    const onUnfoldedChange = vi.fn();
    render(
      <BoardSheetCanvas unfolded={new Set(["J2201"])} onUnfoldedChange={onUnfoldedChange} document={DOCUMENT} bundle={BUNDLE} occurrence="occ_c" canEdit apply={apply} onLeave={vi.fn()} />,
    );
    fireEvent.pointerDown(wire("3"), { button: 0, pointerId: 1 });
    fireEvent.pointerUp(screen.getByRole("application"), { pointerId: 1 });
    fireEvent.pointerDown(wire("4"), { button: 0, shiftKey: true, pointerId: 1 });
    fireEvent.pointerUp(screen.getByRole("application"), { pointerId: 1 });
    fireEvent.keyDown(screen.getByRole("application"), { key: "g" });
    expect(screen.getByLabelText("Sub-port name")).toHaveValue("FAN");
    fireEvent.click(screen.getByRole("button", { name: "Group and fold" }));
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply.mock.calls[0][0]).toEqual([
      { kind: "add-sub-port", subPort: expect.objectContaining({ occurrence: "occ_c", connector: "J2201", name: "FAN", pins: ["3", "4"] }) },
    ]);
    expect(onUnfoldedChange).toHaveBeenCalledWith(new Set());
  });

  it("leaves with Alt+Backspace", () => {
    const onLeave = vi.fn();
    render(<BoardSheetCanvas unfolded={new Set()} onUnfoldedChange={vi.fn()} document={DOCUMENT} bundle={BUNDLE} occurrence="occ_c" canEdit apply={vi.fn()} onLeave={onLeave} />);
    fireEvent.keyDown(screen.getByRole("application"), { key: "Backspace", altKey: true });
    expect(onLeave).toHaveBeenCalled();
  });
});
