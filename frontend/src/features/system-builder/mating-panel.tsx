import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MatingAxis, PortMating, SystemDocument, SystemLink, SystemPlacement } from "@/types/system";

import { MatePreview, type Pick } from "./mate-preview";
import { StackHeightField } from "./stack-height-field";
import { sessionReads } from "./session/session-reads";
import { useSessionRead, useSystemSession } from "./session/use-system-session";

/** How the mating axis reads to a designer (CONTRACTS_P2 §15.1; ±x/±y are the footprint's own axes). */
export const AXIS_LABELS: Record<MatingAxis, string> = {
  top: "Vertical, top side",
  bottom: "Vertical, bottom side",
  "+x": "Right-angle, footprint +X",
  "-x": "Right-angle, footprint −X",
  "+y": "Right-angle, footprint +Y",
  "-y": "Right-angle, footprint −Y",
};

/** The one-line state of a port's frame, as the link details show it. */
export function matingSummary(port: PortMating): { label: string; tone: "ok" | "info" | "warn" } {
  if (port.stored) {
    const turns = port.stored.quarterTurns ? ` · turned ${port.stored.quarterTurns * 90}°` : "";
    const how = port.stored.mode === "confirmed" ? "Confirmed" : "Set by hand";
    if (port.stored.stale) return { label: `${how}: ${AXIS_LABELS[port.stored.axis]}${turns} · footprint moved, check again`, tone: "warn" };
    return { label: `${how}: ${AXIS_LABELS[port.stored.axis]}${turns}`, tone: "ok" };
  }
  if (port.inferred.axis) {
    return { label: `Inferred (${port.inferred.confidence}): ${AXIS_LABELS[port.inferred.axis]}`, tone: "info" };
  }
  return { label: "Mating details needed", tone: "warn" };
}

const TONE: Record<"ok" | "info" | "warn", "secondary" | "outline" | "destructive"> = { ok: "secondary", info: "outline", warn: "destructive" };

interface EndProps {
  side: "A" | "B";
  instanceId: string;
  portKey: string;
  label: string;
  editable: boolean;
  /** The frame being picked by hand (the panel previews it), or null. */
  picking: Pick;
  setPicking: (pick: Pick) => void;
}

/** The stored and inferred frame of one port: undefined while loading, null when it cannot be read. */
function portFrame(read: { data: { ports: PortMating[] } | undefined; error: unknown }, portKey: string): PortMating | null | undefined {
  if (read.error) return null;
  return read.data ? read.data.ports.find((port) => port.portKey === portKey) ?? null : undefined;
}

