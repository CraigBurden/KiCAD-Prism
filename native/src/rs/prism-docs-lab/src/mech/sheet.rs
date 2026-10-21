//! The A3 sheet: KiCad's frame and zone grid, the title block, the notes and
//! the self-contained HTML page. The views live in [`super::views`] and the
//! tables in [`super::tables`].

use std::fmt::Write as _;

use prism_artwork::artwork::geometry::Point;
use prism_artwork::artwork::svg::{escape, number};

use super::Measurement;
use super::board::Board;
use super::draw::{Face, boxed, line, rect_outline, text};
use super::layout::{self, FRAME, Frame, Rect, SHEET_H, SHEET_W, Views};
pub use super::tables::row_counts;
use super::tables::{sheet_one_tables, sheet_two_tables};
use super::views::{elevation, top_view, view_labels};
use crate::html::millimetres;
use crate::theme::{Palette, Theme};

pub(crate) const FONT_SANS: &str = "Geist, Inter, system-ui, sans-serif";
pub(crate) const FONT_MONO: &str = "ui-monospace, SFMono-Regular, Menlo, monospace";
/// Board outline and cutout stroke, sheet millimetres.
pub(crate) const OUTLINE_MM: f64 = 0.35;
/// A body outline's stroke.
pub(crate) const BODY_MM: f64 = 0.13;
/// An overhanging body's stroke.
pub(crate) const OVERHANG_MM: f64 = 0.25;

/// Render every sheet the run needs: one, or one and the table sheet.
pub fn render(
    board: &Board,
    measurement: &Measurement,
    limit: f64,
    tables_on_sheet: bool,
    theme: Theme,
) -> Vec<String> {
    let style = Style {
        measurement,
        limit,
        theme,
        palette: theme.palette(),
    };
    let views = layout::choose(board, tables_on_sheet);
    let frame = Frame::new(tables_on_sheet);
    let total = if tables_on_sheet { 1 } else { 2 };
    let mut sheets = vec![sheet_one(board, &views, &frame, &style, 1, total)];
    if !tables_on_sheet {
        sheets.push(sheet_two(board, &views, &frame, &style, 2, total));
    }
    sheets
}

/// What every function drawing a sheet needs: the measured heights, the limit
/// they are judged against, and the look they are drawn in.
struct Style<'a> {
    measurement: &'a Measurement,
    limit: f64,
    theme: Theme,
    palette: Palette,
}

fn open_sheet(title: &str, palette: &Palette) -> String {
    let mut svg = String::new();
    let _ = writeln!(
        svg,
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1684\" height=\"1191\" \
viewBox=\"0 0 {SHEET_W} {SHEET_H}\" font-family=\"{FONT_SANS}\">\n<title>{}</title>",
        escape(title)
    );
    let _ = writeln!(
        svg,
        "<rect x=\"0\" y=\"0\" width=\"{SHEET_W}\" height=\"{SHEET_H}\" fill=\"{}\"/>",
        palette.paper,
    );
    svg
}

fn sheet_one(
    board: &Board,
    views: &Views,
    frame: &Frame,
    style: &Style<'_>,
    number: usize,
    total: usize,
) -> String {
    let palette = &style.palette;
    let mut svg = open_sheet(
        &format!("{} — mechanical outline, sheet {number}", board.name),
        palette,
    );
    draw_frame(&mut svg, palette);
    title_block(&mut svg, frame.title, board, views, number, total, palette);
    notes(&mut svg, frame.notes, board, style);
    svg.push_str("<defs><clipPath id=\"drawing\"><rect x=\"10\" y=\"10\" width=\"400\" height=\"231\"/></clipPath></defs>\n");
    svg.push_str("<g clip-path=\"url(#drawing)\">\n");
    top_view(&mut svg, board, views, style.limit, palette);
    elevation(&mut svg, board, views, false, style.limit, palette);
    elevation(&mut svg, board, views, true, style.limit, palette);
    view_labels(&mut svg, views, palette);
    svg.push_str("</g>\n");
    if let Some(rect) = frame.table {
        sheet_one_tables(&mut svg, rect, board, style.limit, palette);
    }
    svg.push_str("</svg>\n");
    svg
}

