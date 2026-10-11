import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ECadViewerElement, EcadMeasureState } from "@/types/ecad-viewer";
import { EcadViewerControls } from "./ecad-viewer-controls";
import { MEASURE_UNITS_STORAGE_KEY, MeasureReadout, formatLength } from "./pcb-measure";

/** The slice of <ecad-viewer> measure mode talks to. */
function stubMeasureViewer() {
  const target = new EventTarget();
  const viewer = {
    measureMode: false,
    measureState: null as EcadMeasureState | null,
    setMeasureMode: vi.fn((on: boolean) => {
      viewer.measureMode = on;
      if (!on) viewer.measureState = null;
      target.dispatchEvent(new CustomEvent("ecad-viewer:measure-mode", { detail: { on } }));
    }),
    setMeasureUnits: vi.fn(),
    emit(state: EcadMeasureState) {
      viewer.measureState = state;
      target.dispatchEvent(new CustomEvent("ecad-viewer:measure", { detail: state }));
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    getPcbViewState: () => null,
  };
  return viewer as unknown as ECadViewerElement & {
    measureMode: boolean;
    setMeasureMode: ReturnType<typeof vi.fn>;
    setMeasureUnits: ReturnType<typeof vi.fn>;
    emit(state: EcadMeasureState): void;
  };
}

// U1 pad 25 to a GND via on USB-PD, as the element reports it.
const DONE: EcadMeasureState = {
  phase: "done",
  measurement: {
    a: { kind: "pad", x: 119.025, y: 106.3625, label: "U1 · 25", net: "GND" },
    b: { kind: "via", x: 125.3, y: 102, label: "via", net: "GND" },
    distance: Math.hypot(6.275, 4.3625),
    dx: 6.275,
    dy: 4.3625,
    angle: (Math.atan2(4.3625, 6.275) * 180) / Math.PI,
  },
  hover: null,
};

afterEach(() => window.localStorage.removeItem(MEASURE_UNITS_STORAGE_KEY));

describe("measure toggle", () => {
  it("sits in the PCB rail, mirrors the element and toggles it", () => {
    const viewer = stubMeasureViewer();
    const view = render(<EcadViewerControls context="PCB" viewer={viewer} />);
    const toggle = view.getByRole("button", { name: "Measure" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.getAttribute("title")).toMatch(/^Measure · (⌘|Ctrl)⇧M$/);
    fireEvent.click(toggle);
    expect(viewer.setMeasureMode).toHaveBeenCalledWith(true);
    expect(view.getByRole("button", { name: "Measure" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("follows the key", () => {
    const viewer = stubMeasureViewer();
    const view = render(<EcadViewerControls context="PCB" viewer={viewer} />);
    act(() => viewer.setMeasureMode(true));
    expect(view.getByRole("button", { name: "Measure" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("is not offered on the schematic", () => {
    const viewer = stubMeasureViewer();
    const view = render(<EcadViewerControls context="SCH" viewer={viewer} />);
    expect(view.queryByRole("button", { name: "Measure" })).toBeNull();
  });
});

describe("measure readout", () => {
  it("is hidden until measure mode is on, then shows a dash", () => {
    const viewer = stubMeasureViewer();
    const view = render(<MeasureReadout viewer={viewer} />);
    expect(view.queryByRole("region", { name: "Measure" })).toBeNull();
    act(() => viewer.setMeasureMode(true));
    expect(view.getByLabelText("Distance").textContent).toBe("—");
  });

  it("shows the ends, the distance and the deltas, in mm then mil", () => {
    const viewer = stubMeasureViewer();
    const view = render(<MeasureReadout viewer={viewer} />);
    act(() => viewer.setMeasureMode(true));
    act(() => viewer.emit(DONE));
    const region = view.getByRole("region", { name: "Measure" });
    expect(region.textContent).toContain("U1 · 25 → via");
    expect(view.getByLabelText("Distance").textContent).toBe("7.642 mm");
    expect(region.textContent).toContain("ΔX 6.275");
    expect(region.textContent).toContain("ΔY 4.362");
    expect(region.textContent).toContain("∠ 34.81°");

    fireEvent.click(view.getByRole("button", { name: "mil" }));
    expect(view.getByLabelText("Distance").textContent).toBe("300.9 mil");
    expect(viewer.setMeasureUnits).toHaveBeenLastCalledWith("mil");
    expect(window.localStorage.getItem(MEASURE_UNITS_STORAGE_KEY)).toBe("mil");
  });

  it("starts in the stored units and gives them to the element as the mode turns on", () => {
    window.localStorage.setItem(MEASURE_UNITS_STORAGE_KEY, "mil");
    const viewer = stubMeasureViewer();
    const view = render(<MeasureReadout viewer={viewer} />);
    expect(viewer.setMeasureUnits).not.toHaveBeenCalled();
    act(() => viewer.setMeasureMode(true));
    expect(viewer.setMeasureUnits).toHaveBeenCalledWith("mil");
    expect(view.getByRole("button", { name: "mil" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("closes the mode from its button", () => {
    const viewer = stubMeasureViewer();
    const view = render(<MeasureReadout viewer={viewer} />);
    act(() => viewer.setMeasureMode(true));
    fireEvent.click(view.getByRole("button", { name: "Leave measure mode" }));
    expect(viewer.setMeasureMode).toHaveBeenLastCalledWith(false);
    expect(view.queryByRole("region", { name: "Measure" })).toBeNull();
  });

  it("formats 3 decimals in mm and 1 in mil", () => {
    expect(formatLength(7.640941, "mm")).toBe("7.641");
    expect(formatLength(7.640941, "mil")).toBe("300.8");
  });
});
