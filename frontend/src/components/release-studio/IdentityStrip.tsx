import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { ReleaseCandidate, ReleaseConfiguration, ReleaseIdentity } from "./types";

export function IdentityStrip({
    candidate,
    configuration,
    identity,
    fallbackCommit,
    variant,
    status,
    behind,
    onJumpToLatest,
}: {
    candidate: ReleaseCandidate | null;
    configuration: ReleaseConfiguration | null;
    identity: ReleaseIdentity;
    fallbackCommit: string;
    variant: string;
    status: string;
    behind: boolean;
    onJumpToLatest: () => void;
}) {
    const commit = candidate?.commit_sha || fallbackCommit;
    const resolvedVariant = candidate?.variant || variant || configuration?.default_variant || "default";
    const documentName = configuration?.document_number || identity.document_name || "—";
    const revision = configuration?.revision || identity.tag || "—";
    return (
        <div
            aria-label="Release identity"
            className="ml-auto flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs leading-none"
            title={`${commit} · ${status} · ${resolvedVariant} · ${documentName} · Rev ${revision}`}
        >
            <span className="shrink-0 font-mono text-muted-foreground">{commit.slice(0, 12) || "HEAD"}</span>
            <Badge variant="outline" className="h-5 shrink-0 px-1.5">{status}</Badge>
            <span className="truncate text-muted-foreground">{resolvedVariant}</span>
            <span className="min-w-0 truncate">{documentName}</span>
            <span className="min-w-0 truncate text-muted-foreground">Rev {revision}</span>
            {behind && (
                <Button size="xs" variant="outline" onClick={onJumpToLatest}>
                    Jump to latest
                </Button>
            )}
        </div>
    );
}
