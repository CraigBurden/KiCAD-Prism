//! What a system build reads: the parts of the `prism.system.v2` document the
//! connectivity rules use, and each ready board's two design-bundle members
//! (`docs/system-builder/CONTRACTS.md` §8.1).
//!
//! The CLI validates the document against its schema before this runs, so
//! these types read only the fields they need and ignore the rest.

use crate::placement::frames::ConnectorGeometry;
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};

// ------------------------------------------------------------------ document

/// The document, as far as stage 1b reads it.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    /// Occurrences, in id order.
    #[serde(default)]
    pub occurrences: Vec<Occurrence>,
    /// Occurrence-level sub-ports.
    #[serde(default)]
    pub sub_ports: Vec<SubPort>,
    /// Dismissed suggestions.
    #[serde(default)]
    pub dismissed_suggestions: Vec<DismissedSuggestion>,
    /// B2B mates.
    #[serde(default)]
    pub mates: Vec<Mate>,
    /// Harness blocks.
    #[serde(default)]
    pub harnesses: Vec<Harness>,
    /// Exports.
    #[serde(default)]
    pub exports: Vec<Export>,
    /// Waivers.
    #[serde(default)]
    pub waivers: Vec<Waiver>,
}

/// One occurrence.
#[derive(Clone, Debug, Deserialize)]
pub struct Occurrence {
    /// Its id.
    pub id: String,
    /// Its label.
    pub label: String,
    /// What it places.
    pub source: Source,
}

/// What an occurrence places; only the kind matters here.
#[derive(Clone, Debug, Deserialize)]
pub struct Source {
    /// `board`, `entry` or `body`.
    pub kind: String,
}

/// A sub-port reference on an endpoint.
#[derive(Clone, Debug, Deserialize)]
pub struct SubPortRef {
    /// `occurrence` or `board`.
    pub kind: String,
    /// The sub-port's id.
    pub id: String,
}

/// A connector, or a sub-port of one, on one occurrence.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Endpoint {
    /// The occurrence.
    pub occurrence: String,
    /// The connector's reference designator.
    pub connector: String,
    /// The sub-port; `None` means the whole connector.
    #[serde(default)]
    pub sub_port: Option<SubPortRef>,
}

/// An occurrence-level sub-port.
#[derive(Clone, Debug, Deserialize)]
pub struct SubPort {
    /// Its id.
    pub id: String,
    /// The occurrence.
    pub occurrence: String,
    /// The connector.
    pub connector: String,
    /// Pads in the user's order.
    pub pins: Vec<String>,
    /// The suggestion key it was accepted from.
    #[serde(default)]
    pub suggestion: Option<String>,
}

/// A dismissed suggestion.
#[derive(Clone, Debug, Deserialize)]
pub struct DismissedSuggestion {
    /// The occurrence.
    pub occurrence: String,
    /// The connector.
    pub connector: String,
    /// The suggestion key.
    pub key: String,
}

/// A B2B mate's orientation.
#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Orientation {
    /// Quarter turns of B about the mating axis.
    pub quarter_turns: i32,
    /// Whether B mates on its frame flipped over its x axis.
    pub flip: bool,
}

/// One pair of a manual mapping.
#[derive(Clone, Debug, Deserialize)]
pub struct PadPair {
    /// The pad on side A.
    pub a: String,
    /// The pad on side B.
    pub b: String,
}

/// A B2B mate.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mate {
    /// Its id.
    pub id: String,
    /// Side A.
    pub a: Endpoint,
    /// Side B.
    pub b: Endpoint,
    /// The orientation.
    pub orientation: Orientation,
    /// The manual override, when present.
    #[serde(default)]
    pub manual_map: Option<Vec<PadPair>>,
}

/// A housing cavity and the board pad it lands on.
#[derive(Clone, Debug, Deserialize)]
pub struct CavityPad {
    /// The cavity.
    pub cavity: String,
    /// The board pad.
    pub pad: String,
}

/// A harness end.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct End {
    /// Its id.
    pub id: String,
    /// The mating site; `None` when not attached yet.
    #[serde(default)]
    pub site: Option<Endpoint>,
    /// Cavity-to-pad pairs; empty means cavity n is pad n.
    #[serde(default)]
    pub pin_map: Vec<CavityPad>,
}

/// A schematic harness wire between two endpoints.
#[derive(Clone, Debug, Deserialize)]
pub struct Link {
    /// Its id.
    pub id: String,
    /// Side A.
    pub a: Endpoint,
    /// Side B.
    pub b: Endpoint,
    /// Side A pads cleared from the default wiring.
    #[serde(default)]
    pub unmapped: Vec<String>,
}

/// Where one end of a wire terminates.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Terminal {
    /// `contact`, `splice` or `loose`.
    pub kind: String,
    /// The end, for a contact.
    #[serde(default)]
    pub end: Option<String>,
    /// The cavity, for a contact.
    #[serde(default)]
    pub cavity: Option<String>,
    /// The splice, for a splice terminal.
    #[serde(default)]
    pub splice: Option<String>,
}

/// An explicit wire.
#[derive(Clone, Debug, Deserialize)]
pub struct Wire {
    /// Its id.
    pub id: String,
    /// One terminal.
    pub from: Terminal,
    /// The other terminal.
    pub to: Terminal,
    /// The link whose default wire it replaces.
    #[serde(default)]
    pub link: Option<String>,
}

