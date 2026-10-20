//! Body occurrences and body connectors (`docs/system-builder/CONTRACTS.md`
//! §8.10) on synthetic parts: a body reads as a board of its connectors, and
//! a board mated to a body connector is placed through the connector's mount.

use prism_system::build::build;
use prism_system::input::{
    Board, Document, InterfaceComponent, InterfacePin, Members, PartFacts, PartPin, SemanticFacts,
    SystemInterface,
};
use prism_system::placement::frames::{ConnectorGeometry, Courtyard, PadGeometry, Side};
use prism_system::placement::poses::Bounds;
use serde_json::{Value, json};

/// A 2×4 SMD header's pads (an SMD connector mates out of its top face), 2.54 mm
/// pitch, pad 1 at the far left of the lower row (+y up).
fn header_pads() -> Vec<PadGeometry> {
    (0..8)
        .map(|index| PadGeometry {
            pad: (index + 1).to_string(),
            position_mm: [
                (index / 2) as f64 * 2.54 - 3.81,
                if index % 2 == 0 { -1.27 } else { 1.27 },
            ],
            size_mm: Some([1.7, 1.7]),
            shape: Some("rect".to_owned()),
            tht: Some(false),
        })
        .collect()
}

fn header_part(with_symbol: bool) -> PartFacts {
    PartFacts {
        component_id: "cmp_header".to_owned(),
        revision_id: "rev_h1".to_owned(),
        name: "Header 2x4".to_owned(),
        mpn: Some("HDR-2x4".to_owned()),
        pins: if with_symbol {
            (1..=8)
                .map(|number| PartPin {
                    number: number.to_string(),
                    name: format!("P{number}"),
                    electrical_type: "passive".to_owned(),
                })
                .collect()
        } else {
            Vec::new()
        },
        pads: header_pads(),
        // No name and no courtyard: an unsure frame, which on a body mates out of its top face.
        footprint_name: None,
        courtyard: None,
        model_bounds: None,
    }
}

fn box_part(with_model: bool) -> PartFacts {
    PartFacts {
        component_id: "cmp_box".to_owned(),
        revision_id: "rev_b1".to_owned(),
        name: "Enclosure".to_owned(),
        mpn: None,
        pins: Vec::new(),
        pads: Vec::new(),
        footprint_name: None,
        courtyard: None,
        model_bounds: with_model.then_some(Bounds {
            min_mm: [-30.0, -20.0, 0.0],
            max_mm: [30.0, 20.0, 15.0],
        }),
    }
}

/// A board with the same header on its top side at (40, 10), unturned.
fn board_with_header() -> Board {
    Board {
        revision_key: "a".repeat(64),
        bundle_key: "b".repeat(64),
        interface: SystemInterface {
            board_thickness_mm: Some(1.6),
            board_outline_mm: None,
            components: vec![InterfaceComponent {
                reference: "J1".to_owned(),
                value: "Header 2x4".to_owned(),
                mpn: None,
                candidate: true,
                pins: (1..=8)
                    .map(|number| InterfacePin {
                        pad: number.to_string(),
                        nets: vec![format!("/N{number}")],
                        pin_names: None,
                        pin_types: None,
                        power_net: false,
                    })
                    .collect(),
                geometry: Some(ConnectorGeometry {
                    side: Side::Top,
                    position_mm: [40.0, 10.0],
                    rotation_deg: 0.0,
                    // A named vertical header with its courtyard over the pads: a sure frame on a board.
                    footprint_name: Some("PinHeader_2x04_P2.54mm_Vertical".to_owned()),
                    pads: header_pads()
                        .into_iter()
                        .map(|mut pad| {
                            pad.position_mm =
                                [pad.position_mm[0] + 40.0, pad.position_mm[1] + 10.0];
                            pad
                        })
                        .collect(),
                    courtyard: Some(Courtyard {
                        min_mm: [-5.5, -2.5],
                        max_mm: [5.5, 2.5],
                    }),
                    model: None,
                }),
            }],
        },
        semantic: SemanticFacts::default(),
    }
}

/// A body with one header on its top face (z = 15 mm), turned `turns` quarters.
fn document(turns: i32, mate: bool) -> Document {
    let mut doc = json!({
        "occurrences": [
            {"id": "occ_box", "label": "Box", "source": {"kind": "body", "componentId": "cmp_box", "revisionId": "rev_b1"}},
        ],
        "bodyConnectors": [{
            "id": "bc_1", "occurrence": "occ_box", "refdes": "J10",
            "part": {"componentId": "cmp_header", "revisionId": "rev_h1"},
            "frame": {"translation": {"xNm": 10_000_000, "yNm": 0, "zNm": 15_000_000}, "rotation": {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0}},
            "quarterTurns": turns,
        }],
    });
    if mate {
        doc["occurrences"].as_array_mut().unwrap().push(
            json!({"id": "occ_card", "label": "Card", "source": {"kind": "board", "projectId": "prj_000000000001"}}),
        );
        doc["mates"] = json!([{
            "id": "mate_1", "a": {"occurrence": "occ_box", "connector": "J10"}, "b": {"occurrence": "occ_card", "connector": "J1"},
            "orientation": {"quarterTurns": 0, "flip": false}, "stackHeightNm": 0, "rows": {},
        }]);
    }
    serde_json::from_value(doc).expect("document")
}

