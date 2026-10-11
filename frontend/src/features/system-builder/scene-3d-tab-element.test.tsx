import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defineFakeSemanticViewer, mountedSemanticViewer } from "@/test/fake-semantic-viewer";

import { Scene3dTab } from "./scene-3d-tab";
import { renderInSession } from "./session/memory-session";
import { instance, systemDocument } from "./test-fixtures";

// With the element defined (as the viewer bundle does), its ref runs on every
// render. Nothing it calls may set state, or the tab re-renders forever (SB2-31
// froze the page this way through the emphasis report).
defineFakeSemanticViewer();

afterEach(() => vi.unstubAllGlobals());

describe("Scene3dTab with the viewer element defined", () => {
  it("settles instead of re-rendering forever", async () => {
    vi.stubGlobal("navigator", { ...navigator, gpu: {} });
    const scene = { schema: "prism.system_scene.a0", systemId: "sys_1", systemVersion: 3, units: "mm", assets: [], occurrences: [] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(scene), { status: 200, headers: { "Content-Type": "application/json" } })));
    const document = systemDocument([instance("OBC-1")]);
    renderInSession(<Scene3dTab systemId="sys_1" document={document} canEdit user={null} onNavigate={vi.fn()} />, { document });
    await screen.findByTitle(/^0 boards/);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    const calls = mountedSemanticViewer().setNetEmphasis.mock.calls;
    const settled = calls.length;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(calls.length).toBe(settled);
    expect(settled).toBeLessThan(20);
  });
});
