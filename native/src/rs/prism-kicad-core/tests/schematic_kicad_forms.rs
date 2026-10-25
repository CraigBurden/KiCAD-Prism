//! Schematic forms KiCad 10 writes or accepts that the model must read as KiCad
//! does: each case builds design.json end to end, so a parse or compiled-graph
//! abort fails the test.

use prism_kicad_contracts::generated::source_bundle_manifest::{
    SourceBundleManifestA0, SourceBundleSource, SourceKind,
};
use prism_kicad_core::{
    KiCadDesignJsonPaths, KiCadNetlistLimits, ProjectLimits, SchematicBundleIndex,
    SchematicBundleLimits, SourceBundle, SourceBundleLimits, build_kicad_design_facts,
    build_kicad_design_json,
};
use serde_json::Value;

const RESISTOR_TWO_STYLES: &str = r#"(lib_symbols
    (symbol "Demo:R"
      (property "Reference" "R" (at 0 0 0))
      (property "Value" "R" (at 0 0 0))
      (symbol "Demo:R_1_1"
        (pin passive line (at 0 0 0) (length 0) (name "~") (number "1")))
      (symbol "Demo:R_1_2"
        (pin passive line (at 0 10 0) (length 0) (name "~") (number "1")))))"#;

/// KiCad 10 writes `(body_style N)` on a placed symbol; 8 and 9 wrote `(convert N)`.
/// KiCad's parser takes either (`parseSchematicSymbol`, `T_convert`/`T_body_style`).
#[test]
fn body_style_selects_the_alternate_body_like_convert() {
    for token in ["body_style", "convert"] {
        let root = format!(
            r#"(kicad_sch (version 20260306) (uuid root)
              {RESISTOR_TWO_STYLES}
              (wire (pts (xy 0 0) (xy 5 0)) (uuid w))
              (label "BODY_ONE" (at 5 0 0) (uuid l))
              (symbol (lib_id "Demo:R") (at 0 0 0) (unit 1) ({token} 2)
                (uuid 6e0f0c55-1d9b-4c55-8a5e-1f3e2d4c5b6a)
                (property "Reference" "R1" (at 0 0 0))
                (property "Value" "R" (at 0 0 0))))"#
        );
        let design = design(&[("root.kicad_sch", &root)]).expect("design.json");
        assert_eq!(
            net_of(&design, "R1", "1").as_deref(),
            Some("unconnected-(R1-Pad1)"),
            "({token} 2) places the pin at the body-2 position, off the labelled wire"
        );
    }
}

/// A label carries any number of user fields, each with its own `(at …)`
/// (`SCH_IO_KICAD_SEXPR_PARSER::parseSchText`, `T_property`).
#[test]
fn labels_with_many_fields_parse() {
    let fields: String = (0..12)
        .map(|n| format!(r#"(property "F{n}" "v" (at 0 0 0) (hide yes))"#))
        .collect();
    let root = format!(
        r#"(kicad_sch (version 20260306) (uuid root)
          (label "L" (at 0 0 0) (uuid 1d6e5c4b-3a29-4810-9f7e-6d5c4b3a2910) {fields})
          (global_label "G" (shape input) (at 0 0 0)
            (uuid 2e7f6d5c-4b3a-4921-8a0f-7e6d5c4b3a21) {fields})
          (hierarchical_label "H" (shape input) (at 0 0 0)
            (uuid 3f8a7e6d-5c4b-4a32-9b1a-8f7e6d5c4b32) {fields}))"#
    );
    design(&[("root.kicad_sch", &root)]).expect("labels with fields");
}

/// KiCad reads a pin orientation with `strtol` (`parsePin`, `parseInt("pin
/// orientation")`): `270.0` is 270.
#[test]
fn decimal_pin_angles_read_as_their_integer_part() {
    let root = r#"(kicad_sch (version 20260306) (uuid root)
      (lib_symbols
        (symbol "Demo:R"
          (property "Reference" "R" (at 0 0 0))
          (symbol "Demo:R_1_1"
            (pin passive line (at 0 0 270.0) (length 2.54) (name "~") (number "1")))))
      (symbol (lib_id "Demo:R") (at 0 0 0) (unit 1)
        (uuid 5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a)
        (property "Reference" "R1" (at 0 0 0))))"#;
    let design = design(&[("root.kicad_sch", root)]).expect("a decimal pin angle");
    assert!(net_of(&design, "R1", "1").is_some());
}

