import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SystemDocument } from "@/types/system";

import { instance, systemDocument } from "../test-fixtures";
import { memorySystem, renderInSession } from "./memory-session";
import { sessionReads } from "./session-reads";
import { PENDING_POLL_MS, SystemSession, type SessionRead } from "./system-session";
import { SystemSessionProvider, useSessionRead, useSystemSession } from "./use-system-session";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

const doc = systemDocument([instance("OBC")]);
const flush = () => act(async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
});

function Surface({ name }: { name: string }) {
  const { busy, edit } = useSystemSession();
  return (
    <button type="button" data-busy={busy ?? ""}
      onClick={() => void edit(name, (system) => system.updateLink("L1", { name }))}>{name}</button>
  );
}

describe("SystemSession edits", () => {
  it("runs two surfaces' edits one after the other, each with the ETag the last one left (AC-15)", async () => {
    const memory = memorySystem(doc);
    renderInSession(<><Surface name="diagram" /><Surface name="inspector" /></>, { document: doc, transport: memory.transport });
    fireEvent.click(screen.getByRole("button", { name: "diagram" }));
    fireEvent.click(screen.getByRole("button", { name: "inspector" }));
    // Both surfaces show the shared edit as busy at once.
    expect(screen.getByRole("button", { name: "inspector" }).dataset.busy).toBe("diagram");
    await waitFor(() => expect(memory.calls).toHaveLength(2));
    await flush();
    expect(memory.calls.map((call) => call.args[1])).toEqual([{ name: "diagram" }, { name: "inspector" }]);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(memory.etag()).toBe('"sys:sys_1:3"');
    expect(screen.getByRole("button", { name: "inspector" }).dataset.busy).toBe("");
  });

  it("on a 412 re-reads the document, does not retry, and reports it (SB2-98)", async () => {
    const memory = memorySystem(doc);
    // The page shows version 1 while the server is already at 2.
    await memory.transport.edits.updateLink("sys_1", memory.etag(), "L1", { name: "elsewhere" });
    const session = new SystemSession("sys_1", memory.transport, { document: doc, etag: '"sys:sys_1:1"' });
    const result = await session.edit("link", (system) => system.updateLink("L1", { name: "mine" }), "Saved");
    expect(result).toBeUndefined();
    expect(memory.calls).toHaveLength(1);
    expect(toast.warning).toHaveBeenCalledWith("This system changed elsewhere. It has been reloaded; please try again.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(session.getState()).toMatchObject({ etag: '"sys:sys_1:2"', busy: null });
    // The next edit sends the ETag the re-read brought.
    await session.edit("link", (system) => system.updateLink("L1", { name: "again" }), "Saved");
    expect(memory.calls).toHaveLength(2);
    expect(toast.success).toHaveBeenCalledWith("Saved");
  });

  it("threads the ETag through several edits in one change", async () => {
    const memory = memorySystem(doc, { edits: { addInstance: () => ({ id: "sin_new" }) } });
    const session = new SystemSession("sys_1", memory.transport, { document: doc, etag: memory.etag() });
    const added = await session.edit("add", async (system) => {
      await system.addInstance({ projectId: "p1", label: "A" });
      return system.addInstance({ projectId: "p2", label: "B" });
    });
    expect(added?.body).toEqual({ id: "sin_new" });
    expect(memory.calls.map((call) => call.name)).toEqual(["addInstance", "addInstance"]);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("reports any other failure and stays usable", async () => {
    const memory = memorySystem(doc, { edits: { deleteLink: () => { throw new Error("Link is locked"); } } });
    const session = new SystemSession("sys_1", memory.transport, { document: doc, etag: memory.etag() });
    expect(await session.edit("delete", (system) => system.deleteLink("L1"))).toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith("Link is locked");
    expect(session.getState().busy).toBeNull();
    expect(memory.loads()).toBe(1);
  });
});

function Reader({ name, spec }: { name: string; spec: SessionRead<unknown> | null }) {
  const { data, current } = useSessionRead(spec);
  return <span data-testid={name} data-current={String(current)}>{data === undefined ? "…" : String(data)}</span>;
}

function counter(prefix: string) {
  let count = 0;
  return vi.fn(async () => `${prefix}${(count += 1)}`);
}

describe("SystemSession reads", () => {
  it("shares one read between components and re-reads it after any edit when it follows the version", async () => {
    const getPlacement = counter("p");
    const memory = memorySystem(doc, { reads: { getPlacement } });
    const spec = sessionReads.placement() as SessionRead<unknown>;
    const { session } = renderInSession(<><Reader name="a" spec={spec} /><Reader name="b" spec={spec} /></>, { document: doc, transport: memory.transport });
    await waitFor(() => expect(screen.getByTestId("b").textContent).toBe("p1"));
    expect(getPlacement).toHaveBeenCalledTimes(1);
    await act(() => session.edit("link", (system) => system.updateLink("L1", { name: "x" })));
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("p2"));
    expect(getPlacement).toHaveBeenCalledTimes(2);
  });

  it("re-reads the repository only after edits that change it, keeping the old value meanwhile", async () => {
    const getGitLink = vi.fn(async () => null);
    let snapshots = 0;
    const listSnapshots = vi.fn(async () => Array.from({ length: (snapshots += 1) }, (_, i) => ({ id: `snap${i}` })));
    const memory = memorySystem(doc, { reads: { getGitLink, listSnapshots } });
    const spec = { ...sessionReads.repository(), load: async (...args: Parameters<SessionRead<unknown>["load"]>) => {
      const value = await sessionReads.repository().load(...args);
      return value.snapshot?.id;
    } } as SessionRead<unknown>;
    const { session } = renderInSession(<Reader name="repo" spec={spec} />, { document: doc, transport: memory.transport });
    await waitFor(() => expect(screen.getByTestId("repo").textContent).toBe("snap0"));
    await act(() => session.edit("link", (system) => system.updateLink("L1", { name: "x" })));
    await flush();
    expect(listSnapshots).toHaveBeenCalledTimes(1);
    await act(() => session.edit("snapshot", (system) => system.createSnapshot({ name: "CDR" })));
    await waitFor(() => expect(listSnapshots).toHaveBeenCalledTimes(2));
    await flush();
    expect(screen.getByTestId("repo").textContent).toBe("snap0");
  });

  it("follows the scene key, not every version", async () => {
    const getScene = counter("s");
    let sceneKey = "scene-1";
    const memory = memorySystem(doc, { reads: { getScene } });
    const transport = { ...memory.transport, getSystem: async (...args: Parameters<typeof memory.transport.getSystem>) => {
      const read = await memory.transport.getSystem(...args);
      return { ...read, body: { ...read.body, sceneKey } as SystemDocument };
    } };
    const { session } = renderInSession(<Reader name="scene" spec={sessionReads.scene() as SessionRead<unknown>} />,
      { document: { ...doc, sceneKey } as SystemDocument, transport });
    await waitFor(() => expect(screen.getByTestId("scene").textContent).toBe("s1"));
    await act(() => session.edit("link", (system) => system.updateLink("L1", { name: "x" })));
    await flush();
    expect(getScene).toHaveBeenCalledTimes(1);
    sceneKey = "scene-2";
    await act(() => session.edit("pose", (system) => system.clearPose("sin_OBC")));
    await waitFor(() => expect(screen.getByTestId("scene").textContent).toBe("s2"));
  });

  it("drops a value that does not keep while its next version loads", async () => {
    let release: (value: string) => void = () => undefined;
    const getHierarchy = vi.fn()
      .mockResolvedValueOnce("h1")
      .mockImplementationOnce(() => new Promise<string>((resolve) => { release = resolve; }));
    const memory = memorySystem(doc, { reads: { getHierarchy } });
    const { session } = renderInSession(<Reader name="tree" spec={sessionReads.hierarchy() as SessionRead<unknown>} />,
      { document: doc, transport: memory.transport });
    await waitFor(() => expect(screen.getByTestId("tree").textContent).toBe("h1"));
    await act(() => session.edit("link", (system) => system.updateLink("L1", { name: "x" })));
    expect(screen.getByTestId("tree").textContent).toBe("…");
    await act(async () => release("h2"));
    expect(screen.getByTestId("tree").textContent).toBe("h2");
  });

  it("reads nothing for a null spec and forgets a key nothing reads any more", async () => {
    const getPlacement = counter("p");
    const memory = memorySystem(doc, { reads: { getPlacement } });
    const view = renderInSession(<Reader name="a" spec={sessionReads.placement() as SessionRead<unknown>} />, { document: doc, transport: memory.transport });
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("p1"));
    view.rerender(<Reader name="a" spec={null} />);
    expect(screen.getByTestId("a").textContent).toBe("…");
    view.rerender(<Reader name="a" spec={sessionReads.placement() as SessionRead<unknown>} />);
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("p2"));
  });
});

