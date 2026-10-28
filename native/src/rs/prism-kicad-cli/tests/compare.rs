//! `compare` (cli-spec.md §5.6, amendment C2r §3): the same bundle twice,
//! a source tree against its own bundle, the three precondition refusals, a
//! bad bundle and usage errors.

mod support;

use prism_bundle::zip::ZipWriter;
use prism_bundle::{BundleReader, Limits, Work};
use serde_json::Value;
use std::path::{Path, PathBuf};
use support::{run, s, scratch};

const SHEET: &str = "(kicad_sch (version 20260306) (generator \"eeschema\") (uuid \"6c5f0000-0000-4000-8000-000000000001\") (paper \"A4\") (lib_symbols))\n";

/// A minimal project as a parse-stage bundle.
fn parse_bundle(label: &str) -> PathBuf {
    let dir = scratch(label);
    std::fs::write(dir.join("p.kicad_pro"), "{}").unwrap();
    std::fs::write(dir.join("p.kicad_sch"), SHEET).unwrap();
    let archive = dir.join("a.prism");
    let built = run(&[
        "bundle",
        "build",
        s(&dir.join("p.kicad_pro")),
        "--stage",
        "parse",
        "-o",
        s(&archive),
        "--quiet",
    ]);
    assert_eq!(built.code, 0, "{}", built.document);
    archive
}

/// Rewrite `archive` with `edit` applied to its manifest JSON and members.
fn rewrite(archive: &Path, out: &Path, edit: impl FnOnce(&mut Value, &mut Vec<(String, Vec<u8>)>)) {
    let limits = Limits::defaults(Work::Verify);
    let reader = BundleReader::open(std::fs::read(archive).unwrap(), &limits).unwrap();
    let mut manifest = reader.manifest_read().value.clone();
    let mut members: Vec<(String, Vec<u8>)> = reader
        .manifest()
        .members
        .iter()
        .map(|member| {
            (
                member.path.0.clone(),
                reader.member(&member.path).unwrap().unwrap(),
            )
        })
        .collect();
    edit(&mut manifest, &mut members);
    let mut writer = ZipWriter::new(Vec::new(), &limits);
    let mut bytes = serde_json::to_vec(&manifest).unwrap();
    bytes.push(b'\n');
    writer.add("bundle.json", &bytes, &limits).unwrap();
    for (path, data) in &members {
        writer.add(path, data, &limits).unwrap();
    }
    std::fs::write(out, writer.finish(&limits).unwrap().0).unwrap();
}

fn compare(base: &Path, head: &Path, out: &Path) -> support::Run {
    compare_as(base, head, out, ZERO_KEY)
}

/// `compare` with `base_key` as the base side's revision key.
fn compare_as(base: &Path, head: &Path, out: &Path, base_key: &str) -> support::Run {
    run(&[
        "compare",
        "--base",
        s(base),
        "--base-revision-key",
        base_key,
        "--head",
        s(head),
        "--head-revision-key",
        ZERO_KEY,
        "-o",
        s(out),
        "--quiet",
    ])
}

fn compare_code_field(base: &Path, head: &Path, out: &Path) -> String {
    let failed = compare(base, head, out);
    assert_eq!(failed.code, 7, "{}", failed.document);
    failed.code_field().to_owned()
}

const ZERO_KEY: &str = "0000000000000000000000000000000000000000000000000000000000000000";

