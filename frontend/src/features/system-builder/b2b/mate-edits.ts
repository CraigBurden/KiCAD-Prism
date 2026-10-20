/**
 * The B2B tab's edits (stage 3c), each one `replace-mate` (CONTRACTS §2.4):
 * orientation, stack height, spacer, a row's system name and the manual map.
 * The mapping itself is derived; only these choices are stored.
 */
import type { SystemDocument, SystemOp } from "../model/types";
import { naturalCompare } from "../schematic/scene";

type Mate = SystemDocument["mates"][number];

const NM_PER_MM = 1e6;

function mateOf(document: SystemDocument, id: string): Mate {
  const mate = document.mates.find((item) => item.id === id);
  if (!mate) throw new Error(`No mate ${id}`);
  return mate;
}

const replace = (mate: Mate): SystemOp[] => [{ kind: "replace-mate", mate }];

/** Turn and flip: quarter turns of B about the mating axis (0–3), and B flipped over its x axis. */
export function orientationOps(document: SystemDocument, id: string, orientation: { quarterTurns?: number; flip?: boolean }): SystemOp[] {
  const mate = mateOf(document, id);
  const quarterTurns = (((orientation.quarterTurns ?? mate.orientation.quarterTurns) % 4) + 4) % 4;
  return replace({ ...mate, orientation: { quarterTurns, flip: orientation.flip ?? mate.orientation.flip } });
}

/** The stated stack height in mm; null goes back to the clearance fallback. */
export function stackHeightOps(document: SystemDocument, id: string, heightMm: number | null): SystemOp[] {
  const mate = { ...mateOf(document, id) };
  if (heightMm === null) delete mate.stackHeightNm;
  else {
    if (!Number.isFinite(heightMm) || heightMm < 0) throw new Error("The stack height is a length of zero or more");
    mate.stackHeightNm = Math.round(heightMm * NM_PER_MM);
  }
  return replace(mate);
}

/**
 * A spacer: the offset after the mate transform, along the mating axis, in mm.
 * Zero drops the offset; any turn the offset already has is kept.
 */
export function spacerOps(document: SystemDocument, id: string, spacerMm: number): SystemOp[] {
  if (!Number.isFinite(spacerMm)) throw new Error("The spacer is a length");
  const mate = { ...mateOf(document, id) };
  const rotation = mate.offset?.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  const translation = { ...(mate.offset?.translation ?? { xNm: 0, yNm: 0, zNm: 0 }), zNm: Math.round(spacerMm * NM_PER_MM) };
  const identity = rotation.x === 0 && rotation.y === 0 && rotation.z === 0;
  if (identity && translation.xNm === 0 && translation.yNm === 0 && translation.zNm === 0) delete mate.offset;
  else mate.offset = { translation, rotation };
  return replace(mate);
}

/** A row's system name (keyed by its side A pad); empty clears it. */
export function rowNameOps(document: SystemDocument, id: string, aPad: string, name: string): SystemOp[] {
  const mate = mateOf(document, id);
  const rows = { ...mate.rows };
  const rest = { ...(rows[aPad] ?? {}) };
  delete rest.netLabel;
  const next = name.trim();
  const row = next ? { ...rest, netLabel: next } : rest;
  if (Object.keys(row).length) rows[aPad] = row;
  else delete rows[aPad];
  return replace({ ...mate, rows });
}

/** Replace the derived mapping with `pairs` (sorted by A pad); null goes back to geometry. */
export function manualMapOps(document: SystemDocument, id: string, pairs: { a: string; b: string }[] | null): SystemOp[] {
  const mate = { ...mateOf(document, id) };
  if (pairs === null) delete mate.manualMap;
  else mate.manualMap = [...pairs].sort((x, y) => naturalCompare(x.a, y.a));
  return replace(mate);
}

/**
 * Pairs from text, one per line as `A B`, `A:B`, `A-B` or `A,B`; blank lines
 * and `#` comments are skipped. Throws on a malformed line, or a pad named twice.
 */
export function parsePairs(text: string): { a: string; b: string }[] {
  const pairs: { a: string; b: string }[] = [];
  const seenA = new Set<string>();
  const seenB = new Set<string>();
  text.split("\n").forEach((raw, index) => {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) return;
    const parts = line.split(/\s*[\s:,]\s*|\s*-\s*/).filter(Boolean);
    if (parts.length !== 2) throw new Error(`Line ${index + 1}: expected two pads, as "A B"`);
    const [a, b] = parts;
    if (seenA.has(a)) throw new Error(`Line ${index + 1}: A pad ${a} is paired twice`);
    if (seenB.has(b)) throw new Error(`Line ${index + 1}: B pad ${b} is paired twice`);
    seenA.add(a);
    seenB.add(b);
    pairs.push({ a, b });
  });
  return pairs;
}
