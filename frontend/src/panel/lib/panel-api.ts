/**
 * Panel API client — typed fetch helpers for the remote-provider endpoints.
 */

export interface PanelComponent {
  id: string;
  slug: string;
  name: string;
  manufacturer: string;
  mpn: string;
  description: string;
  package_name: string;
  category: string;
  datasheet_url: string;
  summary: string;
  version: string;
  library_name: string;
  symbol_name: string;
  assets: PanelAsset[];
  availability_state: "metadata_only" | "files_partial" | "place_ready";
  missing_assets: string[];
  place_enabled: boolean;
  stock_quantity: number;
  stock_uom: string;
  inventory_status: string;
  preview_status: Record<string, { status: string; error: string }>;
  symbol_preview_url: string;
  footprint_preview_url: string;
  manifest_url: string;
  inline_url: string;
}

export interface PanelAsset {
  id: string;
  asset_type: "symbol" | "footprint" | "3dmodel" | "spice";
  name: string;
  target_library: string;
  target_name: string;
  content_type: string;
  required: boolean;
}

export interface PanelCategory {
  name: string;
  count: number;
}

class PanelApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PanelApiError";
    this.status = status;
  }
}

let apiToken: string | null = null;

export function setApiToken(token: string | null) {
  apiToken = token;
}

async function panelFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {};
  if (apiToken) {
    headers["Authorization"] = `Bearer ${apiToken}`;
  }
  let response: Response;
  try {
    response = await fetch(url, { credentials: "include", headers, signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new PanelApiError(0, `Network error: ${(err as Error).message}`);
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      detail = payload.detail || payload.message || detail;
    } catch {
      /* ignore */
    }
    throw new PanelApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export function isAuthError(err: unknown): boolean {
  return err instanceof PanelApiError && (err.status === 401 || err.status === 403);
}

async function fetchComponentPages(
  endpoint: string,
  params: URLSearchParams,
  pageSize: number,
  maxItems: number,
  signal?: AbortSignal
): Promise<PanelComponent[]> {
  const items: PanelComponent[] = [];
  let page = 1;
  let pages = 1;
  do {
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    const data = await panelFetch<{ items: PanelComponent[]; pages: number }>(
      `${endpoint}?${params.toString()}`,
      signal
    );
    items.push(...data.items);
    pages = data.pages;
    page += 1;
  } while (page <= pages && items.length < maxItems && !signal?.aborted);
  return items.slice(0, maxItems);
}

export async function searchComponents(
  query: string,
  signal?: AbortSignal
): Promise<PanelComponent[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  return fetchComponentPages("/api/remote-provider/search", params, 50, 50, signal);
}

export async function getCategories(
  signal?: AbortSignal
): Promise<PanelCategory[]> {
  const data = await panelFetch<{ categories: PanelCategory[] }>(
    "/api/remote-provider/categories",
    signal
  );
  return data.categories;
}

export async function getComponentsByCategory(
  category: string,
  signal?: AbortSignal
): Promise<PanelComponent[]> {
  const params = new URLSearchParams({ category });
  return fetchComponentPages("/api/remote-provider/components-by-category", params, 200, 500, signal);
}

export async function getComponent(
  componentId: string,
  signal?: AbortSignal
): Promise<PanelComponent> {
  return panelFetch<PanelComponent>(
    `/api/remote-provider/components/${componentId}`,
    signal
  );
}

export async function getPartManifest(
  partId: string
): Promise<Record<string, unknown>> {
  return panelFetch<Record<string, unknown>>(
    `/api/remote-provider/parts/${partId}`
  );
}

export async function getInlineBundle(
  componentId: string
): Promise<Record<string, unknown>> {
  return panelFetch<Record<string, unknown>>(
    `/api/remote-provider/components/${componentId}/inline`
  );
}
