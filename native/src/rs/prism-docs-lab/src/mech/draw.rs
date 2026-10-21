//! SVG primitives and dimension lines in sheet millimetres.

use std::fmt::Write as _;

use prism_artwork::artwork::geometry::Point;
use prism_artwork::artwork::svg::{escape, number};

use super::layout::Rect;

use super::sheet::{FONT_MONO, FONT_SANS, HEADER, INK, MUTED, PAPER, RULE};

pub(super) fn boxed(svg: &mut String, rect: Rect, title: &str) {
    let _ = write!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{PAPER}\" stroke=\"{RULE}\" stroke-width=\"0.3\"/>",
        number(rect.x),
        number(rect.y),
        number(rect.w),
        number(rect.h)
    );
    let _ = write!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"7\" fill=\"{HEADER}\"/>",
        number(rect.x),
        number(rect.y),
        number(rect.w)
    );
    text(
        svg,
        Point {
            x: rect.x + 3.0,
            y: rect.y + 4.8,
        },
        2.6,
        INK,
        Face::SansBold,
        "start",
        title,
    );
}

// ------------------------------------------------------------------ tables

/// The number of height rows and hole rows the tables will carry, so the
/// caller can decide whether they fit on sheet 1.
pub(super) fn rect_outline(svg: &mut String, x: f64, y: f64, w: f64, h: f64, width: f64) {
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"none\" stroke=\"{INK}\" \
stroke-width=\"{width}\"/>",
        number(x),
        number(y),
        number(w),
        number(h)
    );
}

pub(super) fn line(svg: &mut String, x1: f64, y1: f64, x2: f64, y2: f64, width: f64) {
    let _ = writeln!(
        svg,
        "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{INK}\" stroke-width=\"{width}\"/>",
        number(x1),
        number(y1),
        number(x2),
        number(y2)
    );
}

pub(super) fn dimension_line(svg: &mut String, start: Point, end: Point, width: f64) {
    let _ = writeln!(
        svg,
        "<path d=\"M{} {} L{} {}\" stroke=\"{INK}\" stroke-width=\"{width}\" \
stroke-linecap=\"round\"/>",
        number(start.x),
        number(start.y),
        number(end.x),
        number(end.y)
    );
    arrow(svg, start, end);
    arrow(svg, end, start);
}

pub(super) fn arrow(svg: &mut String, at: Point, from: Point) {
    let angle = (from.y - at.y).atan2(from.x - at.x);
    let size = 1.5;
    let left = angle + 0.32;
    let right = angle - 0.32;
    let _ = write!(
        svg,
        "<path d=\"M{} {} L{} {} L{} {} Z\" fill=\"{INK}\" stroke=\"none\"/>",
        number(at.x),
        number(at.y),
        number(at.x + size * left.cos()),
        number(at.y + size * left.sin()),
        number(at.x + size * right.cos()),
        number(at.y + size * right.sin())
    );
}

pub(super) fn extension(svg: &mut String, start: Point, end: Point) {
    let _ = writeln!(
        svg,
        "<path d=\"M{} {} L{} {}\" stroke=\"{MUTED}\" stroke-width=\"0.12\"/>",
        number(start.x),
        number(start.y),
        number(end.x),
        number(end.y)
    );
}

pub(super) fn rotated_text(svg: &mut String, x: f64, y: f64, value: &str) {
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" transform=\"rotate(-90 {} {})\" font-family=\"{FONT_MONO}\" \
font-size=\"2.4\" fill=\"{INK}\" text-anchor=\"middle\">{}</text>",
        number(x),
        number(y),
        number(x),
        number(y),
        escape(value)
    );
}

pub(super) fn rotated_label(svg: &mut String, x: f64, y: f64, value: &str) {
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" transform=\"rotate(-90 {} {})\" font-family=\"{FONT_MONO}\" \
font-size=\"1.9\" fill=\"{INK}\" text-anchor=\"middle\">{}</text>",
        number(x),
        number(y),
        number(x),
        number(y),
        escape(value)
    );
}

/// A dimension number with a paper-coloured halo, so it stays legible where a
/// body outline runs underneath it.
pub(super) fn text_halo(
    svg: &mut String,
    x: f64,
    y: f64,
    size: f64,
    fill: &str,
    anchor: &str,
    value: &str,
) {
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" font-family=\"{FONT_MONO}\" font-size=\"{}\" fill=\"{fill}\" \
text-anchor=\"{anchor}\" font-weight=\"500\" stroke=\"#ffffff\" stroke-width=\"0.55\" \
paint-order=\"stroke\">{}</text>",
        number(x),
        number(y),
        number(size),
        escape(value)
    );
}

#[allow(
    clippy::too_many_arguments,
    reason = "one text element has these SVG attributes"
)]
/// The face a text element uses: family and weight together.
#[derive(Clone, Copy)]
pub(super) enum Face {
    /// Geist/Inter at 400.
    Sans,
    /// Geist/Inter at 500.
    SansMedium,
    /// Geist/Inter at 600.
    SansBold,
    /// The mono stack at 500.
    MonoMedium,
}

impl Face {
    fn family(self) -> &'static str {
        match self {
            Self::Sans | Self::SansMedium | Self::SansBold => FONT_SANS,
            Self::MonoMedium => FONT_MONO,
        }
    }

    fn weight(self) -> &'static str {
        match self {
            Self::Sans => "400",
            Self::SansMedium | Self::MonoMedium => "500",
            Self::SansBold => "600",
        }
    }
}

/// One text element at sheet point `at`.
pub(super) fn text(
    svg: &mut String,
    at: Point,
    size: f64,
    fill: &str,
    face: Face,
    anchor: &str,
    value: &str,
) {
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{fill}\" \
text-anchor=\"{anchor}\" font-weight=\"{}\">{}</text>",
        number(at.x),
        number(at.y),
        face.family(),
        number(size),
        face.weight(),
        escape(value)
    );
}
