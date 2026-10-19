import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * The System Builder v2 document (`prism.system.v2`, ADR System Builder v2
 * §3.1): one versioned JSON document per system, holding only what the user
 * decided. It stores no copy of board data; everything about a board is read
 * from the occurrence's design bundle by revision key, and whether a
 * referenced connector or pin still exists is a system-bundle finding, never
 * a document error. The rules the schema cannot state are in
 * `docs/system-builder/CONTRACTS.md` §1–§2.
 *
 * Unlike a bundle member, this document is edited by people. It is unfrozen
 * until System Builder v2's stage 5: stages 2–4 may change it, each change
 * with a forward migration of stored documents.
 */
namespace Prism.Contracts.SystemV2;

// ----------------------------------------------------------------- scalars

/**
 * Id of an object in a system document: unique across the whole document and
 * never reused, even after the object is removed. Chosen by the caller or
 * assigned by the server as `<prefix>_<10 base32>`.
 */
@pattern("^[a-z][a-z0-9_-]{0,63}$")
scalar SystemObjectId extends string;

/** Prism project id: `prj_` and 12 lowercase hexadecimal digits. */
@pattern("^prj_[0-9a-f]{12}$")
scalar SystemProjectId extends string;

/** Prism catalog component or revision id, as the catalog issues it. */
@pattern("^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")
scalar SystemCatalogId extends string;

/** A Git branch name as the repository spells it, without `refs/heads/`. */
@minLength(1)
@maxLength(255)
scalar SystemBranchName extends string;

/** A human-readable name or label: 1 to 200 characters. */
@minLength(1)
@maxLength(200)
scalar SystemLabel extends string;

/** A free-text description: up to 4000 characters. */
@maxLength(4000)
scalar SystemDescription extends string;

/** A wire gauge in AWG as people write it: `24`, `0`, `00`, `4/0`. */
@pattern("^[0-9]{1,2}(?:/0)?$")
scalar SystemGaugeAwg extends string;

// ------------------------------------------------------------------- enums

/** How a splice joins its wires. */
enum SystemSpliceMethod {
  /** A crimped splice sleeve. */
  crimp,

  /** A soldered joint. */
  solder,
}

/** What a covering on a harness segment is. */
enum SystemCoveringKind {
  /** A braided or woven sleeve. */
  sleeve,

  /** Heat-shrink tubing. */
  heatShrink: "heat-shrink",

  /** Tape wrap. */
  tape,

  /** Zip ties or lacing. */
  zipTies: "zip-ties",
}

/** What an open harness end is for. */
enum SystemLooseEndKind {
  /** A pigtail left for a later termination. */
  pigtail,

  /** A test point. */
  testPoint: "test-point",

  /** Left open, insulated. */
  open,
}

/** What a marker on a wire is. */
enum SystemMarkerKind {
  /** A printed wire label. */
  label,

  /** A heat-shrink marker sleeve. */
  heatShrinkMarker: "heat-shrink-marker",
}

// --------------------------------------------------------------- geometry

/** A point or translation in system space, in nanometres; +z up, right-handed. */
model SystemVectorNm {
  /** X in nanometres. */
  xNm: Nanometres;

  /** Y in nanometres. */
  yNm: Nanometres;

  /** Z in nanometres, +z up. */
  zNm: Nanometres;
}

/** A unit quaternion; normalized when written. */
model SystemQuaternion {
  /** The x component. */
  x: float64;

  /** The y component. */
  y: float64;

  /** The z component. */
  z: float64;

  /** The scalar component. */
  w: float64;
}

/** A rigid transform: rotation, then translation. */
model SystemPose {
  /** The translation in nanometres. */
  translation: SystemVectorNm;

  /** The rotation. */
  rotation: SystemQuaternion;
}

// ------------------------------------------------------------- references

/** A catalog part, by component and optionally revision. */
model SystemPartRef {
  /** The catalog component id. */
  componentId: SystemCatalogId;

  /** The revision; absent means the latest released revision. */
  revisionId?: SystemCatalogId;
}

/** A sub-port stored in this document. */
model SystemOccurrenceSubPortRef {
  /** Discriminator. */
  kind: "occurrence";

  /** The sub-port's id in `subPorts`. */
  id: SystemObjectId;
}

/** A board-level sub-port, stored against the project and connector. */
model SystemBoardSubPortRef {
  /** Discriminator. */
  kind: "board";

  /** The board-level sub-port's id. */
  id: SystemObjectId;

  /**
   * The definition's version the user last saw. The live definition is always
   * used; a newer one with different pins is a `board-sub-port-changed`
   * finding until `acknowledge-sub-port` (CONTRACTS.md §10.5).
   */
  @minValue(1)
  version: int32;
}

