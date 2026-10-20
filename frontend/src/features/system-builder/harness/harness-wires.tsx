/**
 * Segments, coverings and wires on the harness canvas (CONTRACTS §16.5,
 * mockup 09): a segment is a pale band, a covering darkens its band, an
 * explicit wire is solid in its colour, a default one dashed, and a suggested
 * join amber. Labels sit near the wire's far end.
 */
import type { HarnessLayout, Point } from "./harness-layout";
import type { HarnessView, WireView } from "./harness-view";
import { colourHex, needsOutline, wireLabel } from "./harness-format";

const BAND = "#94a3b8";
const COVER = "#1e293b";
const GREY = "#64748b";
const AMBER = "#f59e0b";
const SELECT = "#0ea5e9";

const pathOf = (points: Point[]) => (points.length ? `M${points.map((point) => `${point.x} ${point.y}`).join(" L")}` : "");

function wireStroke(wire: WireView): { colour: string; dash?: string } {
  if (wire.suggested) return { colour: AMBER, dash: "7 4" };
  if (wire.origin === "default") return { colour: GREY, dash: "7 4" };
  return { colour: colourHex(wire.colour) };
}

function SegmentLayer({ view, placed }: { view: HarnessView; placed: HarnessLayout }) {
  return (
    <>
      {placed.segments.map((segment) => {
        const covering = view.coverings.find((item) => item.segment === segment.id);
        const middle = segment.points[0] && segment.points[segment.points.length - 1]
          ? { x: (segment.points[0].x + segment.points[segment.points.length - 1].x) / 2, y: (segment.points[0].y + segment.points[segment.points.length - 1].y) / 2 }
          : null;
        return (
          <g key={segment.id}>
            <path d={pathOf(segment.points)} fill="none" stroke={BAND} strokeOpacity={0.16} strokeWidth={26} strokeLinecap="round" />
            {covering && <path d={pathOf(segment.points)} fill="none" stroke={COVER} strokeOpacity={0.12} strokeWidth={22} strokeLinecap="round" />}
            {covering && middle && (
              <text x={middle.x} y={middle.y - 10} fontSize={10.5} fontWeight={600} fill="#334155">
                {`${covering.id} · ${covering.kind}`}
              </text>
            )}
            <path d={pathOf(segment.points)} fill="none" stroke="transparent" strokeWidth={30} data-hit="segment" data-id={segment.id} />
          </g>
        );
      })}
    </>
  );
}

function wireLabels(wire: WireView, points: Point[]): { text: string; x: number; y: number; anchor: "start" | "end"; width: number } | null {
  const end = points[points.length - 1];
  const previous = points[points.length - 2];
  if (!end || !previous) return null;
  const text = wireLabel(wire);
  const rightward = end.x >= previous.x;
  return {
    text,
    x: rightward ? end.x - 10 : end.x + 10,
    y: end.y - 9,
    anchor: rightward ? "end" : "start",
    width: text.length * 5.9 + 8,
  };
}

export function WireLayer({
  view,
  placed,
  labels,
  selected,
  hidden,
}: {
  view: HarnessView;
  placed: HarnessLayout;
  labels: boolean;
  selected: ReadonlySet<string>;
  hidden: ReadonlySet<string>;
}) {
  const wires = new Map(view.wires.map((wire) => [wire.id, wire]));
  return (
    <>
      <SegmentLayer view={view} placed={placed} />
      {placed.wires.map((path) => {
        const wire = wires.get(path.id);
        if (!wire || hidden.has(path.id)) return null;
        const { colour, dash } = wireStroke(wire);
        const d = pathOf(path.points);
        const isSelected = selected.has(path.id);
        return (
          <g key={path.id}>
            {isSelected && <path d={d} fill="none" stroke={SELECT} strokeOpacity={0.28} strokeWidth={8.4} strokeLinejoin="round" />}
            {!dash && <path d={d} fill="none" stroke={needsOutline(wire.colour) ? GREY : colour} strokeWidth={3.8} strokeLinejoin="round" />}
            <path
              d={d}
              fill="none"
              stroke={colour}
              strokeWidth={2.4}
              strokeLinejoin="round"
              {...(dash ? { strokeDasharray: dash } : {})}
              data-testid={`wire-${path.id}`}
            />
            <path d={d} fill="none" stroke="transparent" strokeWidth={12} data-hit="wire" data-id={path.id} data-testid={`wire-hit-${path.id}`} />
          </g>
        );
      })}
      {labels && placed.wires.map((path) => {
        const wire = wires.get(path.id);
        if (!wire || hidden.has(path.id)) return null;
        const label = wireLabels(wire, path.points);
        if (!label) return null;
        const left = label.anchor === "end" ? label.x - label.width : label.x - 4;
        return (
          <g key={`label-${path.id}`} pointerEvents="none">
            <rect x={left} y={label.y - 11} width={label.width} height={15} rx={3} fill="#fbfaf7" />
            <text x={label.x} y={label.y} fontSize={9.5} fill={GREY} textAnchor={label.anchor} fontFamily="ui-monospace, Menlo, monospace">
              {label.text}
            </text>
          </g>
        );
      })}
    </>
  );
}
