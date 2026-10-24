import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { JobClock, JobSource, PrismJobStatus } from "@/lib/jobs";

import { useJobWatcher } from "./use-job-watcher";

const running: PrismJobStatus = {
    job_id: "job-1",
    kind: "project_thumbnail",
    status: "running",
    stage: "render",
    message: "",
    percent: 10,
};

describe("useJobWatcher", () => {
    it("stops polling when the component unmounts", async () => {
        let reads = 0;
        const source: JobSource = {
            async read(_jobId, signal) {
                if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
                reads += 1;
                return running;
            },
            async logs() {
                return [];
            },
        };
        // Each sleep parks until the test releases it, so the watch is mid-wait
        // when the component goes away.
        let release: (() => void) | null = null;
        const clock: JobClock = {
            now: () => 0,
            sleep: (_ms, signal) => new Promise((resolve, reject) => {
                release = resolve;
                signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
            }),
        };
        const { result, unmount } = renderHook(() => useJobWatcher());

        const watching = result.current("job-1", { source, clock });
        await Promise.resolve();
        await Promise.resolve();
        expect(reads).toBe(1);
        unmount();

        await expect(watching).rejects.toMatchObject({ name: "AbortError" });
        expect(release).not.toBeNull();
        expect(reads).toBe(1);
    });
});
