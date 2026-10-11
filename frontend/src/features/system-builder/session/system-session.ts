import { toast } from "sonner";

import { ApiHttpError } from "@/lib/api";
import * as api from "@/lib/systems-api";
import type { SystemDocument } from "@/types/system";

/**
 * AC-15: one session per open system. It owns the document and the ETag every
 * edit sends, runs edits one at a time (each waits for the previous edit's
 * re-read, so no two edits send the same ETag), recovers from a 412 by
 * re-reading, and keeps the reads that depend on the system: each read names
 * what makes it stale, and the session re-reads it when that changes.
 *
 * Call sites say only what to change: `session.edit("link", (edit) => edit.updateLink(id, fields), "Saved")`.
 * The HTTP client is the default transport; tests give the session an in-memory one.
 */

/** How often to re-read while a board interface is still being extracted. */
export const PENDING_POLL_MS = 4000;

// ---------------------------------------------------------------------------
// The transport (adapter)

/** Edits guarded by the system ETag: `(systemId, etag, ...args)` in the HTTP client. */
const versionedEdits = {
  addInstance: api.addInstance,
  addCatalogInstance: api.addCatalogInstance,
  updateInstance: api.updateInstance,
  removeInstance: api.removeInstance,
  setPortOverride: api.setPortOverride,
  createLink: api.createLink,
  updateLink: api.updateLink,
  deleteLink: api.deleteLink,
  createExport: api.createExport,
  createExports: api.createExports,
  updateExport: api.updateExport,
  deleteExport: api.deleteExport,
  proposeRename: api.proposeRename,
  withdrawRename: api.withdrawRename,
  createSubport: api.createSubport,
  updateSubport: api.updateSubport,
  deleteSubport: api.deleteSubport,
  replaceRows: api.replaceRows,
  waiveFinding: api.waiveFinding,
  waiveFindings: api.waiveFindings,
  unwaiveFinding: api.unwaiveFinding,
  rebaseSubsystem: api.rebaseSubsystem,
  rebaseInstance: api.rebaseInstance,
  decideReviewItem: api.decideReviewItem,
  keepPinned: api.keepPinned,
  decideManifestImport: api.decideManifestImport,
  createSnapshot: api.createSnapshot,
  putGitLink: api.putGitLink,
  deleteGitLink: api.deleteGitLink,
  commitImport: api.commitImport,
  setDrivingMate: api.setDrivingMate,
  clearDrivingMate: api.clearDrivingMate,
  setMating: api.setMating,
  clearMating: api.clearMating,
  setPose: api.setPose,
  clearPose: api.clearPose,
  setPoses: api.setPoses,
  resetPoses: api.resetPoses,
  createHarness: api.createHarness,
  updateHarness: api.updateHarness,
  deleteHarness: api.deleteHarness,
  addHarnessEnd: api.addHarnessEnd,
  updateHarnessEnd: api.updateHarnessEnd,
  deleteHarnessEnd: api.deleteHarnessEnd,
  setHarnessCoverings: api.setHarnessCoverings,
  setHarnessNodes: api.setHarnessNodes,
  replaceWires: api.replaceWires,
  linkToHarness: api.linkToHarness,
  harnessFromLabel: api.harnessFromLabel,
  harnessToLink: api.harnessToLink,
};

/** Writes that send no ETag but still belong to an edit (busy, re-read): `(systemId, ...args)`. */
const systemWrites = {
  checkNow: api.checkNow,
  generateWires: api.generateWires,
  publishSnapshot: api.publishSnapshot,
  retrySnapshotGit: api.retrySnapshotGit,
  fetchGitLink: api.fetchGitLink,
};

/** What the session reads about the system: `(systemId, ...args)`. */
const systemReads = {
  getHierarchy: api.getHierarchy,
  getScene: api.getScene,
  getPlacement: api.getPlacement,
  getLinkMate: api.getLinkMate,
  getMating: api.getMating,
  listReviews: api.listReviews,
  getHistory: api.getHistory,
  getLayout: api.getLayout,
  getGitLink: api.getGitLink,
  listSnapshots: api.listSnapshots,
  diffSnapshot: api.diffSnapshot,
  getEndSuggestions: api.getEndSuggestions,
  getInstanceInterface: api.getInstanceInterface,
  getIcdHtml: api.getIcdHtml,
  listSystemNetMembers: api.listSystemNetMembers,
  traceSystemNet: api.traceSystemNet,
};

