import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chooseOption } from "@/test/select";

import type { Finding } from "@/types/system";

import { HarnessEditor, draftFromHarness, splices, wireProblems } from "./harness-editor";
import { harness, harnessEnd, instance, systemDocument } from "./test-fixtures";

afterEach(() => vi.unstubAllGlobals());

const obc = instance("OBC");
const pwr = instance("PWR");
const pay = instance("PAY");
const cam = instance("CAM");

/**
 * The merge, split and swap example (SB2-15): OBC J1 and J2 merge into PAY J1;
 * PWR J1 splits to CAM J1 and PAY J1; OBC J1 pins 3 and 4 cross over to PAY 4 and 3.
 */
const five = harness("shn_5", [
  harnessEnd("she_a", 0, { instanceId: obc.id, reference: "J1" }),
  harnessEnd("she_b", 1, { instanceId: obc.id, reference: "J2" }),
  harnessEnd("she_c", 2, { instanceId: pwr.id, reference: "J1" }, 2),
  harnessEnd("she_d", 3, { instanceId: cam.id, reference: "J1" }, 2),
  harnessEnd("she_e", 4, { instanceId: pay.id, reference: "J1" }, 8),
], [
  ["she_a", "1", "she_e", "1"], ["she_b", "1", "she_e", "2"], // merge
  ["she_c", "1", "she_d", "1"], ["she_c", "1", "she_e", "5"], // split: a splice on PWR J1 pin 1
  ["she_a", "3", "she_e", "4"], ["she_a", "4", "she_e", "3"], // swap
]);
const doc = { ...systemDocument([obc, pwr, pay, cam]), harnesses: [five] };

function stubApi() {
  const calls: [string, RequestInit][] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push([url, init]);
    const json = (body: unknown) => new Response(JSON.stringify(body), {
      status: 200, headers: { "Content-Type": "application/json", ETag: '"sys:sys_1:2"' },
    });
    if (url.endsWith("/suggestions")) {
      const endId = url.split("/")[7];
      return json({ endId, connectorMpn: "X", connectorPart: { componentId: "p", name: "P", mpn: "FTSH-110", manufacturer: "Samtec" },
        suggestions: endId === "she_a" ? [{ componentId: "h", name: "Housing", mpn: "FFSD-10", manufacturer: "Samtec" }] : [] });
    }
    if (url.startsWith("/api/catalog/components?")) {
      return json({ items: [{ id: "molex", value: "Housing", description: "", mpn: "51021-0400", manufacturer: "Molex" }], total: 1, page: 1, page_size: 8 });
    }
    if (url.endsWith("/generate")) {
      return json({ wires: [{ from: { end: "she_b", pin: "2" }, to: { end: "she_e", pin: "6" }, signal: "G", netFrom: [], netTo: [] }], skipped: [] });
    }
    return json(five);
  }));
  return calls;
}

function renderEditor(target = five, findings: Finding[] = []) {
  const run = vi.fn(async (_label: string, action: () => Promise<unknown>) => action());
  render(<HarnessEditor systemId="sys_1" document={{ ...doc, harnesses: [target] }} harness={target} etag='"sys:sys_1:1"'
    canEdit findings={findings} busy={null} run={run as never} onDeleted={vi.fn()} onConverted={vi.fn()} />);
}

describe("harness drafts", () => {
  it("finds splices and refuses impossible wires", () => {
    const draft = draftFromHarness(five);
    expect([...splices(draft)]).toEqual(["she_c#1"]);
    expect(wireProblems(draft, five).size).toBe(0);
    const bad = [...draft, { key: "x", from: { end: "she_a", pin: "1" }, to: { end: "she_a", pin: "2" } },
      { key: "y", from: { end: "she_c", pin: "9" }, to: { end: "she_e", pin: "1" } }];
    expect([...wireProblems(bad, five).values()]).toEqual(["A wire joins two different ends.", "That pin does not exist on the end."]);
  });
});

