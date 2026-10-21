/**
 * The system's 3D tab (stage 3b, ADR §2.6–2.7, mockup 06): every board drawn
 * from its analytic bundle where the system bundle places it, selection
 * shared with the other pane, free boards and group roots moved with the
 * gizmo or typed values, and the two explodes. Bodies (stage 3d) draw their
 * catalog model; connector parts are placed on their faces (mockup 08).
 * A placed published entry draws as its contents, one rigid group (§15.3).
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useHotkeys } from "@/hooks/use-hotkeys";
import type { PrismScenePose, PrismSemanticViewerElement, PrismSystemSceneMoveState } from "@/types/prism-semantic-viewer";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import { AddBodyDialog } from "./add-body-dialog";
import { addBodyConnectorOps, addBodyOps, addEntryOps, faceFramePose, nextRefdes } from "./body-edits";
import { entryPartRefs, useEntryContents } from "./entry-contents";
import { MoveCard, type Snap } from "./move-card";
import { PaneToolbar } from "./pane-toolbar";
import { usePartModels } from "./part-models";
import { PlaceConnectorCard, type Placing } from "./place-connector-card";
import { OccurrenceCard } from "./occurrence-card";
import { poseOps, positioningMateOps, storedPose } from "./pose-edits";
import { RouteCard } from "./route-card";
import { systemNetEmphasis } from "./net-emphasis";
import { buildSceneDescriptor } from "./scene-descriptor";
import { useMemberAssets } from "./use-member-assets";
import { useRouteTool } from "./use-route-tool";
import { useViewerEvents } from "./use-viewer-events";
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
  /** Open a harness's tab (the route card's action). */
  onOpenHarness?: (harness: string) => void;
}
const DEFAULT_SNAP: Snap = { mm: 0.5, deg: 15 };

/** Run `command` once the element's script has defined it. */
function whenReady(element: PrismSemanticViewerElement | null, command: (element: PrismSemanticViewerElement) => void) {
  if (!element) return;
  void customElements.whenDefined("prism-semantic-viewer").then(() => command(element));
}

const report = (error: unknown) => toast.error(error instanceof Error ? error.message : String(error));

/** The document with the connector being placed added, once its part and face are chosen. */
function previewDocument(document: SystemDocument, placing: Placing | null): SystemDocument {
  if (!placing?.part || !placing.frame) return document;
  const preview = {
    id: "bc_preview",
    occurrence: placing.body,
    refdes: placing.refdes.trim() || "J?",
    part: { componentId: placing.part.componentId, revisionId: placing.part.revisionId },
    frame: storedPose(placing.frame),
    quarterTurns: placing.quarterTurns,
  };
  return { ...document, bodyConnectors: [...document.bodyConnectors.filter((item) => !(item.occurrence === preview.occurrence && item.refdes === preview.refdes)), preview] };
}

