import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SystemHarness } from "@/types/system";

import { HarnessOutputsSection } from "./harness-outputs-section";
import { memorySystem, renderInSession } from "./session/memory-session";
import { systemDocument } from "./test-fixtures";

const document = systemDocument([]);

const harness = {
  id: "shn_1", name: "C&DH power", label: null, cutLengthMm: null, serviceAllowancePct: null, linkable: true,
  ends: [
    { id: "she_a", ordinal: 0, mates: { instanceId: "sin_e", portKey: "p", port: { portKey: "p", reference: "HPDRM J4", libId: null, footprint: null, pinCount: 50 }, resolved: true, redacted: false },
      part: null, pinCount: 50, pinMap: null, bootMm: null, pins: [], matePads: [] },
    { id: "she_b", ordinal: 1, mates: { instanceId: "sin_c", portKey: "q", port: { portKey: "q", reference: "LPDRM J1", libId: null, footprint: null, pinCount: 26 }, resolved: true, redacted: false },
      part: null, pinCount: 26, pinMap: null, bootMm: null, pins: [], matePads: [] },
  ],
  wires: [],
  lengths: { bundleMm: 161.6, estimatedMm: 177.7, allowancePct: 10, complete: true, wires: {},
    segments: [{ id: "she_a~she_b", from: "she_a", to: "she_b", lengthMm: 146.2, wires: [] }] },
  coverings: [{ segmentId: "*", part: null, description: "PET braid" }],
  updatedAt: "2026-10-09T00:00:00Z",
} as unknown as SystemHarness;

describe("harness manufacturing (SB2-110)", () => {
  it("links every output and lists coverings by segment", () => {
    renderInSession(<HarnessOutputsSection systemId="sys_1" harness={harness} editable={false} />, { document });
    const links = screen.getByLabelText("Outputs").querySelectorAll("a");
    expect([...links].map((a) => a.getAttribute("href"))).toEqual(
      ["drawing.svg", "drawing.pdf", "wiring.csv", "bom.csv", "wireviz.yaml"].map((n) => `/api/systems/sys_1/harnesses/shn_1/outputs/${n}`));
    expect(screen.getByLabelText("Coverings").textContent).toContain("Whole bundle");
    expect(screen.getByLabelText("Coverings").textContent).toContain("PET braid");
  });

  it("adds a covering on a segment and saves the list", async () => {
    const memory = memorySystem(document, { edits: { setHarnessCoverings: () => harness } });
    renderInSession(<HarnessOutputsSection systemId="sys_1" harness={harness} editable />, { document, transport: memory.transport });
    fireEvent.click(screen.getByRole("button", { name: "Add covering" }));
    fireEvent.change(screen.getByLabelText("Covering 2 description"), { target: { value: "Heat-shrink" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(memory.calls).toEqual([{ name: "setHarnessCoverings", args: ["shn_1", [
      { segmentId: "*", componentId: null, description: "PET braid" },
      { segmentId: "*", componentId: null, description: "Heat-shrink" }]] }]));
  });
});
