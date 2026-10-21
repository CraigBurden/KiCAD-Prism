/**
 * The harness tab's toolbar (CONTRACTS §16.5, mockup 09): the part buttons with
 * their keys, the view toggles, auto-layout, and the wire list, BOM, outputs and
 * findings dialogs.
 */
import { FileDown } from "lucide-react";

import type { InsertKind } from "./harness-canvas";

export type HarnessDialog = "wires" | "bom" | "findings" | "outputs";

interface Props {
  canEdit: boolean;
  busy: boolean;
  xray: boolean;
  labels: boolean;
  findings: number;
  onInsert: (kind: InsertKind) => void;
  onCable: () => void;
  onCovering: () => void;
  onMarker: () => void;
  onAutoLayout: () => void;
  onToggleXray: () => void;
  onToggleLabels: () => void;
  onNewPart: () => void;
  onOpen: (dialog: HarnessDialog) => void;
  /** Open the Route tool's 3D tab beside this harness (mockup 10). */
  onRouteIn3D?: () => void;
}

const item = "flex shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-35";
const activeItem = "flex shrink-0 items-center gap-1.5 rounded-md border border-cyan-800 bg-[#0c2a3d] px-2 py-1 text-xs text-zinc-100 hover:bg-[#0e3247]";

function Hint({ children }: { children: string }) {
  return <span className="rounded border border-white/15 px-1 text-[10px] font-semibold text-zinc-400">{children}</span>;
}

function KeyButton({ hint, label, disabled, onClick }: { hint: string; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={item} disabled={disabled} onClick={onClick}>
      <Hint>{hint}</Hint>
      {label}
    </button>
  );
}

export function HarnessToolbar({
  canEdit,
  busy,
  xray,
  labels,
  findings,
  onInsert,
  onCable,
  onCovering,
  onMarker,
  onAutoLayout,
  onToggleXray,
  onToggleLabels,
  onNewPart,
  onOpen,
  onRouteIn3D,
}: Props) {
  const edit = canEdit && !busy;
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-white/10 bg-[#050c1c] px-3" role="toolbar" aria-label="Harness tools">
      <KeyButton hint="P" label="Pigtail" disabled={!edit} onClick={() => onInsert("pigtail")} />
      <KeyButton hint="S" label="Splice" disabled={!edit} onClick={() => onInsert("splice")} />
      <KeyButton hint="A" label="Cable" disabled={!edit} onClick={onCable} />
      <KeyButton hint="B" label="Covering" disabled={!edit} onClick={onCovering} />
      <KeyButton hint="J" label="Branch point" disabled={!edit} onClick={() => onInsert("branch")} />
      <KeyButton hint="M" label="Marker" disabled={!edit} onClick={onMarker} />
      <button type="button" className={item} disabled={!edit} onClick={onNewPart}>
        ＋ Part…
      </button>
      <span className="mx-1.5 h-[22px] w-px bg-white/10" />
      <button type="button" className={xray ? activeItem : item} aria-pressed={xray} onClick={onToggleXray}>
        <Hint>X</Hint>
        X-ray
      </button>
      <button type="button" className={labels ? activeItem : item} aria-pressed={labels} onClick={onToggleLabels}>
        <Hint>L</Hint>
        Labels
      </button>
      <button type="button" className={item} disabled={!edit} onClick={onAutoLayout}>
        Auto-layout
      </button>
      {onRouteIn3D && (
        <button type="button" className={item} onClick={onRouteIn3D}>
          Route in 3D
        </button>
      )}
      <span className="flex-1" />
      <button type="button" className={item} onClick={() => onOpen("wires")}>
        Wires
      </button>
      <button type="button" className={item} onClick={() => onOpen("bom")}>
        BOM
      </button>
      <button type="button" className={item} onClick={() => onOpen("outputs")}>
        <FileDown className="h-3.5 w-3.5" />
        Outputs
      </button>
      <button type="button" className={item} onClick={() => onOpen("findings")}>
        Findings
        {findings > 0 && <span className="rounded-full bg-[#3b2a0a] px-1.5 text-[10.5px] text-amber-400">{findings}</span>}
      </button>
    </div>
  );
}
