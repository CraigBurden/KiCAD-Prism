import type { PartStatus } from "./types";

/**
 * What the BOM check found.
 *
 * The colours are fixed, not theme tokens: markers are drawn over the board
 * pane, which is dark in every theme, so they have to read on that background.
 * Problems also get a ring (see `part-markers.tsx`), so colour is never the only cue.
 */
export const STATUS_LABEL: Record<PartStatus, string> = {
    ok: "In BOM",
    "no-bom": "Not checked",
    "not-in-bom": "Not in BOM",
    "dnp-placed": "DNP but placed",
    "not-placed": "Not placed",
};

export const STATUS_HINT: Partial<Record<PartStatus, string>> = {
    "not-placed": "In the BOM, absent from the position file",
    "dnp-placed": "Marked do-not-place in the BOM, but in the position file",
    "not-in-bom": "In the position file, absent from the BOM",
};

export const STATUS_COLOUR: Record<PartStatus, string> = {
    ok: "#22c55e",
    "no-bom": "#22c55e",
    "not-in-bom": "#f59e0b",
    "dnp-placed": "#ef4444",
    "not-placed": "#ef4444",
};

/** Statuses that need a second look; they are drawn with a ring. */
export const isProblem = (status: PartStatus): boolean =>
    status === "not-in-bom" || status === "dnp-placed" || status === "not-placed";
