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

/** `GET /api/systems/{id}/history`: one logged request, newest first. */
export interface SystemHistoryEntry {
  version: number;
  kind: "edit" | "undo" | "system";
  actor: string;
  undoes: number | null;
  touched: string[];
  createdAt: string;
}

/** Narrow a `SystemOp` union member by its `kind`. */
export type OpOf<K extends SystemOp["kind"]> = Extract<SystemOp, { kind: K }>;
