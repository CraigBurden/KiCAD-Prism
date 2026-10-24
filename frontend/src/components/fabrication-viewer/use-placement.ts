import { ApiHttpError } from "@/lib/api";
import { useServerState } from "@/lib/server-state";

import { fetchPlacement } from "./fabrication-api";
import type { FabricationSource, PlacementView } from "./types";

export type PlacementState =
    | { status: "loading" }
    /** No position file, or a source that has none: nothing to show, and no tab. */
    | { status: "absent" }
    | { status: "ready"; data: PlacementView }
    | { status: "error"; message: string };

/**
 * The package's pick-and-place parts. A missing position file is normal (most
 * packages are bare boards), so a 404 is "absent", not an error.
 */
export function usePlacement(source: FabricationSource): PlacementState {
    const url = source.placementUrl;
    const read = useServerState(url ? ["fabrication-placement", url] : null, (signal) =>
        fetchPlacement(url ?? "", signal),
    );
    if (!url) return { status: "absent" };
    if (read.data) return { status: "ready", data: read.data };
    if (read.error instanceof ApiHttpError && read.error.status === 404) return { status: "absent" };
    if (read.error) return { status: "error", message: read.error.message };
    return { status: "loading" };
}
