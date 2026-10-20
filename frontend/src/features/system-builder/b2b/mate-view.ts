/**
 * A B2B mate as its tab shows it (stage 3c, mockup 04): each side's connector,
 * the mapping rows with both boards' nets, the system net each row joins, the
 * row's user name and what the findings say about it, and the pads drawn in
 * side A's frame (CONTRACTS §8.4).
 */
import type { SystemBundle, SystemDocument } from "../model/types";
import { naturalCompare } from "../schematic/scene";

type BundleMate = SystemBundle["mates"][number];
export type MatePads = NonNullable<BundleMate["pads"]>;

export interface MateSide {
  occurrence: string;
  label: string;
  connector: string;
  value: string;
}

export interface MateRow {
  /** Side A's pad, or null for a B pad with no partner. */
  aPad: string | null;
  aNet: string | null;
  bPad: string | null;
  bNet: string | null;
  /** Either pin is on a power net. */
  power: boolean;
  /** The system net the row joins, when the bundle has it. */
  netId: string | null;
  /** The system net's display name. */
  systemName: string | null;
  /** The user's name for the row (`rows[aPad].netLabel`). */
  label: string | null;
  /** Short notes from the findings and the mapping, e.g. "names differ". */
  notes: string[];
}

export interface MateView {
  id: string;
  a: MateSide;
  b: MateSide;
  source: BundleMate["source"] | "pending";
  rows: MateRow[];
  /** Pairs found, and the most pads either side could pair. */
  landed: number;
  total: number;
  pads: MatePads | null;
  orientation: SystemDocument["mates"][number]["orientation"];
  stackHeightNm: number | null;
  /** Where the placement's stack height came from, when solved. */
  heightSource: "stack-height" | "clearance" | null;
  spacerNm: number;
  manual: boolean;
}

const NOTE = { "net-name-conflict": "names differ", "power-net-conflict": "power nets differ" } as const;

/** The view of mate `id`, or null when the document has no such mate. */
export function buildMateView(document: SystemDocument, bundle: SystemBundle | null | undefined, id: string): MateView | null {
  const mate = document.mates.find((item) => item.id === id);
  if (!mate) return null;
  const labelOf = (occurrence: string) => document.occurrences.find((item) => item.id === occurrence)?.label ?? occurrence;
  const connectorOf = (occurrence: string, refdes: string) =>
    bundle?.occurrences.find((item) => item.occurrence === occurrence)?.connectors.find((item) => item.refdes === refdes);
  const ca = connectorOf(mate.a.occurrence, mate.a.connector);
  const cb = connectorOf(mate.b.occurrence, mate.b.connector);
  const pinsA = new Map((ca?.pins ?? []).map((pin) => [pin.pad, pin]));
  const pinsB = new Map((cb?.pins ?? []).map((pin) => [pin.pad, pin]));

  // The system net of each pin of either connector, and the notes its findings give.
  const netOf = new Map<string, { id: string; name: string }>();
  const pinKey = (occurrence: string, connector: string, pad: string) => `${occurrence}\u0000${connector}\u0000${pad}`;
  for (const net of bundle?.nets ?? []) {
    for (const pin of net.pins) {
      if ((pin.occurrence === mate.a.occurrence && pin.connector === mate.a.connector) || (pin.occurrence === mate.b.occurrence && pin.connector === mate.b.connector)) {
        netOf.set(pinKey(pin.occurrence, pin.connector, pin.pad), { id: net.id, name: net.name });
      }
    }
  }
  const netNotes = new Map<string, string[]>();
  for (const finding of bundle?.findings ?? []) {
    const note = NOTE[finding.code as keyof typeof NOTE];
    if (!note || finding.waived || !finding.subject.startsWith("net:")) continue;
    const netId = finding.subject.slice("net:".length);
    netNotes.set(netId, [...(netNotes.get(netId) ?? []), note]);
  }

  const bundleMate = bundle?.mates.find((item) => item.mate === id);
  const row = (aPad: string | null, bPad: string | null): MateRow => {
    const pa = aPad ? pinsA.get(aPad) : undefined;
    const pb = bPad ? pinsB.get(bPad) : undefined;
    const net = (aPad ? netOf.get(pinKey(mate.a.occurrence, mate.a.connector, aPad)) : undefined)
      ?? (bPad ? netOf.get(pinKey(mate.b.occurrence, mate.b.connector, bPad)) : undefined);
    const notes = [...(net ? netNotes.get(net.id) ?? [] : [])];
    if (!aPad || !bPad) notes.push("no partner");
    return {
      aPad,
      aNet: pa?.net ?? null,
      bPad,
      bNet: pb?.net ?? null,
      power: Boolean(pa?.power || pb?.power),
      netId: net?.id ?? null,
      systemName: net?.name ?? null,
      label: (aPad ? mate.rows[aPad]?.netLabel : undefined) ?? null,
      notes,
    };
  };
  const rows = [
    ...(bundleMate?.pairs ?? []).map((pair) => row(pair.a, pair.b)),
    ...(bundleMate?.unmappedA ?? []).map((pad) => row(pad, null)),
    ...(bundleMate?.unmappedB ?? []).map((pad) => row(null, pad)),
  ].sort((x, y) => naturalCompare(x.aPad ?? "￿", y.aPad ?? "￿") || naturalCompare(x.bPad ?? "", y.bPad ?? ""));

  const placed = bundle?.placement?.mates.find((item) => item.mate === id);
  const pairs = bundleMate?.pairs.length ?? 0;
  return {
    id,
    a: { occurrence: mate.a.occurrence, label: labelOf(mate.a.occurrence), connector: mate.a.connector, value: ca?.value ?? "" },
    b: { occurrence: mate.b.occurrence, label: labelOf(mate.b.occurrence), connector: mate.b.connector, value: cb?.value ?? "" },
    source: bundleMate?.source ?? "pending",
    rows,
    landed: pairs,
    total: Math.max(pairs + (bundleMate?.unmappedA.length ?? 0), pairs + (bundleMate?.unmappedB.length ?? 0)),
    pads: bundleMate?.pads ?? null,
    orientation: mate.orientation,
    stackHeightNm: mate.stackHeightNm ?? placed?.stackHeightNm ?? null,
    heightSource: placed?.heightSource ?? null,
    spacerNm: mate.offset?.translation.zNm ?? 0,
    manual: Boolean(mate.manualMap),
  };
}

/** A tab's title for a mate: "J202 ↔ J1". */
export function mateTitle(document: SystemDocument, id: string): string {
  const mate = document.mates.find((item) => item.id === id);
  return mate ? `${mate.a.connector} ↔ ${mate.b.connector}` : id;
}
