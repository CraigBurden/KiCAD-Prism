//! `system step` (`docs/system-builder/CONTRACTS.md` §18): the AP242 assembly
//! over the mezzanine fixture boards, with hand-written STEP models, a placed
//! board lift and a routed harness's tessellated tubes.

mod support;
#[path = "support/system_common.rs"]
mod system_common;

use prism_step::p21::{File, Param, parse};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use system_common::{
    end, endpoint, fixture_bundle, harness, key, link, mezzanine, mezzanine_mate, write_document,
};

/// Run the binary for `system step` and read its plain JSON result (the step
/// result is not one of the CLI contract documents).
fn step_run(args: &[String]) -> (i32, Value, String) {
    let output = std::process::Command::new(support::binary())
        .args(args)
        .current_dir(support::repo())
        .stdin(std::process::Stdio::null())
        .output()
        .expect("the binary runs");
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let document: Value = if stdout.trim().is_empty() {
        Value::Null
    } else {
        serde_json::from_str(stdout.trim()).expect("stdout is one JSON document")
    };
    (
        output.status.code().unwrap_or(-1),
        document,
        String::from_utf8_lossy(&output.stderr).into_owned(),
    )
}

fn models(dir: &Path, boards: bool) -> PathBuf {
    if boards {
        std::fs::copy(
            Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/step/box.step"),
            dir.join("box.step"),
        )
        .expect("the fixture copies");
    }
    let manifest = if boards {
        json!({
            "boards": {
                "occ_base": {"step": "box.step", "thicknessNm": 1_600_000},
                "occ_top": {"step": "box.step", "thicknessNm": 1_600_000},
            }
        })
    } else {
        json!({"boards": {}, "parts": {}})
    };
    let path = dir.join("models.json");
    std::fs::write(&path, serde_json::to_vec(&manifest).unwrap()).unwrap();
    path
}

fn document() -> Value {
    let mut doc = mezzanine(mezzanine_mate(0, None));
    doc["name"] = json!("Mezzanine");
    doc["harnesses"] = json!([harness(
        "har_1",
        vec![
            end("end_base", "occ_base", "J1"),
            end("end_top", "occ_top", "J1"),
        ],
        vec![link(
            "link_1",
            endpoint("occ_base", "J1"),
            endpoint("occ_top", "J1"),
        )],
    )]);
    doc
}

fn products(file: &File) -> Vec<String> {
    let mut names: Vec<String> = file
        .entities
        .values()
        .filter(|entity| entity.name() == "PRODUCT")
        .filter_map(|entity| entity.params().get(1).and_then(Param::as_str))
        .map(str::to_owned)
        .collect();
    names.sort();
    names
}

fn occurrences(file: &File) -> usize {
    file.entities
        .values()
        .filter(|entity| entity.name() == "NEXT_ASSEMBLY_USAGE_OCCURRENCE")
        .count()
}

/// The target translation of the occurrence named `name`.
fn usage_target(file: &File, name: &str) -> Option<[f64; 3]> {
    let (usage, _) = file.entities.iter().find(|(_, entity)| {
        entity.name() == "NEXT_ASSEMBLY_USAGE_OCCURRENCE"
            && entity.params().get(1).and_then(Param::as_str) == Some(name)
    })?;
    let (shape, _) = file.entities.iter().find(|(_, entity)| {
        entity.name() == "PRODUCT_DEFINITION_SHAPE"
            && entity.params().get(2).and_then(Param::as_ref_id) == Some(*usage)
    })?;
    let relationship = file
        .entities
        .values()
        .find(|entity| {
            entity.name() == "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION"
                && entity.params().get(1).and_then(Param::as_ref_id) == Some(*shape)
        })?
        .params()
        .first()?
        .as_ref_id()?;
    let transform = file
        .get(relationship)?
        .record("REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION")?
        .first()?
        .as_ref_id()?;
    let placement = file.get(transform)?.params().get(3)?.as_ref_id()?;
    let point = file.get(placement)?.params().get(1)?.as_ref_id()?;
    let coordinates = file.get(point)?.params().get(1)?.as_list()?;
    Some([
        coordinates.first()?.as_f64()?,
        coordinates.get(1)?.as_f64()?,
        coordinates.get(2)?.as_f64()?,
    ])
}

fn dense(file: &File) {
    let last = file.entities.len() as u64;
    assert_eq!(
        file.entities.keys().copied().collect::<Vec<_>>(),
        (1..=last).collect::<Vec<_>>()
    );
}

