/**
 * A harness block as its tab shows it (stage 4b, CONTRACTS §16.5, mockup 09):
 * each end as a card with one row per pin of its site's connector, every wire
 * of the bundle's wire list (§16.3) with where it came from, the nodes
 * (splices, loose ends, branch points), the physical objects, and the findings
 * on the block. Ends come only from schematic links; the tab never adds one.
 */
import type { SystemBundle, SystemDocument } from "../model/types";
import { naturalCompare } from "../schematic/scene";

type Harness = SystemDocument["harnesses"][number];
type BundleHarness = NonNullable<SystemBundle["harnesses"]>[number];
type BundleWire = BundleHarness["wires"][number];
type Finding = SystemBundle["findings"][number];
export type PartRef = { componentId: string; revisionId?: string };

export type TerminalView =
  | { kind: "contact"; end: string; cavity: string; pad?: string }
  | { kind: "splice"; splice: string }
  | { kind: "loose"; looseEnd: string };

export interface PinRow {
  pad: string;
  /** The cavity the pad sits in: `pinMap`, else the pad. */
  cavity: string;
  /** The board net's leaf name, or the pin's name when it has no net. */
  name: string;
  /** The system net id. */
  net?: string;
  power: boolean;
  /** The sub-port a link of this block uses the pin through. */
  group?: string;
  /** A link covers it but no wire reaches it. */
  open: boolean;
  /** Wires reach it. */
  wired: boolean;
}

export interface EndView {
  id: string;
  /** `J2201 · Carrier`, or the end id when not attached. */
  title: string;
  subtitle: string;
  side: "left" | "right";
  attached: boolean;
  occurrence?: string;
  connector?: string;
  /** The board connector's MPN, when its bundle carries one. */
  mpn?: string;
  housing?: PartRef;
  /** The housing as the bundle resolved it (`componentId@revisionId`), when it did. */
  housingResolved?: string;
  contacts: Record<string, PartRef>;
  pinMap: { cavity: string; pad: string }[];
  pins: PinRow[];
}

export interface WireView {
  id: string;
  origin: "explicit" | "default";
  link?: string;
  from: TerminalView;
  to: TerminalView;
  gaugeAwg?: string;
  colour?: string;
  label?: string;
  lengthNm?: number;
  cable?: string;
  conductor?: string;
  net?: string;
  /** The system net's display name. */
  netName?: string;
  /** A power or ground join not confirmed yet (§8.5). */
  suggested: boolean;
}

export interface HarnessView {
  id: string;
  label: string;
  harness: Harness;
  ends: EndView[];
  wires: WireView[];
  splices: Harness["splices"];
  looseEnds: Harness["looseEnds"];
  branchPoints: Harness["branchPoints"];
  segments: Harness["segments"];
  cables: Harness["cables"];
  coverings: Harness["coverings"];
  markers: Harness["markers"];
  /** Bundle findings whose objects include the block. */
  findings: Finding[];
  /** The bundle has no wire list for the block (still building, or built before format 5). */
  pending: boolean;
}

/** The last segment of a hierarchical net name (`/SOM/FAN_TACH_3V3` → `FAN_TACH_3V3`). */
export const leaf = (net: string) => net.slice(net.lastIndexOf("/") + 1);

function terminal(raw: BundleWire["from"] | Harness["wires"][number]["from"]): TerminalView {
  const value = raw as { kind: string; end?: string; cavity?: string; pad?: string; splice?: string; looseEnd?: string };
  if (value.kind === "splice") return { kind: "splice", splice: value.splice ?? "" };
  if (value.kind === "loose") return { kind: "loose", looseEnd: value.looseEnd ?? "" };
  return { kind: "contact", end: value.end ?? "", cavity: value.cavity ?? "", ...(value.pad ? { pad: value.pad } : {}) };
}

/** Which column an end goes in: side A of more links than side B goes left; a tie follows the first link. */
function sideOf(harness: Harness, end: Harness["ends"][number]): "left" | "right" {
  const at = (endpoint: { occurrence: string; connector: string }) =>
    end.site?.occurrence === endpoint.occurrence && end.site.connector === endpoint.connector;
  const asA = harness.links.filter((link) => at(link.a)).length;
  const asB = harness.links.filter((link) => at(link.b)).length;
  if (asA !== asB) return asA > asB ? "left" : "right";
  const first = harness.links[0];
  if (first && at(first.a)) return "left";
  if (first && at(first.b)) return "right";
  return harness.ends.indexOf(end) % 2 === 0 ? "left" : "right";
}

