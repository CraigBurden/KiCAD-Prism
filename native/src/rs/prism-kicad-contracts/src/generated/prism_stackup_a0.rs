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
/**KiCad canonical layer name as the board file's `(layers …)` table spells
it, for example `F.Cu`, `In1.Cu`, `B.Mask`, `Edge.Cuts` or `User.1`. Never
the user-assigned layer name, which a contract carries in a separate
optional field. Never a wildcard set such as `*.Cu` or `F&B.Cu`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad canonical layer name as the board file's `(layers …)` table spells\nit, for example `F.Cu`, `In1.Cu`, `B.Mask`, `Edge.Cuts` or `User.1`. Never\nthe user-assigned layer name, which a contract carries in a separate\noptional field. Never a wildcard set such as `*.Cu` or `F&B.Cu`.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct LayerName(::std::string::String);
impl ::std::ops::Deref for LayerName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<LayerName> for ::std::string::String {
    fn from(value: LayerName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for LayerName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for LayerName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for LayerName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for LayerName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for LayerName {
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
/**Projection of a board's stackup, fabrication settings, layer table and via
technology. All lengths are integer nanometres converted from the file's
millimetres as conventions.md §6 states.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.stackup:a0",
///  "title": "StackupA0",
///  "description": "Projection of a board's stackup, fabrication settings, layer table and via\ntechnology. All lengths are integer nanometres converted from the file's\nmillimetres as conventions.md §6 states.",
///  "type": "object",
///  "required": [
///    "boardLayers",
///    "boardThicknessNm",
///    "copperLayers",
///    "layers",
///    "maskColors",
///    "present",
///    "schema",
///    "viaSpans"
///  ],
///  "properties": {
///    "boardLayers": {
///      "description": "The board's `(layers …)` table, one row per declared layer, in file\norder. Empty only for a board file without a layer table.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/StackupBoardLayer"
///      }
///    },
///    "boardThicknessNm": {
///      "description": "Board thickness from `(general (thickness …))`, in nanometres. KiCad's\ndefault of 1.6 mm (1600000) when the file has no such form, as KiCad and\nboth parsers read it. This is the design setting, not the stackup sum\n(`stackThicknessNm`); the two may differ.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "copperLayers": {
///      "description": "The board's copper layers in stack order from front to back. When\n`present` is true: the names of the `layers` entries whose kind is\ncopper, in their order. Otherwise: the names of the `boardLayers` rows\nthat end in `.Cu`, in file order (KiCad writes copper rows front to\nback). Via spans are resolved against this order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/LayerName"
///      }
///    },
///    "layers": {
///      "description": "The stackup's entries in stack order from front to back: the order of\nthe `(layer …)` forms inside `(stackup …)`, which KiCad writes front to\nback. A dielectric with `addsublayer` tokens contributes one entry per\nsub-layer, consecutive and in file order, with `sublayer` 0, 1, 2, ….\nEmpty when `present` is false.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/StackupLayer"
///      }
///    },
///    "maskColors": {
///      "description": "Solder mask colour per side, copied from the `color` of the `F.Mask` and\n`B.Mask` entries of `layers`. Each side is absent when the stackup has no\nsuch entry or the entry has no colour.",
///      "$ref": "#/$defs/StackupMaskColors"
///    },
///    "present": {
///      "description": "True when the board file has a `(setup (stackup …))` form, even an empty\none. False otherwise: `layers` is then empty, `settings` is absent and\n`copperLayers` comes from the layer table.",
///      "type": "boolean"
///    },
///    "schema": {
///      "description": "Schema id of this document.",
///      "type": "string",
///      "const": "prism.stackup.a0"
///    },
///    "settings": {
///      "description": "The stackup's board-level fabrication settings. Absent when `present` is\nfalse.",
///      "$ref": "#/$defs/StackupSettings"
///    },
///    "stackThicknessNm": {
///      "description": "Sum of `thicknessNm` over every entry of `layers` whose kind is copper,\ndielectric or soldermask, sub-layers included. Absent when `present` is\nfalse, when `layers` has no such entry, or when any such entry has no\n`thicknessNm`.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "viaSpans": {
///      "description": "Every top-level `(via …)` of the board, grouped by technology, span and\nback/tertiary drilling, with the number of vias in each group. Sorted\nby: the index of `startLayer` in `copperLayers` (absent or not in\n`copperLayers` sorts after every index), then the index of `stopLayer`\nlikewise, then `viaType` in code point order of its JSON value, then\n`startLayer` and `stopLayer` in code point order (absent as the empty\nstring), then `backdrill`, then `tertiaryDrill`; a drill compares absent\nbefore present, then by `sizeNm` (absent first, then numeric order), then\n`startLayer` and `stopLayer` in code point order (absent as the empty\nstring). Empty when the board has no via.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/StackupViaSpan"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct StackupA0 {
    ///Schema id of this document.
    pub schema: ::std::string::String,
    /**True when the board file has a `(setup (stackup …))` form, even an empty
    one. False otherwise: `layers` is then empty, `settings` is absent and
    `copperLayers` comes from the layer table.*/
    pub present: bool,
    /**Board thickness from `(general (thickness …))`, in nanometres. KiCad's
    default of 1.6 mm (1600000) when the file has no such form, as KiCad and
    both parsers read it. This is the design setting, not the stackup sum
    (`stackThicknessNm`); the two may differ.*/
    #[serde(rename = "boardThicknessNm")]
    pub board_thickness_nm: NonNegativeNanometres,
    /**Sum of `thicknessNm` over every entry of `layers` whose kind is copper,
    dielectric or soldermask, sub-layers included. Absent when `present` is
    false, when `layers` has no such entry, or when any such entry has no
    `thicknessNm`.*/
    #[serde(
        rename = "stackThicknessNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub stack_thickness_nm: ::std::option::Option<NonNegativeNanometres>,
    /**The stackup's entries in stack order from front to back: the order of
    the `(layer …)` forms inside `(stackup …)`, which KiCad writes front to
    back. A dielectric with `addsublayer` tokens contributes one entry per
    sub-layer, consecutive and in file order, with `sublayer` 0, 1, 2, ….
    Empty when `present` is false.*/
    pub layers: ::std::vec::Vec<StackupLayer>,
    /**The board's copper layers in stack order from front to back. When
    `present` is true: the names of the `layers` entries whose kind is
    copper, in their order. Otherwise: the names of the `boardLayers` rows
    that end in `.Cu`, in file order (KiCad writes copper rows front to
    back). Via spans are resolved against this order.*/
    #[serde(rename = "copperLayers")]
    pub copper_layers: ::std::vec::Vec<LayerName>,
    /**The stackup's board-level fabrication settings. Absent when `present` is
    false.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub settings: ::std::option::Option<StackupSettings>,
    /**Solder mask colour per side, copied from the `color` of the `F.Mask` and
    `B.Mask` entries of `layers`. Each side is absent when the stackup has no
    such entry or the entry has no colour.*/
    #[serde(rename = "maskColors")]
    pub mask_colors: StackupMaskColors,
    /**Every top-level `(via …)` of the board, grouped by technology, span and
    back/tertiary drilling, with the number of vias in each group. Sorted
    by: the index of `startLayer` in `copperLayers` (absent or not in
    `copperLayers` sorts after every index), then the index of `stopLayer`
    likewise, then `viaType` in code point order of its JSON value, then
    `startLayer` and `stopLayer` in code point order (absent as the empty
    string), then `backdrill`, then `tertiaryDrill`; a drill compares absent
    before present, then by `sizeNm` (absent first, then numeric order), then
    `startLayer` and `stopLayer` in code point order (absent as the empty
    string). Empty when the board has no via.*/
    #[serde(rename = "viaSpans")]
    pub via_spans: ::std::vec::Vec<StackupViaSpan>,
    /**The board's `(layers …)` table, one row per declared layer, in file
    order. Empty only for a board file without a layer table.*/
    #[serde(rename = "boardLayers")]
    pub board_layers: ::std::vec::Vec<StackupBoardLayer>,
}
///One row of the board's `(layers …)` table: `(<ordinal> "<name>" <type> ["<user name>"])`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One row of the board's `(layers …)` table: `(<ordinal> \"<name>\" <type> [\"<user name>\"])`.",
///  "type": "object",
///  "required": [
///    "name",
///    "ordinal"
///  ],
///  "properties": {
///    "name": {
///      "description": "The layer's canonical name.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "ordinal": {
///      "description": "The layer's ordinal, the integer that opens the row, as written.",
///      "$ref": "#/$defs/Count"
///    },
///    "type": {
///      "description": "The row's type token. Absent when the row has none or a token outside\nthe KiCad set.",
///      "$ref": "#/$defs/StackupBoardLayerType"
///    },
///    "userName": {
///      "description": "The user-assigned layer name, the row's optional fourth element, as\nwritten. Absent when not written or empty.",
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
pub struct StackupBoardLayer {
    ///The layer's ordinal, the integer that opens the row, as written.
    pub ordinal: Count,
    ///The layer's canonical name.
    pub name: LayerName,
    /**The row's type token. Absent when the row has none or a token outside
    the KiCad set.*/
    #[serde(
        rename = "type",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub type_: ::std::option::Option<StackupBoardLayerType>,
    /**The user-assigned layer name, the row's optional fourth element, as
    written. Absent when not written or empty.*/
    #[serde(
        rename = "userName",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub user_name: ::std::option::Option<StackupBoardLayerUserName>,
}
/**The type token of one row of the board's `(layers …)` table, spelled as
KiCad writes it (`LAYER::ShowType`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The type token of one row of the board's `(layers …)` table, spelled as\nKiCad writes it (`LAYER::ShowType`).",
///  "type": "string",
///  "enum": [
///    "signal",
///    "power",
///    "mixed",
///    "jumper",
///    "auxiliary",
///    "front",
///    "back",
///    "user"
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
pub enum StackupBoardLayerType {
    #[serde(rename = "signal")]
    Signal,
    #[serde(rename = "power")]
    Power,
    #[serde(rename = "mixed")]
    Mixed,
    #[serde(rename = "jumper")]
    Jumper,
    #[serde(rename = "auxiliary")]
    Auxiliary,
    #[serde(rename = "front")]
    Front,
    #[serde(rename = "back")]
    Back,
    #[serde(rename = "user")]
    User,
}
impl ::std::fmt::Display for StackupBoardLayerType {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Signal => f.write_str("signal"),
            Self::Power => f.write_str("power"),
            Self::Mixed => f.write_str("mixed"),
            Self::Jumper => f.write_str("jumper"),
            Self::Auxiliary => f.write_str("auxiliary"),
            Self::Front => f.write_str("front"),
            Self::Back => f.write_str("back"),
            Self::User => f.write_str("user"),
        }
    }
}
impl ::std::str::FromStr for StackupBoardLayerType {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "signal" => Ok(Self::Signal),
            "power" => Ok(Self::Power),
            "mixed" => Ok(Self::Mixed),
            "jumper" => Ok(Self::Jumper),
            "auxiliary" => Ok(Self::Auxiliary),
            "front" => Ok(Self::Front),
            "back" => Ok(Self::Back),
            "user" => Ok(Self::User),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for StackupBoardLayerType {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupBoardLayerType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupBoardLayerType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**The user-assigned layer name, the row's optional fourth element, as
written. Absent when not written or empty.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The user-assigned layer name, the row's optional fourth element, as\nwritten. Absent when not written or empty.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct StackupBoardLayerUserName(::std::string::String);
impl ::std::ops::Deref for StackupBoardLayerUserName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<StackupBoardLayerUserName> for ::std::string::String {
    fn from(value: StackupBoardLayerUserName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for StackupBoardLayerUserName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for StackupBoardLayerUserName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupBoardLayerUserName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupBoardLayerUserName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for StackupBoardLayerUserName {
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
/**The stackup's `(edge_connector …)` setting, spelled as KiCad writes it.
KiCad writes the token only for `yes` and `bevelled`; its absence is
`none`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The stackup's `(edge_connector …)` setting, spelled as KiCad writes it.\nKiCad writes the token only for `yes` and `bevelled`; its absence is\n`none`.",
///  "type": "string",
///  "enum": [
///    "none",
///    "yes",
///    "bevelled"
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
pub enum StackupEdgeConnector {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "yes")]
    Yes,
    #[serde(rename = "bevelled")]
    Bevelled,
}
impl ::std::fmt::Display for StackupEdgeConnector {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::None => f.write_str("none"),
            Self::Yes => f.write_str("yes"),
            Self::Bevelled => f.write_str("bevelled"),
        }
    }
}
impl ::std::str::FromStr for StackupEdgeConnector {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "none" => Ok(Self::None),
            "yes" => Ok(Self::Yes),
            "bevelled" => Ok(Self::Bevelled),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for StackupEdgeConnector {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupEdgeConnector {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupEdgeConnector {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**One entry of the physical stackup: a `(layer …)` form of `(stackup …)`,
or one sub-layer of a dielectric form that has `addsublayer` tokens.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One entry of the physical stackup: a `(layer …)` form of `(stackup …)`,\nor one sub-layer of a dielectric form that has `addsublayer` tokens.",
///  "type": "object",
///  "required": [
///    "kind",
///    "name",
///    "sublayer"
///  ],
///  "properties": {
///    "color": {
///      "description": "Colour from `(color \"…\")` of this entry or sub-layer, as written: a\nKiCad colour name (`Green`, `White`, `FR4 natural`) or a custom\n`#RRGGBBAA`. Absent when not written or empty.",
///      "type": "string",
///      "minLength": 1
///    },
///    "epsilonR": {
///      "description": "Relative permittivity εr from `(epsilon_r …)` of this entry or\nsub-layer, as written, including 0. Absent when not written.",
///      "type": "number"
///    },
///    "kind": {
///      "description": "Prism's classification of the entry, from its name.",
///      "$ref": "#/$defs/StackupLayerKind"
///    },
///    "lossTangent": {
///      "description": "Loss tangent tan δ from `(loss_tangent …)` of this entry or sub-layer,\nas written, including 0. Absent when not written.",
///      "type": "number"
///    },
///    "material": {
///      "description": "Material from `(material \"…\")` of this entry or sub-layer, as written\n(for example `FR4`, `3313`, `Not specified`). Absent when not written or\nempty.",
///      "type": "string",
///      "minLength": 1
///    },
///    "name": {
///      "description": "The name the `(layer \"<name>\" …)` form gives: a canonical board layer\nname (`F.SilkS`, `F.Mask`, `F.Cu`, `In1.Cu`) or `dielectric <n>` for a\ndielectric. Every sub-layer of one dielectric repeats the name.",
///      "type": "string",
///      "minLength": 1
///    },
///    "sublayer": {
///      "description": "Position of this entry among the sub-layers of its `(layer …)` form: 0\nfor the values before the first bare `addsublayer` token, n for the\nvalues after the n-th one. Only dielectrics have sub-layers, so every\nother entry has 0.",
///      "$ref": "#/$defs/Count"
///    },
///    "thicknessNm": {
///      "description": "Thickness of this entry or sub-layer from its `(thickness <mm> [locked])`,\nin nanometres. Absent when it is not written or written as zero, which\nKiCad and today's readers treat as unspecified; never 0.",
///      "$ref": "#/$defs/StackupPositiveNanometres"
///    },
///    "type": {
///      "description": "The form's `(type \"…\")`, repeated on every sub-layer. Absent when the\nform has none or a value outside the KiCad set.",
///      "$ref": "#/$defs/StackupLayerType"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct StackupLayer {
    /**The name the `(layer "<name>" …)` form gives: a canonical board layer
    name (`F.SilkS`, `F.Mask`, `F.Cu`, `In1.Cu`) or `dielectric <n>` for a
    dielectric. Every sub-layer of one dielectric repeats the name.*/
    pub name: StackupLayerName,
    /**Position of this entry among the sub-layers of its `(layer …)` form: 0
    for the values before the first bare `addsublayer` token, n for the
    values after the n-th one. Only dielectrics have sub-layers, so every
    other entry has 0.*/
    pub sublayer: Count,
    ///Prism's classification of the entry, from its name.
    pub kind: StackupLayerKind,
    /**The form's `(type "…")`, repeated on every sub-layer. Absent when the
    form has none or a value outside the KiCad set.*/
    #[serde(
        rename = "type",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub type_: ::std::option::Option<StackupLayerType>,
    /**Thickness of this entry or sub-layer from its `(thickness <mm> [locked])`,
    in nanometres. Absent when it is not written or written as zero, which
    KiCad and today's readers treat as unspecified; never 0.*/
    #[serde(
        rename = "thicknessNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub thickness_nm: ::std::option::Option<StackupPositiveNanometres>,
    /**Material from `(material "…")` of this entry or sub-layer, as written
    (for example `FR4`, `3313`, `Not specified`). Absent when not written or
    empty.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub material: ::std::option::Option<StackupLayerMaterial>,
    /**Relative permittivity εr from `(epsilon_r …)` of this entry or
    sub-layer, as written, including 0. Absent when not written.*/
    #[serde(
        rename = "epsilonR",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub epsilon_r: ::std::option::Option<f64>,
    /**Loss tangent tan δ from `(loss_tangent …)` of this entry or sub-layer,
    as written, including 0. Absent when not written.*/
    #[serde(
        rename = "lossTangent",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub loss_tangent: ::std::option::Option<f64>,
    /**Colour from `(color "…")` of this entry or sub-layer, as written: a
    KiCad colour name (`Green`, `White`, `FR4 natural`) or a custom
    `#RRGGBBAA`. Absent when not written or empty.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub color: ::std::option::Option<StackupLayerColor>,
}
/**Colour from `(color "…")` of this entry or sub-layer, as written: a
KiCad colour name (`Green`, `White`, `FR4 natural`) or a custom
`#RRGGBBAA`. Absent when not written or empty.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Colour from `(color \"…\")` of this entry or sub-layer, as written: a\nKiCad colour name (`Green`, `White`, `FR4 natural`) or a custom\n`#RRGGBBAA`. Absent when not written or empty.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct StackupLayerColor(::std::string::String);
impl ::std::ops::Deref for StackupLayerColor {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<StackupLayerColor> for ::std::string::String {
    fn from(value: StackupLayerColor) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for StackupLayerColor {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for StackupLayerColor {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupLayerColor {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupLayerColor {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for StackupLayerColor {
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
/**Prism's classification of a stackup entry, from the entry's name alone
(KiCad types a stackup item by its layer, not by its `type` string): a
name ending in `.Cu` is copper; `F.Mask`/`B.Mask` solder mask;
`F.Paste`/`B.Paste` paste; `F.SilkS`/`B.SilkS` silkscreen; a name starting
with `dielectric` a dielectric; anything else other. Today's readers,
which classify by `type`, agree on every KiCad-written stackup.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Prism's classification of a stackup entry, from the entry's name alone\n(KiCad types a stackup item by its layer, not by its `type` string): a\nname ending in `.Cu` is copper; `F.Mask`/`B.Mask` solder mask;\n`F.Paste`/`B.Paste` paste; `F.SilkS`/`B.SilkS` silkscreen; a name starting\nwith `dielectric` a dielectric; anything else other. Today's readers,\nwhich classify by `type`, agree on every KiCad-written stackup.",
///  "type": "string",
///  "enum": [
///    "copper",
///    "dielectric",
///    "soldermask",
///    "silkscreen",
///    "paste",
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
pub enum StackupLayerKind {
    #[serde(rename = "copper")]
    Copper,
    #[serde(rename = "dielectric")]
    Dielectric,
    #[serde(rename = "soldermask")]
    Soldermask,
    #[serde(rename = "silkscreen")]
    Silkscreen,
    #[serde(rename = "paste")]
    Paste,
    #[serde(rename = "other")]
    Other,
}
impl ::std::fmt::Display for StackupLayerKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Copper => f.write_str("copper"),
            Self::Dielectric => f.write_str("dielectric"),
            Self::Soldermask => f.write_str("soldermask"),
            Self::Silkscreen => f.write_str("silkscreen"),
            Self::Paste => f.write_str("paste"),
            Self::Other => f.write_str("other"),
        }
    }
}
impl ::std::str::FromStr for StackupLayerKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "copper" => Ok(Self::Copper),
            "dielectric" => Ok(Self::Dielectric),
            "soldermask" => Ok(Self::Soldermask),
            "silkscreen" => Ok(Self::Silkscreen),
            "paste" => Ok(Self::Paste),
            "other" => Ok(Self::Other),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for StackupLayerKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupLayerKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupLayerKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**Material from `(material "…")` of this entry or sub-layer, as written
(for example `FR4`, `3313`, `Not specified`). Absent when not written or
empty.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Material from `(material \"…\")` of this entry or sub-layer, as written\n(for example `FR4`, `3313`, `Not specified`). Absent when not written or\nempty.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct StackupLayerMaterial(::std::string::String);
impl ::std::ops::Deref for StackupLayerMaterial {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<StackupLayerMaterial> for ::std::string::String {
    fn from(value: StackupLayerMaterial) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for StackupLayerMaterial {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for StackupLayerMaterial {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupLayerMaterial {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupLayerMaterial {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for StackupLayerMaterial {
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
/**The name the `(layer "<name>" …)` form gives: a canonical board layer
name (`F.SilkS`, `F.Mask`, `F.Cu`, `In1.Cu`) or `dielectric <n>` for a
dielectric. Every sub-layer of one dielectric repeats the name.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The name the `(layer \"<name>\" …)` form gives: a canonical board layer\nname (`F.SilkS`, `F.Mask`, `F.Cu`, `In1.Cu`) or `dielectric <n>` for a\ndielectric. Every sub-layer of one dielectric repeats the name.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct StackupLayerName(::std::string::String);
impl ::std::ops::Deref for StackupLayerName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<StackupLayerName> for ::std::string::String {
    fn from(value: StackupLayerName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for StackupLayerName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for StackupLayerName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupLayerName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupLayerName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for StackupLayerName {
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
/**The `(type "…")` of a stackup `(layer …)` form, spelled exactly as KiCad
writes it (`board_stackup.cpp`). The member names are TypeSpec identifiers
only; the JSON value is the KiCad string.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The `(type \"…\")` of a stackup `(layer …)` form, spelled exactly as KiCad\nwrites it (`board_stackup.cpp`). The member names are TypeSpec identifiers\nonly; the JSON value is the KiCad string.",
///  "type": "string",
///  "enum": [
///    "Top Silk Screen",
///    "Top Solder Paste",
///    "Top Solder Mask",
///    "copper",
///    "core",
///    "prepreg",
///    "Bottom Solder Mask",
///    "Bottom Solder Paste",
///    "Bottom Silk Screen"
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
pub enum StackupLayerType {
    #[serde(rename = "Top Silk Screen")]
    TopSilkScreen,
    #[serde(rename = "Top Solder Paste")]
    TopSolderPaste,
    #[serde(rename = "Top Solder Mask")]
    TopSolderMask,
    #[serde(rename = "copper")]
    Copper,
    #[serde(rename = "core")]
    Core,
    #[serde(rename = "prepreg")]
    Prepreg,
    #[serde(rename = "Bottom Solder Mask")]
    BottomSolderMask,
    #[serde(rename = "Bottom Solder Paste")]
    BottomSolderPaste,
    #[serde(rename = "Bottom Silk Screen")]
    BottomSilkScreen,
}
impl ::std::fmt::Display for StackupLayerType {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::TopSilkScreen => f.write_str("Top Silk Screen"),
            Self::TopSolderPaste => f.write_str("Top Solder Paste"),
            Self::TopSolderMask => f.write_str("Top Solder Mask"),
            Self::Copper => f.write_str("copper"),
            Self::Core => f.write_str("core"),
            Self::Prepreg => f.write_str("prepreg"),
            Self::BottomSolderMask => f.write_str("Bottom Solder Mask"),
            Self::BottomSolderPaste => f.write_str("Bottom Solder Paste"),
            Self::BottomSilkScreen => f.write_str("Bottom Silk Screen"),
        }
    }
}
impl ::std::str::FromStr for StackupLayerType {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "Top Silk Screen" => Ok(Self::TopSilkScreen),
            "Top Solder Paste" => Ok(Self::TopSolderPaste),
            "Top Solder Mask" => Ok(Self::TopSolderMask),
            "copper" => Ok(Self::Copper),
            "core" => Ok(Self::Core),
            "prepreg" => Ok(Self::Prepreg),
            "Bottom Solder Mask" => Ok(Self::BottomSolderMask),
            "Bottom Solder Paste" => Ok(Self::BottomSolderPaste),
            "Bottom Silk Screen" => Ok(Self::BottomSilkScreen),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for StackupLayerType {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupLayerType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupLayerType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A solder mask colour for each side of the board.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A solder mask colour for each side of the board.",
///  "type": "object",
///  "properties": {
///    "back": {
///      "description": "`color` of the stackup's `B.Mask` entry. Absent when there is none;\nreaders that need a colour then use `front`, as the 3D tab does.",
///      "type": "string",
///      "minLength": 1
///    },
///    "front": {
///      "description": "`color` of the stackup's `F.Mask` entry. Absent when there is none.",
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
pub struct StackupMaskColors {
    ///`color` of the stackup's `F.Mask` entry. Absent when there is none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub front: ::std::option::Option<StackupMaskColorsFront>,
    /**`color` of the stackup's `B.Mask` entry. Absent when there is none;
    readers that need a colour then use `front`, as the 3D tab does.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub back: ::std::option::Option<StackupMaskColorsBack>,
}
impl ::std::default::Default for StackupMaskColors {
    fn default() -> Self {
        Self {
            back: Default::default(),
            front: Default::default(),
        }
    }
}
/**`color` of the stackup's `B.Mask` entry. Absent when there is none;
readers that need a colour then use `front`, as the 3D tab does.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "`color` of the stackup's `B.Mask` entry. Absent when there is none;\nreaders that need a colour then use `front`, as the 3D tab does.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct StackupMaskColorsBack(::std::string::String);
impl ::std::ops::Deref for StackupMaskColorsBack {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<StackupMaskColorsBack> for ::std::string::String {
    fn from(value: StackupMaskColorsBack) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for StackupMaskColorsBack {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for StackupMaskColorsBack {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupMaskColorsBack {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupMaskColorsBack {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for StackupMaskColorsBack {
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
///`color` of the stackup's `F.Mask` entry. Absent when there is none.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "`color` of the stackup's `F.Mask` entry. Absent when there is none.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct StackupMaskColorsFront(::std::string::String);
impl ::std::ops::Deref for StackupMaskColorsFront {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<StackupMaskColorsFront> for ::std::string::String {
    fn from(value: StackupMaskColorsFront) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for StackupMaskColorsFront {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for StackupMaskColorsFront {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupMaskColorsFront {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupMaskColorsFront {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for StackupMaskColorsFront {
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
///A count that is at least 1.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A count that is at least 1.",
///  "type": "integer",
///  "minimum": 1.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct StackupPositiveCount(pub ::std::num::NonZeroU64);
impl ::std::ops::Deref for StackupPositiveCount {
    type Target = ::std::num::NonZeroU64;
    fn deref(&self) -> &::std::num::NonZeroU64 {
        &self.0
    }
}
impl ::std::convert::From<StackupPositiveCount> for ::std::num::NonZeroU64 {
    fn from(value: StackupPositiveCount) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::num::NonZeroU64> for StackupPositiveCount {
    fn from(value: ::std::num::NonZeroU64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for StackupPositiveCount {
    type Err = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for StackupPositiveCount {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for StackupPositiveCount {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for StackupPositiveCount {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///A stated, non-zero length in nanometres: at least 1.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A stated, non-zero length in nanometres: at least 1.",
///  "type": "integer",
///  "minimum": 1.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct StackupPositiveNanometres(pub ::std::num::NonZeroU64);
impl ::std::ops::Deref for StackupPositiveNanometres {
    type Target = ::std::num::NonZeroU64;
    fn deref(&self) -> &::std::num::NonZeroU64 {
        &self.0
    }
}
impl ::std::convert::From<StackupPositiveNanometres> for ::std::num::NonZeroU64 {
    fn from(value: StackupPositiveNanometres) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::num::NonZeroU64> for StackupPositiveNanometres {
    fn from(value: ::std::num::NonZeroU64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for StackupPositiveNanometres {
    type Err = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for StackupPositiveNanometres {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for StackupPositiveNanometres {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for StackupPositiveNanometres {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///The board-level settings that close a `(stackup …)` form.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The board-level settings that close a `(stackup …)` form.",
///  "type": "object",
///  "required": [
///    "castellatedPads",
///    "dielectricConstraints",
///    "edgeConnector",
///    "edgePlating"
///  ],
///  "properties": {
///    "castellatedPads": {
///      "description": "Castellated pads, from `(castellated_pads yes)`. False when absent.",
///      "type": "boolean"
///    },
///    "copperFinish": {
///      "description": "Copper finish from `(copper_finish \"…\")`, as written (for example\n`None`, `ENIG`, `HAL lead-free`). KiCad writes the literal `None` for no\nfinish. Absent when the token is not written or empty.",
///      "type": "string",
///      "minLength": 1
///    },
///    "dielectricConstraints": {
///      "description": "Impedance-controlled build, from `(dielectric_constraints yes|no)`.\nFalse when the token is absent, as KiCad reads it.",
///      "type": "boolean"
///    },
///    "edgeConnector": {
///      "description": "Edge-card connector setting from `(edge_connector …)`; `none` when absent.",
///      "$ref": "#/$defs/StackupEdgeConnector"
///    },
///    "edgePlating": {
///      "description": "Plated board edge, from `(edge_plating yes)`. False when absent.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct StackupSettings {
    /**Copper finish from `(copper_finish "…")`, as written (for example
    `None`, `ENIG`, `HAL lead-free`). KiCad writes the literal `None` for no
    finish. Absent when the token is not written or empty.*/
    #[serde(
        rename = "copperFinish",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub copper_finish: ::std::option::Option<StackupSettingsCopperFinish>,
    /**Impedance-controlled build, from `(dielectric_constraints yes|no)`.
    False when the token is absent, as KiCad reads it.*/
    #[serde(rename = "dielectricConstraints")]
    pub dielectric_constraints: bool,
    ///Edge-card connector setting from `(edge_connector …)`; `none` when absent.
    #[serde(rename = "edgeConnector")]
    pub edge_connector: StackupEdgeConnector,
    ///Castellated pads, from `(castellated_pads yes)`. False when absent.
    #[serde(rename = "castellatedPads")]
    pub castellated_pads: bool,
    ///Plated board edge, from `(edge_plating yes)`. False when absent.
    #[serde(rename = "edgePlating")]
    pub edge_plating: bool,
}
/**Copper finish from `(copper_finish "…")`, as written (for example
`None`, `ENIG`, `HAL lead-free`). KiCad writes the literal `None` for no
finish. Absent when the token is not written or empty.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Copper finish from `(copper_finish \"…\")`, as written (for example\n`None`, `ENIG`, `HAL lead-free`). KiCad writes the literal `None` for no\nfinish. Absent when the token is not written or empty.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct StackupSettingsCopperFinish(::std::string::String);
impl ::std::ops::Deref for StackupSettingsCopperFinish {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<StackupSettingsCopperFinish> for ::std::string::String {
    fn from(value: StackupSettingsCopperFinish) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for StackupSettingsCopperFinish {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for StackupSettingsCopperFinish {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupSettingsCopperFinish {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupSettingsCopperFinish {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for StackupSettingsCopperFinish {
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
///A back drill or tertiary drill of a via: its diameter and the layers it removes copper between.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A back drill or tertiary drill of a via: its diameter and the layers it removes copper between.",
///  "type": "object",
///  "properties": {
///    "sizeNm": {
///      "description": "Drill diameter from the form's `(size <mm>)`, in nanometres. Absent when not written.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "startLayer": {
///      "description": "First layer of the form's `(layers \"<a>\" \"<b>\")`, as written. Absent when not written.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "stopLayer": {
///      "description": "Second layer of the form's `(layers \"<a>\" \"<b>\")`, as written. Absent when not written.",
///      "$ref": "#/$defs/LayerName"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct StackupViaDrill {
    ///Drill diameter from the form's `(size <mm>)`, in nanometres. Absent when not written.
    #[serde(
        rename = "sizeNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub size_nm: ::std::option::Option<NonNegativeNanometres>,
    ///First layer of the form's `(layers "<a>" "<b>")`, as written. Absent when not written.
    #[serde(
        rename = "startLayer",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub start_layer: ::std::option::Option<LayerName>,
    ///Second layer of the form's `(layers "<a>" "<b>")`, as written. Absent when not written.
    #[serde(
        rename = "stopLayer",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub stop_layer: ::std::option::Option<LayerName>,
}
impl ::std::default::Default for StackupViaDrill {
    fn default() -> Self {
        Self {
            size_nm: Default::default(),
            start_layer: Default::default(),
            stop_layer: Default::default(),
        }
    }
}
/**A group of vias that share a technology, a layer pair and back/tertiary
drilling. Via size and drill diameter are not part of the group.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A group of vias that share a technology, a layer pair and back/tertiary\ndrilling. Via size and drill diameter are not part of the group.",
///  "type": "object",
///  "required": [
///    "count",
///    "spanLayers",
///    "viaType"
///  ],
///  "properties": {
///    "backdrill": {
///      "description": "The vias' `(backdrill …)`. Absent when the vias have none, or one with\nneither a size nor layers.",
///      "$ref": "#/$defs/StackupViaDrill"
///    },
///    "count": {
///      "description": "Number of vias in the group, at least 1.",
///      "$ref": "#/$defs/StackupPositiveCount"
///    },
///    "spanLayers": {
///      "description": "The copper layers the vias cross, `startLayer` to `stopLayer` inclusive,\nin stack order from front to back as `copperLayers` orders them, whatever\nthe order of `startLayer` and `stopLayer`. Empty when either is absent or\nnot in `copperLayers`.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/LayerName"
///      }
///    },
///    "startLayer": {
///      "description": "First layer of the vias' `(layers \"<a>\" \"<b>\")`, as written. Absent when\nthe form names no layer.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "stopLayer": {
///      "description": "Second layer of the vias' `(layers \"<a>\" \"<b>\")`, as written. Absent\nwhen the form names fewer than two layers.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "tertiaryDrill": {
///      "description": "The vias' `(tertiary_drill …)`. Absent when the vias have none, or one\nwith neither a size nor layers.",
///      "$ref": "#/$defs/StackupViaDrill"
///    },
///    "viaType": {
///      "description": "Technology of every via in the group.",
///      "$ref": "#/$defs/StackupViaType"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct StackupViaSpan {
    ///Technology of every via in the group.
    #[serde(rename = "viaType")]
    pub via_type: StackupViaType,
    /**First layer of the vias' `(layers "<a>" "<b>")`, as written. Absent when
    the form names no layer.*/
    #[serde(
        rename = "startLayer",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub start_layer: ::std::option::Option<LayerName>,
    /**Second layer of the vias' `(layers "<a>" "<b>")`, as written. Absent
    when the form names fewer than two layers.*/
    #[serde(
        rename = "stopLayer",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub stop_layer: ::std::option::Option<LayerName>,
    /**The copper layers the vias cross, `startLayer` to `stopLayer` inclusive,
    in stack order from front to back as `copperLayers` orders them, whatever
    the order of `startLayer` and `stopLayer`. Empty when either is absent or
    not in `copperLayers`.*/
    #[serde(rename = "spanLayers")]
    pub span_layers: ::std::vec::Vec<LayerName>,
    /**The vias' `(backdrill …)`. Absent when the vias have none, or one with
    neither a size nor layers.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub backdrill: ::std::option::Option<StackupViaDrill>,
    /**The vias' `(tertiary_drill …)`. Absent when the vias have none, or one
    with neither a size nor layers.*/
    #[serde(
        rename = "tertiaryDrill",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub tertiary_drill: ::std::option::Option<StackupViaDrill>,
    ///Number of vias in the group, at least 1.
    pub count: StackupPositiveCount,
}
/**A via's technology: the bare header token of its `(via …)` form. KiCad
writes no token for a through via.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A via's technology: the bare header token of its `(via …)` form. KiCad\nwrites no token for a through via.",
///  "type": "string",
///  "enum": [
///    "through",
///    "blind",
///    "buried",
///    "micro"
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
pub enum StackupViaType {
    #[serde(rename = "through")]
    Through,
    #[serde(rename = "blind")]
    Blind,
    #[serde(rename = "buried")]
    Buried,
    #[serde(rename = "micro")]
    Micro,
}
impl ::std::fmt::Display for StackupViaType {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Through => f.write_str("through"),
            Self::Blind => f.write_str("blind"),
            Self::Buried => f.write_str("buried"),
            Self::Micro => f.write_str("micro"),
        }
    }
}
impl ::std::str::FromStr for StackupViaType {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "through" => Ok(Self::Through),
            "blind" => Ok(Self::Blind),
            "buried" => Ok(Self::Buried),
            "micro" => Ok(Self::Micro),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for StackupViaType {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for StackupViaType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for StackupViaType {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
