/**
 * Harness parts in the catalog (CONTRACTS §16.1): the roles a wiring part can
 * carry, the `harness_*` fields a role has, and the searches the end and
 * quick-create dialogs make. Catalog hits are filtered here because the
 * catalog's own search does not know the harness role vocabulary.
 */
import { useEffect, useState } from "react";

import { listComponents, listMates } from "@/components/workspace/catalog-client";
import type { MatingPart } from "@/components/workspace/library-component-mates";
import type { CatalogComponent } from "@/types/catalog";

import type { PartRef } from "./harness-view";

export const HARNESS_ROLES = [
  "housing",
  "contact",
  "cable",
  "sleeve",
  "heat-shrink",
  "tape",
  "zip-ties",
  "label",
  "marker",
] as const;

export type HarnessRole = (typeof HARNESS_ROLES)[number];

export const HARNESS_ROLE_LABEL: Record<HarnessRole, string> = {
  housing: "Housing",
  contact: "Contact",
  cable: "Cable",
  sleeve: "Sleeve",
  "heat-shrink": "Heat-shrink",
  tape: "Tape",
  "zip-ties": "Zip ties",
  label: "Label",
  marker: "Marker",
};

/** A component's `harness_role`, lowercased; undefined when absent or unknown. */
export function harnessRole(component: Pick<CatalogComponent, "extra_fields">): string | undefined {
  const value = String(component.extra_fields?.harness_role ?? "").trim().toLowerCase();
  return value || undefined;
}

/** One `harness_*` field as written. */
export function harnessField(component: Pick<CatalogComponent, "extra_fields">, key: string): string | undefined {
  const value = component.extra_fields?.[key];
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

/** MPNs compare case- and space-insensitively (§16.4 `housing-not-mating`). */
export function normalizeMpn(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

/** The pin a catalog component becomes in the document. */
export function partRefOf(component: CatalogComponent): PartRef {
  return { componentId: component.id, revisionId: component.revision_id };
}

/** A hit's line: what people call it, then its MPN. */
export function partHitName(component: CatalogComponent): string {
  return component.value || component.name || component.mpn || component.id;
}

const LIMIT = 24;
const DEBOUNCE_MS = 200;

/** Catalog parts matching `query`, current revisions only; empty query returns nothing. */
export function useCatalogParts(query: string): { hits: CatalogComponent[]; searching: boolean } {
  const trimmed = query.trim();
  const [hits, setHits] = useState<CatalogComponent[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!trimmed) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({ q: trimmed, page: "1", page_size: String(LIMIT), lightweight: "true", kind: "part" });
      listComponents(params, controller.signal)
        .then((response) => {
          setHits((response.items ?? []).filter((item) => (item.kind ?? "part") === "part" && Boolean(item.revision_id)));
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

/**
 * The parts that mate with the site's connector: the catalog components whose
 * MPN is exactly `mpn` (case and spaces ignored), then their **mates with**
 * partners.
 */
export function useMatingHousings(mpn: string | undefined): { mates: MatingPart[]; searching: boolean } {
  const key = mpn ? normalizeMpn(mpn) : "";
  const [answer, setAnswer] = useState<{ for: string; mates: MatingPart[] } | null>(null);
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: mpn ?? "", page: "1", page_size: "20", lightweight: "true", kind: "part" });
    void listComponents(params, controller.signal)
      .then(async (response) => {
        const exact = (response.items ?? []).filter((item) => normalizeMpn(item.mpn) === key);
        const lists = await Promise.all(exact.map((item) => listMates(item.id, controller.signal).catch(() => ({ items: [] as MatingPart[] }))));
        const found = new Map<string, MatingPart>();
        for (const partner of lists.flatMap((list) => list.items)) {
          if (!found.has(partner.componentId)) found.set(partner.componentId, partner);
        }
        return [...found.values()];
      })
      .then((mates) => {
        if (!controller.signal.aborted) setAnswer({ for: key, mates });
      })
      .catch(() => {
        if (!controller.signal.aborted) setAnswer({ for: key, mates: [] });
      });
    return () => controller.abort();
  }, [key, mpn]);
  return {
    mates: key && answer?.for === key ? answer.mates : [],
    searching: Boolean(key) && answer?.for !== key,
  };
}
