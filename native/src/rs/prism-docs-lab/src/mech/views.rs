//! The three views: board fill, bodies, holes, dimensions and elevations.

use std::collections::BTreeSet;
use std::fmt::Write as _;

use prism_artwork::artwork::geometry::Point;
use prism_artwork::artwork::svg::{number, ring_path};

use super::board::{Board, Body, Edge, HoleRow, Part};
use super::draw::{Face, dimension_line, extension, rotated_label, rotated_text, text, text_halo};
use super::layout::{Rect, Views};
use super::sheet::{BODY, BODY_MM, INK, MUTED, OUTLINE_MM, OVER, OVERHANG_MM, PAPER};
use crate::html::millimetres;

pub(super) fn top_view(svg: &mut String, board: &Board, views: &Views, limit: f64) {
    board_fill(svg, board, views);
    for part in &board.parts {
        body(svg, part, views, limit);
    }
    for hole in &board.holes {
        draw_hole(svg, hole, views);
    }
    mounting_labels(svg, board, views);
    overhang_dimensions(svg, board, views);
    overall_dimensions(svg, board, views);
    ordinate_dimensions(svg, board, views);
    origin_marker(svg, board, views);
}

fn board_fill(svg: &mut String, board: &Board, views: &Views) {
    let mut path = String::new();
    path.push_str(&mapped_ring(&board.outline, views));
    for cutout in &board.cutouts {
        path.push(' ');
        path.push_str(&mapped_ring(cutout, views));
    }
    let _ = writeln!(
        svg,
        "<path d=\"{path}\" fill=\"#f7f8fa\" fill-rule=\"evenodd\" stroke=\"none\"/>"
    );
    let _ = writeln!(
        svg,
        "<path d=\"{}\" fill=\"none\" stroke=\"{INK}\" stroke-width=\"{OUTLINE_MM}\" \
stroke-linejoin=\"round\"/>",
        mapped_ring(&board.outline, views)
    );
    if !board.cutouts.is_empty() {
        let rings: Vec<String> = board
            .cutouts
            .iter()
            .map(|ring| mapped_ring(ring, views))
            .collect();
        let _ = writeln!(
            svg,
            "<path d=\"{}\" fill=\"none\" stroke=\"{INK}\" stroke-width=\"{OUTLINE_MM}\"/>",
            rings.join(" ")
        );
    }
}

fn mapped_ring(ring: &[Point], views: &Views) -> String {
    let mapped: Vec<Point> = ring.iter().map(|point| views.top(*point)).collect();
    ring_path(&mapped)
}

fn body(svg: &mut String, part: &Part, views: &Views, limit: f64) {
    let over_limit = part
        .height
        .is_some_and(|height| height.above > limit || height.below > limit);
    let color = if over_limit {
        OVER
    } else if part.overhang.is_some() {
        INK
    } else {
        BODY
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

fn draw_hole(svg: &mut String, hole: &HoleRow, views: &Views) {
    let at = views.top(hole.at);
    let factor = views.scale.factor();
    if hole.slot {
        slot(svg, hole, at, factor);
        return;
    }
    let radius = (factor * hole.width / 2.0).max(0.18);
    if hole.plated {
        let _ = write!(
            svg,
            "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{PAPER}\" stroke=\"{}\" \
stroke-width=\"{}\"/>",
            number(at.x),
            number(at.y),
            number(radius),
            if hole.mounting { INK } else { MUTED },
            number(if hole.mounting { 0.28 } else { 0.18 })
        );
        let inner = (radius - 0.24).max(0.1);
        let _ = writeln!(
            svg,
            "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"none\" stroke=\"{MUTED}\" \
stroke-width=\"0.12\"/>",
            number(at.x),
            number(at.y),
            number(inner)
        );
    } else {
        let _ = writeln!(
            svg,
            "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{PAPER}\" stroke=\"{INK}\" \
stroke-width=\"{}\"/>",
            number(at.x),
            number(at.y),
            number(radius),
            number(if hole.mounting { 0.28 } else { 0.16 })
        );
        cross(svg, at, (radius + 0.5).max(0.65), 0.12);
    }
}

fn slot(svg: &mut String, hole: &HoleRow, at: Point, factor: f64) {
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
<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" rx=\"{}\" fill=\"{PAPER}\" \
stroke=\"{INK}\" stroke-width=\"0.18\"/></g>",
        number(at.x),
        number(at.y),
        number(-angle),
        number(-width / 2.0),
        number(-height / 2.0),
        number(width),
        number(height),
        number(height / 2.0)
    );
    if !hole.plated {
        cross(svg, at, width / 2.0 + 0.5, 0.12);
    }
}

fn cross(svg: &mut String, at: Point, arm: f64, width: f64) {
    let _ = writeln!(
        svg,
        "<path d=\"M{} {} L{} {} M{} {} L{} {}\" stroke=\"{INK}\" stroke-width=\"{width}\"/>",
        number(at.x - arm),
        number(at.y),
        number(at.x + arm),
        number(at.y),
        number(at.x),
        number(at.y - arm),
        number(at.x),
        number(at.y + arm)
    );
}

fn mounting_labels(svg: &mut String, board: &Board, views: &Views) {
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
        text_halo(svg, at.x, at.y + dy, 1.9, INK, "middle", &label);
    }
}

fn overhang_dimensions(svg: &mut String, board: &Board, views: &Views) {
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
        dimension_line(svg, start, end, 0.18);
        let value = format!("{} {} OVER", part.reference, millimetres(overhang.distance));
        let anchor = if text_at.x >= start.x && text_at.x >= end.x {
            "start"
        } else if text_at.x <= start.x && text_at.x <= end.x {
            "end"
        } else {
            "middle"
        };
        text_halo(svg, text_at.x, text_at.y, 1.9, INK, anchor, &value);
    }
}