export function ThreeDPane({ document, bundle, projectNames, selected, onSelect, canEdit, busy, apply, lit = null, onOpenMate, onOpenHarness }: ThreeDPaneProps) {
  const [element, setElement] = useState<PrismSemanticViewerElement | null>(null);
  const [move, setMove] = useState<PrismSystemSceneMoveState | null>(null);
  const [snap, setSnap] = useState<Snap>(DEFAULT_SNAP);
  const [view, setView] = useState<ViewSettings>(DEFAULT_VIEW);
  // A save landed or the target changed: the Move card starts over.
  const [epoch, setEpoch] = useState(0);
  const setMoving = (enabled: boolean) => whenReady(element, (viewer) => viewer.setMoveMode?.(enabled));
  // The Route tool owns its toggle, drags and the preview the scene draws.
  const route = useRouteTool({
    element,
    document,
    bundle,
    selected,
    onSelect,
    apply,
    canEdit,
    onMove: setMoving,
  });
  const entries = useEntryContents(document);
  const assets = useMemberAssets(document, entries);
  // Adding from the catalog: a body or a published system.
  const [adding, setAdding] = useState<"body" | "entry" | null>(null);
  const [placing, setPlacing] = useState<Placing | null>(null);
  // While placing, the connector shows where it would go: a preview in a copy of the document.
  const shown = useMemo(() => previewDocument(document, placing), [document, placing]);
  const partRefs = useMemo(() => [
    ...shown.occurrences.flatMap((item) => (item.source.kind === "body" ? [item.source] : [])),
    ...shown.bodyConnectors.map((item) => item.part),
    ...[...entries.values()].flatMap((contents) => (contents ? entryPartRefs(contents) : [])),
  ], [shown, entries]);
  const models = usePartModels(partRefs);
  // The tool needs its tubes visible even when the view's toggle is off.
  const showHarnesses = view.harnesses || route.routing;
  const scene = useMemo(
    () => buildSceneDescriptor(shown, bundle, assets, models, entries, selected, showHarnesses, route.preview),
    [shown, bundle, assets, models, entries, selected, showHarnesses, route.preview],
  );

  const occurrenceIds = useMemo(() => new Set(document.occurrences.map((item) => item.id)), [document]);
  const single = selected.size === 1 ? [...selected][0] : null;
  const selectedBoard = single && occurrenceIds.has(single) ? single : null;
  // A net clicked on one board lights on every board its system net reaches.
  const [pickedNet, setPickedNet] = useState<{ occurrence: string; net: string } | null>(null);
  const picked = useMemo(() => systemNetEmphasis(bundle, pickedNet), [bundle, pickedNet]);
  useViewerEvents({
    element,
    document,
    occurrenceIds,
    onSelect,
    onPickNet: setPickedNet,
    apply,
    onMoveState: setMove,
    onSettled: () => setEpoch((value) => value + 1),
    onFailed: (error) => {
      element?.cancelMove?.();
      report(error);
    },
  });

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
    if (lit) viewer.frameParts?.(lit.parts);
    // `litKey` names `lit`: a new row, not a new object for the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [element, litKey]);
  const pickedKey = picked ? `${picked.key}:${picked.members.length}` : null;
  useEffect(() => whenReady(element, (viewer) => {
    const sets = [
      ...(lit ? [{ key: lit.key, members: lit.members }] : []),
      ...(picked && picked.key !== lit?.key ? [picked] : []),
    ];
    viewer.setNetEmphasis?.(sets);
    // The keys name the sets: a new row or net, not a new object for the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [element, litKey, pickedKey]);
  // The other pane's selection shows here; the viewer does not echo it back.
  useEffect(() => whenReady(element, (viewer) => viewer.setSelection(selectedBoard ? { occurrence: selectedBoard } : null)), [element, selectedBoard]);

  const moving = Boolean(move?.enabled);
  useHotkeys([
    { combo: "m", handler: () => { route.setRouting(false); setMoving(!moving); } },
    { combo: "f", handler: () => element?.frameAll?.() },
  ], { enabled: Boolean(element) });

  // Placing a connector, a click on the body's model picks the face it goes on.
  const placingBody = placing?.body ?? null;
  useEffect(() => {
    if (!element || !placingBody) return undefined;
    const onClick = (event: MouseEvent) => {
      const hit = element.pickSurfaceAt?.(event.clientX, event.clientY);
      const body = scene.occurrences.find((item) => item.path === placingBody);
      if (!hit || hit.occurrence !== placingBody || !body) return;
      const frame = faceFramePose(body.pose, hit.pointMm, hit.normal);
      setPlacing((current) => (current ? { ...current, frame } : current));
    };
    element.addEventListener("click", onClick);
    return () => element.removeEventListener("click", onClick);
  }, [element, placingBody, scene]);
  const startPlacing = (body: string) => {
    setMoving(false);
    route.setRouting(false);
    setPlacing({ body, part: null, refdes: nextRefdes(document, body), quarterTurns: 0, frame: null });
  };
  const place = () => {
    if (!placing?.part || !placing.frame) return;
    try {
      const ops = addBodyConnectorOps(document, { body: placing.body, refdes: placing.refdes, part: placing.part, frame: placing.frame, quarterTurns: placing.quarterTurns });
      void apply(ops).then(() => setPlacing(null)).catch(report);
    } catch (error) {
      report(error);
    }
  };

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
        {(route.routing || route.object) && (
          <RouteCard
            document={document}
            bundle={bundle}
            selected={selected}
            routing={route.routing}
            object={route.object}
            objectId={route.objectId}
            drag={route.drag}
            preview={route.preview}
            canEdit={canEdit}
            busy={busy}
            onMoveWaypoint={route.moveWaypoint}
            onMoveBranchPoint={route.moveBranchPoint}
            onRemove={route.remove}
            onStraighten={route.straighten}
            onOpenHarness={onOpenHarness}
          />
        )}
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
            onPlaceConnector={canEdit && !placing ? () => startPlacing(selectedBoard) : undefined}
          />
        )}
      </div>
      {placing && (
        <div className="absolute bottom-16 left-4 z-10">
          <PlaceConnectorCard
            bodyLabel={document.occurrences.find((item) => item.id === placing.body)?.label ?? placing.body}
            placing={placing}
            busy={busy}
            onChange={setPlacing}
            onPlace={place}
            onCancel={() => setPlacing(null)}
          />
        </div>
      )}
      {adding && (
        <AddBodyDialog
          adding={adding}
          onClose={() => setAdding(null)}
          onAdd={async (part) => {
            const { ops, occurrence } = adding === "entry" ? addEntryOps(document, part) : addBodyOps(document, part);
            await apply(ops);
            setAdding(null);
            onSelect(new Set([occurrence]));
          }}
        />
      )}
      {!placing && move && target && targetOccurrence && placedTarget?.movable && (
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
      <PaneToolbar
        moving={moving}
        routing={route.routing}
        canEdit={canEdit}
        adding={adding}
        onSelect={() => { setMoving(false); route.setRouting(false); }}
        onMove={() => { route.setRouting(false); setMoving(!moving); }}
        onRoute={() => route.setRouting(!route.routing)}
        onAddBody={() => setAdding("body")}
        onAddEntry={() => setAdding("entry")}
        onFit={() => element?.frameAll?.()}
      />
    </div>
  );
}
