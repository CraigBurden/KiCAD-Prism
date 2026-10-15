import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chooseMenuItem, openMenu } from "@/test/select";
import type { SystemDocument } from "@/types/system";

import { BoardDetail, linkedPortKeys, portState } from "./board-detail";
import { memorySystem, renderInSession } from "./session/memory-session";
import type { SystemTransport } from "./session/system-session";
import { exportOf, instance, link, port, systemDocument } from "./test-fixtures";

afterEach(() => vi.unstubAllGlobals());

const obc = instance("OBC", { ports: [port("J7"), port("J5", { override: "hidden", exposed: false })] });
const pay = instance("PAY");
const doc = systemDocument([obc, pay, instance("SECRET", { restricted: true, projectId: null, ports: null })],
  [link("L1", obc.id, "J7", pay.id, "J1", 3)]);

function renderTab(props: { document?: SystemDocument; canEdit?: boolean; transport?: SystemTransport } = {}, instanceId?: string) {
  const document = props.document ?? doc;
  const selected = document.instances.find((item) => item.id === (instanceId ?? document.instances[0].id))!;
  // Returns how many times the document was re-read.
  return renderInSession(<BoardDetail systemId="sys_1" document={document} instance={selected} canEdit={props.canEdit ?? true} />,
    { document, transport: props.transport }).loads;
}

describe("port helpers", () => {
  it("collects linked port and member keys per board", () => {
    expect([...linkedPortKeys(doc, obc.id)]).toEqual(["key-J7"]);
    expect([...linkedPortKeys(doc, pay.id)]).toEqual(["key-J1"]);
  });

  it("names override and exposure states", () => {
    expect(portState({ override: "promoted", exposed: true })).toBe("promoted");
    expect(portState({ override: "hidden", exposed: false })).toBe("hidden");
    expect(portState({ override: null, exposed: false })).toBe("not exposed");
  });
});

