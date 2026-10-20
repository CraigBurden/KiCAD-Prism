/**
 * A harness part search (CONTRACTS §16.5): catalog parts of one harness role,
 * the housing's contact family first, and role-less parts only when no part of
 * the role matches. The quick-create link carries the role the search wants.
 */
import { useId, useState } from "react";

import { Label } from "@/components/ui/label";
import type { CatalogComponent } from "@/types/catalog";

import { HARNESS_ROLE_LABEL, harnessField, harnessRole, partHitName, useCatalogParts, type HarnessRole } from "./harness-parts";
import type { PartRef } from "./harness-view";

interface Props {
  label: string;
  placeholder: string;
  role: HarnessRole;
  /** The chosen housing's contact family; its contacts come first. */
  family?: string;
  selected?: PartRef | null;
  disabled?: boolean;
  onPick: (component: CatalogComponent) => void;
  onNewPart?: (role: HarnessRole) => void;
}

export function PartSearchField({
  label,
  placeholder,
  role,
  family,
  selected,
  disabled,
  onPick,
  onNewPart,
}: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const { hits, searching } = useCatalogParts(query);
  const ofRole = hits.filter((hit) => harnessRole(hit) === role);
  const roleless = hits.filter((hit) => !harnessRole(hit));
  const shown = ofRole.length ? ofRole : roleless;
  const inFamily = (hit: CatalogComponent) => Boolean(family) && harnessField(hit, "harness_contact_family") === family;
  const ordered = [...shown].sort((a, b) => Number(inFamily(b)) - Number(inFamily(a)));

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[11.5px] text-zinc-400">{label}</Label>
      <input
        id={id}
        className="w-full rounded-md border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-sky-500 disabled:opacity-50"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => setQuery(event.target.value)}
      />
      {query.trim() !== "" && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-white/10" role="listbox" aria-label={`${label} results`}>
          {searching && shown.length === 0 && <p className="p-2 text-xs text-zinc-500">Searching…</p>}
          {!searching && shown.length === 0 && <p className="p-2 text-xs text-zinc-500">No parts match.</p>}
          {ordered.map((component) => {
            const rolelessHit = !harnessRole(component);
            return (
              <button
                key={component.id}
                type="button"
                role="option"
                aria-selected={selected?.componentId === component.id}
                disabled={disabled}
                onClick={() => onPick(component)}
                className={`flex w-full items-baseline gap-2 px-2 py-1 text-left text-xs hover:bg-white/10 ${selected?.componentId === component.id ? "bg-sky-500/20" : ""}`}
              >
                <span className="truncate font-medium">{partHitName(component)}</span>
                <span className="truncate text-zinc-500">{component.mpn}</span>
                {inFamily(component) && <span className="ml-auto shrink-0 text-emerald-400">{family}</span>}
                {rolelessHit && <span className="ml-auto shrink-0 text-amber-400">no harness role</span>}
              </button>
            );
          })}
        </div>
      )}
      {onNewPart && (
        <button
          type="button"
          className="text-[11px] text-sky-400 hover:underline disabled:pointer-events-none disabled:opacity-40"
          disabled={disabled}
          onClick={() => onNewPart(role)}
        >
          ＋ New {HARNESS_ROLE_LABEL[role].toLowerCase()}…
        </button>
      )}
    </div>
  );
}
