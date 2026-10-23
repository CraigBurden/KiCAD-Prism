import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * Bundle member `models/assembly-hlr.json` (`prism.assembly_hlr.a0`, ADR
 * amendment C3 §3.1), written in stage `models` by `prism-kicad bundle build`
 * and read by `prism-kicad artwork`.
 *
 * It records, for every footprint that names a 3D model, the hidden-line (HLR)
 * projection of the footprint's first `.step`/`.stp` model: the silhouette
 * (`outline`) and the visible internal edges (`detail`), each a set of segments
 * and arcs in board nanometres after the model pose, with a bottom-side view
 * mirrored as Cruncher 2026.9.7 does today. A footprint whose model is missing,
 * not STEP, or rejected by Geometer is listed with a `status` and a reason
 * instead of geometry, never silently dropped.
 *
 * The member is a pure function of the parsed board, its STEP models, the HLR
 * `options` and the Geometer `runtime`, so it carries no provenance
 * (`conventions.md` §4). Field-by-field sources are in
 * `field-maps/release-studio-tools.md`.
 */
namespace Prism.Contracts.AssemblyHlrA0;

// -------------------------------------------------------------------- enums

/** A footprint's projection curve output mode: Geometer's `curve_mode` token, kept verbatim. */
enum AssemblyHlrCurveMode {
  /** Native arcs where the model has them. */
  nativeArcs: "native_arcs",

  /** Sample every curve into line segments. */
  polyline,
}

/** The outline (silhouette) algorithm: Geometer's `outline_algorithm` token, kept verbatim. */
enum AssemblyHlrOutlineAlgorithm {
  /** Exact hidden-line-removal outline. */
  hlrClose: "hlr-close",

  /** The mesh shadow silhouette. */
  meshShadow: "mesh-shadow",

  /** The faster mesh shadow silhouette. */
  fastMeshShadow: "fast-mesh-shadow",
}

/** The projection algorithm: Geometer's `projection_algorithm` token, kept verbatim. */
enum AssemblyHlrProjectionAlgorithm {
  /** Polygon projection. */
  poly,

  /** Exact projection. */
  exact,

  /** Fast projection. */
  fast,
}

/** Why a footprint's body was not projected. */
enum AssemblyHlrStatus {
  /** The footprint names a STEP model whose bytes could not be resolved. */
  modelUnavailable: "model-unavailable",

  /** The footprint names no `.step`/`.stp` model. */
  modelNotStep: "model-not-step",

  /** Geometer could not project the model. */
  projectionFailed: "projection-failed",
}

// ------------------------------------------------------------------- models

/** The Geometer runtime the projection used. */
model AssemblyHlrRuntime {
  /**
   * The Geometer runtime's version string, exactly as `geometer.version()`
   * reports it, for example `2026.9.7`. It is part of the generator id's
   * `hlr_procedure`.
   */
  geometerVersion: string;
}

/**
 * The HLR options every footprint's projection used. The values are the
 * options passed to Geometer, so a consumer can reproduce the projection from
 * the model bytes. The projection's side is not here: it is each footprint's
 * own `side`.
 */
model AssemblyHlrOptions {
  /** The projection algorithm, when the config set one. Absent when Geometer's default applies. */
  projectionAlgorithm?: AssemblyHlrProjectionAlgorithm;

  /** The outline (silhouette) algorithm. */
  outlineAlgorithm: AssemblyHlrOutlineAlgorithm;

  /** The curve output mode. */
  curveMode: AssemblyHlrCurveMode;

  /** How many segments one curve samples into when `curveMode` is `polyline`. */
  samplesPerCurve: Count;

  /** Decimal digits retained in the projected geometry. */
  roundDigits: Count;

  /** Include the visible internal edges (`detail`). */
  includeVisible: boolean;

  /** Include the silhouette (`outline`). */
  includeOutline: boolean;

  /** Union outline polygons before rendering. */
  unionPolygons: boolean;

  /** Mesh linear deflection in millimetres, when set. Absent when Geometer's default applies. */
  meshLinearDeflection?: float64;

  /** Mesh angular deflection in radians, when set. Absent when Geometer's default applies. */
  meshAngularDeflection?: float64;

  /** Whether the mesh deflections are relative to the model size, when set. Absent when Geometer's default applies. */
  meshRelative?: boolean;

  /** The hidden-line-removal angle tolerance in degrees, when set. Absent when Geometer's default applies. */
  hlrAngleTolerance?: float64;

  /**
   * The per-edge-family visibility flags passed to Geometer. The keys are
   * Geometer's flag names (for example `edge_v_outline`), serialized in code
   * point order. Absent when no flags were set.
   */
  edgeFlags?: Record<boolean>;
}

/** A three-dimensional vector in nanometres. */
model AssemblyHlrVector3Nm {
  /** X component in nanometres. */
  xNm: Nanometres;

  /** Y component in nanometres. */
  yNm: Nanometres;

  /** Z component in nanometres. */
  zNm: Nanometres;
}

