import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectComponentImportProposal } from "@/types/catalog";
import { listImportProposals } from "./catalog-client";
import { useImportSessionProposals } from "./library-import-session-proposals";

vi.mock("./catalog-client");

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

import { toast } from "sonner";

function proposal(sessionId: string, reference: string): ProjectComponentImportProposal {
  return {
    id: `${sessionId}-${reference}`,
    session_id: sessionId,
    dedupe_key: reference,
    component_uid: reference,
    reference,
    status: "candidate",
    accepted_component_id: "",
    metadata: { references: [reference] },
    assets: [],
    provenance: [],
    findings: [],
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useImportSessionProposals", () => {
  beforeEach(() => {
    vi.mocked(listImportProposals).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("keeps a delayed session A result off session B's list", async () => {
    let finishA: ((value: { items: ProjectComponentImportProposal[] }) => void) | undefined;
    vi.mocked(listImportProposals).mockImplementation(async (sessionId) => {
      if (sessionId === "session-a") {
        return new Promise((resolve) => {
          finishA = resolve;
        });
      }
      return { items: [proposal("session-b", "R-B")] };
    });

    const { result, rerender } = renderHook(
      ({ sessionId }) => useImportSessionProposals(sessionId),
      { initialProps: { sessionId: "session-a" } },
    );

    rerender({ sessionId: "session-b" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.proposals.map((item) => item.reference)).toEqual(["R-B"]);

    await act(async () => {
      finishA!({ items: [proposal("session-a", "R-A")] });
      await Promise.resolve();
    });
    expect(result.current.proposals.map((item) => item.reference)).toEqual(["R-B"]);
    expect(result.current.proposals[0]?.session_id).toBe("session-b");
  });

  it("reads the proposals again when the session's scan finishes", async () => {
    vi.mocked(listImportProposals)
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [proposal("session-a", "R5")] });
    const { result, rerender } = renderHook(
      ({ status }) => useImportSessionProposals("session-a", status),
      { initialProps: { status: "scanning" } },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.proposals).toEqual([]);

    rerender({ status: "staged" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.proposals.map((item) => item.reference)).toEqual(["R5"]);
    expect(listImportProposals).toHaveBeenCalledTimes(2);
  });

  it("ignores a delayed proposals response after unmount", async () => {
    let finish: ((value: { items: ProjectComponentImportProposal[] }) => void) | undefined;
    vi.mocked(listImportProposals).mockImplementation(async () => new Promise((resolve) => {
      finish = resolve;
    }));
    const { unmount } = renderHook(() => useImportSessionProposals("session-a"));
    unmount();
    await act(async () => {
      finish!({ items: [proposal("session-a", "late")] });
      await Promise.resolve();
    });
    expect(toast.error).not.toHaveBeenCalled();
  });
});
