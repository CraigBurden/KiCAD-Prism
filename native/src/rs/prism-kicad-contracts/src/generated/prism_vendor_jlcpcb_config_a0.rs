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
///BOM source, grouping, DNP and output settings (`bom`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "BOM source, grouping, DNP and output settings (`bom`).",
///  "type": "object",
///  "required": [
///    "group_fields",
///    "include_dnp",
///    "outputs",
///    "split_dnp"
///  ],
///  "properties": {
///    "group_fields": {
///      "description": "The canonical fields that must match before components collapse into one\ngrouped BOM line, in file order (`value`, `footprint`).",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "include_dnp": {
///      "description": "Keep do-not-populate components in normalized/grouped BOM outputs.",
///      "type": "boolean"
///    },
///    "outputs": {
///      "description": "The BOM artifact kinds to emit, in file order. Each listed kind is written\nfrom one load of the design.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/VendorJlcpcbBomOutput"
///      }
///    },
///    "split_dnp": {
///      "description": "Keep fitted and DNP components on separate grouped lines when the group fields match.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct VendorJlcpcbBom {
    /**The BOM artifact kinds to emit, in file order. Each listed kind is written
    from one load of the design.*/
    pub outputs: ::std::vec::Vec<VendorJlcpcbBomOutput>,
    /**The canonical fields that must match before components collapse into one
    grouped BOM line, in file order (`value`, `footprint`).*/
    pub group_fields: ::std::vec::Vec<::std::string::String>,
    ///Keep do-not-populate components in normalized/grouped BOM outputs.
    pub include_dnp: bool,
    ///Keep fitted and DNP components on separate grouped lines when the group fields match.
    pub split_dnp: bool,
}
///One BOM artifact kind the config lists.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One BOM artifact kind the config lists.",
///  "type": "string",
///  "enum": [
///    "raw-json",
///    "legacy-json",
///    "grouped-json",
///    "grouped-csv",
///    "grouped-xlsx",
///    "jlc-csv",
///    "jlc-xlsx"
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
pub enum VendorJlcpcbBomOutput {
    #[serde(rename = "raw-json")]
    RawJson,
    #[serde(rename = "legacy-json")]
    LegacyJson,
    #[serde(rename = "grouped-json")]
    GroupedJson,
    #[serde(rename = "grouped-csv")]
    GroupedCsv,
    #[serde(rename = "grouped-xlsx")]
    GroupedXlsx,
    #[serde(rename = "jlc-csv")]
    JlcCsv,
    #[serde(rename = "jlc-xlsx")]
    JlcXlsx,
}
impl ::std::fmt::Display for VendorJlcpcbBomOutput {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::RawJson => f.write_str("raw-json"),
            Self::LegacyJson => f.write_str("legacy-json"),
            Self::GroupedJson => f.write_str("grouped-json"),
            Self::GroupedCsv => f.write_str("grouped-csv"),
            Self::GroupedXlsx => f.write_str("grouped-xlsx"),
            Self::JlcCsv => f.write_str("jlc-csv"),
            Self::JlcXlsx => f.write_str("jlc-xlsx"),
        }
    }
}
impl ::std::str::FromStr for VendorJlcpcbBomOutput {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "raw-json" => Ok(Self::RawJson),
            "legacy-json" => Ok(Self::LegacyJson),
            "grouped-json" => Ok(Self::GroupedJson),
            "grouped-csv" => Ok(Self::GroupedCsv),
            "grouped-xlsx" => Ok(Self::GroupedXlsx),
            "jlc-csv" => Ok(Self::JlcCsv),
            "jlc-xlsx" => Ok(Self::JlcXlsx),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for VendorJlcpcbBomOutput {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for VendorJlcpcbBomOutput {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for VendorJlcpcbBomOutput {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**The JLCPCB vendor configuration `prism-kicad vendor run jlcpcb --config`
reads (`jlcpcb.config.jsonc` with `schema` replaced).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.vendor.jlcpcb.config:a0",
///  "title": "VendorJlcpcbConfigA0",
///  "description": "The JLCPCB vendor configuration `prism-kicad vendor run jlcpcb --config`\nreads (`jlcpcb.config.jsonc` with `schema` replaced).",
///  "type": "object",
///  "required": [
///    "bom",
///    "pnp",
///    "schema",
///    "variants"
///  ],
///  "properties": {
///    "bom": {
///      "description": "BOM settings.",
///      "$ref": "#/$defs/VendorJlcpcbBom"
///    },
///    "pnp": {
///      "description": "Placement settings.",
///      "$ref": "#/$defs/VendorJlcpcbPnp"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.vendor.jlcpcb.config.a0"
///    },
///    "variants": {
///      "description": "Variant selection.",
///      "$ref": "#/$defs/VendorJlcpcbVariants"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct VendorJlcpcbConfigA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///Variant selection.
    pub variants: VendorJlcpcbVariants,
    ///BOM settings.
    pub bom: VendorJlcpcbBom,
    ///Placement settings.
    pub pnp: VendorJlcpcbPnp,
}
///Placement output settings (`pnp`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Placement output settings (`pnp`).",
///  "type": "object",
///  "required": [
///    "outputs",
///    "units"
///  ],
///  "properties": {
///    "outputs": {
///      "description": "The placement artifact kinds to emit, in file order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/VendorJlcpcbPnpOutput"
///      }
///    },
///    "units": {
///      "description": "The placement coordinate unit.",
///      "$ref": "#/$defs/VendorJlcpcbPnpUnits"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct VendorJlcpcbPnp {
    ///The placement artifact kinds to emit, in file order.
    pub outputs: ::std::vec::Vec<VendorJlcpcbPnpOutput>,
    ///The placement coordinate unit.
    pub units: VendorJlcpcbPnpUnits,
}
///One pick-and-place artifact kind the config lists.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One pick-and-place artifact kind the config lists.",
///  "type": "string",
///  "enum": [
///    "json",
///    "csv",
///    "xlsx",
///    "jlc-cpl",
///    "jlc-cpl-xlsx"
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
pub enum VendorJlcpcbPnpOutput {
    #[serde(rename = "json")]
    Json,
    #[serde(rename = "csv")]
    Csv,
    #[serde(rename = "xlsx")]
    Xlsx,
    #[serde(rename = "jlc-cpl")]
    JlcCpl,
    #[serde(rename = "jlc-cpl-xlsx")]
    JlcCplXlsx,
}
impl ::std::fmt::Display for VendorJlcpcbPnpOutput {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Json => f.write_str("json"),
            Self::Csv => f.write_str("csv"),
            Self::Xlsx => f.write_str("xlsx"),
            Self::JlcCpl => f.write_str("jlc-cpl"),
            Self::JlcCplXlsx => f.write_str("jlc-cpl-xlsx"),
        }
    }
}
impl ::std::str::FromStr for VendorJlcpcbPnpOutput {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "json" => Ok(Self::Json),
            "csv" => Ok(Self::Csv),
            "xlsx" => Ok(Self::Xlsx),
            "jlc-cpl" => Ok(Self::JlcCpl),
            "jlc-cpl-xlsx" => Ok(Self::JlcCplXlsx),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for VendorJlcpcbPnpOutput {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for VendorJlcpcbPnpOutput {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for VendorJlcpcbPnpOutput {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///The coordinate unit of the placement output. The JLCPCB CPL requires `mm`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The coordinate unit of the placement output. The JLCPCB CPL requires `mm`.",
///  "type": "string",
///  "enum": [
///    "mm",
///    "mils"
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
pub enum VendorJlcpcbPnpUnits {
    #[serde(rename = "mm")]
    Mm,
    #[serde(rename = "mils")]
    Mils,
}
impl ::std::fmt::Display for VendorJlcpcbPnpUnits {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Mm => f.write_str("mm"),
            Self::Mils => f.write_str("mils"),
        }
    }
}
impl ::std::str::FromStr for VendorJlcpcbPnpUnits {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "mm" => Ok(Self::Mm),
            "mils" => Ok(Self::Mils),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for VendorJlcpcbPnpUnits {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for VendorJlcpcbPnpUnits {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for VendorJlcpcbPnpUnits {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///How the vendor run selects variants.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How the vendor run selects variants.",
///  "type": "string",
///  "enum": [
///    "base",
///    "all",
///    "named"
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
pub enum VendorJlcpcbVariantMode {
    #[serde(rename = "base")]
    Base,
    #[serde(rename = "all")]
    All,
    #[serde(rename = "named")]
    Named,
}
impl ::std::fmt::Display for VendorJlcpcbVariantMode {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Base => f.write_str("base"),
            Self::All => f.write_str("all"),
            Self::Named => f.write_str("named"),
        }
    }
}
impl ::std::str::FromStr for VendorJlcpcbVariantMode {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "base" => Ok(Self::Base),
            "all" => Ok(Self::All),
            "named" => Ok(Self::Named),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for VendorJlcpcbVariantMode {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for VendorJlcpcbVariantMode {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for VendorJlcpcbVariantMode {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///Variant selection used when no `--variant` is given (`variants`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Variant selection used when no `--variant` is given (`variants`).",
///  "type": "object",
///  "required": [
///    "include_base",
///    "mode",
///    "names"
///  ],
///  "properties": {
///    "include_base": {
///      "description": "Include the no-variant base output when `mode` is `all` or `named`.",
///      "type": "boolean"
///    },
///    "mode": {
///      "description": "How variants are selected.",
///      "$ref": "#/$defs/VendorJlcpcbVariantMode"
///    },
///    "names": {
///      "description": "The variant names used when `mode` is `named`, in file order. Empty when\n`mode` is not `named`.",
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
pub struct VendorJlcpcbVariants {
    ///How variants are selected.
    pub mode: VendorJlcpcbVariantMode,
    /**The variant names used when `mode` is `named`, in file order. Empty when
    `mode` is not `named`.*/
    pub names: ::std::vec::Vec<::std::string::String>,
    ///Include the no-variant base output when `mode` is `all` or `named`.
    pub include_base: bool,
}
