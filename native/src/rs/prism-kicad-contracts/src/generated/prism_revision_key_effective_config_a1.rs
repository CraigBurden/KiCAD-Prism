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
///  "$id": "urn:prism:schema:prism.revision_key.effective_config:a1",
///  "title": "RevisionKeyEffectiveConfigA1",
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
