//! `system build` placement (3a): mated poses, stack heights, offsets and the
//! mate checks on the fixture boards.

mod support;
#[path = "support/system_common.rs"]
mod system_common;

use serde_json::{Value, json};
use system_common::{
    build, endpoint, finding, fixture_bundle, key, mezzanine, mezzanine_bundle, mezzanine_mate,
    mezzanine_members, output, write_document,
};

// -------------------------------------------------------------------- placement (3a)

fn placed<'a>(bundle: &'a Value, occurrence: &str) -> &'a Value {
    bundle["placement"]["occurrences"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["occurrence"] == occurrence)
        .unwrap_or_else(|| panic!("{occurrence} is placed"))
}

fn vector_mm(value: &Value) -> [f64; 3] {
    ["xNm", "yNm", "zNm"].map(|axis| value[axis].as_f64().unwrap() / 1e6)
}

fn distance_mm(a: &Value, b: &Value) -> f64 {
    let (a, b) = (vector_mm(a), vector_mm(b));
    ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt()
}

fn placed_mate(bundle: &Value) -> &Value {
    &bundle["placement"]["mates"][0]
}

#[test]
fn a_mate_places_the_top_board_at_its_stack_height() {
    let mut mate = mezzanine_mate(0, None);
    mate["stackHeightNm"] = json!(7_000_000);
    let bundle = mezzanine_bundle("place-stack", mate);
    let base = placed(&bundle, "occ_base");
    let top = placed(&bundle, "occ_top");
    assert_eq!(base["source"], "default");
    assert_eq!(base["root"], true);
    assert_eq!(top["source"], "mate");
    assert_eq!(top["root"], false);
    assert_eq!(top["positioningMate"], "mate_mezz");
    assert!(base["bounds"].is_object(), "a ready board has bounds");
    let placed = placed_mate(&bundle);
    assert_eq!(placed["driving"], true);
    assert_eq!(placed["heightSource"], "stack-height");
    assert_eq!(placed["stackHeightNm"], 7_000_000);
    // The two connector frames face each other, the stack height apart.
    let gap = distance_mm(
        &placed["frameA"]["translation"],
        &placed["frameB"]["translation"],
    );
    assert!((gap - 7.0).abs() < 1e-3, "frames {gap} mm apart");
}

#[test]
fn a_mate_offset_moves_the_placed_board() {
    let mut mate = mezzanine_mate(0, None);
    mate["stackHeightNm"] = json!(7_000_000);
    mate["offset"] = json!({
        "translation": {"xNm": 0, "yNm": 0, "zNm": 2_000_000},
        "rotation": {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0},
    });
    let bundle = mezzanine_bundle("place-offset", mate);
    let placed = placed_mate(&bundle);
    let gap = distance_mm(
        &placed["frameA"]["translation"],
        &placed["frameB"]["translation"],
    );
    assert!(
        (gap - 9.0).abs() < 1e-3,
        "a 2 mm spacer: frames {gap} mm apart"
    );
}

#[test]
fn quarter_turns_turn_the_placed_board_and_keep_it_mated() {
    let mut turned = mezzanine_mate(2, None);
    turned["stackHeightNm"] = json!(7_000_000);
    let mut straight = mezzanine_mate(0, None);
    straight["stackHeightNm"] = json!(7_000_000);
    let a = mezzanine_bundle("place-turn-0", straight);
    let b = mezzanine_bundle("place-turn-2", turned);
    assert_ne!(
        placed(&a, "occ_top")["pose"]["rotation"],
        placed(&b, "occ_top")["pose"]["rotation"]
    );
    let gap = distance_mm(
        &placed_mate(&b)["frameA"]["translation"],
        &placed_mate(&b)["frameB"]["translation"],
    );
    assert!((gap - 7.0).abs() < 1e-3, "still mated: {gap} mm");
}

#[test]
fn a_stored_pose_moves_the_root_and_is_ignored_on_the_mated_board() {
    let mut mate = mezzanine_mate(0, None);
    mate["stackHeightNm"] = json!(7_000_000);
    let mut doc = mezzanine(mate);
    let pose = |x: i64| json!({"translation": {"xNm": x, "yNm": 0, "zNm": 0}, "rotation": {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0}});
    doc["occurrences"][0]["pose"] = pose(100_000_000);
    doc["occurrences"][1]["pose"] = pose(-50_000_000);
    let base_bundle = fixture_bundle("p2/sources/mezz_base/F0/mezz_base.kicad_pro", 0x11);
    let top_bundle = fixture_bundle("p2/sources/mezz_top/F0/mezz_top.kicad_pro", 0x22);
    let (k11, k22) = (key(0x11), key(0x22));
    let members = mezzanine_members(&base_bundle, &top_bundle, &k11, &k22);
    let path = write_document("place-stored", &doc);
    let (finished, out) = build("place-stored", &path, &members, &[]);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let bundle = output(&out);
    prism_bundle::schema::validate("prism.system_bundle.a0", &bundle).unwrap();
    assert_eq!(placed(&bundle, "occ_base")["source"], "stored");
    assert_eq!(
        placed(&bundle, "occ_base")["pose"]["translation"]["xNm"],
        100_000_000
    );
    assert_eq!(placed(&bundle, "occ_top")["source"], "mate");
    let ignored = finding(&bundle, "pose-ignored").expect("pose-ignored");
    assert_eq!(ignored["subject"], "occurrence:occ_top");
    assert_eq!(ignored["severity"], "info");
}

