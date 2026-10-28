import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * Bundle member `projections/system-interface.json`
 * (`prism.system_interface.v1`), written in stage `parse` by WP-P5: System
 * Builder's board interface. It is a parity document (conventions.md §4,
 * §5, §14): every field keeps the name, unit, rounding and null-versus-absent
 * behaviour of today's artifact, the payload of `EXTRACTOR_VERSION` 8 of
 * `backend/app/services/systems/interface_extractor.py` (`SCHEMA` at `:37`,
 * `EXTRACTOR_VERSION` at `:38`, payload built at `:389-466`), specified in
 * `docs/system-builder/CONTRACTS.md` §2-§4 and `CONTRACTS_P2.md` §8.4 and
 * §14.6. The only change is the envelope: `projectId`, `commit` and
 * `extractor` come from outside the parsed sources, so the bundle member
 * omits them and the System Builder reader (WP-C4) adds them when it serves
 * or stores the artifact. They are outside the `digest`, which is therefore
 * the same in both forms. Field-by-field sources, consumers, the digest
 * algorithm and the expected divergences are in
 * `field-maps/system-interface.md`.
 *
 * Units are today's: lengths are millimetres as IEEE doubles rounded to
 * 1e-4 mm (`_round`, `interface_extractor.py:168-170`: Python
 * `round(v, 4) + 0.0`, correctly rounded from the exact binary value with
 * ties to even, negative zero folded to `0.0`), and positions are in System
 * Builder's board frame (`CONTRACTS_P2.md` §14.2): KiCad x, the negated
 * KiCad y (+y up), origin at the board file's page origin. This frame is not
 * the conventions' y-down frame (conventions.md §7), because a parity
 * document keeps today's frame.
 */
namespace Prism.Contracts.SystemInterfaceV1;

// ------------------------------------------------------------------ scalars

/**
 * Interface digest: `sha256:` followed by 64 lowercase hex digits. SHA-256
 * over the UTF-8 bytes of Python's
 * `json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`,
 * where `body` is the document without `digest`, `extractor`, `projectId` and
 * `commit` (`interface_extractor.py:42-62`). The exact byte rules are in
 * `field-maps/system-interface.md` ("Digest").
 */
@pattern("^sha256:[0-9a-f]{64}$")
scalar SystemInterfaceDigest extends string;

/**
 * Pad number of a schematic pin as the compiled schematic netlist reports it
 * (kicad_monkey's terminal `pin`): never empty, because a terminal with an
 * empty pin is skipped (`interface_extractor.py:137-138`) and KiCad's `~`
 * placeholder is read as empty (kicad_monkey 2026.9.7
 * `kicad_netlist_compiler.py:406-408`). Always a string: `01`, `1` and `A1`
 * are distinct (`CONTRACTS.md` §2.4).
 */
@minLength(1)
scalar SystemInterfacePinPad extends PadNumber;

/**
 * A pin name as the symbol's library pin writes it (kicad_monkey's terminal
 * `pin_name`), never empty. Kept exactly as written, including KiCad's `~`
 * (a KiCad 9 file's "no name") and overbar markup such as `~{RESET}`.
 */
@minLength(1)
scalar SystemInterfacePinName extends string;

/**
 * Manufacturer part number of a component: the first non-empty value, with
 * surrounding whitespace removed, of the fields `MPN`,
 * `Manufacturer_Part_Number`, `Manufacturer Part Number`, `MFR_PN`,
 * `Mfr. No.` and `Mfr No`, field names compared case-insensitively after
 * trimming (`interface_extractor.py:339-345`).
 */
@minLength(1)
scalar SystemInterfaceMpn extends string;

/**
 * A point or size in millimetres, `[x, y]` (or `[width, height]`), each an
 * IEEE double rounded to 1e-4 mm as `_round` does
 * (`interface_extractor.py:168-170`). The field holding it states its frame.
 */
@minItems(2)
@maxItems(2)
model SystemInterfaceMmPair is float64[];

/**
 * Three millimetre values `[x, y, z]`, each rounded to 1e-4 mm as `_round`
 * does (`interface_extractor.py:168-170`).
 */
@minItems(3)
@maxItems(3)
model SystemInterfaceMmTriple is float64[];

/**
 * Three angles in degrees `[x, y, z]`, each rounded to 1e-4 as `_round` does
 * (`interface_extractor.py:168-170`).
 */
@minItems(3)
@maxItems(3)
model SystemInterfaceDegTriple is Degrees[];