fn sheet_two(
    board: &Board,
    views: &Views,
    frame: &Frame,
    style: &Style<'_>,
    sheet_no: usize,
    total: usize,
) -> String {
    let palette = &style.palette;
    let mut svg = open_sheet(
        &format!(
            "{} — mechanical outline tables, sheet {sheet_no}",
            board.name
        ),
        palette,
    );
    draw_frame(&mut svg, palette);
    title_block(
        &mut svg,
        frame.title,
        board,
        views,
        sheet_no,
        total,
        palette,
    );
    svg.push_str("<defs><clipPath id=\"drawing\"><rect x=\"10\" y=\"10\" width=\"400\" height=\"231\"/></clipPath></defs>\n");
    svg.push_str("<g clip-path=\"url(#drawing)\">\n");
    sheet_two_tables(&mut svg, board, style.limit, palette);
    svg.push_str("</g>\n");
    svg.push_str("</svg>\n");
    svg
}

fn draw_frame(svg: &mut String, palette: &Palette) {
    rect_outline(svg, 6.0, 6.0, SHEET_W - 12.0, SHEET_H - 12.0, 0.4, palette);
    rect_outline(
        svg,
        FRAME,
        FRAME,
        SHEET_W - 2.0 * FRAME,
        SHEET_H - 2.0 * FRAME,
        0.2,
        palette,
    );
    let width = SHEET_W - 2.0 * FRAME;
    let height = SHEET_H - 2.0 * FRAME;
    for index in 1..8 {
        let x = FRAME + width * f64::from(index) / 8.0;
        line(svg, x, 6.0, x, FRAME, 0.25, palette);
        line(svg, x, SHEET_H - FRAME, x, SHEET_H - 6.0, 0.25, palette);
    }
    for index in 1..6 {
        let y = FRAME + height * f64::from(index) / 6.0;
        line(svg, 6.0, y, FRAME, y, 0.25, palette);
        line(svg, SHEET_W - FRAME, y, SHEET_W - 6.0, y, 0.25, palette);
    }
    for index in 0..8 {
        let x = FRAME + width * (f64::from(index) + 0.5) / 8.0;
        text(
            svg,
            Point { x, y: 9.3 },
            2.2,
            palette.muted,
            Face::SansMedium,
            "middle",
            &(index + 1).to_string(),
        );
        text(
            svg,
            Point {
                x,
                y: SHEET_H - 6.6,
            },
            2.2,
            palette.muted,
            Face::SansMedium,
            "middle",
            &(index + 1).to_string(),
        );
    }
    for index in 0..6 {
        let y = FRAME + height * (f64::from(index) + 0.5) / 6.0 + 0.8;
        let label = ((b'A' + index as u8) as char).to_string();
        text(
            svg,
            Point { x: 8.0, y },
            2.2,
            palette.muted,
            Face::SansMedium,
            "middle",
            &label,
        );
        text(
            svg,
            Point {
                x: SHEET_W - 8.0,
                y,
            },
            2.2,
            palette.muted,
            Face::SansMedium,
            "middle",
            &label,
        );
    }
}

// -------------------------------------------------------------- title block

fn title_block(
    svg: &mut String,
    rect: Rect,
    board: &Board,
    views: &Views,
    sheet_no: usize,
    total: usize,
    palette: &Palette,
) {
    title_header(svg, rect, board, palette);
    let fifth = rect.w / 2.0;
    let rows = [
        ("DRAWING", "MECH-01".to_owned()),
        ("SHEET", format!("{sheet_no} / {total}")),
        ("SCALE", views.scale.label()),
        ("UNITS", "mm".to_owned()),
        ("PROJECTION", "THIRD ANGLE".to_owned()),
    ];
    title_rows(svg, rect, &rows, fifth, palette);
}