fn argv(
    document: &Path,
    members: &[(String, String, String)],
    models: &Path,
    out: &Path,
) -> Vec<String> {
    let mut args: Vec<String> = vec!["system".to_owned(), "step".to_owned()];
    args.push("--document".to_owned());
    args.push(support::s(document).to_owned());
    for (occurrence, bundle, key) in members {
        args.push("--member".to_owned());
        args.push(format!("{occurrence}={bundle}"));
        args.push("--member-revision-key".to_owned());
        args.push(format!("{occurrence}={key}"));
    }
    args.extend([
        "--models".to_owned(),
        support::s(models).to_owned(),
        "-o".to_owned(),
        support::s(out).to_owned(),
        "--quiet".to_owned(),
    ]);
    args
}

#[test]
fn the_system_step_places_the_boards_and_tessellates_the_harness() {
    let base = fixture_bundle("p2/sources/mezz_base/F0/mezz_base.kicad_pro", 0x11);
    let top = fixture_bundle("p2/sources/mezz_top/F0/mezz_top.kicad_pro", 0x22);
    let (k11, k22) = (key(0x11), key(0x22));
    let dir = support::scratch("system-step");
    let manifest = models(&dir, true);
    let document = write_document("system-step", &document());
    let out = dir.join("system.step");
    let members = vec![
        ("occ_base".to_owned(), support::s(&base).to_owned(), k11),
        ("occ_top".to_owned(), support::s(&top).to_owned(), k22),
    ];
    let argv = argv(&document, &members, &manifest, &out);
    let (code, result, stderr) = step_run(&argv);
    assert_eq!(code, 0, "{stderr}\n{result}");
    let text = std::fs::read_to_string(&out).expect("the STEP file is written");
    assert_eq!(result["bytes"], text.len());
    assert_eq!(result["missing"], json!([]));
    assert!(
        result["products"].as_u64().unwrap_or(0) >= 4,
        "the root, both boards and the harness: {result}"
    );

    let file = parse(&text).expect("the STEP output parses");
    dense(&file);
    let names = products(&file);
    for expected in ["Mezzanine", "Base", "Top", "Harness har_1"] {
        assert!(
            names.iter().any(|name| name == expected),
            "{expected} is a product: {names:?}"
        );
    }
    assert_eq!(occurrences(&file), 3, "each product under the root");
    let base = usage_target(&file, "Base").expect("Base's placement");
    assert!(
        (base[2] + 0.8).abs() < 1e-6,
        "the board model is lifted by half its thickness: {base:?}"
    );
    let top = usage_target(&file, "Top").expect("Top's placement");
    assert!(top[2].is_finite());

    // Every routed segment is a tube, a faceted B-rep solid any reader loads.
    let count = |name: &str| {
        file.entities
            .values()
            .filter(|entity| entity.name() == name)
            .count()
    };
    assert!(
        count("MANIFOLD_SOLID_BREP") >= 1,
        "a tube per routed segment"
    );
    assert!(count("ADVANCED_FACE") > 0);
    assert_eq!(count("TESSELLATED_SHELL"), 0);
    assert!(text.contains("AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF"));
    assert!(text.contains("'1970-01-01T00:00:00'"));
}

#[test]
fn absent_models_leave_empty_products_and_are_listed() {
    let base = fixture_bundle("p2/sources/mezz_base/F0/mezz_base.kicad_pro", 0x11);
    let top = fixture_bundle("p2/sources/mezz_top/F0/mezz_top.kicad_pro", 0x22);
    let (k11, k22) = (key(0x11), key(0x22));
    let dir = support::scratch("system-step-missing");
    let manifest = models(&dir, false);
    let document = write_document("system-step-missing", &document());
    let out = dir.join("system.step");
    let members = vec![
        ("occ_base".to_owned(), support::s(&base).to_owned(), k11),
        ("occ_top".to_owned(), support::s(&top).to_owned(), k22),
    ];
    let argv = argv(&document, &members, &manifest, &out);
    let (code, result, stderr) = step_run(&argv);
    assert_eq!(code, 0, "{stderr}\n{result}");
    assert_eq!(result["missing"], json!(["Base", "Top"]));
    let text = std::fs::read_to_string(&out).expect("the STEP file is written");
    let file = parse(&text).expect("the STEP output parses");
    let names = products(&file);
    assert!(names.iter().any(|name| name == "Base"));
    assert!(names.iter().any(|name| name == "Top"));
    assert_eq!(occurrences(&file), 3, "the empty products are still placed");
}

#[test]
fn system_step_requires_its_models() {
    let document = write_document("system-step-usage", &document());
    let (code, result, _) = step_run(&[
        "system".to_owned(),
        "step".to_owned(),
        "--document".to_owned(),
        support::s(&document).to_owned(),
        "-o".to_owned(),
        "/tmp/never.step".to_owned(),
        "--quiet".to_owned(),
    ]);
    assert_eq!(code, 2, "{result}");
    assert_eq!(result["code"], "usage");
    let (code, result, _) =
        step_run(&["system".to_owned(), "frob".to_owned(), "--quiet".to_owned()]);
    assert_eq!(code, 2);
    assert_eq!(result["code"], "unknown-command");
}
