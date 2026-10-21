/**
 * Whether the harness inspector is folded into its thin strip (CONTRACTS §16.5).
 * The choice belongs to the reviewer, so it survives a reload; storage may
 * refuse (private mode, a full quota), in which case the inspector starts
 * expanded. `]` is the keyboard equivalent, shared with the tab's other keys.
 */
import { useCallback, useEffect, useState } from "react";

import { useHotkeys } from "@/hooks/use-hotkeys";

export const COLLAPSED_KEY = "prism.system-builder.harness-inspector.collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    // react-doctor-disable-next-line react-doctor/client-localstorage-no-version - The key is fixed by the harness tab's panel contract; the value is read back as one boolean, and versioning the key would lose an existing layout preference.
    window.localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  } catch {
    // Storage refused; the choice still applies for this session.
  }
}

export interface InspectorCollapse {
  collapsed: boolean;
  collapse: () => void;
  expand: () => void;
  toggle: () => void;
}

export function useInspectorCollapse(): InspectorCollapse {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  // Persisted from the committed value: an updater React may replay stays pure.
  useEffect(() => writeCollapsed(collapsed), [collapsed]);
  const collapse = useCallback(() => setCollapsed(true), []);
  const expand = useCallback(() => setCollapsed(false), []);
  const toggle = useCallback(() => setCollapsed((current) => !current), []);

  useHotkeys([{ combo: "]", handler: toggle }]);

  return { collapsed, collapse, expand, toggle };
}
