//! Unit tests for the board scan, plus the `#[ignore]`d `geometry_oracle` that
//! compares `scan` against every committed golden on its prepared board
//! (run: `cargo test --offline -p prism-projections geometry_oracle --
//! --ignored --nocapture`).

use super::geometry::BoardFrame;
use super::*;
use crate::BoardModel;
use prism_kicad_core::{PcbLimits, PcbView};
use serde_json::{Value, json};

/// Wrap `body` (one or more footprints) in a minimal valid `kicad_pcb`.
fn board(body: &str) -> String {
    format!(
        "(kicad_pcb\n\
         \t(version 20241229)\n\
         \t(generator \"pcbnew\")\n\
         \t(general (thickness 1.6))\n\
         \t(layers (0 \"F.Cu\" signal) (31 \"B.Cu\" signal))\n\
         {body}\n\
         )\n"
    )
}

/// Build the board and run the scan.
fn facts(text: &str) -> BoardFacts {
    let view = PcbView::parse(text, PcbLimits::default()).expect("board parses");
    let board = BoardModel::new("test.kicad_pcb", text, &view);
    super::scan(&board).expect("scan succeeds")
}

#[test]
fn board_frame_matches_today() {
    // Python: a = radians(angle); x = fx + lx*c + ly*s; y = fy - lx*s + ly*c;
    // [_round(x), _round(-y)] with `math.cos`/`math.sin` (interface_extractor.py:216-224).
    let cases: [(f64, [f64; 2]); 5] = [
        (0.0, [11.0, -22.0]),
        (90.0, [12.0, -19.0]),
        (180.0, [9.0, -18.0]),
        (-90.0, [8.0, -21.0]),
        (30.0, [11.866, -21.2321]),
    ];
    for (angle, expected) in cases {
        let frame = BoardFrame::new(10.0, 20.0, angle);
        assert_eq!(frame.point(1.0, 2.0), expected, "angle {angle}");
    }
}

#[test]
fn a_bottom_side_footprint_is_bottom() {
    let text = board(
        "\t(footprint \"Lib:R_0603\"\n\
         \t\t(layer \"B.Cu\")\n\
         \t\t(at 1 2 0)\n\
         \t\t(property \"Reference\" \"R1\" (at 0 0 0) (layer \"F.SilkS\"))\n\
         \t\t(pad \"1\" smd rect (at 0 0) (size 1 1) (layers \"B.Cu\"))\n\
         \t)",
    );
    let facts = facts(&text);
    assert_eq!(facts.geometry["R1"]["side"], "bottom");
    assert_eq!(facts.geometry["R1"]["positionMm"], json!([1.0, -2.0]));
}

#[test]
fn the_first_model_is_kept_even_when_hidden() {
    // kicad_monkey's `Model.to_sexp()` never emits `hide` (kicad_model.py:58-63),
    // so `_model`'s skip is unreachable: the first model wins for `(hide)`,
    // `(hide yes)` and `(hide no)` alike. The golden `rs-cynthion` U1 has a
    // hidden first model and keeps it.
    let text = board(
        "\t(footprint \"Lib:R_0603\"\n\
         \t\t(layer \"F.Cu\")\n\
         \t\t(at 0 0 0)\n\
         \t\t(property \"Reference\" \"R1\" (at 0 0 0) (layer \"F.SilkS\"))\n\
         \t\t(pad \"1\" smd rect (at 0 0) (size 1 1) (layers \"F.Cu\"))\n\
         \t\t(model \"hidden.step\" (hide yes) (offset (xyz 0 0 0)) (scale (xyz 1 1 1)) (rotate (xyz 0 0 0)))\n\
         \t\t(model \"visible.step\" (offset (xyz 1 2 3)) (scale (xyz 1 1 1)) (rotate (xyz 0 0 0)))\n\
         \t)\n\
         \t(footprint \"Lib:R_0603\"\n\
         \t\t(layer \"F.Cu\")\n\
         \t\t(at 0 0 0)\n\
         \t\t(property \"Reference\" \"R2\" (at 0 0 0) (layer \"F.SilkS\"))\n\
         \t\t(pad \"1\" smd rect (at 0 0) (size 1 1) (layers \"F.Cu\"))\n\
         \t\t(model \"bare.step\" (hide) (offset (xyz 0 0 0)) (scale (xyz 1 1 1)) (rotate (xyz 0 0 0)))\n\
         \t)\n\
         \t(footprint \"Lib:R_0603\"\n\
         \t\t(layer \"F.Cu\")\n\
         \t\t(at 0 0 0)\n\
         \t\t(property \"Reference\" \"R3\" (at 0 0 0) (layer \"F.SilkS\"))\n\
         \t\t(pad \"1\" smd rect (at 0 0) (size 1 1) (layers \"F.Cu\"))\n\
         \t\t(model \"shown.step\" (hide no) (offset (xyz 0 0 0)) (scale (xyz 1 1 1)) (rotate (xyz 0 0 0)))\n\
         \t)",
    );
    let facts = facts(&text);
    assert_eq!(
        facts.geometry["R1"]["model"]["path"], "hidden.step",
        "the hidden first model is kept"
    );
    assert_eq!(facts.geometry["R2"]["model"]["path"], "bare.step");
    assert_eq!(facts.geometry["R3"]["model"]["path"], "shown.step");
}