/** Which sub-port of a connector an endpoint names. */
@oneOf
union SystemSubPortRef {
  /** One of this document's sub-ports. */
  occurrence: SystemOccurrenceSubPortRef,

  /** A board-level sub-port. */
  board: SystemBoardSubPortRef,
}

/**
 * A connector, or a sub-port of one, on one occurrence: the thing every
 * connection names.
 */
model SystemEndpoint {
  /** The occurrence's id. */
  occurrence: SystemObjectId;

  /** The connector's reference designator on that board, or a body connector's `refdes`. */
  connector: Refdes;

  /** The sub-port; absent means the whole connector. */
  subPort?: SystemSubPortRef;
}

/** A connector on one occurrence, never a sub-port: a mating site. */
model SystemSite {
  /** The occurrence's id. */
  occurrence: SystemObjectId;

  /** The connector's reference designator, or a body connector's `refdes`. */
  connector: Refdes;
}

// ------------------------------------------------------------------ sheets

/** A hierarchical sheet of the system schematic. */
model SystemSheet {
  /** The sheet's id. */
  id: SystemObjectId;

  /** The sheet's name, shown in the breadcrumb. */
  name: SystemLabel;

  /** The parent sheet's id; absent means the root sheet. */
  parent?: SystemObjectId;
}

// ------------------------------------------------------------- occurrences

/** A board at a pinned commit, which never changes on its own. */
model SystemPinnedTrack {
  /** Discriminator. */
  kind: "pinned";

  /** The commit. */
  commit: GitObjectId;
}

/** A board that follows a branch, advanced by `advance-occurrence`. */
model SystemFollowedTrack {
  /** Discriminator. */
  kind: "followed";

  /** The branch followed. */
  branch: SystemBranchName;

  /** The commit the occurrence is at now. */
  commit: GitObjectId;

  /** The commit whose changes the user last acknowledged; absent means never acknowledged. */
  reviewedCommit?: GitObjectId;
}

/** How a board occurrence tracks its project's revisions. */
@oneOf
union SystemTrack {
  /** Pinned at a commit. */
  pinned: SystemPinnedTrack,

  /** Following a branch. */
  followed: SystemFollowedTrack,
}

/** A KiCad project, read from its design bundle. */
model SystemBoardSource {
  /** Discriminator. */
  kind: "board";

  /** The Prism project id. */
  projectId: SystemProjectId;

  /** The revision it is at. */
  track: SystemTrack;
}

/** A published system from the catalog. */
model SystemEntrySource {
  /** Discriminator. */
  kind: "entry";

  /** The catalog component id of the published system. */
  componentId: SystemCatalogId;

  /** The published revision. */
  revisionId: SystemCatalogId;
}

/** A mechanical catalog part: an enclosure, a bracket, a module's body. */
model SystemBodySource {
  /** Discriminator. */
  kind: "body";

  /** The catalog component id. */
  componentId: SystemCatalogId;

  /** The revision. */
  revisionId: SystemCatalogId;
}

/** What an occurrence places. */
@oneOf
union SystemOccurrenceSource {
  /** A board. */
  board: SystemBoardSource,

  /** A published entry. */
  entry: SystemEntrySource,

  /** A body. */
  body: SystemBodySource,
}

/** One placed board, published entry or body. */
model SystemOccurrence {
  /** The occurrence's id. */
  id: SystemObjectId;

  /** The label shown on its symbol and in 3D. */
  label: SystemLabel;

  /** The sheet it is drawn on; absent means the root sheet. */
  sheet?: SystemObjectId;

  /** What it places. */
  source: SystemOccurrenceSource;

  /** The stored pose of a free occurrence; absent for a mated one, whose pose is derived. */
  pose?: SystemPose;

  /** The mate that positions it, overriding the automatic choice; absent means automatic. */
  positioningMate?: SystemObjectId;
}

// --------------------------------------------------------------- sub-ports

/** An occurrence-level sub-port: a named, ordered set of a connector's pins. */
model SystemSubPort {
  /** The sub-port's id. */
  id: SystemObjectId;

  /** The occurrence. */
  occurrence: SystemObjectId;

  /** The connector's reference designator. */
  connector: Refdes;

  /** The sub-port's name. */
  name: SystemLabel;

  /** Pad numbers in the user's order: as selected, or as the suggestion listed them. */
  @minItems(1)
  pins: PadNumber[];

  /** The bundle suggestion key it was accepted from; absent when made by hand. */
  suggestion?: SystemLabel;

  /** The board-level sub-port it was promoted to; absent when not promoted. */
  promotedTo?: SystemObjectId;
}

