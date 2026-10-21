import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * Bundle member `projections/placements.json` (`prism.placements.a1`, ADR §6,
 * WP-P3), written in stage `parse` from the project's board file as committed
 * (the `source-board` member, never the refilled board): where every
 * footprint is, which side it is on, its assembly flags, its library link,
 * its 3D model references, its courtyard extent, its pads' anchors and coarse
 * pad facts, the board outline extent and the set of designators.
 *
 * Coordinates are integer nanometres in KiCad's board frame (+x right, +y
 * down, as in the file). Each position field states whether it is
 * board-absolute or footprint-local. Exact copper (custom pad primitives,
 * corner ratios, drills, holes) is not here: it is the materialization's, at
 * stage `board`. Field-by-field sources, the normative computation rules and
 * the derivation of today's Release Studio and System Builder values are in
 * `field-maps/placements.md`.
 */
namespace Prism.Contracts.PlacementsA1;

// ------------------------------------------------------------------ enums

/**
 * A pad's type: the second token of its `(pad "<number>" <type> <shape> …)`
 * form, spelled exactly as KiCad writes it. KiCad rejects any other token.
 */
enum PlacementsPadType {
  /** `thru_hole`: a plated through-hole pad. */
  thruHole: "thru_hole",

  /** `smd`: a surface-mount pad. */
  smd: "smd",

  /** `connect`: an edge-connector (or other) pad with no paste and no hole. */
  connect: "connect",

  /** `np_thru_hole`: a non-plated hole, such as a mounting hole. */
  npThruHole: "np_thru_hole",
}

/**
 * A pad's shape: the third token of its `(pad …)` form, spelled exactly as
 * KiCad writes it. A chamfered rectangle is `roundrect` with a chamfer in
 * the file. KiCad rejects any other token.
 */
enum PlacementsPadShape {
  /** `circle`. */
  circle: "circle",

  /** `rect`. */
  rect: "rect",

  /** `oval`. */
  oval: "oval",

  /** `trapezoid`. */
  trapezoid: "trapezoid",

  /** `roundrect`, including a chamfered rectangle. */
  roundrect: "roundrect",

  /** `custom`: an anchor shape plus primitives; `size` is the anchor's. */
  custom: "custom",
}

// ----------------------------------------------------------------- models

/**
 * Footprint placements of one board. Written once per bundle at stage
 * `parse`; carries no provenance (bundle.json records it). When the project
 * has no board, `footprints` and `designators` are empty and `outlineBounds`
 * is absent.
 */
@jsonSchema
@id("urn:prism:schema:prism.placements:a1")
@extension("title", "Placements a1")
model PlacementsA1 {
  /** Schema id of this document. */
  schema: "prism.placements.a1";

  /**
   * Every footprint of the board, in file order: the order of the top-level
   * `(footprint …)` forms in the board file, whatever its attributes
   * (board-only, DNP, excluded from the BOM or the position files). `uuid` is
   * unique. A footprint whose `(uuid …)` is missing, not a canonical KiCadUuid, or repeats the uuid
   * of an earlier footprint is left out and reported as a manifest warning;
   * KiCad 9 and 10 never write such a board.
   */
  footprints: PlacementsFootprint[];

  /**
   * The distinct `reference` values of `footprints`, sorted in code point
   * order, each once. Footprints without a `reference` contribute nothing.
   * Release Studio's designator set, and the names System Builder matches
   * component bodies in the component GLB by.
   */
  designators: Refdes[];

  /**
   * Board-absolute extent of the board-level `Edge.Cuts` graphics (the
   * top-level `gr_line`, `gr_rect`, `gr_circle`, `gr_arc`, `gr_poly` and
   * `gr_curve` forms on `Edge.Cuts`), by the characteristic-point rule of
   * `PlacementsBounds`, through line centres (stroke widths are ignored).
   * Edge.Cuts graphics owned by footprints are not included. Absent when the
   * board has no such graphic, or the project has no board.
   */
  outlineBounds?: PlacementsBounds;

  /**
   * a1: the board's auxiliary axis origin, `(setup (aux_axis_origin x y))`,
   * board-absolute. Position files measure from it (KiCad's "Use drill/place
   * file origin"; the JLCPCB CPL, ADR amendment C3 §3.3). Absent when the
   * board does not set one, which readers take as 0,0, or the project has no
   * board.
   */
  auxAxisOrigin?: PointNm;
}

