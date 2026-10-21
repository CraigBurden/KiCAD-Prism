//! Harness topology: runs, breakouts and per-segment wire sets
//! (CONTRACTS_P2 §17.7; PLAN §7 items 3, 7).
//!
//! A harness is a tree. Its leaves are the ends that have a pose (SB2-41); its
//! inner nodes are breakouts. Every edge is a **segment**, carrying the wires
//! whose two ends lie on opposite sides of it, and drawn with the bundle
//! diameter of those wires.
//!
//! A faithful port of
//! `backend/app/services/systems/placement/harness_topology.py`; the TypeScript
//! twin is `frontend/src/features/system-builder/placement/harness-topology.ts`.

use crate::placement::harness_spec::{PACKING_FACTOR, wire_od_mm};
use crate::placement::poses::clean;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

/// An end with a pose, as the tree takes it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopologyEnd {
    /// The end's id.
    pub id: String,
    /// The leg point in the world.
    pub leg_mm: [f64; 3],
    /// The unit outward axis.
    pub outward: [f64; 3],
}

/// One side of a wire: its end (and, in scene input, its pin).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WireSide {
    /// The end's id.
    pub end: String,
}

/// A wire's two ends and gauge.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopologyWire {
    /// The wire's id.
    pub id: String,
    /// The wire's start.
    pub from: WireSide,
    /// The wire's end.
    pub to: WireSide,
    /// The gauge, as stored (a string or a number).
    #[serde(default)]
    pub gauge_awg: Option<Value>,
}

/// A user breakout, or one built from stored nodes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopologyBreakout {
    /// The breakout's id.
    pub id: String,
    /// Its position in the world.
    pub position_mm: [f64; 3],
    /// The ends explicitly attached to it.
    #[serde(default)]
    pub ends: Vec<String>,
}

/// What a tree node is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    /// A harness end.
    End,
    /// A breakout.
    Breakout,
}

/// A tree node.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarnessNode {
    /// The node's id.
    pub id: String,
    /// Whether it is an end or a breakout.
    pub kind: NodeKind,
    /// Its position in the world.
    pub position_mm: [f64; 3],
}

/// One edge of the tree and the wires crossing it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarnessSegment {
    /// `from~to`.
    pub id: String,
    /// The edge's start node.
    pub from: String,
    /// The edge's end node.
    pub to: String,
    /// The wires whose ends lie on opposite sides of the edge.
    pub wires: Vec<String>,
    /// The bundle diameter of those wires.
    pub diameter_mm: f64,
    /// Whether any gauge was assumed.
    pub assumed_gauge: bool,
}

/// The harness tree (SB2-42's input to the curves).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Topology {
    /// Ends first, then breakouts, in tree order.
    pub nodes: Vec<HarnessNode>,
    /// The edges, end legs first then breakout links.
    pub segments: Vec<HarnessSegment>,
    /// Wires touching an end without a pose.
    pub unplaced: Vec<String>,
}

/// `d = k·√Σ dᵢ²` (§17.5) and whether any gauge was assumed; 0 without wires.
/// Ports `harness_topology.py:_bundle`.
fn bundle(wires: &[&TopologyWire]) -> (f64, bool) {
    if wires.is_empty() {
        return (0.0, false);
    }
    let mut total = 0.0;
    let mut assumed = false;
    for wire in wires {
        let (od, guessed) = wire_od_mm(wire.gauge_awg.as_ref());
        total += od * od;
        assumed = assumed || guessed;
    }
    (clean(PACKING_FACTOR * total.sqrt()), assumed)
}

/// The wire-count-weighted centroid of the leg points, lifted along the mean
/// outward axis. Ports `harness_topology.py:_auto_breakout`.
fn auto_breakout(ends: &[TopologyEnd], weight: &BTreeMap<String, i64>) -> [f64; 3] {
    let mut weights: Vec<f64> = ends
        .iter()
        .map(|end| weight.get(&end.id).copied().unwrap_or(0).max(0) as f64)
        .collect();
    if weights.iter().sum::<f64>() == 0.0 {
        weights = vec![1.0; ends.len()];
    }
    let total = weights.iter().sum::<f64>();
    let mut centre = [0.0_f64; 3];
    for (k, value) in centre.iter_mut().enumerate() {
        *value = weights
            .iter()
            .zip(ends)
            .map(|(weight, end)| weight * end.leg_mm[k])
            .sum::<f64>()
            / total;
    }
    let mut mean = [0.0_f64; 3];
    for (k, value) in mean.iter_mut().enumerate() {
        *value = ends.iter().map(|end| end.outward[k]).sum::<f64>() / ends.len() as f64;
    }
    let size = (mean[0] * mean[0] + mean[1] * mean[1] + mean[2] * mean[2]).sqrt();
    if size < 1e-9 {
        return centre;
    }
    [0usize, 1, 2]
        .map(|k| centre[k] + crate::placement::harness_spec::BREAKOUT_LIFT_MM * mean[k] / size)
}

