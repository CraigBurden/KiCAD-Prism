import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * A System Builder v2 system bundle (`prism.system_bundle.a0`, ADR System
 * Builder v2 §3.3): what a `prism.system.v2` document means over its boards'
 * design bundles. `prism-kicad system build` writes it; it is a pure function
 * of the document and the members, so the same inputs give the same bytes.
 * Stage 1b holds connectivity only: occurrences, system nets, B2B mappings,
 * harness wiring, sub-port suggestions and findings. The rules are in
 * `docs/system-builder/CONTRACTS.md` §8–§9.
 *
 * Unfrozen until System Builder v2's stage 5, like the document.
 */
namespace Prism.Contracts.SystemBundleA0;

// ----------------------------------------------------------------- scalars

/** Id of an object in the system document (`prism.system.v2`). */
@pattern("^[a-z][a-z0-9_-]{0,63}$")
scalar SystemBundleObjectId extends string;

/** A system net's id: `net-` and 16 lowercase hexadecimal digits. */
@pattern("^net-[0-9a-f]{16}$")
scalar SystemBundleNetId extends string;

// ------------------------------------------------------------------- enums

/** What the build knew about an occurrence. */
enum SystemBundleOccurrenceState {
  /** Its design bundle was read. */
  ready,

  /** Its design bundle is not built yet. */
  pending,

  /** Its project is not present at its commit. */
  absent,

  /** A published entry or body: read from its stage on. */
  unsupported,

  /**
   * Only in an API read: the reader cannot see its project, so its keys and
   * connectors are withheld. A stored bundle never holds this state.
   */
  redacted,
}

/** Where a B2B mapping came from. */
enum SystemBundleMateSource {
  /** Derived from both connectors' pads in the mated pose. */
  geometry,

  /** The document's manual override. */
  manual,

  /** Neither: no mapping. */
  unresolved,
}

/** Which rule wired a pin pair of a harness link. */
enum SystemBundleWireRule {
  /** An explicit wire of the document. */
  explicit,

  /** Two equal-size sub-ports, in order. */
  subPortOrder: "sub-port-order",

  /** Equal board net names. */
  netName: "net-name",
}

/** Where a sub-port suggestion came from. */
enum SystemBundleSuggestionSource {
  /** A KiCad bus alias's members. */
  busAlias: "bus-alias",

  /** One hierarchical sheet's nets. */
  sheet,

  /** A net-name family such as `CAN_H`/`CAN_L`. */
  family,

  /** Power and ground pins. */
  power,
}

/** A finding's fixed severity: errors block publishing an in-house entry unless waived. */
enum SystemBundleSeverity {
  /** Blocks publishing an in-house entry unless waived. */
  error,

  /** Never blocks. */
  warning,

  /** Never blocks; for information. */
  info,
}

// -------------------------------------------------------------- occurrences

/** One pin of a connector, as the board's design bundle has it. */
model SystemBundlePin {
  /** The pad number. */
  pad: PadNumber;

  /** The pin's first schematic net; absent when it has none. */
  net?: NetName;

  /** Every schematic net the pin carries, in code point order. */
  nets: NetName[];

  /** The pin's first name; absent when it has none. */
  pinName?: string;

  /** The pin's first electrical type; absent when unknown. */
  pinType?: string;

  /** Whether the pin is on a power net. */
  power: boolean;
}

/** One connector of a board occurrence. */
model SystemBundleConnector {
  /** The reference designator. */
  refdes: Refdes;

  /** The component's value. */
  value: string;

  /** The manufacturer part number; absent when unknown. */
  mpn?: string;

  /** Whether connector detection marks it a connector. */
  candidate: boolean;

  /** Pins in natural order of their pad. */
  pins: SystemBundlePin[];
}

/** One occurrence of the document. */
model SystemBundleOccurrence {
  /** The occurrence's id. */
  occurrence: SystemBundleObjectId;

  /** What the build knew about it. */
  state: SystemBundleOccurrenceState;

  /** The revision key it was read at; absent unless `ready`. */
  revisionKey?: Sha256Hex;

  /** The design bundle read; absent unless `ready`. */
  bundleKey?: Sha256Hex;

  /** Connectors in natural order of their reference; empty unless `ready`. */
  connectors: SystemBundleConnector[];
}

// --------------------------------------------------------------------- nets

/** A connector pin of the system. */
model SystemBundlePinRef {
  /** The occurrence. */
  occurrence: SystemBundleObjectId;

  /** The connector's reference designator. */
  connector: Refdes;

  /** The pad number. */
  pad: PadNumber;
}

/** A board net that is part of a system net. */
model SystemBundleBoardNet {
  /** The occurrence. */
  occurrence: SystemBundleObjectId;

  /** The board's net name. */
  net: NetName;
}

