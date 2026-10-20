import { useState } from "react";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";

import type { SubPort, SystemOp } from "../model/types";
import { acceptOps, dismissOps, removeSubPortOps, renameSubPortOps } from "./board-edits";
import { describeSubPorts, type BoardConnector } from "./board-scene";

interface Props {
  occurrence: string;
  connectors: BoardConnector[];
  canEdit: boolean;
  send: (ops: SystemOp[]) => void;
  onToggleUnfold: (refdes: string) => void;
  onSelectSubPort: (subPort: SubPort) => void;
}

function SubPortChip({ subPort, members, canEdit, send, onSelect }: { subPort: SubPort; members: string[]; canEdit: boolean; send: Props["send"]; onSelect: () => void }) {
  // The draft name while renaming; null when not.
  const [draft, setDraft] = useState<string | null>(null);
  const rename = () => {
    const name = (draft ?? "").trim();
    setDraft(null);
    if (name && name !== subPort.name) send(renameSubPortOps(subPort, name));
  };
  return (
    <div className="flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[11px]">
      {draft !== null ? (
        <input
          autoFocus
          aria-label="Sub-port name"
          className="w-24 bg-transparent outline-none"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={rename}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") rename();
            if (event.key === "Escape") setDraft(null);
          }}
        />
      ) : (
        <button type="button" className="text-sky-200" onClick={onSelect} onDoubleClick={() => canEdit && setDraft(subPort.name)} title="Select its wires; double-click to rename">
          {subPort.name}
          <span className="text-zinc-400">{`{${members.join(" ")}}`}</span>
        </button>
      )}
      {canEdit && (
        <button type="button" aria-label={`Remove ${subPort.name}`} className="text-zinc-400 hover:text-zinc-100" onClick={() => send(removeSubPortOps([subPort.id]))}>
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** Sub-ports and suggestions per connector, for bulk work (the mockup's side list). */
export function BoardSidePanel({ occurrence, connectors, canEdit, send, onToggleUnfold, onSelectSubPort }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (refdes: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(refdes)) next.delete(refdes);
      else next.add(refdes);
      return next;
    });
  const suggested = connectors.reduce((sum, connector) => sum + connector.suggestions.length, 0);
  return (
    <div className="flex max-h-full w-80 flex-col rounded-lg border border-white/10 bg-zinc-900/95 text-sm text-zinc-100 shadow-xl" onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="font-medium">Sub-ports</span>
        <span className="text-xs text-zinc-400">{suggested} suggested</span>
        <span className="flex-1" />
        {canEdit && suggested > 0 && (
          <button type="button" className="text-xs text-sky-300 hover:underline" onClick={() => send(acceptOps(occurrence, connectors.flatMap((item) => item.suggestions)))}>
            Accept all
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {connectors.map((connector) => {
          const expanded = open.has(connector.refdes);
          const groups = describeSubPorts(connector);
          return (
            <div key={connector.refdes} className="border-b border-white/5 px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <button type="button" aria-label={`${expanded ? "Collapse" : "Expand"} ${connector.refdes}`} onClick={() => toggle(connector.refdes)} className="text-zinc-400">
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <button type="button" className="font-medium" onClick={() => onToggleUnfold(connector.refdes)} title={connector.unfolded ? "Fold" : "Unfold"}>
                  {connector.refdes}
                </button>
                <span className="truncate text-xs text-zinc-400">{connector.detail}</span>
                <span className="flex-1" />
                {connector.suggestions.length > 0 && <span className="text-xs text-zinc-400">{connector.suggestions.length} suggested</span>}
              </div>
              {groups.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 pl-5">
                  {groups.map(({ subPort, members }) => (
                    <SubPortChip key={subPort.id} subPort={subPort} members={members} canEdit={canEdit} send={send} onSelect={() => onSelectSubPort(subPort)} />
                  ))}
                </div>
              )}
              {expanded && connector.suggestions.length > 0 && (
                <ul className="mt-1 space-y-0.5 pl-5 text-xs">
                  {canEdit && (
                    <li>
                      <button type="button" className="text-sky-300 hover:underline" onClick={() => send(acceptOps(occurrence, connector.suggestions))}>Accept all on {connector.refdes}</button>
                    </li>
                  )}
                  {connector.suggestions.map((suggestion) => (
                    <li key={suggestion.key} className="flex items-center gap-1.5 text-zinc-300">
                      <span className="font-mono">{suggestion.name}</span>
                      <span className="truncate text-zinc-500">{`{${suggestion.pins.join(" ")}}`} · {suggestion.source}</span>
                      <span className="flex-1" />
                      {canEdit && (
                        <>
                          <button type="button" aria-label={`Accept ${suggestion.name}`} className="text-emerald-300" onClick={() => send(acceptOps(occurrence, [suggestion]))}><Check className="h-3.5 w-3.5" /></button>
                          <button type="button" aria-label={`Dismiss ${suggestion.name}`} className="text-zinc-400" onClick={() => send(dismissOps(suggestion))}><X className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
