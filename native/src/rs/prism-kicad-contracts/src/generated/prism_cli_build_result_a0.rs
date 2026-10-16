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
///A size in bytes: a non-negative safe integer.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A size in bytes: a non-negative safe integer.",
///  "type": "integer",
///  "minimum": 0.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct ByteCount(pub u64);
impl ::std::ops::Deref for ByteCount {
    type Target = u64;
    fn deref(&self) -> &u64 {
        &self.0
    }
}
impl ::std::convert::From<ByteCount> for u64 {
    fn from(value: ByteCount) -> Self {
        value.0
    }
}
impl ::std::convert::From<u64> for ByteCount {
    fn from(value: u64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for ByteCount {
    type Err = <u64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for ByteCount {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for ByteCount {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for ByteCount {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**stdout of `bundle build` when it wrote `-o`: exit 0 when the stage ended
`complete`, exit 9 when it ended `failed` or `partial`. In both cases the
outcome is recorded in the written bundle.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.build_result:a0",
///  "title": "CliBuildResultA0",
///  "description": "stdout of `bundle build` when it wrote `-o`: exit 0 when the stage ended\n`complete`, exit 9 when it ended `failed` or `partial`. In both cases the\noutcome is recorded in the written bundle.",
///  "type": "object",
///  "required": [
///    "archive_bytes",
///    "archive_sha256",
///    "schema",
///    "stage",
///    "stages",
///    "warnings",
///    "written_members"
///  ],
///  "properties": {
///    "archive_bytes": {
///      "description": "Size of the written archive file in bytes.",
///      "$ref": "#/$defs/ByteCount"
///    },
///    "archive_sha256": {
///      "description": "SHA-256 of the written archive file.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.build_result.a0"
///    },
///    "stage": {
///      "description": "The stage this invocation ran.",
///      "$ref": "#/$defs/CliBuildStage"
///    },
///    "stages": {
///      "description": "Every stage's state in the written bundle, exactly as its manifest\nrecords it, in stage order: `parse`, `board`, `models`.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliStageState"
///      },
///      "maxItems": 3,
///      "minItems": 3
///    },
///    "warnings": {
///      "description": "The warnings this stage added to the manifest, in the order the manifest lists them.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/Warning"
///      }
///    },
///    "written_members": {
///      "description": "The members whose bytes this invocation wrote, sorted by `path` in code\npoint order: every member for stage `parse`; `bundle.json` and the\nstage's own members for a later stage. Members copied unchanged from\n`--in` are not listed.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliMemberDigest"
///      },
///      "minItems": 1
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliBuildResultA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///The stage this invocation ran.
    pub stage: CliBuildStage,
    /**Every stage's state in the written bundle, exactly as its manifest
    records it, in stage order: `parse`, `board`, `models`.*/
    pub stages: [CliStageState; 3usize],
    ///Size of the written archive file in bytes.
    pub archive_bytes: ByteCount,
    ///SHA-256 of the written archive file.
    pub archive_sha256: Sha256Hex,
    /**The members whose bytes this invocation wrote, sorted by `path` in code
    point order: every member for stage `parse`; `bundle.json` and the
    stage's own members for a later stage. Members copied unchanged from
    `--in` are not listed.*/
    pub written_members: ::std::vec::Vec<CliMemberDigest>,
    ///The warnings this stage added to the manifest, in the order the manifest lists them.
    pub warnings: ::std::vec::Vec<Warning>,
}
/**A stage of `bundle build`, in the order the stages run (ADR §4.4). The
same three stages are recorded in the bundle manifest.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A stage of `bundle build`, in the order the stages run (ADR §4.4). The\nsame three stages are recorded in the bundle manifest.",
///  "type": "string",
///  "enum": [
///    "parse",
///    "board",
///    "models"
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
pub enum CliBuildStage {
    #[serde(rename = "parse")]
    Parse,
    #[serde(rename = "board")]
    Board,
    #[serde(rename = "models")]
    Models,
}
impl ::std::fmt::Display for CliBuildStage {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Parse => f.write_str("parse"),
            Self::Board => f.write_str("board"),
            Self::Models => f.write_str("models"),
        }
    }
}
impl ::std::str::FromStr for CliBuildStage {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "parse" => Ok(Self::Parse),
            "board" => Ok(Self::Board),
            "models" => Ok(Self::Models),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliBuildStage {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliBuildStage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliBuildStage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A finding with a stable code, a message for people and an optional location.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A finding with a stable code, a message for people and an optional location.",
///  "type": "object",
///  "required": [
///    "code",
///    "message"
///  ],
///  "properties": {
///    "code": {
///      "description": "Stable code (cli-spec.md §8) that tools and tests match on.",
///      "$ref": "#/$defs/DiagnosticCode"
///    },
///    "location": {
///      "description": "Where the finding is, when known.",
///      "$ref": "#/$defs/CliLocation"
///    },
///    "message": {
///      "description": "One-sentence explanation for people. It never contains a host path; its wording may change between versions.",
///      "type": "string",
///      "minLength": 1
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliFinding {
    ///Stable code (cli-spec.md §8) that tools and tests match on.
    pub code: DiagnosticCode,
    ///One-sentence explanation for people. It never contains a host path; its wording may change between versions.
    pub message: CliFindingMessage,
    ///Where the finding is, when known.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub location: ::std::option::Option<CliLocation>,
}
///One-sentence explanation for people. It never contains a host path; its wording may change between versions.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One-sentence explanation for people. It never contains a host path; its wording may change between versions.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct CliFindingMessage(::std::string::String);
impl ::std::ops::Deref for CliFindingMessage {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<CliFindingMessage> for ::std::string::String {
    fn from(value: CliFindingMessage) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for CliFindingMessage {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for CliFindingMessage {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliFindingMessage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliFindingMessage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for CliFindingMessage {
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
/**A JSON Pointer (RFC 6901) into a JSON file: empty for the whole document,
otherwise `/`-separated reference tokens with `~0` for `~` and `~1` for `/`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A JSON Pointer (RFC 6901) into a JSON file: empty for the whole document,\notherwise `/`-separated reference tokens with `~0` for `~` and `~1` for `/`.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct CliJsonPointer(pub ::std::string::String);
impl ::std::ops::Deref for CliJsonPointer {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<CliJsonPointer> for ::std::string::String {
    fn from(value: CliJsonPointer) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for CliJsonPointer {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for CliJsonPointer {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for CliJsonPointer {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**Where a finding is. Every field is optional; a field is present only when
it is known. The field names are single words so the model can move to
common.tsp unchanged and serve camelCase documents too.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where a finding is. Every field is optional; a field is present only when\nit is known. The field names are single words so the model can move to\ncommon.tsp unchanged and serve camelCase documents too.",
///  "type": "object",
///  "properties": {
///    "column": {
///      "description": "One-based column, counted in Unicode scalar values, on `line`.",
///      "$ref": "#/$defs/CliOneBased"
///    },
///    "line": {
///      "description": "One-based line of the finding in a text file.",
///      "$ref": "#/$defs/CliOneBased"
///    },
///    "offset": {
///      "description": "Zero-based byte offset of the finding from the start of the file.",
///      "$ref": "#/$defs/ByteCount"
///    },
///    "path": {
///      "description": "The file, named by the path it has as a bundle member, whether or not a\nbundle has been written yet: `sources/<RepoPath>` for a source file,\n`refilled/<board file name>` for the `--refilled-board` input (refill mode only),\n`viewer/models/components.glb` for the `--models-glb` input,\nthe member path itself for a member of an existing bundle. Absent when the finding\nis about an argument file that is not a member (`--config`) or about no\nfile at all.",
///      "$ref": "#/$defs/ArchivePath"
///    },
///    "pointer": {
///      "description": "JSON Pointer to the value in a JSON file (a `.kicad_pro`, `--config`, or a JSON member).",
///      "$ref": "#/$defs/CliJsonPointer"
///    },
///    "uuid": {
///      "description": "UUID of the KiCad object the finding is about, as written in the file.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliLocation {
    /**The file, named by the path it has as a bundle member, whether or not a
    bundle has been written yet: `sources/<RepoPath>` for a source file,
    `refilled/<board file name>` for the `--refilled-board` input (refill mode only),
    `viewer/models/components.glb` for the `--models-glb` input,
    the member path itself for a member of an existing bundle. Absent when the finding
    is about an argument file that is not a member (`--config`) or about no
    file at all.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub path: ::std::option::Option<ArchivePath>,
    ///One-based line of the finding in a text file.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub line: ::std::option::Option<CliOneBased>,
    ///One-based column, counted in Unicode scalar values, on `line`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub column: ::std::option::Option<CliOneBased>,
    ///Zero-based byte offset of the finding from the start of the file.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub offset: ::std::option::Option<ByteCount>,
    ///JSON Pointer to the value in a JSON file (a `.kicad_pro`, `--config`, or a JSON member).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub pointer: ::std::option::Option<CliJsonPointer>,
    ///UUID of the KiCad object the finding is about, as written in the file.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub uuid: ::std::option::Option<KiCadUuid>,
}
impl ::std::default::Default for CliLocation {
    fn default() -> Self {
        Self {
            column: Default::default(),
            line: Default::default(),
            offset: Default::default(),
            path: Default::default(),
            pointer: Default::default(),
            uuid: Default::default(),
        }
    }
}
///One archive member and its digest.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One archive member and its digest.",
///  "type": "object",
///  "required": [
///    "bytes",
///    "path",
///    "sha256"
///  ],
///  "properties": {
///    "bytes": {
///      "description": "Its uncompressed size in bytes.",
///      "$ref": "#/$defs/ByteCount"
///    },
///    "path": {
///      "description": "The member's archive path.",
///      "$ref": "#/$defs/ArchivePath"
///    },
///    "sha256": {
///      "description": "SHA-256 of its uncompressed bytes.",
///      "$ref": "#/$defs/Sha256Hex"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliMemberDigest {
    ///The member's archive path.
    pub path: ArchivePath,
    ///Its uncompressed size in bytes.
    pub bytes: ByteCount,
    ///SHA-256 of its uncompressed bytes.
    pub sha256: Sha256Hex,
}
///A member a stage could not write, and why.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A member a stage could not write, and why.",
///  "type": "object",
///  "required": [
///    "code",
///    "message",
///    "path"
///  ],
///  "properties": {
///    "code": {
///      "description": "Stable code (cli-spec.md §8), for example `projection-failed`.",
///      "$ref": "#/$defs/DiagnosticCode"
///    },
///    "message": {
///      "description": "One-sentence explanation for people. It never contains a host path.",
///      "type": "string",
///      "minLength": 1
///    },
///    "path": {
///      "description": "The member's archive path, for example `projections/system-interface.json`.",
///      "$ref": "#/$defs/ArchivePath"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliMemberFailure {
    ///The member's archive path, for example `projections/system-interface.json`.
    pub path: ArchivePath,
    ///Stable code (cli-spec.md §8), for example `projection-failed`.
    pub code: DiagnosticCode,
    ///One-sentence explanation for people. It never contains a host path.
    pub message: CliMemberFailureMessage,
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
pub struct CliMemberFailureMessage(::std::string::String);
impl ::std::ops::Deref for CliMemberFailureMessage {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<CliMemberFailureMessage> for ::std::string::String {
    fn from(value: CliMemberFailureMessage) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for CliMemberFailureMessage {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for CliMemberFailureMessage {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliMemberFailureMessage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliMemberFailureMessage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for CliMemberFailureMessage {
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
///A one-based line or column number.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A one-based line or column number.",
///  "type": "integer",
///  "minimum": 1.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct CliOneBased(pub ::std::num::NonZeroU64);
impl ::std::ops::Deref for CliOneBased {
    type Target = ::std::num::NonZeroU64;
    fn deref(&self) -> &::std::num::NonZeroU64 {
        &self.0
    }
}
impl ::std::convert::From<CliOneBased> for ::std::num::NonZeroU64 {
    fn from(value: CliOneBased) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::num::NonZeroU64> for CliOneBased {
    fn from(value: ::std::num::NonZeroU64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for CliOneBased {
    type Err = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for CliOneBased {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for CliOneBased {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for CliOneBased {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///Why a stage is skipped.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Why a stage is skipped.",
///  "type": "string",
///  "enum": [
///    "no-board",
///    "earlier-stage-failed"
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
pub enum CliSkipReason {
    #[serde(rename = "no-board")]
    NoBoard,
    #[serde(rename = "earlier-stage-failed")]
    EarlierStageFailed,
}
impl ::std::fmt::Display for CliSkipReason {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::NoBoard => f.write_str("no-board"),
            Self::EarlierStageFailed => f.write_str("earlier-stage-failed"),
        }
    }
}
impl ::std::str::FromStr for CliSkipReason {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "no-board" => Ok(Self::NoBoard),
            "earlier-stage-failed" => Ok(Self::EarlierStageFailed),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliSkipReason {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliSkipReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliSkipReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**The state of one build stage: the status, error, skip reason and failed
members of the stage's record in the bundle manifest, copied verbatim. The
manifest's other per-stage fields (warnings, fill check, cross-check) are
not repeated.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The state of one build stage: the status, error, skip reason and failed\nmembers of the stage's record in the bundle manifest, copied verbatim. The\nmanifest's other per-stage fields (warnings, fill check, cross-check) are\nnot repeated.",
///  "type": "object",
///  "required": [
///    "failed_members",
///    "stage",
///    "status"
///  ],
///  "properties": {
///    "error": {
///      "description": "The content error that failed the stage. Present exactly when `status` is `failed`.",
///      "$ref": "#/$defs/CliFinding"
///    },
///    "failed_members": {
///      "description": "The members the stage could not write, sorted by `path` in code point order. Non-empty exactly when `status` is `partial`.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliMemberFailure"
///      }
///    },
///    "skip_reason": {
///      "description": "Why the stage will never run. Present exactly when `status` is `skipped`.",
///      "$ref": "#/$defs/CliSkipReason"
///    },
///    "stage": {
///      "description": "The stage.",
///      "$ref": "#/$defs/CliBuildStage"
///    },
///    "status": {
///      "description": "Its state.",
///      "$ref": "#/$defs/CliStageStatus"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliStageState {
    ///The stage.
    pub stage: CliBuildStage,
    ///Its state.
    pub status: CliStageStatus,
    ///The content error that failed the stage. Present exactly when `status` is `failed`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub error: ::std::option::Option<CliFinding>,
    ///Why the stage will never run. Present exactly when `status` is `skipped`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub skip_reason: ::std::option::Option<CliSkipReason>,
    ///The members the stage could not write, sorted by `path` in code point order. Non-empty exactly when `status` is `partial`.
    pub failed_members: ::std::vec::Vec<CliMemberFailure>,
}
///The state of one stage in a bundle.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The state of one stage in a bundle.",
///  "type": "string",
///  "enum": [
///    "pending",
///    "complete",
///    "partial",
///    "failed",
///    "skipped"
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
pub enum CliStageStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "complete")]
    Complete,
    #[serde(rename = "partial")]
    Partial,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "skipped")]
    Skipped,
}
impl ::std::fmt::Display for CliStageStatus {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Pending => f.write_str("pending"),
            Self::Complete => f.write_str("complete"),
            Self::Partial => f.write_str("partial"),
            Self::Failed => f.write_str("failed"),
            Self::Skipped => f.write_str("skipped"),
        }
    }
}
impl ::std::str::FromStr for CliStageStatus {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "pending" => Ok(Self::Pending),
            "complete" => Ok(Self::Complete),
            "partial" => Ok(Self::Partial),
            "failed" => Ok(Self::Failed),
            "skipped" => Ok(Self::Skipped),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliStageStatus {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliStageStatus {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliStageStatus {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
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
/**A finding with a stable code and a human-readable message. Whether it is a
warning or an error is given by the array that holds it. Field names are
the same in snake_case and camelCase documents.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A finding with a stable code and a human-readable message. Whether it is a\nwarning or an error is given by the array that holds it. Field names are\nthe same in snake_case and camelCase documents.",
///  "type": "object",
///  "required": [
///    "code",
///    "message"
///  ],
///  "properties": {
///    "code": {
///      "description": "Stable code that tools and tests match on.",
///      "$ref": "#/$defs/DiagnosticCode"
///    },
///    "message": {
///      "description": "One-sentence explanation for people; its wording may change between versions.",
///      "type": "string",
///      "minLength": 1
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Warning {
    ///Stable code that tools and tests match on.
    pub code: DiagnosticCode,
    ///One-sentence explanation for people; its wording may change between versions.
    pub message: WarningMessage,
}
///One-sentence explanation for people; its wording may change between versions.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One-sentence explanation for people; its wording may change between versions.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct WarningMessage(::std::string::String);
impl ::std::ops::Deref for WarningMessage {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<WarningMessage> for ::std::string::String {
    fn from(value: WarningMessage) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for WarningMessage {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for WarningMessage {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for WarningMessage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for WarningMessage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for WarningMessage {
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
