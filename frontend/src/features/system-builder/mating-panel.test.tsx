import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { chooseMenuItem, chooseOption } from "@/test/select";
import type { LinkMate, PortMating, SystemLink, SystemPlacement } from "@/types/system";

import { LinkEditor } from "./link-editor";
import { previewOf } from "./mate-preview";
import { matingSummary, placementStatus } from "./mating-panel";
import { renderInSession } from "./session/memory-session";
import { instance, link, systemDocument } from "./test-fixtures";

afterEach(() => vi.unstubAllGlobals());

const obc = instance("OBC");
const cmbd = instance("CMBD");

function port(patch: Partial<PortMating> = {}): PortMating {
  return {
    portKey: "key-J1", reference: "J1", footprint: "F:X", hasGeometry: true,
    inferred: { axis: "top", confidence: "medium", reasons: ["body_over_pads"] }, stored: null, ...patch,
  };
}

const placement = (patch: Partial<SystemPlacement> = {}): SystemPlacement => ({
  systemId: "sys_1", version: 1, roots: [], driving: {}, mismatches: [], unusable: ["L1"], ignoredOverrides: [], drivingMates: {},
  ...patch,
});

const noGeometry = (instanceId: string) => ({
  instanceId, kind: "board", portKey: "key-J1", reference: "J1", geometry: null, thicknessMm: null, inferred: null, stored: null,
});

function stubApi(ports: Record<string, PortMating>, extra: { placement?: SystemPlacement; mate?: LinkMate } = {}) {
  const calls: [string, RequestInit][] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push([url, init]);
    const json = (body: unknown) => new Response(JSON.stringify(body), {
      status: 200, headers: { "Content-Type": "application/json", ETag: '"sys:sys_1:2"' },
    });
    const mating = url.match(/instances\/([^/]+)\/mating$/);
    if (mating) return json({ instanceId: mating[1], boardThicknessMm: 1.6, ports: [ports[mating[1]]] });
    if (url.includes("/interface")) return json({ components: [] });
    if (url.endsWith("/placement")) return json(extra.placement ?? placement());
    if (url.endsWith("/mate")) return json(extra.mate ?? { linkId: "L1", stackHeightMm: 8, a: noGeometry(obc.id), b: noGeometry(cmbd.id) });
    return json({});
  }));
  return calls;
}

function renderEditor(theLink: SystemLink = { ...link("L1", obc.id, "J1", cmbd.id, "J1", 1), type: "b2b", stackHeightMm: 8 }) {
  const document = systemDocument([obc, cmbd], [theLink]);
  renderInSession(<LinkEditor systemId="sys_1" document={document} link={theLink} canEdit findings={[]} onDeleted={vi.fn()} />, { document });
}

describe("matingSummary", () => {
  it("reads stored, inferred and missing frames", () => {
    expect(matingSummary(port())).toEqual({ label: "Inferred (medium): Vertical, top side", tone: "info" });
    expect(matingSummary(port({ stored: { mode: "override", axis: "+x", quarterTurns: 1, stale: false } })))
      .toEqual({ label: "Set by hand: Right-angle, footprint +X · turned 90°", tone: "ok" });
    expect(matingSummary(port({ stored: { mode: "confirmed", axis: "top", quarterTurns: 0, stale: true } })).tone).toBe("warn");
    expect(matingSummary(port({ inferred: { axis: null, confidence: "low", reasons: ["no_courtyard"] } })))
      .toEqual({ label: "Mating details needed", tone: "warn" });
  });
});

