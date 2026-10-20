/**
 * The system's 3D tab (stage 3b, ADR §2.6–2.7, mockup 06): every board drawn
 * from its analytic bundle where the system bundle places it, selection
 * shared with the other pane, free boards and group roots moved with the
 * gizmo or typed values, and the two explodes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize, Move3d, MousePointer2 } from "lucide-react";
import { toast } from "sonner";

import { useHotkeys } from "@/hooks/use-hotkeys";
import type { PrismScenePose, PrismSemanticViewerElement, PrismSystemSceneMoveState, PrismSystemViewerSelection } from "@/types/prism-semantic-viewer";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import { MoveCard, type Snap } from "./move-card";
import { OccurrenceCard } from "./occurrence-card";
import { poseOps, positioningMateOps } from "./pose-edits";
import { buildSceneDescriptor } from "./scene-descriptor";
import { useMemberAssets } from "./use-member-assets";
import { DEFAULT_VIEW, ViewCard, type ViewSettings } from "./view-card";

export interface ThreeDPaneProps {
  document: SystemDocument;
  bundle: SystemBundle | null;
  projectNames: Record<string, string>;
  selected: ReadonlySet<string>;
  onSelect: (ids: Set<string>) => void;
  canEdit: boolean;
  busy: boolean;
  apply: (ops: SystemOp[]) => Promise<unknown>;
  /** A B2B row's nets to light on their boards, and the two connectors to frame; null clears. */
  lit?: { key: string; members: { occurrence: string; net: string }[]; parts: { occurrence: string; reference: string }[] } | null;
  /** Open a mate's B2B tab. */
  onOpenMate?: (mate: string) => void;
}

const DEFAULT_SNAP: Snap = { mm: 0.5, deg: 15 };

/** Run `command` once the element's script has defined it. */
function whenReady(element: PrismSemanticViewerElement | null, command: (element: PrismSemanticViewerElement) => void) {
  if (!element) return;
  void customElements.whenDefined("prism-semantic-viewer").then(() => command(element));
}

const report = (error: unknown) => toast.error(error instanceof Error ? error.message : String(error));