fn members(symbol: bool, model: bool, card: bool) -> Members {
    let mut members = Members::default();
    members
        .parts
        .insert("cmp_box@rev_b1".to_owned(), box_part(model));
    members
        .parts
        .insert("cmp_header@rev_h1".to_owned(), header_part(symbol));
    if card {
        members
            .boards
            .insert("occ_card".to_owned(), board_with_header());
    }
    members
}

fn bundle(doc: &Document, members: &Members) -> Value {
    serde_json::to_value(build(doc, members, "0".repeat(64))).expect("serialise")
}

fn codes(bundle: &Value) -> Vec<(String, String)> {
    bundle["findings"]
        .as_array()
        .unwrap()
        .iter()
        .map(|finding| {
            (
                finding["code"].as_str().unwrap().to_owned(),
                finding["subject"].as_str().unwrap().to_owned(),
            )
        })
        .collect()
}

fn vector(value: &Value) -> [f64; 3] {
    ["xNm", "yNm", "zNm"].map(|axis| value[axis].as_f64().unwrap() / 1e6)
}

#[test]
fn a_body_reads_as_a_board_of_its_connectors() {
    let bundle = bundle(&document(0, false), &members(true, true, false));
    let body = &bundle["occurrences"][0];
    assert_eq!(body["state"], "ready");
    let connector = &body["connectors"][0];
    assert_eq!(connector["refdes"], "J10");
    assert_eq!(connector["value"], "Header 2x4");
    assert_eq!(connector["pins"].as_array().unwrap().len(), 8);
    assert_eq!(connector["pins"][0]["pinName"], "P1");
    // The mount is right of the model's centre: angle 0.
    assert_eq!(connector["placement"]["angleDeg"], 0.0);
    let placed = &bundle["placement"]["occurrences"][0];
    assert_eq!(placed["source"], "default");
    assert_eq!(vector(&placed["bounds"]["max"]), [30.0, 20.0, 15.0]);
    assert!(codes(&bundle).is_empty(), "{:?}", codes(&bundle));
}

#[test]
fn missing_parts_models_and_pins_are_findings() {
    let doc = document(0, false);
    let found = codes(&bundle(&doc, &members(true, false, false)));
    assert!(found.contains(&(
        "body-model-missing".to_owned(),
        "occurrence:occ_box".to_owned()
    )));

    let mut bare = members(false, true, false);
    bare.parts
        .get_mut("cmp_header@rev_h1")
        .unwrap()
        .pads
        .clear();
    let found = codes(&bundle(&doc, &bare));
    assert!(found.contains(&(
        "connector-pins-unknown".to_owned(),
        "connector:occ_box/J10".to_owned()
    )));

    let mut gone = members(true, true, false);
    gone.parts.remove("cmp_header@rev_h1");
    let found = codes(&bundle(&doc, &gone));
    assert!(found.contains(&(
        "connector-part-missing".to_owned(),
        "connector:occ_box/J10".to_owned()
    )));

    // Without a symbol, the footprint's pads are the pins, unnamed.
    let unnamed = bundle(&doc, &members(false, true, false));
    let pin = &unnamed["occurrences"][0]["connectors"][0]["pins"][0];
    assert_eq!(pin["pad"], "1");
    assert!(pin.get("pinName").is_none());
}

#[test]
fn a_board_mated_to_a_body_connector_lands_on_its_frame() {
    for turns in 0..4 {
        let bundle = bundle(&document(turns, true), &members(true, true, true));
        let mate = &bundle["placement"]["mates"][0];
        assert_eq!(mate["driving"], true, "turns {turns}");
        let card = bundle["placement"]["occurrences"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["occurrence"] == "occ_card")
            .unwrap()
            .clone();
        assert_eq!(card["source"], "mate");
        // At stack height 0 the two connector frames meet: same origin.
        let (a, b) = (
            vector(&mate["frameA"]["translation"]),
            vector(&mate["frameB"]["translation"]),
        );
        let apart = ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt();
        assert!(apart < 1e-6, "turns {turns}: frames {apart} mm apart");
        // The body connector's frame sits on its stored face point: (10, 0, 15) in the body, placed at the default row.
        let body = bundle["placement"]["occurrences"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["occurrence"] == "occ_box")
            .unwrap()
            .clone();
        let origin = vector(&body["pose"]["translation"]);
        assert!(
            (a[0] - (origin[0] + 10.0)).abs() < 1e-6 && (a[2] - (origin[2] + 15.0)).abs() < 1e-6,
            "turns {turns}: {a:?}"
        );
        // Every pin pairs with its namesake through the mate.
        let pairs = bundle["mates"][0]["pairs"].as_array().unwrap();
        assert_eq!(pairs.len(), 8, "turns {turns}");
    }
}
