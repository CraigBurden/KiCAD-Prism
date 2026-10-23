//! Net pairing across revisions (`design_compare_net_pairing.py` `pair_nets`):
//! equal connectivity fingerprints first (equal names disambiguate; the
//! remainder pairs in listing order), then exact name in sorted-name order.

use super::input::{Fingerprint, View};
use std::collections::{BTreeMap, BTreeSet, HashMap, VecDeque};

/// One pairing decision: a base and/or head position in the schematic nets.
#[derive(Clone, Copy, Debug)]
pub(super) struct NetPair {
    /// The base net's position, or `None` for a head-only net.
    pub base: Option<usize>,
    /// The head net's position, or `None` for a base-only net.
    pub head: Option<usize>,
}

/// Pair every named net at most once, by connectivity first, then by name.
pub(super) fn pair_nets<'a>(base: &View<'a>, head: &View<'a>) -> Vec<NetPair> {
    let base_named = named(base);
    let head_named = named(head);
    let mut pairs = Vec::new();
    let mut used_base = BTreeSet::new();
    let mut used_head = BTreeSet::new();
    connectivity_stage(
        base,
        head,
        &base_named,
        &head_named,
        &mut pairs,
        &mut used_base,
        &mut used_head,
    );
    name_stage(
        base,
        head,
        &base_named,
        &head_named,
        &used_base,
        &used_head,
        &mut pairs,
    );
    pairs
}

/// The schematic nets with a non-empty name, in member order
/// (`[item for item in nets if item.get("name")]`).
fn named<'a>(view: &View<'a>) -> Vec<usize> {
    view.nets
        .iter()
        .copied()
        .filter(|&net| !view.name(net).is_empty())
        .collect()
}

/// Group named nets by fingerprint, skipping the empty fingerprint (a falsy
/// fingerprint opts a net out of connectivity matching).
fn by_fingerprint<'a>(view: &View<'a>, nets: &[usize]) -> HashMap<Fingerprint<'a>, Vec<usize>> {
    let mut groups: HashMap<Fingerprint<'a>, Vec<usize>> = HashMap::new();
    for &net in nets {
        let fingerprint = view.fingerprint(net);
        if !fingerprint.is_empty() {
            groups.entry(fingerprint).or_default().push(net);
        }
    }
    groups
}

/// The connectivity stage: fingerprints shared by both revisions, in
/// `sorted(fp, key=sorted)` order.
fn connectivity_stage<'a>(
    base: &View<'a>,
    head: &View<'a>,
    base_named: &[usize],
    head_named: &[usize],
    pairs: &mut Vec<NetPair>,
    used_base: &mut BTreeSet<usize>,
    used_head: &mut BTreeSet<usize>,
) {
    let base_groups = by_fingerprint(base, base_named);
    let head_groups = by_fingerprint(head, head_named);
    let mut shared: Vec<&Fingerprint<'a>> = base_groups
        .keys()
        .filter(|fingerprint| head_groups.contains_key(*fingerprint))
        .collect();
    shared.sort_unstable();
    shared.dedup();
    for fingerprint in shared {
        let assigned = assign_group(
            base,
            &base_groups[fingerprint],
            head,
            &head_groups[fingerprint],
        );
        for (old, new) in assigned {
            pairs.push(NetPair {
                base: Some(old),
                head: Some(new),
            });
            used_base.insert(old);
            used_head.insert(new);
        }
    }
}

/// One fingerprint group: name matches first, then the remaining head nets in
/// listing order. Returns the base -> head assignment.
fn assign_group<'a>(
    base: &View<'a>,
    base_group: &[usize],
    head: &View<'a>,
    head_group: &[usize],
) -> Vec<(usize, usize)> {
    let mut head_by_name: HashMap<&'a str, VecDeque<usize>> = HashMap::new();
    for &net in head_group {
        head_by_name
            .entry(head.name(net))
            .or_default()
            .push_back(net);
    }
    let mut assigned: Vec<(usize, usize)> = Vec::new();
    let mut taken: BTreeSet<usize> = BTreeSet::new();
    for &net in base_group {
        if let Some(candidates) = head_by_name.get_mut(base.name(net))
            && let Some(head_net) = candidates.pop_front()
        {
            assigned.push((net, head_net));
            taken.insert(head_net);
        }
    }
    let mut unmatched: VecDeque<usize> = head_group
        .iter()
        .copied()
        .filter(|net| !taken.contains(net))
        .collect();
    let assigned_base: BTreeSet<usize> = assigned.iter().map(|&(old, _)| old).collect();
    for &net in base_group {
        if assigned_base.contains(&net) {
            continue;
        }
        if let Some(head_net) = unmatched.pop_front() {
            assigned.push((net, head_net));
        }
    }
    assigned
}

/// The name stage: nets left over pair by exact name, sorted-name order,
/// zipping duplicate names in listing order.
fn name_stage<'a>(
    base: &View<'a>,
    head: &View<'a>,
    base_named: &[usize],
    head_named: &[usize],
    used_base: &BTreeSet<usize>,
    used_head: &BTreeSet<usize>,
    pairs: &mut Vec<NetPair>,
) {
    let mut groups: BTreeMap<&'a str, (VecDeque<usize>, VecDeque<usize>)> = BTreeMap::new();
    for &net in base_named {
        if !used_base.contains(&net) {
            groups.entry(base.name(net)).or_default().0.push_back(net);
        }
    }
    for &net in head_named {
        if !used_head.contains(&net) {
            groups.entry(head.name(net)).or_default().1.push_back(net);
        }
    }
    for (old, new) in groups.values_mut() {
        while !old.is_empty() || !new.is_empty() {
            pairs.push(NetPair {
                base: old.pop_front(),
                head: new.pop_front(),
            });
        }
    }
}
