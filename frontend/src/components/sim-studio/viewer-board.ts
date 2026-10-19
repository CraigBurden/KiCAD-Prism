import { useEffect, useState } from "react";

import type { PrismSemanticViewerElement } from "@/types/prism-semantic-viewer";

export type ViewerBoardState =
    | { phase: "off" }
    | { phase: "loading" }
    | { phase: "ready" }
    | { phase: "failed"; error: string };

/** How long a board may take to draw before the result view gives up on it. */
const BOARD_TIMEOUT_MS = 180_000;

/** Whether `viewer` has said it is ready (each element says so once). */
export function useViewerReady(viewer: PrismSemanticViewerElement | null): boolean {
    const [readyOne, setReadyOne] = useState<PrismSemanticViewerElement | null>(null);
    useEffect(() => {
        if (!viewer) return;
        const onReady = () => setReadyOne(viewer);
        viewer.addEventListener("prism-semantic-viewer:ready", onReady);
        return () => viewer.removeEventListener("prism-semantic-viewer:ready", onReady);
    }, [viewer]);
    return viewer !== null && readyOne === viewer;
}

/**
 * Whether the viewer has drawn its board. The viewer draws the commit's
 * design bundle (V2a), the bundle the run solved, so a run's overlay goes
 * onto the board already on screen: no geometry of its own to download.
 * Ready once the viewer reports its analytic copper.
 */
export function useViewerBoard(viewer: PrismSemanticViewerElement | null, viewerReady: boolean): ViewerBoardState {
    const [state, setState] = useState<ViewerBoardState>({ phase: "off" });
    useEffect(() => {
        if (!viewer || !viewerReady || typeof viewer.analyticStats !== "function") {
            setState({ phase: "off" });
            return;
        }
        const started = performance.now();
        let timer = 0;
        const check = () => {
            if (viewer.analyticStats()) {
                setState({ phase: "ready" });
            } else if (performance.now() - started > BOARD_TIMEOUT_MS) {
                setState({ phase: "failed", error: "The board did not finish drawing" });
            } else {
                timer = window.setTimeout(check, 200);
            }
        };
        setState({ phase: "loading" });
        check();
        return () => window.clearTimeout(timer);
    }, [viewer, viewerReady]);
    return state;
}
