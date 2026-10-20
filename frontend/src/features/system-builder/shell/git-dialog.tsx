/**
 * Commit to Git (§13): link a system to a file on a project branch, queue a
 * commit, and import the file when it changed outside Prism. Mounted only while
 * open, so the link form starts from the current project list.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePoll, useServerState } from "@/lib/server-state";

import { commitGit, importGit, linkGit, readGit, readProjectBranches, unlinkGit } from "../model/api";
import type { SystemGitJob, SystemGitJobStatus, SystemGitLink, SystemRecord } from "../model/types";

interface Props {
  systemId: string;
  /** The version a commit or import is based on (`If-Match`). */
  version: number;
  systemName: string;
  projects: { id: string; name: string }[];
  onClose: () => void;
  onImported: (record: SystemRecord) => void;
}

type Busy = "link" | "commit" | "import" | "unlink" | null;

const ACTIVE: ReadonlySet<SystemGitJobStatus> = new Set(["queued", "running", "retry_wait", "cancel_requested"]);

export function GitDialog({ systemId, version, systemName, projects, onClose, onImported }: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [branchRef, setBranchRef] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const [message, setMessage] = useState(`Update ${systemName}`);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const git = useServerState(["system-git", systemId], (signal) => readGit(systemId, signal));
  const branches = useServerState(projectId ? ["project-branches", projectId] : null, (signal) =>
    readProjectBranches(projectId, signal),
  );

  const link = git.data?.link ?? null;
  const lastJob = git.data?.lastJob ?? null;
  // A job queued before this link was made belongs to an earlier link (ISO times compare as text).
  const job = lastJob && link && (lastJob.createdAt ?? "") >= link.linkedAt ? lastJob : null;
  const active = job !== null && ACTIVE.has(job.status);
  // The timer belongs to server-state; it stops on unmount or when the job settles.
  usePoll(active, git.refresh, { intervalMs: 2000, onError: () => undefined });

  const branchList = branches.data?.branches ?? [];
  const defaultRef =
    branches.data?.default_ref ??
    branchList.find((branch) => branch.is_current)?.ref ??
    branchList[0]?.ref ??
    "";
  const selectedRef = branchRef && branchList.some((branch) => branch.ref === branchRef) ? branchRef : defaultRef;
  const branch = branchList.find((item) => item.ref === selectedRef) ?? null;
  const projectName = link ? projects.find((project) => project.id === link.projectId)?.name ?? link.projectId : "";

  const linkSystem = async () => {
    if (!projectId || !branch || busy) return;
    setBusy("link");
    setError(null);
    try {
      await linkGit(systemId, { projectId, branch: branch.name, path: path.trim() || undefined });
      await git.refresh();
      setBusy(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(null);
    }
  };

  const commitSystem = async () => {
    const trimmed = message.trim();
    if (!trimmed || busy || active) return;
    setBusy("commit");
    setError(null);
    try {
      await commitGit(systemId, version, trimmed);
      await git.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(null);
    }
  };

  const importFile = async () => {
    if (busy) return;
    setBusy("import");
    setError(null);
    try {
      const record = await importGit(systemId, version);
      await git.refresh();
      onImported(record);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(null);
    }
  };

  const unlinkSystem = async () => {
    if (busy || active) return;
    setBusy("unlink");
    setError(null);
    try {
      await unlinkGit(systemId);
      await git.refresh();
      setMessage(`Update ${systemName}`);
      setPath("");
      setBranchRef(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Commit to Git</DialogTitle>
          <DialogDescription>
            Prism commits the system document to a file on a project branch. It never pulls on its own: import the file when it changes outside Prism.
          </DialogDescription>
        </DialogHeader>
        {git.loading && !git.data && <p className="text-sm text-muted-foreground">Loading…</p>}
        {git.error && !git.data && <p className="text-sm text-destructive" role="alert">{git.error.message}</p>}
        {git.data && !link && (
          <div className="space-y-3">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects are available to link.</p>
            ) : (
              <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
                <Label htmlFor="sb-git-project">Project</Label>
                <select
                  id="sb-git-project"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setBranchRef(null);
                  }}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
                <Label htmlFor="sb-git-branch">Branch</Label>
                <select
                  id="sb-git-branch"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={selectedRef}
                  onChange={(event) => setBranchRef(event.target.value)}
                  disabled={!branches.data || branchList.length === 0}
                >
                  {!branches.data && <option>{branches.error ? "Could not load branches" : "Loading…"}</option>}
                  {branchList.map((item) => (
                    <option key={item.ref} value={item.ref}>{`${item.name} @ ${item.hash}`}</option>
                  ))}
                </select>
                <Label htmlFor="sb-git-path">Path</Label>
                <Input
                  id="sb-git-path"
                  value={path}
                  onChange={(event) => setPath(event.target.value)}
                  placeholder="systems/<slug>.system.json"
                />
              </div>
            )}
            {branches.error && <p className="text-sm text-destructive">Could not load the project&apos;s branches.</p>}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
        )}
        {git.data && link && (
          <div className="space-y-3">
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Project</dt>
              <dd className="truncate">{projectName}</dd>
              <dt className="text-muted-foreground">Branch</dt>
              <dd className="truncate">{link.branch}</dd>
              <dt className="text-muted-foreground">Path</dt>
              <dd className="truncate font-mono text-xs" title={link.path}>{link.path}</dd>
              <dt className="text-muted-foreground">Last commit</dt>
              <dd>{link.lastCommit ? <span className="font-mono text-xs">{shortCommit(link.lastCommit)}</span> : "None yet"}</dd>
              <dt className="text-muted-foreground">Last job</dt>
              <dd>{job ? job.status : "None yet"}</dd>
            </dl>
            <JobState job={job} link={link} active={active} busy={busy} onImport={() => void importFile()} />
            <div className="space-y-1.5">
              <Label htmlFor="sb-git-message">Commit message</Label>
              <Textarea id="sb-git-message" value={message} onChange={(event) => setMessage(event.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
        )}
        <DialogFooter>
          {git.data && link ? (
            <>
              <Button variant="link" className="px-0 sm:mr-auto" onClick={() => void unlinkSystem()} disabled={Boolean(busy) || active}>
                {busy === "unlink" ? "Unlinking…" : "Unlink"}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={Boolean(busy)}>Close</Button>
              <Button onClick={() => void commitSystem()} disabled={Boolean(busy) || active || !message.trim()}>
                {busy === "commit" ? "Committing…" : "Commit"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={Boolean(busy)}>Cancel</Button>
              <Button onClick={() => void linkSystem()} disabled={Boolean(busy) || !git.data || !projectId || !branch}>
                {busy === "link" ? "Linking…" : "Link"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The commit job's state: running, committed, or the failure and its recovery. */
function JobState({ job, link, active, busy, onImport }: { job: SystemGitJob | null; link: SystemGitLink; active: boolean; busy: Busy; onImport: () => void }) {
  if (!job) return null;
  if (active) {
    return <p className="text-sm text-muted-foreground" aria-live="polite">Committing…</p>;
  }
  if (job.status === "completed") {
    return (
      <p className="text-sm text-emerald-700" aria-live="polite">
        Committed{link.lastCommit ? ` ${shortCommit(link.lastCommit)}` : ""}
      </p>
    );
  }
  if (job.status === "failed") {
    return (
      <div className="space-y-2">
        {job.errorCode === "system_git_diverged" ? (
          <>
            <p className="text-sm text-destructive" role="alert">The file changed in Git since Prism last committed it.</p>
            <Button variant="outline" onClick={onImport} disabled={Boolean(busy)}>
              {busy === "import" ? "Importing…" : "Import the file"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-destructive" role="alert">{job.errorMessage ?? "The commit failed."}</p>
        )}
      </div>
    );
  }
  if (job.status === "cancelled") {
    return <p className="text-sm text-muted-foreground">The commit was cancelled.</p>;
  }
  return null;
}

function shortCommit(commit: string): string {
  return commit.slice(0, 7);
}
