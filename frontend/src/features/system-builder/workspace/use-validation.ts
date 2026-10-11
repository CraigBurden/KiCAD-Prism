import type { Finding, SystemDocument, ValidationReport } from "@/types/system";

const NONE: Finding[] = [];

/** The system's findings (P1 §7.2), read with the document since SB2-98. */
export function useValidation(document: SystemDocument): { findings: Finding[]; report: ValidationReport | null } {
  const report = document.validation ?? null;
  return { findings: report?.findings ?? NONE, report };
}
