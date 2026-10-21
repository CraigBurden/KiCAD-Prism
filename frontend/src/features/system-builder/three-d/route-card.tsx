/**
 * The Route tool's card on the 3D tab (CONTRACTS §16.6, mockup 10): the
 * selected waypoint's or branch point's position (typed values commit), the
 * segment it sits on with its wires, bundle, length, bend, clearance and
 * coverings, and the straighten and open-harness actions. With nothing
 * selected it says how the tool works.
 */
import { useState } from "react";
import { toast } from "sonner";

import { buildHarnessView } from "../harness/harness-view";
import { routeOf, type Route, type RouteObject } from "../harness/route-edits";
import type { SystemBundle, SystemDocument } from "../model/types";
import type { RouteDrag, RoutePreview } from "./route-scene";
import type { PointNm } from "./use-route-tool";

export interface RouteCardProps {
  document: SystemDocument;
  bundle: SystemBundle | null;
  selected: ReadonlySet<string>;
  routing: boolean;
  object: RouteObject | null;
  objectId: string | null;
  drag: RouteDrag | null;
  preview: RoutePreview | null;
  canEdit: boolean;
  busy: boolean;
  onMoveWaypoint: (harness: string, id: string, positionNm: PointNm) => void;
  onMoveBranchPoint: (harness: string, id: string, positionNm: PointNm) => void;
  onRemove: (id: string) => void;
  onStraighten: (harness: string, segmentId: string) => void;
  onOpenHarness?: (harness: string) => void;
}

type Axis = "x" | "y" | "z";
const AXES: Axis[] = ["x", "y", "z"];
const AXIS_LABEL: Record<Axis, string> = { x: "X", y: "Y", z: "Z" };

const mm2 = (nm: number): string => (nm / 1e6).toFixed(2);
const mm1 = (nm: number): string => (nm / 1e6).toFixed(1);
const toNm = (mm: number): number => Math.round(mm * 1e6);

/** The node's point from the route's segment samples; null when no segment touches it. */
function nodePointMm(route: Route | null, id: string): [number, number, number] | null {
  for (const segment of route?.segments ?? []) {
    const count = Math.floor(segment.samplesNm.length / 3);
    if (!count) continue;
    const index = segment.from === id ? 0 : segment.to === id ? count - 1 : -1;
    if (index < 0) continue;
    return [
      segment.samplesNm[index * 3] / 1e6,
      segment.samplesNm[index * 3 + 1] / 1e6,
      segment.samplesNm[index * 3 + 2] / 1e6,
    ];
  }
  return null;
}

/** The axis a drag moves farthest, highlighted in its field. */
function draggedAxis(drag: RouteDrag | null): Axis | null {
  if (!drag) return null;
  const deltas = AXES.map((_, index) => Math.abs(drag.pointMm[index] - drag.fromMm[index]));
  const max = Math.max(...deltas);
  if (max < 1e-6) return null;
  return AXES[deltas.indexOf(max)];
}

/** A preview polyline's length, millimetres. */
function previewLengthMm(samplesMm: readonly number[]): number {
  let total = 0;
  for (let index = 3; index < samplesMm.length; index += 3) {
    total += Math.hypot(
      samplesMm[index] - samplesMm[index - 3],
      samplesMm[index + 1] - samplesMm[index - 2],
      samplesMm[index + 2] - samplesMm[index - 1],
    );
  }
  return total;
}

