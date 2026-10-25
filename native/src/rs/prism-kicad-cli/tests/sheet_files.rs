//! Sheet files are found as KiCad 10.0.6 finds them (`SCH_IO_KICAD_SEXPR::loadHierarchy`),
//! by one rule the core, stage parse and the projections share
//! (`prism_kicad_core::sheet_file`): what KiCad resolves, Prism resolves.

mod support;

use prism_bundle::{BundleReader, Limits, Work};
use serde_json::Value;
use support::{run, s, scratch};

fn sheet(uuid: &str, body: &str) -> String {
    format!(
        "(kicad_sch (version 20250114) (generator \"eeschema\") (uuid \"{uuid}\") (paper \"A4\") (lib_symbols){body})\n"
    )
}

fn sub_sheet(uuid: &str, name: &str, file: &str) -> String {
    format!(
        "(sheet (at 0 0) (size 10 10) (uuid \"{uuid}\") (property \"Sheetname\" \"{name}\") (property \"Sheetfile\" \"{file}\"))"
    )
}

#[test]
fn a_letter_case_difference_and_a_text_variable_both_reach_the_sheet() {
    let tree = scratch("sheet-files");
    let root = sheet(
        "00000000-0000-4000-8000-000000000001",
        &format!(
            "{}{}",
            sub_sheet(
                "00000000-0000-4000-8000-000000000002",
                "Child",
                "subsheets/child.kicad_sch"
            ),
            sub_sheet(
                "00000000-0000-4000-8000-000000000003",
                "Power",
                "${SUB}/power.kicad_sch"
            ),
        ),
    );
    let files = [
        (
            "p.kicad_pro",
            r#"{"text_variables": {"SUB": "Subsheets"}}"#.to_owned(),
        ),
        ("p.kicad_sch", root),
        (
            "Subsheets/child.kicad_sch",
            sheet("00000000-0000-4000-8000-000000000004", ""),
        ),
        (
            "Subsheets/power.kicad_sch",
            sheet("00000000-0000-4000-8000-000000000005", ""),
        ),
    ];
    for (path, text) in &files {
        let path = tree.join(path);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, text).unwrap();
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
    let codes: Vec<&str> = built.document["warnings"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|warning| warning["code"].as_str())
        .collect();
    assert_eq!(codes, ["sheet-path-case"]);
    assert_eq!(run(&["bundle", "verify", s(&out), "--quiet"]).code, 0);

    let limits = Limits::defaults(Work::Verify);
    let reader = BundleReader::open(std::fs::read(&out).unwrap(), &limits).unwrap();
    let member = |path: &str| -> Value {
        serde_json::from_slice(&reader.member(path).unwrap().unwrap()).unwrap()
    };
    let project = member("projections/project.json");
    let documents: Vec<&str> = project["documents"]
        .as_array()
        .unwrap()
        .iter()
        .map(|document| document["path"].as_str().unwrap())
        .collect();
    assert_eq!(
        documents,
        [
            "Subsheets/child.kicad_sch",
            "Subsheets/power.kicad_sch",
            "p.kicad_sch"
        ]
    );
    let design = member("design.json");
    let sheets: Vec<&str> = design["sheets"]
        .as_array()
        .unwrap()
        .iter()
        .map(|sheet| sheet["sheet_path"].as_str().unwrap())
        .collect();
    assert_eq!(sheets, ["/", "/Child/", "/Power/"]);
}