#[test]
fn a_second_mate_that_does_not_meet_is_misaligned() {
    let mut j1 = mezzanine_mate(0, None);
    j1["stackHeightNm"] = json!(7_000_000);
    let mut doc = mezzanine(j1);
    doc["mates"].as_array_mut().unwrap().push(json!({
        "id": "mate_two",
        "a": endpoint("occ_base", "J2"),
        "b": endpoint("occ_top", "J2"),
        "orientation": {"quarterTurns": 0, "flip": false},
        "rows": {},
        "stackHeightNm": 8_000_000,
    }));
    let base_bundle = fixture_bundle("p2/sources/mezz_base/F0/mezz_base.kicad_pro", 0x11);
    let top_bundle = fixture_bundle("p2/sources/mezz_top/F0/mezz_top.kicad_pro", 0x22);
    let (k11, k22) = (key(0x11), key(0x22));
    let members = mezzanine_members(&base_bundle, &top_bundle, &k11, &k22);
    let path = write_document("place-misaligned", &doc);
    let (finished, out) = build("place-misaligned", &path, &members, &[]);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let bundle = output(&out);
    prism_bundle::schema::validate("prism.system_bundle.a0", &bundle).unwrap();
    let mates = bundle["placement"]["mates"].as_array().unwrap();
    let driving: Vec<&Value> = mates
        .iter()
        .filter(|mate| mate["driving"] == true)
        .collect();
    assert_eq!(driving.len(), 1, "one mate places the top board");
    let other = mates.iter().find(|mate| mate["driving"] == false).unwrap();
    assert!(other["miss"].is_object(), "the other mate reports its miss");
    let finding = finding(&bundle, "mate-misaligned").expect("mate-misaligned");
    assert_eq!(finding["severity"], "warning");
    assert_eq!(
        finding["subject"],
        format!("mate:{}", other["mate"].as_str().unwrap())
    );
}

// -------------------------------------------------------------------- mate pads (3c)

fn pad<'a>(pads: &'a Value, name: &str) -> &'a Value {
    pads.as_array()
        .unwrap()
        .iter()
        .find(|item| item["pad"] == name)
        .unwrap_or_else(|| panic!("pad {name} is drawn"))
}

fn centre_mm(pad: &Value) -> [f64; 2] {
    ["xNm", "yNm"].map(|axis| pad[axis].as_f64().unwrap() / 1e6)
}

#[test]
fn the_mated_pads_are_drawn_on_each_other_in_a_s_frame() {
    let bundle = mezzanine_bundle("mate-pads", mezzanine_mate(0, None));
    let mate = &bundle["mates"][0];
    let pads = &mate["pads"];
    let pairs = mate["pairs"].as_array().unwrap();
    assert!(!pairs.is_empty());
    for pair in pairs {
        let a = pad(&pads["a"], pair["a"].as_str().unwrap());
        let b = pad(&pads["b"], pair["b"].as_str().unwrap());
        let (ca, cb) = (centre_mm(a), centre_mm(b));
        let apart = (ca[0] - cb[0]).hypot(ca[1] - cb[1]);
        // A pair lands inside A's pad: no further apart than half its long side.
        let reach = a["longNm"].as_f64().unwrap() / 2e6 + 0.1;
        assert!(apart <= reach, "{pair} drawn {apart} mm apart");
        let angle = a["angleDeg"].as_f64().unwrap();
        assert!((0.0..180.0).contains(&angle), "angle {angle}");
    }
}

#[test]
fn a_quarter_turn_turns_b_s_drawn_pads() {
    let natural = mezzanine_bundle("mate-pads-0", mezzanine_mate(0, None));
    let turned = mezzanine_bundle("mate-pads-1", mezzanine_mate(1, None));
    let first = &natural["mates"][0]["pads"]["b"][0];
    let moved = &turned["mates"][0]["pads"]["b"][0];
    assert_eq!(first["pad"], moved["pad"]);
    let (p, q) = (centre_mm(first), centre_mm(moved));
    // A quarter turn about the mating axis keeps the distance from it and moves the pad.
    assert!((p[0].hypot(p[1]) - q[0].hypot(q[1])).abs() < 1e-3);
    assert!((p[0] - q[0]).hypot(p[1] - q[1]) > 0.1);
    // A's own pads do not move.
    assert_eq!(
        natural["mates"][0]["pads"]["a"],
        turned["mates"][0]["pads"]["a"]
    );
}
