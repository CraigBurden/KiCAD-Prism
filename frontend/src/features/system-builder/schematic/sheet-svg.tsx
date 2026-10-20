/**
 * Draws a `Scene` the way Eeschema draws a sheet, with KiCad's default
 * colours on light paper (CONTRACTS §14). Pure rendering: everything a
 * gesture needs to hit is tagged with `data-hit` and its ids, and the canvas
 * does the rest.
 *
 * Coordinates inside are millimetres (the scene's nanometres / 10⁶), so text
 * and strokes scale with zoom as in KiCad.
 */
import { memo } from "react";

import type { Edge } from "../model/types";
import { NORMAL, routeMidpoint, type Point, type Rect } from "./geometry";
import type { Scene, SceneConnection, ScenePort, SceneSymbol } from "./scene";

export const COLOURS = {
  paper: "#f5f4ef",
  grid: "#c9c7bd",
  sheet: "#840084",
  sheetFill: "#ffffd2",
  sheetName: "#006464",
  sheetFile: "#725600",
  pin: "#725600",
  bus: "#0000c2",
  harness: "#b5530a",
  harnessFill: "#fff4e6",
  harnessText: "#8a4a12",
  module: "#5b3fa8",
  moduleFill: "#f3efff",
  select: "#2f9bff",
  dangling: "#c20000",
  muted: "#8a8778",
  exported: "#5b3fa8",
};

const MM = 1_000_000;
const mm = (nm: number) => nm / MM;
const TEXT = 1.27;
const PIN = 0.635; // half the pin glyph

function rectMm(rect: Rect) {
  return { x: mm(rect.x), y: mm(rect.y), width: mm(rect.w), height: mm(rect.h) };
}

/** The pin glyph, drawn inside the border as KiCad draws sheet pins: a bidirectional diamond. */
function pinGlyph(point: Point, edge: Edge): string {
  const n = NORMAL[edge];
  // Inward is −normal; the tangent is the normal turned a quarter.
  const t = { x: -n.y, y: n.x };
  const at = (inward: number, along: number) => `${mm(point.x) - n.x * inward + t.x * along},${mm(point.y) - n.y * inward + t.y * along}`;
  return [at(0, 0), at(PIN, PIN), at(2 * PIN, 0), at(PIN, -PIN)].join(" ");
}

function PortView({ port, colour, selected }: { port: ScenePort; colour: string; selected: boolean }) {
  const n = NORMAL[port.edge];
  const x = mm(port.point.x);
  const y = mm(port.point.y);
  const vertical = port.edge === "top" || port.edge === "bottom";
  // The label runs inward from the glyph; on top and bottom edges it reads upward.
  const inset = 2 * PIN + 0.5;
  const lx = x - n.x * inset;
  const ly = y - n.y * inset;
  const anchor = port.edge === "left" || port.edge === "bottom" ? "start" : "end";
  const transform = vertical ? `rotate(-90 ${lx} ${ly})` : undefined;
  const textY = vertical ? ly : ly + TEXT * 0.35;
  return (
    <g data-hit="port" data-id={port.item} data-key={port.key} style={{ cursor: "grab" }}>
      {/* A larger invisible target than the glyph. */}
      <circle cx={x} cy={y} r={1.8} fill="transparent" />
      {selected && <polygon points={pinGlyph(port.point, port.edge)} fill={COLOURS.select} opacity={0.35} stroke={COLOURS.select} strokeWidth={0.6} />}
      <polygon points={pinGlyph(port.point, port.edge)} fill="none" stroke={port.missing ? COLOURS.dangling : colour} strokeWidth={0.15} />
      {port.label && (
        <text x={lx} y={textY} fontSize={TEXT} fill={port.missing ? COLOURS.dangling : colour} textAnchor={anchor} dominantBaseline={vertical ? "central" : undefined} transform={transform}>
          {port.label}
          {port.detail && (
            <tspan fontSize={TEXT * 0.72} fill={COLOURS.muted}>{`  ${port.detail}`}</tspan>
          )}
        </text>
      )}
      {port.back && (
        <text x={x + n.x * 1.4 + (vertical ? 1 : 0)} y={y + n.y * 1.4 + (vertical ? 0 : -0.8)} fontSize={TEXT * 0.8} fontWeight={700} fill="#7a0000" textAnchor="middle">B</text>
      )}
      {port.missing && (
        <path d={`M${x - 0.6} ${y - 0.6} L${x + 0.6} ${y + 0.6} M${x + 0.6} ${y - 0.6} L${x - 0.6} ${y + 0.6}`} stroke={COLOURS.dangling} strokeWidth={0.2} />
      )}
      {port.exports && <ExportLabel port={port} />}
    </g>
  );
}

const EXPORT_REACH = 5.08; // mm from the port to the label's point
const LABEL_H = 1.8;

