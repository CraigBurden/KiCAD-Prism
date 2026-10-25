//! A KiCad 10 multi-root project (`schematic.top_level_sheets`) parsed into
//! `design.json`, checked against KiCad 10.0.6.
//!
//! `fixtures/multi-root` lists two top-level sheets, Main (`demo.kicad_sch`, with
//! the sub-sheet Power) and Second (`second.kicad_sch`, whose own file UUID the
//! listing overrides). kicad-cli loads one schematic, so the expectation was
//! taken from its netlist of a root that holds the two as sub-sheets, named and
//! identified as the project lists them, with every instance path also written
//! under that root's UUID: the same occurrence paths and the same names, since
//! with more than one top-level sheet KiCad names local nets under the sheet
//! (`SCH_SHEET_PATH::PathHumanReadable`).

mod support;

use prism_bundle::{BundleReader, Limits, Work};
use serde_json::Value;
use std::collections::BTreeMap;
use support::{run, s, scratch};

const MAIN: &str = "/00000000-0000-4000-8000-0000000000a1/";
const SECOND: &str = "/00000000-0000-4000-8000-0000000000b1/";

fn build() -> BundleReader<Vec<u8>> {
    let project = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/multi-root/demo.kicad_pro"
    );
    let out = scratch("multi-root").join("o.prism");
    let built = run(&[
        "bundle",
        "build",
        project,
        "--stage",
        "parse",
        "-o",
        s(&out),
        "--quiet",
    ]);
    assert_eq!(built.code, 0, "{}", built.document);
    assert_eq!(built.document["stages"][0]["status"], "complete");
    assert!(
        built.document["warnings"]
            .as_array()
            .is_none_or(Vec::is_empty),
        "{}",
        built.document
    );
    let limits = Limits::defaults(Work::Verify);
    BundleReader::open(std::fs::read(&out).unwrap(), &limits).unwrap()
}

fn member(reader: &BundleReader<Vec<u8>>, path: &str) -> Value {
    serde_json::from_slice(&reader.member(path).unwrap().unwrap()).unwrap()
}

fn design() -> Value {
    member(&build(), "design.json")
}

#[test]
fn every_top_level_sheet_joins_one_netlist_as_kicad_builds_it() {
    let design = design();
    let nets: BTreeMap<String, Vec<String>> = design["nets"]
        .as_array()
        .unwrap()
        .iter()
        .map(|net| {
            let mut pins: Vec<String> = net["terminals"]
                .as_array()
                .unwrap()
                .iter()
                .map(|t| {
                    format!(
                        "{}.{}",
                        t["designator"].as_str().unwrap(),
                        t["pin"].as_str().unwrap()
                    )
                })
                .collect();
            pins.sort();
            (net["name"].as_str().unwrap().to_owned(), pins)
        })
        .collect();
    let expected: BTreeMap<String, Vec<String>> = [
        ("/Main/SIG", &["R1.2", "R2.1"][..]),
        ("/Second/OWN", &["R4.2"]),
        ("/Second/SIG", &["C2.1", "R4.1"]),
        ("GND", &["C1.2", "R2.2"]),
        ("VIN", &["C2.2", "R1.1"]),
        ("VOUT", &["C1.1", "R3.1"]),
        ("unconnected-(R3-Pad2)", &["R3.2"]),
    ]
    .into_iter()
    .map(|(name, pins)| {
        (
            name.to_owned(),
            pins.iter().map(|p| (*p).to_owned()).collect(),
        )
    })
    .collect();
    assert_eq!(nets, expected);
}