/// KiCad's parser assigns each header form in turn, so a repeated `uuid`,
/// `version`, `generator`, `title_block` or sheet `uuid` (a merge leftover) keeps
/// the later value (`ParseSchematic`, `parseSchematicSymbol`, `parseSheet`).
#[test]
fn repeated_header_forms_keep_the_later_value() {
    let root = r#"(kicad_sch (version 20250114) (version 20260306)
      (generator "eeschema") (generator "eeschema")
      (generator_version "9.0") (generator_version "10.0")
      (uuid root-old) (uuid root)
      (title_block (title "Old") (rev "1"))
      (title_block (title "New"))
      (sheet (at 0 0) (size 10 10)
        (uuid 0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d)
        (uuid 1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d)
        (property "Sheetname" "Child" (at 0 0 0))
        (property "Sheetfile" "child.kicad_sch" (at 0 0 0)))
      (symbol (lib_id "Demo:R") (at 0 0 0) (unit 1)
        (uuid 2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e)
        (uuid 3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f)
        (property "Reference" "R1" (at 0 0 0))))"#;
    let child = r#"(kicad_sch (version 20260306) (uuid child))"#;
    let design = design(&[("root.kicad_sch", root), ("child.kicad_sch", child)])
        .expect("repeated header forms");
    let root_sheet = &design["sheets"][0];
    assert_eq!(root_sheet["title"], "New");
    assert_eq!(
        root_sheet["revision"], "",
        "the later title block replaces it whole"
    );
    assert!(
        design["sheets"]
            .as_array()
            .expect("sheets")
            .iter()
            .any(|sheet| sheet["sheet_path_uuids"]
                .as_str()
                .is_some_and(|path| path.contains("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"))),
        "the later sheet uuid names the sheet path"
    );
}

/// KiCad keeps one instance per project and path; a repeated one replaces the
/// earlier (`SCH_SYMBOL::AddHierarchicalReference` removes it first).
#[test]
fn a_repeated_instance_path_keeps_the_later_record() {
    let root = r#"(kicad_sch (version 20260306) (uuid root)
      (lib_symbols
        (symbol "Demo:R"
          (property "Reference" "R" (at 0 0 0))
          (symbol "Demo:R_1_1"
            (pin passive line (at 0 0 0) (length 0) (name "~") (number "1")))))
      (symbol (lib_id "Demo:R") (at 0 0 0) (unit 1)
        (uuid 4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f7a)
        (property "Reference" "R?" (at 0 0 0))
        (instances
          (project "demo"
            (path "/root" (reference "R1") (unit 1))
            (path "/root" (reference "R2") (unit 1))))))"#;
    let design = design(&[("root.kicad_sch", root)]).expect("a repeated instance path");
    assert!(net_of(&design, "R2", "1").is_some());
    assert!(net_of(&design, "R1", "1").is_none());
}

fn net_of(design: &Value, designator: &str, pin: &str) -> Option<String> {
    design["nets"].as_array()?.iter().find_map(|net| {
        net["terminals"]
            .as_array()?
            .iter()
            .any(|terminal| terminal["designator"] == designator && terminal["pin"] == pin)
            .then(|| net["name"].as_str().unwrap_or_default().to_owned())
    })
}

/// design.json for the given schematics, the first one the root, or the error text.
fn design(schematics: &[(&str, &str)]) -> Result<Value, String> {
    let mut buffers = vec![b"{}".to_vec()];
    let mut sources = vec![descriptor("demo.kicad_pro", SourceKind::Project, 0, b"{}")];
    for (slot, (path, text)) in schematics.iter().enumerate() {
        let slot = u32::try_from(slot + 1).expect("few test sources");
        sources.push(descriptor(
            path,
            SourceKind::Schematic,
            slot,
            text.as_bytes(),
        ));
        buffers.push(text.as_bytes().to_vec());
    }
    let manifest = SourceBundleManifestA0 {
        project_path: Some("demo.kicad_pro".to_owned()),
        root_schematic_path: schematics[0].0.to_owned(),
        schema: "kicad_monkey.source_bundle_manifest.a0".to_owned(),
        sources,
        type_: "kicad_monkey.source_bundle_manifest".to_owned(),
        version: "a0".to_owned(),
    };
    let bundle = SourceBundle::from_manifest(manifest, buffers, SourceBundleLimits::default())
        .map_err(|error| error.to_string())?;
    let index = SchematicBundleIndex::build(&bundle, SchematicBundleLimits::default())
        .map_err(|error| error.to_string())?;
    let facts = build_kicad_design_facts(
        &index,
        &bundle,
        ProjectLimits::default(),
        Default::default(),
        KiCadNetlistLimits::default(),
    )
    .map_err(|error| error.to_string())?;
    build_kicad_design_json(&index, &facts, &KiCadDesignJsonPaths::default(), None, true)
        .map_err(|error| error.to_string())
}

fn descriptor(path: &str, kind: SourceKind, slot: u32, bytes: &[u8]) -> SourceBundleSource {
    SourceBundleSource {
        kind,
        path: path.to_owned(),
        slot: slot.into(),
        source_bytes: bytes.len().to_string().into(),
    }
}
