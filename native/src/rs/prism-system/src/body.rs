//! Body occurrences (CONTRACTS §8.10, ADR §2.1, §2.6): a mechanical catalog
//! part with connector parts placed on its faces.
//!
//! A body reads as a board whose components are its body connectors, so the
//! connectivity, mapping and placement rules apply to it unchanged:
//!
//! - a body connector's pins are its part's symbol pins, or its footprint's
//!   pad numbers without a symbol. A body has no board nets: an exported pin's
//!   net is the name its export gives it, so pins given one name are one
//!   signal, and an exported pin without a name gets KiCad's automatic form
//!   `Net-(J1-Pad3)`; a pin no export covers has no net;
//! - its geometry is the part's footprint in the footprint's own frame, at
//!   zero thickness, so the B2B mapping and the drawn pads read it as they
//!   read a board's;
//! - its footprint sits in the body at `Q = P · Rz(k · 90°) · F_part⁻¹`
//!   (the kept module-ports rule): `P` the stored mating frame on the face,
//!   `k` its quarter turns, `F_part` the footprint's own mating frame. The
//!   placement composes `Q` where a board has the identity.

use crate::input::{
    Board, BodyConnector, Document, InterfaceComponent, InterfacePin, Members, MountFacts,
    PartFacts, PoseIn, SemanticFacts, SystemInterface, part_key,
};
use crate::natural;
use crate::placement::frames::{
    Confidence, ConnectorGeometry, MatingAxis, Side, StoredFrame, connector_frame, infer,
};
use crate::placement::mate::inverse;
use crate::placement::poses::{Pose, canonical_rotation, compose};
use std::collections::BTreeMap;

const NM_PER_MM: f64 = 1_000_000.0;

/// `Rz(k · 90°)`, x → y, canonical (`w ≥ 0`).
const QUARTER: [[f64; 4]; 4] = [
    [0.0, 0.0, 0.0, 1.0],
    [
        0.0,
        0.0,
        std::f64::consts::FRAC_1_SQRT_2,
        std::f64::consts::FRAC_1_SQRT_2,
    ],
    [0.0, 0.0, 1.0, 0.0],
    [
        0.0,
        0.0,
        -std::f64::consts::FRAC_1_SQRT_2,
        std::f64::consts::FRAC_1_SQRT_2,
    ],
];

fn pose_in(pose: &PoseIn) -> Pose {
    Pose {
        translation_mm: [
            pose.translation.x_nm as f64 / NM_PER_MM,
            pose.translation.y_nm as f64 / NM_PER_MM,
            pose.translation.z_nm as f64 / NM_PER_MM,
        ],
        rotation: canonical_rotation([
            pose.rotation.x,
            pose.rotation.y,
            pose.rotation.z,
            pose.rotation.w,
        ]),
    }
}

/// The part's footprint as connector geometry in its own frame, or `None` without pads.
pub fn footprint_geometry(part: &PartFacts) -> Option<ConnectorGeometry> {
    if part.pads.is_empty() {
        return None;
    }
    Some(ConnectorGeometry {
        side: Side::Top,
        position_mm: [0.0, 0.0],
        rotation_deg: 0.0,
        footprint_name: part.footprint_name.clone(),
        pads: part.pads.clone(),
        courtyard: part.courtyard.clone(),
        model: None,
    })
}

/// The footprint's own mating frame at zero thickness; an unsure inference
/// mates out of the top face (the kept module-ports fallback).
fn part_frame(geometry: &ConnectorGeometry) -> Option<Pose> {
    let stored = (infer(Some(geometry)).confidence == Confidence::Low).then_some(StoredFrame {
        axis: MatingAxis::Top,
        quarter_turns: None,
    });
    let frame = connector_frame(Some(geometry), Some(0.0), stored.as_ref())?;
    Some(Pose {
        translation_mm: frame.origin_mm,
        rotation: frame.rotation,
    })
}

/// `Q`: the body connector's footprint frame in the body's frame.
pub fn mount(connector: &BodyConnector, geometry: Option<&ConnectorGeometry>) -> Pose {
    let turn = Pose {
        translation_mm: [0.0; 3],
        rotation: QUARTER[connector.quarter_turns.rem_euclid(4) as usize],
    };
    let placed = compose(&pose_in(&connector.frame), &turn);
    match geometry.and_then(part_frame) {
        Some(frame) => compose(&placed, &inverse(&frame)),
        None => placed,
    }
}