describe("board-to-board link details", () => {
  it("shows both ends' frames and confirms an inferred one", async () => {
    const calls = stubApi({
      [obc.id]: port(),
      [cmbd.id]: port({ inferred: { axis: null, confidence: "low", reasons: ["too_few_pads"] } }),
    });
    renderEditor();
    expect(screen.getByText("Board-to-board")).toBeTruthy();
    expect((screen.getByLabelText("Stack height (mm)") as HTMLInputElement).value).toBe("8");
    await screen.findByText("Inferred (medium): Vertical, top side");
    expect(await screen.findByText("Mating details needed")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Confirm" })).toHaveLength(1); // nothing to confirm on a low inference
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(calls.some(([, init]) => init.method === "PUT")).toBe(true));
    const [url, init] = calls.find(([, i]) => i.method === "PUT")!;
    expect([url, JSON.parse(String(init.body))]).toEqual([`/api/systems/sys_1/instances/${obc.id}/mating/key-J1`, { mode: "confirmed" }]);
  });

  it("sets the stack height in place and clears it back to auto", async () => {
    const calls = stubApi({ [obc.id]: port(), [cmbd.id]: port() });
    renderEditor();
    const field = screen.getByLabelText("Stack height (mm)");
    fireEvent.change(field, { target: { value: "abc" } });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(calls.some(([, init]) => init.method === "PATCH")).toBe(false);
    fireEvent.change(field, { target: { value: "15.24" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(calls.some(([, init]) => init.method === "PATCH")).toBe(true));
    const [url, init] = calls.find(([, i]) => i.method === "PATCH")!;
    expect([url, JSON.parse(String(init.body))]).toEqual(["/api/systems/sys_1/links/L1", { stackHeightMm: 15.24 }]);
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    await waitFor(() => expect(calls.filter(([, i]) => i.method === "PATCH")).toHaveLength(2));
    expect(JSON.parse(String(calls.filter(([, i]) => i.method === "PATCH")[1][1].body))).toEqual({ stackHeightMm: null });
  });

  it("confirms both inferred frames in one go, and fills an empty mate pad to pad (SB2-114)", async () => {
    const calls = stubApi({ [obc.id]: port(), [cmbd.id]: port() });
    const generated = { linkId: "L1", generator: "identity", skipped: [], rows: [
      { pinA: "1", pinB: "1", signal: "VIN", source: "generator", netA: ["/VIN"], netB: ["/VIN"], pinNamesA: null, pinNamesB: null }] };
    const base = fetch as unknown as (url: string, init?: RequestInit) => Promise<Response>;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.endsWith("/generate")) {
        calls.push([url, init]);
        return new Response(JSON.stringify(generated), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return base(url, init);
    }));
    renderEditor({ ...link("L1", obc.id, "J1", cmbd.id, "J1", 0), type: "b2b", stackHeightMm: 8 });

    fireEvent.click(await screen.findByRole("button", { name: "Confirm both" }));
    await waitFor(() => expect(calls.filter(([, i]) => i.method === "PUT" && i.body && String(i.body).includes("confirmed"))).toHaveLength(2));
    const puts = calls.filter(([, i]) => i.method === "PUT").map(([url]) => url);
    expect(puts).toEqual([`/api/systems/sys_1/instances/${obc.id}/mating/key-J1`, `/api/systems/sys_1/instances/${cmbd.id}/mating/key-J1`]);

    fireEvent.click(within(screen.getByRole("group", { name: "Fill pins" })).getByRole("button", { name: "Same pin" }));
    await waitFor(() => expect(calls.some(([url, i]) => url.endsWith("/rows") && i.method === "PUT")).toBe(true));
    const [, init] = calls.find(([url, i]) => url.endsWith("/rows") && i.method === "PUT")!;
    expect(JSON.parse(String(init.body))).toEqual([{ pinA: "1", pinB: "1", signal: "VIN", source: "generator" }]);
  });

  it("does not offer Confirm over a frame set by hand", async () => {
    stubApi({
      [obc.id]: port({ stored: { mode: "override", axis: "bottom", quarterTurns: 0, stale: false } }),
      [cmbd.id]: port({ stored: { mode: "confirmed", axis: "top", quarterTurns: 0, stale: false } }),
    });
    renderEditor();
    expect(await screen.findByText("Set by hand: Vertical, bottom side")).toBeTruthy();
    await screen.findByText("Confirmed: Vertical, top side");
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Reset" })).toHaveLength(2);
  });

  it("sets a frame by hand with a direction and a turn", async () => {
    const calls = stubApi({ [obc.id]: port(), [cmbd.id]: port() });
    renderEditor();
    await screen.findAllByText("Inferred (medium): Vertical, top side");
    fireEvent.click(screen.getAllByRole("button", { name: "Set by hand" })[1]);
    await chooseOption("Mating direction B", "Right-angle, footprint −Y");
    await chooseOption("Turn about the mating axis B", "270°");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some(([, init]) => init.method === "PUT")).toBe(true));
    const [url, init] = calls.find(([, i]) => i.method === "PUT")!;
    expect([url, JSON.parse(String(init.body))]).toEqual([
      `/api/systems/sys_1/instances/${cmbd.id}/mating/key-J1`, { mode: "override", axis: "-y", quarterTurns: 3 }]);
  });

  it("changes the type and stack height in the details dialog", async () => {
    const calls = stubApi({ [obc.id]: port(), [cmbd.id]: port() });
    renderEditor(link("L1", obc.id, "J1", cmbd.id, "J1", 1));
    expect(screen.queryByRole("region", { name: "Mating" })).toBeNull();
    await chooseMenuItem("Link actions", /Edit details/);
    await chooseOption("Link type", /Board-to-board/);
    fireEvent.change(screen.getByLabelText("Stack height (mm)"), { target: { value: "11.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some(([, init]) => init.method === "PATCH")).toBe(true));
    const [url, init] = calls.find(([, i]) => i.method === "PATCH")!;
    expect([url, JSON.parse(String(init.body))]).toEqual(["/api/systems/sys_1/links/L1",
      { name: "L1", harness: null, type: "b2b", stackHeightMm: 11.5 }]);
  });
});

describe("placement status (SB2-39)", () => {
  const theLink = { ...link("L1", obc.id, "J1", cmbd.id, "J1", 1), type: "b2b" as const };
  const label = (id: string) => (id === obc.id ? "OBC" : "CMBD");

  it("says how the solve used the link", () => {
    expect(placementStatus(placement(), theLink, label).text).toMatch(/confirm or set both connectors' frames/);
    expect(placementStatus(placement({ unusable: [], driving: { [cmbd.id]: { linkId: "L1", from: obc.id, overridden: false } },
      drivingMates: { [cmbd.id]: "L1" } }), theLink, label).text).toBe("Places CMBD on OBC (chosen).");
    expect(placementStatus(placement({ unusable: [] }), theLink, label)).toEqual({ tone: "ok", text: "Lines up with the stack." });
    const miss = placementStatus(placement({ unusable: [], mismatches: [{ linkId: "L1", offsetMm: [140.35, 0, 0],
      lateralMm: 140.35, axialMm: 0, angleDeg: 0 }] }), theLink, label);
    expect(miss).toEqual({ tone: "warn", text: "Doesn't line up where the stack puts it: 140.35 mm across the mating plane." });
  });

  it("offers to place a board by this link, and to go back to automatic", async () => {
    const calls = stubApi({ [obc.id]: port(), [cmbd.id]: port() }, {
      placement: placement({ unusable: [], roots: [obc.id], driving: { [cmbd.id]: { linkId: "L2", from: obc.id, overridden: false } } }),
    });
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Place CMBD by this link" }));
    await waitFor(() => expect(calls.some(([url, init]) => init.method === "PUT" && url.endsWith(`/driving-mates/${cmbd.id}`))).toBe(true));
    const [, init] = calls.find(([url, i]) => i.method === "PUT" && url.endsWith(`/driving-mates/${cmbd.id}`))!;
    expect(JSON.parse(String(init.body))).toEqual({ linkId: "L1" });
  });
});

describe("mate preview (SB2-39)", () => {
  // Stock vertical headers from the shared goldens: one on a top side, one on a back side turned 90°.
  const golden = JSON.parse(readFileSync(resolve(__dirname, "../../../../backend/tests/fixtures/system_builder/placement_cases.json"), "utf8"));
  const geometry = (name: string) => golden.frames.find((c: { name: string }) => c.name === name).geometry;
  const pair: LinkMate = {
    linkId: "L1", stackHeightMm: 8.5,
    a: { ...noGeometry("a"), geometry: geometry("vertical header, top"), thicknessMm: 1.6 },
    b: { ...noGeometry("b"), geometry: geometry("vertical header, bottom, 90°"), thicknessMm: 1.6 },
  };

  it("draws the pair with the frames being picked", () => {
    const preview = previewOf(pair, { a: null, b: null })!;
    expect(preview.shapes.map((shape) => `${shape.side}:${shape.kind}`)).toEqual(["a:board", "a:body", "b:body", "b:board"]);
    expect(preview.padOne.map((dot) => dot.side)).toEqual(["a", "b"]);
    expect([preview.result.heightSource, preview.result.stackHeightMm]).toEqual(["link", 8.5]);
    const turned = previewOf(pair, { a: null, b: { axis: "bottom", quarterTurns: 1 } })!;
    expect(turned.result.pose.rotation).not.toEqual(preview.result.pose.rotation);
    expect(previewOf({ ...pair, b: noGeometry("b") }, { a: null, b: null })).toBeNull();
  });

  it("renders in the link details", async () => {
    stubApi({ [obc.id]: port(), [cmbd.id]: port() }, { mate: pair });
    renderEditor();
    expect(await screen.findByRole("img", { name: "OBC J1 mated with CMBD J1" })).toBeTruthy();
    expect(screen.getByText(/stack height 8.5 mm/)).toBeTruthy();
  });
});
