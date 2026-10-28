//! One A3 landscape interface control sheet as a standalone SVG.
//!
//! The sheet is drawn in paper millimetres (`viewBox 0 0 420 297`), so a
//! stroke width is the width it prints at. The frame, the zone grid and the
//! title block follow KiCad's drawing sheet; the views, the tables and the
//! locator are the prototype's own.

use std::fmt::Write;

use crate::theme::{Palette, Theme};
use prism_artwork::artwork::svg::{escape, number};

use super::board::{Connector, Icd, PinRow};
mod tables;
mod views;

/// A3 landscape, millimetres.
pub const PAGE_WIDTH: f64 = 420.0;
/// A3 landscape, millimetres.
pub const PAGE_HEIGHT: f64 = 297.0;
/// Pinout rows a connector's first sheet holds.
pub const ROWS_FIRST: usize = 19;
/// Pinout rows a continuation sheet holds.
pub const ROWS_CONTINUATION: usize = 44;

const FRAME: f64 = 10.0;
const FRAME_INNER: f64 = 12.0;
const TITLE_X: f64 = 276.0;
const TITLE_Y: f64 = 243.0;
const TITLE_WIDTH: f64 = 134.0;
const TITLE_HEIGHT: f64 = 44.0;
/// The box the sheet's content is laid out in (header, views, tables, title
/// block), in millimetres before [`content_transform`] fits it inside the frame.
const CONTENT_LEFT: f64 = 14.0;
const CONTENT_TOP: f64 = 14.0;
const CONTENT_RIGHT: f64 = TITLE_X + TITLE_WIDTH;
const CONTENT_BOTTOM: f64 = TITLE_Y + TITLE_HEIGHT;
/// Clear space between the inner frame line and the content on every side.
const CONTENT_PADDING: f64 = 3.0;
const SANS: &str = "Geist, Inter, system-ui, sans-serif";
const MONO: &str = "Geist Mono, ui-monospace, monospace";

const BODY: f64 = 2.2;
const SMALL: f64 = 1.9;
const TINY: f64 = 1.7;
const ROW_HEIGHT: f64 = 4.4;
/// The first sheet's row height: its pinout area is shorter.
const FIRST_ROW_HEIGHT: f64 = 3.9;

/// One sheet's place in the document.
pub struct SheetContext<'a> {
    /// The document.
    pub icd: &'a Icd,
    /// The connector.
    pub connector: &'a Connector,
    /// Zero-based page within the connector.
    pub page: usize,
    /// One-based sheet within the document.
    pub sheet_number: usize,
    /// The look the sheet is printed in.
    pub theme: Theme,
}

impl SheetContext<'_> {
    fn pages(&self) -> usize {
        self.connector.pages
    }

    fn title(&self) -> String {
        if self.pages() > 1 {
            format!(
                "{} ({} of {}) \u{2014} {}",
                self.connector.reference,
                self.page + 1,
                self.pages(),
                self.connector.value
            )
        } else if self.connector.value.is_empty() {
            self.connector.reference.clone()
        } else {
            format!(
                "{} \u{2014} {}",
                self.connector.reference, self.connector.value
            )
        }
    }

    fn rows(&self) -> &[PinRow] {
        let start = if self.page == 0 {
            0
        } else {
            ROWS_FIRST + (self.page - 1) * ROWS_CONTINUATION
        };
        let end = if self.page == 0 {
            ROWS_FIRST.min(self.connector.pins.len())
        } else {
            (start + ROWS_CONTINUATION).min(self.connector.pins.len())
        };
        &self.connector.pins[start.min(end)..end]
    }

    fn caption(&self) -> String {
        format!(
            "{} \u{00b7} {} of {}",
            self.connector.reference,
            self.page + 1,
            self.pages()
        )
    }
}

/// Render one sheet.
pub fn render_sheet(context: &SheetContext<'_>) -> String {
    let palette = context.theme.palette();
    let mut svg = String::new();
    let _ = writeln!(
        svg,
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}mm\" height=\"{}mm\" \
viewBox=\"0 0 {} {}\" role=\"img\" aria-label=\"Connector ICD {}\">",
        number(PAGE_WIDTH),
        number(PAGE_HEIGHT),
        number(PAGE_WIDTH),
        number(PAGE_HEIGHT),
        escape(&context.caption()),
    );
    let _ = writeln!(
        svg,
        "<rect x=\"0\" y=\"0\" width=\"{}\" height=\"{}\" fill=\"{}\"/>",
        number(PAGE_WIDTH),
        number(PAGE_HEIGHT),
        palette.paper
    );
    frame(&mut svg, &palette);
    let _ = writeln!(svg, "<g transform=\"{}\">", content_transform());
    header(&mut svg, context);
    if context.page == 0 {
        views::cells(&mut svg, context);
        tables::identification(&mut svg, context);
        tables::locator(&mut svg, context);
        tables::notes(&mut svg, context);
        tables::pinout(&mut svg, 14.0, 198.0, 256.0, context);
    } else {
        tables::continuation(&mut svg, context);
    }
    title_block(&mut svg, context);
    svg.push_str("</g>\n</svg>\n");
    svg
}

