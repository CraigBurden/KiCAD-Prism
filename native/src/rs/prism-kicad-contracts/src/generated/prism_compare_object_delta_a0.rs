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
///One scalar in a settings table.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One scalar in a settings table.",
///  "oneOf": [
///    {
///      "description": "A text.",
///      "type": "string"
///    },
///    {
///      "description": "A number.",
///      "type": "number"
///    },
///    {
///      "description": "A flag.",
///      "type": "boolean"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum BoardObjectsReviewScalar {
    String(::std::string::String),
    Number(f64),
    Boolean(bool),
}
impl ::std::fmt::Display for BoardObjectsReviewScalar {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match self {
            Self::String(x) => x.fmt(f),
            Self::Number(x) => x.fmt(f),
            Self::Boolean(x) => x.fmt(f),
        }
    }
}
impl ::std::convert::From<f64> for BoardObjectsReviewScalar {
    fn from(value: f64) -> Self {
        Self::Number(value)
    }
}
impl ::std::convert::From<bool> for BoardObjectsReviewScalar {
    fn from(value: bool) -> Self {
        Self::Boolean(value)
    }
}
///A flat table of settings; keys are KiCad's setting keys as written, serialized in code point order.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A flat table of settings; keys are KiCad's setting keys as written, serialized in code point order.",
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/BoardObjectsReviewScalar"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct BoardObjectsReviewTable(
    pub ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar>,
);
impl ::std::ops::Deref for BoardObjectsReviewTable {
    type Target = ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar> {
        &self.0
    }
}
impl ::std::convert::From<BoardObjectsReviewTable>
    for ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar>
{
    fn from(value: BoardObjectsReviewTable) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar>,
    > for BoardObjectsReviewTable
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar>,
    ) -> Self {
        Self(value)
    }
}
/**One review-field value, as Design Comparison shows it: the value today's
index writes, unconverted (lengths stay the millimetres the file writes,
flags stay booleans, `Size` stays a `w × h` text). A presentation value,
not a typed fact: typed lengths of this member are the `…Nm` fields. A
value of any other shape is written as its canonical JSON text (field
map).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One review-field value, as Design Comparison shows it: the value today's\nindex writes, unconverted (lengths stay the millimetres the file writes,\nflags stay booleans, `Size` stays a `w × h` text). A presentation value,\nnot a typed fact: typed lengths of this member are the `…Nm` fields. A\nvalue of any other shape is written as its canonical JSON text (field\nmap).",
///  "oneOf": [
///    {
///      "description": "A text.",
///      "type": "string"
///    },
///    {
///      "description": "A number as today's index writes it.",
///      "type": "number"
///    },
///    {
///      "description": "A flag.",
///      "type": "boolean"
///    },
///    {
///      "description": "A list of texts, in the order today's index writes them.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    {
///      "description": "A list of numbers, in the order today's index writes them.",
///      "type": "array",
///      "items": {
///        "type": "number"
///      }
///    },
///    {
///      "description": "One table of settings (for example a teardrop parameter set).",
///      "$ref": "#/$defs/BoardObjectsReviewTable"
///    },
///    {
///      "description": "A list of tables, in the order today's index writes them.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/BoardObjectsReviewTable"
///      }
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum BoardObjectsReviewValue {
    Variant0(::std::string::String),
    Variant1(f64),
    Variant2(bool),
    Variant3(::std::vec::Vec<::std::string::String>),
    Variant4(::std::vec::Vec<f64>),
    Variant5(BoardObjectsReviewTable),
    Variant6(::std::vec::Vec<BoardObjectsReviewTable>),
}
impl ::std::convert::From<f64> for BoardObjectsReviewValue {
    fn from(value: f64) -> Self {
        Self::Variant1(value)
    }
}
impl ::std::convert::From<bool> for BoardObjectsReviewValue {
    fn from(value: bool) -> Self {
        Self::Variant2(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<::std::string::String>> for BoardObjectsReviewValue {
    fn from(value: ::std::vec::Vec<::std::string::String>) -> Self {
        Self::Variant3(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<f64>> for BoardObjectsReviewValue {
    fn from(value: ::std::vec::Vec<f64>) -> Self {
        Self::Variant4(value)
    }
}
impl ::std::convert::From<BoardObjectsReviewTable> for BoardObjectsReviewValue {
    fn from(value: BoardObjectsReviewTable) -> Self {
        Self::Variant5(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<BoardObjectsReviewTable>> for BoardObjectsReviewValue {
    fn from(value: ::std::vec::Vec<BoardObjectsReviewTable>) -> Self {
        Self::Variant6(value)
    }
}
///A `(color <r> <g> <b> [<a>])` as today's parser reads it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A `(color <r> <g> <b> [<a>])` as today's parser reads it.",
///  "type": "object",
///  "required": [
///    "a",
///    "b",
///    "g",
///    "r"
///  ],
///  "properties": {
///    "a": {
///      "description": "Alpha, 0 to 1; 1 when the form omits it.",
///      "type": "number"
///    },
///    "b": {
///      "description": "Blue, 0 to 1.",
///      "type": "number"
///    },
///    "g": {
///      "description": "Green, 0 to 1.",
///      "type": "number"
///    },
///    "r": {
///      "description": "Red, 0 to 1.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareColorA0 {
    ///Red, 0 to 1.
    pub r: f64,
    ///Green, 0 to 1.
    pub g: f64,
    ///Blue, 0 to 1.
    pub b: f64,
    ///Alpha, 0 to 1; 1 when the form omits it.
    pub a: f64,
}
///A font's `(size <height> <width>)`, today's `{x, y}`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A font's `(size <height> <width>)`, today's `{x, y}`.",
///  "type": "object",
///  "required": [
///    "x",
///    "y"
///  ],
///  "properties": {
///    "x": {
///      "description": "The first value.",
///      "type": "number"
///    },
///    "y": {
///      "description": "The second value.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareFontSizeA0 {
    ///The first value.
    pub x: f64,
    ///The second value.
    pub y: f64,
}
///Horizontal justification of a text.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Horizontal justification of a text.",
///  "type": "string",
///  "enum": [
///    "left",
///    "right",
///    "center"
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
pub enum CompareJustifyHorizontalA0 {
    #[serde(rename = "left")]
    Left,
    #[serde(rename = "right")]
    Right,
    #[serde(rename = "center")]
    Center,
}
impl ::std::fmt::Display for CompareJustifyHorizontalA0 {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Left => f.write_str("left"),
            Self::Right => f.write_str("right"),
            Self::Center => f.write_str("center"),
        }
    }
}
impl ::std::str::FromStr for CompareJustifyHorizontalA0 {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "left" => Ok(Self::Left),
            "right" => Ok(Self::Right),
            "center" => Ok(Self::Center),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CompareJustifyHorizontalA0 {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CompareJustifyHorizontalA0 {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CompareJustifyHorizontalA0 {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///Vertical justification of a text.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Vertical justification of a text.",
///  "type": "string",
///  "enum": [
///    "top",
///    "bottom",
///    "center"
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
pub enum CompareJustifyVerticalA0 {
    #[serde(rename = "top")]
    Top,
    #[serde(rename = "bottom")]
    Bottom,
    #[serde(rename = "center")]
    Center,
}
impl ::std::fmt::Display for CompareJustifyVerticalA0 {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Top => f.write_str("top"),
            Self::Bottom => f.write_str("bottom"),
            Self::Center => f.write_str("center"),
        }
    }
}
impl ::std::str::FromStr for CompareJustifyVerticalA0 {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "top" => Ok(Self::Top),
            "bottom" => Ok(Self::Bottom),
            "center" => Ok(Self::Center),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CompareJustifyVerticalA0 {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CompareJustifyVerticalA0 {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CompareJustifyVerticalA0 {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**A point in millimetres, `[x, y]` in that order, as today's index writes it.
No rounding: it is the parsed value.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A point in millimetres, `[x, y]` in that order, as today's index writes it.\nNo rounding: it is the parsed value.",
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
pub struct CompareMmPoint(pub [f64; 2usize]);
impl ::std::ops::Deref for CompareMmPoint {
    type Target = [f64; 2usize];
    fn deref(&self) -> &[f64; 2usize] {
        &self.0
    }
}
impl ::std::convert::From<CompareMmPoint> for [f64; 2usize] {
    fn from(value: CompareMmPoint) -> Self {
        value.0
    }
}
impl ::std::convert::From<[f64; 2usize]> for CompareMmPoint {
    fn from(value: [f64; 2usize]) -> Self {
        Self(value)
    }
}
///One object as `native_object` carries it (`ecad-diff.mjs:194-220`), for `componentObjects`, `base` and `compare`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One object as `native_object` carries it (`ecad-diff.mjs:194-220`), for `componentObjects`, `base` and `compare`.",
///  "type": "object",
///  "required": [
///    "documentPath",
///    "kind",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The object's position `[x, y]` in millimetres, in that order, in the frame today's index uses for its kind. Absent when the kind has no position.",
///      "$ref": "#/$defs/CompareMmPoint"
///    },
///    "dnp": {
///      "description": "True when the object is do-not-populate. Absent when the kind has no DNP flag.",
///      "type": "boolean"
///    },
///    "documentPath": {
///      "description": "The document's path, project-relative (D1), for example\n`mini_obc.kicad_pcb`. With `uuid` it forms `key`.",
///      "type": "string"
///    },
///    "inBom": {
///      "description": "False when the object is excluded from the BOM. Absent when the kind has no such flag.",
///      "type": "boolean"
///    },
///    "instances": {
///      "description": "A symbol's instances, in file order. Absent when the kind has none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CompareSymbolInstanceA0"
///      }
///    },
///    "kiidPaths": {
///      "description": "Every occurrence path of a symbol or sheet, schematic form, sorted in code point order. Absent when the kind has none.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "kind": {
///      "description": "Kind of object, today's spelling.",
///      "$ref": "#/$defs/CompareObjectDeltaKind"
///    },
///    "layer": {
///      "description": "The object's layer as written. Absent when the form has none.",
///      "type": "string"
///    },
///    "layers": {
///      "description": "A via's `(layers …)` entries, in file order. Absent unless the object has layers.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "libId": {
///      "description": "The object's library link as written. Absent when it has none.",
///      "type": "string"
///    },
///    "mirror": {
///      "description": "How a symbol is mirrored. Absent when it is not mirrored.",
///      "$ref": "#/$defs/CompareObjectDeltaMirror"
///    },
///    "name": {
///      "description": "A zone's, group's or review-only object's name. Absent when the form has none.",
///      "type": "string"
///    },
///    "net": {
///      "description": "The object's net, by name. Absent when it has no net.",
///      "type": "string"
///    },
///    "number": {
///      "description": "A pad's or pin's number as written; may be empty. Absent when the form has none.",
///      "type": "string"
///    },
///    "onBoard": {
///      "description": "False when the object is not on the board. Absent when the kind has no such flag.",
///      "type": "boolean"
///    },
///    "parentUuid": {
///      "description": "Uuid of the object's parent (a pad's footprint, a pin's symbol, ...). Absent when there is none.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "properties": {
///      "description": "The object's own `(property …)` fields, in file order: a schematic\nsymbol's or sheet's properties, or a footprint's fields. Absent when the\nkind has none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CompareObjectPropertyA0"
///      }
///    },
///    "refdes": {
///      "description": "The object's reference designator. Absent when it has none or it is empty.",
///      "type": "string"
///    },
///    "reviewFields": {
///      "description": "Review fields, with keys in code point order; the keys are review labels. Absent when the kind has none.",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "reviewOnly": {
///      "description": "True for a review-only object. Absent for an object with a KiCad uuid.",
///      "type": "boolean"
///    },
///    "rotation": {
///      "description": "The object's rotation in degrees as written, `0` when the form omits it. Absent when the kind has no rotation.",
///      "type": "number"
///    },
///    "text": {
///      "description": "A label's, sheet pin's or footprint text's text as written. Absent when the form has none.",
///      "type": "string"
///    },
///    "uuid": {
///      "description": "The object's id: its KiCad uuid, or a review-only object's synthetic id\n(`BoardObjectsReviewOnlyId`). With `documentPath` it forms `key`.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareNativeObjectA0 {
    /**The object's id: its KiCad uuid, or a review-only object's synthetic id
    (`BoardObjectsReviewOnlyId`). With `documentPath` it forms `key`.*/
    pub uuid: ::std::string::String,
    ///Kind of object, today's spelling.
    pub kind: CompareObjectDeltaKind,
    /**The document's path, project-relative (D1), for example
    `mini_obc.kicad_pcb`. With `uuid` it forms `key`.*/
    #[serde(rename = "documentPath")]
    pub document_path: ::std::string::String,
    ///Uuid of the object's parent (a pad's footprint, a pin's symbol, ...). Absent when there is none.
    #[serde(
        rename = "parentUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub parent_uuid: ::std::option::Option<KiCadUuid>,
    ///The object's position `[x, y]` in millimetres, in that order, in the frame today's index uses for its kind. Absent when the kind has no position.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<CompareMmPoint>,
    ///The object's rotation in degrees as written, `0` when the form omits it. Absent when the kind has no rotation.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub rotation: ::std::option::Option<f64>,
    ///How a symbol is mirrored. Absent when it is not mirrored.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub mirror: ::std::option::Option<CompareObjectDeltaMirror>,
    ///The object's layer as written. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<::std::string::String>,
    ///A via's `(layers …)` entries, in file order. Absent unless the object has layers.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layers: ::std::option::Option<::std::vec::Vec<::std::string::String>>,
    ///The object's net, by name. Absent when it has no net.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<::std::string::String>,
    ///The object's reference designator. Absent when it has none or it is empty.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub refdes: ::std::option::Option<::std::string::String>,
    ///The object's library link as written. Absent when it has none.
    #[serde(
        rename = "libId",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub lib_id: ::std::option::Option<::std::string::String>,
    ///True when the object is do-not-populate. Absent when the kind has no DNP flag.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub dnp: ::std::option::Option<bool>,
    ///False when the object is excluded from the BOM. Absent when the kind has no such flag.
    #[serde(
        rename = "inBom",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub in_bom: ::std::option::Option<bool>,
    ///False when the object is not on the board. Absent when the kind has no such flag.
    #[serde(
        rename = "onBoard",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub on_board: ::std::option::Option<bool>,
    ///Every occurrence path of a symbol or sheet, schematic form, sorted in code point order. Absent when the kind has none.
    #[serde(
        rename = "kiidPaths",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub kiid_paths: ::std::option::Option<::std::vec::Vec<::std::string::String>>,
    ///A symbol's instances, in file order. Absent when the kind has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub instances: ::std::option::Option<::std::vec::Vec<CompareSymbolInstanceA0>>,
    ///A pad's or pin's number as written; may be empty. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub number: ::std::option::Option<::std::string::String>,
    ///A label's, sheet pin's or footprint text's text as written. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub text: ::std::option::Option<::std::string::String>,
    ///A zone's, group's or review-only object's name. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub name: ::std::option::Option<::std::string::String>,
    ///Review fields, with keys in code point order; the keys are review labels. Absent when the kind has none.
    #[serde(
        rename = "reviewFields",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub review_fields: ::std::option::Option<RecordBoardObjectsReviewValue>,
    ///True for a review-only object. Absent for an object with a KiCad uuid.
    #[serde(
        rename = "reviewOnly",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub review_only: ::std::option::Option<bool>,
    /**The object's own `(property …)` fields, in file order: a schematic
    symbol's or sheet's properties, or a footprint's fields. Absent when the
    kind has none.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub properties: ::std::option::Option<::std::vec::Vec<CompareObjectPropertyA0>>,
}
///One object, as `native_target` carries it (`ecad-diff.mjs:222-230`), for `nativeObjects`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One object, as `native_target` carries it (`ecad-diff.mjs:222-230`), for `nativeObjects`.",
///  "type": "object",
///  "required": [
///    "documentPath",
///    "kind",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The object's `[x, y]` position in millimetres, in that order. Absent when it has none.",
///      "$ref": "#/$defs/CompareMmPoint"
///    },
///    "documentPath": {
///      "description": "The document's project-relative path.",
///      "type": "string"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "$ref": "#/$defs/CompareObjectDeltaKind"
///    },
///    "parentUuid": {
///      "description": "Uuid of the parent. Absent when there is none.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "uuid": {
///      "description": "The object's id.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareNativeTargetA0 {
    ///The object's id.
    pub uuid: ::std::string::String,
    ///Kind of object.
    pub kind: CompareObjectDeltaKind,
    ///The document's project-relative path.
    #[serde(rename = "documentPath")]
    pub document_path: ::std::string::String,
    ///Uuid of the parent. Absent when there is none.
    #[serde(
        rename = "parentUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub parent_uuid: ::std::option::Option<KiCadUuid>,
    ///The object's `[x, y]` position in millimetres, in that order. Absent when it has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<CompareMmPoint>,
}
/**Design Comparison's object diff between two bundles (`prism-kicad compare`
`-o`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.compare.object_delta:a0",
///  "title": "CompareObjectDeltaA0",
///  "description": "Design Comparison's object diff between two bundles (`prism-kicad compare`\n`-o`).",
///  "type": "object",
///  "required": [
///    "base",
///    "byKind",
///    "byReason",
///    "changes",
///    "counts",
///    "head",
///    "ignored",
///    "schema"
///  ],
///  "properties": {
///    "base": {
///      "description": "The `--base` side.",
///      "$ref": "#/$defs/CompareObjectDeltaSideA0"
///    },
///    "byKind": {
///      "description": "Per-kind change counts; the keys are `CompareObjectDeltaKind` values, in code point order.",
///      "$ref": "#/$defs/RecordCompareObjectDeltaKindCountsA0"
///    },
///    "byReason": {
///      "description": "Change counts per reason; the keys are `CompareObjectDeltaReason` values, in code point order.",
///      "$ref": "#/$defs/RecordCount"
///    },
///    "changes": {
///      "description": "Added, removed and modified objects, sorted by `key` in code point order (D2).",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CompareObjectDeltaChangeA0"
///      }
///    },
///    "counts": {
///      "description": "The change counts.",
///      "$ref": "#/$defs/CompareObjectDeltaCountsA0"
///    },
///    "head": {
///      "description": "The `--head` side.",
///      "$ref": "#/$defs/CompareObjectDeltaSideA0"
///    },
///    "ignored": {
///      "description": "Objects matched across a UUID or generated-content change, in head object\norder (today's order; Design Comparison compares it as a set).",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CompareObjectDeltaIgnoredA0"
///      }
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.compare.object_delta.a0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareObjectDeltaA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///The `--base` side.
    pub base: CompareObjectDeltaSideA0,
    ///The `--head` side.
    pub head: CompareObjectDeltaSideA0,
    ///Added, removed and modified objects, sorted by `key` in code point order (D2).
    pub changes: ::std::vec::Vec<CompareObjectDeltaChangeA0>,
    /**Objects matched across a UUID or generated-content change, in head object
    order (today's order; Design Comparison compares it as a set).*/
    pub ignored: ::std::vec::Vec<CompareObjectDeltaIgnoredA0>,
    ///The change counts.
    pub counts: CompareObjectDeltaCountsA0,
    ///Per-kind change counts; the keys are `CompareObjectDeltaKind` values, in code point order.
    #[serde(rename = "byKind")]
    pub by_kind: RecordCompareObjectDeltaKindCountsA0,
    ///Change counts per reason; the keys are `CompareObjectDeltaReason` values, in code point order.
    #[serde(rename = "byReason")]
    pub by_reason: RecordCount,
}
///One entry of `changes`: an added, removed or modified object.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One entry of `changes`: an added, removed or modified object.",
///  "type": "object",
///  "required": [
///    "documentPath",
///    "key",
///    "kind",
///    "status",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The object's position `[x, y]` in millimetres, in that order, in the frame today's index uses for its kind. Absent when the kind has no position.",
///      "$ref": "#/$defs/CompareMmPoint"
///    },
///    "atBase": {
///      "description": "The base object's position in millimetres, `[x, y]` in that order (`modified` only). Absent when it has none.",
///      "$ref": "#/$defs/CompareMmPoint"
///    },
///    "base": {
///      "description": "The `base`-side object (`modified` and `removed` only). Absent for `added`.",
///      "$ref": "#/$defs/CompareNativeObjectA0"
///    },
///    "compare": {
///      "description": "The `head`-side object (`added` and `modified` only). Absent for `removed`.",
///      "$ref": "#/$defs/CompareNativeObjectA0"
///    },
///    "dnp": {
///      "description": "True when the object is do-not-populate. Absent when the kind has no DNP flag.",
///      "type": "boolean"
///    },
///    "documentPath": {
///      "description": "The document's path, project-relative (D1), for example\n`mini_obc.kicad_pcb`. With `uuid` it forms `key`.",
///      "type": "string"
///    },
///    "inBom": {
///      "description": "False when the object is excluded from the BOM. Absent when the kind has no such flag.",
///      "type": "boolean"
///    },
///    "instances": {
///      "description": "A symbol's instances, in file order. Absent when the kind has none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CompareSymbolInstanceA0"
///      }
///    },
///    "key": {
///      "description": "The object's key, `<documentPath>#<uuid>`.",
///      "type": "string"
///    },
///    "kiidPaths": {
///      "description": "Every occurrence path of a symbol or sheet, schematic form, sorted in code point order. Absent when the kind has none.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "kind": {
///      "description": "Kind of object, today's spelling.",
///      "$ref": "#/$defs/CompareObjectDeltaKind"
///    },
///    "layer": {
///      "description": "The object's layer as written. Absent when the form has none.",
///      "type": "string"
///    },
///    "layers": {
///      "description": "A via's `(layers …)` entries, in file order. Absent unless the object has layers.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "libId": {
///      "description": "The object's library link as written. Absent when it has none.",
///      "type": "string"
///    },
///    "mirror": {
///      "description": "How a symbol is mirrored. Absent when it is not mirrored.",
///      "$ref": "#/$defs/CompareObjectDeltaMirror"
///    },
///    "name": {
///      "description": "A zone's, group's or review-only object's name. Absent when the form has none.",
///      "type": "string"
///    },
///    "net": {
///      "description": "The object's net, by name. Absent when it has no net.",
///      "type": "string"
///    },
///    "number": {
///      "description": "A pad's or pin's number as written; may be empty. Absent when the form has none.",
///      "type": "string"
///    },
///    "onBoard": {
///      "description": "False when the object is not on the board. Absent when the kind has no such flag.",
///      "type": "boolean"
///    },
///    "parentUuid": {
///      "description": "Uuid of the object's parent (a pad's footprint, a pin's symbol, ...). Absent when there is none.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "positionDelta": {
///      "description": "The object's move (`modified` only). Absent when it did not move or has no position.",
///      "$ref": "#/$defs/ComparePositionDeltaA0"
///    },
///    "properties": {
///      "description": "The object's property-delta list\n(`CompareObjectPropertyDeltaA0`), sorted by `name` in code point order,\nnot the object's own property list. Absent when there is no delta.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CompareObjectPropertyDeltaA0"
///      }
///    },
///    "reasons": {
///      "description": "The classifier reasons, in the order the classifiers run (`modified` only). Absent for `added` and `removed`.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CompareObjectDeltaReason"
///      }
///    },
///    "refdes": {
///      "description": "The object's reference designator. Absent when it has none or it is empty.",
///      "type": "string"
///    },
///    "reviewFields": {
///      "description": "Review fields, with keys in code point order; the keys are review labels. Absent when the kind has none.",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "reviewOnly": {
///      "description": "True for a review-only object. Absent for an object with a KiCad uuid.",
///      "type": "boolean"
///    },
///    "rotation": {
///      "description": "The object's rotation in degrees as written, `0` when the form omits it. Absent when the kind has no rotation.",
///      "type": "number"
///    },
///    "status": {
///      "description": "How the object relates the two sides; never `ignored` here.",
///      "$ref": "#/$defs/CompareObjectDeltaStatus"
///    },
///    "text": {
///      "description": "A label's, sheet pin's or footprint text's text as written. Absent when the form has none.",
///      "type": "string"
///    },
///    "uuid": {
///      "description": "The object's id: its KiCad uuid, or a review-only object's synthetic id\n(`BoardObjectsReviewOnlyId`). With `documentPath` it forms `key`.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareObjectDeltaChangeA0 {
    ///The object's key, `<documentPath>#<uuid>`.
    pub key: ::std::string::String,
    ///How the object relates the two sides; never `ignored` here.
    pub status: CompareObjectDeltaStatus,
    /**The object's id: its KiCad uuid, or a review-only object's synthetic id
    (`BoardObjectsReviewOnlyId`). With `documentPath` it forms `key`.*/
    pub uuid: ::std::string::String,
    ///Kind of object, today's spelling.
    pub kind: CompareObjectDeltaKind,
    /**The document's path, project-relative (D1), for example
    `mini_obc.kicad_pcb`. With `uuid` it forms `key`.*/
    #[serde(rename = "documentPath")]
    pub document_path: ::std::string::String,
    ///Uuid of the object's parent (a pad's footprint, a pin's symbol, ...). Absent when there is none.
    #[serde(
        rename = "parentUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub parent_uuid: ::std::option::Option<KiCadUuid>,
    ///The object's position `[x, y]` in millimetres, in that order, in the frame today's index uses for its kind. Absent when the kind has no position.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<CompareMmPoint>,
    ///The object's rotation in degrees as written, `0` when the form omits it. Absent when the kind has no rotation.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub rotation: ::std::option::Option<f64>,
    ///How a symbol is mirrored. Absent when it is not mirrored.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub mirror: ::std::option::Option<CompareObjectDeltaMirror>,
    ///The object's layer as written. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<::std::string::String>,
    ///A via's `(layers …)` entries, in file order. Absent unless the object has layers.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layers: ::std::option::Option<::std::vec::Vec<::std::string::String>>,
    ///The object's net, by name. Absent when it has no net.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<::std::string::String>,
    ///The object's reference designator. Absent when it has none or it is empty.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub refdes: ::std::option::Option<::std::string::String>,
    ///The object's library link as written. Absent when it has none.
    #[serde(
        rename = "libId",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub lib_id: ::std::option::Option<::std::string::String>,
    ///True when the object is do-not-populate. Absent when the kind has no DNP flag.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub dnp: ::std::option::Option<bool>,
    ///False when the object is excluded from the BOM. Absent when the kind has no such flag.
    #[serde(
        rename = "inBom",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub in_bom: ::std::option::Option<bool>,
    ///False when the object is not on the board. Absent when the kind has no such flag.
    #[serde(
        rename = "onBoard",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub on_board: ::std::option::Option<bool>,
    ///Every occurrence path of a symbol or sheet, schematic form, sorted in code point order. Absent when the kind has none.
    #[serde(
        rename = "kiidPaths",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub kiid_paths: ::std::option::Option<::std::vec::Vec<::std::string::String>>,
    ///A symbol's instances, in file order. Absent when the kind has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub instances: ::std::option::Option<::std::vec::Vec<CompareSymbolInstanceA0>>,
    ///A pad's or pin's number as written; may be empty. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub number: ::std::option::Option<::std::string::String>,
    ///A label's, sheet pin's or footprint text's text as written. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub text: ::std::option::Option<::std::string::String>,
    ///A zone's, group's or review-only object's name. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub name: ::std::option::Option<::std::string::String>,
    ///Review fields, with keys in code point order; the keys are review labels. Absent when the kind has none.
    #[serde(
        rename = "reviewFields",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub review_fields: ::std::option::Option<RecordBoardObjectsReviewValue>,
    ///True for a review-only object. Absent for an object with a KiCad uuid.
    #[serde(
        rename = "reviewOnly",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub review_only: ::std::option::Option<bool>,
    /**The object's property-delta list
    (`CompareObjectPropertyDeltaA0`), sorted by `name` in code point order,
    not the object's own property list. Absent when there is no delta.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub properties: ::std::option::Option<::std::vec::Vec<CompareObjectPropertyDeltaA0>>,
    ///The `base`-side object (`modified` and `removed` only). Absent for `added`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub base: ::std::option::Option<CompareNativeObjectA0>,
    ///The `head`-side object (`added` and `modified` only). Absent for `removed`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub compare: ::std::option::Option<CompareNativeObjectA0>,
    ///The base object's position in millimetres, `[x, y]` in that order (`modified` only). Absent when it has none.
    #[serde(
        rename = "atBase",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub at_base: ::std::option::Option<CompareMmPoint>,
    ///The classifier reasons, in the order the classifiers run (`modified` only). Absent for `added` and `removed`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub reasons: ::std::option::Option<::std::vec::Vec<CompareObjectDeltaReason>>,
    ///The object's move (`modified` only). Absent when it did not move or has no position.
    #[serde(
        rename = "positionDelta",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub position_delta: ::std::option::Option<ComparePositionDeltaA0>,
}
///The change counts of a comparison (`ecad-diff.mjs:469-477`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The change counts of a comparison (`ecad-diff.mjs:469-477`).",
///  "type": "object",
///  "required": [
///    "added",
///    "baseObjects",
///    "headObjects",
///    "ignored",
///    "modified",
///    "removed",
///    "unchanged"
///  ],
///  "properties": {
///    "added": {
///      "description": "Objects only in `--head`.",
///      "$ref": "#/$defs/Count"
///    },
///    "baseObjects": {
///      "description": "Objects in `--base`.",
///      "$ref": "#/$defs/Count"
///    },
///    "headObjects": {
///      "description": "Objects in `--head`.",
///      "$ref": "#/$defs/Count"
///    },
///    "ignored": {
///      "description": "Objects matched across a UUID change or with only generated content changed.",
///      "$ref": "#/$defs/Count"
///    },
///    "modified": {
///      "description": "Objects in both whose content differs.",
///      "$ref": "#/$defs/Count"
///    },
///    "removed": {
///      "description": "Objects only in `--base`.",
///      "$ref": "#/$defs/Count"
///    },
///    "unchanged": {
///      "description": "Objects in both with equal content, the ignored ones included.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareObjectDeltaCountsA0 {
    ///Objects only in `--head`.
    pub added: Count,
    ///Objects only in `--base`.
    pub removed: Count,
    ///Objects in both whose content differs.
    pub modified: Count,
    ///Objects in both with equal content, the ignored ones included.
    pub unchanged: Count,
    ///Objects matched across a UUID change or with only generated content changed.
    pub ignored: Count,
    ///Objects in `--base`.
    #[serde(rename = "baseObjects")]
    pub base_objects: Count,
    ///Objects in `--head`.
    #[serde(rename = "headObjects")]
    pub head_objects: Count,
}
///One entry of `ignored`: an object matched across a UUID or generated-content change.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One entry of `ignored`: an object matched across a UUID or generated-content change.",
///  "type": "object",
///  "required": [
///    "documentPath",
///    "key",
///    "kind",
///    "reason",
///    "status",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The object's position `[x, y]` in millimetres, in that order, in the frame today's index uses for its kind. Absent when the kind has no position.",
///      "$ref": "#/$defs/CompareMmPoint"
///    },
///    "dnp": {
///      "description": "True when the object is do-not-populate. Absent when the kind has no DNP flag.",
///      "type": "boolean"
///    },
///    "documentPath": {
///      "description": "The document's path, project-relative (D1), for example\n`mini_obc.kicad_pcb`. With `uuid` it forms `key`.",
///      "type": "string"
///    },
///    "inBom": {
///      "description": "False when the object is excluded from the BOM. Absent when the kind has no such flag.",
///      "type": "boolean"
///    },
///    "instances": {
///      "description": "A symbol's instances, in file order. Absent when the kind has none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CompareSymbolInstanceA0"
///      }
///    },
///    "key": {
///      "description": "The object's key, `<documentPath>#<uuid>`.",
///      "type": "string"
///    },
///    "kiidPaths": {
///      "description": "Every occurrence path of a symbol or sheet, schematic form, sorted in code point order. Absent when the kind has none.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "kind": {
///      "description": "Kind of object, today's spelling.",
///      "$ref": "#/$defs/CompareObjectDeltaKind"
///    },
///    "layer": {
///      "description": "The object's layer as written. Absent when the form has none.",
///      "type": "string"
///    },
///    "layers": {
///      "description": "A via's `(layers …)` entries, in file order. Absent unless the object has layers.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "libId": {
///      "description": "The object's library link as written. Absent when it has none.",
///      "type": "string"
///    },
///    "mirror": {
///      "description": "How a symbol is mirrored. Absent when it is not mirrored.",
///      "$ref": "#/$defs/CompareObjectDeltaMirror"
///    },
///    "name": {
///      "description": "A zone's, group's or review-only object's name. Absent when the form has none.",
///      "type": "string"
///    },
///    "net": {
///      "description": "The object's net, by name. Absent when it has no net.",
///      "type": "string"
///    },
///    "number": {
///      "description": "A pad's or pin's number as written; may be empty. Absent when the form has none.",
///      "type": "string"
///    },
///    "onBoard": {
///      "description": "False when the object is not on the board. Absent when the kind has no such flag.",
///      "type": "boolean"
///    },
///    "parentUuid": {
///      "description": "Uuid of the object's parent (a pad's footprint, a pin's symbol, ...). Absent when there is none.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "properties": {
///      "description": "The object's own `(property …)` fields, in file order. Absent when the kind has none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CompareObjectPropertyA0"
///      }
///    },
///    "reason": {
///      "description": "Why the object is ignored.",
///      "$ref": "#/$defs/CompareObjectDeltaIgnoredReason"
///    },
///    "refdes": {
///      "description": "The object's reference designator. Absent when it has none or it is empty.",
///      "type": "string"
///    },
///    "reviewFields": {
///      "description": "Review fields, with keys in code point order; the keys are review labels. Absent when the kind has none.",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "reviewOnly": {
///      "description": "True for a review-only object. Absent for an object with a KiCad uuid.",
///      "type": "boolean"
///    },
///    "rotation": {
///      "description": "The object's rotation in degrees as written, `0` when the form omits it. Absent when the kind has no rotation.",
///      "type": "number"
///    },
///    "status": {
///      "description": "Always `ignored`.",
///      "$ref": "#/$defs/CompareObjectDeltaStatus"
///    },
///    "text": {
///      "description": "A label's, sheet pin's or footprint text's text as written. Absent when the form has none.",
///      "type": "string"
///    },
///    "uuid": {
///      "description": "The object's id: its KiCad uuid, or a review-only object's synthetic id\n(`BoardObjectsReviewOnlyId`). With `documentPath` it forms `key`.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareObjectDeltaIgnoredA0 {
    ///The object's key, `<documentPath>#<uuid>`.
    pub key: ::std::string::String,
    ///Always `ignored`.
    pub status: CompareObjectDeltaStatus,
    ///Why the object is ignored.
    pub reason: CompareObjectDeltaIgnoredReason,
    /**The object's id: its KiCad uuid, or a review-only object's synthetic id
    (`BoardObjectsReviewOnlyId`). With `documentPath` it forms `key`.*/
    pub uuid: ::std::string::String,
    ///Kind of object, today's spelling.
    pub kind: CompareObjectDeltaKind,
    /**The document's path, project-relative (D1), for example
    `mini_obc.kicad_pcb`. With `uuid` it forms `key`.*/
    #[serde(rename = "documentPath")]
    pub document_path: ::std::string::String,
    ///Uuid of the object's parent (a pad's footprint, a pin's symbol, ...). Absent when there is none.
    #[serde(
        rename = "parentUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub parent_uuid: ::std::option::Option<KiCadUuid>,
    ///The object's position `[x, y]` in millimetres, in that order, in the frame today's index uses for its kind. Absent when the kind has no position.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<CompareMmPoint>,
    ///The object's rotation in degrees as written, `0` when the form omits it. Absent when the kind has no rotation.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub rotation: ::std::option::Option<f64>,
    ///How a symbol is mirrored. Absent when it is not mirrored.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub mirror: ::std::option::Option<CompareObjectDeltaMirror>,
    ///The object's layer as written. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<::std::string::String>,
    ///A via's `(layers …)` entries, in file order. Absent unless the object has layers.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layers: ::std::option::Option<::std::vec::Vec<::std::string::String>>,
    ///The object's net, by name. Absent when it has no net.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<::std::string::String>,
    ///The object's reference designator. Absent when it has none or it is empty.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub refdes: ::std::option::Option<::std::string::String>,
    ///The object's library link as written. Absent when it has none.
    #[serde(
        rename = "libId",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub lib_id: ::std::option::Option<::std::string::String>,
    ///True when the object is do-not-populate. Absent when the kind has no DNP flag.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub dnp: ::std::option::Option<bool>,
    ///False when the object is excluded from the BOM. Absent when the kind has no such flag.
    #[serde(
        rename = "inBom",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub in_bom: ::std::option::Option<bool>,
    ///False when the object is not on the board. Absent when the kind has no such flag.
    #[serde(
        rename = "onBoard",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub on_board: ::std::option::Option<bool>,
    ///Every occurrence path of a symbol or sheet, schematic form, sorted in code point order. Absent when the kind has none.
    #[serde(
        rename = "kiidPaths",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub kiid_paths: ::std::option::Option<::std::vec::Vec<::std::string::String>>,
    ///A symbol's instances, in file order. Absent when the kind has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub instances: ::std::option::Option<::std::vec::Vec<CompareSymbolInstanceA0>>,
    ///A pad's or pin's number as written; may be empty. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub number: ::std::option::Option<::std::string::String>,
    ///A label's, sheet pin's or footprint text's text as written. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub text: ::std::option::Option<::std::string::String>,
    ///A zone's, group's or review-only object's name. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub name: ::std::option::Option<::std::string::String>,
    ///Review fields, with keys in code point order; the keys are review labels. Absent when the kind has none.
    #[serde(
        rename = "reviewFields",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub review_fields: ::std::option::Option<RecordBoardObjectsReviewValue>,
    ///True for a review-only object. Absent for an object with a KiCad uuid.
    #[serde(
        rename = "reviewOnly",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub review_only: ::std::option::Option<bool>,
    ///The object's own `(property …)` fields, in file order. Absent when the kind has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub properties: ::std::option::Option<::std::vec::Vec<CompareObjectPropertyA0>>,
}
///Why a matched object is only in `ignored` (`ecad-diff.mjs:390-411`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Why a matched object is only in `ignored` (`ecad-diff.mjs:390-411`).",
///  "type": "string",
///  "enum": [
///    "internal-identity-only",
///    "generated-content-only"
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
pub enum CompareObjectDeltaIgnoredReason {
    #[serde(rename = "internal-identity-only")]
    InternalIdentityOnly,
    #[serde(rename = "generated-content-only")]
    GeneratedContentOnly,
}
impl ::std::fmt::Display for CompareObjectDeltaIgnoredReason {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::InternalIdentityOnly => f.write_str("internal-identity-only"),
            Self::GeneratedContentOnly => f.write_str("generated-content-only"),
        }
    }
}
impl ::std::str::FromStr for CompareObjectDeltaIgnoredReason {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "internal-identity-only" => Ok(Self::InternalIdentityOnly),
            "generated-content-only" => Ok(Self::GeneratedContentOnly),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CompareObjectDeltaIgnoredReason {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CompareObjectDeltaIgnoredReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CompareObjectDeltaIgnoredReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**Kind of an object, in today's spelling: the bundle kind
(`BoardObjectsObject`, `BoardObjectsReviewOnlyKind`) with every `-` written
`_`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Kind of an object, in today's spelling: the bundle kind\n(`BoardObjectsObject`, `BoardObjectsReviewOnlyKind`) with every `-` written\n`_`.",
///  "type": "string",
///  "enum": [
///    "symbol",
///    "pin",
///    "sheet",
///    "sheet_pin",
///    "wire",
///    "bus",
///    "junction",
///    "no_connect",
///    "bus_entry",
///    "label",
///    "graphic",
///    "image",
///    "table",
///    "footprint",
///    "pad",
///    "zone",
///    "footprint_graphic",
///    "footprint_text",
///    "track",
///    "arc",
///    "via",
///    "group",
///    "net_class",
///    "net_class_assignment",
///    "board_constraint",
///    "drc_severity",
///    "routing_preset",
///    "board_default",
///    "teardrop_setting",
///    "zone_setting",
///    "drc_exclusion",
///    "erc_exclusion",
///    "erc_pin_rule",
///    "project_metadata",
///    "custom_rule",
///    "fabrication_output",
///    "bus_alias"
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
pub enum CompareObjectDeltaKind {
    #[serde(rename = "symbol")]
    Symbol,
    #[serde(rename = "pin")]
    Pin,
    #[serde(rename = "sheet")]
    Sheet,
    #[serde(rename = "sheet_pin")]
    SheetPin,
    #[serde(rename = "wire")]
    Wire,
    #[serde(rename = "bus")]
    Bus,
    #[serde(rename = "junction")]
    Junction,
    #[serde(rename = "no_connect")]
    NoConnect,
    #[serde(rename = "bus_entry")]
    BusEntry,
    #[serde(rename = "label")]
    Label,
    #[serde(rename = "graphic")]
    Graphic,
    #[serde(rename = "image")]
    Image,
    #[serde(rename = "table")]
    Table,
    #[serde(rename = "footprint")]
    Footprint,
    #[serde(rename = "pad")]
    Pad,
    #[serde(rename = "zone")]
    Zone,
    #[serde(rename = "footprint_graphic")]
    FootprintGraphic,
    #[serde(rename = "footprint_text")]
    FootprintText,
    #[serde(rename = "track")]
    Track,
    #[serde(rename = "arc")]
    Arc,
    #[serde(rename = "via")]
    Via,
    #[serde(rename = "group")]
    Group,
    #[serde(rename = "net_class")]
    NetClass,
    #[serde(rename = "net_class_assignment")]
    NetClassAssignment,
    #[serde(rename = "board_constraint")]
    BoardConstraint,
    #[serde(rename = "drc_severity")]
    DrcSeverity,
    #[serde(rename = "routing_preset")]
    RoutingPreset,
    #[serde(rename = "board_default")]
    BoardDefault,
    #[serde(rename = "teardrop_setting")]
    TeardropSetting,
    #[serde(rename = "zone_setting")]
    ZoneSetting,
    #[serde(rename = "drc_exclusion")]
    DrcExclusion,
    #[serde(rename = "erc_exclusion")]
    ErcExclusion,
    #[serde(rename = "erc_pin_rule")]
    ErcPinRule,
    #[serde(rename = "project_metadata")]
    ProjectMetadata,
    #[serde(rename = "custom_rule")]
    CustomRule,
    #[serde(rename = "fabrication_output")]
    FabricationOutput,
    #[serde(rename = "bus_alias")]
    BusAlias,
}
impl ::std::fmt::Display for CompareObjectDeltaKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Symbol => f.write_str("symbol"),
            Self::Pin => f.write_str("pin"),
            Self::Sheet => f.write_str("sheet"),
            Self::SheetPin => f.write_str("sheet_pin"),
            Self::Wire => f.write_str("wire"),
            Self::Bus => f.write_str("bus"),
            Self::Junction => f.write_str("junction"),
            Self::NoConnect => f.write_str("no_connect"),
            Self::BusEntry => f.write_str("bus_entry"),
            Self::Label => f.write_str("label"),
            Self::Graphic => f.write_str("graphic"),
            Self::Image => f.write_str("image"),
            Self::Table => f.write_str("table"),
            Self::Footprint => f.write_str("footprint"),
            Self::Pad => f.write_str("pad"),
            Self::Zone => f.write_str("zone"),
            Self::FootprintGraphic => f.write_str("footprint_graphic"),
            Self::FootprintText => f.write_str("footprint_text"),
            Self::Track => f.write_str("track"),
            Self::Arc => f.write_str("arc"),
            Self::Via => f.write_str("via"),
            Self::Group => f.write_str("group"),
            Self::NetClass => f.write_str("net_class"),
            Self::NetClassAssignment => f.write_str("net_class_assignment"),
            Self::BoardConstraint => f.write_str("board_constraint"),
            Self::DrcSeverity => f.write_str("drc_severity"),
            Self::RoutingPreset => f.write_str("routing_preset"),
            Self::BoardDefault => f.write_str("board_default"),
            Self::TeardropSetting => f.write_str("teardrop_setting"),
            Self::ZoneSetting => f.write_str("zone_setting"),
            Self::DrcExclusion => f.write_str("drc_exclusion"),
            Self::ErcExclusion => f.write_str("erc_exclusion"),
            Self::ErcPinRule => f.write_str("erc_pin_rule"),
            Self::ProjectMetadata => f.write_str("project_metadata"),
            Self::CustomRule => f.write_str("custom_rule"),
            Self::FabricationOutput => f.write_str("fabrication_output"),
            Self::BusAlias => f.write_str("bus_alias"),
        }
    }
}
impl ::std::str::FromStr for CompareObjectDeltaKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "symbol" => Ok(Self::Symbol),
            "pin" => Ok(Self::Pin),
            "sheet" => Ok(Self::Sheet),
            "sheet_pin" => Ok(Self::SheetPin),
            "wire" => Ok(Self::Wire),
            "bus" => Ok(Self::Bus),
            "junction" => Ok(Self::Junction),
            "no_connect" => Ok(Self::NoConnect),
            "bus_entry" => Ok(Self::BusEntry),
            "label" => Ok(Self::Label),
            "graphic" => Ok(Self::Graphic),
            "image" => Ok(Self::Image),
            "table" => Ok(Self::Table),
            "footprint" => Ok(Self::Footprint),
            "pad" => Ok(Self::Pad),
            "zone" => Ok(Self::Zone),
            "footprint_graphic" => Ok(Self::FootprintGraphic),
            "footprint_text" => Ok(Self::FootprintText),
            "track" => Ok(Self::Track),
            "arc" => Ok(Self::Arc),
            "via" => Ok(Self::Via),
            "group" => Ok(Self::Group),
            "net_class" => Ok(Self::NetClass),
            "net_class_assignment" => Ok(Self::NetClassAssignment),
            "board_constraint" => Ok(Self::BoardConstraint),
            "drc_severity" => Ok(Self::DrcSeverity),
            "routing_preset" => Ok(Self::RoutingPreset),
            "board_default" => Ok(Self::BoardDefault),
            "teardrop_setting" => Ok(Self::TeardropSetting),
            "zone_setting" => Ok(Self::ZoneSetting),
            "drc_exclusion" => Ok(Self::DrcExclusion),
            "erc_exclusion" => Ok(Self::ErcExclusion),
            "erc_pin_rule" => Ok(Self::ErcPinRule),
            "project_metadata" => Ok(Self::ProjectMetadata),
            "custom_rule" => Ok(Self::CustomRule),
            "fabrication_output" => Ok(Self::FabricationOutput),
            "bus_alias" => Ok(Self::BusAlias),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CompareObjectDeltaKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CompareObjectDeltaKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CompareObjectDeltaKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///Per-kind change counts (`ecad-diff.mjs:455-463`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Per-kind change counts (`ecad-diff.mjs:455-463`).",
