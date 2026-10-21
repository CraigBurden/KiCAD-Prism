//! The three views: board fill, bodies, holes, dimensions and elevations.

use std::collections::BTreeSet;
use std::fmt::Write as _;

use prism_artwork::artwork::geometry::Point;
use prism_artwork::artwork::svg::{number, ring_path};

use super::board::{Board, Body, Edge, HoleRow, Part};
use super::draw::{Face, dimension_line, extension, rotated_label, rotated_text, text, text_halo};
use super::layout::{Rect, Views};
use super::sheet::{BODY_MM, OUTLINE_MM, OVERHANG_MM};
use crate::html::millimetres;
use crate::theme::Palette;

pub(super) fn top_view(
    svg: &mut String,
    board: &Board,
    views: &Views,
    limit: f64,
    palette: &Palette,
) {
    board_fill(svg, board, views, palette);
    for part in &board.parts {
        body(svg, part, views, limit, palette);
    }
    for hole in &board.holes {
        draw_hole(svg, hole, views, palette);
    }
    mounting_labels(svg, board, views, palette);
    overhang_dimensions(svg, board, views, palette);
    overall_dimensions(svg, board, views, palette);
    ordinate_dimensions(svg, board, views, palette);
    origin_marker(svg, board, views, palette);
}

fn board_fill(svg: &mut String, board: &Board, views: &Views, palette: &Palette) {
    let mut path = String::new();
    path.push_str(&mapped_ring(&board.outline, views));
    for cutout in &board.cutouts {
        path.push(' ');
        path.push_str(&mapped_ring(cutout, views));
    }
    let _ = writeln!(
        svg,
        "<path d=\"{path}\" fill=\"{}\" fill-rule=\"evenodd\" stroke=\"none\"/>",
        palette.stripe
    );
    let _ = writeln!(
        svg,
        "<path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"{OUTLINE_MM}\" \
stroke-linejoin=\"round\"/>",
        mapped_ring(&board.outline, views),
        palette.ink
    );
    if !board.cutouts.is_empty() {
        let rings: Vec<String> = board
            .cutouts
            .iter()
            .map(|ring| mapped_ring(ring, views))
            .collect();
        let _ = writeln!(
            svg,
            "<path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"{OUTLINE_MM}\"/>",
            rings.join(" "),
            palette.ink
        );
    }
}

fn mapped_ring(ring: &[Point], views: &Views) -> String {
    let mapped: Vec<Point> = ring.iter().map(|point| views.top(*point)).collect();
    ring_path(&mapped)
}

fn body(svg: &mut String, part: &Part, views: &Views, limit: f64, palette: &Palette) {
    let over_limit = part
        .height
        .is_some_and(|height| height.above > limit || height.below > limit);
    let color = if over_limit {
        palette.alert
    } else if part.overhang.is_some() {
        palette.ink
    } else {
        palette.body
    };
    let width = if part.overhang.is_some() {
        OVERHANG_MM
    } else {
        BODY_MM
    };
    match &part.body {
        Body::Outline(lines) => {
            let mut path = String::new();
            for line in lines {
                push_line(&mut path, line, views);
            }
            if path.is_empty() {
                return;
            }
            let _ = writeln!(
                svg,
                "<path d=\"{path}\" fill=\"none\" stroke=\"{color}\" stroke-width=\"{width}\" \
stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
            );
        }
        Body::Envelope(ring) if ring.len() >= 3 => {
            let _ = writeln!(
                svg,
                "<path d=\"{}\" fill=\"none\" stroke=\"{color}\" stroke-width=\"{BODY_MM}\" \
stroke-dasharray=\"0.8 0.6\"/>",
                mapped_ring(ring, views)
            );
        }
        Body::Envelope(_) => {}
    }
}

fn push_line(path: &mut String, line: &[Point], views: &Views) {
    for (index, point) in line.iter().enumerate() {
        let point = views.top(*point);
        let command = if index == 0 { 'M' } else { 'L' };
        let _ = write!(path, "{command}{} {} ", number(point.x), number(point.y));
    }
}

