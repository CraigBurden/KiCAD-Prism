import { useState } from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { newId } from "../model/ids";
import type { BundleFinding, SystemBundleAnswer, SystemDocument, SystemOp } from "../model/types";

const ORDER = { error: 0, warning: 1, info: 2 } as const;
const ICON = { error: AlertCircle, warning: AlertTriangle, info: Info } as const;
const TONE = { error: "text-destructive", warning: "text-amber-500", info: "text-muted-foreground" } as const;

/** Findings in severity order, then code and subject (CONTRACTS §8.7 order within a severity). */
export function sortFindings(findings: readonly BundleFinding[]): BundleFinding[] {
  return [...findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.code.localeCompare(b.code) || a.subject.localeCompare(b.subject));
}

const keyOf = (finding: BundleFinding) => `${finding.code}\u0000${finding.subject}`;

interface Props {
  document: SystemDocument;
  answer?: SystemBundleAnswer;
  findings: readonly BundleFinding[];
  stale: boolean;
  canEdit: boolean;
  apply: (ops: SystemOp[]) => Promise<unknown>;
  onSelect: (ids: Set<string>) => void;
}

export function ReviewPane({ document, answer, findings, stale, canEdit, apply, onSelect }: Props) {
  const [showWaived, setShowWaived] = useState(false);
  const [waiving, setWaiving] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const sorted = sortFindings(findings).filter((finding) => showWaived || !finding.waived);
  const waivedCount = findings.filter((finding) => finding.waived).length;

  const send = async (ops: SystemOp[]) => {
    try {
      await apply(ops);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };
  const waive = async (finding: BundleFinding) => {
    await send([{ kind: "add-waiver", waiver: { id: newId("wvr"), code: finding.code, subject: finding.subject, reason: reason.trim() } }]);
    setWaiving(null);
    setReason("");
  };
  const unwaive = (finding: BundleFinding) => {
    const waiver = document.waivers.find((item) => item.code === finding.code && item.subject === finding.subject);
    if (waiver) void send([{ kind: "remove-waiver", id: waiver.id }]);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex items-center gap-3 border-b px-4 py-2 text-sm">
        <span className="font-medium">Findings</span>
        <span className="text-muted-foreground">
          {(["error", "warning", "info"] as const).map((severity) => `${findings.filter((item) => item.severity === severity && !item.waived).length} ${severity === "info" ? "info" : `${severity}s`}`).join(" · ")}
        </span>
        {(answer?.state === "building" || stale) && <span className="text-xs text-muted-foreground">updating…</span>}
        {answer && answer.pending.length > 0 && <span className="text-xs text-muted-foreground">{answer.pending.length} board bundle(s) building</span>}
        {answer?.state === "failed" && <span className="text-xs text-destructive" title={answer.error}>build failed</span>}
        <span className="flex-1" />
        {waivedCount > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showWaived} onChange={(event) => setShowWaived(event.target.checked)} />
            Show {waivedCount} waived
          </label>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">{answer?.bundle || findings.length ? "Nothing to review." : "The system bundle has not been built yet."}</p>
        )}
        <ul className="divide-y">
          {sorted.map((finding) => {
            const Icon = ICON[finding.severity];
            const key = keyOf(finding);
            return (
              <li key={key} className={`px-4 py-2 text-sm ${finding.waived ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-2">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONE[finding.severity]}`} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(new Set(finding.objects))} title="Select in the schematic">
                    <span>{finding.message}</span>
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground">{finding.code}</span>
                  </button>
                  {canEdit && (finding.waived ? (
                    <Button size="sm" variant="ghost" onClick={() => unwaive(finding)}>Unwaive</Button>
                  ) : waiving !== key ? (
                    <Button size="sm" variant="ghost" onClick={() => setWaiving(key)}>Waive</Button>
                  ) : null)}
                </div>
                {waiving === key && (
                  <form
                    className="mt-2 flex gap-2 pl-6"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (reason.trim()) void waive(finding);
                    }}
                  >
                    <Input autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this is acceptable" aria-label="Waiver reason" className="h-8" />
                    <Button size="sm" type="submit" disabled={!reason.trim()}>Waive</Button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => setWaiving(null)}>Cancel</Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
