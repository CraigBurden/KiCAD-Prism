//! The height, hole and unknown-height tables.

use std::fmt::Write as _;

use prism_artwork::artwork::geometry::{Bounds, Point};

use super::board::{Board, HoleRow, Part};
use super::draw::{Face, boxed, text};
use super::layout::{DRAWING_BOTTOM, FRAME, Rect};
use super::table::{self, Column};
use crate::html::millimetres;
use crate::theme::Palette;

pub(super) fn sheet_one_tables(
    svg: &mut String,
    rect: Rect,
    board: &Board,
    limit: f64,
    palette: &Palette,
) {
    let known = height_rows(board, limit);
    let height = table::draw(
        svg,
        rect,
        "HEIGHT TABLE — TALLEST FIRST",
        &height_columns(rect.w),
        &known,
        2.0,
        palette,
    );
    let below = Rect::new(rect.x, rect.y + height + 5.0, rect.w, rect.h - height - 5.0);
    if below.h > 20.0 {
        hole_blocks(svg, below, board, palette);
    }
}

// ------------------------------------------------------------------- frame

pub fn row_counts(board: &Board, limit: f64) -> (usize, usize) {
    (height_rows(board, limit).len(), hole_rows(board).0.len())
}

fn height_columns(width: f64) -> Vec<Column> {
    let scale = width / 170.0;
    vec![
        Column {
            title: "REF",
            width: 26.0 * scale,
            numeric: false,
        },
        Column {
            title: "SIDE",
            width: 16.0 * scale,
            numeric: false,
        },
        Column {
            title: "ABOVE",
            width: 26.0 * scale,
            numeric: true,
        },
        Column {
            title: "BELOW",
            width: 26.0 * scale,
            numeric: true,
        },
        Column {
            title: "BODY X×Y",
            width: 44.0 * scale,
            numeric: true,
        },
        Column {
            title: "OVER",
            width: 16.0 * scale,
            numeric: false,
        },
    ]
}

fn hole_columns(width: f64) -> Vec<Column> {
    let scale = width / 111.0;
    vec![
        Column {
            title: "ID",
            width: 10.0 * scale,
            numeric: false,
        },
        Column {
            title: "X",
            width: 18.0 * scale,
            numeric: true,
        },
        Column {
            title: "Y",
            width: 18.0 * scale,
            numeric: true,
        },
        Column {
            title: "DRILL",
            width: 18.0 * scale,
            numeric: true,
        },
        Column {
            title: "PLT",
            width: 9.0 * scale,
            numeric: false,
        },
        Column {
            title: "USED BY",
            width: 38.0 * scale,
            numeric: false,
        },
    ]
}

pub(super) fn height_rows(board: &Board, limit: f64) -> Vec<Vec<String>> {
    let mut parts: Vec<&Part> = board
        .parts
        .iter()
        .filter(|part| part.height.is_some())
        .collect();
    parts.sort_by(|left, right| {
        let left_height = left
            .height
            .map_or(0.0, |height| height.above.max(height.below));
        let right_height = right
            .height
            .map_or(0.0, |height| height.above.max(height.below));
        right_height
            .total_cmp(&left_height)
            .then(left.reference.cmp(&right.reference))
    });
    parts
        .into_iter()
        .map(|part| {
            let height = part.height.unwrap_or(super::board::Height {
                above: 0.0,
                below: 0.0,
            });
            let extent = if part.body_bounds.is_empty() {
                part.pad_bounds.unwrap_or(Bounds::empty())
            } else {
                part.body_bounds
            };
            vec![
                part.reference.clone(),
                part.side.short().to_owned(),
                millimetres(height.above),
                millimetres(height.below),
                format!(
                    "{} × {}",
                    millimetres(extent.width()),
                    millimetres(extent.height())
                ),
                if height.above > limit || height.below > limit {
                    "OVER".to_owned()
                } else {
                    String::new()
                },
            ]
        })
        .collect()
}

fn hole_rows(board: &Board) -> (Vec<Vec<String>>, HoleTableNote) {
    let mut rows: Vec<&HoleRow> = board.holes.iter().collect();
    let vias = rows.iter().filter(|hole| hole.via).count();
    // Keep the table inside two blocks of the A3 sheet: vias are drawn on the
    // top view but a mechanical hole table does not need 651 of them.
    if rows.len() > 108 {
        rows.retain(|hole| !hole.via);
    }
    let omitted = vias - rows.iter().filter(|hole| hole.via).count();
    let candidates = rows.len();
    let rows = rows
        .into_iter()
        .take(112)
        .enumerate()
        .map(|(index, hole)| {
            vec![
                format!("H{:02}", index + 1),
                millimetres(hole.at.x - board.origin.at.x),
                millimetres(board.origin.at.y - hole.at.y),
                hole.diameter(),
                if hole.plated { "P" } else { "NP" }.to_owned(),
                hole.used_by.clone(),
            ]
        })
        .collect();
    (
        rows,
        HoleTableNote {
            omitted_vias: omitted,
            candidates,
        },
    )
}

