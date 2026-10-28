import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "@/lib/api";
import {
    cancelPrismJob,
    JobStalledError,
    throwIfJobFailed,
    watchPrismJob,
    type JobClock,
    type JobSource,
    type PrismJobStatus,
} from "@/lib/jobs";

vi.mock("@/lib/api", () => ({
    fetchApi: vi.fn(),
    readApiError: vi.fn(async () => "request failed"),
}));

const response = (payload: unknown): Response =>
    new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });

describe("unified job polling", () => {
    beforeEach(() => {
        vi.mocked(fetchApi).mockReset();
    });

    it("polls status and logs until the fenced job completes", async () => {
        vi.mocked(fetchApi)
            .mockResolvedValueOnce(response({
                job_id: "job-1",
                kind: "kicad_workflow",
                status: "running",
                stage: "run-jobset",
                message: "Generating",
                percent: 50,
            }))
            .mockResolvedValueOnce(response({ lines: ["first"] }))
            .mockResolvedValueOnce(response({
                job_id: "job-1",
                kind: "kicad_workflow",
                status: "completed",
                stage: "completed",
                message: "Ready",
                percent: 100,
            }))
            .mockResolvedValueOnce(response({ lines: ["first", "done"] }));
        const updates: Array<{ status: string; logs: string[] }> = [];

        const job = await watchPrismJob("job-1", {
            intervalMs: 0,
            includeLogs: true,
            onUpdate: (nextJob, logs) => {
                updates.push({ status: nextJob.status, logs });
            },
        });

        expect(job.status).toBe("completed");
        expect(updates).toEqual([
            { status: "running", logs: ["first"] },
            { status: "completed", logs: ["first", "done"] },
        ]);
    });

    it("surfaces failed job details", () => {
        expect(() => throwIfJobFailed({
            job_id: "job-1",
            kind: "project_sync",
            status: "failed",
            stage: "failed",
            message: "Failed",
            percent: 20,
            error_message: "Remote rejected the fetch",
        }, "Sync failed")).toThrow("Remote rejected the fetch");
    });

    it("requests cancellation through the unified job endpoint", async () => {
        vi.mocked(fetchApi).mockResolvedValueOnce(response({ status: "cancel_requested" }));
        await cancelPrismJob("job-1");
        expect(fetchApi).toHaveBeenCalledWith("/api/jobs/job-1/cancel", { method: "POST" });
    });

    it("rejects a cancel the server refused", async () => {
        vi.mocked(fetchApi).mockResolvedValueOnce(new Response("{}", { status: 403 }));
        await expect(cancelPrismJob("job-1")).rejects.toThrow("request failed");
    });
});

const job = (partial: Partial<PrismJobStatus> & Pick<PrismJobStatus, "status">): PrismJobStatus => ({
    job_id: "job-1",
    kind: "project_thumbnail",
    stage: partial.status,
    message: "",
    percent: 0,
    ...partial,
});

/** Plays back a scripted sequence of job states; the last one repeats. */
function fakeSource(states: PrismJobStatus[]): JobSource & { reads: number } {
    const source = {
        reads: 0,
        async read(_jobId: string, signal?: AbortSignal) {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
            const next = states[Math.min(source.reads, states.length - 1)];
            source.reads += 1;
            return next;
        },
        async logs() {
            return [];
        },
    };
    return source;
}

/** Time advances only when the watcher sleeps. */
function fakeClock(): JobClock & { sleeps: number[] } {
    let now = 0;
    const clock = {
        sleeps: [] as number[],
        now: () => now,
        async sleep(milliseconds: number, signal?: AbortSignal) {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
            clock.sleeps.push(milliseconds);
            now += milliseconds;
        },
    };
    return clock;
}

