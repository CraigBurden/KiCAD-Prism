/**
 * The harness tab's edits (stage 4b, CONTRACTS §16.5): each gesture becomes one
 * request, one undo step. The tab works from `HarnessView`, but every op writes
 * the document's own shape (§2.5); a view terminal's `pad` is presentation and
 * never stored.
 */
import { newId } from "../model/ids";
import type { SystemDocument, SystemOp } from "../model/types";
import { naturalCompare } from "../schematic/scene";
import type { HarnessView, PartRef, TerminalView } from "./harness-view";

type DocTerminal =
  | { kind: "contact"; end: string; cavity: string }
  | { kind: "splice"; splice: string }
  | { kind: "loose"; looseEnd: string };

type WireChanges = { gaugeAwg?: string | null; colour?: string | null; label?: string | null; lengthNm?: number | null };

interface Site {
  occurrence: string;
  connector: string;
}

function siteMatch(a: { occurrence: string; connector: string }, b: Site): boolean {
  return a.occurrence === b.occurrence && a.connector === b.connector;
}

function siteOfEnd(view: HarnessView, id: string): Site | undefined {
  const end = view.ends.find((item) => item.id === id);
  return end?.occurrence !== undefined && end.connector !== undefined
    ? { occurrence: end.occurrence, connector: end.connector }
    : undefined;
}

/** The one link whose sites are these two ends, in either order; `undefined` when none or several. */
export function linkJoining(view: HarnessView, endA: string, endB: string): string | undefined {
  const a = siteOfEnd(view, endA);
  const b = siteOfEnd(view, endB);
  if (!a || !b) return undefined;
  const matches = view.harness.links.filter(
    (link) =>
      (siteMatch(link.a, a) && siteMatch(link.b, b)) || (siteMatch(link.a, b) && siteMatch(link.b, a)),
  );
  return matches.length === 1 ? matches[0].id : undefined;
}

function docTerminal(terminal: TerminalView): DocTerminal {
  if (terminal.kind === "splice") return { kind: "splice", splice: terminal.splice };
  if (terminal.kind === "loose") return { kind: "loose", looseEnd: terminal.looseEnd };
  return { kind: "contact", end: terminal.end, cavity: terminal.cavity };
}

function sameTerminal(a: TerminalView, b: TerminalView): boolean {
  if (a.kind === "contact" && b.kind === "contact") return a.end === b.end && a.cavity === b.cavity;
  if (a.kind === "splice" && b.kind === "splice") return a.splice === b.splice;
  if (a.kind === "loose" && b.kind === "loose") return a.looseEnd === b.looseEnd;
  return false;
}

function wireOf(view: HarnessView, id: string) {
  const wire = view.wires.find((item) => item.id === id);
  if (!wire) throw new Error(`No wire ${id}`);
  return wire;
}

/** A default wire made explicit with no other change (§16.5, "confirm"). */
function explicitWire(view: HarnessView, wireId: string, id: string): SystemOp {
  const wire = wireOf(view, wireId);
  return {
    kind: "add-wire",
    harness: view.id,
    wire: {
      id,
      from: docTerminal(wire.from),
      to: docTerminal(wire.to),
      ...(wire.link ? { link: wire.link } : {}),
      route: [],
    },
  };
}

/** A wire between two terminals; `link` is filled when exactly one link joins their sites. */
export function addWireOps(
  view: HarnessView,
  from: TerminalView,
  to: TerminalView,
  defaults: { gaugeAwg?: string; colour?: string; label?: string },
  id = newId("wire"),
): SystemOp[] {
  if (sameTerminal(from, to)) throw new Error("A wire needs two different ends");
  if (from.kind === "contact" && to.kind === "contact" && from.end === to.end) {
    throw new Error("Both pins are on the same connector");
  }
  const link = from.kind === "contact" && to.kind === "contact" ? linkJoining(view, from.end, to.end) : undefined;
  return [{
    kind: "add-wire",
    harness: view.id,
    wire: {
      id,
      from: docTerminal(from),
      to: docTerminal(to),
      ...(link ? { link } : {}),
      ...(defaults.gaugeAwg !== undefined ? { gaugeAwg: defaults.gaugeAwg } : {}),
      ...(defaults.colour !== undefined ? { colour: defaults.colour } : {}),
      ...(defaults.label !== undefined ? { label: defaults.label } : {}),
      route: [],
    },
  }];
}

