//! Placed-symbol occurrences grouped by reference, a port of `_occurrences`
//! (interface_extractor.py:95-124).
//!
//! Today's `design.schematic_instances()` is the fork's
//! `SchematicBundleIndex::occurrences` (pre-order, one per realized sheet
//! placement); each occurrence's `occurrence_address` is kicad_monkey's
//! `sheet_instance_path` (`semantic_index/sheets.rs`). For each symbol of the
//! occurrence's definition with a `lib_id`, the `(instances …)` entry whose
//! `path` equals that sheet path gives the reference and unit.

use prism_kicad_core::SchematicBundleIndex;
use std::collections::HashMap;

/// One placed symbol's occurrence: its unit, its key (`sheet path + symbol
/// uuid`) and its `lib_id`. The lowest `(unit, key)` unit's `lib_id` becomes
/// the component's.
#[derive(Debug)]
pub(super) struct Placement {
    pub(super) unit: i64,
    pub(super) key: String,
    pub(super) lib_id: String,
}

/// `_occurrences(design)` (interface_extractor.py:95-124): `reference →
/// [(unit, key, symbol)]` for every placed symbol, in occurrence order.
pub(super) fn occurrences(index: &SchematicBundleIndex) -> Vec<(String, Vec<Placement>)> {
    let mut by_reference: HashMap<String, Vec<Placement>> = HashMap::new();
    for occurrence in index.occurrences() {
        // `_string(sheet_instance_path) or "/"` (:105); `occurrence_address`
        // is already `/…` with no trailing slash.
        let sheet_path = occurrence.occurrence_address.as_str();
        let Some(definition) = index.definition(&occurrence.source_path) else {
            continue;
        };
        for symbol in &definition.symbols {
            if symbol.lib_id.is_empty() {
                continue;
            }
            // The first `(instances … (path …))` record whose path equals the
            // sheet path (:110-117); records are per project.
            let Some(record) = symbol
                .instances
                .iter()
                .find(|entry| entry.path == sheet_path)
            else {
                continue;
            };
            let reference = record.reference.as_str();
            if reference.is_empty() || reference.starts_with('#') {
                continue; // power flags and other virtual symbols
            }
            // `entry.unit or symbol.unit or 1` (:121); both default to 1.
            let unit = if record.unit != 0 {
                record.unit
            } else if symbol.unit != 0 {
                symbol.unit
            } else {
                1
            };
            let key = format!("{}/{}", sheet_path.trim_end_matches('/'), symbol.uuid);
            by_reference
                .entry(reference.to_owned())
                .or_default()
                .push(Placement {
                    unit,
                    key,
                    lib_id: symbol.lib_id.clone(),
                });
        }
    }
    // `sorted(occurrences, key=_natural)` happens in the caller.
    by_reference.into_iter().collect()
}
