export interface ApiErrorPayload {
  detail?: string;
  message?: string;
}

export class ApiHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
  }
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

export async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    if (payload.detail) {
      if (typeof payload.detail === "string") {
        return payload.detail;
      }
      if (Array.isArray(payload.detail)) {
        // FastAPI validation errors
        return payload.detail
          .map((e: any) => `${e.loc?.slice(-1)?.[0] || "Field"}: ${e.msg}`)
          .join(", ");
      }
    }
    return payload.message || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackError = "Request failed"
): Promise<T> {
  const response = await fetchApi(input, init);
  if (!response.ok) {
    throw new ApiHttpError(response.status, await readApiError(response, fallbackError));
  }
  return (await response.json()) as T;
}
