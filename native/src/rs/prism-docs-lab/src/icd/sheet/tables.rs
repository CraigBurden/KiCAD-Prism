//! The tables and the locator: identification, pinout, continuation sheets.

use super::*;
use crate::theme::Palette;
use prism_artwork::artwork::geometry::{Bounds, Point};
use prism_artwork::artwork::svg::{number, ring_path};

use super::super::board::PinRow;

/// Space between a value cell's divider and its text, the same as the label's
/// inset from the table edge.
const CELL_INSET: f64 = 1.5;

// -------------------------------------------------------- identification

pub(super) fn identification(svg: &mut String, context: &SheetContext<'_>) {
    let palette = context.theme.palette();
    let rows = &context.connector.fields;
    let x = 14.0;
    let mut y = 144.0;
    let width = 256.0;
    let label_width = 40.0;
    table_header(svg, x, y, width, "IDENTIFICATION", 4.5, &palette);
    y += 4.5;
    for (label, value) in rows {
        let _ = writeln!(
            svg,
            "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"0.12\"/>",
            number(x),
            number(y + 3.9),
            number(x + width),
            number(y + 3.9),
            palette.rule
        );
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\">{}</text>",
            number(x + 1.5),
            number(y + 2.7),
            SANS,
            number(SMALL),
            palette.muted,
            escape(label)
        );
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
data-field=\"{}\">{}</text>",
            number(x + label_width + CELL_INSET),
            number(y + 2.7),
            SANS,
            number(BODY),
            palette.ink,
            escape(label),
            escape(&fit(value, width - label_width - CELL_INSET - 1.5, BODY))
        );
        y += 3.9;
    }
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"144\" width=\"{}\" height=\"{}\" fill=\"none\" stroke=\"{}\" \
stroke-width=\"0.2\"/>",
        number(x),
        number(width),
        number(y - 144.0),
        palette.rule
    );
    let _ = writeln!(
        svg,
        "<line x1=\"{}\" y1=\"144\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"0.12\"/>",
        number(x + label_width),
        number(x + label_width),
        number(y),
        palette.rule
    );
}

// ---------------------------------------------------------------- locator

pub(super) fn locator(svg: &mut String, context: &SheetContext<'_>) {
    let palette = context.theme.palette();
    let x = 276.0;
    let y = 144.0;
    let width = 134.0;
    let height = 54.0;
    table_header(svg, x, y, width, "BOARD LOCATOR", 4.5, &palette);
    let area = Bounds {
        min_x: x + 3.0,
        min_y: y + 7.0,
        max_x: x + width - 3.0,
        max_y: y + height - 2.0,
    };
    let board = &context.icd.board;
    let scale = (area.width() / board.bounds.width().max(0.001))
        .min(area.height() / board.bounds.height().max(0.001));
    let center_x = (area.min_x + area.max_x) / 2.0;
    let center_y = (area.min_y + area.max_y) / 2.0;
    let to_sheet = |point: Point| Point {
        x: center_x + (point.x - (board.bounds.min_x + board.bounds.max_x) / 2.0) * scale,
        y: center_y + (point.y - (board.bounds.min_y + board.bounds.max_y) / 2.0) * scale,
    };
    let clip = format!(
        "clip-locator-{}-{}",
        context.connector.reference, context.page
    );
    let _ = writeln!(
        svg,
        "<clipPath id=\"{}\"><rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\"/></clipPath>",
        escape(&clip),
        number(area.min_x),
        number(area.min_y),
        number(area.width()),
        number(area.height())
    );
    let _ = writeln!(svg, "<g clip-path=\"url(#{})\">", escape(&clip));
    let outline: Vec<Point> = board.outline.iter().map(|point| to_sheet(*point)).collect();
    let _ = writeln!(
        svg,
        "<path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"0.3\"/>",
        ring_path(&outline),
        palette.ink
    );
    for cutout in &board.cutouts {
        let ring: Vec<Point> = cutout.iter().map(|point| to_sheet(*point)).collect();
        let _ = writeln!(
            svg,
            "<path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"0.2\"/>",
            ring_path(&ring),
            palette.rule
        );
    }
    locator_bodies(svg, context, &to_sheet);
    locator_labels(svg, context, &to_sheet);
    svg.push_str("</g>\n");
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"none\" stroke=\"{}\" \
stroke-width=\"0.2\"/>",
        number(x),
        number(y),
        number(width),
        number(height),
        palette.rule
    );
}