#[test]
fn a_courtyard_arc_uses_three_points() {
    // `_courtyard_points` (interface_extractor.py:192-193) adds arc start/mid/end
    // only, then the extent negates y (`:240-242`).
    let text = board(
        "\t(footprint \"Lib:R_0603\"\n\
         \t\t(layer \"F.Cu\")\n\
         \t\t(at 0 0 0)\n\
         \t\t(property \"Reference\" \"R1\" (at 0 0 0) (layer \"F.SilkS\"))\n\
         \t\t(pad \"1\" smd rect (at 0 0) (size 1 1) (layers \"F.Cu\"))\n\
         \t\t(fp_arc (start 0 -1) (mid 1 0) (end 0 1) (layer \"F.CrtYd\") (stroke (width 0.05) (type solid)))\n\
         \t)",
    );
    let facts = facts(&text);
    assert_eq!(
        facts.geometry["R1"]["courtyard"],
        json!({"minMm": [0.0, -1.0], "maxMm": [1.0, 1.0]})
    );
}

#[test]
fn a_repeated_reference_keeps_first_geometry_and_all_pad_nets() {
    // `_board_geometry` keeps the first footprint per reference (:255-262);
    // `_board_pad_nets` reads every one (:151-165). Pads sort stably by
    // `_natural` pad number (:236).
    let text = board(
        "\t(footprint \"Lib:first\"\n\
         \t\t(layer \"F.Cu\")\n\
         \t\t(at 10 20 0)\n\
         \t\t(property \"Reference\" \"R1\" (at 0 0 0) (layer \"F.SilkS\"))\n\
         \t\t(pad \"2\" smd rect (at -1 0) (size 1 1) (layers \"F.Cu\") (net \"X\"))\n\
         \t\t(pad \"10\" smd rect (at 1 0) (size 1 1) (layers \"F.Cu\") (net \"Y\"))\n\
         \t\t(pad \"\" smd circle (at 0 0) (size 0.5 0.5) (layers \"F.Cu\"))\n\
         \t\t(fp_line (start -2 -2) (end 2 2) (layer \"F.CrtYd\") (stroke (width 0.05) (type solid)))\n\
         \t)\n\
         \t(footprint \"Lib:second\"\n\
         \t\t(layer \"B.Cu\")\n\
         \t\t(at 30 40 0)\n\
         \t\t(property \"Reference\" \"R1\" (at 0 0 0) (layer \"F.SilkS\"))\n\
         \t\t(pad \"1\" smd rect (at 0 0) (size 1 1) (layers \"B.Cu\") (net \"Z\"))\n\
         \t\t(pad \"2\" thru_hole circle (at 1 0) (size 1 1) (layers \"F.Cu\") (net \"W\"))\n\
         \t)",
    );
    let facts = facts(&text);
    let geometry = &facts.geometry["R1"];
    assert_eq!(geometry["footprintName"], "first");
    assert_eq!(geometry["positionMm"], json!([10.0, -20.0]));
    assert_eq!(geometry["side"], "top");
    let pad_numbers: Vec<&str> = geometry["pads"]
        .as_array()
        .expect("pads")
        .iter()
        .map(|pad| pad["pad"].as_str().unwrap_or(""))
        .collect();
    assert_eq!(pad_numbers, ["", "2", "10"]);
    assert_eq!(geometry["pads"][2]["tht"], false);

    assert_eq!(facts.pad_nets["R1"]["1"], BTreeSet::from(["Z".to_owned()]));
    assert_eq!(
        facts.pad_nets["R1"]["2"],
        BTreeSet::from(["W".to_owned(), "X".to_owned()])
    );
    assert_eq!(facts.pad_nets["R1"]["10"], BTreeSet::from(["Y".to_owned()]));
    assert!(!facts.pad_nets["R1"].contains_key(""));
}

