/**
 * One open system: its record at the latest version this tab knows, the
 * system bundle the view draws from, and the user's undo and redo stacks
 * (CONTRACTS §3.3).
 *
 * It is an external store (`useSyncExternalStore`), not React state, because
 * writes are a chain: each request carries the version the previous one
 * returned, so they run one at a time in order, whichever component sends
 * them. A gesture is one request and one undo step (§14.3).
 */
import { ApiHttpError } from "@/lib/api";

import { applyOps, readHistory, readSystem, readSystemBundle, undoVersion } from "../model/api";
import type { SystemBundle, SystemBundleAnswer, SystemHistoryEntry, SystemOp, SystemRecord } from "../model/types";

export interface SessionState {
  record?: SystemRecord;
  /** The latest bundle answer, whatever its state. */
  bundleAnswer?: SystemBundleAnswer;
  /** The last ready bundle: drawn while a newer one builds. */
  bundle?: SystemBundle;
  /** The bundle drawn is for an older document version. */
  bundleStale: boolean;
  loadError?: string;
  /** A request is in flight. */
  saving: boolean;
  /** The user's versions not yet undone, newest last. */
  undoStack: number[];
  /** Undo versions that can be undone again (redo), newest last. */
  redoStack: number[];
}

export interface SessionApi {
  readSystem: typeof readSystem;
  readSystemBundle: typeof readSystemBundle;
  readHistory: typeof readHistory;
  applyOps: typeof applyOps;
  undoVersion: typeof undoVersion;
}

const LIVE_API: SessionApi = { readSystem, readSystemBundle, readHistory, applyOps, undoVersion };

/** A refused write, worded for the user; the session has already re-read the system where that helps. */
export class SessionWriteError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "SessionWriteError";
  }
}

/**
 * The user's undo stack from the history (§3.3): their own edits that no undo
 * names, oldest first. Redo is not rebuilt across reloads.
 */
export function undoStackFromHistory(history: readonly SystemHistoryEntry[], actor: string): number[] {
  const undone = new Set(history.filter((entry) => entry.kind === "undo" && entry.undoes !== null).map((entry) => entry.undoes as number));
  return history
    .filter((entry) => entry.actor === actor && entry.kind === "edit" && !undone.has(entry.version))
    .map((entry) => entry.version)
    .sort((a, b) => a - b);
}

export class SystemSession {
  private state: SessionState = { bundleStale: false, saving: false, undoStack: [], redoStack: [] };
  private listeners = new Set<() => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private bundleTimer: ReturnType<typeof setTimeout> | undefined;
  private bundleController: AbortController | undefined;
  private disposed = false;

