/**
 * A catalog part named the way people know it (value · MPN) instead of its
 * ids. Lookups are shared across the tab, so a part read once is not fetched
 * again; until it arrives, or when it cannot be read, the reference is shown.
 */
import { useEffect, useState } from "react";

import { getComponent } from "@/components/workspace/catalog-client";
import type { CatalogComponent } from "@/types/catalog";

import type { PartRef } from "./harness-view";

const names = new Map<string, Promise<string | null>>();

function nameOf(component: CatalogComponent): string {
  const head = component.value || component.name || component.mpn;
  return component.mpn && component.mpn !== head ? `${head} · ${component.mpn}` : head || component.id;
}

function lookup(componentId: string): Promise<string | null> {
  let found = names.get(componentId);
  if (!found) {
    found = getComponent(componentId).then(nameOf, () => null);
    names.set(componentId, found);
  }
  return found;
}

/** `componentId` or `componentId@revisionId` → the part's display name, once read. */
export function usePartName(ref: PartRef | string | undefined): string | undefined {
  const text = typeof ref === "string" ? ref : ref ? `${ref.componentId}${ref.revisionId ? `@${ref.revisionId}` : ""}` : undefined;
  const componentId = text?.split("@")[0];
  const [answer, setAnswer] = useState<{ for: string; name: string } | null>(null);
  useEffect(() => {
    if (!componentId) return undefined;
    let live = true;
    void lookup(componentId).then((name) => {
      if (live && name) setAnswer({ for: componentId, name });
    });
    return () => {
      live = false;
    };
  }, [componentId]);
  return answer && answer.for === componentId ? answer.name : text;
}

export function PartName({ part }: { part: PartRef | string }) {
  return <>{usePartName(part)}</>;
}
