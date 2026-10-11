import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChangesTab } from "./changes-tab";
import { allowedDecisions, automaticEvents, describeValue, groupItems, itemGroup } from "./review-model";
import { renderInSession } from "./session/memory-session";
import { instance, link, systemDocument } from "./test-fixtures";
import type { Review, ReviewItem } from "@/types/system";

afterEach(() => vi.unstubAllGlobals());

const obc = instance("OBC", { baselineCommit: "a".repeat(40) });
const pwr = instance("PWR", { pinned: true, updateAvailable: true, tipCommit: "b".repeat(40) });
const doc = systemDocument([obc, pwr], [link("L1", obc.id, "J7", pwr.id, "J1", 2)]);

const item = (patch: Partial<ReviewItem>): ReviewItem => ({
  id: "i1", ordinal: 0, kind: "net_changed", linkId: "L1", end: "a", rowIds: ["r1"], pins: ["17"],
  expected: ["PAYLOAD_RESET#"], observed: [], candidates: null, decision: null, decisionPayload: null, ...patch,
});

const review: Review = {
  id: "rv1", kind: "source_update", status: "open", instanceId: obc.id, createdAt: "", decidedBy: null, decidedAt: null,
  redacted: false, fromCommit: "a".repeat(40), toCommit: "c".repeat(40),
  pendingChanges: { silent: [{ kind: "connector_relabelled", linkId: "L1", end: "a", before: { reference: "J2" }, after: { reference: "J12" } }] },
  items: [
    item({}),
    item({ id: "i2", ordinal: 1, kind: "connector_missing", end: "b", pins: ["1", "2"], expected: null, observed: null,
      candidates: [{ portKey: "k-J6", reference: "J6", referenceEqual: false, libIdEqual: true, pinCountEqual: true, netOverlap: 0.75 }] }),
  ],
};

function stub(reviews: Review[]) {
  const calls: [string, RequestInit][] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push([url, init]);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json", ETag: '"sys:sys_1:5"' },
    });
    if (url.includes("/reviews?")) return json(reviews);
    if (url.includes("/history")) {
      return json({ nextCursor: null, events: [
        { seq: 3, id: "e3", at: "2026-09-29T10:00:00Z", actor: "system:detection", kind: "baseline_auto_advanced",
          payload: { instanceId: obc.id, from: "1".repeat(40), to: "2".repeat(40) }, redacted: false },
        { seq: 2, id: "e2", at: "2026-09-29T09:00:00Z", actor: "user:a", kind: "rows_replaced", payload: {}, redacted: false },
      ] });
    }
    if (url.includes("/rebase")) return json({ job_id: "j", status: "queued" }, 202);
    return json({ ...reviews[0] });
  }));
  return calls;
}

function renderTab(canEdit = true) {
  return renderInSession(<ChangesTab systemId="sys_1" document={doc} canEdit={canEdit} user={null} onNavigate={vi.fn()} />, { document: doc }).loads;
}

describe("review model", () => {
  it("groups conflicts apart from yes/no items and lists the allowed decisions", () => {
    expect(itemGroup("pin_missing")).toBe("conflict");
    expect(itemGroup("net_changed")).toBe("review");
    expect(groupItems(review.items ?? []).conflict.map((i) => i.id)).toEqual(["i2"]);
    expect(allowedDecisions(review, "net_changed")).toEqual(["accept", "remap", "remove_rows"]);
    expect(allowedDecisions(review, "connector_changed")).toEqual(["accept"]);
    expect(allowedDecisions({ kind: "import" }, "signal_mismatch")).toEqual(["accept", "remove_rows"]);
    expect(describeValue([])).toBe("(no net)");
    expect(describeValue({ libId: "A", pinCount: 4 })).toBe("libId: A, pinCount: 4");
  });

  it("keeps only automatic audit events", () => {
    expect(automaticEvents([
      { seq: 1, id: "a", at: "", actor: "", kind: "connector_rebound", payload: null, redacted: false },
      { seq: 2, id: "b", at: "", actor: "", kind: "link_created", payload: null, redacted: false },
    ]).map((e) => e.id)).toEqual(["a"]);
  });
});