/** One system net: board nets joined through the system's connections. */
model SystemBundleNet {
  /** The net's id: stable while its pins are. */
  id: SystemBundleNetId;

  /** The display name: the most common non-automatic board net name. */
  name: NetName;

  /** Every distinct board net name, in code point order. */
  names: NetName[];

  /** Board nets, sorted by `occurrence` then `net`, in code point order. */
  boardNets: SystemBundleBoardNet[];

  /** Pins, sorted by `occurrence` and `connector` in code point order, then `pad` in natural order. */
  pins: SystemBundlePinRef[];
}

// ------------------------------------------------------------------- mates

/** One pin pair of a B2B mapping. */
model SystemBundlePadPair {
  /** The pad on side A. */
  a: PadNumber;

  /** The pad on side B. */
  b: PadNumber;
}

/** One B2B mate's mapping. */
model SystemBundleMate {
  /** The document mate's id. */
  mate: SystemBundleObjectId;

  /** Where the mapping came from. */
  source: SystemBundleMateSource;

  /** Pin pairs, sorted by `a` in natural order. */
  pairs: SystemBundlePadPair[];

  /** Side A pads without a partner, in natural order. */
  unmappedA: PadNumber[];

  /** Side B pads without a partner, in natural order. */
  unmappedB: PadNumber[];
}

// ------------------------------------------------------------------- links

/** One wire of a harness link's wiring. */
model SystemBundleWire {
  /** The pad on side A. */
  a: PadNumber;

  /** The pad on side B. */
  b: PadNumber;

  /** The rule that wired it. */
  rule: SystemBundleWireRule;

  /** Whether it joins power or ground pins, shown as suggested until confirmed. */
  suggested: boolean;
}

/** One harness link's wiring. */
model SystemBundleLink {
  /** The harness block. */
  harness: SystemBundleObjectId;

  /** The document link's id. */
  link: SystemBundleObjectId;

  /** Wires, sorted by `a` in natural order. */
  wires: SystemBundleWire[];

  /** Side A pins left unmapped, in natural order. */
  unmappedA: PadNumber[];

  /** Side B pins left unmapped, in natural order. */
  unmappedB: PadNumber[];
}

/** A pin of one mating site that two links wire: a proposed splice. */
model SystemBundleSplice {
  /** The harness block. */
  harness: SystemBundleObjectId;

  /** The end. */
  end: SystemBundleObjectId;

  /** The pad. */
  pad: PadNumber;

  /** The links that wire it, in code point order. */
  links: SystemBundleObjectId[];
}

// ------------------------------------------------------------- suggestions

/** A sub-port suggestion read from a board's design bundle. */
model SystemBundleSuggestion {
  /** The occurrence. */
  occurrence: SystemBundleObjectId;

  /** The connector's reference designator. */
  connector: Refdes;

  /** The stable key a sub-port or dismissal names. */
  @minLength(1)
  key: string;

  /** The suggested name. */
  @minLength(1)
  name: string;

  /** Where it came from. */
  source: SystemBundleSuggestionSource;

  /** Pads in natural order, at least two. */
  @minItems(2)
  pins: PadNumber[];
}

// ---------------------------------------------------------------- findings

/** One finding (`docs/system-builder/CONTRACTS.md` §9). */
model SystemBundleFinding {
  /** The finding's code. */
  code: DiagnosticCode;

  /** Its fixed severity. */
  severity: SystemBundleSeverity;

  /** The stable subject key a waiver names, for example `mate:mate_x`. */
  @minLength(1)
  subject: string;

  /** One sentence for people. */
  @minLength(1)
  message: string;

  /** Document object ids involved, in code point order. */
  objects: SystemBundleObjectId[];

  /** Whether a waiver of the document covers it. */
  waived: boolean;
}

// -------------------------------------------------------------------- root

/** A system bundle. */
@jsonSchema
@id("urn:prism:schema:prism.system_bundle:a0")
@extension("title", "System bundle a0")
model SystemBundleA0 {
  /** Schema id. */
  schema: "prism.system_bundle.a0";

  /** SHA-256 of the document's canonical JSON. */
  documentSha256: Sha256Hex;

  /** Occurrences, sorted by `occurrence` in code point order. */
  occurrences: SystemBundleOccurrence[];

  /** System nets, sorted by `id` in code point order. */
  nets: SystemBundleNet[];

  /** B2B mappings, sorted by `mate` in code point order. */
  mates: SystemBundleMate[];

  /** Harness link wirings, sorted by `harness` then `link`, in code point order. */
  links: SystemBundleLink[];

  /** Proposed splices, sorted by `harness`, `end` then `pad` (natural order). */
  splices: SystemBundleSplice[];

  /** Sub-port suggestions, sorted by `occurrence`, `connector` then `key`, in code point order. */
  suggestions: SystemBundleSuggestion[];

  /** Findings, sorted by `code` then `subject`, in code point order. */
  findings: SystemBundleFinding[];
}
