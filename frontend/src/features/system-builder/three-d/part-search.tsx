/**
 * Searching the catalog for a part (stage 3d): a body's part, or a connector
 * part to place on a body. Parts only (`kind` part), newest revision; a part
 * without a 3D model is marked, as a body needs one to be drawn.
 */
import { useEffect, useState } from "react";

import { fetchJson } from "@/lib/api";
import type { CatalogComponent, PaginatedComponents } from "@/types/catalog";

import type { PartChoice } from "./body-edits";

const LIMIT = 20;
const DEBOUNCE_MS = 200;

export interface PartHit extends PartChoice {
  mpn: string;
  /** The part lists no 3D model. */
  noModel: boolean;
}

export function partHit(component: CatalogComponent): PartHit {
  return {
    componentId: component.id,
    revisionId: component.revision_id,
    // A catalog component's `name` is its MPN; its value is what people call it (as `--parts` names it).
    name: component.value || component.name || component.mpn || component.id,
    mpn: component.mpn,
    noModel: (component.missing_assets ?? []).includes("3dmodel"),
  };
}

/** Parts matching `query` (empty: none), as the catalog's search answers. */
export function usePartSearch(query: string): { hits: PartHit[]; searching: boolean } {
  const [hits, setHits] = useState<PartHit[]>([]);
  const [searching, setSearching] = useState(false);
  const trimmed = query.trim();
  useEffect(() => {
    if (!trimmed) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({ q: trimmed, page: "1", page_size: String(LIMIT), lightweight: "true" });
      void fetchJson<PaginatedComponents>(`/api/catalog/components?${params.toString()}`, { signal: controller.signal })
        .then((response) => {
          setHits((response.items ?? []).flatMap((item) => ((item.kind ?? "part") === "part" && item.revision_id ? [partHit(item)] : [])));
          setSearching(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setHits([]);
            setSearching(false);
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);
  return { hits: trimmed ? hits : [], searching: trimmed ? searching : false };
}

/** A search box and its hits; `onPick` takes the chosen part. */
export function PartPicker({ placeholder, selected, onPick, dark = false }: { placeholder: string; selected: PartChoice | null; onPick: (part: PartHit) => void; dark?: boolean }) {
  const [query, setQuery] = useState("");
  const { hits, searching } = usePartSearch(query);
  const box = dark
    ? "w-full rounded-md border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-blue-500"
    : "w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary";
  return (
    <div className="space-y-1.5">
      <input className={box} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {query.trim() !== "" && (
        <div className={`max-h-44 overflow-y-auto rounded-md border ${dark ? "border-white/10" : ""}`} role="listbox" aria-label="Parts">
          {searching && hits.length === 0 && <p className="p-2 text-xs text-zinc-500">Searching…</p>}
          {!searching && hits.length === 0 && <p className="p-2 text-xs text-zinc-500">No parts match.</p>}
          {hits.map((hit) => (
            <button
              key={hit.componentId}
              type="button"
              role="option"
              aria-selected={selected?.componentId === hit.componentId}
              onClick={() => onPick(hit)}
              className={`flex w-full items-baseline gap-2 px-2 py-1 text-left text-xs ${dark ? "hover:bg-white/10" : "hover:bg-muted"} ${selected?.componentId === hit.componentId ? (dark ? "bg-blue-500/20" : "bg-primary/10") : ""}`}
            >
              <span className="truncate font-medium">{hit.name}</span>
              <span className="truncate text-zinc-500">{hit.mpn}</span>
              {hit.noModel && <span className="ml-auto shrink-0 text-amber-500">no 3D model</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
