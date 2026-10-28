//! `prism-kicad bundle reuse` (cli-spec.md §5.10, ADR amendment K2 §3.3) on
//! a repository with two projects: a bundle of one commit serves a later
//! commit exactly when nothing it read, probed or listed changed.

mod support;

use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;
use support::{run, s, scratch};

fn git(repo: &Path, args: &[&str]) {
    let output = Command::new("git")
        .args([
            "-c",
            "user.name=t",
            "-c",
            "user.email=t@example.com",
            "-c",
            "commit.gpgsign=false",
        ])
        .args(args)
        .current_dir(repo)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("HOME", repo)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "git {args:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

fn write(repo: &Path, path: &str, bytes: &[u8]) {
    let path = repo.join(path);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, bytes).unwrap();
}

/// Project `a` with a footprint library table naming a library directory,
/// and an unrelated project `b`.
fn repository(label: &str) -> PathBuf {
    let repo = scratch(label);
    git(&repo, &["init", "-q", "-b", "main"]);
    write(&repo, "a/p.kicad_pro", b"{}\n");
    write(
        &repo,
        "a/p.kicad_sch",
        b"(kicad_sch (version 20231120) (generator \"eeschema\") (uuid \"00000000-0000-0000-0000-000000000001\") (paper \"A4\"))\n",
    );
    write(
        &repo,
        "a/p.kicad_pcb",
        b"(kicad_pcb (version 20240108) (generator \"pcbnew\"))\n",
    );
    write(
        &repo,
        "a/fp-lib-table",
        b"(fp_lib_table (version 7)\n  (lib (name \"parts\")(type \"KiCad\")(uri \"${KIPRJMOD}/lib/parts.pretty\")(options \"\")(descr \"\"))\n)\n",
    );
    write(
        &repo,
        "a/lib/parts.pretty/R.kicad_mod",
        b"(footprint \"R\" (layer \"F.Cu\"))\n",
    );
    write(&repo, "b/q.kicad_pro", b"{}\n");
    std::fs::create_dir_all(repo.join(".git/info")).unwrap();
    std::fs::write(repo.join(".git/info/exclude"), "/out/\n").unwrap();
    commit(&repo);
    repo
}

fn commit(repo: &Path) {
    git(repo, &["add", "-A"]);
    git(repo, &["commit", "-q", "-m", "change"]);
}

/// The key record of project `a` at HEAD, written to `out/<name>`, and its
/// revision key.
fn key_record(repo: &Path, name: &str, extra: &[&str]) -> (PathBuf, String) {
    let mut args = vec![
        "revision-key",
        s(repo),
        "--commit",
        "HEAD",
        "--project",
        "a/p.kicad_pro",
    ];
    args.extend_from_slice(extra);
    let keyed = run(&args);
    assert_eq!(keyed.code, 0, "{}", keyed.document);
    let path = repo.join("out").join(name);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(&path, serde_json::to_vec(&keyed.document).unwrap()).unwrap();
    let key = keyed.document["revision_key"].as_str().unwrap().to_owned();
    (path, key)
}

/// Stage parse of project `a` at HEAD, built with its key record.
fn bundle(repo: &Path) -> PathBuf {
    let (record, key) = key_record(repo, "built.json", &[]);
    let out = repo.join("out/a.prism");
    let built = run(&[
        "bundle",
        "build",
        s(&repo.join("a/p.kicad_pro")),
        "--source-root",
        s(repo),
        "--stage",
        "parse",
        "-o",
        s(&out),
        "--revision-key",
        &key,
        "--key-record",
        s(&record),
        "--quiet",
    ]);
    assert_eq!(built.code, 0, "{}", built.document);
    out
}

fn reuse(archive: &Path, record: &Path) -> support::Run {
    run(&[
        "bundle",
        "reuse",
        "--in",
        s(archive),
        "--key-record",
        s(record),
        "--quiet",
    ])
}

/// `bundle reuse` of `archive` against HEAD's key record: (holds, the
/// failing condition, its path).
fn verdict(repo: &Path, archive: &Path) -> (bool, Option<String>, Option<String>) {
    let (record, key) = key_record(repo, "asked.json", &[]);
    let answered = reuse(archive, &record);
    assert_eq!(answered.code, 0, "{}", answered.document);
    let document = &answered.document;
    prism_bundle::schema::validate("prism.cli.reuse_result.a0", document).unwrap();
    assert_eq!(document["revision_key"], key.as_str());
    let field = |name: &str| document["failure"][name].as_str().map(str::to_owned);
    (
        document["holds"].as_bool().unwrap(),
        field("condition"),
        field("path"),
    )
}

/// A change: its label, the file it writes and the bytes, and the failing
/// condition and path it gives (`None`: the bundle still holds).
type Case = (
    &'static str,
    &'static str,
    &'static [u8],
    Option<(&'static str, &'static str)>,
);

