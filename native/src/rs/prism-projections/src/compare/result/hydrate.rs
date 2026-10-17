//! Hydration of the schematic visual targets: `_hydrate_native_targets` and
//! `_native_index` (`design_compare_nodes.py:201-206, 425-516`).
//!
//! A connectivity target names its object by a UUID and a semantic page; a
//! structure target may name a sheet by its human hierarchy. This module looks
//! the object up in the revision's board objects once per side and copies the
//! object's document, kind, parent and position onto the target, keeping the
//! semantic page as the target's sheet path. It then pairs the labels a
//! `label-count-changed` net lost with the ones it gained, and drops both.
//!
//! Only the Schematic tab is hydrated; the PCB objects already carry their
//! native identity (`design_compare_service.py:1054-1061`).

use super::super::entry::Entry;
use super::{ReviewChange, VisualRole, VisualSide, VisualTarget};
use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;
use std::collections::HashMap;

/// Hydrate every schematic change against the two revisions' board objects.
pub(super) fn build(base: &[Entry], head: &[Entry], changes: &mut [ReviewChange]) {
    let reference = index(base);
    let comparison = index(head);
    for change in changes {
        hydrate_change(&reference, &comparison, change);
    }
}

/// `_native_index`: object UUID to the object, last duplicate wins (a Python
/// dict over the member's objects).
fn index(entries: &[Entry]) -> HashMap<&str, &Entry> {
    let mut index = HashMap::new();
    for entry in entries {
        if !entry.uuid.is_empty() {
            index.insert(entry.uuid.as_str(), entry);
        }
    }
    index
}

fn hydrate_change(
    reference: &HashMap<&str, &Entry>,
    comparison: &HashMap<&str, &Entry>,
    change: &mut ReviewChange,
) {
    hydrate_targets(reference, comparison, &mut change.visual_targets);
    if change
        .change
        .reasons
        .contains(&dc::DesignCompareReason::LabelCountChanged)
    {
        pair_labels(&mut change.visual_targets);
    }
}

fn hydrate_targets(
    reference: &HashMap<&str, &Entry>,
    comparison: &HashMap<&str, &Entry>,
    targets: &mut [VisualTarget],
) {
    for target in targets {
        let index = match target.side {
            VisualSide::Reference => reference,
            VisualSide::Comparison => comparison,
        };
        let Some(entry) = lookup(index, target) else {
            continue;
        };
        let semantic_page = target.document_path.as_deref();
        if let Some(page) = semantic_page
            && page != entry.document_path
        {
            target.sheet_path = Some(page.to_owned());
        }
        target.document_path = Some(entry.document_path.clone());
        target.kind = Some(entry.kind.clone());
        target.parent_source_id = entry.parent_uuid.clone();
        target.at = entry.at.map(point_nm);
    }
}

/// `index.get(sourceId) or index.get(parentSourceId)`.
fn lookup<'a>(index: &HashMap<&str, &'a Entry>, target: &VisualTarget) -> Option<&'a Entry> {
    index
        .get(target.source_id.as_str())
        .or_else(|| {
            target
                .parent_source_id
                .as_deref()
                .and_then(|parent| index.get(parent))
        })
        .copied()
}

fn point_nm(at: [f64; 2]) -> dc::PointNm {
    dc::PointNm {
        x_nm: dc::Nanometres(nanometres(at[0])),
        y_nm: dc::Nanometres(nanometres(at[1])),
    }
}

fn nanometres(millimetres: f64) -> i64 {
    (millimetres * 1e6 + 0.5).floor() as i64
}

/// Pair removed label targets with added ones; drop both
/// (`_hydrate_native_targets`'s `label-count-changed` branch).
fn pair_labels(targets: &mut Vec<VisualTarget>) {
    let removed = positions(targets, VisualSide::Reference);
    let added = positions(targets, VisualSide::Comparison);
    let mut paired_added = vec![false; added.len()];
    let mut dropped = vec![false; targets.len()];
    let mut order = removed;
    order.sort_by(|&a, &b| targets[a].source_id.cmp(&targets[b].source_id));
    for removed_index in order {
        if let Some(candidate) = nearest_added(targets, &added, &paired_added, removed_index) {
            paired_added[candidate] = true;
            dropped[removed_index] = true;
        }
    }
    for (slot, &index) in added.iter().enumerate() {
        if paired_added[slot] {
            dropped[index] = true;
        }
    }
    *targets = targets
        .drain(..)
        .enumerate()
        .filter_map(|(position, target)| (!dropped[position]).then_some(target))
        .collect();
}

/// The indices of the label targets on `side`.
fn positions(targets: &[VisualTarget], side: VisualSide) -> Vec<usize> {
    targets
        .iter()
        .enumerate()
        .filter(|(_, target)| target.role == VisualRole::Label && target.side == side)
        .map(|(position, _)| position)
        .collect()
}

/// The nearest unpaired added label on the same or an unknown page, ties by
/// source id.
fn nearest_added(
    targets: &[VisualTarget],
    added: &[usize],
    paired: &[bool],
    removed_index: usize,
) -> Option<usize> {
    let old = &targets[removed_index];
    let old_page = page_of(old);
    let old_at = at_nm(old);
    let mut best: Option<(i128, &str, usize)> = None;
    for (slot, &index) in added.iter().enumerate() {
        if paired[slot] {
            continue;
        }
        let candidate = &targets[index];
        if !comparable(old_page, page_of(candidate)) {
            continue;
        }
        let distance = squared(at_nm(candidate), old_at);
        let better = best.is_none_or(|(distance0, source0, _)| {
            distance < distance0
                || (distance == distance0 && candidate.source_id.as_str() < source0)
        });
        if better {
            best = Some((distance, candidate.source_id.as_str(), slot));
        }
    }
    best.map(|(_, _, slot)| slot)
}

/// Two pages pair when either is unknown or they are equal.
fn comparable(old: Option<&str>, candidate: Option<&str>) -> bool {
    old.is_none() || candidate.is_none() || old == candidate
}

fn page_of(target: &VisualTarget) -> Option<&str> {
    target
        .sheet_path
        .as_deref()
        .or(target.document_path.as_deref())
}

fn at_nm(target: &VisualTarget) -> (i64, i64) {
    target
        .at
        .as_ref()
        .map_or((0, 0), |at| (at.x_nm.0, at.y_nm.0))
}

fn squared(a: (i64, i64), b: (i64, i64)) -> i128 {
    let dx = i128::from(a.0) - i128::from(b.0);
    let dy = i128::from(a.1) - i128::from(b.1);
    dx * dx + dy * dy
}

#[cfg(test)]
mod tests;
