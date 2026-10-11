import { useEffect, useState } from "react";
import { Link2, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSubport, updateSubport } from "@/lib/systems-api";
import { cn } from "@/lib/utils";
import type { Subport, SubportMove, SystemDocument, SystemInstance, SystemPort } from "@/types/system";

import { exportForPort } from "./exports-section";
import { comparePads } from "./pads";
import { subportLabel } from "./subport-model";
import { sessionReads } from "./session/session-reads";
import { useSessionRead, useSystemSession } from "./session/use-system-session";

/** "1–3, 15": consecutive numeric pads as ranges. */
export function padRanges(pads: readonly string[]): string {
  const out: string[] = [];
  let start: string | null = null;
  let previous: string | null = null;
  const flush = () => {
    if (start === null) return;
    out.push(start === previous ? start : `${start}–${previous}`);
  };
  for (const pad of [...pads].sort(comparePads)) {
    const next = previous !== null && /^\d+$/.test(pad) && /^\d+$/.test(previous) && Number(pad) === Number(previous) + 1;
    if (!next) {
      flush();
      start = pad;
    }
    previous = pad;
  }
  flush();
  return out.join(", ");
}

/** What a change does to rows, one line per move (CONTRACTS_P2 §22.3). */
export function moveLines(document: SystemDocument, moves: readonly SubportMove[]): string[] {
  const names = new Map(document.links.map((link) => [link.id, link.name || link.id]));
  return moves.map((move) => {
    const rows = `${move.rowIds.length} ${move.rowIds.length === 1 ? "row" : "rows"}`;
    return move.action === "split"
      ? `${rows} of ${names.get(move.linkId)} → new link ${move.newLinkName || "(unnamed)"}`
      : `${names.get(move.linkId)} moves with its ${rows}`;
  });
}

interface RowsProps {
  document: SystemDocument;
  instance: SystemInstance;
  port: SystemPort;
  subports: Subport[];
  editable: boolean;
  onEdit: (subport: Subport) => void;
  onExport: (subport: Subport) => void;
}