/// Each change, committed on top of the bundle's commit, and the verdict it
/// gives (ADR amendment K2 §4, K2a acceptance).
#[test]
fn a_bundle_serves_exactly_the_commits_that_leave_its_read_set() {
    let repo = repository("reuse-cases");
    let archive = bundle(&repo);
    assert_eq!(verdict(&repo, &archive), (true, None, None));
    let built = git_head(&repo);
    let cases: [Case; 8] = [
        ("an unrelated project", "b/q.kicad_pro", b"{ }\n", None),
        ("a file nothing reads", "a/README.md", b"hi\n", None),
        (
            "a sheet",
            "a/p.kicad_sch",
            b"(kicad_sch (version 20231120) (generator \"eeschema\") (uuid \"00000000-0000-0000-0000-000000000001\") (paper \"A3\"))\n",
            Some(("read", "a/p.kicad_sch")),
        ),
        (
            "a library table",
            "a/fp-lib-table",
            b"(fp_lib_table (version 7))\n",
            Some(("read", "a/fp-lib-table")),
        ),
        (
            "the board",
            "a/p.kicad_pcb",
            b"(kicad_pcb (version 20240108) (generator \"pcbnew\") )\n",
            Some(("read", "a/p.kicad_pcb")),
        ),
        (
            "a new jobset anywhere",
            "ci/release.kicad_jobset",
            b"{}\n",
            Some(("listing", "ci/release.kicad_jobset")),
        ),
        (
            "a library table where a probe found none",
            "a/sym-lib-table",
            b"(sym_lib_table)\n",
            Some(("probe", "a/sym-lib-table")),
        ),
        (
            "a new file in a listed library directory",
            "a/lib/parts.pretty/C.kicad_mod",
            b"(footprint \"C\")\n",
            Some(("listing", "a/lib/parts.pretty/C.kicad_mod")),
        ),
    ];
    for (label, path, bytes, expected) in cases {
        write(&repo, path, bytes);
        commit(&repo);
        let expected = expected.map_or((true, None, None), |(condition, path)| {
            (false, Some(condition.to_owned()), Some(path.to_owned()))
        });
        assert_eq!(verdict(&repo, &archive), expected, "{label}");
        git(&repo, &["reset", "-q", "--hard", &built]);
    }
}

fn git_head(repo: &Path) -> String {
    let output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(repo)
        .output()
        .unwrap();
    String::from_utf8_lossy(&output.stdout).trim().to_owned()
}

#[test]
fn another_configuration_is_the_first_condition() {
    let repo = repository("reuse-config");
    let archive = bundle(&repo);
    let config = repo.join("out/effective.json");
    std::fs::write(
        &config,
        r#"{"schema":"prism.revision_key.effective_config.a1","project_file":"a/p.kicad_pro","excluded_dirs":["b"]}"#,
    )
    .unwrap();
    let (record, _) = key_record(&repo, "configured.json", &["--config", s(&config)]);
    let answered = reuse(&archive, &record);
    assert_eq!(answered.code, 0, "{}", answered.document);
    assert_eq!(answered.document["holds"], false);
    assert_eq!(answered.document["failure"]["condition"], "config");
    assert!(answered.document["failure"].get("path").is_none());
}

#[test]
fn reuse_reads_no_member_and_writes_nothing() {
    let repo = repository("reuse-stable");
    let archive = bundle(&repo);
    let (record, _) = key_record(&repo, "same.json", &[]);
    let before: Vec<_> = std::fs::read_dir(repo.join("out")).unwrap().collect();
    let first = reuse(&archive, &record);
    let second = reuse(&archive, &record);
    assert_eq!(first.stdout, second.stdout);
    let after: Vec<_> = std::fs::read_dir(repo.join("out")).unwrap().collect();
    assert_eq!(before.len(), after.len());
}

#[test]
fn bad_inputs_are_exit_three() {
    let repo = repository("reuse-bad");
    let archive = bundle(&repo);
    let (record, _) = key_record(&repo, "good.json", &[]);
    let not_a_bundle = repo.join("out/not.prism");
    std::fs::write(&not_a_bundle, b"not a zip").unwrap();
    let failed = reuse(&not_a_bundle, &record);
    assert_eq!(failed.code, 3, "{}", failed.document);
    let bad_record = repo.join("out/bad.json");
    std::fs::write(&bad_record, br#"{"schema":"prism.revision_key.record.a1"}"#).unwrap();
    let failed = reuse(&archive, &bad_record);
    assert_eq!(
        (failed.code, failed.code_field()),
        (3, "key-record-invalid")
    );
    let document: Value = failed.document.clone();
    assert_eq!(document["category"], "input");
}

/// A 3D model the key lists but the worker could not materialize (an LFS
/// object it does not have) is left out with a `model-unavailable` warning
/// (bundle-format.md §2.2). Stage parse's own read-set check (I14) accepts the
/// build; `bundle reuse` refuses to serve it (condition 3).
#[test]
fn an_unavailable_model_builds_with_a_warning_and_is_not_reused() {
    let repo = repository("reuse-unavailable-model");
    write(
        &repo,
        "a/p.kicad_pcb",
        b"(kicad_pcb (version 20240108) (generator \"pcbnew\")\n  (footprint \"parts:R\" (layer \"F.Cu\") (uuid \"00000000-0000-0000-0000-0000000000f1\") (at 0 0)\n    (model \"${KIPRJMOD}/models/R.step\")))\n",
    );
    write(
        &repo,
        "a/models/R.step",
        b"ISO-10303-21;\nEND-ISO-10303-21;\n",
    );
    commit(&repo);
    let (record, key) = key_record(&repo, "built.json", &[]);
    std::fs::remove_file(repo.join("a/models/R.step")).unwrap();
    let out = repo.join("out/a.prism");
    let built = run(&[
        "bundle",
        "build",
        s(&repo.join("a/p.kicad_pro")),
        "--source-root",
        s(&repo),
        "--stage",
        "parse",
        "-o",
        s(&out),
        "--revision-key",
        &key,
        "--key-record",
        s(&record),
        "--quiet",
    ]);
    assert_eq!(built.code, 0, "{}", built.document);
    assert_eq!(built.document["stages"][0]["status"], "complete");
    let codes: Vec<&str> = built.document["warnings"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|warning| warning["code"].as_str())
        .collect();
    assert!(codes.contains(&"model-unavailable"), "{codes:?}");
    let answered = reuse(&out, &record);
    assert_eq!(answered.code, 0, "{}", answered.document);
    assert_eq!(answered.document["holds"], false);
    assert_eq!(
        answered.document["failure"]["condition"],
        "model-unavailable"
    );
}
