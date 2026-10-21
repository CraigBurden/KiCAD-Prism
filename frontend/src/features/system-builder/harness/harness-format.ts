/**
 * The harness tab's words (CONTRACTS §16.5): wire colours, the text a terminal,
 * an end or a wire is read by, and the BOM the toolbar dialog lists. Pure
 * presentation; nothing here reads the store or writes an op.
 */
import type { BundleFinding } from "../model/types";
import type { EndView, HarnessView, PartRef, TerminalView, WireView } from "./harness-view";

const COLOUR_HEX: Record<string, string> = {
  black: "#111827",
  red: "#dc2626",
  yellow: "#eab308",
  blue: "#2563eb",
  green: "#16a34a",
  white: "#cbd5e1",
  orange: "#f97316",
  brown: "#92400e",
  violet: "#7c3aed",
  grey: "#94a3b8",
};

/** The colours the defaults bar and the inspector offer (§16.5). */
export const WIRE_COLOURS = ["black", "red", "yellow", "blue", "green", "white", "orange", "brown", "violet", "grey"] as const;

/** AWG as written (§2.5), thinnest first. */
export const GAUGES = ["32", "30", "28", "26", "24", "22", "20", "18", "16", "14", "12", "10", "0", "00"] as const;

export const UNKNOWN_COLOUR = "#64748b";

/** A wire's stroke; an unknown or absent name reads as grey. */
export function colourHex(name?: string): string {
  return (name ? COLOUR_HEX[name.toLowerCase()] : undefined) ?? UNKNOWN_COLOUR;
}

/** White and yellow need a grey outline to read on paper. */
export function needsOutline(name?: string): boolean {
  const key = name?.toLowerCase();
  return key === "white" || key === "yellow";
}

/** A part reference as a person reads it: `componentId@revisionId`, or just the component. */
export function partRefText(part: PartRef): string {
  return part.revisionId ? `${part.componentId}@${part.revisionId}` : part.componentId;
}

/** The housing shown on an end: the bundle's resolved reference, else the document's. */
export function endHousing(end: EndView): string | undefined {
  return end.housingResolved ?? (end.housing ? partRefText(end.housing) : undefined);
}

/** One line naming a terminal, as the inspector and the wire table read it. */
export function terminalText(view: HarnessView, terminal: TerminalView): string {
  if (terminal.kind === "splice") return `Splice ${terminal.splice}`;
  if (terminal.kind === "loose") {
    const loose = view.looseEnds.find((item) => item.id === terminal.looseEnd);
    return `Loose end ${terminal.looseEnd}${loose ? ` · ${loose.kind}` : ""}`;
  }
  const end = view.ends.find((item) => item.id === terminal.end);
  if (!end) return `End ${terminal.end} · cavity ${terminal.cavity}`;
  const pin = end.pins.find((item) => item.cavity === terminal.cavity);
  const bits = [end.title, `cavity ${terminal.cavity}`];
  if (terminal.pad) bits.push(`pad ${terminal.pad}`);
  if (pin?.name) bits.push(pin.name);
  return bits.join(" · ");
}

