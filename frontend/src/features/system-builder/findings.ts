import type { Finding } from "@/types/system";

import type { WorkspaceSelection } from "./workspace/workspace-state";

/**
 * What a system's validation report means to the UI, derived in one place: open versus waived
 * (SB2-100: a waived finding colours nothing and counts for nothing), severity rollups, lookups
 * by instance, link, row and harness, a finding's selection target, and each rule's `detail`
 * decoded once into a typed shape. Components render from this; none re-filters the report.
 *
 * Reports and findings are replaced, never mutated, so the array (or finding) is the cache key.
 */

export type FindingLevel = "error" | "warning";

/** One side of a SYS-V22 collision: an occurrence path and the colliding part. */
export interface CollisionSide {
  occurrence: string;
  reference: string | null;
}

/** The nets a finding saw: both sides of a join, a schematic net against the PCB's, or a list. */
export type FindingNets =
  | { kind: "join"; a: string[]; b: string[] }
  | { kind: "pcb"; schematic: string[]; pcb: string[] }
  | { kind: "list"; nets: string[] };

export interface FindingDetail {
  /** The harness the finding concerns (harness rules name it). */
  harnessId: string | null;
  /** The far pin of a join (a link row or a harness wire): `referenceB` and `pinB`. */
  far: { reference: string | null; pin: string | null } | null;
  nets: FindingNets | null;
  /** SYS-V09: the rename already proposed for the finding's row (P2 §23.4). */
  rename: { name: string } | null;
  /** SYS-V22: the colliding parts. */
  collision: CollisionSide[];
}

export interface Findings {
  /** Findings no waiver accepts, in report order. */
  readonly open: readonly Finding[];
  readonly errors: number;
  readonly warnings: number;
  /** Open findings on an instance, a link, one link row, or a harness. */
  instance(instanceId: string): readonly Finding[];
  link(linkId: string): readonly Finding[];
  row(linkId: string, rowId: string): readonly Finding[];
  harness(harnessId: string): readonly Finding[];
  /** The waived finding a waiver accepts, by the waiver's finding key. */
  waived(findingKey: string | null | undefined): Finding | null;
  /** Every SYS-V22 finding, waived or not: the 3D toolbar counts the stored check's collisions. */
  readonly collisions: readonly Finding[];
  /** A SYS-V22 finding by its key (a `collision` selection). */
  collision(key: string): Finding | null;
}

const NONE: readonly Finding[] = [];
const sets = new WeakMap<readonly Finding[], Findings>();
const details = new WeakMap<Finding, FindingDetail>();

function push<K>(map: Map<K, Finding[]>, key: K, finding: Finding) {
  (map.get(key) ?? map.set(key, []).get(key)!).push(finding);
}

export function findingsOf(findings: readonly Finding[]): Findings {
  const cached = sets.get(findings);
  if (cached) return cached;
  const open: Finding[] = [];
  const byInstance = new Map<string, Finding[]>();
  const byLink = new Map<string, Finding[]>();
  const byRow = new Map<string, Finding[]>();
  const byHarness = new Map<string, Finding[]>();
  const waived = new Map<string | null | undefined, Finding>();
  const collisions: Finding[] = [];
  const byCollision = new Map<string, Finding>();
  for (const finding of findings) {
    if (finding.rule === "SYS-V22") {
      collisions.push(finding);
      if (finding.key && !byCollision.has(finding.key)) byCollision.set(finding.key, finding);
    }
    if (finding.waived) {
      waived.set(finding.key, finding);
      continue;
    }
    open.push(finding);
    if (finding.instanceId) push(byInstance, finding.instanceId, finding);
    if (finding.linkId) {
      push(byLink, finding.linkId, finding);
      if (finding.rowId) push(byRow, `${finding.linkId}\u0000${finding.rowId}`, finding);
    }
    const { harnessId } = findingDetail(finding);
    if (harnessId) push(byHarness, harnessId, finding);
  }
  const { errors, warnings } = levelCounts(open);
  const index: Findings = {
    open, errors, warnings, collisions,
    instance: (id) => byInstance.get(id) ?? NONE,
    link: (id) => byLink.get(id) ?? NONE,
    row: (linkId, rowId) => byRow.get(`${linkId}\u0000${rowId}`) ?? NONE,
    harness: (id) => byHarness.get(id) ?? NONE,
    waived: (key) => waived.get(key) ?? null,
    collision: (key) => byCollision.get(key) ?? null,
  };
  sets.set(findings, index);
  return index;
}

/** Errors and warnings among `findings` (info counts for neither). */
export function levelCounts(findings: readonly Finding[]): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const finding of findings) {
    if (finding.severity === "error") errors += 1;
    else if (finding.severity === "warning") warnings += 1;
  }
  return { errors, warnings };
}

/** The worst level among `findings`: errors win over warnings; info never shows. */
export function worstLevel(findings: readonly Finding[]): FindingLevel | null {
  const { errors, warnings } = levelCounts(findings);
  return errors ? "error" : warnings ? "warning" : null;
}

/** Where a finding's Show goes: its harness, its collision, its link (and row), or its board. */
export function findingTarget(finding: Finding): WorkspaceSelection | null {
  const { harnessId } = findingDetail(finding);
  if (harnessId) return { kind: "harness", id: harnessId };
  if (finding.rule === "SYS-V22" && finding.key) return { kind: "collision", id: finding.key };
  if (finding.linkId) return { kind: "link", id: finding.linkId, ...(finding.rowId ? { row: finding.rowId } : {}) };
  return finding.instanceId ? { kind: "instance", id: finding.instanceId } : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function collisionSide(value: unknown): CollisionSide[] {
  const side = record(value);
  const occurrence = text(side?.occurrence);
  return occurrence ? [{ occurrence, reference: text(side?.reference) }] : [];
}

/** The finding's `detail`, decoded once into the shapes its rules use. */
export function findingDetail(finding: Finding): FindingDetail {
  const cached = details.get(finding);
  if (cached) return cached;
  const detail = record(finding.detail) ?? {};
  const nets: FindingNets | null = "netA" in detail ? { kind: "join", a: strings(detail.netA), b: strings(detail.netB) }
    : "schematic" in detail ? { kind: "pcb", schematic: strings(detail.schematic), pcb: strings(detail.pcb) }
      : "nets" in detail ? { kind: "list", nets: strings(detail.nets) } : null;
  const rename = text(record(detail.rename)?.name);
  const decoded: FindingDetail = {
    harnessId: text(detail.harnessId),
    far: "pinB" in detail ? { reference: text(detail.referenceB), pin: text(detail.pinB) } : null,
    nets,
    rename: rename ? { name: rename } : null,
    collision: finding.rule === "SYS-V22" ? [...collisionSide(detail.a), ...collisionSide(detail.b)] : [],
  };
  details.set(finding, decoded);
  return decoded;
}
