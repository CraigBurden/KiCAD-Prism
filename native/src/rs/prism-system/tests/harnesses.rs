//! Harness wire lists and part checks (`docs/system-builder/CONTRACTS.md`
//! §16.3–§16.4) on the stage-4 fixtures of ADR §7 that need no geometry: a
//! direct two-end harness, a three-end fanout with splices, a shielded cable,
//! an unknown gauge and a connector revision change.

use prism_system::build::build;
use prism_system::input::{
    Board, Document, HarnessFacts, InterfaceComponent, InterfacePin, Members, PartFacts, PartMate,
    SemanticFacts, SystemInterface,
};
use prism_system::output::{HarnessOut, HarnessWireOut, SystemBundle};
use serde_json::{Value, json};

fn connector(refdes: &str, mpn: Option<&str>, pins: &[(&str, &str)]) -> InterfaceComponent {
    InterfaceComponent {
        reference: refdes.to_owned(),
        value: "CONN".to_owned(),
        mpn: mpn.map(str::to_owned),
        candidate: true,
        pins: pins
            .iter()
            .map(|(pad, net)| InterfacePin {
                pad: (*pad).to_owned(),
                nets: vec![(*net).to_owned()],
                pin_names: None,
                pin_types: None,
                power_net: *net == "+5V",
            })
            .collect(),
        geometry: None,
    }
}

fn board(component: InterfaceComponent) -> Board {
    Board {
        revision_key: "a".repeat(64),
        bundle_key: "b".repeat(64),
        interface: SystemInterface {
            board_outline_mm: None,
            board_thickness_mm: Some(1.6),
            components: vec![component],
        },
        semantic: SemanticFacts::default(),
    }
}

const FAN: [(&str, &str); 4] = [("1", "GND"), ("2", "+5V"), ("3", "TACH"), ("4", "PWM")];

/// A carrier with J1 (an SHR-style header, MPN given) and a fan board with J2.
fn two_boards(carrier_mpn: &str) -> Vec<(&'static str, Board)> {
    vec![
        ("occ_a", board(connector("J1", Some(carrier_mpn), &FAN))),
        ("occ_b", board(connector("J2", None, &FAN))),
    ]
}

fn occurrence(id: &str) -> Value {
    json!({"id": id, "label": id.to_uppercase(), "source": {"kind": "board"}})
}

fn site(occurrence: &str, connector: &str) -> Value {
    json!({"occurrence": occurrence, "connector": connector})
}

fn harness(extra: Value) -> Value {
    let mut harness = json!({
        "id": "har_1", "label": "H1",
        "ends": [
            {"id": "end_a", "site": site("occ_a", "J1"), "contacts": {}, "pinMap": []},
            {"id": "end_b", "site": site("occ_b", "J2"), "contacts": {}, "pinMap": []}
        ],
        "links": [{"id": "link_1", "a": site("occ_a", "J1"), "b": site("occ_b", "J2"), "unmapped": []}],
        "wires": [], "splices": []
    });
    for (key, value) in extra.as_object().expect("object") {
        harness[key] = value.clone();
    }
    harness
}

fn document(harness: Value) -> Value {
    json!({"occurrences": [occurrence("occ_a"), occurrence("occ_b")], "harnesses": [harness]})
}

fn part(component: &str, name: &str, facts: HarnessFacts) -> PartFacts {
    PartFacts {
        component_id: component.to_owned(),
        revision_id: format!("{component}_r1"),
        name: name.to_owned(),
        harness: Some(facts),
        ..PartFacts::default()
    }
}

fn housing(cavities: u32, mates_mpn: &str) -> PartFacts {
    let mut housing = part(
        "cmp_housing",
        "SHR-04V-S-B",
        HarnessFacts {
            role: "housing".to_owned(),
            cavities: Some(cavities),
            contact_family: Some("SSH".to_owned()),
            ..HarnessFacts::default()
        },
    );
    housing.mates_with = vec![PartMate {
        component_id: "cmp_header".to_owned(),
        mpn: Some(mates_mpn.to_owned()),
    }];
    housing
}