/// A splice.
#[derive(Clone, Debug, Deserialize)]
pub struct Splice {
    /// Its id.
    pub id: String,
    /// Whether the user confirmed it.
    pub confirmed: bool,
}

/// A harness block, as far as connectivity reads it.
#[derive(Clone, Debug, Deserialize)]
pub struct Harness {
    /// Its id.
    pub id: String,
    /// Its label.
    pub label: String,
    /// Ends.
    #[serde(default)]
    pub ends: Vec<End>,
    /// Links.
    #[serde(default)]
    pub links: Vec<Link>,
    /// Explicit wires.
    #[serde(default)]
    pub wires: Vec<Wire>,
    /// Splices.
    #[serde(default)]
    pub splices: Vec<Splice>,
}

/// An export.
#[derive(Clone, Debug, Deserialize)]
pub struct Export {
    /// Its id.
    pub id: String,
    /// The connector or sub-port exported.
    pub site: Endpoint,
}

/// A waiver.
#[derive(Clone, Debug, Deserialize)]
pub struct Waiver {
    /// The finding code.
    pub code: String,
    /// The finding's subject.
    pub subject: String,
}

// --------------------------------------------------------------------- boards

/// One pin of a component in `projections/system-interface.json`.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterfacePin {
    /// The pad number.
    pub pad: String,
    /// Schematic nets.
    #[serde(default)]
    pub nets: Vec<String>,
    /// Pin names, or `None`.
    #[serde(default)]
    pub pin_names: Option<Vec<String>>,
    /// Pin types, or `None`.
    #[serde(default)]
    pub pin_types: Option<Vec<String>>,
    /// Whether the pin is on a power net.
    #[serde(default)]
    pub power_net: bool,
}

/// One component of `projections/system-interface.json`.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterfaceComponent {
    /// The reference designator.
    pub reference: String,
    /// The value.
    #[serde(default)]
    pub value: String,
    /// The MPN, or `None`.
    #[serde(default)]
    pub mpn: Option<String>,
    /// Whether connector detection marks it a connector.
    #[serde(default)]
    pub candidate: bool,
    /// Pins.
    #[serde(default)]
    pub pins: Vec<InterfacePin>,
    /// Footprint geometry, or `None` without a board.
    #[serde(default)]
    pub geometry: Option<ConnectorGeometry>,
}

/// `projections/system-interface.json`, as far as a system build reads it.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInterface {
    /// Board thickness in mm, or `None` without a board.
    #[serde(default)]
    pub board_thickness_mm: Option<f64>,
    /// Components.
    #[serde(default)]
    pub components: Vec<InterfaceComponent>,
}

/// A bus alias of `projections/semantic-index.json`.
#[derive(Clone, Debug, Default)]
pub struct BusAlias {
    /// The alias name.
    pub name: String,
    /// Its member names.
    pub members: Vec<String>,
}

/// What a system build reads of `projections/semantic-index.json`.
#[derive(Clone, Debug, Default)]
pub struct SemanticFacts {
    /// Bus aliases.
    pub bus_aliases: Vec<BusAlias>,
    /// Each net's source sheets (sheet name paths), by net name.
    pub net_sheets: BTreeMap<String, BTreeSet<String>>,
}

impl SemanticFacts {
    /// Read the facts from the member's JSON; fields it lacks are empty.
    pub fn from_value(index: &serde_json::Value) -> Self {
        let mut facts = Self::default();
        for bus in index["buses"].as_array().into_iter().flatten() {
            if bus["kind"] == "bus_alias" {
                facts.bus_aliases.push(BusAlias {
                    name: bus["name"].as_str().unwrap_or_default().to_owned(),
                    members: strings(&bus["members"]),
                });
            }
        }
        for net in index["nets"].as_array().into_iter().flatten() {
            let Some(name) = net["name"].as_str() else {
                continue;
            };
            let sheets: BTreeSet<String> = strings(&net["sourceSheets"]).into_iter().collect();
            if !sheets.is_empty() {
                facts.net_sheets.insert(name.to_owned(), sheets);
            }
        }
        facts
    }
}

fn strings(value: &serde_json::Value) -> Vec<String> {
    value
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|item| item.as_str().map(str::to_owned))
        .collect()
}

/// A ready board occurrence's facts.
#[derive(Clone, Debug)]
pub struct Board {
    /// The revision key it was read at.
    pub revision_key: String,
    /// The design bundle read.
    pub bundle_key: String,
    /// Its system interface.
    pub interface: SystemInterface,
    /// Its semantic facts.
    pub semantic: SemanticFacts,
}

impl Board {
    /// A component by reference.
    pub fn component(&self, refdes: &str) -> Option<&InterfaceComponent> {
        self.interface
            .components
            .iter()
            .find(|component| component.reference == refdes)
    }
}

/// Everything a build reads besides the document.
#[derive(Clone, Debug, Default)]
pub struct Members {
    /// Ready board occurrences, by occurrence id.
    pub boards: BTreeMap<String, Board>,
    /// Board occurrences whose project is absent at their commit.
    pub absent: BTreeSet<String>,
}
