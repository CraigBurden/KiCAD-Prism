import { useState } from "react";
import { Cable, MoreHorizontal, Pencil, Plus, Trash2, Unlink, Wand2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WireInput } from "@/lib/systems-api";
import type { Finding, GeneratorKind, HarnessEnd, SystemDocument, SystemHarness } from "@/types/system";

import { endLabel, endWireCount } from "./diagram-model";
import { findingsOf } from "./findings";
import { FindingsAlert } from "./findings-ui";
import { comparePads } from "./pads";
import { sessionReads } from "./session/session-reads";
import { useSessionRead, useSystemSession } from "./session/use-system-session";
import { WireTable } from "./wire-table";
import { useDraftGuard } from "./draft-guard";
import { HarnessOutputsSection } from "./harness-outputs-section";
import { PartDialog, partText } from "./harness-part-dialog";
import { PinnedHousingConvert } from "./pinned-model";

/** A wire being edited: `key` is stable across edits; `id` is kept for existing wires. */
export interface DraftWire extends WireInput {
  key: string;
}

let draftCounter = 0;
const newKey = () => `new-${(draftCounter += 1)}`;

/** Wires in end order then pin order; a draft keeps this order while it is edited, so rows never jump. */
export function draftFromHarness(harness: SystemHarness): DraftWire[] {
  const ordinal = new Map(harness.ends.map((end) => [end.id, end.ordinal]));
  const sorted = [...harness.wires].sort((x, y) => (ordinal.get(x.from.end) ?? 0) - (ordinal.get(y.from.end) ?? 0)
    || comparePads(x.from.pin, y.from.pin) || (ordinal.get(x.to.end) ?? 0) - (ordinal.get(y.to.end) ?? 0)
    || comparePads(x.to.pin, y.to.pin));
  return sorted.map((wire) => ({
    key: wire.id, id: wire.id, from: { ...wire.from }, to: { ...wire.to }, signal: wire.signal,
    gaugeAwg: wire.gaugeAwg, colour: wire.colour, label: wire.label,
  }));
}

/** Problems the server would refuse, shown before saving (§17.2). */
export function wireProblems(draft: DraftWire[], harness: SystemHarness): Map<string, string> {
  const pins = new Map(harness.ends.map((end) => [end.id, new Set(end.pins)]));
  const problems = new Map<string, string>();
  for (const wire of draft) {
    const { from, to } = wire;
    if (!from.end || !to.end || !from.pin || !to.pin) problems.set(wire.key, "Choose both ends and pins.");
    else if (from.end === to.end) problems.set(wire.key, "A wire joins two different ends.");
    else if (!pins.get(from.end)?.has(from.pin) || !pins.get(to.end)?.has(to.pin)) {
      problems.set(wire.key, "That pin does not exist on the end.");
    }
  }
  return problems;
}