/**
 * Three unitless factors `[x, y, z]`, each rounded to 1e-4 as `_round` does
 * (`interface_extractor.py:168-170`).
 */
@minItems(3)
@maxItems(3)
model SystemInterfaceScaleTriple is float64[];

/**
 * A set of KiCad net names, sorted in code point order (Python `sorted()` on
 * `str`), without duplicates, without the empty name and without KiCad's
 * generated `unconnected-(…)` names (`normalized_nets`,
 * `interface_extractor.py:47-49`). Empty when no named net remains.
 */
@uniqueItems
model SystemInterfaceNetSet is NetName[];

/**
 * A non-empty set of pin names, sorted in code point order, without
 * duplicates (`interface_extractor.py:427`).
 */
@minItems(1)
@uniqueItems
model SystemInterfacePinNameSet is SystemInterfacePinName[];

/**
 * A non-empty set of pin electrical types, sorted in code point order of
 * their string values, without duplicates (`interface_extractor.py:428`).
 */
@minItems(1)
@uniqueItems
model SystemInterfacePinTypeSet is SystemInterfacePinType[];

/**
 * The occurrence keys of every unit of one component, sorted in code point
 * order, without duplicates, never empty (`interface_extractor.py:437`).
 */
@minItems(1)
@uniqueItems
model SystemInterfaceMemberKeys is KiidPath[];

// -------------------------------------------------------------------- enums

/**
 * Which connector-detection rule decided `candidate`
 * (`connector_detection.classify`,
 * `backend/app/services/systems/connector_detection.py:42-65`; rule order
 * frozen in `CONTRACTS.md` §4.1). Other System Builder code builds
 * interface-shaped documents with `module` or `export` here
 * (`systems/modules.py:67`, `systems/exports.py:41`); those are not this
 * artifact and never appear in it.
 */
enum SystemInterfaceCandidateReason {
  /** An explicit `Prism_Port` field (true or false), or `System` = `Connector`. */
  field,

  /** The reference's alphabetic prefix is exactly `J`. */
  refdes,

  /** The `lib_id` or footprint library nickname starts with `Connector` (test points excluded). */
  library,

  /** No rule matched (`candidate` is false), or a `TestPoint` symbol stopped the library rule. */
  none,
}

/**
 * Electrical type of a schematic pin as the compiled netlist reports it:
 * KiCad's pin type token, lower case, as the symbol file writes it
 * (kicad_monkey 2026.9.7 `kicad_sch_enums.py:12-37`, `PinElectricalType`;
 * the netlist copies its value, `kicad_netlist_compiler.py:1086-1092`). A
 * library pin with no type reads as `unspecified`; the pre-2021 token
 * `unconnected` reads as `no_connect`. Not the semantic index's upper-case
 * spelling.
 */
enum SystemInterfacePinType {
  /** KiCad `input`. */
  input,

  /** KiCad `output`. */
  output,

  /** KiCad `bidirectional`. */
  bidirectional,

  /** KiCad `tri_state`. */
  triState: "tri_state",

  /** KiCad `passive`. */
  passive,

  /** KiCad `free`. */
  free,

  /** KiCad `unspecified`, also a library pin with no type. */
  unspecified,

  /** KiCad `power_in`. */
  powerIn: "power_in",

  /** KiCad `power_out`. */
  powerOut: "power_out",

  /** KiCad `open_collector`. */
  openCollector: "open_collector",

  /** KiCad `open_emitter`. */
  openEmitter: "open_emitter",

  /** KiCad `no_connect`, also the legacy token `unconnected`. */
  noConnect: "no_connect",
}

/**
 * Board side of a placed footprint in System Builder's spelling
 * (`CONTRACTS_P2.md` §14.6), not Common's `Side`: a parity document keeps
 * today's values.
 */
enum SystemInterfaceFootprintSide {
  /** The footprint's layer does not start with `B.`: KiCad's front. */
  top,

  /** The footprint's layer starts with `B.`: KiCad's back, flipped. */
  bottom,
}

/**
 * Pad shape: the name of kicad_monkey's `PadShape` member in lower case
 * (`interface_extractor.py:233`; kicad_monkey 2026.9.7 `kicad_base.py:93-99`),
 * which is KiCad's pad shape token. A pad with any other token fails the
 * board parse, so no other value occurs.
 */
enum SystemInterfacePadShape {
  /** KiCad `circle`. */
  circle,

  /** KiCad `rect`. */
  rect,