fn title_header(svg: &mut String, rect: Rect, board: &Board, palette: &Palette) {
    let _ = write!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{}\" stroke=\"{}\" stroke-width=\"0.3\"/>",
        number(rect.x),
        number(rect.y),
        number(rect.w),
        number(rect.h),
        palette.paper,
        palette.rule
    );
    let _ = write!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"9\" fill=\"{}\"/>",
        number(rect.x),
        number(rect.y),
        number(rect.w),
        palette.header
    );
    text(
        svg,
        Point {
            x: rect.x + 3.0,
            y: rect.y + 6.0,
        },
        3.4,
        palette.ink,
        Face::SansBold,
        "start",
        "MECHANICAL OUTLINE",
    );
    text(
        svg,
        Point {
            x: rect.x + rect.w - 3.0,
            y: rect.y + 5.9,
        },
        2.2,
        palette.muted,
        Face::SansMedium,
        "end",
        "PROTOTYPE · NOT FOR FABRICATION",
    );
    let _ = write!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"7\" fill=\"{}\"/>",
        number(rect.x),
        number(rect.y + 9.0),
        number(rect.w),
        palette.stripe
    );
    let board_text = if board.file.is_empty() {
        board.name.clone()
    } else {
        board.file.clone()
    };
    text(
        svg,
        Point {
            x: rect.x + 3.0,
            y: rect.y + 13.9,
        },
        2.4,
        palette.ink,
        Face::SansMedium,
        "start",
        &board_text,
    );
}

fn title_rows(
    svg: &mut String,
    rect: Rect,
    rows: &[(&str, String)],
    fifth: f64,
    palette: &Palette,
) {
    let mut index = 0;
    for row in 0..3 {
        let y = rect.y + 16.0 + row as f64 * 6.0;
        line(svg, rect.x, y, rect.x + rect.w, y, 0.2, palette);
        for column in 0..2 {
            let Some((key, value)) = rows.get(index) else {
                break;
            };
            let x = rect.x + fifth * column as f64 + 2.5;
            text(
                svg,
                Point { x, y: y + 4.2 },
                1.8,
                palette.muted,
                Face::SansBold,
                "start",
                key,
            );
            text(
                svg,
                Point {
                    x: x + 22.0,
                    y: y + 4.2,
                },
                2.3,
                palette.ink,
                Face::MonoMedium,
                "start",
                value,
            );
            index += 1;
        }
        if row == 2 {
            third_angle(svg, rect.x + rect.w - 17.0, y + 3.0, palette);
        }
    }
    line(
        svg,
        rect.x + fifth,
        rect.y + 16.0,
        rect.x + fifth,
        rect.y + 34.0,
        0.2,
        palette,
    );
}

fn third_angle(svg: &mut String, x: f64, y: f64, palette: &Palette) {
    let _ = write!(
        svg,
        "<g stroke=\"{}\" stroke-width=\"0.3\" fill=\"none\">\
<circle cx=\"{}\" cy=\"{}\" r=\"2.1\"/><circle cx=\"{}\" cy=\"{}\" r=\"1.0\"/>\
<path d=\"M{} {} L{} {} L{} {} L{} {} Z\"/></g>",
        palette.ink,
        number(x),
        number(y),
        number(x),
        number(y),
        number(x - 5.5),
        number(y - 2.1),
        number(x - 2.5),
        number(y - 2.1),
        number(x - 2.5),
        number(y + 2.1),
        number(x - 5.5),
        number(y + 2.1)
    );
}

// ------------------------------------------------------------------- notes

