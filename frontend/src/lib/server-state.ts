/**
 * Server state: reads of Prism data that a component shows and keeps fresh.
 *
 * Built on the transport in `lib/api.ts`. A read is named by a key; the module
 * owns everything a component used to hand-roll around it:
 *
 * - **fetch and abort.** The first observer of a key starts the read. When the
 *   last observer leaves, the request in flight is aborted and the entry is
 *   forgotten (a later mount reads again).
 * - **stale responses.** Only the newest request for a key may publish. A
 *   response that lost a race, or arrived after its observers left, is dropped.
 * - **stale-while-refresh.** A refresh keeps the last data on screen. A failed
 *   refresh keeps the data too and reports the error beside it.
 * - **poll while visible.** An observer can ask for a poll. Polls never
 *   overlap; with `whileVisible` they skip while the tab is hidden and read
 *   once when it becomes visible again.
 * - **invalidate by key.** `invalidateServerState(prefix)` re-reads every
 *   observed key that starts with `prefix` (a write says what it changed).
 *
 * For a periodic side effect that is not a keyed read (a tick that updates
 * several things), `usePoll` gives the same non-overlapping poll.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export type ServerKey = readonly (string | number | boolean | null)[];

export interface ServerSnapshot<T> {
  /** The last successful response for this key, kept through refreshes. */
  data: T | undefined;
  /** The latest read failed; `data` (if any) is from an earlier read. */
  error: Error | null;
  /** A request for this key is in flight. */
  fetching: boolean;
}

export interface ServerReadOptions<T> {
  /** Re-read every `pollMs` while observed. Polls never overlap. */
  pollMs?: number;
  /** Skip polls while the document is hidden; read when it becomes visible. */
  whileVisible?: boolean;
  /** Called with every successful response, after it is published. */
  onData?: (data: T) => void;
}

export interface ServerRead<T> extends ServerSnapshot<T> {
  /** No data for this key yet and no error: the first read is pending. */
  loading: boolean;
  /** Read again now (aborting a request in flight). Resolves once published. */
  refresh: () => Promise<void>;
}

const IDLE: ServerSnapshot<never> = { data: undefined, error: null, fetching: false };

const isAbort = (error: unknown): boolean =>
  (error instanceof DOMException || error instanceof Error) && error.name === "AbortError";

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

function documentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

interface PollOptions {
  intervalMs: number;
  whileVisible?: boolean;
}

/**
 * Run `tick` every `intervalMs` until the returned stop function is called.
 * A tick never starts while the previous one is in flight. With
 * `whileVisible`, hidden ticks are skipped and one runs when the document
 * becomes visible. `tick` gets a signal that aborts on stop.
 */
function startPoll(tick: (signal: AbortSignal) => Promise<void>, options: PollOptions): () => void {
  const controller = new AbortController();
  let inFlight = false;
  const run = async () => {
    if (inFlight || controller.signal.aborted) return;
    if (options.whileVisible && !documentVisible()) return;
    inFlight = true;
    try {
      await tick(controller.signal);
    } finally {
      inFlight = false;
    }
  };
  const timer = window.setInterval(() => void run(), options.intervalMs);
  const onVisibility = () => {
    if (documentVisible()) void run();
  };
  if (options.whileVisible) document.addEventListener("visibilitychange", onVisibility);
  return () => {
    controller.abort();
    window.clearInterval(timer);
    if (options.whileVisible) document.removeEventListener("visibilitychange", onVisibility);
  };
}

interface Observer {
  load: (signal: AbortSignal) => Promise<unknown>;
  onData?: (data: unknown) => void;
  stopPoll?: () => void;
}

interface Entry {
  key: ServerKey;
  snapshot: ServerSnapshot<unknown>;
  listeners: Set<() => void>;
  observers: Set<Observer>;
  controller: AbortController | null;
  pending: Promise<void> | null;
  /** Bumped by every request; only the newest may publish. */
  sequence: number;
}

function startsWith(key: ServerKey, prefix: ServerKey): boolean {
  return prefix.length <= key.length && prefix.every((part, index) => key[index] === part);
}

/** A store of keyed reads. The app uses one (`serverState`); tests make their own. */
export class ServerStateStore {
  private entries = new Map<string, Entry>();

  snapshot(id: string): ServerSnapshot<unknown> {
    return this.entries.get(id)?.snapshot ?? IDLE;
  }

  /**
   * Observe `key`: `listener` hears every change, `observer.load` reads it.
   * Starts the first read. Returns the function that stops observing.
   */
  observe(key: ServerKey, observer: Observer, listener: () => void, poll?: PollOptions): () => void {
    const id = JSON.stringify(key);
    let entry = this.entries.get(id);
    if (!entry) {
      entry = {
        key,
        snapshot: IDLE,
        listeners: new Set(),
        observers: new Set(),
        controller: null,
        pending: null,
        sequence: 0,
      };
      this.entries.set(id, entry);
    }
    const current = entry;
    current.listeners.add(listener);
    current.observers.add(observer);
    if (poll) observer.stopPoll = startPoll(() => this.read(current, false), poll);
    if (current.snapshot.data === undefined && current.snapshot.error === null && !current.pending) {
      void this.read(current, false);
    }
    return () => {
      current.listeners.delete(listener);
      current.observers.delete(observer);
      observer.stopPoll?.();
      // React unsubscribes and resubscribes in one commit when an option
      // changes; wait a microtask so that does not drop the entry and re-read.
      queueMicrotask(() => {
        if (current.observers.size > 0 || this.entries.get(id) !== current) return;
        current.controller?.abort();
        current.sequence += 1;
        this.entries.delete(id);
      });
    };
  }

