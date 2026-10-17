/// Error types.
pub mod error {
    /// Error from a `TryFrom` or `FromStr` implementation.
    pub struct ConversionError(::std::borrow::Cow<'static, str>);
    impl ::std::error::Error for ConversionError {}
    impl ::std::fmt::Display for ConversionError {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> Result<(), ::std::fmt::Error> {
            ::std::fmt::Display::fmt(&self.0, f)
        }
    }
    impl ::std::fmt::Debug for ConversionError {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> Result<(), ::std::fmt::Error> {
            ::std::fmt::Debug::fmt(&self.0, f)
        }
    }
    impl From<&'static str> for ConversionError {
        fn from(value: &'static str) -> Self {
            Self(value.into())
        }
    }
    impl From<String> for ConversionError {
        fn from(value: String) -> Self {
            Self(value.into())
        }
    }
}
/**stdout of `stroke-text --metrics` (exit 0): the NewStroke advance table, so
layout can measure text without a process per string.

The advance of a string in the renderer's normalized units is the sum, left
to right over the string's Unicode scalar values, of each value below, added
as IEEE-754 doubles; the width in millimetres is that sum times the run's
nominal size. A U+0020 space contributes `space_width`; any other code point
contributes `advances[<decimal code point>]` when present and `0` when
absent (the renderer skips a code point it has no glyph for). This
reproduces kicad_monkey 2026.9.7's
`KiCadStrokeFontRenderer._calculate_text_width` exactly.

For text containing KiCad markup (`~{}`, `^{}`, `_{}`), the plain-text
contributions inside a `^{}` or `_{}` span are multiplied by
`super_sub_size_multiplier`; a `~{}` span's are not (kicad_monkey's
`_markup_nodes_width` with `styled` false).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.stroke_font_metrics:a0",
///  "title": "CliStrokeFontMetricsA0",
///  "description": "stdout of `stroke-text --metrics` (exit 0): the NewStroke advance table, so\nlayout can measure text without a process per string.\n\nThe advance of a string in the renderer's normalized units is the sum, left\nto right over the string's Unicode scalar values, of each value below, added\nas IEEE-754 doubles; the width in millimetres is that sum times the run's\nnominal size. A U+0020 space contributes `space_width`; any other code point\ncontributes `advances[<decimal code point>]` when present and `0` when\nabsent (the renderer skips a code point it has no glyph for). This\nreproduces kicad_monkey 2026.9.7's\n`KiCadStrokeFontRenderer._calculate_text_width` exactly.\n\nFor text containing KiCad markup (`~{}`, `^{}`, `_{}`), the plain-text\ncontributions inside a `^{}` or `_{}` span are multiplied by\n`super_sub_size_multiplier`; a `~{}` span's are not (kicad_monkey's\n`_markup_nodes_width` with `styled` false).",
///  "type": "object",
///  "required": [
///    "advances",
///    "schema",
///    "space_width",
///    "super_sub_size_multiplier"
///  ],
///  "properties": {
///    "advances": {
///      "description": "The per-glyph advance table: the keys are the decimal Unicode code points\n`\"32\"` to `\"11263\"` that the font has a glyph for, serialized in code\npoint order, and each value is that glyph's advance in the renderer's\nnormalized units (U+0020 included; the formula uses `space_width` for it).",
///      "$ref": "#/$defs/RecordFloat64"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.stroke_font_metrics.a0"
///    },
///    "space_width": {
///      "description": "The advance of one U+0020 space, in the renderer's normalized units.",
///      "type": "number"
///    },
///    "super_sub_size_multiplier": {
///      "description": "The scale a `^{}`/`_{}` span's glyphs are measured and drawn at (`0.8`).",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliStrokeFontMetricsA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///The advance of one U+0020 space, in the renderer's normalized units.
    pub space_width: f64,
    ///The scale a `^{}`/`_{}` span's glyphs are measured and drawn at (`0.8`).
    pub super_sub_size_multiplier: f64,
    /**The per-glyph advance table: the keys are the decimal Unicode code points
    `"32"` to `"11263"` that the font has a glyph for, serialized in code
    point order, and each value is that glyph's advance in the renderer's
    normalized units (U+0020 included; the formula uses `space_width` for it).*/
    pub advances: RecordFloat64,
}
///`RecordFloat64`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "type": "number"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordFloat64(pub ::std::collections::BTreeMap<::std::string::String, f64>);
impl ::std::ops::Deref for RecordFloat64 {
    type Target = ::std::collections::BTreeMap<::std::string::String, f64>;
    fn deref(&self) -> &::std::collections::BTreeMap<::std::string::String, f64> {
        &self.0
    }
}
impl ::std::convert::From<RecordFloat64>
    for ::std::collections::BTreeMap<::std::string::String, f64>
{
    fn from(value: RecordFloat64) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::collections::BTreeMap<::std::string::String, f64>>
    for RecordFloat64
{
    fn from(value: ::std::collections::BTreeMap<::std::string::String, f64>) -> Self {
        Self(value)
    }
}
