//! A placed published entry read as a board (`docs/system-builder/CONTRACTS.md`
//! §12.2): its exports are its connectors, and each export pin's board net is
//! the child system net it is on. Two pins of the entry then join exactly when
//! the child bundle puts them on one net, as a board's pins join by a board net.

use crate::input::{
    Board, EntryFacts, InterfaceComponent, InterfacePin, SemanticFacts, SystemInterface,
};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

fn text(value: &Value) -> String {
    value.as_str().unwrap_or_default().to_owned()
}

/// Whether the child bundle marks a pin as power: `(occurrence, connector, pad)`.
fn power_pins(bundle: &Value) -> BTreeSet<(String, String, String)> {
    let mut power = BTreeSet::new();
    for occurrence in bundle["occurrences"].as_array().into_iter().flatten() {
        for connector in occurrence["connectors"].as_array().into_iter().flatten() {
            for pin in connector["pins"].as_array().into_iter().flatten() {
                if pin["power"].as_bool() == Some(true) {
                    power.insert((
                        text(&occurrence["occurrence"]),
                        text(&connector["refdes"]),
                        text(&pin["pad"]),
                    ));
                }
            }
        }
    }
    power
}

/// The board net an export pin carries: the child net's signal, or its id when
/// it has none. A signal two child nets share is qualified with the net id, so
/// distinct child nets never join.
fn board_nets(exports: &[Value]) -> BTreeMap<String, String> {
    let mut nets_of_signal: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for pin in exports
        .iter()
        .flat_map(|export| export["pins"].as_array().into_iter().flatten())
    {
        if let Some(signal) = pin["signal"].as_str() {
            nets_of_signal
                .entry(signal.to_owned())
                .or_default()
                .insert(text(&pin["net"]));
        }
    }
    let mut names = BTreeMap::new();
    for pin in exports
        .iter()
        .flat_map(|export| export["pins"].as_array().into_iter().flatten())
    {
        let net = text(&pin["net"]);
        let name = match pin["signal"].as_str() {
            Some(signal) if nets_of_signal[signal].len() == 1 => signal.to_owned(),
            Some(signal) => format!("{signal} ({net})"),
            None => net.clone(),
        };
        names.insert(net, name);
    }
    names
}

/// The board a validated `prism.system_entry.a0` payload reads as, and its facts.
pub fn board(payload: &Value, stage: &str) -> (Board, EntryFacts) {
    let exports: Vec<Value> = payload["interface"]["exports"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let power = power_pins(&payload["bundle"]);
    let names = board_nets(&exports);
    let components = exports
        .iter()
        .map(|export| {
            let site = (text(&export["occurrence"]), text(&export["connector"]));
            InterfaceComponent {
                reference: text(&export["id"]),
                value: text(&export["name"]),
                mpn: None,
                candidate: true,
                pins: export["pins"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .map(|pin| {
                        let pad = text(&pin["pad"]);
                        InterfacePin {
                            nets: vec![names[&text(&pin["net"])].clone()],
                            pin_names: Some(vec![text(&pin["name"])]),
                            pin_types: None,
                            power_net: power.contains(&(
                                site.0.clone(),
                                site.1.clone(),
                                pad.clone(),
                            )),
                            pad,
                        }
                    })
                    .collect(),
                geometry: None,
            }
        })
        .collect();
    let system_bundle_key = text(&payload["source"]["systemBundleKey"]);
    let board = Board {
        revision_key: String::new(),
        bundle_key: system_bundle_key.clone(),
        interface: SystemInterface {
            board_thickness_mm: None,
            components,
        },
        semantic: SemanticFacts::default(),
    };
    let facts = EntryFacts {
        stage: stage.to_owned(),
        system_bundle_key,
    };
    (board, facts)
}