describe("HarnessEditor", () => {
  it("alerts for its open findings and leaves waived ones out (SB2-100)", () => {
    stubApi();
    const finding = (patch: Partial<Finding>): Finding => ({
      rule: "SYS-V19", name: "harness_tight_bend", severity: "warning", instanceId: null, linkId: null, rowId: null, end: null,
      reference: null, pin: null, detail: { harnessId: "shn_5" }, redacted: false, ...patch,
    });
    renderEditor(five, [finding({ key: "k1", waived: { id: "w1", note: "fine", by: "user:a", at: "" } })]);
    expect(screen.queryByText(/1 warning/)).toBeNull();
  });

  it("alerts for an open finding that names it", () => {
    stubApi();
    renderEditor(five, [{
      rule: "SYS-V19", name: "harness_tight_bend", severity: "warning", instanceId: null, linkId: null, rowId: null, end: null,
      reference: null, pin: null, detail: { harnessId: "shn_5" }, redacted: false,
    }]);
    expect(screen.getByText(/1 warning/)).toBeTruthy();
  });

  it("shows every end with its mate and block, and marks the splice", () => {
    stubApi();
    renderEditor();
    const ends = screen.getByRole("region", { name: "Ends" });
    for (const text of ["OBC J1", "OBC J2", "PWR J1", "CAM J1", "PAY J1"]) expect(ends.textContent).toContain(text);
    expect(ends.textContent).toContain("Generic · 8 pins");
    expect(screen.getAllByTestId("wire-row")).toHaveLength(6);
    expect(screen.getAllByText("splice")).toHaveLength(2);
    expect(screen.getByText(/1 spliced pin/)).toBeTruthy();
  });

  it("suggests the catalog partners of a Generic end's connector without assigning them", async () => {
    stubApi();
    renderEditor();
    expect(await screen.findByText("Mates with FFSD-10")).toBeTruthy();
    expect(screen.getAllByText("No mating part recorded for FTSH-110").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Use/ })).toBeNull();
    expect(screen.getAllByTestId("mating-block").map((cell) => cell.textContent)).toContain("Generic · 4 pins");
  });

  it("assigns a suggested part only when the user picks it, and makes it Generic again", async () => {
    const calls = stubApi();
    const assigned = { ...five, ends: five.ends.map((end) => end.id === "she_b"
      ? { ...end, part: { componentId: "jst", revisionId: "r1", name: "Housing", mpn: "PHR-4", manufacturer: "JST" }, pins: ["1", "2", "3", "4"] }
      : end) };
    renderEditor(assigned);
    expect(await screen.findByText("PHR-4 · JST · 4 pins")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Choose part" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Use FFSD-10" }));
    await waitFor(() => expect(calls.filter(([, init]) => init.method === "PATCH")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Make generic" }));
    await waitFor(() => expect(calls.filter(([, init]) => init.method === "PATCH")).toHaveLength(2));
    expect(calls.filter(([, init]) => init.method === "PATCH").map(([url, init]) => [url.split("/").pop(), JSON.parse(String(init.body))]))
      .toEqual([["she_a", { part: { componentId: "h" } }], ["she_b", { part: null }]]);
  });

  it("finds any catalog part by search", async () => {
    const calls = stubApi();
    renderEditor();
    fireEvent.click(screen.getAllByRole("button", { name: "Choose part" })[2]);
    fireEvent.change(await screen.findByRole("textbox", { name: "Find a catalog part" }), { target: { value: "5102" } });
    fireEvent.click(await screen.findByRole("button", { name: "Use 51021-0400" }));
    await waitFor(() => expect(calls.some(([, init]) => init.method === "PATCH")).toBe(true));
    const [url, init] = calls.find(([, i]) => i.method === "PATCH")!;
    expect([url, JSON.parse(String(init.body))]).toEqual(["/api/systems/sys_1/harnesses/shn_5/ends/she_c", { part: { componentId: "molex" } }]);
  });

  it("maps a part's pins onto the connector's pads", async () => {
    const calls = stubApi();
    const housing = { ...five, ends: five.ends.map((end) => end.id === "she_c"
      ? { ...end, part: { componentId: "jst", revisionId: "r1" }, pins: ["A", "B"], matePads: ["1", "2"] } : end) };
    renderEditor(housing);
    fireEvent.click(screen.getAllByRole("button", { name: "One to one" })[2]);
    await chooseOption("Pad for end pin A", "1");
    await chooseOption("Pad for end pin B", "2");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some(([, init]) => init.method === "PATCH")).toBe(true));
    const [, init] = calls.find(([, i]) => i.method === "PATCH")!;
    expect(JSON.parse(String(init.body))).toEqual({ pinMap: { A: "1", B: "2" } });
  });

  it("adds a wire and saves the whole list", async () => {
    const calls = stubApi();
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /Add wire/ }));
    await chooseOption("Wire 7 from end", "End 2"); // a new wire joins the bottom and stays there
    await chooseOption("Wire 7 from pin", "3");
    await chooseOption("Wire 7 to end", "End 5");
    await chooseOption("Wire 7 to pin", "7");
    fireEvent.click(screen.getByRole("button", { name: "Save wires" }));
    await waitFor(() => expect(calls.some(([, init]) => init.method === "PUT")).toBe(true));
    const [url, init] = calls.find(([, i]) => i.method === "PUT")!;
    const body = JSON.parse(String(init.body)) as { id?: string; from: unknown; to: unknown }[];
    expect(url).toBe("/api/systems/sys_1/harnesses/shn_5/wires");
    expect(body).toHaveLength(7);
    expect(body.filter((wire) => wire.id).length).toBe(6);
    expect(body.find((wire) => !wire.id)).toMatchObject({ from: { end: "she_b", pin: "3" }, to: { end: "she_e", pin: "7" } });
  });

  it("pastes a spreadsheet block and sets gauge and colour on ticked wires (SB2-123)", async () => {
    const calls = stubApi();
    renderEditor();
    fireEvent.paste(screen.getByRole("textbox", { name: "Wire 1 gauge" }), { clipboardData: { getData: () => "24\tRD\n26\tBK\n" } });
    expect((screen.getByRole("textbox", { name: "Wire 2 colour" }) as HTMLInputElement).value).toBe("BK");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select wire 3" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select wire 4" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Colour for selected" }), { target: { value: "WH" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(screen.getByText(/Unsaved changes: 4 wires/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save wires" }));
    await waitFor(() => expect(calls.some(([, init]) => init.method === "PUT")).toBe(true));
    const body = JSON.parse(String(calls.find(([, i]) => i.method === "PUT")![1].body)) as { gaugeAwg: number | null; colour: string | null }[];
    expect(body.slice(0, 2).map((wire) => wire.gaugeAwg)).toEqual([24, 26]);
    expect(body.slice(0, 4).map((wire) => wire.colour)).toEqual(["RD", "BK", "WH", "WH"]);
  });

  it("generates wires for an end pair into the draft", async () => {
    const calls = stubApi();
    renderEditor();
    await chooseOption("Generate from end", "End 2");
    await chooseOption("Generate to end", "End 5");
    fireEvent.click(screen.getByRole("button", { name: /Generate/ }));
    await waitFor(() => expect(screen.getAllByTestId("wire-row")).toHaveLength(7));
    const [, init] = calls.find(([url]) => url.endsWith("/generate"))!;
    expect(JSON.parse(String(init.body))).toEqual({ fromEnd: "she_b", toEnd: "she_e", generator: "identity" });
    expect(screen.getByText(/Unsaved changes: 1 wire$/)).toBeTruthy(); // SB2-102: the change, not the draft
  });

  it("edits an end's pin map", async () => {
    const calls = stubApi();
    renderEditor();
    fireEvent.click(screen.getAllByRole("button", { name: "One to one" })[0]);
    await chooseOption("Pad for end pin 3", "4");
    await chooseOption("Pad for end pin 4", "3");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some(([, init]) => init.method === "PATCH")).toBe(true));
    const [url, init] = calls.find(([, i]) => i.method === "PATCH")!;
    expect([url, JSON.parse(String(init.body))]).toEqual(["/api/systems/sys_1/harnesses/shn_5/ends/she_a", { pinMap: { 3: "4", 4: "3" } }]);
  });

  it("offers conversion to a link only for a simple harness", async () => {
    stubApi();
    renderEditor();
    fireEvent.keyDown(screen.getByRole("button", { name: "Harness actions" }), { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: /Convert to a link/ });
    expect(item.getAttribute("aria-disabled") ?? item.getAttribute("data-disabled")).not.toBeNull();
  });
});