/** A bundle sub-port suggestion the user dismissed. */
model SystemDismissedSuggestion {
  /** The occurrence. */
  occurrence: SystemObjectId;

  /** The connector's reference designator. */
  connector: Refdes;

  /** The suggestion key. */
  key: SystemLabel;
}

// --------------------------------------------------------- body connectors

/** A connector part placed on a body occurrence's face (board-less systems). */
model SystemBodyConnector {
  /** The body connector's id. */
  id: SystemObjectId;

  /** The body occurrence. */
  occurrence: SystemObjectId;

  /** The designator endpoints name as `connector`; unique on its occurrence. */
  refdes: Refdes;

  /** The connector part. */
  part: SystemPartRef;

  /** The part's mating frame in the body's frame. */
  frame: SystemPose;

  /** Quarter turns about the frame's z axis. */
  @minValue(0)
  @maxValue(3)
  quarterTurns: int32;
}

// ------------------------------------------------------------------- mates

/** How the two connectors of a B2B mate face each other. */
model SystemMateOrientation {
  /** Quarter turns of B about the mating axis: `k` of the mate transform. */
  @minValue(0)
  @maxValue(3)
  quarterTurns: int32;

  /** Whether B mates on its frame flipped over its x axis, for a connector reached through the board. */
  flip: boolean;
}

/** One pin pair of a manual mate mapping. */
model SystemMatePair {
  /** The pad on side A. */
  a: PadNumber;

  /** The pad on side B. */
  b: PadNumber;
}

/** The user's labels on one row of a mate's mapping. */
model SystemMateRow {
  /** A net name shown for the row; absent means none. */
  netLabel?: SystemLabel;

  /** A signal label; absent means none. */
  signal?: SystemLabel;
}

/** A board-to-board mate between two connectors. */
model SystemMate {
  /** The mate's id. */
  id: SystemObjectId;

  /** Side A. */
  a: SystemSite;

  /** Side B. */
  b: SystemSite;

  /** The orientation; changing it re-derives the mapping. */
  orientation: SystemMateOrientation;

  /** The stack height; absent means the mate maths' clearance fallback. */
  stackHeightNm?: NonNegativeNanometres;

  /** A pose applied after the mate transform (spacers, a tilted fit); absent means none. */
  offset?: SystemPose;

  /** A manual mapping that replaces the derived one, always flagged; absent means derived. Sorted by `a` in natural order. */
  manualMap?: SystemMatePair[];

  /** Row labels; the keys are pad numbers on side A. */
  rows: Record<SystemMateRow>;
}

// --------------------------------------------------------------- harnesses

/** A harness end: one mating site. */
model SystemHarnessEnd {
  /** The end's id. */
  id: SystemObjectId;

  /** The connector it mates; absent on an end not attached yet. */
  site?: SystemSite;

  /** The housing part; absent until chosen. */
  housing?: SystemPartRef;

  /** Contact parts; the keys are housing cavity numbers. */
  contacts: Record<SystemPartRef>;

  /** Cavity-to-pad pairs where they differ; empty means cavity n is pad n. Sorted by `cavity` in natural order. */
  pinMap: SystemHarnessCavityPad[];

  /** The straight exit length; absent means the harness default. */
  bootLengthNm?: NonNegativeNanometres;
}

/** A housing cavity and the board pad it lands on. */
model SystemHarnessCavityPad {
  /** The cavity. */
  cavity: PadNumber;

  /** The board pad. */
  pad: PadNumber;
}

/** A schematic harness wire between two endpoints; its wiring is derived. */
model SystemHarnessLink {
  /** The link's id. */
  id: SystemObjectId;

  /** Side A; its connector is an end's site in this harness. */
  a: SystemEndpoint;

  /** Side B; its connector is an end's site in this harness. */
  b: SystemEndpoint;

  /** Pads on side A cleared from the default wiring, sorted in natural order. */
  unmapped: PadNumber[];
}

/** A wire terminating on an end's cavity. */
model SystemContactTerminal {
  /** Discriminator. */
  kind: "contact";

  /** The end. */
  end: SystemObjectId;

  /** The cavity. */
  cavity: PadNumber;
}

/** A wire terminating on a splice. */
model SystemSpliceTerminal {
  /** Discriminator. */
  kind: "splice";

  /** The splice. */
  splice: SystemObjectId;
}

