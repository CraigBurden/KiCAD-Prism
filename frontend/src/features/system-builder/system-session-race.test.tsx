import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { updateLink } from "@/lib/systems-api";

import { systemDocument } from "./test-fixtures";
import { useSystemDocument } from "./use-system-document";
import { useSystemMutation } from "./use-system-mutation";

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

function Surface({ name, etag, reload }: { name: string; etag: string; reload: () => Promise<void> }) {
  const { run } = useSystemMutation(reload);
  return <button type="button" onClick={() => void run(name, () => updateLink("sys_1", etag, "L1", { name }))}>{name}</button>;
}

function Page() {
  const state = useSystemDocument("sys_1");
  if (!state.etag) return null;
  return <><Surface name="diagram" etag={state.etag} reload={state.reload} /><Surface name="inspector" etag={state.etag} reload={state.reload} /></>;
}

describe("two surfaces editing one system (AC-15)", () => {
  it.fails("never sends the same ETag twice: the second edit waits for the first one's re-read", async () => {
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
