import { useEffect, useReducer } from "react";

import { ApiHttpError } from "@/lib/api";

import { fetchPlacement } from "./fabrication-api";
import type { FabricationSource, PlacementView } from "./types";

export type PlacementState =
    | { status: "loading" }
    /** No position file, or a source that has none: nothing to show, and no tab. */
    | { status: "absent" }
    | { status: "ready"; data: PlacementView }
    | { status: "error"; message: string };

type Action =
    | { type: "absent" }
    | { type: "ready"; data: PlacementView }
    | { type: "error"; message: string };

function reducer(_state: PlacementState, action: Action): PlacementState {
    if (action.type === "ready") return { status: "ready", data: action.data };
    if (action.type === "absent") return { status: "absent" };
    return { status: "error", message: action.message };
}

/**
 * The package's pick-and-place parts. A missing position file is normal (most
 * packages are bare boards), so a 404 is "absent", not an error.
 */
export function usePlacement(source: FabricationSource): PlacementState {
    const url = source.placementUrl;
    const [state, dispatch] = useReducer(reducer, url ? { status: "loading" } : { status: "absent" });

    // One request owned by the view that shows it; there is no data layer.
    // react-doctor-disable-next-line react-doctor/no-fetch-in-effect
    useEffect(() => {
        if (!url) return undefined;
        let cancelled = false;
        fetchPlacement(url)
            .then((data) => {
                if (!cancelled) dispatch({ type: "ready", data });
            })
            .catch((cause: unknown) => {
                if (cancelled) return;
                if (cause instanceof ApiHttpError && cause.status === 404) {
                    dispatch({ type: "absent" });
                } else {
                    dispatch({ type: "error", message: cause instanceof Error ? cause.message : String(cause) });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [url]);

    return state;
}
