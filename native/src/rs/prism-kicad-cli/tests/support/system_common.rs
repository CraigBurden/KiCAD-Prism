//! Shared helpers of the `system build` tests: fixture bundles, documents and
//! the B2B mezzanine inputs.

#![allow(dead_code, reason = "each test binary uses a subset of the helpers")]

use super::support::{self, repo, run, s, scratch};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

const FIXTURES: &str = "backend/tests/fixtures/system_builder";

/// A deterministic 64-hex revision key for a fixture.
pub fn key(seed: u8) -> String {
    format!("{seed:02x}").repeat(32)
}

fn project(relative: &str) -> PathBuf {
    repo().join(FIXTURES).join(relative)
}

/// A parse-stage bundle of a fixture, built at `seed`'s revision key.
pub fn fixture_bundle(relative: &str, seed: u8) -> PathBuf {
    let dir = scratch(&format!(
        "system-bundle-{seed}-{}",
        relative.replace('/', "-")
    ));
    let archive = dir.join("fixture.prism");
    let finished = run(&[
        "bundle",
        "build",
        s(&project(relative)),
        "--stage",
        "parse",
        "--revision-key",
        &key(seed),
        "-o",
        s(&archive),
        "--quiet",
    ]);
    assert_eq!(finished.code, 0, "{relative}: {}", finished.document);
    archive
}

/// One board occurrence of a document.
pub fn occurrence(id: &str, label: &str) -> Value {
    json!({
        "id": id,
        "label": label,
        "source": {
            "kind": "board",
            "projectId": format!("prj_{:012x}", id.bytes().map(u64::from).sum::<u64>()),
            "track": {"kind": "pinned", "commit": "0".repeat(40)},
        },
    })
}

/// A document with every required collection.
pub fn document(name: &str, occurrences: Vec<Value>) -> Value {
    json!({
        "schema": "prism.system.v2",
        "name": name,
        "sheets": [],
        "occurrences": occurrences,
        "subPorts": [],
        "dismissedSuggestions": [],
        "bodyConnectors": [],
        "mates": [],
        "harnesses": [],
        "exports": [],
        "waivers": [],
        "layout": {},
    })
}

pub fn endpoint(occurrence: &str, connector: &str) -> Value {
    json!({"occurrence": occurrence, "connector": connector})
}

pub fn sub_port_endpoint(occurrence: &str, connector: &str, id: &str) -> Value {
    json!({
        "occurrence": occurrence,
        "connector": connector,
        "subPort": {"kind": "occurrence", "id": id},
    })
}

pub fn sub_port(id: &str, occurrence: &str, connector: &str, pins: &[&str]) -> Value {
    json!({
        "id": id,
        "occurrence": occurrence,
        "connector": connector,
        "name": id,
        "pins": pins,
    })
}

pub fn end(id: &str, occurrence: &str, connector: &str) -> Value {
    json!({
        "id": id,
        "site": endpoint(occurrence, connector),
        "contacts": {},
        "pinMap": [],
    })
}

pub fn link(id: &str, a: Value, b: Value) -> Value {
    json!({"id": id, "a": a, "b": b, "unmapped": []})
}

pub fn harness(id: &str, ends: Vec<Value>, links: Vec<Value>) -> Value {
    json!({
        "id": id,
        "label": id,
        "ends": ends,
        "links": links,
        "wires": [],
        "splices": [],
        "branchPoints": [],
        "segments": [],
        "coverings": [],
        "cables": [],
        "looseEnds": [],
        "markers": [],
        "waypoints": [],
    })
}

pub fn write_document(label: &str, value: &Value) -> PathBuf {
    let dir = scratch(&format!("system-document-{label}"));
    let path = dir.join("system.json");
    std::fs::write(&path, serde_json::to_vec(value).unwrap()).unwrap();
    path
}

pub struct Member<'a> {
    /// The occurrence the member fills.
    pub occurrence: &'a str,
    /// The member's bundle archive.
    pub bundle: &'a Path,
    /// The member's revision key.
    pub key: &'a str,
}

/// Run `system build`; `-o` is `<scratch>/bundle.json`.
pub fn build(
    label: &str,
    document: &Path,
    members: &[Member<'_>],
    absent: &[&str],
) -> (support::Run, PathBuf) {
    let out = scratch(&format!("system-out-{label}")).join("bundle.json");
    let mut args = vec![
        "system".to_owned(),
        "build".to_owned(),
        "--document".to_owned(),
        s(document).to_owned(),
    ];
    for member in members {
        args.push("--member".to_owned());
        args.push(format!("{}={}", member.occurrence, s(member.bundle)));
        args.push("--member-revision-key".to_owned());
        args.push(format!("{}={}", member.occurrence, member.key));
    }
    for occurrence in absent {
        args.push("--absent".to_owned());
        args.push((*occurrence).to_owned());
    }
    args.push("-o".to_owned());
    args.push(s(&out).to_owned());
    args.push("--quiet".to_owned());
    let argv: Vec<&str> = args.iter().map(String::as_str).collect();
    (run(&argv), out)
}

pub fn output(path: &Path) -> Value {
    serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap()
}

pub fn finding<'a>(bundle: &'a Value, code: &str) -> Option<&'a Value> {
    bundle["findings"]
        .as_array()
        .unwrap()
        .iter()
        .find(|finding| finding["code"] == code)
}

/// A two-board mezzanine document with `mate`.
pub fn mezzanine(mate: Value) -> Value {
    let mut doc = document(
        "Mezzanine",
        vec![occurrence("occ_base", "Base"), occurrence("occ_top", "Top")],
    );
    doc["mates"] = json!([mate]);
    doc
}

pub fn mezzanine_mate(turns: u32, manual: Option<Value>) -> Value {
    let mut mate = json!({
        "id": "mate_mezz",
        "a": endpoint("occ_base", "J1"),
        "b": endpoint("occ_top", "J1"),
        "orientation": {"quarterTurns": turns, "flip": false},
        "rows": {},
    });
    if let Some(map) = manual {
        mate["manualMap"] = map;
    }
    mate
}

pub fn mezzanine_members<'a>(
    base: &'a Path,
    top: &'a Path,
    k11: &'a str,
    k22: &'a str,
) -> [Member<'a>; 2] {
    [
        Member {
            occurrence: "occ_base",
            bundle: base,
            key: k11,
        },
        Member {
            occurrence: "occ_top",
            bundle: top,
            key: k22,
        },
    ]
}

pub fn mezzanine_bundle(label: &str, mate: Value) -> Value {
    let base = fixture_bundle("p2/sources/mezz_base/F0/mezz_base.kicad_pro", 0x11);
    let top = fixture_bundle("p2/sources/mezz_top/F0/mezz_top.kicad_pro", 0x22);
    let (k11, k22) = (key(0x11), key(0x22));
    let members = mezzanine_members(&base, &top, &k11, &k22);
    let path = write_document(label, &mezzanine(mate));
    let (finished, out) = build(label, &path, &members, &[]);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let bundle = output(&out);
    prism_bundle::schema::validate("prism.system_bundle.a0", &bundle).unwrap();
    bundle
}
