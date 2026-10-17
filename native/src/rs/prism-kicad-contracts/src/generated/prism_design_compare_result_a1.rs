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
///The BOM tab.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The BOM tab.",
///  "type": "object",
///  "required": [
///    "changes",
///    "fields",
///    "summary"
///  ],
///  "properties": {
///    "changes": {
///      "description": "The BOM rows, sorted by `ref` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/DesignCompareBomRow"
///      }
///    },
///    "fields": {
///      "description": "The BOM columns shown, in display order.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "summary": {
///      "description": "Row counts.",
///      "$ref": "#/$defs/DesignCompareSummary"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareBom {
    ///The BOM columns shown, in display order.
    pub fields: ::std::vec::Vec<::std::string::String>,
    ///The BOM rows, sorted by `ref` in code point order.
    pub changes: ::std::vec::Vec<DesignCompareBomRow>,
    ///Row counts.
    pub summary: DesignCompareSummary,
}
///One field of a changed BOM row.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One field of a changed BOM row.",
///  "type": "object",
///  "required": [
///    "new",
///    "old"
///  ],
///  "properties": {
///    "new": {
///      "description": "The head revision's text.",
///      "type": "string"
///    },
///    "old": {
///      "description": "The base revision's text.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareBomFieldDiff {
    ///The base revision's text.
    pub old: ::std::string::String,
    ///The head revision's text.
    pub new: ::std::string::String,
}
///One BOM row, keyed by reference designator.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One BOM row, keyed by reference designator.",
///  "type": "object",
///  "required": [
///    "ref",
///    "status"
///  ],
///  "properties": {
///    "diffs": {
///      "description": "Keys are BOM column names; only the columns that differ. Absent for an added, removed or unchanged row.",
///      "$ref": "#/$defs/RecordDesignCompareBomFieldDiff"
///    },
///    "new": {
///      "description": "Keys are BOM column names; the head revision's text of each. Absent for a removed row.",
///      "$ref": "#/$defs/RecordString"
///    },
///    "old": {
///      "description": "Keys are BOM column names; the base revision's text of each. Absent for an added row.",
///      "$ref": "#/$defs/RecordString"
///    },
///    "ref": {
///      "description": "The reference designator.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "status": {
///      "description": "The row's state.",
///      "$ref": "#/$defs/DesignCompareBomStatus"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareBomRow {
    ///The reference designator.
    #[serde(rename = "ref")]
    pub ref_: Refdes,
    ///The row's state.
    pub status: DesignCompareBomStatus,
    ///Keys are BOM column names; the base revision's text of each. Absent for an added row.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub old: ::std::option::Option<RecordString>,
    ///Keys are BOM column names; the head revision's text of each. Absent for a removed row.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub new: ::std::option::Option<RecordString>,
    ///Keys are BOM column names; only the columns that differ. Absent for an added, removed or unchanged row.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub diffs: ::std::option::Option<RecordDesignCompareBomFieldDiff>,
}
///The state of one BOM row.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The state of one BOM row.",
///  "type": "string",
///  "enum": [
///    "added",
///    "removed",
///    "changed",
///    "unchanged"
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
pub enum DesignCompareBomStatus {
    #[serde(rename = "added")]
    Added,
    #[serde(rename = "removed")]
    Removed,
    #[serde(rename = "changed")]
    Changed,
    #[serde(rename = "unchanged")]
    Unchanged,
}
impl ::std::fmt::Display for DesignCompareBomStatus {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Added => f.write_str("added"),
            Self::Removed => f.write_str("removed"),
            Self::Changed => f.write_str("changed"),
            Self::Unchanged => f.write_str("unchanged"),
        }
    }
}
impl ::std::str::FromStr for DesignCompareBomStatus {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "added" => Ok(Self::Added),
            "removed" => Ok(Self::Removed),
            "changed" => Ok(Self::Changed),
            "unchanged" => Ok(Self::Unchanged),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for DesignCompareBomStatus {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for DesignCompareBomStatus {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for DesignCompareBomStatus {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///The review category of a change (`frontend/src/lib/diff-grouping`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The review category of a change (`frontend/src/lib/diff-grouping`).",
///  "type": "string",
///  "enum": [
///    "rules",
///    "components",
///    "nets",
///    "board",
///    "zones",
///    "graphics",
///    "symbols",
///    "sheets",
///    "text",
///    "other"
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
pub enum DesignCompareCategory {
    #[serde(rename = "rules")]
    Rules,
    #[serde(rename = "components")]
    Components,
    #[serde(rename = "nets")]
    Nets,
    #[serde(rename = "board")]
    Board,
    #[serde(rename = "zones")]
    Zones,
    #[serde(rename = "graphics")]
    Graphics,
    #[serde(rename = "symbols")]
    Symbols,
    #[serde(rename = "sheets")]
    Sheets,
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "other")]
    Other,
}
impl ::std::fmt::Display for DesignCompareCategory {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Rules => f.write_str("rules"),
            Self::Components => f.write_str("components"),
            Self::Nets => f.write_str("nets"),
            Self::Board => f.write_str("board"),
            Self::Zones => f.write_str("zones"),
            Self::Graphics => f.write_str("graphics"),
            Self::Symbols => f.write_str("symbols"),
            Self::Sheets => f.write_str("sheets"),
            Self::Text => f.write_str("text"),
            Self::Other => f.write_str("other"),
        }
    }
}
impl ::std::str::FromStr for DesignCompareCategory {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "rules" => Ok(Self::Rules),
            "components" => Ok(Self::Components),
            "nets" => Ok(Self::Nets),
            "board" => Ok(Self::Board),
            "zones" => Ok(Self::Zones),
            "graphics" => Ok(Self::Graphics),
            "symbols" => Ok(Self::Symbols),
            "sheets" => Ok(Self::Sheets),
            "text" => Ok(Self::Text),
            "other" => Ok(Self::Other),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for DesignCompareCategory {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for DesignCompareCategory {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for DesignCompareCategory {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One change in the Schematic or PCB tab.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One change in the Schematic or PCB tab.",
///  "type": "object",
///  "required": [
///    "category",
///    "classification",
///    "details",
///    "domain",
///    "fields",
///    "id",
///    "kind",
///    "label",
///    "reasons"
///  ],
///  "properties": {
///    "base": {
///      "description": "Where the object is in the base revision. Absent for an added object.",
///      "$ref": "#/$defs/DesignCompareChangeSide"
///    },
///    "category": {
///      "description": "The review category.",
///      "$ref": "#/$defs/DesignCompareCategory"
///    },
///    "classification": {
///      "description": "How prominently it is reviewed.",
///      "$ref": "#/$defs/DesignCompareClassification"
///    },
///    "details": {
///      "description": "Review evidence beyond the fields.",
///      "$ref": "#/$defs/DesignCompareChangeDetails"
///    },
///    "domain": {
///      "description": "The tab the change belongs to.",
///      "$ref": "#/$defs/DesignCompareDomain"
///    },
///    "fields": {
///      "description": "Keys are field display names (for example `Position`, `Net`, `Value`); each holds the changed field's old and new value. Empty when no field changed.",
///      "$ref": "#/$defs/RecordDesignCompareFieldDelta"
///    },
///    "head": {
///      "description": "Where the object is in the head revision. Absent for a removed object.",
///      "$ref": "#/$defs/DesignCompareChangeSide"
///    },
///    "id": {
///      "description": "The change's id, stable for the same pair; the key of `projectDiff.navigation`.",
///      "type": "string"
///    },
///    "kind": {
///      "description": "What the change does.",
///      "$ref": "#/$defs/DesignCompareChangeKind"
///    },
///    "label": {
///      "description": "The review list's text for the change.",
///      "type": "string"
///    },
///    "net": {
///      "description": "The net the change is about. Absent when it is not about a net.",
///      "$ref": "#/$defs/NetName"
///    },
///    "objectKind": {
///      "description": "The object's kind as the board-objects member names it, for example `footprint` or `sheet-pin`. Absent for a net-level change.",
///      "type": "string"
///    },
///    "page": {
///      "description": "The document the review list files the change under, relative to the project directory. Absent when the change has none (a project setting).",
///      "type": "string"
///    },
///    "reasons": {
///      "description": "Why the object counts as changed, in classification order. Never empty.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/DesignCompareReason"
///      }
///    },
///    "reference": {
///      "description": "The component's reference designator. Absent when the change is not about a component.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "semanticId": {
///      "description": "The identity that groups changes of one design entity (component, net or object) across tabs. Absent when the change has none.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareChange {
    ///The change's id, stable for the same pair; the key of `projectDiff.navigation`.
    pub id: ::std::string::String,
    ///The tab the change belongs to.
    pub domain: DesignCompareDomain,
    ///What the change does.
    pub kind: DesignCompareChangeKind,
    ///The review category.
    pub category: DesignCompareCategory,
    ///How prominently it is reviewed.
    pub classification: DesignCompareClassification,
    ///The review list's text for the change.
    pub label: ::std::string::String,
    ///The object's kind as the board-objects member names it, for example `footprint` or `sheet-pin`. Absent for a net-level change.
    #[serde(
        rename = "objectKind",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub object_kind: ::std::option::Option<::std::string::String>,
    ///The component's reference designator. Absent when the change is not about a component.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub reference: ::std::option::Option<Refdes>,
    ///The net the change is about. Absent when it is not about a net.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<NetName>,
    ///The identity that groups changes of one design entity (component, net or object) across tabs. Absent when the change has none.
    #[serde(
        rename = "semanticId",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub semantic_id: ::std::option::Option<::std::string::String>,
    ///The document the review list files the change under, relative to the project directory. Absent when the change has none (a project setting).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub page: ::std::option::Option<::std::string::String>,
    ///Why the object counts as changed, in classification order. Never empty.
    pub reasons: ::std::vec::Vec<DesignCompareReason>,
    ///Keys are field display names (for example `Position`, `Net`, `Value`); each holds the changed field's old and new value. Empty when no field changed.
    pub fields: RecordDesignCompareFieldDelta,
    ///Review evidence beyond the fields.
    pub details: DesignCompareChangeDetails,
    ///Where the object is in the base revision. Absent for an added object.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub base: ::std::option::Option<DesignCompareChangeSide>,
    ///Where the object is in the head revision. Absent for a removed object.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub head: ::std::option::Option<DesignCompareChangeSide>,
}
///Review evidence of a change beyond its fields.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Review evidence of a change beyond its fields.",
///  "type": "object",
///  "properties": {
///    "connectivity": {
///      "description": "A net's terminal changes. Absent for a change that is not a net.",
///      "$ref": "#/$defs/DesignCompareConnectivity"
///    },
///    "instanceCount": {
///      "description": "The number of instances of a symbol. Absent when it did not change.",
///      "$ref": "#/$defs/DesignCompareCountDelta"
///    },
///    "labelInstances": {
///      "description": "The number of labels of a net. Absent when it did not change.",
///      "$ref": "#/$defs/DesignCompareCountDelta"
///    },
///    "reviewOnly": {
///      "description": "True when the change has no object ecad-viewer can paint (for example a project setting). Absent means false.",
///      "type": "boolean",
///      "const": true
///    },
///    "sheetChange": {
///      "description": "The sheet the object is on. Absent when it did not change.",
///      "$ref": "#/$defs/DesignCompareSheetDelta"
///    },
///    "targets": {
///      "description": "The objects ecad-viewer highlights for the change: base-side targets first, then head-side, each in the order the change's evidence lists them (field map, \"Targets\"). One entry per object and sheet instance. Absent when there are none, as for a change with `reviewOnly`.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/DesignCompareTarget"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareChangeDetails {
    ///True when the change has no object ecad-viewer can paint (for example a project setting). Absent means false.
    #[serde(
        rename = "reviewOnly",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub review_only: ::std::option::Option<bool>,
    ///A net's terminal changes. Absent for a change that is not a net.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub connectivity: ::std::option::Option<DesignCompareConnectivity>,
    ///The number of instances of a symbol. Absent when it did not change.
    #[serde(
        rename = "instanceCount",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub instance_count: ::std::option::Option<DesignCompareCountDelta>,
    ///The number of labels of a net. Absent when it did not change.
    #[serde(
        rename = "labelInstances",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub label_instances: ::std::option::Option<DesignCompareCountDelta>,
    ///The sheet the object is on. Absent when it did not change.
    #[serde(
        rename = "sheetChange",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub sheet_change: ::std::option::Option<DesignCompareSheetDelta>,
    ///The objects ecad-viewer highlights for the change: base-side targets first, then head-side, each in the order the change's evidence lists them (field map, "Targets"). One entry per object and sheet instance. Absent when there are none, as for a change with `reviewOnly`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub targets: ::std::option::Option<::std::vec::Vec<DesignCompareTarget>>,
}
impl ::std::default::Default for DesignCompareChangeDetails {
    fn default() -> Self {
        Self {
            connectivity: Default::default(),
            instance_count: Default::default(),
            label_instances: Default::default(),
            review_only: Default::default(),
            sheet_change: Default::default(),
            targets: Default::default(),
        }
    }
}
///What a change does, in the review's vocabulary.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What a change does, in the review's vocabulary.",
///  "type": "string",
///  "enum": [
///    "added",
///    "removed",
///    "changed"
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
pub enum DesignCompareChangeKind {
    #[serde(rename = "added")]
    Added,
    #[serde(rename = "removed")]
    Removed,
    #[serde(rename = "changed")]
    Changed,
}
impl ::std::fmt::Display for DesignCompareChangeKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Added => f.write_str("added"),
            Self::Removed => f.write_str("removed"),
            Self::Changed => f.write_str("changed"),
        }
    }
}
impl ::std::str::FromStr for DesignCompareChangeKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "added" => Ok(Self::Added),
            "removed" => Ok(Self::Removed),
            "changed" => Ok(Self::Changed),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for DesignCompareChangeKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for DesignCompareChangeKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for DesignCompareChangeKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One side of a changed object: where it is in that revision.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One side of a changed object: where it is in that revision.",
