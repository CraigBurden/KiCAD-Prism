// Custom metadata fields in import remediation (D43). The grid and the dialog
// show one editable value per active custom field; the server refuses an accept
// that leaves a required one blank (field_rules.custom_import_problems).
import { importCustomFields } from "@/lib/catalog-field-rules";
import { useServerState } from "@/lib/server-state";
import type { CatalogMetadataField, ProjectComponentImportProposal } from "@/types/catalog";
import { listMetadataFields } from "./catalog-client";

const CUSTOM_FIELDS_KEY = ["catalog", "metadata-fields", "import-custom"] as const;
const NO_FIELDS: CatalogMetadataField[] = [];

/** The active custom fields an import can fill; empty until they load (or when they fail to). */
export function useImportCustomFields(): CatalogMetadataField[] {
  const read = useServerState(CUSTOM_FIELDS_KEY, async () => {
    const payload = await listMetadataFields();
    return importCustomFields(payload?.items ?? []);
  });
  return read.data ?? NO_FIELDS;
}

/** The symbol fields the scan found, which an accept stores as `extra_fields` unless overridden. */
export function scannedExtraFields(proposal: ProjectComponentImportProposal): Record<string, string> {
  const fields = (proposal.metadata as { fields?: unknown }).fields;
  if (!fields || typeof fields !== "object") return {};
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value ?? "")]));
}

/**
 * The accept request's `extra_fields`: the symbol's own fields with the edited
 * custom values over them (the request replaces the symbol's fields), or
 * undefined when nothing was edited so the server keeps the symbol's fields.
 */
export function acceptExtraFields(
  proposal: ProjectComponentImportProposal,
  edited: Readonly<Record<string, string>>,
): Record<string, string> | undefined {
  if (Object.keys(edited).length === 0) return undefined;
  return { ...scannedExtraFields(proposal), ...edited };
}
