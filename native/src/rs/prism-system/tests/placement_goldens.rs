//! SB2-12/SB2-35/SB2-36: the shared placement goldens and the datasheet
//! mezzanine checks, replayed against the Rust port.
//!
//! `placement_cases.json` is shared with the Python twin
//! (`backend/tests/test_system_placement_frames.py`,
//! `backend/tests/test_system_placement_mate.py`) and the TypeScript twin
//! (`frontend/src/features/system-builder/placement/*.test.ts`). The datasheet
//! checks port `test_system_placement_mate.py`'s `DatasheetTest` and `BodyTest`
//! against `p2/goldens/geometry_fixtures.json` and
//! `p2/goldens/mezzanine_ends.json`.

use prism_system::placement::frames::{
    ConnectorFrame, ConnectorGeometry, Inference, MatingAxis, StoredFrame, connector_frame, infer,
    pad_one, quaternion,
};
use prism_system::placement::mate::{
    CLEARANCE_MARGIN_MM, HeightSource, MateEnd, MateResult, body_corners, clearance_height, local,
    mate, residual,
};
use prism_system::placement::poses::{
    Bounds, DEFAULT_GAP_MM, IDENTITY, PlacedPose, Pose, canonical_rotation, compose, default_row,
    matrix, place, pose_from, rotate, transform_bounds, union,
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

const DATASHEET_MM: f64 = 0.01;
const MEANING_MM: f64 = 1e-4;
const MEANING_UNIT: f64 = 1e-6;

fn repo_path(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../..")
        .join(relative)
}

fn read_json(relative: &str) -> Value {
    let path = repo_path(relative);
    let text = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("read {}: {error}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|error| panic!("parse {}: {error}", path.display()))
}

fn placement_cases() -> Value {
    read_json("backend/tests/fixtures/system_builder/placement_cases.json")
}

fn tolerance(root: &Value) -> (f64, f64) {
    (
        root["tolerance"]["mm"].as_f64().unwrap(),
        root["tolerance"]["unit"].as_f64().unwrap(),
    )
}

fn from_value<T: for<'de> Deserialize<'de>>(value: &Value) -> T {
    serde_json::from_value(value.clone())
        .unwrap_or_else(|error| panic!("deserialise {value}: {error}"))
}

fn f64s(value: &Value) -> Vec<f64> {
    value
        .as_array()
        .unwrap_or_else(|| panic!("expected an array, got {value}"))
        .iter()
        .map(|entry| {
            entry
                .as_f64()
                .unwrap_or_else(|| panic!("expected a number, got {entry}"))
        })
        .collect()
}

fn f64_3(value: &Value) -> [f64; 3] {
    let values = f64s(value);
    [values[0], values[1], values[2]]
}

fn f64_4(value: &Value) -> [f64; 4] {
    let values = f64s(value);
    [values[0], values[1], values[2], values[3]]
}

fn assert_close(actual: &[f64], expected: &[f64], tolerance: f64, label: &str) {
    assert_eq!(actual.len(), expected.len(), "{label}");
    for (a, e) in actual.iter().zip(expected) {
        assert!(
            (a - e).abs() <= tolerance,
            "{label}: {actual:?} != {expected:?}"
        );
    }
}

/// Equal structure, numbers within `tolerance` (the TS twin's `expectClose`).
fn assert_value_close(actual: &Value, expected: &Value, tolerance: f64, path: &str) {
    match expected {
        Value::Number(expected) => {
            let expected = expected.as_f64().unwrap();
            let actual = actual
                .as_f64()
                .unwrap_or_else(|| panic!("{path}: expected a number, got {actual}"));
            assert!(
                (actual - expected).abs() <= tolerance,
                "{path}: {actual} != {expected}"
            );
        }
        Value::Array(expected) => {
            let actual = actual
                .as_array()
                .unwrap_or_else(|| panic!("{path}: expected an array, got {actual}"));
            assert_eq!(actual.len(), expected.len(), "{path}: length");
            for (index, (a, e)) in actual.iter().zip(expected).enumerate() {
                assert_value_close(a, e, tolerance, &format!("{path}[{index}]"));
            }
        }
        Value::Object(expected) => {
            let actual = actual
                .as_object()
                .unwrap_or_else(|| panic!("{path}: expected an object, got {actual}"));
            let mut actual_keys: Vec<&String> = actual.keys().collect();
            let mut expected_keys: Vec<&String> = expected.keys().collect();
            actual_keys.sort();
            expected_keys.sort();
            assert_eq!(actual_keys, expected_keys, "{path}: keys");
            for (key, expected) in expected {
                assert_value_close(&actual[key], expected, tolerance, &format!("{path}.{key}"));
            }
        }
        _ => assert_eq!(actual, expected, "{path}"),
    }
}

fn items(value: &Value) -> Vec<(String, Option<Bounds>)> {
    value
        .as_array()
        .unwrap_or_else(|| panic!("expected items, got {value}"))
        .iter()
        .map(|item| {
            let pair = item.as_array().expect("an item is [label, bounds]");
            (
                pair[0].as_str().expect("an item label").to_owned(),
                from_value(&pair[1]),
            )
        })
        .collect()
}

// ---------------------------------------------------------------------------
// frames

#[derive(Deserialize)]
struct FrameCase {
    name: String,
    geometry: Option<ConnectorGeometry>,
    #[serde(rename = "thicknessMm")]
    thickness_mm: Option<f64>,
    #[serde(default)]
    stored: Option<StoredFrame>,
    expected: FrameExpected,
}

#[derive(Deserialize)]
struct FrameExpected {
    inference: Inference,
    frame: Option<ConnectorFrame>,
}

#[test]
fn frames_replay_every_golden_case() {
    let root = placement_cases();
    let (mm, unit) = tolerance(&root);
    let cases: Vec<FrameCase> = from_value(&root["frames"]);
    assert!(cases.len() >= 14, "the goldens cover 14 frame cases");
    for case in &cases {
        let inferred = infer(case.geometry.as_ref());
        assert_eq!(
            inferred, case.expected.inference,
            "{}: inference",
            case.name
        );
        let frame = connector_frame(
            case.geometry.as_ref(),
            case.thickness_mm,
            case.stored.as_ref(),
        );
        let Some(expected) = case.expected.frame.as_ref() else {
            assert!(frame.is_none(), "{}: expected no frame", case.name);
            continue;
        };
        let frame = frame.unwrap_or_else(|| panic!("{}: expected a frame", case.name));
        assert_eq!(frame.axis, expected.axis, "{}: axis", case.name);
        assert_eq!(
            frame.quarter_turns, expected.quarter_turns,
            "{}: quarterTurns",
            case.name
        );
        assert_close(&frame.origin_mm, &expected.origin_mm, mm, &case.name);
        for (label, actual, expected) in [
            ("xAxis", &frame.x_axis, &expected.x_axis),
            ("yAxis", &frame.y_axis, &expected.y_axis),
            ("zAxis", &frame.z_axis, &expected.z_axis),
        ] {
            assert_close(actual, expected, unit, &format!("{}: {label}", case.name));
        }
        assert_close(
            &frame.rotation,
            &expected.rotation,
            unit,
            &format!("{}: rotation", case.name),
        );
    }
}

#[test]
fn quaternions_are_unit_and_canonical() {
    assert_eq!(
        quaternion([1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]),
        [0.0, 0.0, 0.0, 1.0]
    );
    // 180° about x: w = 0, x leads.
    let flipped = quaternion([1.0, 0.0, 0.0], [0.0, -1.0, 0.0], [0.0, 0.0, -1.0]);
    assert_eq!(flipped.map(round12), [1.0, 0.0, 0.0, 0.0]);
    let root = placement_cases();
    let cases: Vec<FrameCase> = from_value(&root["frames"]);
    for case in &cases {
        if let Some(frame) = case.expected.frame.as_ref() {
            let norm = frame.rotation.iter().map(|c| c * c).sum::<f64>();
            assert!(
                (norm - 1.0).abs() <= 1e-12,
                "{}: unit quaternion",
                case.name
            );
            assert!(frame.rotation[3] >= 0.0, "{}: canonical", case.name);
        }
    }
}

fn round12(value: f64) -> f64 {
    (value * 1e12).round() / 1e12 + 0.0
}

// ---------------------------------------------------------------------------
// poses

#[derive(Deserialize)]
struct PoseCase {
    name: String,
    op: String,
    input: Value,
    expected: Value,
}

fn run_pose_op(op: &str, input: &Value) -> Value {
    match op {
        "canonicalRotation" => json!(canonical_rotation(f64_4(&input["rotation"]))),
        "poseFrom" => json!(
            pose_from(&f64s(&input["translationMm"]), &f64s(&input["rotation"]))
                .expect("the golden pose is valid")
        ),
        "compose" => {
            let parent: Pose = from_value(&input["parent"]);
            let child: Pose = from_value(&input["child"]);
            json!(compose(&parent, &child))
        }
        "matrix" => {
            let pose: Pose = from_value(&input["pose"]);
            json!(matrix(&pose))
        }
        "transformBounds" => {
            let pose: Pose = from_value(&input["pose"]);
            let bounds: Option<Bounds> = from_value(&input["bounds"]);
            json!(transform_bounds(&pose, bounds.as_ref()))
        }
        "defaultRow" => json!(default_row(&items(&input["items"]), DEFAULT_GAP_MM)),
        "place" => {
            let stored: BTreeMap<String, PlacedPose> = from_value(&input["stored"]);
            json!(place(&items(&input["items"]), &stored, DEFAULT_GAP_MM))
        }
        other => panic!("unknown pose op {other}"),
    }
}

#[test]
fn poses_replay_every_golden_case() {
    let root = placement_cases();
    let (_, unit) = tolerance(&root);
    let cases: Vec<PoseCase> = from_value(&root["poses"]);
    let ops: Vec<&str> = cases.iter().map(|case| case.op.as_str()).collect();
    for op in [
        "canonicalRotation",
        "poseFrom",
        "compose",
        "matrix",
        "transformBounds",
        "defaultRow",
        "place",
    ] {
        assert!(ops.contains(&op), "the goldens cover the {op} op");
    }
    for case in &cases {
        let actual = run_pose_op(&case.op, &case.input);
        assert_value_close(&actual, &case.expected, unit, &case.name);
    }
}

#[test]
fn union_skips_the_unknown_boxes() {
    assert_eq!(union(&[None, None]), None);
    let boxes = [
        Some(Bounds {
            min_mm: [0.0, 0.0, -1.0],
            max_mm: [10.0, 5.0, 1.0],
        }),
        None,
        Some(Bounds {
            min_mm: [-2.0, 3.0, 0.0],
            max_mm: [4.0, 9.0, 2.0],
        }),
    ];
    assert_eq!(
        union(&boxes),
        Some(Bounds {
            min_mm: [-2.0, 0.0, -1.0],
            max_mm: [10.0, 9.0, 2.0],
        })
    );
}

// ---------------------------------------------------------------------------
// mates

#[derive(Deserialize)]
struct MateCase {
    name: String,
    op: String,
    input: Value,
    expected: Option<Value>,
}

fn resolve_end(ends: &Value, end: &Value) -> MateEnd {
    let value = match end.get("end").and_then(Value::as_str) {
        None => end.clone(),
        Some(key) => {
            let mut merged = ends[key]
                .as_object()
                .unwrap_or_else(|| panic!("mateEnds has no {key}"))
                .clone();
            for (field, value) in end.as_object().expect("a mate end is an object") {
                if field != "end" {
                    merged.insert(field.clone(), value.clone());
                }
            }
            Value::Object(merged)
        }
    };
    from_value(&value)
}

fn resolved_mate_input(ends: &Value, input: &Value) -> (MateEnd, MateEnd) {
    (
        resolve_end(ends, &input["a"]),
        resolve_end(ends, &input["b"]),
    )
}

fn assert_mate_replay(
    name: &str,
    got: &Option<MateResult>,
    expected: &Option<Value>,
    mm: f64,
    unit: f64,
) {
    match (got, expected) {
        (None, None) => {}
        (Some(got), Some(expected)) => {
            assert_eq!(json!(got.quarter_turns), expected["quarterTurns"], "{name}");
            assert_eq!(json!(got.height_source), expected["heightSource"], "{name}");
            let stack = expected["stackHeightMm"].as_f64().unwrap();
            assert!(
                (got.stack_height_mm - stack).abs() <= mm,
                "{name}: stackHeightMm {} != {stack}",
                got.stack_height_mm
            );
            let pose: Pose = from_value(&expected["pose"]);
            assert_close(
                &got.pose.translation_mm,
                &pose.translation_mm,
                mm,
                &format!("{name}: translation"),
            );
            assert_close(
                &got.pose.rotation,
                &pose.rotation,
                unit,
                &format!("{name}: rotation"),
            );
        }
        _ => panic!("{name}: got {got:?}, expected {expected:?}"),
    }
}

#[test]
fn mates_replay_every_golden_case() {
    let root = placement_cases();
    let (mm, unit) = tolerance(&root);
    let cases: Vec<MateCase> = from_value(&root["mates"]);
    assert!(cases.len() >= 11, "the goldens cover 11 mate cases");
    for case in &cases {
        let input = &case.input;
        let (a, b) = resolved_mate_input(&root["mateEnds"], input);
        match case.op.as_str() {
            "mate" => {
                let got = mate(&a, &b, input["stackHeightMm"].as_f64());
                assert_mate_replay(&case.name, &got, &case.expected, mm, unit);
            }
            "residual" => {
                let a_world: Pose = from_value(&input["aWorld"]);
                let b_world: Pose = from_value(&input["bWorld"]);
                let mated: MateResult = from_value(&input["result"]);
                let got = residual(&a_world, &b_world, &a, &b, &mated)
                    .unwrap_or_else(|| panic!("{}: no residual", case.name));
                let expected = case
                    .expected
                    .as_ref()
                    .unwrap_or_else(|| panic!("{}: no expected residual", case.name));
                assert_close(
                    &got.offset_mm,
                    &f64_3(&expected["offsetMm"]),
                    mm,
                    &format!("{}: offsetMm", case.name),
                );
                for (label, actual) in [
                    ("distanceMm", got.distance_mm),
                    ("lateralMm", got.lateral_mm),
                    ("angleDeg", got.angle_deg),
                ] {
                    let expected = expected[label].as_f64().unwrap();
                    assert!(
                        (actual - expected).abs() <= mm,
                        "{}: {label} {actual} != {expected}",
                        case.name
                    );
                }
            }
            other => panic!("{}: unknown mate op {other}", case.name),
        }
    }
}

/// Axes opposed; B's connector origin exactly `h` along A's axis; pad 1 on pad
/// 1 unless the case says otherwise (`test_every_mate_means_what_it_says`).
#[test]
fn every_mate_means_what_it_says() {
    let root = placement_cases();
    let cases: Vec<MateCase> = from_value(&root["mates"]);
    for case in &cases {
        let input = &case.input;
        if case.op != "mate" {
            continue;
        }
        let (a, b) = resolved_mate_input(&root["mateEnds"], input);
        let expected = match case.expected.as_ref() {
            Some(expected) => expected,
            None => continue,
        };
        let frame_a = connector_frame(Some(&a.geometry), a.thickness_mm, a.stored.as_ref())
            .unwrap_or_else(|| panic!("{}: no A frame", case.name));
        let frame_b = connector_frame(Some(&b.geometry), b.thickness_mm, b.stored.as_ref())
            .unwrap_or_else(|| panic!("{}: no B frame", case.name));
        let pose: Pose = from_value(&expected["pose"]);
        let z_b = rotate(pose.rotation, frame_b.z_axis);
        assert!(
            (z_b[0] * frame_a.z_axis[0]
                + z_b[1] * frame_a.z_axis[1]
                + z_b[2] * frame_a.z_axis[2]
                + 1.0)
                .abs()
                <= MEANING_UNIT,
            "{}: mating axes are opposed",
            case.name
        );
        let origin_b = compose(
            &pose,
            &Pose {
                translation_mm: frame_b.origin_mm,
                rotation: IDENTITY.rotation,
            },
        );
        let stack = expected["stackHeightMm"].as_f64().unwrap();
        assert_close(
            &local(&frame_a, origin_b.translation_mm),
            &[0.0, 0.0, stack],
            MEANING_MM,
            &format!("{}: B's connector origin", case.name),
        );
        let pad_a = pad_origin(&a);
        let pad_b = pad_origin(&b);
        let landed = local(
            &frame_a,
            compose(
                &pose,
                &Pose {
                    translation_mm: pad_b,
                    rotation: IDENTITY.rotation,
                },
            )
            .translation_mm,
        );
        let own = local(&frame_a, pad_a);
        if case.name.contains("quarter-turn") {
            assert_close(
                &landed[..2],
                &[-own[1], own[0]],
                MEANING_MM,
                &format!("{}: pad 1, turned", case.name),
            );
        } else if case.name.contains("one row across") {
            assert_close(
                &landed[..2],
                &[own[0], -own[1]],
                MEANING_MM,
                &format!("{}: pad 1, mirrored row", case.name),
            );
        } else {
            assert_close(
                &landed[..2],
                &own[..2],
                MEANING_MM,
                &format!("{}: pad 1", case.name),
            );
        }
    }
}

fn pad_origin(end: &MateEnd) -> [f64; 3] {
    let geometry = &end.geometry;
    let pad = pad_one(geometry).expect("a pad to orient from");
    let half = end.thickness_mm.unwrap_or(0.0) / 2.0;
    [
        pad.position_mm[0],
        pad.position_mm[1],
        if geometry.side == prism_system::placement::frames::Side::Top {
            half
        } else {
            -half
        },
    ]
}

#[test]
fn named_mate_assemblies() {
    let root = placement_cases();
    let cases: Vec<MateCase> = from_value(&root["mates"]);
    let expected_of = |name: &str| {
        cases
            .iter()
            .find(|case| case.name == name)
            .and_then(|case| case.expected.as_ref())
            .unwrap_or_else(|| panic!("no mate case {name}"))
    };
    let orthogonal: Pose =
        from_value(&expected_of("orthogonal: right-angle header into a vertical socket")["pose"]);
    let coplanar: Pose =
        from_value(&expected_of("coplanar: right-angle socket and right-angle header")["pose"]);
    let up = rotate(orthogonal.rotation, [0.0, 0.0, 1.0]);
    assert!(up[2].abs() <= MEANING_UNIT);
    assert_close(
        &rotate(coplanar.rotation, [0.0, 0.0, 1.0]),
        &[0.0, 0.0, 1.0],
        MEANING_UNIT,
        "coplanar normal",
    );
    assert!(coplanar.translation_mm[2].abs() <= tolerance(&root).0);
    let square = expected_of("square 2x2 headers: k turns pad 1 onto pad 1");
    assert_eq!(square["quarterTurns"], json!(1));
    assert!(
        cases
            .iter()
            .find(|case| case.name == "an end without a frame gives no mate")
            .is_some_and(|case| case.expected.is_none())
    );
}

// ---------------------------------------------------------------------------
// datasheet mezzanine (p2/goldens)

#[derive(Deserialize)]
struct GeometryGoldens {
    mezzanine: Mezzanine,
    #[serde(rename = "mezzanineShifted")]
    mezzanine_shifted: ShiftedGoldens,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Mezzanine {
    base: String,
    top: String,
    mated_height_mm: f64,
    top_pose_in_base_frame: Pose,
    residual_mm: BTreeMap<String, f64>,
    clearance: ClearanceGoldens,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClearanceGoldens {
    terminal_body_height_mm: f64,
    socket_body_height_mm: f64,
    stack_height_mm: f64,
    top_pose_z_mm: f64,
    assumed_stack_height_mm: f64,
    assumed_top_pose_z_mm: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShiftedGoldens {
    top: String,
    residual_mm: BTreeMap<String, f64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    ends: BTreeMap<String, ConnectorGeometry>,
    thickness_mm: f64,
}

fn datasheet_goldens() -> GeometryGoldens {
    from_value(&read_json(
        "backend/tests/fixtures/system_builder/p2/goldens/geometry_fixtures.json",
    ))
}

fn mezzanine_ends() -> BTreeMap<String, Snapshot> {
    from_value(&read_json(
        "backend/tests/fixtures/system_builder/p2/goldens/mezzanine_ends.json",
    ))
}

fn fixture_end(snapshot: &Snapshot, reference: &str) -> MateEnd {
    MateEnd {
        geometry: snapshot
            .ends
            .get(reference)
            .unwrap_or_else(|| panic!("no end {reference}"))
            .clone(),
        thickness_mm: Some(snapshot.thickness_mm),
        stored: None,
        body_mm: None,
    }
}

fn with_body(end: &MateEnd, height: f64) -> MateEnd {
    let courtyard = end
        .geometry
        .courtyard
        .as_ref()
        .expect("the datasheet connectors have a courtyard");
    MateEnd {
        body_mm: Some(Bounds {
            min_mm: [courtyard.min_mm[0], courtyard.min_mm[1], 0.0],
            max_mm: [courtyard.max_mm[0], courtyard.max_mm[1], height],
        }),
        ..end.clone()
    }
}

fn assert_within(actual: &[f64], expected: &[f64], label: &str) {
    for (a, e) in actual.iter().zip(expected) {
        assert!(
            (a - e).abs() <= DATASHEET_MM,
            "{label}: {actual:?} != {expected:?}"
        );
    }
}

#[test]
fn datasheet_mated_height_poses_the_top_board() {
    let goldens = datasheet_goldens();
    let ends = mezzanine_ends();
    let mezz = &goldens.mezzanine;
    let base = fixture_end(&ends[mezz.base.as_str()], "J1");
    let top = fixture_end(&ends[mezz.top.as_str()], "J1");
    let result = mate(&base, &top, Some(mezz.mated_height_mm)).expect("a mate");
    assert_eq!(result.height_source, HeightSource::Link);
    assert_eq!(result.stack_height_mm, mezz.mated_height_mm);
    assert_within(
        &result.pose.translation_mm,
        &mezz.top_pose_in_base_frame.translation_mm,
        "translation",
    );
    assert_within(
        &result.pose.rotation,
        &mezz.top_pose_in_base_frame.rotation,
        "rotation",
    );
}

#[test]
fn datasheet_residuals_with_j1_driving() {
    let goldens = datasheet_goldens();
    let ends = mezzanine_ends();
    let mezz = &goldens.mezzanine;
    let base = |reference: &str| fixture_end(&ends[mezz.base.as_str()], reference);
    let top = |reference: &str| fixture_end(&ends[mezz.top.as_str()], reference);
    let shifted =
        |reference: &str| fixture_end(&ends[goldens.mezzanine_shifted.top.as_str()], reference);
    let placed = mate(&base("J1"), &top("J1"), Some(mezz.mated_height_mm))
        .expect("the J1 mate")
        .pose;
    let check = |snapshot: &dyn Fn(&str) -> MateEnd, expected: &BTreeMap<String, f64>| {
        for reference in ["J1", "J2"] {
            let own = mate(
                &base(reference),
                &snapshot(reference),
                Some(mezz.mated_height_mm),
            )
            .expect("the pair's mate");
            let got = residual(
                &IDENTITY,
                &placed,
                &base(reference),
                &snapshot(reference),
                &own,
            )
            .expect("a residual");
            assert!(
                (got.distance_mm - expected[reference]).abs() <= DATASHEET_MM,
                "{reference}: distanceMm {} != {}",
                got.distance_mm,
                expected[reference]
            );
            assert!(
                got.angle_deg.abs() <= 1e-6,
                "{reference}: angleDeg {} != 0",
                got.angle_deg
            );
        }
    };
    check(&top, &mezz.residual_mm);
    check(&shifted, &goldens.mezzanine_shifted.residual_mm);
    let shifted = residual(
        &IDENTITY,
        &mate(&base("J1"), &shifted("J1"), Some(7.0))
            .expect("the shifted J1 mate")
            .pose,
        &base("J2"),
        &shifted("J2"),
        &mate(&base("J2"), &shifted("J2"), Some(7.0)).expect("the shifted J2 mate"),
    )
    .expect("a shifted residual");
    assert!(
        (shifted.lateral_mm - 1.5).abs() <= DATASHEET_MM,
        "lateralMm"
    );
    assert!(shifted.offset_mm[2].abs() <= DATASHEET_MM, "offsetMm[2]");
}

#[test]
fn datasheet_clearance_from_the_body_heights() {
    let goldens = datasheet_goldens();
    let ends = mezzanine_ends();
    let mezz = &goldens.mezzanine;
    let clearance = &mezz.clearance;
    let result = mate(
        &with_body(
            &fixture_end(&ends[mezz.base.as_str()], "J1"),
            clearance.terminal_body_height_mm,
        ),
        &with_body(
            &fixture_end(&ends[mezz.top.as_str()], "J1"),
            clearance.socket_body_height_mm,
        ),
        None,
    )
    .expect("a clearance mate");
    assert_eq!(result.height_source, HeightSource::Clearance);
    assert!((result.stack_height_mm - clearance.stack_height_mm).abs() <= DATASHEET_MM);
    assert!((result.pose.translation_mm[2] - clearance.top_pose_z_mm).abs() <= DATASHEET_MM);
}

#[test]
fn datasheet_clearance_without_bodies_assumes_five_millimetres() {
    let goldens = datasheet_goldens();
    let ends = mezzanine_ends();
    let mezz = &goldens.mezzanine;
    let clearance = &mezz.clearance;
    let result = mate(
        &fixture_end(&ends[mezz.base.as_str()], "J1"),
        &fixture_end(&ends[mezz.top.as_str()], "J1"),
        None,
    )
    .expect("a clearance mate");
    assert!((result.stack_height_mm - clearance.assumed_stack_height_mm).abs() <= DATASHEET_MM);
    assert!(
        (result.pose.translation_mm[2] - clearance.assumed_top_pose_z_mm).abs() <= DATASHEET_MM
    );
}

#[test]
fn datasheet_given_stack_height_wins_over_clearance() {
    let ends = mezzanine_ends();
    let goldens = datasheet_goldens();
    let mezz = &goldens.mezzanine;
    let result = mate(
        &with_body(&fixture_end(&ends[mezz.base.as_str()], "J1"), 4.9),
        &with_body(&fixture_end(&ends[mezz.top.as_str()], "J1"), 3.23),
        Some(7.0),
    )
    .expect("a mate");
    assert_eq!(result.height_source, HeightSource::Link);
    assert_eq!(result.stack_height_mm, 7.0);
}

// ---------------------------------------------------------------------------
// bodies and clearance (test_system_placement_mate.py BodyTest)

fn identity_frame() -> ConnectorFrame {
    ConnectorFrame {
        axis: MatingAxis::Top,
        quarter_turns: 0,
        origin_mm: [0.0, 0.0, 0.0],
        x_axis: [1.0, 0.0, 0.0],
        y_axis: [0.0, 1.0, 0.0],
        z_axis: [0.0, 0.0, 1.0],
        rotation: [0.0, 0.0, 0.0, 1.0],
    }
}

fn box_corners(x0: f64) -> Vec<[f64; 3]> {
    [x0, x0 + 1.0]
        .into_iter()
        .flat_map(|x| {
            [-0.5, 0.5]
                .into_iter()
                .flat_map(move |y| [0.0, 3.0].into_iter().map(move |z| [x, y, z]))
        })
        .collect()
}

#[test]
fn a_back_side_body_hangs_below_the_board() {
    let geometry = ConnectorGeometry {
        side: prism_system::placement::frames::Side::Bottom,
        position_mm: [10.0, 0.0],
        rotation_deg: 90.0,
        footprint_name: None,
        pads: Vec::new(),
        courtyard: Some(prism_system::placement::frames::Courtyard {
            min_mm: [-1.0, -2.0],
            max_mm: [1.0, 2.0],
        }),
        model: None,
    };
    let corners = body_corners(&geometry, Some(1.6), None).expect("body corners");
    let z: Vec<f64> = corners.iter().map(|corner| corner[2]).collect();
    for value in [-0.8_f64, -5.8] {
        assert!(
            z.iter().any(|z| (z - value).abs() <= 1e-9),
            "z {value}: {z:?}"
        );
    }
    let mut xy: Vec<(f64, f64)> = corners
        .iter()
        .map(|corner| (round9(corner[0]), round9(corner[1])))
        .collect();
    xy.sort_by(|a, b| a.partial_cmp(b).expect("finite corners"));
    xy.dedup();
    assert_eq!(xy, vec![(8.0, -1.0), (8.0, 1.0), (12.0, -1.0), (12.0, 1.0)]);
}

fn round9(value: f64) -> f64 {
    (value * 1e9).round() / 1e9 + 0.0
}

#[test]
fn bodies_side_by_side_need_only_the_margin() {
    let frame = identity_frame();
    let apart = clearance_height(&frame, &box_corners(0.0), &frame, &box_corners(5.0), 0)
        .expect("a clearance");
    assert_eq!(apart, CLEARANCE_MARGIN_MM);
    let touching = clearance_height(&frame, &box_corners(0.0), &frame, &box_corners(0.5), 0)
        .expect("a clearance");
    assert_eq!(touching, 6.0 + CLEARANCE_MARGIN_MM);
}
