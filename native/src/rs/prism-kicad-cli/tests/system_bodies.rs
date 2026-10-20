//! `system build --parts` (3d): a body read from staged KiCad files, the
//! parts file in the key, and the files it may not read.

mod support;
#[path = "support/system_common.rs"]
mod system_common;

use prism_bundle::generator::sha256_hex;
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use support::{run, s, scratch};
use system_common::{document, output, write_document};

const SYMBOL: &str = r#"(kicad_symbol_lib (version 20241209) (generator "kicad_symbol_editor")
  (symbol "Conn_01x04" (in_bom yes) (on_board yes)
    (property "Reference" "J" (at 0 5.08 0) (effects (font (size 1.27 1.27))))
    (symbol "Conn_01x04_1_1"
      (pin passive line (at -5.08 2.54 0) (length 3.81) (name "VBUS" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
      (pin passive line (at -5.08 0 0) (length 3.81) (name "D-" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
      (pin passive line (at -5.08 -2.54 0) (length 3.81) (name "D+" (effects (font (size 1.27 1.27)))) (number "3" (effects (font (size 1.27 1.27)))))
      (pin passive line (at -5.08 -5.08 0) (length 3.81) (name "GND" (effects (font (size 1.27 1.27)))) (number "4" (effects (font (size 1.27 1.27)))))
    )
  )
)
"#;

const FOOTPRINT: &str = r#"(footprint "PinHeader_1x04_P2.54mm_Vertical" (version 20241229) (generator "pcbnew") (layer "F.Cu")
  (fp_rect (start -1.8 -1.8) (end 1.8 9.4) (stroke (width 0.05) (type solid)) (fill none) (layer "F.CrtYd"))
  (pad "1" thru_hole rect (at 0 0) (size 1.7 1.7) (drill 1) (layers "*.Cu" "*.Mask"))
  (pad "2" thru_hole oval (at 0 2.54) (size 1.7 1.7) (drill 1) (layers "*.Cu" "*.Mask"))
  (pad "3" thru_hole oval (at 0 5.08) (size 1.7 1.7) (drill 1) (layers "*.Cu" "*.Mask"))
  (pad "4" thru_hole oval (at 0 7.62) (size 1.7 1.7) (drill 1) (layers "*.Cu" "*.Mask"))
)
"#;

/// A parts file with the header's symbol and footprint staged beside it, and the body's model.
fn parts_dir(label: &str, footprint_path: &str, footprint_sha: Option<&str>) -> PathBuf {
    let dir = scratch(&format!("system-parts-{label}"));
    std::fs::create_dir_all(dir.join("parts")).unwrap();
    std::fs::write(dir.join("parts/conn.kicad_sym"), SYMBOL).unwrap();
    std::fs::write(dir.join("parts/conn.kicad_mod"), FOOTPRINT).unwrap();
    let parts = json!({
        "schema": "prism.system_parts.a0",
        "parts": [
            {"ref": "cmp_box@rev_b1", "componentId": "cmp_box", "revisionId": "rev_b1", "name": "Enclosure",
             "model": {"glbKey": "box", "stepSha256": "a".repeat(64),
                       "boundsMin": {"xNm": -30_000_000, "yNm": -20_000_000, "zNm": 0},
                       "boundsMax": {"xNm": 30_000_000, "yNm": 20_000_000, "zNm": 15_000_000}}},
            {"ref": "cmp_usb", "componentId": "cmp_usb", "revisionId": "rev_u3", "name": "USB header",
             "symbol": {"path": "parts/conn.kicad_sym", "sha256": sha256_hex(SYMBOL.as_bytes()), "name": "Conn_01x04"},
             "footprint": {"path": footprint_path,
                           "sha256": footprint_sha.map_or_else(|| sha256_hex(FOOTPRINT.as_bytes()), str::to_owned)}},
        ],
    });
    std::fs::write(dir.join("parts.json"), serde_json::to_vec(&parts).unwrap()).unwrap();
    dir
}

fn body_document() -> Value {
    let mut doc = document(
        "Module",
        vec![
            json!({"id": "occ_box", "label": "Box", "source": {"kind": "body", "componentId": "cmp_box", "revisionId": "rev_b1"}}),
        ],
    );
    doc["bodyConnectors"] = json!([{
        "id": "bc_usb", "occurrence": "occ_box", "refdes": "J1",
        "part": {"componentId": "cmp_usb"},
        "frame": {"translation": {"xNm": 30_000_000, "yNm": 0, "zNm": 7_500_000},
                  "rotation": {"x": 0.0, "y": std::f64::consts::FRAC_1_SQRT_2, "z": 0.0, "w": std::f64::consts::FRAC_1_SQRT_2}},
        "quarterTurns": 0,
    }]);
    doc
}

fn build_with_parts(label: &str, parts: &Path) -> (support::Run, PathBuf) {
    let doc = write_document(label, &body_document());
    let out = scratch(&format!("system-out-{label}")).join("bundle.json");
    let parts = parts.join("parts.json");
    let argv = [
        "system",
        "build",
        "--document",
        s(&doc),
        "--parts",
        s(&parts),
        "-o",
        s(&out),
        "--quiet",
    ];
    (run(&argv), out)
}

#[test]
fn a_body_reads_its_connectors_from_the_staged_parts() {
    let dir = parts_dir("read", "parts/conn.kicad_mod", None);
    let (finished, out) = build_with_parts("body-read", &dir);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let bundle = output(&out);
    let body = &bundle["occurrences"][0];
    assert_eq!(body["state"], "ready");
    let names: Vec<&str> = body["connectors"][0]["pins"]
        .as_array()
        .unwrap()
        .iter()
        .map(|pin| pin["pinName"].as_str().unwrap())
        .collect();
    assert_eq!(names, ["VBUS", "D-", "D+", "GND"]);
    assert_eq!(body["connectors"][0]["value"], "USB header");
    assert_eq!(
        bundle["placement"]["occurrences"][0]["bounds"]["max"]["zNm"],
        15_000_000
    );
    assert!(
        bundle["findings"].as_array().unwrap().is_empty(),
        "{}",
        bundle["findings"]
    );
}

#[test]
fn the_parts_file_is_part_of_the_key() {
    let first = parts_dir("key-a", "parts/conn.kicad_mod", None);
    let (one, _) = build_with_parts("body-key-a", &first);
    let second = parts_dir("key-b", "parts/conn.kicad_mod", None);
    // The same parts, renamed: a different file, so a different key.
    let mut parts: Value =
        serde_json::from_slice(&std::fs::read(second.join("parts.json")).unwrap()).unwrap();
    parts["parts"][1]["name"] = json!("USB header (rev B)");
    std::fs::write(
        second.join("parts.json"),
        serde_json::to_vec(&parts).unwrap(),
    )
    .unwrap();
    let (two, _) = build_with_parts("body-key-b", &second);
    assert_eq!(one.code, 0, "{}", one.document);
    assert_eq!(two.code, 0, "{}", two.document);
    assert_ne!(
        one.document["system_bundle_key"],
        two.document["system_bundle_key"]
    );
}

#[test]
fn staged_files_must_match_and_stay_beside_the_parts_file() {
    let wrong = parts_dir("sha", "parts/conn.kicad_mod", Some(&"0".repeat(64)));
    let (finished, _) = build_with_parts("body-sha", &wrong);
    assert_eq!(finished.code, 3, "{}", finished.document);
    assert!(
        finished
            .document
            .to_string()
            .contains("does not match its sha256")
    );

    let escaping = parts_dir("escape", "parts/../../conn.kicad_mod", None);
    let (finished, _) = build_with_parts("body-escape", &escaping);
    assert_eq!(finished.code, 3, "{}", finished.document);
}
