/** The system page's top bar: back, name, version and save state, the bundle's state, undo and redo, and Snapshot, Commit to Git and Publish (§15.4). */
import { Link } from "react-router-dom";
import { ArrowLeft, Camera, GitCommitHorizontal, Redo2, Send, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { useSystemSession } from "../session/use-system-session";

type SessionState = ReturnType<typeof useSystemSession>["state"];

export interface SystemHeaderProps {
  name: string | undefined;
  folderId: string | null | undefined;
  version: number | undefined;
  state: SessionState;
  canEdit: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSnapshot?: () => void;
  onCommitGit?: () => void;
  onPublish?: () => void;
}

export function SystemHeader({ name, folderId, version, state, canEdit, onUndo, onRedo, onSnapshot, onCommitGit, onPublish }: SystemHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
      <Button variant="ghost" size="icon" asChild aria-label="Back to the workspace">
        <Link to={folderId ? `/?folder=${encodeURIComponent(folderId)}` : "/"}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <span className="text-sm text-muted-foreground">Systems /</span>
      <span className="truncate text-sm font-semibold">{name ?? "…"}</span>
      {version !== undefined && (
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          v{version} · {state.saving ? "saving…" : "saved"}
        </span>
      )}
      <BundleChip state={state} />
      <span className="flex-1" />
      {canEdit && (
        <>
          <Button variant="ghost" size="icon" aria-label="Undo" title="Undo (⌘Z)" disabled={!state.undoStack.length || state.saving} onClick={onUndo}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!state.redoStack.length || state.saving} onClick={onRedo}>
            <Redo2 className="h-4 w-4" />
          </Button>
          {onSnapshot && (
            <Button variant="outline" size="sm" onClick={onSnapshot}>
              <Camera className="mr-1.5 h-3.5 w-3.5" /> Snapshot
            </Button>
          )}
          {onCommitGit && (
            <Button variant="outline" size="sm" onClick={onCommitGit}>
              <GitCommitHorizontal className="mr-1.5 h-3.5 w-3.5" /> Commit to Git
            </Button>
          )}
          {onPublish && (
            <Button size="sm" onClick={onPublish}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Publish…
            </Button>
          )}
        </>
      )}
    </header>
  );
}

function BundleChip({ state }: { state: SessionState }) {
  const answer = state.bundleAnswer;
  if (!answer) return null;
  if (answer.state === "failed") {
    return <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive" title={answer.error}>bundle failed</span>;
  }
  if (answer.state === "building" || state.bundleStale) {
    return <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">checking…</span>;
  }
  if (answer.pending.length) {
    return <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground" title="Boards whose design bundle is still building">{answer.pending.length} board(s) building</span>;
  }
  return null;
}
