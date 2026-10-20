/** Add a mechanical catalog part as a body (stage 3d): it takes its slot in the default row. */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { PartPicker, type PartHit } from "./part-search";

export function AddBodyDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (part: PartHit) => Promise<void> }) {
  const [part, setPart] = useState<PartHit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!part || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(part);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add body</DialogTitle>
          <DialogDescription>Place a mechanical part from the catalog: an enclosure, a bracket, a module&apos;s body. Connector parts go on its faces in 3D.</DialogDescription>
        </DialogHeader>
        <PartPicker placeholder="Search parts" selected={part} onPick={setPart} />
        {part && (
          <p className="text-sm">
            {part.name} <span className="text-muted-foreground">{part.mpn}</span>
            {part.noModel && <span className="ml-2 text-amber-600">No 3D model yet: it will be placed as a point until one is converted.</span>}
          </p>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !part}>{busy ? "Adding…" : "Add body"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
