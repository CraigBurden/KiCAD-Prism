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
/**Path of a member inside a `.prism` bundle archive: `/`-separated, relative,
no empty, `.` or `..` segment, no leading or trailing `/`, no backslash and
no `:`. The same rule as manifest a1's ArchivePath and prism-bundle's
`check_member_name`, without lookaround.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Path of a member inside a `.prism` bundle archive: `/`-separated, relative,\nno empty, `.` or `..` segment, no leading or trailing `/`, no backslash and\nno `:`. The same rule as manifest a1's ArchivePath and prism-bundle's\n`check_member_name`, without lookaround.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct ArchivePath(pub ::std::string::String);
impl ::std::ops::Deref for ArchivePath {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ArchivePath> for ::std::string::String {
    fn from(value: ArchivePath) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for ArchivePath {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for ArchivePath {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for ArchivePath {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///One component a vendor run left out of an output, and why.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One component a vendor run left out of an output, and why.",
///  "type": "object",
///  "required": [
///    "code",
///    "key",
///    "message"
///  ],
///  "properties": {
///    "code": {
///      "description": "Stable reason code, for example `excluded-from-bom` or `excluded-from-position`.",
///      "$ref": "#/$defs/DiagnosticCode"
///    },
///    "key": {
///      "description": "The component's identity, `<RepoPath>#<KiCadUuid>`.",
///      "$ref": "#/$defs/ObjectRef"
///    },
///    "message": {
///      "description": "One-sentence explanation for people. It never contains a host path.",
///      "type": "string",
///      "minLength": 1
///    },
///    "reference": {
///      "description": "Its reference designator, as written. Absent when it has none or it is empty.",
///      "$ref": "#/$defs/Refdes"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliVendorExcludedComponent {
    ///The component's identity, `<RepoPath>#<KiCadUuid>`.
    pub key: ObjectRef,
    ///Its reference designator, as written. Absent when it has none or it is empty.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub reference: ::std::option::Option<Refdes>,
    ///Stable reason code, for example `excluded-from-bom` or `excluded-from-position`.
    pub code: DiagnosticCode,
    ///One-sentence explanation for people. It never contains a host path.
    pub message: CliVendorExcludedComponentMessage,
}
///One-sentence explanation for people. It never contains a host path.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One-sentence explanation for people. It never contains a host path.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct CliVendorExcludedComponentMessage(::std::string::String);
impl ::std::ops::Deref for CliVendorExcludedComponentMessage {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<CliVendorExcludedComponentMessage> for ::std::string::String {
    fn from(value: CliVendorExcludedComponentMessage) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for CliVendorExcludedComponentMessage {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for CliVendorExcludedComponentMessage {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliVendorExcludedComponentMessage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliVendorExcludedComponentMessage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for CliVendorExcludedComponentMessage {
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
///One file a vendor run wrote.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One file a vendor run wrote.",
///  "type": "object",
///  "required": [
///    "path",
///    "sha256"
///  ],
///  "properties": {
///    "path": {
///      "description": "The file's path relative to the output directory.",
///      "$ref": "#/$defs/ArchivePath"
///    },
///    "sha256": {
///      "description": "SHA-256 of the file's bytes.",
///      "$ref": "#/$defs/Sha256Hex"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliVendorFile {
    ///The file's path relative to the output directory.
    pub path: ArchivePath,
    ///SHA-256 of the file's bytes.
    pub sha256: Sha256Hex,
}
///stdout of `vendor run` (exit 0).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.vendor_run_result:a0",
///  "title": "CliVendorRunResultA0",
///  "description": "stdout of `vendor run` (exit 0).",
///  "type": "object",
///  "required": [
///    "excluded",
///    "files",
///    "rows",
///    "schema",
///    "vendor"
///  ],
///  "properties": {
///    "excluded": {
///      "description": "Every component the run left out, sorted by `key` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliVendorExcludedComponent"
///      }
///    },
///    "files": {
///      "description": "Every file the run wrote, sorted by `path` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliVendorFile"
///      }
///    },
///    "rows": {
///      "description": "How many rows each of the vendor's tables holds; the keys are the vendor's\ntable names, for example `bom` and `cpl`, serialized in code point order.",
///      "$ref": "#/$defs/RecordCount"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.vendor_run_result.a0"
///    },
///    "vendor": {
///      "description": "The vendor that ran, its id (`jlcpcb`).",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliVendorRunResultA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///The vendor that ran, its id (`jlcpcb`).
    pub vendor: ::std::string::String,
    ///Every file the run wrote, sorted by `path` in code point order.
    pub files: ::std::vec::Vec<CliVendorFile>,
    /**How many rows each of the vendor's tables holds; the keys are the vendor's
    table names, for example `bom` and `cpl`, serialized in code point order.*/
    pub rows: RecordCount,
    ///Every component the run left out, sorted by `key` in code point order.
    pub excluded: ::std::vec::Vec<CliVendorExcludedComponent>,
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
/**Stable machine-readable code of a finding, in lowercase kebab-case, for
example `stale-saved-fills` or `net-mismatch`. A code never changes meaning
once published; a new meaning gets a new code.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Stable machine-readable code of a finding, in lowercase kebab-case, for\nexample `stale-saved-fills` or `net-mismatch`. A code never changes meaning\nonce published; a new meaning gets a new code.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct DiagnosticCode(pub ::std::string::String);
impl ::std::ops::Deref for DiagnosticCode {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<DiagnosticCode> for ::std::string::String {
    fn from(value: DiagnosticCode) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for DiagnosticCode {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for DiagnosticCode {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for DiagnosticCode {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**Reference to one object in one KiCad document: `<documentPath>#<uuid>`,
where `documentPath` is the RepoPath of the `.kicad_sch` or `.kicad_pcb`
and `uuid` the object's KiCadUuid. Split at the last `#`. Unique across
every project in the repository, including projects that share a
directory.
A reused sheet file holds one object for all its instances, so an
ObjectRef names the object in the file, not an occurrence; occurrences
are named by KiidPath.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Reference to one object in one KiCad document: `<documentPath>#<uuid>`,\nwhere `documentPath` is the RepoPath of the `.kicad_sch` or `.kicad_pcb`\nand `uuid` the object's KiCadUuid. Split at the last `#`. Unique across\nevery project in the repository, including projects that share a\ndirectory.\nA reused sheet file holds one object for all its instances, so an\nObjectRef names the object in the file, not an occurrence; occurrences\nare named by KiidPath.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct ObjectRef(pub ::std::string::String);
impl ::std::ops::Deref for ObjectRef {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ObjectRef> for ::std::string::String {
    fn from(value: ObjectRef) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for ObjectRef {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for ObjectRef {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for ObjectRef {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
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
