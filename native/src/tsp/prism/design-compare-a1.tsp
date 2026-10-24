import "@typespec/json-schema";
import "./common.tsp";
import "./board-objects-a0.tsp";
import "./kicad-project-diff-v1.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;
using Prism.Contracts.BoardObjectsA0;
using Prism.Contracts.KicadProjectDiffV1;

/**
 * The output document of `prism-kicad compare` (`-o`, cli-spec.md §5.6), schema
 * `prism.design_compare.result.a1`: every Design Comparison tab except
 * fabrication, computed in Rust from two bundles or source trees (ADR
 * amendment C2r).
 *
 * It replaces the backend's `prism.semantic_comparison_v3` for new
 * comparisons. Until R1 removes the backend's legacy path, the frontend reads
 * a v3 result into this shape (`legacy-v3-result.ts`). The backend adds
 * fabrication and stores the result as the job's artifact.
 *
 * a1 differs from a0 only by `details.targets`: the review list reads the
 * targets' kinds, roles and references, which a0 left out (C2r step 6). a0 is
 * removed; no stored bundle holds a comparison result.
 *
 * `projectDiff` is ecad-viewer's input in ecad-viewer's own format
 * (`kicad-project-diff-v1.tsp`). Every other field follows the conventions:
 * camelCase, lengths in integer nanometres, angles in degrees, unknown values
 * omitted. The field map (`field-maps/design-compare.md`) gives each of
 * today's fields' fate.
 */
namespace Prism.Contracts.DesignCompareA1;

// -------------------------------------------------------------------- enums

/** The tab a change belongs to. */
enum DesignCompareDomain {
  /** The Schematic tab. */
  schematic,

  /** The PCB tab. */
  pcb,
}

/** What a change does, in the review's vocabulary. */
enum DesignCompareChangeKind {
  /** Only in the head revision. */
  added,

  /** Only in the base revision. */
  removed,

  /** In both revisions, and different. */
  changed,
}

/** The review category of a change (`frontend/src/lib/diff-grouping`). */
enum DesignCompareCategory {
  /** Design rules and constraints. */
  rules,

  /** Symbols and footprints of components. */
  components,

  /** Nets, net labels and connectivity. */
  nets,

  /** Board outline, setup and stackup. */
  board,

  /** Copper zones and rule areas. */
  zones,

  /** Lines, shapes, images and tables. */
  graphics,

  /** Schematic symbols that are not components (power, graphical). */
  symbols,

  /** Hierarchical sheets and sheet pins. */
  sheets,

  /** Text and text boxes. */
  text,

  /** Anything else. */
  other,
}

/** How prominently a change is reviewed. */
enum DesignCompareClassification {
  /** An authored design decision; shown in the main review list. */
  primary,

  /** A consequence or detail of another change; grouped under it. */
  secondary,
}

/** Why an object counts as changed. Several may apply. */
enum DesignCompareReason {
  /** The object is new. */
  objectAdded: "object-added",

  /** The object is gone. */
  objectRemoved: "object-removed",

  /** A symbol's fields changed. */
  symbolFieldsChanged: "symbol-fields-changed",

  /** A symbol instance was replaced by another. */
  instanceReplaced: "instance-replaced",

  /** The number of instances changed. */
  instanceCountChanged: "instance-count-changed",

  /** The object moved to another sheet. */
  sheetChanged: "sheet-changed",

  /** A net was renamed. */
  netRenamed: "net-renamed",

  /** A net's terminals changed. */
  connectivityChanged: "connectivity-changed",

  /** The number of a net's labels changed. */
  labelCountChanged: "label-count-changed",

  /** A net joined or left a bus. */
  busMembershipChanged: "bus-membership-changed",

  /** The object moved. */
  moved,

  /** The object rotated. */
  rotated,

  /** The object was mirrored. */
  mirrored,

  /** The object's layer changed. */
  layerChanged: "layer-changed",

  /** The object's net changed. */
  netChanged: "net-changed",

  /** The object's name or reference changed. */
  renamed,

  /** The object's library link changed. */
  libChanged: "lib-changed",

  /** The object's do-not-populate flag changed. */
  dnpChanged: "dnp-changed",

  /** The object's occurrence path changed. */
  rePathed: "re-pathed",

  /** One or more properties changed. */
  propertiesChanged: "properties-changed",

  /** The object's content changed in a way no other reason names. */
  contentChanged: "content-changed",
}

/** The state of one BOM row. */
enum DesignCompareBomStatus {
  /** The reference exists only in the head revision. */
  added,

  /** The reference exists only in the base revision. */
  removed,

  /** The reference's fields differ. */
  changed,