export function buildHarnessView(document: SystemDocument, bundle: SystemBundle | null | undefined, harnessId: string): HarnessView | null {
  const harness = document.harnesses.find((item) => item.id === harnessId);
  if (!harness) return null;
  const built = bundle?.harnesses?.find((item) => item.harness === harnessId);
  const netNames = new Map((bundle?.nets ?? []).map((net) => [net.id, net.name]));
  const labels = new Map(document.occurrences.map((item) => [item.id, item.label]));
  const subPortsById = new Map(document.subPorts.map((item) => [item.id, item]));
  const linksById = new Map(harness.links.map((item) => [item.id, item]));

  const wires: WireView[] = built
    ? built.wires.map((wire) => {
        const own = harness.wires.find((item) => item.id === wire.id);
        return {
          id: wire.id,
          origin: wire.origin,
          ...(wire.link ? { link: wire.link } : {}),
          from: terminal(wire.from),
          to: terminal(wire.to),
          ...(wire.gaugeAwg ? { gaugeAwg: wire.gaugeAwg } : {}),
          ...(wire.colour ? { colour: wire.colour } : {}),
          ...(wire.label ? { label: wire.label } : {}),
          ...(own?.lengthNm !== undefined ? { lengthNm: own.lengthNm } : {}),
          ...(wire.cable ? { cable: wire.cable } : {}),
          ...(wire.conductor ? { conductor: wire.conductor } : {}),
          ...(wire.net ? { net: wire.net, netName: netNames.get(wire.net) } : {}),
          suggested: wire.suggested,
        };
      })
    : harness.wires.map((wire) => ({
        id: wire.id,
        origin: "explicit" as const,
        ...(wire.link ? { link: wire.link } : {}),
        from: terminal(wire.from),
        to: terminal(wire.to),
        ...(wire.gaugeAwg ? { gaugeAwg: wire.gaugeAwg } : {}),
        ...(wire.colour ? { colour: wire.colour } : {}),
        ...(wire.label ? { label: wire.label } : {}),
        ...(wire.lengthNm !== undefined ? { lengthNm: wire.lengthNm } : {}),
        suggested: false,
      }));

  // Cavities wires reach, per end.
  const reached = new Map<string, Set<string>>();
  for (const wire of wires) {
    for (const end of [wire.from, wire.to]) {
      if (end.kind !== "contact") continue;
      const set = reached.get(end.end) ?? new Set<string>();
      set.add(end.cavity);
      reached.set(end.end, set);
    }
  }

  const ends: EndView[] = harness.ends.map((end) => {
    const site = end.site;
    const pinMap = end.pinMap.map((pair) => ({ cavity: pair.cavity, pad: pair.pad }));
    const cavityOf = (pad: string) => pinMap.find((pair) => pair.pad === pad)?.cavity ?? pad;
    const base = {
      id: end.id,
      side: sideOf(harness, end),
      ...(end.housing ? { housing: end.housing } : {}),
      contacts: { ...end.contacts },
      pinMap,
    };
    if (!site) {
      return { ...base, title: end.id, subtitle: "not attached", attached: false, pins: [] };
    }
    const connector = bundle?.occurrences
      .find((item) => item.occurrence === site.occurrence)
      ?.connectors.find((item) => item.refdes === site.connector);
    const resolved = built?.ends.find((item) => item.end === end.id);
    const groups = new Map<string, string>();
    for (const link of harness.links) {
      for (const endpoint of [link.a, link.b]) {
        if (endpoint.occurrence !== site.occurrence || endpoint.connector !== site.connector) continue;
        if (endpoint.subPort?.kind !== "occurrence") continue;
        const subPortId = endpoint.subPort.id;
        const subPort = subPortsById.get(subPortId);
        for (const pad of subPort?.pins ?? []) if (!groups.has(pad)) groups.set(pad, subPort!.name);
      }
    }
    const open = new Set<string>();
    for (const out of bundle?.links ?? []) {
      if (out.harness !== harness.id) continue;
      const link = linksById.get(out.link);
      if (!link) continue;
      if (link.a.occurrence === site.occurrence && link.a.connector === site.connector) out.unmappedA.forEach((pad) => open.add(pad));
      if (link.b.occurrence === site.occurrence && link.b.connector === site.connector) out.unmappedB.forEach((pad) => open.add(pad));
    }
    const wiredCavities = reached.get(end.id) ?? new Set<string>();
    const netByPad = new Map((resolved?.cavities ?? []).map((cavity) => [cavity.pad, cavity.net]));
    const pins: PinRow[] = [...(connector?.pins ?? [])]
      .sort((a, b) => naturalCompare(a.pad, b.pad))
      .map((pin) => {
        const cavity = cavityOf(pin.pad);
        const wired = wiredCavities.has(cavity);
        const net = netByPad.get(pin.pad);
        return {
          pad: pin.pad,
          cavity,
          name: pin.net ? leaf(pin.net) : pin.pinName ?? "",
          ...(net ? { net } : {}),
          power: pin.power,
          ...(groups.has(pin.pad) ? { group: groups.get(pin.pad) } : {}),
          open: open.has(pin.pad) && !wired,
          wired,
        };
      });
    const label = labels.get(site.occurrence) ?? site.occurrence;
    return {
      ...base,
      title: `${site.connector} · ${label}`,
      subtitle: connector?.value ? `${connector.value}${connector.mpn ? ` · ${connector.mpn}` : ""}` : "connector",
      attached: true,
      occurrence: site.occurrence,
      connector: site.connector,
      ...(connector?.mpn ? { mpn: connector.mpn } : {}),
      ...(resolved?.housing ? { housingResolved: resolved.housing } : {}),
      pins,
    };
  });

  const findings = (bundle?.findings ?? []).filter((finding) => finding.objects.includes(harness.id));
  return {
    id: harness.id,
    label: harness.label,
    harness,
    ends,
    wires,
    splices: harness.splices,
    looseEnds: harness.looseEnds,
    branchPoints: harness.branchPoints,
    segments: harness.segments,
    cables: harness.cables,
    coverings: harness.coverings,
    markers: harness.markers,
    findings,
    pending: !built,
  };
}
