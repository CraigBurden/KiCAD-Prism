import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chooseMenuItem, openMenu } from "@/test/select";
import type { SystemDocument } from "@/types/system";

import { BoardDetail } from "./board-detail";
import { buildDiagram, connectionIntent, connectionToLink, handleId } from "./diagram-model";
import { padRanges } from "./subport-section";
import { endKey, endPads, endReference, splitEndKey } from "./subport-model";
import { renderInSession } from "./session/memory-session";
import { instance, link, port, systemDocument } from "./test-fixtures";

afterEach(() => vi.unstubAllGlobals());

const PWR = { id: "spt_pwr", portKey: "key-J7", name: "PWR", pads: ["1", "2", "3"] };
const obc = instance("OBC", { ports: [port("J7", { pinCount: 6 }), port("J2")], subports: [PWR] });
const pay = instance("PAY");
const split = link("L1", obc.id, "J7", pay.id, "J1", 2);
const onPwr = { ...link("L2", obc.id, "J7", pay.id, "J2", 1), a: { ...link("L2", obc.id, "J7", pay.id, "J2").a, subport: { id: "spt_pwr", name: "PWR" } } };
const doc = systemDocument([obc, pay], [split, onPwr]);

describe("sub-port model", () => {
  it("keys an end by its connector and sub-port, and reads it back", () => {
    expect(endKey("/a/b", "spt_x")).toBe("/a/b#spt_x");
    expect(splitEndKey("/a/b#spt_x")).toEqual({ portKey: "/a/b", subportId: "spt_x" });
    expect(splitEndKey("/a/b")).toEqual({ portKey: "/a/b", subportId: null });
  });

  it("gives each end its own pads, and names it J7.PWR", () => {
    expect([...endPads(["1", "2", "3", "4", "5"], [PWR], "spt_pwr")]).toEqual(["1", "2", "3"]);
    expect([...endPads(["1", "2", "3", "4", "5"], [PWR], null)]).toEqual(["4", "5"]);
    expect(endReference(onPwr.a)).toBe("J7.PWR");
    expect(endReference(split.a)).toBe("J7");
    expect(padRanges(["15", "1", "3", "2", "A1"])).toBe("1–3, 15, A1");
  });
});

describe("the diagram with a split connector", () => {
  it("draws the remainder and the sub-port as ports of their own", () => {
    const { nodes, edges } = buildDiagram(doc, {});
    const rows = nodes.find((node) => node.id === obc.id)!.data.rows.map((row) => row.reference);
    expect(rows).toEqual(expect.arrayContaining(["J7", "J7.PWR"]));
    const edge = edges.find((candidate) => candidate.id === "L2")!;
    expect(edge.sourceHandle === handleId("r", "key-J7#spt_pwr") || edge.targetHandle?.endsWith("key-J7#spt_pwr")).toBe(true);
  });

  it("asks for a link on the sub-port, and a harness on the whole connector", () => {
    const connection = { source: obc.id, sourceHandle: handleId("r", "key-J7#spt_pwr"), target: pay.id, targetHandle: handleId("l", "key-J1") };
    expect(connectionToLink(connection)).toEqual({
      a: { instanceId: obc.id, portKey: "key-J7", subportId: "spt_pwr" }, b: { instanceId: pay.id, portKey: "key-J1" } });
    expect(connectionIntent(connection, doc, "harness")).toEqual({
      kind: "harness", a: { instanceId: obc.id, portKey: "key-J7" }, b: { instanceId: pay.id, portKey: "key-J1" } });
  });
});

function renderBoard(document: SystemDocument) {
  return renderInSession(<BoardDetail systemId="sys_1" document={document} instance={document.instances[0]} canEdit />, { document });
}

describe("sub-ports in the board inspector", () => {
  it("lists a connector's sub-ports under it, and refuses to hide a split connector", async () => {
    renderBoard(doc);
    const ports = screen.getByRole("list", { name: "Ports" });
    expect(within(ports).getByText("J7.PWR")).toBeTruthy();
    expect(within(ports).getByText("1–3")).toBeTruthy();
    await openMenu("Actions for J2");
    expect(screen.getByRole("menuitem", { name: /^Split$/ })).toBeTruthy();
  });

  it("splits a connector: the server previews the moves, then the split is sent with If-Match", async () => {
    const calls: { url: string; method: string; ifMatch: string | null; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      calls.push({ url, method: init.method ?? "GET", ifMatch: headers.get("If-Match"), body: init.body ? JSON.parse(String(init.body)) : null });
      if (url.includes("/interface")) {
        return new Response(JSON.stringify({ components: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const body = { subport: { ...PWR, id: "spt_new", name: "SIG", pads: ["1"], instanceId: obc.id, label: "J2.SIG" },
        moves: [{ linkId: "L1", end: "a", action: "split", rowIds: ["r"], toSubportId: "spt_new", newLinkName: "L1 · SIG" }] };
      return new Response(JSON.stringify(body), { status: url.includes("preview") ? 200 : 201,
        headers: { "Content-Type": "application/json", ETag: '"sys:sys_1:2"' } });
    }));
    renderBoard(doc);
    await chooseMenuItem("Actions for J2", /^Split$/);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "SIG" } });
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    expect(await screen.findByText(/new link L1 · SIG/)).toBeTruthy();
    expect(calls.find((call) => call.url.includes("preview"))?.ifMatch).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    await waitFor(() => expect(calls.some((call) => call.method === "POST" && !call.url.includes("preview"))).toBe(true));
    const sent = calls.find((call) => call.method === "POST" && !call.url.includes("preview"))!;
    expect(sent.ifMatch).toBe('"sys:sys_1:1"');
    expect(sent.body).toEqual({ portKey: "key-J2", name: "SIG", pads: ["1"] });
  });
});
