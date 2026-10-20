/**
 * The end dialog's contacts (CONTRACTS §16.5): one row per cavity in use, each
 * with a contact search; the housing's family comes first. **Fill all** puts
 * one chosen contact in every row.
 */
import { useState } from "react";

import type { CatalogComponent } from "@/types/catalog";

import { naturalCompare } from "../schematic/scene";
import { PartSearchField } from "./harness-part-search";
import { PartName } from "./part-name";
import { partRefOf, type HarnessRole } from "./harness-parts";
import type { EndView, PartRef } from "./harness-view";

interface Props {
  end: EndView;
  contacts: Record<string, PartRef>;
  family?: string;
  disabled?: boolean;
  onChange: (contacts: Record<string, PartRef>) => void;
  onNewPart: (role: HarnessRole) => void;
}

/** Cavities the wires reach, then any the end already assigns a contact to. */
function cavitiesInUse(end: EndView, contacts: Record<string, PartRef>): string[] {
  const cavities = new Set(Object.keys(contacts));
  for (const pin of end.pins) if (pin.wired) cavities.add(pin.cavity);
  return [...cavities].sort(naturalCompare);
}

export function EndContacts({ end, contacts, family, disabled, onChange, onNewPart }: Props) {
  const [fill, setFill] = useState<PartRef | null>(null);
  const cavities = cavitiesInUse(end, contacts);

  const choose = (cavity: string, component: CatalogComponent) => onChange({ ...contacts, [cavity]: partRefOf(component) });
  const clear = (cavity: string) => {
    const next = { ...contacts };
    delete next[cavity];
    onChange(next);
  };

  return (
    <section aria-label="Contacts" className="space-y-2">
      <h4 className="text-[11px] uppercase tracking-wide text-zinc-500">Contacts</h4>
      {cavities.length === 0 && <p className="text-[11.5px] text-zinc-500">No cavity is wired yet.</p>}
      {cavities.map((cavity) => (
        <div key={cavity} className="rounded-md border border-white/10 p-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs text-zinc-300">Cavity {cavity}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[11.5px] text-zinc-500">{contacts[cavity] ? <PartName part={contacts[cavity]} /> : "no contact"}</span>
              {contacts[cavity] && (
                <button type="button" className="text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40" disabled={disabled} onClick={() => clear(cavity)}>
                  Clear
                </button>
              )}
            </div>
          </div>
          <PartSearchField
            label={`Contact for cavity ${cavity}`}
            placeholder="Search contact parts"
            role="contact"
            family={family}
            selected={contacts[cavity] ?? null}
            disabled={disabled}
            onPick={(component) => choose(cavity, component)}
            onNewPart={onNewPart}
          />
        </div>
      ))}
      {cavities.length > 0 && (
        <div className="rounded-md border border-white/10 p-2">
          <PartSearchField
            label="Contact for every cavity"
            placeholder="Search a contact to fill all"
            role="contact"
            family={family}
            selected={fill}
            disabled={disabled}
            onPick={(component) => setFill(partRefOf(component))}
            onNewPart={onNewPart}
          />
          <button
            type="button"
            className="mt-1.5 rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
            disabled={disabled || !fill}
            onClick={() => {
              if (!fill) return;
              onChange(Object.fromEntries(cavities.map((cavity) => [cavity, fill])));
            }}
          >
            Fill all
          </button>
        </div>
      )}
    </section>
  );
}
