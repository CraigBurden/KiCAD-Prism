import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { BundlePin } from "../model/types";
import { proposeGroup } from "./grouping";

interface Props {
  connector: string;
  /** The selected pads, in the order they will be stored. */
  pins: Pick<BundlePin, "pad" | "net">[];
  refusal: (name: string) => string | null;
  onGroup: (name: string, fold: boolean) => void;
  onCancel: () => void;
}

/**
 * G (§14.3): name the selected wires as a sub-port. The name and members are
 * proposed from the nets; the name is editable. Mounted per selection.
 */
export function GroupPopover({ connector, pins, refusal, onGroup, onCancel }: Props) {
  const proposed = proposeGroup(pins);
  const [name, setName] = useState(proposed.name);
  const problem = refusal(name);
  const submit = (fold: boolean) => {
    if (!problem) onGroup(name.trim(), fold);
  };
  return (
    <dialog
      open
      className="static m-0 block w-80 space-y-2 rounded-lg border border-white/10 bg-zinc-900/95 p-3 text-sm text-zinc-100 shadow-xl"
      aria-label="Group as a sub-port"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") onCancel();
      }}
    >
      <div className="font-medium">
        Group {pins.length} {pins.length === 1 ? "wire" : "wires"} on {connector} <kbd className="ml-1 rounded border border-white/20 px-1 text-[11px]">G</kbd>
      </div>
      <Input
        autoFocus
        value={name}
        aria-label="Sub-port name"
        className="h-8 border-white/20 bg-transparent"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit(event.shiftKey);
        }}
      />
      <div className="max-h-32 overflow-y-auto font-mono text-[11px] text-zinc-300">
        {pins.map((pin, index) => (
          <div key={pin.pad}>
            {pin.pad} · {pin.net ?? "no net"} → <span className="text-sky-300">{proposed.members[index]}</span>
          </div>
        ))}
      </div>
      <div className="font-mono text-[11px] text-zinc-400">
        {name.trim() || "…"}{`{${proposed.members.join(" ")}}`}
      </div>
      {problem && <p className="text-xs text-amber-300" role="alert">{problem}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => submit(false)} disabled={Boolean(problem)}>Group ↵</Button>
        <Button size="sm" variant="secondary" onClick={() => submit(true)} disabled={Boolean(problem)} title="Shift+Enter">Group and fold</Button>
        <Button size="sm" variant="ghost" className="text-zinc-300" onClick={onCancel}>Esc</Button>
      </div>
    </dialog>
  );
}
