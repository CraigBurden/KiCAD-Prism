/**
 * The systems HTTP API (CONTRACTS §5) over `lib/api.ts`. Writes carry the
 * version they were built on as `If-Match`; a stale one throws an
 * `ApiHttpError` with `isStale`.
 */
import { fetchJson, ifMatch } from "@/lib/api";

import type {
  SystemBundleAnswer,
  SystemHistoryEntry,
  SystemOp,
  SystemRecord,
  SystemSummary,
} from "./types";

const base = (systemId: string) => `/api/systems/${encodeURIComponent(systemId)}`;

export function listSystems(signal?: AbortSignal): Promise<SystemSummary[]> {
  return fetchJson<SystemSummary[]>("/api/systems", { signal }, "Could not load systems");
}

export function createSystem(body: { name: string; description?: string; folderId?: string | null }): Promise<SystemRecord> {
  return fetchJson<SystemRecord>("/api/systems", { method: "POST", body: JSON.stringify(body) }, "Could not create the system");
}

export function readSystem(systemId: string, signal?: AbortSignal): Promise<SystemRecord> {
  return fetchJson<SystemRecord>(base(systemId), { signal }, "Could not load the system");
}

export function readSystemBundle(systemId: string, signal?: AbortSignal): Promise<SystemBundleAnswer> {
  return fetchJson<SystemBundleAnswer>(`${base(systemId)}/bundle`, { signal }, "Could not load the system bundle");
}

export function applyOps(systemId: string, version: number, ops: SystemOp[]): Promise<SystemRecord> {
  return fetchJson<SystemRecord>(
    `${base(systemId)}/ops`,
    {
      method: "POST",
      headers: ifMatch("system", systemId, version),
      body: JSON.stringify({ schema: "prism.system.ops.a0", ops }),
    },
    "The change was refused",
  );
}

export function undoVersion(systemId: string, version: number, undo: number): Promise<SystemRecord> {
  return fetchJson<SystemRecord>(
    `${base(systemId)}/undo`,
    { method: "POST", headers: ifMatch("system", systemId, version), body: JSON.stringify({ version: undo }) },
    "Could not undo",
  );
}

export function readHistory(systemId: string, options: { before?: number; limit?: number } = {}, signal?: AbortSignal): Promise<SystemHistoryEntry[]> {
  const query = new URLSearchParams();
  if (options.before) query.set("before", String(options.before));
  query.set("limit", String(options.limit ?? 50));
  return fetchJson<SystemHistoryEntry[]>(`${base(systemId)}/history?${query}`, { signal }, "Could not load the history");
}

export function systemPath(systemId: string): string {
  return `/system/${encodeURIComponent(systemId)}`;
}
