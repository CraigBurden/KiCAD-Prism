import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LinkEndInput } from "@/lib/systems-api";
import { cn } from "@/lib/utils";
import type { SystemDocument } from "@/types/system";

import { useSystemSession } from "./session/use-system-session";
import type { WorkspaceSelection } from "./workspace/workspace-state";

type Kind = "link" | "b2b" | "harness";

const KINDS: Record<Kind, string> = { link: "Link", b2b: "Board-to-board", harness: "Harness" };

export interface ConnectorOption {
  key: string;
  end: LinkEndInput;
  /** `OBC-1 J14`, `CMBD J6.PWR`. */
  label: string;
  value: string;
  pins: number;
  /** Mated already: by a board-to-board link or a harness end; a connector mates once (P2 §17.2). */
  mated: boolean;
  /** Split into sub-ports: a board-to-board link cannot use it (P2 §22.2). */
  split: boolean;
  search: string;
}

/** Every connector a connection can end at, with what the picker shows (SB2-115). */
export function connectorOptions(document: SystemDocument): ConnectorOption[] {
  const mated = new Set<string>();
  for (const link of document.links) {
    if (link.type !== "b2b") continue;
    for (const end of [link.a, link.b]) if (end.port) mated.add(`${end.instanceId}:${end.port.portKey}`);
  }
  for (const harness of document.harnesses ?? []) {
    for (const end of harness.ends) if (end.mates?.port) mated.add(`${end.mates.instanceId}:${end.mates.port.portKey}`);
  }
  const out: ConnectorOption[] = [];
  for (const instance of document.instances) {
    if (instance.restricted || instance.kind === "part") continue;
    for (const port of instance.ports ?? []) {
      if (!port.exposed) continue;
      const id = `${instance.id}:${port.portKey}`;
      const subports = (instance.subports ?? []).filter((subport) => subport.portKey === port.portKey);
      const base = { value: port.value ?? "", mated: mated.has(id), split: subports.length > 0 };
      const label = `${instance.label} ${port.reference}`;
      out.push({ ...base, key: id, end: { instanceId: instance.id, portKey: port.portKey }, label, pins: port.pinCount,
        search: `${label} ${port.value ?? ""}`.toLowerCase() });
      for (const subport of subports) {
        const sublabel = `${instance.label} ${port.reference}.${subport.name}`;
        out.push({ ...base, key: `${id}:${subport.id}`, end: { instanceId: instance.id, portKey: port.portKey, subportId: subport.id },
          label: sublabel, pins: subport.pads?.length ?? 0, search: `${sublabel} ${port.value ?? ""}`.toLowerCase() });
      }
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

function usable(option: ConnectorOption, kind: Kind): string | null {
  if (kind === "link") return null;
  if (option.mated) return "mated already";
  if (kind === "b2b" && (option.split || option.end.subportId)) return "split";
  if (kind === "harness" && option.end.subportId) return "a harness mates the whole connector";
  return null;
}

function Picker({ title, options, kind, chosen, query, onQuery, onChoose }: {
  title: string; options: ConnectorOption[]; kind: Kind; chosen: string | null; query: string;
  onQuery: (query: string) => void; onChoose: (option: ConnectorOption) => void;
}) {
  const shown = options.filter((option) => !query || option.search.includes(query.trim().toLowerCase()));
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Input aria-label={`${title}: find a connector`} placeholder={`${title}: board, connector or MPN`} value={query}
        className="h-8 text-xs" onChange={(event) => onQuery(event.target.value)} />
      <ul aria-label={title} className="h-64 overflow-auto rounded border text-sm">
        {shown.length === 0 && <li className="p-3 text-xs text-muted-foreground">No connector matches.</li>}
        {shown.map((option) => {
          const why = usable(option, kind);
          return (
            <li key={option.key}>
              <button type="button" disabled={Boolean(why)} aria-pressed={chosen === option.key} title={why ?? undefined}
                onClick={() => onChoose(option)}
                className={cn("flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-accent disabled:opacity-40",
                  chosen === option.key && "bg-accent")}>
                <span className="w-32 shrink-0 truncate font-medium">{option.label}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{option.value}</span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{option.pins}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * SB2-115: make a link, board-to-board mate or harness by picking both connectors from lists, with their MPN and pin
 * count, rather than dragging between port handles on the diagram.
 */
export function ConnectDialog({ document, from, onClose, onCreated }: {
  document: SystemDocument;
  /** The connector the dialog was opened from (a port's Connect…), fixed as end A. */
  from?: LinkEndInput;
  onClose: () => void;
  onCreated: (selection: WorkspaceSelection) => void;
}) {
  const { edit } = useSystemSession();
  const options = useMemo(() => connectorOptions(document), [document]);
  const fixed = from ? options.find((option) => option.end.instanceId === from.instanceId && option.end.portKey === from.portKey
    && option.end.subportId === from.subportId) ?? null : null;
  const [kind, setKind] = useState<Kind>("link");
  const [a, setA] = useState<ConnectorOption | null>(fixed);
  const [b, setB] = useState<ConnectorOption | null>(null);
  const [queries, setQueries] = useState({ a: "", b: "" });
  const [busy, setBusy] = useState(false);
  const ready = a && b && a.key !== b.key && !usable(a, kind) && !usable(b, kind);

  const create = async () => {
    if (!a || !b) return;
    setBusy(true);
    try {
      const created = kind === "harness"
        ? await edit("harness", (system) => system.createHarness({ name: "Harness", ends: [a.end, b.end], identity: true }), "Harness created")
        : await edit("link", (system) => system.createLink({ a: a.end, b: b.end, ...(kind === "b2b" ? { type: "b2b" } : {}) }),
          kind === "b2b" ? "Board-to-board link created" : "Link created");
      if (created) onCreated({ kind: kind === "harness" ? "harness" : "link", id: created.body.id, edit: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle>{fixed ? `Connect ${fixed.label}` : "New connection"}</DialogTitle>
        <DialogDescription className="sr-only">Pick the two connectors and the kind of connection.</DialogDescription>
        <div className="flex items-center gap-2 text-sm">
          <Select value={kind} onValueChange={(value) => setKind(value as Kind)}>
            <SelectTrigger aria-label="Kind" className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(KINDS) as Kind[]).map((key) => <SelectItem key={key} value={key}>{KINDS[key]}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {a ? a.label : "—"} ↔ {b ? b.label : "—"}
          </span>
        </div>
        <div className="flex gap-3">
          {!fixed && (
            <Picker title="From" options={options} kind={kind} chosen={a?.key ?? null} query={queries.a}
              onQuery={(query) => setQueries({ ...queries, a: query })} onChoose={setA} />
          )}
          <Picker title="To" options={options.filter((option) => option.key !== a?.key)} kind={kind} chosen={b?.key ?? null}
            query={queries.b} onQuery={(query) => setQueries({ ...queries, b: query })} onChoose={setB} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!ready || busy} onClick={() => void create()}>Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