describe("watchPrismJob with a fake clock and source", () => {
    it("treats cancelled as terminal", async () => {
        const source = fakeSource([job({ status: "running" }), job({ status: "cancelled" })]);
        const settled = await watchPrismJob("job-1", { source, clock: fakeClock() });
        expect(settled.status).toBe("cancelled");
        expect(source.reads).toBe(2);
    });

    it("keeps polling through retry_wait and cancel_requested", async () => {
        const source = fakeSource([
            job({ status: "retry_wait" }),
            job({ status: "cancel_requested" }),
            job({ status: "cancelled" }),
        ]);
        const settled = await watchPrismJob("job-1", { source, clock: fakeClock() });
        expect(settled.status).toBe("cancelled");
        expect(source.reads).toBe(3);
    });

    it("gives up on a job that stays queued past the stall ceiling", async () => {
        const source = fakeSource([job({ status: "queued" })]);
        const clock = fakeClock();
        await expect(watchPrismJob("job-1", {
            source,
            clock,
            intervalMs: 1_000,
            stallTimeoutMs: 10_000,
        })).rejects.toBeInstanceOf(JobStalledError);
        expect(source.reads).toBe(11);
    });

    it("does not count a moving job as stalled", async () => {
        const states = Array.from({ length: 30 }, (_, index) => job({ status: "running", percent: index }));
        const source = fakeSource([...states, job({ status: "completed", percent: 100 })]);
        const settled = await watchPrismJob("job-1", {
            source,
            clock: fakeClock(),
            intervalMs: 1_000,
            stallTimeoutMs: 5_000,
        });
        expect(settled.status).toBe("completed");
    });

    it("stops polling and never reports an update once aborted", async () => {
        const controller = new AbortController();
        const source = fakeSource([job({ status: "running" })]);
        const clock = fakeClock();
        const updates: string[] = [];
        const watching = watchPrismJob("job-1", {
            source,
            clock: {
                ...clock,
                async sleep(milliseconds, signal) {
                    if (source.reads === 3) controller.abort();
                    return clock.sleep(milliseconds, signal);
                },
            },
            signal: controller.signal,
            onUpdate: (next) => {
                updates.push(next.status);
            },
        });
        await expect(watching).rejects.toMatchObject({ name: "AbortError" });
        expect(source.reads).toBe(3);
        expect(updates).toHaveLength(3);
    });

    it("drops an update that lands after the abort", async () => {
        const controller = new AbortController();
        const onUpdate = vi.fn();
        const source: JobSource = {
            async read() {
                controller.abort();
                return job({ status: "running" });
            },
            async logs() {
                return [];
            },
        };
        await expect(watchPrismJob("job-1", {
            source,
            clock: fakeClock(),
            signal: controller.signal,
            onUpdate,
        })).rejects.toMatchObject({ name: "AbortError" });
        expect(onUpdate).not.toHaveBeenCalled();
    });

    it("backs off to the ceiling and resets when the job advances", async () => {
        const source = fakeSource([
            job({ status: "running", result_metadata: { result_version: 0 } }),
            job({ status: "running", result_metadata: { result_version: 0 } }),
            job({ status: "running", result_metadata: { result_version: 0 } }),
            job({ status: "running", result_metadata: { result_version: 0 } }),
            job({ status: "running", result_metadata: { result_version: 1 } }),
            job({ status: "completed", result_metadata: { result_version: 2 } }),
        ]);
        const clock = fakeClock();
        const version = (value?: PrismJobStatus) => Number(value?.result_metadata?.result_version ?? 0);
        await watchPrismJob("job-1", {
            source,
            clock,
            intervalMs: 150,
            maxIntervalMs: 300,
            backoff: 1.5,
            resetBackoff: (next, previous) => version(next) > version(previous),
        });
        expect(clock.sleeps).toEqual([150, 225, 300, 300, 150]);
    });

    it("ends the watch with the error onUpdate throws", async () => {
        const source = fakeSource([job({ status: "running" })]);
        await expect(watchPrismJob("job-1", {
            source,
            clock: fakeClock(),
            onUpdate: async () => {
                throw new Error("hydrate failed");
            },
        })).rejects.toThrow("hydrate failed");
        expect(source.reads).toBe(1);
    });
});
