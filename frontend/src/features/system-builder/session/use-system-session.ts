import { useEffect, useState, useSyncExternalStore } from "react";

import { SystemSession, type SessionState } from "./system-session";

const EMPTY: SessionState = { bundleStale: false, saving: false, undoStack: [], redoStack: [] };
const noop = () => () => undefined;

/**
 * Open `systemId` for `actor` (the signed-in user's email) and keep it open
 * while mounted. The session is an external system: created and loaded in an
 * effect, disposed on cleanup.
 */
export function useSystemSession(systemId: string, actor: string): { session: SystemSession | null; state: SessionState } {
  const [session, setSession] = useState<SystemSession | null>(null);
  useEffect(() => {
    const opened = new SystemSession(systemId, actor);
    const controller = new AbortController();
    setSession(opened);
    void opened.load(controller.signal);
    return () => {
      controller.abort();
      opened.dispose();
    };
  }, [systemId, actor]);
  const state = useSyncExternalStore(session?.subscribe ?? noop, session?.snapshot ?? (() => EMPTY), () => EMPTY);
  return { session, state };
}