/// The acceptance oracle: on every case with a golden, run `scan` over the
/// prepared board and compare every component's `geometry` (null when absent)
/// and every pin's normalized `pcbNets` (null when absent), floats bit for bit.
#[test]
#[ignore = "parity oracle; needs the prepared corpus under the scratchpad"]
fn geometry_oracle() {
    use std::fs;
    use std::path::{Path, PathBuf};

    let native = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .expect("native root");
    let goldens = native.join("parity/goldens");
    let prep = PathBuf::from(
        "/private/tmp/claude-503/-Users-Swaroop-Personal-Projects/\
         f336681f-9155-4f00-80ce-4ac48096d8c0/scratchpad/p1/prep",
    );
    let cases: Value =
        serde_json::from_str(&fs::read_to_string(prep.join("cases.json")).expect("cases.json"))
            .expect("cases.json parses");

    let mut mismatches = 0usize;
    let mut cases_checked = 0usize;
    for entry in fs::read_dir(&goldens).expect("goldens dir") {
        let directory = entry.expect("golden entry").path();
        let golden_path = directory.join("system-interface.json");
        if !golden_path.is_file() {
            continue;
        }
        let case = directory
            .file_name()
            .and_then(|name| name.to_str())
            .expect("case name")
            .to_owned();
        let golden: Value =
            serde_json::from_str(&fs::read_to_string(&golden_path).expect("golden"))
                .expect("golden parses");

        // The prepared board is `<src>/<project stem>.kicad_pcb`.
        let board_path = cases
            .get(&case)
            .and_then(|case| {
                let src = case.get("src")?.as_str()?;
                let stem = case.get("project")?.as_str()?.strip_suffix(".kicad_pro")?;
                Some(PathBuf::from(src).join(format!("{stem}.kicad_pcb")))
            })
            .filter(|path| path.is_file());

        let board_facts = match &board_path {
            Some(path) => {
                let text = fs::read_to_string(path).expect("board text");
                let view = PcbView::parse(&text, PcbLimits::default()).expect("board parses");
                let board = BoardModel::new(path.to_str().expect("board path"), &text, &view);
                super::scan(&board).expect("scan")
            }
            None => BoardFacts::default(),
        };

        let mut checked = 0usize;
        let mut bad = 0usize;
        for component in golden["components"].as_array().expect("components") {
            let reference = component["reference"].as_str().expect("reference");
            let expected_geometry = component.get("geometry").unwrap_or(&Value::Null);
            let actual_geometry = board_facts
                .geometry
                .get(reference)
                .cloned()
                .unwrap_or(Value::Null);
            checked += 1;
            if !same_json(expected_geometry, &actual_geometry) {
                bad += 1;
                println!(
                    "{case} {reference}: geometry golden={} member={}",
                    expected_geometry, actual_geometry
                );
            }
            for pin in component["pins"].as_array().into_iter().flatten() {
                let pad = pin["pad"].as_str().unwrap_or("");
                let expected = pin.get("pcbNets").unwrap_or(&Value::Null);
                let actual = normalized(&board_facts, reference, pad);
                if !same_json(expected, &actual) {
                    bad += 1;
                    println!(
                        "{case} {reference}.{pad}: pcbNets golden={} member={}",
                        expected, actual
                    );
                }
            }
        }
        println!("{case}: {checked} components, {bad} mismatches");
        mismatches += bad;
        cases_checked += 1;
    }
    println!("geometry_oracle: {cases_checked} cases, {mismatches} mismatches");
    assert_eq!(
        mismatches, 0,
        "each golden component's geometry and pcbNets"
    );
}

/// `normalized_nets` (interface_extractor.py:47-49): the sorted set minus `""`
/// and `unconnected-(…)`.
fn normalized(facts: &BoardFacts, reference: &str, pad: &str) -> Value {
    match facts.pad_nets.get(reference).and_then(|pads| pads.get(pad)) {
        Some(names) => Value::Array(
            names
                .iter()
                .filter(|name| !name.is_empty() && !name.starts_with("unconnected-("))
                .map(|name| Value::String(name.clone()))
                .collect(),
        ),
        None => Value::Null,
    }
}

/// JSON equality with floats compared bit for bit.
fn same_json(left: &Value, right: &Value) -> bool {
    match (left, right) {
        (Value::Number(left), Value::Number(right)) => match (left.as_f64(), right.as_f64()) {
            (Some(left), Some(right)) => left.to_bits() == right.to_bits(),
            _ => left == right,
        },
        (Value::Array(left), Value::Array(right)) => {
            left.len() == right.len() && left.iter().zip(right).all(|(a, b)| same_json(a, b))
        }
        (Value::Object(left), Value::Object(right)) => {
            left.len() == right.len()
                && left
                    .iter()
                    .all(|(key, value)| right.get(key).is_some_and(|other| same_json(value, other)))
        }
        _ => left == right,
    }
}