fn overall_dimensions(svg: &mut String, board: &Board, views: &Views) {
    let left = views.top(Point {
        x: board.bounds.min_x,
        y: board.bounds.min_y,
    });
    let right = views.top(Point {
        x: board.bounds.max_x,
        y: board.bounds.max_y,
    });
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
    );
    text_halo(
        svg,
        (left.x + right.x) / 2.0,
        width_y - 1.6,
        2.4,
        INK,
        "middle",
        &millimetres(board.bounds.width()),
    );
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
    );
    rotated_text(
        svg,
        height_x - 1.6,
        (left.y + right.y) / 2.0,
        &millimetres(board.bounds.height()),
    );
}

fn ordinate_dimensions(svg: &mut String, board: &Board, views: &Views) {
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
        dimension_line(svg, Point { x: origin.x, y }, Point { x: at.x, y }, 0.15);
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
        );
        let value = format!("X {}", millimetres(x - board.origin.at.x));
        text_halo(
            svg,
            (origin.x + at.x) / 2.0,
            y - 1.3,
            1.9,
            INK,
            "middle",
            &value,
        );
    }
    for (index, y_value) in ys.iter().enumerate() {
        let at = views.top(Point {
            x: board.origin.at.x,
            y: *y_value,
        });
        let x = left.x - 18.0 - index as f64 * 5.0;
        dimension_line(svg, Point { x, y: origin.y }, Point { x, y: at.y }, 0.15);
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
        );
        let value = format!("Y {}", millimetres(board.origin.at.y - y_value));
        rotated_label(svg, x - 1.3, (origin.y + at.y) / 2.0, &value);
    }
}

fn unique(values: impl Iterator<Item = f64>) -> Vec<f64> {
    let mut set = BTreeSet::new();
    for value in values {
        set.insert((value * 1000.0).round() as i64);
    }
    set.into_iter().map(|value| value as f64 / 1000.0).collect()
}

fn origin_marker(svg: &mut String, board: &Board, views: &Views) {
    let at = views.top(board.origin.at);
    let _ = writeln!(
        svg,
        "<circle cx=\"{}\" cy=\"{}\" r=\"1.5\" fill=\"{PAPER}\" stroke=\"{INK}\" \
stroke-width=\"0.25\"/>",
        number(at.x),
        number(at.y)
    );
    cross(svg, at, 2.4, 0.15);
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
        INK,
        Face::SansBold,
        "start",
        label,
    );
}

// -------------------------------------------------------------- elevations

pub(super) fn elevation(svg: &mut String, board: &Board, views: &Views, side: bool, limit: f64) {
    let rect = if side {
        views.side_board
    } else {
        views.front_board
    };
    let _ = write!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"#f7f8fa\" \
stroke=\"{INK}\" stroke-width=\"{OUTLINE_MM}\"/>",
        number(rect.x),
        number(rect.y),
        number(rect.w),
        number(rect.h)
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
            if over_limit { OVER } else { BODY }
        );
    }
    height_dimensions(svg, board, views, side, limit);
}

struct DimAxis {
    x: f64,
    surface: f64,
    anchor: &'static str,
    side: bool,
}

fn height_dimensions(svg: &mut String, board: &Board, views: &Views, side: bool, limit: f64) {
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
    above_dimension(svg, board, views, &axis, limit);
    below_dimension(svg, board, views, &axis);
    thickness_leader(svg, board, rect, side, views.side_board.x - rect.right());
}

fn above_dimension(svg: &mut String, board: &Board, views: &Views, axis: &DimAxis, limit: f64) {
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
    );
    let reference = board
        .tallest_part()
        .map_or("?", |part| part.reference.as_str());
    let label = format!("{} ABOVE ({reference})", millimetres(above));
    text_halo(
        svg,
        axis.x + offset(axis.side),
        top - 1.2,
        2.1,
        INK,
        axis.anchor,
        &label,
    );
    if above > limit {
        text(
            svg,
            Point {
                x: axis.x + offset(axis.side),
                y: top + 3.2,
            },
            1.8,
            OVER,
            Face::SansBold,
            axis.anchor,
            "OVER LIMIT",
        );
    }
}

fn below_dimension(svg: &mut String, board: &Board, views: &Views, axis: &DimAxis) {
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
    );
    let reference = board
        .deepest_part()
        .map_or("?", |part| part.reference.as_str());
    let label = format!("{} BELOW ({reference})", millimetres(below));
    text_halo(
        svg,
        axis.x + offset(axis.side),
        bottom + 3.6,
        2.1,
        INK,
        axis.anchor,
        &label,
    );
}

fn offset(side: bool) -> f64 {
    if side { 1.4 } else { -1.4 }
}

fn thickness_leader(svg: &mut String, board: &Board, rect: Rect, side: bool, gap: f64) {
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
        "<path d=\"M{} {} L{} {}\" stroke=\"{MUTED}\" stroke-width=\"0.15\"/>",
        number(start.x),
        number(start.y),
        number(end.x),
        number(end.y)
    );
    text(
        svg,
        Point {
            x: end.x - 1.0,
            y: y - 1.2,
        },
        1.8,
        MUTED,
        Face::MonoMedium,
        "end",
        &format!("{} THK", millimetres(board.thickness)),
    );
}

// --------------------------------------------------------------- furniture

pub(super) fn view_labels(svg: &mut String, views: &Views) {
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
        INK,
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
        INK,
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
        INK,
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
        MUTED,
        Face::MonoMedium,
        "end",
        &format!("SCALE {}", views.scale.label()),
    );
}