fn contact(family: &str) -> PartFacts {
    part(
        "cmp_contact",
        "SSH-003T-P0.2",
        HarnessFacts {
            role: "contact".to_owned(),
            contact_family: Some(family.to_owned()),
            gauge_min_awg: Some("32".to_owned()),
            gauge_max_awg: Some("28".to_owned()),
            ..HarnessFacts::default()
        },
    )
}

fn run(doc: Value, boards: Vec<(&str, Board)>, parts: Vec<PartFacts>) -> SystemBundle {
    let doc: Document = serde_json::from_value(doc).expect("document");
    let mut members = Members::default();
    members
        .boards
        .extend(boards.into_iter().map(|(id, board)| (id.to_owned(), board)));
    for facts in parts {
        members.parts.insert(facts.component_id.clone(), facts);
    }
    build(&doc, &members, "0".repeat(64))
}

fn codes(bundle: &SystemBundle) -> Vec<(&str, &str)> {
    bundle
        .findings
        .iter()
        .map(|f| (f.code, f.subject.as_str()))
        .collect()
}

fn only(bundle: &SystemBundle) -> &HarnessOut {
    assert_eq!(bundle.harnesses.len(), 1);
    &bundle.harnesses[0]
}

fn wire<'b>(harness: &'b HarnessOut, id: &str) -> &'b HarnessWireOut {
    harness
        .wires
        .iter()
        .find(|wire| wire.id == id)
        .unwrap_or_else(|| panic!("wire {id}"))
}

fn net_of(bundle: &SystemBundle, name: &str) -> String {
    bundle
        .nets
        .iter()
        .find(|net| net.name == name)
        .map(|net| net.id.clone())
        .unwrap_or_else(|| panic!("net {name}"))
}

#[test]
fn a_direct_two_end_harness_lists_one_default_wire_per_pin() {
    let mut fan_end = harness(json!({}));
    // The fan's housing seats pad 1 in cavity A.
    fan_end["ends"][1]["pinMap"] = json!([{"cavity": "A", "pad": "1"}]);
    let bundle = run(document(fan_end), two_boards("BM04B-SRSS-TB"), vec![]);
    let harness = only(&bundle);
    let ids: Vec<&str> = harness.wires.iter().map(|wire| wire.id.as_str()).collect();
    assert_eq!(ids, ["link_1:1", "link_1:2", "link_1:3", "link_1:4"]);

    let ground = wire(harness, "link_1:1");
    assert_eq!(ground.origin, "default");
    assert_eq!(ground.from.end.as_deref(), Some("end_a"));
    assert_eq!(ground.from.cavity.as_deref(), Some("1"));
    assert_eq!(ground.to.end.as_deref(), Some("end_b"));
    assert_eq!(ground.to.cavity.as_deref(), Some("A"));
    assert_eq!(ground.to.pad.as_deref(), Some("1"));
    assert_eq!(ground.net.as_deref(), Some(net_of(&bundle, "GND").as_str()));
    assert!(ground.suggested, "a ground join is suggested");
    assert!(!wire(harness, "link_1:3").suggested);

    let fan = &harness.ends[1];
    let cavities: Vec<(&str, &str)> = fan
        .cavities
        .iter()
        .map(|item| (item.cavity.as_str(), item.pad.as_str()))
        .collect();
    assert_eq!(cavities, [("2", "2"), ("3", "3"), ("4", "4"), ("A", "1")]);
    // Default wires carry no gauge: the harness asks for gauges, as information.
    assert!(codes(&bundle).contains(&("wire-gauge-unknown", "harness:har_1")));
}

/// Board A's J1 fans out to B's J2 (pins 1–3) and C's J3 (pin 3 and 4); pin 3
/// (GND) goes to both.
#[test]
fn a_confirmed_power_join_is_no_longer_suggested() {
    let contact =
        |end: &str, cavity: &str| json!({"kind": "contact", "end": end, "cavity": cavity});
    let doc = document(harness(json!({
        "wires": [
            {"id": "w_gnd", "link": "link_1", "from": contact("end_a", "1"), "to": contact("end_b", "1")},
            {"id": "w_5v", "link": "link_1", "from": contact("end_a", "2"), "to": contact("end_b", "2")}
        ]
    })));
    let bundle = run(doc, two_boards("BM04B-SRSS-TB"), vec![]);
    let harness = only(&bundle);
    assert!(!wire(harness, "w_gnd").suggested);
    assert!(!wire(harness, "w_5v").suggested);
    let link = &bundle.links[0];
    assert!(link.wires.iter().all(|wire| !wire.suggested));
    assert!(!codes(&bundle).contains(&("power-join-suggested", "link:link_1")));
}

