import { useEffect } from "react";

import { useCommittedRef } from "@/hooks/use-committed-ref";

import type { SessionState, SystemSession } from "../session/system-session";
import { createScriptApi } from "./script-api";

interface ViewHooks {
  open: (sheet: string | null) => void;
  select: (ids: string[]) => void;
  unfold: (occurrence: string, connector: string, unfolded: boolean) => void;
  isUnfolded: (occurrence: string, connector: string) => boolean;
}

/**
 * Publish `window.prismSystemBuilder` for the open system while the page is
 * mounted (§14.6). The API reads the session's latest state through refs, so
 * it is installed once per session.
 */
export function useScriptApi(session: SystemSession | null, state: SessionState, view: ViewHooks): void {
  const stateRef = useCommittedRef(state);
  const viewRef = useCommittedRef(view);
  useEffect(() => {
    if (!session) return;
    const api = createScriptApi({
      record: () => stateRef.current.record,
      bundle: () => stateRef.current.bundle,
      apply: (ops, expectVersion) => session.apply(ops, expectVersion),
      reload: () => session.reload(),
      undo: () => session.undo(),
      open: (sheet) => viewRef.current.open(sheet),
      select: (ids) => viewRef.current.select(ids),
      unfold: (occurrence, connector, unfolded) => viewRef.current.unfold(occurrence, connector, unfolded),
      isUnfolded: (occurrence, connector) => viewRef.current.isUnfolded(occurrence, connector),
    });
    window.prismSystemBuilder = api;
    return () => {
      if (window.prismSystemBuilder === api) delete window.prismSystemBuilder;
    };
  }, [session, stateRef, viewRef]);
}
