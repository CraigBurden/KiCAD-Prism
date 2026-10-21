//! A harness's route tree (CONTRACTS §16.6): which ends each wire reaches,
//! the stored segments as a tree or the derived one, and which segments each
//! wire runs.

use std::collections::{BTreeMap, BTreeSet, VecDeque};

use serde_json::Value;

use crate::input::Harness;
use crate::output::{HarnessWireOut, TerminalOut};
use crate::placement::harness_spec::{PACKING_FACTOR, wire_od_mm};
use crate::placement::harness_topology::{
    HarnessNode, HarnessSegment, NodeKind, Topology, TopologyBreakout, TopologyEnd, TopologyWire,
    WireSide, topology,
};

/// The ends one wire reaches, and whether it runs contact to contact.
pub(crate) struct WireEnds {
    pub id: String,
    pub ends: Vec<String>,
    pub direct: bool,
}

/// A terminal as a node of the splice graph: `e:<end>` or `s:<splice>`.
fn graph_node(terminal: &TerminalOut) -> Option<String> {
    match terminal.kind {
        "contact" => terminal.end.as_ref().map(|end| format!("e:{end}")),
        "splice" => terminal.splice.as_ref().map(|splice| format!("s:{splice}")),
        _ => None,
    }
}

/// Ends and splices joined by wires.
fn splice_graph(wires: &[HarnessWireOut]) -> BTreeMap<String, BTreeSet<String>> {
    let mut adjacent: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for wire in wires {
        if let (Some(a), Some(b)) = (graph_node(&wire.from), graph_node(&wire.to)) {
            adjacent.entry(a.clone()).or_default().insert(b.clone());
            adjacent.entry(b).or_default().insert(a);
        }
    }
    adjacent
}

/// The ends a splice reaches: through other splices, stopping at ends.
fn splice_reach(adjacent: &BTreeMap<String, BTreeSet<String>>, splice: &str) -> BTreeSet<String> {
    let start = format!("s:{splice}");
    let mut seen = BTreeSet::from([start.clone()]);
    let mut queue = VecDeque::from([start]);
    while let Some(at) = queue.pop_front() {
        if at.starts_with("e:") {
            continue;
        }
        for next in adjacent.get(&at).into_iter().flatten() {
            if seen.insert(next.clone()) {
                queue.push_back(next.clone());
            }
        }
    }
    seen.into_iter()
        .filter_map(|id| id.strip_prefix("e:").map(str::to_owned))
        .collect()
}

/// Each wire's ends: a contact's own end, a splice's every end reached through
/// its other wires; loose terminals reach none.
pub(crate) fn wire_ends(wires: &[HarnessWireOut]) -> Vec<WireEnds> {
    let adjacent = splice_graph(wires);
    wires
        .iter()
        .map(|wire| {
            let mut ends = BTreeSet::new();
            for terminal in [&wire.from, &wire.to] {
                if terminal.kind == "contact" {
                    ends.extend(terminal.end.clone());
                } else if let Some(splice) = terminal
                    .splice
                    .as_deref()
                    .filter(|_| terminal.kind == "splice")
                {
                    ends.extend(splice_reach(&adjacent, splice));
                }
            }
            WireEnds {
                id: wire.id.clone(),
                ends: ends.into_iter().collect(),
                direct: wire.from.kind == "contact" && wire.to.kind == "contact",
            }
        })
        .collect()
}

/// A tree's edges with whether they were derived.
pub(crate) struct Tree {
    pub nodes: Vec<HarnessNode>,
    /// `(id, from, to)`.
    pub edges: Vec<(String, String, String)>,
    pub derived: bool,
    /// The stored segments are not a tree over the posed ends.
    pub invalid: bool,
}

/// The derived tree (v1 topology) over the posed ends and positioned branch points.
fn derived(harness: &Harness, ends: &[TopologyEnd], wire_ends: &[WireEnds]) -> Tree {
    let wires: Vec<TopologyWire> = wire_ends
        .iter()
        .flat_map(|wire| {
            wire.ends.windows(2).map(|pair| TopologyWire {
                id: wire.id.clone(),
                from: WireSide {
                    end: pair[0].clone(),
                },
                to: WireSide {
                    end: pair[1].clone(),
                },
                gauge_awg: None,
            })
        })
        .collect();
    let breakouts: Vec<TopologyBreakout> = harness
        .branch_points
        .iter()
        .filter_map(|point| {
            let at = point.position.as_ref()?;
            Some(TopologyBreakout {
                id: point.id.clone(),
                position_mm: [mm(at.x_nm), mm(at.y_nm), mm(at.z_nm)],
                ends: Vec::new(),
            })
        })
        .collect();
    let tree = topology(ends, &wires, &breakouts);
    Tree {
        edges: tree
            .segments
            .iter()
            .map(|segment| {
                let id = format!("{}/{}~{}", harness.id, segment.from, segment.to);
                (id, segment.from.clone(), segment.to.clone())
            })
            .collect(),
        nodes: tree.nodes,
        derived: true,
        invalid: false,
    }
}

