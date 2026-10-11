import { useCallback, useEffect, useRef } from "react";

import { watchPrismJob, type PrismJobStatus } from "@/lib/jobs";

type WatchOptions = NonNullable<Parameters<typeof watchPrismJob>[1]>;

/**
 * `watchPrismJob` bound to the component's lifetime: every watch started
 * through it is aborted on unmount, so a job the user walked away from stops
 * being polled. A caller that passes its own `signal` manages that watch.
 */
export function useJobWatcher(): (jobId: string, options?: WatchOptions) => Promise<PrismJobStatus> {
    const lifetime = useRef<AbortController | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        lifetime.current = controller;
        return () => controller.abort();
    }, []);

    return useCallback(
        (jobId: string, options: WatchOptions = {}) =>
            watchPrismJob(jobId, { ...options, signal: options.signal ?? lifetime.current?.signal }),
        [],
    );
}