#[test]
fn the_same_bundle_twice_has_no_changes() {
    let archive = parse_bundle("compare-self");
    let out = archive.with_file_name("result.json");
    let finished = compare(&archive, &archive, &out);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let result: Value = serde_json::from_slice(&std::fs::read(&out).unwrap()).unwrap();
    assert_eq!(result["schema"], "prism.design_compare.result.a1");
    assert!(
        result["schematic"]["changes"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert!(result["pcb"]["changes"].as_array().unwrap().is_empty());
    for tab in ["schematic", "pcb", "bom"] {
        assert_eq!(
            result["counts"][tab],
            serde_json::json!({"added": 0, "removed": 0, "changed": 0})
        );
    }
    assert_eq!(
        result["files"]["base"],
        serde_json::json!([
            {"path": "p.kicad_pro", "filename": "p.kicad_pro"},
            {"path": "p.kicad_sch", "filename": "p.kicad_sch"},
        ])
    );
    prism_bundle::schema::validate("prism.design_compare.result.a1", &result).unwrap();
    let document = &finished.document;
    assert_eq!(document["schema"], "prism.cli.compare_result.a1");
    assert_eq!(document["counts"], result["counts"]);
    assert_eq!(document["base"]["revision_key"], ZERO_KEY);
}

#[test]
fn a_bundle_side_is_the_revision_it_is_asked_for() {
    // Through an alias one bundle serves several revision keys, so the
    // identity is the argument, not the archive's `revision_key` (ADR
    // amendment K2 §3.6).
    let archive = parse_bundle("compare-identity");
    let out = archive.with_file_name("result.json");
    let asked = "ab".repeat(32);
    let finished = compare_as(&archive, &archive, &out, &asked);
    assert_eq!(finished.code, 0, "{}", finished.document);
    assert_eq!(finished.document["base"]["revision_key"], asked.as_str());
    assert_eq!(finished.document["head"]["revision_key"], ZERO_KEY);
    let result: Value = serde_json::from_slice(&std::fs::read(&out).unwrap()).unwrap();
    assert!(result.to_string().contains(&asked));
}

#[test]
fn a_source_tree_compares_as_its_bundle_does() {
    let archive = parse_bundle("compare-source");
    let dir = archive.parent().unwrap();
    let from_bundles = dir.join("bundles.json");
    let from_sources = dir.join("sources.json");
    assert_eq!(compare(&archive, &archive, &from_bundles).code, 0);
    let project = dir.join("p.kicad_pro");
    let finished = run(&[
        "compare",
        "--base-src",
        s(&project),
        "--base-revision-key",
        ZERO_KEY,
        "--head",
        s(&archive),
        "--head-revision-key",
        ZERO_KEY,
        "-o",
        s(&from_sources),
        "--quiet",
    ]);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let mut bundles: Value =
        serde_json::from_slice(&std::fs::read(&from_bundles).unwrap()).unwrap();
    let sources: Value = serde_json::from_slice(&std::fs::read(&from_sources).unwrap()).unwrap();
    // Only the identity differs: a source tree has no bundle key.
    assert!(sources["base"].get("bundleKey").is_none());
    bundles["base"].as_object_mut().unwrap().remove("bundleKey");
    assert_eq!(bundles, sources);
}

#[test]
fn preconditions_exit_seven() {
    let archive = parse_bundle("compare-preconditions");
    let out = archive.with_file_name("delta.json");

    let foreign = archive.with_file_name("foreign.prism");
    rewrite(&archive, &foreign, |manifest, _| {
        manifest["generator"]["crate_version"] = "9.9.9".into();
    });
    assert_eq!(
        compare_code_field(&foreign, &archive, &out),
        "generator-mismatch"
    );

    let moved = archive.with_file_name("moved.prism");
    rewrite(&archive, &moved, |manifest, _| {
        manifest["config"]["project_file"] = "sub/p.kicad_pro".into();
    });
    assert_eq!(
        compare_code_field(&archive, &moved, &out),
        "anchor-mismatch"
    );

    let memberless = archive.with_file_name("memberless.prism");
    rewrite(&archive, &memberless, |manifest, members| {
        if let Some(list) = manifest["members"].as_array_mut() {
            list.retain(|member| member["path"] != "projections/board-objects.json");
        }
        members.retain(|(path, _)| path != "projections/board-objects.json");
    });
    let missing = compare(&archive, &memberless, &out);
    assert_eq!(
        (missing.code, missing.code_field()),
        (7, "member-not-found")
    );
    assert_eq!(missing.document["argument"], "head");
    assert!(!out.exists(), "-o is untouched on every failure");
}

#[test]
fn a_bad_bundle_exits_three() {
    let archive = parse_bundle("compare-bad");
    let garbage = archive.with_file_name("garbage.prism");
    std::fs::write(&garbage, b"PK\x05\x06 not a bundle").unwrap();
    let out = archive.with_file_name("delta.json");
    let failed = compare(&garbage, &archive, &out);
    assert_eq!((failed.code, failed.code_field()), (3, "bundle-invalid"));
    assert_eq!(failed.document["argument"], "base");
    assert!(!out.exists());
}

#[test]
fn usage_errors_exit_two() {
    for args in [
        vec!["compare"],
        vec!["compare", "--base", "a.prism"],
        vec!["compare", "--base", "a.prism", "--head", "b.prism"],
        vec!["compare", "--base", "a.prism", "--head", "b.prism", "-o"],
        // Both modes need each side's revision key (ADR amendment K2 §3.6).
        vec![
            "compare", "--base", "a.prism", "--head", "b.prism", "-o", "r.json",
        ],
        // A side is a bundle or a source tree, never both.
        vec![
            "compare",
            "--base",
            "a.prism",
            "--base-src",
            "p.kicad_pro",
            "--head",
            "b.prism",
            "-o",
            "r.json",
        ],
        // A source tree needs its revision key, a hex one.
        vec![
            "compare",
            "--base-src",
            "p.kicad_pro",
            "--head",
            "b.prism",
            "-o",
            "r.json",
        ],
        vec![
            "compare",
            "--base-src",
            "p.kicad_pro",
            "--base-revision-key",
            "xyz",
            "--head",
            "b.prism",
            "-o",
            "r.json",
        ],
        // Source-tree inputs only with a source tree.
        vec![
            "compare",
            "--base",
            "a.prism",
            "--base-source-root",
            "d",
            "--head",
            "b.prism",
            "-o",
            "r.json",
        ],
        vec![
            "compare",
            "--base",
            "a.prism",
            "--base-upgraded",
            "p.kicad_sch=20230121",
            "--head",
            "b.prism",
            "-o",
            "r.json",
        ],
    ] {
        let failed = run(&args);
        assert_eq!(failed.code, 2, "{args:?}");
        assert_eq!(failed.document["category"], "usage");
    }
}