fn draw_hole(svg: &mut String, hole: &HoleRow, views: &Views, palette: &Palette) {
    let at = views.top(hole.at);
    let factor = views.scale.factor();
    if hole.slot {
        slot(svg, hole, at, factor, palette);
        return;
    }
    let radius = (factor * hole.width / 2.0).max(0.18);
    if hole.plated {
        let _ = write!(
            svg,
            "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{}\" stroke=\"{}\" \
stroke-width=\"{}\"/>",
            number(at.x),
            number(at.y),
            number(radius),
            palette.paper,
            if hole.mounting {
                palette.ink
            } else {
                palette.muted
            },
            number(if hole.mounting { 0.28 } else { 0.18 })
        );
        let inner = (radius - 0.24).max(0.1);
        let _ = writeln!(
            svg,
            "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"none\" stroke=\"{}\" \
stroke-width=\"0.12\"/>",
            number(at.x),
            number(at.y),
            number(inner),
            palette.muted
        );
    } else {
        let _ = writeln!(
            svg,
            "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{}\" stroke=\"{}\" \
stroke-width=\"{}\"/>",
            number(at.x),
            number(at.y),
            number(radius),
            palette.paper,
            palette.ink,
            number(if hole.mounting { 0.28 } else { 0.16 })
        );
        cross(svg, at, (radius + 0.5).max(0.65), 0.12, palette);
    }
}

fn slot(svg: &mut String, hole: &HoleRow, at: Point, factor: f64, palette: &Palette) {
    let width = (factor * hole.width.max(hole.height)).max(0.5);
    let height = (factor * hole.width.min(hole.height)).max(0.18);
    let angle = if hole.height > hole.width {
        hole.angle + 90.0
    } else {
        hole.angle
    };
    let _ = write!(
        svg,
        "<g transform=\"translate({} {}) rotate({})\">\
<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" rx=\"{}\" fill=\"{}\" \
stroke=\"{}\" stroke-width=\"0.18\"/></g>",
        number(at.x),
        number(at.y),
        number(-angle),
        number(-width / 2.0),
        number(-height / 2.0),
        number(width),
        number(height),
        number(height / 2.0),
        palette.paper,
        palette.ink
    );
    if !hole.plated {
        cross(svg, at, width / 2.0 + 0.5, 0.12, palette);
    }
}

fn cross(svg: &mut String, at: Point, arm: f64, width: f64, palette: &Palette) {
    let _ = writeln!(
        svg,
        "<path d=\"M{} {} L{} {} M{} {} L{} {}\" stroke=\"{}\" stroke-width=\"{width}\"/>",
        number(at.x - arm),
        number(at.y),
        number(at.x + arm),
        number(at.y),
        number(at.x),
        number(at.y - arm),
        number(at.x),
        number(at.y + arm),
        palette.ink
    );
}

fn mounting_labels(svg: &mut String, board: &Board, views: &Views, palette: &Palette) {
    let centre = views.top(Point {
        x: (board.bounds.min_x + board.bounds.max_x) / 2.0,
        y: (board.bounds.min_y + board.bounds.max_y) / 2.0,
    });
    for hole in board.holes.iter().filter(|hole| hole.mounting) {
        let at = views.top(hole.at);
        let clearance = views.scale.factor() * hole.width.max(hole.height) / 2.0 + 1.3;
        let dy = if at.y < centre.y {
            clearance
        } else {
            -clearance + 0.7
        };
        let label = format!("{} {}", hole.used_by, hole.diameter());
        text_halo(
            svg,
            Point {
                x: at.x,
                y: at.y + dy,
            },
            1.9,
            palette.ink,
            "middle",
            &label,
            palette,
        );
    }
}

fn overhang_dimensions(svg: &mut String, board: &Board, views: &Views, palette: &Palette) {
    for (index, part) in board.parts.iter().enumerate() {
        let Some(overhang) = &part.overhang else {
            continue;
        };
        let stagger = index % 2;
        let (start, end, text_at) = match overhang.edge {
            Edge::Left | Edge::Right => {
                let edge = if overhang.edge == Edge::Left {
                    board.bounds.min_x
                } else {
                    board.bounds.max_x
                };
                let a = views.top(Point {
                    x: edge,
                    y: overhang.along,
                });
                let b = views.top(Point {
                    x: overhang.extreme,
                    y: overhang.along,
                });
                (
                    a,
                    b,
                    Point {
                        x: (a.x + b.x) / 2.0,
                        y: a.y - 1.2 - stagger as f64 * 2.2,
                    },
                )
            }
            Edge::Top | Edge::Bottom => {
                let edge = if overhang.edge == Edge::Top {
                    board.bounds.min_y
                } else {
                    board.bounds.max_y
                };
                let a = views.top(Point {
                    x: overhang.along,
                    y: edge,
                });
                let b = views.top(Point {
                    x: overhang.along,
                    y: overhang.extreme,
                });
                (
                    a,
                    b,
                    Point {
                        x: a.x + 1.2 + stagger as f64 * 2.2,
                        y: (a.y + b.y) / 2.0,
                    },
                )
            }
        };
        dimension_line(svg, start, end, 0.18, palette);
        let value = format!("{} {} OVER", part.reference, millimetres(overhang.distance));
        let anchor = if text_at.x >= start.x && text_at.x >= end.x {
            "start"
        } else if text_at.x <= start.x && text_at.x <= end.x {
            "end"
        } else {
            "middle"
        };
        text_halo(svg, text_at, 1.9, palette.ink, anchor, &value, palette);
    }
}