/** Change an explicit wire, or make a default wire explicit with the change. */
export function setWireOps(view: HarnessView, wireId: string, changes: WireChanges, id = newId("wire")): SystemOp[] {
  const wire = wireOf(view, wireId);
  if (wire.origin === "default") {
    return [{
      kind: "add-wire",
      harness: view.id,
      wire: {
        id,
        from: docTerminal(wire.from),
        to: docTerminal(wire.to),
        ...(wire.link ? { link: wire.link } : {}),
        ...(changes.gaugeAwg != null ? { gaugeAwg: changes.gaugeAwg } : {}),
        ...(changes.colour != null ? { colour: changes.colour } : {}),
        ...(changes.label != null ? { label: changes.label } : {}),
        ...(changes.lengthNm != null ? { lengthNm: changes.lengthNm } : {}),
        route: [],
      },
    }];
  }
  const stored = view.harness.wires.find((item) => item.id === wireId);
  if (!stored) throw new Error(`No wire ${wireId}`);
  const next = { ...stored };
  if (changes.gaugeAwg === null) delete next.gaugeAwg;
  else if (changes.gaugeAwg !== undefined) next.gaugeAwg = changes.gaugeAwg;
  if (changes.colour === null) delete next.colour;
  else if (changes.colour !== undefined) next.colour = changes.colour;
  if (changes.label === null) delete next.label;
  else if (changes.label !== undefined) next.label = changes.label;
  if (changes.lengthNm === null) delete next.lengthNm;
  else if (changes.lengthNm !== undefined) next.lengthNm = changes.lengthNm;
  return [{ kind: "replace-wire", harness: view.id, wire: next }];
}

/** Confirm a default wire as it is; an explicit wire needs no confirmation. */
export function confirmWireOps(view: HarnessView, wireId: string, id = newId("wire")): SystemOp[] {
  const wire = wireOf(view, wireId);
  return wire.origin === "default" ? [explicitWire(view, wireId, id)] : [];
}

/**
 * Remove an explicit wire, or clear a default wire's pin from its link: the
 * pad the default wired is side A's, so it joins `unmapped`.
 */
export function removeWireOps(view: HarnessView, wireId: string): SystemOp[] {
  const wire = wireOf(view, wireId);
  if (wire.origin === "explicit") return [{ kind: "remove-wire", harness: view.id, id: wireId }];
  const link = view.harness.links.find((item) => item.id === wire.link);
  if (!link) throw new Error(`No link ${wire.link}`);
  const sideA = [wire.from, wire.to].find((terminal) => {
    if (terminal.kind !== "contact") return false;
    const end = view.ends.find((item) => item.id === terminal.end);
    return end?.occurrence === link.a.occurrence && end.connector === link.a.connector;
  });
  const pad = sideA?.kind === "contact" ? sideA.pad : undefined;
  if (pad === undefined) throw new Error("The link's side A pin is unknown");
  const unmapped = [...new Set([...link.unmapped, pad])].sort(naturalCompare);
  return [{ kind: "replace-link", harness: view.id, link: { ...link, unmapped } }];
}

/** Change an end's housing, contacts or pin map; the rest of the end is kept. */
export function setEndOps(
  view: HarnessView,
  endId: string,
  changes: { housing?: PartRef | null; contacts?: Record<string, PartRef>; pinMap?: { cavity: string; pad: string }[] },
): SystemOp[] {
  const end = view.harness.ends.find((item) => item.id === endId);
  if (!end) throw new Error(`No end ${endId}`);
  const next = { ...end };
  if (changes.housing === null) delete next.housing;
  else if (changes.housing !== undefined) next.housing = changes.housing;
  if (changes.contacts !== undefined) next.contacts = changes.contacts;
  if (changes.pinMap !== undefined) next.pinMap = changes.pinMap;
  return [{ kind: "replace-end", harness: view.id, end: next }];
}