fn notes(svg: &mut String, rect: Rect, board: &Board, style: &Style<'_>) {
    let (limit, theme, palette) = (style.limit, style.theme, &style.palette);
    boxed(svg, rect, "NOTES", palette);
    let mut y = rect.y + 9.6;
    let release = style.measurement.geometer.as_deref().unwrap_or("none");
    let known = board
        .parts
        .iter()
        .filter(|part| part.height.is_some())
        .count();
    let mounting = board.holes.iter().filter(|hole| hole.mounting).count();
    note(
        svg,
        rect,
        &mut y,
        "UNITS",
        "millimetres. Third angle projection.",
        palette,
    );
    note(
        svg,
        rect,
        &mut y,
        "ORIGIN",
        &format!("{}. Ordinates +X right, +Y up.", board.origin.label()),
        palette,
    );
    note(
        svg,
        rect,
        &mut y,
        "HOLES",
        "plated ring; NPTH circle with centre cross; mounting holes by ordinate.",
        palette,
    );
    note(
        svg,
        rect,
        &mut y,
        "HEIGHTS",
        &format!(
            "Geometer {release} model bounds; {known} of {} parts measured.",
            board.parts.len()
        ),
        palette,
    );
    note(
        svg,
        rect,
        &mut y,
        "BOARD",
        &format!(
            "{} × {} × {} mm; {} holes, {mounting} mounting.",
            millimetres(board.bounds.width()),
            millimetres(board.bounds.height()),
            millimetres(board.thickness),
            board.holes.len()
        ),
        palette,
    );
    note(
        svg,
        rect,
        &mut y,
        "OVER LIMIT",
        &if theme == Theme::Light {
            format!("parts above {limit:.2} mm are red {}.", palette.alert)
        } else {
            // A hex colour means nothing to a reader on a themed sheet.
            format!("parts above {limit:.2} mm are marked.")
        },
        palette,
    );
    unknown_note(svg, rect, &mut y, board, palette);
    note(
        svg,
        rect,
        &mut y,
        "SOURCE",
        "models/assembly-hlr.json outlines; projections/placements.json and stackup.json.",
        palette,
    );
}

/// The unknown-height note: the parts a run could not measure, or a sentence
/// saying every part has one.
fn unknown_note(svg: &mut String, rect: Rect, y: &mut f64, board: &Board, palette: &Palette) {
    let unknown = board.unknown_heights();
    if unknown.is_empty() {
        note(
            svg,
            rect,
            y,
            "UNKNOWN",
            "every part has a measured height.",
            palette,
        );
        return;
    }
    let listed: Vec<&str> = unknown.iter().take(40).copied().collect();
    let more = unknown.len().saturating_sub(listed.len());
    let noun = if unknown.len() == 1 { "part" } else { "parts" };
    let mut value = format!("{} {noun}: {}", unknown.len(), listed.join(", "));
    if more > 0 {
        let _ = write!(value, " and {more} more");
    }
    note(svg, rect, y, "NO HEIGHT", &value, palette);
}

fn note(svg: &mut String, rect: Rect, y: &mut f64, key: &str, value: &str, palette: &Palette) {
    let width = rect.w - 6.0;
    let lines = wrap(value, (width - 26.0) / 0.98);
    for (index, line) in lines.iter().enumerate() {
        if *y > rect.bottom() - 2.0 {
            return;
        }
        if index == 0 {
            text(
                svg,
                Point {
                    x: rect.x + 3.0,
                    y: *y,
                },
                2.0,
                palette.muted,
                Face::SansBold,
                "start",
                key,
            );
        }
        text(
            svg,
            Point {
                x: rect.x + 28.0,
                y: *y,
            },
            2.1,
            palette.ink,
            Face::Sans,
            "start",
            line,
        );
        *y += 4.2;
    }
}

/// Wrap `text` into at most `maximum` characters per line.
fn wrap(text: &str, maximum: f64) -> Vec<String> {
    let maximum = maximum.max(8.0) as usize;
    let mut lines = Vec::new();
    let mut line = String::new();
    for word in text.split_whitespace() {
        if !line.is_empty() && line.chars().count() + 1 + word.chars().count() > maximum {
            lines.push(std::mem::take(&mut line));
        }
        if !line.is_empty() {
            line.push(' ');
        }
        line.push_str(word);
    }
    if !line.is_empty() {
        lines.push(line);
    }
    if lines.len() > 3 {
        lines.truncate(3);
        if let Some(last) = lines.last_mut() {
            last.push('…');
        }
    }
    lines
}

// ---------------------------------------------------------------- top view

