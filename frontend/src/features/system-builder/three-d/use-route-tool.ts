/**
 * The Route tool (CONTRACTS §16.6, mockup 10): the 3D tab's toggle, the
 * viewer's harness selection and drags, and the one `apply` each gesture
 * sends. The release of a drag becomes a waypoint, a moved waypoint or a moved
 * branch point through `harness/route-edits`; while it lasts the pane draws the
 * TS curve twin's preview.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useHotkeys } from "@/hooks/use-hotkeys";
import type {
  PrismSemanticViewerElement,
  PrismSystemHarnessDragDetail,
  PrismSystemHarnessSelectDetail,
} from "@/types/prism-semantic-viewer";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import {
  addWaypointOps,
  moveWaypointOps,
  objectAt,
  removeBranchPointOps,
  removeWaypointOps,
  setBranchPointOps,
  straightenOps,
  type RouteObject,
} from "../harness/route-edits";
import { dragPreview, type RouteDrag, type RoutePreview } from "./route-scene";

export interface PointNm {
  xNm: number;
  yNm: number;
  zNm: number;
}

export interface RouteToolOptions {
  element: PrismSemanticViewerElement | null;
  document: SystemDocument;
  bundle: SystemBundle | null;
  selected: ReadonlySet<string>;
  onSelect: (ids: Set<string>) => void;
  apply: (ops: SystemOp[]) => Promise<unknown>;
  canEdit: boolean;
  /** Turn Move off when routing starts. */
  onMove: (on: boolean) => void;
}

export interface RouteTool {
  routing: boolean;
  setRouting: (on: boolean) => void;
  /** The drag in flight, while `start`/`move` keep it alive. */
  drag: RouteDrag | null;
  /** The dragged tube's translucent replacement, for the scene descriptor. */
  preview: RoutePreview | null;
  /** What the selection names, when it names a route object. */
  object: RouteObject | null;
  /** The selected id that names it. */
  objectId: string | null;
  moveWaypoint: (harness: string, id: string, positionNm: PointNm) => void;
  moveBranchPoint: (harness: string, id: string, positionNm: PointNm) => void;
  remove: (id: string) => void;
  straighten: (harness: string, segmentId: string) => void;
}

const report = (error: unknown) => toast.error(error instanceof Error ? error.message : String(error));

/** Viewer millimetres to the document's whole nanometres. */
const pointNm = (point: readonly number[]): PointNm => ({
  xNm: Math.round(point[0] * 1e6),
  yNm: Math.round(point[1] * 1e6),
  zNm: Math.round(point[2] * 1e6),
});

/** Run `command` once the element's script has defined it. */
function whenReady(element: PrismSemanticViewerElement | null, command: (element: PrismSemanticViewerElement) => void) {
  if (!element) return;
  void customElements.whenDefined("prism-semantic-viewer").then(() => command(element));
}

