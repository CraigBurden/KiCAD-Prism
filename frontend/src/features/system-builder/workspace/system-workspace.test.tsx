import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chooseMenuItem, chooseOption } from "@/test/select";
import type { SystemDocument } from "@/types/system";

import { renderInSession } from "../session/memory-session";
import { exportOf, instance, link, systemDocument } from "../test-fixtures";
import { SystemWorkspace } from "./system-workspace";
import type { WorkspaceState } from "./workspace-state";

afterEach(() => vi.unstubAllGlobals());

const obc = instance("OBC");
const pwr = instance("PWR");
// SB2-98: the findings come with the document.
const doc = {
  ...systemDocument([obc, pwr], [link("L1", obc.id, "J1", pwr.id, "J2", 3)]),
  validation: {
    findings: [{ rule: "SYS-V03", name: "pin_missing", severity: "error" as const, instanceId: null, linkId: "L1", rowId: null,
      end: "a" as const, reference: "J1", pin: "3", detail: null, redacted: false }],
    notEvaluated: [], exempt: [], counts: { error: 1, warning: 0, info: 0, notEvaluated: 0 },
  },
};

function stub() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", ETag: '"sys:sys_1:1"' } });
    if (url.endsWith("/git")) return json(null);
    if (url.endsWith("/snapshots")) return json([]);
    return json({});
  }));
}

function renderWorkspace(state: WorkspaceState) {
  const onState = vi.fn();
  renderInSession(
    <SystemWorkspace systemId="sys_1" document={doc} canEdit user={null}
      state={state} importing={false} onState={onState} onImporting={vi.fn()} onBack={vi.fn()} />,
    { document: doc },
  );
  return onState;
}

describe("SystemWorkspace", () => {
  it("opens an empty system on the Diagram, not an empty 3D view (SB2-118)", () => {
    stub();
    const empty = { ...doc, instances: [], links: [] };
    renderInSession(
      <SystemWorkspace systemId="sys_1" document={empty} canEdit user={null}
        state={{ view: "3d", tray: null, selection: null }} importing={false} onState={vi.fn()}
        onImporting={vi.fn()} onBack={vi.fn()} />,
      { document: empty },
    );
    expect(screen.getByRole("tab", { name: "Diagram" }).getAttribute("aria-selected")).toBe("true");
  });

  it("shows the system overview, the outline and the tray, and selects from the outline", async () => {
    stub();
    const onState = renderWorkspace({ view: "icd", tray: null, selection: null });
    const outline = screen.getByRole("navigation", { name: "System outline" });
    expect(within(outline).getByText("OBC")).toBeTruthy();
    expect(within(screen.getByRole("complementary", { name: "Inspector" })).getByText("Stack")).toBeTruthy();
    fireEvent.click(within(outline).getByText("L1"));
    expect(onState).toHaveBeenLastCalledWith({ view: "icd", tray: null, selection: { kind: "link", id: "L1" } });
    fireEvent.click(screen.getByRole("tab", { name: /Findings/ }));
    expect(onState).toHaveBeenLastCalledWith({ view: "icd", tray: "findings", selection: null });
    fireEvent.click(screen.getByRole("tab", { name: "Diagram" }));
    expect(onState).toHaveBeenLastCalledWith({ view: "diagram", tray: null, selection: null });
  });

  it("summarises a selected link and lists its findings; the Findings tray shows the selection", async () => {
    stub();
    const onState = renderWorkspace({ view: "icd", tray: "findings", selection: { kind: "link", id: "L1" } });
    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    expect(within(inspector).getByText("OBC J1")).toBeTruthy();
    expect(await within(inspector).findByTitle(/^SYS-V03 · /)).toBeTruthy();
    fireEvent.click(within(inspector).getByRole("button", { name: /Open its rows/ }));
    expect(onState).toHaveBeenLastCalledWith({ view: "icd", tray: "connections", selection: { kind: "link", id: "L1" } });
    const tray = screen.getByRole("region", { name: "Tray" });
    fireEvent.click(await within(tray).findByRole("button", { name: "Show" }));
    expect(onState).toHaveBeenLastCalledWith({ view: "icd", tray: "findings", selection: { kind: "link", id: "L1" } });
    // SB2-107: the reviews and findings report beside the findings.
    expect(within(tray).getByRole("link", { name: "Report" }).getAttribute("href")).toMatch(/\/report\.xlsx$/);
  });

  it("lists connections in the tray and opens one", async () => {
    stub();
    const onState = renderWorkspace({ view: "icd", tray: "connections", selection: null });
    const table = screen.getByRole("table", { name: "Connections" });
    await waitFor(() => expect(within(table).getByLabelText("1 error")).toBeTruthy());
    fireEvent.click(within(table).getByText("L1"));
    expect(onState).toHaveBeenLastCalledWith({ view: "icd", tray: "connections", selection: { kind: "link", id: "L1" } });
  });
});

