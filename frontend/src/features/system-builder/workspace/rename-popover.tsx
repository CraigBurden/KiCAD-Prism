import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Finding, SystemDocument } from "@/types/system";

import { documentIndex } from "../document-index";
import { findingDetail } from "../findings";

export function netLeaf(net: string): string {
  return net.slice(net.lastIndexOf("/") + 1);
}

export interface RenameSide {
  instanceId: string;
  board: string;
  net: string;
  /** The other side's name: what this board's net would become. */
  suggested: string;
}

/** The boards a SYS-V09 finding's row could rename: each side with one named net, on a board (CONTRACTS_P2 §23.1). */
export function renameSides(document: SystemDocument, finding: Finding): RenameSide[] {
  const link = finding.linkId ? documentIndex(document).links.get(finding.linkId) : undefined;
  const { nets: seen } = findingDetail(finding);
  if (!link || seen?.kind !== "join" || !seen.a.length || !seen.b.length) return [];
  const sides: RenameSide[] = [];
  for (const [end, nets, other] of [["a", seen.a, seen.b], ["b", seen.b, seen.a]] as const) {
    const instance = documentIndex(document).instances.get(link[end].instanceId);
    if (!instance || instance.restricted || (instance.kind ?? "board") !== "board" || nets.length !== 1) continue;
    sides.push({ instanceId: instance.id, board: instance.label, net: nets[0], suggested: netLeaf(other[0]) });
  }
  return sides;
}

/** "Rename": pick the board whose net changes and the name it takes; the board's owner applies it. */
export function RenamePopover({ sides, onPropose }: {
  sides: RenameSide[];
  onPropose: (side: RenameSide, name: string, note: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(0);
  const [name, setName] = useState(sides[0]?.suggested ?? "");
  const [note, setNote] = useState("");
  const side = sides[chosen];
  const pick = (index: number) => {
    setChosen(index);
    setName(sides[index].suggested);
  };
  const propose = async () => {
    if (side && await onPropose(side, name.trim(), note.trim())) setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="w-14 shrink-0 text-right text-xs text-muted-foreground hover:text-foreground hover:underline">Rename</button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2">
        <div role="radiogroup" aria-label="Board to rename" className="grid gap-1">
          {sides.map((option, index) => (
            <button key={option.instanceId + option.net} type="button" role="radio" aria-checked={index === chosen}
              onClick={() => pick(index)}
              className={cn("flex items-center gap-2 rounded border px-2 py-1 text-left text-xs",
                index === chosen ? "border-primary" : "hover:bg-accent")}>
              <span className="shrink-0 font-medium">{option.board}</span>
              <span className="min-w-0 truncate font-mono text-muted-foreground" title={option.net}>{option.net}</span>
            </button>
          ))}
        </div>
        <Input aria-label="New net name" className="font-mono" value={name} maxLength={100}
          onChange={(event) => setName(event.target.value)} />
        <Textarea aria-label="Note for the board's owner" placeholder="Note (optional)" rows={2} value={note}
          maxLength={2000} onChange={(event) => setNote(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" disabled={!side || !name.trim() || /[\s/]/.test(name.trim()) || netLeaf(side.net) === name.trim()}
            onClick={() => void propose()}>Propose</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
