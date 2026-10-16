import "@typespec/json-schema";
import "./common.tsp";
import "./compare-font-a0.tsp";
import "./board-objects-a0.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;
using Prism.Contracts.CompareFontA0;
using Prism.Contracts.BoardObjectsA0;

/**
 * The output document of `prism-kicad compare` (`-o`, cli-spec.md §5.6), schema
 * `prism.compare.object_delta.a0`: Design Comparison's object diff between two
 * bundles' `projections/board-objects.json`.
 *
 * It is a **parity document** (conventions.md §3–§5, §14): every field keeps
 * today's name, today's millimetre number and today's kind spelling (`sheet_pin`
 * for the bundle's `sheet-pin`), so `_node_changes`
 * (`backend/app/services/design_compare_nodes.py:417`), `_hydrate_native_targets`
 * (`:425`) and `revision_components`
 * (`backend/app/services/design_compare_occurrences.py:129`) read it unchanged.
 * It is today's `prism.ecad_object_delta_v1`
 * (`backend/design-compare-parser/ecad-diff.mjs`), changed only as the ADR
 * amendment C2 §4 lists: `base` and `head` carry `bundleKey`; `root`, `timings`,
 * `routeMetrics`, `peakRssBytes` and `node` are dropped; `changes` is sorted by
 * `key` in code point order and a property-delta list by `name` in code point
 * order (D1, D2).
 *
 * `from`/`to` of a property or review delta reuse `BoardObjectsReviewValue`,
 * today's review value union (a text, a number, a flag, and lists and tables of
 * those). The field map (`field-maps/compare.md`) gives every field's source and
 * the exact differences from today's document.
 */
namespace Prism.Contracts.CompareA0;

// -------------------------------------------------------------------- enums

/**
 * Kind of an object, in today's spelling: the bundle kind
 * (`BoardObjectsObject`, `BoardObjectsReviewOnlyKind`) with every `-` written
 * `_`.
 */
enum CompareObjectDeltaKind {
  /** A placed schematic symbol. */
  symbol,

  /** A pin instance of a placed symbol. */
  pin,

  /** A hierarchical sheet. */
  sheet,

  /** A sheet pin, the bundle's `sheet-pin`. */
  sheetPin: "sheet_pin",

  /** A schematic wire. */
  wire,

  /** A schematic bus. */
  bus,

  /** A junction dot. */
  junction,

  /** A no-connect flag. */
  noConnect: "no_connect",

  /** A bus entry. */
  busEntry: "bus_entry",

  /** A net label of any scope. */
  label,

  /** A drawing that is not part of a footprint. */
  graphic,

  /** A schematic bitmap. */
  image,

  /** A schematic table. */
  table,

  /** A footprint placed on the board. */
  footprint,

  /** A footprint pad. */
  pad,

  /** A copper zone or rule area. */
  zone,

  /** A footprint drawing, the bundle's `footprint-graphic`. */
  footprintGraphic: "footprint_graphic",

  /** A footprint text, the bundle's `footprint-text`. */
  footprintText: "footprint_text",

  /** A straight track. */
  track,

  /** A board arc track. */
  arc,

  /** A via. */
  via,

  /** A board group. */
  group,

  /** One net class of the `.kicad_pro`. */
  netClass: "net_class",

  /** One net-to-class assignment. */
  netClassAssignment: "net_class_assignment",

  /** The board design rules of the `.kicad_pro`. */
  boardConstraint: "board_constraint",

  /** The DRC severities of the `.kicad_pro`. */
  drcSeverity: "drc_severity",

  /** The routing presets of the `.kicad_pro`. */
  routingPreset: "routing_preset",

  /** The board drawing defaults of the `.kicad_pro`. */
  boardDefault: "board_default",

  /** The teardrop options of the `.kicad_pro`. */
  teardropSetting: "teardrop_setting",

  /** The zone settings of the `.kicad_pro`. */
  zoneSetting: "zone_setting",

