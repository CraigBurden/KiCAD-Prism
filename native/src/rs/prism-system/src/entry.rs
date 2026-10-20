//! A placed published entry read as a board (`docs/system-builder/CONTRACTS.md`
//! §12.2): its exports are its connectors, and each export pin's board net is
//! the child system net it is on. Two pins of the entry then join exactly when
//! the child bundle puts them on one net, as a board's pins join by a board net.
//!
//! Its exports' connectors carry the child's geometry (`placement.exports`,
//! §8.9) at their mounts, as a body's connectors do, so a mate with an entry
//! derives its mapping and places the entry as one rigid group. The entry's
//! box is the box around its contents where the child placed them.

use crate::input::{
    Board, EntryFacts, InterfaceComponent, InterfacePin, MountFacts, SemanticFacts, SystemInterface,
};
use crate::placement::frames::ConnectorGeometry;
use crate::placement::poses::{Bounds, Pose, canonical_rotation, transform_bounds, union};
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

const NM_PER_MM: f64 = 1_000_000.0;

fn vector_mm(value: &Value) -> Option<[f64; 3]> {
    Some([
        value["xNm"].as_i64()? as f64 / NM_PER_MM,
        value["yNm"].as_i64()? as f64 / NM_PER_MM,
        value["zNm"].as_i64()? as f64 / NM_PER_MM,
    ])
}

fn pose(value: &Value) -> Option<Pose> {
    let q = &value["rotation"];
    Some(Pose {
        translation_mm: vector_mm(&value["translation"])?,
        rotation: canonical_rotation([
            q["x"].as_f64()?,
            q["y"].as_f64()?,
            q["z"].as_f64()?,
            q["w"].as_f64()?,
        ]),
    })
}

/// The box around every placed occurrence's box in the child's frame.
fn contents_bounds(placement: &Value) -> Option<Bounds> {
    let boxes: Vec<Option<Bounds>> = placement["occurrences"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|placed| {
            let bounds = Bounds {
                min_mm: vector_mm(&placed["bounds"]["min"])?,
                max_mm: vector_mm(&placed["bounds"]["max"])?,
            };
            transform_bounds(&pose(&placed["pose"])?, Some(&bounds))
        })
        .collect();
    union(&boxes)
}

/// Each export's geometry and mount, by export id, from `placement.exports`.
fn placed_exports(placement: &Value) -> BTreeMap<String, (ConnectorGeometry, Pose, bool)> {
    placement["exports"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|placed| {
            let geometry = serde_json::from_value(placed["geometry"].clone()).ok()?;
            let mount = pose(&placed["mount"])?;
            let top = placed["matesTop"].as_bool() == Some(true);
            Some((text(&placed["export"]), (geometry, mount, top)))
        })
        .collect()
}

/// The board a validated `prism.system_entry.a0` payload reads as, and its facts.
pub fn board(payload: &Value, stage: &str) -> (Board, EntryFacts) {
    let exports: Vec<Value> = payload["interface"]["exports"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let power = power_pins(&payload["bundle"]);
    let names = board_nets(&exports);
    let placement = &payload["bundle"]["placement"];
    let mut placed = placed_exports(placement);
    let mut mount = MountFacts {
        bounds: contents_bounds(placement),
        ..MountFacts::default()
    };
    let components = exports
        .iter()
        .map(|export| {
            let site = (text(&export["occurrence"]), text(&export["connector"]));
            let id = text(&export["id"]);
            let geometry = placed.remove(&id).map(|(geometry, pose, top)| {
                mount.mounts.insert(id.clone(), pose);
                if top {
                    mount.mates_top.insert(id.clone());
                }
                geometry
            });
            InterfaceComponent {
                reference: id,
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
                geometry,
            }
        })
        .collect();
    let system_bundle_key = text(&payload["source"]["systemBundleKey"]);
    let board = Board {
        revision_key: String::new(),
        bundle_key: system_bundle_key.clone(),
        interface: SystemInterface {
            board_outline_mm: None,
            // Exports' geometry reads at zero thickness at its mounts.
            board_thickness_mm: Some(0.0),
            components,
        },
        semantic: SemanticFacts::default(),
    };
    let facts = EntryFacts {
        stage: stage.to_owned(),
        system_bundle_key,
        mount,
    };
    (board, facts)
}
