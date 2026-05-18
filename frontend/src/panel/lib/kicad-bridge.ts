/**
 * Typed KiCad RPC bridge.
 *
 * Extracted from the original vanilla-JS app.js and ported to TypeScript.
 * Handles session negotiation, command dispatch, and response routing.
 */

const RPC_VERSION = 1;
const BACKOFF_MS = [500, 1200, 2500];

type Waiter = {
  resolve: (payload: KiCadResponse) => void;
  reject: (error: Error) => void;
};

export interface KiCadResponse {
  version?: number;
  session_id?: string;
  message_id?: number;
  response_to?: number;
  command?: string;
  status?: string;
  error_message?: string;
  parameters?: Record<string, unknown>;
  data?: string;
}

type LogFn = (message: string) => void;

const RESPONSE_WAITERS = new Map<string, Waiter>();
let sessionId: string | null = null;
let messageCounter = 0;
let logCallback: LogFn = () => {};

export function setLogCallback(fn: LogFn) {
  logCallback = fn;
}

function appendLog(message: string) {
  logCallback(message);
}

// ─── Transport ────────────────────────────────────────────────────────

function postToKiCad(payload: string): boolean {
  const w = window as unknown as Record<string, unknown>;
  if (
    typeof w.webkit === "object" &&
    w.webkit !== null &&
    (w.webkit as Record<string, unknown>).messageHandlers
  ) {
    const handlers = (w.webkit as Record<string, Record<string, { postMessage: (p: string) => void }>>).messageHandlers;
    if (handlers.kicad) {
      handlers.kicad.postMessage(payload);
      return true;
    }
  }
  if (
    typeof w.chrome === "object" &&
    w.chrome !== null &&
    (w.chrome as Record<string, unknown>).webview
  ) {
    const webview = (w.chrome as Record<string, { postMessage: (p: string) => void }>).webview;
    if (webview?.postMessage) {
      webview.postMessage(payload);
      return true;
    }
  }
  if (typeof w.external === "object" && w.external !== null) {
    const ext = w.external as { invoke?: (p: string) => void };
    if (ext.invoke) {
      try {
        ext.invoke(payload);
        return true;
      } catch {
        /* ignore */
      }
    }
  }
  return false;
}

// ─── Message Handling ─────────────────────────────────────────────────

function handleIncomingMessage(incoming: unknown) {
  let payload: KiCadResponse | null = null;
  if (typeof incoming === "string") {
    try {
      payload = JSON.parse(incoming) as KiCadResponse;
    } catch (err) {
      appendLog(`Invalid KiCad response: ${(err as Error).message}`);
      return;
    }
  } else if (typeof incoming === "object" && incoming !== null) {
    payload = incoming as KiCadResponse;
  }

  if (!payload) return;

  // NEW_SESSION from KiCad
  if (payload.command === "NEW_SESSION" && payload.response_to === undefined) {
    sessionId = payload.session_id ?? null;
    messageCounter = payload.message_id ?? 0;
    RESPONSE_WAITERS.clear();
    appendLog(`Session established: ${sessionId}`);
    sendNewSessionResponse(payload);
    return;
  }

  // Response to a command we sent
  if (payload.response_to !== undefined) {
    const waiter = RESPONSE_WAITERS.get(String(payload.response_to));
    if (waiter) {
      RESPONSE_WAITERS.delete(String(payload.response_to));
      if (payload.status === "ERROR") {
        waiter.reject(new Error(payload.error_message || "KiCad RPC failed"));
      } else {
        waiter.resolve(payload);
      }
    }
    return;
  }

  appendLog(`KiCad -> ${JSON.stringify(payload)}`);
}

function sendNewSessionResponse(request: KiCadResponse) {
  if (!sessionId) return;
  const envelope = {
    version: RPC_VERSION,
    session_id: sessionId,
    message_id: ++messageCounter,
    response_to: request.message_id,
    command: "NEW_SESSION",
    status: "OK",
    parameters: {
      server_name: "KiCAD Prism Remote Provider",
      server_version: "0.1.0",
    },
  };
  postToKiCad(JSON.stringify(envelope));
}

// ─── Public API ───────────────────────────────────────────────────────

export function getSessionId(): string | null {
  return sessionId;
}

export function hasSession(): boolean {
  return sessionId !== null;
}

export function waitForResponse(
  messageId: number,
  timeoutMs = 4000
): Promise<KiCadResponse> {
  return new Promise((resolve, reject) => {
    const key = String(messageId);
    const timer = window.setTimeout(() => {
      RESPONSE_WAITERS.delete(key);
      reject(new Error("Response timeout"));
    }, timeoutMs);
    RESPONSE_WAITERS.set(key, {
      resolve(payload) {
        window.clearTimeout(timer);
        resolve(payload);
      },
      reject(err) {
        window.clearTimeout(timer);
        reject(err);
      },
    });
  });
}

export async function sendRpcCommand(
  command: string,
  parameters: Record<string, unknown> = {},
  data = ""
): Promise<KiCadResponse> {
  if (!sessionId) {
    throw new Error("Session has not been established yet.");
  }
  const envelope = {
    version: RPC_VERSION,
    session_id: sessionId,
    message_id: ++messageCounter,
    command,
    parameters: JSON.parse(JSON.stringify(parameters)),
    data,
  };
  postToKiCad(JSON.stringify(envelope));
  return waitForResponse(envelope.message_id);
}

export async function retry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error | null = null;
  for (let index = 0; index < BACKOFF_MS.length; index += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      appendLog(`Attempt ${index + 1} failed: ${lastError.message}`);
      if (index < BACKOFF_MS.length - 1) {
        await new Promise((r) => window.setTimeout(r, BACKOFF_MS[index]));
      }
    }
  }
  throw lastError;
}

export function installBridge() {
  const w = window as unknown as Record<string, Record<string, unknown>>;
  const existing = (w.kiclient as Record<string, unknown>) || {};
  const previousPost =
    typeof existing.postMessage === "function"
      ? (existing.postMessage as (msg: unknown) => void)
      : null;
  const backlog: unknown[] = Array.isArray(existing._msgBacklog)
    ? existing._msgBacklog
    : [];

  existing.postMessage = function (incoming: unknown) {
    handleIncomingMessage(incoming);
    if (previousPost) previousPost(incoming);
  };
  w.kiclient = existing;

  backlog.forEach((msg) => {
    (existing.postMessage as (msg: unknown) => void)(msg);
  });
}

export async function waitForSession(): Promise<string> {
  while (!sessionId) {
    await new Promise((r) => window.setTimeout(r, 100));
  }
  return sessionId;
}

export async function getSourceInfo(): Promise<KiCadResponse> {
  return sendRpcCommand("GET_SOURCE_INFO");
}

export async function triggerRemoteLogin(): Promise<KiCadResponse> {
  return sendRpcCommand("REMOTE_LOGIN", { interactive: true });
}
