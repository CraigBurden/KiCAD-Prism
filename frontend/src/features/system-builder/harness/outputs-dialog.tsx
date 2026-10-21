/**
 * The harness outputs dialog (CONTRACTS §16.7): the sheets of the harness
 * drawing, one at a time, and a download for every generated file. While the
 * system bundle builds the index is polled; the dialog says so instead of
 * showing an empty list.
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { harnessOutputFile, harnessOutputs } from "../model/api";
import { DownloadList } from "../outputs/download-list";
import { SheetPreview, useSheetNavigation } from "../outputs/sheet-preview";
import { useOutputsIndex } from "../outputs/use-outputs-index";

export function OutputsDialog({ systemId, harness, label, onClose }: {
  systemId: string;
  harness: string;
  label: string;
  onClose: () => void;
}) {
  const { index, error, retry } = useOutputsIndex(
    ["system-harness-outputs", systemId, harness],
    (signal) => harnessOutputs(systemId, harness, signal),
  );
  const ready = index?.state === "ready";
  const sheets = index?.sheets ?? 0;
  const navigation = useSheetNavigation(sheets);

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent
        className="max-h-[88vh] w-[min(96vw,1100px)] max-w-none overflow-auto border-white/10 bg-[#0b1220] text-zinc-100"
        onKeyDown={navigation.onKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Outputs</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {label} · the drawing, wiring table and BOM generated from the system bundle.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="space-y-3 text-sm">
            <p className="text-red-400">{error.message}</p>
            <Button variant="outline" onClick={retry}>Retry</Button>
          </div>
        ) : index === null ? (
          <p className="text-sm text-zinc-400">Loading the outputs…</p>
        ) : !ready ? (
          <p className="text-sm text-zinc-400">The system is still building — outputs follow when it is ready</p>
        ) : sheets < 1 ? (
          <p className="text-sm text-zinc-400">This drawing has no sheets.</p>
        ) : (
          <SheetPreview
            sheets={sheets}
            navigation={navigation}
            load={(name, signal) => harnessOutputFile(systemId, harness, name, signal).then(({ blob }) => blob)}
          />
        )}

        {ready && index.files.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Downloads</h3>
            <DownloadList
              files={index.files}
              load={(name) => harnessOutputFile(systemId, harness, name)}
            />
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
