//! Library graphics KiCad leaves out of a plot (private items) or selects (body style).

#[path = "support/schematic_plot_vectors.rs"]
mod schematic_plot_vectors;

use prism_kicad_core::{
    PlotterTextCacheLimits, PlotterTextCacheResources, SchematicPlotContractLimits,
    SchematicPlotLimits, schematic_plot_document_json, schematic_plot_document_with_symbols,
};
use schematic_plot_vectors::{metric_font, vector_context, vector_drawing_settings};
use serde_json::Value;

const FONT: &str = r#"(effects (font (face "KiCad Monkey Shaping Fixture") (size 1 1)))"#;

/// KiCad draws private fields and private library graphics only in the symbol
/// editor (`SCH_PAINTER`). The same text without the flag is the control.
#[test]
fn private_fields_and_library_text_are_not_drawn() {
    let drawn = |flag: &str| {
        plot(|base| {
            base.replacen(
                "(symbol \"Demo:Part_1_1\"",
                &format!("(symbol \"Demo:Part_1_1\"\n        (text {flag}\"LIBNOTE\" (at 0 0 0) {FONT})"),
                1,
            )
            .replacen(
                "(pin \"1\" (uuid \"placed-pin-1\"))",
                &format!(
                    "(property {flag}\"KLC\" \"FIELDNOTE\" (at 10 14 0) {FONT})\n    (pin \"1\" (uuid \"placed-pin-1\"))"
                ),
                1,
            )
        })
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

/// KiCad 10 writes `(body_style N)`, 8 and 9 `(convert N)`; the later one selects the
/// body the plotter draws (`SCH_IO_KICAD_SEXPR_PARSER::parseSchematicSymbol`).
#[test]
fn body_style_selects_the_drawn_body() {
    let drawn = |placed: &str| {
        plot(|base| {
            base.replacen(
                "(symbol \"Demo:Part_1_1\"",
                &format!("(symbol \"Demo:Part_1_2\" (text \"BODYTWO\" (at 0 0 0) {FONT}))\n      (symbol \"Demo:Part_1_1\""),
                1,
            )
            .replacen("(convert 1)", placed, 1)
        })
    };
    assert!(
        !drawn("(convert 1)").contains("BODYTWO"),
        "body 1 is the control"
    );
    assert!(drawn("(body_style 2)").contains("BODYTWO"));
    assert!(drawn("(convert 1) (body_style 2)").contains("BODYTWO"));
    assert!(!drawn("(body_style 2) (convert 1)").contains("BODYTWO"));
}

/// The shared symbol vector, edited, plotted to its JSON text.
fn plot(edit: impl Fn(&str) -> String) -> String {
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
    let source = edit(vector["source"].as_str().expect("source"));
    let fonts = [metric_font()];
    let resources = PlotterTextCacheResources {
        fonts: &fonts,
        limits: PlotterTextCacheLimits::default(),
    };
    let document = schematic_plot_document_with_symbols(
        &source,
        SchematicPlotLimits::default(),
        &vector_context(vector),
        vector_drawing_settings(vector),
        Some(&resources),
    )
    .expect("symbols plot");
    schematic_plot_document_json(&document, SchematicPlotContractLimits::default())
        .expect("plot json")
        .to_string()
}