///  "type": "object",
///  "required": [
///    "added",
///    "modified",
///    "removed"
///  ],
///  "properties": {
///    "added": {
///      "description": "Added objects of this kind.",
///      "$ref": "#/$defs/Count"
///    },
///    "modified": {
///      "description": "Modified objects of this kind.",
///      "$ref": "#/$defs/Count"
///    },
///    "removed": {
///      "description": "Removed objects of this kind.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareObjectDeltaKindCountsA0 {
    ///Added objects of this kind.
    pub added: Count,
    ///Removed objects of this kind.
    pub removed: Count,
    ///Modified objects of this kind.
    pub modified: Count,
}
///How a schematic symbol is mirrored, today's parser spelling.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How a schematic symbol is mirrored, today's parser spelling.",
///  "type": "string",
///  "enum": [
///    "x",
///    "y"
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
pub enum CompareObjectDeltaMirror {
    #[serde(rename = "x")]
    X,
    #[serde(rename = "y")]
    Y,
}
impl ::std::fmt::Display for CompareObjectDeltaMirror {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::X => f.write_str("x"),
            Self::Y => f.write_str("y"),
        }
    }
}
impl ::std::str::FromStr for CompareObjectDeltaMirror {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "x" => Ok(Self::X),
            "y" => Ok(Self::Y),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CompareObjectDeltaMirror {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CompareObjectDeltaMirror {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CompareObjectDeltaMirror {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**Why a `modified` change was classified, or why an object is in `ignored`.
The classifier reasons are `CLASSIFIERS` plus `properties-changed` and
`content-changed` (`ecad-diff.mjs:32-46`, `:415-435`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Why a `modified` change was classified, or why an object is in `ignored`.\nThe classifier reasons are `CLASSIFIERS` plus `properties-changed` and\n`content-changed` (`ecad-diff.mjs:32-46`, `:415-435`).",
///  "type": "string",
///  "enum": [
///    "moved",
///    "rotated",
///    "mirrored",
///    "layer-changed",
///    "net-changed",
///    "renamed",
///    "lib-changed",
///    "dnp-changed",
///    "re-pathed",
///    "properties-changed",
///    "content-changed"
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
pub enum CompareObjectDeltaReason {
    #[serde(rename = "moved")]
    Moved,
    #[serde(rename = "rotated")]
    Rotated,
    #[serde(rename = "mirrored")]
    Mirrored,
    #[serde(rename = "layer-changed")]
    LayerChanged,
    #[serde(rename = "net-changed")]
    NetChanged,
    #[serde(rename = "renamed")]
    Renamed,
    #[serde(rename = "lib-changed")]
    LibChanged,
    #[serde(rename = "dnp-changed")]
    DnpChanged,
    #[serde(rename = "re-pathed")]
    RePathed,
    #[serde(rename = "properties-changed")]
    PropertiesChanged,
    #[serde(rename = "content-changed")]
    ContentChanged,
}
impl ::std::fmt::Display for CompareObjectDeltaReason {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Moved => f.write_str("moved"),
            Self::Rotated => f.write_str("rotated"),
            Self::Mirrored => f.write_str("mirrored"),
            Self::LayerChanged => f.write_str("layer-changed"),
            Self::NetChanged => f.write_str("net-changed"),
            Self::Renamed => f.write_str("renamed"),
            Self::LibChanged => f.write_str("lib-changed"),
            Self::DnpChanged => f.write_str("dnp-changed"),
            Self::RePathed => f.write_str("re-pathed"),
            Self::PropertiesChanged => f.write_str("properties-changed"),
            Self::ContentChanged => f.write_str("content-changed"),
        }
    }
}
impl ::std::str::FromStr for CompareObjectDeltaReason {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "moved" => Ok(Self::Moved),
            "rotated" => Ok(Self::Rotated),
            "mirrored" => Ok(Self::Mirrored),
            "layer-changed" => Ok(Self::LayerChanged),
            "net-changed" => Ok(Self::NetChanged),
            "renamed" => Ok(Self::Renamed),
            "lib-changed" => Ok(Self::LibChanged),
            "dnp-changed" => Ok(Self::DnpChanged),
            "re-pathed" => Ok(Self::RePathed),
            "properties-changed" => Ok(Self::PropertiesChanged),
            "content-changed" => Ok(Self::ContentChanged),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CompareObjectDeltaReason {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CompareObjectDeltaReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CompareObjectDeltaReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One side of the comparison.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One side of the comparison.",
///  "type": "object",
///  "required": [
///    "bundleKey",
///    "componentObjects",
///    "nativeObjects",
///    "objects"
///  ],
///  "properties": {
///    "bundleKey": {
///      "description": "The side's bundle key, computed from its manifest's revision key and generator id (cli-spec.md §5.1.4).",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "componentObjects": {
///      "description": "Every symbol and footprint of the side, in the side's index object order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CompareNativeObjectA0"
///      }
///    },
///    "nativeObjects": {
///      "description": "Every addressable object of the side, in the side's index object order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CompareNativeTargetA0"
///      }
///    },
///    "objects": {
///      "description": "How many objects the side's `board-objects.json` holds, review-only objects included.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareObjectDeltaSideA0 {
    ///The side's bundle key, computed from its manifest's revision key and generator id (cli-spec.md §5.1.4).
    #[serde(rename = "bundleKey")]
    pub bundle_key: Sha256Hex,
    ///How many objects the side's `board-objects.json` holds, review-only objects included.
    pub objects: Count,
    ///Every addressable object of the side, in the side's index object order.
    #[serde(rename = "nativeObjects")]
    pub native_objects: ::std::vec::Vec<CompareNativeTargetA0>,
    ///Every symbol and footprint of the side, in the side's index object order.
    #[serde(rename = "componentObjects")]
    pub component_objects: ::std::vec::Vec<CompareNativeObjectA0>,
}
///How an entry relates the two sides.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How an entry relates the two sides.",
///  "type": "string",
///  "enum": [
///    "added",
///    "removed",
///    "modified",
///    "ignored"
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
pub enum CompareObjectDeltaStatus {
    #[serde(rename = "added")]
    Added,
    #[serde(rename = "removed")]
    Removed,
    #[serde(rename = "modified")]
    Modified,
    #[serde(rename = "ignored")]
    Ignored,
}
impl ::std::fmt::Display for CompareObjectDeltaStatus {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Added => f.write_str("added"),
            Self::Removed => f.write_str("removed"),
            Self::Modified => f.write_str("modified"),
            Self::Ignored => f.write_str("ignored"),
        }
    }
}
impl ::std::str::FromStr for CompareObjectDeltaStatus {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "added" => Ok(Self::Added),
            "removed" => Ok(Self::Removed),
            "modified" => Ok(Self::Modified),
            "ignored" => Ok(Self::Ignored),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CompareObjectDeltaStatus {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CompareObjectDeltaStatus {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CompareObjectDeltaStatus {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One `(property "Name" "value" …)` field of a symbol, sheet or footprint, as today's index carries it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One `(property \"Name\" \"value\" …)` field of a symbol, sheet or footprint, as today's index carries it.",
///  "type": "object",
///  "required": [
///    "name",
///    "value"
///  ],
///  "properties": {
///    "at": {
///      "description": "The field's `[x, y]` position in millimetres, in that order. Absent when the form has none.",
///      "$ref": "#/$defs/CompareMmPoint"
///    },
///    "effects": {
///      "description": "The field's text effects. Absent when the form has none.",
///      "$ref": "#/$defs/CompareTextEffectsA0"
///    },
///    "hide": {
///      "description": "True when the field is hidden. Absent unless the form hides it.",
///      "type": "boolean"
///    },
///    "name": {
///      "description": "The field name.",
///      "type": "string"
///    },
///    "rotation": {
///      "description": "The field's rotation in degrees as written. Present exactly when the field is at a position.",
///      "type": "number"
///    },
///    "value": {
///      "description": "The field value as written; may be empty.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareObjectPropertyA0 {
    ///The field name.
    pub name: ::std::string::String,
    ///The field value as written; may be empty.
    pub value: ::std::string::String,
    ///The field's `[x, y]` position in millimetres, in that order. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<CompareMmPoint>,
    ///The field's rotation in degrees as written. Present exactly when the field is at a position.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub rotation: ::std::option::Option<f64>,
    ///True when the field is hidden. Absent unless the form hides it.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub hide: ::std::option::Option<bool>,
    ///The field's text effects. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub effects: ::std::option::Option<CompareTextEffectsA0>,
}
/**One property or review-field delta (`ecad-diff.mjs` `property_deltas` and
`review_field_deltas`). A property delta also carries `attributesChanged` and
`fromAttributes`/`toAttributes`; a review-field delta carries only `name`,
`from` and `to`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One property or review-field delta (`ecad-diff.mjs` `property_deltas` and\n`review_field_deltas`). A property delta also carries `attributesChanged` and\n`fromAttributes`/`toAttributes`; a review-field delta carries only `name`,\n`from` and `to`.",
///  "type": "object",
///  "required": [
///    "name"
///  ],
///  "properties": {
///    "attributesChanged": {
///      "description": "True when a property that is present on both sides only moved or was hidden. Absent for a review-field delta.",
///      "type": "boolean"
///    },
///    "from": {
///      "description": "The base value: a text, a number, a flag, a list (in the order today's index writes it) or a table (keys are KiCad's setting keys). Absent when the property or field is only in the head side.",
///      "$ref": "#/$defs/BoardObjectsReviewValue"
///    },
///    "fromAttributes": {
///      "description": "The base property's attributes. Absent for a review-field delta, or when the property is only in the head side.",
///      "$ref": "#/$defs/ComparePropertyAttributesA0"
///    },
///    "name": {
///      "description": "The property or review-field name.",
///      "type": "string"
///    },
///    "to": {
///      "description": "The head value: a text, a number, a flag, a list (in the order today's index writes it) or a table (keys are KiCad's setting keys). Absent when the property or field is only in the base side.",
///      "$ref": "#/$defs/BoardObjectsReviewValue"
///    },
///    "toAttributes": {
///      "description": "The head property's attributes. Absent for a review-field delta, or when the property is only in the base side.",
///      "$ref": "#/$defs/ComparePropertyAttributesA0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareObjectPropertyDeltaA0 {
    ///The property or review-field name.
    pub name: ::std::string::String,
    ///The base value: a text, a number, a flag, a list (in the order today's index writes it) or a table (keys are KiCad's setting keys). Absent when the property or field is only in the head side.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub from: ::std::option::Option<BoardObjectsReviewValue>,
    ///The head value: a text, a number, a flag, a list (in the order today's index writes it) or a table (keys are KiCad's setting keys). Absent when the property or field is only in the base side.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub to: ::std::option::Option<BoardObjectsReviewValue>,
    ///True when a property that is present on both sides only moved or was hidden. Absent for a review-field delta.
    #[serde(
        rename = "attributesChanged",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub attributes_changed: ::std::option::Option<bool>,
    ///The base property's attributes. Absent for a review-field delta, or when the property is only in the head side.
    #[serde(
        rename = "fromAttributes",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub from_attributes: ::std::option::Option<ComparePropertyAttributesA0>,
    ///The head property's attributes. Absent for a review-field delta, or when the property is only in the base side.
    #[serde(
        rename = "toAttributes",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub to_attributes: ::std::option::Option<ComparePropertyAttributesA0>,
}
///A moved object's position deltas (`ecad-diff.mjs:322-332`), in millimetres.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A moved object's position deltas (`ecad-diff.mjs:322-332`), in millimetres.",
///  "type": "object",
///  "required": [
///    "distance",
///    "dx",
///    "dy"
///  ],
///  "properties": {
///    "distance": {
///      "description": "`Math.hypot(dx, dy)`, rounded to 1e-6 mm.",
///      "type": "number"
///    },
///    "dx": {
///      "description": "Change in x, rounded to 1e-6 mm.",
///      "type": "number"
///    },
///    "dy": {
///      "description": "Change in y, rounded to 1e-6 mm.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ComparePositionDeltaA0 {
    ///Change in x, rounded to 1e-6 mm.
    pub dx: f64,
    ///Change in y, rounded to 1e-6 mm.
    pub dy: f64,
    ///`Math.hypot(dx, dy)`, rounded to 1e-6 mm.
    pub distance: f64,
}
///The attributes `attributesChanged` compares (`ecad-diff.mjs:248-263`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The attributes `attributesChanged` compares (`ecad-diff.mjs:248-263`).",
///  "type": "object",
///  "required": [
///    "hide"
///  ],
///  "properties": {
///    "at": {
///      "description": "The property's `[x, y]` position in millimetres, in that order. Absent when it has none.",
///      "$ref": "#/$defs/CompareMmPoint"
///    },
///    "effects": {
///      "description": "The property's text effects. Absent when it has none.",
///      "$ref": "#/$defs/CompareTextEffectsA0"
///    },
///    "hide": {
///      "description": "True when the property is hidden; false otherwise.",
///      "type": "boolean"
///    },
///    "rotation": {
///      "description": "The property's rotation in degrees. Absent when it has none.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ComparePropertyAttributesA0 {
    ///The property's `[x, y]` position in millimetres, in that order. Absent when it has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<CompareMmPoint>,
    ///The property's rotation in degrees. Absent when it has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub rotation: ::std::option::Option<f64>,
    ///True when the property is hidden; false otherwise.
    pub hide: bool,
    ///The property's text effects. Absent when it has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub effects: ::std::option::Option<CompareTextEffectsA0>,
}
///One `(path …)` instance of a placed symbol (`ecad-diff.mjs` `instances`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One `(path …)` instance of a placed symbol (`ecad-diff.mjs` `instances`).",
///  "type": "object",
///  "properties": {
///    "path": {
///      "description": "The occurrence path, schematic form. Absent for a `default_instance` entry.",
///      "type": "string"
///    },
///    "reference": {
///      "description": "The instance's reference. Absent when it has none or it is empty.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareSymbolInstanceA0 {
    ///The instance's reference. Absent when it has none or it is empty.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub reference: ::std::option::Option<::std::string::String>,
    ///The occurrence path, schematic form. Absent for a `default_instance` entry.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub path: ::std::option::Option<::std::string::String>,
}
impl ::std::default::Default for CompareSymbolInstanceA0 {
    fn default() -> Self {
        Self {
            path: Default::default(),
            reference: Default::default(),
        }
    }
}
///A text's `(effects …)` as the vendored parser reads it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A text's `(effects …)` as the vendored parser reads it.",
///  "type": "object",
///  "properties": {
///    "font": {
///      "description": "The `(font …)`. Absent when the effects have none.",
///      "$ref": "#/$defs/CompareTextFontA0"
///    },
///    "hide": {
///      "description": "True when the effects carry a bare `hide`. Absent when it is not written.",
///      "type": "boolean"
///    },
///    "href": {
///      "description": "The `(href …)` as written. Absent when it is not written.",
///      "type": "string"
///    },
///    "justify": {
///      "description": "The `(justify …)`. Absent when the effects have none.",
///      "$ref": "#/$defs/CompareTextJustifyA0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareTextEffectsA0 {
    ///The `(font …)`. Absent when the effects have none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub font: ::std::option::Option<CompareTextFontA0>,
    ///The `(justify …)`. Absent when the effects have none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub justify: ::std::option::Option<CompareTextJustifyA0>,
    ///True when the effects carry a bare `hide`. Absent when it is not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub hide: ::std::option::Option<bool>,
    ///The `(href …)` as written. Absent when it is not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub href: ::std::option::Option<::std::string::String>,
}
impl ::std::default::Default for CompareTextEffectsA0 {
    fn default() -> Self {
        Self {
            font: Default::default(),
            hide: Default::default(),
            href: Default::default(),
            justify: Default::default(),
        }
    }
}
///A text's `(font …)` as the vendored parser reads it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A text's `(font …)` as the vendored parser reads it.",
///  "type": "object",
///  "properties": {
///    "bold": {
///      "description": "True when the font has a bare `bold`. Absent when it is not written.",
///      "type": "boolean"
///    },
///    "color": {
///      "description": "The `(color …)`. Absent when it is not written.",
///      "$ref": "#/$defs/CompareColorA0"
///    },
///    "face": {
///      "description": "The `(face …)` font name. Absent when it is not written.",
///      "type": "string"
///    },
///    "italic": {
///      "description": "True when the font has a bare `italic`. Absent when it is not written.",
///      "type": "boolean"
///    },
///    "lineSpacing": {
///      "description": "The `(line_spacing …)` factor as written. Absent when it is not written.",
///      "type": "number"
///    },
///    "size": {
///      "description": "The `(size …)`. Absent when it is not written.",
///      "$ref": "#/$defs/CompareFontSizeA0"
///    },
///    "thickness": {
///      "description": "The `(thickness …)` stroke width in millimetres. Absent when it is not written.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareTextFontA0 {
    ///The `(face …)` font name. Absent when it is not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub face: ::std::option::Option<::std::string::String>,
    ///The `(size …)`. Absent when it is not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub size: ::std::option::Option<CompareFontSizeA0>,
    ///The `(thickness …)` stroke width in millimetres. Absent when it is not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub thickness: ::std::option::Option<f64>,
    ///True when the font has a bare `bold`. Absent when it is not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub bold: ::std::option::Option<bool>,
    ///True when the font has a bare `italic`. Absent when it is not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub italic: ::std::option::Option<bool>,
    ///The `(line_spacing …)` factor as written. Absent when it is not written.
    #[serde(
        rename = "lineSpacing",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub line_spacing: ::std::option::Option<f64>,
    ///The `(color …)`. Absent when it is not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub color: ::std::option::Option<CompareColorA0>,
}
impl ::std::default::Default for CompareTextFontA0 {
    fn default() -> Self {
        Self {
            bold: Default::default(),
            color: Default::default(),
            face: Default::default(),
            italic: Default::default(),
            line_spacing: Default::default(),
            size: Default::default(),
            thickness: Default::default(),
        }
    }
}
///A text's `(justify …)` as today's parser reads it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A text's `(justify …)` as today's parser reads it.",
///  "type": "object",
///  "required": [
///    "horiz",
///    "mirror",
///    "vert"
///  ],
///  "properties": {
///    "horiz": {
///      "description": "Horizontal justification.",
///      "$ref": "#/$defs/CompareJustifyHorizontalA0"
///    },
///    "mirror": {
///      "description": "True when the justify form contains `mirror`.",
///      "type": "boolean"
///    },
///    "vert": {
///      "description": "Vertical justification.",
///      "$ref": "#/$defs/CompareJustifyVerticalA0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompareTextJustifyA0 {
    ///Horizontal justification.
    pub horiz: CompareJustifyHorizontalA0,
    ///Vertical justification.
    pub vert: CompareJustifyVerticalA0,
    ///True when the justify form contains `mirror`.
    pub mirror: bool,
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
/**KiCad object UUID in the canonical form KiCad writes (`KIID::AsString`):
lowercase hexadecimal, 8-4-4-4-12. Copied from the file, never generated
or re-cased.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad object UUID in the canonical form KiCad writes (`KIID::AsString`):\nlowercase hexadecimal, 8-4-4-4-12. Copied from the file, never generated\nor re-cased.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct KiCadUuid(pub ::std::string::String);
impl ::std::ops::Deref for KiCadUuid {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<KiCadUuid> for ::std::string::String {
    fn from(value: KiCadUuid) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for KiCadUuid {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for KiCadUuid {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for KiCadUuid {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///`RecordBoardObjectsReviewValue`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/BoardObjectsReviewValue"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordBoardObjectsReviewValue(
    pub ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue>,
);
impl ::std::ops::Deref for RecordBoardObjectsReviewValue {
    type Target = ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue> {
        &self.0
    }
}
impl ::std::convert::From<RecordBoardObjectsReviewValue>
    for ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue>
{
    fn from(value: RecordBoardObjectsReviewValue) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue>,
    > for RecordBoardObjectsReviewValue
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue>,
    ) -> Self {
        Self(value)
    }
}
///`RecordCompareObjectDeltaKindCountsA0`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/CompareObjectDeltaKindCountsA0"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordCompareObjectDeltaKindCountsA0(
    pub ::std::collections::BTreeMap<::std::string::String, CompareObjectDeltaKindCountsA0>,
);
impl ::std::ops::Deref for RecordCompareObjectDeltaKindCountsA0 {
    type Target =
        ::std::collections::BTreeMap<::std::string::String, CompareObjectDeltaKindCountsA0>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, CompareObjectDeltaKindCountsA0> {
        &self.0
    }
}
impl ::std::convert::From<RecordCompareObjectDeltaKindCountsA0>
    for ::std::collections::BTreeMap<::std::string::String, CompareObjectDeltaKindCountsA0>
{
    fn from(value: RecordCompareObjectDeltaKindCountsA0) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, CompareObjectDeltaKindCountsA0>,
    > for RecordCompareObjectDeltaKindCountsA0
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, CompareObjectDeltaKindCountsA0>,
    ) -> Self {
        Self(value)
    }
}
///`RecordCount`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/Count"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordCount(pub ::std::collections::BTreeMap<::std::string::String, Count>);
impl ::std::ops::Deref for RecordCount {
    type Target = ::std::collections::BTreeMap<::std::string::String, Count>;
    fn deref(&self) -> &::std::collections::BTreeMap<::std::string::String, Count> {
        &self.0
    }
}
impl ::std::convert::From<RecordCount>
    for ::std::collections::BTreeMap<::std::string::String, Count>
{
    fn from(value: RecordCount) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::collections::BTreeMap<::std::string::String, Count>>
    for RecordCount
{
    fn from(value: ::std::collections::BTreeMap<::std::string::String, Count>) -> Self {
        Self(value)
    }
}
///Lowercase hexadecimal SHA-256 digest: exactly 64 characters, no prefix such as `sha256:`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Lowercase hexadecimal SHA-256 digest: exactly 64 characters, no prefix such as `sha256:`.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct Sha256Hex(pub ::std::string::String);
impl ::std::ops::Deref for Sha256Hex {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<Sha256Hex> for ::std::string::String {
    fn from(value: Sha256Hex) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for Sha256Hex {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for Sha256Hex {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for Sha256Hex {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
impl<'de> ::serde::Deserialize<'de> for BoardObjectsReviewScalar {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if let Ok(inner) = ::serde_json::from_value::<::std::string::String>(value.clone()) {
            return Ok(Self::String(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<f64>(value.clone()) {
            return Ok(Self::Number(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<bool>(value.clone()) {
            return Ok(Self::Boolean(inner));
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum BoardObjectsReviewScalar",
        ))
    }
}
impl<'de> ::serde::Deserialize<'de> for BoardObjectsReviewValue {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if let Ok(inner) = ::serde_json::from_value::<::std::string::String>(value.clone()) {
            return Ok(Self::Variant0(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<f64>(value.clone()) {
            return Ok(Self::Variant1(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<bool>(value.clone()) {
            return Ok(Self::Variant2(inner));
        }
        if let Ok(inner) =
            ::serde_json::from_value::<::std::vec::Vec<::std::string::String>>(value.clone())
        {
            return Ok(Self::Variant3(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<::std::vec::Vec<f64>>(value.clone()) {
            return Ok(Self::Variant4(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<BoardObjectsReviewTable>(value.clone()) {
            return Ok(Self::Variant5(inner));
        }
        if let Ok(inner) =
            ::serde_json::from_value::<::std::vec::Vec<BoardObjectsReviewTable>>(value.clone())
        {
            return Ok(Self::Variant6(inner));
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum BoardObjectsReviewValue",
        ))
    }
}