fn overall_dimensions(svg: &mut String, board: &Board, views: &Views, palette: &Palette) {
    let left = views.top(Point {
        x: board.bounds.min_x,
        y: board.bounds.min_y,
    });
    let right = views.top(Point {
        x: board.bounds.max_x,
        y: board.bounds.max_y,
    });
    width_dimension(svg, board, left, right, palette);
    height_dimension(svg, board, left, right, palette);
}

/// The board's width, below the top view.
fn width_dimension(svg: &mut String, board: &Board, left: Point, right: Point, palette: &Palette) {
    let width_y = right.y + 12.0;
    dimension_line(
        svg,
        Point {
            x: left.x,
            y: width_y,
        },
        Point {
            x: right.x,
            y: width_y,
        },
        0.2,
        palette,
    );
    extension(
        svg,
        Point {
            x: left.x,
            y: right.y + 1.0,
        },
        Point {
            x: left.x,
            y: width_y + 1.5,
        },
        palette,
    );
    extension(
        svg,
        Point {
            x: right.x,
            y: right.y + 1.0,
        },
        Point {
            x: right.x,
            y: width_y + 1.5,
        },
        palette,
    );
    text_halo(
        svg,
        Point {
            x: (left.x + right.x) / 2.0,
            y: width_y - 1.6,
        },
        2.4,
        palette.ink,
        "middle",
        &millimetres(board.bounds.width()),
        palette,
    );
}

/// The board's height, left of the top view.
fn height_dimension(svg: &mut String, board: &Board, left: Point, right: Point, palette: &Palette) {
    let height_x = left.x - 14.0;
    dimension_line(
        svg,
        Point {
            x: height_x,
            y: left.y,
        },
        Point {
            x: height_x,
            y: right.y,
        },
        0.2,
        palette,
    );
    extension(
        svg,
        Point {
            x: left.x - 1.0,
            y: left.y,
        },
        Point {
            x: height_x - 1.5,
            y: left.y,
        },
        palette,
    );
    extension(
        svg,
        Point {
            x: left.x - 1.0,
            y: right.y,
        },
        Point {
            x: height_x - 1.5,
            y: right.y,
        },
        palette,
    );
    rotated_text(
        svg,
        height_x - 1.6,
        (left.y + right.y) / 2.0,
        &millimetres(board.bounds.height()),
        palette,
    );
}

fn ordinate_dimensions(svg: &mut String, board: &Board, views: &Views, palette: &Palette) {
    let origin = views.top(board.origin.at);
    let lower = views.top(Point {
        x: board.bounds.min_x,
        y: board.bounds.max_y,
    });
    let left = views.top(Point {
        x: board.bounds.min_x,
        y: board.bounds.min_y,
    });
    let xs = unique(
        board
            .holes
            .iter()
            .filter(|hole| hole.mounting)
            .map(|hole| hole.at.x),
    );
    let ys = unique(
        board
            .holes
            .iter()
            .filter(|hole| hole.mounting)
            .map(|hole| hole.at.y),
    );
    for (index, x) in xs.iter().enumerate() {
        let at = views.top(Point {
            x: *x,
            y: board.origin.at.y,
        });
        let y = lower.y + 18.0 + index as f64 * 5.0;
        dimension_line(
            svg,
            Point { x: origin.x, y },
            Point { x: at.x, y },
            0.15,
            palette,
        );
        extension(
            svg,
            Point {
                x: at.x,
                y: at.y + 1.0,
            },
            Point {
                x: at.x,
                y: y + 1.2,
            },
            palette,
        );
        let value = format!("X {}", millimetres(x - board.origin.at.x));
        text_halo(
            svg,
            Point {
                x: (origin.x + at.x) / 2.0,
                y: y - 1.3,
            },
            1.9,
            palette.ink,
            "middle",
            &value,
            palette,
        );
    }
    for (index, y_value) in ys.iter().enumerate() {
        let at = views.top(Point {
            x: board.origin.at.x,
            y: *y_value,
        });
        let x = left.x - 18.0 - index as f64 * 5.0;
        dimension_line(
            svg,
            Point { x, y: origin.y },
            Point { x, y: at.y },
            0.15,
            palette,
        );
        extension(
            svg,
            Point {
                x: at.x - 1.0,
                y: at.y,
            },
            Point {
                x: x - 1.2,
                y: at.y,
            },
            palette,
        );
        let value = format!("Y {}", millimetres(board.origin.at.y - y_value));
        rotated_label(svg, x - 1.3, (origin.y + at.y) / 2.0, &value, palette);
    }
}

