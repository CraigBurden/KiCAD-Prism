import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMate, listComponents, listMates, removeMate } from "./catalog-client";

/** A part this part mates with (CONTRACTS_P2 §18). */
export interface MatingPart {
  componentId: string;
  name: string;
  mpn: string;
  manufacturer: string;
}

/**
 * "Mates with" on a part's overview: the mating housings, plugs or sockets it
 * pairs with. System Builder suggests these for harness ends and warns on a
 * board-to-board pair the catalog does not list; nothing is assigned from here.
 */
export function MatesWithPanel({ componentId, canMutate }: { componentId: string; canMutate: boolean }) {
  const [mates, setMates] = useState<{ id: string; items: MatingPart[] } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MatingPart[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listMates(componentId, controller.signal)
      .then((body) => setMates({ id: componentId, items: body.items }))
      .catch(() => !controller.signal.aborted && setMates({ id: componentId, items: [] }));
    return () => controller.abort();
  }, [componentId]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: text, page: "1", page_size: "8", lightweight: "true", kind: "part" });
    const timer = window.setTimeout(() => {
      listComponents(params, controller.signal)
        .then((body) => setResults(body.items.flatMap((item) => (item.id === componentId ? [] : [{
          componentId: item.id, name: item.value || item.description || item.mpn, mpn: item.mpn, manufacturer: item.manufacturer,
        }]))))
        .catch(() => undefined);
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, componentId]);

  const change = async (partner: string, add: boolean) => {
    setBusy(true);
    try {
      const body = await (add ? addMate(componentId, partner) : removeMate(componentId, partner));
      setMates({ id: componentId, items: body.items });
      if (add) {
        setQuery("");
        setResults([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change the mating parts");
    } finally {
      setBusy(false);
    }
  };

  const items = mates?.id === componentId ? mates.items : null;
  const known = new Set((items ?? []).map((item) => item.componentId));
  const shown = query.trim().length < 2 ? [] : results.filter((result) => !known.has(result.componentId));

  return (
    <section className="space-y-3 border p-4" aria-label="Mates with">
      <div>
        <h3 className="text-sm font-semibold" title="Parts this connector plugs into">Mates with</h3>
      </div>
      {items === null ? <p className="text-sm text-muted-foreground">Loading…</p> : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="divide-y border">
          {items.map((item) => (
            <li key={item.componentId} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate"><span className="font-medium">{item.mpn || item.name}</span>
                <span className="text-muted-foreground"> · {item.manufacturer}</span></span>
              {canMutate && (
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} aria-label={`Remove ${item.mpn || item.name}`}
                  onClick={() => void change(item.componentId, false)}><X className="h-4 w-4" /></Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canMutate && (
        <div className="space-y-2">
          <Input aria-label="Find a mating part" placeholder="Find a part by MPN or name" value={query}
            onChange={(event) => setQuery(event.target.value)} />
          {shown.length > 0 && (
            <ul className="divide-y border">
              {shown.map((result) => (
                <li key={result.componentId} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{result.mpn || result.name} <span className="text-muted-foreground">· {result.manufacturer}</span></span>
                  <Button variant="outline" size="sm" disabled={busy} aria-label={`Add ${result.mpn || result.name}`}
                    onClick={() => void change(result.componentId, true)}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
