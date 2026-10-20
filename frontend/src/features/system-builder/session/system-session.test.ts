import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "@/lib/api";

import type { SystemBundle, SystemBundleAnswer, SystemDocument, SystemHistoryEntry, SystemRecord } from "../model/types";
import { SessionWriteError, SystemSession, undoStackFromHistory, type SessionApi } from "./system-session";

const DOCUMENT: SystemDocument = {
  schema: "prism.system.v2",
  name: "Stack",
  sheets: [],
  occurrences: [],
  subPorts: [],
  dismissedSuggestions: [],
  bodyConnectors: [],
  mates: [],
  harnesses: [],
  exports: [],
  waivers: [],
  layout: {},
};

const record = (version: number): SystemRecord => ({
  systemId: "sys_a",
  name: "Stack",
  folderId: null,
  version,
  document: { ...DOCUMENT, name: `v${version}` },
  redacted: false,
  createdBy: "me@example.com",
  createdAt: "",
  updatedAt: "",
});

const BUNDLE = { schema: "prism.system_bundle.a0" } as unknown as SystemBundle;

function fakeApi(start = 1) {
  let version = start;
  const sent: { kind: string; version: number; arg?: unknown }[] = [];
  const answers: SystemBundleAnswer[] = [];
  const api: SessionApi = {
    readSystem: vi.fn(async () => record(version)),
    readHistory: vi.fn(async () => [] as SystemHistoryEntry[]),
    readSystemBundle: vi.fn(async (): Promise<SystemBundleAnswer> =>
      answers.shift() ?? { state: "ready", key: "k", pending: [], documentVersion: version, bundle: BUNDLE }),
    applyOps: vi.fn(async (_id: string, ifVersion: number, ops) => {
      sent.push({ kind: "ops", version: ifVersion, arg: ops });
      if (ifVersion !== version) throw new ApiHttpError(412, "stale", "stale_version");
      version += 1;
      return record(version);
    }),
    undoVersion: vi.fn(async (_id: string, ifVersion: number, undo: number) => {
      sent.push({ kind: "undo", version: ifVersion, arg: undo });
      if (ifVersion !== version) throw new ApiHttpError(412, "stale", "stale_version");
      version += 1;
      return record(version);
    }),
  };
  return { api, sent, answers, bump: () => (version += 1) };
}

let opened: SystemSession[] = [];
afterEach(() => {
  opened.forEach((session) => session.dispose());
  opened = [];
});

function open(api: SessionApi) {
  const session = new SystemSession("sys_a", "me@example.com", api, 5, 5);
  opened.push(session);
  return session;
}

describe("undoStackFromHistory", () => {
  it("keeps the actor's edits no undo names, oldest first", () => {
    const entry = (version: number, actor: string, kind: SystemHistoryEntry["kind"], undoes: number | null = null): SystemHistoryEntry => ({
      version, actor, kind, undoes, touched: [], createdAt: "",
    });
    const history = [
      entry(6, "me@example.com", "undo", 4),
      entry(5, "other@example.com", "edit"),
      entry(4, "me@example.com", "edit"),
      entry(3, "system", "system"),
      entry(2, "me@example.com", "edit"),
    ];
    expect(undoStackFromHistory(history, "me@example.com")).toEqual([2]);
  });
});

describe("SystemSession", () => {
  it("chains requests on the version each one returns", async () => {
    const { api, sent } = fakeApi();
    const session = open(api);
    await session.load();
    await Promise.all([
      session.apply([{ kind: "set-system-info", name: "a" }]),
      session.apply([{ kind: "set-system-info", name: "b" }]),
    ]);
    expect(sent.map((item) => item.version)).toEqual([1, 2]);
    expect(session.snapshot().record?.version).toBe(3);
    expect(session.snapshot().undoStack).toEqual([2, 3]);
  });

  it("undoes the latest own version and redoes by undoing the undo", async () => {
    const { api, sent } = fakeApi();
    const session = open(api);
    await session.load();
    await session.apply([{ kind: "set-system-info", name: "a" }]);
    await session.undo();
    expect(sent[1]).toEqual({ kind: "undo", version: 2, arg: 2 });
    expect(session.snapshot().redoStack).toEqual([3]);
    await session.redo();
    expect(sent[2]).toEqual({ kind: "undo", version: 3, arg: 3 });
    expect(session.snapshot().undoStack).toEqual([4]);
    expect(session.snapshot().redoStack).toEqual([]);
  });

  it("re-reads the system and explains a stale write", async () => {
    const { api, bump } = fakeApi();
    const session = open(api);
    await session.load();
    bump(); // someone else wrote version 2
    await expect(session.apply([{ kind: "set-system-info", name: "a" }])).rejects.toBeInstanceOf(SessionWriteError);
    expect(session.snapshot().record?.version).toBe(2);
    await session.apply([{ kind: "set-system-info", name: "b" }]);
    expect(session.snapshot().record?.version).toBe(3);
  });

  it("keeps drawing the last ready bundle while a newer one builds", async () => {
    const { api, answers } = fakeApi();
    const session = open(api);
    await session.load();
    await vi.waitFor(() => expect(session.snapshot().bundle).toBe(BUNDLE));
    answers.push({ state: "building", key: "k2", pending: [], documentVersion: 2 });
    await session.apply([{ kind: "set-system-info", name: "a" }]);
    await vi.waitFor(() => expect(session.snapshot().bundleAnswer?.state).toBe("building"));
    expect(session.snapshot().bundle).toBe(BUNDLE);
    expect(session.snapshot().bundleStale).toBe(true);
    await vi.waitFor(() => expect(session.snapshot().bundleStale).toBe(false));
  });
});
