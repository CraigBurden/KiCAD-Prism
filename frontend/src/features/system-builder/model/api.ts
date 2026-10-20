/**
 * The systems HTTP API (CONTRACTS §5) over `lib/api.ts`. Writes carry the
 * version they were built on as `If-Match`; a stale one throws an
 * `ApiHttpError` with `isStale`.
 */
import { fetchChecked, fetchJson, ifMatch } from "@/lib/api";

import type {
  SystemBundleAnswer,
  SystemGit,
  SystemHistoryEntry,
  SystemOp,
  SystemPublication,
  SystemPublishAnswer,
  SystemRecord,
  SystemSnapshot,
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

/** Take a named snapshot (§5); taking one on a linked system also queues its commit. */
export function createSnapshot(systemId: string, body: { name: string; note?: string }): Promise<SystemSnapshot> {
  return fetchJson<SystemSnapshot>(
    `${base(systemId)}/snapshots`,
    { method: "POST", body: JSON.stringify(body) },
    "Could not take the snapshot",
  );
}

export function listSnapshots(systemId: string, signal?: AbortSignal): Promise<SystemSnapshot[]> {
  return fetchJson<SystemSnapshot[]>(`${base(systemId)}/snapshots`, { signal }, "Could not load the snapshots");
}

/** The system's Git link and the newest commit job (§13). */
export function readGit(systemId: string, signal?: AbortSignal): Promise<SystemGit> {
  return fetchJson<SystemGit>(`${base(systemId)}/git`, { signal }, "Could not load the Git link");
}

export function linkGit(systemId: string, body: { projectId: string; branch: string; path?: string }): Promise<SystemGit> {
  return fetchJson<SystemGit>(
    `${base(systemId)}/git`,
    { method: "PUT", body: JSON.stringify(body) },
    "Could not link the system to Git",
  );
}

export async function unlinkGit(systemId: string): Promise<void> {
  await fetchChecked(`${base(systemId)}/git`, { method: "DELETE" }, "Could not unlink the system from Git");
}

/** Queue a commit of the document at `version` (§13.2). */
export function commitGit(systemId: string, version: number, message: string): Promise<SystemGit> {
  return fetchJson<SystemGit>(
    `${base(systemId)}/git/commit`,
    { method: "POST", headers: ifMatch("system", systemId, version), body: JSON.stringify({ message }) },
    "Could not commit the system",
  );
}

/** Replace the document with the file at the branch head (§13.3). */
export function importGit(systemId: string, version: number): Promise<SystemRecord> {
  return fetchJson<SystemRecord>(
    `${base(systemId)}/git/import`,
    { method: "POST", headers: ifMatch("system", systemId, version) },
    "Could not import the file",
  );
}

/** The system's catalog component, identity and publications (§11.4). */
export function readPublication(systemId: string, signal?: AbortSignal): Promise<SystemPublication> {
  return fetchJson<SystemPublication>(`${base(systemId)}/publication`, { signal }, "Could not load the publication");
}

/** Publish a snapshot to the catalog's QA review (§11.2). */
export function publishSystem(
  systemId: string,
  version: number,
  body: {
    identity?: "in-house" | "bought-out";
    ipn?: string;
    manufacturer?: string;
    mpn?: string;
    snapshotId?: string;
    changeSummary: string;
  },
): Promise<SystemPublishAnswer> {
  return fetchJson<SystemPublishAnswer>(
    `${base(systemId)}/publish`,
    { method: "POST", headers: ifMatch("system", systemId, version), body: JSON.stringify(body) },
    "Could not publish the system",
  );
}

export function systemPath(systemId: string): string {
  return `/system/${encodeURIComponent(systemId)}`;
}

export interface ProjectBranch {
  name: string;
  ref: string;
  source: "remote" | "local";
  is_current: boolean;
  commit: string;
  hash: string;
  message: string;
  date: string;
}

/** A project's branches with their head commits (`GET /api/projects/{id}/branches`). */
export function readProjectBranches(projectId: string, signal?: AbortSignal): Promise<{ branches: ProjectBranch[]; default_ref: string | null }> {
  return fetchJson(`/api/projects/${encodeURIComponent(projectId)}/branches`, { signal }, "Could not load the project's branches");
}
