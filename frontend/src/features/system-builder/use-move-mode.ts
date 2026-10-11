import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { SemanticViewer } from "@/lib/semantic-viewer";
import type { PrismSystemSceneMoveState } from "@/types/prism-semantic-viewer";
import type { SystemScene } from "@/types/system";

import { stackMove, stackOf, stackUndo } from "./scene-stack";
import { useSystemSession } from "./session/use-system-session";

type MoveTarget = NonNullable<PrismSystemSceneMoveState["target"]>;
type Undo = ReturnType<typeof stackUndo>;
/**
 * Where the target was when it was picked, and whether it has been saved elsewhere since.
 * `undo` is set after a stack move: what Revert stores to put the whole stack back.
 */
type Origin = { instanceId: string; pose: MoveTarget["pose"]; source: MoveTarget["source"]; moved: boolean; undo?: Undo };

/**
 * SB2-29 move mode for the System 3D tab, on the 3D tab's viewer since SB2-31f.
 * The viewer only previews; a released drag or Enter ("commit") stores the
 * target's pose with If-Match, and a failed save puts the board back.
 */
export function useMoveMode(viewer: SemanticViewer, scene: SystemScene | null) {
  const [move, setMove] = useState<PrismSystemSceneMoveState | null>(null);
  // Bumped whenever the view saves, cancels or changes target: the move panel starts over.
  const [epoch, setEpoch] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [origin, setOrigin] = useState<Origin | null>(null);
  // SB2-38: a move of a mated board waiting for "Break the mate" or "Move with its stack".
  const [pending, setPending] = useState<MoveTarget | null>(null);
  const { busy, edit } = useSystemSession();

  const markMoved = (instanceId: string) =>
    setOrigin((current) => (current?.instanceId === instanceId && !current.moved ? { ...current, moved: true } : current));

  /** Store the target's position (a released drag, Enter, or Save); on failure the view goes back. */
  const savePose = async (target: MoveTarget) => {
    const saved = await edit("pose", (system) => system.setPose(target.instanceId, target.pose));
    if (saved) markMoved(target.instanceId);
    else viewer.cancelMove();
  };
  /** A save of a board in a mated stack asks first (D-P2-18); any other saves at once. */
  const requestSave = async (target: MoveTarget) => {
    if (scene && stackOf(scene, target.occurrence)) setPending(target);
    else await savePose(target);
  };
  // The listener is added once per viewer; it reads the latest save through a ref.
  const saveRef = useRef(requestSave);
  useEffect(() => {
    saveRef.current = requestSave;
  });

  useEffect(() => {
    const off = viewer.on("move", (state) => {
      setMove(state);
      const target = state.enabled ? state.target : null;
      setOrigin((current) => {
        if (!target) return null;
        if (current?.instanceId !== target.instanceId) {
          return { instanceId: target.instanceId, pose: target.pose, source: target.source, moved: false };
        }
        return current;
      });
      if (state.phase === "commit" && state.target) void saveRef.current(state.target);
      // Start the panel over when the view's state changed under it; a re-read during
      // typing ("sync" with an unsaved preview) keeps what is typed.
      if (state.phase !== "preview" && !(state.phase === "sync" && state.target?.unsaved)) setEpoch((count) => count + 1);
    });
    return () => off();
  }, [viewer]);

  return {
    move,
    epoch,
    busy: busy !== null,
    /** The target was saved somewhere else since it was picked. */
    moved: Boolean(origin?.moved && origin.instanceId === move?.target?.instanceId),
    confirmReset,
    setConfirmReset,
    savePose: requestSave,
    /** The target's stack (null: not mated) and its own mate, for the panel. */
    stack: move?.target && scene ? stackOf(scene, move.target.occurrence) : null,
    mate: move?.target && scene ? scene.occurrences.find((o) => o.path === move.target?.occurrence)?.mate ?? null : null,
    pending: pending !== null && pending.instanceId === move?.target?.instanceId,
    /** Store only this board's pose: its mated position shows as overridden. */
    breakMate: async () => {
      const target = pending;
      setPending(null);
      if (target) await savePose(target);
    },
    /** Move the whole stack rigidly with the board, in one save. */
    moveWithStack: async () => {
      const target = pending;
      setPending(null);
      if (!target || !scene) return;
      const poses = stackMove(scene, target.occurrence, target.pose);
      const undo = stackUndo(scene, poses);
      const done = await edit("pose", (system) => system.setPoses({ poses }), `${target.displayPath} moved with its stack`);
      if (!done) {
        viewer.cancelMove();
        return;
      }
      setOrigin((current) => (current?.instanceId === target.instanceId ? { ...current, moved: true, undo: current.undo ?? undo } : current));
    },
    cancelPending: () => {
      setPending(null);
      viewer.cancelMove();
    },
    /** Drop the stored pose of a board whose mated position was overridden: it goes back onto its mate. */
    snapBack: async (target: MoveTarget) => {
      const done = await edit("pose", (system) => system.clearPose(target.instanceId), `${target.displayPath} snapped back to its mate`);
      if (done) markMoved(target.instanceId);
    },
    /** Drop an unsaved preview; after saved moves, store the pose the target had when it was picked. */
    revert: async () => {
      viewer.cancelMove();
      const target = move?.target;
      if (!origin?.moved || !target || origin.instanceId !== target.instanceId) return;
      if (origin.undo) {
        const undo = origin.undo;
        const back = await edit("pose", (system) => system.setPoses(undo), `${target.displayPath} and its stack are back where they were`);
        if (back) setOrigin({ ...origin, moved: false, undo: undefined });
        return;
      }
      const done = origin.source !== "manual"
        ? await edit("pose", (system) => system.clearPose(origin.instanceId), `${target.displayPath} is back where it was`)
        : await edit("pose", (system) => system.setPose(origin.instanceId, origin.pose), `${target.displayPath} is back where it was`);
      if (done) setOrigin({ ...origin, moved: false });
    },
    backToDefault: async (target: MoveTarget) => {
      const done = await edit("pose", (system) => system.clearPose(target.instanceId), `${target.displayPath} is back in its default place`);
      if (done) markMoved(target.instanceId);
    },
    resetAll: async () => {
      const done = await edit("pose", (system) => system.resetPoses());
      setConfirmReset(false);
      if (done && origin) markMoved(origin.instanceId);
      if (done) toastReset(done.body.reset.length);
    },
  };
}

function toastReset(count: number) {
  toast.success(count === 0 ? "Every board was already in its default place"
    : `${count} ${count === 1 ? "board is" : "boards are"} back in the default layout`);
}
