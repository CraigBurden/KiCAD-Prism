/**
 * A generated outputs index (CONTRACTS §16.7, §17) as a component keeps it:
 * the first read, then a three-second poll while the system bundle builds.
 * The harness outputs dialog and the ICD / Outputs tab read through this.
 */
import { usePoll, useServerState, type ServerKey } from "@/lib/server-state";

import type { HarnessOutputsIndex } from "../model/types";

export const OUTPUTS_POLL_MS = 3000;

/** What a group says while the system bundle is not ready yet. */
export const OUTPUTS_BUILDING_MESSAGE = "The system is still building — outputs follow when it is ready";

export interface OutputsIndexState {
  /** The index once it has arrived, `null` while the first read is in flight. */
  index: HarnessOutputsIndex | null;
  /** The latest read failed; `index` (if any) is from an earlier read. */
  error: Error | null;
  /** Read again now, e.g. from a Retry button. */
  retry: () => void;
}

export function useOutputsIndex(
  key: ServerKey,
  load: (signal: AbortSignal) => Promise<HarnessOutputsIndex>,
): OutputsIndexState {
  const read = useServerState<HarnessOutputsIndex>(key, load, { retainMs: 0 });
  // While the bundle builds, ask again until the index is ready. Polls never
  // overlap, and a failed poll keeps the last index on screen.
  usePoll(read.data?.state === "building", read.refresh, { intervalMs: OUTPUTS_POLL_MS, onError: () => undefined });
  return { index: read.data ?? null, error: read.error, retry: () => void read.refresh() };
}