  constructor(
    readonly systemId: string,
    private readonly actor: string,
    private readonly api: SessionApi = LIVE_API,
    private readonly bundlePollMs = 1500,
    /** Slower: boards still building their design bundles take minutes. */
    private readonly pendingPollMs = 5000,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  snapshot = (): SessionState => this.state;

  private set(patch: Partial<SessionState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  async load(signal?: AbortSignal): Promise<void> {
    try {
      const [record, history] = await Promise.all([
        this.api.readSystem(this.systemId, signal),
        this.api.readHistory(this.systemId, { limit: 200 }, signal).catch(() => [] as SystemHistoryEntry[]),
      ]);
      this.set({ record, loadError: undefined, undoStack: undoStackFromHistory(history, this.actor), redoStack: [] });
      this.watchBundle();
    } catch (error) {
      if (signal?.aborted) return;
      this.set({ loadError: error instanceof Error ? error.message : String(error) });
    }
  }

  dispose() {
    this.disposed = true;
    this.bundleController?.abort();
    if (this.bundleTimer) clearTimeout(this.bundleTimer);
    this.listeners.clear();
  }

  /** Apply one request (one undo step). Resolves with the new record. */
  apply(ops: SystemOp[]): Promise<SystemRecord> {
    return this.enqueue(async () => {
      const record = this.requireRecord();
      const next = await this.api.applyOps(this.systemId, record.version, ops);
      this.set({ record: next, undoStack: [...this.state.undoStack, next.version], redoStack: [] });
      return next;
    });
  }

  undo(): Promise<SystemRecord | undefined> {
    return this.enqueue(async () => {
      const target = this.state.undoStack[this.state.undoStack.length - 1];
      if (target === undefined) return undefined;
      const record = this.requireRecord();
      const next = await this.api.undoVersion(this.systemId, record.version, target);
      this.set({
        record: next,
        undoStack: this.state.undoStack.slice(0, -1),
        redoStack: [...this.state.redoStack, next.version],
      });
      return next;
    });
  }

  /** Redo is the undo of an undo (§3.3: an undo is itself undoable). */
  redo(): Promise<SystemRecord | undefined> {
    return this.enqueue(async () => {
      const target = this.state.redoStack[this.state.redoStack.length - 1];
      if (target === undefined) return undefined;
      const record = this.requireRecord();
      const next = await this.api.undoVersion(this.systemId, record.version, target);
      this.set({
        record: next,
        redoStack: this.state.redoStack.slice(0, -1),
        undoStack: [...this.state.undoStack, next.version],
      });
      return next;
    });
  }

  private requireRecord(): SystemRecord {
    const record = this.state.record;
    if (!record) throw new SessionWriteError("The system is not loaded yet");
    return record;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = async () => {
      this.set({ saving: true });
      try {
        const result = await work();
        this.watchBundle();
        return result;
      } catch (error) {
        throw await this.explain(error);
      } finally {
        this.set({ saving: false });
      }
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }

  /** Turn a refusal into words, re-reading the system when the tab is behind. */
  private async explain(error: unknown): Promise<SessionWriteError> {
    if (error instanceof SessionWriteError) return error;
    if (error instanceof ApiHttpError && error.isStale) {
      try {
        const record = await this.api.readSystem(this.systemId);
        this.set({ record, redoStack: [] });
        this.watchBundle();
      } catch {
        // The original refusal is still the useful message.
      }
      return new SessionWriteError("Someone else changed this system. It has been reloaded; try again.", error);
    }
    if (error instanceof ApiHttpError && error.code === "system_undo_conflict") {
      return new SessionWriteError("A later change touches the same objects. Undo that one first.", error);
    }
    if (error instanceof ApiHttpError && error.code === "system_undo_nothing") {
      this.set({ undoStack: this.state.undoStack.slice(0, -1) });
      return new SessionWriteError("That change did nothing, so there is nothing to undo.", error);
    }
    return new SessionWriteError(error instanceof Error ? error.message : String(error), error);
  }

  /** Read the bundle for the current version, polling while it builds. */
  private watchBundle() {
    if (this.disposed) return;
    this.bundleController?.abort();
    if (this.bundleTimer) clearTimeout(this.bundleTimer);
    const controller = new AbortController();
    this.bundleController = controller;
    const version = this.state.record?.version;
    const tick = async () => {
      try {
        const answer = await this.api.readSystemBundle(this.systemId, controller.signal);
        if (controller.signal.aborted) return;
        const current = answer.documentVersion === this.state.record?.version;
        this.set({
          bundleAnswer: answer,
          ...(answer.state === "ready" && answer.bundle ? { bundle: answer.bundle, bundleStale: !current } : { bundleStale: true }),
        });
        if (answer.state === "building" || (answer.state === "ready" && !current)) {
          this.bundleTimer = setTimeout(() => void tick(), this.bundlePollMs);
        } else if (answer.pending.length > 0) {
          this.bundleTimer = setTimeout(() => void tick(), this.pendingPollMs);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        this.set({ bundleAnswer: { state: "failed", key: "", pending: [], documentVersion: version ?? 0, error: error instanceof Error ? error.message : String(error) } });
      }
    };
    void tick();
  }
}
