import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PinnedModelFact, useConversionsSettled } from "./pinned-model";
import { renderInSession } from "./session/memory-session";
import { instance, systemDocument } from "./test-fixtures";

afterEach(() => vi.unstubAllGlobals());

function Probe({ converting }: { converting: number }) {
  useConversionsSettled(converting);
  return <PinnedModelFact componentId="cmp" revisionId="rev_1" canConvert={false} />;
}

describe("pinned models", () => {
  it("re-reads a pinned revision's models once the scene's conversions settle", async () => {
    let converted = false;
    const fetch = vi.fn(async () => new Response(JSON.stringify({ items: [{ assetId: "m", glb: converted ? { key: "k" } : null }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const document = systemDocument([instance("ENC")]);
    const view = renderInSession(<Probe converting={1} />, { document });
    expect(await screen.findByText("Not converted")).toBeTruthy();
    converted = true;
    view.rerender(<Probe converting={1} />);
    expect(fetch).toHaveBeenCalledTimes(1);
    view.rerender(<Probe converting={0} />);
    expect(await screen.findByText("Converted")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
