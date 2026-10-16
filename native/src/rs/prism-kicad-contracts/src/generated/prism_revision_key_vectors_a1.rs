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
///Errors of the pure selection and hashing layers; each ends the whole computation. Every one but `project-absent` is a failure.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Errors of the pure selection and hashing layers; each ends the whole computation. Every one but `project-absent` is a failure.",
///  "type": "string",
///  "enum": [
///    "config-invalid",
///    "project-absent",
///    "config-path-missing",
///    "unrepresentable-path",
///    "unsupported-entry",
///    "invalid-listing"
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
pub enum RevisionKeyErrorCode {
    #[serde(rename = "config-invalid")]
    ConfigInvalid,
    #[serde(rename = "project-absent")]
    ProjectAbsent,
    #[serde(rename = "config-path-missing")]
    ConfigPathMissing,
    #[serde(rename = "unrepresentable-path")]
    UnrepresentablePath,
    #[serde(rename = "unsupported-entry")]
    UnsupportedEntry,
    #[serde(rename = "invalid-listing")]
    InvalidListing,
}
impl ::std::fmt::Display for RevisionKeyErrorCode {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::ConfigInvalid => f.write_str("config-invalid"),
            Self::ProjectAbsent => f.write_str("project-absent"),
            Self::ConfigPathMissing => f.write_str("config-path-missing"),
            Self::UnrepresentablePath => f.write_str("unrepresentable-path"),
            Self::UnsupportedEntry => f.write_str("unsupported-entry"),
            Self::InvalidListing => f.write_str("invalid-listing"),
        }
    }
}
impl ::std::str::FromStr for RevisionKeyErrorCode {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "config-invalid" => Ok(Self::ConfigInvalid),
            "project-absent" => Ok(Self::ProjectAbsent),
            "config-path-missing" => Ok(Self::ConfigPathMissing),
            "unrepresentable-path" => Ok(Self::UnrepresentablePath),
            "unsupported-entry" => Ok(Self::UnsupportedEntry),
            "invalid-listing" => Ok(Self::InvalidListing),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeyErrorCode {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeyErrorCode {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeyErrorCode {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///Expected result of a selection vector that fails.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Expected result of a selection vector that fails.",
///  "type": "object",
///  "required": [
///    "code",
///    "kind"
///  ],
///  "properties": {
///    "code": {
///      "description": "The error every implementation must report.",
///      "$ref": "#/$defs/RevisionKeyErrorCode"
///    },
///    "kind": {
///      "description": "Variant tag.",
///      "type": "string",
///      "const": "error"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyErrorOutcome {
    ///Variant tag.
    pub kind: ::std::string::String,
    ///The error every implementation must report.
    pub code: RevisionKeyErrorCode,
}
///Expected result of a hashing vector.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Expected result of a hashing vector.",
///  "type": "object",
///  "required": [
///    "config_canonical",
///    "config_digest",
///    "preimage_hex",
///    "revision_key"
///  ],
///  "properties": {
///    "config_canonical": {
///      "description": "The canonical config bytes as text.",
///      "type": "string",
///      "minLength": 1
///    },
///    "config_digest": {
///      "description": "SHA-256 of the canonical config bytes.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "preimage_hex": {
///      "description": "The whole hashed preimage, in hex.",
///      "$ref": "#/$defs/RevisionKeyHex"
///    },
///    "revision_key": {
///      "description": "SHA-256 of the preimage.",
///      "$ref": "#/$defs/Sha256Hex"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyHashingExpected {
    ///The canonical config bytes as text.
    pub config_canonical: RevisionKeyHashingExpectedConfigCanonical,
    ///SHA-256 of the canonical config bytes.
    pub config_digest: Sha256Hex,
    ///The whole hashed preimage, in hex.
    pub preimage_hex: RevisionKeyHex,
    ///SHA-256 of the preimage.
    pub revision_key: Sha256Hex,
}
///The canonical config bytes as text.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The canonical config bytes as text.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct RevisionKeyHashingExpectedConfigCanonical(::std::string::String);
impl ::std::ops::Deref for RevisionKeyHashingExpectedConfigCanonical {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RevisionKeyHashingExpectedConfigCanonical> for ::std::string::String {
    fn from(value: RevisionKeyHashingExpectedConfigCanonical) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for RevisionKeyHashingExpectedConfigCanonical {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeyHashingExpectedConfigCanonical {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeyHashingExpectedConfigCanonical {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeyHashingExpectedConfigCanonical {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for RevisionKeyHashingExpectedConfigCanonical {
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
///Layer 2: from selected entries and a config to the preimage and the key.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Layer 2: from selected entries and a config to the preimage and the key.",
///  "type": "object",
///  "required": [
///    "config",
///    "description",
///    "entries",
///    "expected",
///    "name",
///    "object_format"
///  ],
///  "properties": {
///    "config": {
///      "description": "The effective config.",
///      "$ref": "#/$defs/RevisionKeyEffectiveConfigA1"
///    },
///    "description": {
///      "description": "What the vector exercises.",
///      "type": "string",
///      "minLength": 1
///    },
///    "entries": {
///      "description": "The entries in the order the hashing function receives them, deliberately not sorted in some vectors: the function sorts them by path bytes. `category` is ignored.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/RevisionKeyEntry"
///      }
///    },
///    "expected": {
///      "description": "Expected values.",
///      "$ref": "#/$defs/RevisionKeyHashingExpected"
///    },
///    "name": {
///      "description": "Unique vector name.",
///      "$ref": "#/$defs/RevisionKeyVectorName"
///    },
///    "object_format": {
///      "description": "Object format; hashed.",
///      "$ref": "#/$defs/RevisionKeyObjectFormat"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyHashingVector {
    ///Unique vector name.
    pub name: RevisionKeyVectorName,
    ///What the vector exercises.
    pub description: RevisionKeyHashingVectorDescription,
    ///Object format; hashed.
    pub object_format: RevisionKeyObjectFormat,
    ///The effective config.
    pub config: RevisionKeyEffectiveConfigA1,
    ///The entries in the order the hashing function receives them, deliberately not sorted in some vectors: the function sorts them by path bytes. `category` is ignored.
    pub entries: ::std::vec::Vec<RevisionKeyEntry>,
    ///Expected values.
    pub expected: RevisionKeyHashingExpected,
}
///What the vector exercises.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What the vector exercises.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct RevisionKeyHashingVectorDescription(::std::string::String);
impl ::std::ops::Deref for RevisionKeyHashingVectorDescription {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RevisionKeyHashingVectorDescription> for ::std::string::String {
    fn from(value: RevisionKeyHashingVectorDescription) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for RevisionKeyHashingVectorDescription {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeyHashingVectorDescription {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeyHashingVectorDescription {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeyHashingVectorDescription {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for RevisionKeyHashingVectorDescription {
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
///Lowercase hexadecimal bytes, two characters per byte.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Lowercase hexadecimal bytes, two characters per byte.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct RevisionKeyHex(pub ::std::string::String);
impl ::std::ops::Deref for RevisionKeyHex {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RevisionKeyHex> for ::std::string::String {
    fn from(value: RevisionKeyHex) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for RevisionKeyHex {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for RevisionKeyHex {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for RevisionKeyHex {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///One record of `git ls-tree -r -z --full-tree <commit>`: `<mode> SP <type> SP <object> TAB <path> NUL`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One record of `git ls-tree -r -z --full-tree <commit>`: `<mode> SP <type> SP <object> TAB <path> NUL`.",
///  "type": "object",
///  "required": [
///    "mode",
///    "object_id",
///    "path",
///    "type"
///  ],
///  "properties": {
///    "mode": {
///      "description": "Mode column.",
///      "$ref": "#/$defs/RevisionKeyListingMode"
///    },
///    "object_id": {
///      "description": "Object column.",
///      "$ref": "#/$defs/GitObjectId"
///    },
///    "path": {
///      "description": "Path column: the raw path bytes decoded as UTF-8. Not necessarily a RepoPath (an `unrepresentable-path` vector holds one that is not).",
///      "type": "string",
///      "minLength": 1
///    },
///    "type": {
///      "description": "Type column.",
///      "$ref": "#/$defs/RevisionKeyListingType"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyListingEntry {
    ///Mode column.
    pub mode: RevisionKeyListingMode,
    ///Type column.
    #[serde(rename = "type")]
    pub type_: RevisionKeyListingType,
    ///Object column.
    pub object_id: GitObjectId,
    ///Path column: the raw path bytes decoded as UTF-8. Not necessarily a RepoPath (an `unrepresentable-path` vector holds one that is not).
    pub path: RevisionKeyListingEntryPath,
}
///Path column: the raw path bytes decoded as UTF-8. Not necessarily a RepoPath (an `unrepresentable-path` vector holds one that is not).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Path column: the raw path bytes decoded as UTF-8. Not necessarily a RepoPath (an `unrepresentable-path` vector holds one that is not).",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct RevisionKeyListingEntryPath(::std::string::String);
impl ::std::ops::Deref for RevisionKeyListingEntryPath {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RevisionKeyListingEntryPath> for ::std::string::String {
    fn from(value: RevisionKeyListingEntryPath) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for RevisionKeyListingEntryPath {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeyListingEntryPath {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeyListingEntryPath {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeyListingEntryPath {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for RevisionKeyListingEntryPath {
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
///A git tree mode as `git ls-tree` prints it: six octal digits.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A git tree mode as `git ls-tree` prints it: six octal digits.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct RevisionKeyListingMode(pub ::std::string::String);
impl ::std::ops::Deref for RevisionKeyListingMode {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RevisionKeyListingMode> for ::std::string::String {
    fn from(value: RevisionKeyListingMode) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for RevisionKeyListingMode {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for RevisionKeyListingMode {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for RevisionKeyListingMode {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///Object type column of a `git ls-tree` record.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Object type column of a `git ls-tree` record.",
///  "type": "string",
///  "enum": [
///    "blob",
///    "commit",
///    "tree"
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
pub enum RevisionKeyListingType {
    #[serde(rename = "blob")]
    Blob,
    #[serde(rename = "commit")]
    Commit,
    #[serde(rename = "tree")]
    Tree,
}
impl ::std::fmt::Display for RevisionKeyListingType {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Blob => f.write_str("blob"),
            Self::Commit => f.write_str("commit"),
            Self::Tree => f.write_str("tree"),
        }
    }
}
impl ::std::str::FromStr for RevisionKeyListingType {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "blob" => Ok(Self::Blob),
            "commit" => Ok(Self::Commit),
            "tree" => Ok(Self::Tree),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeyListingType {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeyListingType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeyListingType {
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
///How the keys of related selection vectors compare.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How the keys of related selection vectors compare.",
///  "type": "string",
///  "enum": [
///    "same-key",
///    "different-key"
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
pub enum RevisionKeyRelationKind {
    #[serde(rename = "same-key")]
    SameKey,
    #[serde(rename = "different-key")]
    DifferentKey,
}
impl ::std::fmt::Display for RevisionKeyRelationKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::SameKey => f.write_str("same-key"),
            Self::DifferentKey => f.write_str("different-key"),
        }
    }
}
impl ::std::str::FromStr for RevisionKeyRelationKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "same-key" => Ok(Self::SameKey),
            "different-key" => Ok(Self::DifferentKey),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeyRelationKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeyRelationKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeyRelationKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///Expected result of a selection vector that succeeds.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Expected result of a selection vector that succeeds.",
///  "type": "object",
///  "required": [
///    "config_canonical",
///    "config_digest",
///    "counts",
///    "entries",
///    "kind",
///    "revision_key"
///  ],
///  "properties": {
///    "config_canonical": {
///      "description": "The canonical config bytes as text (revision-key.md, \"Canonical config bytes\").",
///      "type": "string",
///      "minLength": 1
///    },
///    "config_digest": {
///      "description": "SHA-256 of the canonical config bytes.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "counts": {
///      "description": "Per-category counts of `entries`.",
///      "$ref": "#/$defs/RevisionKeyCounts"
///    },
///    "entries": {
///      "description": "The selected entries, sorted by `path` in code point order (UTF-8 byte order).",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/RevisionKeyEntry"
///      }
///    },
///    "kind": {
///      "description": "Variant tag.",
///      "type": "string",
///      "const": "selected"
///    },
///    "revision_key": {
///      "description": "The expected revision key.",
///      "$ref": "#/$defs/Sha256Hex"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeySelectedOutcome {
    ///Variant tag.
    pub kind: ::std::string::String,
    ///The selected entries, sorted by `path` in code point order (UTF-8 byte order).
    pub entries: ::std::vec::Vec<RevisionKeyEntry>,
    ///Per-category counts of `entries`.
    pub counts: RevisionKeyCounts,
    ///The canonical config bytes as text (revision-key.md, "Canonical config bytes").
    pub config_canonical: RevisionKeySelectedOutcomeConfigCanonical,
    ///SHA-256 of the canonical config bytes.
    pub config_digest: Sha256Hex,
    ///The expected revision key.
    pub revision_key: Sha256Hex,
}
///The canonical config bytes as text (revision-key.md, "Canonical config bytes").
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The canonical config bytes as text (revision-key.md, \"Canonical config bytes\").",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct RevisionKeySelectedOutcomeConfigCanonical(::std::string::String);
impl ::std::ops::Deref for RevisionKeySelectedOutcomeConfigCanonical {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RevisionKeySelectedOutcomeConfigCanonical> for ::std::string::String {
    fn from(value: RevisionKeySelectedOutcomeConfigCanonical) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for RevisionKeySelectedOutcomeConfigCanonical {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeySelectedOutcomeConfigCanonical {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeySelectedOutcomeConfigCanonical {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeySelectedOutcomeConfigCanonical {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for RevisionKeySelectedOutcomeConfigCanonical {
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
///Expected outcome of a selection vector.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Expected outcome of a selection vector.",
///  "oneOf": [
///    {
///      "description": "The computation succeeds.",
///      "$ref": "#/$defs/RevisionKeySelectedOutcome"
///    },
///    {
///      "description": "The computation fails with a code.",
///      "$ref": "#/$defs/RevisionKeyErrorOutcome"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum RevisionKeySelectionOutcome {
    SelectedOutcome(RevisionKeySelectedOutcome),
    ErrorOutcome(RevisionKeyErrorOutcome),
}
impl ::std::convert::From<RevisionKeySelectedOutcome> for RevisionKeySelectionOutcome {
    fn from(value: RevisionKeySelectedOutcome) -> Self {
        Self::SelectedOutcome(value)
    }
}
impl ::std::convert::From<RevisionKeyErrorOutcome> for RevisionKeySelectionOutcome {
    fn from(value: RevisionKeyErrorOutcome) -> Self {
        Self::ErrorOutcome(value)
    }
}
///Layer 1: from a full listing and a config to the selected entries and the key.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Layer 1: from a full listing and a config to the selected entries and the key.",
///  "type": "object",
///  "required": [
///    "config",
///    "description",
///    "expected",
///    "listing",
///    "name",
///    "object_format",
///    "scenario"
///  ],
///  "properties": {
///    "config": {
///      "description": "The effective config given to the computation. Schema-valid, but may break a semantic rule (an `error` outcome).",
///      "$ref": "#/$defs/RevisionKeyEffectiveConfigA1"
///    },
///    "description": {
///      "description": "What the vector exercises.",
///      "type": "string",
///      "minLength": 1
///    },
///    "expected": {
///      "description": "Expected outcome.",
///      "$ref": "#/$defs/RevisionKeySelectionOutcome"
///    },
///    "listing": {
///      "description": "The full listing, record for record in the order `git ls-tree -r -z --full-tree` printed it for a real repository.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/RevisionKeyListingEntry"
///      }
///    },
///    "name": {
///      "description": "Unique vector name.",
///      "$ref": "#/$defs/RevisionKeyVectorName"
///    },
///    "object_format": {
///      "description": "Object format of the repository.",
///      "$ref": "#/$defs/RevisionKeyObjectFormat"
///    },
///    "scenario": {
///      "description": "The scratch repository the listing was printed from; vectors of one scenario share a repository at different commits.",
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
pub struct RevisionKeySelectionVector {
    ///Unique vector name.
    pub name: RevisionKeyVectorName,
    ///The scratch repository the listing was printed from; vectors of one scenario share a repository at different commits.
    pub scenario: RevisionKeySelectionVectorScenario,
    ///What the vector exercises.
    pub description: RevisionKeySelectionVectorDescription,
    ///Object format of the repository.
    pub object_format: RevisionKeyObjectFormat,
    ///The full listing, record for record in the order `git ls-tree -r -z --full-tree` printed it for a real repository.
    pub listing: ::std::vec::Vec<RevisionKeyListingEntry>,
    ///The effective config given to the computation. Schema-valid, but may break a semantic rule (an `error` outcome).
    pub config: RevisionKeyEffectiveConfigA1,
    ///Expected outcome.
    pub expected: RevisionKeySelectionOutcome,
}
///What the vector exercises.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What the vector exercises.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct RevisionKeySelectionVectorDescription(::std::string::String);
impl ::std::ops::Deref for RevisionKeySelectionVectorDescription {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RevisionKeySelectionVectorDescription> for ::std::string::String {
    fn from(value: RevisionKeySelectionVectorDescription) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for RevisionKeySelectionVectorDescription {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeySelectionVectorDescription {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeySelectionVectorDescription {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeySelectionVectorDescription {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for RevisionKeySelectionVectorDescription {
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
///The scratch repository the listing was printed from; vectors of one scenario share a repository at different commits.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The scratch repository the listing was printed from; vectors of one scenario share a repository at different commits.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct RevisionKeySelectionVectorScenario(::std::string::String);
impl ::std::ops::Deref for RevisionKeySelectionVectorScenario {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RevisionKeySelectionVectorScenario> for ::std::string::String {
    fn from(value: RevisionKeySelectionVectorScenario) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for RevisionKeySelectionVectorScenario {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeySelectionVectorScenario {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeySelectionVectorScenario {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeySelectionVectorScenario {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for RevisionKeySelectionVectorScenario {
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
///Name of a test vector: lowercase kebab-case, unique within its array.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Name of a test vector: lowercase kebab-case, unique within its array.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct RevisionKeyVectorName(pub ::std::string::String);
impl ::std::ops::Deref for RevisionKeyVectorName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RevisionKeyVectorName> for ::std::string::String {
    fn from(value: RevisionKeyVectorName) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for RevisionKeyVectorName {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for RevisionKeyVectorName {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for RevisionKeyVectorName {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///An assertion about the keys of two or more selection vectors, stating the intent behind them.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "An assertion about the keys of two or more selection vectors, stating the intent behind them.",
///  "type": "object",
///  "required": [
///    "reason",
///    "relation",
///    "vectors"
///  ],
///  "properties": {
///    "reason": {
///      "description": "Why the keys compare this way.",
///      "type": "string",
///      "minLength": 1
///    },
///    "relation": {
///      "description": "Same or different keys.",
///      "$ref": "#/$defs/RevisionKeyRelationKind"
///    },
///    "vectors": {
///      "description": "Names of `selected` selection vectors, sorted in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/RevisionKeyVectorName"
///      },
///      "minItems": 2
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyVectorRelation {
    ///Same or different keys.
    pub relation: RevisionKeyRelationKind,
    ///Names of `selected` selection vectors, sorted in code point order.
    pub vectors: ::std::vec::Vec<RevisionKeyVectorName>,
    ///Why the keys compare this way.
    pub reason: RevisionKeyVectorRelationReason,
}
///Why the keys compare this way.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Why the keys compare this way.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct RevisionKeyVectorRelationReason(::std::string::String);
impl ::std::ops::Deref for RevisionKeyVectorRelationReason {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RevisionKeyVectorRelationReason> for ::std::string::String {
    fn from(value: RevisionKeyVectorRelationReason) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for RevisionKeyVectorRelationReason {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeyVectorRelationReason {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeyVectorRelationReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeyVectorRelationReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for RevisionKeyVectorRelationReason {
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
/**The revision-key test vectors (`revision-key-vectors.json`). Expected
values were computed by two independent implementations (Python and Node)
that agree byte for byte; WP-K's Python and WP-B's Rust references must
reproduce every value.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.revision_key.vectors:a1",
///  "title": "RevisionKeyVectorsA1",
///  "description": "The revision-key test vectors (`revision-key-vectors.json`). Expected\nvalues were computed by two independent implementations (Python and Node)\nthat agree byte for byte; WP-K's Python and WP-B's Rust references must\nreproduce every value.",
///  "type": "object",
///  "required": [
///    "hashing",
///    "listing_git_version",
///    "relations",
///    "schema",
///    "selection"
///  ],
///  "properties": {
///    "hashing": {
///      "description": "Layer 2 vectors, sorted by `name` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/RevisionKeyHashingVector"
///      }
///    },
///    "listing_git_version": {
///      "description": "Version of git that printed every listing, as `git --version` reports it (for example `2.55.0`).",
///      "type": "string",
///      "minLength": 1
///    },
///    "relations": {
///      "description": "Key assertions over selection vectors, sorted by `relation`, then by `vectors` element by element, in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/RevisionKeyVectorRelation"
///      }
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.revision_key.vectors.a1"
///    },
///    "selection": {
///      "description": "Layer 1 vectors, sorted by `name` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/RevisionKeySelectionVector"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RevisionKeyVectorsA1 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///Version of git that printed every listing, as `git --version` reports it (for example `2.55.0`).
    pub listing_git_version: RevisionKeyVectorsA1ListingGitVersion,
    ///Layer 1 vectors, sorted by `name` in code point order.
    pub selection: ::std::vec::Vec<RevisionKeySelectionVector>,
    ///Layer 2 vectors, sorted by `name` in code point order.
    pub hashing: ::std::vec::Vec<RevisionKeyHashingVector>,
    ///Key assertions over selection vectors, sorted by `relation`, then by `vectors` element by element, in code point order.
    pub relations: ::std::vec::Vec<RevisionKeyVectorRelation>,
}
///Version of git that printed every listing, as `git --version` reports it (for example `2.55.0`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Version of git that printed every listing, as `git --version` reports it (for example `2.55.0`).",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct RevisionKeyVectorsA1ListingGitVersion(::std::string::String);
impl ::std::ops::Deref for RevisionKeyVectorsA1ListingGitVersion {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RevisionKeyVectorsA1ListingGitVersion> for ::std::string::String {
    fn from(value: RevisionKeyVectorsA1ListingGitVersion) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for RevisionKeyVectorsA1ListingGitVersion {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for RevisionKeyVectorsA1ListingGitVersion {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for RevisionKeyVectorsA1ListingGitVersion {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for RevisionKeyVectorsA1ListingGitVersion {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for RevisionKeyVectorsA1ListingGitVersion {
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
impl<'de> ::serde::Deserialize<'de> for RevisionKeySelectionOutcome {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("selected") {
            return ::serde_json::from_value::<RevisionKeySelectedOutcome>(value)
                .map(Self::SelectedOutcome)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("error") {
            return ::serde_json::from_value::<RevisionKeyErrorOutcome>(value)
                .map(Self::ErrorOutcome)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum RevisionKeySelectionOutcome",
        ))
    }
}
