//! KiCad draws private fields and private library graphics only in the symbol editor.

#[path = "support/schematic_plot_vectors.rs"]
mod schematic_plot_vectors;

use prism_kicad_core::{
    PlotterTextCacheLimits, PlotterTextCacheResources, SchematicPlotContractLimits,
    SchematicPlotLimits, schematic_plot_document_json, schematic_plot_document_with_symbols,
};
use schematic_plot_vectors::{metric_font, vector_context, vector_drawing_settings};
use serde_json::Value;

/// KiCad draws private fields and private library graphics only in the symbol
/// editor (`SCH_PAINTER`). The same text without the flag is the control.
#[test]
fn private_fields_and_library_text_are_not_drawn() {
    let vectors: Value = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../tests/parity/schematic_plotter_a0_vectors.json"
    )))
    .expect("shared vectors");
    let vector = vectors["vectors"]
        .as_array()
        .expect("vectors")
        .iter()
        .find(|vector| vector["id"] == "placed-symbols-pins-fields-dnp-and-overplots")
        .expect("symbol vector");
    let base = vector["source"].as_str().expect("source");
    let context = vector_context(vector);
    let settings = vector_drawing_settings(vector);
    let fonts = [metric_font()];
    let resources = PlotterTextCacheResources {
        fonts: &fonts,
        limits: PlotterTextCacheLimits::default(),
    };
    let font = r#"(effects (font (face "KiCad Monkey Shaping Fixture") (size 1 1)))"#;
    let drawn = |flag: &str| {
        let source = base
            .replacen(
                "(symbol \"Demo:Part_1_1\"",
                &format!("(symbol \"Demo:Part_1_1\"\n        (text {flag}\"LIBNOTE\" (at 0 0 0) {font})"),
                1,
            )
            .replacen(
                "(pin \"1\" (uuid \"placed-pin-1\"))",
                &format!(
                    "(property {flag}\"KLC\" \"FIELDNOTE\" (at 10 14 0) {font})\n    (pin \"1\" (uuid \"placed-pin-1\"))"
                ),
                1,
            );
        let document = schematic_plot_document_with_symbols(
            &source,
            SchematicPlotLimits::default(),
            &context,
            settings,
            Some(&resources),
        )
        .expect("symbols plot");
        schematic_plot_document_json(&document, SchematicPlotContractLimits::default())
            .expect("plot json")
            .to_string()
    };
    let public = drawn("");
    assert!(
        public.contains("LIBNOTE") && public.contains("FIELDNOTE"),
        "control draws both"
    );
    let private = drawn("private ");
    assert!(
        !private.contains("LIBNOTE"),
        "private library text is not drawn"
    );
    assert!(
        !private.contains("FIELDNOTE"),
        "a private field is not drawn"
    );
    assert!(
        !private.contains("\"KLC\""),
        "nor is its name drawn as text"
    );
}
