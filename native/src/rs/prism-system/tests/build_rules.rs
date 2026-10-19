//! The system bundle's rules (`docs/system-builder/CONTRACTS.md` §8–§9) on
//! synthetic boards, and the B2B mapping on the frozen mezzanine geometry.
//! End-to-end runs on real bundles are the CLI's tests (`prism-kicad-cli/tests/system.rs`).

use prism_system::build::build;
use prism_system::input::{
    Board, Document, InterfaceComponent, InterfacePin, Members, SemanticFacts, SystemInterface,
};
use prism_system::output::SystemBundle;
use serde_json::{Value, json};
use std::collections::BTreeSet;

fn connector(refdes: &str, pins: &[(&str, &str)]) -> InterfaceComponent {
    InterfaceComponent {
        reference: refdes.to_owned(),
        value: "CONN".to_owned(),
        mpn: None,
        candidate: true,
        pins: pins
            .iter()
            .map(|(pad, net)| InterfacePin {
                pad: (*pad).to_owned(),
                nets: if net.is_empty() {
                    vec![]
                } else {
                    vec![(*net).to_owned()]
                },
                pin_names: None,
                pin_types: None,
                power_net: matches!(*net, "VBAT" | "+3V3" | "3V3"),
            })
            .collect(),
        geometry: None,
    }
}

fn board(components: Vec<InterfaceComponent>) -> Board {
    Board {
        revision_key: "a".repeat(64),
        bundle_key: "b".repeat(64),
        interface: SystemInterface {
            board_thickness_mm: Some(1.6),
            components,
        },
        semantic: SemanticFacts::default(),
    }
}

fn occurrence(id: &str) -> Value {
    json!({"id": id, "label": id.to_uppercase(), "source": {"kind": "board"}})
}

fn run(doc: Value, boards: Vec<(&str, Board)>) -> SystemBundle {
    let doc: Document = serde_json::from_value(doc).expect("document");
    let members = Members {
        boards: boards
            .into_iter()
            .map(|(id, board)| (id.to_owned(), board))
            .collect(),
        absent: BTreeSet::new(),
    };
    build(&doc, &members, "0".repeat(64))
}

fn codes(bundle: &SystemBundle) -> Vec<(&str, &str)> {
    bundle
        .findings
        .iter()
        .map(|f| (f.code, f.subject.as_str()))
        .collect()
}

fn site(occurrence: &str, connector: &str) -> Value {
    json!({"occurrence": occurrence, "connector": connector})
}

fn end(id: &str, occurrence: &str, connector: &str) -> Value {
    json!({"id": id, "site": site(occurrence, connector), "contacts": {}, "pinMap": []})
}

fn three_boards() -> Vec<(&'static str, Board)> {
    vec![
        (
            "occ_a",
            board(vec![connector(
                "J1",
                &[
                    ("1", "CAN_H"),
                    ("2", "CAN_L"),
                    ("3", "GND"),
                    ("4", "I2C_SDA"),
                    ("5", "I2C_SCL"),
                    ("6", "VBAT"),
                ],
            )]),
        ),
        (
            "occ_b",
            board(vec![connector(
                "J2",
                &[("1", "CAN_H"), ("2", "CAN_L"), ("3", "GND"), ("4", "X")],
            )]),
        ),
        (
            "occ_c",
            board(vec![connector(
                "J3",
                &[("1", "I2C_SDA"), ("2", "I2C_SCL"), ("3", "GND"), ("4", "Y")],
            )]),
        ),
    ]
}

fn split_document(b_sub_port: bool) -> Value {
    let b_endpoint = if b_sub_port {
        json!({"occurrence": "occ_b", "connector": "J2", "subPort": {"kind": "occurrence", "id": "sub_b"}})
    } else {
        site("occ_b", "J2")
    };
    json!({
        "occurrences": [occurrence("occ_a"), occurrence("occ_b"), occurrence("occ_c")],
        "subPorts": [
            {"id": "sub_can", "occurrence": "occ_a", "connector": "J1", "name": "CAN", "pins": ["1", "2", "3"]},
            {"id": "sub_i2c", "occurrence": "occ_a", "connector": "J1", "name": "I2C", "pins": ["3", "4", "5"]},
            {"id": "sub_b", "occurrence": "occ_b", "connector": "J2", "name": "B", "pins": ["2", "1", "4"]}
        ],
        "harnesses": [{
            "id": "har_1", "label": "H1",
            "ends": [end("end_a", "occ_a", "J1"), end("end_b", "occ_b", "J2"), end("end_c", "occ_c", "J3")],
            "links": [
                {"id": "link_can", "a": {"occurrence": "occ_a", "connector": "J1", "subPort": {"kind": "occurrence", "id": "sub_can"}}, "b": b_endpoint, "unmapped": []},
                {"id": "link_i2c", "a": {"occurrence": "occ_a", "connector": "J1", "subPort": {"kind": "occurrence", "id": "sub_i2c"}}, "b": site("occ_c", "J3"), "unmapped": []}
            ],
            "wires": [], "splices": []
        }]
    })
}

