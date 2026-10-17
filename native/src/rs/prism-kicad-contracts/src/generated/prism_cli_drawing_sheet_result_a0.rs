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
///How a drawn polygon or rectangle is filled, KiCad's spelling.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How a drawn polygon or rectangle is filled, KiCad's spelling.",
///  "type": "string",
///  "enum": [
///    "NO_FILL",
///    "FILLED_SHAPE",
///    "FILLED_WITH_BG_BODYCOLOR"
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
pub enum CliDrawingSheetFill {
    #[serde(rename = "NO_FILL")]
    NoFill,
    #[serde(rename = "FILLED_SHAPE")]
    FilledShape,
    #[serde(rename = "FILLED_WITH_BG_BODYCOLOR")]
    FilledWithBgBodycolor,
}
impl ::std::fmt::Display for CliDrawingSheetFill {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::NoFill => f.write_str("NO_FILL"),
            Self::FilledShape => f.write_str("FILLED_SHAPE"),
            Self::FilledWithBgBodycolor => f.write_str("FILLED_WITH_BG_BODYCOLOR"),
        }
    }
}
impl ::std::str::FromStr for CliDrawingSheetFill {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "NO_FILL" => Ok(Self::NoFill),
            "FILLED_SHAPE" => Ok(Self::FilledShape),
            "FILLED_WITH_BG_BODYCOLOR" => Ok(Self::FilledWithBgBodycolor),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliDrawingSheetFill {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliDrawingSheetFill {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliDrawingSheetFill {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///Horizontal alignment of a drawn text run, KiCad's spelling.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Horizontal alignment of a drawn text run, KiCad's spelling.",
///  "type": "string",
///  "enum": [
///    "GR_TEXT_H_ALIGN_LEFT",
///    "GR_TEXT_H_ALIGN_CENTER",
///    "GR_TEXT_H_ALIGN_RIGHT"
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
pub enum CliDrawingSheetHAlign {
    #[serde(rename = "GR_TEXT_H_ALIGN_LEFT")]
    GrTextHAlignLeft,
    #[serde(rename = "GR_TEXT_H_ALIGN_CENTER")]
    GrTextHAlignCenter,
    #[serde(rename = "GR_TEXT_H_ALIGN_RIGHT")]
    GrTextHAlignRight,
}
impl ::std::fmt::Display for CliDrawingSheetHAlign {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::GrTextHAlignLeft => f.write_str("GR_TEXT_H_ALIGN_LEFT"),
            Self::GrTextHAlignCenter => f.write_str("GR_TEXT_H_ALIGN_CENTER"),
            Self::GrTextHAlignRight => f.write_str("GR_TEXT_H_ALIGN_RIGHT"),
        }
    }
}
impl ::std::str::FromStr for CliDrawingSheetHAlign {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "GR_TEXT_H_ALIGN_LEFT" => Ok(Self::GrTextHAlignLeft),
            "GR_TEXT_H_ALIGN_CENTER" => Ok(Self::GrTextHAlignCenter),
            "GR_TEXT_H_ALIGN_RIGHT" => Ok(Self::GrTextHAlignRight),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliDrawingSheetHAlign {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliDrawingSheetHAlign {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliDrawingSheetHAlign {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One operation of the default drawing sheet, discriminated by `kind`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One operation of the default drawing sheet, discriminated by `kind`.",
///  "oneOf": [
///    {
///      "description": "A polyline.",
///      "$ref": "#/$defs/CliDrawingSheetPoly"
///    },
///    {
///      "description": "A rectangle.",
///      "$ref": "#/$defs/CliDrawingSheetRect"
///    },
///    {
///      "description": "A text run.",
///      "$ref": "#/$defs/CliDrawingSheetText"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum CliDrawingSheetOp {
    Poly(CliDrawingSheetPoly),
    Rect(CliDrawingSheetRect),
    Text(CliDrawingSheetText),
}
impl ::std::convert::From<CliDrawingSheetPoly> for CliDrawingSheetOp {
    fn from(value: CliDrawingSheetPoly) -> Self {
        Self::Poly(value)
    }
}
impl ::std::convert::From<CliDrawingSheetRect> for CliDrawingSheetOp {
    fn from(value: CliDrawingSheetRect) -> Self {
        Self::Rect(value)
    }
}
impl ::std::convert::From<CliDrawingSheetText> for CliDrawingSheetOp {
    fn from(value: CliDrawingSheetText) -> Self {
        Self::Text(value)
    }
}
/**One drawn polyline. A polyline of exactly two points is a line
(`worksheet.py:84-92`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One drawn polyline. A polyline of exactly two points is a line\n(`worksheet.py:84-92`).",
///  "type": "object",
///  "required": [
///    "fill",
///    "kind",
///    "points",
///    "stroke_color",
///    "width_nm"
///  ],
///  "properties": {
///    "fill": {
///      "description": "How the shape is filled, KiCad's token.",
///      "$ref": "#/$defs/CliDrawingSheetFill"
///    },
///    "kind": {
///      "description": "Variant tag: a polyline.",
///      "type": "string",
///      "const": "poly"
///    },
///    "points": {
///      "description": "The polyline's vertices, in draw order, board frame.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliPointNm"
///      }
///    },
///    "stroke_color": {
///      "description": "Stroke colour, `#RRGGBB` or `#RRGGBBAA`.",
///      "type": "string"
///    },
///    "width_nm": {
///      "description": "Stroke width in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliDrawingSheetPoly {
    ///Variant tag: a polyline.
    pub kind: ::std::string::String,
    ///The polyline's vertices, in draw order, board frame.
    pub points: ::std::vec::Vec<CliPointNm>,
    ///How the shape is filled, KiCad's token.
    pub fill: CliDrawingSheetFill,
    ///Stroke width in nanometres.
    pub width_nm: NonNegativeNanometres,
    ///Stroke colour, `#RRGGBB` or `#RRGGBBAA`.
    pub stroke_color: ::std::string::String,
}
///One drawn rectangle.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One drawn rectangle.",
///  "type": "object",
///  "required": [
///    "corner_radius_nm",
///    "fill",
///    "kind",
///    "stroke_color",
///    "width_nm",
///    "x1_nm",
///    "x2_nm",
///    "y1_nm",
///    "y2_nm"
///  ],
///  "properties": {
///    "corner_radius_nm": {
///      "description": "Corner radius in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "fill": {
///      "description": "How the shape is filled, KiCad's token.",
///      "$ref": "#/$defs/CliDrawingSheetFill"
///    },
///    "kind": {
///      "description": "Variant tag: a rectangle.",
///      "type": "string",
///      "const": "rect"
///    },
///    "stroke_color": {
///      "description": "Stroke colour, `#RRGGBB` or `#RRGGBBAA`.",
///      "type": "string"
///    },
///    "width_nm": {
///      "description": "Stroke width in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "x1_nm": {
///      "description": "X of the first corner in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "x2_nm": {
///      "description": "X of the opposite corner in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "y1_nm": {
///      "description": "Y of the first corner in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "y2_nm": {
///      "description": "Y of the opposite corner in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliDrawingSheetRect {
    ///Variant tag: a rectangle.
    pub kind: ::std::string::String,
    ///X of the first corner in nanometres.
    pub x1_nm: Nanometres,
    ///Y of the first corner in nanometres.
    pub y1_nm: Nanometres,
    ///X of the opposite corner in nanometres.
    pub x2_nm: Nanometres,
    ///Y of the opposite corner in nanometres.
    pub y2_nm: Nanometres,
    ///Corner radius in nanometres.
    pub corner_radius_nm: NonNegativeNanometres,
    ///How the shape is filled, KiCad's token.
    pub fill: CliDrawingSheetFill,
    ///Stroke width in nanometres.
    pub width_nm: NonNegativeNanometres,
    ///Stroke colour, `#RRGGBB` or `#RRGGBBAA`.
    pub stroke_color: ::std::string::String,
}
///stdout of `drawing-sheet` (exit 0): the default worksheet's draw operations.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.drawing_sheet_result:a0",
///  "title": "CliDrawingSheetResultA0",
///  "description": "stdout of `drawing-sheet` (exit 0): the default worksheet's draw operations.",
///  "type": "object",
///  "required": [
///    "ops",
///    "schema"
///  ],
///  "properties": {
///    "ops": {
///      "description": "The draw operations, in the order `drawing_sheet_to_ops` returns them: the\ndefault worksheet's on-disk element order, with every repeat expanded in\nplace. The frame's rectangles, lines and title-block text therefore\ninterleave as the worksheet file lists them, not grouped by kind.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliDrawingSheetOp"
///      }
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.drawing_sheet_result.a0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliDrawingSheetResultA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    /**The draw operations, in the order `drawing_sheet_to_ops` returns them: the
    default worksheet's on-disk element order, with every repeat expanded in
    place. The frame's rectangles, lines and title-block text therefore
    interleave as the worksheet file lists them, not grouped by kind.*/
    pub ops: ::std::vec::Vec<CliDrawingSheetOp>,
}
/**One drawn text run. Its glyph geometry is `stroke-text`'s: draw the run's
`text` at (`x_nm`, `y_nm`) with the NewStroke polylines of a
`StrokeTextRequestA0` run whose size is `size_x_nm`/1e6 mm, aligned by
`h_align`/`v_align`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One drawn text run. Its glyph geometry is `stroke-text`'s: draw the run's\n`text` at (`x_nm`, `y_nm`) with the NewStroke polylines of a\n`StrokeTextRequestA0` run whose size is `size_x_nm`/1e6 mm, aligned by\n`h_align`/`v_align`.",
///  "type": "object",
///  "required": [
///    "bold",
///    "color",
///    "font_face",
///    "h_align",
///    "italic",
///    "kind",
///    "multiline",
///    "orient_deg",
///    "pen_width_nm",
///    "size_x_nm",
///    "size_y_nm",
///    "text",
///    "v_align",
///    "x_nm",
///    "y_nm"
///  ],
///  "properties": {
///    "bold": {
///      "description": "True when the text is bold.",
///      "type": "boolean"
///    },
///    "color": {
///      "description": "Text colour, `#RRGGBB` or `#RRGGBBAA`.",
///      "type": "string"
///    },
///    "font_face": {
///      "description": "The text's font face, for example `Arial`.",
///      "type": "string"
///    },
///    "h_align": {
///      "description": "Horizontal alignment about `x_nm`, KiCad's spelling.",
///      "$ref": "#/$defs/CliDrawingSheetHAlign"
///    },
///    "italic": {
///      "description": "True when the text is italic.",
///      "type": "boolean"
///    },
///    "kind": {
///      "description": "Variant tag: a text run.",
///      "type": "string",
///      "const": "text"
///    },
///    "multiline": {
///      "description": "True when the text may span several lines.",
///      "type": "boolean"
///    },
///    "orient_deg": {
///      "description": "Rotation in degrees as written, 0 for the default sheet's horizontal text.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "pen_width_nm": {
///      "description": "Pen width in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "size_x_nm": {
///      "description": "Nominal width of one glyph in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "size_y_nm": {
///      "description": "Nominal height of one glyph in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "text": {
///      "description": "The run's text, exactly as it is to be drawn.",
///      "type": "string"
///    },
///    "v_align": {
///      "description": "Vertical alignment about `y_nm`, KiCad's spelling.",
///      "$ref": "#/$defs/CliDrawingSheetVAlign"
///    },
///    "x_nm": {
///      "description": "X of the run's alignment point in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "y_nm": {
///      "description": "Y of the run's alignment point in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliDrawingSheetText {
    ///Variant tag: a text run.
    pub kind: ::std::string::String,
    ///X of the run's alignment point in nanometres.
    pub x_nm: Nanometres,
    ///Y of the run's alignment point in nanometres.
    pub y_nm: Nanometres,
    ///The run's text, exactly as it is to be drawn.
    pub text: ::std::string::String,
    ///Text colour, `#RRGGBB` or `#RRGGBBAA`.
    pub color: ::std::string::String,
    ///Rotation in degrees as written, 0 for the default sheet's horizontal text.
    pub orient_deg: Degrees,
    ///Nominal width of one glyph in nanometres.
    pub size_x_nm: NonNegativeNanometres,
    ///Nominal height of one glyph in nanometres.
    pub size_y_nm: NonNegativeNanometres,
    ///Pen width in nanometres.
    pub pen_width_nm: NonNegativeNanometres,
    ///Horizontal alignment about `x_nm`, KiCad's spelling.
    pub h_align: CliDrawingSheetHAlign,
    ///Vertical alignment about `y_nm`, KiCad's spelling.
    pub v_align: CliDrawingSheetVAlign,
    ///True when the text is italic.
    pub italic: bool,
    ///True when the text is bold.
    pub bold: bool,
    ///True when the text may span several lines.
    pub multiline: bool,
    ///The text's font face, for example `Arial`.
    pub font_face: ::std::string::String,
}
///Vertical alignment of a drawn text run, KiCad's spelling.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Vertical alignment of a drawn text run, KiCad's spelling.",
///  "type": "string",
///  "enum": [
///    "GR_TEXT_V_ALIGN_TOP",
///    "GR_TEXT_V_ALIGN_CENTER",
///    "GR_TEXT_V_ALIGN_BOTTOM"
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
pub enum CliDrawingSheetVAlign {
    #[serde(rename = "GR_TEXT_V_ALIGN_TOP")]
    GrTextVAlignTop,
    #[serde(rename = "GR_TEXT_V_ALIGN_CENTER")]
    GrTextVAlignCenter,
    #[serde(rename = "GR_TEXT_V_ALIGN_BOTTOM")]
    GrTextVAlignBottom,
}
impl ::std::fmt::Display for CliDrawingSheetVAlign {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::GrTextVAlignTop => f.write_str("GR_TEXT_V_ALIGN_TOP"),
            Self::GrTextVAlignCenter => f.write_str("GR_TEXT_V_ALIGN_CENTER"),
            Self::GrTextVAlignBottom => f.write_str("GR_TEXT_V_ALIGN_BOTTOM"),
        }
    }
}
impl ::std::str::FromStr for CliDrawingSheetVAlign {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "GR_TEXT_V_ALIGN_TOP" => Ok(Self::GrTextVAlignTop),
            "GR_TEXT_V_ALIGN_CENTER" => Ok(Self::GrTextVAlignCenter),
            "GR_TEXT_V_ALIGN_BOTTOM" => Ok(Self::GrTextVAlignBottom),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliDrawingSheetVAlign {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliDrawingSheetVAlign {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliDrawingSheetVAlign {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A point in nanometres in KiCad's board frame (+x right, +y down).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A point in nanometres in KiCad's board frame (+x right, +y down).",
///  "type": "object",
///  "required": [
///    "x_nm",
///    "y_nm"
///  ],
///  "properties": {
///    "x_nm": {
///      "description": "X coordinate in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "y_nm": {
///      "description": "Y coordinate in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliPointNm {
    ///X coordinate in nanometres.
    pub x_nm: Nanometres,
    ///Y coordinate in nanometres.
    pub y_nm: Nanometres,
}
/**Angle in degrees. In new documents it is as written in the KiCad file:
not normalized, not rounded. A parity document may round it as today's
output does, and its field says so. A positive angle is a counter-clockwise rotation as KiCad shows
it on the front side. Each field states the frame its angle is in.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Angle in degrees. In new documents it is as written in the KiCad file:\nnot normalized, not rounded. A parity document may round it as today's\noutput does, and its field says so. A positive angle is a counter-clockwise rotation as KiCad shows\nit on the front side. Each field states the frame its angle is in.",
///  "type": "number"
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct Degrees(pub f64);
impl ::std::ops::Deref for Degrees {
    type Target = f64;
    fn deref(&self) -> &f64 {
        &self.0
    }
}
impl ::std::convert::From<Degrees> for f64 {
    fn from(value: Degrees) -> Self {
        value.0
    }
}
impl ::std::convert::From<f64> for Degrees {
    fn from(value: f64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for Degrees {
    type Err = <f64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for Degrees {
    type Error = <f64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for Degrees {
    type Error = <f64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for Degrees {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**Length or coordinate in integer nanometres, KiCad's internal board unit.
Converted from the file's decimal millimetres as KiCad's own parser does:
the double product value_mm * 1e6, rounded half away from zero. A single
coordinate or dimension fits KiCad's 32-bit range; sums (for example a
net's total track length) may not, hence a safe integer (|n| < 2^53).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Length or coordinate in integer nanometres, KiCad's internal board unit.\nConverted from the file's decimal millimetres as KiCad's own parser does:\nthe double product value_mm * 1e6, rounded half away from zero. A single\ncoordinate or dimension fits KiCad's 32-bit range; sums (for example a\nnet's total track length) may not, hence a safe integer (|n| < 2^53).",
///  "type": "integer"
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct Nanometres(pub i64);
impl ::std::ops::Deref for Nanometres {
    type Target = i64;
    fn deref(&self) -> &i64 {
        &self.0
    }
}
impl ::std::convert::From<Nanometres> for i64 {
    fn from(value: Nanometres) -> Self {
        value.0
    }
}
impl ::std::convert::From<i64> for Nanometres {
    fn from(value: i64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for Nanometres {
    type Err = <i64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for Nanometres {
    type Error = <i64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for Nanometres {
    type Error = <i64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for Nanometres {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///A Nanometres value that is never negative: a thickness, width, diameter or length.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A Nanometres value that is never negative: a thickness, width, diameter or length.",
///  "type": "integer",
///  "minimum": 0.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct NonNegativeNanometres(pub u64);
impl ::std::ops::Deref for NonNegativeNanometres {
    type Target = u64;
    fn deref(&self) -> &u64 {
        &self.0
    }
}
impl ::std::convert::From<NonNegativeNanometres> for u64 {
    fn from(value: NonNegativeNanometres) -> Self {
        value.0
    }
}
impl ::std::convert::From<u64> for NonNegativeNanometres {
    fn from(value: u64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for NonNegativeNanometres {
    type Err = <u64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for NonNegativeNanometres {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for NonNegativeNanometres {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for NonNegativeNanometres {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
impl<'de> ::serde::Deserialize<'de> for CliDrawingSheetOp {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("poly") {
            return ::serde_json::from_value::<CliDrawingSheetPoly>(value)
                .map(Self::Poly)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("rect") {
            return ::serde_json::from_value::<CliDrawingSheetRect>(value)
                .map(Self::Rect)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("text") {
            return ::serde_json::from_value::<CliDrawingSheetText>(value)
                .map(Self::Text)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum CliDrawingSheetOp",
        ))
    }
}
