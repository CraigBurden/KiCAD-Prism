/**
 * Inside a board's sheet (CONTRACTS §14.1–§14.2): one generated board symbol
 * whose pins are the board's connectors, each pin's bus running to a
 * hierarchical label. An unfolded connector breaks its bus out into one wire
 * per pad through 45° bus entries, each wire ending in its board net's name.
 *
 * Pure: the document, the bundle, the user's unfolded connectors and, while a
 * drag runs, an interior override.
 */
import type {
  BundleConnector,
  BundlePin,
  BundleSuggestion,
  Edge,
  Interior,
  PortPlacement,
  SubPort,
  SystemBundle,
  SystemDocument,
} from "../model/types";
import {
  NORMAL,
  PIN_GRID_NM,
  SHEET_CORNER_NM,
  defaultPorts,
  defaultSheetSize,
  portPoint,
  simplifyRoute,
  type AngledPort,
  type Point,
  type Rect,
} from "../schematic/geometry";
import { naturalCompare } from "../schematic/scene";
import { busGroupLabel, memberSafe, subPortMembers } from "./grouping";

/** Pin to label (§14.2). */
export const LABEL_DISTANCE_NM = 15_240_000;
/** Bus stub from a pin before it turns towards a moved label. */
export const SPINE_OFFSET_NM = 7_620_000;
/** Roughly one character of a 1.27 mm label, for clearing the label column. */
const CHAR_NM = 900_000;
/** Row pitch of an unfolded connector's wires, and a bus entry's run. */
export const ROW_NM = PIN_GRID_NM;
/** A breakout wire's length past its bus entry. */
export const WIRE_NM = 12_700_000;

export interface BoardWire {
  connector: string;
  pad: string;
  net?: string;
  /** The net's name as drawn on the wire's label. */
  netLabel: string;
  power: boolean;
  /** Names of the sub-ports this pad is in. */
  groups: string[];
  /** Where the bus entry leaves the spine. */
  tap: Point;
  /** The entry's other end, where the wire starts. */
  start: Point;
  end: Point;
}

export interface BoardConnector {
  refdes: string;
  detail: string;
  edge: Edge;
  offsetNm: number;
  /** On the board symbol's border. */
  pin: Point;
  back: boolean;
  label: { point: Point; rotationDeg: number; text: string; stored: boolean };
  /** The bus from the pin to the label. */
  bus: Point[];
  unfolded: boolean;
  /** The unfolded connector's spine, from where it leaves the bus to its last row. */
  spine: Point[];
  wires: BoardWire[];
  pins: BundlePin[];
  subPorts: SubPort[];
  suggestions: BundleSuggestion[];
}

export interface BoardScene {
  occurrence: string;
  label: string;
  state: string;
  symbol: Rect;
  corner: number;
  connectors: BoardConnector[];
  bounds: Rect;
}

const LABEL_ROTATION: Record<Edge, number> = { right: 0, top: 90, left: 180, bottom: 270 };

function along(point: Point, direction: Point, distance: number): Point {
  return { x: point.x + direction.x * distance, y: point.y + direction.y * distance };
}

/** The spine runs along the edge: down beside a left or right edge, rightwards beside a top or bottom one. */
function tangent(edge: Edge): Point {
  return edge === "left" || edge === "right" ? { x: 0, y: 1 } : { x: 1, y: 0 };
}

function busTo(pin: Point, edge: Edge, label: Point): Point[] {
  const n = NORMAL[edge];
  const stub = along(pin, n, SPINE_OFFSET_NM);
  const corner = edge === "left" || edge === "right" ? [{ x: stub.x, y: label.y }] : [{ x: label.x, y: stub.y }];
  return simplifyRoute([pin, stub, ...corner, label]);
}

export interface BoardSceneOptions {
  /** Connector refdes the user unfolded. */
  unfolded?: ReadonlySet<string>;
  /** Replaces the stored interior while a drag runs. */
  interior?: Interior;
}

