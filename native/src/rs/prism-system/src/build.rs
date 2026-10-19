//! One system build (`docs/system-builder/CONTRACTS.md` §8): occurrences,
//! references, B2B mappings, then the modules for wiring, nets and
//! suggestions, and finally the findings.

use crate::context::{Context, first_net, pads, pin, power};
use crate::input::{Document, InterfaceComponent, Mate, Members};
use crate::mapping::{self, Side};
use crate::natural;
use crate::nets::{Edge, Node};
use crate::output::{
    ConnectorOut, MateOut, OccurrenceOut, PairOut, PinOut, PinRef, SCHEMA, SystemBundle,
};
use crate::{nets, suggestions, wiring};
use std::collections::{BTreeMap, BTreeSet};

/// Build the system bundle of `doc` over `members`; `document_sha256` is the
/// SHA-256 of the document's canonical JSON.
pub fn build(doc: &Document, members: &Members, document_sha256: String) -> SystemBundle {
    let mut cx = Context::new(doc, members);
    let named = named_connectors(doc);
    let occurrences = occurrences(&mut cx, &named);
    check_references(&mut cx);
    let mut edges = Vec::new();
    let mates = doc
        .mates
        .iter()
        .map(|mate| map_mate(&mut cx, mate, &mut edges))
        .collect();
    let wired = wiring::wire(&mut cx, &mut edges);
    let nets = nets::system_nets(&mut cx, &named, &edges);
    let suggestions = suggestions::suggest(&cx, &named);
    SystemBundle {
        schema: SCHEMA,
        document_sha256,
        occurrences,
        nets,
        mates,
        links: wired.links,
        splices: wired.splices,
        suggestions,
        findings: cx.findings.finish(&doc.waivers),
    }
}

/// Every sub-port, export and harness-end site must name a connector (and
/// pins) its board has; links and mates are checked as they are wired.
fn check_references(cx: &mut Context<'_>) {
    let doc = cx.doc;
    for sub_port in &doc.sub_ports {
        let objects = [sub_port.id.as_str()];
        if let Some(component) = cx.connector(&sub_port.occurrence, &sub_port.connector, &objects) {
            cx.existing_pads(&sub_port.occurrence, component, &sub_port.pins, &objects);
        }
    }
    for export in &doc.exports {
        cx.connector(
            &export.site.occurrence,
            &export.site.connector,
            &[export.id.as_str()],
        );
    }
    for harness in &doc.harnesses {
        for end in &harness.ends {
            if let Some(site) = &end.site {
                cx.connector(
                    &site.occurrence,
                    &site.connector,
                    &[harness.id.as_str(), end.id.as_str()],
                );
            }
        }
    }
}

/// The connectors each occurrence's document objects name.
pub type Named = BTreeMap<String, BTreeSet<String>>;

fn named_connectors(doc: &Document) -> Named {
    let mut named: Named = BTreeMap::new();
    let mut add = |occurrence: &str, connector: &str| {
        named
            .entry(occurrence.to_owned())
            .or_default()
            .insert(connector.to_owned());
    };
    for sub_port in &doc.sub_ports {
        add(&sub_port.occurrence, &sub_port.connector);
    }
    for mate in &doc.mates {
        add(&mate.a.occurrence, &mate.a.connector);
        add(&mate.b.occurrence, &mate.b.connector);
    }
    for export in &doc.exports {
        add(&export.site.occurrence, &export.site.connector);
    }
    for harness in &doc.harnesses {
        for site in harness.ends.iter().filter_map(|end| end.site.as_ref()) {
            add(&site.occurrence, &site.connector);
        }
        for link in &harness.links {
            add(&link.a.occurrence, &link.a.connector);
            add(&link.b.occurrence, &link.b.connector);
        }
    }
    named
}

/// The connectors a ready board shows: detected ones plus any the document names.
pub fn shown(component: &InterfaceComponent, occurrence: &str, named: &Named) -> bool {
    component.candidate
        || named
            .get(occurrence)
            .is_some_and(|set| set.contains(&component.reference))
}

fn connector_out(component: &InterfaceComponent) -> ConnectorOut {
    let pins = pads(component)
        .into_iter()
        .filter_map(|pad| pin(component, &pad))
        .map(|pin| {
            let mut nets = pin.nets.clone();
            nets.sort();
            nets.dedup();
            PinOut {
                pad: pin.pad.clone(),
                net: first_net(pin).map(str::to_owned),
                nets,
                pin_name: pin
                    .pin_names
                    .as_ref()
                    .and_then(|names| names.first().cloned()),
                pin_type: pin
                    .pin_types
                    .as_ref()
                    .and_then(|types| types.first().cloned()),
                power: power(pin),
            }
        })
        .collect();
    ConnectorOut {
        refdes: component.reference.clone(),
        value: component.value.clone(),
        mpn: component.mpn.clone().filter(|mpn| !mpn.is_empty()),
        candidate: component.candidate,
        pins,
    }
}

