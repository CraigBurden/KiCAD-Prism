import { useEffect, useRef } from "react";
import { CircleAlert, Trash2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVirtualViewport } from "@/hooks/use-virtual-viewport";
import { cn } from "@/lib/utils";
import type { Finding, RowSource } from "@/types/system";

import { worstLevel } from "./findings";
import { findingText } from "./findings-ui";

export const ROW_HEIGHT = 36;
const OVERSCAN = 8;

export interface EndView {
  pad: string | null;
  names: string[] | null;
  nets: string[] | null;
  /** The pad's nets now differ from the net baseline accepted for the row. */
  changed: boolean;
  /** The pad no longer exists at the baseline. */
  missing: boolean;
  redacted: boolean;
}

export interface RowView {
  key: string;
  signal: string;
  source: RowSource;
  a: EndView;
  b: EndView;
  findings: readonly Finding[];
  problems: string[];
}

const COLUMNS = "grid-cols-[minmax(5rem,0.8fr)_minmax(8rem,1.4fr)_minmax(8rem,1.2fr)_minmax(8rem,1.4fr)_minmax(5rem,0.8fr)_4rem]";

/** Pad, plus the pin name when it says something the pad does not. */
function Pin({ end }: { end: EndView }) {
  if (end.redacted) {
    return <span className="text-muted-foreground">—</span>;
  }
  const names = (end.names ?? []).filter((name) => name && name !== end.pad).join(", ");
  return (
    <span className="flex min-w-0 items-baseline gap-1.5" title={names || undefined}>
      <span className="font-mono">{end.pad}</span>
      {names && <span className="truncate text-xs text-muted-foreground">{names}</span>}
    </span>
  );
}

function Net({ end }: { end: EndView }) {
  if (end.redacted) {
    return <span className="text-muted-foreground">restricted</span>;
  }
  if (end.missing) {
    return <span className="text-destructive">pad missing</span>;
  }
  return (
    <span className={cn("block truncate font-mono text-xs", end.changed && "text-warning", !end.nets?.length && "text-muted-foreground")}
      title={end.changed ? "This net changed since the row was accepted" : end.nets?.join(" | ")}>
      {end.nets?.length ? end.nets.join(" | ") : "no net"}
    </span>
  );
}

interface LinkRowsTableProps {
  rows: RowView[];
  /** Headings for the two ends, e.g. "OBC-1 J14". */
  sideA: string;
  sideB: string;
  editable: boolean;
  onSignalChange?: (key: string, signal: string) => void;
  onRemove?: (key: string) => void;
  /** SB2-112: the row a finding's Show points at, scrolled into view and outlined. */
  focusKey?: string;
}

export function LinkRowsTable({ rows, sideA, sideB, editable, onSignalChange, onRemove, focusKey }: LinkRowsTableProps) {
  const { height, scrollTop, viewportRef, onScroll } = useVirtualViewport();
  const focusIndex = focusKey ? rows.findIndex((row) => row.key === focusKey) : -1;
  const table = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const viewport = table.current?.querySelector<HTMLElement>("[data-testid=link-rows-viewport]");
    if (focusIndex < 0 || !viewport) return;
    viewport.scrollTop = Math.max(0, (focusIndex - 2) * ROW_HEIGHT);
    table.current?.scrollIntoView({ block: "nearest" });
  }, [focusIndex]);
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
  const visible = rows.slice(first, last);

  // A real table for screen readers; block/grid display so rows can be absolutely positioned (virtualised).
  return (
    <div className="relative overflow-x-auto border">
      <table ref={table} aria-label="Link pins" aria-rowcount={rows.length + 1} className="block min-w-[44rem] text-sm">
        <thead className="block border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr className={cn("grid gap-3 px-3 pt-2 font-semibold text-foreground", COLUMNS)} aria-hidden>
            <td className="col-span-2 truncate">{sideA}</td>
            <td />
            <td className="col-span-2 truncate text-right">{sideB}</td>
            <td />
          </tr>
          <tr className={cn("grid gap-3 px-3 pb-2 pt-1 font-medium", COLUMNS)}>
            <th>Pin</th>
            <th>Net</th>
            <th>Signal</th>
            <th className="text-right">Net</th>
            <th className="text-right">Pin</th>
            <th><span className="sr-only">Status</span></th>
          </tr>
        </thead>
        {rows.length === 0 ? (
          <tbody className="block">
            <tr className="block">
              <td className="block p-6 text-center text-sm text-muted-foreground">No pins connected yet. Add rows or use a generator.</td>
            </tr>
          </tbody>
        ) : (
          <tbody ref={viewportRef} onScroll={onScroll} className="relative block max-h-[60vh] overflow-y-auto" data-testid="link-rows-viewport">
            <tr aria-hidden className="block" style={{ height: rows.length * ROW_HEIGHT }} />
            {visible.map((row, offset) => {
              const index = first + offset;
              const worst = row.problems.length ? "error" : worstLevel(row.findings);
              const tooltip = [...row.problems, ...row.findings.map((f) => `${f.rule} ${findingText(f)}`)].join("\n");
              return (
                <tr
                  key={row.key}
                  aria-rowindex={index + 2}
                  aria-current={row.key === focusKey || undefined}
                  className={cn("absolute left-0 right-0 grid items-center gap-3 border-b px-3", COLUMNS,
                    worst === "error" && "bg-destructive/5", worst === "warning" && "bg-warning/5",
                    row.key === focusKey && "ring-2 ring-inset ring-primary")}
                  style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                >
                  <td className="min-w-0"><Pin end={row.a} /></td>
                  <td className="min-w-0"><Net end={row.a} /></td>
                  <td>
                    {editable && onSignalChange ? (
                      <Input aria-label={`Signal for ${row.a.pad ?? ""} ↔ ${row.b.pad ?? ""}`} value={row.signal} maxLength={200}
                        className="h-7 text-xs" onChange={(event) => onSignalChange(row.key, event.target.value)} />
                    ) : (
                      <span className="block truncate">{row.signal}</span>
                    )}
                  </td>
                  <td className="min-w-0 text-right"><Net end={row.b} /></td>
                  <td className="flex min-w-0 justify-end"><Pin end={row.b} /></td>
                  <td className="flex items-center justify-end">
                    {worst && (
                      <span title={tooltip} className="inline-flex">
                        {worst === "error"
                          ? <CircleAlert className="h-4 w-4 text-destructive" aria-label={tooltip} />
                          : <TriangleAlert className="h-4 w-4 text-warning" aria-label={tooltip} />}
                      </span>
                    )}
                    {editable && onRemove && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Remove ${row.a.pad} ↔ ${row.b.pad}`}
                        onClick={() => onRemove(row.key)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
}