describe("SystemSession document", () => {
  it("re-reads while a board interface is pending, and stops on close", async () => {
    vi.useFakeTimers();
    const pending = systemDocument([instance("OBC", { interface: { status: "pending", digest: null, hasPcb: true, jobId: "j", errorCode: null } })]);
    const memory = memorySystem(pending);
    const session = new SystemSession("sys_1", memory.transport);
    session.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(memory.loads()).toBe(1);
    await vi.advanceTimersByTimeAsync(PENDING_POLL_MS);
    expect(memory.loads()).toBe(2);
    session.close();
    await vi.advanceTimersByTimeAsync(PENDING_POLL_MS * 2);
    expect(memory.loads()).toBe(2);
  });

  it("keeps the document and says so when a re-read fails", async () => {
    const memory = memorySystem(doc);
    const failing = { ...memory.transport, getSystem: vi.fn(async () => { throw new Error("offline"); }) };
    const session = new SystemSession("sys_1", failing, { document: doc, etag: doc.system.etag });
    await session.reload();
    expect(session.getState()).toMatchObject({ document: doc, error: "offline", notFound: false });
    expect(toast.error).toHaveBeenCalledWith("Could not refresh the system: offline", { id: "system-reload" });
  });

  it("serves its state through the provider", async () => {
    const memory = memorySystem(doc);
    const session = new SystemSession("sys_1", memory.transport);
    function Name() {
      const { document } = useSystemSession();
      return <p>{document?.system.name ?? "loading"}</p>;
    }
    render(<SystemSessionProvider session={session}><Name /></SystemSessionProvider>);
    act(() => session.open());
    expect(await screen.findByText("Stack")).toBeTruthy();
  });
});