/// Fit the content box inside the inner frame with [`CONTENT_PADDING`] clear
/// on every side, keeping its proportions and centring it.
fn content_transform() -> String {
    let left = FRAME_INNER + CONTENT_PADDING;
    let top = FRAME_INNER + CONTENT_PADDING;
    let width = PAGE_WIDTH - 2.0 * left;
    let height = PAGE_HEIGHT - 2.0 * top;
    let content_width = CONTENT_RIGHT - CONTENT_LEFT;
    let content_height = CONTENT_BOTTOM - CONTENT_TOP;
    let scale = (width / content_width).min(height / content_height);
    let x = left + (width - content_width * scale) / 2.0 - CONTENT_LEFT * scale;
    let y = top + (height - content_height * scale) / 2.0 - CONTENT_TOP * scale;
    format!(
        "translate({} {}) scale({})",
        number(x),
        number(y),
        number(scale)
    )
}

// ------------------------------------------------------------------- frame

// ------------------------------------------------------------------- frame

fn frame(svg: &mut String, palette: &Palette) {
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"none\" stroke=\"{}\" \
stroke-width=\"0.5\"/>",
        number(FRAME),
        number(FRAME),
        number(PAGE_WIDTH - 2.0 * FRAME),
        number(PAGE_HEIGHT - 2.0 * FRAME),
        palette.frame
    );
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"none\" stroke=\"{}\" \
stroke-width=\"0.2\"/>",
        number(FRAME_INNER),
        number(FRAME_INNER),
        number(PAGE_WIDTH - 2.0 * FRAME_INNER),
        number(PAGE_HEIGHT - 2.0 * FRAME_INNER),
        palette.rule
    );
    let columns = 8;
    let rows = 6;
    let inner_width = PAGE_WIDTH - 2.0 * FRAME;
    let inner_height = PAGE_HEIGHT - 2.0 * FRAME;
    for column in 0..columns {
        let x = FRAME + inner_width * column as f64 / columns as f64;
        let next = FRAME + inner_width * (column + 1) as f64 / columns as f64;
        tick_vertical(svg, x, FRAME, FRAME_INNER, palette);
        tick_vertical(
            svg,
            x,
            PAGE_HEIGHT - FRAME,
            PAGE_HEIGHT - FRAME_INNER,
            palette,
        );
        for y in [FRAME + 1.0, PAGE_HEIGHT - FRAME - 1.0] {
            let _ = writeln!(
                svg,
                "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
text-anchor=\"middle\" dominant-baseline=\"middle\">{}</text>",
                number((x + next) / 2.0),
                number(y),
                SANS,
                number(SMALL),
                palette.muted,
                column + 1
            );
        }
    }
    for row in 0..rows {
        let y = FRAME + inner_height * row as f64 / rows as f64;
        let next = FRAME + inner_height * (row + 1) as f64 / rows as f64;
        tick_horizontal(svg, FRAME, y, FRAME_INNER, palette);
        tick_horizontal(
            svg,
            PAGE_WIDTH - FRAME,
            y,
            PAGE_WIDTH - FRAME_INNER,
            palette,
        );
        let letter = (b'A' + row as u8) as char;
        for x in [FRAME + 1.0, PAGE_WIDTH - FRAME - 1.0] {
            let _ = writeln!(
                svg,
                "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
text-anchor=\"middle\" dominant-baseline=\"middle\">{}</text>",
                number(x),
                number((y + next) / 2.0),
                SANS,
                number(SMALL),
                palette.muted,
                letter
            );
        }
    }
}

fn tick_vertical(svg: &mut String, x: f64, y: f64, inner: f64, palette: &Palette) {
    let _ = writeln!(
        svg,
        "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"0.15\"/>",
        number(x),
        number(y),
        number(x),
        number(inner),
        palette.rule
    );
}

fn tick_horizontal(svg: &mut String, x: f64, y: f64, inner: f64, palette: &Palette) {
    let _ = writeln!(
        svg,
        "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"0.15\"/>",
        number(x),
        number(y),
        number(inner),
        number(y),
        palette.rule
    );
}

// ------------------------------------------------------------------ header

fn header(svg: &mut String, context: &SheetContext<'_>) {
    let palette = context.theme.palette();
    let _ = writeln!(
        svg,
        "<text x=\"14\" y=\"18.6\" font-family=\"{}\" font-size=\"{}\" font-weight=\"600\" \
letter-spacing=\"0.28\" fill=\"{}\">INTERFACE CONTROL SHEET</text>",
        SANS,
        number(TINY),
        palette.muted
    );
    let _ = writeln!(
        svg,
        "<text x=\"14\" y=\"27.2\" font-family=\"{}\" font-size=\"5.6\" font-weight=\"600\" \
letter-spacing=\"-0.06\" fill=\"{}\">{}</text>",
        SANS,
        palette.ink,
        escape(&context.title())
    );
    let _ = writeln!(
        svg,
        "<text x=\"406\" y=\"18.6\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
text-anchor=\"end\">{}</text>",
        SANS,
        number(SMALL),
        palette.muted,
        escape(&context.icd.board_name)
    );
    let _ = writeln!(
        svg,
        "<text x=\"406\" y=\"23.4\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
text-anchor=\"end\">Connector ICD \u{2014} prototype</text>",
        SANS,
        number(TINY),
        palette.muted
    );
}

