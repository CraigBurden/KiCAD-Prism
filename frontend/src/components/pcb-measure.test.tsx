import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EcadViewer } from "@/lib/ecad-viewer";
import { fakeEcadViewer } from "@/test/fake-ecad-viewer";
import type { EcadMeasureState } from "@/types/ecad-viewer";
import { EcadViewerControls } from "./ecad-viewer-controls";
import { MEASURE_UNITS_STORAGE_KEY, MeasureReadout, formatLength } from "./pcb-measure";

/** The board adapter over a fake element with measure mode. */
function measured() {
  const element = fakeEcadViewer({ measure: true, pcb: null });
  const viewer = new EcadViewer("pcb");
  viewer.attach(element);
  return { element, viewer };
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
    const { element, viewer } = measured();
    const view = render(<EcadViewerControls context="PCB" viewer={viewer} />);
    const toggle = view.getByRole("button", { name: "Measure" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.getAttribute("title")).toMatch(/^Measure · (⌘|Ctrl)⇧M$/);
    fireEvent.click(toggle);
    expect(element.setMeasureMode).toHaveBeenCalledWith(true);
    expect(view.getByRole("button", { name: "Measure" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("follows the key", () => {
    const { element, viewer } = measured();
    const view = render(<EcadViewerControls context="PCB" viewer={viewer} />);
    act(() => element.setMeasureMode!(true));
    expect(view.getByRole("button", { name: "Measure" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("is not offered on the schematic", () => {
    const { viewer } = measured();
    const view = render(<EcadViewerControls context="SCH" viewer={viewer} />);
    expect(view.queryByRole("button", { name: "Measure" })).toBeNull();
  });
});

describe("measure readout", () => {
  it("is hidden until measure mode is on, then shows a dash", () => {
    const { element, viewer } = measured();
    const view = render(<MeasureReadout viewer={viewer} />);
    expect(view.queryByRole("region", { name: "Measure" })).toBeNull();
    act(() => element.setMeasureMode!(true));
    expect(view.getByLabelText("Distance").textContent).toBe("—");
  });

  it("shows the ends, the distance and the deltas, in mm then mil", () => {
    const { element, viewer } = measured();
    const view = render(<MeasureReadout viewer={viewer} />);
    act(() => element.setMeasureMode!(true));
    act(() => element.measure(DONE));
    const region = view.getByRole("region", { name: "Measure" });
    expect(region.textContent).toContain("U1 · 25 → via");
    expect(view.getByLabelText("Distance").textContent).toBe("7.642 mm");
    expect(region.textContent).toContain("ΔX 6.275");
    expect(region.textContent).toContain("ΔY 4.362");
    expect(region.textContent).toContain("∠ 34.81°");

    fireEvent.click(view.getByRole("button", { name: "mil" }));
    expect(view.getByLabelText("Distance").textContent).toBe("300.9 mil");
    expect(element.setMeasureUnits).toHaveBeenLastCalledWith("mil");
    expect(window.localStorage.getItem(MEASURE_UNITS_STORAGE_KEY)).toBe("mil");
  });

  it("starts in the stored units and gives them to the element as the mode turns on", () => {
    window.localStorage.setItem(MEASURE_UNITS_STORAGE_KEY, "mil");
    const { element, viewer } = measured();
    const view = render(<MeasureReadout viewer={viewer} />);
    expect(element.setMeasureUnits).not.toHaveBeenCalled();
    act(() => element.setMeasureMode!(true));
    expect(element.setMeasureUnits).toHaveBeenCalledWith("mil");
    expect(view.getByRole("button", { name: "mil" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("closes the mode from its button", () => {
    const { element, viewer } = measured();
    const view = render(<MeasureReadout viewer={viewer} />);
    act(() => element.setMeasureMode!(true));
    fireEvent.click(view.getByRole("button", { name: "Leave measure mode" }));
    expect(element.setMeasureMode).toHaveBeenLastCalledWith(false);
    expect(view.queryByRole("region", { name: "Measure" })).toBeNull();
  });

  it("formats 3 decimals in mm and 1 in mil", () => {
    expect(formatLength(7.640941, "mm")).toBe("7.641");
    expect(formatLength(7.640941, "mil")).toBe("300.8");
  });
});
