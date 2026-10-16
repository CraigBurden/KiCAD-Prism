import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;


/**
 * Text-font models of `prism.compare.object_delta.a0` (`compare-a0.tsp`). They
 * sit in their own file because today's font has one snake-case key,
 * `line_spacing`, which the parity document keeps, and a contract file holds
 * one naming family (conventions.md, Field naming).
 */
namespace Prism.Contracts.CompareFontA0;

/** A text's `(font …)` as the vendored parser reads it. */
model CompareTextFontA0 {
  /** The `(face …)` font name. Absent when it is not written. */
  face?: string;

  /** The `(size …)`. Absent when it is not written. */
  size?: CompareFontSizeA0;

  /** The `(thickness …)` stroke width in millimetres. Absent when it is not written. */
  thickness?: float64;

  /** True when the font has a bare `bold`. Absent when it is not written. */
  bold?: boolean;

  /** True when the font has a bare `italic`. Absent when it is not written. */
  italic?: boolean;

  /** The `(line_spacing …)` factor as written. Absent when it is not written. Parity exemption: today's key is snake case (`kicad-sexpr-parser.mjs`), which is why the font models live in this file of their own (conventions.md, Field naming: one family per file). */
  line_spacing?: float64;

  /** The `(color …)`. Absent when it is not written. */
  color?: CompareColorA0;
}


/** A font's `(size <height> <width>)`, today's `{x, y}`. */
model CompareFontSizeA0 {
  /** The first value. */
  x: float64;

  /** The second value. */
  y: float64;
}


/** A `(color <r> <g> <b> [<a>])` as today's parser reads it. */
model CompareColorA0 {
  /** Red, 0 to 1. */
  r: float64;

  /** Green, 0 to 1. */
  g: float64;

  /** Blue, 0 to 1. */
  b: float64;

  /** Alpha, 0 to 1; 1 when the form omits it. */
  a: float64;
}
