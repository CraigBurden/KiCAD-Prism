/**
 * The end dialog's pin map (CONTRACTS §2.5, §16.5): cavity-to-pad rows where
 * they differ. An empty map means cavity n is pad n.
 */
import { useId } from "react";

import { Label } from "@/components/ui/label";

export interface PinMapRow {
  /** A stable row identity; the document stores only `cavity` and `pad`. */
  key: string;
  cavity: string;
  pad: string;
}

let rowNumber = 0;

/** A blank pin-map row with a fresh identity. */
export function pinMapRow(cavity = "", pad = ""): PinMapRow {
  rowNumber += 1;
  return { key: `pin-map-${rowNumber}`, cavity, pad };
}

interface Props {
  rows: PinMapRow[];
  disabled?: boolean;
  onChange: (rows: PinMapRow[]) => void;
}

export function EndPinMap({ rows, disabled, onChange }: Props) {
  const id = useId();
  const set = (index: number, key: keyof PinMapRow, value: string) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, [key]: value } : row)));

  return (
    <section aria-label="Pin map" className="space-y-2">
      <h4 className="text-[11px] uppercase tracking-wide text-zinc-500">Pin map</h4>
      {rows.length === 0 && <p className="text-[11.5px] text-zinc-500">Cavity n is pad n.</p>}
      {rows.map((row, index) => (
        <div key={row.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`${id}-cavity-${index}`} className="text-[11px] text-zinc-400">Cavity</Label>
            <input
              id={`${id}-cavity-${index}`}
              className="w-full rounded-md border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-sky-500 disabled:opacity-50"
              value={row.cavity}
              disabled={disabled}
              onChange={(event) => set(index, "cavity", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-pad-${index}`} className="text-[11px] text-zinc-400">Pad</Label>
            <input
              id={`${id}-pad-${index}`}
              className="w-full rounded-md border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-sky-500 disabled:opacity-50"
              value={row.pad}
              disabled={disabled}
              onChange={(event) => set(index, "pad", event.target.value)}
            />
          </div>
          <button
            type="button"
            className="rounded-md border border-white/15 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
            disabled={disabled}
            aria-label={`Remove pin map row ${index + 1}`}
            onClick={() => onChange(rows.filter((_, at) => at !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
        disabled={disabled}
        onClick={() => onChange([...rows, pinMapRow()])}
      >
        Add row
      </button>
    </section>
  );
}
