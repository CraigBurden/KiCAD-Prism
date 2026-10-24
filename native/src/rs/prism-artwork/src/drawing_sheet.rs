//! `prism-kicad drawing-sheet` over the core's default worksheet
//! (ADR amendment C3 §3.4).
//!
//! The operations are exactly Python kicad_monkey's
//! `drawing_sheet_to_ops(load_default_drawing_sheet(), …)`: the default
//! worksheet's elements in file order with their repeats expanded, in KiCad's
//! nanometre frame. The page background a schematic sheet header starts with
//! is not part of the drawing sheet, so it is not emitted here.

use crate::ArtworkError;
use prism_kicad_contracts::generated::prism_cli_drawing_sheet_result_a0::{
    CliDrawingSheetFill, CliDrawingSheetHAlign, CliDrawingSheetOp, CliDrawingSheetPoly,
    CliDrawingSheetRect, CliDrawingSheetResultA0, CliDrawingSheetText, CliDrawingSheetVAlign,
    CliPointNm, Degrees, Nanometres, NonNegativeNanometres,
};
use prism_kicad_contracts::generated::prism_drawing_sheet_request_a0::DrawingSheetRequestA0;
use prism_kicad_core::{
    DrawingSheetPage, PlotterFill, PlotterOperation, PlotterTextHAlign, PlotterTextVAlign,
    SchematicPlotLimits, SchematicPlotOperation, SchematicTitleBlock,
    default_drawing_sheet_operations,
};
use std::collections::BTreeMap;

/// The stdout schema id of `drawing-sheet`.
pub const RESULT_SCHEMA: &str = "prism.cli.drawing_sheet_result.a0";

/// Draw the default worksheet for `request`'s page and title block.
pub fn render(request: &DrawingSheetRequestA0) -> Result<CliDrawingSheetResultA0, ArtworkError> {
    let page = DrawingSheetPage {
        paper_name: request.paper_name.clone(),
        width_nm: length(request.paper_width_nm.0, "paper_width_nm")?,
        height_nm: length(request.paper_height_nm.0, "paper_height_nm")?,
        title_block: SchematicTitleBlock {
            title: request.title_block.title.clone(),
            date: request.title_block.date.clone(),
            revision: request.title_block.rev.clone(),
            company: request.title_block.company.clone(),
            comments: comments(&request.title_block.comments.0)?,
        },
        sheet_index: usize::try_from(request.sheet_index.get())
            .map_err(|_| ArtworkError::internal("sheet_index is out of range"))?,
        sheet_count: usize::try_from(request.sheet_count.get())
            .map_err(|_| ArtworkError::internal("sheet_count is out of range"))?,
        file_name: request.file_name.clone(),
        sheet_path: request.sheet_path.clone(),
        sheet_name: request.sheet_name.clone(),
        kicad_version: request.kicad_version.clone(),
    };
    let operations = default_drawing_sheet_operations(&page, SchematicPlotLimits::default())
        .map_err(|error| {
            ArtworkError::internal(format!("the default worksheet failed: {error}"))
        })?;
    let ops = operations
        .into_iter()
        .map(operation)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(CliDrawingSheetResultA0 {
        schema: RESULT_SCHEMA.to_owned(),
        ops,
    })
}

/// The title block's comments by number. A key that is not a decimal comment
/// number is a request error: the contract spells the keys `"1"` to `"4"`.
fn comments(comments: &BTreeMap<String, String>) -> Result<BTreeMap<i64, String>, ArtworkError> {
    comments
        .iter()
        .map(|(key, value)| {
            key.parse::<i64>()
                .map(|index| (index, value.clone()))
                .map_err(|_| {
                    ArtworkError::invalid(format!(
                        "title_block.comments has the key {key:?}, which is not a comment number"
                    ))
                })
        })
        .collect()
}

fn length(value: u64, field: &str) -> Result<i64, ArtworkError> {
    i64::try_from(value)
        .map_err(|_| ArtworkError::invalid(format!("{field} is outside the nanometre range")))
}

