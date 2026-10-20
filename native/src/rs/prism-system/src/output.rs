//! The `prism.system_bundle.a0` document as written (`native/src/tsp/prism/system-bundle-a0.tsp`).
//!
//! Field order is the TypeSpec's, so serde writes keys in contract order
//! (conventions.md §13). Absent optional fields are skipped.

use serde::Serialize;

/// Schema id of the document.
pub const SCHEMA: &str = "prism.system_bundle.a0";

/// The system bundle.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemBundle {
    /// `prism.system_bundle.a0`.
    pub schema: &'static str,
    /// SHA-256 of the document's canonical JSON.
    pub document_sha256: String,
    /// Occurrences, by id.
    pub occurrences: Vec<OccurrenceOut>,
    /// System nets, by id.
    pub nets: Vec<NetOut>,
    /// B2B mappings, by mate id.
    pub mates: Vec<MateOut>,
    /// Harness link wirings, by harness then link.
    pub links: Vec<LinkOut>,
    /// Proposed splices.
    pub splices: Vec<SpliceOut>,
    /// Sub-port suggestions.
    pub suggestions: Vec<SuggestionOut>,
    /// Findings, by code then subject.
    pub findings: Vec<FindingOut>,
}

/// One pin of a connector.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PinOut {
    /// The pad number.
    pub pad: String,
    /// The first schematic net.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub net: Option<String>,
    /// Every schematic net, in code point order.
    pub nets: Vec<String>,
    /// The first pin name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pin_name: Option<String>,
    /// The first pin type.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pin_type: Option<String>,
    /// Whether the pin is power or ground.
    pub power: bool,
}

/// One connector of a board occurrence.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectorOut {
    /// The reference designator.
    pub refdes: String,
    /// The value.
    pub value: String,
    /// The MPN.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mpn: Option<String>,
    /// Whether detection marks it a connector.
    pub candidate: bool,
    /// Where it sits on the board, when the board has an outline (§8.2).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placement: Option<PlacementOut>,
    /// Pins in natural pad order.
    pub pins: Vec<PinOut>,
}

/// A connector's angle from the board outline's centre and its side (§8.2).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacementOut {
    /// Degrees counter-clockwise from +x, +y up, in [0, 360).
    pub angle_deg: f64,
    /// `top` or `bottom`.
    pub side: &'static str,
}

/// A board outline's bounding box (§8.2).
#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineOut {
    /// Width in nanometres.
    pub width_nm: i64,
    /// Height in nanometres.
    pub height_nm: i64,
}

/// One occurrence.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OccurrenceOut {
    /// The occurrence id.
    pub occurrence: String,
    /// `ready`, `pending`, `absent` or `unsupported`.
    pub state: &'static str,
    /// The revision key, when ready.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revision_key: Option<String>,
    /// The design bundle key, when ready.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bundle_key: Option<String>,
    /// The board outline's bounding box, when ready with an outline.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outline: Option<OutlineOut>,
    /// Connectors in natural reference order.
    pub connectors: Vec<ConnectorOut>,
}

/// A connector pin of the system.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub struct PinRef {
    /// The occurrence.
    pub occurrence: String,
    /// The connector.
    pub connector: String,
    /// The pad.
    pub pad: String,
}

/// A board net in a system net.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub struct BoardNetOut {
    /// The occurrence.
    pub occurrence: String,
    /// The board net name.
    pub net: String,
}

/// One system net.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetOut {
    /// `net-` and 16 hexadecimal digits.
    pub id: String,
    /// The display name.
    pub name: String,
    /// Every distinct board net name.
    pub names: Vec<String>,
    /// Board nets.
    pub board_nets: Vec<BoardNetOut>,
    /// Pins.
    pub pins: Vec<PinRef>,
}

/// One pin pair.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PairOut {
    /// The pad on side A.
    pub a: String,
    /// The pad on side B.
    pub b: String,
}

/// One B2B mapping.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MateOut {
    /// The mate id.
    pub mate: String,
    /// `geometry`, `manual` or `unresolved`.
    pub source: &'static str,
    /// Pin pairs, by side A pad.
    pub pairs: Vec<PairOut>,
    /// Side A pads without a partner.
    pub unmapped_a: Vec<String>,
    /// Side B pads without a partner.
    pub unmapped_b: Vec<String>,
}

/// One wire of a link's wiring.
#[derive(Clone, Debug, Serialize)]
pub struct WireOut {
    /// The pad on side A.
    pub a: String,
    /// The pad on side B.
    pub b: String,
    /// `explicit`, `sub-port-order` or `net-name`.
    pub rule: &'static str,
    /// Whether it joins power or ground pins.
    pub suggested: bool,
}

/// One link's wiring.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkOut {
    /// The harness.
    pub harness: String,
    /// The link.
    pub link: String,
    /// Wires, by side A pad.
    pub wires: Vec<WireOut>,
    /// Side A pins left unmapped.
    pub unmapped_a: Vec<String>,
    /// Side B pins left unmapped.
    pub unmapped_b: Vec<String>,
}

/// A proposed splice.
#[derive(Clone, Debug, Serialize)]
pub struct SpliceOut {
    /// The harness.
    pub harness: String,
    /// The end.
    pub end: String,
    /// The pad.
    pub pad: String,
    /// The links that wire it.
    pub links: Vec<String>,
}

/// A sub-port suggestion.
#[derive(Clone, Debug, Serialize)]
pub struct SuggestionOut {
    /// The occurrence.
    pub occurrence: String,
    /// The connector.
    pub connector: String,
    /// The stable key.
    pub key: String,
    /// The suggested name.
    pub name: String,
    /// `bus-alias`, `sheet`, `family` or `power`.
    pub source: &'static str,
    /// Pads in natural order.
    pub pins: Vec<String>,
}

/// One finding.
#[derive(Clone, Debug, Serialize)]
pub struct FindingOut {
    /// The code.
    pub code: &'static str,
    /// `error`, `warning` or `info`.
    pub severity: &'static str,
    /// The waiver subject.
    pub subject: String,
    /// One sentence for people.
    pub message: String,
    /// Document ids involved.
    pub objects: Vec<String>,
    /// Whether a waiver covers it.
    pub waived: bool,
}