  /** One DRC exclusion. */
  drcExclusion: "drc_exclusion",

  /** One ERC exclusion. */
  ercExclusion: "erc_exclusion",

  /** One ERC pin-conflict rule. */
  ercPinRule: "erc_pin_rule",

  /** The project text variables. */
  projectMetadata: "project_metadata",

  /** One custom rule of a `.kicad_dru`. */
  customRule: "custom_rule",

  /** The fabrication-output settings of a `.kicad_pcb`. */
  fabricationOutput: "fabrication_output",

  /** One bus alias of a `.kicad_sch`. */
  busAlias: "bus_alias",
}

/** How an entry relates the two sides. */
enum CompareObjectDeltaStatus {
  /** The object is only in `--head`. */
  added,

  /** The object is only in `--base`. */
  removed,

  /** The object is in both sides and its content differs. */
  modified,

  /** The object is in both sides, matched across a UUID change or a generated-content change only. */
  ignored,
}

/**
 * Why a `modified` change was classified, or why an object is in `ignored`.
 * The classifier reasons are `CLASSIFIERS` plus `properties-changed` and
 * `content-changed` (`ecad-diff.mjs:32-46`, `:415-435`).
 */
enum CompareObjectDeltaReason {
  /** The object's `at` differs. */
  moved,

  /** The object's `rotation` differs (`0` when absent). */
  rotated,

  /** The object's `mirror` differs. */
  mirrored,

  /** The object's `layer` differs, the bundle's `layer-changed`. */
  layerChanged: "layer-changed",

  /** The object's `net` differs, the bundle's `net-changed`. */
  netChanged: "net-changed",

  /** The object's `refdes` differs. */
  renamed,

  /** The object's `libId` differs, the bundle's `lib-changed`. */
  libChanged: "lib-changed",

  /** The object's `dnp` differs (`false` when absent), the bundle's `dnp-changed`. */
  dnpChanged: "dnp-changed",

  /** The object's `kiidPaths` differ, the bundle's `re-pathed`. */
  rePathed: "re-pathed",

  /** A property or review-field delta changed, the bundle's `properties-changed`. */
  propertiesChanged: "properties-changed",

  /** The content changed with no positional, identity or property classifier, the bundle's `content-changed`. */
  contentChanged: "content-changed",
}

/** Why a matched object is only in `ignored` (`ecad-diff.mjs:390-411`). */
enum CompareObjectDeltaIgnoredReason {
  /** The two objects have equal authored content; only UUIDs churned. */
  internalIdentityOnly: "internal-identity-only",

  /** The two objects have equal authored content; only KiCad-generated content changed. */
  generatedContentOnly: "generated-content-only",
}

// ------------------------------------------------------------------- models

/**
 * One object as today's index carries it, without `properties`: the fields
 * `native_object` spreads into a change and the fields of `componentObjects`
 * (`ecad-diff.mjs:194-220`). Every field is optional except `uuid`, `kind` and
 * `documentPath`, because `native_object` emits a field only when the object
 * has it.
 */
