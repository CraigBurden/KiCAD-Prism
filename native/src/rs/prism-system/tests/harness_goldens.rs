//! SB2-40/SB2-41/SB2-42/SB2-43/SB2-45/SB2-46: the shared harness geometry
//! goldens, replayed against the Rust port.
//!
//! `placement_cases.json` is shared with the Python twins
//! (`backend/tests/test_system_harness_*.py`) and the TypeScript twins
//! (`frontend/src/features/system-builder/placement/harness-*.test.ts`). The
//! extra checks port the TS suites' non-golden tests (the frozen spec and the
//! module-end route) plus the Python suite's alignment rule.

use prism_system::placement::frames::{MatingAxis, StoredFrame};
use prism_system::placement::harness_checks::{Board, collisions, lengths, span_box_distance};
use prism_system::placement::harness_curves::{
    Curve, CurveEnd, SegmentCurve, curve, harness_curves,
};
use prism_system::placement::harness_ends::{EndPose, Housing, alignment_pose, board_end};
use prism_system::placement::harness_nodes::{
    HarnessNodeInput, SegmentWaypoints, breakouts, segment_waypoints,
};
use prism_system::placement::harness_route::{
    SceneConnector, SceneHarness, SceneHarnessEnd, SceneWire, route,
};
use prism_system::placement::harness_spec::{
    BEND_RELAX_ITERATIONS, BOARD_COLLISION_MARGIN_MM, BOOT_MM, BREAKOUT_BLEND_MM, BREAKOUT_LIFT_MM,
    CATMULL_ROM_ALPHA, CHORD_ERROR_MM, DEFAULT_GAUGE_AWG, HOUSING_DEPTH_MM, LENGTH_ALLOWANCE,
    LENGTH_MISMATCH_TOLERANCE, MIN_BEND_RADIUS_FACTOR, PACKING_FACTOR, RING_SEGMENTS, WIRE_OD_MM,
    wire_od_mm,
};
use prism_system::placement::harness_topology::{
    Topology, TopologyBreakout, TopologyEnd, TopologyWire, topology,
};
use prism_system::placement::poses::{Pose, canonical_rotation, matrix, rotate};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

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

