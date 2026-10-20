/**
 * Cables on the harness canvas (CONTRACTS §16.5): X-ray on draws the jacket as
 * a dashed rounded rectangle round the middle of the wires its conductors bind;
 * X-ray off draws one thick dark line and hides those wires.
 */
import type { HarnessLayout, Point } from "./harness-layout";
import type { HarnessView } from "./harness-view";
import { partRefText } from "./harness-format";

const JACKET = "#334155";

function bounds(points: Point[]): { x: number; y: number; w: number; h: number } | null {
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function pathOf(points: Point[]): string {
  return points.length ? `M${points.map((point) => `${point.x} ${point.y}`).join(" L")}` : "";
}

/** The wire ids each cable binds, for the layer that hides them when X-ray is off. */
export function boundWireIds(view: HarnessView): Set<string> {
  return new Set(view.cables.flatMap((cable) => cable.conductors.flatMap((conductor) => (conductor.wire ? [conductor.wire] : []))));
}

export function CableLayer({ view, placed, xray }: { view: HarnessView; placed: HarnessLayout; xray: boolean }) {
  const wirePaths = new Map(placed.wires.map((wire) => [wire.id, wire.points]));
  return (
    <>
      {view.cables.map((cable) => {
        const bound = cable.conductors.flatMap((conductor) => {
          const points = conductor.wire ? wirePaths.get(conductor.wire) : undefined;
          return points ? [points] : [];
        });
        if (!bound.length) return null;
        const name = cable.part ? partRefText(cable.part) : (cable.label ?? "cable");
        if (!xray) {
          const first = bound[0];
          const middle = first[Math.floor(first.length / 2)] ?? first[0];
          return (
            <g key={cable.id}>
              <path d={pathOf(first)} fill="none" stroke="#1e293b" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
              <text x={middle.x} y={middle.y - 10} fontSize={10.5} fontWeight={600} fill={JACKET} textAnchor="middle">
                {`${cable.id} · ${name}`}
              </text>
            </g>
          );
        }
        const middle = bound.flatMap((points) => (points.length >= 4 ? [points[2], points[3]] : [points[0], points[points.length - 1]]));
        const box = bounds(middle);
        if (!box) return null;
        return (
          <g key={cable.id}>
            <rect
              x={box.x - 10}
              y={box.y - 9}
              width={box.w + 20}
              height={box.h + 18}
              rx={12}
              fill="none"
              stroke={JACKET}
              strokeWidth={1.6}
              strokeDasharray="5 3"
            />
            <text x={box.x - 10} y={box.y + box.h + 28} fontSize={10.5} fontWeight={600} fill={JACKET}>
              {`${cable.id} · ${name} · X-ray`}
            </text>
          </g>
        );
      })}
    </>
  );
}
