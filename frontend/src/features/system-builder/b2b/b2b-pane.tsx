/**
 * A B2B mate's tab (stage 3c, ADR §2.4, mockup 04): the mated pads in side A's
 * frame, the orientation, stack height and spacer that place them, and the
 * mapping rows. The mapping is derived from geometry; only a row's system
 * name, and the manual map when geometry cannot decide, are the user's.
 * Selecting a row lights its net in the 3D tab.
 */
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { SystemBundle, SystemDocument, SystemOp } from "../model/types";
import { manualMapOps, orientationOps, parsePairs, rowNameOps, spacerOps, stackHeightOps } from "./mate-edits";
import { buildMateView, type MateRow, type MateView } from "./mate-view";
import { PadView } from "./pad-view";

export interface B2bPaneProps {
  document: SystemDocument;
  bundle: SystemBundle | null;
  mate: string;
  canEdit: boolean;
  busy: boolean;
  apply: (ops: SystemOp[]) => Promise<unknown>;
  /** The selected row's nets on each board, for the 3D tab; null clears. */
  onRow: (row: MateRow | null, view: MateView) => void;
}

type Filter = "all" | "findings" | "power";

const pill = (on: boolean) =>
  `rounded-full border px-2.5 py-0.5 text-[12px] ${on ? "border-blue-500 text-zinc-100" : "border-white/15 text-zinc-400 hover:text-zinc-100"}`;
const report = (error: unknown) => toast.error(error instanceof Error ? error.message : String(error));
const mm = (nm: number | null) => (nm === null ? "" : (nm / 1e6).toFixed(2));

/** A row's identity: its two pads. */
const rowKey = (row: MateRow) => `${row.aPad ?? "-"}:${row.bPad ?? "-"}`;

/** The rows a filter and a search keep. */
export function filterRows(rows: MateRow[], filter: Filter, search: string): number[] {
  const needle = search.trim().toLowerCase();
  return rows.flatMap((row, index) => {
    if (filter === "findings" && !row.notes.length) return [];
    if (filter === "power" && !row.power) return [];
    if (needle) {
      const text = [row.aPad, row.bPad, row.aNet, row.bNet, row.label, row.systemName].filter(Boolean).join(" ").toLowerCase();
      if (!text.includes(needle)) return [];
    }
    return [index];
  });
}

