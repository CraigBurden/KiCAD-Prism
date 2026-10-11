import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { previewImport, uploadImport } from "@/lib/systems-api";
import { cn } from "@/lib/utils";
import type { ImportBucket, ImportCommitReport, ImportEntry, ImportPreview, ImportUpload } from "@/types/system";

import {
  REASON_LABELS,
  SKIP,
  TARGETS,
  boardValues,
  missingTargets,
  suggestBoardMap,
  unmappedBoards,
  type ColumnMap,
} from "./import-model";
import type { SystemTabProps } from "./system-tab-content";
import { useSystemSession } from "./session/use-system-session";

type Step = "upload" | "map" | "preview" | "done";

/** Radix Select items cannot hold "", so "no column" and "no board yet" use this. */
const NONE = "__none__";

const BUCKETS: { bucket: ImportBucket; label: string; tone: "success" | "warning" | "destructive" | "outline"; hint: string }[] = [
  { bucket: "matched", label: "Matched", tone: "success", hint: "Written on commit." },
  { bucket: "needsReview", label: "Needs review", tone: "warning", hint: "Queued as an import review on commit." },
  { bucket: "conflict", label: "Conflict", tone: "destructive", hint: "Not imported." },
  { bucket: "unresolved", label: "Unresolved", tone: "outline", hint: "Not imported." },
];

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function endText(entry: ImportEntry, side: "from" | "to"): string {
  const v = entry.values;
  const pad = v[`${side}_board`] || v[`${side}_connector`] ? `${v[`${side}_board`]}/${v[`${side}_connector`]}.${v[`${side}_pin`]}` : "";
  if (!v[`${side}_end`]) return pad;
  // A harness wire (§17.4): the end pin, and the connector pad it lands on.
  return `${v[`${side}_end`]}.${v[`${side}_end_pin`]} ${pad ? `(${pad})` : "(not mated)"}`;
}

