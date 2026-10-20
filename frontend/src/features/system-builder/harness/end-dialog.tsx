/**
 * An end's dialog (CONTRACTS §16.5): its housing (mating catalog parts first),
 * one contact per cavity in use, and the pin map. Saved as one `replace-end`.
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { getComponent } from "@/components/workspace/catalog-client";
import type { CatalogComponent } from "@/types/catalog";

import type { SystemDocument, SystemOp } from "../model/types";
import { naturalCompare } from "../schematic/scene";
import { EndContacts } from "./end-contacts";
import { EndHousing } from "./end-housing";
import { EndPinMap, pinMapRow, type PinMapRow } from "./end-pin-map";
import { setEndOps } from "./harness-edits";
import { harnessField, harnessRole, partRefOf, type HarnessRole } from "./harness-parts";
import type { HarnessView, PartRef } from "./harness-view";
import { QuickPartDialog } from "./quick-part-dialog";

export interface EndDialogProps {
  view: HarnessView;
  endId: string;
  document: SystemDocument;
  canEdit: boolean;
  apply: (ops: SystemOp[]) => Promise<unknown>;
  onClose: () => void;
}

export function EndDialog({ view, endId, document, canEdit, apply, onClose }: EndDialogProps) {
  const end = view.ends.find((item) => item.id === endId);
  const harness = document.harnesses.find((item) => item.id === view.id);
  const [housing, setHousing] = useState<PartRef | null>(end?.housing ?? null);
  const [contacts, setContacts] = useState<Record<string, PartRef>>(() => ({ ...(end?.contacts ?? {}) }));
  const [rows, setRows] = useState<PinMapRow[]>(() => (end?.pinMap ?? []).map((pair) => pinMapRow(pair.cavity, pair.pad)));
  const [family, setFamily] = useState<string | undefined>();
  const [quickRole, setQuickRole] = useState<HarnessRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const housingId = housing?.componentId;
  useEffect(() => {
    if (!housingId) return undefined;
    let live = true;
    void getComponent(housingId)
      .then((component) => {
        if (live) setFamily(harnessField(component, "harness_contact_family"));
      })
      .catch(() => {
        if (live) setFamily(undefined);
      });
    return () => {
      live = false;
    };
  }, [housingId]);

  if (!end) return null;

  const save = async () => {
    if (!canEdit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const pinMap = rows
        .flatMap((row) => {
          const cavity = row.cavity.trim();
          const pad = row.pad.trim();
          return cavity !== "" && pad !== "" && cavity !== pad ? [{ cavity, pad }] : [];
        })
        .sort((a, b) => naturalCompare(a.cavity, b.cavity));
      const chosen = Object.fromEntries(Object.entries(contacts).filter(([, part]) => Boolean(part)));
      await apply(setEndOps(view, endId, { housing: housing ?? null, contacts: chosen, pinMap }));
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  };

  const onCreated = (component: CatalogComponent) => {
    if (harnessRole(component) === "housing") setHousing(partRefOf(component));
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
        <DialogContent className="max-h-[86vh] w-[min(94vw,720px)] max-w-none overflow-y-auto border-white/10 bg-[#0b1220] text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Edit end · {end.title}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Housing, contacts and pin map of {harness?.label ?? view.label}. Saved as one edit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <EndHousing
              end={end}
              housing={housing}
              disabled={!canEdit || busy}
              onPick={setHousing}
              onClear={() => setHousing(null)}
              onNewPart={setQuickRole}
            />
            <EndContacts
              end={end}
              contacts={contacts}
              family={family}
              disabled={!canEdit || busy}
              onChange={setContacts}
              onNewPart={setQuickRole}
            />
            <EndPinMap rows={rows} disabled={!canEdit || busy} onChange={setRows} />
          </div>

          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
            {canEdit && <Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {quickRole && (
        <QuickPartDialog
          role={quickRole}
          onClose={() => setQuickRole(null)}
          onCreated={onCreated}
        />
      )}
    </>
  );
}