fn mm(nm: i64) -> f64 {
    nm as f64 / 1e6
}

/// Whether `edges` form one tree spanning `required` (and only known nodes).
fn is_tree(edges: &[(String, String, String)], known: &BTreeSet<&str>, required: &[&str]) -> bool {
    let mut nodes: BTreeSet<&str> = BTreeSet::new();
    for (_, a, b) in edges {
        if a == b || !known.contains(a.as_str()) || !known.contains(b.as_str()) {
            return false;
        }
        nodes.insert(a);
        nodes.insert(b);
    }
    if edges.len() + 1 != nodes.len() || required.iter().any(|end| !nodes.contains(end)) {
        return false;
    }
    let adjacency = adjacency(edges);
    let Some(first) = nodes.iter().next() else {
        return false;
    };
    let mut seen = BTreeSet::from([first.to_string()]);
    let mut queue = VecDeque::from([first.to_string()]);
    while let Some(at) = queue.pop_front() {
        for (next, _) in adjacency.get(&at).into_iter().flatten() {
            if seen.insert(next.clone()) {
                queue.push_back(next.clone());
            }
        }
    }
    seen.len() == nodes.len()
}

/// Node → `(neighbour, edge index)`.
fn adjacency(edges: &[(String, String, String)]) -> BTreeMap<String, Vec<(String, usize)>> {
    let mut out: BTreeMap<String, Vec<(String, usize)>> = BTreeMap::new();
    for (index, (_, a, b)) in edges.iter().enumerate() {
        out.entry(a.clone()).or_default().push((b.clone(), index));
        out.entry(b.clone()).or_default().push((a.clone(), index));
    }
    out
}

/// Positions for the stored tree's branch points: stored, else the mean of
/// their positioned neighbours, resolved outward from the ends.
fn branch_positions(
    harness: &Harness,
    edges: &[(String, String, String)],
    legs: &BTreeMap<String, [f64; 3]>,
) -> BTreeMap<String, [f64; 3]> {
    let mut known: BTreeMap<String, [f64; 3]> = legs.clone();
    for point in &harness.branch_points {
        if let Some(at) = &point.position {
            known.insert(point.id.clone(), [mm(at.x_nm), mm(at.y_nm), mm(at.z_nm)]);
        }
    }
    let adjacency = adjacency(edges);
    let pending: Vec<&str> = harness
        .branch_points
        .iter()
        .map(|point| point.id.as_str())
        .filter(|id| !known.contains_key(*id))
        .collect();
    for _ in 0..=pending.len() {
        for id in &pending {
            if known.contains_key(*id) {
                continue;
            }
            let near: Vec<[f64; 3]> = adjacency
                .get(*id)
                .into_iter()
                .flatten()
                .filter_map(|(next, _)| known.get(next).copied())
                .collect();
            if !near.is_empty() {
                let n = near.len() as f64;
                let mean = [0, 1, 2].map(|k| near.iter().map(|p| p[k]).sum::<f64>() / n);
                known.insert((*id).to_owned(), mean);
            }
        }
    }
    // Branch points with no positioned neighbour sit at the ends' centroid.
    let n = legs.len().max(1) as f64;
    let centroid = [0, 1, 2].map(|k| legs.values().map(|p| p[k]).sum::<f64>() / n);
    harness
        .branch_points
        .iter()
        .map(|point| (point.id.clone(), *known.get(&point.id).unwrap_or(&centroid)))
        .collect()
}

/// The stored segments as the tree, or the derived tree when they are absent
/// or not a tree over the posed ends.
pub(crate) fn build(harness: &Harness, ends: &[TopologyEnd], wire_ends: &[WireEnds]) -> Tree {
    if harness.segments.is_empty() {
        return derived(harness, ends, wire_ends);
    }
    let edges: Vec<(String, String, String)> = harness
        .segments
        .iter()
        .map(|segment| {
            let id = |node: &crate::input::SegmentNode| node.id().unwrap_or_default().to_owned();
            (segment.id.clone(), id(&segment.from), id(&segment.to))
        })
        .collect();
    let mut known: BTreeSet<&str> = ends.iter().map(|end| end.id.as_str()).collect();
    known.extend(harness.branch_points.iter().map(|point| point.id.as_str()));
    let required: Vec<&str> = ends.iter().map(|end| end.id.as_str()).collect();
    if !is_tree(&edges, &known, &required) {
        let mut tree = derived(harness, ends, wire_ends);
        tree.invalid = true;
        return tree;
    }
    let legs: BTreeMap<String, [f64; 3]> = ends
        .iter()
        .map(|end| (end.id.clone(), end.leg_mm))
        .collect();
    let positions = branch_positions(harness, &edges, &legs);
    let used: BTreeSet<&str> = edges
        .iter()
        .flat_map(|(_, a, b)| [a.as_str(), b.as_str()])
        .collect();
    let mut nodes: Vec<HarnessNode> = ends
        .iter()
        .map(|end| HarnessNode {
            id: end.id.clone(),
            kind: NodeKind::End,
            position_mm: end.leg_mm,
        })
        .collect();
    nodes.extend(
        harness
            .branch_points
            .iter()
            .filter(|point| used.contains(point.id.as_str()))
            .map(|point| HarnessNode {
                id: point.id.clone(),
                kind: NodeKind::Breakout,
                position_mm: positions[&point.id],
            }),
    );
    Tree {
        nodes,
        edges,
        derived: false,
        invalid: false,
    }
}

