/**
 * The end dialog's housing section (CONTRACTS §16.1, §16.5): the parts that
 * mate with the site's connector first, then a catalog search of housing parts.
 */
import type { CatalogComponent } from "@/types/catalog";

import { PartSearchField } from "./harness-part-search";
import { partRefOf, useMatingHousings, type HarnessRole } from "./harness-parts";
import type { EndView, PartRef } from "./harness-view";
import { PartName } from "./part-name";

interface Props {
  end: EndView;
  housing: PartRef | null;
  disabled?: boolean;
  onPick: (part: PartRef) => void;
  onClear: () => void;
  onNewPart: (role: HarnessRole) => void;
}

export function EndHousing({ end, housing, disabled, onPick, onClear, onNewPart }: Props) {
  const { mates, searching } = useMatingHousings(end.mpn);

  return (
    <section aria-label="Housing" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] uppercase tracking-wide text-zinc-500">Housing</h4>
        {housing && (
          <button type="button" className="text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40" disabled={disabled} onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <p className={`rounded-md border border-white/10 px-2 py-1 text-xs ${housing ? "text-emerald-300" : "text-amber-300"}`}>
        {housing ? <PartName part={housing} /> : "Housing not chosen"}
      </p>

      {end.mpn ? (
        <div className="space-y-1">
          <p className="text-[11.5px] text-zinc-400">Mating parts for {end.mpn}</p>
          {searching && <p className="text-xs text-zinc-500">Reading mating parts…</p>}
          {!searching && mates.length === 0 && <p className="text-xs text-zinc-500">No mating parts recorded for this connector.</p>}
          <ul className="divide-y divide-white/5">
            {mates.map((mate) => (
              <li key={mate.componentId}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick({ componentId: mate.componentId })}
                  className={`flex w-full items-baseline gap-2 px-2 py-1 text-left text-xs hover:bg-white/10 disabled:opacity-40 ${housing?.componentId === mate.componentId ? "bg-emerald-500/15" : ""}`}
                >
                  <span className="text-emerald-400" aria-label="mates">✓</span>
                  <span className="truncate font-medium">{mate.name || mate.mpn || mate.componentId}</span>
                  <span className="truncate text-zinc-500">{mate.mpn}</span>
                  <span className="ml-auto shrink-0 text-emerald-400">mates</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[11.5px] text-zinc-500">The connector has no MPN; search the catalog for its housing.</p>
      )}

      <PartSearchField
        label="Find a housing part"
        placeholder="Search housing parts by MPN or name"
        role="housing"
        selected={housing}
        disabled={disabled}
        onPick={(component: CatalogComponent) => onPick(partRefOf(component))}
        onNewPart={onNewPart}
      />
          </section>
  );
}
