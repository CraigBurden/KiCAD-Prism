/**
 * Add from the catalog (stage 3d): a mechanical part as a body, or a published
 * system as an entry (§15.3). Either takes its slot in the default row.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { PartPicker, type PartHit } from "./part-search";

const TEXT = {
  body: {
    title: "Add body",
    description: "Place a mechanical part from the catalog: an enclosure, a bracket, a module's body. Connector parts go on its faces in 3D.",
    search: "Search parts",
    action: "Add body",
  },
  entry: {
    title: "Place published system",
    description: "Place a published system from the catalog. It is drawn as its contents, one rigid group, and its exports mate like connectors.",
    search: "Search published systems",
    action: "Place system",
  },
} as const;

export function AddBodyDialog({ onClose, onAdd, adding = "body" }: { onClose: () => void; onAdd: (part: PartHit) => Promise<void>; adding?: keyof typeof TEXT }) {
  const [part, setPart] = useState<PartHit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = TEXT[adding];
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
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>
        <PartPicker placeholder={text.search} selected={part} onPick={setPart} kind={adding === "entry" ? "system" : "part"} />
        {part && (
          <p className="text-sm">
            {part.name} <span className="text-muted-foreground">{part.mpn}</span>
            {adding === "body" && part.noModel && <span className="ml-2 text-amber-600">No 3D model yet: it will be placed as a point until one is converted.</span>}
            {adding === "entry" && part.stage !== "released" && <span className="ml-2 text-amber-600">Not released: only its own system&apos;s authors may place it.</span>}
          </p>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !part}>{busy ? "Adding…" : text.action}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
