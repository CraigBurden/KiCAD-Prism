//! One system build (`docs/system-builder/CONTRACTS.md` §8): occurrences,
//! references, B2B mappings, then the modules for wiring, nets and
//! suggestions, and finally the findings.

use crate::context::{Context, first_net, pads, pin, power};
use crate::input::{
    Board, Document, InterfaceComponent, Mate, Members, MountFacts, Occurrence, OutlineBox,
};
use crate::mapping::{self, Side};
use crate::natural;
use crate::nets::{Edge, Node};
use crate::output::{
    ConnectorOut, MateOut, MatePadOut, MatePadsOut, OccurrenceOut, OutlineOut, PairOut, PinOut,
    PinRef, PlacementOut, SCHEMA, SystemBundle,
};
use crate::{arrangement, body};
use crate::{harness, nets, suggestions, wiring};
use std::collections::{BTreeMap, BTreeSet};

/// Build the system bundle of `doc` over `members`; `document_sha256` is the
/// SHA-256 of the document's canonical JSON.
pub fn build(doc: &Document, members: &Members, document_sha256: String) -> SystemBundle {
    // Bodies read as boards from here on (§8.10); entries' exports sit at their mounts (§12.2).
    let mut members = members.clone();
    body::add_bodies(doc, &mut members);
    let mounted: Vec<(String, MountFacts)> = members
        .entries
        .iter()
        .map(|(occurrence, facts)| (occurrence.clone(), facts.mount.clone()))
        .collect();
    members.mounted.extend(mounted);
    let members = &members;
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
    let harnesses = harness::resolve(&mut cx, &wired.links, &nets);
    let suggestions = suggestions::suggest(&cx, &named);
    let placement = arrangement::arrange(&mut cx, doc);
    SystemBundle {
        schema: SCHEMA,
        document_sha256,
        occurrences,
        nets,
        mates,
        links: wired.links,
        splices: wired.splices,
        harnesses,
        suggestions,
        findings: cx.findings.finish(&doc.waivers),
        placement,
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

fn connector_out(component: &InterfaceComponent, outline: Option<&OutlineBox>) -> ConnectorOut {
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
        placement: outline.and_then(|outline| placement(component, outline)),
        pins,
    }
}

/// The angle from the outline's centre to the component, and its side (§8.2). The interface's
/// coordinates already have +y up.
fn placement(component: &InterfaceComponent, outline: &OutlineBox) -> Option<PlacementOut> {
    let geometry = component.geometry.as_ref()?;
    let cx = (outline.min_mm[0] + outline.max_mm[0]) / 2.0;
    let cy = (outline.min_mm[1] + outline.max_mm[1]) / 2.0;
    let [x, y] = geometry.position_mm;
    let degrees = (y - cy).atan2(x - cx).to_degrees().rem_euclid(360.0);
    let angle_deg = ((degrees * 1000.0).round() / 1000.0) % 360.0;
    let side = match geometry.side {
        crate::placement::frames::Side::Top => "top",
        crate::placement::frames::Side::Bottom => "bottom",
    };
    Some(PlacementOut { angle_deg, side })
}

/// The outline's bounding box in nanometres.
fn outline_out(outline: &OutlineBox) -> OutlineOut {
    let nm = |mm: f64| (mm * 1_000_000.0).round() as i64;
    OutlineOut {
        width_nm: nm(outline.max_mm[0] - outline.min_mm[0]),
        height_nm: nm(outline.max_mm[1] - outline.min_mm[1]),
    }
}

fn occurrences(cx: &mut Context<'_>, named: &Named) -> Vec<OccurrenceOut> {
    let mut out: Vec<OccurrenceOut> = cx
        .doc
        .occurrences
        .iter()
        .map(|occurrence| occurrence_out(cx, occurrence, named))
        .collect();
    out.sort_by(|a, b| a.occurrence.cmp(&b.occurrence));
    out
}

/// One occurrence's state, keys and connectors, with its state finding (§8.2).
fn occurrence_out(cx: &mut Context<'_>, occurrence: &Occurrence, named: &Named) -> OccurrenceOut {
    let id = occurrence.id.as_str();
    let label = cx.label(id);
    let subject = format!("occurrence:{id}");
    let mut entry = OccurrenceOut {
        occurrence: id.to_owned(),
        state: "pending",
        revision_key: None,
        bundle_key: None,
        outline: None,
        connectors: Vec::new(),
    };
    let kind = occurrence.source.kind.as_str();
    if kind == "body" {
        body_out(cx, id, &label, named, &mut entry);
    } else if kind == "entry" && cx.board(id).is_none() {
        entry.state = "absent";
        let message = format!("{label}'s published revision is not in the catalog");
        cx.findings
            .add("occurrence-absent", subject, message, &[id]);
    } else if let Some(board) = cx.board(id) {
        entry.state = "ready";
        entry.revision_key = Some(board.revision_key.clone()).filter(|key| !key.is_empty());
        entry.bundle_key = Some(board.bundle_key.clone());
        entry_stage(cx, id, &label);
        entry.outline = board.interface.board_outline_mm.as_ref().map(outline_out);
        entry.connectors = ready_connectors(board, id, named);
    } else if cx.members.absent.contains(id) {
        entry.state = "absent";
        let message = format!("{label}'s project is not present at its commit");
        cx.findings
            .add("occurrence-absent", subject, message, &[id]);
    } else {
        let message = format!("{label}'s design bundle is not built yet");
        cx.findings
            .add("occurrence-pending", subject, message, &[id]);
    }
    entry
}

/// A body's state, connectors and findings (§8.10): ready when `--parts` has
/// its part; its connectors placed on the schematic by their angle from the
/// model's centre.
fn body_out(cx: &mut Context<'_>, id: &str, label: &str, named: &Named, entry: &mut OccurrenceOut) {
    let subject = format!("occurrence:{id}");
    let members = cx.members;
    let (Some(board), Some(facts)) = (cx.board(id), members.mounted.get(id)) else {
        entry.state = "absent";
        let message = format!("{label}'s part is not in the catalog");
        cx.findings
            .add("occurrence-absent", subject, message, &[id]);
        return;
    };
    entry.state = "ready";
    entry.connectors = ready_connectors(board, id, named);
    let centre = facts
        .bounds
        .map(|b| {
            [
                (b.min_mm[0] + b.max_mm[0]) / 2.0,
                (b.min_mm[1] + b.max_mm[1]) / 2.0,
            ]
        })
        .unwrap_or([0.0, 0.0]);
    for connector in &mut entry.connectors {
        if let Some(mount) = facts.mounts.get(&connector.refdes) {
            let [x, y, _] = mount.translation_mm;
            let degrees = (y - centre[1])
                .atan2(x - centre[0])
                .to_degrees()
                .rem_euclid(360.0);
            connector.placement = Some(PlacementOut {
                angle_deg: ((degrees * 1000.0).round() / 1000.0) % 360.0,
                side: "top",
            });
        }
    }
    if facts.bounds.is_none() {
        let message = format!("{label}'s part has no converted 3D model; it is placed as a point");
        cx.findings
            .add("body-model-missing", subject, message, &[id]);
    }
    body_connector_findings(cx, id);
}

/// `connector-part-missing` and `connector-pins-unknown` for a body's connectors.
fn body_connector_findings(cx: &mut Context<'_>, id: &str) {
    let doc = cx.doc;
    for connector in doc
        .body_connectors
        .iter()
        .filter(|item| item.occurrence == id)
    {
        let subject = format!("connector:{id}/{}", connector.refdes);
        let objects = [connector.id.as_str()];
        let members = cx.members;
        match members.parts.get(&connector.part.key()) {
            None => cx.findings.add(
                "connector-part-missing",
                subject,
                format!("{}'s part is not in the catalog", connector.refdes),
                &objects,
            ),
            Some(part) if part.pins.is_empty() && part.pads.is_empty() => cx.findings.add(
                "connector-pins-unknown",
                subject,
                format!(
                    "{}'s part has neither a symbol nor a footprint; it has no pins",
                    connector.refdes
                ),
                &objects,
            ),
            Some(_) => {}
        }
    }
}

/// A ready board's connectors in natural reference order.
fn ready_connectors(board: &Board, id: &str, named: &Named) -> Vec<ConnectorOut> {
    let mut components: Vec<&InterfaceComponent> = board
        .interface
        .components
        .iter()
        .filter(|c| shown(c, id, named))
        .collect();
    components.sort_by(|a, b| natural::cmp(&a.reference, &b.reference));
    let outline = board.interface.board_outline_mm.as_ref();
    components
        .into_iter()
        .map(|component| connector_out(component, outline))
        .collect()
}

/// `entry-unreleased` or `entry-archived` for a placed entry's revision (§12.2).
fn entry_stage(cx: &mut Context<'_>, id: &str, label: &str) {
    let Some(facts) = cx.members.entries.get(id) else {
        return;
    };
    let subject = format!("occurrence:{id}");
    match facts.stage.as_str() {
        "released" => {}
        "archived" => cx.findings.add(
            "entry-archived",
            subject,
            format!("{label}'s published revision was archived"),
            &[id],
        ),
        stage => cx.findings.add(
            "entry-unreleased",
            subject,
            format!("{label}'s published revision is not released ({stage})"),
            &[id],
        ),
    }
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
        unsure_mates_top: cx
            .members
            .mounted
            .get(occurrence)
            .is_some_and(|facts| facts.mates_top.contains(&component.reference)),
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
        pads: None,
    };
    let (Some(a), Some(b)) = (a, b) else {
        return out;
    };
    out.pads = side(cx, &mate.a.occurrence, a)
        .zip(side(cx, &mate.b.occurrence, b))
        .and_then(|(sa, sb)| {
            mapping::drawn(
                &sa,
                &sb,
                mate.orientation.quarter_turns,
                mate.orientation.flip,
            )
        })
        .map(|drawn| pads_out(&drawn));
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

/// The drawn pads in nanometres (angles to 1e-6°).
fn pads_out(drawn: &mapping::Drawn) -> MatePadsOut {
    let nm = |mm: f64| (mm * 1_000_000.0).round() as i64;
    let side = |pads: &[mapping::DrawnPad]| {
        pads.iter()
            .map(|pad| MatePadOut {
                pad: pad.pad.clone(),
                x_nm: nm(pad.centre_mm[0]),
                y_nm: nm(pad.centre_mm[1]),
                angle_deg: (pad.angle_deg.rem_euclid(180.0) * 1e6).round() / 1e6 % 180.0,
                long_nm: nm(pad.long_mm),
                short_nm: nm(pad.short_mm),
            })
            .collect()
    };
    MatePadsOut {
        a: side(&drawn.a),
        b: side(&drawn.b),
    }
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