model CompareNativeObjectFields {
  /**
   * The object's id: its KiCad uuid, or a review-only object's synthetic id
   * (`BoardObjectsReviewOnlyId`). With `documentPath` it forms `key`.
   */
  uuid: string;

  /** Kind of object, today's spelling. */
  kind: CompareObjectDeltaKind;

  /**
   * The document's path, project-relative (D1), for example
   * `mini_obc.kicad_pcb`. With `uuid` it forms `key`.
   */
  documentPath: string;

  /** Uuid of the object's parent (a pad's footprint, a pin's symbol, ...). Absent when there is none. */
  parentUuid?: KiCadUuid;

  /** The object's position `[x, y]` in millimetres, in that order, in the frame today's index uses for its kind. Absent when the kind has no position. */
  at?: CompareMmPoint;

  /** The object's rotation in degrees as written, `0` when the form omits it. Absent when the kind has no rotation. */
  rotation?: float64;

  /** How a symbol is mirrored. Absent when it is not mirrored. */
  mirror?: CompareObjectDeltaMirror;

  /** The object's layer as written. Absent when the form has none. */
  layer?: string;

  /** A via's `(layers …)` entries, in file order. Absent unless the object has layers. */
  layers?: string[];

  /** The object's net, by name. Absent when it has no net. */
  net?: string;

  /** The object's reference designator. Absent when it has none or it is empty. */
  refdes?: string;

  /** The object's library link as written. Absent when it has none. */
  libId?: string;

  /** True when the object is do-not-populate. Absent when the kind has no DNP flag. */
  dnp?: boolean;

  /** False when the object is excluded from the BOM. Absent when the kind has no such flag. */
  inBom?: boolean;

  /** False when the object is not on the board. Absent when the kind has no such flag. */
  onBoard?: boolean;

  /** Every occurrence path of a symbol or sheet, schematic form, sorted in code point order. Absent when the kind has none. */
  kiidPaths?: string[];

  /** A symbol's instances, in file order. Absent when the kind has none. */
  instances?: CompareSymbolInstanceA0[];

  /** A pad's or pin's number as written; may be empty. Absent when the form has none. */
  number?: string;

  /** A label's, sheet pin's or footprint text's text as written. Absent when the form has none. */
  text?: string;

  /** A zone's, group's or review-only object's name. Absent when the form has none. */
  name?: string;

  /** Review fields, with keys in code point order; the keys are review labels. Absent when the kind has none. */
  reviewFields?: Record<BoardObjectsReviewValue>;

  /** True for a review-only object. Absent for an object with a KiCad uuid. */
  reviewOnly?: boolean;
}

/** How a schematic symbol is mirrored, today's parser spelling. */
enum CompareObjectDeltaMirror {
  /** Mirrored about the horizontal axis. */
  x,

  /** Mirrored about the vertical axis. */
  y,
}

/**
 * A point in millimetres, `[x, y]` in that order, as today's index writes it.
 * No rounding: it is the parsed value.
 */
@minItems(2)
@maxItems(2)
model CompareMmPoint is float64[];

/** One `(path …)` instance of a placed symbol (`ecad-diff.mjs` `instances`). */
model CompareSymbolInstanceA0 {
  /** The instance's reference. Absent when it has none or it is empty. */
  reference?: string;

  /** The occurrence path, schematic form. Absent for a `default_instance` entry. */
  path?: string;
}

/** One object as `native_object` carries it (`ecad-diff.mjs:194-220`), for `componentObjects`, `base` and `compare`. */
model CompareNativeObjectA0 {
  ...CompareNativeObjectFields;

  /**
   * The object's own `(property …)` fields, in file order: a schematic
   * symbol's or sheet's properties, or a footprint's fields. Absent when the
   * kind has none.
   */
  properties?: CompareObjectPropertyA0[];
}

/** One object, as `native_target` carries it (`ecad-diff.mjs:222-230`), for `nativeObjects`. */
model CompareNativeTargetA0 {
  /** The object's id. */
  uuid: string;

  /** Kind of object. */
  kind: CompareObjectDeltaKind;

  /** The document's project-relative path. */
  documentPath: string;

  /** Uuid of the parent. Absent when there is none. */
  parentUuid?: KiCadUuid;

  /** The object's `[x, y]` position in millimetres, in that order. Absent when it has none. */
  at?: CompareMmPoint;
}

/** One `(property "Name" "value" …)` field of a symbol, sheet or footprint, as today's index carries it. */
model CompareObjectPropertyA0 {
  /** The field name. */
  name: string;

  /** The field value as written; may be empty. */
  value: string;

  /** The field's `[x, y]` position in millimetres, in that order. Absent when the form has none. */
  at?: CompareMmPoint;

  /** The field's rotation in degrees as written. Present exactly when the field is at a position. */
  rotation?: float64;

  /** True when the field is hidden. Absent unless the form hides it. */
  hide?: boolean;

  /** The field's text effects. Absent when the form has none. */
  effects?: CompareTextEffectsA0;
}

