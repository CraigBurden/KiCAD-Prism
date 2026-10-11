/**
 * The one transport to the Prism backend.
 *
 * Every request goes through `fetchApi` (session cookie, JSON content type,
 * and the `kicad-prism-auth-error` event on 401/403 that raises the
 * session-expired banner). The typed readers `fetchJson`, `fetchText`,
 * `fetchBlob` and `fetchChecked` throw `ApiHttpError` for any non-OK status,
 * so a caller never parses an error body itself.
 *
 * Error bodies (see `backend/app/core/errors.py`) have one shape:
 * `{"detail": "<message>", "code": "<code>", ...extra}`, request validation
 * (422 `validation_error`) and plain `HTTPException`s included.
 * Non-JSON bodies (a proxy's 502 page) fall back to the caller's message.
 *
 * Guarded writes send the ETag they read as `If-Match` (`ifMatch`). A stale one
 * answers 412 (`isStale`), a missing one 428.
 *
 * Raw `fetch` is only for non-Prism endpoints (GitHub releases, the local
 * KiCad agent) and immutable static assets.
 */

export interface ApiErrorPayload {
  detail?: unknown;
  code?: string;
  [key: string]: unknown;
}

export class ApiHttpError extends Error {
  status: number;
  code?: string;
  /** The error body's other fields (`currentRevision`, `requiredRole`, ...). */
  payload: Record<string, unknown>;

  constructor(status: number, message: string, code?: string, payload: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }

  /** The session is gone (the app shows the session-expired banner). */
  get isAuth(): boolean {
    return this.status === 401;
  }

  get isPermission(): boolean {
    return this.status === 403 || this.code === "publication_required";
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** The write contradicts state no ETag describes: reload, then retry deliberately. */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** A guarded write's `If-Match` named an old version (412): reload, then retry. */
  get isStale(): boolean {
    return this.status === 412;
  }
}

type ParsedApiError = {
  message: string;
  code?: string;
  payload: Record<string, unknown>;
};

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseApiErrorPayload(raw: unknown, fallback: string): ParsedApiError {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { message: fallback, payload: {} };
  }
  const { detail, code, ...rest } = raw as ApiErrorPayload;
  return { message: nonEmpty(detail) ?? fallback, code: nonEmpty(code), payload: rest };
}

/** The `If-Match` header for a guarded write: the resource's ETag `"<kind>:<id>:<version>"`. */
export function ifMatch(kind: "comment" | "reply" | "component", id: string, version: string | number): Record<string, string> {
  return { "If-Match": `"${kind}:${id}:${version}"` };
}

export async function fetchApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const headers = new Headers(init?.headers);
  if (typeof init?.body === "string" && !headers.has("Content-Type") && !headers.has("content-type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials ?? "include",
  });

  if (response.status === 401 || response.status === 403) {
    window.dispatchEvent(
      new CustomEvent("kicad-prism-auth-error", {
        detail: { status: response.status, url },
      })
    );
  }

  return response;
}

async function readApiErrorPayload(response: Response, fallback: string): Promise<ParsedApiError> {
  try {
    return parseApiErrorPayload(await response.json(), fallback);
  } catch {
    return { message: fallback, payload: {} };
  }
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  return (await readApiErrorPayload(response, fallback)).message;
}

/** The `ApiHttpError` for a failed response. Adapters with their own error subclass start here. */
export async function apiErrorFrom(response: Response, fallback = "Request failed"): Promise<ApiHttpError> {
  const parsed = await readApiErrorPayload(response, fallback);
  return new ApiHttpError(response.status, parsed.message, parsed.code, parsed.payload);
}

/** The response when it is OK; otherwise an `ApiHttpError`. For headers, 204s and streaming. */
export async function fetchChecked(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackError = "Request failed"
): Promise<Response> {
  const response = await fetchApi(input, init);
  if (!response.ok) {
    throw await apiErrorFrom(response, fallbackError);
  }
  return response;
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackError = "Request failed"
): Promise<T> {
  return (await (await fetchChecked(input, init, fallbackError)).json()) as T;
}

export async function fetchText(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackError = "Request failed"
): Promise<string> {
  return (await fetchChecked(input, init, fallbackError)).text();
}

export async function fetchBlob(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackError = "Request failed"
): Promise<Blob> {
  return (await fetchChecked(input, init, fallbackError)).blob();
}