/**
 * A port's exports as a KiCad hierarchical label outside the sheet (§15.4,
 * mockup 05): a short wire out along the edge's normal, then the pointed box
 * with the export's name, captioned "exported".
 */
function ExportLabel({ port }: { port: ScenePort }) {
  const n = NORMAL[port.edge];
  const x = mm(port.point.x);
  const y = mm(port.point.y);
  const text = (port.exports ?? []).join(", ");
  const width = Math.max(4, text.length * TEXT * 0.62 + 2);
  // Laid out along +x from the tip, then turned to face the edge's normal.
  const angle = Math.atan2(n.y, n.x) * (180 / Math.PI);
  const flipped = port.edge === "left";
  const box = `0,0 ${LABEL_H / 2},${-LABEL_H / 2} ${width},${-LABEL_H / 2} ${width},${LABEL_H / 2} ${LABEL_H / 2},${LABEL_H / 2}`;
  const textX = LABEL_H / 2 + 0.6;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} data-testid="export-label">
      <line x1={0} y1={0} x2={EXPORT_REACH} y2={0} stroke={COLOURS.exported} strokeWidth={0.25} />
      <g transform={`translate(${EXPORT_REACH} 0)`}>
        <polygon points={box} fill="#ffffff" stroke={COLOURS.exported} strokeWidth={0.18} />
        <g transform={flipped ? `rotate(180 ${width / 2} 0)` : undefined}>
          <text x={flipped ? width - textX : textX} y={TEXT * 0.35} fontSize={TEXT} fill={COLOURS.exported} textAnchor={flipped ? "end" : "start"}>{text}</text>
          <text x={flipped ? width - textX : textX} y={LABEL_H / 2 + TEXT * 0.9} fontSize={TEXT * 0.7} fontStyle="italic" fill={COLOURS.exported} textAnchor={flipped ? "end" : "start"}>exported</text>
        </g>
      </g>
    </g>
  );
}

const STATE_NOTE: Partial<Record<SceneSymbol["state"], string>> = {
  pending: "design bundle building…",
  absent: "not in the project at this commit",
  unsupported: "not read until stage 3",
  redacted: "no access to this board",
  unknown: "loading…",
};

function SymbolView({ symbol, selected, selectedPorts }: { symbol: SceneSymbol; selected: boolean; selectedPorts: ReadonlySet<string> }) {
  const r = rectMm(symbol.rect);
  const harness = symbol.kind === "harness";
  const body = symbol.kind === "body" || symbol.kind === "entry";
  const stroke = harness ? COLOURS.harness : body ? COLOURS.module : COLOURS.sheet;
  const fill = harness ? COLOURS.harnessFill : body ? COLOURS.moduleFill : COLOURS.sheetFill;
  const kindLabel = harness ? "" : symbol.kind === "board" ? "Board: " : symbol.kind === "body" ? "Body: " : "System: ";
  const note = STATE_NOTE[symbol.state];
  return (
    <g data-symbol={symbol.id}>
      {selected && <rect {...r} rx={harness ? 1.5 : 0} fill="none" stroke={COLOURS.select} strokeWidth={1.2} opacity={0.35} />}
      <rect
        {...r}
        rx={harness ? 1.5 : 0}
        fill={fill}
        stroke={stroke}
        strokeWidth={0.25}
        strokeDasharray={symbol.state === "pending" || symbol.state === "unknown" ? "1 0.6" : undefined}
        data-hit="symbol"
        data-id={symbol.id}
        style={{ cursor: "move" }}
      />
      {harness ? (
        <g pointerEvents="none">
          <text x={r.x + 1.2} y={r.y + 2.4} fontSize={TEXT * 1.1} fontWeight={600} fill={COLOURS.harness}>{symbol.label}</text>
          {symbol.lines.slice(0, Math.max(1, Math.floor((r.height - 4) / 1.6))).map((line, index) => (
            <text key={line + index} x={r.x + 1.2} y={r.y + 4.2 + index * 1.6} fontSize={TEXT * 0.85} fill={COLOURS.harnessText}>{line}</text>
          ))}
          <path
            d={`M${r.x + 1.2} ${r.y + r.height - 1.6} q1.2 -1.4 2.4 0 t2.4 0 t2.4 0`}
            fill="none"
            stroke={COLOURS.harness}
            strokeWidth={0.2}
          />
        </g>
      ) : (
        <g pointerEvents="none">
          <text x={r.x} y={r.y - 0.8} fontSize={TEXT * 1.15} fontWeight={600} fill={COLOURS.sheetName}>{`${kindLabel}${symbol.label}`}</text>
          <text x={r.x} y={r.y + r.height + 1.9} fontSize={TEXT * 0.85} fill={COLOURS.sheetFile}>{symbol.caption}</text>
          {note && (
            <text x={r.x + r.width / 2} y={r.y + r.height / 2} fontSize={TEXT} fill={symbol.state === "absent" ? COLOURS.dangling : COLOURS.muted} textAnchor="middle" fontStyle="italic">{note}</text>
          )}
        </g>
      )}
      {symbol.ports.map((port) => (
        <PortView key={port.key} port={port} colour={harness ? COLOURS.harness : COLOURS.pin} selected={selectedPorts.has(`${port.item}\u0000${port.key}`)} />
      ))}
    </g>
  );
}

