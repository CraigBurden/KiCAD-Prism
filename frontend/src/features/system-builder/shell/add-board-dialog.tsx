import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerState } from "@/lib/server-state";
import type { Project } from "@/types/project";

import { readProjectBranches } from "../model/api";
import type { NewBoard } from "../schematic/edits";

interface Props {
  projects: Project[];
  existingLabels: string[];
  onClose: () => void;
  /** Adds the board; rejects with the server's refusal, shown here. */
  onAdd: (board: NewBoard) => Promise<void>;
}

const displayName = (project: Project) => project.display_name || project.name;

/** A label not yet used in the system: "Carrier", then "Carrier 2". */
export function freshLabel(base: string, taken: readonly string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let index = 2; ; index += 1) if (!used.has(`${base} ${index}`)) return `${base} ${index}`;
}

/** Mounted only while open. */
export function AddBoardDialog({ projects, existingLabels, onClose, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [branchRef, setBranchRef] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...projects]
      .filter((project) => !needle || displayName(project).toLowerCase().includes(needle))
      .sort((a, b) => displayName(a).localeCompare(displayName(b)))
      .slice(0, 50);
  }, [projects, query]);
  const project = projects.find((item) => item.id === projectId) ?? null;
  const branches = useServerState(projectId ? ["project-branches", projectId] : null, (signal) => readProjectBranches(projectId as string, signal));
  const branch = branches.data?.branches.find((item) => item.ref === (branchRef ?? branches.data?.default_ref)) ?? branches.data?.branches[0];
  const shownLabel = label ?? (project ? freshLabel(displayName(project), existingLabels) : "");

  const submit = async () => {
    if (!project || !branch || !shownLabel.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd({
        label: shownLabel.trim(),
        projectId: project.id,
        track: pinned ? { kind: "pinned", commit: branch.commit } : { kind: "followed", branch: branch.name, commit: branch.commit },
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add board</DialogTitle>
          <DialogDescription>Place a project's board on the root sheet. A followed board advances with its branch; a pinned one stays at its commit.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" aria-label="Search projects" />
          <div className="max-h-56 overflow-y-auto rounded-md border" role="listbox" aria-label="Projects">
            {matching.length === 0 && <p className="p-3 text-sm text-muted-foreground">No projects match.</p>}
            {matching.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === projectId}
                onClick={() => {
                  setProjectId(item.id);
                  setBranchRef(null);
                  setLabel(null);
                }}
                className={`block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-muted ${item.id === projectId ? "bg-primary/10 font-medium" : ""}`}
              >
                {displayName(item)}
              </button>
            ))}
          </div>
          {project && (
            <>
              <div className="grid grid-cols-[6rem_1fr] items-center gap-2">
                <Label htmlFor="sb-board-label">Label</Label>
                <Input id="sb-board-label" value={shownLabel} onChange={(event) => setLabel(event.target.value)} />
                <Label htmlFor="sb-board-branch">Branch</Label>
                <select
                  id="sb-board-branch"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={branch?.ref ?? ""}
                  onChange={(event) => setBranchRef(event.target.value)}
                  disabled={!branches.data}
                >
                  {!branches.data && <option>{branches.error ? "Could not load branches" : "Loading…"}</option>}
                  {branches.data?.branches.map((item) => (
                    <option key={item.ref} value={item.ref}>{`${item.name} @ ${item.hash}`}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
                Pin to this commit instead of following the branch
              </label>
            </>
          )}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !project || !branch || !shownLabel.trim()}>{busy ? "Adding…" : "Add board"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
