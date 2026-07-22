export type ComparisonDebugPayload = Record<string, unknown>;

type DebugSession = {
    key: string;
    projectId: string;
    sessionId: string;
    sequence: number;
};

let session: DebugSession | null = null;
let writeTail: Promise<void> = Promise.resolve();

function makeSessionId(): string {
    const suffix = globalThis.crypto?.randomUUID?.()
        ?? Math.random().toString(36).slice(2);
    return `design-compare-${Date.now()}-${suffix}`;
}

function serializeError(error: unknown): ComparisonDebugPayload {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }
    return { message: String(error) };
}

async function postEvent(
    active: DebugSession,
    event: string,
    payload: ComparisonDebugPayload,
    reset: boolean,
): Promise<void> {
    try {
        const response = await fetch(
            `/api/projects/${encodeURIComponent(active.projectId)}/design-compare/debug-log`,
            {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: active.sessionId,
                    sequence: active.sequence,
                    event,
                    timestamp: new Date().toISOString(),
                    payload,
                    reset,
                }),
                keepalive: true,
            },
        );
        if (!response.ok) {
            console.warn(
                `[DesignComparisonDebug] Failed to write ${event}: ${response.status}`,
            );
        }
    } catch (error) {
        console.warn("[DesignComparisonDebug] Debug log write failed", error);
    }
}

function enqueue(
    active: DebugSession,
    event: string,
    payload: ComparisonDebugPayload,
    reset = false,
): void {
    const sequence = active.sequence++;
    const snapshot = { ...active, sequence };
    writeTail = writeTail
        .catch(() => undefined)
        .then(() => postEvent(snapshot, event, payload, reset));
}

export function startComparisonDebugSession(input: {
    projectId: string;
    base: string;
    compare: string;
}): string {
    const key = `${input.projectId}:${input.base}:${input.compare}`;
    if (session?.key === key) return session.sessionId;
    session = {
        key,
        projectId: input.projectId,
        sessionId: makeSessionId(),
        sequence: 0,
    };
    enqueue(session, "session.start", {
        base: input.base,
        compare: input.compare,
        href: window.location.href,
        userAgent: navigator.userAgent,
    }, true);
    return session.sessionId;
}

export function logComparisonDebug(
    event: string,
    payload: ComparisonDebugPayload = {},
): void {
    if (!session) return;
    enqueue(session, event, payload);
}

export function logComparisonDebugError(
    event: string,
    error: unknown,
    payload: ComparisonDebugPayload = {},
): void {
    logComparisonDebug(event, { ...payload, error: serializeError(error) });
}

/** Wait for queued writes; primarily useful to settle diagnostics in tests. */
export function flushComparisonDebugLog(): Promise<void> {
    return writeTail.catch(() => undefined);
}
