import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiHttpError,
  DesignDataFailedError,
  DesignDataPendingError,
  DESIGN_DATA_PENDING_TIMEOUT_MS,
  fetchDesignJson,
  fetchDesignText,
} from "./api";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function textResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

const PENDING = { status: "pending", members: ["projections/project.json"], retryAfterSeconds: 0.01 };
const PENDING_MINUTE = { ...PENDING, retryAfterSeconds: 60 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("design data pending", () => {
  it("retries a 202 and returns the eventual data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(202, PENDING))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }, { "X-Prism-Working-Tree": "dirty" }));
    vi.stubGlobal("fetch", fetchMock);

    const onPending = vi.fn();
    const result = await fetchDesignJson<{ ok: boolean }>("/api/design", undefined, { onPending });

    expect(result.data).toEqual({ ok: true });
    expect(result.workingTreeDirty).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onPending).toHaveBeenCalledWith({ members: ["projections/project.json"], retryAfterSeconds: 0.01 });
  });

  it("gives up with a typed pending error after the window", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(202, PENDING)));

    await expect(
      fetchDesignJson("/api/design", undefined, { pendingTimeoutMs: 0 }),
    ).rejects.toBeInstanceOf(DesignDataPendingError);
  });

  it("keeps polling past two minutes with the default window", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(202, PENDING_MINUTE))
        .mockResolvedValueOnce(jsonResponse(202, PENDING_MINUTE))
        .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
      vi.stubGlobal("fetch", fetchMock);

      const pending = fetchDesignJson<{ ok: boolean }>("/api/design", undefined, {
        pendingTimeoutMs: DESIGN_DATA_PENDING_TIMEOUT_MS,
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Still polling well past the old two-minute window.
      await vi.advanceTimersByTimeAsync(65_000);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      await expect(pending).resolves.toEqual({ data: { ok: true }, workingTreeDirty: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("defaults to a fifteen-minute window", () => {
    expect(DESIGN_DATA_PENDING_TIMEOUT_MS).toBe(900_000);
  });

  it("does not treat another 202 as design data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(202, { job_id: "j", status: "started" })));

    const result = await fetchDesignJson<{ job_id: string }>("/api/jobs", undefined);
    expect(result.data).toEqual({ job_id: "j", status: "started" });
  });
});

describe("design data failed", () => {
  it("turns a 422 failed body into a typed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(422, { status: "failed", members: ["projections/project.json"], detail: "parse failed" }),
      ),
    );

    const failure = await fetchDesignJson("/api/design").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DesignDataFailedError);
    expect(failure).toBeInstanceOf(ApiHttpError);
    expect((failure as DesignDataFailedError).members).toEqual(["projections/project.json"]);
    expect((failure as DesignDataFailedError).message).toBe("parse failed");
  });

  it("keeps an ordinary 422 an ApiHttpError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(422, { detail: "bad input", code: "validation_error" })));

    const failure = await fetchDesignJson("/api/design", undefined, { fallbackError: "fail" }).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(ApiHttpError);
    expect(failure).not.toBeInstanceOf(DesignDataFailedError);
    expect((failure as ApiHttpError).message).toBe("bad input");
  });
});

describe("design data text", () => {
  it("carries the dirty notice from a viewer-source response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => textResponse(200, "(kicad_sch)", { "X-Prism-Working-Tree": "dirty" })));

    const result = await fetchDesignText("/api/projects/p/schematic");
    expect(result.data).toBe("(kicad_sch)");
    expect(result.workingTreeDirty).toBe(true);
  });
});
