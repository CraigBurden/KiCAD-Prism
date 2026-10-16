import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * `projections/stackup.json` (ADR §6, WP-P3): the board's physical stackup,
 * its fabrication settings, its board thickness, its layer table and its via
 * technology, as the `.kicad_pcb` states them. One document per bundle,
 * written at stage `parse` from the board file only.
 *
 * It is a superset of today's three stackup shapes: Release Studio's
 * `prism.release_studio.stackup.a0`, Design Comparison's `_extract_stackup`
 * and the 3D pipeline's `pcb_metadata.board.stackup`. Each is re-derived
 * from this document as `field-maps/stackup.md` describes. Values are as
 * written in the file: presentation defaults (palette colours, "FR4",
 * synthetic stacks) belong to the readers.
 */
namespace Prism.Contracts.StackupA0;

// ---------------------------------------------------------------- scalars

/** A stated, non-zero length in nanometres: at least 1. */
@minValue(1)
scalar StackupPositiveNanometres extends NonNegativeNanometres;

/** A count that is at least 1. */
@minValue(1)
scalar StackupPositiveCount extends Count;

// ------------------------------------------------------------------ enums

/**
 * Prism's classification of a stackup entry, from the entry's name alone
 * (KiCad types a stackup item by its layer, not by its `type` string): a
 * name ending in `.Cu` is copper; `F.Mask`/`B.Mask` solder mask;
 * `F.Paste`/`B.Paste` paste; `F.SilkS`/`B.SilkS` silkscreen; a name starting
 * with `dielectric` a dielectric; anything else other. Today's readers,
 * which classify by `type`, agree on every KiCad-written stackup.
 */
enum StackupLayerKind {
  /** A copper layer (`F.Cu`, `In<n>.Cu`, `B.Cu`). */
  copper,

  /** A dielectric (`dielectric <n>`), core or prepreg. */
  dielectric,

  /** A solder mask layer (`F.Mask`, `B.Mask`). */
  soldermask,

  /** A silkscreen layer (`F.SilkS`, `B.SilkS`). */
  silkscreen,

  /** A solder paste layer (`F.Paste`, `B.Paste`). */
  paste,

  /** A name KiCad does not write in a stackup; kept so that no entry is dropped. */
  other,
}

/**
 * The `(type "…")` of a stackup `(layer …)` form, spelled exactly as KiCad
 * writes it (`board_stackup.cpp`). The member names are TypeSpec identifiers
 * only; the JSON value is the KiCad string.
 */
enum StackupLayerType {
  /** `Top Silk Screen`, on `F.SilkS`. */
  topSilkScreen: "Top Silk Screen",

  /** `Top Solder Paste`, on `F.Paste`. */
  topSolderPaste: "Top Solder Paste",

  /** `Top Solder Mask`, on `F.Mask`. */
  topSolderMask: "Top Solder Mask",

  /** `copper`, on every copper layer. */
  copper: "copper",

  /** `core`, a dielectric core. */
  core: "core",

  /** `prepreg`, a dielectric prepreg. */
  prepreg: "prepreg",

  /** `Bottom Solder Mask`, on `B.Mask`. */
  bottomSolderMask: "Bottom Solder Mask",

  /** `Bottom Solder Paste`, on `B.Paste`. */
  bottomSolderPaste: "Bottom Solder Paste",

  /** `Bottom Silk Screen`, on `B.SilkS`. */
  bottomSilkScreen: "Bottom Silk Screen",
}

/**
 * The type token of one row of the board's `(layers …)` table, spelled as
 * KiCad writes it (`LAYER::ShowType`).
 */
enum StackupBoardLayerType {
  /** `signal`: a routing copper layer. */
  signal,

  /** `power`: a plane copper layer. */
  power,

  /** `mixed`: a mixed signal and plane copper layer. */
  mixed,

  /** `jumper`: a jumper copper layer. */
  jumper,

  /** `auxiliary`: an auxiliary user layer. */
  auxiliary,

  /** `front`: a user layer assigned to the front side. */
  front,

  /** `back`: a user layer assigned to the back side. */
  back,

  /** `user`: a technical or user layer. */
  user,
}

/**
 * The stackup's `(edge_connector …)` setting, spelled as KiCad writes it.
 * KiCad writes the token only for `yes` and `bevelled`; its absence is
 * `none`.
 */
enum StackupEdgeConnector {
  /** No edge connector: the token is absent (KiCad's `BS_EDGE_CONNECTOR_NONE`). */
  none,

  /** `(edge_connector yes)`: the board has edge-card connectors. */
  yes,

  /** `(edge_connector bevelled)`: the board has bevelled edge-card connectors. */
  bevelled,
}

/**
 * A via's technology: the bare header token of its `(via …)` form. KiCad
 * writes no token for a through via.
 */
