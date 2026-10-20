/**
 * Draws a `BoardScene` as Eeschema draws a sheet: the generated board symbol,
 * connector buses to hierarchical labels and, for an unfolded connector, its
 * bus entries and wires with net labels. Pure rendering; hit targets carry
 * `data-hit` with the connector (`data-id`) and pad (`data-key`).
 */
import { memo } from "react";

import { NORMAL, type Point } from "../schematic/geometry";
import { COLOURS } from "../schematic/sheet-svg";
import { wireKey, type BoardConnector, type BoardScene, type BoardWire } from "./board-scene";

const MM = 1_000_000;
const mm = (nm: number) => nm / MM;
const TEXT = 1.27;
const S = 0.635;

export const BOARD_COLOURS = {
  symbol: "#840000",
  symbolFill: "#ffffc2",
  wire: "#008400",
  netLabel: "#000000",
  hierLabel: "#725600",
  group: "#0000c2",
  power: "#a00000",
};

const DIRECTION: Record<number, Point> = { 0: { x: 1, y: 0 }, 90: { x: 0, y: -1 }, 180: { x: -1, y: 0 }, 270: { x: 0, y: 1 } };

function directionOf(rotationDeg: number): Point {
  return DIRECTION[((Math.round(rotationDeg / 90) * 90) % 360 + 360) % 360] ?? DIRECTION[0];
}

const points = (list: readonly Point[]) => list.map((point) => `${mm(point.x)},${mm(point.y)}`).join(" ");

/** KiCad's bidirectional hierarchical label, its point on the bus end, pointing away. */
function HierLabel({ connector, selected }: { connector: BoardConnector; selected: boolean }) {
  const { point, rotationDeg, text } = connector.label;
  const d = directionOf(rotationDeg);
  const q = { x: -d.y, y: d.x };
  const at = (a: number, b: number) => `${mm(point.x) + d.x * a + q.x * b},${mm(point.y) + d.y * a + q.y * b}`;
  const shape = [at(0, 0), at(S, S), at(3 * S, S), at(4 * S, 0), at(3 * S, -S), at(S, -S)].join(" ");
  const tx = mm(point.x) + d.x * (4 * S + 0.6);
  const ty = mm(point.y) + d.y * (4 * S + 0.6);
  const vertical = d.y !== 0;
  const anchor = (vertical ? d.y < 0 : d.x > 0) ? "start" : "end";
  return (
    <g data-hit="label" data-id={connector.refdes} style={{ cursor: "move" }}>
      {selected && <polygon points={shape} fill={COLOURS.select} opacity={0.35} stroke={COLOURS.select} strokeWidth={0.6} />}
      <polygon points={shape} fill="none" stroke={BOARD_COLOURS.hierLabel} strokeWidth={0.15} />
      <text
        x={tx}
        y={vertical ? ty : ty + TEXT * 0.35}
        fontSize={TEXT}
        fill={BOARD_COLOURS.hierLabel}
        textAnchor={anchor}
        dominantBaseline={vertical ? "central" : undefined}
        transform={vertical ? `rotate(-90 ${tx} ${ty})` : undefined}
      >
        {text}
      </text>
    </g>
  );
}

function WireView({ wire, edge, selected }: { wire: BoardWire; edge: BoardConnector["edge"]; selected: boolean }) {
  const n = NORMAL[edge];
  const vertical = n.y !== 0;
  const labelAt = { x: mm(wire.end.x) + n.x * 0.5, y: mm(wire.end.y) + n.y * 0.5 };
  const anchor = vertical ? (n.y < 0 ? "start" : "end") : n.x > 0 ? "start" : "end";
  const transform = vertical ? `rotate(-90 ${labelAt.x} ${labelAt.y})` : undefined;
  const padAt = { x: mm(wire.start.x) + n.x * 0.4, y: mm(wire.start.y) + n.y * 0.4 - (vertical ? 0 : 0.4) };
  return (
    <g data-hit="wire" data-id={wire.connector} data-key={wire.pad} style={{ cursor: "pointer" }}>
      <polyline points={points([wire.tap, wire.start, wire.end])} fill="none" stroke="transparent" strokeWidth={1.4} />
      {selected && <polyline points={points([wire.start, wire.end])} fill="none" stroke={COLOURS.select} strokeWidth={0.9} opacity={0.45} />}
      <polyline points={points([wire.tap, wire.start])} fill="none" stroke={BOARD_COLOURS.wire} strokeWidth={0.15} />
      <polyline points={points([wire.start, wire.end])} fill="none" stroke={BOARD_COLOURS.wire} strokeWidth={0.15} />
      <text x={padAt.x} y={padAt.y} fontSize={TEXT * 0.7} fill="#7a0000" textAnchor={anchor} transform={vertical ? `rotate(-90 ${padAt.x} ${padAt.y})` : undefined}>{wire.pad}</text>
      <text x={labelAt.x} y={vertical ? labelAt.y : labelAt.y + TEXT * 0.35} fontSize={TEXT} fill={wire.power ? BOARD_COLOURS.power : BOARD_COLOURS.netLabel} textAnchor={anchor} dominantBaseline={vertical ? "central" : undefined} transform={transform}>
        {wire.netLabel}
        {wire.groups.length > 0 && <tspan fontSize={TEXT * 0.8} fill={BOARD_COLOURS.group}>{`  ${wire.groups.join(", ")}`}</tspan>}
      </text>
    </g>
  );
}