/** A text's `(effects …)` as the vendored parser reads it. */
model CompareTextEffectsA0 {
  /** The `(font …)`. Absent when the effects have none. */
  font?: CompareTextFontA0;

  /** The `(justify …)`. Absent when the effects have none. */
  justify?: CompareTextJustifyA0;

  /** True when the effects carry a bare `hide`. Absent when it is not written. */
  hide?: boolean;

  /** The `(href …)` as written. Absent when it is not written. */
  href?: string;
}

/** A text's `(justify …)` as today's parser reads it. */
model CompareTextJustifyA0 {
  /** Horizontal justification. */
  horiz: CompareJustifyHorizontalA0;

  /** Vertical justification. */
  vert: CompareJustifyVerticalA0;

  /** True when the justify form contains `mirror`. */
  mirror: boolean;
}

/** Horizontal justification of a text. */
enum CompareJustifyHorizontalA0 {
  /** `left` as written. */
  left,

  /** `right` as written. */
  right,

  /** Neither is written. */
  center,
}

/** Vertical justification of a text. */
enum CompareJustifyVerticalA0 {
  /** `top` as written. */
  top,

  /** `bottom` as written. */
  bottom,

  /** Neither is written. */
  center,
}

/**
 * One property or review-field delta (`ecad-diff.mjs` `property_deltas` and
 * `review_field_deltas`). A property delta also carries `attributesChanged` and
 * `fromAttributes`/`toAttributes`; a review-field delta carries only `name`,
 * `from` and `to`.
 */
model CompareObjectPropertyDeltaA0 {
  /** The property or review-field name. */
  name: string;

  /** The base value: a text, a number, a flag, a list (in the order today's index writes it) or a table (keys are KiCad's setting keys). Absent when the property or field is only in the head side. */
  from?: BoardObjectsReviewValue;

  /** The head value: a text, a number, a flag, a list (in the order today's index writes it) or a table (keys are KiCad's setting keys). Absent when the property or field is only in the base side. */
  to?: BoardObjectsReviewValue;

  /** True when a property that is present on both sides only moved or was hidden. Absent for a review-field delta. */
  attributesChanged?: boolean;

  /** The base property's attributes. Absent for a review-field delta, or when the property is only in the head side. */
  fromAttributes?: ComparePropertyAttributesA0;

  /** The head property's attributes. Absent for a review-field delta, or when the property is only in the base side. */
  toAttributes?: ComparePropertyAttributesA0;
}

/** The attributes `attributesChanged` compares (`ecad-diff.mjs:248-263`). */
model ComparePropertyAttributesA0 {
  /** The property's `[x, y]` position in millimetres, in that order. Absent when it has none. */
  at?: CompareMmPoint;

  /** The property's rotation in degrees. Absent when it has none. */
  rotation?: float64;

  /** True when the property is hidden; false otherwise. */
  hide: boolean;

  /** The property's text effects. Absent when it has none. */
  effects?: CompareTextEffectsA0;
}

/** A moved object's position deltas (`ecad-diff.mjs:322-332`), in millimetres. */
model ComparePositionDeltaA0 {
  /** Change in x, rounded to 1e-6 mm. */
  dx: float64;

  /** Change in y, rounded to 1e-6 mm. */
  dy: float64;

  /** `Math.hypot(dx, dy)`, rounded to 1e-6 mm. */
  distance: float64;
}

