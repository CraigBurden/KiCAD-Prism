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
/**A release version of three dot-separated decimal numbers without leading
zeros, for example `0.1.0` (SemVer), `2026.9.7` (the fork's CalVer) or
`10.0.6` (KiCad, as `kicad-cli version` prints it). Printable ASCII only,
which keeps the generator id's canonical form unambiguous (cli-spec.md §5.1).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A release version of three dot-separated decimal numbers without leading\nzeros, for example `0.1.0` (SemVer), `2026.9.7` (the fork's CalVer) or\n`10.0.6` (KiCad, as `kicad-cli version` prints it). Printable ASCII only,\nwhich keeps the generator id's canonical form unambiguous (cli-spec.md §5.1).",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct CliReleaseVersion(pub ::std::string::String);
impl ::std::ops::Deref for CliReleaseVersion {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<CliReleaseVersion> for ::std::string::String {
    fn from(value: CliReleaseVersion) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for CliReleaseVersion {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for CliReleaseVersion {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for CliReleaseVersion {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///One registered vendor and its outputs.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One registered vendor and its outputs.",
///  "type": "object",
///  "required": [
///    "config_schema",
///    "id",
///    "name",
///    "outputs"
///  ],
///  "properties": {
///    "config_schema": {
///      "description": "The schema id of the vendor's configuration, for example `prism.vendor.jlcpcb.config.a0`.",
///      "$ref": "#/$defs/SchemaId"
///    },
///    "id": {
///      "description": "The vendor's id, the `<vendor-id>` of `vendor run` (`jlcpcb`).",
///      "type": "string"
///    },
///    "name": {
///      "description": "The vendor's human name.",
///      "type": "string"
///    },
///    "outputs": {
///      "description": "The files the vendor writes, sorted by `kind`, then `format`, each in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliVendorOutput"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliVendor {
    ///The vendor's id, the `<vendor-id>` of `vendor run` (`jlcpcb`).
    pub id: ::std::string::String,
    ///The vendor's human name.
    pub name: ::std::string::String,
    ///The files the vendor writes, sorted by `kind`, then `format`, each in code point order.
    pub outputs: ::std::vec::Vec<CliVendorOutput>,
    ///The schema id of the vendor's configuration, for example `prism.vendor.jlcpcb.config.a0`.
    pub config_schema: SchemaId,
}
///stdout of `vendor list` (exit 0).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.vendor_list:a0",
///  "title": "CliVendorListA0",
///  "description": "stdout of `vendor list` (exit 0).",
///  "type": "object",
///  "required": [
///    "schema",
///    "vendors"
///  ],
///  "properties": {
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.vendor_list.a0"
///    },
///    "vendors": {
///      "description": "Every registered vendor, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliVendor"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliVendorListA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///Every registered vendor, sorted by `id` in code point order.
    pub vendors: ::std::vec::Vec<CliVendor>,
}
///One file a vendor writes: its kind, format and format version.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One file a vendor writes: its kind, format and format version.",
///  "type": "object",
///  "required": [
///    "format",
///    "kind",
///    "version"
///  ],
///  "properties": {
///    "format": {
///      "description": "The file's format.",
///      "$ref": "#/$defs/CliVendorOutputFormat"
///    },
///    "kind": {
///      "description": "What the file holds.",
///      "$ref": "#/$defs/CliVendorOutputKind"
///    },
///    "version": {
///      "description": "The format's version, raised when the file's layout changes (cli-spec.md §5.8).",
///      "$ref": "#/$defs/CliReleaseVersion"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliVendorOutput {
    ///What the file holds.
    pub kind: CliVendorOutputKind,
    ///The file's format.
    pub format: CliVendorOutputFormat,
    ///The format's version, raised when the file's layout changes (cli-spec.md §5.8).
    pub version: CliReleaseVersion,
}
///The file format of a vendor output.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The file format of a vendor output.",
///  "type": "string",
///  "enum": [
///    "csv",
///    "xlsx"
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
pub enum CliVendorOutputFormat {
    #[serde(rename = "csv")]
    Csv,
    #[serde(rename = "xlsx")]
    Xlsx,
}
impl ::std::fmt::Display for CliVendorOutputFormat {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Csv => f.write_str("csv"),
            Self::Xlsx => f.write_str("xlsx"),
        }
    }
}
impl ::std::str::FromStr for CliVendorOutputFormat {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "csv" => Ok(Self::Csv),
            "xlsx" => Ok(Self::Xlsx),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliVendorOutputFormat {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliVendorOutputFormat {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliVendorOutputFormat {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///What a vendor output file holds.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What a vendor output file holds.",
///  "type": "string",
///  "enum": [
///    "bom",
///    "cpl"
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
pub enum CliVendorOutputKind {
    #[serde(rename = "bom")]
    Bom,
    #[serde(rename = "cpl")]
    Cpl,
}
impl ::std::fmt::Display for CliVendorOutputKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Bom => f.write_str("bom"),
            Self::Cpl => f.write_str("cpl"),
        }
    }
}
impl ::std::str::FromStr for CliVendorOutputKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "bom" => Ok(Self::Bom),
            "cpl" => Ok(Self::Cpl),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliVendorOutputKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliVendorOutputKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliVendorOutputKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**Id of a JSON document schema, `<family>.<name>.<version>`: for example
`prism.stackup.a0`, `prism.bundle.manifest.a2`, `prism.system_interface.v1`
or `kicad_monkey.design.a0`. Lowercase, dot-separated, ending in the
version (`a<N>` while pre-stable, `v<N>` once stable).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Id of a JSON document schema, `<family>.<name>.<version>`: for example\n`prism.stackup.a0`, `prism.bundle.manifest.a2`, `prism.system_interface.v1`\nor `kicad_monkey.design.a0`. Lowercase, dot-separated, ending in the\nversion (`a<N>` while pre-stable, `v<N>` once stable).",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct SchemaId(pub ::std::string::String);
impl ::std::ops::Deref for SchemaId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SchemaId> for ::std::string::String {
    fn from(value: SchemaId) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for SchemaId {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for SchemaId {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for SchemaId {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
