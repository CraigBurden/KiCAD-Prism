import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * Bundle member `projections/board-objects.json` (`prism.board_objects.a0`),
 * written in stage `parse`: every addressable object of the project's
 * schematics and board, keyed `documentPath#uuid`, plus the review-only
 * settings objects of the `.kicad_pro`, `.kicad_dru`, board and schematic
 * files. Design Comparison reads it for its object deltas (`changes`), focus
 * targets (`nativeObjects`) and component rows (`componentObjects`).
 *
 * It replaces today's Node object index (`prism.ecad_object_index_v1`,
 * `backend/design-compare-parser/ecad-parse.mjs`): every object carries the
 * fields that index emits, under the same names except where the field map
 * lists a rename (`rotation` becomes `rotationDeg`, a footprint's
 * `kiidPaths` becomes `footprintPath`, `hash` becomes `contentDigest`), with
 * coordinates in integer nanometres instead of millimetres. Kinds that KiCad
 * spells with a token keep its spelling; kinds Prism names are kebab-case
 * (today's `sheet_pin` is `sheet-pin`), so today's kind is the bundle kind
 * with every `-` replaced by `_`. The field map
 * (`field-maps/board-objects.md`) gives the source of every field, the
 * exact rule for every value, how to rebuild today's index entry from a
 * member object, and the expected divergences.
 */
namespace Prism.Contracts.BoardObjectsA0;

// ------------------------------------------------------------------ scalars

/**
 * Content digest of one KiCad object: the first 16 hexadecimal digits of the
 * SHA-256 of the object's canonical form text (field map, "contentDigest").
 * The canonical form keeps the object's own s-expression without its
 * identity (`uuid`, `tstamp`), without data KiCad regenerates
 * (`fields_autoplaced`, `filled_polygon`, `render_cache`, an instance path's
 * `page`), with its net written by name, with each child object (a
 * footprint's pads, zones, graphics and texts; a symbol's or sheet's pins)
 * replaced by a reference to its uuid, and with only the child forms listed
 * for its form head in the field map. Two objects with the same key have
 * equal digests exactly when that content is equal; the value means nothing
 * else and is never compared across keys.
 */
@pattern("^[0-9a-f]{16}$")
scalar BoardObjectsContentDigest extends string;

/**
 * Identity of a review-only object, unique within its document: today's
 * synthetic id `<kind with _ written as ->:<16 hex digits>`, for example
 * `net-class:3f0c…` or `drc-exclusion:1ca4…`. The digits are the first 16
 * of the BLAKE2b-512 digest of the JSON text of the object's identity
 * string (`ecad-parse.mjs:252-257`, `:542`); the field map lists the
 * identity string of each kind.
 */
@pattern("^[a-z]+(?:-[a-z]+)*:[0-9a-f]{16}$")
scalar BoardObjectsReviewOnlyId extends string;

/**
 * A board layer exactly as the file writes it on a pad or zone: a canonical
 * layer name (`F.Cu`, `In2.Cu`, `B.Mask`) or a KiCad wildcard set (`*.Cu`,
 * `F&B.Cu`, `*.Mask`), not expanded. Today's Design Comparison shows and
 * compares the wildcard spelling (`ecad-parse.mjs:1423`, `:1452-1454`).
 */
@minLength(1)
scalar BoardObjectsLayerSpec extends string;

// -------------------------------------------------------------------- enums

/** How a schematic symbol is mirrored, KiCad's `(mirror x)` or `(mirror y)`. */
enum BoardObjectsMirror {
  /** KiCad `x`: mirrored about the horizontal axis. */
  x,

  /** KiCad `y`: mirrored about the vertical axis. */
  y,
}

/** Horizontal justification of a text, as today's index reads `(justify …)` (`left`/`right`; `center` when neither is written). */
enum BoardObjectsHorizontalJustify {
  /** KiCad `left`. */
  left,

  /** KiCad `right`. */
  right,

  /** Neither `left` nor `right` is written. */
  center,
}

/** Vertical justification of a text, as today's index reads `(justify …)` (`top`/`bottom`; `center` when neither is written). */
enum BoardObjectsVerticalJustify {
  /** KiCad `top`. */
  top,

  /** KiCad `bottom`. */
  bottom,

  /** Neither `top` nor `bottom` is written. */
  center,
}

/**
 * Kind of a review-only object: structured settings or definitions that have
 * no KiCad uuid and nothing to paint, reviewed by their fields alone
 * (`reviewOnly: true` today). Today's spelling is the value with every `-`
 * written as `_`.
 */
enum BoardObjectsReviewOnlyKind {
  /** One net class of the `.kicad_pro` (`net_settings.classes[]`), named by its class name. */
  netClass: "net-class",

  /** One net-to-class assignment of the `.kicad_pro` (`net_settings.netclass_assignments` or `netclass_patterns[]`), named by its net pattern. */
  netClassAssignment: "net-class-assignment",

  /** The board design rules of the `.kicad_pro` (`board.design_settings.rules`), one object named `Board constraints`. */
  boardConstraint: "board-constraint",

  /** The DRC severities of the `.kicad_pro` (`board.design_settings.rule_severities`), one object named `DRC severities`. */
  drcSeverity: "drc-severity",

  /** The track, via and differential-pair presets of the `.kicad_pro`, one object named `Routing presets`. */
  routingPreset: "routing-preset",

  /** The board drawing defaults of the `.kicad_pro` (`board.design_settings.defaults`), one object named `Board drawing defaults`. */
  boardDefault: "board-default",

  /** The teardrop options and parameters of the `.kicad_pro`, one object named `Teardrop settings`. */
  teardropSetting: "teardrop-setting",

  /** The zone settings of the `.kicad_pro` (`zones_allow_external_fillets`, `zones_use_no_outline`), one object named `Zone settings`. */
  zoneSetting: "zone-setting",

  /** One DRC exclusion of the `.kicad_pro` (`board.design_settings.drc_exclusions[]`). */
  drcExclusion: "drc-exclusion",

  /** One ERC exclusion of the `.kicad_pro` (`erc.erc_exclusions[]`). */
  ercExclusion: "erc-exclusion",

  /** One cell of the ERC pin-conflict matrix of the `.kicad_pro` (`erc.pin_map`). */
  ercPinRule: "erc-pin-rule",

  /** The project text variables of the `.kicad_pro` (`text_variables`), one object named `Project title-block variables`. */
  projectMetadata: "project-metadata",

  /** One `(rule …)` of a `.kicad_dru` file, named by the rule name. */
  customRule: "custom-rule",

  /** The plot and fabrication-output settings of a `.kicad_pcb` (`setup`, `pcbplotparams`), one object named `Fabrication output settings`. */
  fabricationOutput: "fabrication-output",

  /** One `(bus_alias …)` of a `.kicad_sch`, named by the alias name. */
  busAlias: "bus_alias",
}

// ------------------------------------------------------------- root model

/**
 * Every addressable object and review-only settings object of the project's
 * KiCad documents, for Design Comparison.
 */
@jsonSchema
@id("urn:prism:schema:prism.board_objects:a0")
@extension("title", "Board objects a0")
model BoardObjectsA0 {
  /** Schema id of this document. */
  schema: "prism.board_objects.a0";

  /**
   * One entry per `.kicad_sch`, `.kicad_pcb`, `.kicad_pro` and `.kicad_dru`
   * member of the bundle's `sources/`, which is the closure the build read
   * for this project (bundle-format.md §2.2), never the repository-wide key
   * source set, so another project's files appear only when this project
   * references them. Files that yield no object are included. Sorted by
   * `path` in code point order; `path` is unique. A file the producer cannot
   * parse is left out and reported as a warning of stage `parse` in
   * `bundle.json`. Empty only when the closure has none of these files.
   */
  documents: BoardObjectsDocument[];
}

/** The objects of one KiCad document. */
model BoardObjectsDocument {
  /**
   * The document's repository-relative path. With an object's `uuid` it
   * forms the object's ObjectRef `<path>#<uuid>`, Design Comparison's object
   * key (`ecad-diff.mjs:93-95`). Today's `documentPath`
   * (`ecad-parse.mjs:1689`) is relative to the project directory instead;
   * the ids change once, by decision (conventions.md §8).
   */
  path: RepoPath;

  /**
   * The document's objects that carry a KiCad uuid, in file order: ordered
   * by the byte offset of each object's opening parenthesis, so a footprint
   * precedes its pads and a symbol its pins. `uuid` is unique within the
   * array: when two forms of one document carry the same uuid only the
   * later one is kept and stage `parse` gets a warning. Always empty for a
   * `.kicad_pro` or `.kicad_dru` document.
   */
  objects: BoardObjectsObject[];

  /**
   * The document's review-only objects, sorted by `id` in code point order;
   * `id` is unique (of two objects with one id, the one today's index
   * emits later is kept, as its keyed map does). `.kicad_pro`: every kind
   * except `custom-rule`, `fabrication-output` and `bus_alias`;
   * `.kicad_dru`: `custom-rule`; `.kicad_pcb`: `fabrication-output`;
   * `.kicad_sch`: `bus_alias`. Empty when the document has none.
   */
  reviewOnlyObjects: BoardObjectsReviewOnlyObject[];
}

/**
 * One object with a KiCad uuid. The variant is chosen by `kind`; the field
 * map lists each kind's KiCad forms.
 */
@oneOf
union BoardObjectsObject {
  symbol: BoardObjectsSymbol,
  pin: BoardObjectsPin,
  sheet: BoardObjectsSheet,
  sheetPin: BoardObjectsSheetPin,
  wire: BoardObjectsWire,
  bus: BoardObjectsBus,
  junction: BoardObjectsJunction,
  noConnect: BoardObjectsNoConnect,
  busEntry: BoardObjectsBusEntry,
  label: BoardObjectsLabel,
  graphic: BoardObjectsGraphic,
  image: BoardObjectsImage,
  table: BoardObjectsTable,
  footprint: BoardObjectsFootprint,
  pad: BoardObjectsPad,
  zone: BoardObjectsZone,
  footprintGraphic: BoardObjectsFootprintGraphic,
  footprintText: BoardObjectsFootprintText,
  track: BoardObjectsTrack,
  arc: BoardObjectsArc,
  via: BoardObjectsVia,
  group: BoardObjectsGroup,
}

/** Identity fields every KiCad object carries, in this order after `kind`. */
model BoardObjectsIdentity {
  /**
   * The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
   * KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
   * reaches the parser. An object without an id
   * is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
   * object whose id is not a canonical uuid is not listed either (today it
   * is) and stage `parse` gets a warning.
   */
  uuid: KiCadUuid;

  /** Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map. */
  contentDigest: BoardObjectsContentDigest;
}

// ---------------------------------------------------------------- schematic

/** A placed schematic symbol: KiCad `(symbol (lib_id …) …)` (`ecad-parse.mjs:958-985`). */
model BoardObjectsSymbol {
  /** Kind of object. */
  kind: "symbol";

  ...BoardObjectsIdentity;

  /** The symbol's `(lib_id …)` as written. Absent when the form has none. */
  libId?: LibId;

  /** The symbol's anchor, `(at x y …)`, in the schematic page frame (+y down). Absent when the form has no `(at …)`. */
  at?: PointNm;

  /** The angle of the symbol's `(at x y angle)` as written; 0 when the form omits it. Present exactly when `at` is. */
  rotationDeg?: Degrees;

  /** The symbol's `(mirror …)`. Absent when the symbol is not mirrored. */
  mirror?: BoardObjectsMirror;

  /** True when the symbol's own `(dnp …)` is `yes`; false otherwise, including when it is absent. Sheet-level DNP is not folded in. */
  dnp: boolean;

  /** False when the symbol's own `(in_bom …)` is `no`; true otherwise, including when it is absent. */
  inBom: boolean;

  /** False when the symbol's own `(on_board …)` is `no`; true otherwise, including when it is absent. */
  onBoard: boolean;

  /**
   * The reference designator: the first non-empty `(reference …)` of the
   * symbol's `(instances …)`, else its `(default_instance (reference …))`,
   * else its `Reference` property (`ecad-parse.mjs:879-891`). Includes
   * power (`#PWR01`) and unannotated (`R?`) references. Absent when none of
   * these is non-empty.
   */
  refdes?: Refdes;

  /**
   * Every occurrence path of the symbol, schematic form: each
   * `(instances (project … (path P …)))` entry's P (without a trailing `/`)
   * followed by `/<uuid>` (`ecad-parse.mjs:867-877`). Each path once,
   * sorted in code point order. Empty when the symbol has no instance path.
   */
  kiidPaths: KiidPath[];

  /**
   * The symbol's instances, in file order over every `(project …)` and its
   * `(path …)` entries; when there is none, one entry holding only the
   * `(default_instance (reference …))`, if there is one
   * (`ecad-parse.mjs:893-912`). Empty when the symbol has neither.
   */
  instances: BoardObjectsSymbolInstance[];

  /** The symbol's `(property …)` fields, in file order (`ecad-parse.mjs:914-928`). */
  properties: BoardObjectsSchematicProperty[];

  /** Review fields, serialized with keys in code point order; keys are review labels (today: `Unit`). Field map, "Review fields". */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** One `(path …)` instance of a placed symbol. */
model BoardObjectsSymbolInstance {
  /** The instance's `(reference …)`. Absent when it has none or it is empty. */
  reference?: Refdes;

  /** The occurrence path, schematic form: the instance's path (without a trailing `/`) followed by `/<symbol uuid>`. Absent for the `default_instance` entry or when the path is not a valid KIID path. */
  path?: KiidPath;
}

/** A pin instance of a placed symbol: `(pin "<number>" (uuid …))` inside the symbol (`ecad-parse.mjs:986-1002`). */
model BoardObjectsPin {
  /** Kind of object. */
  kind: "pin";

  ...BoardObjectsIdentity;

  /** Uuid of the symbol the pin belongs to. Absent only when that symbol has no valid uuid. */
  parentUuid?: KiCadUuid;

  /** The pin number as written. Absent when the form has none. */
  number?: PadNumber;

  /** The parent symbol's `refdes`. Absent when the parent has none. */
  refdes?: Refdes;

  /** The parent symbol's anchor (a pin instance has no position of its own), schematic page frame. Absent when the symbol has no `(at …)`. */
  at?: PointNm;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Pin number`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A hierarchical sheet: KiCad `(sheet …)` (`ecad-parse.mjs:1005-1015`). Today's index gives it no review fields. */
model BoardObjectsSheet {
  /** Kind of object. */
  kind: "sheet";

  ...BoardObjectsIdentity;

  /** The sheet box's `(at x y)` corner, schematic page frame. Absent when the form has no `(at …)`. */
  at?: PointNm;

  /**
   * Every instance path of the sheet, schematic form: each
   * `(instances (project … (path P …)))` entry's P followed by `/<uuid>`.
   * Each once, sorted in code point order. Empty when it has none.
   */
  kiidPaths: KiidPath[];

  /** The sheet's `(property …)` fields (`Sheetname`, `Sheetfile`, user fields), in file order. */
  properties: BoardObjectsSchematicProperty[];
}

/** A sheet pin: `(pin "<name>" <type> …)` inside a sheet (`ecad-parse.mjs:1016-1036`). */
model BoardObjectsSheetPin {
  /** Kind of object. */
  kind: "sheet-pin";

  ...BoardObjectsIdentity;

  /** Uuid of the sheet the pin belongs to. Absent only when that sheet has no valid uuid. */
  parentUuid?: KiCadUuid;

  /** The pin's name as written. Absent when the form has none. */
  name?: string;

  /** The same value as `name` (today's index emits both). Absent exactly when `name` is. */
  text?: string;

  /** The pin's `(at x y …)`, schematic page frame. Absent when the form has none. */
  at?: PointNm;

  /** The angle of the pin's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is. */
  rotationDeg?: Degrees;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Sheet pin`, `Electrical type`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A schematic wire: `(wire (pts …) …)` (`ecad-parse.mjs:1039-1049`). */
model BoardObjectsWire {
  /** Kind of object. */
  kind: "wire";

  ...BoardObjectsIdentity;

  /** Centroid of the wire's `(pts …)` points, schematic page frame, computed by the field map's centroid rule. Absent when it has no point. */
  at?: PointNm;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Stroke`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A schematic bus: `(bus (pts …) …)` (`ecad-parse.mjs:1039-1049`). */
model BoardObjectsBus {
  /** Kind of object. */
  kind: "bus";

  ...BoardObjectsIdentity;

  /** Centroid of the bus's `(pts …)` points, schematic page frame, computed by the field map's centroid rule. Absent when it has no point. */
  at?: PointNm;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Stroke`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A junction dot: `(junction …)` (`ecad-parse.mjs:1068-1083`). */
model BoardObjectsJunction {
  /** Kind of object. */
  kind: "junction";

  ...BoardObjectsIdentity;

  /** The junction's `(at x y)`, schematic page frame. Absent when the form has none. */
  at?: PointNm;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Diameter`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A no-connect flag: `(no_connect …)` (`ecad-parse.mjs:1068-1083`). */
model BoardObjectsNoConnect {
  /** Kind of object. */
  kind: "no_connect";

  ...BoardObjectsIdentity;

  /** The flag's `(at x y)`, schematic page frame. Absent when the form has none. */
  at?: PointNm;

  /** Review fields, serialized with keys in code point order; keys are review labels (today always empty). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A bus entry: `(bus_entry …)` (`ecad-parse.mjs:1068-1083`). */
model BoardObjectsBusEntry {
  /** Kind of object. */
  kind: "bus_entry";

  ...BoardObjectsIdentity;

  /** The entry's `(at x y)`, schematic page frame. Absent when the form has none. */
  at?: PointNm;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Size`, `Stroke`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A net label of any scope: `(label …)`, `(global_label …)` or `(hierarchical_label …)` (`ecad-parse.mjs:1085-1103`). The scope is part of `contentDigest`, not a field. */
model BoardObjectsLabel {
  /** Kind of object. */
  kind: "label";

  ...BoardObjectsIdentity;

  /** The label's text as written. Absent when the form has none. */
  text?: string;

  /** The label's text again: the name the label gives its net on its sheet, not the resolved full net name (`ecad-parse.mjs:1096`). Absent exactly when `text` is. */
  net?: string;

  /** The label's `(at x y …)`, schematic page frame. Absent when the form has none. */
  at?: PointNm;

  /** The angle of the label's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is. */
  rotationDeg?: Degrees;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Text`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/**
 * A drawing that is not part of a footprint. Schematic: `(polyline …)`,
 * `(rectangle …)`, `(arc …)`, `(circle …)`, `(bezier …)`, `(text …)`,
 * `(text_box …)` (`ecad-parse.mjs:1105-1118`). Board: `(gr_line …)`,
 * `(gr_rect …)`, `(gr_arc …)`, `(gr_circle …)`, `(gr_poly …)`,
 * `(gr_text …)`, `(dimension …)` (`ecad-parse.mjs:1557-1571`).
 */
model BoardObjectsGraphic {
  /** Kind of object. */
  kind: "graphic";

  ...BoardObjectsIdentity;

  /**
   * Position of the drawing in the document frame (schematic page or board,
   * +y down): the form's `(at …)` when it has one, else the centroid of its
   * points as the field map's per-form table defines them. Absent for the
   * forms the table marks so (a schematic `circle`, a board `dimension`).
   */
  at?: PointNm;

  /** Board drawings only: the drawing's `(layer …)`. Absent on schematic drawings and when the form has none. */
  layer?: LayerName;

  /** The drawing's text: schematic `text`/`text_box`, board `gr_text`. Absent on every other form. */
  text?: string;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Graphic type`, `Text`, `Stroke`, `Fill`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A schematic bitmap: `(image …)` (`ecad-parse.mjs:1120-1125`). */
model BoardObjectsImage {
  /** Kind of object. */
  kind: "image";

  ...BoardObjectsIdentity;

  /** The image's `(at x y)` centre, schematic page frame. Absent when the form has none. */
  at?: PointNm;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Scale`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A schematic table: `(table …)` (`ecad-parse.mjs:1126-1134`). It has no position. */
model BoardObjectsTable {
  /** Kind of object. */
  kind: "table";

  ...BoardObjectsIdentity;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Columns`, `Rows`, `Table content`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

// -------------------------------------------------------------------- board

/** A footprint placed on the board: `(footprint "<lib id>" …)` (`ecad-parse.mjs:1380-1412`). */
model BoardObjectsFootprint {
  /** Kind of object. */
  kind: "footprint";

  ...BoardObjectsIdentity;

  /** The footprint's library link, the form's first value, as written. Absent when it is empty. */
  libId?: LibId;

  /** The footprint's anchor, `(at x y …)`, board frame. Absent when the form has none. */
  at?: PointNm;

  /** The angle of the footprint's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is. */
  rotationDeg?: Degrees;

  /** The footprint's `(layer …)`: `F.Cu`, or `B.Cu` for a flipped footprint. Absent when the form has none. */
  layer?: LayerName;

  /** The footprint's `(path …)`, board form (no root sheet uuid): the occurrence of the symbol it was placed from. Today's `kiidPaths` is the one-entry list of this value. Absent when the footprint has no valid path. */
  footprintPath?: KiidPath;

  /** The `Reference` field's value (`ecad-parse.mjs:1383-1385`). Absent when it is missing or empty. */
  refdes?: Refdes;

  /** The footprint's fields, in file order. */
  properties: BoardObjectsFootprintProperty[];

  /** Review fields, serialized with keys in code point order; keys are review labels (`Description`, `Attributes`, `Exclude from BOM`, `Exclude from position files`, `Board only`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A footprint pad: `(pad …)` inside a footprint (`ecad-parse.mjs:1413-1441`). */
model BoardObjectsPad {
  /** Kind of object. */
  kind: "pad";

  ...BoardObjectsIdentity;

  /** Uuid of the footprint the pad belongs to. Absent only when that footprint has no valid uuid. */
  parentUuid?: KiCadUuid;

  /** The pad number as written; empty for an unnumbered pad. Absent when the form has none. */
  number?: PadNumber;

  /** The parent footprint's `refdes`. Absent when it has none. */
  refdes?: Refdes;

  /** The pad's `(at x y …)` as written: footprint-local, relative to the footprint anchor before its rotation; a back-side footprint's children are already mirrored in the file. Absent when the form has none. */
  at?: PointNm;

  /** The angle of the pad's `(at x y angle)` as written, which KiCad stores in the board frame (it includes the footprint's rotation); 0 when omitted. Present exactly when `at` is. */
  rotationDeg?: Degrees;

  /** The first entry of the pad's `(layers …)` as written, wildcard sets included. Absent when the pad has no layer. */
  layer?: BoardObjectsLayerSpec;

  /** The pad's net, by name. Absent when the pad has no net. */
  net?: NetName;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Pad number`, `Pad type`, `Pad shape`, `Size`, `Drill`, `Layers`, `Clearance`, `Solder mask margin`, `Solder paste margin`, `Thermal width`, `Thermal gap`, `Zone connection`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A copper zone or rule area, on the board or inside a footprint: `(zone …)` (`ecad-parse.mjs:1442-1460`, `:1543-1555`). */
model BoardObjectsZone {
  /** Kind of object. */
  kind: "zone";

  ...BoardObjectsIdentity;

  /** Footprint zones only: uuid of the footprint. Absent on board zones and when the footprint has no valid uuid. */
  parentUuid?: KiCadUuid;

  /** Footprint zones only: the footprint's `refdes`. Absent on board zones and when the footprint has none. */
  refdes?: Refdes;

  /**
   * Centroid of the points of all the zone's `(polygon (pts …))` outlines
   * (fill polygons excluded), computed by the field map's centroid rule, in
   * the frame the file stores them: the board frame, except for a footprint
   * zone in a board of format 20260616 or later, whose outline is
   * footprint-local (fork: `src/rs/kicad-monkey-core/src/pcb/footprints.rs:36-37`).
   * Absent when the outline has no point.
   */
  at?: PointNm;

  /** The zone's `(layer …)`; a footprint zone without one takes the first entry of its `(layers …)`. As written, wildcard sets included. Absent when there is none. */
  layer?: BoardObjectsLayerSpec;

  /** The zone's net: its `(net_name …)` when non-empty, else the name of its `(net …)`. Absent when the zone has no net. */
  net?: NetName;

  /** The zone's `(name …)` as written. Absent when the form has none. */
  name?: string;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Zone name`, `Zone layers`, `Priority`, `Hatch`, `Pad connection`, `Minimum thickness`, `Keepout`, `Fill rules`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A footprint drawing: `(fp_line …)`, `(fp_rect …)`, `(fp_arc …)`, `(fp_circle …)` or `(fp_poly …)` inside a footprint (`ecad-parse.mjs:1461-1477`). */
model BoardObjectsFootprintGraphic {
  /** Kind of object. */
  kind: "footprint-graphic";

  ...BoardObjectsIdentity;

  /** Uuid of the footprint. Absent only when it has no valid uuid. */
  parentUuid?: KiCadUuid;

  /** The footprint's `refdes`. Absent when it has none. */
  refdes?: Refdes;

  /** Centroid of the drawing's points as the field map's per-form table defines them, footprint-local as the file stores them. Absent when there is no point. */
  at?: PointNm;

  /** The drawing's `(layer …)`. Absent when the form has none. */
  layer?: LayerName;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Stroke`, `Fill`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A footprint text: `(fp_text reference|value|user "…" …)` inside a footprint (`ecad-parse.mjs:1478-1495`). KiCad 8 and later keep `Reference` and `Value` as properties, not as texts. */
model BoardObjectsFootprintText {
  /** Kind of object. */
  kind: "footprint-text";

  ...BoardObjectsIdentity;

  /** Uuid of the footprint. Absent only when it has no valid uuid. */
  parentUuid?: KiCadUuid;

  /** The footprint's `refdes`. Absent when it has none. */
  refdes?: Refdes;

  /** The text's `(at x y …)` as written: footprint-local. Absent when the form has none. */
  at?: PointNm;

  /** The angle of the text's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is. */
  rotationDeg?: Degrees;

  /** The text's `(layer …)`. Absent when the form has none. */
  layer?: LayerName;

  /** The text as written (unexpanded variables such as `${REFERENCE}` stay). Absent when the form has none. */
  text?: string;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Text kind`, `Text`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A straight track: `(segment …)` (`ecad-parse.mjs:1498-1513`). */
model BoardObjectsTrack {
  /** Kind of object. */
  kind: "track";

  ...BoardObjectsIdentity;

  /** Centroid of the track's start and end, board frame, computed by the field map's centroid rule. Absent when it has neither. */
  at?: PointNm;

  /** The track's `(layer …)`. Absent when the form has none (KiCad 10 writes `(layers …)` for a track with a mask opening; it is then absent). */
  layer?: LayerName;

  /** The track's net, by name. Absent when the track has no net. */
  net?: NetName;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Width`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** An arc track: board-level `(arc (start …) (mid …) (end …) …)` (`ecad-parse.mjs:1498-1513`). */
model BoardObjectsArc {
  /** Kind of object. */
  kind: "arc";

  ...BoardObjectsIdentity;

  /** Centroid of the arc's start, mid and end points, board frame, computed by the field map's centroid rule. Absent when it has none. */
  at?: PointNm;

  /** The arc's `(layer …)`. Absent when the form has none. */
  layer?: LayerName;

  /** The arc's net, by name. Absent when the arc has no net. */
  net?: NetName;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Width`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A via: `(via …)` (`ecad-parse.mjs:1515-1541`). */
model BoardObjectsVia {
  /** Kind of object. */
  kind: "via";

  ...BoardObjectsIdentity;

  /** The via's `(at x y)`, board frame. Absent when the form has none. */
  at?: PointNm;

  /** The first entry of `layers`. Absent when `layers` is empty. */
  layer?: LayerName;

  /** The via's `(layers …)` entries, in file order (its two end layers). Empty when the form has none. */
  layers: LayerName[];

  /** The via's net, by name. Absent when the via has no net. */
  net?: NetName;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Via type`, `Diameter`, `Drill`, `Layer span`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

/** A board group: `(group "<name>" (uuid …) (members …))` (`ecad-parse.mjs:1573-1584`). */
model BoardObjectsGroup {
  /** Kind of object. */
  kind: "group";

  ...BoardObjectsIdentity;

  /** The group's name as written; empty for an unnamed group. */
  name: string;

  /** Review fields, serialized with keys in code point order; keys are review labels (`Group`, `Members`). */
  reviewFields: Record<BoardObjectsReviewValue>;
}

// ------------------------------------------------------------- properties

/** One `(property "<name>" "<value>" …)` field of a schematic symbol or sheet (`ecad-parse.mjs:914-928`). */
model BoardObjectsSchematicProperty {
  /** The field name as written (`Reference`, `Value`, `Sheetname`, a user field). */
  name: string;

  /** The field value as written; may be empty. */
  value: string;

  /** The field's `(at x y …)`, schematic page frame. Absent when the form has none. */
  at?: PointNm;

  /** The angle of the field's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is. */
  rotationDeg?: Degrees;

  /** True when the property form itself has `(hide yes)` or a bare `hide` (KiCad 8 and later). */
  hide: boolean;

  /** The field's `(effects …)`. Absent when the form has none. */
  effects?: BoardObjectsTextEffects;
}

/** One field of a board footprint (field map, "Footprint properties"). */
model BoardObjectsFootprintProperty {
  /** The field name (`Reference`, `Value`, `Footprint`, a user field). */
  name: string;

  /** The field value as written; may be empty. */
  value: string;

  /** The field's `(at x y …)` as written, footprint-local. Absent when the form has none. */
  at?: PointNm;

  /** True when the field form has `(hide yes)` or a bare `hide`; false otherwise. */
  hide: boolean;
}

/** A text's `(effects …)`, with only what the file writes (`kicad-sexpr-parser.mjs:511-550`, as today's index reads it). */
model BoardObjectsTextEffects {
  /** The `(font …)`. Absent when the effects have none. */
  font?: BoardObjectsFont;

  /** The `(justify …)`. Absent when the effects have none. */
  justify?: BoardObjectsJustify;

  /** The effects' `hide` flag as written: true for `hide` or `(hide yes)`, false for `(hide no)`. Absent when not written. */
  hide?: boolean;

  /** The effects' `(href …)` as written. Absent when not written. */
  href?: string;
}

/** A text's `(font …)`, with only what the file writes. */
model BoardObjectsFont {
  /** The `(face …)` font name. Absent when not written. */
  face?: string;

  /** The `(size …)`. Absent when not written. */
  size?: BoardObjectsFontSize;

  /** The `(thickness …)` stroke width. Absent when not written. */
  thicknessNm?: NonNegativeNanometres;

  /** The `bold` flag as written: true for `bold` or `(bold yes)`, false for `(bold no)`. Absent when not written. */
  bold?: boolean;

  /** The `italic` flag as written: true for `italic` or `(italic yes)`, false for `(italic no)`. Absent when not written. */
  italic?: boolean;

  /** The `(line_spacing …)` factor as written. Absent when not written. */
  lineSpacing?: float64;

  /** The `(color …)`. Absent when not written. */
  color?: BoardObjectsColor;
}

/** A font's `(size <height> <width>)`; a missing value is 0. */
model BoardObjectsFontSize {
  /** The first value: glyph height. */
  heightNm: NonNegativeNanometres;

  /** The second value: glyph width. */
  widthNm: NonNegativeNanometres;
}

/** A `(color <r> <g> <b> [<a>])` as written. */
model BoardObjectsColor {
  /** Red, 0 to 255. */
  red: float64;

  /** Green, 0 to 255. */
  green: float64;

  /** Blue, 0 to 255. */
  blue: float64;

  /** Alpha, 0 to 1. Absent when not written; readers then use 1. */
  alpha?: float64;
}

/** A text's `(justify …)` as today's index reads it. */
model BoardObjectsJustify {
  /** Horizontal justification. */
  horizontal: BoardObjectsHorizontalJustify;

  /** Vertical justification. */
  vertical: BoardObjectsVerticalJustify;

  /** True when the justify form contains `mirror`. */
  mirror: boolean;
}

// ------------------------------------------------------- review-only objects

/** A settings or definition object with no KiCad uuid, reviewed only by its fields (`ecad-parse.mjs:533-551`, `:553-858`, `:1051-1066`, `:1586-1591`). */
model BoardObjectsReviewOnlyObject {
  /** Kind of object. */
  kind: BoardObjectsReviewOnlyKind;

  /** The object's id; with the document path it forms Design Comparison's key `<path>#<id>`. */
  id: BoardObjectsReviewOnlyId;

  /** The object's display name: the class name, net pattern, rule name, alias name, exclusion label, pin-type pair, or the fixed name of a singleton kind. */
  @minLength(1)
  name: string;

  /** Review fields, serialized with keys in code point order; keys are review labels, which for the settings kinds are derived from KiCad's own setting keys (field map, "Review fields"). Never empty except for a `net-class` whose class sets no value. */
  reviewFields: Record<BoardObjectsReviewValue>;
}

// ------------------------------------------------------------ review values

/**
 * One review-field value, as Design Comparison shows it: the value today's
 * index writes, unconverted (lengths stay the millimetres the file writes,
 * flags stay booleans, `Size` stays a `w × h` text). A presentation value,
 * not a typed fact: typed lengths of this member are the `…Nm` fields. A
 * value of any other shape is written as its canonical JSON text (field
 * map).
 */
union BoardObjectsReviewValue {
  /** A text. */
  text: string,

  /** A number as today's index writes it. */
  number: float64,

  /** A flag. */
  flag: boolean,

  /** A list of texts, in the order today's index writes them. */
  texts: string[],

  /** A list of numbers, in the order today's index writes them. */
  numbers: float64[],

  /** One table of settings (for example a teardrop parameter set). */
  table: BoardObjectsReviewTable,

  /** A list of tables, in the order today's index writes them. */
  tables: BoardObjectsReviewTable[],
}

/** A flat table of settings; keys are KiCad's setting keys as written, serialized in code point order. */
model BoardObjectsReviewTable is Record<BoardObjectsReviewScalar>;

/** One scalar in a settings table. */
union BoardObjectsReviewScalar {
  /** A text. */
  text: string,

  /** A number. */
  number: float64,

  /** A flag. */
  flag: boolean,
}
