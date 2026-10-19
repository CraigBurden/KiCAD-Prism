//! System nets (`docs/system-builder/CONTRACTS.md` §8.3): connector pins
//! joined by their boards' nets and by the system's connections.

use crate::build::{Named, pin_node, shown};
use crate::context::{Context, automatic, ground, pads, pin};
use crate::natural;
use crate::output::{BoardNetOut, NetOut, PinRef};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

/// A node of the connectivity graph.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Node {
    /// A connector pin.
    Pin(PinRef),
    /// A splice, keyed `<harness>/<splice>`.
    Splice(String),
}

/// An edge between two nodes.
pub type Edge = (Node, Node);

#[derive(Default)]
struct UnionFind {
    index: BTreeMap<Node, usize>,
    parent: Vec<usize>,
}

impl UnionFind {
    fn id(&mut self, node: Node) -> usize {
        let next = self.parent.len();
        let id = *self.index.entry(node).or_insert(next);
        if id == next {
            self.parent.push(next);
        }
        id
    }

    fn root(&mut self, mut id: usize) -> usize {
        while self.parent[id] != id {
            self.parent[id] = self.parent[self.parent[id]];
            id = self.parent[id];
        }
        id
    }

    fn join(&mut self, a: Node, b: Node) {
        let (a, b) = (self.id(a), self.id(b));
        let (a, b) = (self.root(a), self.root(b));
        if a != b {
            self.parent[a.max(b)] = a.min(b);
        }
    }
}

/// Facts about one pin node for naming and findings.
struct PinFacts {
    nets: Vec<String>,
    power: bool,
}

fn board_edges(
    cx: &Context<'_>,
    named: &Named,
    graph: &mut UnionFind,
    facts: &mut BTreeMap<PinRef, PinFacts>,
) {
    for (occurrence, board) in &cx.members.boards {
        let mut first_on_net: BTreeMap<&str, Node> = BTreeMap::new();
        for component in board
            .interface
            .components
            .iter()
            .filter(|c| shown(c, occurrence, named))
        {
            for pad in pads(component) {
                let Some(found) = pin(component, &pad) else {
                    continue;
                };
                let node = pin_node(occurrence, &component.reference, &pad);
                graph.id(node.clone());
                if let Node::Pin(reference) = &node {
                    facts.insert(
                        reference.clone(),
                        PinFacts {
                            nets: found.nets.clone(),
                            power: found.power_net,
                        },
                    );
                }
                for net in &found.nets {
                    match first_on_net.get(net.as_str()) {
                        Some(first) => graph.join(first.clone(), node.clone()),
                        None => {
                            first_on_net.insert(net, node.clone());
                        }
                    }
                }
            }
        }
    }
}

fn net_id(pins: &[PinRef]) -> String {
    let mut hasher = Sha256::new();
    for reference in pins {
        hasher.update(reference.occurrence.as_bytes());
        hasher.update([0]);
        hasher.update(reference.connector.as_bytes());
        hasher.update([0]);
        hasher.update(reference.pad.as_bytes());
        hasher.update([1]);
    }
    let digest = hasher.finalize();
    let hex: String = digest
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect();
    format!("net-{hex}")
}

/// A board net name as the name check compares it: the leaf after the sheet
/// path, with KiCad's bus-member `.` read as `_` (`/SOM/S9.TXP` is `S9_TXP`).
fn comparable(net: &str) -> String {
    net.rsplit('/').next().unwrap_or(net).replace('.', "_")
}

fn display_name(board_nets: &[BoardNetOut]) -> String {
    let mut counts: BTreeMap<&str, usize> = BTreeMap::new();
    for board_net in board_nets
        .iter()
        .filter(|board_net| !automatic(&board_net.net))
    {
        *counts.entry(board_net.net.as_str()).or_default() += 1;
    }
    let best = counts
        .iter()
        .max_by(|x, y| x.1.cmp(y.1).then_with(|| y.0.cmp(x.0)));
    match best {
        Some((name, _)) => (*name).to_owned(),
        None => board_nets
            .iter()
            .map(|board_net| board_net.net.as_str())
            .min()
            .unwrap_or("")
            .to_owned(),
    }
}

/// Every system net, sorted by id; reports name and power conflicts.
pub fn system_nets(cx: &mut Context<'_>, named: &Named, edges: &[(Node, Node)]) -> Vec<NetOut> {
    let mut graph = UnionFind::default();
    let mut facts = BTreeMap::new();
    board_edges(cx, named, &mut graph, &mut facts);
    for (a, b) in edges {
        graph.join(a.clone(), b.clone());
    }
    let mut groups: BTreeMap<usize, Vec<PinRef>> = BTreeMap::new();
    let nodes: Vec<(Node, usize)> = graph
        .index
        .iter()
        .map(|(node, id)| (node.clone(), *id))
        .collect();
    for (node, id) in nodes {
        if let Node::Pin(reference) = node {
            let root = graph.root(id);
            groups.entry(root).or_default().push(reference);
        }
    }
    // A pin on no board net and in no connection is not a net (§8.3). Pins
    // with no board net joined only by connections are, named by a pin.
    let mut nets: Vec<NetOut> = groups
        .into_values()
        .filter(|pins| {
            pins.len() > 1
                || pins
                    .iter()
                    .any(|pin| facts.get(pin).is_some_and(|facts| !facts.nets.is_empty()))
        })
        .map(|pins| net_out(cx, pins, &facts))
        .collect();
    nets.sort_by(|a, b| a.id.cmp(&b.id));
    nets
}