fn occurrences(cx: &mut Context<'_>, named: &Named) -> Vec<OccurrenceOut> {
    let mut out = Vec::new();
    for occurrence in &cx.doc.occurrences {
        let id = occurrence.id.as_str();
        let label = cx.label(id);
        let subject = format!("occurrence:{id}");
        let mut entry = OccurrenceOut {
            occurrence: id.to_owned(),
            state: "pending",
            revision_key: None,
            bundle_key: None,
            connectors: Vec::new(),
        };
        if occurrence.source.kind != "board" {
            entry.state = "unsupported";
            let message =
                format!("{label} is a published entry or body; it is checked from a later stage");
            cx.findings
                .add("occurrence-unsupported", subject, message, &[id]);
        } else if let Some(board) = cx.board(id) {
            entry.state = "ready";
            entry.revision_key = Some(board.revision_key.clone());
            entry.bundle_key = Some(board.bundle_key.clone());
            let mut components: Vec<&InterfaceComponent> = board
                .interface
                .components
                .iter()
                .filter(|c| shown(c, id, named))
                .collect();
            components.sort_by(|a, b| natural::cmp(&a.reference, &b.reference));
            entry.connectors = components.into_iter().map(connector_out).collect();
        } else if cx.members.absent.contains(id) {
            entry.state = "absent";
            cx.findings.add(
                "occurrence-absent",
                subject,
                format!("{label}'s project is not present at its commit"),
                &[id],
            );
        } else {
            cx.findings.add(
                "occurrence-pending",
                subject,
                format!("{label}'s design bundle is not built yet"),
                &[id],
            );
        }
        out.push(entry);
    }
    out.sort_by(|a, b| a.occurrence.cmp(&b.occurrence));
    out
}

fn side<'a>(
    cx: &Context<'a>,
    occurrence: &str,
    component: &'a InterfaceComponent,
) -> Option<Side<'a>> {
    let board = cx.board(occurrence)?;
    Some(Side {
        geometry: component.geometry.as_ref()?,
        thickness_mm: board.interface.board_thickness_mm,
    })
}

fn map_mate(cx: &mut Context<'_>, mate: &Mate, edges: &mut Vec<Edge>) -> MateOut {
    let objects = [mate.id.as_str()];
    let a = cx.connector(&mate.a.occurrence, &mate.a.connector, &objects);
    let b = cx.connector(&mate.b.occurrence, &mate.b.connector, &objects);
    let subject = format!("mate:{}", mate.id);
    let mut out = MateOut {
        mate: mate.id.clone(),
        source: "unresolved",
        pairs: Vec::new(),
        unmapped_a: Vec::new(),
        unmapped_b: Vec::new(),
    };
    let (Some(a), Some(b)) = (a, b) else {
        return out;
    };
    let mapping = if let Some(manual) = &mate.manual_map {
        out.source = "manual";
        cx.findings.add(
            "mate-manual-override",
            subject.clone(),
            "The mapping is a manual override, not geometry".into(),
            &objects,
        );
        Some(manual_mapping(cx, mate, a, b, manual))
    } else {
        let derived = side(cx, &mate.a.occurrence, a)
            .zip(side(cx, &mate.b.occurrence, b))
            .and_then(|(sa, sb)| {
                mapping::derive(
                    &sa,
                    &sb,
                    mate.orientation.quarter_turns,
                    mate.orientation.flip,
                )
            });
        if derived.is_some() {
            out.source = "geometry";
        } else {
            let message = format!(
                "{} ↔ {}: the geometry cannot decide the mapping; set it by hand",
                mate.a.connector, mate.b.connector
            );
            cx.findings
                .add("mate-unresolved", subject.clone(), message, &objects);
        }
        derived
    };
    if let Some(mapping) = mapping {
        if !mapping.unmapped_a.is_empty() || !mapping.unmapped_b.is_empty() {
            let count = mapping.unmapped_a.len() + mapping.unmapped_b.len();
            cx.findings.add(
                "mate-pins-unmapped",
                subject,
                format!("{count} pins have no partner"),
                &objects,
            );
        }
        for (pad_a, pad_b) in &mapping.pairs {
            edges.push((
                pin_node(&mate.a.occurrence, &a.reference, pad_a),
                pin_node(&mate.b.occurrence, &b.reference, pad_b),
            ));
        }
        out.pairs = mapping
            .pairs
            .into_iter()
            .map(|(a, b)| PairOut { a, b })
            .collect();
        out.unmapped_a = mapping.unmapped_a;
        out.unmapped_b = mapping.unmapped_b;
    }
    out
}

fn manual_mapping(
    cx: &mut Context<'_>,
    mate: &Mate,
    a: &InterfaceComponent,
    b: &InterfaceComponent,
    manual: &[crate::input::PadPair],
) -> mapping::Mapping {
    let objects = [mate.id.as_str()];
    let pads_a: Vec<String> = manual.iter().map(|pair| pair.a.clone()).collect();
    let pads_b: Vec<String> = manual.iter().map(|pair| pair.b.clone()).collect();
    let kept_a: BTreeSet<String> = cx
        .existing_pads(&mate.a.occurrence, a, &pads_a, &objects)
        .into_iter()
        .collect();
    let kept_b: BTreeSet<String> = cx
        .existing_pads(&mate.b.occurrence, b, &pads_b, &objects)
        .into_iter()
        .collect();
    let mut pairs: Vec<(String, String)> = manual
        .iter()
        .filter(|pair| kept_a.contains(&pair.a) && kept_b.contains(&pair.b))
        .map(|pair| (pair.a.clone(), pair.b.clone()))
        .collect();
    pairs.sort_by(|x, y| natural::cmp(&x.0, &y.0));
    let used_a: BTreeSet<&String> = pairs.iter().map(|pair| &pair.0).collect();
    let used_b: BTreeSet<&String> = pairs.iter().map(|pair| &pair.1).collect();
    let unmapped_a = pads(a)
        .into_iter()
        .filter(|pad| !used_a.contains(pad))
        .collect();
    let unmapped_b = pads(b)
        .into_iter()
        .filter(|pad| !used_b.contains(pad))
        .collect();
    mapping::Mapping {
        pairs,
        unmapped_a,
        unmapped_b,
    }
}

/// The net node of a connector pin.
pub fn pin_node(occurrence: &str, connector: &str, pad: &str) -> Node {
    Node::Pin(PinRef {
        occurrence: occurrence.to_owned(),
        connector: connector.to_owned(),
        pad: pad.to_owned(),
    })
}
