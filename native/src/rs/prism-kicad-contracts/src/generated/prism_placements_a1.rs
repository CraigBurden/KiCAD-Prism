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
/**Length or coordinate in integer nanometres, KiCad's internal board unit.
Converted from the file's decimal millimetres as KiCad's own parser does:
the double product value_mm * 1e6, rounded half away from zero. A single
coordinate or dimension fits KiCad's 32-bit range; sums (for example a
net's total track length) may not, hence a safe integer (|n| < 2^53).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Length or coordinate in integer nanometres, KiCad's internal board unit.\nConverted from the file's decimal millimetres as KiCad's own parser does:\nthe double product value_mm * 1e6, rounded half away from zero. A single\ncoordinate or dimension fits KiCad's 32-bit range; sums (for example a\nnet's total track length) may not, hence a safe integer (|n| < 2^53).",
///  "type": "integer"
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct Nanometres(pub i64);
impl ::std::ops::Deref for Nanometres {
    type Target = i64;
    fn deref(&self) -> &i64 {
        &self.0
    }
}
impl ::std::convert::From<Nanometres> for i64 {
    fn from(value: Nanometres) -> Self {
        value.0
    }
}
impl ::std::convert::From<i64> for Nanometres {
    fn from(value: i64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for Nanometres {
    type Err = <i64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for Nanometres {
    type Error = <i64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for Nanometres {
    type Error = <i64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for Nanometres {
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
/**Footprint placements of one board. Written once per bundle at stage
`parse`; carries no provenance (bundle.json records it). When the project
has no board, `footprints` and `designators` are empty and `outlineBounds`
is absent.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.placements:a1",
///  "title": "PlacementsA1",
///  "description": "Footprint placements of one board. Written once per bundle at stage\n`parse`; carries no provenance (bundle.json records it). When the project\nhas no board, `footprints` and `designators` are empty and `outlineBounds`\nis absent.",
///  "type": "object",
///  "required": [
///    "designators",
///    "footprints",
///    "schema"
///  ],
///  "properties": {
///    "auxAxisOrigin": {
///      "description": "a1: the board's auxiliary axis origin, `(setup (aux_axis_origin x y))`,\nboard-absolute. Position files measure from it (KiCad's \"Use drill/place\nfile origin\"; the JLCPCB CPL, ADR amendment C3 §3.3). Absent when the\nboard does not set one, which readers take as 0,0, or the project has no\nboard.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "designators": {
///      "description": "The distinct `reference` values of `footprints`, sorted in code point\norder, each once. Footprints without a `reference` contribute nothing.\nRelease Studio's designator set, and the names System Builder matches\ncomponent bodies in the component GLB by.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/Refdes"
///      }
///    },
///    "footprints": {
///      "description": "Every footprint of the board, in file order: the order of the top-level\n`(footprint …)` forms in the board file, whatever its attributes\n(board-only, DNP, excluded from the BOM or the position files). `uuid` is\nunique. A footprint whose `(uuid …)` is missing, not a canonical KiCadUuid, or repeats the uuid\nof an earlier footprint is left out and reported as a manifest warning;\nKiCad 9 and 10 never write such a board.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/PlacementsFootprint"
///      }
///    },
///    "outlineBounds": {
///      "description": "Board-absolute extent of the board-level `Edge.Cuts` graphics (the\ntop-level `gr_line`, `gr_rect`, `gr_circle`, `gr_arc`, `gr_poly` and\n`gr_curve` forms on `Edge.Cuts`), by the characteristic-point rule of\n`PlacementsBounds`, through line centres (stroke widths are ignored).\nEdge.Cuts graphics owned by footprints are not included. Absent when the\nboard has no such graphic, or the project has no board.",
///      "$ref": "#/$defs/PlacementsBounds"
///    },
///    "schema": {
///      "description": "Schema id of this document.",
///      "type": "string",
///      "const": "prism.placements.a1"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PlacementsA1 {
    ///Schema id of this document.
    pub schema: ::std::string::String,
    /**Every footprint of the board, in file order: the order of the top-level
    `(footprint …)` forms in the board file, whatever its attributes
    (board-only, DNP, excluded from the BOM or the position files). `uuid` is
    unique. A footprint whose `(uuid …)` is missing, not a canonical KiCadUuid, or repeats the uuid
    of an earlier footprint is left out and reported as a manifest warning;
    KiCad 9 and 10 never write such a board.*/
    pub footprints: ::std::vec::Vec<PlacementsFootprint>,
    /**The distinct `reference` values of `footprints`, sorted in code point
    order, each once. Footprints without a `reference` contribute nothing.
    Release Studio's designator set, and the names System Builder matches
    component bodies in the component GLB by.*/
    pub designators: ::std::vec::Vec<Refdes>,
    /**Board-absolute extent of the board-level `Edge.Cuts` graphics (the
    top-level `gr_line`, `gr_rect`, `gr_circle`, `gr_arc`, `gr_poly` and
    `gr_curve` forms on `Edge.Cuts`), by the characteristic-point rule of
    `PlacementsBounds`, through line centres (stroke widths are ignored).
    Edge.Cuts graphics owned by footprints are not included. Absent when the
    board has no such graphic, or the project has no board.*/
    #[serde(
        rename = "outlineBounds",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub outline_bounds: ::std::option::Option<PlacementsBounds>,
    /**a1: the board's auxiliary axis origin, `(setup (aux_axis_origin x y))`,
    board-absolute. Position files measure from it (KiCad's "Use drill/place
    file origin"; the JLCPCB CPL, ADR amendment C3 §3.3). Absent when the
    board does not set one, which readers take as 0,0, or the project has no
    board.*/
    #[serde(
        rename = "auxAxisOrigin",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub aux_axis_origin: ::std::option::Option<PointNm>,
}
/**An axis-aligned extent in nanometres: the minimum and maximum x and y over
the characteristic points of a set of graphics, each point computed in
binary64 millimetres from the parsed values and converted to nanometres;
any transcendental function (atan2, sin, cos) is the pure-Rust `libm`
crate's, so the result is the same on every architecture.
The points of each graphic are: for a line or a rectangle, its start and
end; for a circle with centre c through point e, c − (r, r) and c + (r, r)
with r = hypot(e − c); for an arc, its start, mid and end plus every point
at 0°, 90°, 180° or 270° on its circle that it sweeps through; for a
polygon, its vertices (an `(arc …)` element inside `pts` by the arc rule);
for a Bézier curve, its four control points. The frame (board-absolute or
footprint-local) is given by the field that holds it.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "An axis-aligned extent in nanometres: the minimum and maximum x and y over\nthe characteristic points of a set of graphics, each point computed in\nbinary64 millimetres from the parsed values and converted to nanometres;\nany transcendental function (atan2, sin, cos) is the pure-Rust `libm`\ncrate's, so the result is the same on every architecture.\nThe points of each graphic are: for a line or a rectangle, its start and\nend; for a circle with centre c through point e, c − (r, r) and c + (r, r)\nwith r = hypot(e − c); for an arc, its start, mid and end plus every point\nat 0°, 90°, 180° or 270° on its circle that it sweeps through; for a\npolygon, its vertices (an `(arc …)` element inside `pts` by the arc rule);\nfor a Bézier curve, its four control points. The frame (board-absolute or\nfootprint-local) is given by the field that holds it.",
///  "type": "object",
///  "required": [
///    "maxNm",
///    "minNm"
///  ],
///  "properties": {
///    "maxNm": {
///      "description": "The maximum x and the maximum y (the bottom-right corner).",
///      "$ref": "#/$defs/PointNm"
///    },
///    "minNm": {
///      "description": "The minimum x and the minimum y (the top-left corner, since +y is down).",
///      "$ref": "#/$defs/PointNm"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PlacementsBounds {
    ///The minimum x and the minimum y (the top-left corner, since +y is down).
    #[serde(rename = "minNm")]
    pub min_nm: PointNm,
    ///The maximum x and the maximum y (the bottom-right corner).
    #[serde(rename = "maxNm")]
    pub max_nm: PointNm,
}
///One footprint placed on the board: its identity, placement and coarse geometry.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One footprint placed on the board: its identity, placement and coarse geometry.",
///  "type": "object",
///  "required": [
///    "dnp",
///    "excludeFromPosFiles",
///    "models",
///    "pads",
///    "positionNm",
///    "rotationDeg",
///    "side",
///    "sourceSpan",
///    "uuid"
///  ],
///  "properties": {
///    "courtyardBounds": {
///      "description": "Footprint-local extent of the footprint's courtyard: its graphics on\n`F.CrtYd` and `B.CrtYd` together, by the characteristic-point rule of\n`PlacementsBounds`, through line centres, in the frame the file writes\nthem in (relative to the anchor, before the footprint's rotation; for a\nback-side footprint already mirrored), y down. Absent when the footprint\nhas no courtyard graphic.",
///      "$ref": "#/$defs/PlacementsBounds"
///    },
///    "dnp": {
///      "description": "True when the footprint's `(attr …)` holds `dnp`: do not populate, by the board's own attribute, before any variant is applied.",
///      "type": "boolean"
///    },
///    "excludeFromPosFiles": {
///      "description": "True when the footprint's `(attr …)` holds `exclude_from_pos_files`: KiCad's position file leaves it out.",
///      "type": "boolean"
///    },
///    "libId": {
///      "description": "Library link: the first value of the `(footprint \"<lib id>\" …)` form, as\nwritten (`Resistor_SMD:R_0603_1608Metric`). Absent when it is empty.",
///      "$ref": "#/$defs/LibId"
///    },
///    "models": {
///      "description": "The footprint's 3D model references, in file order (the order of its\n`(model …)` forms), hidden ones included. The first with `hidden` false\nis System Builder's model. A `(model \"\")` with an empty path is left\nout. Empty when it has none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/PlacementsModel"
///      }
///    },
///    "pads": {
///      "description": "The footprint's pads, in file order (the order of its `(pad …)` forms).\nNumbers may repeat and may be empty. Empty when it has no pad.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/PlacementsPad"
///      }
///    },
///    "positionNm": {
///      "description": "Board-absolute anchor of the footprint: the x and y of its\n`(at x y angle)`, converted to nanometres. (0, 0) when the form has no\n`(at …)`, as KiCad loads it.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "reference": {
///      "description": "Reference designator as written: the value of the footprint's first\n`(property \"Reference\" …)`. Not trimmed. Absent when it is missing or\nempty.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "rotationDeg": {
///      "description": "Orientation of the footprint: the angle of its `(at x y angle)` as\nwritten, 0 when the form has none; not normalized (KiCad normally writes\nit in (-180, 180]). KiCad's convention: degrees counter-clockwise as the\nboard is seen from the front on screen, so in the y-down board frame a\nfootprint-local point (lx, ly) is at x = ax + lx·cos θ + ly·sin θ,\ny = ay − lx·sin θ + ly·cos θ, where (ax, ay) is `positionNm`. The same\nformula holds on the back: KiCad writes a back-side footprint's children\nalready mirrored.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "side": {
///      "description": "`back` when the footprint's `(layer …)` starts with `B.` (it is flipped), otherwise `front`, including when the form has no layer.",
///      "$ref": "#/$defs/Side"
///    },
///    "sourceSpan": {
///      "description": "Where the footprint's `(footprint …)` form is in the board file's bytes\nas committed, so a reader can copy the form without parsing the board.",
///      "$ref": "#/$defs/PlacementsSourceSpan"
///    },
///    "uuid": {
///      "description": "The footprint's `(uuid …)`, as\nwritten. Unique in `footprints`. The same id as `prism.occurrences.a0`\n`footprints[*].uuid` and `prism.semantic_index.a1` `pcbRefs[*].footprintUuid`.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PlacementsFootprint {
    /**The footprint's `(uuid …)`, as
    written. Unique in `footprints`. The same id as `prism.occurrences.a0`
    `footprints[*].uuid` and `prism.semantic_index.a1` `pcbRefs[*].footprintUuid`.*/
    pub uuid: KiCadUuid,
    /**Reference designator as written: the value of the footprint's first
    `(property "Reference" …)`. Not trimmed. Absent when it is missing or
    empty.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub reference: ::std::option::Option<Refdes>,
    /**Library link: the first value of the `(footprint "<lib id>" …)` form, as
    written (`Resistor_SMD:R_0603_1608Metric`). Absent when it is empty.*/
    #[serde(
        rename = "libId",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub lib_id: ::std::option::Option<LibId>,
    ///`back` when the footprint's `(layer …)` starts with `B.` (it is flipped), otherwise `front`, including when the form has no layer.
    pub side: Side,
    /**Board-absolute anchor of the footprint: the x and y of its
    `(at x y angle)`, converted to nanometres. (0, 0) when the form has no
    `(at …)`, as KiCad loads it.*/
    #[serde(rename = "positionNm")]
    pub position_nm: PointNm,
    /**Orientation of the footprint: the angle of its `(at x y angle)` as
    written, 0 when the form has none; not normalized (KiCad normally writes
    it in (-180, 180]). KiCad's convention: degrees counter-clockwise as the
    board is seen from the front on screen, so in the y-down board frame a
    footprint-local point (lx, ly) is at x = ax + lx·cos θ + ly·sin θ,
    y = ay − lx·sin θ + ly·cos θ, where (ax, ay) is `positionNm`. The same
    formula holds on the back: KiCad writes a back-side footprint's children
    already mirrored.*/
    #[serde(rename = "rotationDeg")]
    pub rotation_deg: Degrees,
    ///True when the footprint's `(attr …)` holds `dnp`: do not populate, by the board's own attribute, before any variant is applied.
    pub dnp: bool,
    ///True when the footprint's `(attr …)` holds `exclude_from_pos_files`: KiCad's position file leaves it out.
    #[serde(rename = "excludeFromPosFiles")]
    pub exclude_from_pos_files: bool,
    /**Footprint-local extent of the footprint's courtyard: its graphics on
    `F.CrtYd` and `B.CrtYd` together, by the characteristic-point rule of
    `PlacementsBounds`, through line centres, in the frame the file writes
    them in (relative to the anchor, before the footprint's rotation; for a
    back-side footprint already mirrored), y down. Absent when the footprint
    has no courtyard graphic.*/
    #[serde(
        rename = "courtyardBounds",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub courtyard_bounds: ::std::option::Option<PlacementsBounds>,
    /**The footprint's pads, in file order (the order of its `(pad …)` forms).
    Numbers may repeat and may be empty. Empty when it has no pad.*/
    pub pads: ::std::vec::Vec<PlacementsPad>,
    /**The footprint's 3D model references, in file order (the order of its
    `(model …)` forms), hidden ones included. The first with `hidden` false
    is System Builder's model. A `(model "")` with an empty path is left
    out. Empty when it has none.*/
    pub models: ::std::vec::Vec<PlacementsModel>,
    /**Where the footprint's `(footprint …)` form is in the board file's bytes
    as committed, so a reader can copy the form without parsing the board.*/
    #[serde(rename = "sourceSpan")]
    pub source_span: PlacementsSourceSpan,
}
///The length of a form in bytes: at least 2, for `(` and `)`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The length of a form in bytes: at least 2, for `(` and `)`.",
///  "type": "integer",
///  "minimum": 2.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct PlacementsFormLength(pub i64);
impl ::std::ops::Deref for PlacementsFormLength {
    type Target = i64;
    fn deref(&self) -> &i64 {
        &self.0
    }
}
impl ::std::convert::From<PlacementsFormLength> for i64 {
    fn from(value: PlacementsFormLength) -> Self {
        value.0
    }
}
impl ::std::convert::From<i64> for PlacementsFormLength {
    fn from(value: i64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for PlacementsFormLength {
    type Err = <i64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for PlacementsFormLength {
    type Error = <i64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for PlacementsFormLength {
    type Error = <i64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for PlacementsFormLength {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**One `(model …)` reference of a footprint, unresolved, with the transform
KiCad applies to the model in its 3D frame relative to the footprint.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One `(model …)` reference of a footprint, unresolved, with the transform\nKiCad applies to the model in its 3D frame relative to the footprint.",
///  "type": "object",
///  "required": [
///    "hidden",
///    "offset",
///    "path",
///    "rotation",
///    "scale"
///  ],
///  "properties": {
///    "hidden": {
///      "description": "True when the form has `(hide yes)` or a bare `hide`; false when it has `(hide no)` or no hide token.",
///      "type": "boolean"
///    },
///    "offset": {
///      "description": "The model's offset.",
///      "$ref": "#/$defs/PlacementsModelOffset"
///    },
///    "path": {
///      "description": "The model path exactly as written: not resolved, variables such as\n`${KICAD9_3DMODEL_DIR}` and `${KIPRJMOD}` and `kicad-embed://` names\nkept.",
///      "type": "string",
///      "minLength": 1
///    },
///    "rotation": {
///      "description": "The model's rotation.",
///      "$ref": "#/$defs/PlacementsModelRotation"
///    },
///    "scale": {
///      "description": "The model's scale.",
///      "$ref": "#/$defs/PlacementsModelScale"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PlacementsModel {
    /**The model path exactly as written: not resolved, variables such as
    `${KICAD9_3DMODEL_DIR}` and `${KIPRJMOD}` and `kicad-embed://` names
    kept.*/
    pub path: PlacementsModelPath,
    ///True when the form has `(hide yes)` or a bare `hide`; false when it has `(hide no)` or no hide token.
    pub hidden: bool,
    ///The model's offset.
    pub offset: PlacementsModelOffset,
    ///The model's rotation.
    pub rotation: PlacementsModelRotation,
    ///The model's scale.
    pub scale: PlacementsModelScale,
}
/**A model's `(offset (xyz x y z))`, millimetres in the file, converted to
nanometres; a pre-KiCad 5 `(at (xyz …))` in inches is converted ×25.4
first, as KiCad does. (0, 0, 0) when the form has neither. Copied in
KiCad's 3D model frame, not converted to the board frame.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A model's `(offset (xyz x y z))`, millimetres in the file, converted to\nnanometres; a pre-KiCad 5 `(at (xyz …))` in inches is converted ×25.4\nfirst, as KiCad does. (0, 0, 0) when the form has neither. Copied in\nKiCad's 3D model frame, not converted to the board frame.",
///  "type": "object",
///  "required": [
///    "xNm",
///    "yNm",
///    "zNm"
///  ],
///  "properties": {
///    "xNm": {
///      "description": "X offset.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "yNm": {
///      "description": "Y offset.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "zNm": {
///      "description": "Z offset.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PlacementsModelOffset {
    ///X offset.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///Y offset.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
    ///Z offset.
    #[serde(rename = "zNm")]
    pub z_nm: Nanometres,
}
/**The model path exactly as written: not resolved, variables such as
`${KICAD9_3DMODEL_DIR}` and `${KIPRJMOD}` and `kicad-embed://` names
kept.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The model path exactly as written: not resolved, variables such as\n`${KICAD9_3DMODEL_DIR}` and `${KIPRJMOD}` and `kicad-embed://` names\nkept.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct PlacementsModelPath(::std::string::String);
impl ::std::ops::Deref for PlacementsModelPath {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<PlacementsModelPath> for ::std::string::String {
    fn from(value: PlacementsModelPath) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for PlacementsModelPath {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for PlacementsModelPath {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for PlacementsModelPath {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for PlacementsModelPath {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for PlacementsModelPath {
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
///A model's `(rotate (xyz x y z))` as written, degrees about each axis of KiCad's 3D model frame; 0 for each when the form is absent.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A model's `(rotate (xyz x y z))` as written, degrees about each axis of KiCad's 3D model frame; 0 for each when the form is absent.",
///  "type": "object",
///  "required": [
///    "xDeg",
///    "yDeg",
///    "zDeg"
///  ],
///  "properties": {
///    "xDeg": {
///      "description": "Rotation about x.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "yDeg": {
///      "description": "Rotation about y.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "zDeg": {
///      "description": "Rotation about z.",
///      "$ref": "#/$defs/Degrees"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PlacementsModelRotation {
    ///Rotation about x.
    #[serde(rename = "xDeg")]
    pub x_deg: Degrees,
    ///Rotation about y.
    #[serde(rename = "yDeg")]
    pub y_deg: Degrees,
    ///Rotation about z.
    #[serde(rename = "zDeg")]
    pub z_deg: Degrees,
}
///A model's `(scale (xyz x y z))` as written, unitless factors; 1 for each when the form is absent.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A model's `(scale (xyz x y z))` as written, unitless factors; 1 for each when the form is absent.",
///  "type": "object",
///  "required": [
///    "x",
///    "y",
///    "z"
///  ],
///  "properties": {
///    "x": {
///      "description": "Scale along x.",
///      "type": "number"
///    },
///    "y": {
///      "description": "Scale along y.",
///      "type": "number"
///    },
///    "z": {
///      "description": "Scale along z.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PlacementsModelScale {
    ///Scale along x.
    pub x: f64,
    ///Scale along y.
    pub y: f64,
    ///Scale along z.
    pub z: f64,
}
///One pad of a footprint: its number, type, shape, board-absolute anchor and size.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One pad of a footprint: its number, type, shape, board-absolute anchor and size.",
///  "type": "object",
///  "required": [
///    "number",
///    "positionNm",
///    "shape",
///    "size",
///    "type"
///  ],
///  "properties": {
///    "number": {
///      "description": "The pad number as written; empty for an unnumbered pad (typically a mechanical hole).",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "positionNm": {
///      "description": "Board-absolute anchor of the pad, computed as KiCad's parser places it\n(`PAD::SetFPRelativePosition`, `RotatePoint`): the pad's footprint-local\n`(at x y …)` converted to integer nanometres, rotated by the footprint's\n`rotationDeg` normalized to [0, 360) — exactly (integer swaps) at 0, 90,\n180 and 270, with sin and cos taken as KiCad's `EDA_ANGLE` does (0, ±1,\n±√½ at multiples of 45°, otherwise sin and cos of the angle in radians\nthrough the pure-Rust `libm` crate) and each coordinate rounded half away\nfrom zero — then added to the footprint's integer `positionNm`. The\nrotation is the formula at `rotationDeg`. Equal to KiCad's own pad\nposition on every architecture.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "shape": {
///      "description": "The pad's shape token.",
///      "$ref": "#/$defs/PlacementsPadShape"
///    },
///    "size": {
///      "description": "The pad's `(size x y)`, in the pad's own frame before its rotation.",
///      "$ref": "#/$defs/PlacementsPadSize"
///    },
///    "type": {
///      "description": "The pad's type token.",
///      "$ref": "#/$defs/PlacementsPadType"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PlacementsPad {
    ///The pad number as written; empty for an unnumbered pad (typically a mechanical hole).
    pub number: PadNumber,
    ///The pad's type token.
    #[serde(rename = "type")]
    pub type_: PlacementsPadType,
    ///The pad's shape token.
    pub shape: PlacementsPadShape,
    /**Board-absolute anchor of the pad, computed as KiCad's parser places it
    (`PAD::SetFPRelativePosition`, `RotatePoint`): the pad's footprint-local
    `(at x y …)` converted to integer nanometres, rotated by the footprint's
    `rotationDeg` normalized to [0, 360) — exactly (integer swaps) at 0, 90,
    180 and 270, with sin and cos taken as KiCad's `EDA_ANGLE` does (0, ±1,
    ±√½ at multiples of 45°, otherwise sin and cos of the angle in radians
    through the pure-Rust `libm` crate) and each coordinate rounded half away
    from zero — then added to the footprint's integer `positionNm`. The
    rotation is the formula at `rotationDeg`. Equal to KiCad's own pad
    position on every architecture.*/
    #[serde(rename = "positionNm")]
    pub position_nm: PointNm,
    ///The pad's `(size x y)`, in the pad's own frame before its rotation.
    pub size: PlacementsPadSize,
}
/**A pad's shape: the third token of its `(pad …)` form, spelled exactly as
KiCad writes it. A chamfered rectangle is `roundrect` with a chamfer in
the file. KiCad rejects any other token.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A pad's shape: the third token of its `(pad …)` form, spelled exactly as\nKiCad writes it. A chamfered rectangle is `roundrect` with a chamfer in\nthe file. KiCad rejects any other token.",
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
pub enum PlacementsPadShape {
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
impl ::std::fmt::Display for PlacementsPadShape {
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
impl ::std::str::FromStr for PlacementsPadShape {
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
impl ::std::convert::TryFrom<&str> for PlacementsPadShape {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for PlacementsPadShape {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for PlacementsPadShape {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///The `(size x y)` of a pad, in nanometres.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The `(size x y)` of a pad, in nanometres.",
///  "type": "object",
///  "required": [
///    "xNm",
///    "yNm"
///  ],
///  "properties": {
///    "xNm": {
///      "description": "Width: the first value of `(size x y)`.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "yNm": {
///      "description": "Height: the second value of `(size x y)`.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PlacementsPadSize {
    ///Width: the first value of `(size x y)`.
    #[serde(rename = "xNm")]
    pub x_nm: NonNegativeNanometres,
    ///Height: the second value of `(size x y)`.
    #[serde(rename = "yNm")]
    pub y_nm: NonNegativeNanometres,
}
/**A pad's type: the second token of its `(pad "<number>" <type> <shape> …)`
form, spelled exactly as KiCad writes it. KiCad rejects any other token.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A pad's type: the second token of its `(pad \"<number>\" <type> <shape> …)`\nform, spelled exactly as KiCad writes it. KiCad rejects any other token.",
///  "type": "string",
///  "enum": [
///    "thru_hole",
///    "smd",
///    "connect",
///    "np_thru_hole"
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
pub enum PlacementsPadType {
    #[serde(rename = "thru_hole")]
    ThruHole,
    #[serde(rename = "smd")]
    Smd,
    #[serde(rename = "connect")]
    Connect,
    #[serde(rename = "np_thru_hole")]
    NpThruHole,
}
impl ::std::fmt::Display for PlacementsPadType {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::ThruHole => f.write_str("thru_hole"),
            Self::Smd => f.write_str("smd"),
            Self::Connect => f.write_str("connect"),
            Self::NpThruHole => f.write_str("np_thru_hole"),
        }
    }
}
impl ::std::str::FromStr for PlacementsPadType {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "thru_hole" => Ok(Self::ThruHole),
            "smd" => Ok(Self::Smd),
            "connect" => Ok(Self::Connect),
            "np_thru_hole" => Ok(Self::NpThruHole),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for PlacementsPadType {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for PlacementsPadType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for PlacementsPadType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**A byte range of the board file as committed: the bytes from the opening
`(` of a form to its closing `)`, both included.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A byte range of the board file as committed: the bytes from the opening\n`(` of a form to its closing `)`, both included.",
///  "type": "object",
///  "required": [
///    "lengthBytes",
///    "offsetBytes"
///  ],
///  "properties": {
///    "lengthBytes": {
///      "description": "Length of the form in bytes, through its closing `)`.",
///      "$ref": "#/$defs/PlacementsFormLength"
///    },
///    "offsetBytes": {
///      "description": "Offset of the opening `(` from the start of the file, in bytes.",
///      "$ref": "#/$defs/ByteCount"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PlacementsSourceSpan {
    ///Offset of the opening `(` from the start of the file, in bytes.
    #[serde(rename = "offsetBytes")]
    pub offset_bytes: ByteCount,
    ///Length of the form in bytes, through its closing `)`.
    #[serde(rename = "lengthBytes")]
    pub length_bytes: PlacementsFormLength,
}
/**A point in nanometres in KiCad's board frame: +x to the right, +y down, as
in the file and never flipped. The field holding the point states whether
it is board-absolute or footprint-local. For camelCase (projection)
documents only.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A point in nanometres in KiCad's board frame: +x to the right, +y down, as\nin the file and never flipped. The field holding the point states whether\nit is board-absolute or footprint-local. For camelCase (projection)\ndocuments only.",
///  "type": "object",
///  "required": [
///    "xNm",
///    "yNm"
///  ],
///  "properties": {
///    "xNm": {
///      "description": "X coordinate in nanometres, +x to the right.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "yNm": {
///      "description": "Y coordinate in nanometres, +y down.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PointNm {
    ///X coordinate in nanometres, +x to the right.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///Y coordinate in nanometres, +y down.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
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
///Board side of a footprint, pad or graphic.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Board side of a footprint, pad or graphic.",
///  "type": "string",
///  "enum": [
///    "front",
///    "back"
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
pub enum Side {
    #[serde(rename = "front")]
    Front,
    #[serde(rename = "back")]
    Back,
}
impl ::std::fmt::Display for Side {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Front => f.write_str("front"),
            Self::Back => f.write_str("back"),
        }
    }
}
impl ::std::str::FromStr for Side {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "front" => Ok(Self::Front),
            "back" => Ok(Self::Back),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for Side {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for Side {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for Side {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
