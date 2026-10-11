import { createContext, useContext } from "react";
import { fetchApi, readApiError } from "@/lib/api";
import type { Comment } from "@/types/comments";

/**
 * Applies a thread the server returned after a message action (reaction,
 * edit, reply delete). The owner of the comment list provides it; without a
 * provider the live stream still delivers the change.
 */
export type ApplyThread = (thread: Comment) => void;

export const ThreadUpdateContext = createContext<ApplyThread | null>(null);

export function useApplyThread(): ApplyThread | null {
    return useContext(ThreadUpdateContext);
}

export class ThreadActionError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

/** Send one message action and return the updated thread. */
export async function threadAction(
    path: string,
    init: RequestInit,
    fallback: string,
): Promise<Comment> {
    const response = await fetchApi(path, init);
    if (!response.ok) {
        const message = response.status === 412
            ? "This message changed while you were editing it. Reload it and try again."
            : await readApiError(response, fallback);
        throw new ThreadActionError(message, response.status);
    }
    return (await response.json()) as Comment;
}

export function commentPath(projectId: string, commentId: string, suffix = ""): string {
    return `/api/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}${suffix}`;
}