export interface SystemTransport {
  getSystem: (systemId: string, init?: RequestInit) => Promise<api.Versioned<SystemDocument>>;
  edits: typeof versionedEdits;
  writes: typeof systemWrites;
  reads: typeof systemReads;
}

export const httpTransport: SystemTransport = { getSystem: api.getSystem, edits: versionedEdits, writes: systemWrites, reads: systemReads };

type WithoutVersion<F> = F extends (systemId: string, etag: string, ...args: infer A) => infer R ? (...args: A) => R : never;
type WithoutSystem<F> = F extends (systemId: string, ...args: infer A) => infer R ? (...args: A) => R : never;

/** What an edit may call: the session supplies the system and the current ETag. */
export type SystemEdits =
  { [K in keyof SystemTransport["edits"]]: WithoutVersion<SystemTransport["edits"][K]> }
  & { [K in keyof SystemTransport["writes"]]: WithoutSystem<SystemTransport["writes"][K]> };
export type SystemReads = { [K in keyof SystemTransport["reads"]]: WithoutSystem<SystemTransport["reads"][K]> };
export type EditName = keyof SystemEdits;

// ---------------------------------------------------------------------------
// Reads and what makes them stale

/**
 * What a read follows: `version` is every change to the system; `scene` and `nets` are the
 * document's `sceneKey`/`netsKey` (SB2-98), which move only when the 3D scene or the
 * connectivity does; `repository` is the git link and the snapshots, which no ETag covers.
 */
export type Topic = "version" | "scene" | "nets" | "repository";

/** Edits that change something a topic other than `version` covers (the ETag covers the rest). */
const MAKES_STALE: Partial<Record<EditName, Topic>> = {
  createSnapshot: "repository",
  publishSnapshot: "repository",
  putGitLink: "repository",
  deleteGitLink: "repository",
  fetchGitLink: "repository",
  retrySnapshotGit: "repository",
};

export interface SessionRead<T> {
  /** What is read; components asking for the same key share one read. */
  key: string;
  follows: readonly Topic[];
  /** Keep showing the last value while a newer one loads (else nothing shows until it lands). */
  keep: boolean;
  load: (reads: SystemReads, signal: AbortSignal) => Promise<T>;
}

export interface ReadState<T> {
  data: T | undefined;
  /** The read's failure, for what the session follows now. */
  error: unknown;
  /** The data is for what the session follows now (false while a kept value is re-read). */
  current: boolean;
}

interface ReadEntry {
  spec: SessionRead<unknown>;
  value: unknown;
  valueToken: string | null;
  error: unknown;
  errorToken: string | null;
  inflight: boolean;
  forced: boolean;
  listeners: Set<() => void>;
  snapshot: ReadState<unknown>;
}

const EMPTY: ReadState<never> = { data: undefined, error: null, current: false };

// ---------------------------------------------------------------------------
// The session

export interface SessionState {
  document: SystemDocument | null;
  /** The ETag of the document shown. */
  etag: string | null;
  /** The label of the edit in progress (or queued), or null. */
  busy: string | null;
  /** Why the last read of the document failed; the document read before stays. */
  error: string | null;
  notFound: boolean;
}

function hasPendingInterface(document: SystemDocument | null): boolean {
  return Boolean(document?.instances.some((instance) => instance.interface?.status === "pending"));
}

function etagOf(result: unknown): string | null {
  if (result && typeof result === "object" && "etag" in result && typeof result.etag === "string") return result.etag;
  return null;
}

export class SystemSession {
  readonly systemId: string;
  private readonly transport: SystemTransport;
  private state: SessionState;
  private readonly listeners = new Set<() => void>();
  /** The ETag the next edit sends; ahead of `state.etag` between an edit and its re-read. */
  private sendEtag: string | null;
  private loadAbort: AbortController | null = null;
  private loading: Promise<void> = Promise.resolve();
  private poll: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private queued = 0;
  private repository = 0;
  private closed = new AbortController();
  private readonly entries = new Map<string, ReadEntry>();
  private readonly reads: SystemReads;

