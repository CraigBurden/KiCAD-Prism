/**
 * A harness block's tab (stage 4b, CONTRACTS §16.5, mockup 09): the
 * configurator's toolbar, canvas, inspector and wire defaults bar. Every
 * gesture becomes one `apply` of the ops `harness-edits` builds; selection is
 * the page's, shared with the schematic.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { newId } from "../model/ids";
import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import { EndDialog } from "./end-dialog";
import { HarnessCanvas, type InsertKind } from "./harness-canvas";
import { HarnessDefaults } from "./harness-defaults";
import { readWireDefaults, writeWireDefaults, type WireDefaults } from "./harness-defaults-store";
import { HarnessDialogs, type HarnessDialogKind } from "./harness-dialogs";
import {
  addBranchPointOps,
  addCableOps,
  addCoveringOps,
  addLooseEndOps,
  addMarkerOps,
  addSpliceOps,
  addWireOps,
  autoLayoutOps,
  canvasOps,
  confirmWireOps,
  removeWireOps,
  setWireOps,
} from "./harness-edits";
import { activeFindings } from "./harness-format";
import { pointNm, removeObjectOp } from "./harness-gestures";
import { HarnessInspector } from "./harness-inspector";
import { layoutHarness, type Point } from "./harness-layout";
import { HarnessToolbar } from "./harness-toolbar";
import { buildHarnessView, type TerminalView } from "./harness-view";
import type { WireChange } from "./harness-wire-inspector";
import { QuickPartDialog } from "./quick-part-dialog";

export interface HarnessPaneProps {
  document: SystemDocument;
  bundle: SystemBundle | null;
  harness: string;
  canEdit: boolean;
  busy: boolean;
  apply: (ops: SystemOp[]) => Promise<unknown>;
  /** The page's selection, shared with the schematic (§16.5). */
  selected: ReadonlySet<string>;
  onSelect: (ids: Set<string>) => void;
  /** Open the Route tool's 3D tab beside this harness (mockup 10). */
  onRouteIn3D?: () => void;
}

const report = (error: unknown) => toast.error(error instanceof Error ? error.message : String(error));