fn wires(bundle: &SystemBundle, link: &str) -> Vec<(String, String, &'static str, bool)> {
    let link = bundle
        .links
        .iter()
        .find(|item| item.link == link)
        .expect("link");
    link.wires
        .iter()
        .map(|w| (w.a.clone(), w.b.clone(), w.rule, w.suggested))
        .collect()
}

#[test]
fn a_connector_split_over_overlapping_sub_ports_is_one_harness_with_a_splice() {
    let bundle = run(split_document(false), three_boards());
    let can = |a: &str, b: &str, suggested| (a.to_owned(), b.to_owned(), "net-name", suggested);
    assert_eq!(
        wires(&bundle, "link_can"),
        vec![
            can("1", "1", false),
            can("2", "2", false),
            can("3", "3", true)
        ]
    );
    assert_eq!(
        wires(&bundle, "link_i2c"),
        vec![
            can("3", "3", true),
            can("4", "1", false),
            can("5", "2", false)
        ]
    );
    let link_can = bundle
        .links
        .iter()
        .find(|item| item.link == "link_can")
        .expect("link");
    assert_eq!(link_can.unmapped_b, vec!["4".to_owned()]);
    assert_eq!(bundle.splices.len(), 1);
    let splice = &bundle.splices[0];
    assert_eq!((splice.end.as_str(), splice.pad.as_str()), ("end_a", "3"));
    assert_eq!(
        splice.links,
        vec!["link_can".to_owned(), "link_i2c".to_owned()]
    );
    let found = codes(&bundle);
    assert!(found.contains(&("splice-proposed", "splice:har_1/end_a/3")));
    assert!(found.contains(&("link-pins-unmapped", "link:link_can")));
    assert!(found.contains(&("power-join-suggested", "link:link_i2c")));
    // GND on all three boards is one system net through the harness.
    let ground = bundle
        .nets
        .iter()
        .find(|net| net.name == "GND")
        .expect("GND");
    let boards: BTreeSet<&str> = ground
        .pins
        .iter()
        .map(|pin| pin.occurrence.as_str())
        .collect();
    assert_eq!(boards, ["occ_a", "occ_b", "occ_c"].into_iter().collect());
}

#[test]
fn equal_size_sub_ports_map_in_order() {
    let bundle = run(split_document(true), three_boards());
    let order =
        |a: &str, b: &str, suggested| (a.to_owned(), b.to_owned(), "sub-port-order", suggested);
    assert_eq!(
        wires(&bundle, "link_can"),
        vec![
            order("1", "2", false),
            order("2", "1", false),
            order("3", "4", true)
        ]
    );
}

#[test]
fn explicit_wires_and_cleared_pins_override_the_default() {
    let mut doc = split_document(false);
    let harness = &mut doc["harnesses"][0];
    harness["wires"] = json!([{
        "id": "wire_x", "link": "link_can",
        "from": {"kind": "contact", "end": "end_a", "cavity": "1"},
        "to": {"kind": "contact", "end": "end_b", "cavity": "4"},
        "route": []
    }]);
    harness["links"][0]["unmapped"] = json!(["2"]);
    let bundle = run(doc, three_boards());
    let got = wires(&bundle, "link_can");
    assert_eq!(got[0], ("1".to_owned(), "4".to_owned(), "explicit", false));
    assert!(!got.iter().any(|wire| wire.0 == "2"));
    let link = bundle
        .links
        .iter()
        .find(|item| item.link == "link_can")
        .expect("link");
    assert!(link.unmapped_a.contains(&"2".to_owned()));
}