/// Every connector's courtyard: this one filled, the rest grey.
fn locator_bodies(
    svg: &mut String,
    context: &SheetContext<'_>,
    to_sheet: &impl Fn(Point) -> Point,
) {
    let palette = context.theme.palette();
    for other in &context.icd.connectors {
        let ring: Vec<Point> = other.body.iter().map(|point| to_sheet(*point)).collect();
        if ring.len() < 3 {
            continue;
        }
        if other.reference == context.connector.reference {
            let _ = writeln!(
                svg,
                "<path d=\"{}\" fill=\"{}\" fill-opacity=\"0.88\" stroke=\"{}\" \
stroke-width=\"0.3\"/>",
                ring_path(&ring),
                palette.ink,
                palette.ink
            );
        } else {
            let _ = writeln!(
                svg,
                "<path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"0.2\"/>",
                ring_path(&ring),
                palette.muted
            );
        }
    }
}

/// The designator above each courtyard, haloed so it reads over a fill.
fn locator_labels(
    svg: &mut String,
    context: &SheetContext<'_>,
    to_sheet: &impl Fn(Point) -> Point,
) {
    let palette = context.theme.palette();
    for other in &context.icd.connectors {
        let ring: Vec<Point> = other.body.iter().map(|point| to_sheet(*point)).collect();
        if ring.len() < 3 {
            continue;
        }
        let label_at = ring
            .iter()
            .min_by(|left, right| {
                left.y
                    .total_cmp(&right.y)
                    .then_with(|| left.x.total_cmp(&right.x))
            })
            .copied()
            .unwrap_or(Point { x: 0.0, y: 0.0 });
        let current = other.reference == context.connector.reference;
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" font-weight=\"{}\" \
fill=\"{}\" stroke=\"{}\" stroke-width=\"0.55\" paint-order=\"stroke\" \
text-anchor=\"middle\">{}</text>",
            number(label_at.x),
            number(label_at.y - 0.8),
            SANS,
            number(if current { 2.2 } else { 1.7 }),
            if current { "600" } else { "400" },
            if current { palette.ink } else { palette.muted },
            palette.paper,
            escape(&other.reference)
        );
    }
}

// ------------------------------------------------------------------ notes

pub(super) fn notes(svg: &mut String, context: &SheetContext<'_>) {
    let palette = context.theme.palette();
    let connector = context.connector;
    let x = 276.0;
    let y = 202.0;
    let width = 134.0;
    table_header(svg, x, y, width, "SHEET NOTES", 4.5, &palette);
    let mut lines: Vec<(String, bool)> = vec![
        (
            format!(
                "{} pads \u{00b7} {} nets \u{00b7} {} power rows",
                connector.pad_count, connector.net_count, connector.power_rows
            ),
            false,
        ),
        (
            format!(
                "Model: {}",
                connector
                    .model
                    .reference()
                    .map_or("none".to_owned(), |reference| reference.to_owned())
            ),
            false,
        ),
        (
            format!(
                "Mating face: {}",
                connector
                    .views
                    .as_ref()
                    .map(|views| views.mating.label())
                    .unwrap_or("not projected")
            ),
            false,
        ),
        (
            "Outline 0.35 mm \u{00b7} detail 0.18 mm \u{00b7} no hidden lines".to_owned(),
            false,
        ),
        (
            format!(
                "Pads {} \u{00b7} pin 1 \u{25b2} \u{00b7} dimensions in mm",
                palette.pad
            ),
            false,
        ),
    ];
    if let Some(reason) = connector.model.reason() {
        lines.push((format!("Fallback reason: {reason}"), true));
    }
    let mut cursor = y + 8.0;
    for (line, muted) in lines {
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\">{}</text>",
            number(x + 1.5),
            number(cursor),
            SANS,
            number(SMALL),
            if muted { palette.muted } else { palette.ink },
            escape(&fit(&line, width - 3.0, SMALL))
        );
        cursor += 4.0;
    }
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"none\" stroke=\"{}\" \
stroke-width=\"0.2\"/>",
        number(x),
        number(y),
        number(width),
        number(38.0),
        palette.rule
    );
}

