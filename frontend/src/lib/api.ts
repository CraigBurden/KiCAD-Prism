/**
 * The one transport to the Prism backend.
 *
 * Every request goes through `fetchApi` (session cookie, JSON content type,
 * and the `kicad-prism-auth-error` event on 401/403 that raises the
 * session-expired banner). The typed readers `fetchJson`, `fetchText`,
 * `fetchBlob` and `fetchChecked` throw `ApiHttpError` for any non-OK status,
 * so a caller never parses an error body itself.
 *
 * Error bodies (see `backend/app/core/errors.py`): `{"detail": "<message>",
 * "code"?: ..., ...extra}`; catalog conflicts send `{"detail": {code, message}}`,
 * some tracker routes nest the whole object under `detail`, and FastAPI
 * validation sends `detail` as an array. Non-JSON bodies (a proxy's 502 page)
 * fall back to the caller's message.
 *
 * Raw `fetch` is only for non-Prism endpoints (GitHub releases, the local
 * KiCad agent) and immutable static assets.
 */

type ValidationEntry = { loc?: unknown[]; msg?: string };

export interface ApiErrorPayload {
  detail?: string | { code?: string; message?: string; detail?: string } | ValidationEntry[];
  message?: string;
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

  /** The write contradicts newer state: reload, then retry deliberately. */
  get isConflict(): boolean {
    return this.status === 409 || this.code === "revision_conflict";
  }

  /** A guarded write carried an old version (System Builder's ETag, 412). */
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
  const { detail, message, code, ...rest } = raw as ApiErrorPayload;
  if (Array.isArray(detail)) {
    const text = detail
      .map((entry) => `${entry.loc?.slice(-1)?.[0] || "Field"}: ${entry.msg}`)
      .join(", ");
    return { message: text || fallback, code: nonEmpty(code), payload: rest };
  }
  if (detail && typeof detail === "object") {
    // Catalog conflicts send {"detail": {code, message}}; some tracker routes nest
    // the whole body ({"detail": {detail, code, ...}}). Either way the object's
    // fields are the error's fields.
    const { detail: inner, message: innerMessage, code: innerCode, ...innerRest } = detail as Record<string, unknown>;
    return {
      message: nonEmpty(inner) ?? nonEmpty(innerMessage) ?? nonEmpty(message) ?? fallback,
      code: nonEmpty(innerCode) ?? nonEmpty(code),
      payload: { ...rest, ...innerRest },
    };
  }
  return { message: nonEmpty(detail) ?? nonEmpty(message) ?? fallback, code: nonEmpty(code), payload: rest };
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
