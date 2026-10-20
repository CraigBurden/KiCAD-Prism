/**
 * The Publish dialog (stage 3d-3, §11, §15.4, mockup 05): the identity, its
 * numbers, the STEP row, the interface and the checks, then Publish to QA
 * review. After the first publish the identity is fixed. While the bundle is
 * still building the server answers `system_bundle_not_ready`, and the dialog
 * asks again until it is ready.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiHttpError } from "@/lib/api";

import { publishSystem, readPublication } from "../model/api";
import type { SystemBundle, SystemDocument, SystemPublication } from "../model/types";
import { defaultIdentity, interfaceSummary, publishChecks, stepRow, type Identity } from "./publish-checks";

const RETRY_MS = 2000;
const RETRY_LIMIT = 60;

/** Library Manager at a component (its catalog page). */
export function componentPath(componentId: string): string {
  return `/?workspace=library&section=library-manager&component=${encodeURIComponent(componentId)}`;
}

const pill = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:text-foreground"}`;

export function PublishDialog({ systemId, name, version, document, bundle, building, onClose }: {
  systemId: string;
  name: string;
  version: number;
  document: SystemDocument;
  bundle: SystemBundle | null;
  /** The bundle does not match the document yet. */
  building: boolean;
  onClose: () => void;
}) {
  const [publication, setPublication] = useState<SystemPublication | null>(null);
  const [chosen, setChosen] = useState<Identity | null>(null);
  const [ipn, setIpn] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [mpn, setMpn] = useState("");
  const [summary, setSummary] = useState(`Publish ${name} v${version}`);
  const [busy, setBusy] = useState<"publishing" | "waiting" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ componentId: string; revisionId: string; stage: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    readPublication(systemId, controller.signal).then(setPublication).catch(() => setPublication({ componentId: null, identity: null, publications: [] }));
    return () => controller.abort();
  }, [systemId]);

  // A published system keeps its identity; a first publish starts from the document's kind.
  const fixed = publication?.identity ?? null;
  const identity: Identity = fixed ?? chosen ?? defaultIdentity(document);
  const checks = publishChecks(document, bundle, identity, building);
  const step = stepRow(document, bundle);
  const numbersReady = fixed ? true : identity === "in-house" ? ipn.trim() !== "" : manufacturer.trim() !== "" && mpn.trim() !== "";
  // A building bundle is waited for; any other failed check blocks.
  const blocking = checks.filter((check) => !check.ok && check.key !== "bundle");

  const submit = async () => {
    if (busy || !numbersReady || blocking.length || !summary.trim()) return;
    setError(null);
    const body = {
      identity,
      changeSummary: summary.trim(),
      ...(fixed ? {} : identity === "in-house" ? { ipn: ipn.trim() } : { manufacturer: manufacturer.trim(), mpn: mpn.trim() }),
    };
    for (let attempt = 0; attempt < RETRY_LIMIT; attempt += 1) {
      setBusy(attempt ? "waiting" : "publishing");
      try {
        setResult(await publishSystem(systemId, version, body));
        setBusy(null);
        return;
      } catch (failure) {
        if (failure instanceof ApiHttpError && failure.code === "system_bundle_not_ready") {
          await new Promise((resolve) => window.setTimeout(resolve, RETRY_MS));
          continue;
        }
        setError(failure instanceof Error ? failure.message : String(failure));
        setBusy(null);
        return;
      }
    }
    setError("The system bundle is still building; try again in a moment.");
    setBusy(null);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Publish {name}</DialogTitle>
          <DialogDescription>
            {result ? "Published for review." : fixed ? `Adds a revision to its published ${fixed} entry.` : identity === "bought-out" ? "A board-less system publishes as a bought-out entry." : "Publishes the system as an in-house entry."}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-2 text-sm">
            <p>
              Revision <span className="font-mono">{result.revisionId.slice(0, 8)}</span> is in <span className="font-medium">{result.stage.replace("_", " ")}</span>. It is released through the catalog&apos;s review.
            </p>
            <Link className="text-primary underline" to={componentPath(result.componentId)}>Open it in Library Manager</Link>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex gap-2" role="radiogroup" aria-label="Identity">
              {(["bought-out", "in-house"] as const).map((option) => (
                <button key={option} type="button" role="radio" aria-checked={identity === option} disabled={Boolean(fixed)} className={pill(identity === option)} onClick={() => setChosen(option)}>
                  {option === "bought-out" ? "Bought-out · MPN" : "In-house · IPN"}
                </button>
              ))}
            </div>
            <dl className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-2">
              {identity === "in-house" ? (
                <>
                  <dt className="text-muted-foreground">IPN</dt>
                  <dd>{fixed ? <span className="font-mono">{publication?.ipn}</span> : <Input value={ipn} onChange={(event) => setIpn(event.target.value)} placeholder="internal part number" aria-label="IPN" />}</dd>
                </>
              ) : (
                <>
                  <dt className="text-muted-foreground">Manufacturer</dt>
                  <dd>{fixed ? publication?.manufacturer : <Input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} placeholder="manufacturer" aria-label="Manufacturer" />}</dd>
                  <dt className="text-muted-foreground">MPN</dt>
                  <dd>{fixed ? <span className="font-mono">{publication?.mpn}</span> : <Input value={mpn} onChange={(event) => setMpn(event.target.value)} placeholder="manufacturer part number" aria-label="MPN" />}</dd>
                  <dt className="text-muted-foreground">STEP</dt>
                  <dd className={step.ok ? "" : "text-amber-600"}>{step.ok ? `✓ ${step.text}` : step.text}</dd>
                </>
              )}
              <dt className="self-start text-muted-foreground">Interface</dt>
              <dd className="space-y-0.5 font-mono text-xs">
                {interfaceSummary(document, bundle).map((line) => <div key={line}>{line}</div>)}
                {document.exports.length === 0 && <span className="font-sans text-muted-foreground">Nothing exported yet</span>}
              </dd>
              <dt className="self-start text-muted-foreground">Checks</dt>
              <dd className="space-y-0.5 text-xs">
                {checks.map((check) => (
                  <div key={check.key} className={`flex items-center gap-1.5 ${check.ok ? "text-emerald-600" : check.key === "bundle" ? "text-muted-foreground" : "text-destructive"}`}>
                    {check.ok ? <Check className="h-3.5 w-3.5" /> : check.key === "bundle" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    <span>{check.label}: {check.detail}</span>
                  </div>
                ))}
              </dd>
              <dt className="self-start text-muted-foreground">Summary</dt>
              <dd><Textarea value={summary} onChange={(event) => setSummary(event.target.value)} aria-label="Change summary" rows={2} /></dd>
            </dl>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
        )}
        <DialogFooter>
          {result ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={Boolean(busy)}>Cancel</Button>
              <Button onClick={() => void submit()} disabled={Boolean(busy) || !publication || !numbersReady || blocking.length > 0 || !summary.trim()}>
                {busy === "waiting" ? "Waiting for the bundle…" : busy ? "Publishing…" : "Publish to QA review"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
