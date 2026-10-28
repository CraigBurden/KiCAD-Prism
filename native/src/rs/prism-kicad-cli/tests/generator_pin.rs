//! The generator pin and determinism over every committed fixture
//! (cli-spec.md §5.1.2, §11 items 2 and 6).
//!
//! Every fixture is built through every stage it reaches, twice: into two
//! output directories, from two working directories, with `--threads 1`
//! and `--threads 8`. Both runs must give byte-identical archives and
//! stdout, `bundle verify` must accept the archive, and each member's
//! SHA-256 must equal the committed table keyed by the generator digest
//! (`tests/fixtures/generator-pin.json`), so a member that changes under an
//! unchanged generator id fails. After an intended change, bump
//! `crate_version` and regenerate the table with `PRISM_KICAD_BLESS=1`.
//!
//! `materialization/board.kmpack` is byte-identical only for the same binary
//! on the same architecture (conventions.md §14), so its digests, and the
//! `bundle.json` that lists them, are pinned per `<arch>-<os>` and checked
//! only on an architecture the table has.

mod support;

use serde_json::{Map, Value, json};
use support::{build_all, fixtures, run, s, scratch, sha256};

const PIN: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/generator-pin.json"
);

const ARCH_DEPENDENT: [&str; 2] = ["bundle.json", "materialization/board.kmpack"];

/// The member digests: the portable ones and the architecture-dependent ones.
fn members(archive: &[u8]) -> (Map<String, Value>, Map<String, Value>) {
    let limits = prism_bundle::Limits::defaults(prism_bundle::Work::Verify);
    let reader = prism_bundle::BundleReader::open(archive.to_vec(), &limits).unwrap();
    let mut digests = vec![(
        "bundle.json".to_owned(),
        sha256(&reader.manifest_read().bytes),
    )];
    for member in &reader.manifest().members {
        digests.push((member.path.0.clone(), member.sha256.0.clone()));
    }
    let has_pack = digests.iter().any(|(path, _)| path == ARCH_DEPENDENT[1]);
    let (mut portable, mut native) = (Map::new(), Map::new());
    for (path, digest) in digests {
        if has_pack && ARCH_DEPENDENT.contains(&path.as_str()) {
            native.insert(path, digest.into());
        } else {
            portable.insert(path, digest.into());
        }
    }
    (portable, native)
}

fn target() -> String {
    format!("{}-{}", std::env::consts::ARCH, std::env::consts::OS)
}

#[test]
fn version_is_the_canonical_generator_id() {
    let version = run(&["version"]);
    assert_eq!(version.code, 0);
    let bytes = &version.stdout[..version.stdout.len() - 1];
    assert_eq!(prism_bundle::generator::canonical(&version.document), bytes);
    assert_eq!(run(&["--version"]).stdout, version.stdout);
}

#[test]
fn every_fixture_builds_identically_twice_and_matches_the_pin() {
    let recordings = scratch("pin-recordings");
    let first_cwd = support::repo();
    let second_cwd = scratch("pin-cwd");
    let version = run(&["version"]);
    let digest = sha256(&version.stdout[..version.stdout.len() - 1]);
    let mut table = Map::new();
    let mut native_table = Map::new();
    for fixture in fixtures(&recordings) {
        let one = scratch("pin-one");
        let two = scratch("pin-two");
        let (archive, stdouts) = build_all(&fixture, &one, "1", Some(&first_cwd));
        let (again, stdouts_again) = build_all(&fixture, &two, "8", Some(&second_cwd));
        assert!(archive == again, "{}: two builds differ", fixture.dir);
        assert_eq!(stdouts, stdouts_again, "{}: stdout differs", fixture.dir);
        let verify = run(&["bundle", "verify", s(&one.join("bundle.prism")), "--quiet"]);
        assert_eq!(verify.code, 0, "{}: {}", fixture.dir, verify.document);
        assert_eq!(verify.document["generator_matches"], true);
        let (portable, native) = members(&archive);
        table.insert(fixture.dir.clone(), Value::Object(portable));
        if !native.is_empty() {
            native_table.insert(fixture.dir.clone(), Value::Object(native));
        }
    }
    let current = json!({"generator_digest": digest, "fixtures": table});
    let pinned: Value = std::fs::read_to_string(PIN)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_else(|| json!({}));
    if std::env::var_os("PRISM_KICAD_BLESS").is_some() {
        let mut blessed = current.clone();
        let mut per_target = pinned["per_target"]
            .as_object()
            .cloned()
            .unwrap_or_default();
        if pinned["generator_digest"] != current["generator_digest"] {
            per_target.clear();
        }
        per_target.insert(target(), Value::Object(native_table));
        blessed["per_target"] = Value::Object(per_target);
        let mut text = serde_json::to_string_pretty(&blessed).unwrap();
        text.push('\n');
        std::fs::write(PIN, text).unwrap();
        return;
    }
    assert_eq!(
        pinned["generator_digest"], current["generator_digest"],
        "the generator id changed: regenerate the pin table with PRISM_KICAD_BLESS=1"
    );
    for (fixture, expected) in pinned["fixtures"].as_object().unwrap() {
        assert_eq!(
            &current["fixtures"][fixture], expected,
            "{fixture}: a member changed under an unchanged generator id; bump crate_version"
        );
    }
    assert_eq!(
        pinned["fixtures"].as_object().unwrap().len(),
        table.len(),
        "a fixture is not pinned"
    );
    match pinned["per_target"].get(target()) {
        Some(expected) => assert_eq!(
            &Value::Object(native_table),
            expected,
            "a materialization changed under an unchanged generator id on {}",
            target()
        ),
        None => eprintln!(
            "no pinned materializations for {}; bless on this architecture to add them",
            target()
        ),
    }
}