#[test]
fn a_confirmed_splice_settles_the_shared_pin() {
    let mut doc = split_document(false);
    let harness = &mut doc["harnesses"][0];
    harness["splices"] = json!([{"id": "spl_1", "method": "crimp", "confirmed": true}]);
    harness["wires"] = json!([{
        "id": "wire_s",
        "from": {"kind": "contact", "end": "end_a", "cavity": "3"},
        "to": {"kind": "splice", "splice": "spl_1"},
        "route": []
    }]);
    let bundle = run(doc, three_boards());
    assert!(bundle.splices.is_empty());
    assert!(
        !codes(&bundle)
            .iter()
            .any(|(code, _)| *code == "splice-proposed")
    );
}

#[test]
fn a_signal_is_traced_through_a_board_and_name_conflicts_are_reported() {
    let doc = json!({
        "occurrences": [occurrence("occ_a"), occurrence("occ_b"), occurrence("occ_c")],
        "mates": [{"id": "mate_ab", "a": site("occ_a", "J1"), "b": site("occ_b", "J1"),
                   "orientation": {"quarterTurns": 0, "flip": false}, "rows": {},
                   "manualMap": [{"a": "1", "b": "1"}]}],
        "harnesses": [{"id": "har_1", "label": "H1",
            "ends": [end("end_b", "occ_b", "J2"), end("end_c", "occ_c", "J1")],
            "links": [{"id": "link_bc", "a": site("occ_b", "J2"), "b": site("occ_c", "J1"), "unmapped": []}],
            "wires": [], "splices": []}]
    });
    let boards = vec![
        ("occ_a", board(vec![connector("J1", &[("1", "SIG")])])),
        (
            "occ_b",
            board(vec![
                connector("J1", &[("1", "SIG_B")]),
                connector("J2", &[("1", "SIG_B")]),
            ]),
        ),
        ("occ_c", board(vec![connector("J1", &[("1", "SIG_B")])])),
    ];
    let bundle = run(doc, boards);
    let net = bundle
        .nets
        .iter()
        .find(|net| net.pins.len() == 4)
        .expect("one net over four pins");
    let boards: BTreeSet<&str> = net.pins.iter().map(|pin| pin.occurrence.as_str()).collect();
    assert_eq!(boards.len(), 3);
    assert_eq!(net.names, vec!["SIG".to_owned(), "SIG_B".to_owned()]);
    assert_eq!(net.name, "SIG_B"); // two boards name it SIG_B, one SIG
    let found = codes(&bundle);
    assert!(found.contains(&("mate-manual-override", "mate:mate_ab")));
    assert!(found.iter().any(|(code, _)| *code == "net-name-conflict"));
}

#[test]
fn missing_references_are_findings_and_a_waiver_covers_one() {
    let doc = json!({
        "occurrences": [occurrence("occ_a"), occurrence("occ_b")],
        "subPorts": [{"id": "sub_x", "occurrence": "occ_a", "connector": "J1", "name": "X", "pins": ["1", "99"]}],
        "exports": [{"id": "exp_1", "name": "P1", "site": site("occ_b", "J9"), "pinNames": {}}],
        "mates": [{"id": "mate_1", "a": site("occ_a", "J1"), "b": site("occ_b", "J9"),
                   "orientation": {"quarterTurns": 0, "flip": false}, "rows": {}}],
        "waivers": [{"id": "wai_1", "code": "connector-missing", "subject": "connector:occ_b/J9", "reason": "rework"}]
    });
    let boards = vec![
        ("occ_a", board(vec![connector("J1", &[("1", "A")])])),
        ("occ_b", board(vec![])),
    ];
    let bundle = run(doc, boards);
    let missing = bundle
        .findings
        .iter()
        .find(|f| f.code == "connector-missing")
        .expect("connector-missing");
    assert_eq!(missing.subject, "connector:occ_b/J9");
    assert!(missing.waived);
    assert!(codes(&bundle).contains(&("pin-missing", "pin:occ_a/J1/99")));
    assert_eq!(bundle.mates[0].source, "unresolved");
}

#[test]
fn occurrences_report_their_state() {
    let doc = json!({"occurrences": [
        occurrence("occ_a"), occurrence("occ_b"), occurrence("occ_c"),
        {"id": "occ_d", "label": "Body", "source": {"kind": "body"}}
    ]});
    let doc: Document = serde_json::from_value(doc).expect("document");
    let members = Members {
        boards: [(
            "occ_a".to_owned(),
            board(vec![connector("J1", &[("1", "A")])]),
        )]
        .into_iter()
        .collect(),
        absent: ["occ_c".to_owned()].into_iter().collect(),
    };
    let bundle = build(&doc, &members, "0".repeat(64));
    let states: Vec<(&str, &str)> = bundle
        .occurrences
        .iter()
        .map(|o| (o.occurrence.as_str(), o.state))
        .collect();
    assert_eq!(
        states,
        vec![
            ("occ_a", "ready"),
            ("occ_b", "pending"),
            ("occ_c", "absent"),
            ("occ_d", "unsupported")
        ]
    );
    let found = codes(&bundle);
    assert!(found.contains(&("occurrence-pending", "occurrence:occ_b")));
    assert!(found.contains(&("occurrence-absent", "occurrence:occ_c")));
    assert_eq!(bundle.occurrences[0].connectors[0].refdes, "J1");
}

