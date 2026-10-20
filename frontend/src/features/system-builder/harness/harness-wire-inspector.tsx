/**
 * The inspector's wire fields (CONTRACTS §16.5, mockup 09): both terminals with
 * pads and nets, system net, gauge, colour, label, the 3D route's length with a
 * typed override, markers, cable and conductor, its findings, and the Confirm
 * and Remove actions.
 */
import { useState, type ReactNode } from "react";

import { findingsOn, colourHex, GAUGES, mmText, parseMm, terminalText, WIRE_COLOURS } from "./harness-format";
import type { HarnessView, WireView } from "./harness-view";

export interface WireChange {
  gaugeAwg?: string | null;
  colour?: string | null;
  label?: string | null;
  lengthNm?: number | null;
}

interface Props {
  view: HarnessView;
  wire: WireView;
  canEdit: boolean;
  busy: boolean;
  onSet: (changes: WireChange) => void;
  onConfirm: () => void;
  onRemove: () => void;
}

const input = "w-full rounded-md border border-white/15 bg-[#020817] px-2 py-1 text-xs text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-600 disabled:opacity-50";
const ghost = "rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40";
const primary = "rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:pointer-events-none disabled:opacity-40";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[86px_1fr] gap-1.5 py-[3px]">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 break-words text-zinc-200">{children}</span>
    </div>
  );
}

export function WireInspector({ view, wire, canEdit, busy, onSet, onConfirm, onRemove }: Props) {
  const [gauge, setGauge] = useState(() => wire.gaugeAwg ?? "");
  const [label, setLabel] = useState(() => wire.label ?? "");
  const [length, setLength] = useState(() => mmText(wire.lengthNm));
  const locked = !canEdit || busy;
  const markers = view.markers.filter((marker) => marker.wire === wire.id);
  const findings = findingsOn(view, wire.id);
  const confirmable = wire.suggested || wire.origin === "default";

  const commitGauge = () => {
    if (gauge === (wire.gaugeAwg ?? "")) return;
    onSet({ gaugeAwg: gauge.trim() || null });
  };
  const commitLabel = () => {
    if (label === (wire.label ?? "")) return;
    onSet({ label: label.trim() || null });
  };
  const commitLength = () => {
    const parsed = parseMm(length);
    if ((wire.lengthNm ?? null) === parsed) return;
    onSet({ lengthNm: parsed });
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-[3px] border border-[#475569]" style={{ background: colourHex(wire.colour) }} />
        <b className="text-sm">{wire.label ?? wire.id}</b>
        <span className="text-[11.5px] text-zinc-400">
          {wire.origin} wire
          {wire.cable ? ` · in ${wire.cable} (${wire.conductor ?? "—"})` : ""}
        </span>
      </div>
      <Row label="From">{terminalText(view, wire.from)}</Row>
      <Row label="To">{terminalText(view, wire.to)}</Row>
      <Row label="System net">{wire.netName ?? wire.net ?? "—"}</Row>
      <div className="my-2 h-px bg-white/10" />

      <div className="mb-1.5">
        <label htmlFor="harness-wire-gauge" className="mb-0.5 block text-[11px] text-zinc-500">
          Gauge
        </label>
        <input
          id="harness-wire-gauge"
          className={input}
          value={gauge}
          disabled={locked}
          list="harness-gauge-options"
          placeholder="—"
          onChange={(event) => setGauge(event.target.value)}
          onBlur={commitGauge}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <datalist id="harness-gauge-options">
          {GAUGES.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </div>

      <div className="mb-1.5">
        <label htmlFor="harness-wire-colour" className="mb-0.5 block text-[11px] text-zinc-500">
          Colour
        </label>
        <select
          id="harness-wire-colour"
          className={input}
          value={wire.colour ?? ""}
          disabled={locked}
          onChange={(event) => onSet({ colour: event.target.value || null })}
        >
          <option value="">—</option>
          {WIRE_COLOURS.map((colour) => (
            <option key={colour} value={colour}>
              {colour[0].toUpperCase() + colour.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-1.5">
        <label htmlFor="harness-wire-label" className="mb-0.5 block text-[11px] text-zinc-500">
          Label
        </label>
        <input
          id="harness-wire-label"
          className={input}
          value={label}
          disabled={locked}
          placeholder={wire.id}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={commitLabel}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </div>

      <div className="mb-1.5">
        <label htmlFor="harness-wire-length" className="mb-0.5 block text-[11px] text-zinc-500">
          Length
        </label>
        <p className="mb-1 text-[11px] text-zinc-500">from the 3D route (stage 4c)</p>
        <input
          id="harness-wire-length"
          className={input}
          value={length}
          disabled={locked}
          placeholder="override, mm"
          inputMode="decimal"
          onChange={(event) => setLength(event.target.value)}
          onBlur={commitLength}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </div>

      {markers.length > 0 && (
        <Row label="Markers">{markers.map((marker) => marker.text).join(" · ")}</Row>
      )}
      {wire.cable && <Row label="Cable">{`${wire.cable} · ${wire.conductor ?? "—"}`}</Row>}
      <div className="my-2 h-px bg-white/10" />
      <h4 className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Findings</h4>
      {findings.length === 0 && <p className="text-[11.5px] text-zinc-500">None on this wire.</p>}
      {findings.map((finding) => (
        <p key={`${finding.code}\u0000${finding.subject}`} className={finding.severity === "error" ? "py-0.5 text-[11.5px] text-red-300" : "py-0.5 text-[11.5px] text-amber-300"}>
          {finding.message}
          <span className="ml-1.5 font-mono text-[10px] text-zinc-500">{finding.code}</span>
        </p>
      ))}
      <div className="mt-2 flex gap-1.5">
        {confirmable && (
          <button type="button" className={primary} disabled={locked} onClick={onConfirm}>
            Confirm
          </button>
        )}
        <button type="button" className={ghost} disabled={locked} onClick={onRemove}>
          Remove wire
        </button>
      </div>
    </div>
  );
}
