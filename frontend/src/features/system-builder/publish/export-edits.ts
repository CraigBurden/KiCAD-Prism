/**
 * Exports and their pin names (stage 3d-3, CONTRACTS §2.6, §15.4, mockup 05):
 * an export makes a connector or a sub-port part of the published interface,
 * and its `pinNames` rename pins there. On a body the names are its signals
 * (§8.10).
 */
import { newId } from "../model/ids";
import type { SubPort, SystemBundle, SystemDocument, SystemOp } from "../model/types";
import { naturalCompare } from "../schematic/scene";

export type Export = SystemDocument["exports"][number];

/** A connector, or one of its occurrence-level sub-ports, on one occurrence. */
export interface ExportSite {
  occurrence: string;
  connector: string;
  subPort?: string;
}

const sameSite = (item: Export, site: ExportSite) =>
  item.site.occurrence === site.occurrence
  && item.site.connector === site.connector
  && (item.site.subPort?.id ?? undefined) === site.subPort;

/** The export of exactly this site, if any. */
export function exportAt(document: SystemDocument, site: ExportSite): Export | undefined {
  return document.exports.find((item) => sameSite(item, site));
}

/** A name for a new export: the sub-port's name or the connector's refdes, unique among the exports. */
export function exportName(document: SystemDocument, base: string): string {
  const taken = new Set(document.exports.map((item) => item.name));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`;
}

/** Export the site, or stop exporting it. */
export function toggleExportOps(document: SystemDocument, site: ExportSite, makeId = () => newId("exp")): SystemOp[] {
  const existing = exportAt(document, site);
  if (existing) return [{ kind: "remove-export", id: existing.id }];
  const subPort = site.subPort ? document.subPorts.find((item) => item.id === site.subPort) : undefined;
  return [{
    kind: "add-export",
    export: {
      id: makeId(),
      name: exportName(document, subPort?.name ?? site.connector),
      site: { occurrence: site.occurrence, connector: site.connector, ...(site.subPort ? { subPort: { kind: "occurrence" as const, id: site.subPort } } : {}) },
      pinNames: {},
    },
  }];
}

/** Rename an export; an empty or taken name is refused. */
export function renameExportOps(document: SystemDocument, item: Export, name: string): SystemOp[] {
  const next = name.trim();
  if (!next || next === item.name) return [];
  if (document.exports.some((other) => other.id !== item.id && other.name === next)) throw new Error(`Another export is named ${next}`);
  return [{ kind: "replace-export", export: { ...item, name: next } }];
}

/** Name one pin of an export in the interface; an empty name falls back to the board's. */
export function pinNameOps(item: Export, pad: string, name: string): SystemOp[] {
  const pinNames = { ...item.pinNames };
  const next = name.trim();
  if ((pinNames[pad] ?? "") === next) return [];
  if (next) pinNames[pad] = next;
  else delete pinNames[pad];
  return [{ kind: "replace-export", export: { ...item, pinNames } }];
}

/** One pin of an export as its pins table shows it. */
export interface ExportPin {
  pad: string;
  /** The interface name: the export's, else the board's pin name, else the pad. */
  name: string;
  /** What the export itself names it; empty when it falls back. */
  given: string;
  /** The board's pin name, shown when the export gives none. */
  boardName: string;
  /** The system net's name it is on, when it is on one. */
  signal: string | null;
  power: boolean;
}

/** The pins of an export's site, in the site's order (a sub-port's, else natural), with their names and signals. */
export function exportPins(document: SystemDocument, bundle: SystemBundle | null | undefined, item: Export): ExportPin[] {
  const connector = bundle?.occurrences
    .find((occurrence) => occurrence.occurrence === item.site.occurrence)
    ?.connectors?.find((candidate) => candidate.refdes === item.site.connector);
  const pins = new Map((connector?.pins ?? []).map((pin) => [pin.pad, pin]));
  const subPort: SubPort | undefined = item.site.subPort?.kind === "occurrence"
    ? document.subPorts.find((candidate) => candidate.id === item.site.subPort?.id)
    : undefined;
  const pads = subPort ? subPort.pins : [...pins.keys()].sort(naturalCompare);
  const signals = new Map<string, string>();
  for (const net of bundle?.nets ?? []) {
    for (const pin of net.pins) {
      if (pin.occurrence === item.site.occurrence && pin.connector === item.site.connector) signals.set(pin.pad, net.name);
    }
  }
  return pads.map((pad) => {
    const pin = pins.get(pad);
    const given = item.pinNames[pad] ?? "";
    const boardName = pin?.pinName ?? "";
    return { pad, name: given || boardName || pad, given, boardName, signal: signals.get(pad) ?? null, power: Boolean(pin?.power) };
  });
}

/** How an export reads in a label or a list: `NAME`, or `NAME{members}` for a sub-port's. */
export function exportLabel(document: SystemDocument, item: Export): string {
  if (item.site.subPort?.kind !== "occurrence") return item.name;
  const subPort = document.subPorts.find((candidate) => candidate.id === item.site.subPort?.id);
  return subPort ? `${item.name}{${subPort.pins.join(" ")}}` : item.name;
}
