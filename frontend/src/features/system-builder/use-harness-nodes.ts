import { useEffect, useRef, useState } from "react";

import type { SemanticViewer } from "@/lib/semantic-viewer";
import type { PrismSystemSceneHarnessState } from "@/types/prism-semantic-viewer";
import type { HarnessNodeInput, SystemScene } from "@/types/system";

import {
  AUTO, addBreakout, addWaypoint, alongSamples, moveNode, nodeInputs, removeNode, setPinned, storeAuto,
} from "./harness-node-edits";
import { useSystemSession } from "./session/use-system-session";

type Vec3 = [number, number, number];

/** A segment end that is the automatic breakout is stored first, so the edit can name it. */
function withSegment(nodes: HarnessNodeInput[], at: PrismSystemSceneHarnessState | null) {
  const segment = at?.segment;
  if (!segment) return null;
  let [from, to] = [segment.from, segment.to];
  let list = nodes;
  if ((from === AUTO || to === AUTO) && at?.autoMm) {
    const stored = storeAuto(list, at.autoMm);
    list = stored.nodes;
    [from, to] = [from === AUTO ? stored.id : from, to === AUTO ? stored.id : to];
  }
  return { nodes: list, from, to, along: alongSamples(segment.samplesMm) };
}

/**
 * SB2-45b: the picked harness in the System 3D tab and edits to its breakouts
 * and waypoints. The viewer previews a dragged node; a released drag ("commit")
 * or the panel's buttons save the harness's whole node list with If-Match, and
 * a failed save puts the node back.
 */
export function useHarnessNodes(viewer: SemanticViewer, scene: SystemScene | null) {
  const [state, setState] = useState<PrismSystemSceneHarnessState | null>(null);
  const { busy, edit } = useSystemSession();
  // A node to give the gizmo once the re-read scene reaches the viewer (it does not exist there before).
  const pendingTarget = useRef<string | null | undefined>(undefined);

  /** The stored nodes of the picked root-level harness, as the save takes them. */
  const stored = (): HarnessNodeInput[] | null => {
    const id = state?.harness?.id;
    const harness = id && !state?.harness?.level ? scene?.harnesses?.find((h) => h.id === id && !h.level) : null;
    return harness ? nodeInputs(harness.nodes ?? []) : null;
  };

  /** Save a node list; then give the gizmo to `target` (a node just added or stored). */
  const save = async (nodes: HarnessNodeInput[], success?: string, target?: string | null) => {
    const id = state?.harness?.id;
    if (!id) return false;
    pendingTarget.current = target;
    const done = await edit("nodes", (system) => system.setHarnessNodes(id, nodes), success);
    if (!done) {
      pendingTarget.current = undefined;
      viewer.cancelHarnessNode();
    }
    return Boolean(done);
  };



  /** A breakout where the tube was picked, at the end of the chain. */
  const addBreakoutAt = async (at: PrismSystemSceneHarnessState | null) => {
    const base = stored();
    const point = at?.pointMm;
    if (!base || !point) return;
    const added = addBreakout(base, point as Vec3);
    await save(added.nodes, "Breakout added", added.id);
  };

  // The viewer's commit, delete and Route-mode clicks go through the latest closure.
  const onEvent = async (next: PrismSystemSceneHarnessState) => {
    // D-P2-53: a bend dragged in Route mode is a waypoint (Alt: a breakout) where it was released,
    // ordered along the segment by where the drag started.
    if (next.phase === "route-drag") {
      const base = stored();
      const position = next.positionMm;
      if (!base || !position) return;
      if (next.breakout) {
        await addBreakoutAt({ ...next, pointMm: position });
        return;
      }
      const at = next.atMm ?? next.pointMm;
      const split = at ? withSegment(base, next) : null;
      if (!split || !at) return;
      const added = addWaypoint(split.nodes, split.from, split.to, at as Vec3, split.along);
      // Dragged means "here": pinned, so bend relaxation does not pull it back (D-P2-53).
      await save(setPinned(moveNode(added.nodes, added.id, position as Vec3), added.id, true), "Waypoint added", added.id);
      return;
    }
    const nodes = stored();
    const node = next.node;
    if (!nodes || !node) return;
    if (next.phase === "commit") {
      if (node.auto) {
        const added = storeAuto(nodes, node.positionMm);
        await save(added.nodes, undefined, added.id);
      } else await save(setPinned(moveNode(nodes, node.id, node.positionMm), node.id, true)); // dragged: pinned (D-P2-53)
    } else if (next.phase === "delete" && !node.auto) {
      await save(removeNode(nodes, node.id), node.kind === "breakout" ? "Breakout removed" : "Waypoint removed", null);
    }
  };
  const eventRef = useRef(onEvent);
  useEffect(() => {
    eventRef.current = onEvent;
  });

  useEffect(() => viewer.on("harness", (next) => {
    setState(next.harness ? next : null);
    if (next.phase === "commit" || next.phase === "delete" || next.phase === "route-drag") void eventRef.current(next);
    if (next.phase === "sync" && pendingTarget.current !== undefined) {
      const target = pendingTarget.current;
      pendingTarget.current = undefined;
      viewer.targetHarnessNode(target);
    }
  }), [viewer]);

  const nodes = stored();
  return {
    state,
    busy: busy !== null,
    /** How many breakouts and waypoints the picked harness stores. */
    counts: {
      breakouts: nodes?.filter((n) => n.kind === "breakout").length ?? 0,
      waypoints: nodes?.filter((n) => n.kind === "waypoint").length ?? 0,
    },
    setPinned: async (pinned: boolean) => {
      const base = stored();
      const node = state?.node;
      if (base && node && !node.auto) await save(setPinned(base, node.id, pinned));
    },
    remove: async () => {
      const base = stored();
      const node = state?.node;
      if (base && node && !node.auto) await save(removeNode(base, node.id), undefined, null);
    },
  };
}