fn fanout(splice: bool) -> SystemBundle {
    let three = vec![
        (
            "occ_a",
            board(connector(
                "J1",
                None,
                &[("1", "CAN_H"), ("2", "CAN_L"), ("3", "GND"), ("4", "SDA")],
            )),
        ),
        (
            "occ_b",
            board(connector(
                "J2",
                None,
                &[("1", "CAN_H"), ("2", "CAN_L"), ("3", "GND")],
            )),
        ),
        (
            "occ_c",
            board(connector("J3", None, &[("1", "SDA"), ("2", "GND")])),
        ),
    ];
    let mut harness = json!({
        "id": "har_1", "label": "H1",
        "ends": [
            {"id": "end_a", "site": site("occ_a", "J1"), "contacts": {}, "pinMap": []},
            {"id": "end_b", "site": site("occ_b", "J2"), "contacts": {}, "pinMap": []},
            {"id": "end_c", "site": site("occ_c", "J3"), "contacts": {}, "pinMap": []}
        ],
        "links": [
            {"id": "link_b", "a": site("occ_a", "J1"), "b": site("occ_b", "J2"), "unmapped": []},
            {"id": "link_c", "a": site("occ_a", "J1"), "b": site("occ_c", "J3"), "unmapped": []}
        ],
        "wires": [], "splices": []
    });
    if splice {
        harness["splices"] = json!([{"id": "spl_gnd", "method": "crimp", "confirmed": true}]);
        harness["wires"] = json!([
            {"id": "w_in", "from": {"kind": "contact", "end": "end_a", "cavity": "3"}, "to": {"kind": "splice", "splice": "spl_gnd"}, "gaugeAwg": "26"},
            {"id": "w_b", "link": "link_b", "from": {"kind": "splice", "splice": "spl_gnd"}, "to": {"kind": "contact", "end": "end_b", "cavity": "3"}, "gaugeAwg": "28"},
            {"id": "w_c", "link": "link_c", "from": {"kind": "splice", "splice": "spl_gnd"}, "to": {"kind": "contact", "end": "end_c", "cavity": "2"}, "gaugeAwg": "28"}
        ]);
    }
    let doc = json!({
        "occurrences": [occurrence("occ_a"), occurrence("occ_b"), occurrence("occ_c")],
        "harnesses": [harness]
    });
    run(doc, three, vec![])
}

#[test]
fn a_three_end_fanout_proposes_a_splice_until_one_is_wired() {
    let bundle = fanout(false);
    let harness = only(&bundle);
    let from_three: Vec<&str> = harness
        .wires
        .iter()
        .filter(|wire| {
            wire.from.end.as_deref() == Some("end_a") && wire.from.pad.as_deref() == Some("3")
        })
        .map(|wire| wire.id.as_str())
        .collect();
    assert_eq!(
        from_three,
        ["link_b:3", "link_c:3"],
        "GND goes to both ends"
    );
    assert!(codes(&bundle).contains(&("splice-proposed", "splice:har_1/end_a/3")));

    let bundle = fanout(true);
    let harness = only(&bundle);
    assert!(
        !codes(&bundle)
            .iter()
            .any(|(code, _)| *code == "splice-proposed")
    );
    let ground = net_of(&bundle, "GND");
    for id in ["w_in", "w_b", "w_c"] {
        let item = wire(harness, id);
        assert_eq!(item.origin, "explicit");
        assert_eq!(item.net.as_deref(), Some(ground.as_str()), "{id} is on GND");
    }
    assert_eq!(wire(harness, "w_b").from.kind, "splice");
    assert_eq!(wire(harness, "w_b").to.pad.as_deref(), Some("3"));
    // The explicit wires replace the links' defaults for GND; the rest stay default.
    let ids: Vec<&str> = harness.wires.iter().map(|wire| wire.id.as_str()).collect();
    assert_eq!(
        ids,
        ["w_in", "w_b", "w_c", "link_b:1", "link_b:2", "link_c:4"]
    );
}