fn net_out(
    cx: &mut Context<'_>,
    mut pins: Vec<PinRef>,
    facts: &BTreeMap<PinRef, PinFacts>,
) -> NetOut {
    pins.sort_by(|a, b| {
        a.occurrence
            .cmp(&b.occurrence)
            .then_with(|| a.connector.cmp(&b.connector))
            .then_with(|| natural::cmp(&a.pad, &b.pad))
    });
    let mut board_nets = BTreeSet::new();
    let mut power_names = BTreeSet::new();
    for reference in &pins {
        let Some(found) = facts.get(reference) else {
            continue;
        };
        for net in &found.nets {
            board_nets.insert(BoardNetOut {
                occurrence: reference.occurrence.clone(),
                net: net.clone(),
            });
            if found.power || ground(net) {
                power_names.insert(net.rsplit('/').next().unwrap_or(net).to_owned());
            }
        }
    }
    let board_nets: Vec<BoardNetOut> = board_nets.into_iter().collect();
    let names: BTreeSet<String> = board_nets
        .iter()
        .map(|board_net| board_net.net.clone())
        .collect();
    let id = net_id(&pins);
    let name = match pins.first() {
        Some(first) if board_nets.is_empty() => {
            format!("{}/{}/{}", first.occurrence, first.connector, first.pad)
        }
        _ => display_name(&board_nets),
    };
    let named: BTreeSet<String> = names
        .iter()
        .filter(|net| !automatic(net))
        .map(|net| comparable(net))
        .collect();
    let occurrences: Vec<&str> = pins
        .iter()
        .map(|reference| reference.occurrence.as_str())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    if named.len() > 1 && power_names.len() < 2 {
        let list = names
            .iter()
            .filter(|net| !automatic(net))
            .map(String::as_str)
            .collect::<Vec<_>>()
            .join(", ");
        cx.findings.add(
            "net-name-conflict",
            format!("net:{id}"),
            format!("{name} joins board nets named {list}"),
            &occurrences,
        );
    }
    if power_names.len() > 1 {
        let list = power_names.iter().cloned().collect::<Vec<_>>().join(", ");
        cx.findings.add(
            "power-net-conflict",
            format!("net:{id}"),
            format!("{name} joins different power nets: {list}"),
            &occurrences,
        );
    }
    NetOut {
        id,
        name,
        names: names.into_iter().collect(),
        board_nets,
        pins,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::build::Named;
    use crate::input::{
        Board, Document, InterfaceComponent, InterfacePin, Members, SemanticFacts, SystemInterface,
    };

    fn board(pins: Vec<InterfacePin>) -> Board {
        Board {
            revision_key: "0".repeat(64),
            bundle_key: "1".repeat(64),
            interface: SystemInterface {
                board_thickness_mm: None,
                components: vec![InterfaceComponent {
                    reference: "J1".to_owned(),
                    value: "Conn".to_owned(),
                    mpn: None,
                    candidate: true,
                    pins,
                    geometry: None,
                }],
            },
            semantic: SemanticFacts::default(),
        }
    }

    #[test]
    fn unconnected_pins_joined_by_a_connection_are_a_net_named_by_a_pin() {
        let mut members = Members::default();
        for occurrence in ["occ_a", "occ_b"] {
            members.boards.insert(
                occurrence.to_owned(),
                board(vec![InterfacePin {
                    pad: "3".to_owned(),
                    ..InterfacePin::default()
                }]),
            );
        }
        let document = Document::default();
        let mut context = Context::new(&document, &members);
        let edge = (pin_node("occ_a", "J1", "3"), pin_node("occ_b", "J1", "3"));
        let nets = system_nets(&mut context, &Named::new(), &[edge]);
        assert_eq!(nets.len(), 1);
        assert_eq!(nets[0].name, "occ_a/J1/3");
        assert!(nets[0].board_nets.is_empty());
    }

    #[test]
    fn a_pin_with_no_board_net_is_not_a_system_net() {
        let mut members = Members::default();
        members.boards.insert(
            "occ".to_owned(),
            board(vec![
                InterfacePin {
                    pad: "1".to_owned(),
                    ..InterfacePin::default()
                },
                InterfacePin {
                    pad: "2".to_owned(),
                    nets: vec!["GND".to_owned()],
                    ..InterfacePin::default()
                },
            ]),
        );
        let document = Document::default();
        let mut context = Context::new(&document, &members);
        let nets = system_nets(&mut context, &Named::new(), &[]);
        assert_eq!(nets.len(), 1);
        assert_eq!(nets[0].name, "GND");
        assert_eq!(
            nets[0]
                .pins
                .iter()
                .map(|pin| pin.pad.as_str())
                .collect::<Vec<_>>(),
            vec!["2"]
        );
    }
}