  /** The reference is the same; listed only when unchanged rows are requested. */
  unchanged,
}

// ------------------------------------------------------------------ models

/** One revision of the comparison. */
model DesignCompareRevision {
  /** The revision key of the commit (revision-key.md). */
  revisionKey: Sha256Hex;

  /** The bundle key the revision was read from. Absent when it was read from its source tree. */
  bundleKey?: Sha256Hex;

  /** The project file the revision was compared by (`config.project_file`). */
  projectFile: RepoPath;
}

/** One KiCad source file of a revision, as the file list and the overlay show it. */
model DesignCompareSourceFile {
  /** The file's path relative to the project directory (amendment C2 D1). */
  path: string;

  /** The file's name. */
  filename: string;
}

/** The KiCad source files of both revisions. */
model DesignCompareFiles {
  /** The base revision's `.kicad_sch`, `.kicad_pcb` and `.kicad_pro` files, sorted by `path` in code point order. */
  base: DesignCompareSourceFile[];

  /** The head revision's files, in the same order. */
  head: DesignCompareSourceFile[];
}

/** One side's old and new value of a changed field. */
model DesignCompareFieldDelta {
  /** The base revision's value: a text, number or flag; a list in the order the object writes it; or a table whose keys are KiCad's setting keys, in code point order. Absent when the base has none. */
  old?: BoardObjectsReviewValue;

  /** The head revision's value, encoded as `old` is (lists in the order the object writes them; table keys are KiCad's setting keys, in code point order). Absent when the head has none. */
  new?: BoardObjectsReviewValue;
}

/** Terminals a net gained and lost. */
model DesignCompareConnectivity {
  /** Terminals (`<reference>.<pin>`) only on the head side, sorted in code point order. */
  addedTerminals: string[];

  /** Terminals only on the base side, sorted in code point order. */
  removedTerminals: string[];
}

/** A count on both sides. */
model DesignCompareCountDelta {
  /** The base revision's count. */
  old: Count;

  /** The head revision's count. */
  new: Count;
}

/** A sheet on both sides. */
model DesignCompareSheetDelta {
  /** The base revision's sheet path. Absent when the base has none. */
  old?: string;

  /** The head revision's sheet path. Absent when the head has none. */
  new?: string;
}

/** Review evidence of a change beyond its fields. */
model DesignCompareChangeDetails {
  /** True when the change has no object ecad-viewer can paint (for example a project setting). Absent means false. */
  reviewOnly?: true;

  /** A net's terminal changes. Absent for a change that is not a net. */
  connectivity?: DesignCompareConnectivity;

  /** The number of instances of a symbol. Absent when it did not change. */
  instanceCount?: DesignCompareCountDelta;

  /** The number of labels of a net. Absent when it did not change. */
  labelInstances?: DesignCompareCountDelta;

  /** The sheet the object is on. Absent when it did not change. */
  sheetChange?: DesignCompareSheetDelta;

  /** The objects ecad-viewer highlights for the change: base-side targets first, then head-side, each in the order the change's evidence lists them (field map, "Targets"). One entry per object and sheet instance. Absent when there are none, as for a change with `reviewOnly`. */
  targets?: DesignCompareTarget[];
}

/** The pane a target is drawn in. */
enum DesignCompareSide {
  /** The base revision's pane. */
  base,

  /** The head revision's pane. */
  head,
}

/** How a target is drawn and reviewed: the object's own kind, or the part it plays in the change (a net's `terminal`, a component's `component`). */
enum DesignCompareTargetRole {
  /** A component the object belongs to, drawn as the whole part. */
  component,

  /** A schematic wire. */
  wire,

  /** A schematic bus or bus alias. */
  bus,

  /** A bus entry. */
  busEntry: "bus-entry",

  /** A net label, or a power symbol drawn as one. */
  label,

  /** A junction dot. */
  junction,

  /** A net's terminal: the pin of a component the net connects. */
  terminal,

  /** A hierarchical sheet instance. */
  sheet,

  /** A hierarchical sheet pin. */
  sheetPin: "sheet-pin",

  /** A schematic symbol. */
  symbol,

  /** A no-connect flag. */
  noConnect: "no-connect",

  /** An authored drawing. */
  graphic,

  /** A footprint. */
  footprint,

  /** A footprint pad. */
  pad,

  /** A track segment. */
  track,

  /** A track arc. */
  arc,

  /** A via. */
  via,

  /** A zone. */
  zone,

  /** A footprint's drawing. */
  footprintGraphic: "footprint-graphic",

  /** A footprint's text. */
  footprintText: "footprint-text",

  /** An image. */
  image,

  /** A table. */
  table,

  /** A group. */
  group,