describe("SystemWorkspace: what the Overview and Boards tabs did", () => {
  const exportsDoc = systemDocument([obc, pwr], [link("L1", obc.id, "J1", pwr.id, "J2", 3)],
    [exportOf("DEBUG", obc.id, "J1"), exportOf("PWR_IN", pwr.id, "J2", { resolved: false })]);

  function stubWith(extra: (url: string, init?: RequestInit) => Response | null) {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const handled = extra(url, init);
      if (handled) return handled;
      const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", ETag: '"sys:sys_1:1"' } });
      if (url.endsWith("/validation")) return json({ findings: [], notEvaluated: [], exempt: [], counts: { error: 0, warning: 0, info: 0, notEvaluated: 0 } });
      if (url.endsWith("/git")) return json(null);
      if (url.endsWith("/snapshots")) return json([]);
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  const writes = (fetchMock: ReturnType<typeof vi.fn>) => (fetchMock.mock.calls as unknown as [string, RequestInit?][])
    .filter(([, init]) => init?.method && init.method !== "GET");
  const ok = (body: unknown = {}, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ETag: '"sys:sys_1:2"' } });

  function renderWith(document: SystemDocument, canEdit = true) {
    const onState = vi.fn();
    const { loads } = renderInSession(
      <SystemWorkspace systemId="sys_1" document={document} canEdit={canEdit} user={null}
        state={{ view: "icd", tray: null, selection: null }} importing={false} onState={onState} onImporting={vi.fn()} onBack={vi.fn()} />,
      { document },
    );
    return { loads, onState };
  }

  it("offers no Add without edit rights, and no opt-in check (SYS-V09 runs on every system, D-P2-57)", () => {
    stubWith(() => null);
    renderWith(doc, false);
    expect(screen.queryByRole("button", { name: /Add/ })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Net names across links/ })).toBeNull();
  });

  it("lists exports with their state and renames through the menu", async () => {
    const fetchMock = stubWith((_url, init) => (init?.method === "PATCH" ? ok() : null));
    renderWith(exportsDoc);
    expect(screen.getByText("DEBUG")).toBeTruthy();
    expect(screen.getByText("unresolved")).toBeTruthy();
    await chooseMenuItem("Actions for DEBUG", /Rename/);
    fireEvent.change(await screen.findByLabelText("Export name"), { target: { value: "SWD" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1));
    const [url, init] = writes(fetchMock)[0];
    expect([url, init?.method, JSON.parse(String(init?.body))]).toEqual(["/api/systems/sys_1/exports/sxp_DEBUG", "PATCH", { name: "SWD", description: "" }]);
  });

  it("adds a subsystem from the catalog, pinning an unreleased one, and selects it", async () => {
    const fetchMock = stubWith((url, init) => {
      if (url.startsWith("/api/catalog")) {
        return ok({ items: [{ id: "cmp_1", name: "CNDH Stack", value: "IPN-1", current_revision_id: "rev_1", released_revision_id: "" }] });
      }
      return init?.method === "POST" ? ok({ id: "sin_new" }, 201) : null;
    });
    const { onState } = renderWith(doc);
    await chooseMenuItem("Add", /Subsystem/);
    await chooseOption("Assembly", /CNDH Stack/);
    expect(await screen.findByText(/Not released yet/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Label in this system"), { target: { value: "CNDH-A" } });
    fireEvent.click(screen.getByRole("button", { name: "Add subsystem" }));
    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1));
    const [url, init] = writes(fetchMock)[0];
    expect(url).toBe("/api/systems/sys_1/instances");
    expect(JSON.parse(String(init?.body))).toEqual({ kind: "assembly", label: "CNDH-A", componentId: "cmp_1", revisionId: "rev_1", follow: "pinned" });
    await waitFor(() => expect(onState).toHaveBeenLastCalledWith({ view: "icd", tray: null, selection: { kind: "instance", id: "sin_new" } }));
  });

  it("adds a catalog module (SB2-49): the module list, then a module instance", async () => {
    const fetchMock = stubWith((url, init) => {
      if (url.startsWith("/api/catalog/components")) {
        return ok({ items: [{ id: "cmp_imu", name: "IMU", value: "IMU-1", released_revision_id: "rev_1", current_revision_id: "rev_1" }] });
      }
      return init?.method === "POST" ? ok({ id: "sin_imu" }, 201) : null;
    });
    renderWith(doc);
    await chooseMenuItem(/Add/, /Module/);
    expect(await screen.findByRole("heading", { name: "Add a module" })).toBeTruthy();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === "/api/catalog/components?kind=module&page_size=200")).toBe(true));
    await chooseOption("Module", /IMU · IMU-1/);
    fireEvent.click(screen.getByRole("button", { name: "Add module" }));
    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1));
    const [url, init] = writes(fetchMock)[0];
    expect(url).toBe("/api/systems/sys_1/instances");
    expect(JSON.parse(String(init?.body))).toEqual({ kind: "module", label: "IMU", componentId: "cmp_imu", follow: "latest_released" });
  });
});

describe("SystemWorkspace without WebGPU", () => {
  it("shows the Diagram in place of the 3D view and disables 3D", async () => {
    stub();
    vi.stubGlobal("navigator", { ...navigator, gpu: undefined });
    renderWorkspace({ view: "3d", tray: null, selection: null });
    const tab = screen.getByRole("tab", { name: "3D" }) as HTMLButtonElement;
    expect(tab.disabled).toBe(true);
    expect(screen.getByRole("tab", { name: "Diagram" }).getAttribute("aria-selected")).toBe("true");
    // The Diagram is lazy: its module placeholder, then its own loading state, then the diagram.
    await waitFor(() => expect(screen.queryByText(/Loading (the )?diagram/) ?? screen.queryByRole("application", { name: "System diagram" })).toBeTruthy());
  });

  it("gives every button a name (SB2-102)", async () => {
    stub();
    for (const state of [
      { view: "diagram", tray: "connections", selection: null },
      { view: "diagram", tray: "findings", selection: { kind: "link", id: "L1" } },
      { view: "icd", tray: null, selection: { kind: "instance", id: obc.id } },
    ] as WorkspaceState[]) {
      const view = renderInSession(
        <SystemWorkspace systemId="sys_1" document={doc} canEdit user={null}
          state={state} importing={false} onState={vi.fn()} onImporting={vi.fn()} onBack={vi.fn()} />,
        { document: doc },
      );
      await act(async () => undefined);
      const unnamed = screen.queryAllByRole("button", { name: "" });
      expect(unnamed.map((button) => button.outerHTML.slice(0, 160))).toEqual([]);
      view.unmount();
    }
  });
});
