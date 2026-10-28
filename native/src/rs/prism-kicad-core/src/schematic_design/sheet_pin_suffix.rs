//! Sheet-pin net names KiCad numbers apart (`_1`, `_2`, …).

use crate::{SchematicWireDriverKind, SchematicWireSubgraph};
use std::collections::{HashMap, HashSet};

pub(super) struct NamedGroup {
    pub(super) group: Vec<usize>,
    pub(super) merged: SchematicWireSubgraph,
    pub(super) name: String,
    pub(super) auto_named: bool,
    pub(super) kind: SchematicWireDriverKind,
    pub(super) sheet_pin_key: Option<(usize, usize)>,
}

/// The `_N` suffix of each net named by a sheet pin whose name another such net
/// shares. KiCad renames each weakly driven subgraph whose name another still
/// shares, in driver order, to the first free `_1`, `_2`, …; the last keeps the
/// bare name (`CONNECTION_GRAPH::processSubGraphs`). Only the pin a net is
/// named by counts: a sheet pin that loses to another driver names nothing.
/// KiCad's driver order is each sheet's item order in its R-tree
/// (`EE_RTREE`, keyed by item type and bounding box); the pin's place in the
/// file stands in for it, so the numbers can differ where the two orders do.
pub(super) fn sheet_pin_suffix_indices(named: &[NamedGroup]) -> HashMap<(usize, usize), usize> {
    let mut taken: HashSet<String> = named.iter().map(|group| group.name.clone()).collect();
    let mut grouped = HashMap::<&str, Vec<(usize, usize)>>::new();
    for group in named {
        if group.kind == SchematicWireDriverKind::SheetPin
            && let Some(key) = group.sheet_pin_key
        {
            grouped.entry(&group.name).or_default().push(key);
        }
    }
    let mut grouped: Vec<_> = grouped
        .into_iter()
        .filter(|(_, keys)| keys.len() > 1)
        .collect();
    grouped.sort_unstable();
    let mut result = HashMap::new();
    for (name, keys) in &mut grouped {
        keys.sort_by_key(|&(occurrence, source_order)| (source_order, occurrence));
        let mut suffix = 1;
        for key in &keys[..keys.len() - 1] {
            while taken.contains(&format!("{name}_{suffix}")) {
                suffix += 1;
            }
            taken.insert(format!("{name}_{suffix}"));
            result.insert(*key, suffix);
            suffix += 1;
        }
    }
    result
}