const HANDLE = 0.9;
export const HANDLES = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

function Handles({ symbol }: { symbol: SceneSymbol }) {
  const r = rectMm(symbol.rect);
  const corners: Record<(typeof HANDLES)[number], [number, number, string]> = {
    "top-left": [r.x, r.y, "nwse-resize"],
    "top-right": [r.x + r.width, r.y, "nesw-resize"],
    "bottom-left": [r.x, r.y + r.height, "nesw-resize"],
    "bottom-right": [r.x + r.width, r.y + r.height, "nwse-resize"],
  };
  return (
    <g>
      {HANDLES.map((handle) => {
        const [x, y, cursor] = corners[handle];
        return (
          <rect
            key={handle}
            x={x - HANDLE / 2}
            y={y - HANDLE / 2}
            width={HANDLE}
            height={HANDLE}
            fill="#fff"
            stroke={COLOURS.select}
            strokeWidth={0.18}
            data-hit="handle"
            data-id={symbol.id}
            data-key={handle}
            style={{ cursor }}
          />
        );
      })}
    </g>
  );
}

function ConnectionView({ connection, selected }: { connection: SceneConnection; selected: boolean }) {
  const colour = connection.kind === "mate" ? COLOURS.bus : COLOURS.harness;
  const points = connection.points.map((point) => `${mm(point.x)},${mm(point.y)}`).join(" ");
  const mark = connection.points.length >= 2 ? routeMidpoint(connection.points) : null;
  return (
    <g>
      {selected && <polyline points={points} fill="none" stroke={COLOURS.select} strokeWidth={1.1} opacity={0.4} strokeLinecap="round" strokeLinejoin="round" />}
      <polyline points={points} fill="none" stroke={colour} strokeWidth={0.36} strokeLinejoin="round" strokeDasharray={connection.dangling ? "0.8 0.5" : undefined} />
      {connection.points.slice(1).map((point, index) => {
        const from = connection.points[index];
        return (
          <line
            key={index}
            x1={mm(from.x)}
            y1={mm(from.y)}
            x2={mm(point.x)}
            y2={mm(point.y)}
            stroke="transparent"
            strokeWidth={1.4}
            data-hit="segment"
            data-id={connection.id}
            data-key={String(index)}
            style={{ cursor: from.y === point.y ? "ns-resize" : "ew-resize" }}
          />
        );
      })}
      {mark && connection.kind === "mate" && (
        <g pointerEvents="none" transform={`translate(${mm(mark.point.x)} ${mm(mark.point.y)})${mark.horizontal ? "" : " rotate(90)"}`}>
          <path d="M-1.1 -1.1 H-0.4 V1.1 H-1.1 M1.1 -1.1 H0.4 V1.1 H1.1" fill={COLOURS.paper} stroke={COLOURS.bus} strokeWidth={0.25} />
          <text y={-1.6} fontSize={TEXT} fontWeight={600} fill={COLOURS.bus} textAnchor="middle" transform={mark.horizontal ? undefined : "rotate(-90)"}>{connection.label}</text>
        </g>
      )}
      {connection.dangling && connection.points.length > 0 && (() => {
        const end = connection.points[connection.points.length - 1];
        return <rect x={mm(end.x) - 0.5} y={mm(end.y) - 0.5} width={1} height={1} fill="none" stroke={COLOURS.dangling} strokeWidth={0.15} />;
      })()}
    </g>
  );
}

export interface SheetSvgProps {
  scene: Scene;
  /** Selected symbol and connection ids. */
  selected: ReadonlySet<string>;
  /** Selected pins, `${item}\0${key}`. */
  selectedPorts?: ReadonlySet<string>;
  /** Draw resize handles on these symbols. */
  resizable?: ReadonlySet<string>;
}

/** The scene's drawing, without paper or viewport (the canvas supplies both). */
export const SheetSvg = memo(function SheetSvg({ scene, selected, selectedPorts = new Set(), resizable = new Set() }: SheetSvgProps) {
  return (
    <g fontFamily="'KiCad Font','Helvetica Neue',Arial,sans-serif">
      {scene.connections.map((connection) => (
        <ConnectionView key={connection.id} connection={connection} selected={selected.has(connection.id)} />
      ))}
      {scene.symbols.map((symbol) => (
        <SymbolView key={symbol.id} symbol={symbol} selected={selected.has(symbol.id)} selectedPorts={selectedPorts} />
      ))}
      {scene.symbols.flatMap((symbol) => (resizable.has(symbol.id) ? [<Handles key={symbol.id} symbol={symbol} />] : []))}
    </g>
  );
});
