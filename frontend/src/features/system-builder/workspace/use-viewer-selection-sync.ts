import { useCallback, useEffect, useRef } from "react";

import { useSemanticViewer, type SemanticViewer, type SemanticViewerAction } from "@/lib/semantic-viewer";
import type { PrismSystemViewerSelection } from "@/types/prism-semantic-viewer";
import type { SystemDocument, SystemScene } from "@/types/system";

import { findingDetail, findingsOf } from "../findings";
import type { WorkspaceSelection } from "./workspace-state";

/** The root-level instance an occurrence path belongs to (`/sin_a/sin_b` → `sin_a`). */
export function rootInstanceOf(path: string | null | undefined): string | null {
  return path?.split("/")[1] || null;
}

export function selectionKey(selection: WorkspaceSelection | null): string {
  return selection ? `${selection.kind}:${selection.id}` : "";
}

/** The viewer action for `selection`, or null when the scene does not draw it (yet). */
export function viewerActionFor(selection: WorkspaceSelection | null, scene: SystemScene, document: SystemDocument): SemanticViewerAction | null {
  if (!selection) return { type: "clear" };
  if (selection.kind === "instance") {
    const path = scene.occurrences.find((item) => item.instanceId === selection.id && item.depth === 1)?.path;
    return path ? { type: "board", path } : null;
  }
  if (selection.kind === "harness") return { type: "harness", id: selection.id };
  if (selection.kind === "collision") {
    const finding = document.validation ? findingsOf(document.validation.findings).collision(selection.id) : null;
    const parts = finding ? findingDetail(finding).collision : [];
    return parts.length ? { type: "parts", parts } : null;
  }
  const link = document.links.find((item) => item.id === selection.id);
  if (!link) return null;
  const parts = [link.a, link.b].flatMap((end) => {
    const occurrence = scene.occurrences.find((item) => item.instanceId === end.instanceId && item.depth === 1)?.path;
    return occurrence && end.port?.reference ? [{ occurrence, reference: end.port.reference }] : [];
  });
  return parts.length ? { type: "parts", parts } : null;
}

/**
 * Keeps the 3D viewer and the workspace selection in step (PLAN M8, SB2-61).
 * The viewer's picks (a board, or a root-level harness) become the workspace
 * selection; an outside selection (the outline, the diagram) is selected and
 * framed in the viewer. A selection the viewer reported is not framed again.
 * Returns the report for a selection the host made in the viewer (a search pick).
 */
export function useViewerSelectionSync(
  viewer: SemanticViewer,
  scene: SystemScene | null,
  document: SystemDocument,
  selection: WorkspaceSelection | null,
  onSelect: ((selection: WorkspaceSelection | null) => void) | undefined,
) {
  const { element } = useSemanticViewer(viewer);
  const fromViewer = useRef<string | null>(null);
  const selectRef = useRef(onSelect);
  const current = useRef(selection);
  useEffect(() => {
    selectRef.current = onSelect;
    current.current = selection;
  }, [onSelect, selection]);

  const report = useCallback((next: WorkspaceSelection | null) => {
    if (!selectRef.current || selectionKey(next) === selectionKey(current.current)) return;
    fromViewer.current = selectionKey(next);
    selectRef.current(next);
  }, []);

  /** Report a viewer selection (a board, a part or a net on a board, or nothing). */
  const reportSelection = useCallback((next: PrismSystemViewerSelection | null) => {
    const instanceId = rootInstanceOf(next?.occurrence);
    if (instanceId) report({ kind: "instance", id: instanceId });
    else if (!next && current.current?.kind === "instance") report(null);
  }, [report]);

  useEffect(() => {
    const offSelection = viewer.on("selection", reportSelection);
    // A picked or dropped harness (root level only: a child system's harnesses are not selectable here).
    const offHarness = viewer.on("harness", (detail) => {
      if (detail?.phase !== "select") return;
      if (detail.harness && !detail.harness.level) report({ kind: "harness", id: detail.harness.id });
      else if (!detail.harness && current.current?.kind === "harness") report(null);
    });
    return () => {
      offSelection();
      offHarness();
    };
  }, [report, reportSelection, viewer]);

  // The workspace selection, shown in the viewer once the scene draws it.
  useEffect(() => {
    if (!element || !scene || !onSelect) return;
    const key = selectionKey(selection);
    if (fromViewer.current === key) return;
    const action = viewerActionFor(selection, scene, document);
    if (!action) return;
    fromViewer.current = key;
    // react-doctor-disable-next-line no-pass-data-to-parent - `viewer` is the element adapter, not a parent callback
    viewer.show(action, () => fromViewer.current === key);
  }, [element, viewer, scene, document, selection, onSelect]);

  return reportSelection;
}