fn unique(values: impl Iterator<Item = f64>) -> Vec<f64> {
    let mut set = BTreeSet::new();
    for value in values {
        set.insert((value * 1000.0).round() as i64);
    }
    set.into_iter().map(|value| value as f64 / 1000.0).collect()
}

fn origin_marker(svg: &mut String, board: &Board, views: &Views, palette: &Palette) {
    let at = views.top(board.origin.at);
    let _ = writeln!(
        svg,
        "<circle cx=\"{}\" cy=\"{}\" r=\"1.5\" fill=\"{}\" stroke=\"{}\" \
stroke-width=\"0.25\"/>",
        number(at.x),
        number(at.y),
        palette.paper,
        palette.ink
    );
    cross(svg, at, 2.4, 0.15, palette);
    let label = if board.origin.from_aux_axis {
        "AUX 0,0"
    } else {
        "0,0"
    };
    text(
        svg,
        Point {
            x: at.x + 3.0,
            y: at.y + 4.0,
        },
        1.9,
        palette.ink,
        Face::SansBold,
        "start",
        label,
    );
}

// -------------------------------------------------------------- elevations

pub(super) fn elevation(
    svg: &mut String,
    board: &Board,
    views: &Views,
    side: bool,
    limit: f64,
    palette: &Palette,
) {
    let rect = if side {
        views.side_board
    } else {
        views.front_board
    };
    let _ = write!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{}\" \
stroke=\"{}\" stroke-width=\"{OUTLINE_MM}\"/>",
        number(rect.x),
        number(rect.y),
        number(rect.w),
        number(rect.h),
        palette.stripe,
        palette.ink
    );
    for part in &board.parts {
        let lines = if side {
            &part.side_lines
        } else {
            &part.front_lines
        };
        if lines.is_empty() {
            continue;
        }
        let over_limit = part
            .height
            .is_some_and(|height| height.above > limit || height.below > limit);
        let mut path = String::new();
        for line in lines {
            for (index, point) in line.iter().enumerate() {
                let mapped = if side {
                    views.side(part.at, *point)
                } else {
                    views.front(part.at, *point)
                };
                let command = if index == 0 { 'M' } else { 'L' };
                let _ = write!(path, "{command}{} {} ", number(mapped.x), number(mapped.y));
            }
        }
        let _ = writeln!(
            svg,
            "<path d=\"{path}\" fill=\"none\" stroke=\"{}\" stroke-width=\"{BODY_MM}\" \
stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
            if over_limit {
                palette.alert
            } else {
                palette.body
            }
        );
    }
    height_dimensions(svg, board, views, side, limit, palette);
}

struct DimAxis {
    x: f64,
    surface: f64,
    anchor: &'static str,
    side: bool,
}

fn height_dimensions(
    svg: &mut String,
    board: &Board,
    views: &Views,
    side: bool,
    limit: f64,
    palette: &Palette,
) {
    let rect = if side {
        views.side_board
    } else {
        views.front_board
    };
    let axis = DimAxis {
        x: if side {
            rect.right() + 9.0
        } else {
            rect.x - 9.0
        },
        surface: views.top_surface(side),
        anchor: if side { "start" } else { "end" },
        side,
    };
    above_dimension(svg, board, views, &axis, limit, palette);
    below_dimension(svg, board, views, &axis, palette);
    thickness_leader(
        svg,
        board,
        rect,
        side,
        views.side_board.x - rect.right(),
        palette,
    );
}