export function HarnessPane({ document, bundle, harness, canEdit, busy, apply, selected, onSelect, onRouteIn3D }: HarnessPaneProps) {
  const view = useMemo(() => buildHarnessView(document, bundle, harness), [document, bundle, harness]);
  const layout = useMemo(() => (view ? layoutHarness(view, document.layout) : null), [view, document.layout]);
  const [xray, setXray] = useState(true);
  const [labels, setLabels] = useState(true);
  const [defaults, setDefaults] = useState<WireDefaults>(readWireDefaults);
  const [dialog, setDialog] = useState<HarnessDialogKind | null>(null);
  const [editingEnd, setEditingEnd] = useState<string | null>(null);
  const [creatingPart, setCreatingPart] = useState(false);

  if (!view || !layout) {
    return <div className="flex h-full items-center justify-center bg-[#050c1c] text-sm text-zinc-400">This harness is no longer in the system.</div>;
  }

  /** One gesture, one request; a builder's refusal is shown, never swallowed. */
  const send = (make: () => SystemOp[]) => {
    if (!canEdit) return;
    try {
      const ops = make();
      if (ops.length) void apply(ops).catch(report);
    } catch (error) {
      report(error);
    }
  };

  /** At the pointer for a key; from the toolbar, the auto-layout's middle column, clear of other nodes. */
  const insertAt = (kind: InsertKind, at?: { xNm: number; yNm: number }) =>
    send(() => {
      if (kind === "splice") return addSpliceOps(document, view, at);
      if (kind === "pigtail") return addLooseEndOps(document, view, at);
      return addBranchPointOps(document, view, at);
    });

  const selectedWires = view.wires.flatMap((wire) => (selected.has(wire.id) ? [wire.id] : []));
  const selectedSegment = view.segments.find((segment) => selected.has(segment.id))?.id;

  const addCable = () => send(() => addCableOps(view, selectedWires));
  const addCovering = () => {
    if (selectedSegment) send(() => addCoveringOps(view, selectedSegment));
    else toast.error("Select a segment first");
  };
  const addMarker = () => {
    if (selectedWires.length === 1) send(() => addMarkerOps(view, selectedWires[0]));
    else toast.error("Select one wire first");
  };

  /** A default wire edited or confirmed becomes a new explicit wire; keep it selected. */
  const reselect = (wireId: string, make: (id: string) => SystemOp[]) => {
    const id = newId("wire");
    send(() => make(id));
    if (canEdit && view.wires.find((item) => item.id === wireId)?.origin === "default") onSelect(new Set([id]));
  };

  const onWire = (from: TerminalView, to: TerminalView) => send(() => addWireOps(view, from, to, defaults));
  const onMove = (id: string, at: Point) => send(() => canvasOps(document, id, pointNm(at)));

  const removeById = (id: string) => {
    const wire = view.wires.find((item) => item.id === id);
    if (wire) {
      send(() => removeWireOps(view, wire.id));
      onSelect(new Set());
      return;
    }
    const op = removeObjectOp(view, id);
    if (op) {
      send(() => [op]);
      onSelect(new Set());
    }
  };

  const removeSelection = () => {
    if (!canEdit) return;
    try {
      const ops = [...selected].flatMap((id): SystemOp[] => {
        const wire = view.wires.find((item) => item.id === id);
        if (wire) return removeWireOps(view, wire.id);
        const op = removeObjectOp(view, id);
        return op ? [op] : [];
      });
      if (!ops.length) return;
      void apply(ops).catch(report);
      onSelect(new Set());
    } catch (error) {
      report(error);
    }
  };

  const changeDefaults = (next: WireDefaults) => {
    setDefaults(next);
    writeWireDefaults(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#050c1c] text-zinc-100">
      <HarnessToolbar
        canEdit={canEdit}
        busy={busy}
        xray={xray}
        labels={labels}
        findings={activeFindings(view.findings).length}
        onInsert={(kind) => insertAt(kind)}
        onCable={addCable}
        onCovering={addCovering}
        onMarker={addMarker}
        onAutoLayout={() => send(() => autoLayoutOps(document, view))}
        onToggleXray={() => setXray((value) => !value)}
        onToggleLabels={() => setLabels((value) => !value)}
        onNewPart={() => setCreatingPart(true)}
        onOpen={setDialog}
        onRouteIn3D={onRouteIn3D}
      />
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <HarnessCanvas
            document={document}
            view={view}
            layout={layout}
            canEdit={canEdit}
            xray={xray}
            labels={labels}
            selected={selected}
            onSelect={onSelect}
            onWire={onWire}
            onMove={onMove}
            onInsert={insertAt}
            onCable={addCable}
            onCovering={addCovering}
            onMarker={addMarker}
            onDelete={removeSelection}
            onOpenEnd={setEditingEnd}
            onToggleXray={() => setXray((value) => !value)}
            onToggleLabels={() => setLabels((value) => !value)}
          />
          <HarnessDefaults defaults={defaults} disabled={!canEdit || busy} onChange={changeDefaults} />
        </div>
        <HarnessInspector
          view={view}
          selected={selected}
          canEdit={canEdit}
          busy={busy}
          onSetWire={(id: string, changes: WireChange) => reselect(id, (next) => setWireOps(view, id, changes, next))}
          onConfirmWire={(id: string) => reselect(id, (next) => confirmWireOps(view, id, next))}
          onRemove={removeById}
          onEditEnd={setEditingEnd}
        />
      </div>
      <HarnessDialogs view={view} open={dialog} onClose={() => setDialog(null)} />
      {editingEnd && (
        <EndDialog
          view={view}
          endId={editingEnd}
          document={document}
          canEdit={canEdit}
          apply={apply}
          onClose={() => setEditingEnd(null)}
        />
      )}
      {creatingPart && (
        <QuickPartDialog
          onClose={() => setCreatingPart(false)}
          onCreated={(component) => toast.success(`${component.name || component.value} created; in review.`)}
        />
      )}
    </div>
  );
}
