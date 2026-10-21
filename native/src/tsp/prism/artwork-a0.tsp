import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * Prism's assembly and testpoint artwork configuration (`prism.artwork.config.a0`,
 * ADR amendment C3 §3.2): the input of `prism-kicad artwork --config`.
 *
 * It is **a config file that mirrors an existing file**, so every field keeps
 * the file's spelling (`conventions.md` §5, the config-file exemption): the
 * keys are snake_case exactly as the two files
 * `backend/app/release_studio/documents/pcb-svg.config.json` and
 * `pcb-svg.testpoints.config.json` write them (Cruncher
 * 2026.9.7's `kicad_cruncher_pcb_svg_config.py` model). Only `schema` changes,
 * from `kicad_cruncher.pcb_svg.config.a0` to `prism.artwork.config.a0`.
 * Every field is optional except the blocks the two files always write, so the
 * same contract types both files.
 *
 * The file's `_prism` author-comment array is not a rendering-config field and
 * has no place in the contract: a bundle document's field names are ASCII
 * `snake_case` or `camelCase` and never start with an underscore
 * (`conventions.md` §5). It is dropped from the file, not typed here.
 * Field-by-field sources are in `field-maps/release-studio-tools.md`.
 */
namespace Prism.Contracts.ArtworkA0;

// -------------------------------------------------------------------- enums

/** How the view's canvas is bounded. */
enum ArtworkCanvasBounds {
  /** The board outline plus `global.canvas.margin_mm`. */
  boardOutline: "board_outline",

  /** Everything drawn in the view, however far it reaches. */
  allGeometry: "all_geometry",

  /**
   * The board outline union every body region and pad the view draws, plus the
   * label boxes of a callout view, and `global.canvas.margin_mm`. A part that
   * overhangs the board edge stays inside the canvas with its designator.
   */
  boardAndBodies: "board_and_bodies",
}

/**
 * How a component's body is projected, used by `assembly.default_projection`,
 * `assembly.dnp_projection` and `views[].assembly_hlr_mode`. The value is
 * Cruncher's token (its `PCB_SVG_COMPONENT_PROJECTION_MODES`), kept verbatim.
 */
enum ArtworkProjectionMode {
  /** The visible-internal-edge (detail) HLR. */
  detail,

  /** The silhouette (outline) HLR. */
  outline,

  /** The model's bounding box. */
  boundingBox: "bounding_box",

  /** The 3D model's bounds. */
  modelBounds: "model_bounds",

  /** The pad envelope's bounds. */
  padBounds: "pad_bounds",

  /** No body geometry. */
  none,
}

/** How a board cutout's outline is stroked. */
enum ArtworkOutlineStyle {
  /** A continuous line. */
  solid,

  /** A dashed line. */
  dashed,
}

/**
 * The side a component override forces, `top`/`bottom` exactly as the config
 * file spells it (KiCad's own spelling for a front/back side).
 */
enum ArtworkComponentSide {
  /** KiCad's `F.*` layers. */
  top,

  /** KiCad's `B.*` layers. */
  bottom,
}

// ------------------------------------------------------------------- models

/**
 * Global rendering options and the default style table
 * (`global` of `pcb-svg.config.json`).
 */
model ArtworkGlobal {
  /** SVG canvas bounds and margin policy. */
  canvas: ArtworkCanvas;

  /** Emit `data-*` metadata in generated SVG elements. */
  include_metadata: boolean;

  /** Write physical layer SVGs even when no geometry is present. */
  show_empty_layers: boolean;

  /** Clip rendered layers to the board outline when possible. */
  clip_to_outline: boolean;

  /** Clip drill and slot holes out of rendered copper layers. */
  clip_holes_from_copper: boolean;

  /** Mirror bottom-side composed views into a board-front reading orientation. */
  mirror_bottom_view: boolean;

  /** SVG user-unit scale factor per millimetre. */
  svg_scale: float64;

  /** SVG `width`/`height` unit suffix; an empty string keeps raw user units. */
  svg_size_unit: string;

  /** Remove prior generated outputs before writing the new render set. */
  clean_output: boolean;

  /** The default style table, merged under each view's own `styles`. */
  styles: ArtworkStyles;
}

/** The view's canvas bounds and margin. */
model ArtworkCanvas {
  /** How the canvas is bounded. */
  bounds: ArtworkCanvasBounds;

  /** Extra margin around the selected canvas bounds, in millimetres. */
  margin_mm: float64;
}

/**
 * The style table: one entry per rendered feature, each optional so a view may
 * merge only what it changes over `global.styles`. The entries are the ones
 * Prism's two config files use.
 */
model ArtworkStyles {
  /** The board perimeter derived from `Edge.Cuts`. */
  board_outline?: ArtworkBoardOutlineStyle;

  /** Internal board cutouts derived from smaller closed `Edge.Cuts` regions. */
  board_cutouts?: ArtworkBoardCutoutStyle;

  /** Circular drill overlays. */
  drills?: ArtworkDrillSlotStyle;

  /** Slotted drill overlays. */
  slots?: ArtworkDrillSlotStyle;

  /** The Geometer-backed assembly projection. */
  assembly_hlr?: ArtworkHlrStyle;

  /** The do-not-populate hatch fill, a per-view override of the top-level `dnp`. */
  dnp?: ArtworkDnpStyle;

  /** Fitted assembly reference-designator text. */
  assembly_designators?: ArtworkAssemblyDesignatorStyle;

  /** Synthesized pin-1 markers (`PIN1_TOP`/`PIN1_BOTTOM`). */
  pin1_marker?: ArtworkPin1MarkerStyle;
}

/** The board-perimeter style. */
model ArtworkBoardOutlineStyle {
  /** Draw the perimeter. */
  enabled?: boolean;

  /** Line colour, CSS syntax. */
  color?: string;

  /** Stroke width in millimetres. */
  line_width_mm?: float64;
}

/** The board-cutout style. */
model ArtworkBoardCutoutStyle {
  /** Draw the cutouts. */
  enabled?: boolean;

  /** Line colour, CSS syntax. */
  color?: string;

  /** Fill the cutout interior with a hatch when true. */
  hatch?: boolean;

  /** How the cutout outline is stroked. */
  outline_style?: ArtworkOutlineStyle;

  /** Cutout outline stroke width in millimetres. */
  outline_width_mm?: float64;
}

/** A circular or slotted drill overlay style (`drills`, `slots`). */
model ArtworkDrillSlotStyle {
  /** Draw the overlays. */
  enabled?: boolean;

  /** Colour of plated geometry. */
  plated_color?: string;

  /** Colour of non-plated geometry. */
  non_plated_color?: string;

  /** Opacity from 0 to 1. */
  opacity?: float64;
}

/** The Geometer-backed assembly projection style. */
model ArtworkHlrStyle {
  /** Draw the projection. */
  enabled?: boolean;

  /** Line colour, CSS syntax. */
  color?: string;

  /** Stroke width in millimetres. */
  line_width_mm?: float64;

  /** Opacity from 0 to 1. */
  opacity?: float64;

  /** Include the visible-internal-edge (detail) geometry. */
  include_visible?: boolean;

  /** Include the silhouette (outline) geometry. */
  include_outline?: boolean;

  /** Union outline polygons before rendering when Geometer supports it. */
  union_polygons?: boolean;
}

/** The fitted assembly designator style. */
model ArtworkAssemblyDesignatorStyle {
  /** Draw the designators. */
  enabled?: boolean;

  /** Text colour, CSS syntax. */
  color?: string;

  /** Fraction of the component bounds used by the fitted text. */
  box_fill_ratio?: float64;

  /** CSS font weight of the designator text. */
  font_weight?: string;

  /** Smallest fitted font size in millimetres. */
  min_font_size_mm?: float64;

  /** Largest fitted font size in millimetres. */
  max_font_size_mm?: float64;

  /** Rotate the text when the fitted bounds are taller than this height/width ratio. */
  rotation_aspect_threshold?: float64;

  /** Designator rotation direction when the bounds are tall (`ccw` or `cw`). */
  rotation_direction?: string;

  /**
   * Place the designator outside the body region with a leader line, at
   * `min_font_size_mm`, instead of fitting it inside. Testpoint views set it:
   * a 1 mm test pad has no room for a readable label.
   */
  callout?: boolean;

  /** Opacity from 0 to 1. */
  opacity?: float64;

  /**
   * Per-selector overrides merged over this style; the keys are designator
   * selectors as written in the file, for example `*` or `TP*`, and each value
   * is the override that applies to the designators the selector matches.
   * Ordered by key in code point order.
   */
  selector_overrides?: Record<ArtworkSelectorOverride>;
}

/** One `selector_overrides` entry: whether matching designators are drawn. */
model ArtworkSelectorOverride {
  /** Draw the designators the selector matches. */
  enabled: boolean;
}

/** The pin-1 marker style. */
model ArtworkPin1MarkerStyle {
  /** Draw the markers. */
  enabled?: boolean;

  /** Marker colour, CSS syntax. */
  color?: string;

  /** Fixed marker dot diameter in millimetres. */
  dot_diameter_mm?: float64;

  /** Marker diameter as a ratio of the selected pad size. */
  pad_diameter_ratio?: float64;

  /** Smallest marker dot diameter in millimetres. */
  min_dot_diameter_mm?: float64;

  /** Largest marker dot diameter in millimetres. */
  max_dot_diameter_mm?: float64;
}

/** Default projection and designator colour policy (`assembly`). */
model ArtworkAssembly {
  /** The projection mode used for a fitted part. */
  default_projection: ArtworkProjectionMode;

  /** The projection mode used for a do-not-populate part. */
  dnp_projection: ArtworkProjectionMode;

  /** Fallback colour for fitted assembly designators. */
  designator_color: string;

  /** Fallback colour for do-not-populate assembly designators. */
  dnp_designator_color: string;
}

/** The do-not-populate hatch/marker style (`dnp`). */
model ArtworkDnp {
  /** Marker colour, CSS syntax. */
  color: string;

  /** Draw a hatch fill when true. */
  hatch: boolean;

  /** Hatch line spacing in millimetres. */
  hatch_spacing_mm: float64;

  /** Hatch angle in degrees. */
  hatch_angle_deg: Degrees;

  /** Hatch stroke width in millimetres. */
  hatch_line_width_mm: float64;
}

/**
 * A do-not-populate hatch override under `global.styles` or `views[].styles`:
 * each field it sets replaces the top-level `dnp` value.
 */
model ArtworkDnpStyle {
  /** Marker colour, CSS syntax. */
  color?: string;

  /** Draw a hatch fill when true. */
  hatch?: boolean;

  /** Hatch line spacing in millimetres. */
  hatch_spacing_mm?: float64;

  /** Hatch angle in degrees. */
  hatch_angle_deg?: Degrees;

  /** Hatch stroke width in millimetres. */
  hatch_line_width_mm?: float64;
}

/** Pin-1 marker selection policy (`pin1`). */
model ArtworkPin1 {
  /**
   * Designators excluded from pin-1 markers, as written: exact names, prefixes,
   * wildcards or ranges. In file order.
   */
  exclude_designators: string[];

  /** Suppress pin-1 markers for single-pin footprints. */
  exclude_single_pin: boolean;
}

/**
 * One per-component override (`components.<designator>`). The keys of the
 * `components` map are reference designators, for example `J1` or `U5`.
 */
model ArtworkComponentOverride {
  /** The side the component is treated as being on. */
  side?: ArtworkComponentSide;

  /** The component's body projection mode. */
  `projection`?: ArtworkProjectionMode;

  /** Assembly HLR style overrides for this component. */
  assembly_hlr?: ArtworkHlrStyle;

  /** Assembly designator style overrides for this component. */
  assembly_designators?: ArtworkAssemblyDesignatorStyle;

  /** Force the pin-1 marker on or off for this component. */
  pin1_enabled?: boolean;

  /** The pad name to use for this component's pin-1 marker. */
  pin1_pad?: string;

  /** The pad name to use for this component's cathode marker. */
  cathode_pad?: string;

  /** Force diode/cathode detection on or off for this component. */
  diode?: boolean;

  /** Force diode line-art rendering on or off for this component. */
  diode_line_art?: boolean;

  /** Force the assembly designator on or off for this component. */
  show_designator?: boolean;
}

/** Standalone per-layer output settings (`layer_outputs`). */
model ArtworkLayerOutputs {
  /** Write standalone per-layer and virtual-layer SVGs. */
  enabled: boolean;
}

/** One composed view (one entry of `views`). */
model ArtworkView {
  /** The view's stable name, used by `--view`. */
  name: string;

  /** Whether the view is rendered. */
  enabled: boolean;

  /** The SVG group id for the composed view. */
  group_id: string;

  /** The output path template relative to the output root; supports `{board}` and `{view}`. */
  output_svg: string;

  /**
   * The physical and virtual layer tokens rendered into this view, in draw
   * order (first drawn at the bottom). A physical token is a KiCad layer name
   * (`F.Cu`) or a config alias (`TOP`); a virtual token is one of
   * `BOARD_OUTLINE`, `BOARD_CUTOUTS`, `DRILLS`, `SLOTS`, `PIN1_TOP`,
   * `PIN1_BOTTOM`, the `ASSEMBLY_HLR_*`, `ASSEMBLY_BOUNDS_*` and
   * `ASSEMBLY_DESIGNATORS_*` tokens.
   */
  layers: string[];

  /** The view's projection mode for its `ASSEMBLY_HLR_*` tokens. */
  assembly_hlr_mode: ArtworkProjectionMode;

  /** Per-view style overrides merged over `global.styles`. */
  styles: ArtworkStyles;
}

// --------------------------------------------------------------------- root

/**
 * The artwork configuration `prism-kicad artwork --config` reads
 * (`pcb-svg.config.json` / `pcb-svg.testpoints.config.json` with `schema`
 * replaced).
 */
@jsonSchema
@id("urn:prism:schema:prism.artwork.config:a0")
@extension("title", "Prism artwork config a0")
model ArtworkConfigA0 {
  /** Document schema id. */
  schema: "prism.artwork.config.a0";

  /** Global rendering options and the default style table. */
  global: ArtworkGlobal;

  /** Default projection and designator colour policy. */
  assembly: ArtworkAssembly;

  /** The do-not-populate hatch/marker style. */
  dnp: ArtworkDnp;

  /** Pin-1 marker selection policy. */
  pin1: ArtworkPin1;

  /**
   * Per-component overrides; the keys are reference designators (`J1`, `U5`),
   * serialized in code point order. Empty when no component is overridden.
   */
  components: Record<ArtworkComponentOverride>;

  /** Standalone per-layer output settings. */
  layer_outputs: ArtworkLayerOutputs;

  /**
   * The composed views, in file order. `prism-kicad artwork --view` names one
   * or more of them.
   */
  views: ArtworkView[];
}