///  "type": "object",
///  "required": [
///    "documentPath",
///    "layers",
///    "sourceId"
///  ],
///  "properties": {
///    "at": {
///      "description": "The object's position. Absent for an object without one (a net, a zone).",
///      "$ref": "#/$defs/PointNm"
///    },
///    "documentPath": {
///      "description": "The document the object is in, relative to the project directory.",
///      "type": "string"
///    },
///    "layer": {
///      "description": "The object's layer as written. Absent for an object without one.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "layers": {
///      "description": "Every layer the object occupies in this revision, sorted in code point order. Empty for a schematic object.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/LayerName"
///      }
///    },
///    "net": {
///      "description": "The object's net in this revision. Absent when it has none.",
///      "$ref": "#/$defs/NetName"
///    },
///    "parentSourceId": {
///      "description": "The parent object's UUID (a pad's footprint, a pin's symbol). Absent for a top-level object.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "reference": {
///      "description": "The object's reference designator in this revision. Absent when it has none.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "sourceId": {
///      "description": "The object's native identity in this revision: its UUID, or for a net, the source id of its first labelled item.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareChangeSide {
    ///The object's native identity in this revision: its UUID, or for a net, the source id of its first labelled item.
    #[serde(rename = "sourceId")]
    pub source_id: ::std::string::String,
    ///The parent object's UUID (a pad's footprint, a pin's symbol). Absent for a top-level object.
    #[serde(
        rename = "parentSourceId",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub parent_source_id: ::std::option::Option<KiCadUuid>,
    ///The document the object is in, relative to the project directory.
    #[serde(rename = "documentPath")]
    pub document_path: ::std::string::String,
    ///The object's layer as written. Absent for an object without one.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<LayerName>,
    ///Every layer the object occupies in this revision, sorted in code point order. Empty for a schematic object.
    pub layers: ::std::vec::Vec<LayerName>,
    ///The object's position. Absent for an object without one (a net, a zone).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The object's reference designator in this revision. Absent when it has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub reference: ::std::option::Option<Refdes>,
    ///The object's net in this revision. Absent when it has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<NetName>,
}
///The changes of one tab.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The changes of one tab.",
///  "type": "object",
///  "required": [
///    "changes"
///  ],
///  "properties": {
///    "changes": {
///      "description": "The tab's changes, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/DesignCompareChange"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareChanges {
    ///The tab's changes, sorted by `id` in code point order.
    pub changes: ::std::vec::Vec<DesignCompareChange>,
}
///How prominently a change is reviewed.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How prominently a change is reviewed.",
///  "type": "string",
///  "enum": [
///    "primary",
///    "secondary"
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
pub enum DesignCompareClassification {
    #[serde(rename = "primary")]
    Primary,
    #[serde(rename = "secondary")]
    Secondary,
}
impl ::std::fmt::Display for DesignCompareClassification {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Primary => f.write_str("primary"),
            Self::Secondary => f.write_str("secondary"),
        }
    }
}
impl ::std::str::FromStr for DesignCompareClassification {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "primary" => Ok(Self::Primary),
            "secondary" => Ok(Self::Secondary),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for DesignCompareClassification {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for DesignCompareClassification {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for DesignCompareClassification {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///Terminals a net gained and lost.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Terminals a net gained and lost.",
///  "type": "object",
///  "required": [
///    "addedTerminals",
///    "removedTerminals"
///  ],
///  "properties": {
///    "addedTerminals": {
///      "description": "Terminals (`<reference>.<pin>`) only on the head side, sorted in code point order.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "removedTerminals": {
///      "description": "Terminals only on the base side, sorted in code point order.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareConnectivity {
    ///Terminals (`<reference>.<pin>`) only on the head side, sorted in code point order.
    #[serde(rename = "addedTerminals")]
    pub added_terminals: ::std::vec::Vec<::std::string::String>,
    ///Terminals only on the base side, sorted in code point order.
    #[serde(rename = "removedTerminals")]
    pub removed_terminals: ::std::vec::Vec<::std::string::String>,
}
///A count on both sides.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A count on both sides.",
///  "type": "object",
///  "required": [
///    "new",
///    "old"
///  ],
///  "properties": {
///    "new": {
///      "description": "The head revision's count.",
///      "$ref": "#/$defs/Count"
///    },
///    "old": {
///      "description": "The base revision's count.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareCountDelta {
    ///The base revision's count.
    pub old: Count,
    ///The head revision's count.
    pub new: Count,
}
///Change counts per tab.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Change counts per tab.",
///  "type": "object",
///  "required": [
///    "bom",
///    "pcb",
///    "schematic"
///  ],
///  "properties": {
///    "bom": {
///      "description": "The BOM tab's rows.",
///      "$ref": "#/$defs/DesignCompareSummary"
///    },
///    "pcb": {
///      "description": "The PCB tab's changes.",
///      "$ref": "#/$defs/DesignCompareSummary"
///    },
///    "schematic": {
///      "description": "The Schematic tab's changes.",
///      "$ref": "#/$defs/DesignCompareSummary"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareCounts {
    ///The Schematic tab's changes.
    pub schematic: DesignCompareSummary,
    ///The PCB tab's changes.
    pub pcb: DesignCompareSummary,
    ///The BOM tab's rows.
    pub bom: DesignCompareSummary,
}
///The tab a change belongs to.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The tab a change belongs to.",
///  "type": "string",
///  "enum": [
///    "schematic",
///    "pcb"
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
pub enum DesignCompareDomain {
    #[serde(rename = "schematic")]
    Schematic,
    #[serde(rename = "pcb")]
    Pcb,
}
impl ::std::fmt::Display for DesignCompareDomain {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Schematic => f.write_str("schematic"),
            Self::Pcb => f.write_str("pcb"),
        }
    }
}
impl ::std::str::FromStr for DesignCompareDomain {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "schematic" => Ok(Self::Schematic),
            "pcb" => Ok(Self::Pcb),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for DesignCompareDomain {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for DesignCompareDomain {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for DesignCompareDomain {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One side's old and new value of a changed field.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One side's old and new value of a changed field.",
///  "type": "object",
///  "properties": {
///    "new": {
///      "description": "The head revision's value, encoded as `old` is (lists in the order the object writes them; table keys are KiCad's setting keys, in code point order). Absent when the head has none.",
///      "$ref": "#/$defs/BoardObjectsReviewValue"
///    },
///    "old": {
///      "description": "The base revision's value: a text, number or flag; a list in the order the object writes it; or a table whose keys are KiCad's setting keys, in code point order. Absent when the base has none.",
///      "$ref": "#/$defs/BoardObjectsReviewValue"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareFieldDelta {
    ///The base revision's value: a text, number or flag; a list in the order the object writes it; or a table whose keys are KiCad's setting keys, in code point order. Absent when the base has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub old: ::std::option::Option<BoardObjectsReviewValue>,
    ///The head revision's value, encoded as `old` is (lists in the order the object writes them; table keys are KiCad's setting keys, in code point order). Absent when the head has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub new: ::std::option::Option<BoardObjectsReviewValue>,
}
impl ::std::default::Default for DesignCompareFieldDelta {
    fn default() -> Self {
        Self {
            new: Default::default(),
            old: Default::default(),
        }
    }
}
///The KiCad source files of both revisions.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The KiCad source files of both revisions.",
///  "type": "object",
///  "required": [
///    "base",
///    "head"
///  ],
///  "properties": {
///    "base": {
///      "description": "The base revision's `.kicad_sch`, `.kicad_pcb` and `.kicad_pro` files, sorted by `path` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/DesignCompareSourceFile"
///      }
///    },
///    "head": {
///      "description": "The head revision's files, in the same order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/DesignCompareSourceFile"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareFiles {
    ///The base revision's `.kicad_sch`, `.kicad_pcb` and `.kicad_pro` files, sorted by `path` in code point order.
    pub base: ::std::vec::Vec<DesignCompareSourceFile>,
    ///The head revision's files, in the same order.
    pub head: ::std::vec::Vec<DesignCompareSourceFile>,
}
///Why an object counts as changed. Several may apply.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Why an object counts as changed. Several may apply.",
///  "type": "string",
///  "enum": [
///    "object-added",
///    "object-removed",
///    "symbol-fields-changed",
///    "instance-replaced",
///    "instance-count-changed",
///    "sheet-changed",
///    "net-renamed",
///    "connectivity-changed",
///    "label-count-changed",
///    "bus-membership-changed",
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
pub enum DesignCompareReason {
    #[serde(rename = "object-added")]
    ObjectAdded,
    #[serde(rename = "object-removed")]
    ObjectRemoved,
    #[serde(rename = "symbol-fields-changed")]
    SymbolFieldsChanged,
    #[serde(rename = "instance-replaced")]
    InstanceReplaced,
    #[serde(rename = "instance-count-changed")]
    InstanceCountChanged,
    #[serde(rename = "sheet-changed")]
    SheetChanged,
    #[serde(rename = "net-renamed")]
    NetRenamed,
    #[serde(rename = "connectivity-changed")]
    ConnectivityChanged,
    #[serde(rename = "label-count-changed")]
    LabelCountChanged,
    #[serde(rename = "bus-membership-changed")]
    BusMembershipChanged,
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
impl ::std::fmt::Display for DesignCompareReason {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::ObjectAdded => f.write_str("object-added"),
            Self::ObjectRemoved => f.write_str("object-removed"),
            Self::SymbolFieldsChanged => f.write_str("symbol-fields-changed"),
            Self::InstanceReplaced => f.write_str("instance-replaced"),
            Self::InstanceCountChanged => f.write_str("instance-count-changed"),
            Self::SheetChanged => f.write_str("sheet-changed"),
            Self::NetRenamed => f.write_str("net-renamed"),
            Self::ConnectivityChanged => f.write_str("connectivity-changed"),
            Self::LabelCountChanged => f.write_str("label-count-changed"),
            Self::BusMembershipChanged => f.write_str("bus-membership-changed"),
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
impl ::std::str::FromStr for DesignCompareReason {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "object-added" => Ok(Self::ObjectAdded),
            "object-removed" => Ok(Self::ObjectRemoved),
            "symbol-fields-changed" => Ok(Self::SymbolFieldsChanged),
            "instance-replaced" => Ok(Self::InstanceReplaced),
            "instance-count-changed" => Ok(Self::InstanceCountChanged),
            "sheet-changed" => Ok(Self::SheetChanged),
            "net-renamed" => Ok(Self::NetRenamed),
            "connectivity-changed" => Ok(Self::ConnectivityChanged),
            "label-count-changed" => Ok(Self::LabelCountChanged),
            "bus-membership-changed" => Ok(Self::BusMembershipChanged),
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
impl ::std::convert::TryFrom<&str> for DesignCompareReason {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for DesignCompareReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for DesignCompareReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**Every Design Comparison tab except fabrication between two revisions
(`prism-kicad compare -o`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.design_compare.result:a1",
///  "title": "DesignCompareResultA1",
///  "description": "Every Design Comparison tab except fabrication between two revisions\n(`prism-kicad compare -o`).",
///  "type": "object",
///  "required": [
///    "base",
///    "bom",
///    "counts",
///    "files",
///    "head",
///    "pcb",
///    "projectDiff",
///    "routeMetrics",
///    "schema",
///    "schematic",
///    "stackup"
///  ],
///  "properties": {
///    "base": {
///      "description": "The base (old) revision.",
///      "$ref": "#/$defs/DesignCompareRevision"
///    },
///    "bom": {
///      "description": "The BOM tab.",
///      "$ref": "#/$defs/DesignCompareBom"
///    },
///    "counts": {
///      "description": "Change counts per tab.",
///      "$ref": "#/$defs/DesignCompareCounts"
///    },
///    "files": {
///      "description": "The KiCad source files of both revisions.",
///      "$ref": "#/$defs/DesignCompareFiles"
///    },
///    "head": {
///      "description": "The head (new) revision.",
///      "$ref": "#/$defs/DesignCompareRevision"
///    },
///    "pcb": {
///      "description": "The PCB tab.",
///      "$ref": "#/$defs/DesignCompareChanges"
///    },
///    "projectDiff": {
///      "description": "ecad-viewer's input: the native changes of both tabs, and the navigation from each change id.",
///      "$ref": "#/$defs/KiCadProjectDiffBundleV1"
///    },
///    "routeMetrics": {
///      "description": "Route metrics of both revisions, for the PCB tab's routing review.",
///      "$ref": "#/$defs/DesignCompareRouteMetrics"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.design_compare.result.a1"
///    },
///    "schematic": {
///      "description": "The Schematic tab.",
///      "$ref": "#/$defs/DesignCompareChanges"
///    },
///    "stackup": {
///      "description": "The Stackup tab.",
///      "$ref": "#/$defs/DesignCompareStackup"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareResultA1 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///The base (old) revision.
    pub base: DesignCompareRevision,
    ///The head (new) revision.
    pub head: DesignCompareRevision,
    ///The KiCad source files of both revisions.
    pub files: DesignCompareFiles,
    ///The Schematic tab.
    pub schematic: DesignCompareChanges,
    ///The PCB tab.
    pub pcb: DesignCompareChanges,
    ///The BOM tab.
    pub bom: DesignCompareBom,
    ///The Stackup tab.
    pub stackup: DesignCompareStackup,
    ///Route metrics of both revisions, for the PCB tab's routing review.
    #[serde(rename = "routeMetrics")]
    pub route_metrics: DesignCompareRouteMetrics,
    ///ecad-viewer's input: the native changes of both tabs, and the navigation from each change id.
    #[serde(rename = "projectDiff")]
    pub project_diff: KiCadProjectDiffBundleV1,
    ///Change counts per tab.
    pub counts: DesignCompareCounts,
}
///One revision of the comparison.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One revision of the comparison.",
///  "type": "object",
///  "required": [
///    "projectFile",
///    "revisionKey"
///  ],
///  "properties": {
///    "bundleKey": {
///      "description": "The bundle key the revision was read from. Absent when it was read from its source tree.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "projectFile": {
///      "description": "The project file the revision was compared by (`config.project_file`).",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "revisionKey": {
///      "description": "The revision key of the commit (revision-key.md).",
///      "$ref": "#/$defs/Sha256Hex"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareRevision {
    ///The revision key of the commit (revision-key.md).
    #[serde(rename = "revisionKey")]
    pub revision_key: Sha256Hex,
    ///The bundle key the revision was read from. Absent when it was read from its source tree.
    #[serde(
        rename = "bundleKey",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub bundle_key: ::std::option::Option<Sha256Hex>,
    ///The project file the revision was compared by (`config.project_file`).
    #[serde(rename = "projectFile")]
    pub project_file: RepoPath,
}
///One net's routing in one revision (`field-maps/route-metrics.md` C2 rules).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One net's routing in one revision (`field-maps/route-metrics.md` C2 rules).",
///  "type": "object",
///  "required": [
///    "routeLengthNm",
///    "usedLayers",
///    "viaCount"
///  ],
///  "properties": {
///    "routeLengthNm": {
///      "description": "The total centreline length of the net's tracks and arcs.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "usedLayers": {
///      "description": "Every copper layer the net occupies, sorted in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/LayerName"
///      }
///    },
///    "viaBarrelLengthNm": {
///      "description": "The summed via barrel length. Absent when it is unreliable (a via span the stackup cannot measure).",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "viaCount": {
///      "description": "The net's vias.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareRouteMetric {
    ///The total centreline length of the net's tracks and arcs.
    #[serde(rename = "routeLengthNm")]
    pub route_length_nm: NonNegativeNanometres,
    ///The net's vias.
    #[serde(rename = "viaCount")]
    pub via_count: Count,
    ///Every copper layer the net occupies, sorted in code point order.
    #[serde(rename = "usedLayers")]
    pub used_layers: ::std::vec::Vec<LayerName>,
    ///The summed via barrel length. Absent when it is unreliable (a via span the stackup cannot measure).
    #[serde(
        rename = "viaBarrelLengthNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub via_barrel_length_nm: ::std::option::Option<NonNegativeNanometres>,
}
///Route metrics of both revisions.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Route metrics of both revisions.",
///  "type": "object",
///  "required": [
///    "base",
///    "head"
///  ],
///  "properties": {
///    "base": {
///      "description": "Keys are net names; the base revision's routed nets.",
///      "$ref": "#/$defs/RecordDesignCompareRouteMetric"
///    },
///    "head": {
///      "description": "Keys are net names; the head revision's routed nets.",
///      "$ref": "#/$defs/RecordDesignCompareRouteMetric"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareRouteMetrics {
    ///Keys are net names; the base revision's routed nets.
    pub base: RecordDesignCompareRouteMetric,
    ///Keys are net names; the head revision's routed nets.
    pub head: RecordDesignCompareRouteMetric,
}
///A sheet on both sides.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A sheet on both sides.",
///  "type": "object",
///  "properties": {
///    "new": {
///      "description": "The head revision's sheet path. Absent when the head has none.",
///      "type": "string"
///    },
///    "old": {
///      "description": "The base revision's sheet path. Absent when the base has none.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareSheetDelta {
    ///The base revision's sheet path. Absent when the base has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub old: ::std::option::Option<::std::string::String>,
    ///The head revision's sheet path. Absent when the head has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub new: ::std::option::Option<::std::string::String>,
}
impl ::std::default::Default for DesignCompareSheetDelta {
    fn default() -> Self {
        Self {
            new: Default::default(),
            old: Default::default(),
        }
    }
}
///The pane a target is drawn in.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The pane a target is drawn in.",
///  "type": "string",
///  "enum": [
///    "base",
///    "head"
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
pub enum DesignCompareSide {
    #[serde(rename = "base")]
    Base,
    #[serde(rename = "head")]
    Head,
}
impl ::std::fmt::Display for DesignCompareSide {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Base => f.write_str("base"),
            Self::Head => f.write_str("head"),
        }
    }
}
impl ::std::str::FromStr for DesignCompareSide {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "base" => Ok(Self::Base),
            "head" => Ok(Self::Head),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for DesignCompareSide {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for DesignCompareSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for DesignCompareSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One KiCad source file of a revision, as the file list and the overlay show it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One KiCad source file of a revision, as the file list and the overlay show it.",
///  "type": "object",
///  "required": [
///    "filename",
///    "path"
///  ],
///  "properties": {
///    "filename": {
///      "description": "The file's name.",
///      "type": "string"
///    },
///    "path": {
///      "description": "The file's path relative to the project directory (amendment C2 D1).",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareSourceFile {
    ///The file's path relative to the project directory (amendment C2 D1).
    pub path: ::std::string::String,
    ///The file's name.
    pub filename: ::std::string::String,
}
///The Stackup tab.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The Stackup tab.",
///  "type": "object",
///  "required": [
///    "base",
///    "baseSettings",
///    "changed",
///    "head",
///    "headSettings",
///    "present"
///  ],
///  "properties": {
///    "base": {
///      "description": "The base revision's forms, in stack order from front to back. Empty without a stackup.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/DesignCompareStackupLayer"
///      }
///    },
///    "baseSettings": {
///      "description": "The base revision's settings.",
///      "$ref": "#/$defs/DesignCompareStackupSettings"
///    },
///    "changed": {
///      "description": "True when the two revisions' stackups or settings differ.",
///      "type": "boolean"
///    },
///    "head": {
///      "description": "The head revision's forms, in stack order from front to back. Empty without a stackup.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/DesignCompareStackupLayer"
///      }
///    },
///    "headSettings": {
///      "description": "The head revision's settings.",
///      "$ref": "#/$defs/DesignCompareStackupSettings"
///    },
///    "present": {
///      "description": "True when either revision has a stackup.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareStackup {
    ///True when either revision has a stackup.
    pub present: bool,
    ///True when the two revisions' stackups or settings differ.
    pub changed: bool,
    ///The base revision's forms, in stack order from front to back. Empty without a stackup.
    pub base: ::std::vec::Vec<DesignCompareStackupLayer>,
    ///The head revision's forms, in stack order from front to back. Empty without a stackup.
    pub head: ::std::vec::Vec<DesignCompareStackupLayer>,
    ///The base revision's settings.
    #[serde(rename = "baseSettings")]
    pub base_settings: DesignCompareStackupSettings,
    ///The head revision's settings.
    #[serde(rename = "headSettings")]
    pub head_settings: DesignCompareStackupSettings,
}
///One stackup form, as the Stackup tab shows it (`field-maps/stackup.md` DC rules: sub-layers folded to forms).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One stackup form, as the Stackup tab shows it (`field-maps/stackup.md` DC rules: sub-layers folded to forms).",
///  "type": "object",
///  "required": [
///    "name"
///  ],
///  "properties": {
///    "color": {
///      "description": "The layer's colour. Absent when the board writes none.",
///      "type": "string"
///    },
///    "epsilonR": {
///      "description": "The relative permittivity. Absent when the board writes none.",
///      "type": "number"
///    },
///    "lossTangent": {
///      "description": "The loss tangent. Absent when the board writes none.",
///      "type": "number"
///    },
///    "material": {
///      "description": "The layer's material. Absent when the board writes none.",
///      "type": "string"
///    },
///    "name": {
///      "description": "The layer's name.",
///      "type": "string"
///    },
///    "thicknessNm": {
///      "description": "The layer's thickness. Absent when the board writes none or writes 0.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "type": {
///      "description": "The layer's KiCad type, for example `copper` or `prepreg`. Absent when the board writes none.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareStackupLayer {
    ///The layer's name.
    pub name: ::std::string::String,
    ///The layer's KiCad type, for example `copper` or `prepreg`. Absent when the board writes none.
    #[serde(
        rename = "type",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub type_: ::std::option::Option<::std::string::String>,
    ///The layer's thickness. Absent when the board writes none or writes 0.
    #[serde(
        rename = "thicknessNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub thickness_nm: ::std::option::Option<Nanometres>,
    ///The layer's material. Absent when the board writes none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub material: ::std::option::Option<::std::string::String>,
    ///The layer's colour. Absent when the board writes none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub color: ::std::option::Option<::std::string::String>,
    ///The relative permittivity. Absent when the board writes none.
    #[serde(
        rename = "epsilonR",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub epsilon_r: ::std::option::Option<f64>,
    ///The loss tangent. Absent when the board writes none.
    #[serde(
        rename = "lossTangent",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub loss_tangent: ::std::option::Option<f64>,
}
///One revision's stackup settings.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One revision's stackup settings.",
///  "type": "object",
///  "properties": {
///    "copperFinish": {
///      "description": "The copper finish. Absent when the board writes none.",
///      "type": "string"
///    },
///    "dielectricConstraints": {
///      "description": "Whether impedance-controlled dielectric constraints are on. Absent when the board has no stackup.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareStackupSettings {
    ///The copper finish. Absent when the board writes none.
    #[serde(
        rename = "copperFinish",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub copper_finish: ::std::option::Option<::std::string::String>,
    ///Whether impedance-controlled dielectric constraints are on. Absent when the board has no stackup.
    #[serde(
        rename = "dielectricConstraints",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub dielectric_constraints: ::std::option::Option<bool>,
}
impl ::std::default::Default for DesignCompareStackupSettings {
    fn default() -> Self {
        Self {
            copper_finish: Default::default(),
            dielectric_constraints: Default::default(),
        }
    }
}
///Added, removed and changed counts.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Added, removed and changed counts.",
///  "type": "object",
///  "required": [
///    "added",
///    "changed",
///    "removed"
///  ],
///  "properties": {
///    "added": {
///      "description": "Added entries.",
///      "$ref": "#/$defs/Count"
///    },
///    "changed": {
///      "description": "Changed entries.",
///      "$ref": "#/$defs/Count"
///    },
///    "removed": {
///      "description": "Removed entries.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareSummary {
    ///Added entries.
    pub added: Count,
    ///Removed entries.
    pub removed: Count,
    ///Changed entries.
    pub changed: Count,
}
///One object ecad-viewer highlights for a change. The review list reads the targets' kinds, roles, documents, positions and references; `projectDiff` is built from the same targets.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One object ecad-viewer highlights for a change. The review list reads the targets' kinds, roles, documents, positions and references; `projectDiff` is built from the same targets.",
///  "type": "object",
///  "required": [
///    "side",
///    "sourceId"
///  ],
///  "properties": {
///    "at": {
///      "description": "The object's position. Absent for an object without one.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "documentPath": {
///      "description": "The document the object is in, relative to the project directory. Absent when it is not known.",
///      "type": "string"
///    },
///    "kind": {
///      "description": "The object's kind as the board-objects member names it, for example `pin` or `sheet-pin`. Absent when the target is only a role (a net's terminal with no pin object of its own).",
///      "type": "string"
///    },
///    "reference": {
///      "description": "The component reference designator the object belongs to. Absent when it belongs to none.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "role": {
///      "description": "How the object is drawn. Absent when it has no role beyond its `kind`.",
///      "$ref": "#/$defs/DesignCompareTargetRole"
///    },
///    "sheetPath": {
///      "description": "The sheet instance path of a schematic object (`/` for the root sheet). Absent on the board, and for a schematic object whose instance is not known.",
///      "type": "string"
///    },
///    "side": {
///      "description": "The pane the object is drawn in: `base` for the base revision's object, `head` for the head's.",
///      "$ref": "#/$defs/DesignCompareSide"
///    },
///    "sourceId": {
///      "description": "The object's native identity in that revision: its UUID, or for a terminal its pin's UUID (its symbol's when the pin has none).",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareTarget {
    ///The pane the object is drawn in: `base` for the base revision's object, `head` for the head's.
    pub side: DesignCompareSide,
    ///The object's native identity in that revision: its UUID, or for a terminal its pin's UUID (its symbol's when the pin has none).
    #[serde(rename = "sourceId")]
    pub source_id: ::std::string::String,
    ///The object's kind as the board-objects member names it, for example `pin` or `sheet-pin`. Absent when the target is only a role (a net's terminal with no pin object of its own).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub kind: ::std::option::Option<::std::string::String>,
    ///How the object is drawn. Absent when it has no role beyond its `kind`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub role: ::std::option::Option<DesignCompareTargetRole>,
    ///The document the object is in, relative to the project directory. Absent when it is not known.
    #[serde(
        rename = "documentPath",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub document_path: ::std::option::Option<::std::string::String>,
    ///The object's position. Absent for an object without one.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The sheet instance path of a schematic object (`/` for the root sheet). Absent on the board, and for a schematic object whose instance is not known.
    #[serde(
        rename = "sheetPath",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub sheet_path: ::std::option::Option<::std::string::String>,
    ///The component reference designator the object belongs to. Absent when it belongs to none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub reference: ::std::option::Option<Refdes>,
}
///How a target is drawn and reviewed: the object's own kind, or the part it plays in the change (a net's `terminal`, a component's `component`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How a target is drawn and reviewed: the object's own kind, or the part it plays in the change (a net's `terminal`, a component's `component`).",
///  "type": "string",
///  "enum": [
///    "component",
///    "wire",
///    "bus",
///    "bus-entry",
///    "label",
///    "junction",
///    "terminal",
///    "sheet",
///    "sheet-pin",
///    "symbol",
///    "no-connect",
///    "graphic",
///    "footprint",
///    "pad",
///    "track",
///    "arc",
///    "via",
///    "zone",
///    "footprint-graphic",
///    "footprint-text",
///    "image",
///    "table",
///    "group",
///    "net-class",
///    "net-class-assignment"
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
pub enum DesignCompareTargetRole {
    #[serde(rename = "component")]
    Component,
    #[serde(rename = "wire")]
    Wire,
    #[serde(rename = "bus")]
    Bus,
    #[serde(rename = "bus-entry")]
    BusEntry,
    #[serde(rename = "label")]
    Label,
    #[serde(rename = "junction")]
    Junction,
    #[serde(rename = "terminal")]
    Terminal,
    #[serde(rename = "sheet")]
    Sheet,
    #[serde(rename = "sheet-pin")]
    SheetPin,
    #[serde(rename = "symbol")]
    Symbol,
    #[serde(rename = "no-connect")]
    NoConnect,
    #[serde(rename = "graphic")]
    Graphic,
    #[serde(rename = "footprint")]
    Footprint,
    #[serde(rename = "pad")]
    Pad,
    #[serde(rename = "track")]
    Track,
    #[serde(rename = "arc")]
    Arc,
    #[serde(rename = "via")]
    Via,
    #[serde(rename = "zone")]
    Zone,
    #[serde(rename = "footprint-graphic")]
    FootprintGraphic,
    #[serde(rename = "footprint-text")]
    FootprintText,
    #[serde(rename = "image")]
    Image,
    #[serde(rename = "table")]
    Table,
    #[serde(rename = "group")]
    Group,
    #[serde(rename = "net-class")]
    NetClass,
    #[serde(rename = "net-class-assignment")]
    NetClassAssignment,
}
impl ::std::fmt::Display for DesignCompareTargetRole {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Component => f.write_str("component"),
            Self::Wire => f.write_str("wire"),
            Self::Bus => f.write_str("bus"),
            Self::BusEntry => f.write_str("bus-entry"),
            Self::Label => f.write_str("label"),
            Self::Junction => f.write_str("junction"),
            Self::Terminal => f.write_str("terminal"),
            Self::Sheet => f.write_str("sheet"),
            Self::SheetPin => f.write_str("sheet-pin"),
            Self::Symbol => f.write_str("symbol"),
            Self::NoConnect => f.write_str("no-connect"),
            Self::Graphic => f.write_str("graphic"),
            Self::Footprint => f.write_str("footprint"),
            Self::Pad => f.write_str("pad"),
            Self::Track => f.write_str("track"),
            Self::Arc => f.write_str("arc"),
            Self::Via => f.write_str("via"),
            Self::Zone => f.write_str("zone"),
            Self::FootprintGraphic => f.write_str("footprint-graphic"),
            Self::FootprintText => f.write_str("footprint-text"),
            Self::Image => f.write_str("image"),
            Self::Table => f.write_str("table"),
            Self::Group => f.write_str("group"),
            Self::NetClass => f.write_str("net-class"),
            Self::NetClassAssignment => f.write_str("net-class-assignment"),
        }
    }
}
impl ::std::str::FromStr for DesignCompareTargetRole {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "component" => Ok(Self::Component),
            "wire" => Ok(Self::Wire),
            "bus" => Ok(Self::Bus),
            "bus-entry" => Ok(Self::BusEntry),
            "label" => Ok(Self::Label),
            "junction" => Ok(Self::Junction),
            "terminal" => Ok(Self::Terminal),
            "sheet" => Ok(Self::Sheet),
            "sheet-pin" => Ok(Self::SheetPin),
            "symbol" => Ok(Self::Symbol),
            "no-connect" => Ok(Self::NoConnect),
            "graphic" => Ok(Self::Graphic),
            "footprint" => Ok(Self::Footprint),
            "pad" => Ok(Self::Pad),
            "track" => Ok(Self::Track),
            "arc" => Ok(Self::Arc),
            "via" => Ok(Self::Via),
            "zone" => Ok(Self::Zone),
            "footprint-graphic" => Ok(Self::FootprintGraphic),
            "footprint-text" => Ok(Self::FootprintText),
            "image" => Ok(Self::Image),
            "table" => Ok(Self::Table),
            "group" => Ok(Self::Group),
            "net-class" => Ok(Self::NetClass),
            "net-class-assignment" => Ok(Self::NetClassAssignment),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for DesignCompareTargetRole {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for DesignCompareTargetRole {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for DesignCompareTargetRole {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///ecad-viewer's comparison input.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "ecad-viewer's comparison input.",
///  "type": "object",
///  "required": [
///    "diagnostics",
///    "navigation",
///    "project",
///    "provider",
///    "schema"
///  ],
///  "properties": {
///    "diagnostics": {
///      "description": "Review items that resolved to no native object, in review order. Empty when there are none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/KiCadProjectDiffDiagnostic"
///      }
///    },
///    "navigation": {
///      "description": "Keys are review item ids (`DesignCompareChange.id`); each maps to the native changes ecad-viewer selects for it.",
///      "$ref": "#/$defs/RecordKiCadProjectDiffNavigation"
///    },
///    "project": {
///      "description": "The native changes, per document.",
///      "$ref": "#/$defs/KiCadProjectDiffProject"
///    },
///    "provider": {
///      "description": "Who produced the diff: `prism-semantic` for Prism.",
///      "type": "string",
///      "const": "prism-semantic"
///    },
///    "schema": {
///      "description": "Document schema id, in ecad-viewer's spelling.",
///      "type": "string",
///      "const": "prism.kicad_project_diff_v1"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct KiCadProjectDiffBundleV1 {
    ///Document schema id, in ecad-viewer's spelling.
    pub schema: ::std::string::String,
    ///Who produced the diff: `prism-semantic` for Prism.
    pub provider: ::std::string::String,
    ///The native changes, per document.
    pub project: KiCadProjectDiffProject,
    ///Keys are review item ids (`DesignCompareChange.id`); each maps to the native changes ecad-viewer selects for it.
    pub navigation: RecordKiCadProjectDiffNavigation,
    ///Review items that resolved to no native object, in review order. Empty when there are none.
    pub diagnostics: ::std::vec::Vec<KiCadProjectDiffDiagnostic>,
}
///What a native change does to its object, in ecad-viewer's vocabulary.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What a native change does to its object, in ecad-viewer's vocabulary.",
///  "type": "string",
///  "enum": [
///    "added",
///    "removed",
///    "modified",
///    "collision",
///    "duplicate_uuid"
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
pub enum KiCadProjectDiffChangeKind {
    #[serde(rename = "added")]
    Added,
    #[serde(rename = "removed")]
    Removed,
    #[serde(rename = "modified")]
    Modified,
    #[serde(rename = "collision")]
    Collision,
    #[serde(rename = "duplicate_uuid")]
    DuplicateUuid,
}
impl ::std::fmt::Display for KiCadProjectDiffChangeKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Added => f.write_str("added"),
            Self::Removed => f.write_str("removed"),
            Self::Modified => f.write_str("modified"),
            Self::Collision => f.write_str("collision"),
            Self::DuplicateUuid => f.write_str("duplicate_uuid"),
        }
    }
}
impl ::std::str::FromStr for KiCadProjectDiffChangeKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "added" => Ok(Self::Added),
            "removed" => Ok(Self::Removed),
            "modified" => Ok(Self::Modified),
            "collision" => Ok(Self::Collision),
            "duplicate_uuid" => Ok(Self::DuplicateUuid),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for KiCadProjectDiffChangeKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for KiCadProjectDiffChangeKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for KiCadProjectDiffChangeKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A review item no native object could be found for.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A review item no native object could be found for.",