describe("BoardDetail", () => {
  it("shows a board, and refuses to hide a linked port", async () => {
    renderTab();
    expect(screen.getByRole("heading", { name: "OBC" })).toBeTruthy();
    expect(screen.getByLabelText("linked")).toBeTruthy();
    expect(screen.getByLabelText("hidden")).toBeTruthy();
    await openMenu("Actions for J7");
    expect(screen.getByRole("menuitem", { name: /Hide \(linked\)/ }).getAttribute("aria-disabled")).toBe("true");
  });

  it("resets an override through the session and re-reads", async () => {
    const memory = memorySystem(doc);
    const loads = renderTab({ transport: memory.transport });
    await chooseMenuItem("Actions for J5", /Reset/);
    await waitFor(() => expect(loads()).toBe(1));
    expect(memory.calls).toEqual([{ name: "setPortOverride", args: ["sin_OBC", "key-J5", null] }]);
    expect(memory.etag()).toBe('"sys:sys_1:2"');
  });

  it("warns that removing a linked board deletes its links", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204, headers: { ETag: '"sys:sys_1:2"' } }));
    vi.stubGlobal("fetch", fetchMock);
    renderTab();
    await chooseMenuItem("Board actions", /Remove board/);
    expect(await screen.findByText(/an end of 1 link/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove board" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/systems/sys_1/instances/sin_OBC?cascade=links");
  });

  it("shows a restricted board without its details or actions", () => {
    renderTab({}, "sin_SECRET");
    expect(screen.getByTitle("Its project is in a folder you cannot see.").textContent).toBe("No access");
    expect(screen.queryByRole("button", { name: "Board actions" })).toBeNull();
  });

  it("offers to remove a board whose project was deleted", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204, headers: { ETag: '"sys:sys_1:2"' } }));
    vi.stubGlobal("fetch", fetchMock);
    const gone = instance("GONE", { restricted: true, projectId: null, ports: null, projectDeleted: true });
    renderTab({ document: systemDocument([obc, gone], []) }, gone.id);
    expect(screen.getByText("Project deleted")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Remove board/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove board" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(`/api/systems/sys_1/instances/${gone.id}`);
  });

  it("waits for the branch check to finish before reloading", async () => {
    const statuses = ["queued", "running", "completed"];
    const fetchMock = vi.fn(async (url: string) => {
      const body = url.startsWith("/api/jobs/")
        ? { job_id: "chk-1", kind: "system_source_check", status: statuses.shift(), stage: "", message: "", percent: 0 }
        : { job_id: "chk-1", status: "queued" };
      return new Response(JSON.stringify(body), { status: url.endsWith("/check") ? 202 : 200,
        headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const tracked = instance("OBC", { trackedRef: "main", ports: [port("J7")] });
    const loads = renderTab({ document: systemDocument([tracked], []) });
    fireEvent.click(screen.getByRole("button", { name: /Check now/ }));
    await waitFor(() => expect(loads()).toBe(1), { timeout: 4000 });
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls[0]).toBe(`/api/systems/sys_1/instances/${tracked.id}/check`);
    expect(urls.filter((url) => url === "/api/jobs/chk-1")).toHaveLength(3);
  });

  it("edits the label and branch in one dialog", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200, headers: { ETag: '"sys:sys_1:2"', "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    renderTab();
    await chooseMenuItem("Board actions", /Edit board/);
    fireEvent.change(await screen.findByLabelText("Board label"), { target: { value: "OBC-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect([url, init.method, JSON.parse(String(init.body))]).toEqual(["/api/systems/sys_1/instances/sin_OBC", "PATCH", { label: "OBC-1" }]);
  });

  it("offers no edits to viewers", () => {
    renderTab({ canEdit: false });
    expect(screen.queryByRole("button", { name: /Actions for/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Board actions" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Check now/ })).toBeNull();
  });
});

describe("BoardDetail ports and subsystems", () => {
  it("exports a free port and marks it so it cannot be hidden", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 201, headers: { ETag: '"sys:sys_1:2"', "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const board = instance("OBC", { ports: [port("J7"), port("J6")] });
    renderTab({ document: systemDocument([board, pay], [link("L1", board.id, "J7", pay.id, "J1", 3)]) });
    await openMenu("Actions for J7");
    expect(screen.queryByRole("menuitem", { name: "Export" })).toBeNull(); // J7 is linked
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await chooseMenuItem("Actions for J6", "Export");
    fireEvent.change(await screen.findByLabelText("Export name"), { target: { value: "DEBUG" } });
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect([url, init.method, JSON.parse(String(init.body))]).toEqual(["/api/systems/sys_1/exports", "POST",
      { name: "DEBUG", description: "", instanceId: board.id, portKey: "key-J6" }]);
  });

  it("badges an exported port and disables Hide on it", async () => {
    const board = instance("OBC", { ports: [port("J6")] });
    renderTab({ document: systemDocument([board], [], [exportOf("DEBUG", board.id, "J6")]) });
    expect(screen.getByLabelText("exported as DEBUG")).toBeTruthy();
    await openMenu("Actions for J6");
    expect(screen.getByRole("menuitem", { name: /Hide \(exported\)/ }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("menuitem", { name: "Export" })).toBeNull();
  });

  it("shows a subsystem with its revision, exports and contents", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ systemId: "sys_1", boardCount: 2, occurrences: [
      { path: "/sin_CNDH", displayPath: "CNDH-A", labels: ["CNDH-A"], instanceId: "sin_CNDH", kind: "assembly", depth: 1, restricted: false },
      { path: "/sin_CNDH/sin_x", displayPath: "CNDH-A ▸ OBC-1", labels: ["CNDH-A", "OBC-1"], instanceId: "sin_x", kind: "board", depth: 2, restricted: false },
      { path: "/sin_CNDH/sin_y", displayPath: "CNDH-A ▸ PAY", labels: ["CNDH-A", "PAY"], instanceId: "sin_y", kind: "board", depth: 2, restricted: true },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const cndh = instance("CNDH", {
      kind: "assembly", label: "CNDH-A", projectId: null, projectName: "CNDH Stack", baselineCommit: null, trackedRef: null,
      ports: [port("PWR_IN", { portKey: "sxp_1", value: "J1", pinCount: 60 })],
      catalog: { componentId: "cmp_1", revisionId: "rev_2", follow: "latest_released", version: 2, releaseStatus: "released",
        identity: "IPN-1", latestReleasedRevisionId: "rev_2", systemId: "sys_child", snapshotName: "CDR-rc2" },
    });
    renderTab({ document: systemDocument([cndh]) });
    expect(screen.getByText("Subsystem")).toBeTruthy();
    expect(screen.getByText("v2 released")).toBeTruthy();
    expect(screen.getByText("CDR-rc2")).toBeTruthy();
    expect(screen.getByText("PWR_IN")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open its system" }).getAttribute("href")).toBe("/systems/sys_child");
    const contents = await screen.findByRole("list", { name: "Subsystem contents" });
    expect(contents.textContent).toContain("OBC-1");
    expect(contents.querySelector("[aria-label=restricted]")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Check now/ })).toBeNull();
  });

  it("shows a pinned part's model state and converts that revision's STEP", async () => {
    const calls: [string, RequestInit][] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push([url, init]);
      const body = url.includes("/models/convert") ? { jobId: "j", status: "queued" }
        : url.includes("/models") ? { items: [{ assetId: "m", name: "enc.step", glb: null }] } : { occurrences: [] };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const enclosure = instance("ENC", {
      kind: "part", label: "Enclosure", projectId: null, projectName: null, baselineCommit: null, trackedRef: null, ports: [],
      catalog: { componentId: "cmp_enc", revisionId: "rev_1", follow: "pinned", version: 1, releaseStatus: "draft",
        identity: "ENC-1", latestReleasedRevisionId: null, systemId: null, snapshotName: null },
    });
    const document = systemDocument([enclosure]);
    const reader = renderInSession(<BoardDetail systemId="sys_1" document={document} instance={enclosure} canEdit={false} />,
      { document });
    expect(await screen.findByText("Not converted")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Convert the pinned revision's models" })).toBeNull();
    reader.unmount();
    renderInSession(<BoardDetail systemId="sys_1" document={document} instance={enclosure} canEdit canConvertModels />,
      { document });
    expect(await screen.findByText("Not converted")).toBeTruthy();
    expect(calls.map(([url]) => url)).toContain("/api/catalog/components/cmp_enc/models?revisionId=rev_1");
    fireEvent.click(screen.getByRole("button", { name: "Convert the pinned revision's models" }));
    await waitFor(() => expect(calls.filter(([, init]) => init.method === "POST").map(([url]) => url))
      .toEqual(["/api/catalog/components/cmp_enc/models/convert?revisionId=rev_1"]));
  });
});