export function useRouteTool({ element, document, bundle, selected, onSelect, apply, canEdit, onMove }: RouteToolOptions): RouteTool {
  const [routing, setRoutingState] = useState(false);
  const [drag, setDrag] = useState<RouteDrag | null>(null);

  // The listeners are added once per element; callbacks read the latest props.
  const latest = useRef({ document, bundle, selected, onSelect, apply, onMove });
  useEffect(() => {
    latest.current = { document, bundle, selected, onSelect, apply, onMove };
  });

  const setRouting = (on: boolean) => {
    setRoutingState(on);
    if (on) latest.current.onMove(false);
  };

  const selection = useMemo(() => {
    for (const id of selected) {
      const found = objectAt(document, bundle, id);
      if (found) return { id, object: found };
    }
    return null;
  }, [selected, document, bundle]);

  const preview = useMemo<RoutePreview | null>(
    () => (drag ? { harness: drag.harness, segments: dragPreview(document, bundle, drag) } : null),
    [drag, document, bundle],
  );

  useEffect(() => whenReady(element, (viewer) => viewer.setRouteMode?.(routing)), [element, routing]);

  // A gesture is one request; its builder's refusal is shown, never swallowed.
  const send = (make: () => SystemOp[]) => {
    try {
      const ops = make();
      if (ops.length) void Promise.resolve(latest.current.apply(ops)).catch(report);
    } catch (error) {
      report(error);
    }
  };

  useEffect(() => {
    if (!element) return undefined;
    const onHarnessSelect = (event: Event) => {
      const detail = (event as CustomEvent<PrismSystemHarnessSelectDetail>).detail;
      const current = latest.current;
      current.onSelect(detail.shiftKey ? new Set([...current.selected, detail.id]) : new Set([detail.id]));
    };
    const onHarnessDrag = (event: Event) => {
      const detail = (event as CustomEvent<PrismSystemHarnessDragDetail>).detail;
      if (detail.phase === "cancel") {
        setDrag(null);
        return;
      }
      if (detail.phase !== "end") {
        setDrag({ harness: detail.harness, target: detail.target, fromMm: detail.fromMm, pointMm: detail.pointMm });
        return;
      }
      setDrag(null);
      const current = latest.current;
      const position = pointNm(detail.pointMm);
      try {
        if (detail.target.kind === "segment") {
          const result = addWaypointOps(current.document, current.bundle, detail.harness, detail.target.id, position, detail.fromMm);
          void Promise.resolve(current.apply(result.ops))
            .then(() => current.onSelect(new Set([result.id])))
            .catch(report);
          return;
        }
        const ops = detail.target.kind === "waypoint"
          ? moveWaypointOps(current.document, detail.harness, detail.target.id, position)
          : setBranchPointOps(current.document, current.bundle, detail.harness, detail.target.id, position);
        void Promise.resolve(current.apply(ops)).catch(report);
      } catch (error) {
        report(error);
      }
    };
    element.addEventListener("prism-semantic-viewer:harness-select", onHarnessSelect);
    element.addEventListener("prism-semantic-viewer:harness-drag", onHarnessDrag);
    return () => {
      element.removeEventListener("prism-semantic-viewer:harness-select", onHarnessSelect);
      element.removeEventListener("prism-semantic-viewer:harness-drag", onHarnessDrag);
    };
  }, [element]);

  const remove = (id: string) => {
    const current = latest.current;
    const found = objectAt(current.document, current.bundle, id);
    if (!found) return;
    if (found.kind === "auto") {
      report(new Error("The automatic breakout can't be removed — move it instead"));
      return;
    }
    if (found.kind === "segment") {
      report(new Error("Select a waypoint or branch point to remove"));
      return;
    }
    try {
      const ops = found.kind === "waypoint"
        ? removeWaypointOps(current.document, found.harness, id)
        : removeBranchPointOps(current.document, found.harness, id);
      void Promise.resolve(current.apply(ops)).then(() => current.onSelect(new Set())).catch(report);
    } catch (error) {
      report(error);
    }
  };

  const removeSelected = () => {
    const current = latest.current;
    const id = selectedId(current.selected, current.document, current.bundle);
    if (id) remove(id);
  };

  useHotkeys([
    { combo: "r", handler: () => setRouting(!routing) },
  ], { enabled: Boolean(element) && canEdit });
  useHotkeys([
    { combo: "delete", handler: removeSelected },
    { combo: "backspace", handler: removeSelected },
  ], { enabled: routing && canEdit });
  useHotkeys([
    { combo: "escape", handler: () => setDrag(null) },
  ], { enabled: routing });

  return {
    routing,
    setRouting,
    drag,
    preview,
    object: selection?.object ?? null,
    objectId: selection?.id ?? null,
    moveWaypoint: (harness, id, position) => send(() => moveWaypointOps(latest.current.document, harness, id, position)),
    moveBranchPoint: (harness, id, position) => send(() => setBranchPointOps(latest.current.document, latest.current.bundle, harness, id, position)),
    remove,
    straighten: (harness, segmentId) => send(() => straightenOps(latest.current.document, harness, segmentId)),
  };
}

/** The selected id that names a waypoint or branch point, for the delete keys. */
function selectedId(selected: ReadonlySet<string>, document: SystemDocument, bundle: SystemBundle | null): string {
  for (const id of selected) {
    const found = objectAt(document, bundle, id);
    if (found && (found.kind === "waypoint" || found.kind === "branch-point")) return id;
  }
  return "";
}
