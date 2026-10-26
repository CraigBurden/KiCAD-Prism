//! Two units of one symbol pasted with the same UUID. KiCad keeps them
//! (`SCH_SCREENS::ReplaceDuplicateTimeStamps` runs only on legacy files) and
//! they stay two units of one reference; the bundle must pass `bundle verify`.

mod support;

use prism_bundle::{BundleReader, Limits, Work};
use serde_json::Value;
use support::{run, s, scratch};

const SHEET: &str = r#"(kicad_sch (version 20250114) (generator "eeschema") (uuid "00000000-0000-4000-8000-000000000001") (paper "A4")
  (lib_symbols
    (symbol "Demo:Dual"
      (symbol "Dual_1_1" (pin passive line (at 0 0 0) (length 2.54) (name "A") (number "1")))
      (symbol "Dual_2_1" (pin passive line (at 0 0 0) (length 2.54) (name "B") (number "2")))))
  (symbol (lib_id "Demo:Dual") (at 10 10 0) (unit 1) (uuid "00000000-0000-4000-8000-0000000000aa")
    (property "Reference" "U1" (at 10 10 0)) (property "Value" "Dual" (at 10 10 0))
    (pin "1" (uuid "00000000-0000-4000-8000-0000000000b1"))
    (instances (project "p" (path "/00000000-0000-4000-8000-000000000001" (reference "U1") (unit 1)))))
  (symbol (lib_id "Demo:Dual") (at 30 10 0) (unit 2) (uuid "00000000-0000-4000-8000-0000000000aa")
    (property "Reference" "U1" (at 30 10 0)) (property "Value" "Dual" (at 30 10 0))
    (pin "2" (uuid "00000000-0000-4000-8000-0000000000b2"))
    (instances (project "p" (path "/00000000-0000-4000-8000-000000000001" (reference "U1") (unit 2)))))
  (sheet_instances (path "/" (page "1"))))
"#;

#[test]
fn units_that_share_a_uuid_give_a_valid_bundle() {
    let tree = scratch("duplicate-units");
    std::fs::write(tree.join("p.kicad_pro"), "{}\n").unwrap();
    std::fs::write(tree.join("p.kicad_sch"), SHEET).unwrap();
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
    let verified = run(&["bundle", "verify", s(&out), "--quiet"]);
    assert_eq!(verified.code, 0, "{}", verified.document);
    let limits = Limits::defaults(Work::Verify);
    let reader = BundleReader::open(std::fs::read(&out).unwrap(), &limits).unwrap();
    let interface: Value = serde_json::from_slice(
        &reader
            .member("projections/system-interface.json")
            .unwrap()
            .unwrap(),
    )
    .unwrap();
    let u1 = interface["components"]
        .as_array()
        .unwrap()
        .iter()
        .find(|component| component["reference"] == "U1")
        .expect("U1 is a component");
    assert_eq!(
        u1["memberKeys"],
        serde_json::json!([
            "/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000aa"
        ])
    );
}