  /** KiCad `oval`. */
  oval,

  /** KiCad `trapezoid`. */
  trapezoid,

  /** KiCad `roundrect`, which also covers chamfered rectangles. */
  roundrect,

  /** KiCad `custom`. */
  custom,
}

/** What `boardOutlineMm` bounds (`interface_extractor.py:304-321`). */
enum SystemInterfaceOutlineSource {
  /** The board-level `Edge.Cuts` graphics, by their line centres. */
  edgeCuts: "edge_cuts",

  /** No board-level `Edge.Cuts` graphic: the extent of all board items, strokes included (KiCad's own fallback). */
  items,
}

/**
 * Code of an extraction diagnostic (`interface_extractor.py:402-420`). The
 * values are today's snake_case strings, not kebab-case DiagnosticCodes: a
 * parity document keeps today's values.
 */
enum SystemInterfaceDiagnosticCode {
  /** A connector candidate whose reference contains `?` (`CONTRACTS.md` §2.3); it can never be a port. */
  unannotatedConnector: "unannotated_connector",

  /** A component that is not a connector candidate whose reference contains `?`. */
  unannotatedComponent: "unannotated_component",

  /** A pin whose pad number carries more than one schematic net (`CONTRACTS.md` §2.4); System Builder's SYS-V07 reports it per row. */
  pinNetAmbiguous: "pin_net_ambiguous",
}

// ------------------------------------------------------------------- models

/**
 * One project's System Builder interface: every placed symbol reference with
 * pins, keyed by occurrence, with the schematic nets of each pin, the board
 * pad nets for the PCB-sync warning, the footprint geometry, the board
 * thickness and outline, extraction diagnostics, and a digest over all of
 * those facts. A project with no board has `hasPcb` false and every board
 * field null. The bundle member is a pure function of the parsed sources: it
 * carries `digest` but not `projectId`, `commit` or `extractor`.
 */
@jsonSchema
@id("urn:prism:schema:prism.system_interface:v1")
@extension("title", "System interface v1")
model SystemInterfaceV1 {
  /** Schema id (`interface_extractor.py:37`), unchanged since extractor version 1. It is part of the digested body. */
  schema: "prism.system_interface.v1";

  /**
   * Prism project id the artifact was extracted for, `str(project.id)`
   * (`interface_extractor.py:454`, from `extract_for_revision` at `:477`).
   * Absent in the bundle member, which does not know the project; present in
   * every artifact the extractor writes and in every artifact System Builder
   * stores or serves (`systems/store_reviews.py:379`, read by the frontend's
   * `InstanceInterface.projectId`, `frontend/src/types/system.ts:380`). Not
   * digested.
   */
  @minLength(1)
  projectId?: string;

  /**
   * Git commit the artifact was extracted at (`interface_extractor.py:455`,
   * from `extract_for_revision` at `:478`). Absent in the bundle member,
   * which is keyed by revision key, not by commit. Null when the extractor
   * ran on a working tree without a commit (`commit=None` passed to
   * `extract_interface`, as the test suite does); the stored artifacts always hold
   * a 40-digit SHA-1 (`system_interface_artifacts.commit` check,
   * `backend/app/services/workspace_migrations/m026_system_builder.py:186`).
   * Not digested.
   */
  commit?: GitObjectId | null;

  /**
   * Which extractor produced the artifact (`interface_extractor.py:456`).
   * Absent in the bundle member, whose generator `bundle.json` records.
   * System Builder keys its artifact cache by `extractor.version`
   * (`systems/store_reviews.py:380`). Not digested.
   */
  extractor?: SystemInterfaceExtractor;

  /**
   * Whether the design has a board: the configured `.kicad_pcb` exists
   * (`interface_extractor.py:380-382`, `:457`). When false, `boardThicknessMm`,
   * `boardOutlineMm`, every `pcbNets` and every `geometry` are null.
   */
  hasPcb: boolean;

  /**
   * Board thickness in millimetres from the board's `(general (thickness …))`,
   * rounded to 1e-4 mm (`interface_extractor.py:458`). Null when there is no
   * board, or when the board's thickness is missing or zero.
   */
  boardThicknessMm: float64 | null;

  /**
   * Axis-aligned bounds of the board outline in the board frame (+y up),
   * extractor v8 (`interface_extractor.py:304-321`, `:459`;
   * `CONTRACTS_P2.md` §14.6). Null when there is no board, or when the board
   * has no Edge.Cuts graphic and no items with bounds.
   */
  boardOutlineMm: SystemInterfaceBoardOutline | null;

  /**
   * Every placed symbol reference that has at least one schematic pin, one
   * entry per reference (all units of a multi-unit symbol together), sorted
   * by `reference` in natural order (conventions.md §9, `_natural`,
   * `interface_extractor.py:89-92`, `:391`); `reference` is unique. A placed
   * symbol counts when it has a `lib_id` and an instance record for its sheet
   * path with a non-empty reference (`:104-120`). Virtual references starting
   * with `#` are excluded; unannotated references (containing `?`) are
   * included. Empty when no symbol has pins.
   */
  components: SystemInterfaceComponent[];

  /**
   * Extraction diagnostics, sorted by `code`, then `portKey`, then `pad`
   * (null as the empty string), each in code point order
   * (`interface_extractor.py:461-463`). Empty when there are none.
   */
  diagnostics: SystemInterfaceDiagnostic[];

  /**
   * SHA-256 over the canonical JSON of this document without `digest`,
   * `extractor`, `projectId` and `commit` (`interface_digest`,
   * `interface_extractor.py:52-62`, `:465`). Two revisions with the same
   * interface facts have the same digest whatever their project, commit or
   * extractor build. The Rust producer computes it over the same bytes
   * Python does (field map, "Digest").
   */
  digest: SystemInterfaceDigest;
}

