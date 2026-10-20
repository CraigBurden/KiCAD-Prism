/**
 * The mated pads of a B2B mate, seen in side A's connector frame looking down
 * its mating axis (CONTRACTS §8.4 `pads`, mockup 04): A's pads as copper
 * rectangles, B's as rings where the mated pose puts them. A click on a pad
 * selects its mapping row.
 */
import type { MatePads, MateRow } from "./mate-view";

type Pad = MatePads["a"][number];

const MARGIN_MM = 1.5;
const MM = (nm: number) => nm / 1e6;
/** B's ring radius: a fraction of its short side, kept visible on small pads. */
const ringRadius = (pad: Pad) => Math.max(MM(pad.shortNm) * 0.32, 0.08);

/** A pad's centre in the drawing: mm, y flipped, as pads are drawn y up. */
const x = (pad: Pad) => MM(pad.xNm);
const y = (pad: Pad) => -MM(pad.yNm);

/** The drawing's box in mm (y up), around every pad. */
export function padBounds(pads: MatePads): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const all = [...pads.a, ...pads.b];
  if (!all.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pad of all) {
    const reach = MM(pad.longNm) / 2;
    minX = Math.min(minX, MM(pad.xNm) - reach);
    maxX = Math.max(maxX, MM(pad.xNm) + reach);
    minY = Math.min(minY, MM(pad.yNm) - reach);
    maxY = Math.max(maxY, MM(pad.yNm) + reach);
  }
  return { minX: minX - MARGIN_MM, minY: minY - MARGIN_MM, maxX: maxX + MARGIN_MM, maxY: maxY + MARGIN_MM };
}

export interface PadViewProps {
  pads: MatePads;
  rows: MateRow[];
  /** The selected row's index in `rows`, or null. */
  selected: number | null;
  onSelect: (index: number | null) => void;
  aName: string;
  bName: string;
}

export function PadView({ pads, rows, selected, onSelect, aName, bName }: PadViewProps) {
  const box = padBounds(pads);
  if (!box) return <p className="p-6 text-sm text-zinc-500">Neither connector has pads to draw.</p>;
  const rowOfA = new Map(rows.flatMap((row, index) => (row.aPad ? [[row.aPad, index] as const] : [])));
  const rowOfB = new Map(rows.flatMap((row, index) => (row.bPad ? [[row.bPad, index] as const] : [])));
  const picked = selected !== null ? rows[selected] : null;
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const label = picked && (pads.a.find((pad) => pad.pad === picked.aPad) ?? pads.b.find((pad) => pad.pad === picked.bPad));

  return (
    <svg
      viewBox={`${box.minX} ${-box.maxY} ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label={`Mated pads of ${aName} and ${bName}`}
      onClick={() => onSelect(null)}
      onKeyDown={(event) => {
        if (event.key === "Escape") onSelect(null);
      }}
    >
      <defs>
        <pattern id="b2b-dots" width="1.27" height="1.27" patternUnits="userSpaceOnUse">
          <circle cx="0.05" cy="0.05" r="0.04" fill="#c9c6bb" />
        </pattern>
      </defs>
      <rect x={box.minX} y={-box.maxY} width={width} height={height} fill="#f5f4ef" />
      <rect x={box.minX} y={-box.maxY} width={width} height={height} fill="url(#b2b-dots)" />
      {pads.a.map((pad, index) => {
        const row = rowOfA.get(pad.pad);
        const on = row !== undefined && row === selected;
        return (
          <rect
            // Pads sharing a number each draw; the index keeps their keys apart.
            key={`a:${pad.pad}:${pad.xNm}:${pad.yNm}:${index}`}
            x={x(pad) - MM(pad.longNm) / 2}
            y={y(pad) - MM(pad.shortNm) / 2}
            width={MM(pad.longNm)}
            height={MM(pad.shortNm)}
            transform={`rotate(${-pad.angleDeg} ${x(pad)} ${y(pad)})`}
            fill={on ? "#3b82f6" : "#dd9373"}
            stroke={on ? "#1d4ed8" : "none"}
            strokeWidth={0.05}
            className="cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(row ?? null);
            }}
          >
            <title>{`${aName} pad ${pad.pad}`}</title>
          </rect>
        );
      })}
      {pads.b.map((pad, index) => {
        const row = rowOfB.get(pad.pad);
        const on = row !== undefined && row === selected;
        const unmatched = row !== undefined && !rows[row].aPad;
        return (
          <circle
            key={`b:${pad.pad}:${pad.xNm}:${pad.yNm}:${index}`}
            cx={x(pad)}
            cy={y(pad)}
            r={ringRadius(pad)}
            fill={on ? "#1d4ed8" : "none"}
            stroke={unmatched ? "#dc2626" : on ? "#1d4ed8" : "#15803d"}
            strokeWidth={0.06}
            className="cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(row ?? null);
            }}
          >
            <title>{`${bName} pad ${pad.pad}`}</title>
          </circle>
        );
      })}
      {picked && label && (
        // Anchored toward the middle, so the text stays inside the drawing at either end.
        <text
          x={x(label)}
          y={y(label) + MM(label.longNm) / 2 + 0.9}
          fontSize={0.7}
          textAnchor={x(label) > (box.minX + box.maxX) / 2 ? "end" : "start"}
          fill="#1d4ed8"
          className="pointer-events-none select-none font-medium"
        >
          {`pad ${picked.aPad ?? "–"} ↔ ${picked.bPad ?? "–"} · ${picked.aNet ?? "no net"} ↔ ${picked.bNet ?? "no net"}`}
        </text>
      )}
    </svg>
  );
}
