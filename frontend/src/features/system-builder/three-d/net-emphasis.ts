/**
 * A net picked on one board, lit on every board the system net reaches: the
 * viewer only knows the board net it was clicked on, the bundle knows which
 * board nets the system joins (§7).
 */
import type { SystemBundle } from "../model/types";
import type { PrismSelection } from "@/types/prism-selection";

export interface NetEmphasis {
  key: string;
  members: { occurrence: string; net: string }[];
}

/** The board net a viewer selection names, when it names one on an occurrence. */
export function pickedBoardNet(selection: (PrismSelection & { occurrence?: string }) | null): { occurrence: string; net: string } | null {
  if (!selection?.occurrence) return null;
  const net = selection.kind === "net" || selection.kind === "terminal" ? selection.netName : undefined;
  return net ? { occurrence: selection.occurrence, net } : null;
}

/**
 * The system net that joins `picked`, as an emphasis set over all its board
 * nets; a board net the bundle does not list still lights on its own board.
 */
export function systemNetEmphasis(bundle: SystemBundle | null | undefined, picked: { occurrence: string; net: string } | null): NetEmphasis | null {
  if (!picked) return null;
  const net = bundle?.nets.find((item) => item.boardNets.some((member) => member.occurrence === picked.occurrence && member.net === picked.net));
  if (!net) return { key: `board:${picked.occurrence}:${picked.net}`, members: [picked] };
  return { key: net.id, members: net.boardNets.map((member) => ({ occurrence: member.occurrence, net: member.net })) };
}
