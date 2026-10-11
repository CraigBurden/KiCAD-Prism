import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SystemSessionProvider, useOpenSystemSession, useSessionState, useSystemSession } from "./session/use-system-session";
import { systemDocument } from "./test-fixtures";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

/**
 * A server holding one system: a GET returns the current version, and a PATCH applies only when its
 * If-Match is that version (else 412). PATCHes wait until the test lets them through, so two edits
 * can be in flight together.
 */
function fakeServer() {
  let version = 1;
  const etag = () => `"sys:sys_1:${version}"`;
  const statuses: number[] = [];
  const held: (() => void)[] = [];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.method || init.method === "GET") {
      return new Response(JSON.stringify(systemDocument([])), { status: 200, headers: { "Content-Type": "application/json", ETag: etag() } });
    }
    await new Promise<void>((release) => held.push(release));
    const ifMatch = new Headers(init.headers).get("If-Match");
    if (ifMatch !== etag()) {
      statuses.push(412);
      return new Response(JSON.stringify({ detail: "stale" }), { status: 412, headers: { "Content-Type": "application/json", ETag: etag() } });
    }
    version += 1;
    statuses.push(200);
    return new Response(JSON.stringify({ id: "L1" }), { status: 200, headers: { "Content-Type": "application/json", ETag: etag() } });
  });
  return { fetchMock, statuses, release: () => held.shift()?.() };
}

function Surface({ name }: { name: string }) {
  const { edit } = useSystemSession();
  return <button type="button" onClick={() => void edit(name, (system) => system.updateLink("L1", { name }))}>{name}</button>;
}

function Page() {
  const session = useOpenSystemSession("sys_1");
  const state = useSessionState(session);
  if (!state.etag) return null;
  return <SystemSessionProvider session={session}><Surface name="diagram" /><Surface name="inspector" /></SystemSessionProvider>;
}

describe("two surfaces editing one system (AC-15)", () => {
  it("never sends the same ETag twice: the second edit waits for the first one's re-read", async () => {
    const server = fakeServer();
    vi.stubGlobal("fetch", server.fetchMock);
    render(<Page />);
    fireEvent.click(await screen.findByRole("button", { name: "diagram" }));
    fireEvent.click(screen.getByRole("button", { name: "inspector" }));
    for (let step = 0; step < 4; step += 1) {
      await act(async () => {
        server.release();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    await waitFor(() => expect(server.statuses.length).toBe(2));
    expect(server.statuses).toEqual([200, 200]);
  });
});
