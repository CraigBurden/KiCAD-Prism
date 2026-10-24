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
/**`projections/project.json`: the project file's facts, the header of every
schematic file of the hierarchy and of the board, and every path
reference they make. Empty form: a project without a schematic or a board
lists only what the files it has state.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.project:a0",
///  "title": "ProjectA0",
///  "description": "`projections/project.json`: the project file's facts, the header of every\nschematic file of the hierarchy and of the board, and every path\nreference they make. Empty form: a project without a schematic or a board\nlists only what the files it has state.",
///  "type": "object",
///  "required": [
///    "documents",
///    "netClasses",
///    "projectFile",
///    "projectName",
///    "references",
///    "schema",
///    "textVariables"
///  ],
///  "properties": {
///    "documents": {
///      "description": "The root schematic, every schematic file reached from it (each once, however many sheets instantiate it), and the board, sorted by `path` in code point order. Empty when the project has neither a schematic nor a board.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/ProjectDocument"
///      }
///    },
///    "netClasses": {
///      "description": "The `.kicad_pro` net classes, in file order (`net_settings.classes[]`). Empty when the file has none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/ProjectNetClass"
///      }
///    },
///    "projectFile": {
///      "description": "The project's anchor: the repository-relative path of the `.kicad_pro`, equal to the manifest's `config.project_file`.",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "projectName": {
///      "description": "KiCad's `${PROJECTNAME}`: the `.kicad_pro` file name without its last suffix.",
///      "type": "string",
///      "minLength": 1
///    },
///    "references": {
///      "description": "Every path reference of the scanned files, sorted by `documentPath`,\nthen `kind`, then `raw`, then `sheetUuid`, then `field`, then\n`libraryName`, then the embedded target's `footprintUuid`, each in code\npoint order, an absent value before any present one. No two entries are\nequal. The scanned files are the `.kicad_pro`, `documents`, the\nproject's `fp-lib-table` and `sym-lib-table`, and every drawing-sheet\nfile a `drawing-sheet` reference resolves to inside the sources.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/ProjectPathReference"
///      }
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.project.a0"
///    },
///    "textVariables": {
///      "description": "The `.kicad_pro` `text_variables`, keyed by variable name, keys in code point order; values as written. Empty when the file has none.",
///      "$ref": "#/$defs/RecordString"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ProjectA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///The project's anchor: the repository-relative path of the `.kicad_pro`, equal to the manifest's `config.project_file`.
    #[serde(rename = "projectFile")]
    pub project_file: RepoPath,
    ///KiCad's `${PROJECTNAME}`: the `.kicad_pro` file name without its last suffix.
    #[serde(rename = "projectName")]
    pub project_name: ProjectA0ProjectName,
    ///The `.kicad_pro` `text_variables`, keyed by variable name, keys in code point order; values as written. Empty when the file has none.
    #[serde(rename = "textVariables")]
    pub text_variables: RecordString,
    ///The `.kicad_pro` net classes, in file order (`net_settings.classes[]`). Empty when the file has none.
    #[serde(rename = "netClasses")]
    pub net_classes: ::std::vec::Vec<ProjectNetClass>,
    ///The root schematic, every schematic file reached from it (each once, however many sheets instantiate it), and the board, sorted by `path` in code point order. Empty when the project has neither a schematic nor a board.
    pub documents: ::std::vec::Vec<ProjectDocument>,
    /**Every path reference of the scanned files, sorted by `documentPath`,
    then `kind`, then `raw`, then `sheetUuid`, then `field`, then
    `libraryName`, then the embedded target's `footprintUuid`, each in code
    point order, an absent value before any present one. No two entries are
    equal. The scanned files are the `.kicad_pro`, `documents`, the
    project's `fp-lib-table` and `sym-lib-table`, and every drawing-sheet
    file a `drawing-sheet` reference resolves to inside the sources.*/
    pub references: ::std::vec::Vec<ProjectPathReference>,
}
///KiCad's `${PROJECTNAME}`: the `.kicad_pro` file name without its last suffix.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad's `${PROJECTNAME}`: the `.kicad_pro` file name without its last suffix.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectA0ProjectName(::std::string::String);
impl ::std::ops::Deref for ProjectA0ProjectName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectA0ProjectName> for ::std::string::String {
    fn from(value: ProjectA0ProjectName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectA0ProjectName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectA0ProjectName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectA0ProjectName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectA0ProjectName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectA0ProjectName {
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
///The reference is an absolute path after expansion (`/…`, or a drive letter such as `C:/…`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The reference is an absolute path after expansion (`/…`, or a drive letter such as `C:/…`).",
///  "type": "object",
///  "required": [
///    "kind",
///    "path"
///  ],
///  "properties": {
///    "kind": {
///      "description": "Variant tag.",
///      "type": "string",
///      "const": "absolute"
///    },
///    "path": {
///      "description": "The expanded path with every `\\` replaced by `/` and normalized lexically, as the source file states it; never a path of the build host.",
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
pub struct ProjectAbsoluteTarget {
    ///Variant tag.
    pub kind: ::std::string::String,
    ///The expanded path with every `\` replaced by `/` and normalized lexically, as the source file states it; never a path of the build host.
    pub path: ProjectAbsoluteTargetPath,
}
///The expanded path with every `\` replaced by `/` and normalized lexically, as the source file states it; never a path of the build host.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The expanded path with every `\\` replaced by `/` and normalized lexically, as the source file states it; never a path of the build host.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectAbsoluteTargetPath(::std::string::String);
impl ::std::ops::Deref for ProjectAbsoluteTargetPath {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectAbsoluteTargetPath> for ::std::string::String {
    fn from(value: ProjectAbsoluteTargetPath) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectAbsoluteTargetPath {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectAbsoluteTargetPath {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectAbsoluteTargetPath {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectAbsoluteTargetPath {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectAbsoluteTargetPath {
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
///One schematic file of the hierarchy, or the board.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One schematic file of the hierarchy, or the board.",
///  "type": "object",
///  "required": [
///    "kind",
///    "path",
///    "properties"
///  ],
///  "properties": {
///    "expandedTitleBlock": {
///      "description": "`titleBlock` with its text variables expanded by today's rule\n(`backend/app/services/kicad_text_variables.py`; field map,\n\"Title-block expansion\"): `${NAME}` takes, from lowest to highest\nprecedence, this title block's fields (`TITLE`, `ISSUE_DATE`,\n`REVISION`, `COMPANY`, `COMMENT1`…`COMMENT9`, the empty string for an\nabsent one), this file's `properties`, the project's `textVariables`,\n`PROJECTNAME` and `FILENAME` (this file's name); a reference to anything\nelse (`${CURRENT_DATE}`, `${#}`) stays as written. Present exactly when\n`titleBlock` is. It has the same fields, except that a field or comment\nwhose expansion is empty is absent.",
///      "$ref": "#/$defs/ProjectTitleBlock"
///    },
///    "formatVersion": {
///      "description": "The file's `(version N)`. Absent when the form is missing or not an integer.",
///      "$ref": "#/$defs/ProjectFileFormatVersion"
///    },
///    "generator": {
///      "description": "The file's `(generator …)`, quoted or bare, for example `eeschema` or `pcbnew`. Absent when the form is missing.",
///      "type": "string"
///    },
///    "generatorVersion": {
///      "description": "The file's `(generator_version \"…\")`, for example `9.0` (KiCad 8 and later). Absent when the form is missing.",
///      "type": "string"
///    },
///    "kind": {
///      "description": "Root schematic, other schematic, or board.",
///      "$ref": "#/$defs/ProjectDocumentKind"
///    },
///    "path": {
///      "description": "The file's repository-relative path.",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "properties": {
///      "description": "The file's top-level `(property \"<name>\" \"<value>\")` forms, keyed by name; KiCad 8 and later write the project's text variables into a board this way. Keys in code point order; an empty name is skipped; when a name repeats, the last form wins. Empty for a schematic, which has no top-level properties.",
///      "$ref": "#/$defs/RecordString"
///    },
///    "titleBlock": {
///      "description": "The file's own `(title_block …)` as written. Absent when the file has none.",
///      "$ref": "#/$defs/ProjectTitleBlock"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ProjectDocument {
    ///The file's repository-relative path.
    pub path: RepoPath,
    ///Root schematic, other schematic, or board.
    pub kind: ProjectDocumentKind,
    ///The file's `(version N)`. Absent when the form is missing or not an integer.
    #[serde(
        rename = "formatVersion",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub format_version: ::std::option::Option<ProjectFileFormatVersion>,
    ///The file's `(generator …)`, quoted or bare, for example `eeschema` or `pcbnew`. Absent when the form is missing.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub generator: ::std::option::Option<::std::string::String>,
    ///The file's `(generator_version "…")`, for example `9.0` (KiCad 8 and later). Absent when the form is missing.
    #[serde(
        rename = "generatorVersion",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub generator_version: ::std::option::Option<::std::string::String>,
    ///The file's own `(title_block …)` as written. Absent when the file has none.
    #[serde(
        rename = "titleBlock",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub title_block: ::std::option::Option<ProjectTitleBlock>,
    /**`titleBlock` with its text variables expanded by today's rule
    (`backend/app/services/kicad_text_variables.py`; field map,
    "Title-block expansion"): `${NAME}` takes, from lowest to highest
    precedence, this title block's fields (`TITLE`, `ISSUE_DATE`,
    `REVISION`, `COMPANY`, `COMMENT1`…`COMMENT9`, the empty string for an
    absent one), this file's `properties`, the project's `textVariables`,
    `PROJECTNAME` and `FILENAME` (this file's name); a reference to anything
    else (`${CURRENT_DATE}`, `${#}`) stays as written. Present exactly when
    `titleBlock` is. It has the same fields, except that a field or comment
    whose expansion is empty is absent.*/
    #[serde(
        rename = "expandedTitleBlock",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub expanded_title_block: ::std::option::Option<ProjectTitleBlock>,
    ///The file's top-level `(property "<name>" "<value>")` forms, keyed by name; KiCad 8 and later write the project's text variables into a board this way. Keys in code point order; an empty name is skipped; when a name repeats, the last form wins. Empty for a schematic, which has no top-level properties.
    pub properties: RecordString,
}
///What a project document is.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What a project document is.",
///  "type": "string",
///  "enum": [
///    "root-schematic",
///    "schematic",
///    "board"
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
pub enum ProjectDocumentKind {
    #[serde(rename = "root-schematic")]
    RootSchematic,
    #[serde(rename = "schematic")]
    Schematic,
    #[serde(rename = "board")]
    Board,
}
impl ::std::fmt::Display for ProjectDocumentKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::RootSchematic => f.write_str("root-schematic"),
            Self::Schematic => f.write_str("schematic"),
            Self::Board => f.write_str("board"),
        }
    }
}
impl ::std::str::FromStr for ProjectDocumentKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "root-schematic" => Ok(Self::RootSchematic),
            "schematic" => Ok(Self::Schematic),
            "board" => Ok(Self::Board),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for ProjectDocumentKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectDocumentKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectDocumentKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///The `(type …)` of a `(file …)` in an `(embedded_files …)` form, spelled as KiCad writes it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The `(type …)` of a `(file …)` in an `(embedded_files …)` form, spelled as KiCad writes it.",
///  "type": "string",
///  "enum": [
///    "model",
///    "worksheet",
///    "datasheet",
///    "font",
///    "other"
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
pub enum ProjectEmbeddedFileType {
    #[serde(rename = "model")]
    Model,
    #[serde(rename = "worksheet")]
    Worksheet,
    #[serde(rename = "datasheet")]
    Datasheet,
    #[serde(rename = "font")]
    Font,
    #[serde(rename = "other")]
    Other,
}
impl ::std::fmt::Display for ProjectEmbeddedFileType {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Model => f.write_str("model"),
            Self::Worksheet => f.write_str("worksheet"),
            Self::Datasheet => f.write_str("datasheet"),
            Self::Font => f.write_str("font"),
            Self::Other => f.write_str("other"),
        }
    }
}
impl ::std::str::FromStr for ProjectEmbeddedFileType {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "model" => Ok(Self::Model),
            "worksheet" => Ok(Self::Worksheet),
            "datasheet" => Ok(Self::Datasheet),
            "font" => Ok(Self::Font),
            "other" => Ok(Self::Other),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for ProjectEmbeddedFileType {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectEmbeddedFileType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectEmbeddedFileType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///The reference is `kicad-embed://<name>` and an embedded file of the lookup order holds that name.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The reference is `kicad-embed://<name>` and an embedded file of the lookup order holds that name.",
///  "type": "object",
///  "required": [
///    "documentPath",
///    "fileType",
///    "kind",
///    "name"
///  ],
///  "properties": {
///    "documentPath": {
///      "description": "The repository-relative path of the document whose `(embedded_files …)` form holds it: the board, or the root schematic for the schematic drawing sheet.",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "fileType": {
///      "description": "The embedded file's `(type …)`.",
///      "$ref": "#/$defs/ProjectEmbeddedFileType"
///    },
///    "footprintUuid": {
///      "description": "UUID of the footprint whose own `(embedded_files …)` holds it. Absent when the document-level form holds it. A model is looked up in its footprint's embedded files first, then in the board's.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "kind": {
///      "description": "Variant tag.",
///      "type": "string",
///      "const": "embedded"
///    },
///    "name": {
///      "description": "The embedded file's name, the text after `kicad-embed://`, equal to its `(name …)`.",
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
pub struct ProjectEmbeddedTarget {
    ///Variant tag.
    pub kind: ::std::string::String,
    ///The embedded file's name, the text after `kicad-embed://`, equal to its `(name …)`.
    pub name: ProjectEmbeddedTargetName,
    ///The repository-relative path of the document whose `(embedded_files …)` form holds it: the board, or the root schematic for the schematic drawing sheet.
    #[serde(rename = "documentPath")]
    pub document_path: RepoPath,
    ///UUID of the footprint whose own `(embedded_files …)` holds it. Absent when the document-level form holds it. A model is looked up in its footprint's embedded files first, then in the board's.
    #[serde(
        rename = "footprintUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub footprint_uuid: ::std::option::Option<KiCadUuid>,
    ///The embedded file's `(type …)`.
    #[serde(rename = "fileType")]
    pub file_type: ProjectEmbeddedFileType,
}
///The embedded file's name, the text after `kicad-embed://`, equal to its `(name …)`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The embedded file's name, the text after `kicad-embed://`, equal to its `(name …)`.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectEmbeddedTargetName(::std::string::String);
impl ::std::ops::Deref for ProjectEmbeddedTargetName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectEmbeddedTargetName> for ::std::string::String {
    fn from(value: ProjectEmbeddedTargetName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectEmbeddedTargetName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectEmbeddedTargetName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectEmbeddedTargetName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectEmbeddedTargetName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectEmbeddedTargetName {
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
/**A KiCad s-expression file format version, the integer of the file's
`(version N)` form: a date written as YYYYMMDD, for example `20241229`
(KiCad 9) or `20260206` (KiCad 10).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A KiCad s-expression file format version, the integer of the file's\n`(version N)` form: a date written as YYYYMMDD, for example `20241229`\n(KiCad 9) or `20260206` (KiCad 10).",
///  "type": "integer",
///  "minimum": 1.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct ProjectFileFormatVersion(pub ::std::num::NonZeroU64);
impl ::std::ops::Deref for ProjectFileFormatVersion {
    type Target = ::std::num::NonZeroU64;
    fn deref(&self) -> &::std::num::NonZeroU64 {
        &self.0
    }
}
impl ::std::convert::From<ProjectFileFormatVersion> for ::std::num::NonZeroU64 {
    fn from(value: ProjectFileFormatVersion) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::num::NonZeroU64> for ProjectFileFormatVersion {
    fn from(value: ::std::num::NonZeroU64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for ProjectFileFormatVersion {
    type Err = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectFileFormatVersion {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for ProjectFileFormatVersion {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for ProjectFileFormatVersion {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**One of KiCad's own library directories, which the KiCad installation
defines through predefined path variables (`env_vars.cpp`). `<N>` is one
or more ASCII digits, any version.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One of KiCad's own library directories, which the KiCad installation\ndefines through predefined path variables (`env_vars.cpp`). `<N>` is one\nor more ASCII digits, any version.",
///  "type": "string",
///  "enum": [
///    "model-3d",
///    "symbol",
///    "footprint",
///    "template",
///    "third-party",
///    "user-template"
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
pub enum ProjectKiCadLibrary {
    #[serde(rename = "model-3d")]
    Model3d,
    #[serde(rename = "symbol")]
    Symbol,
    #[serde(rename = "footprint")]
    Footprint,
    #[serde(rename = "template")]
    Template,
    #[serde(rename = "third-party")]
    ThirdParty,
    #[serde(rename = "user-template")]
    UserTemplate,
}
impl ::std::fmt::Display for ProjectKiCadLibrary {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Model3d => f.write_str("model-3d"),
            Self::Symbol => f.write_str("symbol"),
            Self::Footprint => f.write_str("footprint"),
            Self::Template => f.write_str("template"),
            Self::ThirdParty => f.write_str("third-party"),
            Self::UserTemplate => f.write_str("user-template"),
        }
    }
}
impl ::std::str::FromStr for ProjectKiCadLibrary {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "model-3d" => Ok(Self::Model3d),
            "symbol" => Ok(Self::Symbol),
            "footprint" => Ok(Self::Footprint),
            "template" => Ok(Self::Template),
            "third-party" => Ok(Self::ThirdParty),
            "user-template" => Ok(Self::UserTemplate),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for ProjectKiCadLibrary {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectKiCadLibrary {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectKiCadLibrary {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///The reference starts with one of KiCad's library variables, or names one as a `:<alias>:` form.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The reference starts with one of KiCad's library variables, or names one as a `:<alias>:` form.",
///  "type": "object",
///  "required": [
///    "kind",
///    "library",
///    "relativePath",
///    "variable"
///  ],
///  "properties": {
///    "kind": {
///      "description": "Variant tag.",
///      "type": "string",
///      "const": "kicad-library"
///    },
///    "library": {
///      "description": "Which library directory the variable names.",
///      "$ref": "#/$defs/ProjectKiCadLibrary"
///    },
///    "relativePath": {
///      "description": "The rest of the path below that directory, normalized lexically, for example `Resistor_SMD.3dshapes/R_0603_1608Metric.step`.",
///      "$ref": "#/$defs/ProjectLibraryRelativePath"
///    },
///    "variable": {
///      "description": "The library variable as written, for example `KICAD9_3DMODEL_DIR` or `KISYS3DMOD`. A KiCad of another major version substitutes its own directory when this one is not set in its environment (`common.cpp`, `KIwxExpandEnvVars`); readers apply that rule, this document does not.",
///      "$ref": "#/$defs/ProjectVariableName"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ProjectKiCadLibraryTarget {
    ///Variant tag.
    pub kind: ::std::string::String,
    ///The library variable as written, for example `KICAD9_3DMODEL_DIR` or `KISYS3DMOD`. A KiCad of another major version substitutes its own directory when this one is not set in its environment (`common.cpp`, `KIwxExpandEnvVars`); readers apply that rule, this document does not.
    pub variable: ProjectVariableName,
    ///Which library directory the variable names.
    pub library: ProjectKiCadLibrary,
    ///The rest of the path below that directory, normalized lexically, for example `Resistor_SMD.3dshapes/R_0603_1608Metric.step`.
    #[serde(rename = "relativePath")]
    pub relative_path: ProjectLibraryRelativePath,
}
/**A path below one of KiCad's library directories: `/`-separated, relative,
no empty, `.` or `..` segment, no backslash and no `:`. The same
character rule as Common's RepoPath.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A path below one of KiCad's library directories: `/`-separated, relative,\nno empty, `.` or `..` segment, no backslash and no `:`. The same\ncharacter rule as Common's RepoPath.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct ProjectLibraryRelativePath(pub ::std::string::String);
impl ::std::ops::Deref for ProjectLibraryRelativePath {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectLibraryRelativePath> for ::std::string::String {
    fn from(value: ProjectLibraryRelativePath) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for ProjectLibraryRelativePath {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for ProjectLibraryRelativePath {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for ProjectLibraryRelativePath {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**One net class of the `.kicad_pro` (`net_settings.classes[]`). A value is
absent when the class does not state it: KiCad 9 and later then use the
`Default` class's value. Values are the file's millimetres converted to
nanometres (conventions.md §6).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One net class of the `.kicad_pro` (`net_settings.classes[]`). A value is\nabsent when the class does not state it: KiCad 9 and later then use the\n`Default` class's value. Values are the file's millimetres converted to\nnanometres (conventions.md §6).",
///  "type": "object",
///  "required": [
///    "name"
///  ],
///  "properties": {
///    "clearanceNm": {
///      "description": "`clearance`.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "diffPairGapNm": {
///      "description": "`diff_pair_gap`.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "diffPairWidthNm": {
///      "description": "`diff_pair_width`.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "name": {
///      "description": "The class name, `name`.",
///      "type": "string",
///      "minLength": 1
///    },
///    "trackWidthNm": {
///      "description": "`track_width`.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "viaDiameterNm": {
///      "description": "`via_diameter`.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "viaDrillNm": {
///      "description": "`via_drill`.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ProjectNetClass {
    ///The class name, `name`.
    pub name: ProjectNetClassName,
    ///`track_width`.
    #[serde(
        rename = "trackWidthNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub track_width_nm: ::std::option::Option<NonNegativeNanometres>,
    ///`clearance`.
    #[serde(
        rename = "clearanceNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub clearance_nm: ::std::option::Option<NonNegativeNanometres>,
    ///`diff_pair_width`.
    #[serde(
        rename = "diffPairWidthNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub diff_pair_width_nm: ::std::option::Option<NonNegativeNanometres>,
    ///`diff_pair_gap`.
    #[serde(
        rename = "diffPairGapNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub diff_pair_gap_nm: ::std::option::Option<NonNegativeNanometres>,
    ///`via_diameter`.
    #[serde(
        rename = "viaDiameterNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub via_diameter_nm: ::std::option::Option<NonNegativeNanometres>,
    ///`via_drill`.
    #[serde(
        rename = "viaDrillNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub via_drill_nm: ::std::option::Option<NonNegativeNanometres>,
}
///The class name, `name`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The class name, `name`.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectNetClassName(::std::string::String);
impl ::std::ops::Deref for ProjectNetClassName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectNetClassName> for ::std::string::String {
    fn from(value: ProjectNetClassName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectNetClassName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectNetClassName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectNetClassName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectNetClassName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectNetClassName {
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
///The reference climbs above the repository root: KiCad would read a file the commit does not hold.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The reference climbs above the repository root: KiCad would read a file the commit does not hold.",
///  "type": "object",
///  "required": [
///    "base",
///    "kind",
///    "path"
///  ],
///  "properties": {
///    "base": {
///      "description": "The directory the path was joined to.",
///      "$ref": "#/$defs/ProjectPathBase"
///    },
///    "kind": {
///      "description": "Variant tag.",
///      "type": "string",
///      "const": "outside-repository"
///    },
///    "path": {
///      "description": "The target relative to the repository root, normalized lexically: one or\nmore leading `..` segments, then the rest. Not a RepoPath, since it\nnames no file of the repository.",
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
pub struct ProjectOutsideRepositoryTarget {
    ///Variant tag.
    pub kind: ::std::string::String,
    /**The target relative to the repository root, normalized lexically: one or
    more leading `..` segments, then the rest. Not a RepoPath, since it
    names no file of the repository.*/
    pub path: ProjectOutsideRepositoryTargetPath,
    ///The directory the path was joined to.
    pub base: ProjectPathBase,
}
/**The target relative to the repository root, normalized lexically: one or
more leading `..` segments, then the rest. Not a RepoPath, since it
names no file of the repository.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The target relative to the repository root, normalized lexically: one or\nmore leading `..` segments, then the rest. Not a RepoPath, since it\nnames no file of the repository.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectOutsideRepositoryTargetPath(::std::string::String);
impl ::std::ops::Deref for ProjectOutsideRepositoryTargetPath {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectOutsideRepositoryTargetPath> for ::std::string::String {
    fn from(value: ProjectOutsideRepositoryTargetPath) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectOutsideRepositoryTargetPath {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectOutsideRepositoryTargetPath {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectOutsideRepositoryTargetPath {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectOutsideRepositoryTargetPath {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectOutsideRepositoryTargetPath {
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
///Which directory a relative or `${KIPRJMOD}` path was joined to.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Which directory a relative or `${KIPRJMOD}` path was joined to.",
///  "type": "string",
///  "enum": [
///    "project-variable",
///    "project-directory",
///    "document-directory"
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
pub enum ProjectPathBase {
    #[serde(rename = "project-variable")]
    ProjectVariable,
    #[serde(rename = "project-directory")]
    ProjectDirectory,
    #[serde(rename = "document-directory")]
    DocumentDirectory,
}
impl ::std::fmt::Display for ProjectPathBase {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::ProjectVariable => f.write_str("project-variable"),
            Self::ProjectDirectory => f.write_str("project-directory"),
            Self::DocumentDirectory => f.write_str("document-directory"),
        }
    }
}
impl ::std::str::FromStr for ProjectPathBase {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "project-variable" => Ok(Self::ProjectVariable),
            "project-directory" => Ok(Self::ProjectDirectory),
            "document-directory" => Ok(Self::DocumentDirectory),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for ProjectPathBase {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectPathBase {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectPathBase {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**One path reference: the text as written, the variables its expansion
used, and where it leads. The resolution algorithm is normative in
`field-maps/project.md`, "Resolution"; in short: variables are expanded
(`PROJECTNAME` and the project's text variables first, then `KIPRJMOD`
and KiCad's library variables, up to 8 rounds), `\` becomes `/`, and the
result is classified by its form.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One path reference: the text as written, the variables its expansion\nused, and where it leads. The resolution algorithm is normative in\n`field-maps/project.md`, \"Resolution\"; in short: variables are expanded\n(`PROJECTNAME` and the project's text variables first, then `KIPRJMOD`\nand KiCad's library variables, up to 8 rounds), `\\` becomes `/`, and the\nresult is classified by its form.",
///  "type": "object",
///  "required": [
///    "documentPath",
///    "kind",
///    "raw",
///    "target",
///    "variables"
///  ],
///  "properties": {
///    "documentPath": {
///      "description": "The repository-relative path of the file that holds the reference: the `.kicad_pro`, a schematic of the hierarchy, the board, a library table, or a drawing-sheet file.",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "field": {
///      "description": "Where in the file the text sits. Present exactly when `kind` is\n`drawing-sheet` or `text-path`. In the `.kicad_pro`, the RFC 6901 JSON\nPointer of the value (`/schematic/page_layout_descr_file`). In an\ns-expression file, the property name when the text is the value of a\n`(property \"<name>\" …)` form, otherwise the head token of the list the\ntext is an element of (`descr`).",
///      "type": "string",
///      "minLength": 1
///    },
///    "kind": {
///      "description": "Which setting or form holds the reference.",
///      "$ref": "#/$defs/ProjectReferenceKind"
///    },
///    "libraryName": {
///      "description": "The library nickname, the row's `(name …)`. Present exactly when `kind` is `footprint-library` or `symbol-library`; unique within its table.",
///      "type": "string",
///      "minLength": 1
///    },
///    "raw": {
///      "description": "The reference exactly as written, after s-expression or JSON string unescaping, `${KIPRJMOD}` and other variables unexpanded; never empty. Its resolved repository path, if any, is `target.path`.",
///      "type": "string",
///      "minLength": 1
///    },
///    "sheetName": {
///      "description": "The sheet's first `Sheetname` (or `Sheet name`) property as written. Present exactly when `kind` is `sheet-file` and that property has non-empty text.",
///      "type": "string",
///      "minLength": 1
///    },
///    "sheetUuid": {
///      "description": "UUID of the `(sheet …)` that holds the reference. Present exactly when `kind` is `sheet-file`; it equals the `sheetSymbolUuid` of the semantic index's `sheetInstances[]` that the sheet places.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "target": {
///      "description": "Where the reference leads.",
///      "$ref": "#/$defs/ProjectPathTarget"
///    },
///    "variables": {
///      "description": "Names of the variables the expansion substituted, in any round, sorted in code point order, without repeats. Empty when the text holds none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/ProjectVariableName"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ProjectPathReference {
    ///Which setting or form holds the reference.
    pub kind: ProjectReferenceKind,
    ///The repository-relative path of the file that holds the reference: the `.kicad_pro`, a schematic of the hierarchy, the board, a library table, or a drawing-sheet file.
    #[serde(rename = "documentPath")]
    pub document_path: RepoPath,
    ///UUID of the `(sheet …)` that holds the reference. Present exactly when `kind` is `sheet-file`; it equals the `sheetSymbolUuid` of the semantic index's `sheetInstances[]` that the sheet places.
    #[serde(
        rename = "sheetUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub sheet_uuid: ::std::option::Option<KiCadUuid>,
    ///The sheet's first `Sheetname` (or `Sheet name`) property as written. Present exactly when `kind` is `sheet-file` and that property has non-empty text.
    #[serde(
        rename = "sheetName",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub sheet_name: ::std::option::Option<ProjectPathReferenceSheetName>,
    ///The library nickname, the row's `(name …)`. Present exactly when `kind` is `footprint-library` or `symbol-library`; unique within its table.
    #[serde(
        rename = "libraryName",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub library_name: ::std::option::Option<ProjectPathReferenceLibraryName>,
    /**Where in the file the text sits. Present exactly when `kind` is
    `drawing-sheet` or `text-path`. In the `.kicad_pro`, the RFC 6901 JSON
    Pointer of the value (`/schematic/page_layout_descr_file`). In an
    s-expression file, the property name when the text is the value of a
    `(property "<name>" …)` form, otherwise the head token of the list the
    text is an element of (`descr`).*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub field: ::std::option::Option<ProjectPathReferenceField>,
    ///The reference exactly as written, after s-expression or JSON string unescaping, `${KIPRJMOD}` and other variables unexpanded; never empty. Its resolved repository path, if any, is `target.path`.
    pub raw: ProjectPathReferenceRaw,
    ///Names of the variables the expansion substituted, in any round, sorted in code point order, without repeats. Empty when the text holds none.
    pub variables: ::std::vec::Vec<ProjectVariableName>,
    ///Where the reference leads.
    pub target: ProjectPathTarget,
}
/**Where in the file the text sits. Present exactly when `kind` is
`drawing-sheet` or `text-path`. In the `.kicad_pro`, the RFC 6901 JSON
Pointer of the value (`/schematic/page_layout_descr_file`). In an
s-expression file, the property name when the text is the value of a
`(property "<name>" …)` form, otherwise the head token of the list the
text is an element of (`descr`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where in the file the text sits. Present exactly when `kind` is\n`drawing-sheet` or `text-path`. In the `.kicad_pro`, the RFC 6901 JSON\nPointer of the value (`/schematic/page_layout_descr_file`). In an\ns-expression file, the property name when the text is the value of a\n`(property \"<name>\" …)` form, otherwise the head token of the list the\ntext is an element of (`descr`).",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectPathReferenceField(::std::string::String);
impl ::std::ops::Deref for ProjectPathReferenceField {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectPathReferenceField> for ::std::string::String {
    fn from(value: ProjectPathReferenceField) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectPathReferenceField {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectPathReferenceField {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectPathReferenceField {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectPathReferenceField {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectPathReferenceField {
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
///The library nickname, the row's `(name …)`. Present exactly when `kind` is `footprint-library` or `symbol-library`; unique within its table.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The library nickname, the row's `(name …)`. Present exactly when `kind` is `footprint-library` or `symbol-library`; unique within its table.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectPathReferenceLibraryName(::std::string::String);
impl ::std::ops::Deref for ProjectPathReferenceLibraryName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectPathReferenceLibraryName> for ::std::string::String {
    fn from(value: ProjectPathReferenceLibraryName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectPathReferenceLibraryName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectPathReferenceLibraryName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectPathReferenceLibraryName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectPathReferenceLibraryName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectPathReferenceLibraryName {
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
///The reference exactly as written, after s-expression or JSON string unescaping, `${KIPRJMOD}` and other variables unexpanded; never empty. Its resolved repository path, if any, is `target.path`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The reference exactly as written, after s-expression or JSON string unescaping, `${KIPRJMOD}` and other variables unexpanded; never empty. Its resolved repository path, if any, is `target.path`.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectPathReferenceRaw(::std::string::String);
impl ::std::ops::Deref for ProjectPathReferenceRaw {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectPathReferenceRaw> for ::std::string::String {
    fn from(value: ProjectPathReferenceRaw) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectPathReferenceRaw {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectPathReferenceRaw {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectPathReferenceRaw {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectPathReferenceRaw {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectPathReferenceRaw {
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
///The sheet's first `Sheetname` (or `Sheet name`) property as written. Present exactly when `kind` is `sheet-file` and that property has non-empty text.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The sheet's first `Sheetname` (or `Sheet name`) property as written. Present exactly when `kind` is `sheet-file` and that property has non-empty text.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectPathReferenceSheetName(::std::string::String);
impl ::std::ops::Deref for ProjectPathReferenceSheetName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectPathReferenceSheetName> for ::std::string::String {
    fn from(value: ProjectPathReferenceSheetName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectPathReferenceSheetName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectPathReferenceSheetName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectPathReferenceSheetName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectPathReferenceSheetName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectPathReferenceSheetName {
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
///Where a path reference leads. The variant is chosen by `kind`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where a path reference leads. The variant is chosen by `kind`.",
///  "oneOf": [
///    {
///      "description": "Inside the repository.",
///      "$ref": "#/$defs/ProjectRepositoryTarget"
///    },
///    {
///      "description": "Above the repository root.",
///      "$ref": "#/$defs/ProjectOutsideRepositoryTarget"
///    },
///    {
///      "description": "An absolute path.",
///      "$ref": "#/$defs/ProjectAbsoluteTarget"
///    },
///    {
///      "description": "Below a KiCad library directory.",
///      "$ref": "#/$defs/ProjectKiCadLibraryTarget"
///    },
///    {
///      "description": "An embedded file.",
///      "$ref": "#/$defs/ProjectEmbeddedTarget"
///    },
///    {
///      "description": "Not resolvable from the sources.",
///      "$ref": "#/$defs/ProjectUnresolvedTarget"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum ProjectPathTarget {
    RepositoryTarget(ProjectRepositoryTarget),
    OutsideRepositoryTarget(ProjectOutsideRepositoryTarget),
    AbsoluteTarget(ProjectAbsoluteTarget),
    KiCadLibraryTarget(ProjectKiCadLibraryTarget),
    EmbeddedTarget(ProjectEmbeddedTarget),
    UnresolvedTarget(ProjectUnresolvedTarget),
}
impl ::std::convert::From<ProjectRepositoryTarget> for ProjectPathTarget {
    fn from(value: ProjectRepositoryTarget) -> Self {
        Self::RepositoryTarget(value)
    }
}
impl ::std::convert::From<ProjectOutsideRepositoryTarget> for ProjectPathTarget {
    fn from(value: ProjectOutsideRepositoryTarget) -> Self {
        Self::OutsideRepositoryTarget(value)
    }
}
impl ::std::convert::From<ProjectAbsoluteTarget> for ProjectPathTarget {
    fn from(value: ProjectAbsoluteTarget) -> Self {
        Self::AbsoluteTarget(value)
    }
}
impl ::std::convert::From<ProjectKiCadLibraryTarget> for ProjectPathTarget {
    fn from(value: ProjectKiCadLibraryTarget) -> Self {
        Self::KiCadLibraryTarget(value)
    }
}
impl ::std::convert::From<ProjectEmbeddedTarget> for ProjectPathTarget {
    fn from(value: ProjectEmbeddedTarget) -> Self {
        Self::EmbeddedTarget(value)
    }
}
impl ::std::convert::From<ProjectUnresolvedTarget> for ProjectPathTarget {
    fn from(value: ProjectUnresolvedTarget) -> Self {
        Self::UnresolvedTarget(value)
    }
}
///Which KiCad file setting or form holds a path reference.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Which KiCad file setting or form holds a path reference.",
///  "type": "string",
///  "enum": [
///    "sheet-file",
///    "footprint-library",
///    "symbol-library",
///    "model-3d",
///    "drawing-sheet",
///    "text-path"
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
pub enum ProjectReferenceKind {
    #[serde(rename = "sheet-file")]
    SheetFile,
    #[serde(rename = "footprint-library")]
    FootprintLibrary,
    #[serde(rename = "symbol-library")]
    SymbolLibrary,
    #[serde(rename = "model-3d")]
    Model3d,
    #[serde(rename = "drawing-sheet")]
    DrawingSheet,
    #[serde(rename = "text-path")]
    TextPath,
}
impl ::std::fmt::Display for ProjectReferenceKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::SheetFile => f.write_str("sheet-file"),
            Self::FootprintLibrary => f.write_str("footprint-library"),
            Self::SymbolLibrary => f.write_str("symbol-library"),
            Self::Model3d => f.write_str("model-3d"),
            Self::DrawingSheet => f.write_str("drawing-sheet"),
            Self::TextPath => f.write_str("text-path"),
        }
    }
}
impl ::std::str::FromStr for ProjectReferenceKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "sheet-file" => Ok(Self::SheetFile),
            "footprint-library" => Ok(Self::FootprintLibrary),
            "symbol-library" => Ok(Self::SymbolLibrary),
            "model-3d" => Ok(Self::Model3d),
            "drawing-sheet" => Ok(Self::DrawingSheet),
            "text-path" => Ok(Self::TextPath),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for ProjectReferenceKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectReferenceKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectReferenceKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///The reference resolves to a path inside the repository.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The reference resolves to a path inside the repository.",
///  "type": "object",
///  "required": [
///    "base",
///    "inSources",
///    "kind",
///    "path"
///  ],
///  "properties": {
///    "base": {
///      "description": "The directory the path was joined to.",
///      "$ref": "#/$defs/ProjectPathBase"
///    },
///    "inSources": {
///      "description": "True when the revision key's source set, as K materializes it, holds\nthe target: the file `path`, or, for a directory target such as a\n`.pretty` footprint library, at least one file below it. Such a target\nis read by the build and so is a member `sources/<path>` (the closure,\nbundle-format.md §2.2). False means the file\nis missing from the commit, or present but outside the revision key's\nsource set (for example under an excluded directory, or a file type the\nsource set does not select).",
///      "type": "boolean"
///    },
///    "kind": {
///      "description": "Variant tag.",
///      "type": "string",
///      "const": "repository"
///    },
///    "path": {
///      "description": "The target's repository-relative path: the base directory's repository\npath joined with the reference and normalized lexically (`.` dropped,\neach `..` cancels the segment before it). Its bundle member is\n`sources/<path>`.",
///      "$ref": "#/$defs/RepoPath"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ProjectRepositoryTarget {
    ///Variant tag.
    pub kind: ::std::string::String,
    /**The target's repository-relative path: the base directory's repository
    path joined with the reference and normalized lexically (`.` dropped,
    each `..` cancels the segment before it). Its bundle member is
    `sources/<path>`.*/
    pub path: RepoPath,
    ///The directory the path was joined to.
    pub base: ProjectPathBase,
    /**True when the revision key's source set, as K materializes it, holds
    the target: the file `path`, or, for a directory target such as a
    `.pretty` footprint library, at least one file below it. Such a target
    is read by the build and so is a member `sources/<path>` (the closure,
    bundle-format.md §2.2). False means the file
    is missing from the commit, or present but outside the revision key's
    source set (for example under an excluded directory, or a file type the
    source set does not select).*/
    #[serde(rename = "inSources")]
    pub in_sources: bool,
}
/**A `(title_block …)` form. Each field is present exactly when the form has
it with non-empty text; an empty string is treated as absent (KiCad writes
no empty title-block fields). This is the fork's `KiCadTitleBlock`, whose
empty strings stand for absent fields.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A `(title_block …)` form. Each field is present exactly when the form has\nit with non-empty text; an empty string is treated as absent (KiCad writes\nno empty title-block fields). This is the fork's `KiCadTitleBlock`, whose\nempty strings stand for absent fields.",
///  "type": "object",
///  "required": [
///    "comments"
///  ],
///  "properties": {
///    "comments": {
///      "description": "The `(comment N \"…\")` forms with N from 1 to 9 and non-empty text, sorted by `number` in numeric order; when a number repeats, the last form in the file wins. Empty when there are none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/ProjectTitleBlockComment"
///      }
///    },
///    "company": {
///      "description": "`(company \"…\")`, KiCad's `${COMPANY}`.",
///      "type": "string",
///      "minLength": 1
///    },
///    "date": {
///      "description": "`(date \"…\")`, KiCad's `${ISSUE_DATE}`, as written (not parsed as a date).",
///      "type": "string",
///      "minLength": 1
///    },
///    "rev": {
///      "description": "`(rev \"…\")`, KiCad's `${REVISION}`.",
///      "type": "string",
///      "minLength": 1
///    },
///    "title": {
///      "description": "`(title \"…\")`, KiCad's `${TITLE}`.",
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
pub struct ProjectTitleBlock {
    ///`(title "…")`, KiCad's `${TITLE}`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub title: ::std::option::Option<ProjectTitleBlockTitle>,
    ///`(date "…")`, KiCad's `${ISSUE_DATE}`, as written (not parsed as a date).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub date: ::std::option::Option<ProjectTitleBlockDate>,
    ///`(rev "…")`, KiCad's `${REVISION}`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub rev: ::std::option::Option<ProjectTitleBlockRev>,
    ///`(company "…")`, KiCad's `${COMPANY}`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub company: ::std::option::Option<ProjectTitleBlockCompany>,
    ///The `(comment N "…")` forms with N from 1 to 9 and non-empty text, sorted by `number` in numeric order; when a number repeats, the last form in the file wins. Empty when there are none.
    pub comments: ::std::vec::Vec<ProjectTitleBlockComment>,
}
///One numbered comment of a title block.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One numbered comment of a title block.",
///  "type": "object",
///  "required": [
///    "number",
///    "text"
///  ],
///  "properties": {
///    "number": {
///      "description": "The comment's number.",
///      "$ref": "#/$defs/ProjectTitleBlockCommentNumber"
///    },
///    "text": {
///      "description": "The comment's text; never empty.",
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
pub struct ProjectTitleBlockComment {
    ///The comment's number.
    pub number: ProjectTitleBlockCommentNumber,
    ///The comment's text; never empty.
    pub text: ProjectTitleBlockCommentText,
}
///Number of a title-block comment, as in `(comment N "…")`: 1 to 9.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Number of a title-block comment, as in `(comment N \"…\")`: 1 to 9.",
///  "type": "integer",
///  "maximum": 9.0,
///  "minimum": 1.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct ProjectTitleBlockCommentNumber(pub ::std::num::NonZeroU64);
impl ::std::ops::Deref for ProjectTitleBlockCommentNumber {
    type Target = ::std::num::NonZeroU64;
    fn deref(&self) -> &::std::num::NonZeroU64 {
        &self.0
    }
}
impl ::std::convert::From<ProjectTitleBlockCommentNumber> for ::std::num::NonZeroU64 {
    fn from(value: ProjectTitleBlockCommentNumber) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::num::NonZeroU64> for ProjectTitleBlockCommentNumber {
    fn from(value: ::std::num::NonZeroU64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for ProjectTitleBlockCommentNumber {
    type Err = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectTitleBlockCommentNumber {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for ProjectTitleBlockCommentNumber {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for ProjectTitleBlockCommentNumber {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///The comment's text; never empty.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The comment's text; never empty.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectTitleBlockCommentText(::std::string::String);
impl ::std::ops::Deref for ProjectTitleBlockCommentText {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectTitleBlockCommentText> for ::std::string::String {
    fn from(value: ProjectTitleBlockCommentText) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectTitleBlockCommentText {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectTitleBlockCommentText {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectTitleBlockCommentText {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectTitleBlockCommentText {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectTitleBlockCommentText {
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
///`(company "…")`, KiCad's `${COMPANY}`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "`(company \"…\")`, KiCad's `${COMPANY}`.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectTitleBlockCompany(::std::string::String);
impl ::std::ops::Deref for ProjectTitleBlockCompany {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectTitleBlockCompany> for ::std::string::String {
    fn from(value: ProjectTitleBlockCompany) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectTitleBlockCompany {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectTitleBlockCompany {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectTitleBlockCompany {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectTitleBlockCompany {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectTitleBlockCompany {
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
///`(date "…")`, KiCad's `${ISSUE_DATE}`, as written (not parsed as a date).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "`(date \"…\")`, KiCad's `${ISSUE_DATE}`, as written (not parsed as a date).",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectTitleBlockDate(::std::string::String);
impl ::std::ops::Deref for ProjectTitleBlockDate {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectTitleBlockDate> for ::std::string::String {
    fn from(value: ProjectTitleBlockDate) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectTitleBlockDate {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectTitleBlockDate {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectTitleBlockDate {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectTitleBlockDate {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectTitleBlockDate {
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
///`(rev "…")`, KiCad's `${REVISION}`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "`(rev \"…\")`, KiCad's `${REVISION}`.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectTitleBlockRev(::std::string::String);
impl ::std::ops::Deref for ProjectTitleBlockRev {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectTitleBlockRev> for ::std::string::String {
    fn from(value: ProjectTitleBlockRev) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectTitleBlockRev {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectTitleBlockRev {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectTitleBlockRev {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectTitleBlockRev {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectTitleBlockRev {
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
///`(title "…")`, KiCad's `${TITLE}`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "`(title \"…\")`, KiCad's `${TITLE}`.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct ProjectTitleBlockTitle(::std::string::String);
impl ::std::ops::Deref for ProjectTitleBlockTitle {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectTitleBlockTitle> for ::std::string::String {
    fn from(value: ProjectTitleBlockTitle) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for ProjectTitleBlockTitle {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for ProjectTitleBlockTitle {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectTitleBlockTitle {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectTitleBlockTitle {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for ProjectTitleBlockTitle {
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
///Why a reference could not be resolved from the sources alone.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Why a reference could not be resolved from the sources alone.",
///  "type": "string",
///  "enum": [
///    "undefined-variable",
///    "nondeterministic-variable",
///    "misplaced-variable",
///    "variable-loop",
///    "uri",
///    "home-relative",
///    "alias",
///    "embedded-missing",
///    "outside-library-root",
///    "empty-path",
///    "unrepresentable-path"
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
pub enum ProjectUnresolvedReason {
    #[serde(rename = "undefined-variable")]
    UndefinedVariable,
    #[serde(rename = "nondeterministic-variable")]
    NondeterministicVariable,
    #[serde(rename = "misplaced-variable")]
    MisplacedVariable,
    #[serde(rename = "variable-loop")]
    VariableLoop,
    #[serde(rename = "uri")]
    Uri,
    #[serde(rename = "home-relative")]
    HomeRelative,
    #[serde(rename = "alias")]
    Alias,
    #[serde(rename = "embedded-missing")]
    EmbeddedMissing,
    #[serde(rename = "outside-library-root")]
    OutsideLibraryRoot,
    #[serde(rename = "empty-path")]
    EmptyPath,
    #[serde(rename = "unrepresentable-path")]
    UnrepresentablePath,
}
impl ::std::fmt::Display for ProjectUnresolvedReason {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::UndefinedVariable => f.write_str("undefined-variable"),
            Self::NondeterministicVariable => f.write_str("nondeterministic-variable"),
            Self::MisplacedVariable => f.write_str("misplaced-variable"),
            Self::VariableLoop => f.write_str("variable-loop"),
            Self::Uri => f.write_str("uri"),
            Self::HomeRelative => f.write_str("home-relative"),
            Self::Alias => f.write_str("alias"),
            Self::EmbeddedMissing => f.write_str("embedded-missing"),
            Self::OutsideLibraryRoot => f.write_str("outside-library-root"),
            Self::EmptyPath => f.write_str("empty-path"),
            Self::UnrepresentablePath => f.write_str("unrepresentable-path"),
        }
    }
}
impl ::std::str::FromStr for ProjectUnresolvedReason {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "undefined-variable" => Ok(Self::UndefinedVariable),
            "nondeterministic-variable" => Ok(Self::NondeterministicVariable),
            "misplaced-variable" => Ok(Self::MisplacedVariable),
            "variable-loop" => Ok(Self::VariableLoop),
            "uri" => Ok(Self::Uri),
            "home-relative" => Ok(Self::HomeRelative),
            "alias" => Ok(Self::Alias),
            "embedded-missing" => Ok(Self::EmbeddedMissing),
            "outside-library-root" => Ok(Self::OutsideLibraryRoot),
            "empty-path" => Ok(Self::EmptyPath),
            "unrepresentable-path" => Ok(Self::UnrepresentablePath),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for ProjectUnresolvedReason {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ProjectUnresolvedReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ProjectUnresolvedReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///The reference cannot be resolved from the sources alone.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The reference cannot be resolved from the sources alone.",
///  "type": "object",
///  "required": [
///    "kind",
///    "reason"
///  ],
///  "properties": {
///    "kind": {
///      "description": "Variant tag.",
///      "type": "string",
///      "const": "unresolved"
///    },
///    "reason": {
///      "description": "Why.",
///      "$ref": "#/$defs/ProjectUnresolvedReason"
///    },
///    "variable": {
///      "description": "The variable concerned. Present exactly when `reason` is\n`undefined-variable` or `nondeterministic-variable` (the first such\nreference, in text order, of the expansion round that stopped), or\n`misplaced-variable` (the variable of the first marker, in text order,\nthat does not start the text).",
///      "$ref": "#/$defs/ProjectVariableName"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ProjectUnresolvedTarget {
    ///Variant tag.
    pub kind: ::std::string::String,
    ///Why.
    pub reason: ProjectUnresolvedReason,
    /**The variable concerned. Present exactly when `reason` is
    `undefined-variable` or `nondeterministic-variable` (the first such
    reference, in text order, of the expansion round that stopped), or
    `misplaced-variable` (the variable of the first marker, in text order,
    that does not start the text).*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub variable: ::std::option::Option<ProjectVariableName>,
}
/**Name of a path variable as written between `${` and `}` or `$(` and `)`:
ASCII letters, digits, `_` and `:`, as KiCad's expander reads them
(`common.cpp`, `KIwxExpandEnvVars`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Name of a path variable as written between `${` and `}` or `$(` and `)`:\nASCII letters, digits, `_` and `:`, as KiCad's expander reads them\n(`common.cpp`, `KIwxExpandEnvVars`).",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct ProjectVariableName(pub ::std::string::String);
impl ::std::ops::Deref for ProjectVariableName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ProjectVariableName> for ::std::string::String {
    fn from(value: ProjectVariableName) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for ProjectVariableName {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for ProjectVariableName {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for ProjectVariableName {
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
impl<'de> ::serde::Deserialize<'de> for ProjectPathTarget {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("repository") {
            return ::serde_json::from_value::<ProjectRepositoryTarget>(value)
                .map(Self::RepositoryTarget)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("outside-repository") {
            return ::serde_json::from_value::<ProjectOutsideRepositoryTarget>(value)
                .map(Self::OutsideRepositoryTarget)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("absolute") {
            return ::serde_json::from_value::<ProjectAbsoluteTarget>(value)
                .map(Self::AbsoluteTarget)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("kicad-library") {
            return ::serde_json::from_value::<ProjectKiCadLibraryTarget>(value)
                .map(Self::KiCadLibraryTarget)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("embedded") {
            return ::serde_json::from_value::<ProjectEmbeddedTarget>(value)
                .map(Self::EmbeddedTarget)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("unresolved") {
            return ::serde_json::from_value::<ProjectUnresolvedTarget>(value)
                .map(Self::UnresolvedTarget)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum ProjectPathTarget",
        ))
    }
}