/** The sheet of one board occurrence; `null` when it is not a board or cannot be drawn yet. */
export function buildBoardScene(
  document: SystemDocument,
  bundle: SystemBundle | undefined,
  occurrenceId: string,
  options: BoardSceneOptions = {},
): BoardScene | null {
  const occurrence = document.occurrences.find((item) => item.id === occurrenceId);
  // A body's sheet is its connector parts, drawn like a board's (§15.4).
  if (!occurrence || (occurrence.source.kind !== "board" && occurrence.source.kind !== "body")) return null;
  const bundled = bundle?.occurrences.find((item) => item.occurrence === occurrenceId);
  const interior = options.interior ?? document.layout[occurrenceId]?.interior ?? {};
  const connectors = [...(bundled?.connectors ?? [])].sort((a, b) => naturalCompare(a.refdes, b.refdes));
  const angled: AngledPort[] = connectors.map((item) => ({ key: item.refdes, angleDeg: item.placement?.angleDeg }));
  const size = interior.symbol
    ? { widthNm: interior.symbol.widthNm, heightNm: interior.symbol.heightNm }
    : document.layout[occurrenceId]?.size ?? defaultSheetSize(bundled?.outline, angled);
  const symbol: Rect = { x: interior.symbol?.xNm ?? 0, y: interior.symbol?.yNm ?? 0, w: size.widthNm, h: size.heightNm };
  const placements: Record<string, PortPlacement> = { ...defaultPorts(angled, size), ...(interior.pins ?? {}) };
  const unfolded = options.unfolded ?? new Set<string>();
  const subPortsOf = (refdes: string) => document.subPorts.filter((item) => item.occurrence === occurrenceId && item.connector === refdes);
  const suggestionsOf = (refdes: string) =>
    (bundle?.suggestions ?? []).filter((item) => item.occurrence === occurrenceId && item.connector === refdes);

  // An unfolded connector breaks out beyond its edge's folded labels, so its
  // wires never cross a neighbour's label (§14.2).
  const longest: Record<Edge, number> = { left: 0, right: 0, top: 0, bottom: 0 };
  for (const connector of connectors) {
    const edge = placements[connector.refdes].edge;
    const text = busGroupLabel(connector.refdes, connector.pins, subPortsOf(connector.refdes));
    longest[edge] = Math.max(longest[edge], text.length);
  }
  const breakout = (edge: Edge) =>
    Math.ceil((LABEL_DISTANCE_NM + 4 * 635_000 + longest[edge] * CHAR_NM + 2 * PIN_GRID_NM) / PIN_GRID_NM) * PIN_GRID_NM;

  const drawn = connectors.map((connector: BundleConnector): BoardConnector => {
    const placement = placements[connector.refdes];
    const pin = portPoint(symbol, size, placement, SHEET_CORNER_NM);
    const n = NORMAL[placement.edge];
    const stored = interior.labels?.[connector.refdes];
    let labelPoint = stored ? { x: stored.xNm, y: stored.yNm } : along(pin, n, LABEL_DISTANCE_NM);
    let labelRotation = stored?.rotationDeg ?? LABEL_ROTATION[placement.edge];
    const subPorts = subPortsOf(connector.refdes);
    const pins = [...connector.pins].sort((a, b) => naturalCompare(a.pad, b.pad));
    const isUnfolded = unfolded.has(connector.refdes);
    const wires: BoardWire[] = [];
    let spine: Point[] = [];
    let bus = busTo(pin, placement.edge, labelPoint);
    if (isUnfolded && pins.length) {
      const t = tangent(placement.edge);
      const head = along(pin, n, breakout(placement.edge));
      const groupsOf = new Map<string, string[]>();
      for (const subPort of subPorts) for (const pad of subPort.pins) groupsOf.set(pad, [...(groupsOf.get(pad) ?? []), subPort.name]);
      pins.forEach((item, index) => {
        const tap = along(head, t, ROW_NM * (index + 1));
        const start = along(along(tap, n, ROW_NM), t, ROW_NM);
        wires.push({
          connector: connector.refdes,
          pad: item.pad,
          net: item.net,
          netLabel: memberSafe(item.net) || "no net",
          power: item.power,
          groups: groupsOf.get(item.pad) ?? [],
          tap,
          start,
          end: along(start, n, WIRE_NM),
        });
      });
      // Unfolded, the label sits at the spine's far end, pointing along it.
      labelPoint = along(wires[wires.length - 1].tap, t, 2 * ROW_NM);
      labelRotation = t.y ? 270 : 0;
      spine = [head, labelPoint];
      bus = [pin, head];
    }
    return {
      refdes: connector.refdes,
      detail: [connector.value || connector.mpn, `${connector.pins.length}`].filter(Boolean).join(" · "),
      edge: placement.edge,
      offsetNm: placement.offsetNm,
      pin,
      back: connector.placement?.side === "bottom",
      label: {
        point: labelPoint,
        rotationDeg: labelRotation,
        text: busGroupLabel(connector.refdes, pins, subPorts),
        stored: Boolean(stored),
      },
      bus,
      unfolded: isUnfolded,
      spine,
      wires,
      pins,
      subPorts,
      suggestions: suggestionsOf(connector.refdes),
    };
  });

  const xs: number[] = [symbol.x, symbol.x + symbol.w];
  const ys: number[] = [symbol.y, symbol.y + symbol.h];
  for (const connector of drawn) {
    for (const point of [...connector.bus, ...connector.wires.map((wire) => wire.end)]) {
      xs.push(point.x);
      ys.push(point.y);
    }
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    occurrence: occurrenceId,
    label: occurrence.label,
    state: bundled?.state ?? "unknown",
    symbol,
    corner: SHEET_CORNER_NM,
    connectors: drawn,
    bounds: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y },
  };
}

/** A wire's key in a selection: connector and pad. */
export const wireKey = (connector: string, pad: string) => `${connector}\u0000${pad}`;

export function parseWireKey(key: string): { connector: string; pad: string } {
  const [connector, pad] = key.split("\u0000");
  return { connector, pad };
}

/** The member names of a connector's accepted sub-ports, for the side list. */
export function describeSubPorts(connector: BoardConnector): { subPort: SubPort; members: string[] }[] {
  return connector.subPorts.map((subPort) => ({ subPort, members: subPortMembers(subPort, connector.pins) }));
}