#[test]
fn a_shielded_cable_names_its_conductors_and_checks_their_count() {
    let wires = json!([
        {"id": "w1", "link": "link_1", "from": {"kind": "contact", "end": "end_a", "cavity": "3"}, "to": {"kind": "contact", "end": "end_b", "cavity": "3"}, "gaugeAwg": "28"},
        {"id": "w2", "link": "link_1", "from": {"kind": "contact", "end": "end_a", "cavity": "4"}, "to": {"kind": "contact", "end": "end_b", "cavity": "4"}, "gaugeAwg": "28"},
        {"id": "w3", "link": "link_1", "from": {"kind": "contact", "end": "end_a", "cavity": "2"}, "to": {"kind": "contact", "end": "end_b", "cavity": "2"}, "gaugeAwg": "28"},
        {"id": "w_drain", "link": "link_1", "from": {"kind": "contact", "end": "end_a", "cavity": "1"}, "to": {"kind": "loose", "looseEnd": "le_shield"}, "gaugeAwg": "28"}
    ]);
    let cable = |conductors: Value| {
        harness(json!({
            "wires": wires.clone(),
            "looseEnds": [{"id": "le_shield", "kind": "pigtail"}],
            "cables": [{"id": "cab_1", "part": {"componentId": "cmp_cable"}, "conductors": conductors}]
        }))
    };
    let cable_part = part(
        "cmp_cable",
        "4C shielded",
        HarnessFacts {
            role: "cable".to_owned(),
            conductors: Some(4),
            ..HarnessFacts::default()
        },
    );
    let four = json!([
        {"name": "white", "wire": "w1", "drain": false},
        {"name": "green", "wire": "w2", "drain": false},
        {"name": "red", "wire": "w3", "drain": false},
        {"name": "drain", "wire": "w_drain", "drain": true}
    ]);
    let bundle = run(
        document(cable(four)),
        two_boards("BM04B-SRSS-TB"),
        vec![cable_part.clone()],
    );
    let harness_out = only(&bundle);
    let drain = wire(harness_out, "w_drain");
    assert_eq!(drain.cable.as_deref(), Some("cab_1"));
    assert_eq!(drain.conductor.as_deref(), Some("drain"));
    assert_eq!(drain.to.kind, "loose");
    assert_eq!(drain.to.loose_end.as_deref(), Some("le_shield"));
    assert!(
        harness_out
            .wires
            .iter()
            .all(|wire| wire.origin == "explicit")
    );
    assert!(
        !codes(&bundle)
            .iter()
            .any(|(code, _)| code.starts_with("cable-"))
    );
    assert!(
        !codes(&bundle)
            .iter()
            .any(|(code, _)| *code == "wire-gauge-unknown")
    );

    let three = json!([
        {"name": "white", "wire": "w1", "drain": false},
        {"name": "green", "wire": "w2", "drain": false},
        {"name": "red", "wire": "w3", "drain": false}
    ]);
    let bundle = run(
        document(cable(three)),
        two_boards("BM04B-SRSS-TB"),
        vec![cable_part],
    );
    assert!(codes(&bundle).contains(&("cable-conductors-mismatch", "cable:cab_1")));
}

/// End A with a housing and contacts in cavities 3 and 4, and one explicit wire on cavity 3.
fn with_parts(gauge: &str) -> Value {
    harness(json!({
        "ends": [
            {"id": "end_a", "site": site("occ_a", "J1"),
             "housing": {"componentId": "cmp_housing"},
             "contacts": {"3": {"componentId": "cmp_contact"}, "4": {"componentId": "cmp_contact"}},
             "pinMap": []},
            {"id": "end_b", "site": site("occ_b", "J2"), "contacts": {}, "pinMap": []}
        ],
        "wires": [
            {"id": "w_tach", "link": "link_1", "from": {"kind": "contact", "end": "end_a", "cavity": "3"}, "to": {"kind": "contact", "end": "end_b", "cavity": "3"}, "gaugeAwg": gauge}
        ],
        "cables": [], "coverings": [{"id": "cov_1", "segment": "seg_1", "kind": "sleeve", "part": {"componentId": "cmp_sleeve"}}]
    }))
}