  /** A net class. */
  netClass: "net-class",

  /** A net class assignment. */
  netClassAssignment: "net-class-assignment",
}

/** One object ecad-viewer highlights for a change. The review list reads the targets' kinds, roles, documents, positions and references; `projectDiff` is built from the same targets. */
model DesignCompareTarget {
  /** The pane the object is drawn in: `base` for the base revision's object, `head` for the head's. */
  side: DesignCompareSide;

  /** The object's native identity in that revision: its UUID, or for a terminal its pin's UUID (its symbol's when the pin has none). */
  sourceId: string;

  /** The object's kind as the board-objects member names it, for example `pin` or `sheet-pin`. Absent when the target is only a role (a net's terminal with no pin object of its own). */
  kind?: string;

  /** How the object is drawn. Absent when it has no role beyond its `kind`. */
  role?: DesignCompareTargetRole;

  /** The document the object is in, relative to the project directory. Absent when it is not known. */
  documentPath?: string;

  /** The object's position. Absent for an object without one. */
  at?: PointNm;

  /** The sheet instance path of a schematic object (`/` for the root sheet). Absent on the board, and for a schematic object whose instance is not known. */
  sheetPath?: string;

  /** The component reference designator the object belongs to. Absent when it belongs to none. */
  reference?: Refdes;
}

/** One side of a changed object: where it is in that revision. */
model DesignCompareChangeSide {
  /** The object's native identity in this revision: its UUID, or for a net, the source id of its first labelled item. */
  sourceId: string;

  /** The parent object's UUID (a pad's footprint, a pin's symbol). Absent for a top-level object. */
  parentSourceId?: KiCadUuid;

  /** The document the object is in, relative to the project directory. */
  documentPath: string;

  /** The object's layer as written. Absent for an object without one. */
  layer?: LayerName;

  /** Every layer the object occupies in this revision, sorted in code point order. Empty for a schematic object. */
  layers: LayerName[];

  /** The object's position. Absent for an object without one (a net, a zone). */
  at?: PointNm;

  /** The object's reference designator in this revision. Absent when it has none. */
  reference?: Refdes;

  /** The object's net in this revision. Absent when it has none. */
  net?: NetName;
}

/** One change in the Schematic or PCB tab. */
model DesignCompareChange {
  /** The change's id, stable for the same pair; the key of `projectDiff.navigation`. */
  id: string;

  /** The tab the change belongs to. */
  domain: DesignCompareDomain;

  /** What the change does. */
  kind: DesignCompareChangeKind;

  /** The review category. */
  category: DesignCompareCategory;

  /** How prominently it is reviewed. */
  classification: DesignCompareClassification;

  /** The review list's text for the change. */
  label: string;

  /** The object's kind as the board-objects member names it, for example `footprint` or `sheet-pin`. Absent for a net-level change. */
  objectKind?: string;

  /** The component's reference designator. Absent when the change is not about a component. */
  reference?: Refdes;

  /** The net the change is about. Absent when it is not about a net. */
  net?: NetName;

  /** The identity that groups changes of one design entity (component, net or object) across tabs. Absent when the change has none. */
  semanticId?: string;

  /** The document the review list files the change under, relative to the project directory. Absent when the change has none (a project setting). */
  page?: string;

  /** Why the object counts as changed, in classification order. Never empty. */
  reasons: DesignCompareReason[];

  /** Keys are field display names (for example `Position`, `Net`, `Value`); each holds the changed field's old and new value. Empty when no field changed. */
  fields: Record<DesignCompareFieldDelta>;

  /** Review evidence beyond the fields. */
  details: DesignCompareChangeDetails;

  /** Where the object is in the base revision. Absent for an added object. */
  base?: DesignCompareChangeSide;

  /** Where the object is in the head revision. Absent for a removed object. */
  head?: DesignCompareChangeSide;
}

/** The changes of one tab. */
model DesignCompareChanges {
  /** The tab's changes, sorted by `id` in code point order. */
  changes: DesignCompareChange[];
}

/** Added, removed and changed counts. */
model DesignCompareSummary {
  /** Added entries. */
  added: Count;

  /** Removed entries. */
  removed: Count;

  /** Changed entries. */
  changed: Count;
}

/** One field of a changed BOM row. */
model DesignCompareBomFieldDiff {
  /** The base revision's text. */
  old: string;

  /** The head revision's text. */
  new: string;
}