describe("ChangesTab", () => {
  it("shows silent changes, conflicts and reviews, and records decisions with If-Match", async () => {
    const calls = stub([review]);
    const loads = renderTab();
    expect(await screen.findByText("Resolved automatically when applied")).toBeTruthy();
    expect(screen.getByText("Conflicts: choose a new mapping")).toBeTruthy();
    expect(screen.getByText("Review required")).toBeTruthy();
    expect(screen.getByText(/J2 → J12/)).toBeTruthy();
    expect(screen.getByText("PAYLOAD_RESET#")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Remap to pad"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Remap" }));
    await waitFor(() => expect(loads()).toBe(1));
    const [url, init] = calls.find(([u]) => u.endsWith("/decision"))!;
    expect(url).toBe("/api/systems/sys_1/reviews/rv1/items/i1/decision");
    expect(JSON.parse(String(init.body))).toEqual({ decision: "remap", payload: { pad: "20" } });
    expect(new Headers(init.headers).get("If-Match")).toBe('"sys:sys_1:1"');

    fireEvent.click(screen.getByRole("button", { name: "Bind" }));
    await waitFor(() => expect(calls.filter(([u]) => u.endsWith("/decision"))).toHaveLength(2));
    const bind = calls.filter(([u]) => u.endsWith("/decision"))[1];
    expect(JSON.parse(String(bind[1].body))).toEqual({ decision: "bind_candidate", payload: { portKey: "k-J6" } });
  });

  it("lists pinned updates and automatic changes; viewers get no actions", async () => {
    stub([]);
    renderTab(false);
    expect(await screen.findByText("Updates on pinned boards")).toBeTruthy();
    expect(screen.getByText("Applied automatically")).toBeTruthy();
    expect(screen.getByText(/OBC 11111111 → 22222222/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rebase to tip" })).toBeNull();
  });

  it("rebases a pinned board to its tip", async () => {
    const calls = stub([]);
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "Rebase to tip" }));
    await waitFor(() => expect(calls.some(([u]) => u.endsWith("/rebase"))).toBe(true));
    const [, init] = calls.find(([u]) => u.endsWith("/rebase"))!;
    expect(JSON.parse(String(init.body))).toEqual({ commit: "b".repeat(40) });
  });

  it("says when nothing needs review", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("history") ? { events: [], nextCursor: null } : []), {
      status: 200, headers: { "Content-Type": "application/json" },
    })));
    const document = systemDocument([obc]);
    renderInSession(<ChangesTab systemId="sys_1" document={document} canEdit user={null} onNavigate={vi.fn()} />, { document });
    expect(await screen.findByText("Nothing to review")).toBeTruthy();
  });
  it("shows a subsystem review by revision and offers the latest released revision", async () => {
    const cndh = instance("CNDH", { kind: "assembly", projectId: null, baselineCommit: null, trackedRef: null, pinned: true,
      updateAvailable: true, catalog: { componentId: "cmp", revisionId: "rev1", follow: "pinned", version: 1,
        releaseStatus: "released", identity: "IPN", latestReleasedRevisionId: "rev2", systemId: "sys_c", snapshotName: "CDR" } });
    const child: Review = { ...review, id: "rv2", kind: "child_update", instanceId: cndh.id, fromCommit: "rev1", toCommit: "rev2",
      pendingChanges: { silent: [] }, items: [item({})] };
    const calls: [string, RequestInit][] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push([url, init]);
      const body = url.includes("/reviews") ? [child]
        : url.includes("/history") ? { nextCursor: null, events: [] }
          : { outcome: "auto_advanced", reviewId: null, instance: {} };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", ETag: '"sys:sys_1:3"' } });
    }));
    const document = systemDocument([cndh]);
    renderInSession(<ChangesTab systemId="sys_1" document={document} canEdit user={null} onNavigate={vi.fn()} />, { document });
    expect(await screen.findByText(/revision v1/)).toBeTruthy();
    expect(screen.queryByText(/rev1/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Take latest released" }));
    await waitFor(() => expect(calls.some(([url]) => url.endsWith("/rebase"))).toBe(true));
    const [, init] = calls.find(([url]) => url.endsWith("/rebase"))!;
    expect(JSON.parse(String(init.body))).toEqual({ revisionId: "rev2" });
  });
});

describe("manifest import reviews (P2 §21.3)", () => {
  const summary = {
    instances: { added: [], removed: [], changed: [] }, links: { added: [], removed: ["L9"], changed: ["Renamed link"] },
    harnesses: { added: [], removed: [], changed: [] }, exports: { added: [], removed: [], changed: [] },
    system: ["name"], placement: false, layout: true,
  };
  const manifestReview = (pendingChanges: Review["pendingChanges"]): Review => ({
    id: "rv9", kind: "manifest_import", status: "open", instanceId: null, createdAt: "", decidedBy: null, decidedAt: null,
    redacted: false, fromCommit: "a".repeat(40), toCommit: "d".repeat(40), pendingChanges, items: [],
  });

  it("lists what the outside manifest changes and accepts it with If-Match", async () => {
    const calls = stub([manifestReview({ blob: "f".repeat(40), summary, problems: [] })]);
    renderTab();
    expect(await screen.findByText("Repository manifest")).toBeTruthy();
    expect(screen.getByText("System name changed")).toBeTruthy();
    expect(screen.getByText("Links removed: L9")).toBeTruthy();
    expect(screen.getByText("Links changed: Renamed link")).toBeTruthy();
    expect(screen.getByText("Canvas layout changed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(calls.some(([u]) => u.endsWith("/reviews/rv9/manifest-import"))).toBe(true));
    const [, init] = calls.find(([u]) => u.endsWith("/reviews/rv9/manifest-import"))!;
    expect(JSON.parse(String(init.body))).toEqual({ decision: "accept" });
    expect(new Headers(init.headers).get("If-Match")).toBe('"sys:sys_1:1"');
  });

  it("only offers Reject for a manifest that cannot be imported", async () => {
    stub([manifestReview({ blob: "f".repeat(40), summary: null, problems: ["schema: Field required"] })]);
    renderTab();
    expect(await screen.findByText("schema: Field required")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Accept" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