/** A wire terminating on a loose end. */
model SystemLooseTerminal {
  /** Discriminator. */
  kind: "loose";

  /** The loose end. */
  looseEnd: SystemObjectId;
}

/** Where one end of a wire terminates. */
@oneOf
union SystemWireTerminal {
  /** An end's cavity. */
  contact: SystemContactTerminal,

  /** A splice. */
  splice: SystemSpliceTerminal,

  /** A loose end. */
  loose: SystemLooseTerminal,
}

/** An explicit wire. */
model SystemHarnessWire {
  /** The wire's id. */
  id: SystemObjectId;

  /** One terminal. */
  from: SystemWireTerminal;

  /** The other terminal. */
  to: SystemWireTerminal;

  /** The link whose default wire for this pin it replaces; absent for a free-standing wire. */
  link?: SystemObjectId;

  /** The gauge; absent means unknown. */
  gaugeAwg?: SystemGaugeAwg;

  /** The insulation colour; absent means unknown. */
  colour?: SystemLabel;

  /** The cut length; absent means derived from the route. */
  lengthNm?: NonNegativeNanometres;

  /** The wire's label; absent means none. */
  label?: SystemLabel;

  /** Segment ids from `from` to `to`, in route order; empty means derived. */
  route: SystemObjectId[];
}

/** A splice joining several wires. */
model SystemHarnessSplice {
  /** The splice's id. */
  id: SystemObjectId;

  /** How it is made. */
  method: SystemSpliceMethod;

  /** Whether the user confirmed a proposed splice. */
  confirmed: boolean;
}

/** Where the bundle physically divides; not an electrical join. */
model SystemHarnessBranchPoint {
  /** The branch point's id. */
  id: SystemObjectId;

  /** Its pinned position; absent means derived from the topology. */
  position?: SystemVectorNm;
}

/** A segment node at an end. */
model SystemEndNode {
  /** Discriminator. */
  kind: "end";

  /** The end. */
  end: SystemObjectId;
}

/** A segment node at a branch point. */
model SystemBranchPointNode {
  /** Discriminator. */
  kind: "branch-point";

  /** The branch point. */
  branchPoint: SystemObjectId;
}

/** One end of a harness segment. */
@oneOf
union SystemHarnessNode {
  /** An end. */
  end: SystemEndNode,

  /** A branch point. */
  branchPoint: SystemBranchPointNode,
}

/** A physical segment of the bundle between two nodes. */
model SystemHarnessSegment {
  /** The segment's id. */
  id: SystemObjectId;

  /** One node. */
  from: SystemHarnessNode;

  /** The other node. */
  to: SystemHarnessNode;
}

/** A covering on part or all of a segment. */
model SystemHarnessCovering {
  /** The covering's id. */
  id: SystemObjectId;

  /** The segment. */
  segment: SystemObjectId;

  /** What it is. */
  kind: SystemCoveringKind;

  /** The catalog part; absent until chosen. */
  part?: SystemPartRef;

  /** Distance from the segment's `from` node where it starts; absent means at the node. */
  startNm?: NonNegativeNanometres;

  /** Distance from the segment's `from` node where it ends; absent means at the `to` node. */
  endNm?: NonNegativeNanometres;
}

/** One conductor of a cable. */
model SystemCableConductor {
  /** The conductor's name in the cable's datasheet. */
  name: SystemLabel;

  /** The wire it carries; absent when unused. */
  wire?: SystemObjectId;

  /** Whether it is a shield drain. */
  drain: boolean;
}

/** A jacketed multi-conductor cable. */
model SystemHarnessCable {
  /** The cable's id. */
  id: SystemObjectId;

  /** The catalog part; absent until chosen. */
  part?: SystemPartRef;

  /** The cable's label; absent means none. */
  label?: SystemLabel;

  /** Conductors in the cable's own order. */
  conductors: SystemCableConductor[];
}

/** A harness end left open. */
model SystemHarnessLooseEnd {
  /** The loose end's id. */
  id: SystemObjectId;

  /** What it is for. */
  kind: SystemLooseEndKind;

  /** The pigtail length; absent means unknown. */
  lengthNm?: NonNegativeNanometres;

  /** Its label; absent means none. */
  label?: SystemLabel;
}

/** A label or marker along a wire. */
model SystemHarnessMarker {
  /** The marker's id. */
  id: SystemObjectId;

  /** The wire. */
  wire: SystemObjectId;

  /** What it is. */
  kind: SystemMarkerKind;

  /** The printed text. */
  text: SystemLabel;

  /** Distance from the wire's `from` terminal; absent means the default position. */
  atNm?: NonNegativeNanometres;
}

