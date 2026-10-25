//! The shared schematic plot vectors' context, drawing settings and metric font.

use prism_kicad_contracts::generated::shaping_record::ShapingRecordA0;
use prism_kicad_core::{
    PlotterTextFont, SchematicDrawingSettings, SchematicPlotContext, SchematicPlotVariables,
};
use serde_json::Value;

pub(crate) fn vector_context(vector: &Value) -> SchematicPlotContext {
    let variables = vector
        .get("project_variables")
        .and_then(Value::as_object)
        .into_iter()
        .flat_map(|values| values.iter())
        .map(|(name, value)| {
            (
                name.clone(),
                value.as_str().expect("variable string").to_owned(),
            )
        });
    SchematicPlotContext {
        source_path: vector
            .get("source_path")
            .and_then(Value::as_str)
            .map(str::to_owned),
        document_id: vector
            .get("document_id")
            .and_then(Value::as_str)
            .map(str::to_owned),
        sheet_index: vector
            .get("sheet_index")
            .and_then(Value::as_u64)
            .unwrap_or(1) as usize,
        sheet_count: vector
            .get("sheet_count")
            .and_then(Value::as_u64)
            .unwrap_or(1) as usize,
        sheet_path: vector
            .get("sheet_path")
            .and_then(Value::as_str)
            .unwrap_or("/")
            .to_owned(),
        sheet_instance_path: vector
            .get("sheet_instance_path")
            .and_then(Value::as_str)
            .unwrap_or("/")
            .to_owned(),
        sheet_name: vector
            .get("sheet_name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_owned(),
        project_variables: SchematicPlotVariables::from_entries(variables),
        worksheet_source: vector
            .get("worksheet_source")
            .and_then(Value::as_str)
            .map(|value| value.as_bytes().to_vec()),
    }
}

pub(crate) fn vector_drawing_settings(vector: &Value) -> SchematicDrawingSettings {
    let values = vector.get("drawing_settings");
    SchematicDrawingSettings {
        text_offset_ratio: values
            .and_then(|value| value.get("text_offset_ratio"))
            .and_then(Value::as_f64)
            .unwrap_or(0.15),
        default_line_width_nm: values
            .and_then(|value| value.get("default_line_thickness"))
            .and_then(Value::as_f64)
            .map(|mils| (mils * 25_400.0).round_ties_even() as i64)
            .unwrap_or(152_400),
    }
}

pub(crate) const METRIC_FONT_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../tests/parity/fonts/shaping-variable-fixture.ttf"
));

pub(crate) fn metric_font() -> PlotterTextFont<'static> {
    let vectors: Value = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../tests/parity/font_shaping_a0_vectors.json"
    )))
    .expect("shaping vectors");
    let record: ShapingRecordA0 = vectors["records"]
        .as_array()
        .expect("shaping records")
        .iter()
        .find(|record| record["case_id"] == "fixture_default_variation_axis")
        .cloned()
        .map(serde_json::from_value)
        .expect("metric shaping case")
        .expect("metric shaping record");
    PlotterTextFont {
        face: "KiCad Monkey Shaping Fixture",
        bold: false,
        italic: false,
        font_bytes: METRIC_FONT_BYTES,
        shaping: record.input,
        fake_bold: false,
        fake_italic: false,
    }
}
