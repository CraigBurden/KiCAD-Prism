/**
 * How long a viewer keeps asking for something its scene cannot answer yet
 * (a harness tube that is not drawn, a board that reports no layers): about
 * six seconds, for every viewer (decisions D10/D11). A caller picks only its
 * interval; the number of retries follows from this window.
 */
const VIEWER_RETRY_WINDOW_MS = 6000;

/** Retries that fit in the window when they run `intervalMs` apart. */
export function viewerRetries(intervalMs: number): number {
    return Math.floor(VIEWER_RETRY_WINDOW_MS / intervalMs);
}
