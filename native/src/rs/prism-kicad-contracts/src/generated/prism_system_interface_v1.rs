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
/**Angle in degrees. In new documents it is as written in the KiCad file:
not normalized, not rounded. A parity document may round it as today's
output does, and its field says so. A positive angle is a counter-clockwise rotation as KiCad shows
it on the front side. Each field states the frame its angle is in.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Angle in degrees. In new documents it is as written in the KiCad file:\nnot normalized, not rounded. A parity document may round it as today's\noutput does, and its field says so. A positive angle is a counter-clockwise rotation as KiCad shows\nit on the front side. Each field states the frame its angle is in.",
///  "type": "number"
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct Degrees(pub f64);
impl ::std::ops::Deref for Degrees {
    type Target = f64;
    fn deref(&self) -> &f64 {
        &self.0
    }
}
impl ::std::convert::From<Degrees> for f64 {
    fn from(value: Degrees) -> Self {
        value.0
    }
}
impl ::std::convert::From<f64> for Degrees {
    fn from(value: f64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for Degrees {
    type Err = <f64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for Degrees {
    type Error = <f64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for Degrees {
    type Error = <f64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for Degrees {
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
/**KiCad KIID path: one or more `/<uuid>` steps, no trailing `/`. Two forms
exist and every field of this type states which one it holds: the
schematic form, which starts at the root sheet's UUID (a symbol's
`(instances (project … (path …)))` entry, plus the symbol UUID for an
occurrence); and the board form, which omits the root sheet (a footprint's
`(path …)`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad KIID path: one or more `/<uuid>` steps, no trailing `/`. Two forms\nexist and every field of this type states which one it holds: the\nschematic form, which starts at the root sheet's UUID (a symbol's\n`(instances (project … (path …)))` entry, plus the symbol UUID for an\noccurrence); and the board form, which omits the root sheet (a footprint's\n`(path …)`).",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct KiidPath(pub ::std::string::String);
impl ::std::ops::Deref for KiidPath {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<KiidPath> for ::std::string::String {
    fn from(value: KiidPath) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for KiidPath {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for KiidPath {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for KiidPath {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**KiCad library identifier as written in the file: `<nickname>:<name>` for a
symbol (`Device:R`) or a footprint (`Resistor_SMD:R_0603_1608Metric`). The
nickname may be absent when the file has none.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad library identifier as written in the file: `<nickname>:<name>` for a\nsymbol (`Device:R`) or a footprint (`Resistor_SMD:R_0603_1608Metric`). The\nnickname may be absent when the file has none.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct LibId(::std::string::String);
impl ::std::ops::Deref for LibId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<LibId> for ::std::string::String {
    fn from(value: LibId) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for LibId {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for LibId {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for LibId {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for LibId {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for LibId {
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
/**KiCad full net name as KiCad resolves it, including the sheet path prefix
of a local net (`/Power/VBUS`), a global name (`GND`) or a generated name
(`Net-(R1-Pad2)`, `unconnected-(U1-PA0-Pad3)`). "No net" is expressed by
omitting the field, never by an empty name.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad full net name as KiCad resolves it, including the sheet path prefix\nof a local net (`/Power/VBUS`), a global name (`GND`) or a generated name\n(`Net-(R1-Pad2)`, `unconnected-(U1-PA0-Pad3)`). \"No net\" is expressed by\nomitting the field, never by an empty name.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct NetName(::std::string::String);
impl ::std::ops::Deref for NetName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<NetName> for ::std::string::String {
    fn from(value: NetName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for NetName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for NetName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for NetName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for NetName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for NetName {
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
/**Pad or pin number as written in the file, always a string (`1`, `A1`,
`EP`). Empty for a pad KiCad leaves unnumbered, such as a mechanical
non-plated hole.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Pad or pin number as written in the file, always a string (`1`, `A1`,\n`EP`). Empty for a pad KiCad leaves unnumbered, such as a mechanical\nnon-plated hole.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct PadNumber(pub ::std::string::String);
impl ::std::ops::Deref for PadNumber {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<PadNumber> for ::std::string::String {
    fn from(value: PadNumber) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for PadNumber {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for PadNumber {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for PadNumber {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
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
/**Bounds of the board outline (extractor v8, `interface_extractor.py:304-321`;
`CONTRACTS_P2.md` §14.6): line centres, not stroke edges; arcs by their
true extent (ends plus every axis extreme they sweep), circles by centre
plus or minus radius, polygons and Bézier curves by their points.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Bounds of the board outline (extractor v8, `interface_extractor.py:304-321`;\n`CONTRACTS_P2.md` §14.6): line centres, not stroke edges; arcs by their\ntrue extent (ends plus every axis extreme they sweep), circles by centre\nplus or minus radius, polygons and Bézier curves by their points.",
///  "type": "object",
///  "required": [
///    "maxMm",
///    "minMm",
///    "source"
///  ],
///  "properties": {
///    "maxMm": {
///      "description": "Largest x and largest y, `[x, y]` in that order, in millimetres, board frame (+y up), rounded to 1e-4 mm.",
///      "$ref": "#/$defs/SystemInterfaceMmPair"
///    },
///    "minMm": {
///      "description": "Smallest x and smallest y, `[x, y]` in that order, in millimetres, board frame (+y up), rounded to 1e-4 mm.",
///      "$ref": "#/$defs/SystemInterfaceMmPair"
///    },
///    "source": {
///      "description": "What was bounded.",
///      "$ref": "#/$defs/SystemInterfaceOutlineSource"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInterfaceBoardOutline {
    ///Smallest x and smallest y, `[x, y]` in that order, in millimetres, board frame (+y up), rounded to 1e-4 mm.
    #[serde(rename = "minMm")]
    pub min_mm: SystemInterfaceMmPair,
    ///Largest x and largest y, `[x, y]` in that order, in millimetres, board frame (+y up), rounded to 1e-4 mm.
    #[serde(rename = "maxMm")]
    pub max_mm: SystemInterfaceMmPair,
    ///What was bounded.
    pub source: SystemInterfaceOutlineSource,
}
/**Which connector-detection rule decided `candidate`
(`connector_detection.classify`,
`backend/app/services/systems/connector_detection.py:42-65`; rule order
frozen in `CONTRACTS.md` §4.1). Other System Builder code builds
interface-shaped documents with `module` or `export` here
(`systems/modules.py:67`, `systems/exports.py:41`); those are not this
artifact and never appear in it.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Which connector-detection rule decided `candidate`\n(`connector_detection.classify`,\n`backend/app/services/systems/connector_detection.py:42-65`; rule order\nfrozen in `CONTRACTS.md` §4.1). Other System Builder code builds\ninterface-shaped documents with `module` or `export` here\n(`systems/modules.py:67`, `systems/exports.py:41`); those are not this\nartifact and never appear in it.",
///  "type": "string",
///  "enum": [
///    "field",
///    "refdes",
///    "library",
///    "none"
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
pub enum SystemInterfaceCandidateReason {
    #[serde(rename = "field")]
    Field,
    #[serde(rename = "refdes")]
    Refdes,
    #[serde(rename = "library")]
    Library,
    #[serde(rename = "none")]
    None,
}
impl ::std::fmt::Display for SystemInterfaceCandidateReason {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Field => f.write_str("field"),
            Self::Refdes => f.write_str("refdes"),
            Self::Library => f.write_str("library"),
            Self::None => f.write_str("none"),
        }
    }
}
impl ::std::str::FromStr for SystemInterfaceCandidateReason {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "field" => Ok(Self::Field),
            "refdes" => Ok(Self::Refdes),
            "library" => Ok(Self::Library),
            "none" => Ok(Self::None),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfaceCandidateReason {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemInterfaceCandidateReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfaceCandidateReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**One component: every unit occurrence of one reference designator
(`interface_extractor.py:95-124`, `:391-450`; `CONTRACTS.md` §2.2-§3).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One component: every unit occurrence of one reference designator\n(`interface_extractor.py:95-124`, `:391-450`; `CONTRACTS.md` §2.2-§3).",
///  "type": "object",
///  "required": [
///    "candidate",
///    "candidateReason",
///    "dnp",
///    "footprint",
///    "geometry",
///    "libId",
///    "memberKeys",
///    "mpn",
///    "pins",
///    "portKey",
///    "reference",
///    "value"
///  ],
///  "properties": {
///    "candidate": {
///      "description": "Whether connector detection makes this component a port candidate (`CONTRACTS.md` §4.1).",
///      "type": "boolean"
///    },
///    "candidateReason": {
///      "description": "The detection rule that decided `candidate`.",
///      "$ref": "#/$defs/SystemInterfaceCandidateReason"
///    },
///    "dnp": {
///      "description": "Do-not-populate in the design's default assembly, from the\ndesign-variant resolver with the sheet fold\n(`interface_extractor.py:386-387`, `:444`;\n`backend/app/services/semantic_index_variants.py:752-800`, the default\n`components` map keyed by reference). False when the resolver has no\nentry for the reference, which includes every reference ending in `?`\n(`_valid_reference`, `semantic_index_variants.py:115-122`), even with\n`(dnp yes)`.",
///      "type": "boolean"
///    },
///    "footprint": {
///      "description": "Footprint library link of the netlist component with this reference, as\nwritten (`interface_extractor.py:399`). Empty when the symbol has no\nfootprint or the netlist has no component with this reference.",
///      "type": "string"
///    },
///    "geometry": {
///      "description": "Footprint geometry, extractor v6 (`interface_extractor.py:213-262`,\n`:448`; `CONTRACTS_P2.md` §14.6), from the first board footprint (file\norder) whose `Reference` property equals `reference`. Null when there is\nno board or no footprint has that `Reference` property.",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/SystemInterfaceGeometry"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "libId": {
///      "description": "The `lib_id` of the lowest unit's placed symbol, as written (`interface_extractor.py:398`).",
///      "$ref": "#/$defs/LibId"
///    },
///    "memberKeys": {
///      "description": "Occurrence keys (schematic-form KIID paths) of every unit of this\nreference, sorted in code point order (`interface_extractor.py:437`).\nRepeated sheets give distinct keys for one symbol UUID.",
///      "$ref": "#/$defs/SystemInterfaceMemberKeys"
///    },
///    "mpn": {
///      "description": "Manufacturer part number, extractor v7 (`interface_extractor.py:443`,\n`CONTRACTS_P2.md` §18.1). Null when no MPN-style field has a non-empty\nvalue.",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/SystemInterfaceMpn"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "pins": {
///      "description": "One entry per distinct schematic pad number of this reference across\nall its units, sorted by `pad` in natural order (conventions.md §9,\n`interface_extractor.py:413`); `pad` is unique. Never empty: a reference\nwith no schematic pin is not a component.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemInterfacePin"
///      },
///      "minItems": 1
///    },
///    "portKey": {
///      "description": "Port key: the occurrence key of the lowest unit number present, ties\nbroken by occurrence key in code point order (`CONTRACTS.md` §2.3,\n`interface_extractor.py:392`, `:396`). An occurrence key is a KIID path\nin the schematic form: the containing sheet instance's path from the\nroot sheet's UUID, then `/<symbol uuid>` (`:122`). Always an element of\n`memberKeys`.",
///      "$ref": "#/$defs/KiidPath"
///    },
///    "reference": {
///      "description": "Reference designator as the symbol instance resolves it for its sheet\npath (`interface_extractor.py:118`). Never starts with `#`; may contain\n`?` when unannotated.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "value": {
///      "description": "Value field of the netlist component with this reference\n(`interface_extractor.py:441`). Empty when it has none or the netlist has\nno such component.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInterfaceComponent {
    /**Port key: the occurrence key of the lowest unit number present, ties
    broken by occurrence key in code point order (`CONTRACTS.md` §2.3,
    `interface_extractor.py:392`, `:396`). An occurrence key is a KIID path
    in the schematic form: the containing sheet instance's path from the
    root sheet's UUID, then `/<symbol uuid>` (`:122`). Always an element of
    `memberKeys`.*/
    #[serde(rename = "portKey")]
    pub port_key: KiidPath,
    /**Occurrence keys (schematic-form KIID paths) of every unit of this
    reference, sorted in code point order (`interface_extractor.py:437`).
    Repeated sheets give distinct keys for one symbol UUID.*/
    #[serde(rename = "memberKeys")]
    pub member_keys: SystemInterfaceMemberKeys,
    /**Reference designator as the symbol instance resolves it for its sheet
    path (`interface_extractor.py:118`). Never starts with `#`; may contain
    `?` when unannotated.*/
    pub reference: Refdes,
    ///The `lib_id` of the lowest unit's placed symbol, as written (`interface_extractor.py:398`).
    #[serde(rename = "libId")]
    pub lib_id: LibId,
    /**Footprint library link of the netlist component with this reference, as
    written (`interface_extractor.py:399`). Empty when the symbol has no
    footprint or the netlist has no component with this reference.*/
    pub footprint: ::std::string::String,
    /**Value field of the netlist component with this reference
    (`interface_extractor.py:441`). Empty when it has none or the netlist has
    no such component.*/
    pub value: ::std::string::String,
    /**Manufacturer part number, extractor v7 (`interface_extractor.py:443`,
    `CONTRACTS_P2.md` §18.1). Null when no MPN-style field has a non-empty
    value.*/
    pub mpn: ::std::option::Option<SystemInterfaceMpn>,
    /**Do-not-populate in the design's default assembly, from the
    design-variant resolver with the sheet fold
    (`interface_extractor.py:386-387`, `:444`;
    `backend/app/services/semantic_index_variants.py:752-800`, the default
    `components` map keyed by reference). False when the resolver has no
    entry for the reference, which includes every reference ending in `?`
    (`_valid_reference`, `semantic_index_variants.py:115-122`), even with
    `(dnp yes)`.*/
    pub dnp: bool,
    ///Whether connector detection makes this component a port candidate (`CONTRACTS.md` §4.1).
    pub candidate: bool,
    ///The detection rule that decided `candidate`.
    #[serde(rename = "candidateReason")]
    pub candidate_reason: SystemInterfaceCandidateReason,
    /**One entry per distinct schematic pad number of this reference across
    all its units, sorted by `pad` in natural order (conventions.md §9,
    `interface_extractor.py:413`); `pad` is unique. Never empty: a reference
    with no schematic pin is not a component.*/
    pub pins: ::std::vec::Vec<SystemInterfacePin>,
    /**Footprint geometry, extractor v6 (`interface_extractor.py:213-262`,
    `:448`; `CONTRACTS_P2.md` §14.6), from the first board footprint (file
    order) whose `Reference` property equals `reference`. Null when there is
    no board or no footprint has that `Reference` property.*/
    pub geometry: ::std::option::Option<SystemInterfaceGeometry>,
}
///Courtyard bounds in the footprint's own frame (`interface_extractor.py:237-242`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Courtyard bounds in the footprint's own frame (`interface_extractor.py:237-242`).",
///  "type": "object",
///  "required": [
///    "maxMm",
///    "minMm"
///  ],
///  "properties": {
///    "maxMm": {
///      "description": "Largest x and largest y, `[x, y]` in that order, in millimetres, footprint frame (+y up, before rotation and flip).",
///      "$ref": "#/$defs/SystemInterfaceMmPair"
///    },
///    "minMm": {
///      "description": "Smallest x and smallest y, `[x, y]` in that order, in millimetres, footprint frame (+y up, before\nrotation and flip), over line and rectangle ends, arc start, mid and end\npoints (not the arc's true extent), circle boxes and polygon points.",
///      "$ref": "#/$defs/SystemInterfaceMmPair"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInterfaceCourtyard {
    /**Smallest x and smallest y, `[x, y]` in that order, in millimetres, footprint frame (+y up, before
    rotation and flip), over line and rectangle ends, arc start, mid and end
    points (not the arc's true extent), circle boxes and polygon points.*/
    #[serde(rename = "minMm")]
    pub min_mm: SystemInterfaceMmPair,
    ///Largest x and largest y, `[x, y]` in that order, in millimetres, footprint frame (+y up, before rotation and flip).
    #[serde(rename = "maxMm")]
    pub max_mm: SystemInterfaceMmPair,
}
/**Three angles in degrees `[x, y, z]`, each rounded to 1e-4 as `_round` does
(`interface_extractor.py:168-170`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Three angles in degrees `[x, y, z]`, each rounded to 1e-4 as `_round` does\n(`interface_extractor.py:168-170`).",
///  "type": "array",
///  "items": {
///    "$ref": "#/$defs/Degrees"
///  },
///  "maxItems": 3,
///  "minItems": 3
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct SystemInterfaceDegTriple(pub [Degrees; 3usize]);
impl ::std::ops::Deref for SystemInterfaceDegTriple {
    type Target = [Degrees; 3usize];
    fn deref(&self) -> &[Degrees; 3usize] {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfaceDegTriple> for [Degrees; 3usize] {
    fn from(value: SystemInterfaceDegTriple) -> Self {
        value.0
    }
}
impl ::std::convert::From<[Degrees; 3usize]> for SystemInterfaceDegTriple {
    fn from(value: [Degrees; 3usize]) -> Self {
        Self(value)
    }
}
///One extraction diagnostic (`interface_extractor.py:402-420`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One extraction diagnostic (`interface_extractor.py:402-420`).",
///  "type": "object",
///  "required": [
///    "code",
///    "detail",
///    "pad",
///    "portKey"
///  ],
///  "properties": {
///    "code": {
///      "description": "What was found.",
///      "$ref": "#/$defs/SystemInterfaceDiagnosticCode"
///    },
///    "detail": {
///      "description": "Fixed English text, part of the digest: `<reference> is not annotated`\nfor `unannotated_*`, `<reference>.<pad> carries <n> schematic nets` for\n`pin_net_ambiguous`, `<n>` in decimal.",
///      "type": "string",
///      "minLength": 1
///    },
///    "pad": {
///      "description": "The pad concerned for `pin_net_ambiguous`. Null for the two `unannotated_*` codes, which concern the whole component.",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/SystemInterfacePinPad"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "portKey": {
///      "description": "`portKey` of the component concerned.",
///      "$ref": "#/$defs/KiidPath"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInterfaceDiagnostic {
    ///What was found.
    pub code: SystemInterfaceDiagnosticCode,
    ///`portKey` of the component concerned.
    #[serde(rename = "portKey")]
    pub port_key: KiidPath,
    ///The pad concerned for `pin_net_ambiguous`. Null for the two `unannotated_*` codes, which concern the whole component.
    pub pad: ::std::option::Option<SystemInterfacePinPad>,
    /**Fixed English text, part of the digest: `<reference> is not annotated`
    for `unannotated_*`, `<reference>.<pad> carries <n> schematic nets` for
    `pin_net_ambiguous`, `<n>` in decimal.*/
    pub detail: SystemInterfaceDiagnosticDetail,
}
/**Code of an extraction diagnostic (`interface_extractor.py:402-420`). The
values are today's snake_case strings, not kebab-case DiagnosticCodes: a
parity document keeps today's values.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Code of an extraction diagnostic (`interface_extractor.py:402-420`). The\nvalues are today's snake_case strings, not kebab-case DiagnosticCodes: a\nparity document keeps today's values.",
///  "type": "string",
///  "enum": [
///    "unannotated_connector",
///    "unannotated_component",
///    "pin_net_ambiguous"
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
pub enum SystemInterfaceDiagnosticCode {
    #[serde(rename = "unannotated_connector")]
    UnannotatedConnector,
    #[serde(rename = "unannotated_component")]
    UnannotatedComponent,
    #[serde(rename = "pin_net_ambiguous")]
    PinNetAmbiguous,
}
impl ::std::fmt::Display for SystemInterfaceDiagnosticCode {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::UnannotatedConnector => f.write_str("unannotated_connector"),
            Self::UnannotatedComponent => f.write_str("unannotated_component"),
            Self::PinNetAmbiguous => f.write_str("pin_net_ambiguous"),
        }
    }
}
impl ::std::str::FromStr for SystemInterfaceDiagnosticCode {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "unannotated_connector" => Ok(Self::UnannotatedConnector),
            "unannotated_component" => Ok(Self::UnannotatedComponent),
            "pin_net_ambiguous" => Ok(Self::PinNetAmbiguous),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfaceDiagnosticCode {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemInterfaceDiagnosticCode {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfaceDiagnosticCode {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**Fixed English text, part of the digest: `<reference> is not annotated`
for `unannotated_*`, `<reference>.<pad> carries <n> schematic nets` for
`pin_net_ambiguous`, `<n>` in decimal.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Fixed English text, part of the digest: `<reference> is not annotated`\nfor `unannotated_*`, `<reference>.<pad> carries <n> schematic nets` for\n`pin_net_ambiguous`, `<n>` in decimal.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemInterfaceDiagnosticDetail(::std::string::String);
impl ::std::ops::Deref for SystemInterfaceDiagnosticDetail {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfaceDiagnosticDetail> for ::std::string::String {
    fn from(value: SystemInterfaceDiagnosticDetail) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemInterfaceDiagnosticDetail {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfaceDiagnosticDetail {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemInterfaceDiagnosticDetail {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfaceDiagnosticDetail {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemInterfaceDiagnosticDetail {
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
/**Interface digest: `sha256:` followed by 64 lowercase hex digits. SHA-256
over the UTF-8 bytes of Python's
`json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`,
where `body` is the document without `digest`, `extractor`, `projectId` and
`commit` (`interface_extractor.py:42-62`). The exact byte rules are in
`field-maps/system-interface.md` ("Digest").*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Interface digest: `sha256:` followed by 64 lowercase hex digits. SHA-256\nover the UTF-8 bytes of Python's\n`json.dumps(body, sort_keys=True, separators=(\",\", \":\"), ensure_ascii=False)`,\nwhere `body` is the document without `digest`, `extractor`, `projectId` and\n`commit` (`interface_extractor.py:42-62`). The exact byte rules are in\n`field-maps/system-interface.md` (\"Digest\").",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct SystemInterfaceDigest(pub ::std::string::String);
impl ::std::ops::Deref for SystemInterfaceDigest {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfaceDigest> for ::std::string::String {
    fn from(value: SystemInterfaceDigest) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for SystemInterfaceDigest {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for SystemInterfaceDigest {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for SystemInterfaceDigest {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///The extractor that produced an artifact (`interface_extractor.py:456`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The extractor that produced an artifact (`interface_extractor.py:456`).",
///  "type": "object",
///  "required": [
///    "kicadMonkeyVersion",
///    "version"
///  ],
///  "properties": {
///    "kicadMonkeyVersion": {
///      "description": "Today: the version of the Python `kicad-monkey` distribution that parsed\nthe sources, or `workspace` when it is not installed as a distribution\n(`_kicad_monkey_version`, `interface_extractor.py:78-82`). An artifact\nthat C4 builds from a bundle member carries the bundle's generator id\nhere instead. Informational: nothing reads it.",
///      "type": "string",
///      "minLength": 1
///    },
///    "version": {
///      "description": "`EXTRACTOR_VERSION` (`interface_extractor.py:38`). This contract is the\npayload of version 8; an artifact of another version has a different\nshape and is a different contract.",
///      "type": "string",
///      "const": "8"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInterfaceExtractor {
    /**`EXTRACTOR_VERSION` (`interface_extractor.py:38`). This contract is the
    payload of version 8; an artifact of another version has a different
    shape and is a different contract.*/
    pub version: ::std::string::String,
    /**Today: the version of the Python `kicad-monkey` distribution that parsed
    the sources, or `workspace` when it is not installed as a distribution
    (`_kicad_monkey_version`, `interface_extractor.py:78-82`). An artifact
    that C4 builds from a bundle member carries the bundle's generator id
    here instead. Informational: nothing reads it.*/
    #[serde(rename = "kicadMonkeyVersion")]
    pub kicad_monkey_version: SystemInterfaceExtractorKicadMonkeyVersion,
}
/**Today: the version of the Python `kicad-monkey` distribution that parsed
the sources, or `workspace` when it is not installed as a distribution
(`_kicad_monkey_version`, `interface_extractor.py:78-82`). An artifact
that C4 builds from a bundle member carries the bundle's generator id
here instead. Informational: nothing reads it.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Today: the version of the Python `kicad-monkey` distribution that parsed\nthe sources, or `workspace` when it is not installed as a distribution\n(`_kicad_monkey_version`, `interface_extractor.py:78-82`). An artifact\nthat C4 builds from a bundle member carries the bundle's generator id\nhere instead. Informational: nothing reads it.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemInterfaceExtractorKicadMonkeyVersion(::std::string::String);
impl ::std::ops::Deref for SystemInterfaceExtractorKicadMonkeyVersion {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfaceExtractorKicadMonkeyVersion> for ::std::string::String {
    fn from(value: SystemInterfaceExtractorKicadMonkeyVersion) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemInterfaceExtractorKicadMonkeyVersion {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfaceExtractorKicadMonkeyVersion {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String>
    for SystemInterfaceExtractorKicadMonkeyVersion
{
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfaceExtractorKicadMonkeyVersion {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemInterfaceExtractorKicadMonkeyVersion {
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
/**Board side of a placed footprint in System Builder's spelling
(`CONTRACTS_P2.md` §14.6), not Common's `Side`: a parity document keeps
today's values.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Board side of a placed footprint in System Builder's spelling\n(`CONTRACTS_P2.md` §14.6), not Common's `Side`: a parity document keeps\ntoday's values.",
///  "type": "string",
///  "enum": [
///    "top",
///    "bottom"
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
pub enum SystemInterfaceFootprintSide {
    #[serde(rename = "top")]
    Top,
    #[serde(rename = "bottom")]
    Bottom,
}
impl ::std::fmt::Display for SystemInterfaceFootprintSide {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Top => f.write_str("top"),
            Self::Bottom => f.write_str("bottom"),
        }
    }
}
impl ::std::str::FromStr for SystemInterfaceFootprintSide {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "top" => Ok(Self::Top),
            "bottom" => Ok(Self::Bottom),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfaceFootprintSide {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemInterfaceFootprintSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfaceFootprintSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**Where one component's footprint sits on the board, extractor v6
(`interface_extractor.py:213-252`; `CONTRACTS_P2.md` §14.6). Numbers are
rounded to 1e-4.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where one component's footprint sits on the board, extractor v6\n(`interface_extractor.py:213-252`; `CONTRACTS_P2.md` §14.6). Numbers are\nrounded to 1e-4.",
///  "type": "object",
///  "required": [
///    "courtyard",
///    "footprintName",
///    "model",
///    "pads",
///    "positionMm",
///    "rotationDeg",
///    "side"
///  ],
///  "properties": {
///    "courtyard": {
///      "description": "Axis-aligned bounds of the footprint's `F.CrtYd`/`B.CrtYd` graphics in\nthe footprint's own frame (+y up, before rotation and flip)\n(`interface_extractor.py:180-196`, `:237-242`). Null when the footprint\nhas no courtyard graphic.",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/SystemInterfaceCourtyard"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "footprintName": {
///      "description": "The footprint's library link after its last `:`\n(`interface_extractor.py:248`). Empty when the footprint has no library\nlink.",
///      "type": "string"
///    },
///    "model": {
///      "description": "The footprint's first 3D model that is not hidden, unresolved\n(`interface_extractor.py:199-210`). Null when it has none.",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/SystemInterfaceModelRef"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "pads": {
///      "description": "Every pad of the footprint, sorted by `pad` in natural order\n(conventions.md §9, `interface_extractor.py:236`); pads with the same\nnumber (including several unnumbered pads) all appear, in the\nfootprint's file order (a stable sort). Empty for a footprint with no\npads.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemInterfacePad"
///      }
///    },
///    "positionMm": {
///      "description": "Footprint anchor `[x, y]`, in that order, in millimetres in the board frame (+y up): KiCad's `(at x y)` with y negated.",
///      "$ref": "#/$defs/SystemInterfaceMmPair"
///    },
///    "rotationDeg": {
///      "description": "Footprint rotation in degrees as the board file writes it (KiCad's\ncounter-clockwise angle, `(at x y angle)`, 0 when absent), not\nnormalized, rounded to 1e-4 (`interface_extractor.py:216`, `:247`).",
///      "$ref": "#/$defs/Degrees"
///    },
///    "side": {
///      "description": "Board side of the footprint, from its layer (`interface_extractor.py:243-245`).",
///      "$ref": "#/$defs/SystemInterfaceFootprintSide"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInterfaceGeometry {
    ///Board side of the footprint, from its layer (`interface_extractor.py:243-245`).
    pub side: SystemInterfaceFootprintSide,
    ///Footprint anchor `[x, y]`, in that order, in millimetres in the board frame (+y up): KiCad's `(at x y)` with y negated.
    #[serde(rename = "positionMm")]
    pub position_mm: SystemInterfaceMmPair,
    /**Footprint rotation in degrees as the board file writes it (KiCad's
    counter-clockwise angle, `(at x y angle)`, 0 when absent), not
    normalized, rounded to 1e-4 (`interface_extractor.py:216`, `:247`).*/
    #[serde(rename = "rotationDeg")]
    pub rotation_deg: Degrees,
    /**The footprint's library link after its last `:`
    (`interface_extractor.py:248`). Empty when the footprint has no library
    link.*/
    #[serde(rename = "footprintName")]
    pub footprint_name: ::std::string::String,
    /**Every pad of the footprint, sorted by `pad` in natural order
    (conventions.md §9, `interface_extractor.py:236`); pads with the same
    number (including several unnumbered pads) all appear, in the
    footprint's file order (a stable sort). Empty for a footprint with no
    pads.*/
    pub pads: ::std::vec::Vec<SystemInterfacePad>,
    /**Axis-aligned bounds of the footprint's `F.CrtYd`/`B.CrtYd` graphics in
    the footprint's own frame (+y up, before rotation and flip)
    (`interface_extractor.py:180-196`, `:237-242`). Null when the footprint
    has no courtyard graphic.*/
    pub courtyard: ::std::option::Option<SystemInterfaceCourtyard>,
    /**The footprint's first 3D model that is not hidden, unresolved
    (`interface_extractor.py:199-210`). Null when it has none.*/
    pub model: ::std::option::Option<SystemInterfaceModelRef>,
}
/**The occurrence keys of every unit of one component, sorted in code point
order, without duplicates, never empty (`interface_extractor.py:437`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The occurrence keys of every unit of one component, sorted in code point\norder, without duplicates, never empty (`interface_extractor.py:437`).",
///  "type": "array",
///  "items": {
///    "$ref": "#/$defs/KiidPath"
///  },
///  "minItems": 1,
///  "uniqueItems": true
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct SystemInterfaceMemberKeys(pub Vec<KiidPath>);
impl ::std::ops::Deref for SystemInterfaceMemberKeys {
    type Target = Vec<KiidPath>;
    fn deref(&self) -> &Vec<KiidPath> {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfaceMemberKeys> for Vec<KiidPath> {
    fn from(value: SystemInterfaceMemberKeys) -> Self {
        value.0
    }
}
impl ::std::convert::From<Vec<KiidPath>> for SystemInterfaceMemberKeys {
    fn from(value: Vec<KiidPath>) -> Self {
        Self(value)
    }
}
/**A point or size in millimetres, `[x, y]` (or `[width, height]`), each an
IEEE double rounded to 1e-4 mm as `_round` does
(`interface_extractor.py:168-170`). The field holding it states its frame.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A point or size in millimetres, `[x, y]` (or `[width, height]`), each an\nIEEE double rounded to 1e-4 mm as `_round` does\n(`interface_extractor.py:168-170`). The field holding it states its frame.",
///  "type": "array",
///  "items": {
///    "type": "number"
///  },
///  "maxItems": 2,
///  "minItems": 2
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct SystemInterfaceMmPair(pub [f64; 2usize]);
impl ::std::ops::Deref for SystemInterfaceMmPair {
    type Target = [f64; 2usize];
    fn deref(&self) -> &[f64; 2usize] {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfaceMmPair> for [f64; 2usize] {
    fn from(value: SystemInterfaceMmPair) -> Self {
        value.0
    }
}
impl ::std::convert::From<[f64; 2usize]> for SystemInterfaceMmPair {
    fn from(value: [f64; 2usize]) -> Self {
        Self(value)
    }
}
/**Three millimetre values `[x, y, z]`, each rounded to 1e-4 mm as `_round`
does (`interface_extractor.py:168-170`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Three millimetre values `[x, y, z]`, each rounded to 1e-4 mm as `_round`\ndoes (`interface_extractor.py:168-170`).",
///  "type": "array",
///  "items": {
///    "type": "number"
///  },
///  "maxItems": 3,
///  "minItems": 3
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct SystemInterfaceMmTriple(pub [f64; 3usize]);
impl ::std::ops::Deref for SystemInterfaceMmTriple {
    type Target = [f64; 3usize];
    fn deref(&self) -> &[f64; 3usize] {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfaceMmTriple> for [f64; 3usize] {
    fn from(value: SystemInterfaceMmTriple) -> Self {
        value.0
    }
}
impl ::std::convert::From<[f64; 3usize]> for SystemInterfaceMmTriple {
    fn from(value: [f64; 3usize]) -> Self {
        Self(value)
    }
}
/**A footprint's 3D model reference, unresolved (`interface_extractor.py:199-210`).
A model with `(hide)` or `(hide yes)` is skipped.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A footprint's 3D model reference, unresolved (`interface_extractor.py:199-210`).\nA model with `(hide)` or `(hide yes)` is skipped.",
///  "type": "object",
///  "required": [
///    "offsetMm",
///    "path",
///    "rotationDeg",
///    "scale"
///  ],
///  "properties": {
///    "offsetMm": {
///      "description": "The model's `(offset (xyz …))` `[x, y, z]` in millimetres, rounded to 1e-4 mm; in that order.",
///      "$ref": "#/$defs/SystemInterfaceMmTriple"
///    },
///    "path": {
///      "description": "Model path exactly as the board file writes it, environment variables such as `${KICAD10_3DMODEL_DIR}` kept.",
///      "type": "string"
///    },
///    "rotationDeg": {
///      "description": "The model's `(rotate (xyz …))` `[x, y, z]` in degrees, rounded to 1e-4; in that order.",
///      "$ref": "#/$defs/SystemInterfaceDegTriple"
///    },
///    "scale": {
///      "description": "The model's `(scale (xyz …))` `[x, y, z]`, rounded to 1e-4; in that order.",
///      "$ref": "#/$defs/SystemInterfaceScaleTriple"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInterfaceModelRef {
    ///Model path exactly as the board file writes it, environment variables such as `${KICAD10_3DMODEL_DIR}` kept.
    pub path: ::std::string::String,
    ///The model's `(offset (xyz …))` `[x, y, z]` in millimetres, rounded to 1e-4 mm; in that order.
    #[serde(rename = "offsetMm")]
    pub offset_mm: SystemInterfaceMmTriple,
    ///The model's `(rotate (xyz …))` `[x, y, z]` in degrees, rounded to 1e-4; in that order.
    #[serde(rename = "rotationDeg")]
    pub rotation_deg: SystemInterfaceDegTriple,
    ///The model's `(scale (xyz …))` `[x, y, z]`, rounded to 1e-4; in that order.
    pub scale: SystemInterfaceScaleTriple,
}
/**Manufacturer part number of a component: the first non-empty value, with
surrounding whitespace removed, of the fields `MPN`,
`Manufacturer_Part_Number`, `Manufacturer Part Number`, `MFR_PN`,
`Mfr. No.` and `Mfr No`, field names compared case-insensitively after
trimming (`interface_extractor.py:339-345`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Manufacturer part number of a component: the first non-empty value, with\nsurrounding whitespace removed, of the fields `MPN`,\n`Manufacturer_Part_Number`, `Manufacturer Part Number`, `MFR_PN`,\n`Mfr. No.` and `Mfr No`, field names compared case-insensitively after\ntrimming (`interface_extractor.py:339-345`).",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemInterfaceMpn(::std::string::String);
impl ::std::ops::Deref for SystemInterfaceMpn {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfaceMpn> for ::std::string::String {
    fn from(value: SystemInterfaceMpn) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemInterfaceMpn {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfaceMpn {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemInterfaceMpn {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfaceMpn {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemInterfaceMpn {
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
/**A set of KiCad net names, sorted in code point order (Python `sorted()` on
`str`), without duplicates, without the empty name and without KiCad's
generated `unconnected-(…)` names (`normalized_nets`,
`interface_extractor.py:47-49`). Empty when no named net remains.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A set of KiCad net names, sorted in code point order (Python `sorted()` on\n`str`), without duplicates, without the empty name and without KiCad's\ngenerated `unconnected-(…)` names (`normalized_nets`,\n`interface_extractor.py:47-49`). Empty when no named net remains.",
///  "type": "array",
///  "items": {
///    "$ref": "#/$defs/NetName"
///  },
///  "uniqueItems": true
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct SystemInterfaceNetSet(pub Vec<NetName>);
impl ::std::ops::Deref for SystemInterfaceNetSet {
    type Target = Vec<NetName>;
    fn deref(&self) -> &Vec<NetName> {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfaceNetSet> for Vec<NetName> {
    fn from(value: SystemInterfaceNetSet) -> Self {
        value.0
    }
}
impl ::std::convert::From<Vec<NetName>> for SystemInterfaceNetSet {
    fn from(value: Vec<NetName>) -> Self {
        Self(value)
    }
}
///What `boardOutlineMm` bounds (`interface_extractor.py:304-321`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What `boardOutlineMm` bounds (`interface_extractor.py:304-321`).",
///  "type": "string",
///  "enum": [
///    "edge_cuts",
///    "items"
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
pub enum SystemInterfaceOutlineSource {
    #[serde(rename = "edge_cuts")]
    EdgeCuts,
    #[serde(rename = "items")]
    Items,
}
impl ::std::fmt::Display for SystemInterfaceOutlineSource {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::EdgeCuts => f.write_str("edge_cuts"),
            Self::Items => f.write_str("items"),
        }
    }
}
impl ::std::str::FromStr for SystemInterfaceOutlineSource {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "edge_cuts" => Ok(Self::EdgeCuts),
            "items" => Ok(Self::Items),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfaceOutlineSource {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemInterfaceOutlineSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfaceOutlineSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One footprint pad (`interface_extractor.py:226-235`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One footprint pad (`interface_extractor.py:226-235`).",
///  "type": "object",
///  "required": [
///    "pad",
///    "positionMm",
///    "shape",
///    "sizeMm",
///    "tht"
///  ],
///  "properties": {
///    "pad": {
///      "description": "Pad number as the board file writes it; empty for an unnumbered pad (a mounting or alignment hole).",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "positionMm": {
///      "description": "Pad centre `[x, y]`, in that order, in millimetres in the board frame (+y up): the pad's\nfootprint-local `(at …)` rotated by the footprint angle about the anchor,\nadded to the anchor, y negated (`interface_extractor.py:220-224`, `:231`).",
///      "$ref": "#/$defs/SystemInterfaceMmPair"
///    },
///    "shape": {
///      "description": "Pad shape.",
///      "$ref": "#/$defs/SystemInterfacePadShape"
///    },
///    "sizeMm": {
///      "description": "Pad `(size w h)` as `[width, height]`, in that order, in millimetres, in the pad's own frame, unrotated; 0 for a missing dimension.",
///      "$ref": "#/$defs/SystemInterfaceMmPair"
///    },
///    "tht": {
///      "description": "True for a `thru_hole` or `np_thru_hole` pad (`interface_extractor.py:228`, `:234`).",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInterfacePad {
    ///Pad number as the board file writes it; empty for an unnumbered pad (a mounting or alignment hole).
    pub pad: PadNumber,
    /**Pad centre `[x, y]`, in that order, in millimetres in the board frame (+y up): the pad's
    footprint-local `(at …)` rotated by the footprint angle about the anchor,
    added to the anchor, y negated (`interface_extractor.py:220-224`, `:231`).*/
    #[serde(rename = "positionMm")]
    pub position_mm: SystemInterfaceMmPair,
    ///Pad `(size w h)` as `[width, height]`, in that order, in millimetres, in the pad's own frame, unrotated; 0 for a missing dimension.
    #[serde(rename = "sizeMm")]
    pub size_mm: SystemInterfaceMmPair,
    ///Pad shape.
    pub shape: SystemInterfacePadShape,
    ///True for a `thru_hole` or `np_thru_hole` pad (`interface_extractor.py:228`, `:234`).
    pub tht: bool,
}
/**Pad shape: the name of kicad_monkey's `PadShape` member in lower case
(`interface_extractor.py:233`; kicad_monkey 2026.9.7 `kicad_base.py:93-99`),
which is KiCad's pad shape token. A pad with any other token fails the
board parse, so no other value occurs.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Pad shape: the name of kicad_monkey's `PadShape` member in lower case\n(`interface_extractor.py:233`; kicad_monkey 2026.9.7 `kicad_base.py:93-99`),\nwhich is KiCad's pad shape token. A pad with any other token fails the\nboard parse, so no other value occurs.",
///  "type": "string",
///  "enum": [
///    "circle",
///    "rect",
///    "oval",
///    "trapezoid",
///    "roundrect",
///    "custom"
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
pub enum SystemInterfacePadShape {
    #[serde(rename = "circle")]
    Circle,
    #[serde(rename = "rect")]
    Rect,
    #[serde(rename = "oval")]
    Oval,
    #[serde(rename = "trapezoid")]
    Trapezoid,
    #[serde(rename = "roundrect")]
    Roundrect,
    #[serde(rename = "custom")]
    Custom,
}
impl ::std::fmt::Display for SystemInterfacePadShape {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Circle => f.write_str("circle"),
            Self::Rect => f.write_str("rect"),
            Self::Oval => f.write_str("oval"),
            Self::Trapezoid => f.write_str("trapezoid"),
            Self::Roundrect => f.write_str("roundrect"),
            Self::Custom => f.write_str("custom"),
        }
    }
}
impl ::std::str::FromStr for SystemInterfacePadShape {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "circle" => Ok(Self::Circle),
            "rect" => Ok(Self::Rect),
            "oval" => Ok(Self::Oval),
            "trapezoid" => Ok(Self::Trapezoid),
            "roundrect" => Ok(Self::Roundrect),
            "custom" => Ok(Self::Custom),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfacePadShape {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemInterfacePadShape {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfacePadShape {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**One logical pin: every schematic pin of the reference that shares one pad
number (`CONTRACTS.md` §2.4, `interface_extractor.py:127-145`, `:413-432`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One logical pin: every schematic pin of the reference that shares one pad\nnumber (`CONTRACTS.md` §2.4, `interface_extractor.py:127-145`, `:413-432`).",
///  "type": "object",
///  "required": [
///    "nets",
///    "pad",
///    "pcbNets",
///    "pinNames",
///    "pinTypes",
///    "powerNet"
///  ],
///  "properties": {
///    "nets": {
///      "description": "Full hierarchical schematic net names of the pin, captured from the\ncompiled schematic netlist before any board overlay (`CONTRACTS.md` §3),\nas a sorted set (`SystemInterfaceNetSet`): code point order. Empty when\nthe pin is unconnected; KiCad's `unconnected-(…)` names are removed. More\nthan one element is the `pin_net_ambiguous` case.",
///      "$ref": "#/$defs/SystemInterfaceNetSet"
///    },
///    "pad": {
///      "description": "Pad number of the pin.",
///      "$ref": "#/$defs/SystemInterfacePinPad"
///    },
///    "pcbNets": {
///      "description": "Net names of the board pads with this pad number on every board\nfootprint whose `Reference` property equals `reference` (all of them,\nnot only the first), as a sorted set (code point order) with the same\nfiltering as `nets`; empty when those pads have no net\n(`interface_extractor.py:148-165`, `:421`, `:426`). Null when there is no\nboard, or when no such footprint has a pad with this number.",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/SystemInterfaceNetSet"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "pinNames": {
///      "description": "Pin names of the pins sharing this pad, sorted in code point order\n(`interface_extractor.py:141-142`, `:427`). Null when none of them has a\nnon-empty name. Best effort; never drives drift (`CONTRACTS.md` §3).",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/SystemInterfacePinNameSet"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "pinTypes": {
///      "description": "Electrical types of the pins sharing this pad, sorted in code point\norder of their values (`interface_extractor.py:143-144`, `:428`). Null\nwhen none of them has a type. Best effort; never drives drift.",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/SystemInterfacePinTypeSet"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "powerNet": {
///      "description": "Extractor v5 (`CONTRACTS_P2.md` §8.4): true when any name in `nets` is\nthe `Value` of a placed symbol whose library symbol has the `power`\nflag, anywhere in the hierarchy (`interface_extractor.py:324-336`,\n`:430`). False for a pin with no net.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInterfacePin {
    ///Pad number of the pin.
    pub pad: SystemInterfacePinPad,
    /**Full hierarchical schematic net names of the pin, captured from the
    compiled schematic netlist before any board overlay (`CONTRACTS.md` §3),
    as a sorted set (`SystemInterfaceNetSet`): code point order. Empty when
    the pin is unconnected; KiCad's `unconnected-(…)` names are removed. More
    than one element is the `pin_net_ambiguous` case.*/
    pub nets: SystemInterfaceNetSet,
    /**Net names of the board pads with this pad number on every board
    footprint whose `Reference` property equals `reference` (all of them,
    not only the first), as a sorted set (code point order) with the same
    filtering as `nets`; empty when those pads have no net
    (`interface_extractor.py:148-165`, `:421`, `:426`). Null when there is no
    board, or when no such footprint has a pad with this number.*/
    #[serde(rename = "pcbNets")]
    pub pcb_nets: ::std::option::Option<SystemInterfaceNetSet>,
    /**Pin names of the pins sharing this pad, sorted in code point order
    (`interface_extractor.py:141-142`, `:427`). Null when none of them has a
    non-empty name. Best effort; never drives drift (`CONTRACTS.md` §3).*/
    #[serde(rename = "pinNames")]
    pub pin_names: ::std::option::Option<SystemInterfacePinNameSet>,
    /**Electrical types of the pins sharing this pad, sorted in code point
    order of their values (`interface_extractor.py:143-144`, `:428`). Null
    when none of them has a type. Best effort; never drives drift.*/
    #[serde(rename = "pinTypes")]
    pub pin_types: ::std::option::Option<SystemInterfacePinTypeSet>,
    /**Extractor v5 (`CONTRACTS_P2.md` §8.4): true when any name in `nets` is
    the `Value` of a placed symbol whose library symbol has the `power`
    flag, anywhere in the hierarchy (`interface_extractor.py:324-336`,
    `:430`). False for a pin with no net.*/
    #[serde(rename = "powerNet")]
    pub power_net: bool,
}
/**A pin name as the symbol's library pin writes it (kicad_monkey's terminal
`pin_name`), never empty. Kept exactly as written, including KiCad's `~`
(a KiCad 9 file's "no name") and overbar markup such as `~{RESET}`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A pin name as the symbol's library pin writes it (kicad_monkey's terminal\n`pin_name`), never empty. Kept exactly as written, including KiCad's `~`\n(a KiCad 9 file's \"no name\") and overbar markup such as `~{RESET}`.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemInterfacePinName(::std::string::String);
impl ::std::ops::Deref for SystemInterfacePinName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfacePinName> for ::std::string::String {
    fn from(value: SystemInterfacePinName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemInterfacePinName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfacePinName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemInterfacePinName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfacePinName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemInterfacePinName {
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
/**A non-empty set of pin names, sorted in code point order, without
duplicates (`interface_extractor.py:427`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A non-empty set of pin names, sorted in code point order, without\nduplicates (`interface_extractor.py:427`).",
///  "type": "array",
///  "items": {
///    "$ref": "#/$defs/SystemInterfacePinName"
///  },
///  "minItems": 1,
///  "uniqueItems": true
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct SystemInterfacePinNameSet(pub Vec<SystemInterfacePinName>);
impl ::std::ops::Deref for SystemInterfacePinNameSet {
    type Target = Vec<SystemInterfacePinName>;
    fn deref(&self) -> &Vec<SystemInterfacePinName> {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfacePinNameSet> for Vec<SystemInterfacePinName> {
    fn from(value: SystemInterfacePinNameSet) -> Self {
        value.0
    }
}
impl ::std::convert::From<Vec<SystemInterfacePinName>> for SystemInterfacePinNameSet {
    fn from(value: Vec<SystemInterfacePinName>) -> Self {
        Self(value)
    }
}
/**Pad number of a schematic pin as the compiled schematic netlist reports it
(kicad_monkey's terminal `pin`): never empty, because a terminal with an
empty pin is skipped (`interface_extractor.py:137-138`) and KiCad's `~`
placeholder is read as empty (kicad_monkey 2026.9.7
`kicad_netlist_compiler.py:406-408`). Always a string: `01`, `1` and `A1`
are distinct (`CONTRACTS.md` §2.4).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Pad number of a schematic pin as the compiled schematic netlist reports it\n(kicad_monkey's terminal `pin`): never empty, because a terminal with an\nempty pin is skipped (`interface_extractor.py:137-138`) and KiCad's `~`\nplaceholder is read as empty (kicad_monkey 2026.9.7\n`kicad_netlist_compiler.py:406-408`). Always a string: `01`, `1` and `A1`\nare distinct (`CONTRACTS.md` §2.4).",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemInterfacePinPad(::std::string::String);
impl ::std::ops::Deref for SystemInterfacePinPad {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfacePinPad> for ::std::string::String {
    fn from(value: SystemInterfacePinPad) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemInterfacePinPad {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfacePinPad {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemInterfacePinPad {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfacePinPad {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemInterfacePinPad {
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
/**Electrical type of a schematic pin as the compiled netlist reports it:
KiCad's pin type token, lower case, as the symbol file writes it
(kicad_monkey 2026.9.7 `kicad_sch_enums.py:12-37`, `PinElectricalType`;
the netlist copies its value, `kicad_netlist_compiler.py:1086-1092`). A
library pin with no type reads as `unspecified`; the pre-2021 token
`unconnected` reads as `no_connect`. Not the semantic index's upper-case
spelling.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Electrical type of a schematic pin as the compiled netlist reports it:\nKiCad's pin type token, lower case, as the symbol file writes it\n(kicad_monkey 2026.9.7 `kicad_sch_enums.py:12-37`, `PinElectricalType`;\nthe netlist copies its value, `kicad_netlist_compiler.py:1086-1092`). A\nlibrary pin with no type reads as `unspecified`; the pre-2021 token\n`unconnected` reads as `no_connect`. Not the semantic index's upper-case\nspelling.",
///  "type": "string",
///  "enum": [
///    "input",
///    "output",
///    "bidirectional",
///    "tri_state",
///    "passive",
///    "free",
///    "unspecified",
///    "power_in",
///    "power_out",
///    "open_collector",
///    "open_emitter",
///    "no_connect"
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
pub enum SystemInterfacePinType {
    #[serde(rename = "input")]
    Input,
    #[serde(rename = "output")]
    Output,
    #[serde(rename = "bidirectional")]
    Bidirectional,
    #[serde(rename = "tri_state")]
    TriState,
    #[serde(rename = "passive")]
    Passive,
    #[serde(rename = "free")]
    Free,
    #[serde(rename = "unspecified")]
    Unspecified,
    #[serde(rename = "power_in")]
    PowerIn,
    #[serde(rename = "power_out")]
    PowerOut,
    #[serde(rename = "open_collector")]
    OpenCollector,
    #[serde(rename = "open_emitter")]
    OpenEmitter,
    #[serde(rename = "no_connect")]
    NoConnect,
}
impl ::std::fmt::Display for SystemInterfacePinType {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Input => f.write_str("input"),
            Self::Output => f.write_str("output"),
            Self::Bidirectional => f.write_str("bidirectional"),
            Self::TriState => f.write_str("tri_state"),
            Self::Passive => f.write_str("passive"),
            Self::Free => f.write_str("free"),
            Self::Unspecified => f.write_str("unspecified"),
            Self::PowerIn => f.write_str("power_in"),
            Self::PowerOut => f.write_str("power_out"),
            Self::OpenCollector => f.write_str("open_collector"),
            Self::OpenEmitter => f.write_str("open_emitter"),
            Self::NoConnect => f.write_str("no_connect"),
        }
    }
}
impl ::std::str::FromStr for SystemInterfacePinType {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "input" => Ok(Self::Input),
            "output" => Ok(Self::Output),
            "bidirectional" => Ok(Self::Bidirectional),
            "tri_state" => Ok(Self::TriState),
            "passive" => Ok(Self::Passive),
            "free" => Ok(Self::Free),
            "unspecified" => Ok(Self::Unspecified),
            "power_in" => Ok(Self::PowerIn),
            "power_out" => Ok(Self::PowerOut),
            "open_collector" => Ok(Self::OpenCollector),
            "open_emitter" => Ok(Self::OpenEmitter),
            "no_connect" => Ok(Self::NoConnect),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfacePinType {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemInterfacePinType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfacePinType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**A non-empty set of pin electrical types, sorted in code point order of
their string values, without duplicates (`interface_extractor.py:428`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A non-empty set of pin electrical types, sorted in code point order of\ntheir string values, without duplicates (`interface_extractor.py:428`).",
///  "type": "array",
///  "items": {
///    "$ref": "#/$defs/SystemInterfacePinType"
///  },
///  "minItems": 1,
///  "uniqueItems": true
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct SystemInterfacePinTypeSet(pub Vec<SystemInterfacePinType>);
impl ::std::ops::Deref for SystemInterfacePinTypeSet {
    type Target = Vec<SystemInterfacePinType>;
    fn deref(&self) -> &Vec<SystemInterfacePinType> {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfacePinTypeSet> for Vec<SystemInterfacePinType> {
    fn from(value: SystemInterfacePinTypeSet) -> Self {
        value.0
    }
}
impl ::std::convert::From<Vec<SystemInterfacePinType>> for SystemInterfacePinTypeSet {
    fn from(value: Vec<SystemInterfacePinType>) -> Self {
        Self(value)
    }
}
/**Three unitless factors `[x, y, z]`, each rounded to 1e-4 as `_round` does
(`interface_extractor.py:168-170`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Three unitless factors `[x, y, z]`, each rounded to 1e-4 as `_round` does\n(`interface_extractor.py:168-170`).",
///  "type": "array",
///  "items": {
///    "type": "number"
///  },
///  "maxItems": 3,
///  "minItems": 3
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct SystemInterfaceScaleTriple(pub [f64; 3usize]);
impl ::std::ops::Deref for SystemInterfaceScaleTriple {
    type Target = [f64; 3usize];
    fn deref(&self) -> &[f64; 3usize] {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfaceScaleTriple> for [f64; 3usize] {
    fn from(value: SystemInterfaceScaleTriple) -> Self {
        value.0
    }
}
impl ::std::convert::From<[f64; 3usize]> for SystemInterfaceScaleTriple {
    fn from(value: [f64; 3usize]) -> Self {
        Self(value)
    }
}
/**One project's System Builder interface: every placed symbol reference with
pins, keyed by occurrence, with the schematic nets of each pin, the board
pad nets for the PCB-sync warning, the footprint geometry, the board
thickness and outline, extraction diagnostics, and a digest over all of
those facts. A project with no board has `hasPcb` false and every board
field null. The bundle member is a pure function of the parsed sources: it
carries `digest` but not `projectId`, `commit` or `extractor`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.system_interface:v1",
///  "title": "SystemInterfaceV1",
///  "description": "One project's System Builder interface: every placed symbol reference with\npins, keyed by occurrence, with the schematic nets of each pin, the board\npad nets for the PCB-sync warning, the footprint geometry, the board\nthickness and outline, extraction diagnostics, and a digest over all of\nthose facts. A project with no board has `hasPcb` false and every board\nfield null. The bundle member is a pure function of the parsed sources: it\ncarries `digest` but not `projectId`, `commit` or `extractor`.",
///  "type": "object",
///  "required": [
///    "boardOutlineMm",
///    "boardThicknessMm",
///    "components",
///    "diagnostics",
///    "digest",
///    "hasPcb",
///    "schema"
///  ],
///  "properties": {
///    "boardOutlineMm": {
///      "description": "Axis-aligned bounds of the board outline in the board frame (+y up),\nextractor v8 (`interface_extractor.py:304-321`, `:459`;\n`CONTRACTS_P2.md` §14.6). Null when there is no board, or when the board\nhas no Edge.Cuts graphic and no items with bounds.",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/SystemInterfaceBoardOutline"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "boardThicknessMm": {
///      "description": "Board thickness in millimetres from the board's `(general (thickness …))`,\nrounded to 1e-4 mm (`interface_extractor.py:458`). Null when there is no\nboard, or when the board's thickness is missing or zero.",
///      "oneOf": [
///        {
///          "type": "number"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "commit": {
///      "description": "Git commit the artifact was extracted at (`interface_extractor.py:455`,\nfrom `extract_for_revision` at `:478`). Absent in the bundle member,\nwhich is keyed by revision key, not by commit. Null when the extractor\nran on a working tree without a commit (`commit=None` passed to\n`extract_interface`, as the test suite does); the stored artifacts always hold\na 40-digit SHA-1 (`system_interface_artifacts.commit` check,\n`backend/app/services/workspace_migrations/m026_system_builder.py:186`).\nNot digested.",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/GitObjectId"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "components": {
///      "description": "Every placed symbol reference that has at least one schematic pin, one\nentry per reference (all units of a multi-unit symbol together), sorted\nby `reference` in natural order (conventions.md §9, `_natural`,\n`interface_extractor.py:89-92`, `:391`); `reference` is unique. A placed\nsymbol counts when it has a `lib_id` and an instance record for its sheet\npath with a non-empty reference (`:104-120`). Virtual references starting\nwith `#` are excluded; unannotated references (containing `?`) are\nincluded. Empty when no symbol has pins.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemInterfaceComponent"
///      }
///    },
///    "diagnostics": {
///      "description": "Extraction diagnostics, sorted by `code`, then `portKey`, then `pad`\n(null as the empty string), each in code point order\n(`interface_extractor.py:461-463`). Empty when there are none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemInterfaceDiagnostic"
///      }
///    },
///    "digest": {
///      "description": "SHA-256 over the canonical JSON of this document without `digest`,\n`extractor`, `projectId` and `commit` (`interface_digest`,\n`interface_extractor.py:52-62`, `:465`). Two revisions with the same\ninterface facts have the same digest whatever their project, commit or\nextractor build. The Rust producer computes it over the same bytes\nPython does (field map, \"Digest\").",
///      "$ref": "#/$defs/SystemInterfaceDigest"
///    },
///    "extractor": {
///      "description": "Which extractor produced the artifact (`interface_extractor.py:456`).\nAbsent in the bundle member, whose generator `bundle.json` records.\nSystem Builder keys its artifact cache by `extractor.version`\n(`systems/store_reviews.py:380`). Not digested.",
///      "$ref": "#/$defs/SystemInterfaceExtractor"
///    },
///    "hasPcb": {
///      "description": "Whether the design has a board: the configured `.kicad_pcb` exists\n(`interface_extractor.py:380-382`, `:457`). When false, `boardThicknessMm`,\n`boardOutlineMm`, every `pcbNets` and every `geometry` are null.",
///      "type": "boolean"
///    },
///    "projectId": {
///      "description": "Prism project id the artifact was extracted for, `str(project.id)`\n(`interface_extractor.py:454`, from `extract_for_revision` at `:477`).\nAbsent in the bundle member, which does not know the project; present in\nevery artifact the extractor writes and in every artifact System Builder\nstores or serves (`systems/store_reviews.py:379`, read by the frontend's\n`InstanceInterface.projectId`, `frontend/src/types/system.ts:380`). Not\ndigested.",
///      "type": "string",
///      "minLength": 1
///    },
///    "schema": {
///      "description": "Schema id (`interface_extractor.py:37`), unchanged since extractor version 1. It is part of the digested body.",
///      "type": "string",
///      "const": "prism.system_interface.v1"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInterfaceV1 {
    ///Schema id (`interface_extractor.py:37`), unchanged since extractor version 1. It is part of the digested body.
    pub schema: ::std::string::String,
    /**Prism project id the artifact was extracted for, `str(project.id)`
    (`interface_extractor.py:454`, from `extract_for_revision` at `:477`).
    Absent in the bundle member, which does not know the project; present in
    every artifact the extractor writes and in every artifact System Builder
    stores or serves (`systems/store_reviews.py:379`, read by the frontend's
    `InstanceInterface.projectId`, `frontend/src/types/system.ts:380`). Not
    digested.*/
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub project_id: ::std::option::Option<SystemInterfaceV1ProjectId>,
    /**Git commit the artifact was extracted at (`interface_extractor.py:455`,
    from `extract_for_revision` at `:478`). Absent in the bundle member,
    which is keyed by revision key, not by commit. Null when the extractor
    ran on a working tree without a commit (`commit=None` passed to
    `extract_interface`, as the test suite does); the stored artifacts always hold
    a 40-digit SHA-1 (`system_interface_artifacts.commit` check,
    `backend/app/services/workspace_migrations/m026_system_builder.py:186`).
    Not digested.*/
    #[serde(
        default,
        deserialize_with = "crate::deserialize_present_nullable",
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub commit: ::std::option::Option<::std::option::Option<GitObjectId>>,
    /**Which extractor produced the artifact (`interface_extractor.py:456`).
    Absent in the bundle member, whose generator `bundle.json` records.
    System Builder keys its artifact cache by `extractor.version`
    (`systems/store_reviews.py:380`). Not digested.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub extractor: ::std::option::Option<SystemInterfaceExtractor>,
    /**Whether the design has a board: the configured `.kicad_pcb` exists
    (`interface_extractor.py:380-382`, `:457`). When false, `boardThicknessMm`,
    `boardOutlineMm`, every `pcbNets` and every `geometry` are null.*/
    #[serde(rename = "hasPcb")]
    pub has_pcb: bool,
    /**Board thickness in millimetres from the board's `(general (thickness …))`,
    rounded to 1e-4 mm (`interface_extractor.py:458`). Null when there is no
    board, or when the board's thickness is missing or zero.*/
    #[serde(rename = "boardThicknessMm")]
    pub board_thickness_mm: ::std::option::Option<f64>,
    /**Axis-aligned bounds of the board outline in the board frame (+y up),
    extractor v8 (`interface_extractor.py:304-321`, `:459`;
    `CONTRACTS_P2.md` §14.6). Null when there is no board, or when the board
    has no Edge.Cuts graphic and no items with bounds.*/
    #[serde(rename = "boardOutlineMm")]
    pub board_outline_mm: ::std::option::Option<SystemInterfaceBoardOutline>,
    /**Every placed symbol reference that has at least one schematic pin, one
    entry per reference (all units of a multi-unit symbol together), sorted
    by `reference` in natural order (conventions.md §9, `_natural`,
    `interface_extractor.py:89-92`, `:391`); `reference` is unique. A placed
    symbol counts when it has a `lib_id` and an instance record for its sheet
    path with a non-empty reference (`:104-120`). Virtual references starting
    with `#` are excluded; unannotated references (containing `?`) are
    included. Empty when no symbol has pins.*/
    pub components: ::std::vec::Vec<SystemInterfaceComponent>,
    /**Extraction diagnostics, sorted by `code`, then `portKey`, then `pad`
    (null as the empty string), each in code point order
    (`interface_extractor.py:461-463`). Empty when there are none.*/
    pub diagnostics: ::std::vec::Vec<SystemInterfaceDiagnostic>,
    /**SHA-256 over the canonical JSON of this document without `digest`,
    `extractor`, `projectId` and `commit` (`interface_digest`,
    `interface_extractor.py:52-62`, `:465`). Two revisions with the same
    interface facts have the same digest whatever their project, commit or
    extractor build. The Rust producer computes it over the same bytes
    Python does (field map, "Digest").*/
    pub digest: SystemInterfaceDigest,
}
/**Prism project id the artifact was extracted for, `str(project.id)`
(`interface_extractor.py:454`, from `extract_for_revision` at `:477`).
Absent in the bundle member, which does not know the project; present in
every artifact the extractor writes and in every artifact System Builder
stores or serves (`systems/store_reviews.py:379`, read by the frontend's
`InstanceInterface.projectId`, `frontend/src/types/system.ts:380`). Not
digested.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Prism project id the artifact was extracted for, `str(project.id)`\n(`interface_extractor.py:454`, from `extract_for_revision` at `:477`).\nAbsent in the bundle member, which does not know the project; present in\nevery artifact the extractor writes and in every artifact System Builder\nstores or serves (`systems/store_reviews.py:379`, read by the frontend's\n`InstanceInterface.projectId`, `frontend/src/types/system.ts:380`). Not\ndigested.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemInterfaceV1ProjectId(::std::string::String);
impl ::std::ops::Deref for SystemInterfaceV1ProjectId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemInterfaceV1ProjectId> for ::std::string::String {
    fn from(value: SystemInterfaceV1ProjectId) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemInterfaceV1ProjectId {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemInterfaceV1ProjectId {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemInterfaceV1ProjectId {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemInterfaceV1ProjectId {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemInterfaceV1ProjectId {
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