fn width(value: i64, field: &str) -> Result<NonNegativeNanometres, ArtworkError> {
    u64::try_from(value)
        .map(NonNegativeNanometres)
        .map_err(|_| ArtworkError::internal(format!("{field} is negative")))
}

fn operation(operation: SchematicPlotOperation) -> Result<CliDrawingSheetOp, ArtworkError> {
    match operation {
        SchematicPlotOperation::Plotter(PlotterOperation::Rect(rect)) => Ok(CliDrawingSheetRect {
            kind: "rect".to_owned(),
            x1_nm: Nanometres(rect.x1),
            y1_nm: Nanometres(rect.y1),
            x2_nm: Nanometres(rect.x2),
            y2_nm: Nanometres(rect.y2),
            corner_radius_nm: width(rect.corner_radius_nm, "corner_radius_nm")?,
            fill: fill(rect.fill)?,
            width_nm: width(rect.width_nm, "width_nm")?,
            stroke_color: colour(rect.stroke_color)?,
        }
        .into()),
        SchematicPlotOperation::Plotter(PlotterOperation::PlotPoly(poly)) => {
            Ok(CliDrawingSheetPoly {
                kind: "poly".to_owned(),
                points: poly
                    .points
                    .iter()
                    .map(|point| CliPointNm {
                        x_nm: Nanometres(point[0]),
                        y_nm: Nanometres(point[1]),
                    })
                    .collect(),
                fill: fill(poly.fill)?,
                width_nm: width(poly.width_nm, "width_nm")?,
                stroke_color: colour(poly.stroke_color)?,
            }
            .into())
        }
        SchematicPlotOperation::Plotter(PlotterOperation::Text(text)) => Ok(CliDrawingSheetText {
            kind: "text".to_owned(),
            x_nm: Nanometres(text.x),
            y_nm: Nanometres(text.y),
            text: text.text,
            color: text.color,
            orient_deg: Degrees(text.orient_deg),
            size_x_nm: width(text.size_x_nm, "size_x_nm")?,
            size_y_nm: width(text.size_y_nm, "size_y_nm")?,
            pen_width_nm: width(text.pen_width_nm, "pen_width_nm")?,
            h_align: match text.h_align {
                PlotterTextHAlign::Left => CliDrawingSheetHAlign::GrTextHAlignLeft,
                PlotterTextHAlign::Center => CliDrawingSheetHAlign::GrTextHAlignCenter,
                PlotterTextHAlign::Right => CliDrawingSheetHAlign::GrTextHAlignRight,
            },
            v_align: match text.v_align {
                PlotterTextVAlign::Top => CliDrawingSheetVAlign::GrTextVAlignTop,
                PlotterTextVAlign::Center => CliDrawingSheetVAlign::GrTextVAlignCenter,
                PlotterTextVAlign::Bottom => CliDrawingSheetVAlign::GrTextVAlignBottom,
            },
            italic: text.italic,
            bold: text.bold,
            multiline: text.multiline,
            font_face: text.font_face,
        }
        .into()),
        _ => Err(ArtworkError::internal(
            "the default worksheet emitted an operation the contract has no kind for",
        )),
    }
}

fn fill(fill: PlotterFill) -> Result<CliDrawingSheetFill, ArtworkError> {
    match fill {
        PlotterFill::NoFill => Ok(CliDrawingSheetFill::NoFill),
        PlotterFill::FilledShape => Ok(CliDrawingSheetFill::FilledShape),
        PlotterFill::FilledWithBackgroundBodyColor => {
            Ok(CliDrawingSheetFill::FilledWithBgBodycolor)
        }
        _ => Err(ArtworkError::internal(
            "the default worksheet emitted a fill the contract has no value for",
        )),
    }
}

fn colour(colour: Option<String>) -> Result<String, ArtworkError> {
    colour.ok_or_else(|| {
        ArtworkError::internal("the default worksheet emitted an operation without a stroke colour")
    })
}
