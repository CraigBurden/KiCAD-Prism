/**
 * The harness outputs dialog (CONTRACTS §16.7): the sheets of the harness
 * drawing, one at a time, and a download for every generated file. While the
 * system bundle builds the index is polled; the dialog says so instead of
 * showing an empty list.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { harnessOutputFile, harnessOutputs } from "../model/api";
import type { HarnessOutputsIndex } from "../model/types";

const POLL_MS = 3000;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Hand an already-fetched file to the browser as a download. */
function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export function OutputsDialog({ systemId, harness, label, onClose }: {
  systemId: string;
  harness: string;
  label: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState<HarnessOutputsIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sheet, setSheet] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  // The index; while building, ask again every three seconds until it is ready.
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    let timer: number | undefined;
    setError(null);
    harnessOutputs(systemId, harness, controller.signal)
      .then((answer) => {
        if (!live) return;
        setIndex(answer);
        if (answer.state === "building") {
          timer = window.setTimeout(() => setAttempt((value) => value + 1), POLL_MS);
        }
      })
      .catch((failure: unknown) => {
        if (live && !controller.signal.aborted) setError(message(failure));
      });
    return () => {
      live = false;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [systemId, harness, attempt]);

  const ready = index?.state === "ready";
  const sheets = index?.sheets ?? 0;
  const current = Math.min(Math.max(sheet, 1), Math.max(sheets, 1));

  // The previewed sheet: an object URL, revoked when the sheet changes or the dialog closes.
  useEffect(() => {
    if (!ready || sheets < 1) {
      setPreview(null);
      return undefined;
    }
    const controller = new AbortController();
    let live = true;
    let href: string | null = null;
    setPreview(null);
    setPreviewError(null);
    harnessOutputFile(systemId, harness, `sheet-${current}.svg`, controller.signal)
      .then(({ blob }) => {
        if (!live) return;
        href = URL.createObjectURL(blob);
        setPreview(href);
      })
      .catch((failure: unknown) => {
        if (live && !controller.signal.aborted) setPreviewError(message(failure));
      });
    return () => {
      live = false;
      controller.abort();
      if (href) URL.revokeObjectURL(href);
    };
  }, [systemId, harness, ready, sheets, current]);

  const changeSheet = (next: number) => setSheet(Math.min(Math.max(next, 1), Math.max(sheets, 1)));

  const download = async (name: string) => {
    setDownloadError(null);
    setDownloading(name);
    try {
      const { blob, filename } = await harnessOutputFile(systemId, harness, name);
      saveBlob(blob, filename);
    } catch (failure) {
      setDownloadError(message(failure));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent
        className="max-h-[88vh] w-[min(96vw,1100px)] max-w-none overflow-auto border-white/10 bg-[#0b1220] text-zinc-100"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            changeSheet(current - 1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            changeSheet(current + 1);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Outputs</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {label} · the drawing, wiring table and BOM generated from the system bundle.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="space-y-3 text-sm">
            <p className="text-red-400">{error}</p>
            <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry</Button>
          </div>
        ) : index === null ? (
          <p className="text-sm text-zinc-400">Loading the outputs…</p>
        ) : !ready ? (
          <p className="text-sm text-zinc-400">The system is still building — outputs follow when it is ready</p>
        ) : sheets < 1 ? (
          <p className="text-sm text-zinc-400">This drawing has no sheets.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="icon" aria-label="Previous sheet" disabled={current <= 1} onClick={() => changeSheet(current - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm text-zinc-300" aria-live="polite">Sheet {current} of {sheets}</p>
              <Button variant="outline" size="icon" aria-label="Next sheet" disabled={current >= sheets} onClick={() => changeSheet(current + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex min-h-40 items-center justify-center overflow-auto rounded-md bg-white p-2">
              {previewError ? (
                <p className="text-sm text-zinc-700">{previewError}</p>
              ) : preview ? (
                <img src={preview} alt={`Sheet ${current} of ${sheets}`} className="block h-auto w-full" />
              ) : (
                <p className="text-sm text-zinc-600">Loading sheet {current}…</p>
              )}
            </div>
          </div>
        )}

        {ready && index.files.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Downloads</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {index.files.map((file) => (
                <button
                  key={file.name}
                  type="button"
                  aria-label={`Download ${file.title}`}
                  disabled={downloading !== null}
                  className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-left hover:bg-white/5 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => void download(file.name)}
                >
                  <FileDown className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="min-w-0">
                    <span className="block text-sm text-zinc-200">{file.title}</span>
                    <span className="block truncate font-mono text-[11px] text-zinc-500">{file.name}</span>
                  </span>
                </button>
              ))}
            </div>
            {downloadError && <p className="text-xs text-red-400">{downloadError}</p>}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