/** The extractor that produced an artifact (`interface_extractor.py:456`). */
model SystemInterfaceExtractor {
  /**
   * `EXTRACTOR_VERSION` (`interface_extractor.py:38`). This contract is the
   * payload of version 8; an artifact of another version has a different
   * shape and is a different contract.
   */
  version: "8";

  /**
   * Today: the version of the Python `kicad-monkey` distribution that parsed
   * the sources, or `workspace` when it is not installed as a distribution
   * (`_kicad_monkey_version`, `interface_extractor.py:78-82`). An artifact
   * that C4 builds from a bundle member carries the bundle's generator id
   * here instead. Informational: nothing reads it.
   */
  @minLength(1)
  kicadMonkeyVersion: string;
}

/**
 * Bounds of the board outline (extractor v8, `interface_extractor.py:304-321`;
 * `CONTRACTS_P2.md` §14.6): line centres, not stroke edges; arcs by their
 * true extent (ends plus every axis extreme they sweep), circles by centre
 * plus or minus radius, polygons and Bézier curves by their points.
 */
model SystemInterfaceBoardOutline {
  /** Smallest x and smallest y, `[x, y]` in that order, in millimetres, board frame (+y up), rounded to 1e-4 mm. */
  minMm: SystemInterfaceMmPair;

  /** Largest x and largest y, `[x, y]` in that order, in millimetres, board frame (+y up), rounded to 1e-4 mm. */
  maxMm: SystemInterfaceMmPair;

  /** What was bounded. */
  source: SystemInterfaceOutlineSource;
}

/**
 * One component: every unit occurrence of one reference designator
 * (`interface_extractor.py:95-124`, `:391-450`; `CONTRACTS.md` §2.2-§3).
 */
