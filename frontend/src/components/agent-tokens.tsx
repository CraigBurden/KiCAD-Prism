import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, useConfirmTarget } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { fetchApi, readApiError } from "@/lib/api";

/**
 * Agent tokens: the tokens a KiCad desktop agent holds to act on Prism as a
 * user. These are managed inside the admin Access Control page, per user, rather
 * than on their own tab, an admin sees every account and can revoke any of its
 * agent tokens from the same place they manage its role.
 *
 * Access Control is admin-only, so loading every user's tokens (all_users=true,
 * which the backend honours for admins) is always in scope here.
 */

export interface AgentToken {
    jti: string;
    email: string;
    label: string;
    scopes: string[];
    created_at: string | null;
    expires_at: number;
    last_used_at: string | null;
}

function formatIso(value: string | null): string {
    if (!value) return "never";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "unknown" : date.toLocaleString();
}

function formatEpoch(seconds: number): string {
    if (!seconds) return "unknown";
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? "unknown" : date.toLocaleString();
}

/**
 * Loads every user's agent tokens once and groups them by email, so each user
 * row in Access Control can show its own without a request per row. `enabled`
 * gates the fetch (it only makes sense for an admin viewing the page).
 */
export function useAgentTokens(enabled: boolean) {
    const [byEmail, setByEmail] = useState<Record<string, AgentToken[]>>({});
    const [loading, setLoading] = useState(false);

    const reload = useCallback(async () => {
        if (!enabled) {
            setByEmail({});
            return;
        }
        setLoading(true);
        try {
            const response = await fetchApi("/api/agent/tokens?all_users=true");
            if (!response.ok) {
                throw new Error(await readApiError(response, "Failed to load agent tokens"));
            }
            const tokens = (await response.json()) as AgentToken[];
            const grouped: Record<string, AgentToken[]> = {};
            for (const token of tokens) {
                const key = token.email.trim().toLowerCase();
                (grouped[key] ??= []).push(token);
            }
            setByEmail(grouped);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load agent tokens");
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const revoke = useCallback(
        async (jti: string) => {
            try {
                const response = await fetchApi(`/api/agent/tokens/${encodeURIComponent(jti)}`, {
                    method: "DELETE",
                });
                if (!response.ok) {
                    throw new Error(await readApiError(response, "Failed to revoke token"));
                }
                toast.success("Agent token revoked");
                await reload();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to revoke token");
            }
        },
        [reload],
    );

    return { byEmail, loading, reload, revoke };
}

/**
 * One user's agent tokens, with a Revoke button per token. Rendered inside that
 * user's Access Control row when it is expanded.
 */
export function AgentTokensForUser({
    tokens,
    onRevoke,
}: {
    tokens: AgentToken[];
    onRevoke: (jti: string) => void | Promise<void>;
}) {
    const revokeTarget = useConfirmTarget<AgentToken>();

    if (tokens.length === 0) {
        return (
            <p className="text-xs text-muted-foreground italic px-3 py-2">
                No agent tokens. This user signs in from the KiCad agent to create one.
            </p>
        );
    }

    return (
        <div className="divide-y rounded-md border bg-background">
            {tokens.map((token) => (
                <div key={token.jti} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{token.label || "Unnamed agent"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                            {token.scopes.join(", ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Last used {formatIso(token.last_used_at)} · Expires{" "}
                            {formatEpoch(token.expires_at)}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => revokeTarget.request(token)}
                        aria-label={`Revoke token ${token.label || token.jti}`}
                    >
                        Revoke
                    </Button>
                </div>
            ))}

            <ConfirmDialog
                open={revokeTarget.open}
                onOpenChange={(next) => {
                    if (!next) revokeTarget.clear();
                }}
                title="Revoke agent token"
                description={
                    revokeTarget.target
                        ? `${revokeTarget.target.label || "This agent"} stops working on Prism immediately. Signing in again from that machine creates a new token.`
                        : ""
                }
                confirmLabel="Hold to revoke"
                requireHold
                onConfirm={() => {
                    const target = revokeTarget.target;
                    revokeTarget.clear();
                    if (target) void onRevoke(target.jti);
                }}
            />
        </div>
    );
}