function ConnectorView({ connector, selectedWires, selectedLabel }: { connector: BoardConnector; selectedWires: ReadonlySet<string>; selectedLabel: boolean }) {
  const n = NORMAL[connector.edge];
  const vertical = connector.edge === "top" || connector.edge === "bottom";
  const inside = { x: mm(connector.pin.x) - n.x * 0.8, y: mm(connector.pin.y) - n.y * 0.8 };
  const anchor = connector.edge === "left" || connector.edge === "bottom" ? "start" : "end";
  return (
    <g>
      {/* The bus: double-click to unfold or fold. */}
      <g data-hit="bus" data-id={connector.refdes} style={{ cursor: "pointer" }}>
        <polyline points={points(connector.bus)} fill="none" stroke="transparent" strokeWidth={1.6} />
        <polyline points={points(connector.bus)} fill="none" stroke={COLOURS.bus} strokeWidth={0.36} strokeLinejoin="round" />
        {connector.spine.length > 1 && <polyline points={points(connector.spine)} fill="none" stroke={COLOURS.bus} strokeWidth={0.36} />}
        {connector.spine.length > 1 && <circle cx={mm(connector.spine[0].x)} cy={mm(connector.spine[0].y)} r={0.45} fill={COLOURS.bus} />}
      </g>
      {connector.wires.map((wire) => (
        <WireView key={wire.pad} wire={wire} edge={connector.edge} selected={selectedWires.has(wireKey(wire.connector, wire.pad))} />
      ))}
      <g data-hit="pin" data-id={connector.refdes} style={{ cursor: "grab" }}>
        <circle cx={mm(connector.pin.x)} cy={mm(connector.pin.y)} r={1.4} fill="transparent" />
        <circle cx={mm(connector.pin.x)} cy={mm(connector.pin.y)} r={0.3} fill="none" stroke={BOARD_COLOURS.symbol} strokeWidth={0.15} />
        <text
          x={inside.x}
          y={vertical ? inside.y : inside.y + TEXT * 0.35}
          fontSize={TEXT}
          fill={BOARD_COLOURS.symbol}
          textAnchor={anchor}
          dominantBaseline={vertical ? "central" : undefined}
          transform={vertical ? `rotate(-90 ${inside.x} ${inside.y})` : undefined}
        >
          {connector.refdes}
          <tspan fontSize={TEXT * 0.72} fill={COLOURS.muted}>{`  ${connector.detail}`}</tspan>
        </text>
        {connector.back && (
          <text x={mm(connector.pin.x) + n.x * 1.4 + (vertical ? 1 : 0)} y={mm(connector.pin.y) + n.y * 1.4 + (vertical ? 0 : -0.8)} fontSize={TEXT * 0.8} fontWeight={700} fill="#7a0000" textAnchor="middle">B</text>
        )}
      </g>
      <HierLabel connector={connector} selected={selectedLabel} />
    </g>
  );
}

export interface BoardSheetSvgProps {
  scene: BoardScene;
  selectedWires: ReadonlySet<string>;
  selectedLabels: ReadonlySet<string>;
  symbolSelected: boolean;
}

export const BoardSheetSvg = memo(function BoardSheetSvg({ scene, selectedWires, selectedLabels, symbolSelected }: BoardSheetSvgProps) {
  const r = { x: mm(scene.symbol.x), y: mm(scene.symbol.y), width: mm(scene.symbol.w), height: mm(scene.symbol.h) };
  return (
    <g fontFamily="'KiCad Font','Helvetica Neue',Arial,sans-serif">
      {symbolSelected && <rect {...r} fill="none" stroke={COLOURS.select} strokeWidth={1.2} opacity={0.35} />}
      <rect {...r} fill={BOARD_COLOURS.symbolFill} stroke={BOARD_COLOURS.symbol} strokeWidth={0.25} data-hit="symbol" style={{ cursor: "move" }} />
      <g pointerEvents="none">
        <text x={r.x} y={r.y - 0.8} fontSize={TEXT} fill={COLOURS.sheetName}>U_BOARD</text>
        <text x={r.x + r.width / 2} y={r.y + r.height / 2} fontSize={TEXT * 1.4} fontWeight={600} fill={BOARD_COLOURS.symbol} textAnchor="middle">{scene.label}</text>
        <text x={r.x + r.width / 2} y={r.y + r.height / 2 + 2} fontSize={TEXT * 0.8} fill="#9a5a5a" textAnchor="middle">generated from the bundle · read-only</text>
      </g>
      {scene.connectors.map((connector) => (
        <ConnectorView key={connector.refdes} connector={connector} selectedWires={selectedWires} selectedLabel={selectedLabels.has(connector.refdes)} />
      ))}
    </g>
  );
});
