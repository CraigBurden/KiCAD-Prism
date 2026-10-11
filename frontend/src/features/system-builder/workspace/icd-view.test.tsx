import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderInSession } from "../session/memory-session";
import { systemDocument } from "../test-fixtures";
import { IcdView } from "./icd-view";

const document = systemDocument([]);

afterEach(() => vi.unstubAllGlobals());

describe("IcdView", () => {
  it("reads the live ICD through the API and shows it in a frame that runs no scripts", async () => {
    const fetch = vi.fn<(url: string) => Promise<Response>>(async () => new Response("<!DOCTYPE html><html><head></head><body><h1>ICD</h1></body></html>",
      { headers: { "Content-Type": "text/html" } }));
    vi.stubGlobal("fetch", fetch);
    renderInSession(<IcdView systemId="sys_1" />, { document });
    const frame = await screen.findByTitle("Interface control document");
    expect(frame).toHaveAttribute("srcdoc", expect.stringContaining("<h1>ICD</h1>"));
    // Same-origin so the page can theme and scale it; no allow-scripts, so nothing in it runs.
    expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    expect(fetch.mock.calls[0][0]).toBe("/api/systems/sys_1/icd.html");
    expect(screen.getByRole("link", { name: "Open in a new tab" })).toHaveAttribute("href", "/api/systems/sys_1/icd.html");
    expect(screen.getByRole("link", { name: "CSV" })).toHaveAttribute("href", "/api/systems/sys_1/icd.csv");
  });

  it("says why when the ICD cannot be generated", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "System not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } })));
    renderInSession(<IcdView systemId="sys_1" />, { document });
    expect(await screen.findByText(/System not found/)).toBeInTheDocument();
  });
});
