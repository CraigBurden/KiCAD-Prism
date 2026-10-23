import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * The input of `prism-kicad stroke-text --request` (`prism.stroke_text.request.a0`,
 * ADR amendment C3 §3.4): a batch of text runs to render with the core's
 * NewStroke font. It replaces Release Studio's per-string calls to Python
 * kicad_monkey's `render_text_polylines(value, x, y, size, size, h_align, v_align)`
 * call (`backend/app/release_studio/documents/fonts.py:363-371`)
 * with one call per sheet.
 *
 * Coordinates and sizes are millimetres, as that call takes them, not
 * nanometres: the polylines are page geometry, not board coordinates.
 *
 * The root is a batch, so every array is required and empty when there is
 * nothing to render (`conventions.md` §10).
 */
namespace Prism.Contracts.StrokeTextA0;

// -------------------------------------------------------------------- enums

/** Horizontal alignment of a run about its `x_mm`, as the renderer takes it. */
enum StrokeTextHAlign {
  /** `x_mm` is the start of the run. */
  left,

  /** `x_mm` is the centre of the run. */
  center,

  /** `x_mm` is the end of the run. */
  right,
}

/** Vertical alignment of a run about its `y_mm`, as the renderer takes it. */
enum StrokeTextVAlign {
  /** `y_mm` is the top of the run's cap height. */
  top,

  /** `y_mm` is the centre of the run's cap height. */
  center,

  /** `y_mm` is the baseline of the run. */
  bottom,
}

// ------------------------------------------------------------------- models

/** One text run to render. */
model StrokeTextRun {
  /**
   * The run's text, UTF-8, exactly as it is to be drawn. KiCad markup
   * (`~{}`, `^{}`, `_{}`) is interpreted by the renderer, matching Python
   * kicad_monkey.
   */
  text: string;

  /** X position of the run's alignment point, in millimetres. */
  x_mm: float64;

  /** Y position of the run's alignment point, in millimetres. */
  y_mm: float64;

  /** The run's nominal size in millimetres: the em size, applied to both axes. */
  size_mm: float64;

  /** Horizontal alignment about `x_mm`. */
  h_align: StrokeTextHAlign;

  /** Vertical alignment about `y_mm`. */
  v_align: StrokeTextVAlign;
}

// --------------------------------------------------------------------- root

/**
 * The batch of runs `prism-kicad stroke-text --request` renders in one call.
 */
@jsonSchema
@id("urn:prism:schema:prism.stroke_text.request:a0")
@extension("title", "Prism stroke-text request a0")
model StrokeTextRequestA0 {
  /** Document schema id. */
  schema: "prism.stroke_text.request.a0";

  /**
   * The runs, in the request's order. `CliStrokeTextResultA0.runs` reports them
   * in the same order.
   */
  runs: StrokeTextRun[];
}
