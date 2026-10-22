//! The boxed tables: a tinted title band, a rule under every row and mono
//! numbers. Columns are fixed-width so rows line up across a page break.

use std::fmt::Write as _;

use prism_artwork::artwork::svg::{escape, number};

use super::layout::Rect;
use super::sheet::{FONT_MONO, FONT_SANS};
use crate::theme::Palette;

/// One table column.
pub struct Column {
    /// The heading.
    pub title: &'static str,
    /// Width in sheet millimetres.
    pub width: f64,
    /// True for numbers, which take the mono face and a right alignment.
    pub numeric: bool,
}

/// The band heights and row height, millimetres.
const TITLE_H: f64 = 7.0;
const HEAD_H: f64 = 5.2;
const ROW_H: f64 = 3.9;

/// The rows one table of `rect` height can hold.
pub fn row_capacity(rect: Rect, title: bool) -> usize {
    let used = TITLE_H + HEAD_H;
    let available = (rect.h - used - if title { 0.0 } else { TITLE_H }).max(0.0);
    (available / ROW_H).floor() as usize
}

/// Draw `rows` in `rect`; returns the height actually used.
pub fn draw(
    svg: &mut String,
    rect: Rect,
    title: &str,
    columns: &[Column],
    rows: &[Vec<String>],
    font: f64,
    palette: &Palette,
) -> f64 {
    let width: f64 = columns.iter().map(|column| column.width).sum();
    let count = rows.len().min(row_capacity(rect, true));
    let height = TITLE_H + HEAD_H + count as f64 * ROW_H;
    let _ = write!(
        svg,
        "<g class=\"table\"><rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{}\" \
stroke=\"{}\" stroke-width=\"0.25\"/>",
        number(rect.x),
        number(rect.y),
        number(width),
        number(height),
        palette.paper,
        palette.rule,
    );
    let _ = write!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{}\"/>",
        number(rect.x),
        number(rect.y),
        number(width),
        number(TITLE_H),
        palette.header,
    );
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" font-family=\"{FONT_SANS}\" font-size=\"2.7\" \
font-weight=\"600\" fill=\"{}\">{}</text>",
        number(rect.x + 2.2),
        number(rect.y + 4.7),
        palette.ink,
        escape(title),
    );
    header(svg, rect, columns, width, font, palette);
    rows_body(svg, rect, columns, rows, width, font, palette);
    svg.push_str("</g>\n");
    height
}

fn header(
    svg: &mut String,
    rect: Rect,
    columns: &[Column],
    width: f64,
    font: f64,
    palette: &Palette,
) {
    let y = rect.y + TITLE_H;
    let _ = write!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{}\"/>",
        number(rect.x),
        number(y),
        number(width),
        number(HEAD_H),
        palette.stripe,
    );
    let mut x = rect.x;
    for column in columns {
        let anchor = if column.numeric { "end" } else { "start" };
        let tx = if column.numeric {
            x + column.width - 1.4
        } else {
            x + 1.4
        };
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{FONT_SANS}\" font-size=\"{}\" \
font-weight=\"600\" fill=\"{}\" text-anchor=\"{anchor}\">{}</text>",
            number(tx),
            number(y + 3.5),
            number(font),
            palette.muted,
            escape(column.title),
        );
        x += column.width;
    }
    rule(svg, rect.x, y + HEAD_H, width, palette);
}

fn rows_body(
    svg: &mut String,
    rect: Rect,
    columns: &[Column],
    rows: &[Vec<String>],
    width: f64,
    font: f64,
    palette: &Palette,
) {
    let top = rect.y + TITLE_H + HEAD_H;
    for (index, row) in rows.iter().enumerate() {
        let y = top + index as f64 * ROW_H;
        if index % 2 == 1 {
            let _ = write!(
                svg,
                "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{}\"/>",
                number(rect.x),
                number(y),
                number(width),
                number(ROW_H),
                palette.stripe,
            );
        }
        let mut x = rect.x;
        for (column, value) in columns.iter().zip(row.iter()) {
            let anchor = if column.numeric { "end" } else { "start" };
            let tx = if column.numeric {
                x + column.width - 1.4
            } else {
                x + 1.4
            };
            let face = if column.numeric { FONT_MONO } else { FONT_SANS };
            let text = fit(value, column.width - 2.4, font);
            let _ = writeln!(
                svg,
                "<text x=\"{}\" y=\"{}\" font-family=\"{face}\" font-size=\"{}\" \
fill=\"{}\" text-anchor=\"{anchor}\">{}</text>",
                number(tx),
                number(y + ROW_H - 1.1),
                number(font),
                palette.ink,
                escape(&text),
            );
            x += column.width;
        }
        rule(svg, rect.x, y + ROW_H, width, palette);
    }
}

fn rule(svg: &mut String, x: f64, y: f64, width: f64, palette: &Palette) {
    let _ = writeln!(
        svg,
        "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"0.2\"/>",
        number(x),
        number(y),
        number(x + width),
        number(y),
        palette.rule,
    );
}

/// Trim `text` to `width` millimetres at `font` millimetres, with an ellipsis.
pub fn fit(text: &str, width: f64, font: f64) -> String {
    let per_character = font * 0.56;
    let maximum = (width / per_character).floor().max(1.0) as usize;
    let count = text.chars().count();
    if count <= maximum {
        return text.to_owned();
    }
    if maximum <= 1 {
        return "…".to_owned();
    }
    let kept: String = text.chars().take(maximum - 1).collect();
    format!("{kept}…")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_long_cell_gets_an_ellipsis() {
        assert_eq!(fit("0123456789", 20.0, 2.5), "0123456789");
        let fitted = fit("0123456789012345678901234567890", 20.0, 2.5);
        assert!(fitted.ends_with('…'));
        assert!(fitted.chars().count() < 31);
    }

    #[test]
    fn a_table_needs_room_for_its_bands() {
        let rect = Rect::new(0.0, 0.0, 100.0, 40.0);
        assert_eq!(row_capacity(rect, true), 7);
    }
}