fn above_dimension(
    svg: &mut String,
    board: &Board,
    views: &Views,
    axis: &DimAxis,
    limit: f64,
    palette: &Palette,
) {
    let above = board.tallest_above();
    if above <= 0.0 {
        return;
    }
    let top = views.elevation_y(above, axis.side);
    dimension_line(
        svg,
        Point {
            x: axis.x,
            y: axis.surface,
        },
        Point { x: axis.x, y: top },
        0.18,
        palette,
    );
    let reference = board
        .tallest_part()
        .map_or("?", |part| part.reference.as_str());
    let label = format!("{} ABOVE ({reference})", millimetres(above));
    text_halo(
        svg,
        Point {
            x: axis.x + offset(axis.side),
            y: top - 1.2,
        },
        2.1,
        palette.ink,
        axis.anchor,
        &label,
        palette,
    );
    if above > limit {
        text(
            svg,
            Point {
                x: axis.x + offset(axis.side),
                y: top + 3.2,
            },
            1.8,
            palette.alert_text,
            Face::SansBold,
            axis.anchor,
            "OVER LIMIT",
        );
    }
}

fn below_dimension(
    svg: &mut String,
    board: &Board,
    views: &Views,
    axis: &DimAxis,
    palette: &Palette,
) {
    let below = board.deepest_below();
    if below <= 0.0 {
        return;
    }
    let bottom = views.elevation_y(-below, axis.side);
    dimension_line(
        svg,
        Point {
            x: axis.x,
            y: axis.surface,
        },
        Point {
            x: axis.x,
            y: bottom,
        },
        0.18,
        palette,
    );
    let reference = board
        .deepest_part()
        .map_or("?", |part| part.reference.as_str());
    let label = format!("{} BELOW ({reference})", millimetres(below));
    text_halo(
        svg,
        Point {
            x: axis.x + offset(axis.side),
            y: bottom + 3.6,
        },
        2.1,
        palette.ink,
        axis.anchor,
        &label,
        palette,
    );
}

fn offset(side: bool) -> f64 {
    if side { 1.4 } else { -1.4 }
}

fn thickness_leader(
    svg: &mut String,
    board: &Board,
    rect: Rect,
    side: bool,
    gap: f64,
    palette: &Palette,
) {
    if side {
        return;
    }
    let y = rect.y + rect.h / 2.0;
    let start = Point {
        x: rect.right() + 1.0,
        y,
    };
    let length = gap.clamp(5.0, 16.0) * 0.6;
    let end = Point {
        x: rect.right() + length,
        y,
    };
    let _ = writeln!(
        svg,
        "<path d=\"M{} {} L{} {}\" stroke=\"{}\" stroke-width=\"0.15\"/>",
        number(start.x),
        number(start.y),
        number(end.x),
        number(end.y),
        palette.muted
    );
    text(
        svg,
        Point {
            x: end.x - 1.0,
            y: y - 1.2,
        },
        1.8,
        palette.muted,
        Face::MonoMedium,
        "end",
        &format!("{} THK", millimetres(board.thickness)),
    );
}

// --------------------------------------------------------------- furniture

pub(super) fn view_labels(svg: &mut String, views: &Views, palette: &Palette) {
    let top = views.content;
    let centre = views.top(Point {
        x: (top.min_x + top.max_x) / 2.0,
        y: top.min_y,
    });
    text(
        svg,
        Point {
            x: centre.x,
            y: views.top_y - 3.2,
        },
        3.0,
        palette.ink,
        Face::SansBold,
        "middle",
        "TOP VIEW",
    );
    text(
        svg,
        Point {
            x: views.front.x,
            y: views.front.y - 3.2,
        },
        3.0,
        palette.ink,
        Face::SansBold,
        "start",
        "FRONT VIEW",
    );
    text(
        svg,
        Point {
            x: views.side.x,
            y: views.side.y - 3.2,
        },
        3.0,
        palette.ink,
        Face::SansBold,
        "start",
        "RIGHT SIDE VIEW",
    );
    text(
        svg,
        Point {
            x: views.front.right(),
            y: views.front.y - 3.2,
        },
        2.1,
        palette.muted,
        Face::MonoMedium,
        "end",
        &format!("SCALE {}", views.scale.label()),
    );
}
