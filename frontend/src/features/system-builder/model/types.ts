/**
 * The System Builder v2 types the frontend uses, named after the contract
 * (`docs/system-builder/CONTRACTS.md`). The shapes come from the generated
 * modules beside this file; this module only gives them short names and adds
 * the HTTP envelopes the API returns (§5).
 */
import type { SystemBundleA0 } from "./system-bundle-a0.generated";
import type { SystemOp, SystemOpsA0 } from "./system-ops-a0.generated";
import type {
  SystemEndpoint,
  SystemHarness,
  SystemHarnessEnd,
  SystemHarnessLink,
  SystemInterior,
  SystemMate,
  SystemOccurrence,
  SystemPortPlacement,
  SystemSchematicPlacement,
  SystemSchematicPoint,
  SystemSite,
  SystemSubPort,
  SystemV2,
} from "./system-v2.generated";

export type {
  SystemBundleA0 as SystemBundle,
  SystemOp,
  SystemOpsA0 as SystemOpsRequest,
  SystemV2 as SystemDocument,
  SystemEndpoint as Endpoint,
  SystemHarness as Harness,
  SystemHarnessEnd as HarnessEnd,
  SystemHarnessLink as HarnessLink,
  SystemInterior as Interior,
  SystemMate as Mate,
  SystemOccurrence as Occurrence,
  SystemPortPlacement as PortPlacement,
  SystemSchematicPlacement as SchematicPlacement,
  SystemSchematicPoint as SchematicPoint,
  SystemSite as Site,
  SystemSubPort as SubPort,
};
export type {
  SystemBundleConnector as BundleConnector,
  SystemBundleFinding as BundleFinding,
  SystemBundleOccurrence as BundleOccurrence,
  SystemBundlePin as BundlePin,
  SystemBundleSuggestion as BundleSuggestion,
} from "./system-bundle-a0.generated";

/** A sheet edge (§2.8). */
export type Edge = SystemPortPlacement["edge"];

/** `GET /api/systems`: one row per system the caller can see. */
export interface SystemSummary {
  systemId: string;
  name: string;
  folderId: string | null;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /api/systems/{id}` and every write: the document at a version, redacted for the caller (§6). */
export interface SystemRecord extends SystemSummary {
  document: SystemV2;
  redacted: boolean;
}

/** `GET /api/systems/{id}/bundle` (§8): the bundle once built, else its build state. */
export interface SystemBundleAnswer {
  state: "ready" | "building" | "failed";
  key: string;
  /** Occurrences whose design bundle is still being built. */
  pending: string[];
  documentVersion: number;
  bundle?: SystemBundleA0;
  error?: string;
}

/** One generated harness file (§16.7). */
export interface HarnessOutputFile {
  name: string;
  title: string;
  contentType: string;
}

/** `GET /api/systems/{id}/harnesses/{harness}/outputs` (§16.7): the index, or that the bundle builds. */
export interface HarnessOutputsIndex {
  state: "ready" | "building";
  files: HarnessOutputFile[];
  /** How many `sheet-<i>.svg` previews the harness drawing has. */
  sheets: number;
}

/** `GET /api/systems/{id}/icd` (§17): the same index shape, for the interface control document. */
export type IcdIndex = HarnessOutputsIndex;

/** One board's model in the STEP assembly (§18). */
export interface StepBoard {
  occurrence: string;
  label: string;
  state: "queued" | "building" | "ready" | "failed";
  /** Component models `kicad-cli` reported it could not find. */
  missingModels: number;
  /** The export fell back to a plain checkout (submodules or LFS missing). */
  fallback: boolean;
}

/** `GET`/`POST /api/systems/{id}/step` (§18): the current bundle key's STEP assembly. */
export interface SystemStepAnswer {
  state: "none" | "building" | "ready" | "failed";
  boards: StepBoard[];
  /** Product names whose model was missing from the assembly. */
  missing: string[];
  error?: string;
  sizeBytes?: number;
}

/** `GET /api/systems/{id}/history`: one logged request, newest first. */
export interface SystemHistoryEntry {
  version: number;
  kind: "edit" | "undo" | "system";
  actor: string;
  undoes: number | null;
  touched: string[];
  createdAt: string;
}

/** `GET`/`POST /api/systems/{id}/snapshots`: a named copy of the document (§5). */
export interface SystemSnapshot {
  snapshotId: string;
  systemId: string;
  version: number;
  name: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
  /** Set when taking the snapshot also queued its Git commit (§13.2). */
  gitCommitJobId?: string;
}

/** The file a system is linked to and the last commit Prism made there (§13.1). */
export interface SystemGitLink {
  projectId: string;
  branch: string;
  path: string;
  lastCommit: string | null;
  lastBlob: string | null;
  lastVersion: number | null;
  linkedBy: string;
  linkedAt: string;
}

/** A commit job's state, as the job table names it. */
export type SystemGitJobStatus =
  | "queued"
  | "running"
  | "retry_wait"
  | "cancel_requested"
  | "completed"
  | "failed"
  | "cancelled";

/** The newest commit job a system queued, whatever its state (§13.2). */
export interface SystemGitJob {
  jobId: string;
  status: SystemGitJobStatus;
  errorCode: string | null;
  errorMessage: string | null;
  blob: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** `GET`/`PUT /api/systems/{id}/git`: the link and its newest commit job. */
export interface SystemGit {
  systemId: string;
  link: SystemGitLink | null;
  lastJob: SystemGitJob | null;
}

/** One past publication of a system (§11.4). */
export interface SystemPublicationEntry {
  version: number;
  snapshotId: string;
  revisionId: string;
  stage: string | null;
  publishedBy: string;
  publishedAt: string;
}

/** `GET /api/systems/{id}/publication`: the catalog identity and its history (§11.4). */
export interface SystemPublication {
  componentId: string | null;
  identity: "in-house" | "bought-out" | null;
  ipn?: string;
  manufacturer?: string;
  mpn?: string;
  publications: SystemPublicationEntry[];
}

/** `POST /api/systems/{id}/publish`: the revision it created (§11.2). */
export interface SystemPublishAnswer {
  componentId: string;
  revisionId: string;
  stage: string;
}

/** Narrow a `SystemOp` union member by its `kind`. */
export type OpOf<K extends SystemOp["kind"]> = Extract<SystemOp, { kind: K }>;
