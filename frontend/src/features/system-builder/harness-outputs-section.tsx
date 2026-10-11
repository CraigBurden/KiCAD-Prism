import { useState } from "react";
import { Download, Eye, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HARNESS_OUTPUTS, harnessOutputUrl } from "@/lib/systems-api";
import type { HarnessCovering, SystemHarness } from "@/types/system";

import { HarnessDrawingViewer } from "./harness-drawing-viewer";
import { PartDialog, partText } from "./harness-part-dialog";
import { useSystemSession } from "./session/use-system-session";

const OUTPUT_LABELS: Record<(typeof HARNESS_OUTPUTS)[number], string> = {
  "drawing.svg": "Drawing SVG",
  "drawing.pdf": "PDF",
  "wiring.csv": "Wiring list",
  "bom.csv": "BOM",
  "wireviz.yaml": "WireViz",
};

interface Draft {
  /** A stable React key for an unsaved row. */
  key: string;
  segmentId: string;
  componentId: string | null;
  partText: string | null;
  description: string;
}

function toDraft(covering: HarnessCovering, index: number): Draft {
  return { key: `stored-${index}-${covering.segmentId}`, segmentId: covering.segmentId, componentId: covering.part?.componentId ?? null,
    partText: covering.part ? partText(covering.part) : null, description: covering.description };
}

/** The rows as saved, without their React keys: what tells a draft from the stored list. */
function comparable(list: Draft[]): string {
  return JSON.stringify(list.map(({ key: _key, ...row }) => row));
}

/** SB2-110 (§26): the harness's coverings per route segment and its manufacturing outputs. */
export function HarnessOutputsSection({ systemId, harness, editable }: { systemId: string; harness: SystemHarness; editable: boolean }) {
  const session = useSystemSession();
  // A draft belongs to the version it was started on.
  const etag = session.etag;
  const busy = session.busy !== null;
  const stored = (harness.coverings ?? []).map(toDraft);
  const [draft, setDraft] = useState<{ etag: string | null; rows: Draft[] } | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [viewing, setViewing] = useState(false);
  const rows = draft?.etag === etag ? draft.rows : stored;
  const dirty = draft?.etag === etag && comparable(draft.rows) !== comparable(stored);
  const segments = harness.lengths?.segments ?? [];
  const ends = new Map(harness.ends.map((end, index) => [end.id, end.mates?.port?.reference ?? `End ${index + 1}`]));
  const segmentName = (id: string) => {
    if (id === "*") return "Whole bundle";
    const found = segments.find((segment) => segment.id === id);
    if (!found) return `${id} (unrouted)`;
    const side = (node: string) => ends.get(node) ?? "breakout";
    return `${side(found.from)} – ${side(found.to)} · ${Math.round(found.lengthMm)} mm`;
  };
  const change = (update: (current: Draft[]) => Draft[]) => setDraft({ etag, rows: update(rows) });
  const save = () => void session.edit("harness", (system) => system.setHarnessCoverings(harness.id,
    rows.map((row) => ({ segmentId: row.segmentId, componentId: row.componentId, description: row.description.trim() }))),
  "Coverings saved").then(() => setDraft(null));
  const options = ["*", ...segments.map((segment) => segment.id)];

  return (
    <section className="space-y-2" aria-label="Manufacturing">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Coverings</h3>
        {editable && (
          <Button variant="ghost" size="sm" disabled={busy} aria-label="Add covering"
            onClick={() => change((current) => [...current,
              { key: crypto.randomUUID(), segmentId: "*", componentId: null, partText: null, description: "" }])}>
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        )}
        {dirty && (
          <>
            <Button size="sm" disabled={busy || rows.some((row) => !row.componentId && !row.description.trim())} onClick={save}>Save</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDraft(null)}>Discard</Button>
          </>
        )}
        <Button variant="outline" size="sm" className="ml-auto h-7 gap-1 px-2 text-xs" onClick={() => setViewing(true)}>
          <Eye className="h-3 w-3" aria-hidden />Drawing
        </Button>
        <span className="flex flex-wrap gap-1" aria-label="Outputs">
          {HARNESS_OUTPUTS.map((name) => (
            <a key={name} href={harnessOutputUrl(systemId, harness.id, name)} download
              className="inline-flex h-7 items-center gap-1 rounded border px-2 text-xs hover:bg-accent">
              <Download className="h-3 w-3" aria-hidden />{OUTPUT_LABELS[name]}
            </a>
          ))}
        </span>
      </div>
      {rows.length > 0 && (
        <ul className="divide-y rounded border text-sm" aria-label="Coverings">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-center gap-2 px-2 py-1">
              {editable ? (
                <Select value={row.segmentId} onValueChange={(segmentId) => change((current) =>
                  current.map((r, i) => (i === index ? { ...r, segmentId } : r)))}>
                  <SelectTrigger aria-label={`Covering ${index + 1} segment`} className="h-8 w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[...new Set([...options, row.segmentId])].map((id) => <SelectItem key={id} value={id}>{segmentName(id)}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <span className="w-56 shrink-0 truncate">{segmentName(row.segmentId)}</span>}
              {editable ? (
                <Input aria-label={`Covering ${index + 1} description`} className="h-8 min-w-0 flex-1" maxLength={200}
                  value={row.description} placeholder="PET braid 6 mm"
                  onChange={(event) => change((current) => current.map((r, i) => (i === index ? { ...r, description: event.target.value } : r)))} />
              ) : <span className="min-w-0 flex-1 truncate">{row.description}</span>}
              {editable ? (
                <button type="button" className="max-w-40 truncate text-xs underline-offset-2 hover:underline" disabled={busy}
                  onClick={() => setPicking(index)}>{row.partText ?? "Part"}</button>
              ) : <span className="max-w-40 truncate text-xs text-muted-foreground">{row.partText}</span>}
              {editable && (
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove covering ${index + 1}`} disabled={busy}
                  onClick={() => change((current) => current.filter((_, i) => i !== index))}>
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {viewing && <HarnessDrawingViewer systemId={systemId} harness={harness} onClose={() => setViewing(false)} />}
      {picking !== null && rows[picking] && (
        <PartDialog title="Covering part" current={rows[picking].componentId} busy={busy} onClose={() => setPicking(null)}
          onPick={async (part) => change((current) => current.map((r, i) => (i === picking
            ? { ...r, componentId: part.componentId, partText: partText(part) } : r)))} />
      )}
    </section>
  );
}