enum StackupViaType {
  /** No `blind`, `buried` or `micro` token: a through via. */
  through,

  /** `(via blind …)`. KiCad 9 and earlier also write `blind` for a buried via. */
  blind,

  /** `(via buried …)`. */
  buried,

  /** `(via micro …)`. */
  micro,
}

// ----------------------------------------------------------------- models

/**
 * Projection of a board's stackup, fabrication settings, layer table and via
 * technology. All lengths are integer nanometres converted from the file's
 * millimetres as conventions.md §6 states.
 */
@jsonSchema
@id("urn:prism:schema:prism.stackup:a0")
@extension("title", "Stackup a0")
model StackupA0 {
  /** Schema id of this document. */
  schema: "prism.stackup.a0";

  /**
   * True when the board file has a `(setup (stackup …))` form, even an empty
   * one. False otherwise: `layers` is then empty, `settings` is absent and
   * `copperLayers` comes from the layer table.
   */
  present: boolean;

  /**
   * Board thickness from `(general (thickness …))`, in nanometres. KiCad's
   * default of 1.6 mm (1600000) when the file has no such form, as KiCad and
   * both parsers read it. This is the design setting, not the stackup sum
   * (`stackThicknessNm`); the two may differ.
   */
  boardThicknessNm: NonNegativeNanometres;

  /**
   * Sum of `thicknessNm` over every entry of `layers` whose kind is copper,
   * dielectric or soldermask, sub-layers included. Absent when `present` is
   * false, when `layers` has no such entry, or when any such entry has no
   * `thicknessNm`.
   */
  stackThicknessNm?: NonNegativeNanometres;

  /**
   * The stackup's entries in stack order from front to back: the order of
   * the `(layer …)` forms inside `(stackup …)`, which KiCad writes front to
   * back. A dielectric with `addsublayer` tokens contributes one entry per
   * sub-layer, consecutive and in file order, with `sublayer` 0, 1, 2, ….
   * Empty when `present` is false.
   */
  layers: StackupLayer[];

  /**
   * The board's copper layers in stack order from front to back. When
   * `present` is true: the names of the `layers` entries whose kind is
   * copper, in their order. Otherwise: the names of the `boardLayers` rows
   * that end in `.Cu`, in file order (KiCad writes copper rows front to
   * back). Via spans are resolved against this order.
   */
  copperLayers: LayerName[];

  /**
   * The stackup's board-level fabrication settings. Absent when `present` is
   * false.
   */
  settings?: StackupSettings;

  /**
   * Solder mask colour per side, copied from the `color` of the `F.Mask` and
   * `B.Mask` entries of `layers`. Each side is absent when the stackup has no
   * such entry or the entry has no colour.
   */
  maskColors: StackupMaskColors;

  /**
   * Every top-level `(via …)` of the board, grouped by technology, span and
   * back/tertiary drilling, with the number of vias in each group. Sorted
   * by: the index of `startLayer` in `copperLayers` (absent or not in
   * `copperLayers` sorts after every index), then the index of `stopLayer`
   * likewise, then `viaType` in code point order of its JSON value, then
   * `startLayer` and `stopLayer` in code point order (absent as the empty
   * string), then `backdrill`, then `tertiaryDrill`; a drill compares absent
   * before present, then by `sizeNm` (absent first, then numeric order), then
   * `startLayer` and `stopLayer` in code point order (absent as the empty
   * string). Empty when the board has no via.
   */
  viaSpans: StackupViaSpan[];

  /**
   * The board's `(layers …)` table, one row per declared layer, in file
   * order. Empty only for a board file without a layer table.
   */
  boardLayers: StackupBoardLayer[];
}

/**
 * One entry of the physical stackup: a `(layer …)` form of `(stackup …)`,
 * or one sub-layer of a dielectric form that has `addsublayer` tokens.
 */
