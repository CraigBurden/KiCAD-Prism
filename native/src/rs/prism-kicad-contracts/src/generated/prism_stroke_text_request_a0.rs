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
///Horizontal alignment of a run about its `x_mm`, as the renderer takes it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Horizontal alignment of a run about its `x_mm`, as the renderer takes it.",
///  "type": "string",
///  "enum": [
///    "left",
///    "center",
///    "right"
///  ]
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize,
    ::serde::Serialize,
    Clone,
    Copy,
    Debug,
    Eq,
    Hash,
    Ord,
    PartialEq,
    PartialOrd,
)]
pub enum StrokeTextHAlign {
    #[serde(rename = "left")]
    Left,
    #[serde(rename = "center")]
    Center,
    #[serde(rename = "right")]
    Right,
}
impl ::std::fmt::Display for StrokeTextHAlign {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Left => f.write_str("left"),
            Self::Center => f.write_str("center"),
            Self::Right => f.write_str("right"),
        }
    }
}
impl ::std::str::FromStr for StrokeTextHAlign {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "left" => Ok(Self::Left),
            "center" => Ok(Self::Center),
            "right" => Ok(Self::Right),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for StrokeTextHAlign {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StrokeTextHAlign {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StrokeTextHAlign {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///The batch of runs `prism-kicad stroke-text --request` renders in one call.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.stroke_text.request:a0",
///  "title": "StrokeTextRequestA0",
///  "description": "The batch of runs `prism-kicad stroke-text --request` renders in one call.",
///  "type": "object",
///  "required": [
///    "runs",
///    "schema"
///  ],
///  "properties": {
///    "runs": {
///      "description": "The runs, in the request's order. `CliStrokeTextResultA0.runs` reports them\nin the same order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/StrokeTextRun"
///      }
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.stroke_text.request.a0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct StrokeTextRequestA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    /**The runs, in the request's order. `CliStrokeTextResultA0.runs` reports them
    in the same order.*/
    pub runs: ::std::vec::Vec<StrokeTextRun>,
}
///One text run to render.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One text run to render.",
///  "type": "object",
///  "required": [
///    "h_align",
///    "size_mm",
///    "text",
///    "v_align",
///    "x_mm",
///    "y_mm"
///  ],
///  "properties": {
///    "h_align": {
///      "description": "Horizontal alignment about `x_mm`.",
///      "$ref": "#/$defs/StrokeTextHAlign"
///    },
///    "size_mm": {
///      "description": "The run's nominal size in millimetres: the em size, applied to both axes.",
///      "type": "number"
///    },
///    "text": {
///      "description": "The run's text, UTF-8, exactly as it is to be drawn. KiCad markup\n(`~{}`, `^{}`, `_{}`) is interpreted by the renderer, matching Python\nkicad_monkey.",
///      "type": "string"
///    },
///    "v_align": {
///      "description": "Vertical alignment about `y_mm`.",
///      "$ref": "#/$defs/StrokeTextVAlign"
///    },
///    "x_mm": {
///      "description": "X position of the run's alignment point, in millimetres.",
///      "type": "number"
///    },
///    "y_mm": {
///      "description": "Y position of the run's alignment point, in millimetres.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct StrokeTextRun {
    /**The run's text, UTF-8, exactly as it is to be drawn. KiCad markup
    (`~{}`, `^{}`, `_{}`) is interpreted by the renderer, matching Python
    kicad_monkey.*/
    pub text: ::std::string::String,
    ///X position of the run's alignment point, in millimetres.
    pub x_mm: f64,
    ///Y position of the run's alignment point, in millimetres.
    pub y_mm: f64,
    ///The run's nominal size in millimetres: the em size, applied to both axes.
    pub size_mm: f64,
    ///Horizontal alignment about `x_mm`.
    pub h_align: StrokeTextHAlign,
    ///Vertical alignment about `y_mm`.
    pub v_align: StrokeTextVAlign,
}
///Vertical alignment of a run about its `y_mm`, as the renderer takes it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Vertical alignment of a run about its `y_mm`, as the renderer takes it.",
///  "type": "string",
///  "enum": [
///    "top",
///    "center",
///    "bottom"
///  ]
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize,
    ::serde::Serialize,
    Clone,
    Copy,
    Debug,
    Eq,
    Hash,
    Ord,
    PartialEq,
    PartialOrd,
)]
pub enum StrokeTextVAlign {
    #[serde(rename = "top")]
    Top,
    #[serde(rename = "center")]
    Center,
    #[serde(rename = "bottom")]
    Bottom,
}
impl ::std::fmt::Display for StrokeTextVAlign {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Top => f.write_str("top"),
            Self::Center => f.write_str("center"),
            Self::Bottom => f.write_str("bottom"),
        }
    }
}
impl ::std::str::FromStr for StrokeTextVAlign {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "top" => Ok(Self::Top),
            "center" => Ok(Self::Center),
            "bottom" => Ok(Self::Bottom),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for StrokeTextVAlign {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StrokeTextVAlign {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StrokeTextVAlign {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