/** A waypoint the user pinned on a segment. */
model SystemHarnessWaypoint {
  /** The waypoint's id. */
  id: SystemObjectId;

  /** The segment. */
  segment: SystemObjectId;

  /** Its position in system space. */
  position: SystemVectorNm;

  /** Its place along the segment, from the `from` node: lower comes first. */
  @minValue(0)
  order: int32;
}

/** A harness block and everything in it. */
model SystemHarness {
  /** The harness's id. */
  id: SystemObjectId;

  /** The label, for example `H1`. */
  label: SystemLabel;

  /** The sheet its block is drawn on; absent means the root sheet. */
  sheet?: SystemObjectId;

  /** Ends, sorted by `id` in code point order. */
  ends: SystemHarnessEnd[];

  /** Links, sorted by `id` in code point order. */
  links: SystemHarnessLink[];

  /** Wires, sorted by `id` in code point order. */
  wires: SystemHarnessWire[];

  /** Splices, sorted by `id` in code point order. */
  splices: SystemHarnessSplice[];

  /** Branch points, sorted by `id` in code point order. */
  branchPoints: SystemHarnessBranchPoint[];

  /** Segments, sorted by `id` in code point order. */
  segments: SystemHarnessSegment[];

  /** Coverings, sorted by `id` in code point order. */
  coverings: SystemHarnessCovering[];

  /** Cables, sorted by `id` in code point order. */
  cables: SystemHarnessCable[];

  /** Loose ends, sorted by `id` in code point order. */
  looseEnds: SystemHarnessLooseEnd[];

  /** Markers, sorted by `id` in code point order. */
  markers: SystemHarnessMarker[];

  /** Waypoints, sorted by `id` in code point order. */
  waypoints: SystemHarnessWaypoint[];
}

// --------------------------------------------------------- exports, waivers

/** A connector or sub-port that is part of the system's interface. */
model SystemExport {
  /** The export's id. */
  id: SystemObjectId;

  /** The name in the published interface. */
  name: SystemLabel;

  /** The connector or sub-port exported. */
  site: SystemEndpoint;

  /** Interface pin names; the keys are pad numbers. */
  pinNames: Record<SystemLabel>;
}

/** A waived finding. */
model SystemWaiver {
  /** The waiver's id. */
  id: SystemObjectId;

  /** The finding code. */
  code: DiagnosticCode;

  /** The finding's subject key. */
  @minLength(1)
  subject: string;

  /** Why it is waived. */
  @minLength(1)
  reason: string;
}

// ------------------------------------------------------------------ layout

/** Where an object's symbol sits in the schematic; presentation only. */
model SystemSchematicPlacement {
  /** The sheet; absent means the root sheet. */
  sheet?: SystemObjectId;

  /** X in nanometres on the sheet, +x right. */
  xNm: Nanometres;

  /** Y in nanometres on the sheet, +y down. */
  yNm: Nanometres;

  /** Rotation in degrees, counter-clockwise. */
  rotationDeg: Degrees;

  /** Whether the symbol is mirrored. */
  mirror: boolean;
}

// -------------------------------------------------------------------- root

/** A System Builder v2 system. */
@jsonSchema
@id("urn:prism:schema:prism.system:v2")
@extension("title", "System v2")
model SystemV2 {
  /** Schema id. */
  schema: "prism.system.v2";

  /** The system's name. */
  name: SystemLabel;

  /** A description; absent means none. */
  description?: SystemDescription;

  /** Sheets, sorted by `id` in code point order. */
  sheets: SystemSheet[];

  /** Occurrences, sorted by `id` in code point order. */
  occurrences: SystemOccurrence[];

  /** Occurrence-level sub-ports, sorted by `id` in code point order. */
  subPorts: SystemSubPort[];

  /** Dismissed suggestions, sorted by `occurrence`, then `connector`, then `key`, each in code point order. */
  dismissedSuggestions: SystemDismissedSuggestion[];

  /** Body connectors, sorted by `id` in code point order. */
  bodyConnectors: SystemBodyConnector[];

  /** B2B mates, sorted by `id` in code point order. */
  mates: SystemMate[];

  /** Harness blocks, sorted by `id` in code point order. */
  harnesses: SystemHarness[];

  /** Exports, sorted by `id` in code point order. */
  exports: SystemExport[];

  /** Waivers, sorted by `id` in code point order. */
  waivers: SystemWaiver[];

  /** Schematic placements; the keys are object ids. */
  layout: Record<SystemSchematicPlacement>;
}
