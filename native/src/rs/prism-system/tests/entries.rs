//! Placed entries in 3D (`docs/system-builder/CONTRACTS.md` §8.9, §12.2): a
//! system's bundle carries its exports' geometry, and a system placing it as
//! an entry mates by that geometry and places the entry as one rigid group,
//! exactly where its contents would land if mated directly.

use prism_system::build::build;
use prism_system::input::{
    Board, Document, InterfaceComponent, InterfacePin, Members, SemanticFacts, SystemInterface,
};
use prism_system::placement::frames::{ConnectorGeometry, Courtyard, PadGeometry, Side};
use serde_json::{Value, json};

/// A 2×4 SMD header at (40, 10) on `side` of a 1.6 mm board, its pins on nets `/N1`…`/N8`.
fn board_with_header(side: Side) -> Board {
    let pads = (0..8)
        .map(|index| PadGeometry {
            pad: (index + 1).to_string(),
            position_mm: [
                (index / 2) as f64 * 2.54 - 3.81 + 40.0,
                if index % 2 == 0 { -1.27 } else { 1.27 } + 10.0,
            ],
            size_mm: Some([1.7, 1.7]),
            shape: Some("rect".to_owned()),
            tht: Some(false),
        })
        .collect();
    Board {
        revision_key: "a".repeat(64),
        bundle_key: "b".repeat(64),
        interface: SystemInterface {
            board_thickness_mm: Some(1.6),
            board_outline_mm: Some(prism_system::input::OutlineBox {
                min_mm: [0.0, 0.0],
                max_mm: [60.0, 30.0],
            }),
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
                    side,
                    position_mm: [40.0, 10.0],
                    rotation_deg: 0.0,
                    footprint_name: Some("PinHeader_2x04_P2.54mm_Vertical".to_owned()),
                    pads,
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

fn board_occurrence(id: &str) -> Value {
    json!({"id": id, "label": id, "source": {"kind": "board", "projectId": "prj_000000000001"}})
}

fn mate(a: (&str, &str), b: (&str, &str)) -> Value {
    json!({
        "id": "mate_1", "a": {"occurrence": a.0, "connector": a.1}, "b": {"occurrence": b.0, "connector": b.1},
        "orientation": {"quarterTurns": 0, "flip": false}, "stackHeightNm": 3_000_000, "rows": {},
    })
}

fn bundle(doc: Value, members: &Members) -> Value {
    let doc: Document = serde_json::from_value(doc).expect("document");
    serde_json::to_value(build(&doc, members, "0".repeat(64))).expect("serialise")
}

/// The child system: one card, turned and lifted off the origin, its J1 exported.
fn child(side: Side) -> Value {
    let mut card = board_occurrence("occ_card");
    card["pose"] = json!({
        "translation": {"xNm": 5_000_000, "yNm": 7_000_000, "zNm": 3_000_000},
        "rotation": {"x": 0.0, "y": 0.0, "z": std::f64::consts::FRAC_1_SQRT_2, "w": std::f64::consts::FRAC_1_SQRT_2},
    });
    let doc = json!({
        "occurrences": [card],
        "exports": [{"id": "exp_j1", "name": "Power in", "site": {"occurrence": "occ_card", "connector": "J1"}, "pinNames": {}}],
    });
    let mut members = Members::default();
    members
        .boards
        .insert("occ_card".to_owned(), board_with_header(side));
    bundle(doc, &members)
}

/// The child as a published entry's payload, its export pins on the child's nets.
fn payload(child: &Value) -> Value {
    let pins: Vec<Value> = (1..=8)
        .map(|n| json!({"pad": n.to_string(), "name": n.to_string(), "net": format!("net_{n}"), "signal": format!("/N{n}")}))
        .collect();
    json!({
        "schema": "prism.system_entry.a0",
        "source": {"systemId": "sys_child", "version": 1, "snapshotId": "snap_1", "systemBundleKey": "c".repeat(64)},
        "document": {},
        "boardSubPorts": {},
        "bundle": child,
        "interface": {"exports": [{"id": "exp_j1", "name": "Power in", "occurrence": "occ_card", "connector": "J1", "pins": pins}]},
    })
}

fn placed<'a>(bundle: &'a Value, occurrence: &str) -> &'a Value {
    bundle["placement"]["occurrences"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["occurrence"] == occurrence)
        .unwrap()
}

fn vector(value: &Value) -> [f64; 3] {
    ["xNm", "yNm", "zNm"].map(|axis| value[axis].as_f64().unwrap() / 1e6)
}

fn quaternion(value: &Value) -> [f64; 4] {
    ["x", "y", "z", "w"].map(|axis| value[axis].as_f64().unwrap())
}

/// `parent · child` for two placement poses, as (translation mm, rotation).
fn compose(parent: &Value, child: &Value) -> ([f64; 3], [f64; 4]) {
    use prism_system::placement::poses::{Pose, compose};
    let pose = |value: &Value| Pose {
        translation_mm: vector(&value["translation"]),
        rotation: quaternion(&value["rotation"]),
    };
    let out = compose(&pose(parent), &pose(child));
    (out.translation_mm, out.rotation)
}

fn close(a: &[f64], b: &[f64]) -> bool {
    a.iter().zip(b).all(|(x, y)| (x - y).abs() < 1e-6)
}

#[test]
fn a_system_bundle_places_its_exports() {
    let child = child(Side::Top);
    let exports = child["placement"]["exports"].as_array().unwrap();
    assert_eq!(exports.len(), 1);
    let export = &exports[0];
    assert_eq!(export["export"], "exp_j1");
    assert_eq!(export["matesTop"], false);
    assert_eq!(
        export["geometry"]["footprintName"],
        "PinHeader_2x04_P2.54mm_Vertical"
    );
    // The card's frame, lifted to its top surface: z = 3 + 1.6 / 2.
    assert!(close(
        &vector(&export["mount"]["translation"]),
        &[5.0, 7.0, 3.8]
    ));
    let bottom = child_export_z(Side::Bottom);
    assert!((bottom - 2.2).abs() < 1e-6, "bottom {bottom}");
}

fn child_export_z(side: Side) -> f64 {
    vector(&child(side)["placement"]["exports"][0]["mount"]["translation"])[2]
}

#[test]
fn a_board_mated_to_an_entry_lands_where_it_would_on_the_contents() {
    for side in [Side::Top, Side::Bottom] {
        let child = child(side);
        let (board, facts) = prism_system::entry::board(&payload(&child), "released");

        // Through the entry: a base board's J1 mated to the entry's export.
        let mut through = Members::default();
        through
            .boards
            .insert("occ_base".to_owned(), board_with_header(Side::Top));
        through.boards.insert("occ_unit".to_owned(), board);
        through.entries.insert("occ_unit".to_owned(), facts);
        let unit = json!({"id": "occ_unit", "label": "unit", "source": {"kind": "entry", "componentId": "cmp_unit", "revisionId": "rev_1"}});
        let via = bundle(
            json!({"occurrences": [board_occurrence("occ_base"), unit], "mates": [mate(("occ_base", "J1"), ("occ_unit", "exp_j1"))]}),
            &through,
        );
        let codes: Vec<&str> = via["findings"]
            .as_array()
            .unwrap()
            .iter()
            .map(|finding| finding["code"].as_str().unwrap())
            .collect();
        assert!(!codes.contains(&"mate-unresolved"), "{side:?}: {codes:?}");
        assert_eq!(
            via["mates"][0]["pairs"].as_array().unwrap().len(),
            8,
            "{side:?}"
        );
        let entry = placed(&via, "occ_unit");
        assert_eq!(entry["source"], "mate", "{side:?}");
        assert!(entry["bounds"].is_object(), "{side:?}: the contents' box");
        let card_through = compose(&entry["pose"], &placed(&child, "occ_card")["pose"]);

        // Directly: the same card mated to the same base.
        let mut direct = Members::default();
        direct
            .boards
            .insert("occ_base".to_owned(), board_with_header(Side::Top));
        direct
            .boards
            .insert("occ_card".to_owned(), board_with_header(side));
        let straight = bundle(
            json!({"occurrences": [board_occurrence("occ_base"), board_occurrence("occ_card")], "mates": [mate(("occ_base", "J1"), ("occ_card", "J1"))]}),
            &direct,
        );
        let card = placed(&straight, "occ_card");
        assert!(
            close(&card_through.0, &vector(&card["pose"]["translation"])),
            "{side:?}: {:?} vs {:?}",
            card_through.0,
            card["pose"]["translation"]
        );
        let q = quaternion(&card["pose"]["rotation"]);
        let same = close(&card_through.1, &q) || close(&card_through.1, &q.map(|v| -v));
        assert!(same, "{side:?}: {:?} vs {q:?}", card_through.1);
    }
}

#[test]
fn an_entry_published_without_export_geometry_needs_a_manual_map() {
    let mut child = child(Side::Top);
    child["placement"]
        .as_object_mut()
        .unwrap()
        .remove("exports");
    let (board, facts) = prism_system::entry::board(&payload(&child), "released");
    let mut members = Members::default();
    members
        .boards
        .insert("occ_base".to_owned(), board_with_header(Side::Top));
    members.boards.insert("occ_unit".to_owned(), board);
    members.entries.insert("occ_unit".to_owned(), facts);
    let unit = json!({"id": "occ_unit", "label": "unit", "source": {"kind": "entry", "componentId": "cmp_unit", "revisionId": "rev_1"}});
    let out = bundle(
        json!({"occurrences": [board_occurrence("occ_base"), unit], "mates": [mate(("occ_base", "J1"), ("occ_unit", "exp_j1"))]}),
        &members,
    );
    assert!(
        out["findings"]
            .as_array()
            .unwrap()
            .iter()
            .any(|finding| finding["code"] == "mate-unresolved")
    );
}

/// A 1x04 vertical header's pads in its footprint frame (+y up), as `--parts` reads them.
fn header_1x04() -> Vec<PadGeometry> {
    (0..4)
        .map(|index| PadGeometry {
            pad: (index + 1).to_string(),
            position_mm: [0.0, -2.54 * index as f64],
            size_mm: Some([1.7, 1.7]),
            shape: Some(if index == 0 { "rect" } else { "circle" }.to_owned()),
            tht: Some(true),
        })
        .collect()
}

#[test]
fn a_body_connector_maps_the_same_through_an_entry() {
    use prism_system::input::{PartFacts, PartPin};
    use prism_system::placement::poses::Bounds;
    let part = |id: &str, pads: Vec<PadGeometry>, bounds: Option<Bounds>| PartFacts {
        component_id: id.to_owned(),
        revision_id: "rev_1".to_owned(),
        name: id.to_owned(),
        pins: (1..=pads.len())
            .map(|n| PartPin {
                number: n.to_string(),
                name: format!("Pin_{n}"),
                electrical_type: "passive".to_owned(),
            })
            .collect(),
        pads,
        footprint_name: Some("PinHeader_1x04_P2.54mm_Vertical".to_owned()),
        courtyard: Some(Courtyard {
            min_mm: [-1.77, -9.39],
            max_mm: [1.77, 1.77],
        }),
        model_bounds: bounds,
        ..PartFacts::default()
    };
    let mut parts = Members::default();
    parts.parts.insert(
        "cmp_box@rev_1".to_owned(),
        part(
            "cmp_box",
            Vec::new(),
            Some(prism_system::placement::poses::Bounds {
                min_mm: [-8.0, -12.0, 0.0],
                max_mm: [8.0, 12.0, 8.25],
            }),
        ),
    );
    parts.parts.insert(
        "cmp_hdr@rev_1".to_owned(),
        part("cmp_hdr", header_1x04(), None),
    );
    let body = json!({"id": "occ_box", "label": "Box", "source": {"kind": "body", "componentId": "cmp_box", "revisionId": "rev_1"}});
    let connector = json!([{"id": "bc_1", "occurrence": "occ_box", "refdes": "J1", "part": {"componentId": "cmp_hdr", "revisionId": "rev_1"},
        "frame": {"translation": {"xNm": 0, "yNm": 0, "zNm": 8_250_000}, "rotation": {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0}}, "quarterTurns": 0}]);
    // A carrier with the same header on its top side.
    let mut carrier = board_with_header(Side::Top);
    let geometry = carrier.interface.components[0].geometry.as_mut().unwrap();
    geometry.pads = header_1x04()
        .into_iter()
        .map(|mut pad| {
            pad.position_mm = [pad.position_mm[0] + 40.0, pad.position_mm[1] + 10.0];
            pad
        })
        .collect();
    carrier.interface.components[0].pins.truncate(4);

    // Directly: the carrier mated to the body's J1.
    let mut direct = parts.clone();
    direct.boards.insert("occ_base".to_owned(), carrier.clone());
    let straight = bundle(
        json!({"occurrences": [board_occurrence("occ_base"), body.clone()], "bodyConnectors": connector.clone(), "mates": [mate(("occ_base", "J1"), ("occ_box", "J1"))]}),
        &direct,
    );
    let direct_pairs = straight["mates"][0]["pairs"].clone();
    assert_eq!(
        direct_pairs.as_array().unwrap().len(),
        4,
        "{}",
        straight["mates"][0]
    );

    // Through an entry: the body published with J1 exported.
    let child = bundle(
        json!({"occurrences": [body], "bodyConnectors": connector, "exports": [{"id": "exp_j1", "name": "Out", "site": {"occurrence": "occ_box", "connector": "J1"}, "pinNames": {}}]}),
        &parts,
    );
    let mut payload = payload(&child);
    payload["interface"]["exports"][0]["occurrence"] = json!("occ_box");
    payload["interface"]["exports"][0]["pins"] = json!(
        (1..=4)
            .map(
                |n| json!({"pad": n.to_string(), "name": n.to_string(), "net": format!("net_{n}")})
            )
            .collect::<Vec<_>>()
    );
    let (board, facts) = prism_system::entry::board(&payload, "released");
    let mut through = Members::default();
    through.boards.insert("occ_base".to_owned(), carrier);
    through.boards.insert("occ_unit".to_owned(), board);
    through.entries.insert("occ_unit".to_owned(), facts);
    let unit = json!({"id": "occ_unit", "label": "unit", "source": {"kind": "entry", "componentId": "cmp_unit", "revisionId": "rev_1"}});
    let via = bundle(
        json!({"occurrences": [board_occurrence("occ_base"), unit], "mates": [mate(("occ_base", "J1"), ("occ_unit", "exp_j1"))]}),
        &through,
    );
    assert_eq!(
        via["mates"][0]["pairs"], direct_pairs,
        "{}",
        via["mates"][0]
    );
}
