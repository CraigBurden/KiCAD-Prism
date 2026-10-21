//! Harness routes in 3D (`docs/system-builder/CONTRACTS.md` §16.6): two
//! boards side by side, each with a vertical 2×4 header, joined by a harness
//! whose link wires the eight pins by net name. The route is derived, or runs
//! the stored segments through their waypoints; bends, clearance, typed
//! lengths and unplaced ends are checked.

use prism_system::build::build;
use prism_system::input::{
    Board, Document, InterfaceComponent, InterfacePin, Members, OutlineBox, SemanticFacts,
    SystemInterface,
};
use prism_system::placement::frames::{ConnectorGeometry, Courtyard, PadGeometry, Side};
use serde_json::{Value, json};

/// A 60 × 30 mm board with a 2×4 SMD header at (40, 10), pins on `/N1`…`/N8`.
fn board(geometry: bool) -> Board {
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
            board_outline_mm: Some(OutlineBox {
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
                geometry: geometry.then(|| ConnectorGeometry {
                    side: Side::Top,
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

fn occurrence(id: &str, x_nm: i64) -> Value {
    json!({
        "id": id, "label": id.to_uppercase(), "source": {"kind": "board", "projectId": "prj_000000000001"},
        "pose": {"translation": {"xNm": x_nm, "yNm": 0, "zNm": 0}, "rotation": {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0}},
    })
}

fn site(occurrence: &str) -> Value {
    json!({"occurrence": occurrence, "connector": "J1"})
}

/// Board A at the origin, board B 100 mm along x; harness H1 joins their J1s.
fn document(extra: Value) -> Value {
    let mut harness = json!({
        "id": "har_1", "label": "H1",
        "ends": [
            {"id": "end_a", "site": site("occ_a"), "contacts": {}, "pinMap": []},
            {"id": "end_b", "site": site("occ_b"), "contacts": {}, "pinMap": []}
        ],
        "links": [{"id": "link_1", "a": site("occ_a"), "b": site("occ_b"), "unmapped": []}],
        "wires": [], "splices": [], "segments": [], "branchPoints": [], "waypoints": []
    });
    for (key, value) in extra.as_object().expect("object") {
        harness[key] = value.clone();
    }
    json!({"occurrences": [occurrence("occ_a", 0), occurrence("occ_b", 100_000_000)], "harnesses": [harness]})
}

fn run(doc: Value, b_has_geometry: bool) -> Value {
    let doc: Document = serde_json::from_value(doc).expect("document");
    let mut members = Members::default();
    members.boards.insert("occ_a".to_owned(), board(true));
    members
        .boards
        .insert("occ_b".to_owned(), board(b_has_geometry));
    serde_json::to_value(build(&doc, &members, "0".repeat(64))).expect("serialise")
}

fn codes(bundle: &Value) -> Vec<String> {
    bundle["findings"]
        .as_array()
        .unwrap()
        .iter()
        .map(|finding| finding["code"].as_str().unwrap().to_owned())
        .collect()
}

fn samples(segment: &Value) -> Vec<[f64; 3]> {
    let flat: Vec<f64> = segment["samplesNm"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_i64().unwrap() as f64 / 1e6)
        .collect();
    flat.chunks(3).map(|p| [p[0], p[1], p[2]]).collect()
}

fn nearest(points: &[[f64; 3]], to: [f64; 3]) -> f64 {
    points
        .iter()
        .map(|p| ((p[0] - to[0]).powi(2) + (p[1] - to[1]).powi(2) + (p[2] - to[2]).powi(2)).sqrt())
        .fold(f64::INFINITY, f64::min)
}

fn wire(id: &str, cavity: &str, extra: Value) -> Value {
    let mut wire = json!({
        "id": id, "link": "link_1",
        "from": {"kind": "contact", "end": "end_a", "cavity": cavity},
        "to": {"kind": "contact", "end": "end_b", "cavity": cavity},
        "route": []
    });
    for (key, value) in extra.as_object().expect("object") {
        wire[key] = value.clone();
    }
    wire
}

#[test]
fn a_two_end_harness_is_derived_as_one_segment_and_its_wires_get_lengths() {
    let bundle = run(document(json!({})), true);
    let route = &bundle["harnesses"][0]["route"];
    assert_eq!(route["derived"], true);
    assert_eq!(route["ends"].as_array().unwrap().len(), 2);
    let segments = route["segments"].as_array().unwrap();
    assert_eq!(segments.len(), 1);
    let segment = &segments[0];
    assert_eq!(segment["id"], "har_1/end_a~end_b");
    assert_eq!(segment["wires"].as_array().unwrap().len(), 8);
    // Eight 24 AWG-sized wires (no gauge: assumed): 1.2 · √8 · 1.143 mm.
    let diameter = segment["diameterNm"].as_i64().unwrap() as f64 / 1e6;
    assert!(
        (diameter - 1.2 * 8f64.sqrt() * 1.143).abs() < 1e-3,
        "{diameter}"
    );
    assert_eq!(segment["assumedGauge"], true);
    // The headers mate upward, so the cable leaves both housings along +z.
    let exit = &route["ends"][0]["outward"];
    assert!((exit["z"].as_f64().unwrap() - 1.0).abs() < 1e-9, "{exit}");
    let arc = segment["lengthNm"].as_i64().unwrap() as f64 / 1e6;
    assert!(arc > 85.0, "{arc}");
    for wire in bundle["harnesses"][0]["wires"].as_array().unwrap() {
        let length = wire["routeLengthNm"].as_i64().unwrap() as f64 / 1e6;
        assert!(
            (length - (arc + 16.0) * 1.1).abs() < 1e-3,
            "{length} vs {arc}"
        );
    }
    assert!(
        !codes(&bundle)
            .iter()
            .any(|code| code == "wire-length-unrouted")
    );
}

#[test]
fn a_stored_segment_runs_through_its_waypoints_in_order() {
    let extra = json!({
        "segments": [{"id": "seg_1", "from": {"kind": "end", "end": "end_a"}, "to": {"kind": "end", "end": "end_b"}}],
        "waypoints": [
            {"id": "wp_2", "segment": "seg_1", "position": {"xNm": 75_000_000, "yNm": 40_000_000, "zNm": 30_000_000}, "order": 1},
            {"id": "wp_1", "segment": "seg_1", "position": {"xNm": 65_000_000, "yNm": 40_000_000, "zNm": 30_000_000}, "order": 0}
        ]
    });
    let bundle = run(document(extra), true);
    let route = &bundle["harnesses"][0]["route"];
    assert_eq!(route["derived"], false);
    let segment = &route["segments"][0];
    assert_eq!(segment["id"], "seg_1");
    let points = samples(segment);
    assert!(nearest(&points, [65.0, 40.0, 30.0]) < 0.01);
    assert!(nearest(&points, [75.0, 40.0, 30.0]) < 0.01);
    let first = points
        .iter()
        .position(|p| (p[0] - 65.0).abs() < 0.01 && (p[2] - 30.0).abs() < 0.01)
        .unwrap();
    let second = points
        .iter()
        .position(|p| (p[0] - 75.0).abs() < 0.01 && (p[2] - 30.0).abs() < 0.01)
        .unwrap();
    assert!(first < second, "order 0 comes first");
}

#[test]
fn a_waypoint_on_the_board_is_a_clearance_finding_and_a_tight_bend() {
    let extra = json!({
        "segments": [{"id": "seg_1", "from": {"kind": "end", "end": "end_a"}, "to": {"kind": "end", "end": "end_b"}}],
        "waypoints": [{"id": "wp_1", "segment": "seg_1", "position": {"xNm": 20_000_000, "yNm": 20_000_000, "zNm": 1_500_000}, "order": 0}]
    });
    let bundle = run(document(extra), true);
    let found = codes(&bundle);
    assert!(
        found.iter().any(|code| code == "harness-clearance"),
        "{found:?}"
    );
    assert!(
        found.iter().any(|code| code == "harness-bend-tight"),
        "{found:?}"
    );
    let clearance = bundle["findings"]
        .as_array()
        .unwrap()
        .iter()
        .find(|finding| finding["code"] == "harness-clearance")
        .unwrap();
    assert_eq!(clearance["subject"], "segment:har_1/seg_1/occ_a");
    let hits = bundle["harnesses"][0]["route"]["segments"][0]["clearances"]
        .as_array()
        .unwrap();
    assert_eq!(hits[0]["occurrence"], "occ_a");
    assert!(hits[0]["distanceNm"].as_i64().unwrap() < hits[0]["neededNm"].as_i64().unwrap());
}

#[test]
fn stored_segments_that_are_not_a_tree_fall_back_to_the_derived_route() {
    let extra = json!({
        "segments": [{"id": "seg_1", "from": {"kind": "end", "end": "end_a"}, "to": {"kind": "branch-point", "branchPoint": "bp_gone"}}],
        "waypoints": [{"id": "wp_1", "segment": "seg_1", "position": {"xNm": 0, "yNm": 0, "zNm": 30_000_000}, "order": 0}]
    });
    let bundle = run(document(extra), true);
    let found = codes(&bundle);
    assert!(
        found.iter().any(|code| code == "harness-topology-invalid"),
        "{found:?}"
    );
    assert!(
        found.iter().any(|code| code == "harness-waypoint-unused"),
        "{found:?}"
    );
    assert_eq!(bundle["harnesses"][0]["route"]["derived"], true);
}

#[test]
fn a_branch_point_without_a_position_sits_between_its_neighbours() {
    let extra = json!({
        "branchPoints": [{"id": "bp_1"}],
        "segments": [
            {"id": "seg_a", "from": {"kind": "end", "end": "end_a"}, "to": {"kind": "branch-point", "branchPoint": "bp_1"}},
            {"id": "seg_b", "from": {"kind": "branch-point", "branchPoint": "bp_1"}, "to": {"kind": "end", "end": "end_b"}}
        ]
    });
    let bundle = run(document(extra), true);
    let route = &bundle["harnesses"][0]["route"];
    assert_eq!(route["derived"], false);
    let segments = route["segments"].as_array().unwrap();
    assert_eq!(segments.len(), 2);
    // Both segments carry all eight wires, and meet at the legs' midpoint.
    for segment in segments {
        assert_eq!(segment["wires"].as_array().unwrap().len(), 8);
    }
    let a_end = *samples(&segments[0]).last().unwrap();
    assert!((a_end[0] - 90.0).abs() < 1e-6, "{a_end:?}");
    let wire = &bundle["harnesses"][0]["wires"][0];
    let total: i64 = segments
        .iter()
        .map(|s| s["lengthNm"].as_i64().unwrap())
        .sum();
    let expected = ((total as f64 / 1e6 + 16.0) * 1.1 * 1e6).round() as i64;
    assert!((wire["routeLengthNm"].as_i64().unwrap() - expected).abs() <= 2);
}

#[test]
fn a_typed_length_far_from_the_route_is_flagged() {
    let extra = json!({"wires": [wire("w_1", "1", json!({"lengthNm": 5_000_000}))]});
    let bundle = run(document(extra), true);
    let mismatch = bundle["findings"]
        .as_array()
        .unwrap()
        .iter()
        .find(|finding| finding["code"] == "wire-length-mismatch")
        .expect("mismatch");
    assert_eq!(mismatch["subject"], "wire:w_1");
}

#[test]
fn an_end_without_a_place_leaves_the_harness_unrouted() {
    let bundle = run(document(json!({})), false);
    assert!(bundle["harnesses"][0].get("route").is_none());
    let found = codes(&bundle);
    assert!(
        found.iter().any(|code| code == "harness-end-unplaced"),
        "{found:?}"
    );
    assert!(
        bundle["harnesses"][0]["wires"][0]
            .get("routeLengthNm")
            .is_none()
    );
}
