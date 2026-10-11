import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chooseOption } from "@/test/select";

import type { Finding } from "@/types/system";

import { LinkEditor, endLabel } from "./link-editor";
import { renderInSession } from "./session/memory-session";
import { instance, link, systemDocument } from "./test-fixtures";

afterEach(() => vi.unstubAllGlobals());

const a = instance("OBC");
const b = instance("PAY");
const theLink = link("L1", a.id, "J1", b.id, "J1", 2);
const doc = systemDocument([a, b], [theLink]);

function iface(instanceId: string) {
  return {
    instanceId, atBaseline: true, projectId: "p", commit: "c", digest: "d", hasPcb: true,
    components: [{
      portKey: "key-J1", memberKeys: ["key-J1"], reference: "J1", libId: null, footprint: null, value: null, dnp: false,
      candidate: true, candidateReason: null, override: null, exposed: true,
      pins: ["1", "2", "3"].map((pad) => ({ pad, nets: [`/X/NET${pad}`], pinNames: [`P${pad}`], pinTypes: null })),
    }],
  };
}

function stubApi() {
  const calls: [string, RequestInit][] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push([url, init]);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json", ETag: '"sys:sys_1:2"' },
    });
    if (url.endsWith("/interface")) return json(iface(url.split("/")[5]));
    if (url.endsWith("/rows")) return json(theLink);
    if (url.endsWith("/generate")) {
      return json({ linkId: "L1", generator: "identity", skipped: [{ pinA: "1", pinB: "1", reason: "existing" }],
        rows: [{ pinA: "3", pinB: "3", signal: "NET3", source: "generator", netA: ["/X/NET3"], netB: ["/X/NET3"], pinNamesA: null, pinNamesB: null }] });
    }
    return json({});
  }));
  return calls;
}

function renderEditor(canEdit = true, findings: Finding[] = []) {
  renderInSession(<LinkEditor systemId="sys_1" document={doc} link={theLink} canEdit={canEdit}
    findings={findings} onDeleted={vi.fn()} />, { document: doc });
}

const rowFinding = (rowId: string, patch: Partial<Finding> = {}): Finding => ({
  rule: "SYS-V09", name: "net_name_mismatch", severity: "warning", instanceId: a.id, linkId: "L1", rowId, end: null,
  reference: "J1", pin: "1", detail: null, redacted: false, key: `k-${rowId}`, ...patch,
});

describe("LinkEditor", () => {
  it("leaves a waived finding out of the alert and the row colour (SB2-100)", () => {
    stubApi();
    const waived = { id: "w1", note: "fine", by: "user:a", at: "" };
    renderEditor(true, [rowFinding("L1-r0", { waived })]);
    expect(screen.queryByText(/1 warning/)).toBeNull();
    expect(screen.queryByLabelText(/SYS-V09/)).toBeNull();
  });

  it("colours a row and alerts for an open finding", () => {
    stubApi();
    renderEditor(true, [rowFinding("L1-r1")]);
    expect(screen.getByText(/1 warning/)).toBeTruthy();
    expect(screen.getByLabelText(/SYS-V09/)).toBeTruthy();
  });

  it("adds a row with a signal from net A and saves every row with its id", async () => {
    const calls = stubApi();
    renderEditor();
    await waitFor(() => expect(calls.filter(([url]) => url.endsWith("/interface"))).toHaveLength(2));
    await chooseOption("New row pin A", "3");
    await chooseOption("New row pin B", "3");
    fireEvent.click(screen.getByRole("button", { name: /Add row/ }));
    expect(screen.getByText(/Unsaved changes: 1 row$/)).toBeTruthy(); // SB2-102: the change, not the draft
    fireEvent.click(screen.getByRole("button", { name: "Save pins" }));
    await waitFor(() => expect(calls.some(([url]) => url.endsWith("/rows"))).toBe(true));
    const [, init] = calls.find(([url]) => url.endsWith("/rows"))!;
    expect(init.method).toBe("PUT");
    expect(new Headers(init.headers).get("If-Match")).toBe('"sys:sys_1:1"');
    expect(JSON.parse(String(init.body))).toEqual([
      { id: "L1-r0", pinA: "1", pinB: "1", signal: "S0", source: "manual" },
      { id: "L1-r1", pinA: "2", pinB: "2", signal: "S1", source: "manual" },
      { pinA: "3", pinB: "3", signal: "NET3", source: "manual" },
    ]);
  });

  it("blocks saving a duplicate pair", async () => {
    const calls = stubApi();
    renderEditor();
    await waitFor(() => expect(calls.filter(([url]) => url.endsWith("/interface"))).toHaveLength(2));
    await chooseOption("New row pin A", "1");
    await chooseOption("New row pin B", "1");
    fireEvent.click(screen.getByRole("button", { name: /Add row/ }));
    expect(screen.getByText(/1 to fix before saving/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save pins" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers one level of Undo after a save, sending the rows as they were (SB2-102)", async () => {
    const calls = stubApi();
    renderEditor();
    await waitFor(() => expect(calls.filter(([url]) => url.endsWith("/interface"))).toHaveLength(2));
    const before = theLink.rows.map(({ id, pinA, pinB, signal, source }) => ({ id, pinA, pinB, signal, source }));
    const field = screen.getAllByRole("textbox", { name: /^Signal for/ })[0];
    fireEvent.change(field, { target: { value: "RENAMED" } });
    expect(screen.getByText(/Unsaved changes: 1 row$/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save pins" }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(calls.filter(([url, init]) => url.endsWith("/rows") && init.method === "PUT")).toHaveLength(2));
    const [, undone] = calls.filter(([url, init]) => url.endsWith("/rows") && init.method === "PUT")[1];
    expect(JSON.parse(String(undone.body))).toEqual(expect.arrayContaining(before));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Undo" })).toBeNull());
  });

  it("previews a generator and approves its rows into the draft", async () => {
    stubApi();
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /Generate rows/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Preview/ }));
    expect(await screen.findByText(/1 proposed · 1 skipped \(already used\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add 1 to the draft" }));
    expect(screen.getByText(/Unsaved changes: 1 row$/)).toBeTruthy(); // SB2-102: the change, not the draft
  });

  it("is read-only for viewers", () => {
    stubApi();
    renderEditor(false);
    expect(screen.queryByRole("button", { name: /Add row/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Link actions/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Generate rows/ })).toBeNull();
    expect(screen.queryByLabelText(/Signal for/)).toBeNull();
  });
  it("names the physical connector behind a subsystem export", () => {
    const withExport = { ...link("L9", a.id, "J7", b.id, "PWR_IN", 1) };
    withExport.b = { ...withExport.b, export: { name: "PWR_IN", reference: "J6", occurrence: "/sin_x", description: "" } };
    expect(endLabel(systemDocument([a, b], [withExport]), withExport, "b")).toBe("PAY PWR_IN → J6");
  });
});
