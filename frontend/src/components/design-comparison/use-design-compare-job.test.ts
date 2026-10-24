import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fetchApi } from "@/lib/api";
import { watchPrismJob } from "@/lib/jobs";
import { useDesignCompareJob } from "./use-design-compare-job";

vi.mock("@/lib/api", () => ({ fetchApi: vi.fn(), readApiError: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ isAbortError: () => false, watchPrismJob: vi.fn() }));

describe("useDesignCompareJob", () => {
    it("reports why a failed comparison failed, not just that it did", async () => {
        vi.mocked(fetchApi).mockResolvedValue(new Response(JSON.stringify({ job_id: "job-1" }), { status: 202 }));
        vi.mocked(watchPrismJob).mockResolvedValue({
            job_id: "job-1",
            kind: "design_compare",
            status: "failed",
            stage: "failed",
            message: "Failed",
            percent: 100,
            error_message: "The project is not present at f307d1d (mezz_top.kicad_pro is not in the tree)",
        });

        const { result } = renderHook(() => useDesignCompareJob("prj_1", "f307d1d", "2d844c3"));

        await waitFor(() => expect(result.current.error).toBe(
            "The project is not present at f307d1d (mezz_top.kicad_pro is not in the tree)",
        ));
    });
});