/** One BOM row, keyed by reference designator. */
model DesignCompareBomRow {
  /** The reference designator. */
  ref: Refdes;

  /** The row's state. */
  status: DesignCompareBomStatus;

  /** Keys are BOM column names; the base revision's text of each. Absent for an added row. */
  old?: Record<string>;

  /** Keys are BOM column names; the head revision's text of each. Absent for a removed row. */
  new?: Record<string>;

  /** Keys are BOM column names; only the columns that differ. Absent for an added, removed or unchanged row. */
  diffs?: Record<DesignCompareBomFieldDiff>;
}

/** The BOM tab. */
model DesignCompareBom {
  /** The BOM columns shown, in display order. */
  fields: string[];

  /** The BOM rows, sorted by `ref` in code point order. */
  changes: DesignCompareBomRow[];

  /** Row counts. */
  summary: DesignCompareSummary;
}

/** One stackup form, as the Stackup tab shows it (`field-maps/stackup.md` DC rules: sub-layers folded to forms). */
model DesignCompareStackupLayer {
  /** The layer's name. */
  name: string;

  /** The layer's KiCad type, for example `copper` or `prepreg`. Absent when the board writes none. */
  type?: string;

  /** The layer's thickness. Absent when the board writes none or writes 0. */
  thicknessNm?: Nanometres;

  /** The layer's material. Absent when the board writes none. */
  material?: string;

  /** The layer's colour. Absent when the board writes none. */
  color?: string;

  /** The relative permittivity. Absent when the board writes none. */
  epsilonR?: float64;

  /** The loss tangent. Absent when the board writes none. */
  lossTangent?: float64;
}

/** One revision's stackup settings. */
model DesignCompareStackupSettings {
  /** The copper finish. Absent when the board writes none. */
  copperFinish?: string;

  /** Whether impedance-controlled dielectric constraints are on. Absent when the board has no stackup. */
  dielectricConstraints?: boolean;
}

/** The Stackup tab. */
model DesignCompareStackup {
  /** True when either revision has a stackup. */
  present: boolean;

  /** True when the two revisions' stackups or settings differ. */
  changed: boolean;

  /** The base revision's forms, in stack order from front to back. Empty without a stackup. */
  base: DesignCompareStackupLayer[];

  /** The head revision's forms, in stack order from front to back. Empty without a stackup. */
  head: DesignCompareStackupLayer[];

  /** The base revision's settings. */
  baseSettings: DesignCompareStackupSettings;

  /** The head revision's settings. */
  headSettings: DesignCompareStackupSettings;
}

/** One net's routing in one revision (`field-maps/route-metrics.md` C2 rules). */
model DesignCompareRouteMetric {
  /** The total centreline length of the net's tracks and arcs. */
  routeLengthNm: NonNegativeNanometres;

  /** The net's vias. */
  viaCount: Count;

  /** Every copper layer the net occupies, sorted in code point order. */
  usedLayers: LayerName[];

  /** The summed via barrel length. Absent when it is unreliable (a via span the stackup cannot measure). */
  viaBarrelLengthNm?: NonNegativeNanometres;
}

/** Route metrics of both revisions. */
model DesignCompareRouteMetrics {
  /** Keys are net names; the base revision's routed nets. */
  base: Record<DesignCompareRouteMetric>;

  /** Keys are net names; the head revision's routed nets. */
  head: Record<DesignCompareRouteMetric>;
}

/** Change counts per tab. */
model DesignCompareCounts {
  /** The Schematic tab's changes. */
  schematic: DesignCompareSummary;

  /** The PCB tab's changes. */
  pcb: DesignCompareSummary;

  /** The BOM tab's rows. */
  bom: DesignCompareSummary;
}

/**
 * Every Design Comparison tab except fabrication between two revisions
 * (`prism-kicad compare -o`).
 */
@jsonSchema
@id("urn:prism:schema:prism.design_compare.result:a1")
@extension("title", "Design compare result a1")
model DesignCompareResultA1 {
  /** Document schema id. */
  schema: "prism.design_compare.result.a1";

  /** The base (old) revision. */
  base: DesignCompareRevision;

  /** The head (new) revision. */
  head: DesignCompareRevision;

  /** The KiCad source files of both revisions. */
  files: DesignCompareFiles;

  /** The Schematic tab. */
  schematic: DesignCompareChanges;

  /** The PCB tab. */
  pcb: DesignCompareChanges;

  /** The BOM tab. */
  bom: DesignCompareBom;

  /** The Stackup tab. */
  stackup: DesignCompareStackup;

  /** Route metrics of both revisions, for the PCB tab's routing review. */
  routeMetrics: DesignCompareRouteMetrics;

  /** ecad-viewer's input: the native changes of both tabs, and the navigation from each change id. */
  projectDiff: KiCadProjectDiffBundleV1;

  /** Change counts per tab. */
  counts: DesignCompareCounts;
}
