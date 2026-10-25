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
