/**
 * An export's pins (stage 3d-3, §15.4, mockup 05's "Pins of FAN"): its name in
 * the interface and each pin's name, signal and kind. On a body the names are
 * its signals (§8.10); on a board an empty name keeps the board's pin name.
 */
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import { exportLabel, exportPins, pinNameOps, renameExportOps, type Export } from "./export-edits";

/** One editable name: committed on blur or Enter, dropped on Escape. */
function NameField({ value, placeholder, label, disabled, onCommit }: { value: string; placeholder?: string; label: string; disabled: boolean; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      aria-label={label}
      disabled={disabled}
      className="w-full rounded border border-white/10 bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400 disabled:opacity-70"
      value={draft ?? value}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") commit();
        if (event.key === "Escape") setDraft(null);
      }}
    />
  );
}

export function ExportPinsCard({ document, bundle, item, canEdit, send, onClose }: {
  document: SystemDocument;
  bundle: SystemBundle | null | undefined;
  item: Export;
  canEdit: boolean;
  send: (ops: SystemOp[]) => void;
  onClose: () => void;
}) {
  const pins = exportPins(document, bundle, item);
  const body = document.occurrences.find((occurrence) => occurrence.id === item.site.occurrence)?.source.kind === "body";
  const rename = (name: string) => {
    try {
      send(renameExportOps(document, item, name));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <section className="flex max-h-full w-[26rem] flex-col rounded-lg border border-white/10 bg-zinc-900/95 text-sm text-zinc-100 shadow-xl" aria-label={`Pins of ${item.name}`} onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-start gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Pins of {exportLabel(document, item)}</div>
          <div className="text-xs text-zinc-400">
            {body ? "No board nets here: the names you give are the module's signals." : "Names in the published interface; empty keeps the board's pin name."}
          </div>
        </div>
        <button type="button" aria-label="Close" className="text-zinc-400 hover:text-zinc-100" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs">
        <span className="w-20 shrink-0 text-zinc-400">Export name</span>
        <NameField key={item.name} value={item.name} label="Export name" disabled={!canEdit} onCommit={rename} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        <table className="w-full text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1 text-left font-normal">Pad</th>
              <th className="py-1 text-left font-normal">Name</th>
              <th className="py-1 text-left font-normal">Signal</th>
              <th className="py-1 text-left font-normal">Type</th>
            </tr>
          </thead>
          <tbody>
            {pins.map((pin) => (
              <tr key={pin.pad} className="border-t border-white/5">
                <td className="py-1 pr-2 font-mono">{pin.pad}</td>
                <td className="py-1 pr-2">
                  <NameField key={`${pin.pad}:${pin.given}`} value={pin.given} placeholder={pin.boardName || pin.pad} label={`Name of pad ${pin.pad}`} disabled={!canEdit} onCommit={(name) => send(pinNameOps(item, pin.pad, name))} />
                </td>
                <td className="py-1 pr-2 font-mono text-zinc-300">{pin.signal ?? <span className="text-zinc-600">no net</span>}</td>
                <td className="py-1 text-zinc-400">{pin.power ? "power" : "signal"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pins.length === 0 && <p className="py-2 text-xs text-zinc-500">The bundle has no pins for this connector yet.</p>}
      </div>
    </section>
  );
}