/** Place an object on the tab's canvas, keeping the rest of its placement (§2.8 `canvas`). */
export function canvasOps(document: SystemDocument, id: string, at: { xNm: number; yNm: number }): SystemOp[] {
  const placement = document.layout[id] ?? { xNm: 0, yNm: 0, rotationDeg: 0, mirror: false };
  return [{ kind: "set-layout", item: id, placement: { ...placement, canvas: { xNm: at.xNm, yNm: at.yNm } } }];
}

/** `S`: a confirmed crimp splice at the pointer, or wherever auto-layout puts it. */
export function addSpliceOps(document: SystemDocument, view: HarnessView, at?: { xNm: number; yNm: number }, id = newId("spl")): SystemOp[] {
  return [
    { kind: "add-splice", harness: view.id, splice: { id, method: "crimp", confirmed: true } },
    ...(at ? canvasOps(document, id, at) : []),
  ];
}

/** `P`: a pigtail at the pointer, or wherever auto-layout puts it. */
export function addLooseEndOps(document: SystemDocument, view: HarnessView, at?: { xNm: number; yNm: number }, id = newId("pt")): SystemOp[] {
  return [
    { kind: "add-loose-end", harness: view.id, looseEnd: { id, kind: "pigtail" } },
    ...(at ? canvasOps(document, id, at) : []),
  ];
}

/** `J`: a branch point at the pointer, or wherever auto-layout puts it. */
export function addBranchPointOps(document: SystemDocument, view: HarnessView, at?: { xNm: number; yNm: number }, id = newId("bp")): SystemOp[] {
  return [
    { kind: "add-branch-point", harness: view.id, branchPoint: { id } },
    ...(at ? canvasOps(document, id, at) : []),
  ];
}

/** `A`: one conductor per selected wire, in the given order; default wires become explicit first. */
export function addCableOps(view: HarnessView, wireIds: string[], part?: PartRef, id = newId("cab")): SystemOp[] {
  if (wireIds.length < 2) throw new Error("Select two or more wires");
  const ops: SystemOp[] = [];
  const conductors: { name: string; wire: string; drain: boolean }[] = [];
  wireIds.forEach((wireId, index) => {
    const wire = wireOf(view, wireId);
    let bound = wireId;
    if (wire.origin === "default") {
      bound = newId("wire");
      ops.push(explicitWire(view, wireId, bound));
    }
    conductors.push({ name: wire.colour ?? `C${index + 1}`, wire: bound, drain: false });
  });
  ops.push({
    kind: "add-cable",
    harness: view.id,
    cable: {
      id,
      ...(part ? { part } : {}),
      conductors,
    },
  });
  return ops;
}

/** `B`: a heat-shrink covering on a segment. */
export function addCoveringOps(view: HarnessView, segmentId: string, id = newId("cov")): SystemOp[] {
  if (!view.segments.some((segment) => segment.id === segmentId)) throw new Error("Pick a segment of this harness");
  return [{
    kind: "add-covering",
    harness: view.id,
    covering: { id, segment: segmentId, kind: "heat-shrink" },
  }];
}

/** `M`: a label on a wire, naming it by its label or id; a default wire becomes explicit first. */
export function addMarkerOps(view: HarnessView, wireId: string, id = newId("mkr")): SystemOp[] {
  const wire = wireOf(view, wireId);
  const ops: SystemOp[] = [];
  let target = wireId;
  if (wire.origin === "default") {
    target = newId("wire");
    ops.push(explicitWire(view, wireId, target));
  }
  ops.push({
    kind: "add-marker",
    harness: view.id,
    marker: { id, wire: target, kind: "label", text: wire.label ?? wire.id },
  });
  return ops;
}

/** Auto-layout: drop every Canvas placement of the block's ends and nodes, keeping the rest. */
export function autoLayoutOps(document: SystemDocument, view: HarnessView): SystemOp[] {
  const ids = [
    ...view.ends.map((end) => end.id),
    ...view.splices.map((splice) => splice.id),
    ...view.looseEnds.map((loose) => loose.id),
    ...view.branchPoints.map((point) => point.id),
  ];
  const ops: SystemOp[] = [];
  for (const item of ids) {
    const placement = document.layout[item];
    if (!placement?.canvas) continue;
    const next = { ...placement };
    delete next.canvas;
    ops.push({ kind: "set-layout", item, placement: next });
  }
  return ops;
}
