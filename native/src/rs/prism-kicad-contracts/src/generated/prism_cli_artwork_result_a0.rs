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
///stdout of `artwork` (exit 0).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.artwork_result:a0",
///  "title": "CliArtworkResultA0",
///  "description": "stdout of `artwork` (exit 0).",
///  "type": "object",
///  "required": [
///    "schema",
///    "views"
///  ],
///  "properties": {
///    "paper_scale": {
///      "description": "The ratio of sheet millimetres to board millimetres the run drew at:\n`--paper-scale` when given, so every stroke and font in the views prints at\nits configured size on paper at that scale. Absent when the run drew in\nboard millimetres and sizes scale with the drawing.",
///      "type": "number",
///      "minimum": 0.0
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.artwork_result.a0"
///    },
///    "views": {
///      "description": "One entry per rendered view, sorted by `name` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliArtworkView"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliArtworkResultA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    /**The ratio of sheet millimetres to board millimetres the run drew at:
    `--paper-scale` when given, so every stroke and font in the views prints at
    its configured size on paper at that scale. Absent when the run drew in
    board millimetres and sizes scale with the drawing.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub paper_scale: ::std::option::Option<f64>,
    ///One entry per rendered view, sorted by `name` in code point order.
    pub views: ::std::vec::Vec<CliArtworkView>,
}
///One rendered artwork view and what it drew.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One rendered artwork view and what it drew.",
///  "type": "object",
///  "required": [
///    "designators_placed",
///    "dnp_footprints_hatched",
///    "file",
///    "footprints_drawn",
///    "footprints_without_outline",
///    "name",
///    "sha256"
///  ],
///  "properties": {
///    "designators_placed": {
///      "description": "How many reference designators the view placed.",
///      "$ref": "#/$defs/Count"
///    },
///    "dnp_footprints_hatched": {
///      "description": "How many do-not-populate footprints the view hatched (`dnp.hatch`).",
///      "$ref": "#/$defs/Count"
///    },
///    "file": {
///      "description": "The SVG's path relative to the output directory, `<view>.svg`.",
///      "$ref": "#/$defs/ArchivePath"
///    },
///    "footprints_drawn": {
///      "description": "How many footprints the view drew a body region for.",
///      "$ref": "#/$defs/Count"
///    },
///    "footprints_without_outline": {
///      "description": "Every footprint the view has no body outline for, `<RepoPath>#<KiCadUuid>`,\nsorted in code point order: the footprints drawn from the hole envelope or\nthe pad envelope instead, or with no body region at all.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/ObjectRef"
///      }
///    },
///    "name": {
///      "description": "The view's name, as the `ArtworkConfigA0` gives it and `--view` names it.",
///      "type": "string"
///    },
///    "sha256": {
///      "description": "SHA-256 of the SVG file's bytes.",
///      "$ref": "#/$defs/Sha256Hex"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliArtworkView {
    ///The view's name, as the `ArtworkConfigA0` gives it and `--view` names it.
    pub name: ::std::string::String,
    ///The SVG's path relative to the output directory, `<view>.svg`.
    pub file: ArchivePath,
    ///SHA-256 of the SVG file's bytes.
    pub sha256: Sha256Hex,
    ///How many footprints the view drew a body region for.
    pub footprints_drawn: Count,
    ///How many reference designators the view placed.
    pub designators_placed: Count,
    ///How many do-not-populate footprints the view hatched (`dnp.hatch`).
    pub dnp_footprints_hatched: Count,
    /**Every footprint the view has no body outline for, `<RepoPath>#<KiCadUuid>`,
    sorted in code point order: the footprints drawn from the hole envelope or
    the pad envelope instead, or with no body region at all.*/
    pub footprints_without_outline: ::std::vec::Vec<ObjectRef>,
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