/** A split connector's sub-ports, under its row in the Ports list. */
export function SubportRows({ document, instance, port, subports, editable, onEdit, onExport }: RowsProps) {
  const { busy, edit } = useSystemSession();
  const [removing, setRemoving] = useState<{ subport: Subport; lines: string[] } | null>(null);
  const linked = new Set<string>();
  for (const link of document.links) {
    for (const end of [link.a, link.b]) {
      if (end.instanceId === instance.id && end.subport) linked.add(end.subport.id);
    }
  }

  const askRemove = async (subport: Subport) => {
    const preview = await edit("subport-preview", (system) => system.deleteSubport(instance.id, subport.id, true));
    if (preview) setRemoving({ subport, lines: moveLines(document, preview.body.moves) });
  };

  return (
    <>
      {subports.map((subport) => {
        const label = subportLabel(port.reference, subport.name);
        const exported = exportForPort(document, instance.id, port.portKey, subport.id);
        const isLinked = linked.has(subport.id);
        return (
          <li key={subport.id} className="flex h-8 items-center gap-2 border-b pl-4 last:border-b-0">
            <span className="w-24 shrink-0 truncate font-mono text-xs font-medium">{label}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{padRanges(subport.pads ?? [])}</span>
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
              {isLinked && <Link2 className="size-3.5" aria-label="linked" />}
              {exported && <Share2 className="size-3.5" aria-label={`exported as ${exported.name}`} />}
            </span>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{subport.pads?.length ?? ""}</span>
            {editable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`Actions for ${label}`} disabled={busy !== null}>
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!isLinked && !exported && (
                    <DropdownMenuItem onSelect={() => onExport(subport)}><Share2 className="mr-2 h-4 w-4" /> Export</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => onEdit(subport)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                  <DropdownMenuItem disabled={Boolean(exported)} onSelect={() => void askRemove(subport)}>
                    <Trash2 className="mr-2 h-4 w-4" /> {exported ? "Remove (exported)" : "Remove"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        );
      })}
      {removing && (
        <ConfirmDialog open onOpenChange={(open) => !open && setRemoving(null)}
          title={`Remove ${subportLabel(port.reference, removing.subport.name)}?`}
          description={removing.lines.length ? <MoveList lines={removing.lines} /> : `Its pads return to ${port.reference}.`}
          confirmLabel="Remove" destructive busy={busy === "subport"}
          onConfirm={() => void edit("subport", (system) => system.deleteSubport(instance.id, removing.subport.id),
            `${subportLabel(port.reference, removing.subport.name)} removed`).then((done) => done && setRemoving(null))} />
      )}
    </>
  );
}

function MoveList({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-0.5 text-xs">
      {lines.map((line) => <li key={line} className="truncate">{line}</li>)}
    </ul>
  );
}

interface DialogProps {
  systemId: string;
  document: SystemDocument;
  instance: SystemInstance;
  port: SystemPort;
  /** Set when editing; absent when splitting. */
  subport?: Subport;
  others: Subport[];
  onClose: () => void;
}

/** The connector's pads, from its interface; 1..pinCount when it cannot be read. */
function usePads(instance: SystemInstance, port: SystemPort): string[] {
  const read = useSessionRead(sessionReads.instanceInterface(instance.id, instance.baselineCommit, instance.interface?.status ?? null)).data;
  const component = read?.state === "ready" ? read.body.components.find((c) => c.portKey === port.portKey) : undefined;
  return component ? component.pins.map((pin) => String(pin.pad)).sort(comparePads) : Array.from({ length: port.pinCount }, (_, index) => String(index + 1));
}

/** Split a connector into a named sub-port, or edit one: name, pads, and the row moves it makes. */
export function SubportDialog({ systemId, document, instance, port, subport, others, onClose }: DialogProps) {
  const { busy, edit } = useSystemSession();
  const pads = usePads(instance, port);
  const [name, setName] = useState(subport?.name ?? "");
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(subport?.pads ?? []));
  const [preview, setPreview] = useState<{ lines: string[]; error: string | null } | null>(null);
  const taken = new Map(others.flatMap((other) => (other.pads ?? []).map((pad) => [pad, other.name] as const)));
  const selected = pads.filter((pad) => chosen.has(pad));
  const body = { name: name.trim(), pads: selected };
  const request = JSON.stringify(body);
  const subportId = subport?.id;

  // The server's own checks and row moves for what is chosen so far (`?preview=true` writes nothing).
  useEffect(() => {
    const wanted = JSON.parse(request) as { name: string; pads: string[] };
    if (!wanted.name || !wanted.pads.length) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      // A preview writes nothing and sends no ETag.
      const call = subportId
        ? updateSubport(systemId, "", instance.id, subportId, wanted, true)
        : createSubport(systemId, "", instance.id, { portKey: port.portKey, ...wanted }, true);
      call.then((result) => !cancelled && setPreview({ lines: moveLines(document, result.body.moves), error: null }))
        .catch((error: unknown) => !cancelled && setPreview({ lines: [], error: error instanceof Error ? error.message : "Not valid" }));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [request, document, systemId, instance.id, port.portKey, subportId]);

  const toggle = (pad: string) => setChosen((current) => {
    const next = new Set(current);
    if (next.has(pad)) next.delete(pad); else next.add(pad);
    return next;
  });
  const save = async () => {
    const done = subport
      ? await edit("subport", (system) => system.updateSubport(instance.id, subport.id, body), `${subportLabel(port.reference, body.name)} saved`)
      : await edit("subport", (system) => system.createSubport(instance.id, { portKey: port.portKey, ...body }),
        `${subportLabel(port.reference, body.name)} split off`);
    if (done) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{subport ? `Edit ${subportLabel(port.reference, subport.name)}` : `Split ${instance.label} ${port.reference}`}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="subport-name">Name</Label>
            <div className="flex items-center gap-1">
              <span className="font-mono text-sm text-muted-foreground">{port.reference}.</span>
              <Input id="subport-name" value={name} maxLength={32} placeholder="PWR" className="font-mono"
                onChange={(event) => setName(event.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Pads <span className="font-normal text-muted-foreground">· {selected.length ? padRanges(selected) : "none"}</span></Label>
            <div role="group" aria-label="Pads" className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">
              {pads.map((pad) => {
                const owner = taken.get(pad);
                return (
                  <button key={pad} type="button" aria-pressed={chosen.has(pad)} disabled={Boolean(owner)}
                    title={owner ? `In ${subportLabel(port.reference, owner)}` : undefined} onClick={() => toggle(pad)}
                    className={cn("h-7 min-w-8 rounded border px-1.5 font-mono text-xs disabled:opacity-40",
                      chosen.has(pad) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>
                    {pad}
                  </button>
                );
              })}
            </div>
          </div>
          {preview?.error && <p className="text-xs text-destructive">{preview.error}</p>}
          {preview && !preview.error && preview.lines.length > 0 && <MoveList lines={preview.lines} />}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!body.name || !body.pads.length || Boolean(preview?.error) || busy !== null} onClick={() => void save()}>
            {subport ? "Save" : "Split"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