model SystemInterfaceComponent {
  /**
   * Port key: the occurrence key of the lowest unit number present, ties
   * broken by occurrence key in code point order (`CONTRACTS.md` §2.3,
   * `interface_extractor.py:392`, `:396`). An occurrence key is a KIID path
   * in the schematic form: the containing sheet instance's path from the
   * root sheet's UUID, then `/<symbol uuid>` (`:122`). Always an element of
   * `memberKeys`.
   */
  portKey: KiidPath;

  /**
   * Occurrence keys (schematic-form KIID paths) of every unit of this
   * reference, sorted in code point order (`interface_extractor.py:437`).
   * Repeated sheets give distinct keys for one symbol UUID.
   */
  memberKeys: SystemInterfaceMemberKeys;

  /**
   * Reference designator as the symbol instance resolves it for its sheet
   * path (`interface_extractor.py:118`). Never starts with `#`; may contain
   * `?` when unannotated.
   */
  reference: Refdes;

  /** The `lib_id` of the lowest unit's placed symbol, as written (`interface_extractor.py:398`). */
  libId: LibId;

  /**
   * Footprint library link of the netlist component with this reference, as
   * written (`interface_extractor.py:399`). Empty when the symbol has no
   * footprint or the netlist has no component with this reference.
   */
  footprint: string;

  /**
   * Value field of the netlist component with this reference
   * (`interface_extractor.py:441`). Empty when it has none or the netlist has
   * no such component.
   */
  value: string;

  /**
   * Manufacturer part number, extractor v7 (`interface_extractor.py:443`,
   * `CONTRACTS_P2.md` §18.1). Null when no MPN-style field has a non-empty
   * value.
   */
  mpn: SystemInterfaceMpn | null;

  /**
   * Do-not-populate in the design's default assembly, from the
   * design-variant resolver with the sheet fold
   * (`interface_extractor.py:386-387`, `:444`;
   * `backend/app/services/semantic_index_variants.py:752-800`, the default
   * `components` map keyed by reference). False when the resolver has no
   * entry for the reference, which includes every reference ending in `?`
   * (`_valid_reference`, `semantic_index_variants.py:115-122`), even with
   * `(dnp yes)`.
   */
  dnp: boolean;

  /** Whether connector detection makes this component a port candidate (`CONTRACTS.md` §4.1). */
  candidate: boolean;

  /** The detection rule that decided `candidate`. */
  candidateReason: SystemInterfaceCandidateReason;

  /**
   * One entry per distinct schematic pad number of this reference across
   * all its units, sorted by `pad` in natural order (conventions.md §9,
   * `interface_extractor.py:413`); `pad` is unique. Never empty: a reference
   * with no schematic pin is not a component.
   */
  @minItems(1)
  pins: SystemInterfacePin[];

  /**
   * Footprint geometry, extractor v6 (`interface_extractor.py:213-262`,
   * `:448`; `CONTRACTS_P2.md` §14.6), from the first board footprint (file
   * order) whose `Reference` property equals `reference`. Null when there is
   * no board or no footprint has that `Reference` property.
   */
  geometry: SystemInterfaceGeometry | null;
}

/**
 * One logical pin: every schematic pin of the reference that shares one pad
 * number (`CONTRACTS.md` §2.4, `interface_extractor.py:127-145`, `:413-432`).
 */
model SystemInterfacePin {
  /** Pad number of the pin. */
  pad: SystemInterfacePinPad;

  /**
   * Full hierarchical schematic net names of the pin, captured from the
   * compiled schematic netlist before any board overlay (`CONTRACTS.md` §3),
   * as a sorted set (`SystemInterfaceNetSet`): code point order. Empty when
   * the pin is unconnected; KiCad's `unconnected-(…)` names are removed. More
   * than one element is the `pin_net_ambiguous` case.
   */
  nets: SystemInterfaceNetSet;

  /**
   * Net names of the board pads with this pad number on every board
   * footprint whose `Reference` property equals `reference` (all of them,
   * not only the first), as a sorted set (code point order) with the same
   * filtering as `nets`; empty when those pads have no net
   * (`interface_extractor.py:148-165`, `:421`, `:426`). Null when there is no
   * board, or when no such footprint has a pad with this number.
   */
  pcbNets: SystemInterfaceNetSet | null;

  /**
   * Pin names of the pins sharing this pad, sorted in code point order
   * (`interface_extractor.py:141-142`, `:427`). Null when none of them has a
   * non-empty name. Best effort; never drives drift (`CONTRACTS.md` §3).
   */
  pinNames: SystemInterfacePinNameSet | null;

  /**
   * Electrical types of the pins sharing this pad, sorted in code point
   * order of their values (`interface_extractor.py:143-144`, `:428`). Null
   * when none of them has a type. Best effort; never drives drift.
   */
  pinTypes: SystemInterfacePinTypeSet | null;

  /**
   * Extractor v5 (`CONTRACTS_P2.md` §8.4): true when any name in `nets` is
   * the `Value` of a placed symbol whose library symbol has the `power`
   * flag, anywhere in the hierarchy (`interface_extractor.py:324-336`,
   * `:430`). False for a pin with no net.
   */
  powerNet: boolean;
}

/**
 * Where one component's footprint sits on the board, extractor v6
 * (`interface_extractor.py:213-252`; `CONTRACTS_P2.md` §14.6). Numbers are
 * rounded to 1e-4.
 */