/// Each exported body pin's net, by `(occurrence, refdes)` then pad (§8.10).
fn exported_nets(doc: &Document) -> BTreeMap<(&str, &str), BTreeMap<String, String>> {
    let mut out: BTreeMap<(&str, &str), BTreeMap<String, String>> = BTreeMap::new();
    for export in &doc.exports {
        let site = &export.site;
        // A sub-port export covers its pads; a whole connector, every pad (`None`).
        let covered: Option<Vec<&str>> = site.sub_port.as_ref().map(|sub_port| {
            doc.sub_ports
                .iter()
                .filter(|candidate| candidate.id == sub_port.id)
                .flat_map(|candidate| candidate.pins.iter().map(String::as_str))
                .collect()
        });
        let nets = out
            .entry((site.occurrence.as_str(), site.connector.as_str()))
            .or_default();
        let named = |pad: &str| match export.pin_names.get(pad).map(|name| name.trim()) {
            Some(name) if !name.is_empty() => name.to_owned(),
            _ => format!("Net-({}-Pad{pad})", site.connector),
        };
        match covered {
            Some(pads) => {
                for pad in pads {
                    nets.entry(pad.to_owned()).or_insert_with(|| named(pad));
                }
            }
            // `*` stands for every pad of the connector, named at `pins`.
            None => {
                nets.entry("*".to_owned()).or_default();
                for (pad, name) in &export.pin_names {
                    if !name.trim().is_empty() {
                        nets.entry(pad.clone())
                            .or_insert_with(|| name.trim().to_owned());
                    }
                }
            }
        }
    }
    out
}

/// The pins a body connector carries: its symbol's, else its footprint's pad numbers.
fn pins(part: &PartFacts) -> Vec<InterfacePin> {
    let named = |number: &str, name: &str, kind: &str| InterfacePin {
        pad: number.to_owned(),
        nets: Vec::new(),
        pin_names: (!name.is_empty()).then(|| vec![name.to_owned()]),
        pin_types: (!kind.is_empty()).then(|| vec![kind.to_owned()]),
        power_net: false,
    };
    let mut out: Vec<InterfacePin> = if part.pins.is_empty() {
        let mut numbers: Vec<String> = part
            .pads
            .iter()
            .map(|pad| pad.pad.clone())
            .filter(|pad| !pad.is_empty())
            .collect();
        numbers.sort_by(|a, b| natural::cmp(a, b));
        numbers.dedup();
        numbers.iter().map(|number| named(number, "", "")).collect()
    } else {
        part.pins
            .iter()
            .map(|pin| named(&pin.number, &pin.name, &pin.electrical_type))
            .collect()
    };
    out.sort_by(|a, b| natural::cmp(&a.pad, &b.pad));
    out
}

/// One body connector as a component of its body's board; `nets` are its
/// exported pins' nets by pad (`*`: every pad is exported).
fn component(
    connector: &BodyConnector,
    part: Option<&PartFacts>,
    nets: Option<&BTreeMap<String, String>>,
) -> InterfaceComponent {
    let mut pins = part.map(pins).unwrap_or_default();
    if let Some(nets) = nets {
        let every = nets.contains_key("*");
        for pin in &mut pins {
            let net = match nets.get(&pin.pad) {
                Some(name) => name.clone(),
                None if every => format!("Net-({}-Pad{})", connector.refdes, pin.pad),
                None => continue,
            };
            pin.nets = vec![net];
        }
    }
    InterfaceComponent {
        reference: connector.refdes.clone(),
        value: part.map(|part| part.name.clone()).unwrap_or_default(),
        mpn: part.and_then(|part| part.mpn.clone()),
        candidate: true,
        pins,
        geometry: part.and_then(footprint_geometry),
    }
}

/// Add every body occurrence whose part `--parts` resolved to `members`: its
/// connectors as a board in `boards`, its bounds and mounts in `bodies`.
pub fn add_bodies(doc: &Document, members: &mut Members) {
    let exported = exported_nets(doc);
    let mut by_body: BTreeMap<&str, Vec<&BodyConnector>> = BTreeMap::new();
    for connector in &doc.body_connectors {
        by_body
            .entry(connector.occurrence.as_str())
            .or_default()
            .push(connector);
    }
    for occurrence in &doc.occurrences {
        let source = &occurrence.source;
        if source.kind != "body" {
            continue;
        }
        let Some(component_id) = source.component_id.as_deref() else {
            continue;
        };
        let Some(part) = members
            .parts
            .get(&part_key(component_id, source.revision_id.as_deref()))
        else {
            continue;
        };
        let bounds = part.model_bounds;
        let mut connectors = by_body.remove(occurrence.id.as_str()).unwrap_or_default();
        connectors.sort_by(|a, b| natural::cmp(&a.refdes, &b.refdes));
        let mut components = Vec::new();
        let mut mounts = BTreeMap::new();
        for connector in connectors {
            let part = members.parts.get(&connector.part.key());
            let nets = exported.get(&(occurrence.id.as_str(), connector.refdes.as_str()));
            let component = component(connector, part, nets);
            mounts.insert(
                connector.refdes.clone(),
                mount(connector, component.geometry.as_ref()),
            );
            components.push(component);
        }
        members.boards.insert(
            occurrence.id.clone(),
            Board {
                revision_key: String::new(),
                bundle_key: String::new(),
                interface: SystemInterface {
                    board_thickness_mm: Some(0.0),
                    board_outline_mm: None,
                    components,
                },
                semantic: SemanticFacts::default(),
            },
        );
        let mates_top = mounts.keys().cloned().collect();
        members.mounted.insert(
            occurrence.id.clone(),
            MountFacts {
                bounds,
                mounts,
                mates_top,
            },
        );
    }
}
