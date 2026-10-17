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
///A point in millimetres, `[x, y]` in that order, as the renderer returns it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A point in millimetres, `[x, y]` in that order, as the renderer returns it.",
///  "type": "array",
///  "items": {
///    "type": "number"
///  },
///  "maxItems": 2,
///  "minItems": 2
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct CliMmPoint(pub [f64; 2usize]);
impl ::std::ops::Deref for CliMmPoint {
    type Target = [f64; 2usize];
    fn deref(&self) -> &[f64; 2usize] {
        &self.0
    }
}
impl ::std::convert::From<CliMmPoint> for [f64; 2usize] {
    fn from(value: CliMmPoint) -> Self {
        value.0
    }
}
impl ::std::convert::From<[f64; 2usize]> for CliMmPoint {
    fn from(value: [f64; 2usize]) -> Self {
        Self(value)
    }
}
///One polyline in millimetres: its points in stroke order.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One polyline in millimetres: its points in stroke order.",
///  "type": "array",
///  "items": {
///    "$ref": "#/$defs/CliMmPoint"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct CliMmPolyline(pub ::std::vec::Vec<CliMmPoint>);
impl ::std::ops::Deref for CliMmPolyline {
    type Target = ::std::vec::Vec<CliMmPoint>;
    fn deref(&self) -> &::std::vec::Vec<CliMmPoint> {
        &self.0
    }
}
impl ::std::convert::From<CliMmPolyline> for ::std::vec::Vec<CliMmPoint> {
    fn from(value: CliMmPolyline) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::vec::Vec<CliMmPoint>> for CliMmPolyline {
    fn from(value: ::std::vec::Vec<CliMmPoint>) -> Self {
        Self(value)
    }
}
///stdout of `stroke-text --request` (exit 0).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.stroke_text_result:a0",
///  "title": "CliStrokeTextResultA0",
///  "description": "stdout of `stroke-text --request` (exit 0).",
///  "type": "object",
///  "required": [
///    "runs",
///    "schema"
///  ],
///  "properties": {
///    "runs": {
///      "description": "One entry per run of the request, in the request's run order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliStrokeTextRun"
///      }
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.stroke_text_result.a0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliStrokeTextResultA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///One entry per run of the request, in the request's run order.
    pub runs: ::std::vec::Vec<CliStrokeTextRun>,
}
///One rendered text run.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One rendered text run.",
///  "type": "object",
///  "required": [
///    "advance_mm",
///    "missing_codepoints",
///    "polylines_mm"
///  ],
///  "properties": {
///    "advance_mm": {
///      "description": "The run's advance width in millimetres: `_calculate_text_width(text) × size_mm`.",
///      "type": "number"
///    },
///    "missing_codepoints": {
///      "description": "The code points the NewStroke font has no glyph for, so the run drew them\nas nothing (`fonts.unsupported_codepoints`), in ascending numeric order.\nEmpty when every code point is present.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/Count"
///      }
///    },
///    "polylines_mm": {
///      "description": "The run's polylines in millimetres, in the order the renderer returns them; each polyline is one stroke.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliMmPolyline"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliStrokeTextRun {
    ///The run's polylines in millimetres, in the order the renderer returns them; each polyline is one stroke.
    pub polylines_mm: ::std::vec::Vec<CliMmPolyline>,
    ///The run's advance width in millimetres: `_calculate_text_width(text) × size_mm`.
    pub advance_mm: f64,
    /**The code points the NewStroke font has no glyph for, so the run drew them
    as nothing (`fonts.unsupported_codepoints`), in ascending numeric order.
    Empty when every code point is present.*/
    pub missing_codepoints: ::std::vec::Vec<Count>,
}
///A count of things: a non-negative safe integer.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A count of things: a non-negative safe integer.",
///  "type": "integer",
///  "minimum": 0.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct Count(pub u64);
impl ::std::ops::Deref for Count {
    type Target = u64;
    fn deref(&self) -> &u64 {
        &self.0
    }
}
impl ::std::convert::From<Count> for u64 {
    fn from(value: Count) -> Self {
        value.0
    }
}
impl ::std::convert::From<u64> for Count {
    fn from(value: u64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for Count {
    type Err = <u64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for Count {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for Count {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for Count {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