  /** Read `id` again, aborting a request in flight. No-op when unobserved. */
  refresh(id: string): Promise<void> {
    const entry = this.entries.get(id);
    return entry && entry.observers.size > 0 ? this.read(entry, true) : Promise.resolve();
  }

  /** Re-read every observed key that starts with `prefix`. */
  invalidate(prefix: ServerKey): Promise<void> {
    const reads: Promise<void>[] = [];
    for (const entry of this.entries.values()) {
      if (entry.observers.size > 0 && startsWith(entry.key, prefix)) reads.push(this.read(entry, true));
    }
    return Promise.all(reads).then(() => undefined);
  }

  private publish(entry: Entry, snapshot: ServerSnapshot<unknown>) {
    entry.snapshot = snapshot;
    for (const listener of [...entry.listeners]) listener();
  }

  private read(entry: Entry, force: boolean): Promise<void> {
    if (entry.pending && !force) return entry.pending;
    const [observer] = entry.observers;
    if (!observer) return Promise.resolve();
    entry.controller?.abort();
    const controller = new AbortController();
    const sequence = ++entry.sequence;
    entry.controller = controller;
    const owns = () => entry.sequence === sequence && !controller.signal.aborted;
    if (!entry.snapshot.fetching) this.publish(entry, { ...entry.snapshot, fetching: true });
    const pending = observer
      .load(controller.signal)
      .then(
        (data) => {
          if (!owns()) return;
          this.publish(entry, { data, error: null, fetching: false });
          for (const each of [...entry.observers]) each.onData?.(data);
        },
        (error: unknown) => {
          if (!owns() || isAbort(error)) return;
          this.publish(entry, { data: entry.snapshot.data, error: asError(error), fetching: false });
        },
      )
      .finally(() => {
        if (entry.sequence === sequence) {
          entry.pending = null;
          entry.controller = null;
        }
      });
    entry.pending = pending;
    return pending;
  }
}

const serverState = new ServerStateStore();

/** Re-read every observed key starting with `prefix`, e.g. after a write. */
export function invalidateServerState(prefix: ServerKey): Promise<void> {
  return serverState.invalidate(prefix);
}

/**
 * Read `key` with `load` and keep it fresh. `null` reads nothing. `load` and
 * `onData` may change on every render; the latest ones are used.
 */
export function useServerState<T>(
  key: ServerKey | null,
  load: (signal: AbortSignal) => Promise<T>,
  options: ServerReadOptions<T> = {},
  store: ServerStateStore = serverState,
): ServerRead<T> {
  const id = key ? JSON.stringify(key) : null;
  const loadRef = useRef(load);
  const onDataRef = useRef(options.onData);
  useEffect(() => {
    loadRef.current = load;
    onDataRef.current = options.onData;
  });
  const { pollMs, whileVisible } = options;

  const subscribe = useCallback(
    (listener: () => void) => {
      if (id === null) return () => undefined;
      const observer: Observer = {
        load: (signal) => loadRef.current(signal),
        onData: (data) => onDataRef.current?.(data as T),
      };
      const poll = pollMs ? { intervalMs: pollMs, whileVisible } : undefined;
      return store.observe(JSON.parse(id) as ServerKey, observer, listener, poll);
    },
    [id, pollMs, whileVisible, store],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (id === null ? IDLE : store.snapshot(id)),
    () => IDLE,
  ) as ServerSnapshot<T>;
  const refresh = useCallback(() => (id === null ? Promise.resolve() : store.refresh(id)), [id, store]);

  return {
    ...snapshot,
    loading: id !== null && snapshot.data === undefined && snapshot.error === null,
    refresh,
  };
}

/**
 * Run `tick` every `intervalMs` while `enabled`, never two at once, aborting
 * the one in flight on unmount. `onError` hears a failure once per outage:
 * repeats of the same message are skipped until a tick succeeds.
 */
export function usePoll(
  enabled: boolean,
  tick: (signal: AbortSignal) => Promise<void>,
  { intervalMs, onError }: { intervalMs: number; onError: (error: unknown) => void },
): void {
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });
  useEffect(() => {
    if (!enabled) return;
    let lastFailure = "";
    return startPoll(
      async (signal) => {
        try {
          await tick(signal);
          lastFailure = "";
        } catch (error) {
          if (signal.aborted || isAbort(error)) return;
          const failure = error instanceof Error ? error.message : String(error);
          if (failure === lastFailure) return;
          lastFailure = failure;
          onErrorRef.current(error);
        }
      },
      { intervalMs },
    );
  }, [enabled, intervalMs, tick]);
}
