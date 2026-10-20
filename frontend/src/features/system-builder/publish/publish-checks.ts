/**
 * What the Publish dialog shows before publishing (stage 3d-3, §15.4): the
 * identity it starts with, the STEP row, the interface and the checks of
 * §11.2 step 3, all read from the live document and bundle. The server
 * decides; these only say up front what it will say.
 */
import type { SystemBundle, SystemDocument } from "../model/types";
import { exportLabel, exportPins } from "./export-edits";

export type Identity = "in-house" | "bought-out";

/** The identity a first publish starts with: bought-out for a module (a body, no boards), else in-house. */
export function defaultIdentity(document: SystemDocument): Identity {
  const kinds = new Set(document.occurrences.map((item) => item.source.kind));
  return kinds.has("body") && !kinds.has("board") ? "bought-out" : "in-house";
}

export interface PublishCheck {
  key: string;
  label: string;
  ok: boolean;
  /** What failed, or what passed, in a few words. */
  detail: string;
}

const bodiesWithModels = (document: SystemDocument, bundle: SystemBundle | null | undefined) => {
  const states = new Map((bundle?.occurrences ?? []).map((item) => [item.occurrence, item.state]));
  const missing = new Set<string>();
  for (const finding of bundle?.findings ?? []) if (finding.code === "body-model-missing") missing.add(finding.subject);
  return document.occurrences.filter(
    (item) => item.source.kind === "body" && states.get(item.id) === "ready" && !missing.has(`occurrence:${item.id}`),
  );
};

/** The STEP row: the body whose model a bought-out entry carries, or what is missing. */
export function stepRow(document: SystemDocument, bundle: SystemBundle | null | undefined): { ok: boolean; text: string } {
  const bodies = document.occurrences.filter((item) => item.source.kind === "body");
  if (!bodies.length) return { ok: false, text: "No body: add one in 3D" };
  const ready = bodiesWithModels(document, bundle);
  if (ready.length) return { ok: true, text: `${ready.map((item) => item.label).join(", ")} (from the body)` };
  return { ok: false, text: "The body's part has no converted STEP model yet" };
}

/** Each export as the interface lists it: `NAME: pin, pin, …`, a sub-port's as `NAME{members}`. */
export function interfaceSummary(document: SystemDocument, bundle: SystemBundle | null | undefined): string[] {
  return [...document.exports]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((item) => {
      const names = [...new Set(exportPins(document, bundle, item).map((pin) => pin.name))];
      return `${exportLabel(document, item)}: ${names.join(", ") || "no pins yet"}`;
    });
}

/**
 * §11.2 step 3's checks against the live system, in the server's order.
 * `building` says the bundle does not match the document yet.
 */
export function publishChecks(document: SystemDocument, bundle: SystemBundle | null | undefined, identity: Identity, building: boolean): PublishCheck[] {
  const findings = bundle?.findings ?? [];
  const unwaived = findings.filter((item) => item.severity === "error" && !item.waived);
  const unreleased = findings.filter((item) => item.code === "entry-unreleased");
  const notReady = (bundle?.occurrences ?? []).filter((item) => document.occurrences.some((occurrence) => occurrence.id === item.occurrence && occurrence.source.kind === "board") && item.state !== "ready");
  const checks: PublishCheck[] = [
    { key: "exports", label: "Exports", ok: document.exports.length > 0, detail: document.exports.length ? `${document.exports.length} exported` : "Export a connector or sub-port first" },
    {
      key: "bundle",
      label: "Bundle",
      ok: Boolean(bundle) && !building && notReady.length === 0,
      detail: !bundle || building ? "Building…" : notReady.length ? `${notReady.length} board(s) not ready` : "Built",
    },
    {
      key: "errors",
      label: "Checks",
      ok: unwaived.length === 0,
      detail: unwaived.length ? `${unwaived.length} unwaived error(s): ${[...new Set(unwaived.map((item) => item.code))].join(", ")}` : "No unwaived errors",
    },
    { key: "entries", label: "Placed systems", ok: unreleased.length === 0, detail: unreleased.length ? `${unreleased.length} not released` : "All released" },
  ];
  if (identity === "bought-out") {
    const step = stepRow(document, bundle);
    checks.push({ key: "body", label: "STEP body", ok: step.ok, detail: step.text });
  }
  return checks;
}