/** One footprint placed on the board: its identity, placement and coarse geometry. */
model PlacementsFootprint {
  /**
   * The footprint's `(uuid …)`, as
   * written. Unique in `footprints`. The same id as `prism.occurrences.a0`
   * `footprints[*].uuid` and `prism.semantic_index.a1` `pcbRefs[*].footprintUuid`.
   */
  uuid: KiCadUuid;

  /**
   * Reference designator as written: the value of the footprint's first
   * `(property "Reference" …)`. Not trimmed. Absent when it is missing or
   * empty.
   */
  reference?: Refdes;

  /**
   * Library link: the first value of the `(footprint "<lib id>" …)` form, as
   * written (`Resistor_SMD:R_0603_1608Metric`). Absent when it is empty.
   */
  libId?: LibId;

  /** `back` when the footprint's `(layer …)` starts with `B.` (it is flipped), otherwise `front`, including when the form has no layer. */
  side: Side;

  /**
   * Board-absolute anchor of the footprint: the x and y of its
   * `(at x y angle)`, converted to nanometres. (0, 0) when the form has no
   * `(at …)`, as KiCad loads it.
   */
  positionNm: PointNm;

  /**
   * Orientation of the footprint: the angle of its `(at x y angle)` as
   * written, 0 when the form has none; not normalized (KiCad normally writes
   * it in (-180, 180]). KiCad's convention: degrees counter-clockwise as the
   * board is seen from the front on screen, so in the y-down board frame a
   * footprint-local point (lx, ly) is at x = ax + lx·cos θ + ly·sin θ,
   * y = ay − lx·sin θ + ly·cos θ, where (ax, ay) is `positionNm`. The same
   * formula holds on the back: KiCad writes a back-side footprint's children
   * already mirrored.
   */
  rotationDeg: Degrees;

  /** True when the footprint's `(attr …)` holds `dnp`: do not populate, by the board's own attribute, before any variant is applied. */
  dnp: boolean;

  /** True when the footprint's `(attr …)` holds `exclude_from_pos_files`: KiCad's position file leaves it out. */
  excludeFromPosFiles: boolean;

  /**
   * Footprint-local extent of the footprint's courtyard: its graphics on
   * `F.CrtYd` and `B.CrtYd` together, by the characteristic-point rule of
   * `PlacementsBounds`, through line centres, in the frame the file writes
   * them in (relative to the anchor, before the footprint's rotation; for a
   * back-side footprint already mirrored), y down. Absent when the footprint
   * has no courtyard graphic.
   */
  courtyardBounds?: PlacementsBounds;

  /**
   * The footprint's pads, in file order (the order of its `(pad …)` forms).
   * Numbers may repeat and may be empty. Empty when it has no pad.
   */
  pads: PlacementsPad[];

  /**
   * The footprint's 3D model references, in file order (the order of its
   * `(model …)` forms), hidden ones included. The first with `hidden` false
   * is System Builder's model. A `(model "")` with an empty path is left
   * out. Empty when it has none.
   */
  models: PlacementsModel[];

  /**
   * Where the footprint's `(footprint …)` form is in the board file's bytes
   * as committed, so a reader can copy the form without parsing the board.
   */
  sourceSpan: PlacementsSourceSpan;
}

/** One pad of a footprint: its number, type, shape, board-absolute anchor and size. */
model PlacementsPad {
  /** The pad number as written; empty for an unnumbered pad (typically a mechanical hole). */
  number: PadNumber;

  /** The pad's type token. */
  type: PlacementsPadType;

  /** The pad's shape token. */
  shape: PlacementsPadShape;

  /**
   * Board-absolute anchor of the pad, computed as KiCad's parser places it
   * (`PAD::SetFPRelativePosition`, `RotatePoint`): the pad's footprint-local
   * `(at x y …)` converted to integer nanometres, rotated by the footprint's
   * `rotationDeg` normalized to [0, 360) — exactly (integer swaps) at 0, 90,
   * 180 and 270, with sin and cos taken as KiCad's `EDA_ANGLE` does (0, ±1,
   * ±√½ at multiples of 45°, otherwise sin and cos of the angle in radians
   * through the pure-Rust `libm` crate) and each coordinate rounded half away
   * from zero — then added to the footprint's integer `positionNm`. The
   * rotation is the formula at `rotationDeg`. Equal to KiCad's own pad
   * position on every architecture.
   */
  positionNm: PointNm;

  /** The pad's `(size x y)`, in the pad's own frame before its rotation. */
  size: PlacementsPadSize;
}

