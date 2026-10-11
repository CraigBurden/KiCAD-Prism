import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Finding, NetRename, SystemDocument } from "@/types/system";

import { memorySystem, renderInSession } from "../session/memory-session";
import { instance, link, systemDocument } from "../test-fixtures";
import { UsedInPanel } from "../used-in-panel";
import { FindingsTray } from "./findings-tray";
import { renameSides } from "./rename-popover";

afterEach(() => vi.unstubAllGlobals());

const obc = instance("OBC");
const pay = instance("PAY");
const base = systemDocument([obc, pay], [link("L1", obc.id, "J7", pay.id, "J4", 1)]);
const v09: Finding = {
  rule: "SYS-V09", name: "net_name_mismatch", severity: "warning", instanceId: null, linkId: "L1", rowId: "L1-r0",
  end: null, reference: null, pin: null, detail: { netA: ["/Payload IF/TM_MON"], netB: ["GND_3"] }, redacted: false,
  key: "SYS-V09||L1|||||", waived: null,
};
const proposal: NetRename = {
  id: "snr_1", instanceId: obc.id, net: "/Payload IF/TM_MON", name: "GND_3", note: "", state: "open", rows: 1,
  createdBy: "user:a", createdAt: "2026-10-09T00:00:00Z", closedBy: null, closedAt: null, closedCommit: null,
};

function doc(findings: Finding[], renames: NetRename[] = []): SystemDocument {
  return { ...base, renames, validation: { findings, waivers: [], notEvaluated: [], exempt: [],
    counts: { error: 0, warning: findings.length, info: 0, notEvaluated: 0 } } };
}

function renderTray(document: SystemDocument) {
  const memory = memorySystem(document, { edits: { proposeRename: () => proposal } });
  renderInSession(<FindingsTray document={document} canEdit onSelect={vi.fn()} />, { document, transport: memory.transport });
  return memory;
}

describe("net rename proposals (SB2-106)", () => {
  it("offers each board's side, suggesting the other side's name", () => {
    expect(renameSides(doc([v09]), v09).map((side) => [side.board, side.net, side.suggested])).toEqual([
      ["OBC", "/Payload IF/TM_MON", "GND_3"], ["PAY", "GND_3", "TM_MON"]]);
  });

  it("proposes a rename from a SYS-V09 row", async () => {
    const memory = renderTray(doc([v09]));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.click(screen.getByRole("radio", { name: /PAY/ }));
    expect((screen.getByLabelText("New net name") as HTMLInputElement).value).toBe("TM_MON");
    fireEvent.click(screen.getByRole("radio", { name: /OBC/ }));
    fireEvent.click(screen.getByRole("button", { name: "Propose" }));
    await waitFor(() => expect(memory.calls).toEqual([{ name: "proposeRename", args: [{ instanceId: obc.id, net: "/Payload IF/TM_MON", name: "GND_3" }] }]));
  });

  it("shows a proposed rename on its row, and lists open proposals with Withdraw", () => {
    const annotated = { ...v09, detail: { ...v09.detail as object, rename: { id: "snr_1", instanceId: obc.id, name: "GND_3" } } };
    renderTray(doc([annotated], [proposal]));
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
    expect(screen.getByTitle("Rename proposed").textContent).toBe("→ GND_3");
    expect(screen.getByRole("button", { name: /Rename proposals/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeTruthy();
  });
});

describe("Used in panel (SB2-106)", () => {
  it("lists the systems that place the board, a few placements each", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      projectId: "prj_obc",
      systems: [{ id: "sys_1", name: "C&DH", instances: [{ id: "sin_a", label: "OBC-1", baselineCommit: null, trackedRef: "main", pinned: false }],
        renames: [{ ...proposal, board: "OBC-1", connectors: ["J7.12"] }] }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    render(<MemoryRouter><UsedInPanel projectId="prj_obc" /></MemoryRouter>);
    expect((await screen.findByRole("link", { name: "C&DH" })).getAttribute("href")).toBe("/systems/sys_1");
    expect(screen.getByRole("cell", { name: "OBC-1" })).toBeTruthy();
    expect(screen.queryByText("J7.12")).toBeNull(); // renames are not on the board page
    expect(screen.getByRole("heading", { name: "Used in" })).toBeTruthy();
  });

  it("shows nothing when no system uses the board", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ projectId: "p", systems: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<MemoryRouter><UsedInPanel projectId="p" /></MemoryRouter>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