fn to_value<T: serde::Serialize>(value: &T) -> Value {
    serde_json::to_value(value).unwrap_or_else(|error| panic!("serialise: {error}"))
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

fn points(value: &Value) -> Vec<[f64; 3]> {
    value
        .as_array()
        .unwrap_or_else(|| panic!("expected points, got {value}"))
        .iter()
        .map(f64_3)
        .collect()
}

fn bools(value: &Value) -> Vec<bool> {
    value
        .as_array()
        .unwrap_or_else(|| panic!("expected flags, got {value}"))
        .iter()
        .map(|entry| entry.as_bool().unwrap_or_else(|| panic!("flag: {entry}")))
        .collect()
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

// ---------------------------------------------------------------------------
// spec

#[test]
fn harness_spec_equals_the_frozen_file() {
    let golden = read_json("backend/tests/fixtures/system_builder/harness_spec.json");
    let pairs = [
        ("bootMm", BOOT_MM),
        ("housingDepthMm", HOUSING_DEPTH_MM),
        ("breakoutLiftMm", BREAKOUT_LIFT_MM),
        ("chordErrorMm", CHORD_ERROR_MM),
        ("catmullRomAlpha", CATMULL_ROM_ALPHA),
        ("minBendRadiusFactor", MIN_BEND_RADIUS_FACTOR),
        ("bendRelaxIterations", BEND_RELAX_ITERATIONS as f64),
        ("packingFactor", PACKING_FACTOR),
        ("ringSegments", f64::from(RING_SEGMENTS)),
        ("breakoutBlendMm", BREAKOUT_BLEND_MM),
        ("lengthAllowance", LENGTH_ALLOWANCE),
        ("lengthMismatchTolerance", LENGTH_MISMATCH_TOLERANCE),
        ("boardCollisionMarginMm", BOARD_COLLISION_MARGIN_MM),
    ];
    for (key, value) in pairs {
        assert_eq!(golden[key].as_f64(), Some(value), "{key}");
    }
    assert_eq!(golden["defaultGaugeAwg"], json!(DEFAULT_GAUGE_AWG));
    let table = golden["wireSpec"]["outsideDiameterMm"].as_object().unwrap();
    assert_eq!(table.len(), WIRE_OD_MM.len());
    for (gauge, od) in WIRE_OD_MM {
        assert_eq!(table[*gauge].as_f64(), Some(*od), "{gauge}");
    }
}

#[test]
fn the_wire_table_is_the_nasa_one_in_mm() {
    let inches = [("24", 0.045), ("20", 0.060), ("16", 0.079), ("00", 0.546)];
    for (gauge, value) in inches {
        let od = WIRE_OD_MM
            .iter()
            .find(|(name, _)| *name == gauge)
            .map(|(_, od)| *od)
            .unwrap();
        assert!((od - value * 25.4).abs() <= 1e-9, "{gauge}");
    }
    let ods: Vec<f64> = WIRE_OD_MM.iter().map(|(_, od)| *od).collect();
    let mut sorted = ods.clone();
    sorted.sort_by(f64::total_cmp);
    assert_eq!(ods, sorted, "thicker gauge, bigger wire");
}

#[test]
fn an_unknown_or_missing_gauge_is_assumed_24() {
    assert_eq!(wire_od_mm(Some(&json!("22"))), (1.3208, false));
    assert_eq!(wire_od_mm(Some(&json!(20))), (1.524, false));
    assert_eq!(wire_od_mm(Some(&json!("22 AWG"))), (1.3208, false));
    for gauge in [json!(null), json!(""), json!("26"), json!("28")] {
        assert_eq!(wire_od_mm(Some(&gauge)), (1.143, true), "{gauge}");
    }
    assert_eq!(wire_od_mm(None), (1.143, true));
}

// ---------------------------------------------------------------------------
// ends

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EndInput {
    board_world: Pose,
    geometry: Option<prism_system::placement::frames::ConnectorGeometry>,
    thickness_mm: Option<f64>,
    stored: Option<StoredFrame>,
    #[serde(default)]
    quarter_turns: i32,
    housing: Option<Housing>,
    body_mm: Option<prism_system::placement::poses::Bounds>,
}

#[derive(Deserialize)]
struct EndCase {
    name: String,
    input: EndInput,
    expected: Option<EndPose>,
}

#[test]
fn harness_ends_replay_every_golden_case() {
    let root = placement_cases();
    let (mm, unit) = tolerance(&root);
    let cases: Vec<EndCase> = from_value(&root["harnessEnds"]);
    assert!(cases.len() >= 8, "the goldens cover 8 end cases");
    for case in &cases {
        let input = &case.input;
        let got = board_end(
            &input.board_world,
            input.geometry.as_ref(),
            input.thickness_mm,
            input.stored.as_ref(),
            input.quarter_turns,
            input.housing.as_ref(),
            input.body_mm.as_ref(),
        );
        let Some(expected) = case.expected.as_ref() else {
            assert!(got.is_none(), "{}: expected no end", case.name);
            continue;
        };
        let got = got.unwrap_or_else(|| panic!("{}: expected an end", case.name));
        assert_close(&got.exit_mm, &expected.exit_mm, mm, &case.name);
        assert_close(&got.leg_mm, &expected.leg_mm, mm, &case.name);
        assert_close(&got.outward, &expected.outward, unit, &case.name);
        assert_close(
            &got.pose.rotation,
            &expected.pose.rotation,
            unit,
            &case.name,
        );
        assert_close(
            &got.pose.translation_mm,
            &expected.pose.translation_mm,
            mm,
            &case.name,
        );
        assert_eq!(got.modeled, expected.modeled, "{}", case.name);
        assert!(
            (got.depth_mm - expected.depth_mm).abs() <= mm,
            "{}",
            case.name
        );
        match (got.mating_plane_mm, expected.mating_plane_mm) {
            (Some(got), Some(expected)) => assert!((got - expected).abs() <= mm),
            (None, None) => {}
            other => panic!("{}: mating plane {other:?}", case.name),
        }
    }
}

#[test]
fn alignment_rotates_z_then_y_then_x() {
    let alignment = prism_system::placement::harness_ends::Alignment {
        offset_mm: Some([1.0, 2.0, 3.0]),
        rotation_deg: Some([90.0, 0.0, 90.0]),
        scale: Some(2.0),
    };
    let (pose, scale) = alignment_pose(Some(&alignment));
    assert_close(
        &rotate(pose.rotation, [1.0, 0.0, 0.0]),
        &[0.0, 1.0, 0.0],
        1e-9,
        "x",
    );
    assert_close(
        &rotate(pose.rotation, [0.0, 1.0, 0.0]),
        &[0.0, 0.0, 1.0],
        1e-9,
        "y",
    );
    assert_eq!(pose.translation_mm, [1.0, 2.0, 3.0]);
    assert_eq!(scale, 2.0);
}

// ---------------------------------------------------------------------------
// topology

#[derive(Deserialize)]
struct TopologyInput {
    ends: Vec<TopologyEnd>,
    wires: Vec<TopologyWire>,
    #[serde(default)]
    breakouts: Vec<TopologyBreakout>,
}

#[derive(Deserialize)]
struct TopologyCase {
    name: String,
    input: TopologyInput,
    expected: Topology,
}

#[test]
fn harness_topologies_replay_every_golden_case() {
    let root = placement_cases();
    let (mm, _) = tolerance(&root);
    let cases: Vec<TopologyCase> = from_value(&root["harnessTopologies"]);
    assert!(cases.len() >= 6, "the goldens cover 6 topology cases");
    for case in &cases {
        let got = topology(&case.input.ends, &case.input.wires, &case.input.breakouts);
        let expected = &case.expected;
        assert_eq!(
            got.nodes
                .iter()
                .map(|n| (&n.id, n.kind))
                .collect::<Vec<_>>(),
            expected
                .nodes
                .iter()
                .map(|n| (&n.id, n.kind))
                .collect::<Vec<_>>(),
            "{}: nodes",
            case.name
        );
        for (a, e) in got.nodes.iter().zip(&expected.nodes) {
            assert_close(&a.position_mm, &e.position_mm, mm, &case.name);
        }
        assert_eq!(
            got.segments
                .iter()
                .map(|s| (&s.id, &s.wires, s.assumed_gauge))
                .collect::<Vec<_>>(),
            expected
                .segments
                .iter()
                .map(|s| (&s.id, &s.wires, s.assumed_gauge))
                .collect::<Vec<_>>(),
            "{}: segments",
            case.name
        );
        for (a, e) in got.segments.iter().zip(&expected.segments) {
            assert!((a.diameter_mm - e.diameter_mm).abs() <= mm, "{}", case.name);
        }
        assert_eq!(got.unplaced, expected.unplaced, "{}", case.name);
    }
}

// ---------------------------------------------------------------------------
// curves

#[derive(Deserialize)]
struct CurveCase {
    name: String,
    op: String,
    input: Value,
    expected: Value,
}

#[test]
fn harness_curves_replay_every_golden_case() {
    let root = placement_cases();
    let (mm, _) = tolerance(&root);
    let cases: Vec<CurveCase> = from_value(&root["harnessCurves"]);
    assert!(cases.len() >= 6, "the goldens cover 6 curve cases");
    for case in &cases {
        let got: Vec<SegmentCurve> = if case.op == "curve" {
            vec![SegmentCurve {
                segment_id: String::new(),
                curve: curve(
                    &points(&case.input["points"]),
                    &bools(&case.input["movable"]),
                    case.input["diameterMm"].as_f64().unwrap(),
                ),
            }]
        } else {
            harness_curves(
                &from_value(&case.input["ends"]),
                &from_value(&case.input["tree"]),
                &case
                    .input
                    .get("waypoints")
                    .map(from_value)
                    .unwrap_or_default(),
                &BTreeMap::new(),
            )
        };
        let expected: Vec<Value> = match &case.expected {
            Value::Array(values) => values.clone(),
            value => vec![value.clone()],
        };
        assert_eq!(got.len(), expected.len(), "{}", case.name);
        for (result, want) in got.iter().zip(&expected) {
            let curve: &Curve = &result.curve;
            let expected_samples: Vec<[f64; 3]> = want["samplesMm"]
                .as_array()
                .unwrap()
                .iter()
                .map(f64_3)
                .collect();
            assert_eq!(curve.samples_mm.len(), expected_samples.len());
            for (a, e) in curve.samples_mm.iter().zip(&expected_samples) {
                assert_close(a, e, mm, &case.name);
            }
            assert!(
                (curve.length_mm - want["lengthMm"].as_f64().unwrap()).abs() <= 0.01,
                "{}: length",
                case.name
            );
            assert_eq!(
                curve.tight_bend.is_none(),
                want["tightBend"].is_null(),
                "{}: tightBend",
                case.name
            );
            if case.op == "curve" {
                assert_value_close(&to_value(curve), &case.expected, mm, &case.name);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// nodes

#[derive(Deserialize)]
struct NodeInput {
    ends: Vec<TopologyEnd>,
    wires: Vec<TopologyWire>,
    nodes: Vec<HarnessNodeInput>,
    posed: BTreeMap<String, CurveEnd>,
}

#[derive(Deserialize)]
struct NodeExpected {
    breakouts: Vec<TopologyBreakout>,
    tree: Topology,
    split: SegmentWaypoints,
    curves: Vec<SegmentCurve>,
}

#[derive(Deserialize)]
struct NodeCase {
    name: String,
    input: NodeInput,
    expected: NodeExpected,
}

#[test]
fn harness_nodes_replay_every_golden_case() {
    let root = placement_cases();
    let (mm, _) = tolerance(&root);
    let cases: Vec<NodeCase> = from_value(&root["harnessNodes"]);
    assert!(cases.len() >= 4, "the goldens cover 4 node cases");
    for case in &cases {
        let input = &case.input;
        let tree = topology(&input.ends, &input.wires, &breakouts(&input.nodes));
        let split = segment_waypoints(&tree, &input.nodes);
        assert_value_close(
            &to_value(&breakouts(&input.nodes)),
            &to_value(&case.expected.breakouts),
            0.0,
            &case.name,
        );
        assert_eq!(
            tree.segments.iter().map(|s| &s.id).collect::<Vec<_>>(),
            case.expected
                .tree
                .segments
                .iter()
                .map(|s| &s.id)
                .collect::<Vec<_>>(),
            "{}: segments",
            case.name
        );
        assert_value_close(
            &to_value(&split),
            &to_value(&case.expected.split),
            0.0,
            &case.name,
        );
        let curves = harness_curves(&input.posed, &tree, &split.waypoints, &split.pinned);
        assert_eq!(curves.len(), case.expected.curves.len(), "{}", case.name);
        for (got, want) in curves.iter().zip(&case.expected.curves) {
            assert_eq!(got.segment_id, want.segment_id, "{}", case.name);
            assert!(
                (got.curve.length_mm - want.curve.length_mm).abs() <= 0.01,
                "{}: length",
                case.name
            );
            assert_eq!(
                got.curve.tight_bend.is_none(),
                want.curve.tight_bend.is_none(),
                "{}: tightBend",
                case.name
            );
            for (a, e) in got.curve.control_mm.iter().zip(&want.curve.control_mm) {
                assert_close(a, e, mm, &case.name);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// checks

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CheckInput {
    harness: SceneHarness,
    worlds: BTreeMap<String, [f64; 16]>,
    boards: Vec<Board>,
    allowance_pct: Option<f64>,
}

#[derive(Deserialize)]
struct CheckCase {
    name: String,
    op: String,
    input: Value,
    expected: Value,
}

#[test]
fn harness_checks_replay_every_golden_case() {
    let root = placement_cases();
    let (mm, _) = tolerance(&root);
    let cases: Vec<CheckCase> = from_value(&root["harnessChecks"]);
    assert!(cases.len() >= 6, "the goldens cover 6 check cases");
    for case in &cases {
        if case.op == "span" {
            let got = span_box_distance(
                f64_3(&case.input["a"]),
                f64_3(&case.input["b"]),
                f64_3(&case.input["lo"]),
                f64_3(&case.input["hi"]),
            );
            // The search runs the same float steps as the Python half: equal to the bit.
            assert_eq!(vec![got.0, got.1], f64s(&case.expected), "{}", case.name);
            continue;
        }
        let input: CheckInput = from_value(&case.input);
        let routed = route(&input.harness, |path| input.worlds.get(path).copied())
            .unwrap_or_else(|| panic!("{}: no route", case.name));
        let expected = &case.expected;
        assert_eq!(
            routed
                .curves
                .iter()
                .map(|c| &c.segment_id)
                .collect::<Vec<_>>(),
            expected["segments"]
                .as_array()
                .unwrap()
                .iter()
                .map(|s| s.as_str().unwrap())
                .collect::<Vec<_>>(),
            "{}: segments",
            case.name
        );
        for (curve, want) in routed
            .curves
            .iter()
            .zip(expected["lengthsMm"].as_array().unwrap())
        {
            assert!(
                (curve.curve.length_mm - want.as_f64().unwrap()).abs() <= 0.01,
                "{}: curve length",
                case.name
            );
        }
        let hits = collisions(&routed, &input.boards);
        assert_value_close(
            &to_value(&hits),
            &expected["collisions"],
            mm,
            &format!("{}: collisions", case.name),
        );
        let measured = lengths(&routed, input.allowance_pct);
        assert_value_close(
            &to_value(&measured),
            &expected["lengths"],
            0.01,
            &format!("{}: lengths", case.name),
        );
    }
}

// ---------------------------------------------------------------------------
// module ends (the TS suite's non-golden route test)

fn scene_connector(
    geometry: &prism_system::placement::frames::ConnectorGeometry,
    thickness_mm: f64,
    in_occurrence: Option<Pose>,
) -> SceneConnector {
    SceneConnector {
        geometry: Some(geometry.clone()),
        thickness_mm: Some(thickness_mm),
        stored: Some(StoredFrame {
            axis: MatingAxis::Top,
            quarter_turns: Some(0),
        }),
        in_occurrence,
    }
}

fn module_harness(
    geometry: &prism_system::placement::frames::ConnectorGeometry,
    in_occurrence: Option<Pose>,
) -> SceneHarness {
    SceneHarness {
        id: "h".to_owned(),
        level: None,
        ends: vec![
            SceneHarnessEnd {
                id: "e1".to_owned(),
                ordinal: 0,
                occurrence: Some("/m".to_owned()),
                connector: Some(scene_connector(geometry, 0.0, in_occurrence)),
                housing: None,
            },
            SceneHarnessEnd {
                id: "e2".to_owned(),
                ordinal: 1,
                occurrence: Some("/b".to_owned()),
                connector: Some(scene_connector(geometry, 1.6, None)),
                housing: None,
            },
        ],
        wires: vec![SceneWire {
            id: "w".to_owned(),
            from: "e1".to_owned(),
            to: "e2".to_owned(),
            gauge_awg: Some(json!(24)),
        }],
        nodes: Some(Vec::new()),
    }
}

#[test]
fn module_ends_route_like_a_board_end_posed_on_the_module() {
    let root = placement_cases();
    let geometry: prism_system::placement::frames::ConnectorGeometry =
        from_value(&root["modulePorts"][0]["input"]["geometry"]);
    let at = Pose {
        translation_mm: [5.0, -3.0, 12.0],
        rotation: canonical_rotation([0.0, 0.3826834, 0.0, 0.9238795]),
    };
    let identity = Pose {
        translation_mm: [0.0, 0.0, 0.0],
        rotation: [0.0, 0.0, 0.0, 1.0],
    };
    let board = matrix(&Pose {
        translation_mm: [80.0, 0.0, 0.0],
        rotation: [0.0, 0.0, 0.0, 1.0],
    });
    let as_module = route(&module_harness(&geometry, Some(at)), |path| match path {
        "/m" => Some(matrix(&identity)),
        "/b" => Some(board),
        _ => None,
    })
    .expect("the module route");
    let as_board = route(&module_harness(&geometry, None), |path| match path {
        "/m" => Some(matrix(&at)),
        "/b" => Some(board),
        _ => None,
    })
    .expect("the board route");
    assert_close(
        &as_module.ends["e1"].pose.leg_mm,
        &as_board.ends["e1"].pose.leg_mm,
        1e-6,
        "legMm",
    );
}

#[test]
fn checks_named_rules() {
    let root = placement_cases();
    let cases: Vec<CheckCase> = from_value(&root["harnessChecks"]);
    let by = |name: &str| {
        cases
            .iter()
            .find(|case| case.name.starts_with(name))
            .unwrap_or_else(|| panic!("no check case {name}"))
    };
    assert_eq!(
        span_box_distance(
            f64_3(&by("a span through the box").input["a"]),
            f64_3(&by("a span through the box").input["b"]),
            f64_3(&by("a span through the box").input["lo"]),
            f64_3(&by("a span through the box").input["hi"]),
        )
        .0,
        0.0
    );
    let hits = &by("WH-style").expected["collisions"];
    let pairs: Vec<(&str, &str)> = hits
        .as_array()
        .unwrap()
        .iter()
        .map(|hit| {
            (
                hit["segmentId"].as_str().unwrap(),
                hit["board"].as_str().unwrap(),
            )
        })
        .collect();
    assert_eq!(pairs, [("e2~auto", "/wall"), ("e3~auto", "/wall")]);
}
