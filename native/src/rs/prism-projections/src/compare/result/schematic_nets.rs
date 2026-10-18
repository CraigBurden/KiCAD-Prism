//! The schematic view of the semantic index's nets (field map
//! `semantic-index.md` D7). The member reconciles split nets
//! (`semantic_index/reconcile.rs`): a board net absorbs each schematic net
//! whose pins sit on it, keeps its board name, and takes the schematic name,
//! that net's aliases and its schematic refs. Today's comparison builds a
//! schematic-only index and never reconciles, so it sees each schematic net
//! under its own name. Connectivity pairs nets by their terminals'
//! `schematicNetName`; a merged net under its board name finds none of them,
//! and reads as "no connections" with no rename (C2r step 7 gate:
//! `obc-F0-F8`, `synthetic-usbpd`).
//!
//! [`split`] puts each merged board net back as the schematic nets it absorbed,
//! in the board net's place:
//! - a merged net is one whose name is no terminal's `schematicNetName` while
//!   an alias is;
//! - its aliases are, in absorption order, each absorbed name followed by that
//!   net's own aliases (`absorb_aliases`), so each schematic name starts a run;
//! - its schematic refs go to the schematic net their pins are on; a ref with
//!   no pins goes with the ref before it (the first net's, at the start), since
//!   each absorbed net's refs were appended as one block;
//! - each split net is named by its schematic name, with
//!   `stable_uid("net", [name])` as its uid, as the schematic-only index has.

use crate::semantic_index::stable_uid;
use prism_kicad_contracts::generated::prism_semantic_index_a2::{
    NetName, SemanticIndexA2, SemanticIndexNet, SemanticIndexNetSchematicRef, SemanticIndexNetUid,
};
use std::collections::{HashMap, HashSet};

/// Replace every merged board net of `index` by the schematic nets it absorbed.
pub(super) fn split(index: &mut SemanticIndexA2) {
    let names: HashSet<String> = index
        .terminals
        .iter()
        .filter_map(|terminal| terminal.schematic_net_name.as_ref())
        .map(|name| name.as_str().to_owned())
        .collect();
    if !index.nets.iter().any(|net| merged(net, &names)) {
        return;
    }
    let net_of_pin: HashMap<String, String> = index
        .terminals
        .iter()
        .filter_map(|terminal| {
            let name = terminal.schematic_net_name.as_ref()?;
            let pin = terminal.schematic_pin_uuid.as_ref()?;
            Some((pin.as_str().to_owned(), name.as_str().to_owned()))
        })
        .collect();
    let nets = std::mem::take(&mut index.nets);
    for net in nets {
        if merged(&net, &names) {
            index.nets.extend(schematic_nets(net, &names, &net_of_pin));
        } else {
            index.nets.push(net);
        }
    }
}

/// A board net that absorbed schematic nets: its name is no schematic net's,
/// and an alias is.
fn merged(net: &SemanticIndexNet, names: &HashSet<String>) -> bool {
    !names.contains(net.name.as_str())
        && net
            .aliases
            .iter()
            .flatten()
            .any(|alias| names.contains(alias.as_str()))
}

/// The schematic nets one merged board net absorbed, in absorption order.
fn schematic_nets(
    net: SemanticIndexNet,
    names: &HashSet<String>,
    net_of_pin: &HashMap<String, String>,
) -> Vec<SemanticIndexNet> {
    // Each absorbed name starts a run of its own aliases.
    let mut runs: Vec<(NetName, Vec<NetName>)> = Vec::new();
    for alias in net.aliases.iter().flatten() {
        if names.contains(alias.as_str()) {
            runs.push((alias.clone(), Vec::new()));
        } else if let Some((_, aliases)) = runs.last_mut() {
            aliases.push(alias.clone());
        }
    }
    let position: HashMap<&str, usize> = runs
        .iter()
        .enumerate()
        .map(|(index, (name, _))| (name.as_str(), index))
        .collect();
    let mut refs: Vec<Vec<SemanticIndexNetSchematicRef>> = vec![Vec::new(); runs.len()];
    let mut owner = 0;
    for reference in &net.schematic_refs {
        if let Some(&found) = reference.pin_uuids.iter().find_map(|pin| {
            net_of_pin
                .get(pin.as_str())
                .and_then(|name| position.get(name.as_str()))
        }) {
            owner = found;
        }
        refs[owner].push(reference.clone());
    }
    runs.into_iter()
        .zip(refs)
        .map(|((name, mut aliases), schematic_refs)| {
            aliases.sort_by(|a, b| a.as_str().cmp(b.as_str()));
            SemanticIndexNet {
                net_uid: SemanticIndexNetUid(stable_uid("net", &[name.as_str()])),
                name,
                aliases: Some(aliases),
                schematic_refs,
                ..net.clone()
            }
        })
        .collect()
}

#[cfg(test)]
mod tests;