#[test]
fn housing_and_contact_parts_are_checked_against_the_board_and_the_wire() {
    let parts = |family: &str| vec![housing(4, "BM04B-SRSS-TB"), contact(family)];
    // A gauge in range, the right family, mating housing: nothing but the
    // missing sleeve part and the default wires' unknown gauge.
    let bundle = run(
        document(with_parts("28")),
        two_boards("bm04b-srss-tb "),
        parts("SSH"),
    );
    let found = codes(&bundle);
    assert!(found.contains(&("harness-part-missing", "covering:cov_1")));
    for code in [
        "housing-not-mating",
        "housing-cavities-short",
        "contact-family-mismatch",
        "contact-gauge-mismatch",
    ] {
        assert!(
            !found.iter().any(|(c, _)| *c == code),
            "unexpected {code}: {found:?}"
        );
    }
    let end = &only(&bundle).ends[0];
    assert_eq!(end.housing.as_deref(), Some("cmp_housing@cmp_housing_r1"));
    let tach = end
        .cavities
        .iter()
        .find(|item| item.cavity == "3")
        .expect("cavity 3");
    assert_eq!(tach.contact.as_deref(), Some("cmp_contact@cmp_contact_r1"));

    // A thinner wire than the contact takes, a contact of another family.
    let bundle = run(
        document(with_parts("34")),
        two_boards("BM04B-SRSS-TB"),
        parts("SUR"),
    );
    let found = codes(&bundle);
    assert!(found.contains(&("contact-gauge-mismatch", "wire:w_tach")));
    assert!(found.contains(&("contact-family-mismatch", "end:end_a")));

    // A two-cavity housing on a four-pin connector.
    let bundle = run(
        document(with_parts("28")),
        two_boards("BM04B-SRSS-TB"),
        vec![housing(2, "BM04B-SRSS-TB"), contact("SSH")],
    );
    assert!(codes(&bundle).contains(&("housing-cavities-short", "end:end_a")));
}

#[test]
fn a_connector_revision_change_shows_on_the_housing_and_the_pins() {
    let parts = || vec![housing(4, "BM04B-SRSS-TB"), contact("SSH")];
    let doc = || document(with_parts("28"));
    let before = run(doc(), two_boards("BM04B-SRSS-TB"), parts());
    assert!(
        !codes(&before)
            .iter()
            .any(|(code, _)| *code == "housing-not-mating")
    );

    // The followed board moved to a five-pin header without pad 4.
    let changed = vec![
        (
            "occ_a",
            board(connector(
                "J1",
                Some("BM05B-SRSS-TB"),
                &[("1", "GND"), ("2", "+5V"), ("3", "TACH"), ("5", "PWM")],
            )),
        ),
        ("occ_b", board(connector("J2", None, &FAN))),
    ];
    let mut doc = doc();
    doc["harnesses"][0]["wires"]
        .as_array_mut()
        .expect("wires")
        .push(json!({"id": "w_pwm", "link": "link_1", "from": {"kind": "contact", "end": "end_a", "cavity": "4"}, "to": {"kind": "contact", "end": "end_b", "cavity": "4"}, "gaugeAwg": "28"}));
    let after = run(doc, changed, parts());
    let found = codes(&after);
    assert!(found.contains(&("housing-not-mating", "end:end_a")));
    assert!(
        found.contains(&("pin-missing", "pin:occ_a/J1/4")),
        "{found:?}"
    );
}

#[test]
fn a_wire_to_nothing_is_an_error() {
    let doc = document(harness(json!({
        "wires": [{"id": "w_bad", "from": {"kind": "contact", "end": "end_zz", "cavity": "1"}, "to": {"kind": "splice", "splice": "spl_none"}}]
    })));
    let bundle = run(doc, two_boards("BM04B-SRSS-TB"), vec![]);
    assert!(codes(&bundle).contains(&("wire-terminal-invalid", "wire:w_bad")));
    let bad = wire(only(&bundle), "w_bad");
    assert_eq!(bad.from.end.as_deref(), Some("end_zz"));
    assert_eq!(bad.to.kind, "splice");
}