/** A three-dimensional rotation in degrees. */
model AssemblyHlrRotation3Deg {
  /** Rotation about x, in degrees as written. */
  xDeg: Degrees;

  /** Rotation about y, in degrees as written. */
  yDeg: Degrees;

  /** Rotation about z, in degrees as written. */
  zDeg: Degrees;
}

/** A three-dimensional scale factor. */
model AssemblyHlrScale3 {
  /** X scale factor. */
  x: float64;

  /** Y scale factor. */
  y: float64;

  /** Z scale factor. */
  z: float64;
}

/**
 * The pose of the footprint's model: the footprint's placement on the board,
 * plus the model's own offset, rotation and scale, exactly the inputs of
 * Cruncher's `kicad_model_local_pose`.
 */
model AssemblyHlrPose {
  /** Board-absolute anchor of the footprint: its `(at x y)` in KiCad's board frame. */
  positionNm: PointNm;

  /** The footprint's orientation in degrees, as written, not normalized. */
  rotationDeg: Degrees;

  /** The model's `(offset x y z)` as written, in nanometres. */
  modelOffset: AssemblyHlrVector3Nm;

  /** The model's `(rotate x y z)` as written, in degrees. */
  modelRotation: AssemblyHlrRotation3Deg;

  /** The model's `(scale x y z)` as written. */
  modelScale: AssemblyHlrScale3;
}

/** The footprint's first STEP model and the digest of its bytes. */
model AssemblyHlrModel {
  /**
   * The model reference as written in the footprint's `(model …)`: a
   * `${VAR}`-relative path, a repository-relative path, or a `kicad-embed://`
   * reference.
   */
  reference: string;

  /** SHA-256 of the STEP file's bytes. Absent when the bytes could not be resolved (`model-unavailable`). */
  sha256?: Sha256Hex;
}

/** One straight edge of a projected edge set. */
model AssemblyHlrSegment {
  /** The edge's start point, board frame. */
  startNm: PointNm;

  /** The edge's end point, board frame. */
  endNm: PointNm;
}

/** One circular edge of a projected edge set, the fields Geometer returns. */
model AssemblyHlrArc {
  /** The arc's start point, board frame. */
  startNm: PointNm;

  /** The arc's end point, board frame. */
  endNm: PointNm;

  /** The arc's center point, board frame. */
  centerNm: PointNm;

  /** The arc's radius in nanometres. */
  radiusNm: NonNegativeNanometres;

  /** The arc's angular extent in degrees, from Geometer's `extent_rad`. */
  extentDeg: Degrees;

  /** True when the arc runs counter-clockwise from `startNm` to `endNm`. */
  ccw: boolean;

  /** True when the arc is a full circle, in which case `startNm` and `endNm` coincide. */
  fullCircle: boolean;
}

/** A projected edge set: its segments and arcs. */
model AssemblyHlrEdges {
  /**
   * The straight edges, in the order Geometer returned them after Cruncher's
   * deduplication (endpoints ordered and duplicates removed).
   */
  segments: AssemblyHlrSegment[];

  /** The circular edges, in the order Geometer returned them after Cruncher's deduplication. */
  arcs: AssemblyHlrArc[];
}

/** One footprint's model, pose and projected geometry, or the reason it has none. */
model AssemblyHlrFootprint {
  /** The board file's repository-relative path. */
  documentPath: RepoPath;

  /** The footprint's `(uuid …)`, as written. */
  uuid: KiCadUuid;

  /** The footprint's reference designator, as written. Absent when it has none or it is empty. */
  reference?: Refdes;

  /** The footprint's side: `back` when its `(layer …)` starts with `B.`. */
  side: Side;

  /** The footprint's first STEP model. Absent when it names no `.step`/`.stp` model (`model-not-step`). */
  stepModel?: AssemblyHlrModel;

  /** The model's pose. Present exactly when the model was projected (`outline` and `detail` are present). */
  pose?: AssemblyHlrPose;

  /** The silhouette edges, board frame. Present exactly when the projection succeeded. */
  outline?: AssemblyHlrEdges;

  /** The visible-internal edges, board frame. Present exactly when the projection succeeded. */
  detail?: AssemblyHlrEdges;

  /**
   * Why the footprint has no geometry. Present exactly when `outline` and
   * `detail` are absent; absent when the projection succeeded.
   */
  status?: AssemblyHlrStatus;
}

// --------------------------------------------------------------------- root

/**
 * The HLR projection of every footprint that names a 3D model, the bundle
 * member `models/assembly-hlr.json` (stage `models`).
 */
@jsonSchema
@id("urn:prism:schema:prism.assembly_hlr:a0")
@extension("title", "Prism assembly HLR a0")
model AssemblyHlrA0 {
  /** Document schema id. */
  schema: "prism.assembly_hlr.a0";

  /** The HLR options every footprint's projection used. */
  options: AssemblyHlrOptions;

  /** The Geometer runtime the projection used. */
  runtime: AssemblyHlrRuntime;

  /**
   * Every footprint that names a 3D model, sorted by `documentPath`, then
   * `uuid`, each in code point order; a footprint with no model at all is not
   * listed. Footprints with a resolvable STEP model carry `pose`, `outline` and
   * `detail`; the others carry a `status`.
   */
  footprints: AssemblyHlrFootprint[];
}
