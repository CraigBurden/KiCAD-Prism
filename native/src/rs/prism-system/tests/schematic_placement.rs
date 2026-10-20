//! Stage 2's schematic inputs in the system bundle (`docs/system-builder/CONTRACTS.md` §8.2):
//! each connector's angle from the board outline's centre, its side, and the outline's size.

use prism_system::build::build;
use prism_system::input::{Board, Document, Members, SemanticFacts, SystemInterface};
use serde_json::{Value, json};

fn component(refdes: &str, x: f64, y: f64, side: &str) -> Value {
    json!({
        "reference": refdes, "value": "CONN", "candidate": true,
        "pins": [{"pad": "1", "nets": ["GND"], "powerNet": true}],
        "geometry": {"side": side, "positionMm": [x, y], "rotationDeg": 0.0,
                     "pads": [{"pad": "1", "positionMm": [x, y], "sizeMm": [1.0, 1.0], "shape": "rect", "tht": false}]}
    })
}

fn interface(outline: Option<Value>, components: Vec<Value>) -> SystemInterface {
    let mut value = json!({"boardThicknessMm": 1.6, "components": components});
    if let Some(outline) = outline {
        value["boardOutlineMm"] = outline;
    }
    serde_json::from_value(value).expect("interface")
}

fn run(interface: SystemInterface) -> Value {
    let doc: Document = serde_json::from_value(json!({
        "schema": "prism.system.v2", "name": "S", "sheets": [],
        "occurrences": [{"id": "occ_a", "label": "A", "source": {"kind": "board"}}],
        "subPorts": [], "dismissedSuggestions": [], "bodyConnectors": [], "mates": [],
        "harnesses": [], "exports": [], "waivers": [], "layout": {}
    }))
    .expect("document");
    let mut members = Members::default();
    members.boards.insert(
        "occ_a".to_owned(),
        Board {
            revision_key: "a".repeat(64),
            bundle_key: "b".repeat(64),
            interface,
            semantic: SemanticFacts::default(),
        },
    );
    serde_json::to_value(build(&doc, &members, "0".repeat(64))).expect("bundle")
}

#[test]
fn connectors_carry_their_angle_and_side_and_the_board_its_outline() {
    // A 100 x 50 mm board centred on (50, -25); the interface has +y up.
    let outline = json!({"minMm": [0.0, -50.0], "maxMm": [100.0, 0.0], "source": "edge_cuts"});
    let bundle = run(interface(
        Some(outline),
        vec![
            component("J1", 100.0, -25.0, "top"),  // right edge: 0°
            component("J2", 50.0, 0.0, "top"),     // top edge: 90°
            component("J3", 0.0, -25.0, "bottom"), // left edge, on the back: 180°
            component("J4", 50.0, -50.0, "top"),   // bottom edge: 270°
        ],
    ));
    let occurrence = &bundle["occurrences"][0];
    assert_eq!(
        occurrence["outline"],
        json!({"widthNm": 100_000_000, "heightNm": 50_000_000})
    );
    let placements: Vec<(String, f64, String)> = occurrence["connectors"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| {
            (
                c["refdes"].as_str().unwrap().to_owned(),
                c["placement"]["angleDeg"].as_f64().unwrap(),
                c["placement"]["side"].as_str().unwrap().to_owned(),
            )
        })
        .collect();
    assert_eq!(
        placements,
        vec![
            ("J1".to_owned(), 0.0, "top".to_owned()),
            ("J2".to_owned(), 90.0, "top".to_owned()),
            ("J3".to_owned(), 180.0, "bottom".to_owned()),
            ("J4".to_owned(), 270.0, "top".to_owned()),
        ]
    );
}

#[test]
fn without_an_outline_there_is_no_placement_or_outline() {
    let bundle = run(interface(None, vec![component("J1", 10.0, -5.0, "top")]));
    let occurrence = &bundle["occurrences"][0];
    assert!(occurrence.get("outline").is_none());
    assert!(occurrence["connectors"][0].get("placement").is_none());
}
