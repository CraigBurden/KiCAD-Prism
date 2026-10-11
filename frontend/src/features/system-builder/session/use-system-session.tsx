import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { httpTransport, SystemSession, type ReadState, type SessionRead, type SessionState, type SystemTransport } from "./system-session";

const SessionContext = createContext<SystemSession | null>(null);

export function SystemSessionProvider({ session, children }: { session: SystemSession; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/** The page's session for `systemId`: read on open, polled while interfaces extract, stopped on leave. */
export function useOpenSystemSession(systemId: string, transport: SystemTransport = httpTransport): SystemSession {
  const session = useMemo(() => new SystemSession(systemId, transport), [systemId, transport]);
  useEffect(() => {
    session.open();
    return () => session.close();
  }, [session]);
  return session;
}

export function useSessionState(session: SystemSession): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState);
}

/**
 * The open system's session: its state (document, ETag, busy) and `edit`, which runs a change
 * with the current ETag, one at a time, and re-reads afterwards.
 */
export function useSystemSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSystemSession needs a SystemSessionProvider");
  const state = useSessionState(session);
  const edit = useCallback<SystemSession["edit"]>((label, change, success) => session.edit(label, change, success), [session]);
  return { session, busy: state.busy, etag: state.etag, document: state.document, edit };
}

export type Edit = ReturnType<typeof useSystemSession>["edit"];

const NO_READ: ReadState<never> = { data: undefined, error: null, current: false };

/** A read of the open system (`sessionReads`), shared by key and re-read when what it follows changes; null reads nothing. */
export function useSessionRead<T>(spec: SessionRead<T> | null): ReadState<T> {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSessionRead needs a SystemSessionProvider");
  const key = spec?.key ?? null;
  const subscribe = useCallback(
    (notify: () => void) => (spec ? session.subscribeRead(spec as SessionRead<unknown>, notify) : () => undefined),
    // The loader belongs to the key: a new key brings its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, key],
  );
  const snapshot = useCallback(() => (key === null ? NO_READ : session.readSnapshot(key)), [session, key]);
  return useSyncExternalStore(subscribe, snapshot) as ReadState<T>;
}
