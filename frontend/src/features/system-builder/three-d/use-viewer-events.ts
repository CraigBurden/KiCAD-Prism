/**
 * The 3D pane's viewer events: the selection change the page mirrors, and the
 * Move gizmo's phases, whose commit is one `replace-occurrence` save.
 */
import { useEffect, useRef } from "react";

import type { PrismSemanticViewerElement, PrismSystemSceneMoveState, PrismSystemViewerSelection } from "@/types/prism-semantic-viewer";

import type { SystemDocument, SystemOp } from "../model/types";
import { poseOps } from "./pose-edits";

export interface ViewerEventsOptions {
  element: PrismSemanticViewerElement | null;
  document: SystemDocument;
  /** The document's occurrences, the only selections the page keeps from the scene. */
  occurrenceIds: ReadonlySet<string>;
  onSelect: (ids: Set<string>) => void;
  apply: (ops: SystemOp[]) => Promise<unknown>;
  /** The gizmo's state, for the Move card. */
  onMoveState: (state: PrismSystemSceneMoveState) => void;
  /** A save landed or the target changed: the Move card starts over. */
  onSettled: () => void;
  /** A save failed: the gizmo goes back to the stored pose. */
  onFailed: (error: unknown) => void;
}

export function useViewerEvents({ element, document, occurrenceIds, onSelect, apply, onMoveState, onSettled, onFailed }: ViewerEventsOptions): void {
  const latest = useRef({ document, occurrenceIds, onSelect, apply, onMoveState, onSettled, onFailed });
  useEffect(() => {
    latest.current = { document, occurrenceIds, onSelect, apply, onMoveState, onSettled, onFailed };
  });

  useEffect(() => {
    if (!element) return undefined;
    const onSelection = (event: CustomEvent<{ selection: unknown }>) => {
      const selection = event.detail.selection as PrismSystemViewerSelection | null;
      const occurrence = selection && "occurrence" in selection ? selection.occurrence : undefined;
      const current = latest.current;
      current.onSelect(occurrence && current.occurrenceIds.has(occurrence) ? new Set([occurrence]) : new Set());
    };
    const onMove = (event: CustomEvent<PrismSystemSceneMoveState>) => {
      const state = event.detail;
      const current = latest.current;
      current.onMoveState(state);
      if (state.phase === "target" || state.phase === "sync" || state.phase === "cancel") current.onSettled();
      if (state.phase === "commit" && state.target) {
        const target = state.target;
        void current.apply(poseOps(current.document, target.occurrence, target.pose))
          .then(() => current.onSettled())
          .catch(current.onFailed);
      }
    };
    element.addEventListener("prism-semantic-viewer:selectionchange", onSelection as EventListener);
    element.addEventListener("prism-semantic-viewer:move", onMove);
    return () => {
      element.removeEventListener("prism-semantic-viewer:selectionchange", onSelection as EventListener);
      element.removeEventListener("prism-semantic-viewer:move", onMove);
    };
  }, [element]);
}