model SystemInterfaceGeometry {
  /** Board side of the footprint, from its layer (`interface_extractor.py:243-245`). */
  side: SystemInterfaceFootprintSide;

  /** Footprint anchor `[x, y]`, in that order, in millimetres in the board frame (+y up): KiCad's `(at x y)` with y negated. */
  positionMm: SystemInterfaceMmPair;

  /**
   * Footprint rotation in degrees as the board file writes it (KiCad's
   * counter-clockwise angle, `(at x y angle)`, 0 when absent), not
   * normalized, rounded to 1e-4 (`interface_extractor.py:216`, `:247`).
   */
  rotationDeg: Degrees;

  /**
   * The footprint's library link after its last `:`
   * (`interface_extractor.py:248`). Empty when the footprint has no library
   * link.
   */
  footprintName: string;

  /**
   * Every pad of the footprint, sorted by `pad` in natural order
   * (conventions.md §9, `interface_extractor.py:236`); pads with the same
   * number (including several unnumbered pads) all appear, in the
   * footprint's file order (a stable sort). Empty for a footprint with no
   * pads.
   */
  pads: SystemInterfacePad[];

  /**
   * Axis-aligned bounds of the footprint's `F.CrtYd`/`B.CrtYd` graphics in
   * the footprint's own frame (+y up, before rotation and flip)
   * (`interface_extractor.py:180-196`, `:237-242`). Null when the footprint
   * has no courtyard graphic.
   */
  courtyard: SystemInterfaceCourtyard | null;

  /**
   * The footprint's first 3D model that is not hidden, unresolved
   * (`interface_extractor.py:199-210`). Null when it has none.
   */
  `model`: SystemInterfaceModelRef | null;
}

/** One footprint pad (`interface_extractor.py:226-235`). */
model SystemInterfacePad {
  /** Pad number as the board file writes it; empty for an unnumbered pad (a mounting or alignment hole). */
  pad: PadNumber;

  /**
   * Pad centre `[x, y]`, in that order, in millimetres in the board frame (+y up): the pad's
   * footprint-local `(at …)` rotated by the footprint angle about the anchor,
   * added to the anchor, y negated (`interface_extractor.py:220-224`, `:231`).
   */
  positionMm: SystemInterfaceMmPair;

  /** Pad `(size w h)` as `[width, height]`, in that order, in millimetres, in the pad's own frame, unrotated; 0 for a missing dimension. */
  sizeMm: SystemInterfaceMmPair;

  /** Pad shape. */
  shape: SystemInterfacePadShape;

  /** True for a `thru_hole` or `np_thru_hole` pad (`interface_extractor.py:228`, `:234`). */
  tht: boolean;
}

/** Courtyard bounds in the footprint's own frame (`interface_extractor.py:237-242`). */
model SystemInterfaceCourtyard {
  /**
   * Smallest x and smallest y, `[x, y]` in that order, in millimetres, footprint frame (+y up, before
   * rotation and flip), over line and rectangle ends, arc start, mid and end
   * points (not the arc's true extent), circle boxes and polygon points.
   */
  minMm: SystemInterfaceMmPair;

  /** Largest x and largest y, `[x, y]` in that order, in millimetres, footprint frame (+y up, before rotation and flip). */
  maxMm: SystemInterfaceMmPair;
}

/**
 * A footprint's 3D model reference, unresolved (`interface_extractor.py:199-210`).
 * A model with `(hide)` or `(hide yes)` is skipped.
 */
model SystemInterfaceModelRef {
  /** Model path exactly as the board file writes it, environment variables such as `${KICAD10_3DMODEL_DIR}` kept. */
  path: string;

  /** The model's `(offset (xyz …))` `[x, y, z]` in millimetres, rounded to 1e-4 mm; in that order. */
  offsetMm: SystemInterfaceMmTriple;

  /** The model's `(rotate (xyz …))` `[x, y, z]` in degrees, rounded to 1e-4; in that order. */
  rotationDeg: SystemInterfaceDegTriple;

  /** The model's `(scale (xyz …))` `[x, y, z]`, rounded to 1e-4; in that order. */
  scale: SystemInterfaceScaleTriple;
}

/** One extraction diagnostic (`interface_extractor.py:402-420`). */
model SystemInterfaceDiagnostic {
  /** What was found. */
  code: SystemInterfaceDiagnosticCode;

  /** `portKey` of the component concerned. */
  portKey: KiidPath;

  /** The pad concerned for `pin_net_ambiguous`. Null for the two `unannotated_*` codes, which concern the whole component. */
  pad: SystemInterfacePinPad | null;

  /**
   * Fixed English text, part of the digest: `<reference> is not annotated`
   * for `unannotated_*`, `<reference>.<pad> carries <n> schematic nets` for
   * `pin_net_ambiguous`, `<n>` in decimal.
   */
  @minLength(1)
  detail: string;
}