function MatingEnd({ side, instanceId, portKey, label, editable, picking, setPicking }: EndProps) {
  const session = useSystemSession();
  const { edit } = session;
  const busy = session.busy !== null;
  const current = portFrame(useSessionRead(sessionReads.mating(instanceId)), portKey);
  if (current === undefined) return <p className="text-sm text-muted-foreground">{side} · {label}: loading…</p>;
  if (current === null) return <p className="text-sm text-muted-foreground">{side} · {label}: no frame (the board interface is not ready).</p>;
  const summary = matingSummary(current);
  // Confirm accepts the inferred frame, so it is offered only while nothing is stored: a frame set
  // by hand is already explicit, and confirming over it would silently replace it (Reset goes back).
  const canConfirm = editable && Boolean(current.inferred.axis) && !current.stored;
  const start = picking ?? { axis: current.stored?.axis ?? current.inferred.axis ?? "top", quarterTurns: current.stored?.quarterTurns ?? 0 };

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid={`mating-${side}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{side} · {label}</span>
        <Badge variant={TONE[summary.tone]}>{summary.label}</Badge>
      </div>
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          {canConfirm && (
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => void edit("mating", (system) => system.setMating(instanceId, portKey, { mode: "confirmed" }), "Mating frame confirmed")}>
              Confirm
            </Button>
          )}
          {!picking && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPicking(start)}>Set by hand</Button>
          )}
          {current.stored && !picking && (
            <Button size="sm" variant="ghost" disabled={busy}
              onClick={() => void edit("mating", (system) => system.clearMating(instanceId, portKey), "Back to the inferred frame")}>
              Reset
            </Button>
          )}
        </div>
      )}
      {editable && picking && (
        <form className="flex flex-wrap items-end gap-2" aria-label={`Mating frame ${side}`}
          onSubmit={async (event) => {
            event.preventDefault();
            // edit() reports failures itself and never rejects.
            await edit("mating", (system) => system.setMating(instanceId, portKey, { mode: "override", ...picking }), "Mating frame saved");
            setPicking(null);
          }}>
          <Select value={picking.axis} onValueChange={(value) => setPicking({ ...picking, axis: value as MatingAxis })}>
            <SelectTrigger aria-label={`Mating direction ${side}`} className="h-8 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(AXIS_LABELS) as MatingAxis[]).map((axis) => <SelectItem key={axis} value={axis}>{AXIS_LABELS[axis]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(picking.quarterTurns)} onValueChange={(value) => setPicking({ ...picking, quarterTurns: Number(value) })}>
            <SelectTrigger aria-label={`Turn about the mating axis ${side}`} className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3].map((turns) => <SelectItem key={turns} value={String(turns)}>{turns * 90}°</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" type="submit" disabled={busy}>Save</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setPicking(null)}>Cancel</Button>
        </form>
      )}
    </div>
  );
}

interface MatingPanelProps {
  document: SystemDocument;
  link: SystemLink;
  editable: boolean;
}

type Status = { tone: "ok" | "info" | "warn"; text: string };

const mm = (value: number) => `${Math.round(value * 100) / 100} mm`;

/** What the solve did with this link (CONTRACTS_P2 §14.9). */
export function placementStatus(placement: SystemPlacement, link: SystemLink, label: (instanceId: string) => string): Status {
  const mismatch = placement.mismatches.find((m) => m.linkId === link.id);
  if (mismatch) {
    const apart = Math.abs(mismatch.axialMm) > 0.005 ? `, ${mm(mismatch.axialMm)} along the mating axis` : "";
    const turned = mismatch.angleDeg > 0.005 ? `, turned ${Math.round(mismatch.angleDeg * 10) / 10}°` : "";
    return { tone: "warn", text: `Doesn't line up where the stack puts it: ${mm(mismatch.lateralMm)} across the mating plane${apart}${turned}.` };
  }
  if (placement.unusable.includes(link.id)) {
    return { tone: "info", text: "Not used for 3D placement yet: confirm or set both connectors' frames." };
  }
  const placed = Object.entries(placement.driving).find(([, entry]) => entry.linkId === link.id);
  if (placed) {
    const chosen = placement.drivingMates[placed[0]] === link.id ? " (chosen)" : "";
    return { tone: "ok", text: `Places ${label(placed[0])} on ${label(placed[1].from)}${chosen}.` };
  }
  return { tone: "ok", text: "Lines up with the stack." };
}

const STATUS_TONE: Record<Status["tone"], string> = {
  ok: "text-muted-foreground", info: "text-muted-foreground", warn: "text-destructive",
};

/** CONTRACTS_P2 §16.2, §20.14: a board-to-board link shows both connectors' mating frames, how the solve used
 * the link, a choice of which board it places, and a live preview of the pair. */
