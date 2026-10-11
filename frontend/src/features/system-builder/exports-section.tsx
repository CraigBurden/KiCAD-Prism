import { useState } from "react";
import { Lock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SystemDocument, SystemExport } from "@/types/system";

import { ExportManyDialog } from "./export-many-dialog";
import { subportLabel } from "./subport-model";
import { useSystemSession } from "./session/use-system-session";
import { InspectorSection } from "./workspace/inspector-section";

/** The export (if any) whose target is this board port, or one of its sub-ports (CONTRACTS_P2 §22.2). */
export function exportForPort(document: SystemDocument, instanceId: string, portKey: string,
  subportId: string | null = null): SystemExport | undefined {
  return document.exports?.find((entry) => entry.instanceId === instanceId && entry.portKey === portKey
    && (entry.subportId ?? null) === subportId);
}

export function exportStatus(entry: SystemExport): { label: string; variant: "outline" | "destructive" | "secondary" } {
  if (entry.redacted) return { label: "restricted", variant: "secondary" };
  if (entry.resolved === false) return { label: "unresolved", variant: "destructive" };
  if (entry.resolved === null) return { label: "not evaluated", variant: "secondary" };
  return { label: "published", variant: "outline" };
}

interface ExportDialogProps {
  title: string;
  description: string;
  initial: { name: string; description: string };
  existingNames: string[];
  busy: boolean;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (value: { name: string; description: string }) => void | Promise<void>;
}

/** Name and describe an export; names are unique per system, ignoring case. */
export function ExportDialog({ title, description, initial, existingNames, busy, submitLabel, onClose, onSubmit }: ExportDialogProps) {
  const [name, setName] = useState(initial.name);
  const [text, setText] = useState(initial.description);
  const taken = existingNames.some((existing) => existing.toLowerCase() === name.trim().toLowerCase());
  const problem = !name.trim() ? "Give the export a name." : taken ? "Another export already has this name." : null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (!problem) void onSubmit({ name: name.trim(), description: text.trim() });
        }}>
          <div className="space-y-1.5">
            <Label htmlFor="export-name">Export name</Label>
            <Input id="export-name" value={name} maxLength={100} autoFocus onChange={(event) => setName(event.target.value)} />
            {problem && name && <p className="text-xs text-destructive">{problem}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="export-description">Description</Label>
            <Textarea id="export-description" value={text} maxLength={2000} rows={3}
              placeholder="What a parent system connects here, e.g. 28 V bus input"
              onChange={(event) => setText(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || problem !== null}>{busy ? "Saving…" : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ExportsSectionProps {
  document: SystemDocument;
  canEdit: boolean;
  onOpenBoard: (instanceId: string) => void;
}

/** The connectors this system publishes, for parent systems to link to (CONTRACTS_P2 §4). */
export function ExportsSection({ document, canEdit, onOpenBoard }: ExportsSectionProps) {
  const { busy, edit } = useSystemSession();
  const [editing, setEditing] = useState<SystemExport | null>(null);
  const [removing, setRemoving] = useState<SystemExport | null>(null);
  const [adding, setAdding] = useState(false);
  const exports = document.exports ?? [];
  const labels = new Map(document.instances.map((instance) => [instance.id, instance.label]));

  return (
    <InspectorSection title="Exports" count={exports.length} action={canEdit && (
      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => setAdding(true)} title="Export several connectors">
        <Plus className="size-3.5" /> Export…
      </Button>
    )}>
      {exports.length === 0 ? <p className="h-8 text-sm text-muted-foreground">None</p> : (
        <ul className="text-sm">
          {exports.map((entry) => {
            const status = exportStatus(entry);
            const where = `${labels.get(entry.instanceId) ?? "Board"} ${entry.redacted ? ""
              : entry.port ? subportLabel(entry.port.reference, entry.subport?.name) : "—"}`.trim();
            return (
              <li key={entry.id} className="flex h-8 items-center gap-2 border-b last:border-b-0"
                title={[entry.name, where, entry.port ? `${entry.port.pinCount} pins` : "", entry.description].filter(Boolean).join(" · ")}>
                <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
                <button type="button" className="min-w-0 max-w-[45%] truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => onOpenBoard(entry.instanceId)}>
                  {entry.redacted ? <Lock className="inline size-3" aria-label="restricted" /> : where}
                </button>
                {status.label !== "published" && (
                  <span className={status.variant === "destructive" ? "shrink-0 text-xs text-destructive" : "shrink-0 text-xs text-muted-foreground"}>{status.label}</span>
                )}
                {canEdit && !entry.redacted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`Actions for ${entry.name}`}>
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(entry)}><Pencil className="mr-2 h-4 w-4" /> Rename</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setRemoving(entry)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remove export
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <ExportDialog title={`Rename ${editing.name}`} description="Parents keep their links: an export's identity never changes."
          initial={{ name: editing.name, description: editing.description }} submitLabel="Save"
          existingNames={exports.flatMap((entry) => (entry.id === editing.id ? [] : [entry.name]))}
          busy={busy === "export"} onClose={() => setEditing(null)}
          onSubmit={async (value) => {
            const done = await edit("export", (system) => system.updateExport(editing.id, value), "Export updated");
            if (done) setEditing(null);
          }} />
      )}
      {adding && (
        <ExportManyDialog document={document}
          onClose={() => setAdding(false)} />
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove the export ${removing?.name ?? ""}?`}
        description="Parent systems that link to it will see it as missing when they take the next revision."
        confirmLabel="Remove export"
        destructive
        busy={busy === "export"}
        onConfirm={() => {
          if (!removing) return;
          void edit("export", (system) => system.deleteExport(removing.id), `Removed ${removing.name}`).then(() => setRemoving(null));
        }}
      />
    </InspectorSection>
  );
}
