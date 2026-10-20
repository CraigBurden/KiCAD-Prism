/**
 * Board-sheet edits as ops (CONTRACTS §14.3): grouping pins into sub-ports,
 * accepting or dismissing the bundle's suggestions, renaming and removing
 * sub-ports, and the sheet's own layout (`interior`).
 */
import { newId } from "../model/ids";
import type { BundleSuggestion, Interior, SchematicPlacement, SubPort, SystemDocument, SystemOp } from "../model/types";
import { naturalCompare } from "../schematic/scene";

/** `add-sub-port` for pads of one connector; pads keep the order given (§2.3: the user's order). */
export function groupOps(occurrence: string, connector: string, pads: readonly string[], name: string, id = newId("sub")): SystemOp[] {
  if (pads.length === 0) return [];
  const pins = [...pads] as [string, ...string[]];
  return [{ kind: "add-sub-port", subPort: { id, occurrence, connector, name, pins } }];
}

/** Pads in natural order: the order a drag selection hands to G. */
export function orderedPads(pads: Iterable<string>): string[] {
  return [...new Set(pads)].sort(naturalCompare);
}

/** Accept suggestions as sub-ports, one request (§14.3 "accept all"). */
export function acceptOps(occurrence: string, suggestions: readonly BundleSuggestion[], makeId: typeof newId = newId): SystemOp[] {
  return suggestions.map((suggestion) => ({
    kind: "add-sub-port",
    subPort: {
      id: makeId("sub"),
      occurrence,
      connector: suggestion.connector,
      name: suggestion.name,
      pins: [...suggestion.pins],
      suggestion: suggestion.key,
    },
  }));
}

export function dismissOps(suggestion: Pick<BundleSuggestion, "occurrence" | "connector" | "key">): SystemOp[] {
  return [{ kind: "dismiss-suggestion", suggestion: { occurrence: suggestion.occurrence, connector: suggestion.connector, key: suggestion.key } }];
}

export function renameSubPortOps(subPort: SubPort, name: string): SystemOp[] {
  return [{ kind: "replace-sub-port", subPort: { ...subPort, name } }];
}

export function removeSubPortOps(ids: readonly string[]): SystemOp[] {
  return ids.map((id) => ({ kind: "remove-sub-port", id }));
}

/** Can these pads be grouped? A reason when not. */
export function groupRefusal(document: SystemDocument, occurrence: string, connector: string | null, pads: readonly string[], name: string): string | null {
  if (!connector) return "Select wires of one connector to group them.";
  if (pads.length < 1) return "Select at least one wire.";
  if (!/^\S/.test(name) || !name.trim()) return "Give the group a name.";
  const clash = document.subPorts.some((item) => item.occurrence === occurrence && item.connector === connector && item.name === name.trim());
  return clash ? `${connector} already has a group named ${name.trim()}.` : null;
}

/** The occurrence's layout entry with its interior replaced: one `set-layout`. */
export function interiorOps(document: SystemDocument, occurrence: string, interior: Interior): SystemOp[] {
  const current: SchematicPlacement = document.layout[occurrence] ?? { xNm: 0, yNm: 0, rotationDeg: 0, mirror: false };
  return [{ kind: "set-layout", item: occurrence, placement: { ...current, interior } }];
}
