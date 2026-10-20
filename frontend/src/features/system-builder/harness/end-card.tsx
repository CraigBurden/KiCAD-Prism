/**
 * An end on the harness canvas (CONTRACTS §16.5, mockup 09): a white card with
 * its title, housing chip, the pin strip on the side facing the middle and one
 * row per pin. The pin dots are the wire gesture's starts and ends; the rest of
 * the card drags it.
 */
import { CARD_HEADER, ROW, STRIP, type PlacedEnd } from "./harness-layout";
import { endHousing } from "./harness-format";
import type { EndView } from "./harness-view";
import { usePartName } from "./part-name";

const INK = "#0f172a";
const DIM = "#64748b";
const LINE = "#f1f5f9";

export function EndCard({ end, placed, selected }: { end: EndView; placed: PlacedEnd; selected: boolean }) {
  const { x, y, width } = placed;
  const stripX = end.side === "left" ? x + width + STRIP : x - STRIP;
  const housing = usePartName(endHousing(end));
  const contacts = Object.keys(end.contacts).length;
  const border = selected ? "#0ea5e9" : housing ? "#cbd5e1" : "#f59e0b";

  return (
    <g data-hit="card" data-id={end.id}>
      <rect x={x} y={y} width={width} height={placed.height} rx={10} fill="#ffffff" stroke={border} strokeWidth={selected ? 2 : 1.4} />
      <text x={x + 12} y={y + 20} fontSize={13} fontWeight={650} fill={INK}>
        {end.title}
      </text>
      <text x={x + 12} y={y + 35} fontSize={10} fill={DIM}>
        {end.subtitle}
      </text>
      <rect x={x + 12} y={y + 43} width={width - 24} height={20} rx={5} fill={housing ? "#ecfdf5" : "#fffbeb"} />
      <text x={x + 18} y={y + 57} fontSize={9.5} fontWeight={600} fill={housing ? "#047857" : "#b45309"}>
        {housing ?? "Housing not chosen"}
      </text>
      <text x={x + width - 18} y={y + 57} fontSize={9.5} fontWeight={600} fill={housing ? "#047857" : "#b45309"} textAnchor="end">
        {contacts ? `${contacts} contacts` : "— contacts"}
      </text>

      <rect x={stripX - 6} y={y + CARD_HEADER - 6} width={12} height={ROW * Math.max(1, end.pins.length) + 2} rx={3} fill="#334155" />

      {end.pins.map((pin, index) => {
        const rowY = y + CARD_HEADER + ROW / 2 + index * ROW;
        const pointX = stripX;
        const left = end.side === "left";
        return (
          <g key={`${pin.cavity}\u0000${pin.pad}`}>
            {index > 0 && <line x1={x + 8} x2={x + width - 8} y1={rowY - ROW / 2} y2={rowY - ROW / 2} stroke={LINE} />}
            <text x={left ? x + 12 : x + width - 12} y={rowY + 4} fontSize={10.5} fill={DIM} textAnchor={left ? "start" : "end"} fontFamily="ui-monospace, Menlo, monospace">
              {pin.pad}
            </text>
            <text x={left ? x + 40 : x + 12} y={rowY + 4} fontSize={11} fill={pin.wired ? INK : DIM} fontFamily="ui-monospace, Menlo, monospace">
              {pin.name}
            </text>
            {pin.group && (
              <text
                x={left ? x + width - 16 : x + width - 40}
                y={rowY + 4}
                fontSize={9.5}
                fill={DIM}
                textAnchor="end"
                fontStyle="italic"
              >
                {pin.group}
              </text>
            )}
            {pin.open && (
              <g>
                <line
                  x1={pointX}
                  x2={left ? pointX + 26 : pointX - 26}
                  y1={rowY}
                  y2={rowY}
                  stroke="#f59e0b"
                  strokeWidth={1.6}
                  strokeDasharray="3 2"
                />
                <text x={left ? pointX + 30 : pointX - 30} y={rowY + 4} fontSize={9.5} fill="#b45309" textAnchor={left ? "start" : "end"}>
                  open
                </text>
              </g>
            )}
            <circle cx={pointX} cy={rowY} r={4} fill="#ffffff" stroke="#334155" strokeWidth={1.5} data-hit="pin" data-id={end.id} data-key={pin.cavity} />
            <circle cx={pointX} cy={rowY} r={8} fill="transparent" data-hit="pin" data-id={end.id} data-key={pin.cavity} />
          </g>
        );
      })}
    </g>
  );
}