/** The label a wire carries on the canvas and in the inspector's header. */
export function wireLabel(wire: WireView): string {
  const parts = [wire.origin === "default" ? "default" : wire.id];
  if (wire.suggested) {
    parts.push("suggested");
  } else {
    if (wire.gaugeAwg) parts.push(`${wire.gaugeAwg} AWG`);
    if (wire.colour) parts.push(wire.colour);
  }
  return parts.join(" · ");
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** `3 ends · 5 wires (1 default) · 1 splice …`, as under the mockup's breadcrumb. */
export function countsLine(view: HarnessView): string {
  const defaults = view.wires.filter((wire) => wire.origin === "default").length;
  const bits = [plural(view.ends.length, "end"), `${plural(view.wires.length, "wire")}${defaults ? ` (${defaults} default)` : ""}`];
  if (view.splices.length) bits.push(plural(view.splices.length, "splice"));
  if (view.looseEnds.length) bits.push(plural(view.looseEnds.length, "pigtail", "pigtails"));
  if (view.cables.length) bits.push(plural(view.cables.length, "cable"));
  if (view.coverings.length) bits.push(plural(view.coverings.length, "covering"));
  if (view.branchPoints.length) bits.push(plural(view.branchPoints.length, "branch point"));
  return bits.join(" · ");
}

/** Findings the toolbar counts: neither waived nor informational (§16.5). */
export function activeFindings(findings: readonly BundleFinding[]): BundleFinding[] {
  return findings.filter((finding) => !finding.waived && finding.severity !== "info");
}

/** The findings that name this object (§8.7 `objects`). */
export function findingsOn(view: HarnessView, id: string): BundleFinding[] {
  return view.findings.filter((finding) => !finding.waived && finding.objects.includes(id));
}

export interface BomRow {
  label: string;
  count: number;
}

export interface BomSection {
  title: string;
  rows: BomRow[];
}

function tally(labels: string[]): BomRow[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => ({ label, count }));
}

/** Housings, contacts, cables and coverings by part; wires by gauge and colour (§16.5 BOM). */
export function buildBom(view: HarnessView): BomSection[] {
  const sections: BomSection[] = [
    { title: "Housings", rows: tally(view.ends.flatMap((end) => (end.housing ? [partRefText(end.housing)] : []))) },
    { title: "Contacts", rows: tally(view.ends.flatMap((end) => Object.values(end.contacts).map(partRefText))) },
    { title: "Cables", rows: tally(view.cables.flatMap((cable) => (cable.part ? [partRefText(cable.part)] : []))) },
    { title: "Coverings", rows: tally(view.coverings.flatMap((covering) => (covering.part ? [partRefText(covering.part)] : []))) },
    {
      title: "Wire",
      rows: wireTally(view.wires),
    },
  ];
  return sections.filter((section) => section.rows.length > 0);
}

/** Nanometres as a millimetre string for a length field. */
export function mmText(nm: number | undefined): string {
  if (nm === undefined) return "";
  return String(Math.round((nm / 1e6) * 100) / 100);
}

/** The length a wire is read by: a typed override wins over the 3D route (§16.6). */
export function effectiveLengthNm(wire: WireView): number | undefined {
  return wire.lengthNm ?? wire.routeLengthNm;
}

/** A wire's length cell: the typed value (marked `typed`), the route's, or an em dash. */
export function wireLengthText(wire: WireView): { text: string; typed: boolean } {
  if (wire.lengthNm !== undefined) return { text: mmText(wire.lengthNm), typed: true };
  if (wire.routeLengthNm !== undefined) return { text: mmText(wire.routeLengthNm), typed: false };
  return { text: "—", typed: false };
}

/** A whole number of millimetres, grouped as `1 240`. */
function totalMm(nm: number): string {
  return String(Math.round(nm / 1e6)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Wire rows by gauge and colour, with their total length when every wire has one. */
function wireTally(wires: WireView[]): BomRow[] {
  const groups = new Map<string, { count: number; totalNm: number; complete: boolean }>();
  for (const wire of wires) {
    const label = `${wire.gaugeAwg ?? "no gauge"} AWG · ${wire.colour ?? "no colour"}`;
    const group = groups.get(label) ?? { count: 0, totalNm: 0, complete: true };
    const length = effectiveLengthNm(wire);
    group.count += 1;
    group.totalNm += length ?? 0;
    group.complete = group.complete && length !== undefined;
    groups.set(label, group);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, group]) => ({
      label: group.complete ? `${label} · ${totalMm(group.totalNm)} mm` : label,
      count: group.count,
    }));
}

/** Parse a millimetre field; `null` clears the override. */
export function parseMm(text: string): number | null {
  const value = Number(text.trim());
  if (!text.trim() || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 1e6);
}
