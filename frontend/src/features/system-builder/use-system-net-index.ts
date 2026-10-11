import { useMemo } from "react";

import type { SystemNetListed } from "@/types/system";

import { sessionReads } from "./session/session-reads";
import { useSessionRead } from "./session/use-system-session";

/** Board net → its system net: keys are `occurrence\nnet`. */
export type SystemNetIndex = ReadonlyMap<string, SystemNetListed>;

export const boardNetKey = (occurrence: string, net: string) => `${occurrence}\n${net}`;

/** Index the listed nets by each visible board net they hold. */
export function indexSystemNets(groups: readonly SystemNetListed[]): SystemNetIndex {
  const index = new Map<string, SystemNetListed>();
  for (const group of groups) {
    for (const member of group.members ?? []) index.set(boardNetKey(member.occurrence, member.net), group);
  }
  return index;
}

/**
 * SB2-33: which system net each board net belongs to, for the search to show
 * one result per system net. SB2-98: read only once the search is opened, and
 * again only when the system's connectivity (`netsKey`) changes; a failed read
 * leaves the search on board nets alone.
 */
export function useSystemNetIndex(wanted: boolean): SystemNetIndex {
  // The session keeps the last connectivity's list until the new one arrives.
  const list = useSessionRead(wanted ? sessionReads.netMembers() : null).data;
  return useMemo(() => (list ? indexSystemNets(list.groups) : EMPTY), [list]);
}

const EMPTY: SystemNetIndex = new Map();
