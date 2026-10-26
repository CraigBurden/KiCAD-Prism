import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CommentAuthorKind } from "@/types/comments";

const AUTHOR_KIND_LABELS: Partial<Record<CommentAuthorKind, string>> = {
    agent: "Agent",
    service: "Service",
};

interface CommentAuthorKindBadgeProps {
    authorKind?: CommentAuthorKind;
    /** MCP client name or id; shown as the badge's native title when present. */
    authorClientId?: string | null;
    className?: string;
}

/**
 * Marks a comment or reply written by an AI agent or a service. A person's
 * words are unmarked, so the badge is only evidence that a human did not write
 * them.
 */
export function CommentAuthorKindBadge({
    authorKind,
    authorClientId,
    className,
}: CommentAuthorKindBadgeProps) {
    const label = authorKind ? AUTHOR_KIND_LABELS[authorKind] : undefined;
    if (!label) return null;
    return (
        <Badge
            variant={authorKind === "agent" ? "info" : "outline"}
            className={cn("h-5 px-1.5 text-[10px]", className)}
            title={authorClientId ? `via ${authorClientId}` : undefined}
        >
            {label}
        </Badge>
    );
}
