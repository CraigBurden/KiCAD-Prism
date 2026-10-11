import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { hasUnsavedDrafts } from "@/features/system-builder/draft-guard";
import { SystemSessionProvider, useOpenSystemSession, useSessionState } from "@/features/system-builder/session/use-system-session";
import { SystemWorkspace } from "@/features/system-builder/workspace/system-workspace";
import {
  migrateLegacyTab,
  workspaceParams,
  workspaceStateFromParams,
  type WorkspaceState,
} from "@/features/system-builder/workspace/workspace-state";
import { canManageProjects } from "@/lib/roles";
import type { User } from "@/types/auth";

interface SystemDetailPageProps {
  user: User | null;
}

export function SystemDetailPage({ user }: SystemDetailPageProps) {
  const { systemId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useOpenSystemSession(systemId);
  const state = useSessionState(session);
  const system = state.document?.system ?? null;
  // D-P2-31: an archived system is kept for the parents that froze it, and takes no changes.
  const canEdit = canManageProjects(user?.role) && !system?.archivedAt;
  const workspace = workspaceStateFromParams(searchParams);
  const importing = searchParams.get("import") === "1";

  // Links to the old tabs (`?tab=…`) open the matching workspace (D-P2-49).
  useEffect(() => {
    const migrated = migrateLegacyTab(searchParams);
    if (!migrated) return;
    const params = workspaceParams(migrated.state, searchParams);
    if (migrated.importing) params.set("import", "1");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  // SB2-102: a change that unmounts an editor holding an unsaved draft asks first.
  const [pending, setPending] = useState<(() => void) | null>(null);
  const guarded = (action: () => void) => {
    if (hasUnsavedDrafts()) setPending(() => action);
    else action();
  };
  const applyWorkspace = (next: WorkspaceState) => setSearchParams((current) => workspaceParams(next, current));
  const setWorkspace = (next: WorkspaceState) => {
    const leaves = next.tray !== workspace.tray
      || next.selection?.kind !== workspace.selection?.kind || next.selection?.id !== workspace.selection?.id;
    if (leaves) guarded(() => applyWorkspace(next));
    else applyWorkspace(next);
  };
  const setImporting = (open: boolean) => setSearchParams((current) => {
    const params = new URLSearchParams(current);
    if (open) params.set("import", "1"); else params.delete("import");
    return params;
  });
  const back = () => guarded(() => navigate(system?.folderId ? `/?folder=${encodeURIComponent(system.folderId)}` : "/"));

  if (state.notFound) {
    return (
      <div className="flex h-app-viewport flex-col items-center justify-center gap-3 bg-background text-center">
        <p className="text-lg font-semibold">System not found</p>
        <p className="text-sm text-muted-foreground">It may have been deleted, or it is in a folder you cannot see.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Back to workspace</Button>
      </div>
    );
  }
  if (!state.document || !state.etag) {
    return (
      <div className="flex h-app-viewport flex-col items-center justify-center gap-3 bg-background text-sm text-muted-foreground">
        {state.error ? (
          <div className="rounded-md border border-destructive/40 p-4 text-destructive" role="alert">
            {state.error}
            <Button variant="outline" size="sm" className="ml-3" onClick={() => void session.reload()}>Retry</Button>
          </div>
        ) : "Loading…"}
      </div>
    );
  }
  return (
    <SystemSessionProvider session={session}>
    <SystemWorkspace
      systemId={systemId}
      document={state.document}
      canEdit={canEdit}
      user={user}
      state={workspace}
      importing={importing && canEdit}
      onState={setWorkspace}
      onImporting={setImporting}
      onBack={back}
    />
    <ConfirmDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}
      title="Discard unsaved changes?" description="The pins or wires you edited and did not save will be lost."
      confirmLabel="Discard" cancelLabel="Keep editing"
      onConfirm={() => {
        const action = pending;
        setPending(null);
        action?.();
      }} />
    </SystemSessionProvider>
  );
}
