/**
 * Pure helpers for the link editor: which pins each end offers, the local
 * row draft, and the checks the server will also make (§8.4 write rules), so
 * a user sees problems before saving rather than as a 422.
 */

import type { RowInput } from "@/lib/systems-api";
import type { GeneratedRow, InstanceComponent, InstanceInterface, LinkRow, PortBaseline, RowSource } from "@/types/system";
import { comparePads } from "./pads";

export interface PinFact {
  pad: string;
  nets: string[];
  pinNames: string[] | null;
  pinTypes: string[] | null;
}

/** The component a stored port baseline names in an interface, by key or member keys. */
export function componentFor(iface: Pick<InstanceInterface, "components">, port: PortBaseline): InstanceComponent | null {
  const exact = iface.components.find((component) => component.portKey === port.portKey);
  if (exact) {
    return exact;
  }
  const wanted = new Set(port.memberKeys.length ? port.memberKeys : [port.portKey]);
  const matches = iface.components.filter((component) => component.memberKeys.some((key) => wanted.has(key)));
  return matches.length === 1 ? matches[0] : null;
}

export function pinFacts(component: InstanceComponent | null): Map<string, PinFact> {
  const facts = new Map<string, PinFact>();
  for (const pin of component?.pins ?? []) {
    facts.set(String(pin.pad), {
      pad: String(pin.pad),
      nets: [...new Set(pin.nets)].sort(),
      pinNames: pin.pinNames ?? null,
      pinTypes: pin.pinTypes ?? null,
    });
  }
  return facts;
}

export interface DraftRow {
  /** Stable React key; the row id when it has one. */
  key: string;
  id?: string;
  pinA: string;
  pinB: string;
  signal: string;
  source: RowSource;
}

export function draftFromRows(rows: LinkRow[]): DraftRow[] {
  return rows
    .filter((row) => row.pinA !== null && row.pinB !== null)
    .map((row) => ({ key: row.id, id: row.id, pinA: row.pinA as string, pinB: row.pinB as string, signal: row.signal, source: row.source }));
}

export function draftToInputs(rows: DraftRow[]): RowInput[] {
  return rows.map(({ id, pinA, pinB, signal, source }) => (id ? { id, pinA, pinB, signal, source } : { pinA, pinB, signal, source }));
}

/** SB2-102: how many rows the draft adds, removes or changes against `rows` (not the draft's length). */
export function changedRowCount(draft: DraftRow[], rows: LinkRow[]): number {
  const before = new Map(rows.map((row) => [row.id, row]));
  const kept = new Set<string>();
  let changed = 0;
  for (const row of draft) {
    const old = row.id ? before.get(row.id) : undefined;
    if (old) kept.add(old.id);
    if (!old || old.pinA !== row.pinA || old.pinB !== row.pinB || old.signal !== row.signal) changed += 1;
  }
  return changed + rows.filter((row) => !kept.has(row.id)).length;
}

let nextDraftKey = 0;
export function newDraftKey(): string {
  nextDraftKey += 1;
  return `new-${nextDraftKey}`;
}

/** Proposals from a generator become draft rows; pairs already in the draft are skipped. */
export function mergeGenerated(draft: DraftRow[], generated: GeneratedRow[]): DraftRow[] {
  const taken = new Set(draft.map((row) => `${row.pinA}\u0000${row.pinB}`));
  const merged = [...draft];
  for (const row of generated) {
    if (!taken.has(`${row.pinA}\u0000${row.pinB}`)) {
      merged.push({ key: newDraftKey(), pinA: row.pinA, pinB: row.pinB, signal: row.signal, source: "generator" });
    }
  }
  return merged;
}

export interface DraftProblem {
  key: string;
  message: string;
}

/** Problems the server would refuse: missing pads and duplicate pin pairs. */
export function draftProblems(draft: DraftRow[], padsA: Set<string> | null, padsB: Set<string> | null): DraftProblem[] {
  const problems: DraftProblem[] = [];
  const seen = new Map<string, string>();
  for (const row of draft) {
    if (padsA && !padsA.has(row.pinA)) {
      problems.push({ key: row.key, message: `Pad ${row.pinA} does not exist on end A` });
    }
    if (padsB && !padsB.has(row.pinB)) {
      problems.push({ key: row.key, message: `Pad ${row.pinB} does not exist on end B` });
    }
    const pair = `${row.pinA}\u0000${row.pinB}`;
    if (seen.has(pair)) {
      problems.push({ key: row.key, message: `${row.pinA} ↔ ${row.pinB} is already in this link` });
    } else {
      seen.set(pair, row.key);
    }
  }
  return problems;
}

export function sortDraft(draft: DraftRow[]): DraftRow[] {
  return [...draft].sort((a, b) => comparePads(a.pinA, b.pinA) || comparePads(a.pinB, b.pinB));
}

export function sameNets(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const left = [...(a ?? [])].sort();
  const right = [...(b ?? [])].sort();
  return left.length === right.length && left.every((net, index) => net === right[index]);
}