/** End pins carrying more than one wire: splices (allowed, shown for review). */
export function splices(draft: DraftWire[]): Set<string> {
  const counts = new Map<string, number>();
  for (const wire of draft) {
    for (const point of [wire.from, wire.to]) {
      const key = `${point.end}#${point.pin}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const spliced = new Set<string>();
  for (const [key, count] of counts) if (count > 1) spliced.add(key);
  return spliced;
}

/** SB2-102: how many wires the draft adds, removes or changes against the harness's own. */
export function changedWireCount(draft: DraftWire[], harness: SystemHarness): number {
  const before = new Map(draftFromHarness(harness).map((wire) => [wire.key, JSON.stringify(toInput(wire))]));
  const kept = new Set<string>();
  let changed = 0;
  for (const wire of draft) {
    const old = wire.id ? before.get(wire.id) : undefined;
    if (old !== undefined) kept.add(wire.id!);
    if (old === undefined || old !== JSON.stringify(toInput(wire))) changed += 1;
  }
  return changed + [...before.keys()].filter((key) => !kept.has(key)).length;
}

function toInput(wire: DraftWire): WireInput {
  return { id: wire.id, from: wire.from, to: wire.to, signal: wire.signal ?? "", gaugeAwg: wire.gaugeAwg ?? null,
    colour: wire.colour || null, label: wire.label || null };
}

interface HarnessEditorProps {
  systemId: string;
  document: SystemDocument;
  harness: SystemHarness;
  canEdit: boolean;
  /** The reader may write the catalog: Convert a housing part's pinned models (§18.2). */
  canConvertModels?: boolean;
  findings: Finding[];
  onDeleted: () => void;
  onConverted: (linkId: string) => void;
}

/**
 * An end's mating block: Generic or a catalog part (§17.2), with the catalog partners of the mated
 * connector as suggestions (§18). A part is only assigned when the user picks one.
 */
function MatingBlock({ harnessId, end, editable, canConvertModels }: {
  harnessId: string; end: HarnessEnd; editable: boolean; canConvertModels: boolean;
}) {
  const session = useSystemSession();
  const { edit } = session;
  const busy = session.busy !== null;
  const [picking, setPicking] = useState<"part" | "contact" | null>(null);
  const lookup = Boolean(end.mates && !end.mates.redacted);
  const body = useSessionRead(lookup ? sessionReads.endSuggestions(harnessId, end.id) : null).data ?? null;
  const suggestions = body?.suggestions ?? [];
  const hint = end.part || !body ? null : suggestions.length
    ? `Mates with ${suggestions.map((part) => part.mpn || part.name).join(", ")}`
    : body.connectorPart ? `No mating part recorded for ${body.connectorPart.mpn}` : null;
  const assign = (part: { componentId: string } | null, done: string) =>
    edit("harness", (system) => system.updateHarnessEnd(harnessId, end.id, { part }), done);
  const setContact = (contact: { componentId: string } | null, done: string) =>
    edit("harness", (system) => system.updateHarnessEnd(harnessId, end.id, { contact }), done);
  return (
    <>
      <span data-testid="mating-block">
        {end.part ? `${end.part.mpn || end.part.name ? partText(end.part) : "Catalog part"} · ${end.pinCount} pins` : `Generic · ${end.pinCount} pins`}
      </span>
      {hint && <span className="block text-xs text-muted-foreground" data-testid="end-suggestion">{hint}</span>}
      {end.part && (
        <PinnedHousingConvert componentId={end.part.componentId} revisionId={end.part.revisionId} canConvert={canConvertModels} />
      )}
      {editable && (
        <span className="mt-1 flex flex-wrap gap-x-2 text-xs">
          <button type="button" className="whitespace-nowrap underline-offset-2 hover:underline" disabled={busy} onClick={() => setPicking("part")}>
            {end.part ? "Change part" : "Choose part"}
          </button>
          {end.part && (
            <button type="button" className="whitespace-nowrap underline-offset-2 hover:underline" disabled={busy}
              onClick={() => void assign(null, "End made Generic")}>Make generic</button>
          )}
        </span>
      )}
      {(end.contact || editable) && (
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs" data-testid="end-contact">
          <span className="truncate text-muted-foreground">Contact {end.contact ? partText(end.contact) : "—"}</span>
          {editable && (
            <button type="button" className="whitespace-nowrap underline-offset-2 hover:underline" disabled={busy}
              onClick={() => setPicking("contact")}>{end.contact ? "Change" : "Choose"}</button>
          )}
          {editable && end.contact && (
            <button type="button" className="whitespace-nowrap underline-offset-2 hover:underline" disabled={busy}
              onClick={() => void setContact(null, "Contact removed")}>Clear</button>
          )}
        </span>
      )}
      {picking === "part" && (
        <PartDialog title={`${endLabel(end)} mating part`} current={end.part?.componentId}
          description="The part's pins become the end's pins. Map them onto the connector's pads where the names differ."
          suggestions={suggestions} busy={busy} onClose={() => setPicking(null)}
          onPick={(part) => assign({ componentId: part.componentId }, `${part.mpn || part.name} assigned`)} />
      )}
      {picking === "contact" && (
        <PartDialog title={`${endLabel(end)} contact`} current={end.contact?.componentId} busy={busy}
          onClose={() => setPicking(null)}
          onPick={(part) => setContact({ componentId: part.componentId }, `${part.mpn || part.name} contact set`)} />
      )}
    </>
  );
}

function matesText(document: SystemDocument, end: HarnessEnd): string {
  if (!end.mates) return "Not mated";
  if (end.mates.redacted || !end.mates.port) return "Restricted board";
  const label = document.instances.find((instance) => instance.id === end.mates!.instanceId)?.label ?? "?";
  return `${label} ${end.mates.port.reference}`;
}


function PinMapDialog({ end, pads, busy, onClose, onSave }: {
  end: HarnessEnd; pads: string[]; busy: boolean; onClose: () => void;
  onSave: (pinMap: Record<string, string> | null) => Promise<unknown>;
}) {
  const [map, setMap] = useState<Record<string, string>>({ ...(end.pinMap ?? {}) });
  const targets = Object.values(map);
  const clash = new Set(targets.filter((pad, index) => targets.indexOf(pad) !== index));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{endLabel(end)} pin map</DialogTitle>
          <DialogDescription>
            Each end pin lands on the connector pad of the same name unless you map it elsewhere.
            {end.part && " Every wired pin of the part must land on a pad (SYS-V19)."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[4rem_1fr] items-center gap-2 text-sm">
          {end.pins.map((pin) => (
            <div key={pin} className="contents">
              <span className="font-mono">{pin}</span>
              <Select value={map[pin] ?? pin} onValueChange={(pad) => setMap((current) => {
                const next = { ...current };
                if (pad === pin) delete next[pin]; else next[pin] = pad;
                return next;
              })}>
                <SelectTrigger aria-label={`Pad for end pin ${pin}`} className={`h-8 ${clash.has(map[pin]) ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="No pad of this name" />
                </SelectTrigger>
                <SelectContent>{pads.map((pad) => <SelectItem key={pad} value={pad}>{pad === pin ? `${pad} (same)` : pad}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
        </div>
        {clash.size > 0 && <p className="text-xs text-destructive">Each connector pad takes one end pin.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || clash.size > 0} onClick={async () => {
            await onSave(Object.keys(map).length ? map : null);
            onClose();
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailsDialog({ harness, busy, onClose, onSave }: {
  harness: SystemHarness; busy: boolean; onClose: () => void;
  onSave: (fields: { name: string; label: string | null; cutLengthMm: number | null }) => Promise<unknown>;
}) {
  const [name, setName] = useState(harness.name);
  const [label, setLabel] = useState(harness.label ?? "");
  const [cut, setCut] = useState(harness.cutLengthMm ? String(harness.cutLengthMm) : "");
  const cutValue = cut.trim() ? Number(cut) : null;
  const invalid = !name.trim() || (cutValue !== null && !(cutValue > 0));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Harness details</DialogTitle>
          <DialogDescription>The label is the drawing or part number the cable is built to.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={async (event) => {
          event.preventDefault();
          await onSave({ name: name.trim(), label: label.trim() || null, cutLengthMm: cutValue });
          onClose();
        }}>
          <div className="grid gap-2"><Label htmlFor="harness-name">Name</Label>
            <Input id="harness-name" value={name} maxLength={200} onChange={(event) => setName(event.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="harness-label">Label</Label>
            <Input id="harness-label" value={label} maxLength={200} placeholder="e.g. WH-003" onChange={(event) => setLabel(event.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="harness-cut">Cut length (mm)</Label>
            <Input id="harness-cut" inputMode="decimal" value={cut} placeholder="Optional" onChange={(event) => setCut(event.target.value)} />
            {harness.lengths && (
              <p className="text-xs text-muted-foreground">
                Estimated {harness.lengths.estimatedMm} mm from the 3D route ({harness.lengths.allowancePct} % allowance);
                a cut length more than 15 % away is flagged.
              </p>
            )}</div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || invalid}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function HarnessEditor({ systemId, document, harness, canEdit, canConvertModels = false, findings, onDeleted,
  onConverted }: HarnessEditorProps) {
  const { busy, edit } = useSystemSession();
  const [draft, setDraft] = useState<DraftWire[] | null>(null);
  // SB2-102: the wires before the last save, for one level of Undo; dropped on the next edit.
  const [undo, setUndo] = useState<{ harnessId: string; wires: WireInput[] } | null>(null);
  const changed = draft ? changedWireCount(draft, harness) : 0;
  useDraftGuard(changed > 0);
  const [dialog, setDialog] = useState<"details" | "delete" | { pinMap: string } | null>(null);
  const [pair, setPair] = useState<{ from: string; to: string; generator: GeneratorKind }>(
    { from: harness.ends[0]?.id ?? "", to: harness.ends[1]?.id ?? "", generator: "identity" });
  const editable = canEdit && !harness.ends.some((end) => end.mates?.redacted);
  const wires = draft ?? draftFromHarness(harness);
  const problems = wireProblems(wires, harness);
  const spliced = splices(wires);
  const own = findingsOf(findings).harness(harness.id);
  const isBusy = busy !== null;

  const editDraft = (update: (rows: DraftWire[]) => DraftWire[]) => {
    setUndo(null);
    setDraft((current) => update(current ?? draftFromHarness(harness)));
  };
  const save = async () => {
    if (!draft) return;
    const before = draftFromHarness(harness).map(toInput);
    const done = await edit("wires", (system) => system.replaceWires(harness.id, draft.map(toInput)), "Wires saved");
    if (done) {
      setDraft(null);
      setUndo({ harnessId: harness.id, wires: before });
    }
  };
  const undoSave = async () => {
    if (!undo) return;
    const done = await edit("wires", (system) => system.replaceWires(undo.harnessId, undo.wires), "Wires restored");
    if (done) setUndo(null);
  };
  const generate = async () => {
    const proposal = await edit("generate", (system) => system.generateWires(harness.id,
      { fromEnd: pair.from, toEnd: pair.to, generator: pair.generator }));
    if (proposal) editDraft((rows) => [...rows, ...proposal.wires.map((wire) => ({ ...wire, key: newKey() }))]);
  };
  const pinMapEnd = typeof dialog === "object" && dialog ? harness.ends.find((end) => end.id === dialog.pinMap) : undefined;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 truncate text-lg font-semibold"><Cable className="h-5 w-5" /> {harness.name}</h2>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{harness.ends.length} ends · {harness.wires.length} wires</span>
            {harness.label && <Badge variant="outline">{harness.label}</Badge>}
            {harness.cutLengthMm && <span>· cut {harness.cutLengthMm} mm</span>}
            {harness.lengths && (
              <span title={`Bundle ${harness.lengths.bundleMm} mm as the 3D view routes it, plus ${harness.lengths.allowancePct} % allowance`}>
                · estimated {harness.lengths.estimatedMm} mm{harness.lengths.complete ? "" : " (ends not all placed)"}
              </span>
            )}
          </p>
        </div>
        {editable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Harness actions"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setDialog("details")}><Pencil className="mr-2 h-4 w-4" /> Edit details</DropdownMenuItem>
              <DropdownMenuItem disabled={!harness.linkable}
                onSelect={() => void edit("harness", (system) => system.harnessToLink(harness.id), "Converted to a link")
                  .then((done) => done && onConverted(done.body.id))}>
                <Unlink className="mr-2 h-4 w-4" /> Convert to a link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDialog("delete")}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete harness
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <FindingsAlert findings={own} />

      <section className="space-y-2" aria-label="Ends">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Ends</h3>
          {editable && (
            <Button variant="outline" size="sm" disabled={isBusy}
              onClick={() => void edit("harness", (system) => system.addHarnessEnd(harness.id, { pinCount: 2 }), "Generic end added")}>
              <Plus className="mr-1 h-4 w-4" /> Generic end
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2 font-medium">End</th><th className="px-3 py-2 font-medium">Mates</th>
                <th className="px-3 py-2 font-medium">Mating block</th><th className="px-3 py-2 font-medium">Pin map</th>
                <th className="px-3 py-2 font-medium">Wires</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody>
              {harness.ends.map((end) => {
                const remapped = Object.keys(end.pinMap ?? {}).length;
                return (
                  <tr key={end.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{endLabel(end)}</td>
                    <td className="px-3 py-2">{matesText(document, end)}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <MatingBlock harnessId={harness.id} end={end} editable={editable} canConvertModels={canConvertModels} />
                    </td>
                    <td className="px-3 py-2">
                      {editable && end.mates && !end.mates.redacted ? (
                        <button type="button" className="underline-offset-2 hover:underline" onClick={() => setDialog({ pinMap: end.id })}>
                          {remapped ? `${remapped} remapped` : "One to one"}
                        </button>
                      ) : remapped ? `${remapped} remapped` : "One to one"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{endWireCount(harness, end.id)}</td>
                    <td className="px-3 py-2 text-right">
                      {editable && (
                        <span className="inline-flex gap-1">
                          {end.mates && (
                            <Button variant="ghost" size="sm" disabled={isBusy} aria-label={`Unmate ${endLabel(end)}`}
                              onClick={() => void edit("harness", (system) => system.updateHarnessEnd(harness.id, end.id, { mates: null }), "End unmated")}>
                              Unmate
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isBusy || harness.ends.length === 1}
                            aria-label={`Remove ${endLabel(end)}`}
                            onClick={() => void edit("harness", (system) => system.deleteHarnessEnd(harness.id, end.id), "End removed")}>
                            <X className="h-4 w-4" />
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editable && <p className="text-xs text-muted-foreground">Drag from a harness end on the diagram to a port to mate it, or from “Add an end” to add one.</p>}
      </section>

      <section className="space-y-2" aria-label="Wires">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Wires{spliced.size > 0 && <span className="ml-2 font-normal text-muted-foreground">{spliced.size} spliced {spliced.size === 1 ? "pin" : "pins"}</span>}</h3>
          {editable && harness.ends.length > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              {(["from", "to"] as const).map((side) => (
                <Select key={side} value={pair[side]} onValueChange={(value) => setPair((current) => ({ ...current, [side]: value }))}>
                  <SelectTrigger aria-label={`Generate ${side} end`} className="h-8 w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{harness.ends.map((end) => <SelectItem key={end.id} value={end.id}>{endLabel(end)}</SelectItem>)}</SelectContent>
                </Select>
              ))}
              <Select value={pair.generator} onValueChange={(value) => setPair((current) => ({ ...current, generator: value as GeneratorKind }))}>
                <SelectTrigger aria-label="Generator" className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="identity">Same pin</SelectItem>
                  <SelectItem value="reverse">Reversed</SelectItem>
                  <SelectItem value="net_name">By net name</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={isBusy || !pair.from || !pair.to || pair.from === pair.to} onClick={() => void generate()}>
                <Wand2 className="mr-1 h-4 w-4" /> Generate
              </Button>
            </div>
          )}
        </div>
        <WireTable harness={harness} wires={wires} editable={editable} problems={problems} spliced={spliced} edit={editDraft} />
        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={harness.ends.length < 2}
              onClick={() => editDraft((rows) => [...rows, { key: newKey(), from: { end: harness.ends[0].id, pin: "" },
                to: { end: harness.ends[1].id, pin: "" }, signal: "" }])}>
              <Plus className="mr-1 h-4 w-4" /> Add wire
            </Button>
            {!draft && undo?.harnessId === harness.id && (
              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void undoSave()}>Undo save</Button>
            )}
            {draft && (
              <>
                <span className="text-sm text-muted-foreground">Unsaved changes: {changed} {changed === 1 ? "wire" : "wires"}</span>
                <Button size="sm" disabled={isBusy || problems.size > 0} onClick={() => void save()}>Save wires</Button>
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
              </>
            )}
          </div>
        )}
      </section>

      <HarnessOutputsSection systemId={systemId} harness={harness} editable={editable} />

      {dialog === "details" && (
        <DetailsDialog harness={harness} busy={isBusy} onClose={() => setDialog(null)}
          onSave={(fields) => edit("harness", (system) => system.updateHarness(harness.id, fields), "Harness updated")} />
      )}
      {pinMapEnd && (
        <PinMapDialog end={pinMapEnd} busy={isBusy} onClose={() => setDialog(null)}
          pads={[...new Set([...(pinMapEnd.matePads.length ? pinMapEnd.matePads : pinMapEnd.pins),
            ...Object.values(pinMapEnd.pinMap ?? {})])].sort(comparePads)}
          onSave={(pinMap) => edit("harness", (system) => system.updateHarnessEnd(harness.id, pinMapEnd.id, { pinMap }), "Pin map saved")} />
      )}
      <ConfirmDialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)}
        title={`Delete ${harness.name}?`} description="Its ends and wires are deleted. The boards are not changed."
        confirmLabel="Delete harness" destructive
        onConfirm={() => void edit("harness", (system) => system.deleteHarness(harness.id), "Harness deleted").then(() => onDeleted())} />
    </div>
  );
}
