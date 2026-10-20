import { afterEach, describe, expect, it, vi } from "vitest";

import {
  commitGit,
  createSnapshot,
  importGit,
  linkGit,
  listSnapshots,
  publishSystem,
  readGit,
  readPublication,
  unlinkGit,
} from "./api";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubFetch(response: Response | (() => Response)) {
  const mock = vi.fn(async () => (typeof response === "function" ? response() : response));
  vi.stubGlobal("fetch", mock);
  return mock;
}

const SYSTEM = "sys/1";
const ROOT = "/api/systems/sys%2F1";

function call(mock: ReturnType<typeof stubFetch>): [string, RequestInit] {
  return mock.mock.calls[0] as unknown as [string, RequestInit];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("snapshot wrappers", () => {
  it("takes a snapshot with a POST body and no If-Match", async () => {
    const answer = { snapshotId: "snap_1", systemId: SYSTEM, version: 3, name: "v3", note: null, createdBy: "a@b", createdAt: "2026-01-01" };
    const mock = stubFetch(jsonResponse(201, answer));
    await expect(createSnapshot(SYSTEM, { name: "v3" })).resolves.toEqual(answer);
    const [url, init] = call(mock);
    expect(url).toBe(`${ROOT}/snapshots`);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).has("If-Match")).toBe(false);
    expect(JSON.parse(init.body as string)).toEqual({ name: "v3" });
  });

  it("lists snapshots with a GET", async () => {
    const mock = stubFetch(jsonResponse(200, []));
    await expect(listSnapshots(SYSTEM)).resolves.toEqual([]);
    const [url, init] = call(mock);
    expect(url).toBe(`${ROOT}/snapshots`);
    expect(init.method).toBeUndefined();
  });
});

describe("Git link wrappers", () => {
  const answer = { systemId: SYSTEM, link: null, lastJob: null };

  it("reads the link", async () => {
    const mock = stubFetch(jsonResponse(200, answer));
    await expect(readGit(SYSTEM)).resolves.toEqual(answer);
    expect(call(mock)[0]).toBe(`${ROOT}/git`);
  });

  it("links with a PUT body", async () => {
    const mock = stubFetch(jsonResponse(200, answer));
    await expect(linkGit(SYSTEM, { projectId: "prj_1", branch: "main", path: "systems/s.system.json" })).resolves.toEqual(answer);
    const [url, init] = call(mock);
    expect(url).toBe(`${ROOT}/git`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ projectId: "prj_1", branch: "main", path: "systems/s.system.json" });
  });

  it("unlinks with a DELETE and no body", async () => {
    const mock = stubFetch(new Response(null, { status: 204 }));
    await expect(unlinkGit(SYSTEM)).resolves.toBeUndefined();
    const [url, init] = call(mock);
    expect(url).toBe(`${ROOT}/git`);
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  it("commits under If-Match", async () => {
    const mock = stubFetch(jsonResponse(202, answer));
    await expect(commitGit(SYSTEM, 4, "Update Rover")).resolves.toEqual(answer);
    const [url, init] = call(mock);
    expect(url).toBe(`${ROOT}/git/commit`);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("If-Match")).toBe(`"system:${SYSTEM}:4"`);
    expect(JSON.parse(init.body as string)).toEqual({ message: "Update Rover" });
  });

  it("imports under If-Match with no body", async () => {
    const mock = stubFetch(jsonResponse(200, { systemId: SYSTEM, version: 5 }));
    await importGit(SYSTEM, 4);
    const [url, init] = call(mock);
    expect(url).toBe(`${ROOT}/git/import`);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("If-Match")).toBe(`"system:${SYSTEM}:4"`);
    expect(init.body).toBeUndefined();
  });
});

describe("publication wrappers", () => {
  it("reads the publication", async () => {
    const answer = { componentId: null, identity: null, publications: [] };
    const mock = stubFetch(jsonResponse(200, answer));
    await expect(readPublication(SYSTEM)).resolves.toEqual(answer);
    expect(call(mock)[0]).toBe(`${ROOT}/publication`);
  });

  it("publishes under If-Match", async () => {
    const answer = { componentId: "cmp_1", revisionId: "rev_1", stage: "qa_review" };
    const mock = stubFetch(jsonResponse(200, answer));
    await expect(
      publishSystem(SYSTEM, 6, { identity: "in-house", ipn: "IPN-1", changeSummary: "First release" }),
    ).resolves.toEqual(answer);
    const [url, init] = call(mock);
    expect(url).toBe(`${ROOT}/publish`);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("If-Match")).toBe(`"system:${SYSTEM}:6"`);
    expect(JSON.parse(init.body as string)).toEqual({ identity: "in-house", ipn: "IPN-1", changeSummary: "First release" });
  });
});
