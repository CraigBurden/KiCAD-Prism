/**
 * The STEP group of the ICD / Outputs tab (CONTRACTS §18): build one AP242
 * assembly of the whole system on request, watch its boards while it builds,
 * then download it with the warnings the assembly reported. A caller who
 * cannot see every board is refused, because a STEP file cannot hide one.
 */
import { useState } from "react";
import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiHttpError } from "@/lib/api";
import { usePoll, useServerState } from "@/lib/server-state";

import { stepFile, stepState, startStep } from "../model/api";
import type { SystemStepAnswer } from "../model/types";
import { saveBlob, slug } from "./file-saver";

export const STEP_POLL_MS = 3000;

/** What the group says while nothing has been built for the current bundle. */
export const STEP_HINT = "Boards from kicad-cli at their commits, parts from the catalog, harnesses as tubes";

/** The refusal a caller gets when a board of the system is hidden from them (§18). */
export const STEP_REDACTED_MESSAGE = "The STEP assembly needs access to every board in the system";

/** The refusal the bundle's build state puts on the POST (§18). */
export const STEP_BUILDING_MESSAGE = "The system is still building";

const MUTED = "text-sm text-zinc-400";
const WARNING = "text-xs text-amber-400";
const ERROR = "text-xs text-red-400";

function Muted({ children }: { children: string }) {
  return <p className={MUTED}>{children}</p>;
}

/** A byte count the way the rest of the app writes file sizes. */
function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isRedacted(error: unknown): boolean {
  return error instanceof ApiHttpError && (error.status === 403 || error.code === "system_redacted");
}

function isBundleBuilding(error: unknown): boolean {
  return error instanceof ApiHttpError && (error.status === 409 || error.code === "system_bundle_building");
}

/** The message a refusal shows; anything else keeps its own. */
function failureMessage(error: unknown, fallback: string): string {
  if (isRedacted(error)) return STEP_REDACTED_MESSAGE;
  if (isBundleBuilding(error)) return STEP_BUILDING_MESSAGE;
  return error instanceof Error && error.message ? error.message : fallback;
}

/** The warnings a ready assembly reports (§18): missing component models, fallbacks and missing parts. */
function Warnings({ answer }: { answer: SystemStepAnswer }) {
  const missingModels = answer.boards.filter((board) => board.missingModels > 0);
  const fallback = answer.boards.some((board) => board.fallback);
  if (!missingModels.length && !fallback && !answer.missing.length) return null;
  return (
    <div className="space-y-1">
      {missingModels.length > 0 && (
        <ul className={`space-y-1 ${WARNING}`}>
          {missingModels.map((board) => (
            <li key={board.occurrence}>
              {board.label}: {board.missingModels} component models missing
            </li>
          ))}
        </ul>
      )}
      {fallback && <p className={WARNING}>built from a plain checkout (submodules or LFS missing)</p>}
      {answer.missing.length > 0 && <p className={WARNING}>Missing models: {answer.missing.join(", ")}</p>}
    </div>
  );
}

export function StepGroup({ systemId, name }: {
  systemId: string;
  /** The system's name, for the download's filename. */
  name: string;
}) {
  const read = useServerState<SystemStepAnswer>(
    ["system-step", systemId],
    (signal) => stepState(systemId, signal),
    { retainMs: 0 },
  );
  // While the assembly builds, ask again until it is ready or failed. Polls
  // never overlap, and a failed poll keeps the last state on screen.
  usePoll(read.data?.state === "building", read.refresh, { intervalMs: STEP_POLL_MS, onError: () => undefined });

  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const filename = `${slug(name)}.step`;

  const start = async () => {
    setActionError(null);
    setStarting(true);
    try {
      await startStep(systemId);
      // The POST answers with the state it started; read it through the key so
      // the same view serves the build and the poll that follows.
      await read.refresh();
    } catch (failure) {
      const message = failureMessage(failure, "Could not build the STEP assembly");
      setActionError(message);
      if (message === STEP_BUILDING_MESSAGE) void read.refresh();
    } finally {
      setStarting(false);
    }
  };

  const download = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      const { blob, filename: saved } = await stepFile(systemId, filename);
      saveBlob(blob, saved);
    } catch (failure) {
      setDownloadError(failureMessage(failure, "Could not download the STEP assembly"));
    } finally {
      setDownloading(false);
    }
  };

  if (isRedacted(read.error) || actionError === STEP_REDACTED_MESSAGE) {
    return <p className={WARNING}>{STEP_REDACTED_MESSAGE}</p>;
  }
  if (read.error && !read.data) {
    return <p className={ERROR}>{failureMessage(read.error, "Could not load the STEP assembly")}</p>;
  }
  if (!read.data) return <Muted>Loading the STEP assembly…</Muted>;

  const answer = read.data;
  const actionFailure = actionError ? <p className={WARNING}>{actionError}</p> : null;

  if (answer.state === "none") {
    return (
      <div className="space-y-2">
        <Button variant="outline" size="sm" disabled={starting} onClick={() => void start()}>
          Build STEP
        </Button>
        <Muted>{STEP_HINT}</Muted>
        {actionFailure}
      </div>
    );
  }

  if (answer.state === "building") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-300">Building the STEP assembly…</p>
        {answer.boards.length > 0 && (
          <ul className="space-y-1" aria-label="Board STEP models">
            {answer.boards.map((board) => (
              <li key={board.occurrence} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-zinc-300">{board.label}</span>
                <span className="shrink-0 font-mono text-[11px] text-zinc-500">{board.state}</span>
              </li>
            ))}
          </ul>
        )}
        {actionFailure}
      </div>
    );
  }

  if (answer.state === "ready") {
    return (
      <div className="space-y-2">
        <button
          type="button"
          aria-label={`Download ${filename}`}
          disabled={downloading}
          className="flex w-full items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-left hover:bg-white/5 disabled:pointer-events-none disabled:opacity-50"
          onClick={() => void download()}
        >
          <FileDown className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="min-w-0">
            <span className="block text-sm text-zinc-200">{filename}</span>
            {answer.sizeBytes !== undefined && (
              <span className="block font-mono text-[11px] text-zinc-500">{formatBytes(answer.sizeBytes)}</span>
            )}
          </span>
        </button>
        <Warnings answer={answer} />
        {downloadError && <p className={ERROR}>{downloadError}</p>}
        <button
          type="button"
          disabled={starting}
          className="text-xs text-sky-300 hover:underline disabled:pointer-events-none disabled:opacity-50"
          onClick={() => void start()}
        >
          Rebuild
        </button>
        {actionFailure}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className={ERROR}>{answer.error || "The STEP assembly did not finish"}</p>
      <button
        type="button"
        disabled={starting}
        className="text-xs text-sky-300 hover:underline disabled:pointer-events-none disabled:opacity-50"
        onClick={() => void start()}
      >
        Rebuild
      </button>
      {actionFailure}
    </div>
  );
}
