/** The header's dialogs (§15.4): Snapshot, Commit to Git and Publish, one open at a time. */
import { toast } from "sonner";

import { PublishDialog } from "../publish/publish-dialog";
import type { SessionState } from "../session/system-session";
import { GitDialog } from "./git-dialog";
import { SnapshotDialog } from "./snapshot-dialog";

export type HeaderDialog = "snapshot" | "git" | "publish";

export function HeaderDialogs({ open, state, projects, onClose, onImported }: {
  open: HeaderDialog | null;
  state: SessionState;
  projects: { id: string; name: string }[];
  onClose: () => void;
  /** Git replaced the document: reload it. */
  onImported: () => void;
}) {
  const record = state.record;
  if (!open || !record) return null;
  if (open === "snapshot") {
    return (
      <SnapshotDialog
        systemId={record.systemId}
        defaultName={`v${record.version}`}
        onClose={onClose}
        onCreated={(snapshot) => {
          onClose();
          toast.success(`Snapshot ${snapshot.name} taken${snapshot.gitCommitJobId ? "; its Git commit is queued" : ""}`);
        }}
      />
    );
  }
  if (open === "git") {
    return (
      <GitDialog
        systemId={record.systemId}
        version={record.version}
        systemName={record.name}
        projects={projects}
        onClose={onClose}
        onImported={() => {
          onClose();
          toast.success("Imported the file from Git");
          onImported();
        }}
      />
    );
  }
  return (
    <PublishDialog
      systemId={record.systemId}
      name={record.name}
      version={record.version}
      document={record.document}
      bundle={state.bundle ?? null}
      building={state.bundleStale || state.bundleAnswer?.state !== "ready"}
      onClose={onClose}
    />
  );
}
