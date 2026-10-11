import { useState } from "react";

import type { PrismSystemViewerSelection } from "@/types/prism-semantic-viewer";
import type { SystemNetDetail } from "@/types/system";

import { sessionReads } from "./session/session-reads";
import { useSessionRead } from "./session/use-system-session";

export interface TracedNet {
  /** The board the click landed on (the trace starts there). */
  origin: string;
  /** The board net clicked. */
  boardNet: string;
  loading: boolean;
  /** The system net, or null when the net stays on its board. */
  net: SystemNetDetail | null;
  error: string | null;
  /** Over 200 pins and not confirmed yet: lit only on the clicked board (D-P2-8). */
  waiting: boolean;
}

/** The board net a selection is on: a net, or a pad's net, on one placement. */
function tracedFrom(selection: PrismSystemViewerSelection | null): { origin: string; boardNet: string } | null {
  if (!selection || selection.kind === "board" || !selection.occurrence) return null;
  if (selection.kind !== "net" && selection.kind !== "terminal") return null;
  return selection.netName ? { origin: selection.occurrence, boardNet: selection.netName } : null;
}

/**
 * SB2-32 (D-P2-28): clicking a trace selects its system net. The selection's
 * board net is resolved on the server to the system net it belongs to, re-read
 * whenever the system changes. A net over 200 pins waits for `light` (D-P2-8).
 */
export function useTracedNet(selection: PrismSystemViewerSelection | null) {
  const from = tracedFrom(selection);
  const read = useSessionRead(from ? sessionReads.tracedNet(from.origin, from.boardNet) : null);
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());

  // Re-read whenever the system's connectivity changes; nothing shows from the last one meanwhile.
  const current = read.error
    ? { net: null, error: read.error instanceof Error ? read.error.message : "Could not trace the net" }
    : read.data !== undefined ? { net: read.data, error: null } : null;
  const traced: TracedNet | null = from ? {
    ...from,
    loading: !current,
    net: current?.net ?? null,
    error: current?.error ?? null,
    waiting: Boolean(current?.net?.large && !confirmed.has(current.net.groupId)),
  } : null;

  return {
    traced,
    /** Light a large net on every board after all. */
    light: (groupId: string) => setConfirmed((set) => new Set(set).add(groupId)),
  };
}