///  "type": "object",
///  "required": [
///    "changeId",
///    "reason"
///  ],
///  "properties": {
///    "changeId": {
///      "description": "The review item's id (`DesignCompareChange.id`).",
///      "type": "string"
///    },
///    "reason": {
///      "description": "Why, in ecad-viewer's vocabulary, for example `missing-source-id`.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct KiCadProjectDiffDiagnostic {
    ///The review item's id (`DesignCompareChange.id`).
    #[serde(rename = "changeId")]
    pub change_id: ::std::string::String,
    ///Why, in ecad-viewer's vocabulary, for example `missing-source-id`.
    pub reason: ::std::string::String,
}
///The KiCad file type of one document of the diff.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The KiCad file type of one document of the diff.",
///  "type": "string",
///  "enum": [
///    "kicad_sch",
///    "kicad_pcb"
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
pub enum KiCadProjectDiffDocType {
    #[serde(rename = "kicad_sch")]
    KicadSch,
    #[serde(rename = "kicad_pcb")]
    KicadPcb,
}
impl ::std::fmt::Display for KiCadProjectDiffDocType {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::KicadSch => f.write_str("kicad_sch"),
            Self::KicadPcb => f.write_str("kicad_pcb"),
        }
    }
}
impl ::std::str::FromStr for KiCadProjectDiffDocType {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "kicad_sch" => Ok(Self::KicadSch),
            "kicad_pcb" => Ok(Self::KicadPcb),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for KiCadProjectDiffDocType {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for KiCadProjectDiffDocType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for KiCadProjectDiffDocType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One KiCad document's native changes.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One KiCad document's native changes.",
///  "type": "object",
///  "required": [
///    "changes",
///    "docType",
///    "path"
///  ],
///  "properties": {
///    "changes": {
///      "description": "The document's native changes, in review order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/KiCadProjectDiffItemChange"
///      }
///    },
///    "docType": {
///      "description": "The document's file type.",
///      "$ref": "#/$defs/KiCadProjectDiffDocType"
///    },
///    "path": {
///      "description": "The document's path, relative to the project directory (amendment C2 D1).",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct KiCadProjectDiffDocument {
    ///The document's path, relative to the project directory (amendment C2 D1).
    pub path: ::std::string::String,
    ///The document's file type.
    #[serde(rename = "docType")]
    pub doc_type: KiCadProjectDiffDocType,
    ///The document's native changes, in review order.
    pub changes: ::std::vec::Vec<KiCadProjectDiffItemChange>,
}
/**One changed KiCad object ecad-viewer resolves against its own parsed scene
and highlights. ecad-viewer measures the geometry itself, so `bbox` is
absent in Prism's output.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One changed KiCad object ecad-viewer resolves against its own parsed scene\nand highlights. ecad-viewer measures the geometry itself, so `bbox` is\nabsent in Prism's output.",
///  "type": "object",
///  "required": [
///    "children",
///    "id",
///    "kind",
///    "properties",
///    "typeName"
///  ],
///  "properties": {
///    "bbox": {
///      "description": "Bounds `[x0, y0, x1, y1]`, in that order, in KiCad document millimetres. Absent in Prism's output; native KiCad diffs carry it.",
///      "type": "array",
///      "items": {
///        "type": "number"
///      },
///      "maxItems": 4,
///      "minItems": 4
///    },
///    "children": {
///      "description": "Further objects of the same review item in this document, in review order. Empty when there are none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/KiCadProjectDiffItemChange"
///      }
///    },
///    "id": {
///      "description": "The object's native identity: its KIID path, or its UUID when it has no path.",
///      "type": "string"
///    },
///    "kind": {
///      "description": "What the change does to the object.",
///      "$ref": "#/$defs/KiCadProjectDiffChangeKind"
///    },
///    "properties": {
///      "description": "The properties that differ, sorted by `name` in code point order. Empty for a child change.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/KiCadProjectDiffProperty"
///      }
///    },
///    "refdes": {
///      "description": "The reference designator, or the net name for a net-level change. Absent when the change has neither.",
///      "type": "string"
///    },
///    "retainReference": {
///      "description": "True when the reference pane keeps the object visible although the change belongs to the comparison. Absent means false.",
///      "type": "boolean",
///      "const": true
///    },
///    "sourceSide": {
///      "description": "The revision pane the object is painted in.",
///      "$ref": "#/$defs/KiCadProjectDiffSourceSide"
///    },
///    "typeName": {
///      "description": "KiCad's C++ type name of the object, for example `SCH_SYMBOL`, `PCB_TRACK` or `ZONE`; `EDA_ITEM` when no specific type applies.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct KiCadProjectDiffItemChange {
    ///The object's native identity: its KIID path, or its UUID when it has no path.
    pub id: ::std::string::String,
    ///KiCad's C++ type name of the object, for example `SCH_SYMBOL`, `PCB_TRACK` or `ZONE`; `EDA_ITEM` when no specific type applies.
    #[serde(rename = "typeName")]
    pub type_name: ::std::string::String,
    ///What the change does to the object.
    pub kind: KiCadProjectDiffChangeKind,
    ///The revision pane the object is painted in.
    #[serde(
        rename = "sourceSide",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub source_side: ::std::option::Option<KiCadProjectDiffSourceSide>,
    ///The properties that differ, sorted by `name` in code point order. Empty for a child change.
    pub properties: ::std::vec::Vec<KiCadProjectDiffProperty>,
    ///Bounds `[x0, y0, x1, y1]`, in that order, in KiCad document millimetres. Absent in Prism's output; native KiCad diffs carry it.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub bbox: ::std::option::Option<[f64; 4usize]>,
    ///The reference designator, or the net name for a net-level change. Absent when the change has neither.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub refdes: ::std::option::Option<::std::string::String>,
    ///True when the reference pane keeps the object visible although the change belongs to the comparison. Absent means false.
    #[serde(
        rename = "retainReference",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub retain_reference: ::std::option::Option<bool>,
    ///Further objects of the same review item in this document, in review order. Empty when there are none.
    pub children: ::std::vec::Vec<KiCadProjectDiffItemChange>,
}
///Where one review item's native changes sit: its first document, and every document when there is more than one.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where one review item's native changes sit: its first document, and every document when there is more than one.",
///  "type": "object",
///  "required": [
///    "changeId",
///    "documentPath"
///  ],
///  "properties": {
///    "changeId": {
///      "description": "The first native change id in the first document.",
///      "type": "string"
///    },
///    "changeIds": {
///      "description": "Every native change id in the first document, in review order.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "documentPath": {
///      "description": "The first document's path.",
///      "type": "string"
///    },
///    "documents": {
///      "description": "One entry per document, in review order. Absent when the review item touches one document.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/KiCadProjectDiffNavigationDocument"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct KiCadProjectDiffNavigation {
    ///The first document's path.
    #[serde(rename = "documentPath")]
    pub document_path: ::std::string::String,
    ///The first native change id in the first document.
    #[serde(rename = "changeId")]
    pub change_id: ::std::string::String,
    ///Every native change id in the first document, in review order.
    #[serde(
        rename = "changeIds",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub change_ids: ::std::option::Option<::std::vec::Vec<::std::string::String>>,
    ///One entry per document, in review order. Absent when the review item touches one document.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub documents: ::std::option::Option<::std::vec::Vec<KiCadProjectDiffNavigationDocument>>,
}
///Where one review item's native changes sit in one document.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where one review item's native changes sit in one document.",
///  "type": "object",
///  "required": [
///    "changeId",
///    "changeIds",
///    "documentPath"
///  ],
///  "properties": {
///    "changeId": {
///      "description": "The first native change id of the review item in this document.",
///      "type": "string"
///    },
///    "changeIds": {
///      "description": "Every native change id of the review item in this document, in review order.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "documentPath": {
///      "description": "The document's path, as in `KiCadProjectDiffDocument.path`.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct KiCadProjectDiffNavigationDocument {
    ///The document's path, as in `KiCadProjectDiffDocument.path`.
    #[serde(rename = "documentPath")]
    pub document_path: ::std::string::String,
    ///The first native change id of the review item in this document.
    #[serde(rename = "changeId")]
    pub change_id: ::std::string::String,
    ///Every native change id of the review item in this document, in review order.
    #[serde(rename = "changeIds")]
    pub change_ids: ::std::vec::Vec<::std::string::String>,
}
///The project part of the diff.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The project part of the diff.",
///  "type": "object",
///  "required": [
///    "documents"
///  ],
///  "properties": {
///    "documents": {
///      "description": "One entry per document with at least one change, sorted by `path` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/KiCadProjectDiffDocument"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct KiCadProjectDiffProject {
    ///One entry per document with at least one change, sorted by `path` in code point order.
    pub documents: ::std::vec::Vec<KiCadProjectDiffDocument>,
}
///One property that differs between the two revisions of a native change.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One property that differs between the two revisions of a native change.",
///  "type": "object",
///  "required": [
///    "after",
///    "before",
///    "name"
///  ],
///  "properties": {
///    "after": {
///      "description": "The comparison revision's value.",
///      "$ref": "#/$defs/KiCadProjectDiffValue"
///    },
///    "before": {
///      "description": "The reference revision's value.",
///      "$ref": "#/$defs/KiCadProjectDiffValue"
///    },
///    "name": {
///      "description": "The property's display name, for example `Position` or `Net`.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct KiCadProjectDiffProperty {
    ///The property's display name, for example `Position` or `Net`.
    pub name: ::std::string::String,
    ///The reference revision's value.
    pub before: KiCadProjectDiffValue,
    ///The comparison revision's value.
    pub after: KiCadProjectDiffValue,
}
///A property value: a text, a number or a flag.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A property value: a text, a number or a flag.",
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
pub enum KiCadProjectDiffScalar {
    String(::std::string::String),
    Number(f64),
    Boolean(bool),
}
impl ::std::fmt::Display for KiCadProjectDiffScalar {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match self {
            Self::String(x) => x.fmt(f),
            Self::Number(x) => x.fmt(f),
            Self::Boolean(x) => x.fmt(f),
        }
    }
}
impl ::std::convert::From<f64> for KiCadProjectDiffScalar {
    fn from(value: f64) -> Self {
        Self::Number(value)
    }
}
impl ::std::convert::From<bool> for KiCadProjectDiffScalar {
    fn from(value: bool) -> Self {
        Self::Boolean(value)
    }
}
///The revision pane a native change is painted in.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The revision pane a native change is painted in.",
///  "type": "string",
///  "enum": [
///    "reference",
///    "comparison"
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
pub enum KiCadProjectDiffSourceSide {
    #[serde(rename = "reference")]
    Reference,
    #[serde(rename = "comparison")]
    Comparison,
}
impl ::std::fmt::Display for KiCadProjectDiffSourceSide {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Reference => f.write_str("reference"),
            Self::Comparison => f.write_str("comparison"),
        }
    }
}
impl ::std::str::FromStr for KiCadProjectDiffSourceSide {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "reference" => Ok(Self::Reference),
            "comparison" => Ok(Self::Comparison),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for KiCadProjectDiffSourceSide {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for KiCadProjectDiffSourceSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for KiCadProjectDiffSourceSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One side's value of a property: its encoding and the value.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One side's value of a property: its encoding and the value.",
///  "type": "object",
///  "required": [
///    "type"
///  ],
///  "properties": {
///    "label": {
///      "description": "A display label ecad-viewer shows instead of `v`. Absent when `v` is shown as is.",
///      "type": "string"
///    },
///    "type": {
///      "description": "How `v` is encoded.",
///      "$ref": "#/$defs/KiCadProjectDiffValueType"
///    },
///    "v": {
///      "description": "The value; `null` exactly when `type` is `null` (ecad-viewer's encoding).",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/KiCadProjectDiffScalar"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct KiCadProjectDiffValue {
    ///How `v` is encoded.
    #[serde(rename = "type")]
    pub type_: KiCadProjectDiffValueType,
    ///The value; `null` exactly when `type` is `null` (ecad-viewer's encoding).
    #[serde(
        default,
        deserialize_with = "crate::deserialize_present_nullable",
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub v: ::std::option::Option<::std::option::Option<KiCadProjectDiffScalar>>,
    ///A display label ecad-viewer shows instead of `v`. Absent when `v` is shown as is.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub label: ::std::option::Option<::std::string::String>,
}
///The encoding of one property value, after KiCad's PROJECT_DIFF.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The encoding of one property value, after KiCad's PROJECT_DIFF.",
///  "type": "string",
///  "enum": [
///    "null",
///    "bool",
///    "int",
///    "double",
///    "string"
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
pub enum KiCadProjectDiffValueType {
    #[serde(rename = "null")]
    Null,
    #[serde(rename = "bool")]
    Bool,
    #[serde(rename = "int")]
    Int,
    #[serde(rename = "double")]
    Double,
    #[serde(rename = "string")]
    String,
}
impl ::std::fmt::Display for KiCadProjectDiffValueType {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Null => f.write_str("null"),
            Self::Bool => f.write_str("bool"),
            Self::Int => f.write_str("int"),
            Self::Double => f.write_str("double"),
            Self::String => f.write_str("string"),
        }
    }
}
impl ::std::str::FromStr for KiCadProjectDiffValueType {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "null" => Ok(Self::Null),
            "bool" => Ok(Self::Bool),
            "int" => Ok(Self::Int),
            "double" => Ok(Self::Double),
            "string" => Ok(Self::String),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for KiCadProjectDiffValueType {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for KiCadProjectDiffValueType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for KiCadProjectDiffValueType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
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
/**KiCad canonical layer name as the board file's `(layers …)` table spells
it, for example `F.Cu`, `In1.Cu`, `B.Mask`, `Edge.Cuts` or `User.1`. Never
the user-assigned layer name, which a contract carries in a separate
optional field. Never a wildcard set such as `*.Cu` or `F&B.Cu`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad canonical layer name as the board file's `(layers …)` table spells\nit, for example `F.Cu`, `In1.Cu`, `B.Mask`, `Edge.Cuts` or `User.1`. Never\nthe user-assigned layer name, which a contract carries in a separate\noptional field. Never a wildcard set such as `*.Cu` or `F&B.Cu`.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct LayerName(::std::string::String);
impl ::std::ops::Deref for LayerName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<LayerName> for ::std::string::String {
    fn from(value: LayerName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for LayerName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for LayerName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for LayerName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for LayerName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for LayerName {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
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
/**KiCad full net name as KiCad resolves it, including the sheet path prefix
of a local net (`/Power/VBUS`), a global name (`GND`) or a generated name
(`Net-(R1-Pad2)`, `unconnected-(U1-PA0-Pad3)`). "No net" is expressed by
omitting the field, never by an empty name.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad full net name as KiCad resolves it, including the sheet path prefix\nof a local net (`/Power/VBUS`), a global name (`GND`) or a generated name\n(`Net-(R1-Pad2)`, `unconnected-(U1-PA0-Pad3)`). \"No net\" is expressed by\nomitting the field, never by an empty name.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct NetName(::std::string::String);
impl ::std::ops::Deref for NetName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<NetName> for ::std::string::String {
    fn from(value: NetName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for NetName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for NetName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for NetName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for NetName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for NetName {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
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
/**A point in nanometres in KiCad's board frame: +x to the right, +y down, as
in the file and never flipped. The field holding the point states whether
it is board-absolute or footprint-local. For camelCase (projection)
documents only.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A point in nanometres in KiCad's board frame: +x to the right, +y down, as\nin the file and never flipped. The field holding the point states whether\nit is board-absolute or footprint-local. For camelCase (projection)\ndocuments only.",
///  "type": "object",
///  "required": [
///    "xNm",
///    "yNm"
///  ],
///  "properties": {
///    "xNm": {
///      "description": "X coordinate in nanometres, +x to the right.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "yNm": {
///      "description": "Y coordinate in nanometres, +y down.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PointNm {
    ///X coordinate in nanometres, +x to the right.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///Y coordinate in nanometres, +y down.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
}
///`RecordDesignCompareBomFieldDiff`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/DesignCompareBomFieldDiff"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordDesignCompareBomFieldDiff(
    pub ::std::collections::BTreeMap<::std::string::String, DesignCompareBomFieldDiff>,
);
impl ::std::ops::Deref for RecordDesignCompareBomFieldDiff {
    type Target = ::std::collections::BTreeMap<::std::string::String, DesignCompareBomFieldDiff>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, DesignCompareBomFieldDiff> {
        &self.0
    }
}
impl ::std::convert::From<RecordDesignCompareBomFieldDiff>
    for ::std::collections::BTreeMap<::std::string::String, DesignCompareBomFieldDiff>
{
    fn from(value: RecordDesignCompareBomFieldDiff) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, DesignCompareBomFieldDiff>,
    > for RecordDesignCompareBomFieldDiff
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, DesignCompareBomFieldDiff>,
    ) -> Self {
        Self(value)
    }
}
///`RecordDesignCompareFieldDelta`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/DesignCompareFieldDelta"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordDesignCompareFieldDelta(
    pub ::std::collections::BTreeMap<::std::string::String, DesignCompareFieldDelta>,
);
impl ::std::ops::Deref for RecordDesignCompareFieldDelta {
    type Target = ::std::collections::BTreeMap<::std::string::String, DesignCompareFieldDelta>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, DesignCompareFieldDelta> {
        &self.0
    }
}
impl ::std::convert::From<RecordDesignCompareFieldDelta>
    for ::std::collections::BTreeMap<::std::string::String, DesignCompareFieldDelta>
{
    fn from(value: RecordDesignCompareFieldDelta) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, DesignCompareFieldDelta>,
    > for RecordDesignCompareFieldDelta
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, DesignCompareFieldDelta>,
    ) -> Self {
        Self(value)
    }
}
///`RecordDesignCompareRouteMetric`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/DesignCompareRouteMetric"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordDesignCompareRouteMetric(
    pub ::std::collections::BTreeMap<::std::string::String, DesignCompareRouteMetric>,
);
impl ::std::ops::Deref for RecordDesignCompareRouteMetric {
    type Target = ::std::collections::BTreeMap<::std::string::String, DesignCompareRouteMetric>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, DesignCompareRouteMetric> {
        &self.0
    }
}
impl ::std::convert::From<RecordDesignCompareRouteMetric>
    for ::std::collections::BTreeMap<::std::string::String, DesignCompareRouteMetric>
{
    fn from(value: RecordDesignCompareRouteMetric) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, DesignCompareRouteMetric>,
    > for RecordDesignCompareRouteMetric
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, DesignCompareRouteMetric>,
    ) -> Self {
        Self(value)
    }
}
///`RecordKiCadProjectDiffNavigation`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/KiCadProjectDiffNavigation"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordKiCadProjectDiffNavigation(
    pub ::std::collections::BTreeMap<::std::string::String, KiCadProjectDiffNavigation>,
);
impl ::std::ops::Deref for RecordKiCadProjectDiffNavigation {
    type Target = ::std::collections::BTreeMap<::std::string::String, KiCadProjectDiffNavigation>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, KiCadProjectDiffNavigation> {
        &self.0
    }
}
impl ::std::convert::From<RecordKiCadProjectDiffNavigation>
    for ::std::collections::BTreeMap<::std::string::String, KiCadProjectDiffNavigation>
{
    fn from(value: RecordKiCadProjectDiffNavigation) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, KiCadProjectDiffNavigation>,
    > for RecordKiCadProjectDiffNavigation
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, KiCadProjectDiffNavigation>,
    ) -> Self {
        Self(value)
    }
}
///`RecordString`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "type": "string"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordString(
    pub ::std::collections::BTreeMap<::std::string::String, ::std::string::String>,
);
impl ::std::ops::Deref for RecordString {
    type Target = ::std::collections::BTreeMap<::std::string::String, ::std::string::String>;
    fn deref(&self) -> &::std::collections::BTreeMap<::std::string::String, ::std::string::String> {
        &self.0
    }
}
impl ::std::convert::From<RecordString>
    for ::std::collections::BTreeMap<::std::string::String, ::std::string::String>
{
    fn from(value: RecordString) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<::std::collections::BTreeMap<::std::string::String, ::std::string::String>>
    for RecordString
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, ::std::string::String>,
    ) -> Self {
        Self(value)
    }
}
/**Reference designator as KiCad resolves it for one symbol instance or
footprint, for example `R1`, `U3`, `#PWR01` or `R?`. Always a string. A
contract states whether it includes virtual (`#`) and unannotated (`?`)
references.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Reference designator as KiCad resolves it for one symbol instance or\nfootprint, for example `R1`, `U3`, `#PWR01` or `R?`. Always a string. A\ncontract states whether it includes virtual (`#`) and unannotated (`?`)\nreferences.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct Refdes(::std::string::String);
impl ::std::ops::Deref for Refdes {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<Refdes> for ::std::string::String {
    fn from(value: Refdes) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for Refdes {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for Refdes {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for Refdes {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for Refdes {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for Refdes {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
/**Repository-relative POSIX path, exactly as `git ls-tree` names the entry:
`/`-separated, case preserved, no leading `/`, no empty, `.` or `..`
segment, no backslash and no `:`. The same character rule as ArchivePath.
It is the only path type in bundle documents: a file has one spelling
whichever project in the repository refers to it, and a file outside the
project directory needs no `..`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Repository-relative POSIX path, exactly as `git ls-tree` names the entry:\n`/`-separated, case preserved, no leading `/`, no empty, `.` or `..`\nsegment, no backslash and no `:`. The same character rule as ArchivePath.\nIt is the only path type in bundle documents: a file has one spelling\nwhichever project in the repository refers to it, and a file outside the\nproject directory needs no `..`.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct RepoPath(pub ::std::string::String);
impl ::std::ops::Deref for RepoPath {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RepoPath> for ::std::string::String {
    fn from(value: RepoPath) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for RepoPath {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for RepoPath {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for RepoPath {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
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
impl<'de> ::serde::Deserialize<'de> for KiCadProjectDiffScalar {
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
            "data did not match any variant of untagged enum KiCadProjectDiffScalar",
        ))
    }
}