/** The `(size x y)` of a pad, in nanometres. */
model PlacementsPadSize {
  /** Width: the first value of `(size x y)`. */
  xNm: NonNegativeNanometres;

  /** Height: the second value of `(size x y)`. */
  yNm: NonNegativeNanometres;
}

/**
 * One `(model …)` reference of a footprint, unresolved, with the transform
 * KiCad applies to the model in its 3D frame relative to the footprint.
 */
model PlacementsModel {
  /**
   * The model path exactly as written: not resolved, variables such as
   * `${KICAD9_3DMODEL_DIR}` and `${KIPRJMOD}` and `kicad-embed://` names
   * kept.
   */
  @minLength(1)
  path: string;

  /** True when the form has `(hide yes)` or a bare `hide`; false when it has `(hide no)` or no hide token. */
  hidden: boolean;

  /** The model's offset. */
  offset: PlacementsModelOffset;

  /** The model's rotation. */
  rotation: PlacementsModelRotation;

  /** The model's scale. */
  scale: PlacementsModelScale;
}

/**
 * A model's `(offset (xyz x y z))`, millimetres in the file, converted to
 * nanometres; a pre-KiCad 5 `(at (xyz …))` in inches is converted ×25.4
 * first, as KiCad does. (0, 0, 0) when the form has neither. Copied in
 * KiCad's 3D model frame, not converted to the board frame.
 */
model PlacementsModelOffset {
  /** X offset. */
  xNm: Nanometres;

  /** Y offset. */
  yNm: Nanometres;

  /** Z offset. */
  zNm: Nanometres;
}

/** A model's `(rotate (xyz x y z))` as written, degrees about each axis of KiCad's 3D model frame; 0 for each when the form is absent. */
model PlacementsModelRotation {
  /** Rotation about x. */
  xDeg: Degrees;

  /** Rotation about y. */
  yDeg: Degrees;

  /** Rotation about z. */
  zDeg: Degrees;
}

/** A model's `(scale (xyz x y z))` as written, unitless factors; 1 for each when the form is absent. */
model PlacementsModelScale {
  /** Scale along x. */
  x: float64;

  /** Scale along y. */
  y: float64;

  /** Scale along z. */
  z: float64;
}

/**
 * An axis-aligned extent in nanometres: the minimum and maximum x and y over
 * the characteristic points of a set of graphics, each point computed in
 * binary64 millimetres from the parsed values and converted to nanometres;
 * any transcendental function (atan2, sin, cos) is the pure-Rust `libm`
 * crate's, so the result is the same on every architecture.
 * The points of each graphic are: for a line or a rectangle, its start and
 * end; for a circle with centre c through point e, c − (r, r) and c + (r, r)
 * with r = hypot(e − c); for an arc, its start, mid and end plus every point
 * at 0°, 90°, 180° or 270° on its circle that it sweeps through; for a
 * polygon, its vertices (an `(arc …)` element inside `pts` by the arc rule);
 * for a Bézier curve, its four control points. The frame (board-absolute or
 * footprint-local) is given by the field that holds it.
 */
model PlacementsBounds {
  /** The minimum x and the minimum y (the top-left corner, since +y is down). */
  minNm: PointNm;

  /** The maximum x and the maximum y (the bottom-right corner). */
  maxNm: PointNm;
}

/**
 * A byte range of the board file as committed: the bytes from the opening
 * `(` of a form to its closing `)`, both included.
 */
model PlacementsSourceSpan {
  /** Offset of the opening `(` from the start of the file, in bytes. */
  offsetBytes: ByteCount;

  /** Length of the form in bytes, through its closing `)`. */
  lengthBytes: PlacementsFormLength;
}

/** The length of a form in bytes: at least 2, for `(` and `)`. */
@minValue(2)
scalar PlacementsFormLength extends ByteCount;
