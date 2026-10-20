/** Take a named snapshot (§5, §15.4's header) and show the latest ones. */
import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isDialogSubmitShortcut } from "@/lib/dialog-shortcuts";
import { invalidateServerState, useServerState } from "@/lib/server-state";

import { createSnapshot, listSnapshots } from "../model/api";
import type { SystemSnapshot } from "../model/types";

interface Props {
  systemId: string;
  /** The version being captured, as `v<version>` when the dialog opens. */
  defaultName: string;
  onClose: () => void;
  onCreated: (snapshot: SystemSnapshot) => void;
}

const LATEST = 5;

/** Mounted only while open, so each open starts from this version's name. */
export function SnapshotDialog({ systemId, defaultName, onClose, onCreated }: Props) {
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snapshots = useServerState(["system-snapshots", systemId], (signal) => listSnapshots(systemId, signal));

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const snapshot = await createSnapshot(systemId, { name: trimmed, note: note.trim() || undefined });
      void invalidateServerState(["system-snapshots", systemId]);
      onCreated(snapshot);
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

  const latest = snapshots.data?.slice(0, LATEST) ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent onKeyDown={onKeyDown}>
        <DialogHeader>
          <DialogTitle>Take snapshot</DialogTitle>
          <DialogDescription>A snapshot keeps this version of the system by name. You can publish it to the catalog later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sb-snapshot-name">Name</Label>
            <Input id="sb-snapshot-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Snapshot name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sb-snapshot-note">Note</Label>
            <Textarea id="sb-snapshot-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="What changed (optional)" />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Latest snapshots</p>
            {snapshots.loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {snapshots.error && <p className="text-sm text-destructive">{snapshots.error.message}</p>}
            {!snapshots.loading && !snapshots.error && latest.length === 0 && <p className="text-sm text-muted-foreground">No snapshots yet.</p>}
            <ul className="space-y-1">
              {latest.map((snapshot) => (
                <li key={snapshot.snapshotId} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{snapshot.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    v{snapshot.version} · {snapshot.createdBy} · {formatWhen(snapshot.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>{busy ? "Taking snapshot…" : "Take snapshot"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
