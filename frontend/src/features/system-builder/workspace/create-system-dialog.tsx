import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isDialogSubmitShortcut } from "@/lib/dialog-shortcuts";

import { createSystem } from "../model/api";
import type { SystemRecord } from "../model/types";

interface CreateSystemDialogProps {
  folderId: string | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (record: SystemRecord) => void;
}

/** Mounted only while open, so each open starts empty. */
export function CreateSystemDialog({ folderId, onOpenChange, onCreated }: CreateSystemDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(await createSystem({ name: trimmed, description: description.trim() || undefined, folderId }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isDialogSubmitShortcut(event)) return;
    event.preventDefault();
    void submit();
  };

  return (
    <Dialog open onOpenChange={(open) => !busy && onOpenChange(open)}>
      <DialogContent onKeyDown={onKeyDown}>
        <DialogHeader>
          <DialogTitle>New system</DialogTitle>
          <DialogDescription>A system joins boards with board-to-board mates and harnesses. Add boards once it is open.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="System name"
            aria-label="System name"
          />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description (optional)" aria-label="Description" />
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