export function MatingPanel({ document, link, editable }: MatingPanelProps) {
  const session = useSystemSession();
  const { edit } = session;
  const busy = session.busy !== null;
  const [picks, setPicks] = useState<{ a: Pick; b: Pick }>({ a: null, b: null });
  const placement = useSessionRead(sessionReads.placement()).data ?? null;
  const pair = useSessionRead(sessionReads.linkMate(link.id)).data ?? null;
  const label = (instanceId: string) => document.instances.find((candidate) => candidate.id === instanceId)?.label ?? "?";
  const status = placement ? placementStatus(placement, link, label) : null;
  const restricted = link.a.redacted || link.b.redacted;
  // SB2-114: both ends' frames, so both inferred frames can be confirmed at once. Never over a stored one.
  const framed = (end: "a" | "b") => Boolean(link[end].port?.portKey && !link[end].redacted);
  const frameA = useSessionRead(framed("a") ? sessionReads.mating(link.a.instanceId) : null);
  const frameB = useSessionRead(framed("b") ? sessionReads.mating(link.b.instanceId) : null);
  const frames = [framed("a") ? portFrame(frameA, link.a.port!.portKey) : null, framed("b") ? portFrame(frameB, link.b.port!.portKey) : null];
  const confirmBoth = editable && !restricted && frames.every((frame) => frame?.inferred.axis && !frame.stored);
  const confirmFrames = () => void edit("mating", async (system) => {
    await system.setMating(link.a.instanceId, link.a.port!.portKey, { mode: "confirmed" });
    return system.setMating(link.b.instanceId, link.b.port!.portKey, { mode: "confirmed" });
  }, "Both mating frames confirmed");
  // A board this link could place instead of its current driving mate, and a choice to undo.
  const choices = placement && editable && !restricted
    ? (["a", "b"] as const).flatMap((end): { instanceId: string; kind: "use" | "reset" }[] => {
      const instanceId = link[end].instanceId;
      const current = placement.driving[instanceId];
      if (placement.drivingMates[instanceId] === link.id) return [{ instanceId, kind: "reset" }];
      if (current && current.linkId !== link.id && !placement.unusable.includes(link.id)) return [{ instanceId, kind: "use" }];
      return [];
    })
    : [];
  return (
    <section className="space-y-2" aria-label="Mating">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold" title="3D placement uses only frames that are confirmed or set by hand">Mating</h3>
        {confirmBoth && (
          <Button size="sm" variant="outline" className="mr-auto" disabled={busy} onClick={confirmFrames}
            title="Accept both connectors' inferred frames">Confirm both</Button>
        )}
        <StackHeightField link={link} editable={editable && !restricted} />
      </div>
      {status && <p className={`text-xs ${STATUS_TONE[status.tone]}`} role="status">{status.text}</p>}
      {choices.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {choices.map((choice) => (choice.kind === "use" ? (
            <Button key={choice.instanceId} size="sm" variant="outline" disabled={busy}
              onClick={() => void edit("driving", (system) => system.setDrivingMate(choice.instanceId, link.id),
                `${label(choice.instanceId)} is now placed by this link`)}>
              Place {label(choice.instanceId)} by this link
            </Button>
          ) : (
            <Button key={choice.instanceId} size="sm" variant="ghost" disabled={busy}
              onClick={() => void edit("driving", (system) => system.clearDrivingMate(choice.instanceId),
                `${label(choice.instanceId)} is placed automatically again`)}>
              Place {label(choice.instanceId)} automatically
            </Button>
          )))}
        </div>
      )}
      {(["a", "b"] as const).map((end) => {
        const instance = document.instances.find((candidate) => candidate.id === link[end].instanceId);
        const side = end === "a" ? "A" : "B";
        const endLabel = `${instance?.label ?? "?"} ${link[end].port?.reference ?? ""}`.trim();
        if (link[end].redacted || !link[end].port) return <p key={end} className="text-sm text-muted-foreground">{side} · restricted</p>;
        if (instance?.kind === "assembly") {
          return <p key={end} className="text-sm text-muted-foreground">{side} · {endLabel}: the frame comes from the subsystem's snapshot.</p>;
        }
        return (
          <MatingEnd key={end} side={side} instanceId={link[end].instanceId}
            portKey={link[end].port!.portKey} label={endLabel} editable={editable}
            picking={picks[end]} setPicking={(pick) => setPicks((current) => ({ ...current, [end]: pick }))} />
        );
      })}
      {pair && !restricted && (
        <MatePreview data={pair} picks={picks}
          labels={{ a: `${label(link.a.instanceId)} ${pair.a.reference}`, b: `${label(link.b.instanceId)} ${pair.b.reference}` }} />
      )}
    </section>
  );
}