export function ImportTab({ systemId, document, canEdit, onNavigate }: SystemTabProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<ImportUpload | null>(null);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [boardMap, setBoardMap] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [bucket, setBucket] = useState<ImportBucket>("matched");
  const [report, setReport] = useState<ImportCommitReport | null>(null);
  const [working, setWorking] = useState(false);
  const { edit } = useSystemSession();

  if (!canEdit) {
    return <p className="p-6 text-sm text-muted-foreground">Only designers can import connections.</p>;
  }

  const boards = document.instances.filter((instance) => !instance.restricted);
  const values = upload ? boardValues(upload, columnMap) : [];
  const missing = missingTargets(columnMap);
  const unmapped = unmappedBoards(values, boardMap);
  const maps = { columnMap, boardMap };

  const doUpload = async () => {
    if (!file) return;
    setWorking(true);
    try {
      const body = await uploadImport(systemId, file);
      setUpload(body);
      setColumnMap(body.suggestedColumnMap);
      setBoardMap(suggestBoardMap(boardValues(body, body.suggestedColumnMap), document.instances));
      setStep("map");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the CSV");
    } finally {
      setWorking(false);
    }
  };

  const setColumn = (target: string, column: string) => {
    const next = { ...columnMap, [target]: column || undefined };
    setColumnMap(next);
    if (upload) setBoardMap(suggestBoardMap(boardValues(upload, next), document.instances, boardMap));
  };

  const doPreview = async () => {
    if (!upload) return;
    setWorking(true);
    try {
      const { body } = await previewImport(systemId, upload.importId, maps);
      setPreview(body);
      setBucket(body.counts.matched ? "matched" : (BUCKETS.find((b) => body.counts[b.bucket])?.bucket ?? "matched"));
      setStep("preview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not preview the import");
    } finally {
      setWorking(false);
    }
  };

  const doCommit = async () => {
    if (!upload) return;
    setWorking(true);
    try {
      const result = await edit("import", (system) => system.commitImport(upload.importId, maps));
      if (result) {
        setReport(result.body);
        setStep("done");
      }
    } finally {
      setWorking(false);
    }
  };

  const restart = () => {
    setStep("upload");
    setFile(null);
    setUpload(null);
    setPreview(null);
    setReport(null);
    setColumnMap({});
    setBoardMap({});
  };

  return (
    <div className="space-y-5 pb-6 pt-4">
      <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="Import steps">
        {(["upload", "map", "preview", "done"] as Step[]).map((name, index) => (
          <li key={name} aria-current={step === name ? "step" : undefined}
            className={cn("flex items-center gap-1", step === name ? "font-medium text-foreground" : "text-muted-foreground")}>
            {index > 0 && <span aria-hidden className="px-1 text-muted-foreground">›</span>}
            {index + 1}. {name === "upload" ? "Upload" : name === "map" ? "Map columns and boards" : name === "preview" ? "Preview" : "Done"}
          </li>
        ))}
      </ol>

      {step === "upload" && (
        <section className="max-w-xl space-y-3">
          <p className="text-sm text-muted-foreground">One row per connection, naming each end's board, connector and pin.</p>
          <FileInput accept=".csv,text/csv" value={file} onValueChange={setFile} aria-label="CSV file" />
          <Button onClick={() => void doUpload()} disabled={!file || working}>
            <Upload className="mr-1 h-4 w-4" /> {working ? "Reading…" : "Upload"}
          </Button>
        </section>
      )}

      {step === "map" && upload && (
        <section className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {upload.filename} · {upload.rowCount} rows · {upload.columns.length} columns
          </p>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {TARGETS.map(({ target, label, required }) => (
              <div key={target} className="grid gap-1.5">
                <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
                <Select value={columnMap[target] ?? NONE} onValueChange={(value) => setColumn(target, value === NONE ? "" : value)}>
                  <SelectTrigger aria-label={`Column for ${label}`} className="h-8 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{required ? "Choose a column…" : "None"}</SelectItem>
                    {upload.columns.map((column) => <SelectItem key={column} value={column}>{column}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {values.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Boards</h3>
              <p className="text-xs text-muted-foreground">Match each board named in the file to a board of this system, or skip it.</p>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                {values.map((value) => (
                  <div key={value} className="grid gap-1.5">
                    <Label className="truncate font-mono text-xs" title={value}>{value}</Label>
                    <Select value={boardMap[value] || NONE} onValueChange={(next) => {
                      const updated = { ...boardMap };
                      if (next === NONE) delete updated[value]; else updated[value] = next;
                      setBoardMap(updated);
                    }}>
                      <SelectTrigger aria-label={`Board for ${value}`} className="h-8 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Choose…</SelectItem>
                        <SelectItem value={SKIP}>Skip these rows</SelectItem>
                        {boards.map((instance) => <SelectItem key={instance.id} value={instance.id}>{instance.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Sample rows</summary>
            <div className="relative mt-2 overflow-x-auto rounded border">
              <table className="text-xs">
                <thead className="bg-muted/50">
                  <tr>{upload.columns.map((column) => <th key={column} className="px-2 py-1 text-left font-medium">{column}</th>)}</tr>
                </thead>
                <tbody>
                  {upload.sampleRows.map((row, index) => (
                    // Sample rows have no identity of their own; their order is the file's.
                    // react-doctor-disable-next-line no-array-index-as-key
                    <tr key={index} className="border-t">
                      {upload.columns.map((column) => <td key={column} className="whitespace-nowrap px-2 py-1">{row[column]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {(missing.length > 0 || unmapped.length > 0) && (
            <p className="text-xs text-destructive" role="alert">
              {missing.length > 0 && `Map ${missing.join(", ")}. `}
              {unmapped.length > 0 && `Choose a board (or skip) for ${unmapped.join(", ")}.`}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={restart}>Start over</Button>
            <Button onClick={() => void doPreview()} disabled={working || missing.length > 0 || unmapped.length > 0}>
              {working ? "Checking…" : "Preview"}
            </Button>
          </div>
        </section>
      )}

      {step === "preview" && preview && (
        <section className="space-y-4">
          <Tabs value={bucket} onValueChange={(value) => setBucket(value as ImportBucket)}>
            <TabsList aria-label="Import buckets" className="h-9">
              {BUCKETS.map(({ bucket: name, label, tone }) => (
                <TabsTrigger key={name} value={name} className="gap-2 px-3 text-xs">
                  {label} <Badge variant={tone} className="h-5 px-1.5 tabular-nums">{preview.counts[name]}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground">{BUCKETS.find((b) => b.bucket === bucket)?.hint}</p>
          <div className="relative max-h-[50vh] overflow-auto border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Line</th>
                  <th className="px-3 py-2 font-medium">From</th>
                  <th className="px-3 py-2 font-medium">To</th>
                  <th className="px-3 py-2 font-medium">Signal</th>
                  <th className="px-3 py-2 font-medium">{bucket === "matched" ? "Action" : "Reason"}</th>
                </tr>
              </thead>
              <tbody>
                {preview[bucket].length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No rows.</td></tr>
                )}
                {preview[bucket].map((entry) => (
                  <tr key={entry.line} className="border-t">
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{entry.line}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{endText(entry, "from")}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{endText(entry, "to")}</td>
                    <td className="px-3 py-1.5">{entry.signal}</td>
                    <td className="px-3 py-1.5 text-xs">
                      {bucket === "matched"
                        ? `${entry.action === "update" ? "update" : "create"}${entry.linkId ? "" : entry.kind === "wire" ? ` (new harness ${entry.linkName})` : " (new link)"}`
                        : REASON_LABELS[entry.reason ?? ""] ?? entry.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
            <Button onClick={() => void doCommit()} disabled={working || preview.counts.matched + preview.counts.needsReview === 0}>
              {working ? "Importing…" : `Commit ${plural(preview.counts.matched, "row")}`}
              {preview.counts.needsReview > 0 && ` and review ${preview.counts.needsReview}`}
            </Button>
          </div>
        </section>
      )}

      {step === "done" && report && (
        <section className="max-w-xl space-y-3">
          <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-success" /> Import committed</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>{plural(report.created, "row")} created, {report.updated} updated, {report.unchanged} unchanged</li>
            <li>{report.linksCreated.length} new {report.linksCreated.length === 1 ? "link" : "links"}</li>
            {(report.harnessesCreated?.length ?? 0) > 0 && (
              <li>{plural(report.harnessesCreated?.length ?? 0, "new harness")}</li>
            )}
            <li>{plural(report.unresolved.length + report.conflict.length, "row")} not imported</li>
          </ul>
          <div className="flex gap-2">
            {report.reviewId && (
              <Button onClick={() => onNavigate("changes")}>Review {plural(report.counts.needsReview, "row")}</Button>
            )}
            <Button variant="outline" onClick={() => onNavigate("connectivity")}>Back to connections</Button>
            <Button variant="ghost" onClick={restart}>Import another file</Button>
          </div>
        </section>
      )}
    </div>
  );
}
