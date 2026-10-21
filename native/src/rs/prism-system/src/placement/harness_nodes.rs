//! Stored harness nodes as inputs to the tree and the curves
//! (CONTRACTS_P2 §17.9, SB2-45).
//!
//! A harness's nodes are its breakouts and waypoints, in the harness's system
//! frame. `breakouts` gives the topology its breakouts in chain order;
//! `segment_waypoints` gives each segment of a built tree its waypoints from the
//! segment's `from` node toward its `to` node, and which of them are pinned.
//!
//! A faithful port of
//! `backend/app/services/systems/placement/harness_nodes.py`; the TypeScript
//! twin is `frontend/src/features/system-builder/placement/harness-nodes.ts`.

use crate::placement::harness_topology::{Topology, TopologyBreakout};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

/// What a stored node is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StoredNodeKind {
    /// A breakout.
    Breakout,
    /// A waypoint.
    Waypoint,
}

/// A breakout or waypoint stored on a harness.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarnessNodeInput {
    /// The node's id.
    pub id: String,
    /// Whether it is a breakout or a waypoint.
    pub kind: StoredNodeKind,
    /// Its position in the harness's level frame.
    pub position_mm: [f64; 3],
    /// Whether curve relaxation leaves it where it is.
    #[serde(default)]
    pub pinned: Option<bool>,
    /// Its order among the harness's nodes.
    pub order: i64,
    /// A breakout's explicitly attached ends.
    #[serde(default)]
    pub ends: Vec<String>,
    /// A waypoint's two nodes, in either direction.
    #[serde(default)]
    pub between: Option<Vec<String>>,
}

/// The waypoints each segment takes, which are pinned, and the unused ones.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentWaypoints {
    /// Segment ID → points from the segment's `from` node.
    pub waypoints: BTreeMap<String, Vec<[f64; 3]>>,
    /// Segment ID → pinned flags, in the same order.
    pub pinned: BTreeMap<String, Vec<bool>>,
    /// Waypoint IDs whose two nodes no segment joins.
    pub unused: Vec<String>,
}

/// The nodes of one kind, by `(order, id)`. Ports
/// `harness_nodes.py:_ordered`.
fn ordered(nodes: &[HarnessNodeInput], kind: StoredNodeKind) -> Vec<&HarnessNodeInput> {
    let mut selected: Vec<&HarnessNodeInput> =
        nodes.iter().filter(|node| node.kind == kind).collect();
    selected.sort_by(|a, b| a.order.cmp(&b.order).then_with(|| a.id.cmp(&b.id)));
    selected
}

/// The breakouts in chain order, as [`Topology`] takes them. Ports
/// `harness_nodes.py:breakouts`.
pub fn breakouts(nodes: &[HarnessNodeInput]) -> Vec<TopologyBreakout> {
    ordered(nodes, StoredNodeKind::Breakout)
        .into_iter()
        .map(|node| TopologyBreakout {
            id: node.id.clone(),
            position_mm: node.position_mm,
            ends: node.ends.clone(),
        })
        .collect()
}

/// The undirected key for a pair of node ids.
fn pair_key(a: &str, b: &str) -> BTreeSet<String> {
    BTreeSet::from([a.to_owned(), b.to_owned()])
}

/// A waypoint's `between` as a key (empty when it is missing). Python uses a
/// `frozenset`, so every listed id participates and duplicates collapse.
fn node_key(node: &HarnessNodeInput) -> BTreeSet<String> {
    node.between
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .cloned()
        .collect()
}

/// Whether the stored waypoints run from the segment's `from` node.
fn starts_at_from(node: &HarnessNodeInput, from: &str) -> bool {
    node.between
        .as_deref()
        .and_then(|between| between.first())
        .is_some_and(|first| first == from)
}

/// `{waypoints, pinned, unused}` for a tree built from these nodes' breakouts.
/// Ports `harness_nodes.py:segment_waypoints`.
pub fn segment_waypoints(tree: &Topology, nodes: &[HarnessNodeInput]) -> SegmentWaypoints {
    let mut groups: BTreeMap<BTreeSet<String>, Vec<&HarnessNodeInput>> = BTreeMap::new();
    for node in ordered(nodes, StoredNodeKind::Waypoint) {
        groups.entry(node_key(node)).or_default().push(node);
    }
    let mut waypoints = BTreeMap::new();
    let mut pinned = BTreeMap::new();
    let mut used: BTreeSet<BTreeSet<String>> = BTreeSet::new();
    for segment in &tree.segments {
        let key = pair_key(&segment.from, &segment.to);
        let Some(group) = groups.get(&key) else {
            continue;
        };
        used.insert(key);
        let mut group = group.clone();
        if !group
            .first()
            .is_some_and(|node| starts_at_from(node, &segment.from))
        {
            group.reverse();
        }
        waypoints.insert(
            segment.id.clone(),
            group.iter().map(|node| node.position_mm).collect(),
        );
        pinned.insert(
            segment.id.clone(),
            group
                .iter()
                .map(|node| node.pinned.unwrap_or(false))
                .collect(),
        );
    }
    let mut unused: Vec<String> = groups
        .iter()
        .filter(|(key, _)| !used.contains(*key))
        .flat_map(|(_, group)| group.iter().map(|node| node.id.clone()))
        .collect();
    unused.sort();
    SegmentWaypoints {
        waypoints,
        pinned,
        unused,
    }
}
