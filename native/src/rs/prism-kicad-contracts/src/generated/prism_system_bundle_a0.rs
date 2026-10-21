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
///A system bundle.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.system_bundle:a0",
///  "title": "SystemBundleA0",
///  "description": "A system bundle.",
///  "type": "object",
///  "required": [
///    "documentSha256",
///    "findings",
///    "links",
///    "mates",
///    "nets",
///    "occurrences",
///    "placement",
///    "schema",
///    "splices",
///    "suggestions"
///  ],
///  "properties": {
///    "documentSha256": {
///      "description": "SHA-256 of the document's canonical JSON.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "findings": {
///      "description": "Findings, sorted by `code` then `subject`, in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleFinding"
///      }
///    },
///    "harnesses": {
///      "description": "Harness blocks with their resolved wire lists, in document order (§16.3).\nAbsent from a bundle built before format 5, such as an entry published\nearlier; every build writes it.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleHarness"
///      }
///    },
///    "links": {
///      "description": "Harness link wirings, sorted by `harness` then `link`, in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleLink"
///      }
///    },
///    "mates": {
///      "description": "B2B mappings, sorted by `mate` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleMate"
///      }
///    },
///    "nets": {
///      "description": "System nets, sorted by `id` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleNet"
///      }
///    },
///    "occurrences": {
///      "description": "Occurrences, sorted by `occurrence` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleOccurrence"
///      }
///    },
///    "placement": {
///      "description": "Where each occurrence sits, and what each mate means for that (stage 3a).",
///      "$ref": "#/$defs/SystemBundlePlacement"
///    },
///    "schema": {
///      "description": "Schema id.",
///      "type": "string",
///      "const": "prism.system_bundle.a0"
///    },
///    "splices": {
///      "description": "Proposed splices, sorted by `harness`, `end` then `pad` (natural order).",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleSplice"
///      }
///    },
///    "suggestions": {
///      "description": "Sub-port suggestions, sorted by `occurrence`, `connector` then `key`, in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleSuggestion"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleA0 {
    ///Schema id.
    pub schema: ::std::string::String,
    ///SHA-256 of the document's canonical JSON.
    #[serde(rename = "documentSha256")]
    pub document_sha256: Sha256Hex,
    ///Occurrences, sorted by `occurrence` in code point order.
    pub occurrences: ::std::vec::Vec<SystemBundleOccurrence>,
    ///System nets, sorted by `id` in code point order.
    pub nets: ::std::vec::Vec<SystemBundleNet>,
    ///B2B mappings, sorted by `mate` in code point order.
    pub mates: ::std::vec::Vec<SystemBundleMate>,
    ///Harness link wirings, sorted by `harness` then `link`, in code point order.
    pub links: ::std::vec::Vec<SystemBundleLink>,
    ///Proposed splices, sorted by `harness`, `end` then `pad` (natural order).
    pub splices: ::std::vec::Vec<SystemBundleSplice>,
    /**Harness blocks with their resolved wire lists, in document order (§16.3).
    Absent from a bundle built before format 5, such as an entry published
    earlier; every build writes it.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub harnesses: ::std::option::Option<::std::vec::Vec<SystemBundleHarness>>,
    ///Sub-port suggestions, sorted by `occurrence`, `connector` then `key`, in code point order.
    pub suggestions: ::std::vec::Vec<SystemBundleSuggestion>,
    ///Findings, sorted by `code` then `subject`, in code point order.
    pub findings: ::std::vec::Vec<SystemBundleFinding>,
    ///Where each occurrence sits, and what each mate means for that (stage 3a).
    pub placement: SystemBundlePlacement,
}
///A board net that is part of a system net.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A board net that is part of a system net.",
///  "type": "object",
///  "required": [
///    "net",
///    "occurrence"
///  ],
///  "properties": {
///    "net": {
///      "description": "The board's net name.",
///      "$ref": "#/$defs/NetName"
///    },
///    "occurrence": {
///      "description": "The occurrence.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleBoardNet {
    ///The occurrence.
    pub occurrence: SystemBundleObjectId,
    ///The board's net name.
    pub net: NetName,
}
///The side of the board a component sits on.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The side of the board a component sits on.",
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
pub enum SystemBundleBoardSide {
    #[serde(rename = "top")]
    Top,
    #[serde(rename = "bottom")]
    Bottom,
}
impl ::std::fmt::Display for SystemBundleBoardSide {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Top => f.write_str("top"),
            Self::Bottom => f.write_str("bottom"),
        }
    }
}
impl ::std::str::FromStr for SystemBundleBoardSide {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "top" => Ok(Self::Top),
            "bottom" => Ok(Self::Bottom),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleBoardSide {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleBoardSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleBoardSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///An axis-aligned box in an occurrence's own frame.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "An axis-aligned box in an occurrence's own frame.",
///  "type": "object",
///  "required": [
///    "max",
///    "min"
///  ],
///  "properties": {
///    "max": {
///      "description": "The maximum corner.",
///      "$ref": "#/$defs/SystemBundleVectorNm"
///    },
///    "min": {
///      "description": "The minimum corner.",
///      "$ref": "#/$defs/SystemBundleVectorNm"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleBounds {
    ///The minimum corner.
    pub min: SystemBundleVectorNm,
    ///The maximum corner.
    pub max: SystemBundleVectorNm,
}
///Where a segment comes closer to a board or body than its radius and the margin.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where a segment comes closer to a board or body than its radius and the margin.",
///  "type": "object",
///  "required": [
///    "at",
///    "distanceNm",
///    "neededNm",
///    "occurrence"
///  ],
///  "properties": {
///    "at": {
///      "description": "The closest point on the segment.",
///      "$ref": "#/$defs/SystemBundleVectorNm"
///    },
///    "distanceNm": {
///      "description": "The distance from the curve to the occurrence's box.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "neededNm": {
///      "description": "The distance needed: the bundle's radius plus the margin.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "occurrence": {
///      "description": "The board or body occurrence.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleClearance {
    ///The board or body occurrence.
    pub occurrence: SystemBundleObjectId,
    ///The closest point on the segment.
    pub at: SystemBundleVectorNm,
    ///The distance from the curve to the occurrence's box.
    #[serde(rename = "distanceNm")]
    pub distance_nm: Nanometres,
    ///The distance needed: the bundle's radius plus the margin.
    #[serde(rename = "neededNm")]
    pub needed_nm: Nanometres,
}
///One connector of a board occurrence.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One connector of a board occurrence.",
///  "type": "object",
///  "required": [
///    "candidate",
///    "pins",
///    "refdes",
///    "value"
///  ],
///  "properties": {
///    "candidate": {
///      "description": "Whether connector detection marks it a connector.",
///      "type": "boolean"
///    },
///    "mpn": {
///      "description": "The manufacturer part number; absent when unknown.",
///      "type": "string"
///    },
///    "pins": {
///      "description": "Pins in natural order of their pad.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundlePin"
///      }
///    },
///    "placement": {
///      "description": "Where it sits on the board; absent when the board has no outline.",
///      "$ref": "#/$defs/SystemBundleConnectorPlacement"
///    },
///    "refdes": {
///      "description": "The reference designator.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "value": {
///      "description": "The component's value.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleConnector {
    ///The reference designator.
    pub refdes: Refdes,
    ///The component's value.
    pub value: ::std::string::String,
    ///The manufacturer part number; absent when unknown.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub mpn: ::std::option::Option<::std::string::String>,
    ///Whether connector detection marks it a connector.
    pub candidate: bool,
    ///Where it sits on the board; absent when the board has no outline.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub placement: ::std::option::Option<SystemBundleConnectorPlacement>,
    ///Pins in natural order of their pad.
    pub pins: ::std::vec::Vec<SystemBundlePin>,
}
///Where a connector sits on its board, for the schematic's default pin placement.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where a connector sits on its board, for the schematic's default pin placement.",
///  "type": "object",
///  "required": [
///    "angleDeg",
///    "side"
///  ],
///  "properties": {
///    "angleDeg": {
///      "description": "Angle from the outline's centre to the component, counter-clockwise from +x with +y up, in [0, 360).",
///      "$ref": "#/$defs/Degrees"
///    },
///    "side": {
///      "description": "The side it is mounted on.",
///      "$ref": "#/$defs/SystemBundleBoardSide"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleConnectorPlacement {
    ///Angle from the outline's centre to the component, counter-clockwise from +x with +y up, in [0, 360).
    #[serde(rename = "angleDeg")]
    pub angle_deg: Degrees,
    ///The side it is mounted on.
    pub side: SystemBundleBoardSide,
}
///A footprint's courtyard box in its own frame (+y up), in millimetres.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A footprint's courtyard box in its own frame (+y up), in millimetres.",
///  "type": "object",
///  "required": [
///    "maxMm",
///    "minMm"
///  ],
///  "properties": {
///    "maxMm": {
///      "description": "The maximum corner `[x, y]`, in that order.",
///      "type": "array",
///      "items": {
///        "type": "number"
///      }
///    },
///    "minMm": {
///      "description": "The minimum corner `[x, y]`, in that order.",
///      "type": "array",
///      "items": {
///        "type": "number"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleExportCourtyard {
    ///The minimum corner `[x, y]`, in that order.
    #[serde(rename = "minMm")]
    pub min_mm: ::std::vec::Vec<f64>,
    ///The maximum corner `[x, y]`, in that order.
    #[serde(rename = "maxMm")]
    pub max_mm: ::std::vec::Vec<f64>,
}
/**An export's connector footprint, as the board interface's extractor v6
geometry gives it (millimetres, +y up), without its 3D model.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "An export's connector footprint, as the board interface's extractor v6\ngeometry gives it (millimetres, +y up), without its 3D model.",
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
///      "description": "The footprint's courtyard. Null when the footprint has no courtyard graphic.",
///      "oneOf": [
///        {
///          "$ref": "#/$defs/SystemBundleExportCourtyard"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "footprintName": {
///      "description": "The footprint name, which the mating-axis inference reads. Null when unknown.",
///      "oneOf": [
///        {
///          "type": "string"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "model": {
///      "description": "Always null: an export's geometry carries no 3D model.",
///      "type": "null"
///    },
///    "pads": {
///      "description": "The pads, in the extractor's order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleExportPad"
///      }
///    },
///    "positionMm": {
///      "description": "The footprint anchor `[x, y]`, in that order, in the mount's frame.",
///      "type": "array",
///      "items": {
///        "type": "number"
///      },
///      "maxItems": 2,
///      "minItems": 2
///    },
///    "rotationDeg": {
///      "description": "The footprint rotation in degrees.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "side": {
///      "description": "The side of its board the footprint is on.",
///      "$ref": "#/$defs/SystemBundleFootprintSide"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleExportGeometry {
    ///The side of its board the footprint is on.
    pub side: SystemBundleFootprintSide,
    ///The footprint anchor `[x, y]`, in that order, in the mount's frame.
    #[serde(rename = "positionMm")]
    pub position_mm: [f64; 2usize],
    ///The footprint rotation in degrees.
    #[serde(rename = "rotationDeg")]
    pub rotation_deg: Degrees,
    ///The footprint name, which the mating-axis inference reads. Null when unknown.
    #[serde(rename = "footprintName")]
    pub footprint_name: ::std::option::Option<::std::string::String>,
    ///The pads, in the extractor's order.
    pub pads: ::std::vec::Vec<SystemBundleExportPad>,
    ///The footprint's courtyard. Null when the footprint has no courtyard graphic.
    pub courtyard: ::std::option::Option<SystemBundleExportCourtyard>,
    ///Always null: an export's geometry carries no 3D model.
    pub model: (),
}
///One pad of an export's footprint geometry, in millimetres in its frame (+y up).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One pad of an export's footprint geometry, in millimetres in its frame (+y up).",
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
///      "description": "The pad number; empty for a mounting or alignment hole.",
///      "type": "string"
///    },
///    "positionMm": {
///      "description": "The pad centre `[x, y]`, in that order.",
///      "type": "array",
///      "items": {
///        "type": "number"
///      },
///      "maxItems": 2,
///      "minItems": 2
///    },
///    "shape": {
///      "description": "The pad shape (`circle`, `rect`, …). Null when the footprint gives none.",
///      "oneOf": [
///        {
///          "type": "string"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "sizeMm": {
///      "description": "The pad size `[x, y]`, in that order. Null when the footprint gives none.",
///      "oneOf": [
///        {
///          "type": "array",
///          "items": {
///            "type": "number"
///          }
///        },
///        {
///          "type": "null"
///        }
///      ]
///    },
///    "tht": {
///      "description": "Whether the pad is through-hole. Null when the footprint does not say.",
///      "oneOf": [
///        {
///          "type": "boolean"
///        },
///        {
///          "type": "null"
///        }
///      ]
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleExportPad {
    ///The pad number; empty for a mounting or alignment hole.
    pub pad: ::std::string::String,
    ///The pad centre `[x, y]`, in that order.
    #[serde(rename = "positionMm")]
    pub position_mm: [f64; 2usize],
    ///The pad size `[x, y]`, in that order. Null when the footprint gives none.
    #[serde(rename = "sizeMm")]
    pub size_mm: ::std::option::Option<::std::vec::Vec<f64>>,
    ///The pad shape (`circle`, `rect`, …). Null when the footprint gives none.
    pub shape: ::std::option::Option<::std::string::String>,
    ///Whether the pad is through-hole. Null when the footprint does not say.
    pub tht: ::std::option::Option<bool>,
}
///One finding (`docs/system-builder/CONTRACTS.md` §9).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One finding (`docs/system-builder/CONTRACTS.md` §9).",
///  "type": "object",
///  "required": [
///    "code",
///    "message",
///    "objects",
///    "severity",
///    "subject",
///    "waived"
///  ],
///  "properties": {
///    "code": {
///      "description": "The finding's code.",
///      "$ref": "#/$defs/DiagnosticCode"
///    },
///    "message": {
///      "description": "One sentence for people.",
///      "type": "string",
///      "minLength": 1
///    },
///    "objects": {
///      "description": "Document object ids involved, in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleObjectId"
///      }
///    },
///    "severity": {
///      "description": "Its fixed severity.",
///      "$ref": "#/$defs/SystemBundleSeverity"
///    },
///    "subject": {
///      "description": "The stable subject key a waiver names, for example `mate:mate_x`.",
///      "type": "string",
///      "minLength": 1
///    },
///    "waived": {
///      "description": "Whether a waiver of the document covers it.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleFinding {
    ///The finding's code.
    pub code: DiagnosticCode,
    ///Its fixed severity.
    pub severity: SystemBundleSeverity,
    ///The stable subject key a waiver names, for example `mate:mate_x`.
    pub subject: SystemBundleFindingSubject,
    ///One sentence for people.
    pub message: SystemBundleFindingMessage,
    ///Document object ids involved, in code point order.
    pub objects: ::std::vec::Vec<SystemBundleObjectId>,
    ///Whether a waiver of the document covers it.
    pub waived: bool,
}
///One sentence for people.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One sentence for people.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemBundleFindingMessage(::std::string::String);
impl ::std::ops::Deref for SystemBundleFindingMessage {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemBundleFindingMessage> for ::std::string::String {
    fn from(value: SystemBundleFindingMessage) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemBundleFindingMessage {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleFindingMessage {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleFindingMessage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleFindingMessage {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemBundleFindingMessage {
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
///The stable subject key a waiver names, for example `mate:mate_x`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The stable subject key a waiver names, for example `mate:mate_x`.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemBundleFindingSubject(::std::string::String);
impl ::std::ops::Deref for SystemBundleFindingSubject {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemBundleFindingSubject> for ::std::string::String {
    fn from(value: SystemBundleFindingSubject) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemBundleFindingSubject {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleFindingSubject {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleFindingSubject {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleFindingSubject {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemBundleFindingSubject {
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
///The side of its board a footprint is on.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The side of its board a footprint is on.",
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
pub enum SystemBundleFootprintSide {
    #[serde(rename = "top")]
    Top,
    #[serde(rename = "bottom")]
    Bottom,
}
impl ::std::fmt::Display for SystemBundleFootprintSide {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Top => f.write_str("top"),
            Self::Bottom => f.write_str("bottom"),
        }
    }
}
impl ::std::str::FromStr for SystemBundleFootprintSide {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "top" => Ok(Self::Top),
            "bottom" => Ok(Self::Bottom),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleFootprintSide {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleFootprintSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleFootprintSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A harness block's ends and resolved wire list (§16.3).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A harness block's ends and resolved wire list (§16.3).",
///  "type": "object",
///  "required": [
///    "ends",
///    "harness",
///    "wires"
///  ],
///  "properties": {
///    "ends": {
///      "description": "Its ends, in document order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleHarnessEnd"
///      }
///    },
///    "harness": {
///      "description": "The harness block.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "route": {
///      "description": "The route in 3D (stage 4c, §16.6). Absent in bundles built before\nformat 6, and when fewer than two ends are posed.",
///      "$ref": "#/$defs/SystemBundleHarnessRoute"
///    },
///    "wires": {
///      "description": "Explicit wires in document order, then each link's default wires.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleHarnessWire"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleHarness {
    ///The harness block.
    pub harness: SystemBundleObjectId,
    ///Its ends, in document order.
    pub ends: ::std::vec::Vec<SystemBundleHarnessEnd>,
    ///Explicit wires in document order, then each link's default wires.
    pub wires: ::std::vec::Vec<SystemBundleHarnessWire>,
    /**The route in 3D (stage 4c, §16.6). Absent in bundles built before
    format 6, and when fewer than two ends are posed.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub route: ::std::option::Option<SystemBundleHarnessRoute>,
}
///A cavity of an end in use (§16.3).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A cavity of an end in use (§16.3).",
///  "type": "object",
///  "required": [
///    "cavity",
///    "pad"
///  ],
///  "properties": {
///    "cavity": {
///      "description": "The cavity, as the end's `pinMap` names it.",
///      "type": "string",
///      "minLength": 1
///    },
///    "contact": {
///      "description": "The resolved contact part (`componentId@revisionId`), when one is chosen.",
///      "type": "string"
///    },
///    "net": {
///      "description": "The system net of that pad, when it has one.",
///      "$ref": "#/$defs/SystemBundleNetId"
///    },
///    "pad": {
///      "description": "The site's pad in it.",
///      "$ref": "#/$defs/PadNumber"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleHarnessCavity {
    ///The cavity, as the end's `pinMap` names it.
    pub cavity: SystemBundleHarnessCavityCavity,
    ///The site's pad in it.
    pub pad: PadNumber,
    ///The system net of that pad, when it has one.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<SystemBundleNetId>,
    ///The resolved contact part (`componentId@revisionId`), when one is chosen.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub contact: ::std::option::Option<::std::string::String>,
}
///The cavity, as the end's `pinMap` names it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The cavity, as the end's `pinMap` names it.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemBundleHarnessCavityCavity(::std::string::String);
impl ::std::ops::Deref for SystemBundleHarnessCavityCavity {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemBundleHarnessCavityCavity> for ::std::string::String {
    fn from(value: SystemBundleHarnessCavityCavity) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemBundleHarnessCavityCavity {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleHarnessCavityCavity {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleHarnessCavityCavity {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleHarnessCavityCavity {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemBundleHarnessCavityCavity {
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
///An end of a harness block and the cavities in use (§16.3).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "An end of a harness block and the cavities in use (§16.3).",
///  "type": "object",
///  "required": [
///    "cavities",
///    "end"
///  ],
///  "properties": {
///    "cavities": {
///      "description": "Cavities in use, in natural order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleHarnessCavity"
///      }
///    },
///    "connector": {
///      "description": "Its site's connector, when it has a site.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "end": {
///      "description": "The end.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "housing": {
///      "description": "The resolved housing part (`componentId@revisionId`), when one is chosen.",
///      "type": "string"
///    },
///    "occurrence": {
///      "description": "Its site's occurrence, when it has a site.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleHarnessEnd {
    ///The end.
    pub end: SystemBundleObjectId,
    ///Its site's occurrence, when it has a site.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub occurrence: ::std::option::Option<SystemBundleObjectId>,
    ///Its site's connector, when it has a site.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub connector: ::std::option::Option<Refdes>,
    ///The resolved housing part (`componentId@revisionId`), when one is chosen.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub housing: ::std::option::Option<::std::string::String>,
    ///Cavities in use, in natural order.
    pub cavities: ::std::vec::Vec<SystemBundleHarnessCavity>,
}
///A harness route (stage 4c, §16.6).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A harness route (stage 4c, §16.6).",
///  "type": "object",
///  "required": [
///    "derived",
///    "ends",
///    "segments",
///    "wires"
///  ],
///  "properties": {
///    "derived": {
///      "description": "The tree was derived (no stored segments, or stored ones that are not a tree).",
///      "type": "boolean"
///    },
///    "ends": {
///      "description": "The posed ends, in document order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleRouteEnd"
///      }
///    },
///    "segments": {
///      "description": "The segments in tree order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleRouteSegment"
///      }
///    },
///    "wires": {
///      "description": "Every wire of the wire list, in its order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleRouteWire"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleHarnessRoute {
    ///The tree was derived (no stored segments, or stored ones that are not a tree).
    pub derived: bool,
    ///The posed ends, in document order.
    pub ends: ::std::vec::Vec<SystemBundleRouteEnd>,
    ///The segments in tree order.
    pub segments: ::std::vec::Vec<SystemBundleRouteSegment>,
    ///Every wire of the wire list, in its order.
    pub wires: ::std::vec::Vec<SystemBundleRouteWire>,
}
///One conductor of a harness (§16.3).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One conductor of a harness (§16.3).",
///  "type": "object",
///  "required": [
///    "from",
///    "id",
///    "origin",
///    "suggested",
///    "to"
///  ],
///  "properties": {
///    "cable": {
///      "description": "The cable that carries it.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "colour": {
///      "description": "Colour.",
///      "type": "string"
///    },
///    "conductor": {
///      "description": "The cable conductor's name.",
///      "type": "string"
///    },
///    "from": {
///      "description": "One end.",
///      "$ref": "#/$defs/SystemBundleTerminal"
///    },
///    "gaugeAwg": {
///      "description": "AWG as written (`\"24\"`, `\"0\"`).",
///      "type": "string"
///    },
///    "id": {
///      "description": "The document wire's id, or `<link>:<pad A>` for a default wire.",
///      "type": "string",
///      "minLength": 1
///    },
///    "label": {
///      "description": "Printed label.",
///      "type": "string"
///    },
///    "link": {
///      "description": "The link it belongs to.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "net": {
///      "description": "The system net it is on.",
///      "$ref": "#/$defs/SystemBundleNetId"
///    },
///    "origin": {
///      "description": "Where it comes from.",
///      "$ref": "#/$defs/SystemBundleWireOrigin"
///    },
///    "routeLengthNm": {
///      "description": "Its route length (stage 4c, §16.6): segments' arc length, both housings' depths and the allowance.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "suggested": {
///      "description": "Joins power or ground pins (§8.5).",
///      "type": "boolean"
///    },
///    "to": {
///      "description": "The other end.",
///      "$ref": "#/$defs/SystemBundleTerminal"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleHarnessWire {
    ///The document wire's id, or `<link>:<pad A>` for a default wire.
    pub id: SystemBundleHarnessWireId,
    ///Where it comes from.
    pub origin: SystemBundleWireOrigin,
    ///The link it belongs to.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub link: ::std::option::Option<SystemBundleObjectId>,
    ///One end.
    pub from: SystemBundleTerminal,
    ///The other end.
    pub to: SystemBundleTerminal,
    ///AWG as written (`"24"`, `"0"`).
    #[serde(
        rename = "gaugeAwg",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub gauge_awg: ::std::option::Option<::std::string::String>,
    ///Colour.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub colour: ::std::option::Option<::std::string::String>,
    ///Printed label.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub label: ::std::option::Option<::std::string::String>,
    ///The cable that carries it.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub cable: ::std::option::Option<SystemBundleObjectId>,
    ///The cable conductor's name.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub conductor: ::std::option::Option<::std::string::String>,
    ///The system net it is on.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<SystemBundleNetId>,
    ///Joins power or ground pins (§8.5).
    pub suggested: bool,
    ///Its route length (stage 4c, §16.6): segments' arc length, both housings' depths and the allowance.
    #[serde(
        rename = "routeLengthNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub route_length_nm: ::std::option::Option<Nanometres>,
}
///The document wire's id, or `<link>:<pad A>` for a default wire.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The document wire's id, or `<link>:<pad A>` for a default wire.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemBundleHarnessWireId(::std::string::String);
impl ::std::ops::Deref for SystemBundleHarnessWireId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemBundleHarnessWireId> for ::std::string::String {
    fn from(value: SystemBundleHarnessWireId) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemBundleHarnessWireId {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleHarnessWireId {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleHarnessWireId {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleHarnessWireId {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemBundleHarnessWireId {
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
///Which stack height a mate used.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Which stack height a mate used.",
///  "type": "string",
///  "enum": [
///    "stack-height",
///    "clearance"
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
pub enum SystemBundleHeightSource {
    #[serde(rename = "stack-height")]
    StackHeight,
    #[serde(rename = "clearance")]
    Clearance,
}
impl ::std::fmt::Display for SystemBundleHeightSource {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::StackHeight => f.write_str("stack-height"),
            Self::Clearance => f.write_str("clearance"),
        }
    }
}
impl ::std::str::FromStr for SystemBundleHeightSource {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "stack-height" => Ok(Self::StackHeight),
            "clearance" => Ok(Self::Clearance),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleHeightSource {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleHeightSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleHeightSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One harness link's wiring.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One harness link's wiring.",
///  "type": "object",
///  "required": [
///    "harness",
///    "link",
///    "unmappedA",
///    "unmappedB",
///    "wires"
///  ],
///  "properties": {
///    "harness": {
///      "description": "The harness block.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "link": {
///      "description": "The document link's id.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "unmappedA": {
///      "description": "Side A pins left unmapped, in natural order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/PadNumber"
///      }
///    },
///    "unmappedB": {
///      "description": "Side B pins left unmapped, in natural order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/PadNumber"
///      }
///    },
///    "wires": {
///      "description": "Wires, sorted by `a` in natural order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleWire"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleLink {
    ///The harness block.
    pub harness: SystemBundleObjectId,
    ///The document link's id.
    pub link: SystemBundleObjectId,
    ///Wires, sorted by `a` in natural order.
    pub wires: ::std::vec::Vec<SystemBundleWire>,
    ///Side A pins left unmapped, in natural order.
    #[serde(rename = "unmappedA")]
    pub unmapped_a: ::std::vec::Vec<PadNumber>,
    ///Side B pins left unmapped, in natural order.
    #[serde(rename = "unmappedB")]
    pub unmapped_b: ::std::vec::Vec<PadNumber>,
}
///One B2B mate's mapping.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One B2B mate's mapping.",
///  "type": "object",
///  "required": [
///    "mate",
///    "pairs",
///    "source",
///    "unmappedA",
///    "unmappedB"
///  ],
///  "properties": {
///    "mate": {
///      "description": "The document mate's id.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "pads": {
///      "description": "Both connectors' pads in the mated pose; absent when the geometry cannot decide it (stage 3c).",
///      "$ref": "#/$defs/SystemBundleMatePads"
///    },
///    "pairs": {
///      "description": "Pin pairs, sorted by `a` in natural order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundlePadPair"
///      }
///    },
///    "source": {
///      "description": "Where the mapping came from.",
///      "$ref": "#/$defs/SystemBundleMateSource"
///    },
///    "unmappedA": {
///      "description": "Side A pads without a partner, in natural order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/PadNumber"
///      }
///    },
///    "unmappedB": {
///      "description": "Side B pads without a partner, in natural order.",
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
pub struct SystemBundleMate {
    ///The document mate's id.
    pub mate: SystemBundleObjectId,
    ///Where the mapping came from.
    pub source: SystemBundleMateSource,
    ///Pin pairs, sorted by `a` in natural order.
    pub pairs: ::std::vec::Vec<SystemBundlePadPair>,
    ///Side A pads without a partner, in natural order.
    #[serde(rename = "unmappedA")]
    pub unmapped_a: ::std::vec::Vec<PadNumber>,
    ///Side B pads without a partner, in natural order.
    #[serde(rename = "unmappedB")]
    pub unmapped_b: ::std::vec::Vec<PadNumber>,
    ///Both connectors' pads in the mated pose; absent when the geometry cannot decide it (stage 3c).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub pads: ::std::option::Option<SystemBundleMatePads>,
}
///One pad of a mate drawn in side A's connector frame (stage 3c).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One pad of a mate drawn in side A's connector frame (stage 3c).",
///  "type": "object",
///  "required": [
///    "angleDeg",
///    "longNm",
///    "pad",
///    "shortNm",
///    "xNm",
///    "yNm"
///  ],
///  "properties": {
///    "angleDeg": {
///      "description": "The pad's long axis, degrees counter-clockwise from A's +x, in [0, 180).",
///      "$ref": "#/$defs/Degrees"
///    },
///    "longNm": {
///      "description": "The pad's long side.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "pad": {
///      "description": "The pad number.",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "shortNm": {
///      "description": "The pad's short side.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "xNm": {
///      "description": "The centre's x in A's connector frame.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "yNm": {
///      "description": "The centre's y in A's connector frame.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleMatePad {
    ///The pad number.
    pub pad: PadNumber,
    ///The centre's x in A's connector frame.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///The centre's y in A's connector frame.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
    ///The pad's long axis, degrees counter-clockwise from A's +x, in [0, 180).
    #[serde(rename = "angleDeg")]
    pub angle_deg: Degrees,
    ///The pad's long side.
    #[serde(rename = "longNm")]
    pub long_nm: NonNegativeNanometres,
    ///The pad's short side.
    #[serde(rename = "shortNm")]
    pub short_nm: NonNegativeNanometres,
}
///Both connectors' pads in the mated pose, seen in side A's connector frame (x, y on the mating face, looking down its mating axis).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Both connectors' pads in the mated pose, seen in side A's connector frame (x, y on the mating face, looking down its mating axis).",
///  "type": "object",
///  "required": [
///    "a",
///    "b"
///  ],
///  "properties": {
///    "a": {
///      "description": "Side A's named pads, in natural order of their pad; pads sharing a number each appear.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleMatePad"
///      }
///    },
///    "b": {
///      "description": "Side B's named pads, carried into A's frame by the mate transform, in natural order of their pad.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleMatePad"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleMatePads {
    ///Side A's named pads, in natural order of their pad; pads sharing a number each appear.
    pub a: ::std::vec::Vec<SystemBundleMatePad>,
    ///Side B's named pads, carried into A's frame by the mate transform, in natural order of their pad.
    pub b: ::std::vec::Vec<SystemBundleMatePad>,
}
///Where a B2B mapping came from.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where a B2B mapping came from.",
///  "type": "string",
///  "enum": [
///    "geometry",
///    "manual",
///    "unresolved"
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
pub enum SystemBundleMateSource {
    #[serde(rename = "geometry")]
    Geometry,
    #[serde(rename = "manual")]
    Manual,
    #[serde(rename = "unresolved")]
    Unresolved,
}
impl ::std::fmt::Display for SystemBundleMateSource {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Geometry => f.write_str("geometry"),
            Self::Manual => f.write_str("manual"),
            Self::Unresolved => f.write_str("unresolved"),
        }
    }
}
impl ::std::str::FromStr for SystemBundleMateSource {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "geometry" => Ok(Self::Geometry),
            "manual" => Ok(Self::Manual),
            "unresolved" => Ok(Self::Unresolved),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleMateSource {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleMateSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleMateSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One system net: board nets joined through the system's connections.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One system net: board nets joined through the system's connections.",
///  "type": "object",
///  "required": [
///    "boardNets",
///    "id",
///    "name",
///    "names",
///    "pins"
///  ],
///  "properties": {
///    "boardNets": {
///      "description": "Board nets, sorted by `occurrence` then `net`, in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleBoardNet"
///      }
///    },
///    "id": {
///      "description": "The net's id: stable while its pins are.",
///      "$ref": "#/$defs/SystemBundleNetId"
///    },
///    "name": {
///      "description": "The display name: the most common non-automatic board net name.",
///      "$ref": "#/$defs/NetName"
///    },
///    "names": {
///      "description": "Every distinct board net name, in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/NetName"
///      }
///    },
///    "pins": {
///      "description": "Pins, sorted by `occurrence` and `connector` in code point order, then `pad` in natural order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundlePinRef"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleNet {
    ///The net's id: stable while its pins are.
    pub id: SystemBundleNetId,
    ///The display name: the most common non-automatic board net name.
    pub name: NetName,
    ///Every distinct board net name, in code point order.
    pub names: ::std::vec::Vec<NetName>,
    ///Board nets, sorted by `occurrence` then `net`, in code point order.
    #[serde(rename = "boardNets")]
    pub board_nets: ::std::vec::Vec<SystemBundleBoardNet>,
    ///Pins, sorted by `occurrence` and `connector` in code point order, then `pad` in natural order.
    pub pins: ::std::vec::Vec<SystemBundlePinRef>,
}
///A system net's id: `net-` and 16 lowercase hexadecimal digits.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A system net's id: `net-` and 16 lowercase hexadecimal digits.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct SystemBundleNetId(pub ::std::string::String);
impl ::std::ops::Deref for SystemBundleNetId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemBundleNetId> for ::std::string::String {
    fn from(value: SystemBundleNetId) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for SystemBundleNetId {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for SystemBundleNetId {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for SystemBundleNetId {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///Id of an object in the system document (`prism.system.v2`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Id of an object in the system document (`prism.system.v2`).",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct SystemBundleObjectId(pub ::std::string::String);
impl ::std::ops::Deref for SystemBundleObjectId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemBundleObjectId> for ::std::string::String {
    fn from(value: SystemBundleObjectId) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for SystemBundleObjectId {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for SystemBundleObjectId {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for SystemBundleObjectId {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///One occurrence of the document.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One occurrence of the document.",
///  "type": "object",
///  "required": [
///    "connectors",
///    "occurrence",
///    "state"
///  ],
///  "properties": {
///    "bundleKey": {
///      "description": "The design bundle read; absent unless `ready`.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "connectors": {
///      "description": "Connectors in natural order of their reference; empty unless `ready`.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleConnector"
///      }
///    },
///    "occurrence": {
///      "description": "The occurrence's id.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "outline": {
///      "description": "The board outline's bounding box; absent unless `ready` with an Edge.Cuts outline.",
///      "$ref": "#/$defs/SystemBundleOutline"
///    },
///    "revisionKey": {
///      "description": "The revision key it was read at; absent unless `ready`.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "state": {
///      "description": "What the build knew about it.",
///      "$ref": "#/$defs/SystemBundleOccurrenceState"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleOccurrence {
    ///The occurrence's id.
    pub occurrence: SystemBundleObjectId,
    ///What the build knew about it.
    pub state: SystemBundleOccurrenceState,
    ///The revision key it was read at; absent unless `ready`.
    #[serde(
        rename = "revisionKey",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub revision_key: ::std::option::Option<Sha256Hex>,
    ///The design bundle read; absent unless `ready`.
    #[serde(
        rename = "bundleKey",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub bundle_key: ::std::option::Option<Sha256Hex>,
    ///The board outline's bounding box; absent unless `ready` with an Edge.Cuts outline.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub outline: ::std::option::Option<SystemBundleOutline>,
    ///Connectors in natural order of their reference; empty unless `ready`.
    pub connectors: ::std::vec::Vec<SystemBundleConnector>,
}
///What the build knew about an occurrence.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What the build knew about an occurrence.",
///  "type": "string",
///  "enum": [
///    "ready",
///    "pending",
///    "absent",
///    "unsupported",
///    "redacted"
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
pub enum SystemBundleOccurrenceState {
    #[serde(rename = "ready")]
    Ready,
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "absent")]
    Absent,
    #[serde(rename = "unsupported")]
    Unsupported,
    #[serde(rename = "redacted")]
    Redacted,
}
impl ::std::fmt::Display for SystemBundleOccurrenceState {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Ready => f.write_str("ready"),
            Self::Pending => f.write_str("pending"),
            Self::Absent => f.write_str("absent"),
            Self::Unsupported => f.write_str("unsupported"),
            Self::Redacted => f.write_str("redacted"),
        }
    }
}
impl ::std::str::FromStr for SystemBundleOccurrenceState {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "ready" => Ok(Self::Ready),
            "pending" => Ok(Self::Pending),
            "absent" => Ok(Self::Absent),
            "unsupported" => Ok(Self::Unsupported),
            "redacted" => Ok(Self::Redacted),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleOccurrenceState {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleOccurrenceState {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleOccurrenceState {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A board's outline bounding box.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A board's outline bounding box.",
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
pub struct SystemBundleOutline {
    ///Width in nanometres.
    #[serde(rename = "widthNm")]
    pub width_nm: NonNegativeNanometres,
    ///Height in nanometres.
    #[serde(rename = "heightNm")]
    pub height_nm: NonNegativeNanometres,
}
///One pin pair of a B2B mapping.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One pin pair of a B2B mapping.",
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
pub struct SystemBundlePadPair {
    ///The pad on side A.
    pub a: PadNumber,
    ///The pad on side B.
    pub b: PadNumber,
}
///One pin of a connector, as the board's design bundle has it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One pin of a connector, as the board's design bundle has it.",
///  "type": "object",
///  "required": [
///    "nets",
///    "pad",
///    "power"
///  ],
///  "properties": {
///    "net": {
///      "description": "The pin's first schematic net; absent when it has none.",
///      "$ref": "#/$defs/NetName"
///    },
///    "nets": {
///      "description": "Every schematic net the pin carries, in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/NetName"
///      }
///    },
///    "pad": {
///      "description": "The pad number.",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "pinName": {
///      "description": "The pin's first name; absent when it has none.",
///      "type": "string"
///    },
///    "pinType": {
///      "description": "The pin's first electrical type; absent when unknown.",
///      "type": "string"
///    },
///    "power": {
///      "description": "Whether the pin is on a power net.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundlePin {
    ///The pad number.
    pub pad: PadNumber,
    ///The pin's first schematic net; absent when it has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<NetName>,
    ///Every schematic net the pin carries, in code point order.
    pub nets: ::std::vec::Vec<NetName>,
    ///The pin's first name; absent when it has none.
    #[serde(
        rename = "pinName",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub pin_name: ::std::option::Option<::std::string::String>,
    ///The pin's first electrical type; absent when unknown.
    #[serde(
        rename = "pinType",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub pin_type: ::std::option::Option<::std::string::String>,
    ///Whether the pin is on a power net.
    pub power: bool,
}
///A connector pin of the system.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A connector pin of the system.",
///  "type": "object",
///  "required": [
///    "connector",
///    "occurrence",
///    "pad"
///  ],
///  "properties": {
///    "connector": {
///      "description": "The connector's reference designator.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "occurrence": {
///      "description": "The occurrence.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "pad": {
///      "description": "The pad number.",
///      "$ref": "#/$defs/PadNumber"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundlePinRef {
    ///The occurrence.
    pub occurrence: SystemBundleObjectId,
    ///The connector's reference designator.
    pub connector: Refdes,
    ///The pad number.
    pub pad: PadNumber,
}
///One export's connector, as a system placing this one as an entry mates by it (stage 3d).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One export's connector, as a system placing this one as an entry mates by it (stage 3d).",
///  "type": "object",
///  "required": [
///    "export",
///    "geometry",
///    "matesTop",
///    "mount"
///  ],
///  "properties": {
///    "export": {
///      "description": "The export's id.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "geometry": {
///      "description": "The connector's footprint geometry in that frame.",
///      "$ref": "#/$defs/SystemBundleExportGeometry"
///    },
///    "matesTop": {
///      "description": "An unsure mating-axis inference mates out of the top face: a body's connector, or an export of one.",
///      "type": "boolean"
///    },
///    "mount": {
///      "description": "The frame `geometry` is in, placed in the system frame with the\nconnector's side of its board applied, so the geometry reads at zero\nthickness: a board's frame lifted to its surface, a body connector's\nfootprint frame.",
///      "$ref": "#/$defs/SystemBundlePose"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundlePlacedExport {
    ///The export's id.
    pub export: SystemBundleObjectId,
    /**The frame `geometry` is in, placed in the system frame with the
    connector's side of its board applied, so the geometry reads at zero
    thickness: a board's frame lifted to its surface, a body connector's
    footprint frame.*/
    pub mount: SystemBundlePose,
    ///The connector's footprint geometry in that frame.
    pub geometry: SystemBundleExportGeometry,
    ///An unsure mating-axis inference mates out of the top face: a body's connector, or an export of one.
    #[serde(rename = "matesTop")]
    pub mates_top: bool,
}
///What one B2B mate means for placement.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "What one B2B mate means for placement.",
///  "type": "object",
///  "required": [
///    "driving",
///    "mate"
///  ],
///  "properties": {
///    "driving": {
///      "description": "It places one of its occurrences (it is a positioning mate).",
///      "type": "boolean"
///    },
///    "frameA": {
///      "description": "Side A's connector frame in the system frame; absent when unknown.",
///      "$ref": "#/$defs/SystemBundlePose"
///    },
///    "frameB": {
///      "description": "Side B's connector frame in the system frame; absent when unknown.",
///      "$ref": "#/$defs/SystemBundlePose"
///    },
///    "heightSource": {
///      "description": "Where that height came from.",
///      "$ref": "#/$defs/SystemBundleHeightSource"
///    },
///    "mate": {
///      "description": "The mate's id.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "miss": {
///      "description": "A non-driving mate's miss: B's connector origin minus its mated position, on A's connector axes.",
///      "$ref": "#/$defs/SystemBundleVectorNm"
///    },
///    "missDeg": {
///      "description": "A non-driving mate's rotation miss, in degrees.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "stackHeightNm": {
///      "description": "The stack height used; absent when the mate could not be solved.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundlePlacedMate {
    ///The mate's id.
    pub mate: SystemBundleObjectId,
    ///It places one of its occurrences (it is a positioning mate).
    pub driving: bool,
    ///The stack height used; absent when the mate could not be solved.
    #[serde(
        rename = "stackHeightNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub stack_height_nm: ::std::option::Option<Nanometres>,
    ///Where that height came from.
    #[serde(
        rename = "heightSource",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub height_source: ::std::option::Option<SystemBundleHeightSource>,
    ///Side A's connector frame in the system frame; absent when unknown.
    #[serde(
        rename = "frameA",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub frame_a: ::std::option::Option<SystemBundlePose>,
    ///Side B's connector frame in the system frame; absent when unknown.
    #[serde(
        rename = "frameB",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub frame_b: ::std::option::Option<SystemBundlePose>,
    ///A non-driving mate's miss: B's connector origin minus its mated position, on A's connector axes.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub miss: ::std::option::Option<SystemBundleVectorNm>,
    ///A non-driving mate's rotation miss, in degrees.
    #[serde(
        rename = "missDeg",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub miss_deg: ::std::option::Option<Degrees>,
}
///One occurrence's place in the system.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One occurrence's place in the system.",
///  "type": "object",
///  "required": [
///    "occurrence",
///    "pose",
///    "root",
///    "source"
///  ],
///  "properties": {
///    "bounds": {
///      "description": "Its board's outline box across its thickness, in its own frame; absent when unknown.",
///      "$ref": "#/$defs/SystemBundleBounds"
///    },
///    "occurrence": {
///      "description": "The occurrence's id.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "pose": {
///      "description": "Its board frame in the system frame.",
///      "$ref": "#/$defs/SystemBundlePose"
///    },
///    "positioningMate": {
///      "description": "The mate that placed it, for a mated non-root.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "root": {
///      "description": "The occurrence is its mated group's root, or is not mated.",
///      "type": "boolean"
///    },
///    "source": {
///      "description": "Where the pose came from.",
///      "$ref": "#/$defs/SystemBundlePoseSource"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundlePlacedOccurrence {
    ///The occurrence's id.
    pub occurrence: SystemBundleObjectId,
    ///Its board frame in the system frame.
    pub pose: SystemBundlePose,
    ///Where the pose came from.
    pub source: SystemBundlePoseSource,
    ///The occurrence is its mated group's root, or is not mated.
    pub root: bool,
    ///The mate that placed it, for a mated non-root.
    #[serde(
        rename = "positioningMate",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub positioning_mate: ::std::option::Option<SystemBundleObjectId>,
    ///Its board's outline box across its thickness, in its own frame; absent when unknown.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub bounds: ::std::option::Option<SystemBundleBounds>,
}
///The system's placement (stage 3a).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The system's placement (stage 3a).",
///  "type": "object",
///  "required": [
///    "mates",
///    "occurrences"
///  ],
///  "properties": {
///    "exports": {
///      "description": "Every export whose connector has footprint geometry and a place, sorted\nby `export` in code point order (stage 3d). Absent in bundles built\nbefore format 4.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundlePlacedExport"
///      }
///    },
///    "mates": {
///      "description": "Every mate, sorted by `mate` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundlePlacedMate"
///      }
///    },
///    "occurrences": {
///      "description": "Every occurrence, sorted by `occurrence` in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundlePlacedOccurrence"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundlePlacement {
    ///Every occurrence, sorted by `occurrence` in code point order.
    pub occurrences: ::std::vec::Vec<SystemBundlePlacedOccurrence>,
    ///Every mate, sorted by `mate` in code point order.
    pub mates: ::std::vec::Vec<SystemBundlePlacedMate>,
    /**Every export whose connector has footprint geometry and a place, sorted
    by `export` in code point order (stage 3d). Absent in bundles built
    before format 4.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub exports: ::std::option::Option<::std::vec::Vec<SystemBundlePlacedExport>>,
}
///A frame in the system frame: translation, then rotation.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A frame in the system frame: translation, then rotation.",
///  "type": "object",
///  "required": [
///    "rotation",
///    "translation"
///  ],
///  "properties": {
///    "rotation": {
///      "description": "The rotation.",
///      "$ref": "#/$defs/SystemBundleQuaternion"
///    },
///    "translation": {
///      "description": "The translation.",
///      "$ref": "#/$defs/SystemBundleVectorNm"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundlePose {
    ///The translation.
    pub translation: SystemBundleVectorNm,
    ///The rotation.
    pub rotation: SystemBundleQuaternion,
}
///Where an occurrence's pose came from (CONTRACTS §8.9).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where an occurrence's pose came from (CONTRACTS §8.9).",
///  "type": "string",
///  "enum": [
///    "mate",
///    "stored",
///    "default"
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
pub enum SystemBundlePoseSource {
    #[serde(rename = "mate")]
    Mate,
    #[serde(rename = "stored")]
    Stored,
    #[serde(rename = "default")]
    Default,
}
impl ::std::fmt::Display for SystemBundlePoseSource {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Mate => f.write_str("mate"),
            Self::Stored => f.write_str("stored"),
            Self::Default => f.write_str("default"),
        }
    }
}
impl ::std::str::FromStr for SystemBundlePoseSource {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "mate" => Ok(Self::Mate),
            "stored" => Ok(Self::Stored),
            "default" => Ok(Self::Default),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundlePoseSource {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundlePoseSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundlePoseSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A unit quaternion, canonical with `w ≥ 0`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A unit quaternion, canonical with `w ≥ 0`.",
///  "type": "object",
///  "required": [
///    "w",
///    "x",
///    "y",
///    "z"
///  ],
///  "properties": {
///    "w": {
///      "description": "W.",
///      "type": "number"
///    },
///    "x": {
///      "description": "X.",
///      "type": "number"
///    },
///    "y": {
///      "description": "Y.",
///      "type": "number"
///    },
///    "z": {
///      "description": "Z.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleQuaternion {
    ///X.
    pub x: f64,
    ///Y.
    pub y: f64,
    ///Z.
    pub z: f64,
    ///W.
    pub w: f64,
}
///A posed harness end (§16.6): where the cable leaves the housing.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A posed harness end (§16.6): where the cable leaves the housing.",
///  "type": "object",
///  "required": [
///    "end",
///    "exit",
///    "leg",
///    "outward"
///  ],
///  "properties": {
///    "end": {
///      "description": "The end.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "exit": {
///      "description": "The housing's rear face, where the cable leaves it.",
///      "$ref": "#/$defs/SystemBundleVectorNm"
///    },
///    "leg": {
///      "description": "The end of the straight boot, where the curve starts.",
///      "$ref": "#/$defs/SystemBundleVectorNm"
///    },
///    "outward": {
///      "description": "The connector's outward axis.",
///      "$ref": "#/$defs/SystemBundleUnitVector"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleRouteEnd {
    ///The end.
    pub end: SystemBundleObjectId,
    ///The housing's rear face, where the cable leaves it.
    pub exit: SystemBundleVectorNm,
    ///The connector's outward axis.
    pub outward: SystemBundleUnitVector,
    ///The end of the straight boot, where the curve starts.
    pub leg: SystemBundleVectorNm,
}
///One segment of the route tree and its curve (§16.6).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One segment of the route tree and its curve (§16.6).",
///  "type": "object",
///  "required": [
///    "assumedGauge",
///    "clearances",
///    "derived",
///    "diameterNm",
///    "from",
///    "id",
///    "lengthNm",
///    "minRadiusAllowedNm",
///    "samplesNm",
///    "to",
///    "wires"
///  ],
///  "properties": {
///    "assumedGauge": {
///      "description": "A carried wire's gauge was missing or unknown, so 24 AWG's diameter was used.",
///      "type": "boolean"
///    },
///    "clearances": {
///      "description": "Boards and bodies the bundle comes too close to, in occurrence order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleClearance"
///      }
///    },
///    "derived": {
///      "description": "The tree was derived, not stored.",
///      "type": "boolean"
///    },
///    "diameterNm": {
///      "description": "The bundle's diameter.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "from": {
///      "description": "A node id: an end, a branch point, or `auto` for the automatic breakout.",
///      "type": "string"
///    },
///    "id": {
///      "description": "The stored segment's id, or `<harness>/<from>~<to>` for a derived one.",
///      "type": "string"
///    },
///    "lengthNm": {
///      "description": "The curve's arc length.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "minRadiusAllowedNm": {
///      "description": "The minimum bend radius, 6 × the diameter.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "minRadiusNm": {
///      "description": "The tightest bend's radius; absent for a straight segment.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "samplesNm": {
///      "description": "The curve's samples as flat `[x, y, z, …]` triples in system space, in order from `from` to `to`.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/Nanometres"
///      }
///    },
///    "tightBend": {
///      "description": "Present when a bend is tighter than allowed.",
///      "$ref": "#/$defs/SystemBundleTightBend"
///    },
///    "to": {
///      "description": "A node id, as `from`.",
///      "type": "string"
///    },
///    "wires": {
///      "description": "The wires it carries (wire-list ids, `<link>:<pad A>` for a default one), in wire-list order.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleRouteSegment {
    ///The stored segment's id, or `<harness>/<from>~<to>` for a derived one.
    pub id: ::std::string::String,
    ///The tree was derived, not stored.
    pub derived: bool,
    ///A node id: an end, a branch point, or `auto` for the automatic breakout.
    pub from: ::std::string::String,
    ///A node id, as `from`.
    pub to: ::std::string::String,
    ///The wires it carries (wire-list ids, `<link>:<pad A>` for a default one), in wire-list order.
    pub wires: ::std::vec::Vec<::std::string::String>,
    ///The bundle's diameter.
    #[serde(rename = "diameterNm")]
    pub diameter_nm: Nanometres,
    ///A carried wire's gauge was missing or unknown, so 24 AWG's diameter was used.
    #[serde(rename = "assumedGauge")]
    pub assumed_gauge: bool,
    ///The curve's samples as flat `[x, y, z, …]` triples in system space, in order from `from` to `to`.
    #[serde(rename = "samplesNm")]
    pub samples_nm: ::std::vec::Vec<Nanometres>,
    ///The curve's arc length.
    #[serde(rename = "lengthNm")]
    pub length_nm: Nanometres,
    ///The tightest bend's radius; absent for a straight segment.
    #[serde(
        rename = "minRadiusNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub min_radius_nm: ::std::option::Option<Nanometres>,
    ///The minimum bend radius, 6 × the diameter.
    #[serde(rename = "minRadiusAllowedNm")]
    pub min_radius_allowed_nm: Nanometres,
    ///Present when a bend is tighter than allowed.
    #[serde(
        rename = "tightBend",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub tight_bend: ::std::option::Option<SystemBundleTightBend>,
    ///Boards and bodies the bundle comes too close to, in occurrence order.
    pub clearances: ::std::vec::Vec<SystemBundleClearance>,
}
///A wire's route length.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A wire's route length.",
///  "type": "object",
///  "required": [
///    "wire"
///  ],
///  "properties": {
///    "lengthNm": {
///      "description": "Absent when the wire is unrouted (a splice or loose terminal, or an unposed end).",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "wire": {
///      "description": "The wire's wire-list id.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleRouteWire {
    ///The wire's wire-list id.
    pub wire: ::std::string::String,
    ///Absent when the wire is unrouted (a splice or loose terminal, or an unposed end).
    #[serde(
        rename = "lengthNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub length_nm: ::std::option::Option<Nanometres>,
}
///A finding's fixed severity: errors block publishing an in-house entry unless waived.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A finding's fixed severity: errors block publishing an in-house entry unless waived.",
///  "type": "string",
///  "enum": [
///    "error",
///    "warning",
///    "info"
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
pub enum SystemBundleSeverity {
    #[serde(rename = "error")]
    Error,
    #[serde(rename = "warning")]
    Warning,
    #[serde(rename = "info")]
    Info,
}
impl ::std::fmt::Display for SystemBundleSeverity {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Error => f.write_str("error"),
            Self::Warning => f.write_str("warning"),
            Self::Info => f.write_str("info"),
        }
    }
}
impl ::std::str::FromStr for SystemBundleSeverity {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "error" => Ok(Self::Error),
            "warning" => Ok(Self::Warning),
            "info" => Ok(Self::Info),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleSeverity {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleSeverity {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleSeverity {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A pin of one mating site that two links wire: a proposed splice.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A pin of one mating site that two links wire: a proposed splice.",
///  "type": "object",
///  "required": [
///    "end",
///    "harness",
///    "links",
///    "pad"
///  ],
///  "properties": {
///    "end": {
///      "description": "The end.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "harness": {
///      "description": "The harness block.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "links": {
///      "description": "The links that wire it, in code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/SystemBundleObjectId"
///      }
///    },
///    "pad": {
///      "description": "The pad.",
///      "$ref": "#/$defs/PadNumber"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleSplice {
    ///The harness block.
    pub harness: SystemBundleObjectId,
    ///The end.
    pub end: SystemBundleObjectId,
    ///The pad.
    pub pad: PadNumber,
    ///The links that wire it, in code point order.
    pub links: ::std::vec::Vec<SystemBundleObjectId>,
}
///A sub-port suggestion read from a board's design bundle.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A sub-port suggestion read from a board's design bundle.",
///  "type": "object",
///  "required": [
///    "connector",
///    "key",
///    "name",
///    "occurrence",
///    "pins",
///    "source"
///  ],
///  "properties": {
///    "connector": {
///      "description": "The connector's reference designator.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "key": {
///      "description": "The stable key a sub-port or dismissal names.",
///      "type": "string",
///      "minLength": 1
///    },
///    "name": {
///      "description": "The suggested name.",
///      "type": "string",
///      "minLength": 1
///    },
///    "occurrence": {
///      "description": "The occurrence.",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "pins": {
///      "description": "Pads in natural order, at least two.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/PadNumber"
///      },
///      "minItems": 2
///    },
///    "source": {
///      "description": "Where it came from.",
///      "$ref": "#/$defs/SystemBundleSuggestionSource"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleSuggestion {
    ///The occurrence.
    pub occurrence: SystemBundleObjectId,
    ///The connector's reference designator.
    pub connector: Refdes,
    ///The stable key a sub-port or dismissal names.
    pub key: SystemBundleSuggestionKey,
    ///The suggested name.
    pub name: SystemBundleSuggestionName,
    ///Where it came from.
    pub source: SystemBundleSuggestionSource,
    ///Pads in natural order, at least two.
    pub pins: ::std::vec::Vec<PadNumber>,
}
///The stable key a sub-port or dismissal names.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The stable key a sub-port or dismissal names.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemBundleSuggestionKey(::std::string::String);
impl ::std::ops::Deref for SystemBundleSuggestionKey {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemBundleSuggestionKey> for ::std::string::String {
    fn from(value: SystemBundleSuggestionKey) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemBundleSuggestionKey {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleSuggestionKey {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleSuggestionKey {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleSuggestionKey {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemBundleSuggestionKey {
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
///The suggested name.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The suggested name.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct SystemBundleSuggestionName(::std::string::String);
impl ::std::ops::Deref for SystemBundleSuggestionName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<SystemBundleSuggestionName> for ::std::string::String {
    fn from(value: SystemBundleSuggestionName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for SystemBundleSuggestionName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleSuggestionName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleSuggestionName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleSuggestionName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for SystemBundleSuggestionName {
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
///Where a sub-port suggestion came from.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where a sub-port suggestion came from.",
///  "type": "string",
///  "enum": [
///    "bus-alias",
///    "sheet",
///    "family",
///    "power"
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
pub enum SystemBundleSuggestionSource {
    #[serde(rename = "bus-alias")]
    BusAlias,
    #[serde(rename = "sheet")]
    Sheet,
    #[serde(rename = "family")]
    Family,
    #[serde(rename = "power")]
    Power,
}
impl ::std::fmt::Display for SystemBundleSuggestionSource {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::BusAlias => f.write_str("bus-alias"),
            Self::Sheet => f.write_str("sheet"),
            Self::Family => f.write_str("family"),
            Self::Power => f.write_str("power"),
        }
    }
}
impl ::std::str::FromStr for SystemBundleSuggestionSource {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "bus-alias" => Ok(Self::BusAlias),
            "sheet" => Ok(Self::Sheet),
            "family" => Ok(Self::Family),
            "power" => Ok(Self::Power),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleSuggestionSource {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleSuggestionSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleSuggestionSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One end of a wire of the wire list.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One end of a wire of the wire list.",
///  "type": "object",
///  "required": [
///    "kind"
///  ],
///  "properties": {
///    "cavity": {
///      "description": "The cavity (`contact`).",
///      "type": "string"
///    },
///    "end": {
///      "description": "The end (`contact`).",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "kind": {
///      "description": "What it is.",
///      "$ref": "#/$defs/SystemBundleTerminalKind"
///    },
///    "looseEnd": {
///      "description": "The loose end (`loose`).",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    },
///    "pad": {
///      "description": "The site's pad in that cavity (`contact`, when the end has a site).",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "splice": {
///      "description": "The splice (`splice`).",
///      "$ref": "#/$defs/SystemBundleObjectId"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleTerminal {
    ///What it is.
    pub kind: SystemBundleTerminalKind,
    ///The end (`contact`).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub end: ::std::option::Option<SystemBundleObjectId>,
    ///The cavity (`contact`).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub cavity: ::std::option::Option<::std::string::String>,
    ///The site's pad in that cavity (`contact`, when the end has a site).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub pad: ::std::option::Option<PadNumber>,
    ///The splice (`splice`).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub splice: ::std::option::Option<SystemBundleObjectId>,
    ///The loose end (`loose`).
    #[serde(
        rename = "looseEnd",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub loose_end: ::std::option::Option<SystemBundleObjectId>,
}
///Where a wire of the wire list stops (§16.3).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where a wire of the wire list stops (§16.3).",
///  "type": "string",
///  "enum": [
///    "contact",
///    "splice",
///    "loose"
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
pub enum SystemBundleTerminalKind {
    #[serde(rename = "contact")]
    Contact,
    #[serde(rename = "splice")]
    Splice,
    #[serde(rename = "loose")]
    Loose,
}
impl ::std::fmt::Display for SystemBundleTerminalKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Contact => f.write_str("contact"),
            Self::Splice => f.write_str("splice"),
            Self::Loose => f.write_str("loose"),
        }
    }
}
impl ::std::str::FromStr for SystemBundleTerminalKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "contact" => Ok(Self::Contact),
            "splice" => Ok(Self::Splice),
            "loose" => Ok(Self::Loose),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleTerminalKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleTerminalKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleTerminalKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A bend tighter than the minimum radius.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A bend tighter than the minimum radius.",
///  "type": "object",
///  "required": [
///    "at",
///    "radiusNm"
///  ],
///  "properties": {
///    "at": {
///      "description": "Where the bend is tightest.",
///      "$ref": "#/$defs/SystemBundleVectorNm"
///    },
///    "radiusNm": {
///      "description": "The radius there.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleTightBend {
    ///Where the bend is tightest.
    pub at: SystemBundleVectorNm,
    ///The radius there.
    #[serde(rename = "radiusNm")]
    pub radius_nm: Nanometres,
}
///A unit direction.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A unit direction.",
///  "type": "object",
///  "required": [
///    "x",
///    "y",
///    "z"
///  ],
///  "properties": {
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
pub struct SystemBundleUnitVector {
    ///The x component.
    pub x: f64,
    ///The y component.
    pub y: f64,
    ///The z component.
    pub z: f64,
}
///A point or offset in the system frame, in nanometres.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A point or offset in the system frame, in nanometres.",
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
///      "description": "Z in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleVectorNm {
    ///X in nanometres.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///Y in nanometres.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
    ///Z in nanometres.
    #[serde(rename = "zNm")]
    pub z_nm: Nanometres,
}
///One wire of a harness link's wiring.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One wire of a harness link's wiring.",
///  "type": "object",
///  "required": [
///    "a",
///    "b",
///    "rule",
///    "suggested"
///  ],
///  "properties": {
///    "a": {
///      "description": "The pad on side A.",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "b": {
///      "description": "The pad on side B.",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "rule": {
///      "description": "The rule that wired it.",
///      "$ref": "#/$defs/SystemBundleWireRule"
///    },
///    "suggested": {
///      "description": "Whether it joins power or ground pins, shown as suggested until confirmed.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SystemBundleWire {
    ///The pad on side A.
    pub a: PadNumber,
    ///The pad on side B.
    pub b: PadNumber,
    ///The rule that wired it.
    pub rule: SystemBundleWireRule,
    ///Whether it joins power or ground pins, shown as suggested until confirmed.
    pub suggested: bool,
}
///Where a wire of the wire list comes from.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where a wire of the wire list comes from.",
///  "type": "string",
///  "enum": [
///    "explicit",
///    "default"
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
pub enum SystemBundleWireOrigin {
    #[serde(rename = "explicit")]
    Explicit,
    #[serde(rename = "default")]
    Default,
}
impl ::std::fmt::Display for SystemBundleWireOrigin {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Explicit => f.write_str("explicit"),
            Self::Default => f.write_str("default"),
        }
    }
}
impl ::std::str::FromStr for SystemBundleWireOrigin {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "explicit" => Ok(Self::Explicit),
            "default" => Ok(Self::Default),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleWireOrigin {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleWireOrigin {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleWireOrigin {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///Which rule wired a pin pair of a harness link.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Which rule wired a pin pair of a harness link.",
///  "type": "string",
///  "enum": [
///    "explicit",
///    "sub-port-order",
///    "net-name"
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
pub enum SystemBundleWireRule {
    #[serde(rename = "explicit")]
    Explicit,
    #[serde(rename = "sub-port-order")]
    SubPortOrder,
    #[serde(rename = "net-name")]
    NetName,
}
impl ::std::fmt::Display for SystemBundleWireRule {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Explicit => f.write_str("explicit"),
            Self::SubPortOrder => f.write_str("sub-port-order"),
            Self::NetName => f.write_str("net-name"),
        }
    }
}
impl ::std::str::FromStr for SystemBundleWireRule {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "explicit" => Ok(Self::Explicit),
            "sub-port-order" => Ok(Self::SubPortOrder),
            "net-name" => Ok(Self::NetName),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for SystemBundleWireRule {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for SystemBundleWireRule {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for SystemBundleWireRule {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