/// What the hole table title must say about the rows it leaves out.
struct HoleTableNote {
    omitted_vias: usize,
    candidates: usize,
}

fn hole_blocks(svg: &mut String, rect: Rect, board: &Board, palette: &Palette) {
    let (rows, note) = hole_rows(board);
    let mut title = String::from("HOLE TABLE");
    if note.omitted_vias > 0 {
        let _ = write!(title, " — {} VIAS DRAWN, NOT LISTED", note.omitted_vias);
    }
    if rows.len() < note.candidates {
        let _ = write!(title, " · {} OF {} LISTED", rows.len(), note.candidates);
    }
    let half = rows.len().div_ceil(2);
    let blocks = if rows.len() <= table::row_capacity(rect, true) {
        1
    } else {
        2
    };
    let block_width = if blocks == 1 {
        rect.w
    } else {
        (rect.w - 4.0) / 2.0
    };
    let columns = hole_columns(block_width);
    let capacity = table::row_capacity(rect, true);
    for block in 0..blocks {
        let x = rect.x + block as f64 * (block_width + 4.0);
        let block_rect = Rect::new(x, rect.y, block_width, rect.h);
        let slice = if blocks == 1 {
            &rows[..]
        } else if block == 0 {
            &rows[..half.min(rows.len())]
        } else {
            &rows[half.min(rows.len())..]
        };
        let title = if block == 0 {
            title.clone()
        } else {
            "HOLE TABLE (CONTINUED)".to_owned()
        };
        let _ = capacity;
        table::draw(svg, block_rect, &title, &columns, slice, 2.0, palette);
    }
}

fn unknown_block(svg: &mut String, rect: Rect, board: &Board, known: usize, palette: &Palette) {
    let unknown = board.unknown_heights();
    if unknown.is_empty() || known > 44 {
        return;
    }
    let top = rect.y + 12.2 + known as f64 * 3.9 + 6.0;
    let height = rect.bottom() - top;
    if height < 20.0 {
        return;
    }
    let block = Rect::new(rect.x, top, rect.w, height);
    let noun = if unknown.len() == 1 { "PART" } else { "PARTS" };
    boxed(
        svg,
        block,
        &format!("NO HEIGHT — {} {noun}", unknown.len()),
        palette,
    );
    let columns = ((block.w - 4.0) / 48.0).floor().max(1.0) as usize;
    let per_column = ((block.h - 10.0) / 3.4).floor().max(1.0) as usize;
    let capacity = columns * per_column;
    let width = (block.w - 4.0) / columns as f64;
    for (index, reference) in unknown.iter().take(capacity).enumerate() {
        let column = index / per_column;
        let row = index % per_column;
        let x = block.x + 2.0 + column as f64 * width;
        let y = block.y + 11.0 + row as f64 * 3.4;
        text(
            svg,
            Point { x, y },
            2.0,
            palette.ink,
            Face::Sans,
            "start",
            reference,
        );
    }
    if unknown.len() > capacity {
        text(
            svg,
            Point {
                x: block.x + 2.0,
                y: block.bottom() - 2.0,
            },
            1.9,
            palette.muted,
            Face::SansMedium,
            "start",
            &format!("{} more not listed", unknown.len() - capacity),
        );
    }
}

/// Sheet 2's two tables: heights on the left, holes in two blocks on the right.
pub(super) fn sheet_two_tables(svg: &mut String, board: &Board, limit: f64, palette: &Palette) {
    let height = Rect::new(FRAME, FRAME, 170.0, DRAWING_BOTTOM - FRAME);
    let known = height_rows(board, limit);
    table::draw(
        svg,
        height,
        "HEIGHT TABLE — TALLEST FIRST",
        &height_columns(170.0),
        &known,
        2.2,
        palette,
    );
    unknown_block(svg, height, board, known.len(), palette);
    let holes = Rect::new(184.0, FRAME, 226.0, DRAWING_BOTTOM - FRAME);
    hole_blocks(svg, holes, board, palette);
}