  constructor(systemId: string, transport: SystemTransport = httpTransport, seed?: { document: SystemDocument; etag: string }) {
    this.systemId = systemId;
    this.transport = transport;
    this.state = { document: seed?.document ?? null, etag: seed?.etag ?? null, busy: null, error: null, notFound: false };
    this.sendEtag = seed?.etag ?? null;
    this.reads = Object.fromEntries(Object.entries(transport.reads).map(([name, read]) => [
      name, (...args: unknown[]) => (read as (...all: unknown[]) => unknown)(systemId, ...args),
    ])) as SystemReads;
  }

  getState = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Start reading the document (the page opening the system). */
  open(): void {
    if (this.closed.signal.aborted) this.closed = new AbortController();
    if (!this.state.document) this.startLoad();
    else this.schedulePoll();
  }

  /** Stop reading: the page left the system. */
  close(): void {
    this.loadAbort?.abort();
    this.closed.abort();
    if (this.poll) clearTimeout(this.poll);
    this.poll = null;
  }

  /** Re-read the document; resolves once the newest read has landed. */
  async reload(): Promise<void> {
    this.startLoad();
    let waiting: Promise<void>;
    do {
      waiting = this.loading;
      await waiting;
    } while (waiting !== this.loading);
  }

  /**
   * Run one change. Edits run one at a time, each with the ETag the previous one left, and the
   * session stays busy until the re-read after it lands (SB2-98). A 412 means someone else changed
   * the system: the change is not retried; the document is re-read so the user can redo it.
   * Failures are reported here; the result is undefined then.
   */
  edit<T>(label: string, change: (edit: SystemEdits) => Promise<T>, success?: string): Promise<T | undefined> {
    this.queued += 1;
    if (this.state.busy === null) this.set({ busy: label });
    const run = async (): Promise<T | undefined> => {
      this.set({ busy: label });
      const touched = new Set<Topic>();
      try {
        const result = await change(this.bindEdits(touched));
        if (success) toast.success(success);
        return result;
      } catch (error) {
        if (error instanceof api.StaleSystemError) {
          toast.warning("This system changed elsewhere. It has been reloaded; please try again.");
        } else {
          toast.error(error instanceof Error ? error.message : "The change failed");
        }
        return undefined;
      } finally {
        if (touched.has("repository")) this.repository += 1;
        await this.reload();
        this.queued -= 1;
        this.set({ busy: this.queued === 0 ? null : this.state.busy });
      }
    };
    const next = this.queue.then(run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  // --- reads ---------------------------------------------------------------

  subscribeRead(spec: SessionRead<unknown>, listener: () => void): () => void {
    let entry = this.entries.get(spec.key);
    if (!entry) {
      entry = { spec, value: undefined, valueToken: null, error: null, errorToken: null, inflight: false, forced: false, listeners: new Set(), snapshot: EMPTY };
      this.entries.set(spec.key, entry);
    }
    entry.spec = spec;
    entry.listeners.add(listener);
    this.fetch(entry);
    const subscribed = entry;
    return () => {
      subscribed.listeners.delete(listener);
      if (subscribed.listeners.size === 0 && !subscribed.inflight && this.entries.get(spec.key) === subscribed) {
        this.entries.delete(spec.key);
      }
    };
  }

  readSnapshot(key: string): ReadState<unknown> {
    return this.entries.get(key)?.snapshot ?? EMPTY;
  }

  /** Read again now (a poll), keeping what is shown until the new value lands. */
  refresh(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.forced = true;
    this.fetch(entry);
  }

  /** Put a value just written (the diagram's saved layout) where the read keeps it. */
  store(key: string, value: unknown): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.value = value;
    entry.valueToken = this.token(entry.spec);
    entry.error = null;
    entry.errorToken = null;
    this.publishRead(entry);
  }

  // --- internals -------------------------------------------------------------

  private set(patch: Partial<SessionState>): void {
    const next = { ...this.state, ...patch };
    if (Object.entries(patch).every(([name, value]) => this.state[name as keyof SessionState] === value)) return;
    this.state = next;
    for (const entry of this.entries.values()) {
      this.publishRead(entry);
      this.fetch(entry);
    }
    for (const listener of this.listeners) listener();
  }

  private bindEdits(touched: Set<Topic>): SystemEdits {
    const bound: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
    const note = (name: string) => {
      const topic = MAKES_STALE[name as EditName];
      if (topic) touched.add(topic);
    };
    for (const [name, edit] of Object.entries(this.transport.edits)) {
      bound[name] = async (...args) => {
        note(name);
        const result = await (edit as (...all: unknown[]) => Promise<unknown>)(this.systemId, this.sendEtag ?? "", ...args);
        // Several edits in one change (adding boards one by one) each send the ETag the last one returned.
        this.sendEtag = etagOf(result) ?? this.sendEtag;
        return result;
      };
    }
    for (const [name, write] of Object.entries(this.transport.writes)) {
      bound[name] = async (...args) => {
        note(name);
        return (write as (...all: unknown[]) => Promise<unknown>)(this.systemId, ...args);
      };
    }
    return bound as unknown as SystemEdits;
  }

  private startLoad(): void {
    this.loadAbort?.abort();
    if (this.poll) clearTimeout(this.poll);
    this.poll = null;
    const abort = new AbortController();
    this.loadAbort = abort;
    this.loading = this.transport.getSystem(this.systemId, { signal: abort.signal }).then(
      (result) => {
        if (abort.signal.aborted) return;
        const etag = result.etag ?? result.body.system.etag;
        this.sendEtag = etag;
        this.set({ document: result.body, etag, error: null, notFound: false });
        this.schedulePoll();
      },
      (error: unknown) => {
        if (abort.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        const message = error instanceof Error ? error.message : "Could not load the system";
        // SB2-98: with a document on screen a failed re-read was silent, and the next edit then
        // sent an old ETag; say so, and keep the document until a re-read succeeds.
        if (this.state.document) toast.error(`Could not refresh the system: ${message}`, { id: "system-reload" });
        this.set({ error: message, notFound: error instanceof ApiHttpError && error.status === 404 });
      },
    );
  }

  /** Extraction runs as a background job; re-read until every interface settles. */
  private schedulePoll(): void {
    if (this.poll || this.closed.signal.aborted || !hasPendingInterface(this.state.document)) return;
    this.poll = setTimeout(() => {
      this.poll = null;
      this.startLoad();
    }, PENDING_POLL_MS);
  }

  private topic(topic: Topic): string {
    const { document, etag } = this.state;
    switch (topic) {
      case "version":
        return etag ?? "";
      case "scene":
        return document?.sceneKey ?? etag ?? "";
      case "nets":
        return document?.netsKey ?? etag ?? "";
      case "repository":
        return String(this.repository);
    }
  }

  private token(spec: SessionRead<unknown>): string {
    return spec.follows.map((topic) => this.topic(topic)).join("\n");
  }

  private fetch(entry: ReadEntry): void {
    if (entry.inflight || this.state.etag === null) return;
    const token = this.token(entry.spec);
    const settled = entry.valueToken === token || entry.errorToken === token;
    if (settled && !entry.forced) return;
    entry.forced = false;
    entry.inflight = true;
    const { key } = entry.spec;
    entry.spec.load(this.reads, this.closed.signal).then(
      (value) => {
        entry.value = value;
        entry.valueToken = token;
        entry.error = null;
        entry.errorToken = null;
      },
      (error: unknown) => {
        entry.error = error;
        entry.errorToken = token;
      },
    ).finally(() => {
      entry.inflight = false;
      if (entry.listeners.size === 0) {
        if (this.entries.get(key) === entry) this.entries.delete(key);
        return;
      }
      this.publishRead(entry);
      // The system may have moved on while this was read.
      this.fetch(entry);
    });
  }

  private publishRead(entry: ReadEntry): void {
    const token = this.token(entry.spec);
    const current = entry.valueToken === token;
    const data = entry.valueToken !== null && (current || entry.spec.keep) ? entry.value : undefined;
    const error = entry.errorToken === token ? entry.error : null;
    const previous = entry.snapshot;
    if (previous.data === data && previous.error === error && previous.current === current) return;
    entry.snapshot = { data, error, current };
    for (const listener of entry.listeners) listener();
  }
}
