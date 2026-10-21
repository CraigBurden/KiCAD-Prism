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
/**The HLR option set stage `models` passes to Geometer for every footprint
(`models/assembly-hlr.json`'s `options`), as one versioned token: changing
any option changes the token, and with it the generator id (cli-spec.md
§5.2.4).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The HLR option set stage `models` passes to Geometer for every footprint\n(`models/assembly-hlr.json`'s `options`), as one versioned token: changing\nany option changes the token, and with it the generator id (cli-spec.md\n§5.2.4).",
///  "type": "string",
///  "enum": [
///    "assembly-hlr-a0"
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
pub enum CliHlrOptionsProcedure {
    #[serde(rename = "assembly-hlr-a0")]
    AssemblyHlrA0,
}
impl ::std::fmt::Display for CliHlrOptionsProcedure {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::AssemblyHlrA0 => f.write_str("assembly-hlr-a0"),
        }
    }
}
impl ::std::str::FromStr for CliHlrOptionsProcedure {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "assembly-hlr-a0" => Ok(Self::AssemblyHlrA0),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliHlrOptionsProcedure {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliHlrOptionsProcedure {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliHlrOptionsProcedure {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**The procedure stage `models` uses for `models/assembly-hlr.json`
(cli-spec.md §5.2.4): the Geometer runtime release and the HLR option set.
Changing either is a generator bump.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The procedure stage `models` uses for `models/assembly-hlr.json`\n(cli-spec.md §5.2.4): the Geometer runtime release and the HLR option set.\nChanging either is a generator bump.",
///  "type": "object",
///  "required": [
///    "geometer_version",
///    "options"
///  ],
///  "properties": {
///    "geometer_version": {
///      "description": "The Geometer runtime's release version, exactly as its welcome reports it, for example `2026.9.19`. `--geometer` must report this version or exit 7.",
///      "$ref": "#/$defs/CliReleaseVersion"
///    },
///    "options": {
///      "description": "The HLR option set every projection used.",
///      "$ref": "#/$defs/CliHlrOptionsProcedure"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliHlrProcedure {
    ///The Geometer runtime's release version, exactly as its welcome reports it, for example `2026.9.19`. `--geometer` must report this version or exit 7.
    pub geometer_version: CliReleaseVersion,
    ///The HLR option set every projection used.
    pub options: CliHlrOptionsProcedure,
}
///KiCad's current `(version N)` per source format, declared in code point order.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad's current `(version N)` per source format, declared in code point order.",
///  "type": "object",
///  "required": [
///    "board",
///    "schematic"
///  ],
///  "properties": {
///    "board": {
///      "description": "`.kicad_pcb`, for example `20260206`.",
///      "type": "integer",
///      "maximum": 99991231.0,
///      "minimum": 20000000.0
///    },
///    "schematic": {
///      "description": "`.kicad_sch`, for example `20260306`.",
///      "type": "integer",
///      "maximum": 99991231.0,
///      "minimum": 20000000.0
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliKicadFileFormats {
    ///`.kicad_pcb`, for example `20260206`.
    pub board: i64,
    ///`.kicad_sch`, for example `20260306`.
    pub schematic: i64,
}
/**The component-model export the backend runs before stage `models`
(cli-spec.md §9.3). Pinned in the generator id because its output is a
bundle member.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The component-model export the backend runs before stage `models`\n(cli-spec.md §9.3). Pinned in the generator id because its output is a\nbundle member.",
///  "type": "string",
///  "enum": [
///    "kicad-cli-glb-a0"
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
pub enum CliModelsProcedure {
    #[serde(rename = "kicad-cli-glb-a0")]
    KicadCliGlbA0,
}
impl ::std::fmt::Display for CliModelsProcedure {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::KicadCliGlbA0 => f.write_str("kicad-cli-glb-a0"),
        }
    }
}
impl ::std::str::FromStr for CliModelsProcedure {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "kicad-cli-glb-a0" => Ok(Self::KicadCliGlbA0),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliModelsProcedure {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliModelsProcedure {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliModelsProcedure {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**The zone-refill procedure the backend runs before stage `board`
(cli-spec.md §9.2). Pinned in the generator id because its output is a
bundle member.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The zone-refill procedure the backend runs before stage `board`\n(cli-spec.md §9.2). Pinned in the generator id because its output is a\nbundle member.",
///  "type": "string",
///  "enum": [
///    "pcbnew-zone-filler-a0"
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
pub enum CliRefillProcedure {
    #[serde(rename = "pcbnew-zone-filler-a0")]
    PcbnewZoneFillerA0,
}
impl ::std::fmt::Display for CliRefillProcedure {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::PcbnewZoneFillerA0 => f.write_str("pcbnew-zone-filler-a0"),
        }
    }
}
impl ::std::str::FromStr for CliRefillProcedure {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "pcbnew-zone-filler-a0" => Ok(Self::PcbnewZoneFillerA0),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliRefillProcedure {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliRefillProcedure {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliRefillProcedure {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
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
/**The source-upgrade procedure the backend runs before stage `parse`
(cli-spec.md §9.4). Pinned in the generator id because its output is the
bytes of upgraded source members.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The source-upgrade procedure the backend runs before stage `parse`\n(cli-spec.md §9.4). Pinned in the generator id because its output is the\nbytes of upgraded source members.",
///  "type": "string",
///  "enum": [
///    "kicad-seeded-upgrade-a0"
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
pub enum CliUpgradeProcedure {
    #[serde(rename = "kicad-seeded-upgrade-a0")]
    KicadSeededUpgradeA0,
}
impl ::std::fmt::Display for CliUpgradeProcedure {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::KicadSeededUpgradeA0 => f.write_str("kicad-seeded-upgrade-a0"),
        }
    }
}
impl ::std::str::FromStr for CliUpgradeProcedure {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "kicad-seeded-upgrade-a0" => Ok(Self::KicadSeededUpgradeA0),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for CliUpgradeProcedure {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for CliUpgradeProcedure {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for CliUpgradeProcedure {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**The generator id: the stdout of `prism-kicad version`. It states everything
that decides the bytes of a bundle besides the sources (ADR §5), and is
bumped explicitly, never derived from binary or source bytes.

Fields are declared in canonical order: `schema` first, then the other keys
in code point order, which is also the order inside every nested object.
The canonical bytes (cli-spec.md §5.1) are that compact serialization; the
generator digest and the bundle key are SHA-256 over them.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.version:a0",
///  "title": "CliVersionA0",
///  "description": "The generator id: the stdout of `prism-kicad version`. It states everything\nthat decides the bytes of a bundle besides the sources (ADR §5), and is\nbumped explicitly, never derived from binary or source bytes.\n\nFields are declared in canonical order: `schema` first, then the other keys\nin code point order, which is also the order inside every nested object.\nThe canonical bytes (cli-spec.md §5.1) are that compact serialization; the\ngenerator digest and the bundle key are SHA-256 over them.",
///  "type": "object",
///  "required": [
///    "crate_version",
///    "engine_version",
///    "hlr_procedure",
///    "kicad_file_formats",
///    "kicad_version",
///    "member_schemas",
///    "models_procedure",
///    "pack_format_version",
///    "refill_procedure",
///    "schema",
///    "upgrade_procedure"
///  ],
///  "properties": {
///    "crate_version": {
///      "description": "Version of the `prism-kicad-cli` crate. Bumped whenever any member's\nbytes or any recorded stage outcome could change for the same inputs:\nthe core, a projection producer, the manifest or archive writer, or the\nGLB canonicalization (cli-spec.md §5.1.2).",
///      "$ref": "#/$defs/CliReleaseVersion"
///    },
///    "engine_version": {
///      "description": "Version of the parser core crate (`ENGINE_VERSION`, the fork's `kicad-monkey-core`, `prism-kicad-core` after WP-F2).",
///      "$ref": "#/$defs/CliReleaseVersion"
///    },
///    "hlr_procedure": {
///      "description": "The procedure stage `models` uses for `models/assembly-hlr.json`: the Geometer runtime and the HLR options (cli-spec.md §5.2.4).",
///      "$ref": "#/$defs/CliHlrProcedure"
///    },
///    "kicad_file_formats": {
///      "description": "The current file formats of `kicad_version`: the `(version N)` KiCad\nwrites. Sources older than them are upgraded before stage `parse`\n(cli-spec.md §9.4), and the parser reads only these formats, so they\ndecide every parsed member's bytes. Raised with `kicad_version`.",
///      "$ref": "#/$defs/CliKicadFileFormats"
///    },
///    "kicad_version": {
///      "description": "KiCad version of the KiCad-produced members (the refilled board and\n`components.glb`), exactly as `kicad-cli version` prints it. It also\npins KiCad's stock 3D model library. `--refill-tool` and\n`--models-tool` must have its major.minor; patch releases are tolerated.",
///      "$ref": "#/$defs/CliReleaseVersion"
///    },
///    "member_schemas": {
///      "description": "Every member this generator writes with a schema (`bundle.json`,\n`design.json`, the materialization and every projection) and its schema\nid, sorted by `path` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliVersionMemberSchema"
///      },
///      "minItems": 1
///    },
///    "models_procedure": {
///      "description": "The procedure the backend must use to produce `--models-glb`.",
///      "$ref": "#/$defs/CliModelsProcedure"
///    },
///    "pack_format_version": {
///      "description": "Format version of the packed materialization encoding (`PACK_FORMAT_VERSION` of the materialization-pack crate), which the materialization schema id does not pin.",
///      "type": "integer",
///      "maximum": 65535.0,
///      "minimum": 0.0
///    },
///    "refill_procedure": {
///      "description": "The procedure the backend must use to produce `--refilled-board`.",
///      "$ref": "#/$defs/CliRefillProcedure"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.version.a0"
///    },
///    "upgrade_procedure": {
///      "description": "The procedure the backend must use to upgrade sources older than `kicad_version`'s file format before stage `parse` (cli-spec.md §9.4).",
///      "$ref": "#/$defs/CliUpgradeProcedure"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliVersionA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    /**Version of the `prism-kicad-cli` crate. Bumped whenever any member's
    bytes or any recorded stage outcome could change for the same inputs:
    the core, a projection producer, the manifest or archive writer, or the
    GLB canonicalization (cli-spec.md §5.1.2).*/
    pub crate_version: CliReleaseVersion,
    ///Version of the parser core crate (`ENGINE_VERSION`, the fork's `kicad-monkey-core`, `prism-kicad-core` after WP-F2).
    pub engine_version: CliReleaseVersion,
    ///The procedure stage `models` uses for `models/assembly-hlr.json`: the Geometer runtime and the HLR options (cli-spec.md §5.2.4).
    pub hlr_procedure: CliHlrProcedure,
    /**The current file formats of `kicad_version`: the `(version N)` KiCad
    writes. Sources older than them are upgraded before stage `parse`
    (cli-spec.md §9.4), and the parser reads only these formats, so they
    decide every parsed member's bytes. Raised with `kicad_version`.*/
    pub kicad_file_formats: CliKicadFileFormats,
    /**KiCad version of the KiCad-produced members (the refilled board and
    `components.glb`), exactly as `kicad-cli version` prints it. It also
    pins KiCad's stock 3D model library. `--refill-tool` and
    `--models-tool` must have its major.minor; patch releases are tolerated.*/
    pub kicad_version: CliReleaseVersion,
    /**Every member this generator writes with a schema (`bundle.json`,
    `design.json`, the materialization and every projection) and its schema
    id, sorted by `path` in code point order.*/
    pub member_schemas: ::std::vec::Vec<CliVersionMemberSchema>,
    ///The procedure the backend must use to produce `--models-glb`.
    pub models_procedure: CliModelsProcedure,
    ///Format version of the packed materialization encoding (`PACK_FORMAT_VERSION` of the materialization-pack crate), which the materialization schema id does not pin.
    pub pack_format_version: u16,
    ///The procedure the backend must use to produce `--refilled-board`.
    pub refill_procedure: CliRefillProcedure,
    ///The procedure the backend must use to upgrade sources older than `kicad_version`'s file format before stage `parse` (cli-spec.md §9.4).
    pub upgrade_procedure: CliUpgradeProcedure,
}
///One member the generator writes with a schema, and that schema's id.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One member the generator writes with a schema, and that schema's id.",
///  "type": "object",
///  "required": [
///    "path",
///    "schema"
///  ],
///  "properties": {
///    "path": {
///      "description": "The member's archive path, for example `projections/stackup.json`.",
///      "$ref": "#/$defs/ArchivePath"
///    },
///    "schema": {
///      "description": "The schema id the member's content follows, for example `prism.stackup.a0`.",
///      "$ref": "#/$defs/SchemaId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliVersionMemberSchema {
    ///The member's archive path, for example `projections/stackup.json`.
    pub path: ArchivePath,
    ///The schema id the member's content follows, for example `prism.stackup.a0`.
    pub schema: SchemaId,
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
