import { useEffect, useReducer, useRef } from "react";

import { useServerState } from "@/lib/server-state";

import { fetchFabricationView, fetchLayerObjectUrl } from "./fabrication-api";
import type { FabricationSource, FabricationView } from "./types";

type ViewState =
    | { status: "loading" }
    | { status: "ready"; view: FabricationView }
    | { status: "error"; message: string };

const messageOf = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/**
 * Load a package's layer list. The viewer is keyed on the source, so a new
 * package is a new component; the read itself is server state, keyed by URL.
 */
export function useFabricationView(source: FabricationSource): ViewState {
    const read = useServerState(["fabrication-view", source.viewUrl], (signal) =>
        fetchFabricationView(source.viewUrl, signal),
    );
    if (read.data) return { status: "ready", view: read.data };
    if (read.error) return { status: "error", message: read.error.message };
    return { status: "loading" };
}

export type LayerImage =
    | { status: "loading" }
    | { status: "ready"; url: string }
    | { status: "error"; message: string };

type ImageAction =
    | { type: "loading"; id: string }
    | { type: "ready"; id: string; url: string }
    | { type: "error"; id: string; message: string };

function imagesReducer(
    state: Record<string, LayerImage>,
    action: ImageAction,
): Record<string, LayerImage> {
    switch (action.type) {
        case "loading":
            return { ...state, [action.id]: { status: "loading" } };
        case "ready":
            return { ...state, [action.id]: { status: "ready", url: action.url } };
        default:
            return { ...state, [action.id]: { status: "error", message: action.message } };
    }
}

/** A layer URL that changes whenever the backend draws layers differently. */
export function withVersion(url: string, version: number): string {
    return `${url}${url.includes("?") ? "&" : "?"}r=${version}`;
}

/**
 * Layer SVGs, fetched the first time a layer is shown and kept after it is
 * hidden again. Object URLs are revoked when the viewer goes away.
 */
export function useLayerImages(
    source: FabricationSource,
    visibleIds: readonly string[],
    renderVersion: number,
): Record<string, LayerImage> {
    const [images, dispatch] = useReducer(imagesReducer, {});
    const requested = useRef(new Set<string>());
    const urls = useRef<string[]>([]);
    const closed = useRef(false);

    // react-doctor-disable-next-line react-doctor/no-fetch-in-effect
    useEffect(() => {
        for (const id of visibleIds) {
            if (requested.current.has(id)) continue;
            requested.current.add(id);
            dispatch({ type: "loading", id });
            // The dispatch is this hook's own reducer, not a callback into a parent.
            // react-doctor-disable-next-line react-doctor/no-pass-data-to-parent
            fetchLayerObjectUrl(withVersion(source.layerUrl(id), renderVersion))
                .then((url) => {
                    if (closed.current) {
                        URL.revokeObjectURL(url);
                        return;
                    }
                    urls.current.push(url);
                    dispatch({ type: "ready", id, url });
                })
                .catch((cause: unknown) => {
                    if (!closed.current) dispatch({ type: "error", id, message: messageOf(cause) });
                });
        }
    }, [visibleIds, source, renderVersion]);

    useEffect(() => {
        closed.current = false;
        const held = urls.current;
        return () => {
            closed.current = true;
            for (const url of held) URL.revokeObjectURL(url);
        };
    }, []);

    return images;
}
