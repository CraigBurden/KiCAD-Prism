/**
 * The harness canvas's nodes (CONTRACTS §16.5): a crimp splice, a loose end and
 * a branch point. A splice and a loose end carry a wire dot at their centre;
 * the body and its label drag the node.
 */
import type { HarnessLayout, PlacedNode } from "./harness-layout";
import type { HarnessView } from "./harness-view";

const INK = "#0f172a";
const DIM = "#64748b";
const NODE = "#334155";
const SELECT = "#0ea5e9";

function captionOf(view: HarnessView, node: PlacedNode): string {
  if (node.kind === "splice") {
    const splice = view.splices.find((item) => item.id === node.id);
    return `${node.id} · ${splice?.method ?? "crimp"} splice`;
  }
  if (node.kind === "loose") {
    const loose = view.looseEnds.find((item) => item.id === node.id);
    return `${node.id} · ${loose?.kind ?? "pigtail"}`;
  }
  return `${node.id} · branch point`;
}

function NodeShape({ node, selected }: { node: PlacedNode; selected: boolean }) {
  const { x, y } = node.point;
  if (node.kind === "splice") {
    return (
      <g>
        {selected && <circle cx={x} cy={y} r={14} fill={SELECT} opacity={0.16} />}
        <circle cx={x} cy={y} r={9} fill="#ffffff" stroke={INK} strokeWidth={2} />
        <text x={x} y={y + 4} fontSize={10} fontWeight={700} fill={INK} textAnchor="middle">
          S
        </text>
      </g>
    );
  }
  if (node.kind === "loose") {
    return (
      <g>
        {selected && <circle cx={x} cy={y} r={13} fill={SELECT} opacity={0.16} />}
        <circle cx={x} cy={y} r={7} fill="#ffffff" stroke={NODE} strokeWidth={1.8} />
        <circle cx={x} cy={y} r={2.5} fill="none" stroke={DIM} strokeWidth={1.2} />
      </g>
    );
  }
  return (
    <g>
      {selected && <circle cx={x} cy={y} r={14} fill={SELECT} opacity={0.16} />}
      <path d={`M${x} ${y - 10} L${x + 10} ${y} L${x} ${y + 10} L${x - 10} ${y} Z`} fill="#ffffff" stroke={NODE} strokeWidth={2} />
    </g>
  );
}

/** The node's label and, for a splice or a loose end, its wire dot. */
function NodeGlyph({ view, node, selected }: { view: HarnessView; node: PlacedNode; selected: boolean }) {
  const caption = captionOf(view, node);
  const terminal = node.kind !== "branch-point";
  const label =
    node.kind === "splice" ? (
      <text x={node.point.x - 4} y={node.point.y - 15} fontSize={10.5} fontWeight={600} fill={NODE} textAnchor="middle">
        {caption}
      </text>
    ) : (
      <text x={node.point.x + (node.kind === "branch-point" ? 20 : 13)} y={node.point.y + 4} fontSize={10.5} fontWeight={600} fill={NODE}>
        {caption}
      </text>
    );
  return (
    <g data-hit="node" data-id={node.id}>
      <NodeShape node={node} selected={selected} />
      {label}
      {terminal && (
        <circle cx={node.point.x} cy={node.point.y} r={8} fill="transparent" data-hit="pin" data-id={node.id} data-key="node" />
      )}
    </g>
  );
}

export function NodeLayer({ view, placed, selected }: { view: HarnessView; placed: HarnessLayout; selected: ReadonlySet<string> }) {
  return (
    <>
      {placed.nodes.map((node) => (
        <NodeGlyph key={node.id} view={view} node={node} selected={selected.has(node.id)} />
      ))}
    </>
  );
}
