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
/**A command-line argument a diagnostic or error is about, named as the usage
text names it: an option by its long name without the leading `--`, a
positional argument by its placeholder. Used instead of echoing the
argument's value, which may be a host path.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A command-line argument a diagnostic or error is about, named as the usage\ntext names it: an option by its long name without the leading `--`, a\npositional argument by its placeholder. Used instead of echoing the\nargument's value, which may be a host path.",
///  "type": "string",
///  "enum": [
///    "command",
///    "project-file",
///    "bundle",
///    "member",
///    "repo",
///    "output",
///    "in",
///    "stage",
///    "source-root",
///    "refilled-board",
///    "refill-tool",
///    "models-glb",
///    "models-tool",
///    "revision-key",
///    "key-record",
///    "upgraded",
///    "config",
///    "commit",
///    "worktree",
///    "project",
///    "limit",
///    "threads",
///    "quiet",
///    "base",
///    "head",
///    "base-src",
///    "head-src",
///    "base-source-root",
///    "head-source-root",
///    "base-config",
///    "head-config",
///    "base-revision-key",
///    "head-revision-key",
///    "base-upgraded",
///    "head-upgraded",
///    "include-unchanged",
///    "view",
///    "variant",
///    "paper-scale",
///    "vendor",
///    "request",
///    "metrics",
///    "geometer",
///    "model-dir",
///    "hlr-cache"
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
pub enum CliArgument {
    #[serde(rename = "command")]
    Command,
    #[serde(rename = "project-file")]
    ProjectFile,
    #[serde(rename = "bundle")]
    Bundle,
    #[serde(rename = "member")]
    Member,
    #[serde(rename = "repo")]
    Repo,
    #[serde(rename = "output")]
    Output,
    #[serde(rename = "in")]
    In,
    #[serde(rename = "stage")]
    Stage,
    #[serde(rename = "source-root")]
    SourceRoot,
    #[serde(rename = "refilled-board")]
    RefilledBoard,
    #[serde(rename = "refill-tool")]
    RefillTool,
    #[serde(rename = "models-glb")]
    ModelsGlb,
    #[serde(rename = "models-tool")]
    ModelsTool,
    #[serde(rename = "revision-key")]
    RevisionKey,
    #[serde(rename = "key-record")]
    KeyRecord,
    #[serde(rename = "upgraded")]
    Upgraded,
    #[serde(rename = "config")]
    Config,
    #[serde(rename = "commit")]
    Commit,
    #[serde(rename = "worktree")]
    Worktree,
    #[serde(rename = "project")]
    Project,
    #[serde(rename = "limit")]
    Limit,
    #[serde(rename = "threads")]
    Threads,
    #[serde(rename = "quiet")]
    Quiet,
    #[serde(rename = "base")]
    Base,
    #[serde(rename = "head")]
    Head,
    #[serde(rename = "base-src")]
    BaseSrc,
    #[serde(rename = "head-src")]
    HeadSrc,
    #[serde(rename = "base-source-root")]
    BaseSourceRoot,
    #[serde(rename = "head-source-root")]
    HeadSourceRoot,
    #[serde(rename = "base-config")]
    BaseConfig,
    #[serde(rename = "head-config")]
    HeadConfig,
    #[serde(rename = "base-revision-key")]
    BaseRevisionKey,
    #[serde(rename = "head-revision-key")]
    HeadRevisionKey,
    #[serde(rename = "base-upgraded")]
    BaseUpgraded,
    #[serde(rename = "head-upgraded")]
    HeadUpgraded,
    #[serde(rename = "include-unchanged")]
    IncludeUnchanged,
    #[serde(rename = "view")]
    View,
    #[serde(rename = "variant")]
    Variant,
    #[serde(rename = "paper-scale")]
    PaperScale,
    #[serde(rename = "vendor")]
    Vendor,
    #[serde(rename = "request")]
    Request,
    #[serde(rename = "metrics")]
    Metrics,
    #[serde(rename = "geometer")]
    Geometer,
    #[serde(rename = "model-dir")]
    ModelDir,
    #[serde(rename = "hlr-cache")]
    HlrCache,
}
impl ::std::fmt::Display for CliArgument {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Command => f.write_str("command"),
            Self::ProjectFile => f.write_str("project-file"),
            Self::Bundle => f.write_str("bundle"),
            Self::Member => f.write_str("member"),
            Self::Repo => f.write_str("repo"),
            Self::Output => f.write_str("output"),
            Self::In => f.write_str("in"),
            Self::Stage => f.write_str("stage"),
            Self::SourceRoot => f.write_str("source-root"),
            Self::RefilledBoard => f.write_str("refilled-board"),
            Self::RefillTool => f.write_str("refill-tool"),
            Self::ModelsGlb => f.write_str("models-glb"),
            Self::ModelsTool => f.write_str("models-tool"),
            Self::RevisionKey => f.write_str("revision-key"),
            Self::KeyRecord => f.write_str("key-record"),
            Self::Upgraded => f.write_str("upgraded"),
            Self::Config => f.write_str("config"),
            Self::Commit => f.write_str("commit"),
            Self::Worktree => f.write_str("worktree"),
            Self::Project => f.write_str("project"),
            Self::Limit => f.write_str("limit"),
            Self::Threads => f.write_str("threads"),
            Self::Quiet => f.write_str("quiet"),
            Self::Base => f.write_str("base"),
            Self::Head => f.write_str("head"),
            Self::BaseSrc => f.write_str("base-src"),
            Self::HeadSrc => f.write_str("head-src"),
            Self::BaseSourceRoot => f.write_str("base-source-root"),
            Self::HeadSourceRoot => f.write_str("head-source-root"),
            Self::BaseConfig => f.write_str("base-config"),
            Self::HeadConfig => f.write_str("head-config"),
            Self::BaseRevisionKey => f.write_str("base-revision-key"),
            Self::HeadRevisionKey => f.write_str("head-revision-key"),
            Self::BaseUpgraded => f.write_str("base-upgraded"),
            Self::HeadUpgraded => f.write_str("head-upgraded"),
            Self::IncludeUnchanged => f.write_str("include-unchanged"),
            Self::View => f.write_str("view"),
            Self::Variant => f.write_str("variant"),
            Self::PaperScale => f.write_str("paper-scale"),
            Self::Vendor => f.write_str("vendor"),
            Self::Request => f.write_str("request"),
            Self::Metrics => f.write_str("metrics"),
            Self::Geometer => f.write_str("geometer"),
            Self::ModelDir => f.write_str("model-dir"),
            Self::HlrCache => f.write_str("hlr-cache"),
        }
    }
}
impl ::std::str::FromStr for CliArgument {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "command" => Ok(Self::Command),
            "project-file" => Ok(Self::ProjectFile),
            "bundle" => Ok(Self::Bundle),
            "member" => Ok(Self::Member),
            "repo" => Ok(Self::Repo),
            "output" => Ok(Self::Output),
            "in" => Ok(Self::In),
            "stage" => Ok(Self::Stage),
            "source-root" => Ok(Self::SourceRoot),
            "refilled-board" => Ok(Self::RefilledBoard),
            "refill-tool" => Ok(Self::RefillTool),
            "models-glb" => Ok(Self::ModelsGlb),
            "models-tool" => Ok(Self::ModelsTool),
            "revision-key" => Ok(Self::RevisionKey),
            "key-record" => Ok(Self::KeyRecord),
            "upgraded" => Ok(Self::Upgraded),
            "config" => Ok(Self::Config),
            "commit" => Ok(Self::Commit),
            "worktree" => Ok(Self::Worktree),
            "project" => Ok(Self::Project),
            "limit" => Ok(Self::Limit),
            "threads" => Ok(Self::Threads),
            "quiet" => Ok(Self::Quiet),
            "base" => Ok(Self::Base),
            "head" => Ok(Self::Head),
            "base-src" => Ok(Self::BaseSrc),
            "head-src" => Ok(Self::HeadSrc),
            "base-source-root" => Ok(Self::BaseSourceRoot),
            "head-source-root" => Ok(Self::HeadSourceRoot),
            "base-config" => Ok(Self::BaseConfig),
            "head-config" => Ok(Self::HeadConfig),
            "base-revision-key" => Ok(Self::BaseRevisionKey),
            "head-revision-key" => Ok(Self::HeadRevisionKey),
            "base-upgraded" => Ok(Self::BaseUpgraded),
            "head-upgraded" => Ok(Self::HeadUpgraded),
            "include-unchanged" => Ok(Self::IncludeUnchanged),
            "view" => Ok(Self::View),
            "variant" => Ok(Self::Variant),
            "paper-scale" => Ok(Self::PaperScale),
            "vendor" => Ok(Self::Vendor),
            "request" => Ok(Self::Request),
            "metrics" => Ok(Self::Metrics),
            "geometer" => Ok(Self::Geometer),
            "model-dir" => Ok(Self::ModelDir),
            "hlr-cache" => Ok(Self::HlrCache),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliArgument {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliArgument {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliArgument {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
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
///A size limit that was hit: a limit whose name ends in `-bytes`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A size limit that was hit: a limit whose name ends in `-bytes`.",
///  "type": "object",
///  "required": [
///    "kind",
///    "limit_bytes",
///    "name"
///  ],
///  "properties": {
///    "kind": {
///      "description": "Variant tag: the limit is a size in bytes.",
///      "type": "string",
///      "const": "bytes"
///    },
///    "limit_bytes": {
///      "description": "The limit's value for this invocation, its default or the `--limit` override.",
///      "$ref": "#/$defs/ByteCount"
///    },
///    "name": {
///      "description": "Which limit.",
///      "$ref": "#/$defs/CliLimitName"
///    },
///    "observed_bytes": {
///      "description": "The size that exceeded it, when the input's size was known before reading it (a file or a declared member size). Absent when the work stopped at the limit without knowing the total, and always for `max-memory-bytes`.",
///      "$ref": "#/$defs/ByteCount"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliByteLimitHit {
    ///Variant tag: the limit is a size in bytes.
    pub kind: ::std::string::String,
    ///Which limit.
    pub name: CliLimitName,
    ///The limit's value for this invocation, its default or the `--limit` override.
    pub limit_bytes: ByteCount,
    ///The size that exceeded it, when the input's size was known before reading it (a file or a declared member size). Absent when the work stopped at the limit without knowing the total, and always for `max-memory-bytes`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub observed_bytes: ::std::option::Option<ByteCount>,
}
///A count limit that was hit: a limit whose name ends neither in `-bytes` nor in `-ms`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A count limit that was hit: a limit whose name ends neither in `-bytes` nor in `-ms`.",
///  "type": "object",
///  "required": [
///    "kind",
///    "limit_count",
///    "name"
///  ],
///  "properties": {
///    "kind": {
///      "description": "Variant tag: the limit is a count.",
///      "type": "string",
///      "const": "count"
///    },
///    "limit_count": {
///      "description": "The limit's value for this invocation, its default or the `--limit` override.",
///      "$ref": "#/$defs/Count"
///    },
///    "name": {
///      "description": "Which limit.",
///      "$ref": "#/$defs/CliLimitName"
///    },
///    "observed_count": {
///      "description": "The count that exceeded it, when it was known before stopping (for example the number of selected source files). Absent otherwise.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliCountLimitHit {
    ///Variant tag: the limit is a count.
    pub kind: ::std::string::String,
    ///Which limit.
    pub name: CliLimitName,
    ///The limit's value for this invocation, its default or the `--limit` override.
    pub limit_count: Count,
    ///The count that exceeded it, when it was known before stopping (for example the number of selected source files). Absent otherwise.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub observed_count: ::std::option::Option<Count>,
}
/**One stderr line. stderr is JSON Lines: every line is one compact
CliDiagnosticA0 followed by LF, in the order the findings happen. It is a
log for people and the job log; callers never take control decisions from
it, only from the exit code and stdout.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.diagnostic:a0",
///  "title": "CliDiagnosticA0",
///  "description": "One stderr line. stderr is JSON Lines: every line is one compact\nCliDiagnosticA0 followed by LF, in the order the findings happen. It is a\nlog for people and the job log; callers never take control decisions from\nit, only from the exit code and stdout.",
///  "type": "object",
///  "required": [
///    "code",
///    "message",
///    "schema",
///    "severity"
///  ],
///  "properties": {
///    "argument": {
///      "description": "The command-line argument the finding is about, when it is about one.",
///      "$ref": "#/$defs/CliArgument"
///    },
///    "code": {
///      "description": "Stable code (cli-spec.md §8).",
///      "$ref": "#/$defs/DiagnosticCode"
///    },
///    "limit": {
///      "description": "The limit that was hit, for `limit-exceeded` and `diagnostics-truncated`.",
///      "$ref": "#/$defs/CliLimitHit"
///    },
///    "location": {
///      "description": "Where the finding is, when known.",
///      "$ref": "#/$defs/CliLocation"
///    },
///    "message": {
///      "description": "One-sentence explanation for people, at most 4096 bytes. It never contains a host path.",
///      "type": "string",
///      "minLength": 1
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.diagnostic.a0"
///    },
///    "severity": {
///      "description": "How serious the finding is.",
///      "$ref": "#/$defs/CliSeverity"
///    },
///    "stage": {
///      "description": "The `bundle build` stage the finding belongs to. Absent for other commands and for findings outside a stage (argument parsing).",
///      "$ref": "#/$defs/CliBuildStage"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliDiagnosticA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///How serious the finding is.
    pub severity: CliSeverity,
    ///Stable code (cli-spec.md §8).
    pub code: DiagnosticCode,
    ///One-sentence explanation for people, at most 4096 bytes. It never contains a host path.
    pub message: CliDiagnosticA0Message,
    ///The `bundle build` stage the finding belongs to. Absent for other commands and for findings outside a stage (argument parsing).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub stage: ::std::option::Option<CliBuildStage>,
    ///The command-line argument the finding is about, when it is about one.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub argument: ::std::option::Option<CliArgument>,
    ///Where the finding is, when known.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub location: ::std::option::Option<CliLocation>,
    ///The limit that was hit, for `limit-exceeded` and `diagnostics-truncated`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub limit: ::std::option::Option<CliLimitHit>,
}
///One-sentence explanation for people, at most 4096 bytes. It never contains a host path.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One-sentence explanation for people, at most 4096 bytes. It never contains a host path.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct CliDiagnosticA0Message(::std::string::String);
impl ::std::ops::Deref for CliDiagnosticA0Message {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<CliDiagnosticA0Message> for ::std::string::String {
    fn from(value: CliDiagnosticA0Message) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for CliDiagnosticA0Message {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for CliDiagnosticA0Message {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliDiagnosticA0Message {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliDiagnosticA0Message {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for CliDiagnosticA0Message {
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
/**The limit a resource-limit or timeout error, or a diagnostic, hit. The
variant follows the limit name's unit suffix.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The limit a resource-limit or timeout error, or a diagnostic, hit. The\nvariant follows the limit name's unit suffix.",
///  "oneOf": [
///    {
///      "description": "A size limit.",
///      "$ref": "#/$defs/CliByteLimitHit"
///    },
///    {
///      "description": "The wall-clock limit.",
///      "$ref": "#/$defs/CliTimeLimitHit"
///    },
///    {
///      "description": "A count limit.",
///      "$ref": "#/$defs/CliCountLimitHit"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum CliLimitHit {
    ByteLimitHit(CliByteLimitHit),
    TimeLimitHit(CliTimeLimitHit),
    CountLimitHit(CliCountLimitHit),
}
impl ::std::convert::From<CliByteLimitHit> for CliLimitHit {
    fn from(value: CliByteLimitHit) -> Self {
        Self::ByteLimitHit(value)
    }
}
impl ::std::convert::From<CliTimeLimitHit> for CliLimitHit {
    fn from(value: CliTimeLimitHit) -> Self {
        Self::TimeLimitHit(value)
    }
}
impl ::std::convert::From<CliCountLimitHit> for CliLimitHit {
    fn from(value: CliCountLimitHit) -> Self {
        Self::CountLimitHit(value)
    }
}
/**A resource limit (cli-spec.md §7.2). The suffix gives the unit: `-bytes` is
bytes, `-ms` is milliseconds, anything else is a count. Every limit can be
set with `--limit <name>=<value>`, up to its hard bound. Hitting one is
never recorded in a bundle: limits are configuration, not part of the
bundle key.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A resource limit (cli-spec.md §7.2). The suffix gives the unit: `-bytes` is\nbytes, `-ms` is milliseconds, anything else is a count. Every limit can be\nset with `--limit <name>=<value>`, up to its hard bound. Hitting one is\nnever recorded in a bundle: limits are configuration, not part of the\nbundle key.",
///  "type": "string",
///  "enum": [
///    "max-source-files",
///    "max-source-file-bytes",
///    "max-total-source-bytes",
///    "max-path-bytes",
///    "max-sexpr-depth",
///    "max-sexpr-nodes",
///    "max-sexpr-string-bytes",
///    "max-json-depth",
///    "max-json-nodes",
///    "max-config-bytes",
///    "max-models-glb-bytes",
///    "max-materialization-operations",
///    "max-member-bytes",
///    "max-archive-bytes",
///    "max-archive-members",
///    "max-total-unpacked-bytes",
///    "max-compression-ratio",
///    "max-diagnostic-lines",
///    "max-findings",
///    "max-memory-bytes",
///    "timeout-ms"
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
pub enum CliLimitName {
    #[serde(rename = "max-source-files")]
    MaxSourceFiles,
    #[serde(rename = "max-source-file-bytes")]
    MaxSourceFileBytes,
    #[serde(rename = "max-total-source-bytes")]
    MaxTotalSourceBytes,
    #[serde(rename = "max-path-bytes")]
    MaxPathBytes,
    #[serde(rename = "max-sexpr-depth")]
    MaxSexprDepth,
    #[serde(rename = "max-sexpr-nodes")]
    MaxSexprNodes,
    #[serde(rename = "max-sexpr-string-bytes")]
    MaxSexprStringBytes,
    #[serde(rename = "max-json-depth")]
    MaxJsonDepth,
    #[serde(rename = "max-json-nodes")]
    MaxJsonNodes,
    #[serde(rename = "max-config-bytes")]
    MaxConfigBytes,
    #[serde(rename = "max-models-glb-bytes")]
    MaxModelsGlbBytes,
    #[serde(rename = "max-materialization-operations")]
    MaxMaterializationOperations,
    #[serde(rename = "max-member-bytes")]
    MaxMemberBytes,
    #[serde(rename = "max-archive-bytes")]
    MaxArchiveBytes,
    #[serde(rename = "max-archive-members")]
    MaxArchiveMembers,
    #[serde(rename = "max-total-unpacked-bytes")]
    MaxTotalUnpackedBytes,
    #[serde(rename = "max-compression-ratio")]
    MaxCompressionRatio,
    #[serde(rename = "max-diagnostic-lines")]
    MaxDiagnosticLines,
    #[serde(rename = "max-findings")]
    MaxFindings,
    #[serde(rename = "max-memory-bytes")]
    MaxMemoryBytes,
    #[serde(rename = "timeout-ms")]
    TimeoutMs,
}
impl ::std::fmt::Display for CliLimitName {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::MaxSourceFiles => f.write_str("max-source-files"),
            Self::MaxSourceFileBytes => f.write_str("max-source-file-bytes"),
            Self::MaxTotalSourceBytes => f.write_str("max-total-source-bytes"),
            Self::MaxPathBytes => f.write_str("max-path-bytes"),
            Self::MaxSexprDepth => f.write_str("max-sexpr-depth"),
            Self::MaxSexprNodes => f.write_str("max-sexpr-nodes"),
            Self::MaxSexprStringBytes => f.write_str("max-sexpr-string-bytes"),
            Self::MaxJsonDepth => f.write_str("max-json-depth"),
            Self::MaxJsonNodes => f.write_str("max-json-nodes"),
            Self::MaxConfigBytes => f.write_str("max-config-bytes"),
            Self::MaxModelsGlbBytes => f.write_str("max-models-glb-bytes"),
            Self::MaxMaterializationOperations => f.write_str("max-materialization-operations"),
            Self::MaxMemberBytes => f.write_str("max-member-bytes"),
            Self::MaxArchiveBytes => f.write_str("max-archive-bytes"),
            Self::MaxArchiveMembers => f.write_str("max-archive-members"),
            Self::MaxTotalUnpackedBytes => f.write_str("max-total-unpacked-bytes"),
            Self::MaxCompressionRatio => f.write_str("max-compression-ratio"),
            Self::MaxDiagnosticLines => f.write_str("max-diagnostic-lines"),
            Self::MaxFindings => f.write_str("max-findings"),
            Self::MaxMemoryBytes => f.write_str("max-memory-bytes"),
            Self::TimeoutMs => f.write_str("timeout-ms"),
        }
    }
}
impl ::std::str::FromStr for CliLimitName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "max-source-files" => Ok(Self::MaxSourceFiles),
            "max-source-file-bytes" => Ok(Self::MaxSourceFileBytes),
            "max-total-source-bytes" => Ok(Self::MaxTotalSourceBytes),
            "max-path-bytes" => Ok(Self::MaxPathBytes),
            "max-sexpr-depth" => Ok(Self::MaxSexprDepth),
            "max-sexpr-nodes" => Ok(Self::MaxSexprNodes),
            "max-sexpr-string-bytes" => Ok(Self::MaxSexprStringBytes),
            "max-json-depth" => Ok(Self::MaxJsonDepth),
            "max-json-nodes" => Ok(Self::MaxJsonNodes),
            "max-config-bytes" => Ok(Self::MaxConfigBytes),
            "max-models-glb-bytes" => Ok(Self::MaxModelsGlbBytes),
            "max-materialization-operations" => Ok(Self::MaxMaterializationOperations),
            "max-member-bytes" => Ok(Self::MaxMemberBytes),
            "max-archive-bytes" => Ok(Self::MaxArchiveBytes),
            "max-archive-members" => Ok(Self::MaxArchiveMembers),
            "max-total-unpacked-bytes" => Ok(Self::MaxTotalUnpackedBytes),
            "max-compression-ratio" => Ok(Self::MaxCompressionRatio),
            "max-diagnostic-lines" => Ok(Self::MaxDiagnosticLines),
            "max-findings" => Ok(Self::MaxFindings),
            "max-memory-bytes" => Ok(Self::MaxMemoryBytes),
            "timeout-ms" => Ok(Self::TimeoutMs),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliLimitName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliLimitName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliLimitName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
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
///A duration in integer milliseconds (conventions.md §6, CLI limits).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A duration in integer milliseconds (conventions.md §6, CLI limits).",
///  "type": "integer",
///  "minimum": 0.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct CliMilliseconds(pub u64);
impl ::std::ops::Deref for CliMilliseconds {
    type Target = u64;
    fn deref(&self) -> &u64 {
        &self.0
    }
}
impl ::std::convert::From<CliMilliseconds> for u64 {
    fn from(value: CliMilliseconds) -> Self {
        value.0
    }
}
impl ::std::convert::From<u64> for CliMilliseconds {
    fn from(value: u64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for CliMilliseconds {
    type Err = <u64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for CliMilliseconds {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for CliMilliseconds {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for CliMilliseconds {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
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
///How serious a stderr diagnostic is.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How serious a stderr diagnostic is.",
///  "type": "string",
///  "enum": [
///    "info",
///    "warning",
///    "error"
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
pub enum CliSeverity {
    #[serde(rename = "info")]
    Info,
    #[serde(rename = "warning")]
    Warning,
    #[serde(rename = "error")]
    Error,
}
impl ::std::fmt::Display for CliSeverity {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Info => f.write_str("info"),
            Self::Warning => f.write_str("warning"),
            Self::Error => f.write_str("error"),
        }
    }
}
impl ::std::str::FromStr for CliSeverity {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "info" => Ok(Self::Info),
            "warning" => Ok(Self::Warning),
            "error" => Ok(Self::Error),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliSeverity {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliSeverity {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliSeverity {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A time limit that was hit: `timeout-ms`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A time limit that was hit: `timeout-ms`.",
///  "type": "object",
///  "required": [
///    "kind",
///    "limit_ms",
///    "name"
///  ],
///  "properties": {
///    "kind": {
///      "description": "Variant tag: the limit is a duration.",
///      "type": "string",
///      "const": "time"
///    },
///    "limit_ms": {
///      "description": "The limit's value for this invocation. No elapsed time is reported: documents carry no measured durations.",
///      "$ref": "#/$defs/CliMilliseconds"
///    },
///    "name": {
///      "description": "Which limit.",
///      "$ref": "#/$defs/CliLimitName"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliTimeLimitHit {
    ///Variant tag: the limit is a duration.
    pub kind: ::std::string::String,
    ///Which limit.
    pub name: CliLimitName,
    ///The limit's value for this invocation. No elapsed time is reported: documents carry no measured durations.
    pub limit_ms: CliMilliseconds,
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
impl<'de> ::serde::Deserialize<'de> for CliLimitHit {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("bytes") {
            return ::serde_json::from_value::<CliByteLimitHit>(value)
                .map(Self::ByteLimitHit)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("time") {
            return ::serde_json::from_value::<CliTimeLimitHit>(value)
                .map(Self::TimeLimitHit)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("count") {
            return ::serde_json::from_value::<CliCountLimitHit>(value)
                .map(Self::CountLimitHit)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum CliLimitHit",
        ))
    }
}
