//! KiCad 9's `(property private "NAME" "VALUE" …)` fields.
//!
//! KiCad's stock libraries mark KLC notes private (for example
//! `Jumper:SolderJumper_3_Open`), and KiCad copies those fields onto the placed
//! symbol. v5.0.0-alpha read only two bare values per property, so one such
//! field failed the whole schematic model with a misleading resource-limit
//! error.

use prism_kicad_contracts::generated::source_bundle_manifest::{
    SourceBundleManifestA0, SourceBundleSource, SourceKind,
};
use prism_kicad_core::{
    KiCadNetlistLimits, SchematicBundleIndex, SchematicBundleLimits, SourceBundle,
    SourceBundleError, SourceBundleErrorKind, SourceBundleLimits, build_kicad_netlist,
};

const JUMPER: &str = r#"(kicad_sch
  (uuid root)
  (lib_symbols
    (symbol "Jumper:SolderJumper_3_Open"
      (property "Reference" "JP" (at 0 0 0) (effects (font (size 1.27 1.27))))
      (property "Value" "SolderJumper_3_Open" (at 0 0 0) (effects (font (size 1.27 1.27))))
      (property private "KLC_S3.3" "The rectangle is not a symbol body but a graphical element"
        (at 0 0 0) (effects (font (size 1.27 1.27)) (hide yes)))
      (symbol "Jumper:SolderJumper_3_Open_0_1")))
  (symbol (lib_id "Jumper:SolderJumper_3_Open") (at 10 10 0) (unit 1)
    (uuid 0b6a1f6e-2c1d-4a43-9d2a-6f6f2c1f3a01)
    (property "Reference" "JP1" (at 0 0 0))
    (property "Value" "SolderJumper_3_Open" (at 0 0 0))
    (property "private" "a field that is only named private" (at 0 0 0) (hide yes))
    (property private "KLC_S3.3" "The rectangle is not a symbol body but a graphical element"
      (at 0 0 0) (effects (font (size 1.27 1.27)) (hide yes)))))"#;

#[test]
fn private_fields_on_library_and_placed_symbols_parse_and_keep_their_names() {
    let index = single_index(JUMPER.as_bytes()).expect("a private field is valid KiCad");
    let netlist =
        build_kicad_netlist(&index, None, KiCadNetlistLimits::default()).expect("native netlist");
    let component = &netlist.components[0];
    // KiCad's netlist exporter keeps private fields; only drawing and BOMs leave them out.
    assert_eq!(
        component.properties.get("KLC_S3.3").map(String::as_str),
        Some("The rectangle is not a symbol body but a graphical element")
    );
    // A quoted "private" is an ordinary field name, not the flag.
    assert_eq!(
        component.properties.get("private").map(String::as_str),
        Some("a field that is only named private")
    );
}

#[test]
fn a_property_with_an_extra_value_is_a_format_error_not_a_resource_limit() {
    let error = single_index(
        br#"(kicad_sch
          (uuid root)
          (symbol (lib_id "Device:R") (at 0 0 0) (unit 1)
            (uuid 4c2f0d1e-77a8-4e0f-9a5b-0d5f6b1e2c33)
            (property "Reference" "R1" "unexpected")))"#,
    )
    .expect_err("three bare values without the private flag");
    assert_eq!(error.kind, SourceBundleErrorKind::Schematic);
}

#[test]
fn a_private_flag_does_not_make_room_for_a_fourth_value() {
    let error = single_index(
        br#"(kicad_sch
          (uuid root)
          (symbol (lib_id "Device:R") (at 0 0 0) (unit 1)
            (uuid 4c2f0d1e-77a8-4e0f-9a5b-0d5f6b1e2c34)
            (property private "Note" "text" "unexpected")))"#,
    )
    .expect_err("four bare values");
    assert_eq!(error.kind, SourceBundleErrorKind::Schematic);
}

#[test]
fn a_private_field_on_a_hierarchical_sheet_parses() {
    let root = br#"(kicad_sch
      (uuid root)
      (sheet (at 0 0) (size 10 10)
        (uuid 9d1c2b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d)
        (property "Sheetname" "Child" (at 0 0 0))
        (property "Sheetfile" "child.kicad_sch" (at 0 0 0))
        (property private "Note" "kept private" (at 0 0 0) (hide yes))))"#;
    let child = br#"(kicad_sch (uuid child))"#;
    index(&[
        ("root.kicad_sch", root.as_slice()),
        ("child.kicad_sch", child.as_slice()),
    ])
    .expect("a private sheet field is valid KiCad");
}

fn single_index(root: &[u8]) -> Result<SchematicBundleIndex, SourceBundleError> {
    index(&[("root.kicad_sch", root)])
}

fn index(schematics: &[(&str, &[u8])]) -> Result<SchematicBundleIndex, SourceBundleError> {
    let mut buffers = vec![b"{}".to_vec()];
    let mut sources = vec![descriptor(
        "demo.kicad_pro",
        SourceKind::Project,
        0,
        &buffers[0],
    )];
    for (slot, (path, bytes)) in schematics.iter().enumerate() {
        let slot = u32::try_from(slot + 1).expect("few test sources");
        sources.push(descriptor(path, SourceKind::Schematic, slot, bytes));
        buffers.push(bytes.to_vec());
    }
    let manifest = SourceBundleManifestA0 {
        project_path: Some("demo.kicad_pro".to_owned()),
        root_schematic_path: "root.kicad_sch".to_owned(),
        schema: "kicad_monkey.source_bundle_manifest.a0".to_owned(),
        sources,
        type_: "kicad_monkey.source_bundle_manifest".to_owned(),
        version: "a0".to_owned(),
    };
    let bundle = SourceBundle::from_manifest(manifest, buffers, SourceBundleLimits::default())
        .expect("test source bundle");
    SchematicBundleIndex::build(&bundle, SchematicBundleLimits::default())
}

fn descriptor(path: &str, kind: SourceKind, slot: u32, bytes: &[u8]) -> SourceBundleSource {
    SourceBundleSource {
        kind,
        path: path.to_owned(),
        slot: slot.into(),
        source_bytes: bytes.len().to_string().into(),
    }
}
