// Renders the catalog field rules the server enforces
// (backend/app/services/catalog/field_rules.py) from their generated contract.
// The metadata editor, the bulk-edit grid and the import remediation surfaces
// ask here instead of keeping their own required lists or URL checks.
// catalog-field-rules.cases.json is run against this module and the Python
// rules alike, so the two cannot disagree.
import { CATALOG_FIELD_RULES } from "./catalog-field-rules.generated";

export type FieldRulesContext = keyof typeof CATALOG_FIELD_RULES.contexts;
export type IdentityKind = keyof typeof CATALOG_FIELD_RULES.identityExemptFields;
type FieldVerdict = "" | keyof typeof CATALOG_FIELD_RULES.fieldMessages;

/** The parts of a metadata field definition the rules read. */
interface RuleField {
  key: string;
  type?: string;
  required?: boolean;
  enum_values?: readonly string[];
}

/** A metadata field definition as the import surfaces read it. */
interface CustomRuleField extends RuleField {
  label: string;
  storage_key: string;
  built_in?: boolean;
  archived?: boolean;
}

interface ImportFinding {
  code: string;
  severity: string;
}

const NUMBER = new RegExp(CATALOG_FIELD_RULES.numberPattern);
const URL_PATTERN = new RegExp(CATALOG_FIELD_RULES.urlPattern, "i");
const BOOLEAN_TOKENS: readonly string[] = CATALOG_FIELD_RULES.booleanTokens;
const BUILTIN_REQUIRED: Readonly<Record<string, boolean>> = CATALOG_FIELD_RULES.builtinRequired;
const IMPORT_RULES = CATALOG_FIELD_RULES.import;

export function isFieldRequired(field: RuleField, identityKind: IdentityKind = "mpn"): boolean {
  const exempt: readonly string[] = CATALOG_FIELD_RULES.identityExemptFields[identityKind] ?? [];
  if (exempt.includes(field.key)) return false;
  return BUILTIN_REQUIRED[field.key] ?? Boolean(field.required);
}

export function fieldVerdict(
  field: RuleField,
  value: string | null | undefined,
  context: FieldRulesContext,
  identityKind: IdentityKind = "mpn",
): FieldVerdict {
  const text = String(value ?? "").trim();
  if (!text) return isFieldRequired(field, identityKind) ? "required" : "";
  if (!CATALOG_FIELD_RULES.contexts[context].shapeChecks) return "";
  switch (field.type) {
    case "number":
      return NUMBER.test(text) ? "" : "number";
    case "url":
      return URL_PATTERN.test(text) ? "" : "url";
    case "boolean":
      return BOOLEAN_TOKENS.includes(text.toLowerCase()) ? "" : "boolean";
    case "enum":
      return (field.enum_values ?? []).includes(text) ? "" : "enum";
    default:
      return "";
  }
}

/** The message for `value` in `field`, or "" when it is valid in `context`. */
export function fieldError(
  field: RuleField,
  value: string | null | undefined,
  context: FieldRulesContext,
  identityKind: IdentityKind = "mpn",
): string {
  const verdict = fieldVerdict(field, value, context, identityKind);
  return verdict ? CATALOG_FIELD_RULES.fieldMessages[verdict] : "";
}

/** Whether an import field, named as in the accept request, must hold a value. */
export function isImportFieldRequired(key: string): boolean {
  const item = IMPORT_RULES.fields.find((candidate) => candidate.key === key);
  return item ? isFieldRequired({ key: item.fieldKey }, "mpn") : false;
}

/** Why proposal metadata keyed by accept-request name cannot be accepted yet. */
export function importMetadataProblems(values: Readonly<Record<string, string | undefined>>): string[] {
  const problems: string[] = [];
  for (const item of IMPORT_RULES.fields) {
    const verdict = fieldVerdict({ key: item.fieldKey, type: item.type }, values[item.key], "import", "mpn");
    if (verdict) problems.push(`${item.label} ${IMPORT_RULES.messages[verdict]}`);
  }
  return problems;
}

/** The active custom fields an import can fill (custom values live in `extra_fields`). */
export function importCustomFields<T extends CustomRuleField>(fields: readonly T[]): T[] {
  return fields.filter((field) => !field.built_in && !field.archived);
}

/**
 * Why `extraFields` (keyed by storage key) cannot be accepted: one
 * "<Label> is required" per custom required field left blank. Presence only,
 * as the server's `custom_import_problems`.
 */
export function customImportProblems(
  fields: readonly CustomRuleField[],
  extraFields: Readonly<Record<string, string | undefined>>,
): string[] {
  const problems: string[] = [];
  for (const field of importCustomFields(fields)) {
    if (fieldVerdict(field, extraFields[field.storage_key], "editor", "mpn") === "required") {
      problems.push(`${field.label || field.key} ${IMPORT_RULES.messages.required}`);
    }
  }
  return problems;
}

/** Error findings that metadata edits and asset links cannot resolve. */
export function blockingImportFindings<T extends ImportFinding>(
  findings: readonly T[],
  linkedAssetTypes: Iterable<string> = [],
): T[] {
  const resolvedByLink = new Set(
    [...linkedAssetTypes].map((assetType) => `${assetType}${IMPORT_RULES.linkResolvedFindingSuffix}`),
  );
  return findings.filter(
    (finding) =>
      finding.severity === "error"
      && !IMPORT_RULES.editableFindingPrefixes.some((prefix) => finding.code.startsWith(prefix))
      && !resolvedByLink.has(finding.code),
  );
}