/// The self-contained print page: both sheets inline, A3 landscape, no margin.
///
/// A dark or blueprint page asks the printer to keep its background; the light
/// page is emitted exactly as it always was, which prints as white paper.
pub fn html(title: &str, sheets: &[String], theme: Theme) -> String {
    let palette = theme.palette();
    let (paper, mat) = (palette.paper, palette.mat);
    let print = if theme == Theme::Light {
        String::new()
    } else {
        "html, body, .sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n"
            .to_owned()
    };
    let mut page = String::new();
    let _ = writeln!(
        page,
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n\
<title>{}</title>\n<style>\n\
@page {{ size: A3 landscape; margin: 0; }}\n\
html, body {{ margin: 0; padding: 0; background: {paper}; }}\n\
.sheet {{ width: 420mm; height: 297mm; overflow: hidden; break-after: page; }}\n\
.sheet:last-child {{ break-after: auto; }}\n\
.sheet svg {{ width: 420mm; height: 297mm; display: block; }}\n\
@media screen {{ body {{ background: {mat}; padding: 16px; }}\
.sheet {{ margin: 0 auto 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.18); background: {paper}; }} }}\n\
{print}</style>\n</head>\n<body>\n",
        escape(title)
    );
    for sheet in sheets {
        let _ = writeln!(page, "<section class=\"sheet\">\n{sheet}</section>");
    }
    page.push_str("</body>\n</html>\n");
    page
}

// ------------------------------------------------------------------- marks

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mech::board::{Body, Height, HeightSource, Origin, Part, Side};
    use crate::mech::layout::Scale;
    use crate::mech::tables::height_rows;
    use prism_artwork::artwork::geometry::Bounds;

    fn board() -> Board {
        let bounds = Bounds {
            min_x: 0.0,
            min_y: 0.0,
            max_x: 40.0,
            max_y: 30.0,
        };
        Board {
            name: "test".to_owned(),
            file: "test.kicad_pcb".to_owned(),
            thickness: 1.6,
            outline: bounds.ring(),
            cutouts: Vec::new(),
            bounds,
            origin: Origin {
                at: Point { x: 0.0, y: 30.0 },
                from_aux_axis: false,
            },
            parts: vec![Part {
                index: 0,
                reference: "U1".to_owned(),
                library: String::new(),
                side: Side::Top,
                mechanical: false,
                at: Point { x: 20.0, y: 15.0 },
                angle: 0.0,
                body: Body::Envelope(bounds.ring()),
                body_bounds: bounds,
                courtyard: None,
                pad_bounds: None,
                overhang: None,
                model: None,
                fallback_height: None,
                height: Some(Height {
                    above: 3.0,
                    below: 0.0,
                }),
                height_source: HeightSource::ModelBounds,
                height_note: String::new(),
                front_lines: Vec::new(),
                side_lines: Vec::new(),
            }],
            holes: Vec::new(),
        }
    }

    #[test]
    fn wrapping_keeps_words_and_caps_the_lines() {
        let lines = wrap("one two three four five six seven", 9.0);
        assert_eq!(lines[0], "one two");
        assert!(lines.len() <= 3);
    }

    #[test]
    fn a_known_height_sorts_first() {
        let rows = height_rows(&board(), 5.0);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0][0], "U1");
        assert_eq!(rows[0][2], "3.00");
        assert!(rows[0][5].is_empty());
    }

    #[test]
    fn a_scale_label_is_the_ratio() {
        assert_eq!(Scale { num: 3, den: 1 }.label(), "3:1");
    }

    #[test]
    fn the_sheets_are_byte_identical_for_the_same_inputs() {
        let board = board();
        let measurement = Measurement {
            geometer: None,
            measured: 0,
            models: 0,
            requests: 0,
            warnings: Vec::new(),
        };
        let first = render(&board, &measurement, 5.0, true, Theme::Light);
        let second = render(&board, &measurement, 5.0, true, Theme::Light);
        assert_eq!(first, second);
    }

    #[test]
    fn a_themed_page_keeps_its_background_when_printed() {
        for theme in [Theme::Dark, Theme::Blueprint] {
            let page = html("x", &[], theme);
            assert!(page.contains("print-color-adjust: exact"), "{page}");
            assert!(
                page.contains(&format!("background: {};", theme.palette().paper)),
                "{page}"
            );
        }
        let light = html("x", &[], Theme::Light);
        assert!(!light.contains("print-color-adjust"), "{light}");
    }

    #[test]
    fn the_html_page_is_a3_landscape_with_every_sheet() {
        let page = html(
            "x",
            &["<svg/>".to_owned(), "<svg/>".to_owned()],
            Theme::Light,
        );
        assert!(page.contains("size: A3 landscape"));
        assert_eq!(page.matches("<section class=\"sheet\">").count(), 2);
    }
}
