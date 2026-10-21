/**
 * A group of generated files, one download button each (CONTRACTS §16.7,
 * §17): fetch the file, then save it under the name the server gave it. The
 * harness outputs dialog and the ICD / Outputs tab share it.
 */
import { useState } from "react";
import { FileDown } from "lucide-react";

import { saveBlob } from "./file-saver";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface DownloadEntry {
  name: string;
  title: string;
}

export interface DownloadListProps {
  files: readonly DownloadEntry[];
  /** Fetch one file by name, authenticated; it names the download. */
  load: (name: string) => Promise<{ blob: Blob; filename: string }>;
}

export function DownloadList({ files, load }: DownloadListProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (name: string) => {
    setError(null);
    setDownloading(name);
    try {
      const { blob, filename } = await load(name);
      saveBlob(blob, filename);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        {files.map((file) => (
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
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