export function B2bPane({ document, bundle, mate, canEdit, busy, apply, onRow }: B2bPaneProps) {
  const view = useMemo(() => buildMateView(document, bundle, mate), [document, bundle, mate]);
  // The selected row by its pads, so it survives a rebuild that reorders the rows.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const manual = useRef<HTMLDialogElement>(null);
  const [manualText, setManualText] = useState("");

  if (!view) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">This mate is no longer in the system.</div>;
  const send = (ops: () => SystemOp[]) => {
    try {
      void apply(ops()).catch(report);
    } catch (error) {
      report(error);
    }
  };
  const selectedIndex = view.rows.findIndex((row) => rowKey(row) === selectedKey);
  const selected = selectedIndex >= 0 ? selectedIndex : null;
  const select = (index: number | null) => {
    setSelectedKey(index === null ? null : rowKey(view.rows[index]));
    onRow(index === null ? null : view.rows[index], view);
  };
  const shown = filterRows(view.rows, filter, search);
  const findings = view.rows.filter((row) => row.notes.length).length;
  const power = view.rows.filter((row) => row.power).length;
  const allLand = view.total > 0 && view.landed === view.total;
  const openManual = () => {
    setManualText(view.rows.flatMap((row) => (row.aPad && row.bPad ? [`${row.aPad} ${row.bPad}`] : [])).join("\n"));
    manual.current?.showModal();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto bg-background p-4 text-zinc-100">
      <p className="text-sm text-zinc-400">
        <span className="font-semibold text-zinc-100">B2B {view.a.connector} ↔ {view.b.connector}</span>
        {` · ${view.a.label} ${view.a.connector}${view.a.value ? ` (${view.a.value})` : ""} mates ${view.b.label} ${view.b.connector}${view.b.value ? ` (${view.b.value})` : ""}`}
      </p>
      <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-white/10 bg-zinc-900/95 px-4 py-2.5 text-sm" role="toolbar" aria-label="Mate orientation">
        <span className="font-semibold">Orientation</span>
        {[0, 1, 2, 3].map((turns) => (
          <button key={turns} type="button" disabled={!canEdit || busy} className={pill(view.orientation.quarterTurns === turns)} aria-pressed={view.orientation.quarterTurns === turns} onClick={() => send(() => orientationOps(document, mate, { quarterTurns: turns }))}>
            {turns * 90}°
          </button>
        ))}
        <span className="text-zinc-600">|</span>
        <span>Flip</span>
        <button type="button" disabled={!canEdit || busy} className={pill(view.orientation.flip)} aria-pressed={view.orientation.flip} onClick={() => send(() => orientationOps(document, mate, { flip: !view.orientation.flip }))}>
          {view.orientation.flip ? "on" : "off"}
        </button>
        <span className="text-zinc-600">|</span>
        <LengthField
          key={`stack:${view.stackHeightNm}`}
          label="Stack"
          value={mm(view.stackHeightNm)}
          hint={view.heightSource === "clearance" ? "from clearance" : view.heightSource ? "stated" : ""}
          disabled={!canEdit || busy}
          onCommit={(value) => send(() => stackHeightOps(document, mate, value))}
        />
        <LengthField
          key={`spacer:${view.spacerNm}`}
          label="Spacer"
          value={mm(view.spacerNm)}
          hint=""
          disabled={!canEdit || busy}
          onCommit={(value) => send(() => spacerOps(document, mate, value ?? 0))}
        />
        <span className="flex-1" />
        <span className={allLand ? "text-green-500" : "text-amber-500"}>● {view.landed}/{view.total} pads land</span>
        {canEdit && (
          <button type="button" disabled={busy} className="rounded-md border border-white/15 bg-zinc-950 px-2.5 py-1 text-xs" onClick={openManual}>
            {view.manual ? "Manual map ✓" : "Manual map…"}
          </button>
        )}
      </div>
      {/* Two columns when there is room; the mapping wraps under the pads beside the 3D tab. */}
      <div className="grid min-h-0 flex-1 gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))" }}>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-md border border-white/10 bg-[#f5f4ef] px-4 pb-8 pt-9">
            <p className="absolute left-4 top-3 z-10 text-xs text-zinc-600">
              Mated pads, seen from {view.a.label}&apos;s side · {view.a.connector} ▭ · {view.b.connector} ○ ({view.b.label})
            </p>
            {view.pads ? (
              <PadView pads={view.pads} rows={view.rows} selected={selected} onSelect={select} aName={`${view.a.label} ${view.a.connector}`} bName={`${view.b.label} ${view.b.connector}`} />
            ) : (
              <p className="flex h-full items-center justify-center bg-[#f5f4ef] text-sm text-zinc-600">
                {view.source === "pending" ? "Waiting for the system bundle…" : "The geometry cannot place these pads; set the mapping by hand."}
              </p>
            )}
            <p className="absolute bottom-2 left-4 text-xs text-zinc-600">
              Mapping source: {view.source} · {view.landed} pairs · unmapped A {view.rows.filter((row) => !row.bPad).length}, B {view.rows.filter((row) => !row.aPad).length}
            </p>
          </div>
        </div>
        <div className="flex min-h-[320px] min-w-0 flex-col rounded-[10px] border border-white/10 bg-zinc-900/95 p-4">
          <div className="flex items-baseline gap-2">
            <h4 className="text-[15px] font-semibold">Mapping</h4>
            <span className="text-xs text-zinc-400">rows are derived; only the system name is yours</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button type="button" className={pill(filter === "all")} onClick={() => setFilter("all")}>All {view.rows.length}</button>
            <button type="button" className={`${pill(filter === "findings")} ${findings ? "text-amber-500" : ""}`} onClick={() => setFilter("findings")}>With findings {findings}</button>
            <button type="button" className={pill(filter === "power")} onClick={() => setFilter("power")}>Power {power}</button>
            <input
              className="min-w-0 flex-1 rounded-full border border-white/15 bg-transparent px-2.5 py-0.5 text-[12px] outline-none focus:border-blue-500"
              placeholder="Search…"
              aria-label="Search rows"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="mt-2 min-h-0 flex-1 overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-zinc-900 text-left text-xs text-zinc-400">
                <tr>
                  <th className="py-1.5 font-normal">A pad</th>
                  <th className="font-normal">{view.a.label} net</th>
                  <th className="font-normal">B pad</th>
                  <th className="font-normal">{view.b.label} net</th>
                  <th className="font-normal">System name</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((index) => {
                  const row = view.rows[index];
                  return (
                    <tr
                      key={rowKey(row)}
                      className={`cursor-pointer border-t border-white/5 ${selected === index ? "bg-blue-500/15" : "hover:bg-white/5"}`}
                      tabIndex={0}
                      aria-selected={selected === index}
                      onClick={() => select(selected === index ? null : index)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                        event.preventDefault();
                        select(selected === index ? null : index);
                      }}
                    >
                      <td className="py-1 font-mono">{row.aPad ?? "–"}</td>
                      <td className="max-w-[140px] truncate" title={row.aNet ?? ""}>{row.aNet ?? "–"}</td>
                      <td className="font-mono">{row.bPad ?? "–"}</td>
                      <td className="max-w-[140px] truncate" title={row.bNet ?? ""}>{row.bNet ?? "–"}</td>
                      <td onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                        {row.aPad ? (
                          <NameField
                            key={`${row.aPad}:${row.label ?? ""}`}
                            value={row.label ?? ""}
                            placeholder={row.systemName ?? ""}
                            disabled={!canEdit || busy}
                            onCommit={(name) => send(() => rowNameOps(document, mate, row.aPad as string, name))}
                          />
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap pl-2 text-xs text-amber-500">{row.notes.join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-500">A name set here wins in the ICD and on harness labels; it never edits either board.</p>
        </div>
      </div>
      <dialog ref={manual} className="w-[420px] rounded-xl border border-white/10 bg-zinc-900 p-4 text-zinc-100 backdrop:bg-black/50" aria-label="Manual map">
        <h4 className="text-sm font-semibold">Manual map</h4>
        <p className="mt-1 text-xs text-zinc-400">One pair per line, A pad then B pad. A manual map replaces the geometry and is flagged in Review.</p>
        <textarea className="mt-3 h-64 w-full rounded-md border border-white/15 bg-zinc-950 p-2 font-mono text-xs outline-none focus:border-blue-500" value={manualText} onChange={(event) => setManualText(event.target.value)} aria-label="Pairs" />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-zinc-950"
            onClick={() => {
              try {
                const pairs = parsePairs(manualText);
                manual.current?.close();
                send(() => manualMapOps(document, mate, pairs));
              } catch (error) {
                report(error);
              }
            }}
          >
            Use these pairs
          </button>
          {view.manual && (
            <button type="button" className="rounded-md border border-white/15 px-3 py-1.5 text-xs" onClick={() => { manual.current?.close(); send(() => manualMapOps(document, mate, null)); }}>
              Back to geometry
            </button>
          )}
          <span className="flex-1" />
          <button type="button" className="rounded-md border border-white/15 px-3 py-1.5 text-xs" onClick={() => manual.current?.close()}>Cancel</button>
        </div>
      </dialog>
    </div>
  );
}

/** A length in mm, committed on Enter or blur; empty commits null. */
function LengthField({ label, value, hint, disabled, onCommit }: { label: string; value: string; hint: string; disabled: boolean; onCommit: (mm: number | null) => void }) {
  const [draft, setDraft] = useState(value);
  // What was last sent: saving disables the field, and the blur that causes must not send it again.
  const sent = useRef(value);
  const commit = () => {
    if (draft === value || draft === sent.current) return;
    sent.current = draft;
    const text = draft.trim();
    if (!text) return onCommit(null);
    const number = Number(text);
    if (!Number.isFinite(number)) {
      setDraft(value);
      return report(new Error(`${label}: not a number`));
    }
    onCommit(number);
  };
  return (
    <label className="flex items-center gap-1.5">
      <span>{label}</span>
      <input
        className="w-16 rounded-full border border-white/15 bg-transparent px-2 py-0.5 text-right font-mono text-xs outline-none focus:border-blue-500 disabled:opacity-60"
        value={draft}
        disabled={disabled}
        inputMode="decimal"
        aria-label={`${label} (mm)`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(value);
        }}
      />
      <span className="text-xs text-zinc-500">mm{hint ? ` ${hint}` : ""}</span>
    </label>
  );
}

/** A row's system name, committed on Enter or blur. */
function NameField({ value, placeholder, disabled, onCommit }: { value: string; placeholder: string; disabled: boolean; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(value);
  const sent = useRef(value);
  const commit = () => {
    if (draft.trim() === value || draft === sent.current) return;
    sent.current = draft;
    onCommit(draft);
  };
  return (
    <input
      className="w-full min-w-[110px] rounded-md border border-white/15 bg-transparent px-1.5 py-0.5 text-[12px] outline-none placeholder:text-zinc-500 focus:border-blue-500 disabled:opacity-60"
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      aria-label="System name"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") setDraft(value);
      }}
    />
  );
}
