import { afterEach, describe, expect, it, vi } from "vitest";
import {
    flushComparisonDebugLog,
    logComparisonDebug,
    startComparisonDebugSession,
} from "./comparison-debug-log";

describe("comparison debug log", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("serializes a reset session followed by ordered transition events", async () => {
        const requests: RequestInit[] = [];
        vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
            requests.push(init);
            return new Response(JSON.stringify({ status: "logged" }), {
                status: 200,
            });
        }));

        startComparisonDebugSession({
            projectId: "debug-project",
            base: "base-sha",
            compare: "compare-sha",
        });
        logComparisonDebug("difference.click", {
            target: "item",
            id: "net:VCC",
        });
        await flushComparisonDebugLog();

        expect(requests).toHaveLength(2);
        const first = JSON.parse(String(requests[0]!.body));
        const second = JSON.parse(String(requests[1]!.body));
        expect(first).toMatchObject({
            sequence: 0,
            event: "session.start",
            reset: true,
        });
        expect(second).toMatchObject({
            sequence: 1,
            event: "difference.click",
            reset: false,
            payload: {
                target: "item",
                id: "net:VCC",
                clientElapsedMs: expect.any(Number),
            },
        });
        expect(second.session_id).toBe(first.session_id);
    });
});
