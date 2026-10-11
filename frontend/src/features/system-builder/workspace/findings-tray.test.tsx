import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Finding, SystemDocument } from "@/types/system";

import { memorySystem, renderInSession } from "../session/memory-session";
import { instance, link, systemDocument } from "../test-fixtures";
import { FindingsTray } from "./findings-tray";

const obc = instance("OBC");
const pwr = instance("PWR");
const cndh = instance("CNDH", { kind: "assembly", catalog: { componentId: "cmp_1" } as SystemDocument["instances"][number]["catalog"] });
const base = systemDocument([obc, pwr, cndh], [link("L1", obc.id, "J1", pwr.id, "J2", 3)]);

const finding = (patch: Partial<Finding>): Finding => ({
  rule: "SYS-V06", name: "pcb_out_of_sync", severity: "warning", instanceId: obc.id, linkId: null, rowId: null,
  end: null, reference: "J1", pin: "1", detail: null, redacted: false, key: `SYS-V06|${obc.id}||||J1|1`, waived: null, ...patch,
});

function doc(findings: Finding[], waivers: NonNullable<SystemDocument["validation"]>["waivers"] = []): SystemDocument {
  return { ...base, validation: { findings, waivers, notEvaluated: [], exempt: [], counts: { error: 0, warning: 0, info: 0, notEvaluated: 0 } } };
}

function renderTray(document: SystemDocument, canEdit = true) {
  const memory = memorySystem(document);
  const onSelect = vi.fn();
  renderInSession(<FindingsTray document={document} canEdit={canEdit} onSelect={onSelect} />, { document, transport: memory.transport });
  return { memory, onSelect };
}

describe("FindingsTray (SB2-100)", () => {
  it("filters by board, pin or net, waives a group in one batch, and splits a large group by place (SB2-113)", async () => {
    const linkId = base.links[0].id;
    const v09 = (pin: string, a: string, b: string) => finding({ rule: "SYS-V09", name: "net_name_mismatch", linkId, rowId: `r${pin}`,
      end: "a", pin, detail: { pinB: pin, referenceB: "J2", netA: [a], netB: [b] }, key: `V09|${pin}` });
    const onPwr = Array.from({ length: 9 }, (_, i) => finding({ instanceId: pwr.id, reference: "J2", pin: String(i + 1), key: `V06|p${i}` }));
    const { memory } = renderTray(doc([v09("1", "GND_3", "GND"), v09("3", "CLK", "SCK"), finding({ pin: "9", key: "V06|9" }), ...onPwr]));
    // SYS-V06 has 10 findings on two boards: one row per board, PWR first (9), each opening on demand.
    const places = screen.getAllByRole("button", { name: /^(PWR|OBC)\s*\d+$/ });
    expect(places.map((button) => button.textContent)).toEqual(["PWR9", "OBC1"]);
    expect(screen.queryByText("J2 · 1")).toBeNull();
    fireEvent.click(places[0]);
    expect(screen.getByText("J2 · 1")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Filter findings"), { target: { value: "sck" } });
    expect(screen.queryByText("GND_3 ↔ GND")).toBeNull();
    expect(screen.getByText("CLK ↔ SCK")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filter findings"), { target: { value: "" } });

    const obc = screen.getByRole("button", { name: /^OBC\s*1$/ }).parentElement!;
    fireEvent.click(within(obc).getByRole("button", { name: "Waive all" }));
    fireEvent.change(screen.getByLabelText("Why this is acceptable"), { target: { value: "Board-level, accepted" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Waive" }).at(-1)!);
    await vi.waitFor(() => expect(memory.calls).toEqual([{ name: "waiveFindings", args: [["V06|9"], "Board-level, accepted"] }]));
  });

  it("names a join finding's pins and nets, and Show opens its row (SB2-112)", () => {
    const linkId = base.links[0].id;
    const { onSelect } = renderTray(doc([finding({
      rule: "SYS-V10", name: "power_meets_signal", severity: "error", linkId, rowId: "row_4", end: "a", pin: "4",
      detail: { pinB: "4", referenceB: "J2", netA: ["VCC_3V3"], netB: [] }, key: "e4" })]));
    expect(screen.getByText("J1 4 ↔ J2 4")).toBeTruthy();
    expect(screen.getByText("VCC_3V3 ↔ no net")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "link", id: linkId, row: "row_4" });
  });

  it("says it is loading until the findings come with the document", () => {
    renderTray({ ...base, validation: undefined });
    expect(screen.getByText("Loading findings…")).toBeTruthy();
  });

  it("groups by rule with a count; a large group starts closed and opens on demand", () => {
    const many = Array.from({ length: 40 }, (_, i) => finding({ pin: String(i + 1), key: `SYS-V06|${obc.id}||||J1|${i + 1}` }));
    renderTray(doc([finding({ rule: "SYS-V03", name: "port_not_exposed", severity: "error", key: "e1" }), ...many]));
    const group = screen.getByRole("button", { name: /SYS-V06/ });
    expect(group.getAttribute("aria-expanded")).toBe("false");
    expect(within(group).getByText("40")).toBeTruthy();
    expect(screen.getByRole("button", { name: /SYS-V03/ }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(group);
    expect(group.getAttribute("aria-expanded")).toBe("true");
  });

  it("offers Waive on warnings only, and sends the finding key with the note", async () => {
    const { memory } = renderTray(doc([finding({}), finding({ rule: "SYS-V03", name: "port_not_exposed", severity: "error", key: "e1" })]));
    const waive = screen.getAllByRole("button", { name: "Waive" });
    expect(waive).toHaveLength(1);
    fireEvent.click(waive[0]);
    fireEvent.change(screen.getByLabelText("Why this is acceptable"), { target: { value: "Known, harmless" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Waive" }).at(-1)!);
    await vi.waitFor(() => expect(memory.calls).toEqual([{ name: "waiveFinding", args: [`SYS-V06|${obc.id}||||J1|1`, "Known, harmless"] }]));
  });

  it("lists waivers apart, with the note, and a gone finding as no longer raised", () => {
    const waived = finding({ waived: { id: "sfw_1", note: "Known", by: "user:a@b", at: "2026-10-09" } });
    renderTray(doc([waived], [
      { id: "sfw_1", findingKey: waived.key!, rule: "SYS-V06", note: "Known", by: "user:a@b", at: "2026-10-09", active: true },
      { id: "sfw_2", findingKey: "SYS-V06|gone", rule: "SYS-V06", note: "Old", by: "user:a@b", at: "2026-10-01", active: false },
    ]));
    expect(screen.getByRole("button", { name: /Waived/ })).toBeTruthy();
    expect(screen.getByText("Known")).toBeTruthy();
    expect(screen.getByText("No longer raised")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Unwaive" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /SYS-V06.*1$/ })).toBeNull();
  });

  it("links an unreleased subsystem's finding to its catalog page", () => {
    renderTray(doc([finding({ rule: "SYS-V14", name: "child_revision_unreleased", instanceId: cndh.id, reference: null, pin: null, key: "v14" })]));
    expect(screen.getByRole("link", { name: "Catalog" }).getAttribute("href")).toContain("catalogSelection=cmp_1");
  });

  it("offers no Waive or Unwaive to a viewer", () => {
    renderTray(doc([finding({})]), false);
    expect(screen.queryByRole("button", { name: "Waive" })).toBeNull();
  });
});
