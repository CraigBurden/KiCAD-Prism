//! Schematic pins and net normalization, a port of `_schematic_pins` and
//! `normalized_nets` (interface_extractor.py:47-49, :127-145).
//!
//! The nets, pin names and pin types come from the typed schematic netlist
//! (`schematic.facts.netlist()`), which is the compiled netlist before any
//! board overlay — the same source today reads through `design.to_netlist()`.

use prism_kicad_core::KiCadNetlist;
use std::collections::{BTreeSet, HashMap};

/// KiCad's unconnected-placeholder prefix (`_UNCONNECTED_PREFIX`,
/// interface_extractor.py:39).
pub(super) const UNCONNECTED_PREFIX: &str = "unconnected-(";

/// The net names, pin names and pin types seen on one `(reference, pad)`.
#[derive(Debug, Default)]
pub(super) struct PinEntry {
    pub(super) nets: BTreeSet<String>,
    pub(super) names: BTreeSet<String>,
    pub(super) types: BTreeSet<String>,
}

/// `_schematic_pins(netlist)` (interface_extractor.py:127-145):
/// `reference → pad → {nets, names, types}`. A terminal with an empty
/// designator or pin is skipped; virtual (`#`) designators are not terminals.
pub(super) fn schematic_pins(netlist: &KiCadNetlist) -> HashMap<String, HashMap<String, PinEntry>> {
    let mut pins: HashMap<String, HashMap<String, PinEntry>> = HashMap::new();
    for net in &netlist.nets {
        for terminal in &net.terminals {
            if terminal.designator.is_empty() || terminal.pin.is_empty() {
                continue;
            }
            let entry = pins
                .entry(terminal.designator.clone())
                .or_default()
                .entry(terminal.pin.clone())
                .or_default();
            entry.nets.insert(net.name.clone());
            if !terminal.pin_name.is_empty() {
                entry.names.insert(terminal.pin_name.clone());
            }
            if !terminal.pin_type.is_empty() {
                entry.types.insert(terminal.pin_type.clone());
            }
        }
    }
    pins
}

/// `normalized_nets(names)` (interface_extractor.py:47-49): the unique
/// non-empty names without the `unconnected-(…)` placeholders, sorted in code
/// point order (`BTreeSet` iteration order).
pub(super) fn normalized_nets<'a>(names: impl IntoIterator<Item = &'a String>) -> Vec<String> {
    names
        .into_iter()
        .filter(|name| !name.is_empty() && !name.starts_with(UNCONNECTED_PREFIX))
        .cloned()
        .collect()
}