// ------------------------------------------------------------- title block

fn title_block(svg: &mut String, context: &SheetContext<'_>) {
    let palette = context.theme.palette();
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{}\" stroke=\"{}\" \
stroke-width=\"0.35\"/>",
        number(TITLE_X),
        number(TITLE_Y),
        number(TITLE_WIDTH),
        number(TITLE_HEIGHT),
        palette.paper,
        palette.frame
    );
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"11\" fill=\"{}\" stroke=\"{}\" \
stroke-width=\"0.2\"/>",
        number(TITLE_X),
        number(TITLE_Y),
        number(TITLE_WIDTH),
        palette.header,
        palette.rule
    );
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" font-weight=\"600\" \
letter-spacing=\"0.16\" fill=\"{}\" data-title=\"1\">CONNECTOR ICD \u{2014} PROTOTYPE</text>",
        number(TITLE_X + 3.0),
        number(TITLE_Y + 4.2),
        SANS,
        number(TINY),
        palette.muted
    );
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"7\" font-weight=\"600\" \
fill=\"{}\" text-anchor=\"end\">{}</text>",
        number(TITLE_X + TITLE_WIDTH - 3.0),
        number(TITLE_Y + 8.2),
        SANS,
        palette.ink,
        escape(&context.connector.reference)
    );
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
data-design=\"1\">{}</text>",
        number(TITLE_X + 3.0),
        number(TITLE_Y + 8.6),
        SANS,
        number(SMALL),
        palette.muted,
        escape(&fit(
            &format!(
                "{} \u{00b7} {}",
                context.icd.identity_label, context.icd.identity
            ),
            90.0,
            SMALL
        ))
    );
    title_rows(svg, context);
}

fn title_rows(svg: &mut String, context: &SheetContext<'_>) {
    let palette = context.theme.palette();
    let rows = [
        ("BOARD", context.icd.board_name.clone()),
        (
            "CONNECTOR",
            format!(
                "{} \u{00b7} {}",
                context.connector.reference, context.connector.value
            ),
        ),
        (
            "FOOTPRINT",
            context
                .connector
                .fields
                .iter()
                .find(|(label, _)| label == "Footprint")
                .map(|(_, value)| value.clone())
                .unwrap_or_default(),
        ),
        (
            "SHEET",
            format!(
                "{} of {} \u{00b7} {} of {}",
                context.sheet_number,
                context.icd.sheets,
                context.page + 1,
                context.pages()
            ),
        ),
    ];
    let mut y = TITLE_Y + 11.0;
    for (label, value) in rows {
        let _ = writeln!(
            svg,
            "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"0.15\"/>",
            number(TITLE_X),
            number(y),
            number(TITLE_X + TITLE_WIDTH),
            number(y),
            palette.rule
        );
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
text-transform=\"uppercase\">{}</text>",
            number(TITLE_X + 3.0),
            number(y + 5.4),
            SANS,
            number(TINY),
            palette.muted,
            label
        );
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
data-title-row=\"{}\" >{}</text>",
            number(TITLE_X + 27.0),
            number(y + 5.4),
            SANS,
            number(BODY),
            palette.ink,
            label,
            escape(&fit(&value, TITLE_WIDTH - 30.0, BODY))
        );
        y += 8.25;
    }
}

fn table_header(
    svg: &mut String,
    x: f64,
    y: f64,
    width: f64,
    label: &str,
    height: f64,
    palette: &Palette,
) {
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{}\" stroke=\"{}\" \
stroke-width=\"0.2\"/>",
        number(x),
        number(y),
        number(width),
        number(height),
        palette.header,
        palette.rule
    );
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" font-weight=\"600\" \
letter-spacing=\"0.16\" fill=\"{}\">{}</text>",
        number(x + 1.5),
        number(y + height - 1.4),
        SANS,
        number(TINY),
        palette.muted,
        label
    );
}

/// `text` cut to `width` millimetres at `size`, with an ellipsis.
fn fit(text: &str, width: f64, size: f64) -> String {
    let characters = (width / (size * 0.53)).floor().max(2.0) as usize;
    if text.chars().count() <= characters {
        return text.to_owned();
    }
    let mut cut: String = text.chars().take(characters.saturating_sub(1)).collect();
    cut.push('\u{2026}');
    cut
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_long_value_is_cut_with_an_ellipsis() {
        let text = "x".repeat(200);
        let cut = fit(&text, 40.0, BODY);
        assert!(cut.chars().count() < 200);
        assert!(cut.ends_with('\u{2026}'));
    }
}
