import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import type { PrismSemanticViewerElement } from "@/types/prism-semantic-viewer";
import type { SystemScene } from "@/types/system";

import { memorySystem } from "./session/memory-session";
import { SystemSession } from "./session/system-session";
import { SystemSessionProvider } from "./session/use-system-session";
import { systemDocument } from "./test-fixtures";
import { useHarnessNodes } from "./use-harness-nodes";

const scene = { harnesses: [{ id: "hrn_1", level: null, nodes: [] }] } as unknown as SystemScene;

function harnessEvent(viewer: EventTarget, detail: Record<string, unknown>) {
  act(() => {
    viewer.dispatchEvent(new CustomEvent("prism-semantic-viewer:harness", { detail }));
  });
}

/** The hook in a session over an in-memory system; answers what the session saved. */
function renderNodes(viewer: PrismSemanticViewerElement) {
  const document = systemDocument([]);
  const memory = memorySystem(document);
  const session = new SystemSession("sys_1", memory.transport, { document, etag: memory.etag() });
  const wrapper = ({ children }: { children: ReactNode }) => <SystemSessionProvider session={session}>{children}</SystemSessionProvider>;
  renderHook(() => useHarnessNodes(viewer, scene), { wrapper });
  return memory;
}

describe("useHarnessNodes in Route mode (D-P2-53)", () => {
  it("saves a breakout where an Alt-drag on the harness is released", async () => {
    const viewer = new EventTarget() as unknown as PrismSemanticViewerElement;
    const memory = renderNodes(viewer);
    const picked = { harness: { id: "hrn_1", level: null, name: "PERF-01" }, segment: null, pointMm: [1, 2, 3], node: null, editable: true };
    harnessEvent(viewer, { phase: "select", ...picked });
    harnessEvent(viewer, { phase: "route-drag", ...picked, atMm: [1, 2, 3], positionMm: [4, 5, 6], breakout: true });
    await waitFor(() => expect(memory.calls).toHaveLength(1));
    expect(memory.calls[0]).toEqual({ name: "setHarnessNodes", args: ["hrn_1", [expect.objectContaining({ kind: "breakout", positionMm: [4, 5, 6] })]] });
    // The in-memory system refuses a stale ETag, so the save landing moved it on.
    expect(memory.etag()).toBe('"sys:sys_1:2"');
  });

  it("saves a waypoint where a drag on the harness is released, on the segment it started on", async () => {
    const viewer = new EventTarget() as unknown as PrismSemanticViewerElement;
    const memory = renderNodes(viewer);
    const picked = { harness: { id: "hrn_1", level: null, name: "PERF-01" }, pointMm: [5, 0, 0], node: null, editable: true,
      segment: { id: "seg", from: "end_a", to: "end_b", samplesMm: [[0, 0, 0], [10, 0, 0]] } };
    harnessEvent(viewer, { phase: "select", ...picked });
    harnessEvent(viewer, { phase: "route-drag", ...picked, atMm: [5, 0, 0], positionMm: [5, 0, 20], breakout: false });
    await waitFor(() => expect(memory.calls).toHaveLength(1));
    expect(memory.calls[0].args[1]).toEqual([
      expect.objectContaining({ kind: "waypoint", positionMm: [5, 0, 20], pinned: true, between: ["end_a", "end_b"] }),
    ]);
  });
});
