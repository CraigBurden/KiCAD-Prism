import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * A System Builder v2 system bundle (`prism.system_bundle.a0`, ADR System
 * Builder v2 §3.3): what a `prism.system.v2` document means over its boards'
 * design bundles. `prism-kicad system build` writes it; it is a pure function
 * of the document and the members, so the same inputs give the same bytes.
 * Stage 1b holds connectivity: occurrences, system nets, B2B mappings,
 * harness wiring, sub-port suggestions and findings; stage 3a adds placement. The rules are in
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

/** The side of the board a component sits on. */
enum SystemBundleBoardSide {
  /** The board's top (front) side. */
  top,

  /** The board's bottom (back) side. */
  bottom,
}

/** Where a connector sits on its board, for the schematic's default pin placement. */
model SystemBundleConnectorPlacement {
  /** Angle from the outline's centre to the component, counter-clockwise from +x with +y up, in [0, 360). */
  angleDeg: Degrees;

  /** The side it is mounted on. */
  side: SystemBundleBoardSide;
}

/** A board's outline bounding box. */
model SystemBundleOutline {
  /** Width in nanometres. */
  widthNm: NonNegativeNanometres;

  /** Height in nanometres. */
  heightNm: NonNegativeNanometres;
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

  /** Where it sits on the board; absent when the board has no outline. */
  placement?: SystemBundleConnectorPlacement;

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

  /** The board outline's bounding box; absent unless `ready` with an Edge.Cuts outline. */
  outline?: SystemBundleOutline;

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

/** One pad of a mate drawn in side A's connector frame (stage 3c). */
model SystemBundleMatePad {
  /** The pad number. */
  pad: PadNumber;

  /** The centre's x in A's connector frame. */
  xNm: Nanometres;

  /** The centre's y in A's connector frame. */
  yNm: Nanometres;

  /** The pad's long axis, degrees counter-clockwise from A's +x, in [0, 180). */
  angleDeg: Degrees;

  /** The pad's long side. */
  longNm: NonNegativeNanometres;

  /** The pad's short side. */
  shortNm: NonNegativeNanometres;
}

/** Both connectors' pads in the mated pose, seen in side A's connector frame (x, y on the mating face, looking down its mating axis). */
model SystemBundleMatePads {
  /** Side A's named pads, in natural order of their pad; pads sharing a number each appear. */
  a: SystemBundleMatePad[];

  /** Side B's named pads, carried into A's frame by the mate transform, in natural order of their pad. */
  b: SystemBundleMatePad[];
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

  /** Both connectors' pads in the mated pose; absent when the geometry cannot decide it (stage 3c). */
  pads?: SystemBundleMatePads;
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

// --------------------------------------------------------------- placement (3a)

/** Where an occurrence's pose came from (CONTRACTS §8.9). */
enum SystemBundlePoseSource {
  /** Derived through its positioning mate from its group's root. */
  mate,

  /** The document's stored pose (a root, or a free occurrence). */
  stored,

  /** The default row: a free occurrence or root without a stored pose. */
  default: "default",
}

/** Which stack height a mate used. */
enum SystemBundleHeightSource {
  /** The mate's `stackHeightNm`. */
  stackHeight: "stack-height",

  /** The clearance fallback: the two connector bodies apart, plus a margin. */
  clearance,
}

/** A point or offset in the system frame, in nanometres. */
model SystemBundleVectorNm {
  /** X in nanometres. */
  xNm: Nanometres;

  /** Y in nanometres. */
  yNm: Nanometres;

  /** Z in nanometres. */
  zNm: Nanometres;
}

/** A unit quaternion, canonical with `w ≥ 0`. */
model SystemBundleQuaternion {
  /** X. */
  x: float64;

  /** Y. */
  y: float64;

  /** Z. */
  z: float64;

  /** W. */
  w: float64;
}

/** A frame in the system frame: translation, then rotation. */
model SystemBundlePose {
  /** The translation. */
  translation: SystemBundleVectorNm;

  /** The rotation. */
  rotation: SystemBundleQuaternion;
}

/** An axis-aligned box in an occurrence's own frame. */
model SystemBundleBounds {
  /** The minimum corner. */
  min: SystemBundleVectorNm;

  /** The maximum corner. */
  max: SystemBundleVectorNm;
}

/** One occurrence's place in the system. */
model SystemBundlePlacedOccurrence {
  /** The occurrence's id. */
  occurrence: SystemBundleObjectId;

  /** Its board frame in the system frame. */
  pose: SystemBundlePose;

  /** Where the pose came from. */
  source: SystemBundlePoseSource;

  /** The occurrence is its mated group's root, or is not mated. */
  root: boolean;

  /** The mate that placed it, for a mated non-root. */
  positioningMate?: SystemBundleObjectId;

  /** Its board's outline box across its thickness, in its own frame; absent when unknown. */
  bounds?: SystemBundleBounds;
}

/** What one B2B mate means for placement. */
model SystemBundlePlacedMate {
  /** The mate's id. */
  mate: SystemBundleObjectId;

  /** It places one of its occurrences (it is a positioning mate). */
  driving: boolean;

  /** The stack height used; absent when the mate could not be solved. */
  stackHeightNm?: Nanometres;

  /** Where that height came from. */
  heightSource?: SystemBundleHeightSource;

  /** Side A's connector frame in the system frame; absent when unknown. */
  frameA?: SystemBundlePose;

  /** Side B's connector frame in the system frame; absent when unknown. */
  frameB?: SystemBundlePose;

  /** A non-driving mate's miss: B's connector origin minus its mated position, on A's connector axes. */
  miss?: SystemBundleVectorNm;

  /** A non-driving mate's rotation miss, in degrees. */
  missDeg?: Degrees;
}

/** The side of its board a footprint is on. */
enum SystemBundleFootprintSide {
  /** The front face. */
  top,

  /** The back face. */
  bottom,
}

/** One pad of an export's footprint geometry, in millimetres in its frame (+y up). */
model SystemBundleExportPad {
  /** The pad number; empty for a mounting or alignment hole. */
  pad: string;

  /** The pad centre `[x, y]`, in that order. */
  @minItems(2)
  @maxItems(2)
  positionMm: float64[];

  /** The pad size `[x, y]`, in that order. Null when the footprint gives none. */
  sizeMm: float64[] | null;

  /** The pad shape (`circle`, `rect`, …). Null when the footprint gives none. */
  shape: string | null;

  /** Whether the pad is through-hole. Null when the footprint does not say. */
  tht: boolean | null;
}

/** A footprint's courtyard box in its own frame (+y up), in millimetres. */
model SystemBundleExportCourtyard {
  /** The minimum corner `[x, y]`, in that order. */
  minMm: float64[];

  /** The maximum corner `[x, y]`, in that order. */
  maxMm: float64[];
}

/**
 * An export's connector footprint, as the board interface's extractor v6
 * geometry gives it (millimetres, +y up), without its 3D model.
 */
model SystemBundleExportGeometry {
  /** The side of its board the footprint is on. */
  side: SystemBundleFootprintSide;

  /** The footprint anchor `[x, y]`, in that order, in the mount's frame. */
  @minItems(2)
  @maxItems(2)
  positionMm: float64[];

  /** The footprint rotation in degrees. */
  rotationDeg: Degrees;

  /** The footprint name, which the mating-axis inference reads. Null when unknown. */
  footprintName: string | null;

  /** The pads, in the extractor's order. */
  pads: SystemBundleExportPad[];

  /** The footprint's courtyard. Null when the footprint has no courtyard graphic. */
  courtyard: SystemBundleExportCourtyard | null;

  /** Always null: an export's geometry carries no 3D model. */
  `model`: null;
}

/** One export's connector, as a system placing this one as an entry mates by it (stage 3d). */
model SystemBundlePlacedExport {
  /** The export's id. */
  export: SystemBundleObjectId;

  /**
   * The frame `geometry` is in, placed in the system frame with the
   * connector's side of its board applied, so the geometry reads at zero
   * thickness: a board's frame lifted to its surface, a body connector's
   * footprint frame.
   */
  mount: SystemBundlePose;

  /** The connector's footprint geometry in that frame. */
  geometry: SystemBundleExportGeometry;

  /** An unsure mating-axis inference mates out of the top face: a body's connector, or an export of one. */
  matesTop: boolean;
}

/** The system's placement (stage 3a). */
model SystemBundlePlacement {
  /** Every occurrence, sorted by `occurrence` in code point order. */
  occurrences: SystemBundlePlacedOccurrence[];

  /** Every mate, sorted by `mate` in code point order. */
  mates: SystemBundlePlacedMate[];

  /**
   * Every export whose connector has footprint geometry and a place, sorted
   * by `export` in code point order (stage 3d). Absent in bundles built
   * before format 4.
   */
  exports?: SystemBundlePlacedExport[];
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

  /** Where each occurrence sits, and what each mate means for that (stage 3a). */
  placement: SystemBundlePlacement;
}