// ----------------------------------------------------------------- pinout

struct Columns {
    pin: f64,
    name: f64,
    kind: f64,
    net: f64,
    class: f64,
    connects: f64,
}

impl Columns {
    fn first(width: f64) -> Self {
        Self {
            pin: 20.0 / 256.0 * width,
            name: 44.0 / 256.0 * width,
            kind: 26.0 / 256.0 * width,
            net: 58.0 / 256.0 * width,
            class: 30.0 / 256.0 * width,
            connects: 78.0 / 256.0 * width,
        }
    }
}

pub(super) fn pinout(
    svg: &mut String,
    x: f64,
    y: f64,
    width: f64,
    context: &SheetContext<'_>,
) -> f64 {
    let palette = context.theme.palette();
    let columns = Columns::first(width);
    let row_height = if context.page == 0 {
        FIRST_ROW_HEIGHT
    } else {
        ROW_HEIGHT
    };
    let mut cursor = y;
    table_header(svg, x, cursor, width, "PINOUT", 4.5, &palette);
    cursor += 4.5;
    pin_header(svg, x, cursor, width, &columns, &palette);
    cursor += 5.0;
    for row in context.rows() {
        pin_row(
            svg,
            RowBand {
                x,
                y: cursor,
                width,
                height: row_height,
            },
            &columns,
            row,
            &palette,
        );
        cursor += row_height;
    }
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"none\" stroke=\"{}\" \
stroke-width=\"0.25\"/>",
        number(x),
        number(y),
        number(width),
        number(cursor - y),
        palette.rule
    );
    for (offset, _) in column_offsets(&columns) {
        let _ = writeln!(
            svg,
            "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"0.1\"/>",
            number(x + offset),
            number(y),
            number(x + offset),
            number(cursor),
            palette.rule
        );
    }
    cursor
}

fn column_offsets(columns: &Columns) -> [(f64, f64); 5] {
    let mut offset = 0.0;
    let mut out = [(0.0, 0.0); 5];
    for (slot, width) in [
        columns.pin,
        columns.name,
        columns.kind,
        columns.net,
        columns.class,
    ]
    .into_iter()
    .enumerate()
    {
        offset += width;
        out[slot] = (offset, width);
    }
    out
}

fn pin_header(svg: &mut String, x: f64, y: f64, width: f64, columns: &Columns, palette: &Palette) {
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"5\" fill=\"{}\"/>",
        number(x),
        number(y),
        number(width),
        palette.header
    );
    let labels = [
        ("PIN", columns.pin),
        ("NAME", columns.name),
        ("TYPE", columns.kind),
        ("NET", columns.net),
        ("CLASS", columns.class),
        ("CONNECTS TO", columns.connects),
    ];
    let mut offset = x;
    for (label, column) in labels {
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" font-weight=\"600\" \
letter-spacing=\"0.12\" fill=\"{}\">{}</text>",
            number(offset + 1.2),
            number(y + 3.4),
            SANS,
            number(TINY),
            palette.muted,
            label
        );
        offset += column;
    }
}

