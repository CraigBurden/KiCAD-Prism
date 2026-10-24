import { useCallback, useState } from "react";
import type { Comment } from "@/types/comments";

/**
 * Which threads have activity since this browser last opened them.
 *
 * A per-viewer convenience kept in localStorage: it is never shared and may be
 * cleared at any time. The first visit to a project records a baseline, so an
 * existing review does not open with every thread marked new.
 */
interface SeenState {
    baseline: string;
    seen: Record<string, string>;
}

const storageKey = (projectId: string) => `prism:comments-seen:${projectId}`;

function readSeen(projectId: string): SeenState {
    try {
        const raw = window.localStorage.getItem(storageKey(projectId));
        const parsed = raw ? (JSON.parse(raw) as Partial<SeenState>) : null;
        if (parsed && typeof parsed.baseline === "string" && parsed.seen && typeof parsed.seen === "object") {
            return { baseline: parsed.baseline, seen: parsed.seen };
        }
    } catch {
        // Storage blocked or corrupt: fall through to a fresh baseline.
    }
    const fresh = { baseline: new Date().toISOString(), seen: {} };
    writeSeen(projectId, fresh);
    return fresh;
}

function writeSeen(projectId: string, state: SeenState): void {
    try {
        window.localStorage.setItem(storageKey(projectId), JSON.stringify(state));
    } catch {
        // Unread markers are a convenience; losing them is harmless.
    }
}

const time = (value: string | undefined) => {
    const parsed = value ? Date.parse(value) : Number.NaN;
    return Number.isNaN(parsed) ? 0 : parsed;
};

/** The newest post, reply or edit in a thread. */
export function latestActivity(comment: Comment): number {
    let latest = Math.max(time(comment.timestamp), time(comment.editedAt));
    for (const reply of comment.replies) {
        latest = Math.max(latest, time(reply.timestamp), time(reply.editedAt));
    }
    return latest;
}

export function useUnreadThreads(projectId: string) {
    const [state, setState] = useState<{ projectId: string; seen: SeenState }>(() => ({
        projectId, seen: readSeen(projectId),
    }));
    const current = state.projectId === projectId ? state.seen : readSeen(projectId);
    if (state.projectId !== projectId) setState({ projectId, seen: current });

    const isUnread = useCallback((comment: Comment) => {
        const since = Math.max(time(current.baseline), time(current.seen[comment.id]));
        return latestActivity(comment) > since;
    }, [current]);

    const markSeen = useCallback((comment: Comment) => {
        const at = new Date(Math.max(Date.now(), latestActivity(comment))).toISOString();
        const next = { ...current, seen: { ...current.seen, [comment.id]: at } };
        writeSeen(projectId, next);
        setState({ projectId, seen: next });
    }, [current, projectId]);

    return { isUnread, markSeen };
}
