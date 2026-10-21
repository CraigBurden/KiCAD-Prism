//! Contract goldens for `prism-artwork` (chunk C, ADR amendment C3 §3.4).
//!
//! Each request is the checked-in `tests/data/*_request.json`; the render is
//! compared with `tests/data/*_result.json`, which was captured from
//! `prism-kicad stroke-text` / `drawing-sheet` on this commit and is also
//! checked against Python kicad_monkey by `parity/stroke/compare_stroke.py`.

use prism_artwork::drawing_sheet;
use prism_artwork::stroke_text;
use prism_kicad_contracts::generated::prism_drawing_sheet_request_a0::DrawingSheetRequestA0;
use prism_kicad_contracts::generated::prism_stroke_text_request_a0::StrokeTextRequestA0;
use serde_json::Value;

fn data(name: &str) -> String {
    std::fs::read_to_string(format!("{}/tests/data/{name}", env!("CARGO_MANIFEST_DIR")))
        .unwrap_or_else(|error| panic!("tests/data/{name}: {error}"))
}

fn expected(name: &str) -> Value {
    serde_json::from_str(&data(name)).unwrap_or_else(|error| panic!("tests/data/{name}: {error}"))
}

#[test]
fn stroke_request_parses_and_matches_its_golden() {
    let request: StrokeTextRequestA0 =
        serde_json::from_str(&data("stroke_request.json")).expect("stroke request decodes");
    let rendered = serde_json::to_value(stroke_text::render(&request).expect("stroke renders"))
        .expect("stroke result serializes");
    assert_eq!(rendered, expected("stroke_result.json"));
}

#[test]
fn drawing_sheet_request_parses_and_matches_its_golden() {
    let request: DrawingSheetRequestA0 = serde_json::from_str(&data("drawing_sheet_request.json"))
        .expect("drawing sheet request decodes");
    let rendered =
        serde_json::to_value(drawing_sheet::render(&request).expect("drawing sheet renders"))
            .expect("drawing sheet result serializes");
    assert_eq!(rendered, expected("drawing_sheet_result.json"));
}

#[test]
fn stroke_request_rejects_an_unknown_field() {
    let request = data("stroke_request.json").replace("\"runs\"", "\"unknown\": true,\n  \"runs\"");
    assert!(serde_json::from_str::<StrokeTextRequestA0>(&request).is_err());
}

#[test]
fn drawing_sheet_rejects_a_key_that_is_not_a_comment_number() {
    let mut request: DrawingSheetRequestA0 =
        serde_json::from_str(&data("drawing_sheet_request.json")).expect("request decodes");
    request
        .title_block
        .comments
        .0
        .insert("first".to_owned(), "value".to_owned());
    let error = drawing_sheet::render(&request).expect_err("a non-numeric key is refused");
    assert_eq!(error.kind, prism_artwork::ArtworkErrorKind::InvalidInput);
}

#[test]
fn stroke_font_metrics_cover_every_glyph() {
    let metrics = stroke_text::metrics();
    assert_eq!(metrics.schema, stroke_text::METRICS_SCHEMA);
    assert_eq!(metrics.space_width, 16.0 / 21.0);
    assert_eq!(metrics.super_sub_size_multiplier, 0.8);
    // NewStroke's printable range: U+0020 to U+2BFF inclusive.
    assert_eq!(metrics.advances.0.len(), 0x2C00 - 0x20);
    assert_eq!(metrics.advances.0.get("32"), Some(&(16.0 / 21.0)));
    assert_eq!(metrics.advances.0.get("8486"), Some(&(24.0 / 21.0)));
}

/// The two checked-in artwork configs validate against the generated
/// `prism.artwork.config.a0` schema, not just their generated Rust types.
#[test]
fn artwork_configs_validate_against_the_generated_schema() {
    for name in ["assembly.json", "testpoints.json"] {
        let path = format!("{}/configs/{name}", env!("CARGO_MANIFEST_DIR"));
        let text = std::fs::read_to_string(&path).unwrap_or_else(|error| panic!("{path}: {error}"));
        let value: Value =
            serde_json::from_str(&text).unwrap_or_else(|error| panic!("{path}: {error}"));
        prism_bundle::schema::validate("prism.artwork.config.a0", &value)
            .unwrap_or_else(|violation| panic!("{path}: {}", violation.message));
        let config: prism_kicad_contracts::generated::prism_artwork_config_a0::ArtworkConfigA0 =
            serde_json::from_value(value).unwrap_or_else(|error| panic!("{path}: {error}"));
        assert_eq!(config.schema, "prism.artwork.config.a0");
    }
}
