/**
 * Placing a connector part on a body (stage 3d, mockup 08): choose the part
 * and its reference, click a face of the body, turn it in quarter turns, and
 * place it. The preview draws in the 3D view as soon as a face is picked.
 */
import type { Pose } from "../placement/poses";
import { PartPicker, type PartHit } from "./part-search";

export interface Placing {
  body: string;
  part: PartHit | null;
  refdes: string;
  quarterTurns: number;
  /** The mating frame on the picked face, in the body's frame; null until a face is clicked. */
  frame: Pose | null;
}

const pill = (on: boolean) =>
  `rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-blue-500 text-zinc-100" : "border-white/15 text-zinc-400 hover:text-zinc-100"}`;

export function PlaceConnectorCard({ bodyLabel, placing, busy, onChange, onPlace, onCancel }: {
  bodyLabel: string;
  placing: Placing;
  busy: boolean;
  onChange: (next: Placing) => void;
  onPlace: () => void;
  onCancel: () => void;
}) {
  const ready = Boolean(placing.part && placing.frame && placing.refdes.trim());
  const at = placing.frame?.translationMm.map((value) => value.toFixed(2)).join(", ");
  return (
    <div
      className="w-[320px] rounded-[10px] border border-white/10 bg-zinc-900/95 p-3 text-zinc-100 shadow-xl"
      role="group"
      aria-label="Place connector"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
        if (event.key === "Enter" && ready && !busy) onPlace();
      }}
    >
      <h4 className="text-[13.5px] font-semibold">Place connector on {bodyLabel}</h4>
      <p className="mb-2.5 text-[11.5px] text-zinc-400">{placing.frame ? `On a face at ${at} mm` : "Choose the part, then click a face of the body."}</p>
      <div className="space-y-2.5 text-xs">
        <div>
          <span className="mb-1 block text-zinc-500">Part</span>
          {placing.part ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-zinc-100">{placing.part.name}</span>
              <span className="truncate text-zinc-500">{placing.part.mpn}</span>
              <button type="button" className="ml-auto text-zinc-400 hover:text-zinc-100" onClick={() => onChange({ ...placing, part: null })}>Change</button>
            </div>
          ) : (
            <PartPicker dark placeholder="Search connector parts" selected={null} onPick={(part) => onChange({ ...placing, part })} />
          )}
        </div>
        <label className="flex items-center gap-2">
          <span className="w-24 text-zinc-500">Reference</span>
          <input
            className="w-24 rounded-md border border-white/15 bg-zinc-950 px-2 py-0.5 font-mono text-xs outline-none focus:border-blue-500"
            value={placing.refdes}
            onChange={(event) => onChange({ ...placing, refdes: event.target.value })}
            aria-label="Reference"
          />
        </label>
        <div className="flex items-center gap-1.5">
          <span className="w-24 text-zinc-500">Quarter turns</span>
          {[0, 1, 2, 3].map((turns) => (
            <button key={turns} type="button" className={pill(placing.quarterTurns === turns)} aria-pressed={placing.quarterTurns === turns} onClick={() => onChange({ ...placing, quarterTurns: turns })}>
              {turns * 90}°
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        <button type="button" disabled={!ready || busy} onClick={onPlace} className="rounded-md border border-blue-500 bg-blue-500 px-2.5 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-50">Place ↵</button>
        <span className="flex-1" />
        <button type="button" onClick={onCancel} className="rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-xs">Esc</button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">The connector mates out of the face along its normal; click another face to move it.</p>
    </div>
  );
}
