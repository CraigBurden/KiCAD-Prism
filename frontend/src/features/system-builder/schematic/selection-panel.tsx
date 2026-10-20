import { useState } from "react";
import { Trash2, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { SystemDocument, SystemOp } from "../model/types";
import { removeOps, renameOps } from "./edits";

interface Props {
  document: SystemDocument;
  id: string;
  canEdit: boolean;
  apply: (ops: SystemOp[]) => Promise<unknown>;
  onRemoved: () => void;
  projectNames?: Record<string, string>;
  /** Open a mate's B2B tab. */
  onOpenMate?: (mate: string) => void;
}

/** Facts and the few edits for one selected object (label, remove). Keyed by id, so each selection starts fresh. */
export function SelectionPanel({ document, id, canEdit, apply, onRemoved, projectNames, onOpenMate }: Props) {
  const occurrence = document.occurrences.find((item) => item.id === id);
  const harness = document.harnesses.find((item) => item.id === id);
  const mate = document.mates.find((item) => item.id === id);
  const endHarness = document.harnesses.find((item) => item.ends.some((end) => end.id === id));
  const end = endHarness?.ends.find((item) => item.id === id);
  const label = occurrence?.label ?? harness?.label;
  const [draft, setDraft] = useState(label ?? "");
  const labelOf = (occurrenceId: string) => document.occurrences.find((item) => item.id === occurrenceId)?.label ?? occurrenceId;

  const send = async (ops: SystemOp[]) => {
    try {
      await apply(ops);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      return false;
    }
  };
  const rename = () => {
    const next = draft.trim();
    if (!next || next === label) return;
    void send(renameOps(document, id, next));
  };

  let title = "";
  const facts: [string, string][] = [];
  if (occurrence) {
    title = occurrence.source.kind === "board" ? "Board" : occurrence.source.kind === "entry" ? "Published system" : "Body";
    if (occurrence.source.kind === "board") {
      const source = occurrence.source;
      facts.push(["Project", projectNames?.[source.projectId] ?? source.projectId]);
      facts.push(source.track.kind === "followed" ? ["Follows", `${source.track.branch} @ ${source.track.commit.slice(0, 7)}`] : ["Pinned", source.track.commit.slice(0, 7)]);
    }
  } else if (harness) {
    title = "Harness";
    facts.push(["Ends", String(harness.ends.length)], ["Links", String(harness.links.length)]);
  } else if (mate) {
    title = "Board-to-board mate";
    facts.push(["A", `${labelOf(mate.a.occurrence)}.${mate.a.connector}`], ["B", `${labelOf(mate.b.occurrence)}.${mate.b.connector}`]);
    facts.push(["Orientation", `${mate.orientation.quarterTurns * 90}°${mate.orientation.flip ? ", flipped" : ""}`]);
  } else if (end && endHarness) {
    title = "Harness end";
    facts.push(["Harness", endHarness.label]);
    if (end.site) facts.push(["Site", `${labelOf(end.site.occurrence)}.${end.site.connector}`]);
  } else {
    return null;
  }

  return (
    <div className="w-64 space-y-3 rounded-lg border bg-background/95 p-3 text-sm shadow-lg backdrop-blur" onPointerDown={(event) => event.stopPropagation()}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {label !== undefined && (
        <Input
          value={draft}
          disabled={!canEdit}
          aria-label="Label"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={rename}
          onKeyDown={(event) => {
            if (event.key === "Enter") rename();
            event.stopPropagation();
          }}
        />
      )}
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-xs">
        {facts.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="truncate" title={value}>{value}</dd>
          </div>
        ))}
      </dl>
      {mate && onOpenMate && (
        <Button size="sm" variant="secondary" className="w-full" onClick={() => onOpenMate(mate.id)}>
          <Unplug className="mr-1.5 h-3.5 w-3.5" /> Open B2B tab
        </Button>
      )}
      {canEdit && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={async () => {
            if (await send(removeOps(document, [id]))) onRemoved();
          }}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
        </Button>
      )}
    </div>
  );
}
