/**
 * The 3D tab's View card (stage 3b, mockup 06): the two explodes, as
 * separate controls, and what is shown. Assembly explode slides mated boards
 * apart along their mate axes; stackup separation splits each board's
 * layers, on every board or only the selected one.
 */
export interface ViewSettings {
  assembly: number;
  stackup: number;
  stackupScope: "all" | "selected";
  labels: boolean;
  parts: boolean;
}

export const DEFAULT_VIEW: ViewSettings = { assembly: 0, stackup: 0, stackupScope: "all", labels: true, parts: true };

const pill = (on: boolean) =>
  `rounded-full border px-2 py-0.5 text-[11px] disabled:opacity-40 ${on ? "border-blue-500 text-zinc-100" : "border-white/15 text-zinc-400 hover:text-zinc-100"}`;

export function ViewCard({ view, onChange, hasSelection }: { view: ViewSettings; onChange: (next: ViewSettings) => void; hasSelection: boolean }) {
  const slider = (key: "assembly" | "stackup", label: string) => (
    <label className="col-span-2 grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1">
      <span>{label}</span>
      <span className="font-mono text-zinc-400">{Math.round(view[key] * 100)}%</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(view[key] * 100)}
        onChange={(event) => onChange({ ...view, [key]: Number(event.target.value) / 100 })}
        className="col-span-2 h-1 w-full accent-blue-500"
        aria-label={label}
      />
    </label>
  );
  return (
    <div className="w-[250px] rounded-[10px] border border-white/10 bg-zinc-900/95 p-3 text-zinc-100 shadow-xl" role="group" aria-label="View">
      <h4 className="text-[13.5px] font-semibold">View</h4>
      <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-2 text-xs">
        {slider("assembly", "Assembly explode")}
        {slider("stackup", "Stackup separation")}
        <span className="text-[11.5px] text-zinc-400">Separate</span>
        <span className="flex gap-1">
          <button type="button" className={pill(view.stackupScope === "all")} aria-pressed={view.stackupScope === "all"} onClick={() => onChange({ ...view, stackupScope: "all" })}>All boards</button>
          <button type="button" className={pill(view.stackupScope === "selected")} aria-pressed={view.stackupScope === "selected"} disabled={!hasSelection} onClick={() => onChange({ ...view, stackupScope: "selected" })}>Selected</button>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" className={pill(view.labels)} aria-pressed={view.labels} onClick={() => onChange({ ...view, labels: !view.labels })}>Labels</button>
        <button type="button" className={pill(view.parts)} aria-pressed={view.parts} onClick={() => onChange({ ...view, parts: !view.parts })}>Parts</button>
      </div>
    </div>
  );
}