#[test]
fn suggestions_come_from_families_power_and_bus_aliases_minus_dismissed_and_accepted() {
    let mut a = board(vec![connector(
        "J1",
        &[
            ("1", "CAN_H"),
            ("2", "CAN_L"),
            ("3", "GND"),
            ("4", "/Bus/D0"),
            ("5", "/Bus/D1"),
            ("6", "VBAT"),
            ("7", "I2C_SDA"),
            ("8", "I2C_SCL"),
        ],
    )]);
    a.semantic.bus_aliases.push(prism_system::input::BusAlias {
        name: "DATA".to_owned(),
        members: vec!["D0".to_owned(), "D1".to_owned()],
    });
    let doc = json!({
        "occurrences": [occurrence("occ_a")],
        "subPorts": [{"id": "sub_i2c", "occurrence": "occ_a", "connector": "J1", "name": "I2C", "pins": ["7", "8"], "suggestion": "family:I2C"}],
        "dismissedSuggestions": [{"occurrence": "occ_a", "connector": "J1", "key": "family:CAN"}]
    });
    let bundle = run(doc, vec![("occ_a", a)]);
    let keys: Vec<(&str, &str, Vec<String>)> = bundle
        .suggestions
        .iter()
        .map(|s| (s.key.as_str(), s.source, s.pins.clone()))
        .collect();
    let pins = |items: &[&str]| {
        items
            .iter()
            .map(|item| (*item).to_owned())
            .collect::<Vec<_>>()
    };
    assert_eq!(
        keys,
        vec![
            ("bus:DATA", "bus-alias", pins(&["4", "5"])),
            ("power", "power", pins(&["3", "6"]))
        ]
    );
}

fn mezzanine(snapshot: &str, refdes: &str) -> InterfaceComponent {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../../backend/tests/fixtures/system_builder/p2/goldens/mezzanine_ends.json"
    );
    let ends: Value =
        serde_json::from_str(&std::fs::read_to_string(path).expect("fixture")).expect("json");
    let geometry = ends[snapshot]["ends"][refdes].clone();
    let mut pads: Vec<String> = geometry["pads"]
        .as_array()
        .expect("pads")
        .iter()
        .filter_map(|pad| {
            pad["pad"]
                .as_str()
                .filter(|name| !name.is_empty())
                .map(str::to_owned)
        })
        .collect();
    pads.sort();
    pads.dedup();
    let mut component = connector(
        refdes,
        &pads
            .iter()
            .map(|pad| (pad.as_str(), ""))
            .collect::<Vec<_>>(),
    );
    component.geometry = Some(serde_json::from_value(geometry).expect("geometry"));
    component
}

fn mated(quarter_turns: i32) -> SystemBundle {
    let doc = json!({
        "occurrences": [occurrence("occ_base"), occurrence("occ_top")],
        "mates": [{"id": "mate_1", "a": site("occ_base", "J1"), "b": site("occ_top", "J1"),
                   "orientation": {"quarterTurns": quarter_turns, "flip": false}, "rows": {}, "stackHeightNm": 7000000}]
    });
    run(
        doc,
        vec![
            ("occ_base", board(vec![mezzanine("mezz_base/F0", "J1")])),
            ("occ_top", board(vec![mezzanine("mezz_top/F0", "J1")])),
        ],
    )
}

#[test]
fn a_mezzanine_mapping_is_derived_from_geometry() {
    let bundle = mated(0);
    let mate = &bundle.mates[0];
    assert_eq!(mate.source, "geometry");
    assert!(!mate.pairs.is_empty());
    assert!(
        mate.pairs.iter().all(|pair| pair.a == pair.b),
        "pad n lands on pad n: {:?}",
        &mate.pairs[..4.min(mate.pairs.len())]
    );
    assert!(mate.unmapped_a.is_empty() && mate.unmapped_b.is_empty());
    let turned = mated(2);
    assert_ne!(
        turned.mates[0].pairs, mate.pairs,
        "a half turn re-derives the mapping"
    );
}

