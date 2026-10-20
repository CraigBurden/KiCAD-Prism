/**
 * Sub-port names in KiCad's bus-group form (CONTRACTS §14.1, §14.3): a
 * group's name is what its nets have in common, its members what differs,
 * and a folded connector's label lists its groups and ungrouped pads,
 * `J2201{FAN{TACH PWM} 1 2 MP}`.
 */
import type { BundlePin, SubPort } from "../model/types";
import { naturalCompare } from "../schematic/scene";

/** A net's last path segment, as a bus member may be named: no overbar braces, no spaces. */
export function memberSafe(net: string | undefined): string {
  const leaf = (net ?? "").split("/").filter(Boolean).pop() ?? "";
  return leaf.replace(/~\{([^}]*)\}/g, "$1").replace(/[{}\s]+/g, "_").replace(/^_+|_+$/g, "");
}

const tokens = (name: string) => name.split("_").filter(Boolean);

/** Tokens every list starts with, and (of what is left) every list ends with. */
function commonParts(lists: string[][]): { head: string[]; tail: string[] } {
  const head: string[] = [];
  for (let index = 0; lists.every((list) => list.length > index + 1 && list[index] === lists[0][index]); index += 1) head.push(lists[0][index]);
  const rest = lists.map((list) => list.slice(head.length));
  const tail: string[] = [];
  for (let index = 1; rest.every((list) => list.length > index && list[list.length - index] === rest[0][rest[0].length - index]); index += 1) {
    tail.unshift(rest[0][rest[0].length - index]);
  }
  return { head, tail };
}

export interface ProposedGroup {
  name: string;
  /** One member name per pad, in the pads' order. */
  members: string[];
}

/**
 * The name and members G proposes for pads with these nets (§14.3): the
 * shared leading part of the net names is the name, the differing middle the
 * members; a shared ending (`_3V3`) is dropped. Pads without a usable net,
 * and members that would collide, fall back to the pad number.
 */
export function proposeGroup(pins: readonly Pick<BundlePin, "pad" | "net">[]): ProposedGroup {
  const names = pins.map((pin) => memberSafe(pin.net));
  const usable = names.filter(Boolean).map(tokens);
  const { head, tail } = usable.length >= 2 ? commonParts(usable) : { head: [], tail: [] };
  // One shared net (GND on several pads) names the group by itself.
  const single = new Set(usable.map((list) => list.join("_"))).size === 1 ? usable[0].join("_") : "";
  const name = head.join("_") || single || "GROUP";
  const members = names.map((full, index) => {
    if (!full) return pins[index].pad;
    const middle = tokens(full).slice(head.length, tokens(full).length - tail.length);
    return middle.join("_") || full;
  });
  const seen = new Map<string, number>();
  for (const member of members) seen.set(member, (seen.get(member) ?? 0) + 1);
  return { name, members: members.map((member, index) => ((seen.get(member) ?? 0) > 1 ? pins[index].pad : member)) };
}

/** Member names of an accepted sub-port, derived again from its pins' nets. */
export function subPortMembers(subPort: Pick<SubPort, "pins">, pins: readonly Pick<BundlePin, "pad" | "net">[]): string[] {
  const byPad = new Map(pins.map((pin) => [pin.pad, pin]));
  return proposeGroup(subPort.pins.map((pad) => byPad.get(pad) ?? { pad })).members;
}

/** At most this many ungrouped pads are spelled out in a folded label; more read `+N`. */
export const LABEL_PAD_LIMIT = 8;

/**
 * A connector's hierarchical label (§14.1). Without groups it is the
 * reference and its pin count, `J202{121}`; with groups, each group as
 * `NAME{MEMBERS}` followed by the ungrouped pads in natural order.
 */
export function busGroupLabel(refdes: string, pins: readonly Pick<BundlePin, "pad" | "net">[], subPorts: readonly Pick<SubPort, "name" | "pins">[]): string {
  if (subPorts.length === 0) return `${refdes}{${pins.length}}`;
  const grouped = new Set(subPorts.flatMap((subPort) => subPort.pins));
  const groups = subPorts.map((subPort) => `${subPort.name}{${subPortMembers(subPort, pins).join(" ")}}`);
  const loose = pins.flatMap((pin) => (grouped.has(pin.pad) ? [] : [pin.pad])).sort(naturalCompare);
  const shown = loose.length > LABEL_PAD_LIMIT ? [...loose.slice(0, LABEL_PAD_LIMIT - 1), `+${loose.length - LABEL_PAD_LIMIT + 1}`] : loose;
  return `${refdes}{${[...groups, ...shown].join(" ")}}`;
}