export function RouteCard({
  document,
  bundle,
  selected,
  routing,
  object,
  objectId,
  drag,
  preview,
  canEdit,
  busy,
  onMoveWaypoint,
  onMoveBranchPoint,
  onRemove,
  onStraighten,
  onOpenHarness,
}: RouteCardProps) {
  const harnessId = object?.harness
    ?? (routing ? drag?.harness ?? [...selected].find((id) => document.harnesses.some((item) => item.id === id)) ?? null : null);
  const harness = harnessId ? document.harnesses.find((item) => item.id === harnessId) : undefined;
  const route = routeOf(bundle, harnessId ?? "");
  const view = harness ? buildHarnessView(document, bundle, harness.id) : null;

  const waypoint = harness && object?.kind === "waypoint" ? harness.waypoints.find((item) => item.id === objectId) : undefined;
  const branchPoint = harness && object?.kind === "branch-point" ? harness.branchPoints.find((item) => item.id === objectId) : undefined;
  const segmentId = object?.kind === "segment" ? objectId : waypoint?.segment ?? null;
  const segment = segmentId ? route?.segments.find((item) => item.id === segmentId) : undefined;
  const storedSegment = segmentId ? harness?.segments.find((item) => item.id === segmentId) : undefined;

  const dragged = Boolean(objectId && drag?.target.id === objectId);
  const storedPosition = waypoint?.position ?? branchPoint?.position ?? null;
  const positionMm: [number, number, number] | null = dragged && drag
    ? [drag.pointMm[0], drag.pointMm[1], drag.pointMm[2]]
    : storedPosition
      ? [storedPosition.xNm / 1e6, storedPosition.yNm / 1e6, storedPosition.zNm / 1e6]
      : nodePointMm(route, objectId ?? "");
  const axis = dragged ? draggedAxis(drag) : null;

  const endTitle = (node: string) => view?.ends.find((end) => end.id === node)?.title ?? node;
  const occurrenceLabel = (id: string) => document.occurrences.find((item) => item.id === id)?.label ?? id;

  const wireViews = new Map((view?.wires ?? []).map((wire) => [wire.id, wire]));
  const cableIds = new Set((segment?.wires ?? []).flatMap((id) => {
    const cable = wireViews.get(id)?.cable;
    return cable ? [cable] : [];
  }));
  const cableNames = [...cableIds].map((id) => harness?.cables.find((cable) => cable.id === id)?.label ?? id);
  const coverings = harness && segmentId ? harness.coverings.filter((covering) => covering.segment === segmentId) : [];
  const segmentIndex = route && segmentId ? route.segments.findIndex((item) => item.id === segmentId) : -1;

  const previewSamples = preview?.segments.find((item) => item.segmentId === segmentId)?.samplesMm;
  const clearance = segment?.clearances.length
    ? [...segment.clearances].sort((a, b) => a.distanceNm - b.distanceNm)[0]
    : undefined;

  const commit = (index: number, value: number) => {
    if (!harness || !objectId || !positionMm) return;
    const next: [number, number, number] = [...positionMm];
    next[index] = value;
    const position: PointNm = { xNm: toNm(next[0]), yNm: toNm(next[1]), zNm: toNm(next[2]) };
    if (object?.kind === "waypoint") onMoveWaypoint(harness.id, objectId, position);
    else onMoveBranchPoint(harness.id, objectId, position);
  };

  const heading = object?.kind === "waypoint"
    ? `WAYPOINT ${objectId}${segmentIndex >= 0 ? ` · ON SEG ${segmentIndex + 1}` : ""}`
    : object?.kind === "branch-point"
      ? `BRANCH POINT ${objectId}`
      : object?.kind === "auto"
        ? "AUTOMATIC BREAKOUT"
        : null;

  return (
    <section className="w-[270px] rounded-[10px] border border-white/10 bg-zinc-900/95 p-3 text-zinc-100 shadow-xl" role="group" aria-label="Route">
      <header className="flex items-baseline justify-between gap-2">
        <h4 className="truncate text-[13.5px] font-semibold">Route{harness ? ` · ${harness.label}` : ""}</h4>
        {harness && (
          <span className="shrink-0 text-[11px] text-zinc-400">
            {harness.ends.length} ends · {(route?.segments.length ?? harness.segments.length)} segments
          </span>
        )}
      </header>

      {positionMm && heading && object && object.kind !== "segment" && (
        <div className="mt-2.5">
          <p className="text-[10.5px] font-semibold tracking-wide text-zinc-500">{heading}</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {AXES.map((key, index) => (
              <AxisField
                key={`${objectId}:${key}`}
                id={`route-position-${objectId}-${key}`}
                label={AXIS_LABEL[key]}
                valueMm={positionMm[index]}
                highlighted={axis === key}
                disabled={!canEdit || busy}
                onCommit={(value) => commit(index, value)}
              />
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="rounded-full border border-white/15 px-1.5 text-[10.5px] text-zinc-400">{dragged ? "dragging" : "pinned"}</span>
            <button
              type="button"
              disabled={!canEdit || busy}
              className="ml-auto rounded-md border border-white/15 bg-zinc-950 px-2 py-0.5 text-[11px] disabled:opacity-50"
              onClick={() => objectId && onRemove(objectId)}
            >
              Remove ⌫
            </button>
          </div>
        </div>
      )}

      {segment && harness && (
        <div className="mt-2.5 border-t border-white/10 pt-2">
          <p className="text-[10.5px] font-semibold tracking-wide text-zinc-500">
            SEGMENT {segmentIndex + 1} · {endTitle(segment.from)} → {endTitle(segment.to)}
          </p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11.5px]">
            <dt className="text-zinc-500">Carries</dt>
            <dd>
              {segment.wires.length} wire{segment.wires.length === 1 ? "" : "s"}
              {cableNames.length > 0 && <span className="text-zinc-400"> · in cable {cableNames.join(", ")}</span>}
            </dd>
            <dt className="text-zinc-500">Bundle Ø</dt>
            <dd>
              {mm2(segment.diameterNm)} mm
              {segment.assumedGauge && <span className="ml-1 text-amber-400">gauge assumed</span>}
            </dd>
            <dt className="text-zinc-500">Length</dt>
            <dd>
              {mm1(segment.lengthNm)} mm
              {previewSamples && <span className="text-zinc-400"> → {previewLengthMm(previewSamples).toFixed(1)} after drag</span>}
            </dd>
            <dt className="text-zinc-500">Min bend</dt>
            <dd className={segment.tightBend ? "text-red-400" : undefined}>
              R {segment.tightBend ? mm1(segment.tightBend.radiusNm) : "—"} mm · needs {mm1(segment.minRadiusAllowedNm)}
            </dd>
            <dt className="text-zinc-500">Clearance</dt>
            <dd className={clearance ? "text-red-400" : undefined}>
              {clearance
                ? `${mm1(clearance.distanceNm)} mm to ${occurrenceLabel(clearance.occurrence)} · needs ${mm1(clearance.neededNm)}`
                : "clear"}
            </dd>
            <dt className="text-zinc-500">Coverings</dt>
            <dd>{coverings.length ? coverings.map((covering) => covering.kind).join(", ") : "—"}</dd>
          </dl>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={!canEdit || busy}
              className="rounded-md border border-white/15 bg-zinc-950 px-2 py-0.5 text-[11px] disabled:opacity-50"
              onClick={() => segmentId && onStraighten(harness.id, segmentId)}
            >
              Straighten segment
            </button>
            {onOpenHarness && (
              <button type="button" className="rounded-md border border-white/15 bg-zinc-950 px-2 py-0.5 text-[11px]" onClick={() => onOpenHarness(harness.id)}>
                Open harness tab
              </button>
            )}
          </div>
        </div>
      )}

      {!object && (
        <p className="mt-2 text-[11.5px] text-zinc-400">Drag a tube to pull a bend.</p>
      )}

      {storedSegment && !segment && (
        <p className="mt-2 text-[11.5px] text-zinc-500">This segment is not in the bundle&apos;s route yet.</p>
      )}
    </section>
  );
}

/** One field of the route point; typed text shows until Enter or blur commits it. */
function AxisField({
  id,
  label,
  valueMm,
  highlighted,
  disabled,
  onCommit,
}: {
  id: string;
  label: string;
  valueMm: number;
  highlighted: boolean;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const value = Number(text);
    if (!Number.isFinite(value)) {
      toast.error(`Enter ${label} in millimetres`);
      return;
    }
    onCommit(value);
    setText(null);
  };
  return (
    <span className="flex items-center gap-1 rounded-md border border-white/15 bg-zinc-950 px-1.5 py-0.5 focus-within:border-blue-400">
      <label htmlFor={id} className={`text-[10.5px] ${highlighted ? "text-blue-300" : "text-zinc-500"}`}>{label}</label>
      <input
        id={id}
        className={`w-full min-w-0 bg-transparent font-mono text-[11.5px] outline-none disabled:opacity-60 ${highlighted ? "text-blue-200" : "text-zinc-100"}`}
        value={text ?? valueMm.toFixed(2)}
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
    </span>
  );
}
