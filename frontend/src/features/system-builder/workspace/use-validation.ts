import type { Finding, SystemDocument, ValidationReport } from "@/types/system";

const NONE: Finding[] = [];

/** The system's findings (P1 §7.2), read with the document since SB2-98. */
export function useValidation(document: SystemDocument): { findings: Finding[]; report: ValidationReport | null } {
  const report = document.validation ?? null;
  return { findings: report?.findings ?? NONE, report };
}

/** Open findings that concern one harness (they name it in their detail); SB2-100: waived ones colour nothing. */
export function harnessFindings(findings: Finding[], harnessId: string): Finding[] {
  return findings.filter((finding) => !finding.waived && (finding.detail as { harnessId?: string } | null)?.harnessId === harnessId);
}