/// One pin's row: its box on the sheet.
struct RowBand {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn pin_row(svg: &mut String, band: RowBand, columns: &Columns, row: &PinRow, palette: &Palette) {
    let (x, y, width, height) = (band.x, band.y, band.width, band.height);
    if row.power {
        let _ = writeln!(
            svg,
            "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{}\"/>",
            number(x),
            number(y),
            number(width),
            number(height),
            palette.stripe
        );
    }
    let mut offset = x;
    let baseline = y + height * 0.66;
    let pin_number = if row.pads > 1 {
        format!("{} \u{00d7}{}", row.number, row.pads)
    } else {
        row.number.clone()
    };
    let cells = [
        (pin_number, columns.pin, MONO, BODY),
        (row.pin_name.clone(), columns.name, SANS, BODY),
        (row.pin_type.clone(), columns.kind, SANS, SMALL),
        (crate::html::overbar(&row.net), columns.net, MONO, BODY),
        (row.net_class.clone(), columns.class, SANS, SMALL),
        (row.connects.clone(), columns.connects, SANS, SMALL),
    ];
    for (index, (text, column, font, size)) in cells.iter().enumerate() {
        // The net cell prints the leaf; the full hierarchical name is its
        // tooltip.
        let title = if index == 3 && row.net_full != row.net {
            format!("<title>{}</title>", escape(&row.net_full))
        } else {
            String::new()
        };
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\"{}>{}{}</text>",
            number(offset + 1.2),
            number(baseline),
            font,
            number(*size),
            if row.mechanical {
                palette.muted
            } else {
                palette.ink
            },
            if index == 0 {
                " font-weight=\"500\"".to_owned()
            } else {
                String::new()
            },
            title,
            escape(&fit(text, column - 2.0, *size))
        );
        offset += column;
    }
    let _ = writeln!(
        svg,
        "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"0.1\"/>",
        number(x),
        number(y + height),
        number(x + width),
        number(y + height),
        palette.rule
    );
}

// ------------------------------------------------------------ continuation

pub(super) fn continuation(svg: &mut String, context: &SheetContext<'_>) {
    let palette = context.theme.palette();
    let bottom = pinout(svg, 14.0, 32.0, 396.0, context);
    if bottom < 190.0 {
        identification_wide(svg, context, bottom + 10.0);
    }
    let _ = writeln!(
        svg,
        "<text x=\"14\" y=\"250\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\">\
Continued from sheet {} of {} \u{2014} {} rows {} to {}.</text>",
        SANS,
        number(SMALL),
        palette.muted,
        context.page,
        context.pages(),
        escape(&context.connector.reference),
        ROWS_FIRST + (context.page - 1) * ROWS_CONTINUATION + 1,
        ROWS_FIRST + (context.page - 1) * ROWS_CONTINUATION + context.rows().len()
    );
}

/// The identification table again, two columns wide, so a continuation sheet
/// can be read without the first one.
fn identification_wide(svg: &mut String, context: &SheetContext<'_>, y: f64) {
    let palette = context.theme.palette();
    let rows = &context.connector.fields;
    let x = 14.0;
    let gap = 8.0;
    let column_width = (396.0 - gap) / 2.0;
    let label_width = 34.0;
    let row_height = 4.0;
    let mut bottom = y;
    table_header(svg, x, y, 396.0, "IDENTIFICATION", 4.5, &palette);
    bottom += 4.5;
    for (index, (label, value)) in rows.iter().enumerate() {
        let column = index / 6;
        let row = index % 6;
        if column > 1 {
            break;
        }
        let column_x = x + column as f64 * (column_width + gap);
        let row_y = y + 4.5 + row as f64 * row_height;
        bottom = bottom.max(row_y + row_height);
        let _ = writeln!(
            svg,
            "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"0.12\"/>",
            number(column_x),
            number(row_y + row_height),
            number(column_x + column_width),
            number(row_y + row_height),
            palette.rule
        );
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\">{}</text>",
            number(column_x + 1.5),
            number(row_y + row_height - 1.2),
            SANS,
            number(SMALL),
            palette.muted,
            escape(label)
        );
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\">{}</text>",
            number(column_x + label_width + CELL_INSET),
            number(row_y + row_height - 1.2),
            SANS,
            number(BODY),
            palette.ink,
            escape(&fit(
                value,
                column_width - label_width - CELL_INSET - 1.5,
                BODY
            ))
        );
    }
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"396\" height=\"{}\" fill=\"none\" stroke=\"{}\" \
stroke-width=\"0.2\"/>",
        number(x),
        number(y),
        number(bottom - y),
        palette.rule
    );
}
