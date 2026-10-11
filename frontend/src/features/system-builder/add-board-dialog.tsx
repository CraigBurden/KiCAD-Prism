import { useRef, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspaceData, workspaceSessionKey } from "@/hooks/use-workspace-data";
import type { User } from "@/types/auth";

import { BoardFields, boardProblems, instanceInput, type BoardDraft } from "./board-fields";
import type { SystemEdits } from "./session/system-session";

export interface AddedBoards {
  added: string[];
  failures: { board: BoardDraft; error: string }[];
}

/** SB2-124: add boards in order (the session carries the ETag from one call to the next); a refused board does not stop the rest. */
export async function addBoards(system: Pick<SystemEdits, "addInstance">, boards: BoardDraft[]): Promise<AddedBoards> {
  const out: AddedBoards = { added: [], failures: [] };
  for (const board of boards) {
    try {
      // react-doctor-disable-next-line async-await-in-loop - each add sends the ETag the previous one returned, so they run in order
      const created = await system.addInstance(instanceInput(board));
      out.added.push(created.body.id);
    } catch (error) {
      out.failures.push({ board, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return out;
}

interface AddBoardDialogProps {
  user: User | null;
  existingLabels: string[];
  busy: boolean;
  onClose: () => void;
  /** Adds the boards; answers the ones the server refused, which stay in the dialog. */
  onSubmit: (boards: BoardDraft[]) => Promise<AddedBoards["failures"]>;
}

const blank = (key: number): BoardDraft => ({ key, projectId: "", label: "", source: "branch", ref: "main", pinned: false });

export function AddBoardDialog({ user, existingLabels, busy, onClose, onSubmit }: AddBoardDialogProps) {
  const { projects } = useWorkspaceData({ sessionKey: workspaceSessionKey(user) });
  const nextKey = useRef(2);
  const [boards, setBoards] = useState<BoardDraft[]>([blank(1)]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [attempted, setAttempted] = useState(false);
  const problems = boardProblems(boards, existingLabels);

  const submit = async () => {
    setAttempted(true);
    if (problems.length > 0) return;
    const failures = await onSubmit(boards);
    if (!failures.length) return;
    setBoards(failures.map((failure) => failure.board));
    setErrors(Object.fromEntries(failures.map((failure) => [failure.board.key, failure.error])));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add boards</DialogTitle>
          <DialogDescription className="sr-only">Add projects as boards</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {boards.map((board, index) => (
            <div key={board.key} className="space-y-1">
              <BoardFields board={board} index={index} projects={projects}
                onChange={(next) => setBoards((current) => current.map((item) => (item.key === board.key ? next : item)))}
                onRemove={boards.length > 1 ? () => setBoards((current) => current.filter((item) => item.key !== board.key)) : undefined} />
              {errors[board.key] && <p className="text-xs text-destructive" role="alert">{errors[board.key]}</p>}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => {
            const key = nextKey.current;
            nextKey.current += 1;
            setBoards((current) => [...current, blank(key)]);
          }}>
            <Plus className="mr-1 size-4" /> Another board
          </Button>
        </div>
        {attempted && problems.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-destructive" role="alert">
            {problems.map((problem) => <li key={problem}>{boards.length === 1 ? problem.replace(/^Board 1: /, "") : problem}</li>)}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy} onClick={() => void submit()}>
            {busy ? "Adding…" : boards.length === 1 ? "Add board" : `Add ${boards.length} boards`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
