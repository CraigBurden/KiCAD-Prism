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
/**Per-net routing metrics of the project's board: routed centerline length,
via count, copper layers used and via layer pairs. Computed from the
top-level tracks (`segment` and `arc` forms) and vias (`via` forms) of the
project's board, exactly the effective configuration's `board`
(`config.board` in the manifest; never chosen by directory), as
committed: never the refilled board. Pads, zones,
zone fills and graphic shapes contribute nothing, even when they carry a
net. Design Comparison reads it for the route rows of a rerouted net
(route length, via count, used layers, via barrel length).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.route_metrics:a0",
///  "title": "RouteMetricsA0",
///  "description": "Per-net routing metrics of the project's board: routed centerline length,\nvia count, copper layers used and via layer pairs. Computed from the\ntop-level tracks (`segment` and `arc` forms) and vias (`via` forms) of the\nproject's board, exactly the effective configuration's `board`\n(`config.board` in the manifest; never chosen by directory), as\ncommitted: never the refilled board. Pads, zones,\nzone fills and graphic shapes contribute nothing, even when they carry a\nnet. Design Comparison reads it for the route rows of a rerouted net\n(route length, via count, used layers, via barrel length).",
///  "type": "object",
///  "required": [
///    "nets",
///    "schema"
///  ],
///  "properties": {
///    "nets": {
///      "description": "One entry per net that has at least one track or via on the board,\nsorted by `netName` in code point order; `netName` is unique. A net\nwith no track and no via is absent. Tracks and vias with no net (net 0,\na net code missing from the board's net table, an empty net name, or no\n`(net …)` form at all) belong to no entry and are not reported. Empty\nwhen no net is routed or the project has no board.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/RouteMetricsNet"
///      }
///    },
///    "schema": {
///      "description": "Schema id of this document.",
///      "type": "string",
///      "const": "prism.route_metrics.a0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RouteMetricsA0 {
    ///Schema id of this document.
    pub schema: ::std::string::String,
    /**One entry per net that has at least one track or via on the board,
    sorted by `netName` in code point order; `netName` is unique. A net
    with no track and no via is absent. Tracks and vias with no net (net 0,
    a net code missing from the board's net table, an empty net name, or no
    `(net …)` form at all) belong to no entry and are not reported. Empty
    when no net is routed or the project has no board.*/
    pub nets: ::std::vec::Vec<RouteMetricsNet>,
}
///Routing metrics of one net on the board.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Routing metrics of one net on the board.",
///  "type": "object",
///  "required": [
///    "netName",
///    "routeLengthNm",
///    "usedLayers",
///    "viaCount",
///    "viaSpans"
///  ],
///  "properties": {
///    "netName": {
///      "description": "KiCad full net name of the net's tracks and vias as the board resolves\nit: the name in the item's `(net \"<name>\")` form (KiCad 10), or the name\nthe board's net table gives the item's `(net <code>)` (KiCad 9 and\nearlier). Copied exactly: not trimmed, not re-cased.",
///      "$ref": "#/$defs/NetName"
///    },
///    "routeLengthNm": {
///      "description": "Routed centerline length of the net in nanometres: the sum, over the\nnet's tracks, of each `segment`'s straight start-to-end distance and\neach `arc`'s circular arc length through its start, mid and end points\n(the polyline start-mid-end when the three points are collinear). Summed\nin file order in IEEE double millimetres, then converted once with the\nconventions' rule (value_mm * 1e6, rounded half away from zero). The\narc's `hypot` and `atan2` are the pure-Rust `libm` crate's, so the total\nis the same on every architecture (conventions.md §14). One\ntotal over all layers; track widths, via barrels, pads and zones are not\nincluded. 0 when the net has vias but no track.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "usedLayers": {
///      "description": "Layers the net's copper is routed on, each once, sorted in code point\norder: the layer of every track (its `(layer …)`, or the copper entries\nof its `(layers …)` form when KiCad writes the plural form for a track\nwith a solder-mask opening), plus, for every via, every copper layer it\nspans: for a `(layers …)` form naming exactly two layers, both of them\nand every copper layer between them in the board's copper order (the\nsame order as `prism.stackup.a0` `copperLayers`: the stackup's copper\nentries when the board has a stackup, else the layer table's `.Cu` rows\nin file order), so a through via adds every copper layer; otherwise the\nlayers its form names. Empty only when every track and via of the net\nlacks a layer.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/LayerName"
///      }
///    },
///    "viaCount": {
///      "description": "Number of vias on the net, of every type (through, blind, buried,\nmicro). Includes vias whose `(layers …)` form does not name exactly two\nlayers, which `viaSpans` leaves out.",
///      "$ref": "#/$defs/Count"
///    },
///    "viaSpans": {
///      "description": "The net's vias grouped by layer pair, sorted by `startLayer`, then\n`stopLayer`, both in code point order; each pair appears once. Only vias\nwhose `(layers …)` form names exactly two layers are counted here, so\n`viaCount` minus the sum of `viaSpans[*].viaCount` is the number of the\nnet's vias that have no usable layer pair. Empty when the net has no\nsuch via.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/RouteMetricsViaSpan"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RouteMetricsNet {
    /**KiCad full net name of the net's tracks and vias as the board resolves
    it: the name in the item's `(net "<name>")` form (KiCad 10), or the name
    the board's net table gives the item's `(net <code>)` (KiCad 9 and
    earlier). Copied exactly: not trimmed, not re-cased.*/
    #[serde(rename = "netName")]
    pub net_name: NetName,
    /**Routed centerline length of the net in nanometres: the sum, over the
    net's tracks, of each `segment`'s straight start-to-end distance and
    each `arc`'s circular arc length through its start, mid and end points
    (the polyline start-mid-end when the three points are collinear). Summed
    in file order in IEEE double millimetres, then converted once with the
    conventions' rule (value_mm * 1e6, rounded half away from zero). The
    arc's `hypot` and `atan2` are the pure-Rust `libm` crate's, so the total
    is the same on every architecture (conventions.md §14). One
    total over all layers; track widths, via barrels, pads and zones are not
    included. 0 when the net has vias but no track.*/
    #[serde(rename = "routeLengthNm")]
    pub route_length_nm: NonNegativeNanometres,
    /**Number of vias on the net, of every type (through, blind, buried,
    micro). Includes vias whose `(layers …)` form does not name exactly two
    layers, which `viaSpans` leaves out.*/
    #[serde(rename = "viaCount")]
    pub via_count: Count,
    /**Layers the net's copper is routed on, each once, sorted in code point
    order: the layer of every track (its `(layer …)`, or the copper entries
    of its `(layers …)` form when KiCad writes the plural form for a track
    with a solder-mask opening), plus, for every via, every copper layer it
    spans: for a `(layers …)` form naming exactly two layers, both of them
    and every copper layer between them in the board's copper order (the
    same order as `prism.stackup.a0` `copperLayers`: the stackup's copper
    entries when the board has a stackup, else the layer table's `.Cu` rows
    in file order), so a through via adds every copper layer; otherwise the
    layers its form names. Empty only when every track and via of the net
    lacks a layer.*/
    #[serde(rename = "usedLayers")]
    pub used_layers: ::std::vec::Vec<LayerName>,
    /**The net's vias grouped by layer pair, sorted by `startLayer`, then
    `stopLayer`, both in code point order; each pair appears once. Only vias
    whose `(layers …)` form names exactly two layers are counted here, so
    `viaCount` minus the sum of `viaSpans[*].viaCount` is the number of the
    net's vias that have no usable layer pair. Empty when the net has no
    such via.*/
    #[serde(rename = "viaSpans")]
    pub via_spans: ::std::vec::Vec<RouteMetricsViaSpan>,
}
///A via count within one via span: at least 1, because a span is listed only when one of the net's vias has that layer pair.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A via count within one via span: at least 1, because a span is listed only when one of the net's vias has that layer pair.",
///  "type": "integer",
///  "minimum": 1.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RouteMetricsSpanCount(pub ::std::num::NonZeroU64);
impl ::std::ops::Deref for RouteMetricsSpanCount {
    type Target = ::std::num::NonZeroU64;
    fn deref(&self) -> &::std::num::NonZeroU64 {
        &self.0
    }
}
impl ::std::convert::From<RouteMetricsSpanCount> for ::std::num::NonZeroU64 {
    fn from(value: RouteMetricsSpanCount) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::num::NonZeroU64> for RouteMetricsSpanCount {
    fn from(value: ::std::num::NonZeroU64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for RouteMetricsSpanCount {
    type Err = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for RouteMetricsSpanCount {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for RouteMetricsSpanCount {
    type Error = <::std::num::NonZeroU64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for RouteMetricsSpanCount {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**The vias of one net that share one layer pair, as their `(layers …)` form
names it. The layers between the pair follow from the board's stackup.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The vias of one net that share one layer pair, as their `(layers …)` form\nnames it. The layers between the pair follow from the board's stackup.",
///  "type": "object",
///  "required": [
///    "startLayer",
///    "stopLayer",
///    "viaCount"
///  ],
///  "properties": {
///    "startLayer": {
///      "description": "First layer of the via's `(layers …)` form, as written. KiCad writes the\nlayer nearer the front first, so for a through via this is `F.Cu`.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "stopLayer": {
///      "description": "Second layer of the via's `(layers …)` form, as written: for a through\nvia `B.Cu`, for a blind or micro via the inner layer it ends on.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "viaCount": {
///      "description": "Number of the net's vias with exactly this layer pair, in this order.",
///      "$ref": "#/$defs/RouteMetricsSpanCount"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RouteMetricsViaSpan {
    /**First layer of the via's `(layers …)` form, as written. KiCad writes the
    layer nearer the front first, so for a through via this is `F.Cu`.*/
    #[serde(rename = "startLayer")]
    pub start_layer: LayerName,
    /**Second layer of the via's `(layers …)` form, as written: for a through
    via `B.Cu`, for a blind or micro via the inner layer it ends on.*/
    #[serde(rename = "stopLayer")]
    pub stop_layer: LayerName,
    ///Number of the net's vias with exactly this layer pair, in this order.
    #[serde(rename = "viaCount")]
    pub via_count: RouteMetricsSpanCount,
}