#[test]
fn each_top_level_sheet_is_named_and_identified_by_the_project() {
    let design = design();
    let sheets: Vec<(&str, &str, &str)> = design["sheets"]
        .as_array()
        .unwrap()
        .iter()
        .map(|sheet| {
            (
                sheet["path"].as_str().unwrap(),
                sheet["sheet_path"].as_str().unwrap(),
                sheet["sheet_path_uuids"].as_str().unwrap(),
            )
        })
        .collect();
    let power = format!("{MAIN}00000000-0000-4000-8000-0000000000c1/");
    assert_eq!(
        sheets,
        [
            ("demo.kicad_sch", "/Main/", MAIN),
            ("sub/power.kicad_sch", "/Main/Power/", power.as_str()),
            ("second.kicad_sch", "/Second/", SECOND),
        ]
    );
    let r3 = design["components"]
        .as_array()
        .unwrap()
        .iter()
        .find(|component| component["designator"] == "R3")
        .unwrap();
    assert_eq!(r3["parameters"]["Sheetname"], "Second");
    assert_eq!(r3["parameters"]["Sheetfile"], "second.kicad_sch");
    assert_eq!(r3["parameters"]["kicad_sheet_path_uuids"], SECOND);
}

#[test]
fn the_project_lists_every_top_level_sheet() {
    let project = member(&build(), "projections/project.json");
    let documents: Vec<(&str, &str)> = project["documents"]
        .as_array()
        .unwrap()
        .iter()
        .map(|document| {
            (
                document["path"].as_str().unwrap(),
                document["kind"].as_str().unwrap(),
            )
        })
        .collect();
    assert_eq!(
        documents,
        [
            ("demo.kicad_sch", "root-schematic"),
            ("second.kicad_sch", "schematic"),
            ("sub/power.kicad_sch", "schematic"),
        ]
    );
}

/// A project may list top-level sheets that leave out `<stem>.kicad_sch`: KiCad
/// does not open it, but it stays a member, as the configured root schematic
/// (bundle-format.md I4), and the bundle verifies.
#[test]
fn a_configured_root_left_out_of_the_listing_stays_a_member() {
    let sheet = |uuid: &str| {
        format!(
            "(kicad_sch (version 20260306) (generator \"eeschema\") (uuid \"{uuid}\") (paper \"A4\") (lib_symbols))\n"
        )
    };
    let project = r#"{"schematic": {"top_level_sheets": [
        {"filename": "a.kicad_sch", "name": "A", "uuid": "00000000-0000-4000-8000-0000000000a1"},
        {"filename": "b.kicad_sch", "name": "B", "uuid": "00000000-0000-4000-8000-0000000000b1"}]}}"#;
    let tree = scratch("multi-root-unlisted");
    for (name, text) in [
        ("p.kicad_pro", project.to_owned()),
        ("p.kicad_sch", sheet("00000000-0000-4000-8000-000000000001")),
        ("a.kicad_sch", sheet("00000000-0000-4000-8000-000000000002")),
        ("b.kicad_sch", sheet("00000000-0000-4000-8000-000000000003")),
    ] {
        std::fs::write(tree.join(name), text).unwrap();
    }
    let out = tree.join("o.prism");
    let built = run(&[
        "bundle",
        "build",
        s(&tree.join("p.kicad_pro")),
        "--stage",
        "parse",
        "-o",
        s(&out),
        "--quiet",
    ]);
    assert_eq!(built.code, 0, "{}", built.document);
    assert_eq!(built.document["stages"][0]["status"], "complete");
    let limits = Limits::defaults(Work::Verify);
    let reader = BundleReader::open(std::fs::read(&out).unwrap(), &limits).unwrap();
    let members: Vec<&str> = reader
        .manifest()
        .members
        .iter()
        .map(|member| member.path.0.as_str())
        .collect();
    for sheet in [
        "sources/p.kicad_sch",
        "sources/a.kicad_sch",
        "sources/b.kicad_sch",
    ] {
        assert!(members.contains(&sheet), "{sheet} in {members:?}");
    }
    let design: Value =
        serde_json::from_slice(&reader.member("design.json").unwrap().unwrap()).unwrap();
    let paths: Vec<&str> = design["sheets"]
        .as_array()
        .unwrap()
        .iter()
        .map(|sheet| sheet["path"].as_str().unwrap())
        .collect();
    assert_eq!(paths, ["a.kicad_sch", "b.kicad_sch"]);
    assert_eq!(run(&["bundle", "verify", s(&out), "--quiet"]).code, 0);
}