export function ThreeDPane({ document, bundle, projectNames, selected, onSelect, canEdit, busy, apply, lit = null, onOpenMate }: ThreeDPaneProps) {
  const [element, setElement] = useState<PrismSemanticViewerElement | null>(null);
  const assets = useMemberAssets(document);
  const scene = useMemo(() => buildSceneDescriptor(document, bundle, assets), [document, bundle, assets]);
  const [move, setMove] = useState<PrismSystemSceneMoveState | null>(null);
  const [snap, setSnap] = useState<Snap>(DEFAULT_SNAP);
  const [view, setView] = useState<ViewSettings>(DEFAULT_VIEW);
  // A save landed or the target changed: the Move card starts over.
  const [epoch, setEpoch] = useState(0);

  const occurrenceIds = useMemo(() => new Set(document.occurrences.map((item) => item.id)), [document]);
  const single = selected.size === 1 ? [...selected][0] : null;
  const selectedBoard = single && occurrenceIds.has(single) ? single : null;

  // Callbacks read the latest props through a ref; the listeners are added once per element.
  const latest = useRef({ document, onSelect, apply, occurrenceIds });
  useEffect(() => {
    latest.current = { document, onSelect, apply, occurrenceIds };
  });

  useEffect(() => {
    if (!element) return;
    const onSelection = (event: CustomEvent<{ selection: unknown }>) => {
      const selection = event.detail.selection as PrismSystemViewerSelection | null;
      const occurrence = selection && "occurrence" in selection ? selection.occurrence : undefined;
      latest.current.onSelect(occurrence && latest.current.occurrenceIds.has(occurrence) ? new Set([occurrence]) : new Set());
    };
    const onMove = (event: CustomEvent<PrismSystemSceneMoveState>) => {
      const state = event.detail;
      setMove(state);
      if (state.phase === "target" || state.phase === "sync" || state.phase === "cancel") setEpoch((value) => value + 1);
      if (state.phase === "commit" && state.target) {
        const target = state.target;
        latest.current.apply(poseOps(latest.current.document, target.occurrence, target.pose))
          .then(() => setEpoch((value) => value + 1))
          .catch((error: unknown) => {
            element.cancelMove?.();
            report(error);
          });
      }
    };
    element.addEventListener("prism-semantic-viewer:selectionchange", onSelection as EventListener);
    element.addEventListener("prism-semantic-viewer:move", onMove);
    return () => {
      element.removeEventListener("prism-semantic-viewer:selectionchange", onSelection as EventListener);
      element.removeEventListener("prism-semantic-viewer:move", onMove);
    };
  }, [element]);

  useEffect(() => whenReady(element, (viewer) => viewer.setSystemScene?.(scene)), [element, scene]);
  useEffect(() => whenReady(element, (viewer) => viewer.setMoveSnap?.(snap)), [element, snap]);
  useEffect(() => whenReady(element, (viewer) => {
    viewer.setAssemblyExplode?.(view.assembly);
    viewer.setLabelsVisible?.(view.labels);
    viewer.setShowComponents(view.parts);
    for (const occurrence of scene.occurrences) {
      const own = view.stackupScope === "all" || occurrence.path === selectedBoard;
      viewer.setSeparation(own ? view.stackup : 0, occurrence.path);
    }
  }), [element, view, scene, selectedBoard]);
  // A B2B row lights its net on both boards and frames the two connectors (mockup 04).
  const litKey = lit?.key ?? null;
  useEffect(() => whenReady(element, (viewer) => {
    viewer.setNetEmphasis?.(lit ? [{ key: lit.key, members: lit.members }] : []);
    if (lit) viewer.frameParts?.(lit.parts);
    // `litKey` names `lit`: a new row, not a new object for the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [element, litKey]);
  // The other pane's selection shows here; the viewer does not echo it back.
  useEffect(() => whenReady(element, (viewer) => viewer.setSelection(selectedBoard ? { occurrence: selectedBoard } : null)), [element, selectedBoard]);

  const moving = Boolean(move?.enabled);
  const setMoving = (enabled: boolean) => whenReady(element, (viewer) => viewer.setMoveMode?.(enabled));
  useHotkeys([
    { combo: "m", handler: () => setMoving(!moving) },
    { combo: "f", handler: () => element?.frameAll?.() },
  ], { enabled: Boolean(element) });

  const target = moving ? move?.target ?? null : null;
  const targetOccurrence = target ? document.occurrences.find((item) => item.id === target.occurrence) : undefined;
  const placedTarget = target ? scene.occurrences.find((item) => item.path === target.occurrence) : undefined;
  const isGroupRoot = Boolean(target && document.mates.some((mate) => mate.a.occurrence === target.occurrence || mate.b.occurrence === target.occurrence));

  return (
    <div className="relative h-full bg-[#e8edf0]">
      <prism-semantic-viewer
        ref={setElement}
        mode="system"
        hide-panel="true"
        active="true"
        move-allowed={canEdit ? "true" : "false"}
        className="block h-full w-full"
      />
      {!bundle?.placement && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-500">Placing the boards…</div>
      )}
      {/* One column on the right: the View card, then the selected board's card (no overlap in a narrow pane). */}
      <div className="absolute right-4 top-3 z-10 flex max-h-[calc(100%-5rem)] flex-col items-end gap-3 overflow-auto">
        <ViewCard view={view} onChange={setView} hasSelection={Boolean(selectedBoard)} />
        {selectedBoard && !(target && target.occurrence === selectedBoard && placedTarget?.movable) && (
          <OccurrenceCard
            document={document}
            bundle={bundle}
            occurrence={selectedBoard}
            projectNames={projectNames}
            canEdit={canEdit}
            busy={busy}
            onPositioningMate={(mate) => void apply(positioningMateOps(document, selectedBoard, mate)).catch(report)}
            onOpenMate={onOpenMate}
          />
        )}
      </div>
      {move && target && targetOccurrence && placedTarget?.movable && (
        <div className="absolute bottom-16 left-4 z-10">
          <MoveCard
            key={`${target.occurrence}:${epoch}`}
            label={targetOccurrence.label}
            role={isGroupRoot ? "group root" : "free board"}
            state={move}
            target={target}
            snap={snap}
            busy={busy}
            onPreview={(pose: PrismScenePose | null) => element?.previewPose?.(pose)}
            onPlace={(pose) => void apply(poseOps(document, target.occurrence, pose)).then(() => setEpoch((value) => value + 1)).catch((error: unknown) => {
              element?.cancelMove?.();
              report(error);
            })}
            onReset={() => void apply(poseOps(document, target.occurrence, null)).then(() => setEpoch((value) => value + 1)).catch(report)}
            onCancel={() => element?.cancelMove?.()}
            onSpace={(space) => element?.setMoveSpace?.(space)}
            onSnap={setSnap}
          />
        </div>
      )}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/95 p-1 text-zinc-100 shadow-xl" role="toolbar" aria-label="3D tools">
        <PaneButton active={!moving} onClick={() => setMoving(false)} icon={MousePointer2} label="Select" />
        {canEdit && <PaneButton active={moving} onClick={() => setMoving(!moving)} icon={Move3d} label="Move (M)" />}
        <PaneButton active={false} onClick={() => element?.frameAll?.()} icon={Maximize} label="Fit (F)" />
      </div>
    </div>
  );
}

function PaneButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Maximize; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs ${active ? "bg-white/15 text-white" : "text-zinc-300 hover:bg-white/10"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
