//! `prism-kicad stroke-text` over the core's NewStroke font
//! (ADR amendment C3 §3.4).
//!
//! A run renders exactly as Python kicad_monkey's
//! `render_text_polylines(value, x, y, size, size, h_align, v_align)` does:
//! the same alignment width (a missing glyph adds nothing to it), the same
//! vertical anchor, and `?` drawn in place of a missing glyph.

use crate::{ArtworkError, ArtworkErrorKind};
use prism_kicad_contracts::generated::prism_cli_stroke_font_metrics_a0::{
    CliStrokeFontMetricsA0, RecordFloat64,
};
use prism_kicad_contracts::generated::prism_cli_stroke_text_result_a0::{
    CliMmPoint, CliMmPolyline, CliStrokeTextResultA0, CliStrokeTextRun, Count,
};
use prism_kicad_contracts::generated::prism_stroke_text_request_a0::{
    StrokeTextHAlign, StrokeTextRequestA0, StrokeTextRun, StrokeTextVAlign,
};
use prism_kicad_core::newstroke::{
    NEWSTROKE_SUPER_SUB_SIZE_MULTIPLIER, NewstrokeError, NewstrokeErrorKind, NewstrokeLimits,
    NewstrokeRequest, newstroke_advance, newstroke_codepoints, newstroke_has_glyph,
    realize_newstroke_a0,
};
use prism_kicad_core::{TextHorizontalAlignment, TextVerticalAlignment};
use std::collections::{BTreeMap, BTreeSet};

/// The stdout schema id of `stroke-text --request`.
pub const RESULT_SCHEMA: &str = "prism.cli.stroke_text_result.a0";

/// The stdout schema id of `stroke-text --metrics`.
pub const METRICS_SCHEMA: &str = "prism.cli.stroke_font_metrics.a0";

/// Render every run of `request`, in its order.
pub fn render(request: &StrokeTextRequestA0) -> Result<CliStrokeTextResultA0, ArtworkError> {
    let runs = request
        .runs
        .iter()
        .map(render_run)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(CliStrokeTextResultA0 {
        schema: RESULT_SCHEMA.to_owned(),
        runs,
    })
}

fn render_run(run: &StrokeTextRun) -> Result<CliStrokeTextRun, ArtworkError> {
    let output = realize_newstroke_a0(
        NewstrokeRequest {
            text: &run.text,
            position_x_mm: run.x_mm,
            position_y_mm: run.y_mm,
            size_x_mm: run.size_mm,
            size_y_mm: run.size_mm,
            angle_degrees: 0.0,
            horizontal_alignment: horizontal(run.h_align),
            vertical_alignment: vertical(run.v_align),
            mirrored: false,
            italic: false,
            bold: false,
            stroke_width_mm: None,
        },
        NewstrokeLimits::default(),
    )
    .map_err(core_error)?;
    let polylines_mm = output
        .polylines
        .iter()
        .map(|polyline| {
            CliMmPolyline(
                polyline
                    .points
                    .iter()
                    .map(|point| CliMmPoint([point.x_mm, point.y_mm]))
                    .collect(),
            )
        })
        .collect();
    Ok(CliStrokeTextRun {
        polylines_mm,
        // The contract's advance is Python's `_calculate_text_width × size`:
        // the alignment width, which leaves a missing glyph's `?` out.
        advance_mm: output.alignment_width_mm,
        missing_codepoints: missing_codepoints(&run.text),
    })
}

/// The code points the font has no glyph for, ascending, leaving out the
/// layout controls the reporter skips (`\n`, `\r`, `\t`).
fn missing_codepoints(text: &str) -> Vec<Count> {
    let mut missing = BTreeSet::new();
    for character in text.chars() {
        if !matches!(character, '\n' | '\r' | '\t') && !newstroke_has_glyph(character) {
            missing.insert(u64::from(character as u32));
        }
    }
    missing.into_iter().map(Count).collect()
}

/// The NewStroke advance table, in the renderer's normalized units.
pub fn metrics() -> CliStrokeFontMetricsA0 {
    let advances = newstroke_codepoints()
        .filter_map(|character| {
            newstroke_advance(character).map(|width| (u32::from(character).to_string(), width))
        })
        .collect::<BTreeMap<_, _>>();
    CliStrokeFontMetricsA0 {
        schema: METRICS_SCHEMA.to_owned(),
        space_width: newstroke_advance(' ').unwrap_or(0.0),
        super_sub_size_multiplier: NEWSTROKE_SUPER_SUB_SIZE_MULTIPLIER,
        advances: RecordFloat64(advances),
    }
}

fn horizontal(alignment: StrokeTextHAlign) -> TextHorizontalAlignment {
    match alignment {
        StrokeTextHAlign::Left => TextHorizontalAlignment::Left,
        StrokeTextHAlign::Center => TextHorizontalAlignment::Center,
        StrokeTextHAlign::Right => TextHorizontalAlignment::Right,
    }
}

fn vertical(alignment: StrokeTextVAlign) -> TextVerticalAlignment {
    match alignment {
        StrokeTextVAlign::Top => TextVerticalAlignment::Top,
        StrokeTextVAlign::Center => TextVerticalAlignment::Center,
        StrokeTextVAlign::Bottom => TextVerticalAlignment::Bottom,
    }
}

fn core_error(error: NewstrokeError) -> ArtworkError {
    let kind = match error.kind {
        NewstrokeErrorKind::ResourceLimit => ArtworkErrorKind::ResourceLimit,
        NewstrokeErrorKind::InvalidInput => ArtworkErrorKind::InvalidInput,
    };
    ArtworkError {
        kind,
        message: error.message.to_owned(),
    }
}
