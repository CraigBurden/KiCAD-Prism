import { fieldError } from "@/lib/catalog-field-rules";
import type { CatalogComponent, CatalogMetadataField } from "@/types/catalog";

export function activeMetadataFields(items: CatalogMetadataField[]): CatalogMetadataField[] {
  return items
    .filter((field) => !field.archived)
    .sort((left, right) => left.display_order - right.display_order || left.key.localeCompare(right.key));
}

export function componentFieldValue(component: CatalogComponent, field: CatalogMetadataField): string {
  if (field.storage_kind === "extra") return String(component.extra_fields?.[field.storage_key] ?? "");
  return String((component as unknown as Record<string, unknown>)[field.storage_key] ?? "");
}

export function valuesFromComponent(
  component: CatalogComponent,
  fields: CatalogMetadataField[],
): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, componentFieldValue(component, field)]));
}

export function unknownExtraFields(
  component: CatalogComponent,
  fields: CatalogMetadataField[],
): Record<string, string> {
  const claimed = new Set<string>();
  for (const field of fields) {
    if (field.storage_kind === "extra") claimed.add(field.storage_key);
  }
  return Object.fromEntries(
    Object.entries(component.extra_fields ?? {}).filter(([key]) => !claimed.has(key)),
  );
}

export function parseUnknownExtraJson(
  raw: string,
): { ok: true; extras: Record<string, string> } | { ok: false; message: string } {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, message: "Additional extra fields must be a JSON object." };
    }
    return {
      ok: true,
      extras: Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value ?? "")])),
    };
  } catch (reason) {
    return {
      ok: false,
      message: reason instanceof Error ? reason.message : "Unknown extra fields contain invalid JSON.",
    };
  }
}

export function metadataFormErrors(
  fields: CatalogMetadataField[],
  values: Record<string, string>,
  identityKind: CatalogComponent["identity_kind"],
  changeSummary: string,
  unknownExtrasJson: string,
): { fieldErrors: Record<string, string>; changeSummaryError: string; unknownExtrasError: string } {
  const parsed = parseUnknownExtraJson(unknownExtrasJson);
  return {
    fieldErrors: Object.fromEntries(
      // The single-component PATCH accepts the free-form strings the previous
      // editor stored, so the editor context checks presence only: blocking
      // on shape would trap saves on legacy values the user did not touch.
      fields.map((field) => [field.key, fieldError(field, values[field.key], "editor", identityKind)]),
    ),
    changeSummaryError: changeSummary.trim() ? "" : "Required",
    unknownExtrasError: parsed.ok ? "" : parsed.message,
  };
}

export function isMetadataFormComplete(errors: ReturnType<typeof metadataFormErrors>): boolean {
  return !errors.changeSummaryError
    && !errors.unknownExtrasError
    && Object.values(errors.fieldErrors).every((message) => !message);
}

export function buildMetadataPatch({
  values,
  fields,
  unknownExtras,
  changeSummary,
}: {
  values: Record<string, string>;
  fields: CatalogMetadataField[];
  unknownExtras: Record<string, string>;
  changeSummary: string;
}): Record<string, unknown> {
  const extraFields = { ...unknownExtras };
  const columns: Record<string, string> = {};
  for (const field of fields) {
    const value = (values[field.key] ?? "").trim();
    if (field.storage_kind === "extra") extraFields[field.storage_key] = value;
    else columns[field.storage_key] = value;
  }
  return {
    ...columns,
    extra_fields: extraFields,
    change_summary: changeSummary.trim(),
  };
}
