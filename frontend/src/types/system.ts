/**
 * System Builder response shapes (docs/system-builder/CONTRACTS.md §7–§9).
 * Fields mirror the API exactly; restricted boards arrive with nulls and
 * `redacted: true` (§8.2), so every field a restricted board can hide is
 * nullable here.
 */

import type { ConnectorGeometry } from "@/features/system-builder/placement/frames";

/** Rules that run only when a system opts in (CONTRACTS_P2 §8.4). */
export type OptionalRule = "SYS-V09";

export interface SystemSummary {
  id: string;
  kind: "system";
  name: string;
  description: string;
  folderId: string | null;
  version: number;
  etag: string;
  /** Board instances only (P2): subsystems and modules are counted apart. */
  instanceCount: number;
  subsystemCount?: number;
  moduleCount?: number;
  openReviewCount: number;
  /** The catalog `assembly` this system publishes to, bound on first publish (CONTRACTS_P2 §3.3). */
  catalogComponentId?: string | null;
  /** Set when deleting archived the system instead (D-P2-31): read-only, left out of lists. */
  archivedAt?: string | null;
  /** Opt-in validation rules this system runs (CONTRACTS_P2 §8.4); absent before P2-1.10. */
  optionalRules?: OptionalRule[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** SB2-101: boards counted through every subsystem (null if the hierarchy can't be resolved). */
  boardTotal?: number | null;
  /** SB2-101, `GET /api/systems` only: the last snapshot, the git branch and the last counts of this version. */
  lastSnapshot?: { id: string; name: string; createdAt: string } | null;
  git?: { branch: string; outsideChange: boolean; error: boolean } | null;
  findingCounts?: FindingCounts | null;
}

export type InterfaceStatus = "ready" | "pending" | "failed";

export interface InstanceInterfaceState {
  status: InterfaceStatus;
  digest: string | null;
  hasPcb: boolean | null;
  jobId: string | null;
  errorCode: string | null;
}

export interface SystemPort {
  portKey: string;
  memberKeys: string[];
  reference: string;
  libId: string | null;
  footprint: string | null;
  value: string | null;
  dnp: boolean;
  candidate: boolean;
  candidateReason: string | null;
  override: "hidden" | "promoted" | null;
  exposed: boolean;
  pinCount: number;
}

export interface SystemInstance {
  id: string;
  label: string;
  restricted: boolean;
  redacted?: boolean;
  projectId: string | null;
  projectName: string | null;
  /** The board's project was deleted; a designer can still remove it from the system. */
  projectDeleted?: boolean;
  baselineCommit: string | null;
  trackedRef: string | null;
  pinned: boolean;
  resolution: "resolved" | "unresolved";
  tipCommit: string | null;
  tipCheckedAt: string | null;
  updateAvailable: boolean | null;
  interface: InstanceInterfaceState | null;
  /** For an assembly, its exports: `portKey` is the export ID (CONTRACTS_P2 §5.1). */
  ports: SystemPort[] | null;
  /** `board` when absent (documents from before P2). */
  /** `part`: a mechanical part from the catalog, with a model and no ports (CONTRACTS_P2 §24.1). */
  kind?: "board" | "assembly" | "module" | "part";
  /** Set for assembly and module instances. */
  catalog?: InstanceCatalogRef;
  /** Named pad sets carved out of its ports (CONTRACTS_P2 §22); absent before SB2-105. */
  subports?: Subport[];
}

/** A sub-port: `J6.PWR` = some pads of J6; the pads left over stay on J6 (CONTRACTS_P2 §22). */
export interface Subport {
  id: string;
  /** Null on a restricted board, with `pads`. */
  portKey: string | null;
  name: string;
  pads: string[] | null;
}

/** A row move a sub-port change makes (CONTRACTS_P2 §22.3). */
export interface SubportMove {
  linkId: string;
  end: "a" | "b";
  action: "retarget" | "split";
  rowIds: string[];
  toSubportId: string | null;
  newLinkName: string | null;
  newLinkId?: string;
}

export interface SubportChange {
  subport?: Subport & { instanceId: string; label: string };
  moves: SubportMove[];
}

export interface InstanceCatalogRef {
  componentId: string;
  revisionId: string;
  follow: "pinned" | "latest_released";
  version: number | null;
  releaseStatus: string | null;
  identity: string | null;
  latestReleasedRevisionId: string | null;
  /** SB2-122: the component's released version and its newest revision, for the release chain. */
  latestReleasedVersion?: number | null;
  newestVersion?: number | null;
  newestReleaseStatus?: string | null;
  /** The child system the revision was published from, and its snapshot. */
  systemId: string | null;
  snapshotName: string | null;
  /** SB2-117: open errors and warnings in that snapshot (an assembly only); null when unknown. */
  findingCounts?: { error: number; warning: number } | null;
}

export interface PortBaseline {
  portKey: string;
  memberKeys: string[];
  reference: string;
  libId: string | null;
  footprint: string | null;
  pinCount: number;
}

export interface LinkEnd {
  instanceId: string;
  redacted: boolean;
  port: PortBaseline | null;
  resolved: boolean | null;
  exposed: boolean | null;
  /** An end on a subsystem export: where it lands inside the child (CONTRACTS_P2 §6.1). */
  export?: { name: string; reference: string | null; occurrence: string | null; description: string } | null;
  /** The port's stored mating frame (CONTRACTS_P2 §15.2); absent in documents from before SB2-19. */
  mating?: { mode: "confirmed" | "override"; axis: MatingAxis; quarterTurns: number } | null;
  /** The sub-port this end lands on (CONTRACTS_P2 §22); null for a whole connector or its remainder. */
  subport?: { id: string; name: string | null } | null;
}

export interface PinObservation {
  present: boolean;
  nets: string[] | null;
  pcbNets: string[] | null;
  pinNames: string[] | null;
  pinTypes: string[] | null;
}

export type RowSource = "manual" | "generator" | "import";

export interface LinkRow {
  id: string;
  pinA: string | null;
  pinB: string | null;
  signal: string;
  source: RowSource;
  netA: string[] | null;
  netB: string[] | null;
  observedA: PinObservation | null;
  observedB: PinObservation | null;
  redacted: boolean;
  redactedEnds: ("a" | "b")[];
}

/** CONTRACTS_P2 §16: P1 links are `unspecified`. */
export type LinkType = "unspecified" | "b2b";

export interface SystemLink {
  id: string;
  name: string;
  harness: string | null;
  /** Absent in documents frozen before link types existed. */
  type?: LinkType;
  /** `b2b` only: the mated pair's stack height from the datasheet (§16.2). */
  stackHeightMm?: number | null;
  updatedAt: string;
  a: LinkEnd;
  b: LinkEnd;
  rows: LinkRow[];
}

export interface FindingCounts {
  error: number;
  warning: number;
  info: number;
  notEvaluated: number;
  /** SB2-100: waived findings, left out of the counts above. */
  waived?: number;
}

/** A connector this system publishes to parent systems (CONTRACTS_P2 §4). */
export interface SystemExport {
  id: string;
  name: string;
  description: string;
  instanceId: string;
  /** Null for a re-export or when the board is restricted. */
  portKey: string | null;
  port: PortBaseline | null;
  childExportId: string | null;
  /** False: the connector is gone or no longer exposed (SYS-V16). Null: not evaluated or restricted. */
  resolved: boolean | null;
  redacted: boolean;
  updatedAt: string;
  /** The sub-port it publishes (CONTRACTS_P2 §22.2). */
  subportId?: string | null;
  subport?: { id: string; name: string | null } | null;
}

/** A harness end's mating block and what it mates (CONTRACTS_P2 §17.2). */
export interface HarnessEnd {
  id: string;
  ordinal: number;
  mates: {
    instanceId: string;
    portKey: string | null;
    port: { portKey: string; reference: string; libId: string | null; footprint: string | null; pinCount: number } | null;
    resolved: boolean | null;
    redacted: boolean;
  } | null;
  /** The block's catalog part, with its name and MPN as they were at assignment; null = Generic. */
  part: { componentId: string; revisionId: string; name?: string | null; mpn?: string | null; manufacturer?: string | null } | null;
  /** SB2-110 (§26.1): the contact every wired cavity takes; absent from older servers. */
  contact?: { componentId: string; revisionId: string; name?: string | null; mpn?: string | null; manufacturer?: string | null } | null;
  pinCount: number;
  pinMap: Record<string, string> | null;
  bootMm: number | null;
  /** End pin names: the part's pins when a part is assigned, else the mated connector's pads, else `1…pinCount`. */
  pins: string[];
  /** The mated connector's pads, which the pin map targets (SB2-18); empty while unmated. */
  matePads: string[];
}

export interface HarnessWire {
  id: string;
  from: { end: string; pin: string };
  to: { end: string; pin: string };
  signal: string;
  gaugeAwg: number | null;
  colour: string | null;
  label: string | null;
  netFrom: string[] | null;
  netTo: string[] | null;
  redactedEnds: ("from" | "to")[];
}

export interface SystemHarness {
  id: string;
  name: string;
  label: string | null;
  cutLengthMm: number | null;
  serviceAllowancePct: number | null;
  /** Two mated ends, no splices, identity pin maps: it can become a link (§16.1). */
  linkable: boolean;
  ends: HarnessEnd[];
  wires: HarnessWire[];
  /** SB2-45: breakouts and waypoints; absent from older servers and frozen documents. */
  nodes?: HarnessNode[];
  /** SB2-46 (§17.10): measured where the 3D view routes it; null with fewer than two placed ends. */
  lengths?: HarnessLengths | null;
  /** SB2-110 (§26.1): coverings by route segment, `*` for the whole bundle. */
  coverings?: HarnessCovering[];
  updatedAt: string;
}

export interface HarnessCovering {
  segmentId: string;
  part: { componentId: string; revisionId: string; name?: string | null; mpn?: string | null; manufacturer?: string | null } | null;
  description: string;
}

/**
 * A breakout or waypoint (CONTRACTS_P2 §17.9), in the harness's system frame (mm).
 * Breakouts chain by `order` and list the ends they branch to; a waypoint lies
 * `between` two ends or breakouts, `order` counting from `between[0]`.
 */
export interface HarnessNode {
  id: string;
  kind: "breakout" | "waypoint";
  positionMm: [number, number, number];
  pinned: boolean;
  order: number;
  ends: string[];
  between: [string, string] | null;
}

export interface HarnessLengths {
  bundleMm: number;
  estimatedMm: number;
  allowancePct: number;
  /** False when an end is not placed: the numbers cover only what is routed. */
  complete: boolean;
  wires: Record<string, { lengthMm: number; estimatedMm: number }>;
  /** SB2-110 (§26.1): the routed segments a covering names. */
  segments?: { id: string; from: string; to: string; lengthMm: number; wires: string[] }[];
}

/** A node as `PUT …/harnesses/{hid}/nodes` takes it: `order` comes from the list. */
export type HarnessNodeInput = Pick<HarnessNode, "id" | "kind" | "positionMm" | "pinned" | "ends" | "between">;

export interface SystemDocument {
  system: SystemSummary;
  instances: SystemInstance[];
  links: SystemLink[];
  /** Absent in documents frozen before harness objects existed. */
  harnesses?: SystemHarness[];
  /** Absent in documents frozen before exports existed. */
  exports?: SystemExport[];
  openReviewCount: number;
  findingCounts: FindingCounts | null;
  /** SB2-98: the live document's findings, read with it (`?include=validation`); absent in frozen ones. */
  validation?: ValidationReport;
  /** SB2-98: digests of what the 3D scene and the system nets depend on; they change less often than the version. */
  sceneKey?: string;
  netsKey?: string;
  /** Open net rename proposals (CONTRACTS_P2 §23); absent before SB2-106. */
  renames?: NetRename[];
}

/** A proposal that one board rename one of its nets (CONTRACTS_P2 §23.1). */
export interface NetRename {
  id: string;
  instanceId: string;
  /** Null for a board the reader cannot see, with `name`, `note` and `rows`. */
  net: string | null;
  name: string | null;
  note: string | null;
  state: "open" | "applied" | "withdrawn";
  /** Rows and harness wires in the system that carry the net. */
  rows: number | null;
  createdBy: string;
  createdAt: string;
  closedBy: string | null;
  closedAt: string | null;
  closedCommit: string | null;
  redacted?: boolean;
}

/** `GET /api/systems/by-project/{projectId}`: the systems that place a board (CONTRACTS_P2 §23.5). */
export interface ProjectSystems {
  projectId: string;
  systems: {
    id: string;
    name: string;
    instances: { id: string; label: string; baselineCommit: string | null; trackedRef: string | null; pinned: boolean }[];
    renames: (NetRename & { board: string; connectors: string[] })[];
  }[];
}

/** A component from `GET …/interface`: artifact facts plus exposure, with pins instead of a count. */
export interface InstanceComponent extends Omit<SystemPort, "pinCount"> {
  pins: { pad: string; nets: string[]; pcbNets?: string[] | null; pinNames?: string[] | null; pinTypes?: string[] | null }[];
}

/** `GET …/instances/{iid}/interface`: the artifact (§3) plus exposure. */
export interface InstanceInterface {
  instanceId: string;
  atBaseline: boolean;
  projectId: string;
  commit: string;
  digest: string;
  hasPcb: boolean;
  components: InstanceComponent[];
}

// Validation (§7.2)

export type Severity = "error" | "warning" | "info";

export interface Finding {
  rule: string;
  name: string;
  severity: Severity;
  instanceId: string | null;
  linkId: string | null;
  rowId: string | null;
  end: "a" | "b" | null;
  reference: string | null;
  pin: string | null;
  detail: Record<string, unknown> | null;
  redacted: boolean;
  /** SB2-100: the finding's identity across re-reads; null when redacted. */
  key?: string | null;
  /** SB2-100: set when a waiver accepts this finding. */
  waived?: WaiverStamp | null;
}

export interface WaiverStamp {
  id: string;
  note: string | null;
  by: string;
  at: string;
}

/** SB2-100 (D-P2-56): an accepted warning or info finding; `active` while the finding occurs. */
export interface FindingWaiver extends WaiverStamp {
  findingKey: string | null;
  rule: string;
  active: boolean;
  redacted?: boolean;
}

/** SB2-108 (P2 §24.2): the stored collision check against the document's placement. */
export interface CollisionCheck {
  state: "current" | "stale" | "not_checked";
  checkedAt: string | null;
  notEvaluated: { occurrence: string; label: string; reason: string }[];
}

export interface ValidationReport {
  findings: Finding[];
  collisionCheck?: CollisionCheck;
  waivers?: FindingWaiver[];
  notEvaluated: { rule: string; instanceId: string; reason: string }[];
  exempt: {
    rule: string;
    instanceId: string;
    portKey: string | null;
    reference: string | null;
    pin: string | null;
    links: string[];
    harness: string;
    redacted?: boolean;
  }[];
  counts: FindingCounts;
}

// Reviews (§7.1, §8.4)

export type ReviewKind = "source_update" | "baseline_unreachable" | "import" | "child_update" | "manifest_import";
export type ReviewStatus = "open" | "applied" | "kept_pinned" | "superseded" | "closed";
export type Decision = "accept" | "remap" | "bind_candidate" | "remove_rows";
export type ReviewItemKind = "connector_missing" | "connector_changed" | "pin_missing" | "net_changed" | "signal_mismatch";

export interface RebindCandidate {
  portKey: string;
  reference: string;
  referenceEqual: boolean;
  libIdEqual: boolean;
  pinCountEqual: boolean;
  netOverlap: number;
}

export interface ReviewItem {
  id: string;
  ordinal: number;
  kind: ReviewItemKind;
  linkId: string | null;
  end: "a" | "b" | null;
  rowIds: string[];
  pins: string[];
  expected: unknown;
  observed: unknown;
  candidates: RebindCandidate[] | null;
  decision: Decision | null;
  decisionPayload: Record<string, unknown> | null;
  redacted?: boolean;
}

export interface Review {
  id: string;
  kind: ReviewKind;
  status: ReviewStatus;
  instanceId: string | null;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  redacted: boolean;
  fromCommit: string | null;
  toCommit: string | null;
  pendingChanges: {
    portUpdates?: { linkId: string; end: "a" | "b"; port: PortBaseline }[];
    silent?: { kind: string; linkId: string; end: "a" | "b"; via?: string; before?: unknown; after?: unknown }[];
    /** A manifest_import review (P2 §21.3): the outside manifest's blob, what it changes, and why it cannot be accepted. */
    blob?: string | null;
    summary?: ManifestChangeSummary | null;
    problems?: string[];
  } | null;
  items: ReviewItem[] | null;
}

export interface ManifestAreaChanges {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface ManifestChangeSummary {
  instances: ManifestAreaChanges;
  links: ManifestAreaChanges;
  harnesses: ManifestAreaChanges;
  exports: ManifestAreaChanges;
  system: string[];
  placement: boolean;
  layout: boolean;
}

// History (§8.4)

export interface AuditEvent {
  seq: number;
  id: string;
  at: string;
  actor: string;
  kind: string;
  payload: Record<string, unknown> | null;
  redacted: boolean;
}

export interface HistoryPage {
  events: AuditEvent[];
  nextCursor: number | null;
}

// Snapshots (§9.1)

export interface SnapshotMeta {
  id: string;
  name: string;
  note: string;
  createdBy: string;
  createdAt: string;
  digest: string;
  /** Manifest connectivity digest; null for snapshots taken before manifests (P2 §9.4). */
  connectivityDigest?: string | null;
  manifestSchema?: string | null;
  openReviewCount: number;
  rendererVersion: string;
  /** SB2-116: what it froze: open errors and warnings, and its exports. */
  findingCounts?: { error: number; warning: number };
  exportCount?: number;
  /** The catalog revision this snapshot was published as, if any. */
  publication?: SnapshotPublication | null;
  /** Its commit to the linked repository; null when the system was not linked (P2 §21.2). */
  git?: SnapshotGit | null;
}

export type SnapshotGit =
  | { state: "queued" }
  | { state: "pushed"; commit: string; branch: string }
  | { state: "refused"; reason: "outside-change"; commit: string }
  | { state: "failed"; reason: string; message: string }
  | { state: "skipped" };

/** A system's repository link (P2 §21.1). */
export interface GitLink {
  url: string;
  branch: string;
  tip: string | null;
  knownBlob: string | null;
  /** A branch tip whose manifest changed outside Prism; snapshots wait for it (P2 §21.3). */
  outsideCommit: string | null;
  lastFetchedAt: string | null;
  lastError: { reason: string; message: string } | null;
  linkedBy: string;
  linkedAt: string;
}

export interface SnapshotPublication {
  componentId: string;
  revisionId: string;
  version: number | null;
  releaseStatus: string | null;
  /** The commit of the snapshot in the linked repository, when it was committed (P2 §21.6). */
  commit?: string | null;
}

export interface Snapshot extends SnapshotMeta {
  document: SystemDocument & { validation: ValidationReport; reviewRowIds: string[] };
}

export interface RowFields {
  pinA: string | null;
  pinB: string | null;
  signal: string;
  netA: string[] | null;
  netB: string[] | null;
}

export interface SnapshotDiff {
  snapshotId: string;
  against: string;
  boards: { instanceId: string; label: string; status: "added" | "removed" | "rebased"; before: string | null; after: string | null }[];
  links: {
    linkId: string;
    name: string;
    status: "added" | "removed" | "changed";
    rows: { added: LinkRow[]; removed: LinkRow[]; changed: { id: string; before: RowFields; after: RowFields }[] };
  }[];
}

// CSV import (§9.3)

export type ImportTarget =
  | "from_board" | "from_connector" | "from_pin" | "to_board" | "to_connector" | "to_pin"
  | "signal" | "harness" | "link_name" | "row_id"
  // Harness wires (CONTRACTS_P2 §17.4)
  | "from_end" | "from_end_pin" | "to_end" | "to_end_pin" | "gauge_awg" | "colour" | "wire_label";
export type ImportBucket = "matched" | "needsReview" | "unresolved" | "conflict";

export interface ImportUpload {
  importId: string;
  filename: string;
  delimiter: string;
  rowCount: number;
  columns: string[];
  sampleRows: Record<string, string>[];
  suggestedColumnMap: Partial<Record<ImportTarget, string>>;
  boardValues: Record<string, string[]>;
}

export interface ImportEnd {
  instanceId: string;
  label: string;
  reference: string;
  portKey: string;
  exposed: boolean;
  pin: string;
  pinNames: string[] | null;
  nets: string[];
}

export interface ImportEntry {
  line: number;
  values: Record<ImportTarget, string>;
  reason: string | null;
  from: ImportEnd | null;
  to: ImportEnd | null;
  signal: string;
  harness: string | null;
  linkName: string;
  linkId: string | null;
  rowId: string | null;
  action: "create" | "update" | null;
  /** A harness wire (§17.4): `linkName` is the harness, `linkId` its ID once it exists; ends by position. */
  kind?: "wire";
  fromEnd?: number | null;
  fromPin?: string;
  toEnd?: number | null;
  toPin?: string;
}

export interface ImportPreview extends Record<ImportBucket, ImportEntry[]> {
  importId: string;
  committed: boolean;
  counts: Record<ImportBucket, number>;
}

export interface ImportCommitReport {
  importId: string;
  created: number;
  updated: number;
  unchanged: number;
  linksCreated: string[];
  harnessesCreated?: string[];
  reviewId: string | null;
  counts: Record<ImportBucket, number>;
  unresolved: ImportEntry[];
  conflict: ImportEntry[];
}

// Generators (§8.5)

export type GeneratorKind = "identity" | "reverse" | "offset" | "net_name";

export interface GeneratedRow {
  pinA: string;
  pinB: string;
  signal: string;
  source: "generator";
  netA: string[];
  netB: string[];
  pinNamesA: string[] | null;
  pinNamesB: string[] | null;
  /** SB2-120: the join rules this pair would raise once saved (SYS-V09, V10, V23). */
  flags?: { rule: string; name: string; severity: "error" | "warning" | "info" }[];
}

export interface GeneratorResult {
  linkId: string;
  generator: GeneratorKind;
  rows: GeneratedRow[];
  skipped: { pinA: string; pinB: string; reason: "existing" | "unconnected" }[];
}

/** `GET …/hierarchy` (CONTRACTS_P2 §11): every occurrence, redacted for the reader. */
export interface SystemOccurrence {
  path: string;
  displayPath: string;
  labels: string[];
  instanceId: string;
  kind: "board" | "assembly" | "module" | "part";
  depth: number;
  systemId: string;
  projectId: string | null;
  baselineCommit: string | null;
  componentId: string | null;
  revisionId: string | null;
  childSystemId: string | null;
  childSnapshotId: string | null;
  unresolved: boolean;
  restricted: boolean;
}

export interface SystemHierarchy {
  systemId: string;
  occurrences: SystemOccurrence[];
  boardCount: number;
}

/** `GET …/scene` → `prism.system_scene.a0` (CONTRACTS_P2 §20). Lengths in mm; matrices column-major. */
export interface SystemSceneAsset {
  assetId: string;
  projectId: string;
  commit: string;
  status: "ready" | "building" | "missing" | "failed";
  bundleUrl: string | null;
  sourceRevisionKey: string | null;
  generatorBuild: string | null;
  jobId: string | null;
  error: string | null;
  bundleToBoard: number[] | null;
}

export interface SystemSceneOccurrence {
  path: string;
  parentPath: string | null;
  displayPath: string;
  labels: string[];
  instanceId: string;
  kind: "board" | "assembly" | string;
  depth: number;
  restricted: boolean;
  assetId: string | null;
  pose: { translationMm: number[]; rotation: number[]; source: "default" | "manual" | "auto" };
  worldMatrix: number[];
  boundsMm: { minMm: number[]; maxMm: number[] } | null;
  /** SB2-37: the driving mate that placed it (null: a root, or not mated); absent from older servers. */
  mate?: SystemSceneMate | null;
  /** SB2-48b: a catalog GLB drawn in the occurrence frame (`matrixMm`: model STEP mm → occurrence; proxy box while loading). */
  model?: { glbKey: string; matrixMm?: number[]; boundsMm?: { minMm: number[]; maxMm: number[] } | null };
  /** SB2-48b: a coloured box in the occurrence frame. */
  box?: { boundsMm: { minMm: number[]; maxMm: number[] }; rgba?: [number, number, number, number] };
  /** SB2-48b: `false` never moves; an object limits the gizmo to these local axes (indices 0–2). */
  move?: false | { translate?: number[]; rotate?: number[]; rotateSnapDeg?: number; pivot?: "origin" | "bounds" };
  /** SB2-48b: surface picks (`pickSurfaceAt`) may land on this occurrence's model. */
  pickSurface?: boolean;
}

/** How a mated occurrence is placed (CONTRACTS_P2 §14.9). */
export interface SystemSceneMate {
  linkId: string;
  /** The occurrence path it hangs from. */
  from: string;
  /** A manual pose replaced the mated one ("Mated position overridden"). */
  overridden: boolean;
  /** Where "Snap back" returns it. */
  autoPose: { translationMm: number[]; rotation: number[] };
}

/** The root level's solve (CONTRACTS_P2 §14.9). */
export interface SystemScenePlacement {
  roots: string[];
  mismatches: { linkId: string; offsetMm: number[]; lateralMm: number; axialMm: number; angleDeg: number }[];
  /** B2B links that can't place yet: an end without a confirmed frame, or an unreadable connector. */
  unusable: string[];
  ignoredOverrides: { member: string; linkId: string; reason: "not_a_usable_mate" | "root" | "unreachable" }[];
}

/** A stored pose (CONTRACTS_P2 §14.3); an instance without one takes its default pose. */
export interface StoredPose {
  instanceId: string;
  translationMm: [number, number, number];
  rotation: [number, number, number, number];
  source: "manual" | "auto" | "default";
  updatedBy: string;
  updatedAt: string;
}

export interface SystemScene {
  schema: "prism.system_scene.a0";
  systemId: string;
  systemVersion: number;
  units: "mm";
  assets: SystemSceneAsset[];
  occurrences: SystemSceneOccurrence[];
  /** SB2-34: harnesses drawn as proxies; absent from older servers. */
  harnesses?: SystemSceneHarness[];
  /** SB2-37: the root level's mate solve; null without B2B links, absent from older servers. */
  placement?: SystemScenePlacement | null;
  /** #698: pinned model and housing revisions with a GLB conversion queued or running (catalog writers only). */
  modelsConverting?: number;
}

/** A harness in the scene (CONTRACTS_P2 §20.11): its ends on board placements, its wires as end pairs. */
export interface SystemSceneHarness {
  id: string;
  /** The child system it belongs to (occurrence path), or null for the root. */
  level: string | null;
  name: string;
  /** `occurrence` null: unmated, or a board the reader cannot see; `reference` null on a restricted board. */
  ends: { id: string; ordinal: number; occurrence: string | null; reference: string | null }[];
  wires: { id: string; from: string; to: string }[];
  /** SB2-45: in the level's frame; absent from older servers. */
  nodes?: HarnessNode[];
}

/** `GET …/instances/{iid}/mating` (CONTRACTS_P2 §15.3). */
export type MatingAxis = "top" | "bottom" | "+x" | "-x" | "+y" | "-y";

export interface PortMating {
  portKey: string;
  reference: string;
  footprint: string;
  hasGeometry: boolean;
  inferred: { axis: MatingAxis | null; confidence: "high" | "medium" | "low"; reasons: string[] };
  stored: { mode: "confirmed" | "override"; axis: MatingAxis; quarterTurns: number; stale: boolean } | null;
}

/** `GET …/placement` (CONTRACTS_P2 §14.10): the root level's solve, by instance ID. */
export interface SystemPlacement {
  systemId: string;
  version: number;
  roots: string[];
  driving: Record<string, { linkId: string; from: string; overridden: boolean }>;
  mismatches: SystemScenePlacement["mismatches"];
  unusable: string[];
  ignoredOverrides: SystemScenePlacement["ignoredOverrides"];
  /** The user's choices: instance → link. */
  drivingMates: Record<string, string>;
}

/** One connector of `GET …/links/{lid}/mate`; `geometry` null for a subsystem or an unread connector. */
export interface LinkMateEnd {
  instanceId: string;
  kind: string;
  portKey: string;
  reference: string;
  geometry: ConnectorGeometry | null;
  thicknessMm: number | null;
  inferred: PortMating["inferred"] | null;
  stored: PortMating["stored"];
}

export interface LinkMate {
  linkId: string;
  stackHeightMm: number | null;
  a: LinkMateEnd;
  b: LinkMateEnd;
}

export interface InstanceMating {
  instanceId: string;
  boardThicknessMm: number | null;
  ports: PortMating[];
}

/** A system net (CONTRACTS_P2 §8.2): `GET …/nets` lists these, `GET …/nets/{groupId}` adds members and hops. */
export interface SystemNetSummary {
  groupId: string;
  name: string;
  aliases: string[];
  pinCount: number;
  /** Over 200 pins: the UI confirms before highlighting. */
  large: boolean;
}

/** A net as `GET …/nets` lists it. */
export interface SystemNetListed extends SystemNetSummary {
  /** Visible boards it reaches. */
  boards?: number;
  /** With `members=true` (SB2-33): its visible board nets. */
  members?: { occurrence: string; net: string }[];
}

export interface SystemNetList {
  systemId: string;
  groups: SystemNetListed[];
  total: number;
  /** The page's start (`GET …/nets?offset=`); absent from older servers. */
  offset?: number;
}

/** A member: a board net on one occurrence; restricted boards are `{occurrence: null, redacted: true}`. */
export interface SystemNetMember {
  occurrence: string | null;
  displayPath?: string;
  net?: string | null;
  redacted?: boolean;
}

export interface SystemNetHopEnd {
  occurrence: string | null;
  displayPath?: string | null;
  portKey?: string | null;
  reference?: string | null;
  pad?: string | null;
  nets?: string[];
  end?: string;
  endPin?: string;
}

export interface SystemNetHop {
  kind: "row" | "wire";
  linkId?: string;
  linkName?: string;
  harnessId?: string;
  harnessName?: string;
  wireId?: string;
  signal?: string;
  from: SystemNetHopEnd;
  to: SystemNetHopEnd;
}

export interface SystemNetDetail extends SystemNetSummary {
  members: SystemNetMember[];
  hops: SystemNetHop[];
}
