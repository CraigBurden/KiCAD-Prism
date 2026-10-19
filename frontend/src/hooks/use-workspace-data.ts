import { useCallback, useMemo } from "react";

import { fetchApi, fetchJson, readApiError } from "@/lib/api";
import { forgetServerState, useServerState } from "@/lib/server-state";
import type { User } from "@/types/auth";
import { FolderTreeItem, Project } from "@/types/project";

export interface WorkspaceActionResult {
  ok: boolean;
  error?: string;
}

interface WorkspaceDataState {
  projects: Project[];
  folders: FolderTreeItem[];
  /** No data to show yet for this session. */
  loading: boolean;
  /** The latest load failed and there is no data to fall back on. */
  error: string | null;
  /** The latest refresh failed but earlier data is still shown. */
  refreshError: string | null;
  /** The shown data has not been confirmed by a successful load in this session. */
  stale: boolean;
  folderById: Map<string, FolderTreeItem>;
  refresh: () => Promise<void>;
  createFolder: (name: string, parentId: string | null) => Promise<WorkspaceActionResult>;
  renameFolder: (folderId: string, name: string) => Promise<WorkspaceActionResult>;
  deleteFolder: (folderId: string) => Promise<WorkspaceActionResult>;
  moveProject: (projectId: string, folderId: string | null) => Promise<WorkspaceActionResult>;
  moveProjects: (projectIds: string[], folderId: string | null) => Promise<WorkspaceActionResult>;
  deleteProject: (projectId: string) => Promise<WorkspaceActionResult>;
}

interface WorkspaceBootstrapResponse {
  projects: Project[];
  folders: FolderTreeItem[];
}

/**
 * Identity of the signed-in account the workspace data belongs to. Two
 * sessions with different keys never see each other's cached bootstrap.
 */
export function workspaceSessionKey(user: Pick<User, "email" | "role"> | null | undefined): string {
  return user ? `${user.email}\u0000${user.role}` : "";
}

const WORKSPACE_KEY = ["workspace", "bootstrap"] as const;

/**
 * Drop the kept bootstrap of every session, e.g. on sign-out. A load already
 * in flight cannot bring it back.
 */
export function clearWorkspaceDataCache(): void {
  forgetServerState(WORKSPACE_KEY);
}

const EMPTY_PROJECTS: Project[] = [];
const EMPTY_FOLDERS: FolderTreeItem[] = [];

/**
 * The workspace bootstrap through `lib/server-state`: kept after the last
 * unmount for the whole session (until `clearWorkspaceDataCache`), so a
 * remount shows it at once while it is read again. Only the latest session is
 * kept: reading one session forgets every other.
 */
export function useWorkspaceData({ sessionKey }: { sessionKey: string }): WorkspaceDataState {
  const key = useMemo(() => [...WORKSPACE_KEY, sessionKey] as const, [sessionKey]);
  const read = useServerState<WorkspaceBootstrapResponse>(
    key,
    (signal) => {
      forgetServerState(WORKSPACE_KEY, { except: key, unobservedOnly: true });
      return fetchJson<WorkspaceBootstrapResponse>("/api/workspace/bootstrap", { signal }, "Failed to load workspace");
    },
    { retainMs: Infinity },
  );
  const { refresh } = read;
  const failure = read.error ? read.error.message || "Failed to load workspace" : null;
  const current = {
    data: read.data ?? null,
    loading: read.loading,
    error: read.data === undefined ? failure : null,
    refreshError: read.data === undefined ? null : failure,
  };

  const projects = current.data?.projects ?? EMPTY_PROJECTS;
  const folders = current.data?.folders ?? EMPTY_FOLDERS;

  const folderById = useMemo(() => {
    const lookup = new Map<string, FolderTreeItem>();
    folders.forEach((folder) => {
      lookup.set(folder.id, folder);
    });
    return lookup;
  }, [folders]);

  const runMutation = useCallback(
    async (
      input: RequestInfo | URL,
      init: RequestInit,
      fallbackError: string
    ): Promise<WorkspaceActionResult> => {
      try {
        const response = await fetchApi(input, init);
        if (!response.ok) {
          return { ok: false, error: await readApiError(response, fallbackError) };
        }

        await refresh();
        return { ok: true };
      } catch {
        return { ok: false, error: fallbackError };
      }
    },
    [refresh]
  );

  const createFolder = useCallback(
    async (name: string, parentId: string | null): Promise<WorkspaceActionResult> => {
      return runMutation(
        "/api/folders/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            parent_id: parentId,
          }),
        },
        "Failed to create folder"
      );
    },
    [runMutation]
  );

  const renameFolder = useCallback(
    async (folderId: string, name: string): Promise<WorkspaceActionResult> => {
      return runMutation(
        `/api/folders/${folderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
        "Failed to rename folder"
      );
    },
    [runMutation]
  );

  const deleteFolder = useCallback(
    async (folderId: string): Promise<WorkspaceActionResult> => {
      return runMutation(
        `/api/folders/${folderId}?cascade=true`,
        {
          method: "DELETE",
        },
        "Failed to delete folder"
      );
    },
    [runMutation]
  );

  const moveProjects = useCallback(
    async (projectIds: string[], folderId: string | null): Promise<WorkspaceActionResult> => {
      return runMutation(
        "/api/folders/projects/move",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_ids: projectIds, folder_id: folderId }),
        },
        projectIds.length === 1 ? "Failed to move project" : "Failed to move projects"
      );
    },
    [runMutation]
  );

  const moveProject = useCallback(
    async (projectId: string, folderId: string | null): Promise<WorkspaceActionResult> => {
      return moveProjects([projectId], folderId);
    },
    [moveProjects]
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<WorkspaceActionResult> => {
      return runMutation(
        `/api/projects/${projectId}`,
        {
          method: "DELETE",
        },
        "Failed to delete project"
      );
    },
    [runMutation]
  );

  return {
    projects,
    folders,
    loading: current.loading,
    error: current.error,
    refreshError: current.refreshError,
    stale: current.data !== null && read.stale,
    folderById,
    refresh,
    createFolder,
    renameFolder,
    deleteFolder,
    moveProject,
    moveProjects,
    deleteProject,
  };
}