/// The edges on the path between two nodes, or `None` when they are not joined.
fn path(
    adjacency: &BTreeMap<String, Vec<(String, usize)>>,
    from: &str,
    to: &str,
) -> Option<Vec<usize>> {
    let mut back: BTreeMap<String, (String, usize)> = BTreeMap::new();
    let mut seen = BTreeSet::from([from.to_owned()]);
    let mut queue = VecDeque::from([from.to_owned()]);
    while let Some(at) = queue.pop_front() {
        if at == to {
            let mut edges = Vec::new();
            let mut node = at;
            while let Some((previous, edge)) = back.get(&node) {
                edges.push(*edge);
                node = previous.clone();
            }
            return Some(edges);
        }
        for (next, edge) in adjacency.get(&at).into_iter().flatten() {
            if seen.insert(next.clone()) {
                back.insert(next.clone(), (at.clone(), *edge));
                queue.push_back(next.clone());
            }
        }
    }
    None
}

/// Each wire's edges: the subtree joining the ends it reaches (or its stored
/// `route`, when every listed segment is in the tree).
pub(crate) fn wire_edges(
    tree: &Tree,
    harness: &Harness,
    wire_ends: &[WireEnds],
) -> BTreeMap<String, BTreeSet<usize>> {
    let adjacency = adjacency(&tree.edges);
    let index: BTreeMap<&str, usize> = tree
        .edges
        .iter()
        .enumerate()
        .map(|(i, (id, _, _))| (id.as_str(), i))
        .collect();
    let stored: BTreeMap<&str, &Vec<String>> = harness
        .wires
        .iter()
        .filter(|wire| !wire.route.is_empty())
        .map(|wire| (wire.id.as_str(), &wire.route))
        .collect();
    let mut out = BTreeMap::new();
    for wire in wire_ends {
        if let Some(route) = stored.get(wire.id.as_str()) {
            let listed: Option<BTreeSet<usize>> = route
                .iter()
                .map(|id| index.get(id.as_str()).copied())
                .collect();
            if let Some(listed) = listed {
                out.insert(wire.id.clone(), listed);
                continue;
            }
        }
        let Some((first, rest)) = wire.ends.split_first() else {
            continue;
        };
        let mut edges = BTreeSet::new();
        for other in rest {
            edges.extend(path(&adjacency, first, other).into_iter().flatten());
        }
        if !edges.is_empty() {
            out.insert(wire.id.clone(), edges);
        }
    }
    out
}

/// The tree's segments with their wires (in wire-list order) and bundle size.
pub(crate) fn segments(
    tree: &Tree,
    wires: &[HarnessWireOut],
    edges_of: &BTreeMap<String, BTreeSet<usize>>,
) -> Vec<HarnessSegment> {
    tree.edges
        .iter()
        .enumerate()
        .map(|(index, (id, from, to))| {
            let carried: Vec<&HarnessWireOut> = wires
                .iter()
                .filter(|wire| {
                    edges_of
                        .get(&wire.id)
                        .is_some_and(|edges| edges.contains(&index))
                })
                .collect();
            let mut total = 0.0;
            let mut assumed = false;
            for wire in &carried {
                let gauge = wire.gauge_awg.clone().map(Value::String);
                let (od, guessed) = wire_od_mm(gauge.as_ref());
                total += od * od;
                assumed |= guessed;
            }
            HarnessSegment {
                id: id.clone(),
                from: from.clone(),
                to: to.clone(),
                wires: carried.iter().map(|wire| wire.id.clone()).collect(),
                diameter_mm: if carried.is_empty() {
                    0.0
                } else {
                    PACKING_FACTOR * total.sqrt()
                },
                assumed_gauge: assumed,
            }
        })
        .collect()
}

/// The tree as the curve maths reads it.
pub(crate) fn topology_of(tree: &Tree, segments: Vec<HarnessSegment>) -> Topology {
    Topology {
        nodes: tree.nodes.clone(),
        segments,
        unplaced: Vec::new(),
    }
}
