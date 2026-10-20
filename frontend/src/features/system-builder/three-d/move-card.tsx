/**
 * The Move card (stage 3b, mockup 06): where the move target sits, as
 * numbers that follow the gizmo and take typed values. Typing previews the
 * pose in the view; Enter or Place stores it, Esc drops it.
 */
import { useState } from "react";

import type { PrismScenePose, PrismSystemSceneMoveState } from "@/types/prism-semantic-viewer";

import { eulerDegrees, rotationFromEuler } from "../placement/poses";

type Target = NonNullable<PrismSystemSceneMoveState["target"]>;
type Fields = [string, string, string, string, string, string];
export interface Snap {
  mm: number;
  deg: number;
}

const AXES = [
  { name: "X", colour: "text-red-500" },
  { name: "Y", colour: "text-green-500" },
  { name: "Z", colour: "text-blue-500" },
] as const;
const FIELD_KEYS = ["px", "py", "pz", "tx", "ty", "tz"] as const;
const SNAP_MM = [0.1, 0.5, 1, 5] as const;
const SNAP_DEG = [1, 5, 15, 45, 90] as const;

function shown(value: number, places: number): string {
  const text = value.toFixed(places);
  return /^-0\.?0*$/.test(text) ? text.slice(1) : text;
}

/** The six fields for a pose: millimetres to 2 places, degrees to 1. */
export function poseFields(pose: PrismScenePose): Fields {
  return [...pose.translationMm.map((value) => shown(value, 2)), ...eulerDegrees(pose.rotation).map((value) => shown(value, 1))] as Fields;
}

/** The pose the fields describe, or null while one of them is not a number. */
export function fieldsPose(fields: Fields): PrismScenePose | null {
  const values = fields.map((field) => (field.trim() === "" ? Number.NaN : Number(field.replace("−", "-"))));
  if (values.some((value) => !Number.isFinite(value))) return null;
  return { translationMm: [values[0], values[1], values[2]], rotation: rotationFromEuler([values[3], values[4], values[5]]) };
}

const pill = (on: boolean) =>
  `rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-blue-500 text-zinc-100" : "border-white/15 text-zinc-400 hover:text-zinc-100"}`;

/** The next value in a cycle of steps (clicking a snap pill steps through them). */
const next = <T,>(steps: readonly T[], current: T) => steps[(steps.indexOf(current) + 1) % steps.length];

export interface MoveCardProps {
  label: string;
  /** "free board" or "group root": what moving it moves. */
  role: string;
  state: PrismSystemSceneMoveState;
  target: Target;
  snap: Snap;
  busy: boolean;
  onPreview: (pose: PrismScenePose | null) => void;
  onPlace: (pose: PrismScenePose) => void;
  onReset: () => void;
  onCancel: () => void;
  onSpace: (space: "world" | "local") => void;
  onSnap: (snap: Snap) => void;
}

export function MoveCard({ label, role, state, target, snap, busy, onPreview, onPlace, onReset, onCancel, onSpace, onSnap }: MoveCardProps) {
  // What is typed; otherwise the fields follow the view. The host remounts the card
  // (its `key`) when the target changes or a save lands, which drops it.
  const [typed, setTyped] = useState<Fields | null>(null);
  const fields = typed ?? poseFields(target.pose);
  const typedPose = typed ? fieldsPose(typed) : null;

  const edit = (index: number, value: string) => {
    const nextFields = [...fields] as Fields;
    nextFields[index] = value;
    setTyped(nextFields);
    const pose = fieldsPose(nextFields);
    if (pose) onPreview(pose);
  };
  const place = () => {
    const pose = typedPose ?? target.pose;
    setTyped(null);
    onPlace(pose);
  };
  const cancel = () => {
    setTyped(null);
    onCancel();
  };

  const field = (index: number) => {
    const axis = AXES[index % 3];
    return (
      <label key={FIELD_KEYS[index]} className="flex min-w-0 items-center gap-1 rounded-md border border-white/10 bg-zinc-950/60 px-1.5 py-1 focus-within:border-blue-500">
        <b className={`text-[11px] ${axis.colour}`}>{axis.name}</b>
        <input
          aria-label={`${index < 3 ? "Position" : "Turn"} ${axis.name}`}
          className="w-full min-w-0 bg-transparent text-right font-mono text-xs text-zinc-100 outline-none"
          value={fields[index]}
          inputMode="decimal"
          onChange={(event) => edit(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") place();
            if (event.key === "Escape") cancel();
          }}
        />
      </label>
    );
  };

  return (
    <div className="w-[300px] rounded-[10px] border border-white/10 bg-zinc-900/95 p-3 text-zinc-100 shadow-xl" role="group" aria-label={`Move ${label}`}>
      <div className="flex items-baseline gap-2">
        <h4 className="truncate text-[13.5px] font-semibold">Move {label}</h4>
        <span className="text-[11.5px] text-zinc-400">{role} · {state.space}</span>
        {target.unsaved && <span className="ml-auto text-[11px] text-amber-400">not placed</span>}
      </div>
      <div className="mt-2.5 grid grid-cols-[54px_repeat(3,1fr)] items-center gap-1.5 text-xs">
        <span className="text-zinc-400">Position</span>
        {[0, 1, 2].map(field)}
        <span className="text-zinc-400">Turn</span>
        {[3, 4, 5].map(field)}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-zinc-400">
        Snap
        <button type="button" className={pill(true)} title="Step for moves (click for the next)" onClick={() => onSnap({ ...snap, mm: next(SNAP_MM, snap.mm as (typeof SNAP_MM)[number]) })}>{snap.mm} mm</button>
        <button type="button" className={pill(true)} title="Step for turns (click for the next)" onClick={() => onSnap({ ...snap, deg: next(SNAP_DEG, snap.deg as (typeof SNAP_DEG)[number]) })}>{snap.deg}°</button>
        <span className="flex-1" />
        <button type="button" className={pill(state.space === "world")} aria-pressed={state.space === "world"} onClick={() => onSpace("world")}>World</button>
        <button type="button" className={pill(state.space === "local")} aria-pressed={state.space === "local"} onClick={() => onSpace("local")}>Local</button>
      </div>
      <div className="mt-3 flex gap-1.5">
        <button type="button" disabled={busy || (typed !== null && !typedPose)} onClick={place} className="rounded-md border border-blue-500 bg-blue-500 px-2.5 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-50">Place ↵</button>
        <button type="button" disabled={busy} onClick={onReset} className="rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-xs disabled:opacity-50" title="Drop its stored position: it takes its slot in the default row">Reset to default</button>
        <span className="flex-1" />
        <button type="button" onClick={cancel} className="rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-xs">Esc</button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">Drag an arrow or ring, or type: values follow the drag. Hold Shift for fine steps.</p>
    </div>
  );
}
