//! `stroke-text` and `drawing-sheet` (cli-spec.md §5.9): the core's NewStroke
//! font and default worksheet as one JSON document each.
//!
//! The request file validates against its contract before any work (exit 3,
//! `input-invalid`); the facades live in `prism-artwork`, over
//! `prism-kicad-core`. A facade's resource-limit failure is exit 4; a defect
//! is exit 1.

use crate::args::Args;
use crate::inputs;
use prism_artwork::{ArtworkError, ArtworkErrorKind};
use prism_bundle::{Category, Failure, LimitName, Outcome, schema};
use prism_kicad_contracts::generated::prism_drawing_sheet_request_a0::DrawingSheetRequestA0;
use prism_kicad_contracts::generated::prism_stroke_text_request_a0::StrokeTextRequestA0;
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::path::Path;

/// The `stroke-text --request` schema id.
const STROKE_REQUEST: &str = "prism.stroke_text.request.a0";
/// The `drawing-sheet --request` schema id.
const DRAWING_SHEET_REQUEST: &str = "prism.drawing_sheet.request.a0";

/// `stroke-text --request` or `--metrics`.
pub fn stroke_text(args: &Args) -> Outcome<(Value, u8)> {
    let document = if args.metrics {
        document(prism_artwork::stroke_font_metrics())?
    } else {
        let request: StrokeTextRequestA0 = read_request(args, STROKE_REQUEST)?;
        document(prism_artwork::render_stroke_text(&request).map_err(failure)?)?
    };
    Ok((document, 0))
}

/// `drawing-sheet --request`.
pub fn drawing_sheet(args: &Args) -> Outcome<(Value, u8)> {
    let request: DrawingSheetRequestA0 = read_request(args, DRAWING_SHEET_REQUEST)?;
    let result = prism_artwork::render_drawing_sheet(&request).map_err(failure)?;
    Ok((document(result)?, 0))
}

/// Read, bound, validate and decode `--request`.
fn read_request<T: DeserializeOwned>(args: &Args, schema_id: &str) -> Outcome<T> {
    let path = Path::new(args.option("request").unwrap_or_default());
    let bytes = inputs::read(path, "request", LimitName::MaxMemberBytes, &args.limits)?;
    prism_bundle::reader::json_bounds(&bytes, &args.limits, false, "--request").map_err(
        |mut failure| {
            failure.argument = Some("request");
            failure.finding.location = None;
            failure
        },
    )?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|error| {
        Failure::input("input-invalid", format!("--request is not JSON: {error}"))
            .argument("request")
    })?;
    schema::validate(schema_id, &value).map_err(|violation| {
        Failure::input(
            "input-invalid",
            format!("--request breaks {schema_id}: {}", violation.message),
        )
        .argument("request")
    })?;
    serde_json::from_value(value).map_err(|error| {
        Failure::input(
            "input-invalid",
            format!("--request does not fit its contract: {error}"),
        )
        .argument("request")
    })
}

fn document<T: serde::Serialize>(value: T) -> Outcome<Value> {
    serde_json::to_value(value)
        .map_err(|error| Failure::internal(format!("the result does not serialize: {error}")))
}

fn failure(error: ArtworkError) -> Failure {
    match error.kind {
        ArtworkErrorKind::InvalidInput => {
            Failure::input("input-invalid", error.message).argument("request")
        }
        ArtworkErrorKind::ResourceLimit => {
            Failure::new(Category::ResourceLimit, "limit-exceeded", error.message)
        }
        ArtworkErrorKind::Internal => Failure::internal(error.message),
    }
}
