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
///`RecordSystemInteriorLabel`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/SystemInteriorLabel"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordSystemInteriorLabel(
    pub ::std::collections::BTreeMap<::std::string::String, SystemInteriorLabel>,
);
impl ::std::ops::Deref for RecordSystemInteriorLabel {
    type Target = ::std::collections::BTreeMap<::std::string::String, SystemInteriorLabel>;
    fn deref(&self) -> &::std::collections::BTreeMap<::std::string::String, SystemInteriorLabel> {
        &self.0
    }
}
impl ::std::convert::From<RecordSystemInteriorLabel>
    for ::std::collections::BTreeMap<::std::string::String, SystemInteriorLabel>
{
    fn from(value: RecordSystemInteriorLabel) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::collections::BTreeMap<::std::string::String, SystemInteriorLabel>>
    for RecordSystemInteriorLabel
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, SystemInteriorLabel>,
    ) -> Self {
        Self(value)
    }
}
///`RecordSystemLabel`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/SystemLabel"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordSystemLabel(pub ::std::collections::BTreeMap<::std::string::String, SystemLabel>);
impl ::std::ops::Deref for RecordSystemLabel {
    type Target = ::std::collections::BTreeMap<::std::string::String, SystemLabel>;
    fn deref(&self) -> &::std::collections::BTreeMap<::std::string::String, SystemLabel> {
        &self.0
    }
}
impl ::std::convert::From<RecordSystemLabel>
    for ::std::collections::BTreeMap<::std::string::String, SystemLabel>
{
    fn from(value: RecordSystemLabel) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::collections::BTreeMap<::std::string::String, SystemLabel>>
    for RecordSystemLabel
{
    fn from(value: ::std::collections::BTreeMap<::std::string::String, SystemLabel>) -> Self {
        Self(value)
    }
}
///`RecordSystemMateRow`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/SystemMateRow"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordSystemMateRow(
    pub ::std::collections::BTreeMap<::std::string::String, SystemMateRow>,
);
impl ::std::ops::Deref for RecordSystemMateRow {
    type Target = ::std::collections::BTreeMap<::std::string::String, SystemMateRow>;
    fn deref(&self) -> &::std::collections::BTreeMap<::std::string::String, SystemMateRow> {
        &self.0
    }
}
impl ::std::convert::From<RecordSystemMateRow>
    for ::std::collections::BTreeMap<::std::string::String, SystemMateRow>
{
    fn from(value: RecordSystemMateRow) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::collections::BTreeMap<::std::string::String, SystemMateRow>>
    for RecordSystemMateRow
{
    fn from(value: ::std::collections::BTreeMap<::std::string::String, SystemMateRow>) -> Self {
        Self(value)
    }
}
///`RecordSystemPartRef`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/SystemPartRef"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordSystemPartRef(
    pub ::std::collections::BTreeMap<::std::string::String, SystemPartRef>,
);
impl ::std::ops::Deref for RecordSystemPartRef {
    type Target = ::std::collections::BTreeMap<::std::string::String, SystemPartRef>;
    fn deref(&self) -> &::std::collections::BTreeMap<::std::string::String, SystemPartRef> {
        &self.0
    }
}
impl ::std::convert::From<RecordSystemPartRef>
    for ::std::collections::BTreeMap<::std::string::String, SystemPartRef>
{
    fn from(value: RecordSystemPartRef) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::collections::BTreeMap<::std::string::String, SystemPartRef>>
    for RecordSystemPartRef
{
    fn from(value: ::std::collections::BTreeMap<::std::string::String, SystemPartRef>) -> Self {
        Self(value)
    }
}
///`RecordSystemPortPlacement`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/SystemPortPlacement"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordSystemPortPlacement(
    pub ::std::collections::BTreeMap<::std::string::String, SystemPortPlacement>,
);
impl ::std::ops::Deref for RecordSystemPortPlacement {
    type Target = ::std::collections::BTreeMap<::std::string::String, SystemPortPlacement>;
    fn deref(&self) -> &::std::collections::BTreeMap<::std::string::String, SystemPortPlacement> {
        &self.0
    }
}
impl ::std::convert::From<RecordSystemPortPlacement>
    for ::std::collections::BTreeMap<::std::string::String, SystemPortPlacement>
{
    fn from(value: RecordSystemPortPlacement) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::collections::BTreeMap<::std::string::String, SystemPortPlacement>>
    for RecordSystemPortPlacement
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, SystemPortPlacement>,
    ) -> Self {
        Self(value)
    }
}
///`RecordSystemSchematicPlacement`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/SystemSchematicPlacement"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordSystemSchematicPlacement(
    pub ::std::collections::BTreeMap<::std::string::String, SystemSchematicPlacement>,
);
impl ::std::ops::Deref for RecordSystemSchematicPlacement {
    type Target = ::std::collections::BTreeMap<::std::string::String, SystemSchematicPlacement>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, SystemSchematicPlacement> {
        &self.0
    }
}
impl ::std::convert::From<RecordSystemSchematicPlacement>
    for ::std::collections::BTreeMap<::std::string::String, SystemSchematicPlacement>
{
    fn from(value: RecordSystemSchematicPlacement) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, SystemSchematicPlacement>,
    > for RecordSystemSchematicPlacement
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, SystemSchematicPlacement>,
    ) -> Self {
        Self(value)
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
///A KiCad project, read from its design bundle.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A KiCad project, read from its design bundle.",
///  "type": "object",
///  "required": [
///    "kind",
///    "projectId",
///    "track"
///  ],
///  "properties": {
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "board"
///    },
///    "projectId": {
///      "description": "The Prism project id.",
///      "$ref": "#/$defs/SystemProjectId"
///    },
///    "track": {
///      "description": "The revision it is at.",
///      "$ref": "#/$defs/SystemTrack"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBoardSource {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The Prism project id.
    #[serde(rename = "projectId")]
    pub project_id: SystemProjectId,
    ///The revision it is at.
    pub track: SystemTrack,
}
///A board-level sub-port, stored against the project and connector.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A board-level sub-port, stored against the project and connector.",
///  "type": "object",
///  "required": [
///    "id",
///    "kind",
///    "version"
///  ],
///  "properties": {
///    "id": {
///      "description": "The board-level sub-port's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "board"
///    },
///    "version": {
///      "description": "The definition's version the user last saw. The live definition is always\nused; a newer one with different pins is a `board-sub-port-changed`\nfinding until `acknowledge-sub-port` (CONTRACTS.md §10.5).",
///      "type": "integer",
///      "maximum": 2147483647.0,
///      "minimum": 1.0
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBoardSubPortRef {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The board-level sub-port's id.
    pub id: SystemObjectId,
    /**The definition's version the user last saw. The live definition is always
    used; a newer one with different pins is a `board-sub-port-changed`
    finding until `acknowledge-sub-port` (CONTRACTS.md §10.5).*/
    pub version: ::std::num::NonZeroU64,
}
///A connector part placed on a body occurrence's face (board-less systems).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A connector part placed on a body occurrence's face (board-less systems).",
///  "type": "object",
///  "required": [
///    "frame",
///    "id",
///    "occurrence",
///    "part",
///    "quarterTurns",
///    "refdes"
///  ],
///  "properties": {
///    "frame": {
///      "description": "The part's mating frame in the body's frame.",
///      "$ref": "#/$defs/SystemPose"
///    },
///    "id": {
///      "description": "The body connector's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "occurrence": {
///      "description": "The body occurrence.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "part": {
///      "description": "The connector part.",
///      "$ref": "#/$defs/SystemPartRef"
///    },
///    "quarterTurns": {
///      "description": "Quarter turns about the frame's z axis.",
///      "type": "integer",
///      "maximum": 3.0,
///      "minimum": 0.0
///    },
///    "refdes": {
///      "description": "The designator endpoints name as `connector`; unique on its occurrence.",
///      "$ref": "#/$defs/Refdes"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBodyConnector {
    ///The body connector's id.
    pub id: SystemObjectId,
    ///The body occurrence.
    pub occurrence: SystemObjectId,
    ///The designator endpoints name as `connector`; unique on its occurrence.
    pub refdes: Refdes,
    ///The connector part.
    pub part: SystemPartRef,
    ///The part's mating frame in the body's frame.
    pub frame: SystemPose,
    ///Quarter turns about the frame's z axis.
    #[serde(rename = "quarterTurns")]
    pub quarter_turns: i64,
}
///A mechanical catalog part: an enclosure, a bracket, a module's body.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A mechanical catalog part: an enclosure, a bracket, a module's body.",
///  "type": "object",
///  "required": [
///    "componentId",
///    "kind",
///    "revisionId"
///  ],
///  "properties": {
///    "componentId": {
///      "description": "The catalog component id.",
///      "$ref": "#/$defs/SystemCatalogId"
///    },
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "body"
///    },
///    "revisionId": {
///      "description": "The revision.",
///      "$ref": "#/$defs/SystemCatalogId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBodySource {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The catalog component id.
    #[serde(rename = "componentId")]
    pub component_id: SystemCatalogId,
    ///The revision.
    #[serde(rename = "revisionId")]
    pub revision_id: SystemCatalogId,
}
///A Git branch name as the repository spells it, without `refs/heads/`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A Git branch name as the repository spells it, without `refs/heads/`.",
///  "type": "string",
///  "maxLength": 255,
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemBranchName(::std::string::String);
impl ::std::ops::Deref for SystemBranchName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemBranchName> for ::std::string::String {
    fn from(value: SystemBranchName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemBranchName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() > 255usize {
            return Err("longer than 255 characters".into());
        }
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemBranchName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBranchName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBranchName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemBranchName {
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
///A segment node at a branch point.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A segment node at a branch point.",
///  "type": "object",
///  "required": [
///    "branchPoint",
///    "kind"
///  ],
///  "properties": {
///    "branchPoint": {
///      "description": "The branch point.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "branch-point"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBranchPointNode {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The branch point.
    #[serde(rename = "branchPoint")]
    pub branch_point: SystemObjectId,
}
///One conductor of a cable.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One conductor of a cable.",
///  "type": "object",
///  "required": [
///    "drain",
///    "name"
///  ],
///  "properties": {
///    "drain": {
///      "description": "Whether it is a shield drain.",
///      "type": "boolean"
///    },
///    "name": {
///      "description": "The conductor's name in the cable's datasheet.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "wire": {
///      "description": "The wire it carries; absent when unused.",
///      "$ref": "#/$defs/SystemObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemCableConductor {
    ///The conductor's name in the cable's datasheet.
    pub name: SystemLabel,
    ///The wire it carries; absent when unused.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub wire: ::std::option::Option<SystemObjectId>,
    ///Whether it is a shield drain.
    pub drain: bool,
}
///Prism catalog component or revision id, as the catalog issues it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Prism catalog component or revision id, as the catalog issues it.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct SystemCatalogId(pub ::std::string::String);
impl ::std::ops::Deref for SystemCatalogId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemCatalogId> for ::std::string::String {
    fn from(value: SystemCatalogId) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for SystemCatalogId {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for SystemCatalogId {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for SystemCatalogId {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///A wire terminating on an end's cavity.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A wire terminating on an end's cavity.",
///  "type": "object",
///  "required": [
///    "cavity",
///    "end",
///    "kind"
///  ],
///  "properties": {
///    "cavity": {
///      "description": "The cavity.",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "end": {
///      "description": "The end.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "contact"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemContactTerminal {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The end.
    pub end: SystemObjectId,
    ///The cavity.
    pub cavity: PadNumber,
}
///What a covering on a harness segment is.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What a covering on a harness segment is.",
///  "type": "string",
///  "enum": [
///    "sleeve",
///    "heat-shrink",
///    "tape",
///    "zip-ties"
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
pub enum SystemCoveringKind {
    #[serde(rename = "sleeve")]
    Sleeve,
    #[serde(rename = "heat-shrink")]
    HeatShrink,
    #[serde(rename = "tape")]
    Tape,
    #[serde(rename = "zip-ties")]
    ZipTies,
}
impl ::std::fmt::Display for SystemCoveringKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Sleeve => f.write_str("sleeve"),
            Self::HeatShrink => f.write_str("heat-shrink"),
            Self::Tape => f.write_str("tape"),
            Self::ZipTies => f.write_str("zip-ties"),
        }
    }
}
impl ::std::str::FromStr for SystemCoveringKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "sleeve" => Ok(Self::Sleeve),
            "heat-shrink" => Ok(Self::HeatShrink),
            "tape" => Ok(Self::Tape),
            "zip-ties" => Ok(Self::ZipTies),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemCoveringKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemCoveringKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemCoveringKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A free-text description: up to 4000 characters.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A free-text description: up to 4000 characters.",
///  "type": "string",
///  "maxLength": 4000
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemDescription(::std::string::String);
impl ::std::ops::Deref for SystemDescription {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemDescription> for ::std::string::String {
    fn from(value: SystemDescription) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemDescription {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() > 4000usize {
            return Err("longer than 4000 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemDescription {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemDescription {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemDescription {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemDescription {
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
///A bundle sub-port suggestion the user dismissed.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A bundle sub-port suggestion the user dismissed.",
///  "type": "object",
///  "required": [
///    "connector",
///    "key",
///    "occurrence"
///  ],
///  "properties": {
///    "connector": {
///      "description": "The connector's reference designator.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "key": {
///      "description": "The suggestion key.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "occurrence": {
///      "description": "The occurrence.",
///      "$ref": "#/$defs/SystemObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemDismissedSuggestion {
    ///The occurrence.
    pub occurrence: SystemObjectId,
    ///The connector's reference designator.
    pub connector: Refdes,
    ///The suggestion key.
    pub key: SystemLabel,
}
///A segment node at an end.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A segment node at an end.",
///  "type": "object",
///  "required": [
///    "end",
///    "kind"
///  ],
///  "properties": {
///    "end": {
///      "description": "The end.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "end"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemEndNode {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The end.
    pub end: SystemObjectId,
}
/**A connector, or a sub-port of one, on one occurrence: the thing every
connection names.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A connector, or a sub-port of one, on one occurrence: the thing every\nconnection names.",
///  "type": "object",
///  "required": [
///    "connector",
///    "occurrence"
///  ],
///  "properties": {
///    "connector": {
///      "description": "The connector's reference designator on that board, or a body connector's `refdes`.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "occurrence": {
///      "description": "The occurrence's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "subPort": {
///      "description": "The sub-port; absent means the whole connector.",
///      "$ref": "#/$defs/SystemSubPortRef"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemEndpoint {
    ///The occurrence's id.
    pub occurrence: SystemObjectId,
    ///The connector's reference designator on that board, or a body connector's `refdes`.
    pub connector: Refdes,
    ///The sub-port; absent means the whole connector.
    #[serde(
        rename = "subPort",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub sub_port: ::std::option::Option<SystemSubPortRef>,
}
///A published system from the catalog.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A published system from the catalog.",
///  "type": "object",
///  "required": [
///    "componentId",
///    "kind",
///    "revisionId"
///  ],
///  "properties": {
///    "componentId": {
///      "description": "The catalog component id of the published system.",
///      "$ref": "#/$defs/SystemCatalogId"
///    },
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "entry"
///    },
///    "revisionId": {
///      "description": "The published revision.",
///      "$ref": "#/$defs/SystemCatalogId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemEntrySource {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The catalog component id of the published system.
    #[serde(rename = "componentId")]
    pub component_id: SystemCatalogId,
    ///The published revision.
    #[serde(rename = "revisionId")]
    pub revision_id: SystemCatalogId,
}
///A connector or sub-port that is part of the system's interface.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A connector or sub-port that is part of the system's interface.",
///  "type": "object",
///  "required": [
///    "id",
///    "name",
///    "pinNames",
///    "site"
///  ],
///  "properties": {
///    "id": {
///      "description": "The export's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "name": {
///      "description": "The name in the published interface.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "pinNames": {
///      "description": "Interface pin names; the keys are pad numbers.",
///      "$ref": "#/$defs/RecordSystemLabel"
///    },
///    "site": {
///      "description": "The connector or sub-port exported.",
///      "$ref": "#/$defs/SystemEndpoint"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemExport {
    ///The export's id.
    pub id: SystemObjectId,
    ///The name in the published interface.
    pub name: SystemLabel,
    ///The connector or sub-port exported.
    pub site: SystemEndpoint,
    ///Interface pin names; the keys are pad numbers.
    #[serde(rename = "pinNames")]
    pub pin_names: RecordSystemLabel,
}
///A board that follows a branch, advanced by `advance-occurrence`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A board that follows a branch, advanced by `advance-occurrence`.",
///  "type": "object",
///  "required": [
///    "branch",
///    "commit",
///    "kind"
///  ],
///  "properties": {
///    "branch": {
///      "description": "The branch followed.",
///      "$ref": "#/$defs/SystemBranchName"
///    },
///    "commit": {
///      "description": "The commit the occurrence is at now.",
///      "$ref": "#/$defs/GitObjectId"
///    },
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "followed"
///    },
///    "reviewedCommit": {
///      "description": "The commit whose changes the user last acknowledged; absent means never acknowledged.",
///      "$ref": "#/$defs/GitObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemFollowedTrack {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The branch followed.
    pub branch: SystemBranchName,
    ///The commit the occurrence is at now.
    pub commit: GitObjectId,
    ///The commit whose changes the user last acknowledged; absent means never acknowledged.
    #[serde(
        rename = "reviewedCommit",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub reviewed_commit: ::std::option::Option<GitObjectId>,
}
///A wire gauge in AWG as people write it: `24`, `0`, `00`, `4/0`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A wire gauge in AWG as people write it: `24`, `0`, `00`, `4/0`.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct SystemGaugeAwg(pub ::std::string::String);
impl ::std::ops::Deref for SystemGaugeAwg {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemGaugeAwg> for ::std::string::String {
    fn from(value: SystemGaugeAwg) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for SystemGaugeAwg {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for SystemGaugeAwg {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for SystemGaugeAwg {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///A harness block and everything in it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A harness block and everything in it.",
///  "type": "object",
///  "required": [
///    "branchPoints",
///    "cables",
///    "coverings",
///    "ends",
///    "id",
///    "label",
///    "links",
///    "looseEnds",
///    "markers",
///    "segments",
///    "splices",
///    "waypoints",
///    "wires"
///  ],
///  "properties": {
///    "branchPoints": {
///      "description": "Branch points, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessBranchPoint"
///      }
///    },
///    "cables": {
///      "description": "Cables, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessCable"
///      }
///    },
///    "coverings": {
///      "description": "Coverings, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessCovering"
///      }
///    },
///    "ends": {
///      "description": "Ends, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessEnd"
///      }
///    },
///    "id": {
///      "description": "The harness's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "label": {
///      "description": "The label, for example `H1`.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "links": {
///      "description": "Links, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessLink"
///      }
///    },
///    "looseEnds": {
///      "description": "Loose ends, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessLooseEnd"
///      }
///    },
///    "markers": {
///      "description": "Markers, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessMarker"
///      }
///    },
///    "segments": {
///      "description": "Segments, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessSegment"
///      }
///    },
///    "sheet": {
///      "description": "The sheet its block is drawn on; absent means the root sheet.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "splices": {
///      "description": "Splices, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessSplice"
///      }
///    },
///    "waypoints": {
///      "description": "Waypoints, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessWaypoint"
///      }
///    },
///    "wires": {
///      "description": "Wires, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessWire"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarness {
    ///The harness's id.
    pub id: SystemObjectId,
    ///The label, for example `H1`.
    pub label: SystemLabel,
    ///The sheet its block is drawn on; absent means the root sheet.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub sheet: ::std::option::Option<SystemObjectId>,
    ///Ends, sorted by `id` in code point order.
    pub ends: ::std::vec::Vec<SystemHarnessEnd>,
    ///Links, sorted by `id` in code point order.
    pub links: ::std::vec::Vec<SystemHarnessLink>,
    ///Wires, sorted by `id` in code point order.
    pub wires: ::std::vec::Vec<SystemHarnessWire>,
    ///Splices, sorted by `id` in code point order.
    pub splices: ::std::vec::Vec<SystemHarnessSplice>,
    ///Branch points, sorted by `id` in code point order.
    #[serde(rename = "branchPoints")]
    pub branch_points: ::std::vec::Vec<SystemHarnessBranchPoint>,
    ///Segments, sorted by `id` in code point order.
    pub segments: ::std::vec::Vec<SystemHarnessSegment>,
    ///Coverings, sorted by `id` in code point order.
    pub coverings: ::std::vec::Vec<SystemHarnessCovering>,
    ///Cables, sorted by `id` in code point order.
    pub cables: ::std::vec::Vec<SystemHarnessCable>,
    ///Loose ends, sorted by `id` in code point order.
    #[serde(rename = "looseEnds")]
    pub loose_ends: ::std::vec::Vec<SystemHarnessLooseEnd>,
    ///Markers, sorted by `id` in code point order.
    pub markers: ::std::vec::Vec<SystemHarnessMarker>,
    ///Waypoints, sorted by `id` in code point order.
    pub waypoints: ::std::vec::Vec<SystemHarnessWaypoint>,
}
///Where the bundle physically divides; not an electrical join.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where the bundle physically divides; not an electrical join.",
///  "type": "object",
///  "required": [
///    "id"
///  ],
///  "properties": {
///    "id": {
///      "description": "The branch point's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "position": {
///      "description": "Its pinned position; absent means derived from the topology.",
///      "$ref": "#/$defs/SystemVectorNm"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessBranchPoint {
    ///The branch point's id.
    pub id: SystemObjectId,
    ///Its pinned position; absent means derived from the topology.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub position: ::std::option::Option<SystemVectorNm>,
}
///A jacketed multi-conductor cable.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A jacketed multi-conductor cable.",
///  "type": "object",
///  "required": [
///    "conductors",
///    "id"
///  ],
///  "properties": {
///    "conductors": {
///      "description": "Conductors in the cable's own order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemCableConductor"
///      }
///    },
///    "id": {
///      "description": "The cable's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "label": {
///      "description": "The cable's label; absent means none.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "part": {
///      "description": "The catalog part; absent until chosen.",
///      "$ref": "#/$defs/SystemPartRef"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessCable {
    ///The cable's id.
    pub id: SystemObjectId,
    ///The catalog part; absent until chosen.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub part: ::std::option::Option<SystemPartRef>,
    ///The cable's label; absent means none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub label: ::std::option::Option<SystemLabel>,
    ///Conductors in the cable's own order.
    pub conductors: ::std::vec::Vec<SystemCableConductor>,
}
///A housing cavity and the board pad it lands on.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A housing cavity and the board pad it lands on.",
///  "type": "object",
///  "required": [
///    "cavity",
///    "pad"
///  ],
///  "properties": {
///    "cavity": {
///      "description": "The cavity.",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "pad": {
///      "description": "The board pad.",
///      "$ref": "#/$defs/PadNumber"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessCavityPad {
    ///The cavity.
    pub cavity: PadNumber,
    ///The board pad.
    pub pad: PadNumber,
}
///A covering on part or all of a segment.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A covering on part or all of a segment.",
///  "type": "object",
///  "required": [
///    "id",
///    "kind",
///    "segment"
///  ],
///  "properties": {
///    "endNm": {
///      "description": "Distance from the segment's `from` node where it ends; absent means at the `to` node.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "id": {
///      "description": "The covering's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "kind": {
///      "description": "What it is.",
///      "$ref": "#/$defs/SystemCoveringKind"
///    },
///    "part": {
///      "description": "The catalog part; absent until chosen.",
///      "$ref": "#/$defs/SystemPartRef"
///    },
///    "segment": {
///      "description": "The segment.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "startNm": {
///      "description": "Distance from the segment's `from` node where it starts; absent means at the node.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessCovering {
    ///The covering's id.
    pub id: SystemObjectId,
    ///The segment.
    pub segment: SystemObjectId,
    ///What it is.
    pub kind: SystemCoveringKind,
    ///The catalog part; absent until chosen.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub part: ::std::option::Option<SystemPartRef>,
    ///Distance from the segment's `from` node where it starts; absent means at the node.
    #[serde(
        rename = "startNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub start_nm: ::std::option::Option<NonNegativeNanometres>,
    ///Distance from the segment's `from` node where it ends; absent means at the `to` node.
    #[serde(
        rename = "endNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub end_nm: ::std::option::Option<NonNegativeNanometres>,
}
///A harness end: one mating site.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A harness end: one mating site.",
///  "type": "object",
///  "required": [
///    "contacts",
///    "id",
///    "pinMap"
///  ],
///  "properties": {
///    "bootLengthNm": {
///      "description": "The straight exit length; absent means the harness default.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "contacts": {
///      "description": "Contact parts; the keys are housing cavity numbers.",
///      "$ref": "#/$defs/RecordSystemPartRef"
///    },
///    "housing": {
///      "description": "The housing part; absent until chosen.",
///      "$ref": "#/$defs/SystemPartRef"
///    },
///    "id": {
///      "description": "The end's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "pinMap": {
///      "description": "Cavity-to-pad pairs where they differ; empty means cavity n is pad n. Sorted by `cavity` in natural order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarnessCavityPad"
///      }
///    },
///    "site": {
///      "description": "The connector it mates; absent on an end not attached yet.",
///      "$ref": "#/$defs/SystemSite"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessEnd {
    ///The end's id.
    pub id: SystemObjectId,
    ///The connector it mates; absent on an end not attached yet.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub site: ::std::option::Option<SystemSite>,
    ///The housing part; absent until chosen.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub housing: ::std::option::Option<SystemPartRef>,
    ///Contact parts; the keys are housing cavity numbers.
    pub contacts: RecordSystemPartRef,
    ///Cavity-to-pad pairs where they differ; empty means cavity n is pad n. Sorted by `cavity` in natural order.
    #[serde(rename = "pinMap")]
    pub pin_map: ::std::vec::Vec<SystemHarnessCavityPad>,
    ///The straight exit length; absent means the harness default.
    #[serde(
        rename = "bootLengthNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub boot_length_nm: ::std::option::Option<NonNegativeNanometres>,
}
///A schematic harness wire between two endpoints; its wiring is derived.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A schematic harness wire between two endpoints; its wiring is derived.",
///  "type": "object",
///  "required": [
///    "a",
///    "b",
///    "id",
///    "unmapped"
///  ],
///  "properties": {
///    "a": {
///      "description": "Side A; its connector is an end's site in this harness.",
///      "$ref": "#/$defs/SystemEndpoint"
///    },
///    "b": {
///      "description": "Side B; its connector is an end's site in this harness.",
///      "$ref": "#/$defs/SystemEndpoint"
///    },
///    "id": {
///      "description": "The link's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "unmapped": {
///      "description": "Pads on side A cleared from the default wiring, sorted in natural order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/PadNumber"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessLink {
    ///The link's id.
    pub id: SystemObjectId,
    ///Side A; its connector is an end's site in this harness.
    pub a: SystemEndpoint,
    ///Side B; its connector is an end's site in this harness.
    pub b: SystemEndpoint,
    ///Pads on side A cleared from the default wiring, sorted in natural order.
    pub unmapped: ::std::vec::Vec<PadNumber>,
}
///A harness end left open.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A harness end left open.",
///  "type": "object",
///  "required": [
///    "id",
///    "kind"
///  ],
///  "properties": {
///    "id": {
///      "description": "The loose end's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "kind": {
///      "description": "What it is for.",
///      "$ref": "#/$defs/SystemLooseEndKind"
///    },
///    "label": {
///      "description": "Its label; absent means none.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "lengthNm": {
///      "description": "The pigtail length; absent means unknown.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessLooseEnd {
    ///The loose end's id.
    pub id: SystemObjectId,
    ///What it is for.
    pub kind: SystemLooseEndKind,
    ///The pigtail length; absent means unknown.
    #[serde(
        rename = "lengthNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub length_nm: ::std::option::Option<NonNegativeNanometres>,
    ///Its label; absent means none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub label: ::std::option::Option<SystemLabel>,
}
///A label or marker along a wire.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A label or marker along a wire.",
///  "type": "object",
///  "required": [
///    "id",
///    "kind",
///    "text",
///    "wire"
///  ],
///  "properties": {
///    "atNm": {
///      "description": "Distance from the wire's `from` terminal; absent means the default position.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "id": {
///      "description": "The marker's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "kind": {
///      "description": "What it is.",
///      "$ref": "#/$defs/SystemMarkerKind"
///    },
///    "text": {
///      "description": "The printed text.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "wire": {
///      "description": "The wire.",
///      "$ref": "#/$defs/SystemObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessMarker {
    ///The marker's id.
    pub id: SystemObjectId,
    ///The wire.
    pub wire: SystemObjectId,
    ///What it is.
    pub kind: SystemMarkerKind,
    ///The printed text.
    pub text: SystemLabel,
    ///Distance from the wire's `from` terminal; absent means the default position.
    #[serde(
        rename = "atNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub at_nm: ::std::option::Option<NonNegativeNanometres>,
}
///One end of a harness segment.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One end of a harness segment.",
///  "oneOf": [
///    {
///      "description": "An end.",
///      "$ref": "#/$defs/SystemEndNode"
///    },
///    {
///      "description": "A branch point.",
///      "$ref": "#/$defs/SystemBranchPointNode"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum SystemHarnessNode {
    EndNode(SystemEndNode),
    BranchPointNode(SystemBranchPointNode),
}
impl ::std::convert::From<SystemEndNode> for SystemHarnessNode {
    fn from(value: SystemEndNode) -> Self {
        Self::EndNode(value)
    }
}
impl ::std::convert::From<SystemBranchPointNode> for SystemHarnessNode {
    fn from(value: SystemBranchPointNode) -> Self {
        Self::BranchPointNode(value)
    }
}
///A physical segment of the bundle between two nodes.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A physical segment of the bundle between two nodes.",
///  "type": "object",
///  "required": [
///    "from",
///    "id",
///    "to"
///  ],
///  "properties": {
///    "from": {
///      "description": "One node.",
///      "$ref": "#/$defs/SystemHarnessNode"
///    },
///    "id": {
///      "description": "The segment's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "to": {
///      "description": "The other node.",
///      "$ref": "#/$defs/SystemHarnessNode"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessSegment {
    ///The segment's id.
    pub id: SystemObjectId,
    ///One node.
    pub from: SystemHarnessNode,
    ///The other node.
    pub to: SystemHarnessNode,
}
///A splice joining several wires.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A splice joining several wires.",
///  "type": "object",
///  "required": [
///    "confirmed",
///    "id",
///    "method"
///  ],
///  "properties": {
///    "confirmed": {
///      "description": "Whether the user confirmed a proposed splice.",
///      "type": "boolean"
///    },
///    "id": {
///      "description": "The splice's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "method": {
///      "description": "How it is made.",
///      "$ref": "#/$defs/SystemSpliceMethod"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessSplice {
    ///The splice's id.
    pub id: SystemObjectId,
    ///How it is made.
    pub method: SystemSpliceMethod,
    ///Whether the user confirmed a proposed splice.
    pub confirmed: bool,
}
///A waypoint the user pinned on a segment.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A waypoint the user pinned on a segment.",
///  "type": "object",
///  "required": [
///    "id",
///    "order",
///    "position",
///    "segment"
///  ],
///  "properties": {
///    "id": {
///      "description": "The waypoint's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "order": {
///      "description": "Its place along the segment, from the `from` node: lower comes first.",
///      "type": "integer",
///      "maximum": 2147483647.0,
///      "minimum": 0.0
///    },
///    "position": {
///      "description": "Its position in system space.",
///      "$ref": "#/$defs/SystemVectorNm"
///    },
///    "segment": {
///      "description": "The segment.",
///      "$ref": "#/$defs/SystemObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessWaypoint {
    ///The waypoint's id.
    pub id: SystemObjectId,
    ///The segment.
    pub segment: SystemObjectId,
    ///Its position in system space.
    pub position: SystemVectorNm,
    ///Its place along the segment, from the `from` node: lower comes first.
    pub order: i64,
}
///An explicit wire.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "An explicit wire.",
///  "type": "object",
///  "required": [
///    "from",
///    "id",
///    "route",
///    "to"
///  ],
///  "properties": {
///    "colour": {
///      "description": "The insulation colour; absent means unknown.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "from": {
///      "description": "One terminal.",
///      "$ref": "#/$defs/SystemWireTerminal"
///    },
///    "gaugeAwg": {
///      "description": "The gauge; absent means unknown.",
///      "$ref": "#/$defs/SystemGaugeAwg"
///    },
///    "id": {
///      "description": "The wire's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "label": {
///      "description": "The wire's label; absent means none.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "lengthNm": {
///      "description": "The cut length; absent means derived from the route.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "link": {
///      "description": "The link whose default wire for this pin it replaces; absent for a free-standing wire.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "route": {
///      "description": "Segment ids from `from` to `to`, in route order; empty means derived.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemObjectId"
///      }
///    },
///    "to": {
///      "description": "The other terminal.",
///      "$ref": "#/$defs/SystemWireTerminal"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemHarnessWire {
    ///The wire's id.
    pub id: SystemObjectId,
    ///One terminal.
    pub from: SystemWireTerminal,
    ///The other terminal.
    pub to: SystemWireTerminal,
    ///The link whose default wire for this pin it replaces; absent for a free-standing wire.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub link: ::std::option::Option<SystemObjectId>,
    ///The gauge; absent means unknown.
    #[serde(
        rename = "gaugeAwg",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub gauge_awg: ::std::option::Option<SystemGaugeAwg>,
    ///The insulation colour; absent means unknown.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub colour: ::std::option::Option<SystemLabel>,
    ///The cut length; absent means derived from the route.
    #[serde(
        rename = "lengthNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub length_nm: ::std::option::Option<NonNegativeNanometres>,
    ///The wire's label; absent means none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub label: ::std::option::Option<SystemLabel>,
    ///Segment ids from `from` to `to`, in route order; empty means derived.
    pub route: ::std::vec::Vec<SystemObjectId>,
}
///The layout inside a board or body sheet.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The layout inside a board or body sheet.",
///  "type": "object",
///  "properties": {
///    "labels": {
///      "description": "Each connector's hierarchical label by reference; a missing key means the default.",
///      "$ref": "#/$defs/RecordSystemInteriorLabel"
///    },
///    "pins": {
///      "description": "The board symbol's pins by connector reference; a missing key means the default.",
///      "$ref": "#/$defs/RecordSystemPortPlacement"
///    },
///    "symbol": {
///      "description": "The board symbol; absent means the default.",
///      "$ref": "#/$defs/SystemInteriorSymbol"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInterior {
    ///The board symbol; absent means the default.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub symbol: ::std::option::Option<SystemInteriorSymbol>,
    ///The board symbol's pins by connector reference; a missing key means the default.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub pins: ::std::option::Option<RecordSystemPortPlacement>,
    ///Each connector's hierarchical label by reference; a missing key means the default.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub labels: ::std::option::Option<RecordSystemInteriorLabel>,
}
impl ::std::default::Default for SystemInterior {
    fn default() -> Self {
        Self {
            labels: Default::default(),
            pins: Default::default(),
            symbol: Default::default(),
        }
    }
}
///Where a hierarchical label sits inside a board's sheet.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where a hierarchical label sits inside a board's sheet.",
///  "type": "object",
///  "required": [
///    "rotationDeg",
///    "xNm",
///    "yNm"
///  ],
///  "properties": {
///    "rotationDeg": {
///      "description": "Rotation in degrees, counter-clockwise.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "xNm": {
///      "description": "X in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "yNm": {
///      "description": "Y in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInteriorLabel {
    ///X in nanometres.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///Y in nanometres.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
    ///Rotation in degrees, counter-clockwise.
    #[serde(rename = "rotationDeg")]
    pub rotation_deg: Degrees,
}
///The board symbol inside a board's sheet.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The board symbol inside a board's sheet.",
///  "type": "object",
///  "required": [
///    "heightNm",
///    "widthNm",
///    "xNm",
///    "yNm"
///  ],
///  "properties": {
///    "heightNm": {
///      "description": "Height in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "widthNm": {
///      "description": "Width in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "xNm": {
///      "description": "X of its top-left corner in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "yNm": {
///      "description": "Y of its top-left corner in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemInteriorSymbol {
    ///X of its top-left corner in nanometres.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///Y of its top-left corner in nanometres.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
    ///Width in nanometres.
    #[serde(rename = "widthNm")]
    pub width_nm: NonNegativeNanometres,
    ///Height in nanometres.
    #[serde(rename = "heightNm")]
    pub height_nm: NonNegativeNanometres,
}
///A human-readable name or label: 1 to 200 characters.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A human-readable name or label: 1 to 200 characters.",
///  "type": "string",
///  "maxLength": 200,
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemLabel(::std::string::String);
impl ::std::ops::Deref for SystemLabel {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemLabel> for ::std::string::String {
    fn from(value: SystemLabel) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemLabel {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() > 200usize {
            return Err("longer than 200 characters".into());
        }
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemLabel {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemLabel {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemLabel {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemLabel {
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
///What an open harness end is for.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What an open harness end is for.",
///  "type": "string",
///  "enum": [
///    "pigtail",
///    "test-point",
///    "open"
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
pub enum SystemLooseEndKind {
    #[serde(rename = "pigtail")]
    Pigtail,
    #[serde(rename = "test-point")]
    TestPoint,
    #[serde(rename = "open")]
    Open,
}
impl ::std::fmt::Display for SystemLooseEndKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Pigtail => f.write_str("pigtail"),
            Self::TestPoint => f.write_str("test-point"),
            Self::Open => f.write_str("open"),
        }
    }
}
impl ::std::str::FromStr for SystemLooseEndKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "pigtail" => Ok(Self::Pigtail),
            "test-point" => Ok(Self::TestPoint),
            "open" => Ok(Self::Open),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemLooseEndKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemLooseEndKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemLooseEndKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A wire terminating on a loose end.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A wire terminating on a loose end.",
///  "type": "object",
///  "required": [
///    "kind",
///    "looseEnd"
///  ],
///  "properties": {
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "loose"
///    },
///    "looseEnd": {
///      "description": "The loose end.",
///      "$ref": "#/$defs/SystemObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemLooseTerminal {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The loose end.
    #[serde(rename = "looseEnd")]
    pub loose_end: SystemObjectId,
}
///What a marker on a wire is.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What a marker on a wire is.",
///  "type": "string",
///  "enum": [
///    "label",
///    "heat-shrink-marker"
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
pub enum SystemMarkerKind {
    #[serde(rename = "label")]
    Label,
    #[serde(rename = "heat-shrink-marker")]
    HeatShrinkMarker,
}
impl ::std::fmt::Display for SystemMarkerKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Label => f.write_str("label"),
            Self::HeatShrinkMarker => f.write_str("heat-shrink-marker"),
        }
    }
}
impl ::std::str::FromStr for SystemMarkerKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "label" => Ok(Self::Label),
            "heat-shrink-marker" => Ok(Self::HeatShrinkMarker),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemMarkerKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemMarkerKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemMarkerKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A board-to-board mate between two connectors.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A board-to-board mate between two connectors.",
///  "type": "object",
///  "required": [
///    "a",
///    "b",
///    "id",
///    "orientation",
///    "rows"
///  ],
///  "properties": {
///    "a": {
///      "description": "Side A.",
///      "$ref": "#/$defs/SystemSite"
///    },
///    "b": {
///      "description": "Side B.",
///      "$ref": "#/$defs/SystemSite"
///    },
///    "id": {
///      "description": "The mate's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "manualMap": {
///      "description": "A manual mapping that replaces the derived one, always flagged; absent means derived. Sorted by `a` in natural order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemMatePair"
///      }
///    },
///    "offset": {
///      "description": "A pose applied after the mate transform (spacers, a tilted fit); absent means none.",
///      "$ref": "#/$defs/SystemPose"
///    },
///    "orientation": {
///      "description": "The orientation; changing it re-derives the mapping.",
///      "$ref": "#/$defs/SystemMateOrientation"
///    },
///    "rows": {
///      "description": "Row labels; the keys are pad numbers on side A.",
///      "$ref": "#/$defs/RecordSystemMateRow"
///    },
///    "stackHeightNm": {
///      "description": "The stack height; absent means the mate maths' clearance fallback.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemMate {
    ///The mate's id.
    pub id: SystemObjectId,
    ///Side A.
    pub a: SystemSite,
    ///Side B.
    pub b: SystemSite,
    ///The orientation; changing it re-derives the mapping.
    pub orientation: SystemMateOrientation,
    ///The stack height; absent means the mate maths' clearance fallback.
    #[serde(
        rename = "stackHeightNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub stack_height_nm: ::std::option::Option<NonNegativeNanometres>,
    ///A pose applied after the mate transform (spacers, a tilted fit); absent means none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub offset: ::std::option::Option<SystemPose>,
    ///A manual mapping that replaces the derived one, always flagged; absent means derived. Sorted by `a` in natural order.
    #[serde(
        rename = "manualMap",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub manual_map: ::std::option::Option<::std::vec::Vec<SystemMatePair>>,
    ///Row labels; the keys are pad numbers on side A.
    pub rows: RecordSystemMateRow,
}
///How the two connectors of a B2B mate face each other.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How the two connectors of a B2B mate face each other.",
///  "type": "object",
///  "required": [
///    "flip",
///    "quarterTurns"
///  ],
///  "properties": {
///    "flip": {
///      "description": "Whether B mates on its frame flipped over its x axis, for a connector reached through the board.",
///      "type": "boolean"
///    },
///    "quarterTurns": {
///      "description": "Quarter turns of B about the mating axis: `k` of the mate transform.",
///      "type": "integer",
///      "maximum": 3.0,
///      "minimum": 0.0
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemMateOrientation {
    ///Quarter turns of B about the mating axis: `k` of the mate transform.
    #[serde(rename = "quarterTurns")]
    pub quarter_turns: i64,
    ///Whether B mates on its frame flipped over its x axis, for a connector reached through the board.
    pub flip: bool,
}
///One pin pair of a manual mate mapping.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One pin pair of a manual mate mapping.",
///  "type": "object",
///  "required": [
///    "a",
///    "b"
///  ],
///  "properties": {
///    "a": {
///      "description": "The pad on side A.",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "b": {
///      "description": "The pad on side B.",
///      "$ref": "#/$defs/PadNumber"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemMatePair {
    ///The pad on side A.
    pub a: PadNumber,
    ///The pad on side B.
    pub b: PadNumber,
}
///The user's labels on one row of a mate's mapping.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The user's labels on one row of a mate's mapping.",
///  "type": "object",
///  "properties": {
///    "netLabel": {
///      "description": "A net name shown for the row; absent means none.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "signal": {
///      "description": "A signal label; absent means none.",
///      "$ref": "#/$defs/SystemLabel"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemMateRow {
    ///A net name shown for the row; absent means none.
    #[serde(
        rename = "netLabel",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub net_label: ::std::option::Option<SystemLabel>,
    ///A signal label; absent means none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub signal: ::std::option::Option<SystemLabel>,
}
impl ::std::default::Default for SystemMateRow {
    fn default() -> Self {
        Self {
            net_label: Default::default(),
            signal: Default::default(),
        }
    }
}
/**Id of an object in a system document: unique across the whole document and
never reused, even after the object is removed. Chosen by the caller or
assigned by the server as `<prefix>_<10 base32>`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Id of an object in a system document: unique across the whole document and\nnever reused, even after the object is removed. Chosen by the caller or\nassigned by the server as `<prefix>_<10 base32>`.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct SystemObjectId(pub ::std::string::String);
impl ::std::ops::Deref for SystemObjectId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemObjectId> for ::std::string::String {
    fn from(value: SystemObjectId) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for SystemObjectId {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for SystemObjectId {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for SystemObjectId {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///One placed board, published entry or body.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One placed board, published entry or body.",
///  "type": "object",
///  "required": [
///    "id",
///    "label",
///    "source"
///  ],
///  "properties": {
///    "id": {
///      "description": "The occurrence's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "label": {
///      "description": "The label shown on its symbol and in 3D.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "pose": {
///      "description": "The stored pose of a free occurrence; absent for a mated one, whose pose is derived.",
///      "$ref": "#/$defs/SystemPose"
///    },
///    "positioningMate": {
///      "description": "The mate that positions it, overriding the automatic choice; absent means automatic.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "sheet": {
///      "description": "The sheet it is drawn on; absent means the root sheet.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "source": {
///      "description": "What it places.",
///      "$ref": "#/$defs/SystemOccurrenceSource"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemOccurrence {
    ///The occurrence's id.
    pub id: SystemObjectId,
    ///The label shown on its symbol and in 3D.
    pub label: SystemLabel,
    ///The sheet it is drawn on; absent means the root sheet.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub sheet: ::std::option::Option<SystemObjectId>,
    ///What it places.
    pub source: SystemOccurrenceSource,
    ///The stored pose of a free occurrence; absent for a mated one, whose pose is derived.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub pose: ::std::option::Option<SystemPose>,
    ///The mate that positions it, overriding the automatic choice; absent means automatic.
    #[serde(
        rename = "positioningMate",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub positioning_mate: ::std::option::Option<SystemObjectId>,
}
///What an occurrence places.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What an occurrence places.",
///  "oneOf": [
///    {
///      "description": "A board.",
///      "$ref": "#/$defs/SystemBoardSource"
///    },
///    {
///      "description": "A published entry.",
///      "$ref": "#/$defs/SystemEntrySource"
///    },
///    {
///      "description": "A body.",
///      "$ref": "#/$defs/SystemBodySource"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum SystemOccurrenceSource {
    BoardSource(SystemBoardSource),
    EntrySource(SystemEntrySource),
    BodySource(SystemBodySource),
}
impl ::std::convert::From<SystemBoardSource> for SystemOccurrenceSource {
    fn from(value: SystemBoardSource) -> Self {
        Self::BoardSource(value)
    }
}
impl ::std::convert::From<SystemEntrySource> for SystemOccurrenceSource {
    fn from(value: SystemEntrySource) -> Self {
        Self::EntrySource(value)
    }
}
impl ::std::convert::From<SystemBodySource> for SystemOccurrenceSource {
    fn from(value: SystemBodySource) -> Self {
        Self::BodySource(value)
    }
}
///A sub-port stored in this document.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A sub-port stored in this document.",
///  "type": "object",
///  "required": [
///    "id",
///    "kind"
///  ],
///  "properties": {
///    "id": {
///      "description": "The sub-port's id in `subPorts`.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "occurrence"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemOccurrenceSubPortRef {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The sub-port's id in `subPorts`.
    pub id: SystemObjectId,
}
///A catalog part, by component and optionally revision.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A catalog part, by component and optionally revision.",
///  "type": "object",
///  "required": [
///    "componentId"
///  ],
///  "properties": {
///    "componentId": {
///      "description": "The catalog component id.",
///      "$ref": "#/$defs/SystemCatalogId"
///    },
///    "revisionId": {
///      "description": "The revision; absent means the latest released revision.",
///      "$ref": "#/$defs/SystemCatalogId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemPartRef {
    ///The catalog component id.
    #[serde(rename = "componentId")]
    pub component_id: SystemCatalogId,
    ///The revision; absent means the latest released revision.
    #[serde(
        rename = "revisionId",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub revision_id: ::std::option::Option<SystemCatalogId>,
}
///A board at a pinned commit, which never changes on its own.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A board at a pinned commit, which never changes on its own.",
///  "type": "object",
///  "required": [
///    "commit",
///    "kind"
///  ],
///  "properties": {
///    "commit": {
///      "description": "The commit.",
///      "$ref": "#/$defs/GitObjectId"
///    },
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "pinned"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemPinnedTrack {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The commit.
    pub commit: GitObjectId,
}
///Where a sheet pin sits: an edge, and the distance along it from its top or left end.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where a sheet pin sits: an edge, and the distance along it from its top or left end.",
///  "type": "object",
///  "required": [
///    "edge",
///    "offsetNm"
///  ],
///  "properties": {
///    "edge": {
///      "description": "The edge.",
///      "$ref": "#/$defs/SystemSheetEdge"
///    },
///    "offsetNm": {
///      "description": "Nanometres along the edge from its top or left end.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemPortPlacement {
    ///The edge.
    pub edge: SystemSheetEdge,
    ///Nanometres along the edge from its top or left end.
    #[serde(rename = "offsetNm")]
    pub offset_nm: NonNegativeNanometres,
}
///A rigid transform: rotation, then translation.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A rigid transform: rotation, then translation.",
///  "type": "object",
///  "required": [
///    "rotation",
///    "translation"
///  ],
///  "properties": {
///    "rotation": {
///      "description": "The rotation.",
///      "$ref": "#/$defs/SystemQuaternion"
///    },
///    "translation": {
///      "description": "The translation in nanometres.",
///      "$ref": "#/$defs/SystemVectorNm"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemPose {
    ///The translation in nanometres.
    pub translation: SystemVectorNm,
    ///The rotation.
    pub rotation: SystemQuaternion,
}
///Prism project id: `prj_` and 12 lowercase hexadecimal digits.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Prism project id: `prj_` and 12 lowercase hexadecimal digits.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct SystemProjectId(pub ::std::string::String);
impl ::std::ops::Deref for SystemProjectId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemProjectId> for ::std::string::String {
    fn from(value: SystemProjectId) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for SystemProjectId {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for SystemProjectId {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for SystemProjectId {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///A unit quaternion; normalized when written.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A unit quaternion; normalized when written.",
///  "type": "object",
///  "required": [
///    "w",
///    "x",
///    "y",
///    "z"
///  ],
///  "properties": {
///    "w": {
///      "description": "The scalar component.",
///      "type": "number"
///    },
///    "x": {
///      "description": "The x component.",
///      "type": "number"
///    },
///    "y": {
///      "description": "The y component.",
///      "type": "number"
///    },
///    "z": {
///      "description": "The z component.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemQuaternion {
    ///The x component.
    pub x: f64,
    ///The y component.
    pub y: f64,
    ///The z component.
    pub z: f64,
    ///The scalar component.
    pub w: f64,
}
///Where an object's symbol sits in the schematic; presentation only.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where an object's symbol sits in the schematic; presentation only.",
///  "type": "object",
///  "required": [
///    "mirror",
///    "rotationDeg",
///    "xNm",
///    "yNm"
///  ],
///  "properties": {
///    "canvas": {
///      "description": "Where a harness object sits on its harness tab (CONTRACTS.md §16.5): an end card's top-left, a splice's, loose end's or branch point's centre; absent means the auto-layout.",
///      "$ref": "#/$defs/SystemSchematicPoint"
///    },
///    "interior": {
///      "description": "Inside a board or body sheet; absent means the defaults.",
///      "$ref": "#/$defs/SystemInterior"
///    },
///    "mirror": {
///      "description": "Whether the symbol is mirrored.",
///      "type": "boolean"
///    },
///    "ports": {
///      "description": "A sheet symbol's pins: by connector reference (occurrence) or end id (harness block); a missing key means the default.",
///      "$ref": "#/$defs/RecordSystemPortPlacement"
///    },
///    "rotationDeg": {
///      "description": "Rotation in degrees, counter-clockwise.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "route": {
///      "description": "A connection's drawn path: a mate's, its points in order from side a to side b, or a harness end's, from its site's pin to the block; absent means auto-routed.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemSchematicPoint"
///      },
///      "minItems": 2
///    },
///    "sheet": {
///      "description": "The sheet; absent means the root sheet.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "size": {
///      "description": "A sheet symbol's size; absent means the default.",
///      "$ref": "#/$defs/SystemSchematicSize"
///    },
///    "xNm": {
///      "description": "X in nanometres on the sheet, +x right; a sheet symbol's or harness block's top-left corner.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "yNm": {
///      "description": "Y in nanometres on the sheet, +y down.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemSchematicPlacement {
    ///The sheet; absent means the root sheet.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub sheet: ::std::option::Option<SystemObjectId>,
    ///X in nanometres on the sheet, +x right; a sheet symbol's or harness block's top-left corner.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///Y in nanometres on the sheet, +y down.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
    ///Rotation in degrees, counter-clockwise.
    #[serde(rename = "rotationDeg")]
    pub rotation_deg: Degrees,
    ///Whether the symbol is mirrored.
    pub mirror: bool,
    ///A sheet symbol's size; absent means the default.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub size: ::std::option::Option<SystemSchematicSize>,
    ///A sheet symbol's pins: by connector reference (occurrence) or end id (harness block); a missing key means the default.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub ports: ::std::option::Option<RecordSystemPortPlacement>,
    ///A connection's drawn path: a mate's, its points in order from side a to side b, or a harness end's, from its site's pin to the block; absent means auto-routed.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub route: ::std::option::Option<::std::vec::Vec<SystemSchematicPoint>>,
    ///Inside a board or body sheet; absent means the defaults.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub interior: ::std::option::Option<SystemInterior>,
    ///Where a harness object sits on its harness tab (CONTRACTS.md §16.5): an end card's top-left, a splice's, loose end's or branch point's centre; absent means the auto-layout.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub canvas: ::std::option::Option<SystemSchematicPoint>,
}
///A point on a sheet.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A point on a sheet.",
///  "type": "object",
///  "required": [
///    "xNm",
///    "yNm"
///  ],
///  "properties": {
///    "xNm": {
///      "description": "X in nanometres, +x right.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "yNm": {
///      "description": "Y in nanometres, +y down.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemSchematicPoint {
    ///X in nanometres, +x right.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///Y in nanometres, +y down.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
}
///A sheet symbol's size.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A sheet symbol's size.",
///  "type": "object",
///  "required": [
///    "heightNm",
///    "widthNm"
///  ],
///  "properties": {
///    "heightNm": {
///      "description": "Height in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "widthNm": {
///      "description": "Width in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemSchematicSize {
    ///Width in nanometres.
    #[serde(rename = "widthNm")]
    pub width_nm: NonNegativeNanometres,
    ///Height in nanometres.
    #[serde(rename = "heightNm")]
    pub height_nm: NonNegativeNanometres,
}
///A hierarchical sheet of the system schematic.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A hierarchical sheet of the system schematic.",
///  "type": "object",
///  "required": [
///    "id",
///    "name"
///  ],
///  "properties": {
///    "id": {
///      "description": "The sheet's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "name": {
///      "description": "The sheet's name, shown in the breadcrumb.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "parent": {
///      "description": "The parent sheet's id; absent means the root sheet.",
///      "$ref": "#/$defs/SystemObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemSheet {
    ///The sheet's id.
    pub id: SystemObjectId,
    ///The sheet's name, shown in the breadcrumb.
    pub name: SystemLabel,
    ///The parent sheet's id; absent means the root sheet.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub parent: ::std::option::Option<SystemObjectId>,
}
///An edge of a sheet symbol.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "An edge of a sheet symbol.",
///  "type": "string",
///  "enum": [
///    "left",
///    "right",
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
pub enum SystemSheetEdge {
    #[serde(rename = "left")]
    Left,
    #[serde(rename = "right")]
    Right,
    #[serde(rename = "top")]
    Top,
    #[serde(rename = "bottom")]
    Bottom,
}
impl ::std::fmt::Display for SystemSheetEdge {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Left => f.write_str("left"),
            Self::Right => f.write_str("right"),
            Self::Top => f.write_str("top"),
            Self::Bottom => f.write_str("bottom"),
        }
    }
}
impl ::std::str::FromStr for SystemSheetEdge {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "left" => Ok(Self::Left),
            "right" => Ok(Self::Right),
            "top" => Ok(Self::Top),
            "bottom" => Ok(Self::Bottom),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemSheetEdge {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemSheetEdge {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemSheetEdge {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A connector on one occurrence, never a sub-port: a mating site.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A connector on one occurrence, never a sub-port: a mating site.",
///  "type": "object",
///  "required": [
///    "connector",
///    "occurrence"
///  ],
///  "properties": {
///    "connector": {
///      "description": "The connector's reference designator, or a body connector's `refdes`.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "occurrence": {
///      "description": "The occurrence's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemSite {
    ///The occurrence's id.
    pub occurrence: SystemObjectId,
    ///The connector's reference designator, or a body connector's `refdes`.
    pub connector: Refdes,
}
///How a splice joins its wires.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How a splice joins its wires.",
///  "type": "string",
///  "enum": [
///    "crimp",
///    "solder"
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
pub enum SystemSpliceMethod {
    #[serde(rename = "crimp")]
    Crimp,
    #[serde(rename = "solder")]
    Solder,
}
impl ::std::fmt::Display for SystemSpliceMethod {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Crimp => f.write_str("crimp"),
            Self::Solder => f.write_str("solder"),
        }
    }
}
impl ::std::str::FromStr for SystemSpliceMethod {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "crimp" => Ok(Self::Crimp),
            "solder" => Ok(Self::Solder),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemSpliceMethod {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemSpliceMethod {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemSpliceMethod {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A wire terminating on a splice.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A wire terminating on a splice.",
///  "type": "object",
///  "required": [
///    "kind",
///    "splice"
///  ],
///  "properties": {
///    "kind": {
///      "description": "Discriminator.",
///      "type": "string",
///      "const": "splice"
///    },
///    "splice": {
///      "description": "The splice.",
///      "$ref": "#/$defs/SystemObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemSpliceTerminal {
    ///Discriminator.
    pub kind: ::std::string::String,
    ///The splice.
    pub splice: SystemObjectId,
}
///An occurrence-level sub-port: a named, ordered set of a connector's pins.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "An occurrence-level sub-port: a named, ordered set of a connector's pins.",
///  "type": "object",
///  "required": [
///    "connector",
///    "id",
///    "name",
///    "occurrence",
///    "pins"
///  ],
///  "properties": {
///    "connector": {
///      "description": "The connector's reference designator.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "id": {
///      "description": "The sub-port's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "name": {
///      "description": "The sub-port's name.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "occurrence": {
///      "description": "The occurrence.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "pins": {
///      "description": "Pad numbers in the user's order: as selected, or as the suggestion listed them.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/PadNumber"
///      },
///      "minItems": 1
///    },
///    "promotedTo": {
///      "description": "The board-level sub-port it was promoted to; absent when not promoted.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "suggestion": {
///      "description": "The bundle suggestion key it was accepted from; absent when made by hand.",
///      "$ref": "#/$defs/SystemLabel"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemSubPort {
    ///The sub-port's id.
    pub id: SystemObjectId,
    ///The occurrence.
    pub occurrence: SystemObjectId,
    ///The connector's reference designator.
    pub connector: Refdes,
    ///The sub-port's name.
    pub name: SystemLabel,
    ///Pad numbers in the user's order: as selected, or as the suggestion listed them.
    pub pins: ::std::vec::Vec<PadNumber>,
    ///The bundle suggestion key it was accepted from; absent when made by hand.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub suggestion: ::std::option::Option<SystemLabel>,
    ///The board-level sub-port it was promoted to; absent when not promoted.
    #[serde(
        rename = "promotedTo",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub promoted_to: ::std::option::Option<SystemObjectId>,
}
///Which sub-port of a connector an endpoint names.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Which sub-port of a connector an endpoint names.",
///  "oneOf": [
///    {
///      "description": "One of this document's sub-ports.",
///      "$ref": "#/$defs/SystemOccurrenceSubPortRef"
///    },
///    {
///      "description": "A board-level sub-port.",
///      "$ref": "#/$defs/SystemBoardSubPortRef"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum SystemSubPortRef {
    OccurrenceSubPortRef(SystemOccurrenceSubPortRef),
    BoardSubPortRef(SystemBoardSubPortRef),
}
impl ::std::convert::From<SystemOccurrenceSubPortRef> for SystemSubPortRef {
    fn from(value: SystemOccurrenceSubPortRef) -> Self {
        Self::OccurrenceSubPortRef(value)
    }
}
impl ::std::convert::From<SystemBoardSubPortRef> for SystemSubPortRef {
    fn from(value: SystemBoardSubPortRef) -> Self {
        Self::BoardSubPortRef(value)
    }
}
///How a board occurrence tracks its project's revisions.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How a board occurrence tracks its project's revisions.",
///  "oneOf": [
///    {
///      "description": "Pinned at a commit.",
///      "$ref": "#/$defs/SystemPinnedTrack"
///    },
///    {
///      "description": "Following a branch.",
///      "$ref": "#/$defs/SystemFollowedTrack"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum SystemTrack {
    PinnedTrack(SystemPinnedTrack),
    FollowedTrack(SystemFollowedTrack),
}
impl ::std::convert::From<SystemPinnedTrack> for SystemTrack {
    fn from(value: SystemPinnedTrack) -> Self {
        Self::PinnedTrack(value)
    }
}
impl ::std::convert::From<SystemFollowedTrack> for SystemTrack {
    fn from(value: SystemFollowedTrack) -> Self {
        Self::FollowedTrack(value)
    }
}
///A System Builder v2 system.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.system:v2",
///  "title": "SystemV2",
///  "description": "A System Builder v2 system.",
///  "type": "object",
///  "required": [
///    "bodyConnectors",
///    "dismissedSuggestions",
///    "exports",
///    "harnesses",
///    "layout",
///    "mates",
///    "name",
///    "occurrences",
///    "schema",
///    "sheets",
///    "subPorts",
///    "waivers"
///  ],
///  "properties": {
///    "bodyConnectors": {
///      "description": "Body connectors, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBodyConnector"
///      }
///    },
///    "description": {
///      "description": "A description; absent means none.",
///      "$ref": "#/$defs/SystemDescription"
///    },
///    "dismissedSuggestions": {
///      "description": "Dismissed suggestions, sorted by `occurrence`, then `connector`, then `key`, each in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemDismissedSuggestion"
///      }
///    },
///    "exports": {
///      "description": "Exports, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemExport"
///      }
///    },
///    "harnesses": {
///      "description": "Harness blocks, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemHarness"
///      }
///    },
///    "layout": {
///      "description": "Schematic placements; the keys are object ids.",
///      "$ref": "#/$defs/RecordSystemSchematicPlacement"
///    },
///    "mates": {
///      "description": "B2B mates, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemMate"
///      }
///    },
///    "name": {
///      "description": "The system's name.",
///      "$ref": "#/$defs/SystemLabel"
///    },
///    "occurrences": {
///      "description": "Occurrences, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemOccurrence"
///      }
///    },
///    "schema": {
///      "description": "Schema id.",
///      "type": "string",
///      "const": "prism.system.v2"
///    },
///    "sheets": {
///      "description": "Sheets, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemSheet"
///      }
///    },
///    "subPorts": {
///      "description": "Occurrence-level sub-ports, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemSubPort"
///      }
///    },
///    "waivers": {
///      "description": "Waivers, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemWaiver"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemV2 {
    ///Schema id.
    pub schema: ::std::string::String,
    ///The system's name.
    pub name: SystemLabel,
    ///A description; absent means none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub description: ::std::option::Option<SystemDescription>,
    ///Sheets, sorted by `id` in code point order.
    pub sheets: ::std::vec::Vec<SystemSheet>,
    ///Occurrences, sorted by `id` in code point order.
    pub occurrences: ::std::vec::Vec<SystemOccurrence>,
    ///Occurrence-level sub-ports, sorted by `id` in code point order.
    #[serde(rename = "subPorts")]
    pub sub_ports: ::std::vec::Vec<SystemSubPort>,
    ///Dismissed suggestions, sorted by `occurrence`, then `connector`, then `key`, each in code point order.
    #[serde(rename = "dismissedSuggestions")]
    pub dismissed_suggestions: ::std::vec::Vec<SystemDismissedSuggestion>,
    ///Body connectors, sorted by `id` in code point order.
    #[serde(rename = "bodyConnectors")]
    pub body_connectors: ::std::vec::Vec<SystemBodyConnector>,
    ///B2B mates, sorted by `id` in code point order.
    pub mates: ::std::vec::Vec<SystemMate>,
    ///Harness blocks, sorted by `id` in code point order.
    pub harnesses: ::std::vec::Vec<SystemHarness>,
    ///Exports, sorted by `id` in code point order.
    pub exports: ::std::vec::Vec<SystemExport>,
    ///Waivers, sorted by `id` in code point order.
    pub waivers: ::std::vec::Vec<SystemWaiver>,
    ///Schematic placements; the keys are object ids.
    pub layout: RecordSystemSchematicPlacement,
}
///A point or translation in system space, in nanometres; +z up, right-handed.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A point or translation in system space, in nanometres; +z up, right-handed.",
///  "type": "object",
///  "required": [
///    "xNm",
///    "yNm",
///    "zNm"
///  ],
///  "properties": {
///    "xNm": {
///      "description": "X in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "yNm": {
///      "description": "Y in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "zNm": {
///      "description": "Z in nanometres, +z up.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemVectorNm {
    ///X in nanometres.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///Y in nanometres.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
    ///Z in nanometres, +z up.
    #[serde(rename = "zNm")]
    pub z_nm: Nanometres,
}
///A waived finding.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A waived finding.",
///  "type": "object",
///  "required": [
///    "code",
///    "id",
///    "reason",
///    "subject"
///  ],
///  "properties": {
///    "code": {
///      "description": "The finding code.",
///      "$ref": "#/$defs/DiagnosticCode"
///    },
///    "id": {
///      "description": "The waiver's id.",
///      "$ref": "#/$defs/SystemObjectId"
///    },
///    "reason": {
///      "description": "Why it is waived.",
///      "type": "string",
///      "minLength": 1
///    },
///    "subject": {
///      "description": "The finding's subject key.",
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
pub struct SystemWaiver {
    ///The waiver's id.
    pub id: SystemObjectId,
    ///The finding code.
    pub code: DiagnosticCode,
    ///The finding's subject key.
    pub subject: SystemWaiverSubject,
    ///Why it is waived.
    pub reason: SystemWaiverReason,
}
///Why it is waived.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Why it is waived.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemWaiverReason(::std::string::String);
impl ::std::ops::Deref for SystemWaiverReason {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemWaiverReason> for ::std::string::String {
    fn from(value: SystemWaiverReason) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemWaiverReason {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemWaiverReason {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemWaiverReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemWaiverReason {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemWaiverReason {
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
///The finding's subject key.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The finding's subject key.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemWaiverSubject(::std::string::String);
impl ::std::ops::Deref for SystemWaiverSubject {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemWaiverSubject> for ::std::string::String {
    fn from(value: SystemWaiverSubject) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemWaiverSubject {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemWaiverSubject {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemWaiverSubject {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemWaiverSubject {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemWaiverSubject {
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
///Where one end of a wire terminates.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where one end of a wire terminates.",
///  "oneOf": [
///    {
///      "description": "An end's cavity.",
///      "$ref": "#/$defs/SystemContactTerminal"
///    },
///    {
///      "description": "A splice.",
///      "$ref": "#/$defs/SystemSpliceTerminal"
///    },
///    {
///      "description": "A loose end.",
///      "$ref": "#/$defs/SystemLooseTerminal"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum SystemWireTerminal {
    ContactTerminal(SystemContactTerminal),
    SpliceTerminal(SystemSpliceTerminal),
    LooseTerminal(SystemLooseTerminal),
}
impl ::std::convert::From<SystemContactTerminal> for SystemWireTerminal {
    fn from(value: SystemContactTerminal) -> Self {
        Self::ContactTerminal(value)
    }
}
impl ::std::convert::From<SystemSpliceTerminal> for SystemWireTerminal {
    fn from(value: SystemSpliceTerminal) -> Self {
        Self::SpliceTerminal(value)
    }
}
impl ::std::convert::From<SystemLooseTerminal> for SystemWireTerminal {
    fn from(value: SystemLooseTerminal) -> Self {
        Self::LooseTerminal(value)
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemHarnessNode {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("end") {
            return ::serde_json::from_value::<SystemEndNode>(value)
                .map(Self::EndNode)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("branch-point") {
            return ::serde_json::from_value::<SystemBranchPointNode>(value)
                .map(Self::BranchPointNode)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum SystemHarnessNode",
        ))
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemOccurrenceSource {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("board") {
            return ::serde_json::from_value::<SystemBoardSource>(value)
                .map(Self::BoardSource)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("entry") {
            return ::serde_json::from_value::<SystemEntrySource>(value)
                .map(Self::EntrySource)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("body") {
            return ::serde_json::from_value::<SystemBodySource>(value)
                .map(Self::BodySource)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum SystemOccurrenceSource",
        ))
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemSubPortRef {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("occurrence") {
            return ::serde_json::from_value::<SystemOccurrenceSubPortRef>(value)
                .map(Self::OccurrenceSubPortRef)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("board") {
            return ::serde_json::from_value::<SystemBoardSubPortRef>(value)
                .map(Self::BoardSubPortRef)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum SystemSubPortRef",
        ))
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemTrack {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("pinned") {
            return ::serde_json::from_value::<SystemPinnedTrack>(value)
                .map(Self::PinnedTrack)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("followed") {
            return ::serde_json::from_value::<SystemFollowedTrack>(value)
                .map(Self::FollowedTrack)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum SystemTrack",
        ))
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemWireTerminal {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("contact") {
            return ::serde_json::from_value::<SystemContactTerminal>(value)
                .map(Self::ContactTerminal)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("splice") {
            return ::serde_json::from_value::<SystemSpliceTerminal>(value)
                .map(Self::SpliceTerminal)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("loose") {
            return ::serde_json::from_value::<SystemLooseTerminal>(value)
                .map(Self::LooseTerminal)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum SystemWireTerminal",
        ))
    }
}