/** One entry of `changes`: an added, removed or modified object. */
model CompareObjectDeltaChangeA0 {
  /** The object's key, `<documentPath>#<uuid>`. */
  key: string;

  /** How the object relates the two sides; never `ignored` here. */
  status: CompareObjectDeltaStatus;

  ...CompareNativeObjectFields;

  /**
   * The object's property-delta list
   * (`CompareObjectPropertyDeltaA0`), sorted by `name` in code point order,
   * not the object's own property list. Absent when there is no delta.
   */
  properties?: CompareObjectPropertyDeltaA0[];

  /** The `base`-side object (`modified` and `removed` only). Absent for `added`. */
  base?: CompareNativeObjectA0;

  /** The `head`-side object (`added` and `modified` only). Absent for `removed`. */
  compare?: CompareNativeObjectA0;

  /** The base object's position in millimetres, `[x, y]` in that order (`modified` only). Absent when it has none. */
  atBase?: CompareMmPoint;

  /** The classifier reasons, in the order the classifiers run (`modified` only). Absent for `added` and `removed`. */
  reasons?: CompareObjectDeltaReason[];

  /** The object's move (`modified` only). Absent when it did not move or has no position. */
  positionDelta?: ComparePositionDeltaA0;
}

/** One entry of `ignored`: an object matched across a UUID or generated-content change. */
model CompareObjectDeltaIgnoredA0 {
  /** The object's key, `<documentPath>#<uuid>`. */
  key: string;

  /** Always `ignored`. */
  status: CompareObjectDeltaStatus;

  /** Why the object is ignored. */
  reason: CompareObjectDeltaIgnoredReason;

  ...CompareNativeObjectFields;

  /** The object's own `(property …)` fields, in file order. Absent when the kind has none. */
  properties?: CompareObjectPropertyA0[];
}

/** The change counts of a comparison (`ecad-diff.mjs:469-477`). */
model CompareObjectDeltaCountsA0 {
  /** Objects only in `--head`. */
  added: Count;

  /** Objects only in `--base`. */
  removed: Count;

  /** Objects in both whose content differs. */
  modified: Count;

  /** Objects in both with equal content, the ignored ones included. */
  unchanged: Count;

  /** Objects matched across a UUID change or with only generated content changed. */
  ignored: Count;

  /** Objects in `--base`. */
  baseObjects: Count;

  /** Objects in `--head`. */
  headObjects: Count;
}

/** Per-kind change counts (`ecad-diff.mjs:455-463`). */
model CompareObjectDeltaKindCountsA0 {
  /** Added objects of this kind. */
  added: Count;

  /** Removed objects of this kind. */
  removed: Count;

  /** Modified objects of this kind. */
  modified: Count;
}

/** One side of the comparison. */
model CompareObjectDeltaSideA0 {
  /** The side's bundle key, computed from its manifest's revision key and generator id (cli-spec.md §5.1.4). */
  bundleKey: Sha256Hex;

  /** How many objects the side's `board-objects.json` holds, review-only objects included. */
  objects: Count;

  /** Every addressable object of the side, in the side's index object order. */
  nativeObjects: CompareNativeTargetA0[];

  /** Every symbol and footprint of the side, in the side's index object order. */
  componentObjects: CompareNativeObjectA0[];
}

/**
 * Design Comparison's object diff between two bundles (`prism-kicad compare`
 * `-o`).
 */
@jsonSchema
@id("urn:prism:schema:prism.compare.object_delta:a0")
@extension("title", "Compare object delta a0")
model CompareObjectDeltaA0 {
  /** Document schema id. */
  schema: "prism.compare.object_delta.a0";

  /** The `--base` side. */
  base: CompareObjectDeltaSideA0;

  /** The `--head` side. */
  head: CompareObjectDeltaSideA0;

  /** Added, removed and modified objects, sorted by `key` in code point order (D2). */
  changes: CompareObjectDeltaChangeA0[];

  /**
   * Objects matched across a UUID or generated-content change, in head object
   * order (today's order; Design Comparison compares it as a set).
   */
  ignored: CompareObjectDeltaIgnoredA0[];

  /** The change counts. */
  counts: CompareObjectDeltaCountsA0;

  /** Per-kind change counts; the keys are `CompareObjectDeltaKind` values, in code point order. */
  byKind: Record<CompareObjectDeltaKindCountsA0>;

  /** Change counts per reason; the keys are `CompareObjectDeltaReason` values, in code point order. */
  byReason: Record<Count>;
}
