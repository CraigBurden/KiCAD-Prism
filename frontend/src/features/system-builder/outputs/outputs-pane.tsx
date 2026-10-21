/**
 * The ICD / Outputs tab (CONTRACTS §17, ADR §4.1): the interface control
 * document previewed sheet by sheet on the left, and on the right the
 * downloads — the ICD, the system document, each harness's outputs and the
 * STEP note. While the system bundle builds the index is polled, as the
 * harness outputs dialog does.
 */
import { Button } from "@/components/ui/button";

import type { SystemDocument } from "../model/types";
import { icd, icdFile } from "../model/api";
import { OutputsGroups } from "./outputs-groups";
import { SheetPreview, useSheetNavigation } from "./sheet-preview";
import { OUTPUTS_BUILDING_MESSAGE, useOutputsIndex } from "./use-outputs-index";

function IcdPreview({ systemId, sheets }: { systemId: string; sheets: number }) {
  const navigation = useSheetNavigation(sheets);
  return (
    <div onKeyDown={navigation.onKeyDown}>
      <SheetPreview
        sheets={sheets}
        navigation={navigation}
        alt="Interface control document sheet"
        load={(name, signal) => icdFile(systemId, name, signal).then(({ blob }) => blob)}
      />
    </div>
  );
}

export function OutputsPane({ systemId, document, name }: {
  systemId: string;
  document: SystemDocument;
  /** The system's name, for the document export's filename. */
  name: string;
}) {
  const icdIndex = useOutputsIndex(["system-icd", systemId], (signal) => icd(systemId, signal));
  const ready = icdIndex.index?.state === "ready";
  const sheets = icdIndex.index?.sheets ?? 0;

  return (
    <div className="flex h-full min-h-0 bg-[#050c1c] text-zinc-100">
      <section className="flex min-w-0 flex-1 flex-col gap-3 p-4" aria-label="Interface control document">
        <h2 className="text-sm font-semibold">Interface control document</h2>
        <div className="min-h-0 flex-1 overflow-auto">
          {icdIndex.error ? (
            <div className="space-y-3">
              <p className="text-sm text-red-400">{icdIndex.error.message}</p>
              <Button variant="outline" size="sm" onClick={icdIndex.retry}>Retry</Button>
            </div>
          ) : !icdIndex.index ? (
            <p className="text-sm text-zinc-400">Loading the interface control document…</p>
          ) : !ready ? (
            <p className="text-sm text-zinc-400">{OUTPUTS_BUILDING_MESSAGE}</p>
          ) : sheets < 1 ? (
            <p className="text-sm text-zinc-400">This document has no sheets.</p>
          ) : (
            <IcdPreview systemId={systemId} sheets={sheets} />
          )}
        </div>
      </section>

      <aside className="w-[340px] shrink-0 overflow-y-auto border-l border-white/10 p-4" aria-label="Downloads">
        <OutputsGroups systemId={systemId} document={document} name={name} icd={icdIndex} />
      </aside>
    </div>
  );
}
