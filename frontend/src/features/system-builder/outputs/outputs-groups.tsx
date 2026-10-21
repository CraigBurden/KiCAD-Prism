/**
 * The ICD / Outputs tab's right column (CONTRACTS §17): the downloads grouped
 * as the contract lists them — the ICD, the system document as JSON, one group
 * per harness with its §16.7 files, and the STEP note. Downloads are
 * viewer-level, so the groups are the same for a read-only caller.
 */
import { FileJson } from "lucide-react";
import type { ReactNode } from "react";

import type { Harness, SystemDocument } from "../model/types";
import { harnessOutputFile, harnessOutputs, icdFile } from "../model/api";
import { DownloadList } from "./download-list";
import { saveJson, slug } from "./file-saver";
import { OUTPUTS_BUILDING_MESSAGE, useOutputsIndex, type OutputsIndexState } from "./use-outputs-index";

const MUTED = "text-sm text-zinc-400";

function Muted({ children }: { children: string }) {
  return <p className={MUTED}>{children}</p>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

/** One index's files, or why there are none yet. */
function IndexDownloads({ state, load }: {
  state: OutputsIndexState;
  load: (name: string) => Promise<{ blob: Blob; filename: string }>;
}) {
  if (state.error) return <p className="text-xs text-red-400">{state.error.message}</p>;
  if (!state.index) return <Muted>Loading the outputs…</Muted>;
  if (state.index.state !== "ready") return <Muted>{OUTPUTS_BUILDING_MESSAGE}</Muted>;
  if (!state.index.files.length) return <Muted>No files yet.</Muted>;
  return <DownloadList files={state.index.files} load={load} />;
}

function HarnessDownloads({ systemId, harness }: { systemId: string; harness: Harness }) {
  const state = useOutputsIndex(
    ["system-harness-outputs", systemId, harness.id],
    (signal) => harnessOutputs(systemId, harness.id, signal),
  );
  return (
    <div className="space-y-2 border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
      <h4 className="text-xs font-medium text-zinc-300">{harness.label}</h4>
      <IndexDownloads state={state} load={(name) => harnessOutputFile(systemId, harness.id, name)} />
    </div>
  );
}

export function OutputsGroups({ systemId, document, name, icd }: {
  systemId: string;
  document: SystemDocument;
  /** The system's name, for the document export's filename. */
  name: string;
  icd: OutputsIndexState;
}) {
  const documentFilename = `${slug(name || document.name)}-system.json`;
  return (
    <div className="space-y-5">
      <Group title="ICD">
        <IndexDownloads state={icd} load={(file) => icdFile(systemId, file)} />
      </Group>

      <Group title="Document">
        <button
          type="button"
          aria-label="Download the system document as JSON"
          className="flex w-full items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-left hover:bg-white/5"
          onClick={() => saveJson(document, documentFilename)}
        >
          <FileJson className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="min-w-0">
            <span className="block text-sm text-zinc-200">prism.system.v2</span>
            <span className="block truncate font-mono text-[11px] text-zinc-500">{documentFilename}</span>
          </span>
        </button>
      </Group>

      <Group title="Harnesses">
        {document.harnesses.length ? (
          <div className="space-y-3">
            {document.harnesses.map((harness) => (
              <HarnessDownloads key={harness.id} systemId={systemId} harness={harness} />
            ))}
          </div>
        ) : (
          <Muted>This system has no harnesses.</Muted>
        )}
      </Group>

      <Group title="STEP">
        <Muted>The STEP assembly arrives with stage 5b.</Muted>
      </Group>
    </div>
  );
}