/// A 2×10 mezzanine row pair in the board frame: odd pads on one row, even on
/// the other, pad 1 at `first_x` stepping by `step`.
fn row_pair(
    refdes: &str,
    side: &str,
    rotation: f64,
    first_x: f64,
    step: f64,
    odd_y: f64,
    size: [f64; 2],
) -> InterfaceComponent {
    let mut pads = Vec::new();
    for k in 0..10 {
        let x = first_x + step * f64::from(k);
        for (pad, y) in [(2 * k + 1, odd_y), (2 * k + 2, -odd_y)] {
            pads.push(
                json!({"pad": pad.to_string(), "positionMm": [x, y], "sizeMm": size,
                             "shape": "roundrect", "tht": false}),
            );
        }
    }
    let names: Vec<String> = (1..=20).map(|pad| pad.to_string()).collect();
    let mut component = connector(
        refdes,
        &names
            .iter()
            .map(|pad| (pad.as_str(), ""))
            .collect::<Vec<_>>(),
    );
    component.geometry = Some(
        serde_json::from_value(json!({"side": side, "positionMm": [0.0, 0.0],
                                      "rotationDeg": rotation, "pads": pads,
                                      "courtyard": {"minMm": [-3.5, -4.25], "maxMm": [3.5, 4.25]}}))
        .expect("geometry"),
    );
    component
}

#[test]
fn long_pads_at_different_row_spacings_map_pad_n_to_pad_n() {
    // A terminal/socket pair whose matching pad centres sit 0.22 mm apart
    // across the row (rows 6.17 mm against 5.73 mm apart), more than half the
    // pads' narrow side but well inside their length.
    let doc = json!({
        "occurrences": [occurrence("occ_carrier"), occurrence("occ_module")],
        "mates": [{"id": "mate_1", "a": site("occ_carrier", "J2"), "b": site("occ_module", "J1"),
                   "orientation": {"quarterTurns": 0, "flip": false}, "rows": {}}]
    });
    let bundle = run(
        doc,
        vec![
            (
                "occ_carrier",
                board(vec![row_pair(
                    "J2",
                    "top",
                    180.0,
                    2.25,
                    -0.5,
                    -3.086,
                    [0.305, 1.45],
                )]),
            ),
            (
                "occ_module",
                board(vec![row_pair(
                    "J1",
                    "bottom",
                    0.0,
                    -2.25,
                    0.5,
                    2.865,
                    [0.279, 2.27],
                )]),
            ),
        ],
    );
    let mate = &bundle.mates[0];
    assert_eq!(mate.source, "geometry", "{:?}", bundle.findings);
    assert_eq!(mate.pairs.len(), 20, "unmapped: {:?}", mate.unmapped_a);
    assert!(mate.pairs.iter().all(|pair| pair.a == pair.b));
}

#[test]
fn names_differing_only_by_sheet_path_or_bus_dot_do_not_conflict() {
    let doc = json!({
        "occurrences": [occurrence("occ_a"), occurrence("occ_b")],
        "mates": [{"id": "mate_ab", "a": site("occ_a", "J1"), "b": site("occ_b", "J1"),
                   "orientation": {"quarterTurns": 0, "flip": false}, "rows": {},
                   "manualMap": [{"a": "1", "b": "1"}, {"a": "2", "b": "2"},
                                 {"a": "3", "b": "3"}]}]
    });
    let bundle = run(
        doc,
        vec![
            (
                "occ_a",
                board(vec![connector(
                    "J1",
                    &[("1", "/S9_TXP"), ("2", "/GPIO_25"), ("3", "+3V3")],
                )]),
            ),
            (
                "occ_b",
                board(vec![connector(
                    "J1",
                    &[("1", "/SOM/S9.TXP"), ("2", "/SOM/FAN_PWM"), ("3", "3V3")],
                )]),
            ),
        ],
    );
    let subjects: Vec<String> = bundle
        .findings
        .iter()
        .filter(|f| f.code == "net-name-conflict")
        .map(|f| f.message.clone())
        .collect();
    assert_eq!(subjects.len(), 1, "{subjects:?}");
    assert!(subjects[0].contains("FAN_PWM"));
    assert!(
        codes(&bundle)
            .iter()
            .any(|(code, _)| *code == "power-net-conflict"),
        "the rail is reported once, as a power conflict"
    );
}
