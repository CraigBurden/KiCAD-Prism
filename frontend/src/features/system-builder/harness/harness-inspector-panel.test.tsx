import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { SystemDocument } from "../model/types";
import { HarnessInspector } from "./harness-inspector";
import { buildHarnessView } from "./harness-view";
import { COLLAPSED_KEY } from "./use-inspector-collapse";

const WIDTH_KEY = "prism.system-builder.harness-inspector.width";

function systemDocument(): SystemDocument {
  return {
    schema: "prism.system.v2",
    name: "Stack",
    sheets: [],
    occurrences: [],
    subPorts: [],
    dismissedSuggestions: [],
    bodyConnectors: [],
    mates: [],
    harnesses: [{
      id: "har_h",
      label: "H1",
      ends: [],
      links: [],
      wires: [],
      splices: [],
      branchPoints: [],
      segments: [],
      coverings: [],
      cables: [],
      looseEnds: [],
      markers: [],
      waypoints: [],
    }],
    exports: [],
    waivers: [],
    layout: {},
  };
}

const noop = () => undefined;

function Inspector() {
  const view = buildHarnessView(systemDocument(), null, "har_h");
  if (!view) throw new Error("the fixture harness is missing");
  return (
    <HarnessInspector
      view={view}
      selected={new Set()}
      canEdit={false}
      busy={false}
      onSetWire={noop}
      onConfirmWire={noop}
      onRemove={noop}
      onEditEnd={noop}
    />
  );
}

const collapseButton = () => screen.getByRole("button", { name: "Collapse inspector" });
const expandButton = () => screen.getByRole("button", { name: "Expand inspector" });

beforeEach(() => window.localStorage.clear());

describe("harness inspector panel", () => {
  it("takes its width from the shared resizable panel", () => {
    render(<Inspector />);
    const panel = screen.getByLabelText("Harness inspector");
    expect(panel.style.width).toBe("360px");

    // The handle on the panel's left edge: dragging it left widens the panel.
    fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowLeft" });
    expect(panel.style.width).toBe("376px");
    expect(window.localStorage.getItem(WIDTH_KEY)).toBe("376");
  });

  it("folds to a strip, hiding the inspector's content", () => {
    render(<Inspector />);
    expect(screen.getByText("H1")).toBeTruthy();

    fireEvent.click(collapseButton());

    expect(screen.queryByLabelText("Harness inspector")).toBeNull();
    expect(screen.queryByText("H1")).toBeNull();
    expect(expandButton()).toBeTruthy();
    expect(window.localStorage.getItem(COLLAPSED_KEY)).toBe("true");
  });

  it("expands back from the strip", () => {
    render(<Inspector />);
    fireEvent.click(collapseButton());

    fireEvent.click(expandButton());

    expect(screen.getByLabelText("Harness inspector")).toBeTruthy();
    expect(screen.getByText("H1")).toBeTruthy();
    expect(window.localStorage.getItem(COLLAPSED_KEY)).toBe("false");
  });

  it("remembers a collapsed inspector across a remount", () => {
    const first = render(<Inspector />);
    fireEvent.click(collapseButton());
    first.unmount();

    render(<Inspector />);

    expect(expandButton()).toBeTruthy();
    expect(screen.queryByLabelText("Harness inspector")).toBeNull();
  });

  it("toggles with the ] key", () => {
    render(<Inspector />);

    fireEvent.keyDown(window, { key: "]" });
    expect(expandButton()).toBeTruthy();
    expect(screen.queryByLabelText("Harness inspector")).toBeNull();

    fireEvent.keyDown(window, { key: "]" });
    expect(screen.getByLabelText("Harness inspector")).toBeTruthy();
  });

  it("leaves ] alone while a field has focus", () => {
    render(
      <>
        <Inspector />
        <input aria-label="Probe" />
      </>,
    );

    fireEvent.keyDown(screen.getByLabelText("Probe"), { key: "]" });

    expect(screen.getByLabelText("Harness inspector")).toBeTruthy();
  });
});
