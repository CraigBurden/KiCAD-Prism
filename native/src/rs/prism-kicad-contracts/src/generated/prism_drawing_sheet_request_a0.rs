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
/**The page and title block `prism-kicad drawing-sheet --request` draws the
default worksheet on.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.drawing_sheet.request:a0",
///  "title": "DrawingSheetRequestA0",
///  "description": "The page and title block `prism-kicad drawing-sheet --request` draws the\ndefault worksheet on.",
///  "type": "object",
///  "required": [
///    "file_name",
///    "kicad_version",
///    "paper_height_nm",
///    "paper_name",
///    "paper_width_nm",
///    "schema",
///    "sheet_count",
///    "sheet_index",
///    "sheet_name",
///    "sheet_path",
///    "title_block"
///  ],
///  "properties": {
///    "file_name": {
///      "description": "The file name the sheet is drawn as, for example `doc.pdf`.",
///      "type": "string"
///    },
///    "kicad_version": {
///      "description": "The KiCad version string recorded on the sheet, for example `10.0.6`, or\nthe literal `KiCad` when the version is unknown.",
///      "type": "string"
///    },
///    "paper_height_nm": {
///      "description": "Page height in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "paper_name": {
///      "description": "The paper's name, for example `A4` or `A3`.",
///      "type": "string"
///    },
///    "paper_width_nm": {
///      "description": "Page width in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.drawing_sheet.request.a0"
///    },
///    "sheet_count": {
///      "description": "How many sheets the document has.",
///      "type": "integer",
///      "minimum": 1.0
///    },
///    "sheet_index": {
///      "description": "One-based index of this sheet among `sheet_count`.",
///      "type": "integer",
///      "minimum": 1.0
///    },
///    "sheet_name": {
///      "description": "The sheet's own name, for example `key`.",
///      "type": "string"
///    },
///    "sheet_path": {
///      "description": "The schematic sheet path, for example `/key`.",
///      "type": "string"
///    },
///    "title_block": {
///      "description": "The title block drawn on the page.",
///      "$ref": "#/$defs/DrawingSheetTitleBlock"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DrawingSheetRequestA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///Page width in nanometres.
    pub paper_width_nm: NonNegativeNanometres,
    ///Page height in nanometres.
    pub paper_height_nm: NonNegativeNanometres,
    ///The title block drawn on the page.
    pub title_block: DrawingSheetTitleBlock,
    ///One-based index of this sheet among `sheet_count`.
    pub sheet_index: ::std::num::NonZeroU64,
    ///How many sheets the document has.
    pub sheet_count: ::std::num::NonZeroU64,
    ///The paper's name, for example `A4` or `A3`.
    pub paper_name: ::std::string::String,
    ///The file name the sheet is drawn as, for example `doc.pdf`.
    pub file_name: ::std::string::String,
    ///The schematic sheet path, for example `/key`.
    pub sheet_path: ::std::string::String,
    ///The sheet's own name, for example `key`.
    pub sheet_name: ::std::string::String,
    /**The KiCad version string recorded on the sheet, for example `10.0.6`, or
    the literal `KiCad` when the version is unknown.*/
    pub kicad_version: ::std::string::String,
}
/**The title block drawn in the sheet's lower-right corner, matching the four
standard fields and KiCad's comments 1 to 4.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The title block drawn in the sheet's lower-right corner, matching the four\nstandard fields and KiCad's comments 1 to 4.",
///  "type": "object",
///  "required": [
///    "comments",
///    "company",
///    "date",
///    "rev",
///    "title"
///  ],
///  "properties": {
///    "comments": {
///      "description": "The keys are the comment numbers `\"1\"` to `\"4\"` as decimal strings,\nserialized in code point order. A value is the comment's text, which may be\nempty.",
///      "$ref": "#/$defs/RecordString"
///    },
///    "company": {
///      "description": "The `Company` field.",
///      "type": "string"
///    },
///    "date": {
///      "description": "The `Date` field, as written.",
///      "type": "string"
///    },
///    "rev": {
///      "description": "The `Rev` field, as written.",
///      "type": "string"
///    },
///    "title": {
///      "description": "The `Title` field.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DrawingSheetTitleBlock {
    ///The `Title` field.
    pub title: ::std::string::String,
    ///The `Date` field, as written.
    pub date: ::std::string::String,
    ///The `Rev` field, as written.
    pub rev: ::std::string::String,
    ///The `Company` field.
    pub company: ::std::string::String,
    /**The keys are the comment numbers `"1"` to `"4"` as decimal strings,
    serialized in code point order. A value is the comment's text, which may be
    empty.*/
    pub comments: RecordString,
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
