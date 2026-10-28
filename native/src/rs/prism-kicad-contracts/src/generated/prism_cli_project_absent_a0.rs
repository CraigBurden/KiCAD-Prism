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
/**stdout of `revision-key` and of `bundle build --stage parse` when the
project is absent at this revision: its anchor, the project file, is not
in the tree (exit 10, cli-spec.md §4). This is an outcome, not a failure
(conventions.md §8): the revision has no such project, so it has no
revision key and no bundle, nothing is retried, and consumers show "not
present at this revision". Nothing is written to `-o`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.project_absent:a0",
///  "title": "CliProjectAbsentA0",
///  "description": "stdout of `revision-key` and of `bundle build --stage parse` when the\nproject is absent at this revision: its anchor, the project file, is not\nin the tree (exit 10, cli-spec.md §4). This is an outcome, not a failure\n(conventions.md §8): the revision has no such project, so it has no\nrevision key and no bundle, nothing is retried, and consumers show \"not\npresent at this revision\". Nothing is written to `-o`.",
///  "type": "object",
///  "required": [
///    "code",
///    "command",
///    "project_file",
///    "schema"
///  ],
///  "properties": {
///    "code": {
///      "description": "Stable code of the outcome (cli-spec.md §8), equivalent to exit 10.",
///      "type": "string",
///      "const": "project-absent"
///    },
///    "command": {
///      "description": "The command that found the project absent.",
///      "$ref": "#/$defs/CliProjectAbsentCommand"
///    },
///    "commit": {
///      "description": "The full commit id the revision resolved to, for `revision-key --commit`. Absent for `--worktree` and for `bundle build`.",
///      "$ref": "#/$defs/GitObjectId"
///    },
///    "project_file": {
///      "description": "The absent anchor, repository-relative: `--project` of `revision-key`, or `<project.kicad_pro>` of `bundle build` relative to the source root.",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.project_absent.a0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliProjectAbsentA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///Stable code of the outcome (cli-spec.md §8), equivalent to exit 10.
    pub code: ::std::string::String,
    ///The command that found the project absent.
    pub command: CliProjectAbsentCommand,
    ///The absent anchor, repository-relative: `--project` of `revision-key`, or `<project.kicad_pro>` of `bundle build` relative to the source root.
    pub project_file: RepoPath,
    ///The full commit id the revision resolved to, for `revision-key --commit`. Absent for `--worktree` and for `bundle build`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub commit: ::std::option::Option<GitObjectId>,
}
///A command that can find the project absent at a revision (CliProjectAbsentA0).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A command that can find the project absent at a revision (CliProjectAbsentA0).",
///  "type": "string",
///  "enum": [
///    "revision-key",
///    "bundle build"
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
pub enum CliProjectAbsentCommand {
    #[serde(rename = "revision-key")]
    RevisionKey,
    #[serde(rename = "bundle build")]
    BundleBuild,
}
impl ::std::fmt::Display for CliProjectAbsentCommand {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::RevisionKey => f.write_str("revision-key"),
            Self::BundleBuild => f.write_str("bundle build"),
        }
    }
}
impl ::std::str::FromStr for CliProjectAbsentCommand {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "revision-key" => Ok(Self::RevisionKey),
            "bundle build" => Ok(Self::BundleBuild),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliProjectAbsentCommand {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliProjectAbsentCommand {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliProjectAbsentCommand {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**Git object id in lowercase hexadecimal: 40 characters in a SHA-1
repository, 64 in a SHA-256 repository. Used for commit ids and blob ids.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Git object id in lowercase hexadecimal: 40 characters in a SHA-1\nrepository, 64 in a SHA-256 repository. Used for commit ids and blob ids.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct GitObjectId(pub ::std::string::String);
impl ::std::ops::Deref for GitObjectId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<GitObjectId> for ::std::string::String {
    fn from(value: GitObjectId) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for GitObjectId {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for GitObjectId {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for GitObjectId {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
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
