//! Pad facts: a parsed pad's shape in pad-local coordinates, ready to draw.
//!
//! Custom pads keep their authored primitives as rings; the anchor shape the
//! pad's `(options (anchor …))` names is drawn from the pad's own size.

use prism_artwork::artwork::geometry::{self, Point};
use prism_kicad_core::{PcbPad, PcbPadPrimitiveGeometry, PcbPolygonPoint};

use super::model::{Pad, PadShape};

/// A board file stores a pad's angle in the board frame, already including its
/// footprint's rotation; the drawing turns pads inside the footprint's own
/// transform, so the footprint's angle comes off here.
pub fn pad_facts(pad: &PcbPad, footprint_angle: f64) -> Pad {
    Pad {
        net: pad.net.name.clone().unwrap_or_default(),
        layers: pad.layers.clone(),
        x: pad.at_x,
        y: pad.at_y,
        angle: pad.angle - footprint_angle,
        shape: pad_shape(pad),
    }
}

fn pad_shape(pad: &PcbPad) -> PadShape {
    let width = pad.size_x.abs();
    let height = pad.size_y.abs();
    match pad.shape.as_str() {
        "circle" => PadShape::Circle {
            diameter: width.min(height),
        },
        "oval" => PadShape::Oval { width, height },
        "roundrect" => PadShape::RoundRect {
            width,
            height,
            radius: pad.roundrect_rratio.unwrap_or(0.25) * width.min(height),
        },
        "custom" => PadShape::Custom {
            width,
            height,
            anchor_circle: pad
                .custom_options
                .as_ref()
                .and_then(|options| options.anchor.as_deref())
                == Some("circle"),
            rings: custom_rings(pad),
        },
        _ => PadShape::Rect { width, height },
    }
}

fn custom_rings(pad: &PcbPad) -> Vec<Vec<Point>> {
    pad.custom_primitives
        .iter()
        .filter_map(|primitive| primitive.geometry.as_ref())
        .flat_map(primitive_rings)
        .collect()
}

fn primitive_rings(geometry: &PcbPadPrimitiveGeometry) -> Vec<Vec<Point>> {
    match geometry {
        PcbPadPrimitiveGeometry::Polygon { points } => vec![polygon_ring(points)],
        PcbPadPrimitiveGeometry::Rect { start, end, .. } => vec![rect_ring(*start, *end)],
        PcbPadPrimitiveGeometry::Circle { center, end } => vec![circle_ring(*center, *end)],
        _ => Vec::new(),
    }
}

fn polygon_ring(points: &[PcbPolygonPoint]) -> Vec<Point> {
    let mut ring = Vec::new();
    for point in points {
        match point {
            PcbPolygonPoint::Xy(point) => ring.push(Point::from(*point)),
            PcbPolygonPoint::Arc { start, mid, end } => {
                let arc =
                    geometry::sample_arc(Point::from(*start), Point::from(*mid), Point::from(*end));
                let skip = usize::from(
                    ring.last()
                        .is_some_and(|last| last.x == arc[0].x && last.y == arc[0].y),
                );
                ring.extend_from_slice(&arc[skip..]);
            }
        }
    }
    ring
}

fn rect_ring(start: prism_kicad_core::PcbPoint, end: prism_kicad_core::PcbPoint) -> Vec<Point> {
    vec![
        Point {
            x: start.x,
            y: start.y,
        },
        Point {
            x: end.x,
            y: start.y,
        },
        Point { x: end.x, y: end.y },
        Point {
            x: start.x,
            y: end.y,
        },
    ]
}

fn circle_ring(center: prism_kicad_core::PcbPoint, end: prism_kicad_core::PcbPoint) -> Vec<Point> {
    const STEPS: usize = 48;
    let radius = ((end.x - center.x).powi(2) + (end.y - center.y).powi(2)).sqrt();
    (0..STEPS)
        .map(|index| {
            let angle = 2.0 * std::f64::consts::PI * index as f64 / STEPS as f64;
            Point {
                x: center.x + angle.cos() * radius,
                y: center.y + angle.sin() * radius,
            }
        })
        .collect()
}