model StackupLayer {
  /**
   * The name the `(layer "<name>" …)` form gives: a canonical board layer
   * name (`F.SilkS`, `F.Mask`, `F.Cu`, `In1.Cu`) or `dielectric <n>` for a
   * dielectric. Every sub-layer of one dielectric repeats the name.
   */
  @minLength(1)
  name: string;

  /**
   * Position of this entry among the sub-layers of its `(layer …)` form: 0
   * for the values before the first bare `addsublayer` token, n for the
   * values after the n-th one. Only dielectrics have sub-layers, so every
   * other entry has 0.
   */
  sublayer: Count;

  /** Prism's classification of the entry, from its name. */
  kind: StackupLayerKind;

  /**
   * The form's `(type "…")`, repeated on every sub-layer. Absent when the
   * form has none or a value outside the KiCad set.
   */
  type?: StackupLayerType;

  /**
   * Thickness of this entry or sub-layer from its `(thickness <mm> [locked])`,
   * in nanometres. Absent when it is not written or written as zero, which
   * KiCad and today's readers treat as unspecified; never 0.
   */
  thicknessNm?: StackupPositiveNanometres;

  /**
   * Material from `(material "…")` of this entry or sub-layer, as written
   * (for example `FR4`, `3313`, `Not specified`). Absent when not written or
   * empty.
   */
  @minLength(1)
  material?: string;

  /**
   * Relative permittivity εr from `(epsilon_r …)` of this entry or
   * sub-layer, as written, including 0. Absent when not written.
   */
  epsilonR?: float64;

  /**
   * Loss tangent tan δ from `(loss_tangent …)` of this entry or sub-layer,
   * as written, including 0. Absent when not written.
   */
  lossTangent?: float64;

  /**
   * Colour from `(color "…")` of this entry or sub-layer, as written: a
   * KiCad colour name (`Green`, `White`, `FR4 natural`) or a custom
   * `#RRGGBBAA`. Absent when not written or empty.
   */
  @minLength(1)
  color?: string;
}

/** The board-level settings that close a `(stackup …)` form. */
model StackupSettings {
  /**
   * Copper finish from `(copper_finish "…")`, as written (for example
   * `None`, `ENIG`, `HAL lead-free`). KiCad writes the literal `None` for no
   * finish. Absent when the token is not written or empty.
   */
  @minLength(1)
  copperFinish?: string;

  /**
   * Impedance-controlled build, from `(dielectric_constraints yes|no)`.
   * False when the token is absent, as KiCad reads it.
   */
  dielectricConstraints: boolean;

  /** Edge-card connector setting from `(edge_connector …)`; `none` when absent. */
  edgeConnector: StackupEdgeConnector;

  /** Castellated pads, from `(castellated_pads yes)`. False when absent. */
  castellatedPads: boolean;

  /** Plated board edge, from `(edge_plating yes)`. False when absent. */
  edgePlating: boolean;
}

/** A solder mask colour for each side of the board. */
model StackupMaskColors {
  /** `color` of the stackup's `F.Mask` entry. Absent when there is none. */
  @minLength(1)
  front?: string;

  /**
   * `color` of the stackup's `B.Mask` entry. Absent when there is none;
   * readers that need a colour then use `front`, as the 3D tab does.
   */
  @minLength(1)
  back?: string;
}

/**
 * A group of vias that share a technology, a layer pair and back/tertiary
 * drilling. Via size and drill diameter are not part of the group.
 */
model StackupViaSpan {
  /** Technology of every via in the group. */
  viaType: StackupViaType;

  /**
   * First layer of the vias' `(layers "<a>" "<b>")`, as written. Absent when
   * the form names no layer.
   */
  startLayer?: LayerName;

  /**
   * Second layer of the vias' `(layers "<a>" "<b>")`, as written. Absent
   * when the form names fewer than two layers.
   */
  stopLayer?: LayerName;

  /**
   * The copper layers the vias cross, `startLayer` to `stopLayer` inclusive,
   * in stack order from front to back as `copperLayers` orders them, whatever
   * the order of `startLayer` and `stopLayer`. Empty when either is absent or
   * not in `copperLayers`.
   */
  spanLayers: LayerName[];

  /**
   * The vias' `(backdrill …)`. Absent when the vias have none, or one with
   * neither a size nor layers.
   */
  backdrill?: StackupViaDrill;

  /**
   * The vias' `(tertiary_drill …)`. Absent when the vias have none, or one
   * with neither a size nor layers.
   */
  tertiaryDrill?: StackupViaDrill;

  /** Number of vias in the group, at least 1. */
  count: StackupPositiveCount;
}

/** A back drill or tertiary drill of a via: its diameter and the layers it removes copper between. */
model StackupViaDrill {
  /** Drill diameter from the form's `(size <mm>)`, in nanometres. Absent when not written. */
  sizeNm?: NonNegativeNanometres;

  /** First layer of the form's `(layers "<a>" "<b>")`, as written. Absent when not written. */
  startLayer?: LayerName;

  /** Second layer of the form's `(layers "<a>" "<b>")`, as written. Absent when not written. */
  stopLayer?: LayerName;
}

/** One row of the board's `(layers …)` table: `(<ordinal> "<name>" <type> ["<user name>"])`. */
model StackupBoardLayer {
  /** The layer's ordinal, the integer that opens the row, as written. */
  ordinal: Count;

  /** The layer's canonical name. */
  name: LayerName;

  /**
   * The row's type token. Absent when the row has none or a token outside
   * the KiCad set.
   */
  type?: StackupBoardLayerType;

  /**
   * The user-assigned layer name, the row's optional fourth element, as
   * written. Absent when not written or empty.
   */
  @minLength(1)
  userName?: string;
}
