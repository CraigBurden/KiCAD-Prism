import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SystemDocument } from "@/types/system";

import { connectorOptions, type ConnectorOption } from "./connect-dialog";
import { useSystemSession } from "./session/use-system-session";

const endKey = (instanceId: string, portKey: string, subportId: string | null | undefined) =>
  `${instanceId}:${portKey}:${subportId ?? ""}`;

/**
 * SB2-121: the connectors that can still be exported: board and module ports, not an end of a link here,
 * not exported already. Each gets a default name: its reference, or board and reference when the
 * reference alone would clash.
 */
export function exportCandidates(document: SystemDocument): (ConnectorOption & { name: string })[] {
  const kinds = new Map(document.instances.map((instance) => [instance.id, instance.kind ?? "board"]));
  const taken = new Set<string>();
  for (const link of document.links) {
    for (const end of [link.a, link.b]) if (end.port) taken.add(endKey(end.instanceId, end.port.portKey, end.subport?.id));
  }
  for (const entry of document.exports ?? []) {
    if (entry.portKey) taken.add(endKey(entry.instanceId, entry.portKey, entry.subportId));
  }
  const options = connectorOptions(document).filter((option) => ["board", "module"].includes(kinds.get(option.end.instanceId) ?? "")
    && !taken.has(endKey(option.end.instanceId, option.end.portKey ?? "", option.end.subportId)));
  const short = (option: ConnectorOption) => option.label.slice(option.label.lastIndexOf(" ") + 1);
  const used = new Set((document.exports ?? []).map((entry) => entry.name.toLowerCase()));
  const counts = new Map<string, number>();
  for (const option of options) counts.set(short(option).toLowerCase(), (counts.get(short(option).toLowerCase()) ?? 0) + 1);
  return options.map((option) => {
    const name = short(option);
    const clash = (counts.get(name.toLowerCase()) ?? 0) > 1 || used.has(name.toLowerCase());
    return { ...option, name: clash ? option.label : name };
  });
}

interface ExportManyDialogProps {
  document: SystemDocument;
  onClose: () => void;
}

/** SB2-121: tick the connectors to export and name them in one table; one batch call. */
export function ExportManyDialog({ document, onClose }: ExportManyDialogProps) {
  const session = useSystemSession();
  const { edit } = session;
  const busy = session.busy === "export";
  const candidates = useMemo(() => exportCandidates(document), [document]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = candidates.filter((option) => !needle || option.search.includes(needle));
  const nameOf = (option: { key: string; name: string }) => (names[option.key] ?? option.name).trim();
  const picked = candidates.filter((option) => chosen.has(option.key));
  const existing = new Set((document.exports ?? []).map((entry) => entry.name.toLowerCase()));
  const seen = new Map<string, number>();
  for (const option of picked) seen.set(nameOf(option).toLowerCase(), (seen.get(nameOf(option).toLowerCase()) ?? 0) + 1);
  const clash = (option: { key: string; name: string }) => {
    const name = nameOf(option).toLowerCase();
    return !name || existing.has(name) || (seen.get(name) ?? 0) > 1;
  };
  const invalid = picked.some(clash);
  const toggle = (keys: string[], on: boolean) => setChosen((current) => {
    const next = new Set(current);
    for (const key of keys) if (on) next.add(key); else next.delete(key);
    return next;
  });
  const allShown = shown.length > 0 && shown.every((option) => chosen.has(option.key));

  const submit = async () => {
    const items = picked.map((option) => ({ name: nameOf(option), description: "", instanceId: option.end.instanceId,
      portKey: option.end.portKey ?? "", ...(option.end.subportId ? { subportId: option.end.subportId } : {}) }));
    const done = await edit("export", (system) => system.createExports(items),
      `Exported ${items.length} ${items.length === 1 ? "connector" : "connectors"}`);
    if (done) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export connectors</DialogTitle>
          <DialogDescription className="sr-only">Pick connectors to export and name them</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Checkbox aria-label="Select all shown" checked={allShown} disabled={!shown.length}
            onCheckedChange={(checked) => toggle(shown.map((option) => option.key), checked === true)} />
          <Input aria-label="Find a connector" placeholder="Board, connector or MPN" value={query}
            className="h-8 text-xs" onChange={(event) => setQuery(event.target.value)} />
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{picked.length} / {candidates.length}</span>
        </div>
        <ul aria-label="Connectors" className="min-h-0 flex-1 overflow-auto rounded border text-sm">
          {shown.length === 0 && <li className="px-2 py-1.5 text-muted-foreground">None</li>}
          {shown.map((option) => {
            const on = chosen.has(option.key);
            return (
              <li key={option.key} className="flex h-9 items-center gap-2 border-b px-2 last:border-b-0">
                <Checkbox aria-label={`Export ${option.label}`} checked={on} onCheckedChange={(checked) => toggle([option.key], checked === true)} />
                <span className="w-40 shrink-0 truncate" title={option.label}>{option.label}</span>
                <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{option.pins}p</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={option.value}>{option.value}</span>
                <Input aria-label={`Name for ${option.label}`} value={names[option.key] ?? option.name} maxLength={100} disabled={!on}
                  aria-invalid={on && clash(option)}
                  className={on && clash(option) ? "h-7 w-40 shrink-0 border-destructive text-xs" : "h-7 w-40 shrink-0 text-xs"}
                  onChange={(event) => setNames((current) => ({ ...current, [option.key]: event.target.value }))} />
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          {invalid && <span className="mr-auto self-center text-xs text-destructive">Names must be unique</span>}
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={busy || !picked.length || invalid} onClick={() => void submit()}>
            {busy ? "Exporting…" : `Export ${picked.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
