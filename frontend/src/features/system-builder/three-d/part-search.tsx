/**
 * Searching the catalog (stage 3d): a body's part, a connector part to place
 * on a body (`kind` part), or a published system to place as an entry (`kind`
 * system); current revision. A part without a 3D model is marked, as a body
 * needs one to be drawn; a system's revision shows its workflow stage.
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
  /** The current revision's workflow stage (`released`, `qa_review`, …). */
  stage: string;
}

/** What a search looks for: catalog parts, or published systems. */
export type CatalogKind = "part" | "system";

export function partHit(component: CatalogComponent): PartHit {
  return {
    componentId: component.id,
    revisionId: component.revision_id,
    // A catalog component's `name` is its MPN; its value is what people call it (as `--parts` names it).
    name: component.value || component.name || component.mpn || component.id,
    mpn: component.mpn,
    noModel: (component.missing_assets ?? []).includes("3dmodel"),
    stage: String(component.workflow_stage ?? ""),
  };
}

/** Components of `kind` matching `query` (empty: none), as the catalog's search answers. */
export function usePartSearch(query: string, kind: CatalogKind = "part"): { hits: PartHit[]; searching: boolean } {
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
          setHits((response.items ?? []).flatMap((item) => ((item.kind ?? "part") === kind && item.revision_id ? [partHit(item)] : [])));
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
  }, [trimmed, kind]);
  return { hits: trimmed ? hits : [], searching: trimmed ? searching : false };
}

/** A search box and its hits; `onPick` takes the chosen part. */
export function PartPicker({ placeholder, selected, onPick, dark = false, kind = "part" }: { placeholder: string; selected: PartChoice | null; onPick: (part: PartHit) => void; dark?: boolean; kind?: CatalogKind }) {
  const [query, setQuery] = useState("");
  const { hits, searching } = usePartSearch(query, kind);
  const box = dark
    ? "w-full rounded-md border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-blue-500"
    : "w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary";
  return (
    <div className="space-y-1.5">
      <input className={box} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {query.trim() !== "" && (
        <div className={`max-h-44 overflow-y-auto rounded-md border ${dark ? "border-white/10" : ""}`} role="listbox" aria-label={kind === "system" ? "Systems" : "Parts"}>
          {searching && hits.length === 0 && <p className="p-2 text-xs text-zinc-500">Searching…</p>}
          {!searching && hits.length === 0 && <p className="p-2 text-xs text-zinc-500">{kind === "system" ? "No published systems match." : "No parts match."}</p>}
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
              {kind === "part" && hit.noModel && <span className="ml-auto shrink-0 text-amber-500">no 3D model</span>}
              {kind === "system" && hit.stage !== "released" && <span className="ml-auto shrink-0 text-amber-500">{hit.stage.replace("_", " ") || "unreleased"}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
