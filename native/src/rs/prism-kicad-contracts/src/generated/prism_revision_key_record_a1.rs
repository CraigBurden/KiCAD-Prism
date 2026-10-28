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
///The key was computed from a commit's tree (`--commit`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The key was computed from a commit's tree (`--commit`).",
///  "type": "object",
///  "required": [
///    "commit",
///    "kind"
///  ],
///  "properties": {
///    "commit": {
///      "description": "The full commit id the given revision resolved to (`git rev-parse --verify <rev>^{commit}`).",
///      "$ref": "#/$defs/GitObjectId"
///    },
///    "kind": {
///      "description": "Variant tag.",
///      "type": "string",
///      "const": "commit"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyCommitSource {
    ///Variant tag.
    pub kind: ::std::string::String,
    ///The full commit id the given revision resolved to (`git rev-parse --verify <rev>^{commit}`).
    pub commit: GitObjectId,
}
///Number of selected entries per category. Each field is the count of entries whose `category` is the matching value.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Number of selected entries per category. Each field is the count of entries whose `category` is the matching value.",
///  "type": "object",
///  "required": [
///    "footprint",
///    "gitlink",
///    "kicad_board",
///    "kicad_design_rules",
///    "kicad_jobset",
///    "kicad_project",
///    "kicad_schematic",
///    "kicad_worksheet",
///    "library_table",
///    "model_3d",
///    "prism_settings",
///    "symbol_library",
///    "symlink",
///    "total"
///  ],
///  "properties": {
///    "footprint": {
///      "description": "Entries of category `footprint`.",
///      "$ref": "#/$defs/Count"
///    },
///    "gitlink": {
///      "description": "Entries of category `gitlink`.",
///      "$ref": "#/$defs/Count"
///    },
///    "kicad_board": {
///      "description": "Entries of category `kicad-board`.",
///      "$ref": "#/$defs/Count"
///    },
///    "kicad_design_rules": {
///      "description": "Entries of category `kicad-design-rules`.",
///      "$ref": "#/$defs/Count"
///    },
///    "kicad_jobset": {
///      "description": "Entries of category `kicad-jobset`.",
///      "$ref": "#/$defs/Count"
///    },
///    "kicad_project": {
///      "description": "Entries of category `kicad-project`.",
///      "$ref": "#/$defs/Count"
///    },
///    "kicad_schematic": {
///      "description": "Entries of category `kicad-schematic`.",
///      "$ref": "#/$defs/Count"
///    },
///    "kicad_worksheet": {
///      "description": "Entries of category `kicad-worksheet`.",
///      "$ref": "#/$defs/Count"
///    },
///    "library_table": {
///      "description": "Entries of category `library-table`.",
///      "$ref": "#/$defs/Count"
///    },
///    "model_3d": {
///      "description": "Entries of category `model-3d`.",
///      "$ref": "#/$defs/Count"
///    },
///    "prism_settings": {
///      "description": "Entries of category `prism-settings`.",
///      "$ref": "#/$defs/Count"
///    },
///    "symbol_library": {
///      "description": "Entries of category `symbol-library`.",
///      "$ref": "#/$defs/Count"
///    },
///    "symlink": {
///      "description": "Entries of category `symlink`.",
///      "$ref": "#/$defs/Count"
///    },
///    "total": {
///      "description": "All selected entries: the sum of the fields above, equal to the length of `entries`.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyCounts {
    ///Entries of category `kicad-project`.
    pub kicad_project: Count,
    ///Entries of category `kicad-schematic`.
    pub kicad_schematic: Count,
    ///Entries of category `kicad-board`.
    pub kicad_board: Count,
    ///Entries of category `kicad-design-rules`.
    pub kicad_design_rules: Count,
    ///Entries of category `kicad-worksheet`.
    pub kicad_worksheet: Count,
    ///Entries of category `kicad-jobset`.
    pub kicad_jobset: Count,
    ///Entries of category `library-table`.
    pub library_table: Count,
    ///Entries of category `symbol-library`.
    pub symbol_library: Count,
    ///Entries of category `footprint`.
    pub footprint: Count,
    ///Entries of category `model-3d`.
    pub model_3d: Count,
    ///Entries of category `prism-settings`.
    pub prism_settings: Count,
    ///Entries of category `symlink`.
    pub symlink: Count,
    ///Entries of category `gitlink`.
    pub gitlink: Count,
    ///All selected entries: the sum of the fields above, equal to the length of `entries`.
    pub total: Count,
}
/**The effective project configuration: everything outside the source files
that changes which files are the project or how they are read. Prism
resolves it (stored settings over the committed `.prism.json` over
detection), by the same function for a commit and for a working tree; the
CLI only validates and hashes it. Its canonical bytes, hashed into the key,
are the compact JSON of exactly these fields in this order with absent
optional fields omitted (revision-key.md, "Canonical config bytes"). All
paths are repository-relative.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "title": "Revision key effective config a1",
///  "description": "The effective project configuration: everything outside the source files\nthat changes which files are the project or how they are read. Prism\nresolves it (stored settings over the committed `.prism.json` over\ndetection), by the same function for a commit and for a working tree; the\nCLI only validates and hashes it. Its canonical bytes, hashed into the key,\nare the compact JSON of exactly these fields in this order with absent\noptional fields omitted (revision-key.md, \"Canonical config bytes\"). All\npaths are repository-relative.",
///  "type": "object",
///  "required": [
///    "excluded_dirs",
///    "project_file",
///    "schema"
///  ],
///  "properties": {
///    "board": {
///      "description": "The board the build parses (ends in `.kicad_pcb`). Absent when the\nproject has none or Prism resolved none. Must be a blob entry of the\nlisting when present.",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "excluded_dirs": {
///      "description": "Directories whose entries are never selected: Prism's resolved\ndesign-output and manufacturing-output directories, whether or not they\nexist at this revision. Sorted by UTF-8 bytes, strictly increasing; no\nelement lies under another; none contains `project_file`,\n`root_schematic` or `board`. Empty when nothing is excluded.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/RepoPath"
///      }
///    },
///    "project_file": {
///      "description": "The project anchor: the resolved `.kicad_pro` (its last segment ends in\n`.kicad_pro`, ASCII case-insensitive). Its directory is KiCad's\n`KIPRJMOD`. Must be a blob entry of the listing.",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "root_schematic": {
///      "description": "The root schematic the build parses (ends in `.kicad_sch`). Absent when\nthe project has none or Prism resolved none. Must be a blob entry of the\nlisting when present.",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.revision_key.effective_config.a1"
///    },
///    "zone_fills": {
///      "description": "Zone-fill handling of the board stage, from Prism's stored project\nsetting `zoneFills`. Absent means `refill`; the only value ever written\nis `saved`, and an explicit `refill` is `config-invalid`, so each config\nhas one spelling. Last in the canonical key order, so a config without it\nkeeps its canonical bytes.",
///      "$ref": "#/$defs/RevisionKeyZoneFills"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyEffectiveConfigA1 {
    ///Document schema id.
    pub schema: ::std::string::String,
    /**The project anchor: the resolved `.kicad_pro` (its last segment ends in
    `.kicad_pro`, ASCII case-insensitive). Its directory is KiCad's
    `KIPRJMOD`. Must be a blob entry of the listing.*/
    pub project_file: RepoPath,
    /**The root schematic the build parses (ends in `.kicad_sch`). Absent when
    the project has none or Prism resolved none. Must be a blob entry of the
    listing when present.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub root_schematic: ::std::option::Option<RepoPath>,
    /**The board the build parses (ends in `.kicad_pcb`). Absent when the
    project has none or Prism resolved none. Must be a blob entry of the
    listing when present.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub board: ::std::option::Option<RepoPath>,
    /**Directories whose entries are never selected: Prism's resolved
    design-output and manufacturing-output directories, whether or not they
    exist at this revision. Sorted by UTF-8 bytes, strictly increasing; no
    element lies under another; none contains `project_file`,
    `root_schematic` or `board`. Empty when nothing is excluded.*/
    pub excluded_dirs: ::std::vec::Vec<RepoPath>,
    /**Zone-fill handling of the board stage, from Prism's stored project
    setting `zoneFills`. Absent means `refill`; the only value ever written
    is `saved`, and an explicit `refill` is `config-invalid`, so each config
    has one spelling. Last in the canonical key order, so a config without it
    keeps its canonical bytes.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub zone_fills: ::std::option::Option<RevisionKeyZoneFills>,
}
///One entry of the source set: a tree entry the key hashes.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One entry of the source set: a tree entry the key hashes.",
///  "type": "object",
///  "required": [
///    "category",
///    "kind",
///    "object_id",
///    "path"
///  ],
///  "properties": {
///    "category": {
///      "description": "Selection rule the entry matched; not hashed.",
///      "$ref": "#/$defs/RevisionKeySourceCategory"
///    },
///    "kind": {
///      "description": "Entry kind, from the git mode and object type.",
///      "$ref": "#/$defs/RevisionKeyEntryKind"
///    },
///    "object_id": {
///      "description": "Blob id (regular, executable, symlink) or recorded commit id (gitlink), in the repository's object format.",
///      "$ref": "#/$defs/GitObjectId"
///    },
///    "path": {
///      "description": "Repository-relative path, exactly the bytes git lists (UTF-8, never Unicode-normalized or case-folded).",
///      "$ref": "#/$defs/RepoPath"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyEntry {
    ///Repository-relative path, exactly the bytes git lists (UTF-8, never Unicode-normalized or case-folded).
    pub path: RepoPath,
    ///Entry kind, from the git mode and object type.
    pub kind: RevisionKeyEntryKind,
    ///Blob id (regular, executable, symlink) or recorded commit id (gitlink), in the repository's object format.
    pub object_id: GitObjectId,
    ///Selection rule the entry matched; not hashed.
    pub category: RevisionKeySourceCategory,
}
/**Kind of a source-set entry, fixed by its git tree mode and object type. The
hashed framing spells each kind as git does (revision-key.md, "Hashing").*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Kind of a source-set entry, fixed by its git tree mode and object type. The\nhashed framing spells each kind as git does (revision-key.md, \"Hashing\").",
///  "type": "string",
///  "enum": [
///    "regular",
///    "executable",
///    "symlink",
///    "gitlink"
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
pub enum RevisionKeyEntryKind {
    #[serde(rename = "regular")]
    Regular,
    #[serde(rename = "executable")]
    Executable,
    #[serde(rename = "symlink")]
    Symlink,
    #[serde(rename = "gitlink")]
    Gitlink,
}
impl ::std::fmt::Display for RevisionKeyEntryKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Regular => f.write_str("regular"),
            Self::Executable => f.write_str("executable"),
            Self::Symlink => f.write_str("symlink"),
            Self::Gitlink => f.write_str("gitlink"),
        }
    }
}
impl ::std::str::FromStr for RevisionKeyEntryKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "regular" => Ok(Self::Regular),
            "executable" => Ok(Self::Executable),
            "symlink" => Ok(Self::Symlink),
            "gitlink" => Ok(Self::Gitlink),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeyEntryKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeyEntryKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeyEntryKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///Object format of the repository, as `git rev-parse --show-object-format` prints it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Object format of the repository, as `git rev-parse --show-object-format` prints it.",
///  "type": "string",
///  "enum": [
///    "sha1",
///    "sha256"
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
pub enum RevisionKeyObjectFormat {
    #[serde(rename = "sha1")]
    Sha1,
    #[serde(rename = "sha256")]
    Sha256,
}
impl ::std::fmt::Display for RevisionKeyObjectFormat {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Sha1 => f.write_str("sha1"),
            Self::Sha256 => f.write_str("sha256"),
        }
    }
}
impl ::std::str::FromStr for RevisionKeyObjectFormat {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "sha1" => Ok(Self::Sha1),
            "sha256" => Ok(Self::Sha256),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeyObjectFormat {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeyObjectFormat {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeyObjectFormat {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**Output of `prism-kicad revision-key`: the key with everything needed to
recompute and audit it. Printed on stdout as one compact JSON document
followed by LF (conventions.md §13).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.revision_key.record:a1",
///  "title": "RevisionKeyRecordA1",
///  "description": "Output of `prism-kicad revision-key`: the key with everything needed to\nrecompute and audit it. Printed on stdout as one compact JSON document\nfollowed by LF (conventions.md §13).",
///  "type": "object",
///  "required": [
///    "config",
///    "config_digest",
///    "counts",
///    "entries",
///    "object_format",
///    "revision_key",
///    "schema",
///    "source",
///    "warnings"
///  ],
///  "properties": {
///    "config": {
///      "description": "The effective configuration that was hashed, after validation; the default one when `--config` was not given.",
///      "$ref": "#/$defs/RevisionKeyEffectiveConfigA1"
///    },
///    "config_digest": {
///      "description": "Lowercase hex SHA-256 of the canonical config bytes; the commit index's config column.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "counts": {
///      "description": "Per-category counts of `entries`.",
///      "$ref": "#/$defs/RevisionKeyCounts"
///    },
///    "entries": {
///      "description": "The source set, sorted by `path` in code point order (UTF-8 byte order); the order they are hashed in. Always holds the project file.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/RevisionKeyEntry"
///      },
///      "minItems": 1
///    },
///    "object_format": {
///      "description": "Object format of the repository; hashed into the key.",
///      "$ref": "#/$defs/RevisionKeyObjectFormat"
///    },
///    "revision_key": {
///      "description": "The design revision key: lowercase hex SHA-256 of the a1 preimage (revision-key.md, \"Hashing\"). Never truncated.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.revision_key.record.a1"
///    },
///    "source": {
///      "description": "Commit or working tree. Not hashed.",
///      "$ref": "#/$defs/RevisionKeySource"
///    },
///    "warnings": {
///      "description": "Non-fatal findings (for example `lfs-filter-unavailable`), sorted by `code`, then `message`, in code point order. Empty when there are none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/Warning"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyRecordA1 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///The design revision key: lowercase hex SHA-256 of the a1 preimage (revision-key.md, "Hashing"). Never truncated.
    pub revision_key: Sha256Hex,
    ///Object format of the repository; hashed into the key.
    pub object_format: RevisionKeyObjectFormat,
    ///Commit or working tree. Not hashed.
    pub source: RevisionKeySource,
    ///The effective configuration that was hashed, after validation; the default one when `--config` was not given.
    pub config: RevisionKeyEffectiveConfigA1,
    ///Lowercase hex SHA-256 of the canonical config bytes; the commit index's config column.
    pub config_digest: Sha256Hex,
    ///The source set, sorted by `path` in code point order (UTF-8 byte order); the order they are hashed in. Always holds the project file.
    pub entries: ::std::vec::Vec<RevisionKeyEntry>,
    ///Per-category counts of `entries`.
    pub counts: RevisionKeyCounts,
    ///Non-fatal findings (for example `lfs-filter-unavailable`), sorted by `code`, then `message`, in code point order. Empty when there are none.
    pub warnings: ::std::vec::Vec<Warning>,
}
///Where the listing came from. The same content gives the same key either way.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where the listing came from. The same content gives the same key either way.",
///  "oneOf": [
///    {
///      "description": "A commit.",
///      "$ref": "#/$defs/RevisionKeyCommitSource"
///    },
///    {
///      "description": "The working tree.",
///      "$ref": "#/$defs/RevisionKeyWorktreeSource"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum RevisionKeySource {
    CommitSource(RevisionKeyCommitSource),
    WorktreeSource(RevisionKeyWorktreeSource),
}
impl ::std::convert::From<RevisionKeyCommitSource> for RevisionKeySource {
    fn from(value: RevisionKeyCommitSource) -> Self {
        Self::CommitSource(value)
    }
}
impl ::std::convert::From<RevisionKeyWorktreeSource> for RevisionKeySource {
    fn from(value: RevisionKeyWorktreeSource) -> Self {
        Self::WorktreeSource(value)
    }
}
/**Why an entry is in the source set, from its file name (revision-key.md,
"Selection"). Name rules are ASCII case-insensitive. Not hashed: it is
derived from the path and kind.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Why an entry is in the source set, from its file name (revision-key.md,\n\"Selection\"). Name rules are ASCII case-insensitive. Not hashed: it is\nderived from the path and kind.",
///  "type": "string",
///  "enum": [
///    "kicad-project",
///    "kicad-schematic",
///    "kicad-board",
///    "kicad-design-rules",
///    "kicad-worksheet",
///    "kicad-jobset",
///    "library-table",
///    "symbol-library",
///    "footprint",
///    "model-3d",
///    "prism-settings",
///    "symlink",
///    "gitlink"
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
pub enum RevisionKeySourceCategory {
    #[serde(rename = "kicad-project")]
    KicadProject,
    #[serde(rename = "kicad-schematic")]
    KicadSchematic,
    #[serde(rename = "kicad-board")]
    KicadBoard,
    #[serde(rename = "kicad-design-rules")]
    KicadDesignRules,
    #[serde(rename = "kicad-worksheet")]
    KicadWorksheet,
    #[serde(rename = "kicad-jobset")]
    KicadJobset,
    #[serde(rename = "library-table")]
    LibraryTable,
    #[serde(rename = "symbol-library")]
    SymbolLibrary,
    #[serde(rename = "footprint")]
    Footprint,
    #[serde(rename = "model-3d")]
    Model3d,
    #[serde(rename = "prism-settings")]
    PrismSettings,
    #[serde(rename = "symlink")]
    Symlink,
    #[serde(rename = "gitlink")]
    Gitlink,
}
impl ::std::fmt::Display for RevisionKeySourceCategory {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::KicadProject => f.write_str("kicad-project"),
            Self::KicadSchematic => f.write_str("kicad-schematic"),
            Self::KicadBoard => f.write_str("kicad-board"),
            Self::KicadDesignRules => f.write_str("kicad-design-rules"),
            Self::KicadWorksheet => f.write_str("kicad-worksheet"),
            Self::KicadJobset => f.write_str("kicad-jobset"),
            Self::LibraryTable => f.write_str("library-table"),
            Self::SymbolLibrary => f.write_str("symbol-library"),
            Self::Footprint => f.write_str("footprint"),
            Self::Model3d => f.write_str("model-3d"),
            Self::PrismSettings => f.write_str("prism-settings"),
            Self::Symlink => f.write_str("symlink"),
            Self::Gitlink => f.write_str("gitlink"),
        }
    }
}
impl ::std::str::FromStr for RevisionKeySourceCategory {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "kicad-project" => Ok(Self::KicadProject),
            "kicad-schematic" => Ok(Self::KicadSchematic),
            "kicad-board" => Ok(Self::KicadBoard),
            "kicad-design-rules" => Ok(Self::KicadDesignRules),
            "kicad-worksheet" => Ok(Self::KicadWorksheet),
            "kicad-jobset" => Ok(Self::KicadJobset),
            "library-table" => Ok(Self::LibraryTable),
            "symbol-library" => Ok(Self::SymbolLibrary),
            "footprint" => Ok(Self::Footprint),
            "model-3d" => Ok(Self::Model3d),
            "prism-settings" => Ok(Self::PrismSettings),
            "symlink" => Ok(Self::Symlink),
            "gitlink" => Ok(Self::Gitlink),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeySourceCategory {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeySourceCategory {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeySourceCategory {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///The key was computed from the working tree (`--worktree`): the tree `git add -A` would stage, computed without writing.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The key was computed from the working tree (`--worktree`): the tree `git add -A` would stage, computed without writing.",
///  "type": "object",
///  "required": [
///    "kind"
///  ],
///  "properties": {
///    "kind": {
///      "description": "Variant tag.",
///      "type": "string",
///      "const": "worktree"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyWorktreeSource {
    ///Variant tag.
    pub kind: ::std::string::String,
}
/**How the board stage obtains zone fills (revision-key.md §4; cli-spec.md
§5.2.3). The config writes only `saved`: the default is spelled by
omitting the field, and an explicit `refill` is `config-invalid`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How the board stage obtains zone fills (revision-key.md §4; cli-spec.md\n§5.2.3). The config writes only `saved`: the default is spelled by\nomitting the field, and an explicit `refill` is `config-invalid`.",
///  "type": "string",
///  "enum": [
///    "refill",
///    "saved"
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
pub enum RevisionKeyZoneFills {
    #[serde(rename = "refill")]
    Refill,
    #[serde(rename = "saved")]
    Saved,
}
impl ::std::fmt::Display for RevisionKeyZoneFills {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Refill => f.write_str("refill"),
            Self::Saved => f.write_str("saved"),
        }
    }
}
impl ::std::str::FromStr for RevisionKeyZoneFills {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "refill" => Ok(Self::Refill),
            "saved" => Ok(Self::Saved),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeyZoneFills {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeyZoneFills {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeyZoneFills {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
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
impl<'de> ::serde::Deserialize<'de> for RevisionKeySource {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("commit") {
            return ::serde_json::from_value::<RevisionKeyCommitSource>(value)
                .map(Self::CommitSource)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("worktree") {
            return ::serde_json::from_value::<RevisionKeyWorktreeSource>(value)
                .map(Self::WorktreeSource)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum RevisionKeySource",
        ))
    }
}
