//! What every rule of a build shares: the document, the boards, the findings,
//! and how a connector, endpoint or pin is resolved on a board.

use crate::findings::Findings;
use crate::input::{Board, Document, Endpoint, InterfaceComponent, InterfacePin, Members};
use crate::natural;
use std::collections::BTreeMap;

/// KiCad's automatic net names, which never name a system net when another name exists.
pub fn automatic(net: &str) -> bool {
    net.starts_with("Net-(") || net.starts_with("unconnected-(")
}

/// The last segment of a hierarchical net name: `/Power/GND` → `GND`.
pub fn leaf(net: &str) -> &str {
    net.rsplit('/').next().unwrap_or(net)
}

const GROUNDS: [&str; 7] = ["GND", "AGND", "DGND", "PGND", "GNDA", "GNDD", "VSS"];

/// Whether a net name is a ground name (`docs/system-builder/CONTRACTS.md` §8.5).
pub fn ground(net: &str) -> bool {
    let leaf = leaf(net).to_ascii_uppercase();
    GROUNDS.iter().any(|name| {
        leaf == *name
            || leaf
                .strip_prefix(name)
                .is_some_and(|rest| rest.starts_with('_'))
    })
}

/// Whether a pin is power or ground.
pub fn power(pin: &InterfacePin) -> bool {
    pin.power_net || pin.nets.iter().any(|net| ground(net))
}

/// A pin's first schematic net, in code point order.
pub fn first_net(pin: &InterfacePin) -> Option<&str> {
    pin.nets.iter().map(String::as_str).min()
}

/// The shared state of one build.
pub struct Context<'a> {
    /// The document.
    pub doc: &'a Document,
    /// The members.
    pub members: &'a Members,
    /// The findings collected so far.
    pub findings: Findings,
    labels: BTreeMap<&'a str, &'a str>,
}

impl<'a> Context<'a> {
    /// A context for one build.
    pub fn new(doc: &'a Document, members: &'a Members) -> Self {
        let labels = doc
            .occurrences
            .iter()
            .map(|occurrence| (occurrence.id.as_str(), occurrence.label.as_str()))
            .collect();
        Self {
            doc,
            members,
            findings: Findings::default(),
            labels,
        }
    }

    /// An occurrence's label, or its id.
    pub fn label(&self, occurrence: &str) -> String {
        self.labels
            .get(occurrence)
            .copied()
            .unwrap_or(occurrence)
            .to_owned()
    }

    /// A ready board.
    pub fn board(&self, occurrence: &str) -> Option<&'a Board> {
        self.members.boards.get(occurrence)
    }

    /// The named connector on a ready board; reports `connector-missing` and
    /// `not-a-connector` (`None` when the board is not ready or lacks it).
    pub fn connector(
        &mut self,
        occurrence: &str,
        refdes: &str,
        objects: &[&str],
    ) -> Option<&'a InterfaceComponent> {
        let board = self.board(occurrence)?;
        let label = self.label(occurrence);
        let subject = format!("connector:{occurrence}/{refdes}");
        let Some(component) = board.component(refdes) else {
            let message = format!("{label} has no {refdes}");
            self.findings
                .add("connector-missing", subject, message, objects);
            return None;
        };
        if !component.candidate {
            let message = format!("{label} {refdes} is not detected as a connector");
            self.findings
                .add("not-a-connector", subject, message, objects);
        }
        Some(component)
    }

    /// Report each of `pads` the component lacks as `pin-missing`; return the ones it has, in order.
    pub fn existing_pads(
        &mut self,
        occurrence: &str,
        component: &InterfaceComponent,
        pads: &[String],
        objects: &[&str],
    ) -> Vec<String> {
        let label = self.label(occurrence);
        let mut kept = Vec::new();
        for pad in pads {
            if pin(component, pad).is_some() {
                kept.push(pad.clone());
            } else {
                let subject = format!("pin:{occurrence}/{}/{pad}", component.reference);
                let message = format!("{label} {} has no pin {pad}", component.reference);
                self.findings.add("pin-missing", subject, message, objects);
            }
        }
        kept
    }

    /// An endpoint's pins in order: its sub-port's, else the connector's in natural order.
    /// `None` when its board is not ready or the connector is missing.
    pub fn endpoint_pins(
        &mut self,
        endpoint: &Endpoint,
        objects: &[&str],
    ) -> Option<(&'a InterfaceComponent, Vec<String>)> {
        let component = self.connector(&endpoint.occurrence, &endpoint.connector, objects)?;
        let sub_port = endpoint
            .sub_port
            .as_ref()
            .filter(|reference| reference.kind == "occurrence")
            .and_then(|reference| {
                self.doc
                    .sub_ports
                    .iter()
                    .find(|sub_port| sub_port.id == reference.id)
            });
        let pins = match sub_port {
            Some(sub_port) => {
                let mut objects = objects.to_vec();
                objects.push(&sub_port.id);
                self.existing_pads(&endpoint.occurrence, component, &sub_port.pins, &objects)
            }
            None => pads(component),
        };
        Some((component, pins))
    }
}

/// A component's pin by pad.
pub fn pin<'c>(component: &'c InterfaceComponent, pad: &str) -> Option<&'c InterfacePin> {
    component.pins.iter().find(|pin| pin.pad == pad)
}

/// A component's numbered pads, unique, in natural order.
pub fn pads(component: &InterfaceComponent) -> Vec<String> {
    let mut pads: Vec<String> = component
        .pins
        .iter()
        .filter(|pin| !pin.pad.is_empty())
        .map(|pin| pin.pad.clone())
        .collect();
    natural::sort(&mut pads);
    pads.dedup();
    pads
}