/// The Euclidean distance between two points (`math.dist`).
fn distance(a: [f64; 3], b: [f64; 3]) -> f64 {
    let (dx, dy, dz) = (a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    (dx * dx + dy * dy + dz * dz).sqrt()
}

/// An end's first explicitly assigned breakout, by breakout then end order.
/// Ports the `assigned` loop in `harness_topology.py:topology`.
fn assigned_ends(ends: &[TopologyEnd], breakouts: &[TopologyBreakout]) -> BTreeMap<String, String> {
    let known: BTreeSet<&str> = ends.iter().map(|end| end.id.as_str()).collect();
    let mut assigned = BTreeMap::new();
    for breakout in breakouts {
        for end_id in &breakout.ends {
            if known.contains(end_id.as_str()) {
                assigned
                    .entry(end_id.clone())
                    .or_insert_with(|| breakout.id.clone());
            }
        }
    }
    assigned
}

/// The nearest breakout by leg point, ties to the earlier (`min`).
fn nearest_breakout(breakouts: &[TopologyBreakout], leg: [f64; 3]) -> String {
    let mut best = &breakouts[0];
    let mut best_distance = distance(best.position_mm, leg);
    for breakout in &breakouts[1..] {
        let candidate = distance(breakout.position_mm, leg);
        if candidate < best_distance {
            best = breakout;
            best_distance = candidate;
        }
    }
    best.id.clone()
}

/// The nodes and edges before wire sets are computed.
fn nodes_and_edges(
    ends: &[TopologyEnd],
    breakouts: &[TopologyBreakout],
    weight: &BTreeMap<String, i64>,
) -> (Vec<HarnessNode>, Vec<(String, String)>) {
    let mut nodes: Vec<HarnessNode> = ends
        .iter()
        .map(|end| HarnessNode {
            id: end.id.clone(),
            kind: NodeKind::End,
            position_mm: end.leg_mm.map(clean),
        })
        .collect();
    let mut edges = Vec::new();
    if !breakouts.is_empty() {
        nodes.extend(breakouts.iter().map(|breakout| HarnessNode {
            id: breakout.id.clone(),
            kind: NodeKind::Breakout,
            position_mm: breakout.position_mm.map(clean),
        }));
        let assigned = assigned_ends(ends, breakouts);
        for end in ends {
            let target = assigned
                .get(&end.id)
                .cloned()
                .unwrap_or_else(|| nearest_breakout(breakouts, end.leg_mm));
            edges.push((end.id.clone(), target));
        }
        for pair in breakouts.windows(2) {
            edges.push((pair[0].id.clone(), pair[1].id.clone()));
        }
    } else if ends.len() == 2 {
        edges.push((ends[0].id.clone(), ends[1].id.clone()));
    } else if ends.len() > 2 {
        nodes.push(HarnessNode {
            id: "auto".to_owned(),
            kind: NodeKind::Breakout,
            position_mm: auto_breakout(ends, weight).map(clean),
        });
        edges.extend(ends.iter().map(|end| (end.id.clone(), "auto".to_owned())));
    }
    (nodes, edges)
}

/// The undirected adjacency of the edges.
fn adjacency(nodes: &[HarnessNode], edges: &[(String, String)]) -> BTreeMap<String, Vec<String>> {
    let mut adjacency: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for node in nodes {
        adjacency.entry(node.id.clone()).or_default();
    }
    for (a, b) in edges {
        adjacency.entry(a.clone()).or_default().push(b.clone());
        adjacency.entry(b.clone()).or_default().push(a.clone());
    }
    adjacency
}

/// The nodes reachable from `start` without crossing `cut`.
fn side(
    adjacency: &BTreeMap<String, Vec<String>>,
    start: &str,
    cut: (&str, &str),
) -> BTreeSet<String> {
    let mut seen = BTreeSet::from([start.to_owned()]);
    let mut stack = vec![start.to_owned()];
    while let Some(node) = stack.pop() {
        let Some(others) = adjacency.get(&node) else {
            continue;
        };
        for other in others {
            let crosses = (node.as_str() == cut.0 && other.as_str() == cut.1)
                || (node.as_str() == cut.1 && other.as_str() == cut.0);
            if crosses || seen.contains(other) {
                continue;
            }
            seen.insert(other.clone());
            stack.push(other.clone());
        }
    }
    seen
}

/// One edge's segment: the wires whose ends the cut separates.
fn segment_for_edge(
    a: &str,
    b: &str,
    placed: &[&TopologyWire],
    adjacency: &BTreeMap<String, Vec<String>>,
) -> HarnessSegment {
    let near = side(adjacency, a, (a, b));
    let crossing: Vec<&TopologyWire> = placed
        .iter()
        .copied()
        .filter(|wire| near.contains(&wire.from.end) != near.contains(&wire.to.end))
        .collect();
    let (diameter, assumed_gauge) = bundle(&crossing);
    HarnessSegment {
        id: format!("{a}~{b}"),
        from: a.to_owned(),
        to: b.to_owned(),
        wires: crossing.iter().map(|wire| wire.id.clone()).collect(),
        diameter_mm: diameter,
        assumed_gauge,
    }
}

/// The harness tree. Ports `harness_topology.py:topology`.
///
/// `ends` are only those with a pose, in ordinal order; a wire touching an end
/// without a pose is listed in `unplaced`; user breakouts are in chain order.
pub fn topology(
    ends: &[TopologyEnd],
    wires: &[TopologyWire],
    breakouts: &[TopologyBreakout],
) -> Topology {
    let by_end: BTreeSet<&str> = ends.iter().map(|end| end.id.as_str()).collect();
    let mut placed = Vec::new();
    let mut unplaced = Vec::new();
    for wire in wires {
        if by_end.contains(wire.from.end.as_str()) && by_end.contains(wire.to.end.as_str()) {
            placed.push(wire);
        } else {
            unplaced.push(wire.id.clone());
        }
    }
    let mut weight: BTreeMap<String, i64> = BTreeMap::new();
    for wire in &placed {
        for end in [&wire.from.end, &wire.to.end] {
            *weight.entry(end.clone()).or_insert(0) += 1;
        }
    }
    let (nodes, edges) = nodes_and_edges(ends, breakouts, &weight);
    let adjacency = adjacency(&nodes, &edges);
    let segments = edges
        .iter()
        .map(|(a, b)| segment_for_edge(a, b, &placed, &adjacency))
        .collect();
    Topology {
        nodes,
        segments,
        unplaced,
    }
}
