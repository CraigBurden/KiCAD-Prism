import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
    toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchApi = vi.fn();
vi.mock("@/lib/api", () => ({
    fetchApi: (...args: unknown[]) => fetchApi(...args),
    readApiError: vi.fn(async () => "boom"),
}));

import { AgentToken, AgentTokensForUser, useAgentTokens } from "./agent-tokens";

const TOKENS: AgentToken[] = [
    {
        jti: "tok-1",
        email: "owner@example.com",
        label: "my-laptop",
        scopes: ["api:read", "api:write"],
        created_at: "2026-01-01T00:00:00+00:00",
        expires_at: 4102444800,
        last_used_at: "2026-02-01T12:00:00+00:00",
    },
    {
        jti: "tok-2",
        email: "OTHER@example.com",
        label: "workshop-pc",
        scopes: ["api:read"],
        created_at: "2026-01-02T00:00:00+00:00",
        expires_at: 4102444800,
        last_used_at: null,
    },
];

function jsonResponse(body: unknown, ok = true) {
    return { ok, json: async () => body } as unknown as Response;
}

beforeEach(() => {
    fetchApi.mockReset();
});

afterEach(() => {
    cleanup();
});

describe("useAgentTokens", () => {
    it("does not fetch when disabled", async () => {
        renderHook(() => useAgentTokens(false));
        await waitFor(() => expect(fetchApi).not.toHaveBeenCalled());
    });

    it("loads every user's tokens and groups them by lowercased email", async () => {
        fetchApi.mockResolvedValue(jsonResponse(TOKENS));
        const { result } = renderHook(() => useAgentTokens(true));

        await waitFor(() =>
            expect(fetchApi).toHaveBeenCalledWith("/api/agent/tokens?all_users=true"),
        );
        await waitFor(() => expect(Object.keys(result.current.byEmail)).toHaveLength(2));
        expect(result.current.byEmail["owner@example.com"]).toHaveLength(1);
        // The email was OTHER@…; grouping folds case so a lookup is predictable.
        expect(result.current.byEmail["other@example.com"]).toHaveLength(1);
    });

    it("revokes a token then reloads", async () => {
        fetchApi.mockResolvedValue(jsonResponse(TOKENS));
        const { result } = renderHook(() => useAgentTokens(true));
        await waitFor(() => expect(Object.keys(result.current.byEmail)).toHaveLength(2));

        fetchApi.mockClear();
        fetchApi.mockResolvedValue(jsonResponse([]));
        await result.current.revoke("tok-1");

        expect(fetchApi).toHaveBeenCalledWith(
            "/api/agent/tokens/tok-1",
            expect.objectContaining({ method: "DELETE" }),
        );
        // A reload follows the delete.
        expect(fetchApi).toHaveBeenCalledWith("/api/agent/tokens?all_users=true");
    });
});

describe("AgentTokensForUser", () => {
    it("shows an empty state when the user has no tokens", () => {
        render(<AgentTokensForUser tokens={[]} onRevoke={vi.fn()} />);
        expect(screen.getByText(/No agent tokens/i)).toBeInTheDocument();
    });

    it("lists tokens and asks for confirmation before revoking", async () => {
        const onRevoke = vi.fn();
        render(<AgentTokensForUser tokens={[TOKENS[0]]} onRevoke={onRevoke} />);

        expect(screen.getByText("my-laptop")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Revoke token my-laptop" }));

        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByText(/my-laptop stops working on Prism/i)).toBeInTheDocument();
        // The confirm is a hold, so nothing is revoked on the plain open.
        expect(onRevoke).not.toHaveBeenCalled();
    });
});
