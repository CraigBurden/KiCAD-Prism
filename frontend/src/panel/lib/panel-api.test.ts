import { afterEach, describe, expect, it, vi } from "vitest";

import { getComponent, getInlineBundle, getPartManifest } from "./panel-api";


describe("panel representation requests", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes one representation through detail and both placement paths", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ id: "component-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await getComponent("component-1", undefined, "representation-2");
    await getPartManifest("component-1", "representation-2");
    await getInlineBundle("component-1", "representation-2");

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/remote-provider/components/component-1?representation=representation-2",
      "/api/remote-provider/parts/component-1?representation=representation-2",
      "/api/remote-provider/components/component-1/inline?representation=representation-2",
    ]);
  });

  it("preserves default placement for clients that omit representation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await getPartManifest("component-1");
    await getInlineBundle("component-1");

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/remote-provider/parts/component-1",
      "/api/remote-provider/components/component-1/inline",
    ]);
  });
});
