//! Pad shapes for the callout views: KiCad's authored pad token as a closed
//! ring in the board frame. A testpoint is a circle, a rectangle, a rounded
//! rectangle or a stadium; anything else falls back to its rectangle.
//!
//! The transform mirrors `geometry::FootprintTransform::apply` and
//! `FootprintInfo::pad_position`: a local point is rotated by the footprint's
//! angle in the board frame (KiCad's +y down convention).

use super::geometry::{Point, circle_ring};

/// One pad's authored shape: `shape` is KiCad's token (`circle`, `rect`,
/// `roundrect`, `oval`, `trapezoid`, `custom`).
pub(crate) fn pad_ring(
    shape: &str,
    size_x: f64,
    size_y: f64,
    roundrect_ratio: Option<f64>,
    center: Point,
    angle_deg: f64,
) -> Vec<Point> {
    let width = size_x.abs();
    let height = size_y.abs();
    if width <= 0.0 || height <= 0.0 {
        return Vec::new();
    }
    let local = match shape.trim().to_ascii_lowercase().as_str() {
        "circle" => circle_ring(Point { x: 0.0, y: 0.0 }, (width.max(height)) / 2.0),
        "oval" => oval_ring(width, height),
        "roundrect" => roundrect_ring(width, height, roundrect_ratio.unwrap_or(0.25)),
        _ => vec![
            Point {
                x: -width / 2.0,
                y: -height / 2.0,
            },
            Point {
                x: width / 2.0,
                y: -height / 2.0,
            },
            Point {
                x: width / 2.0,
                y: height / 2.0,
            },
            Point {
                x: -width / 2.0,
                y: height / 2.0,
            },
        ],
    };
    let (sin, cos) = angle_deg.to_radians().sin_cos();
    local
        .into_iter()
        .map(|point| Point {
            x: center.x + point.x * cos + point.y * sin,
            y: center.y - point.x * sin + point.y * cos,
        })
        .collect()
}

/// A stadium: the longer axis is straight, the shorter one is two half circles.
fn oval_ring(width: f64, height: f64) -> Vec<Point> {
    const ARC_STEPS: usize = 16;
    let (radius, half_length, horizontal) = if width >= height {
        (height / 2.0, (width - height) / 2.0, true)
    } else {
        (width / 2.0, (height - width) / 2.0, false)
    };
    let mut points = Vec::with_capacity(ARC_STEPS * 2 + 2);
    if horizontal {
        for index in 0..=ARC_STEPS {
            let angle = -std::f64::consts::FRAC_PI_2
                + std::f64::consts::PI * index as f64 / ARC_STEPS as f64;
            points.push(Point {
                x: half_length + radius * angle.cos(),
                y: radius * angle.sin(),
            });
        }
        for index in 0..=ARC_STEPS {
            let angle = std::f64::consts::FRAC_PI_2
                + std::f64::consts::PI * index as f64 / ARC_STEPS as f64;
            points.push(Point {
                x: -half_length + radius * angle.cos(),
                y: radius * angle.sin(),
            });
        }
    } else {
        for index in 0..=ARC_STEPS {
            let angle = std::f64::consts::PI * index as f64 / ARC_STEPS as f64;
            points.push(Point {
                x: radius * angle.cos(),
                y: half_length + radius * angle.sin(),
            });
        }
        for index in 0..=ARC_STEPS {
            let angle =
                std::f64::consts::PI + std::f64::consts::PI * index as f64 / ARC_STEPS as f64;
            points.push(Point {
                x: radius * angle.cos(),
                y: -half_length + radius * angle.sin(),
            });
        }
    }
    points
}

/// A rectangle with its corners rounded by `ratio * min(width, height)`.
fn roundrect_ring(width: f64, height: f64, ratio: f64) -> Vec<Point> {
    const CORNER_STEPS: usize = 8;
    let radius = (ratio.clamp(0.0, 0.5) * width.min(height)).max(0.0);
    if radius <= 1.0e-9 {
        return vec![
            Point {
                x: -width / 2.0,
                y: -height / 2.0,
            },
            Point {
                x: width / 2.0,
                y: -height / 2.0,
            },
            Point {
                x: width / 2.0,
                y: height / 2.0,
            },
            Point {
                x: -width / 2.0,
                y: height / 2.0,
            },
        ];
    }
    let half_x = width / 2.0 - radius;
    let half_y = height / 2.0 - radius;
    let mut points = Vec::with_capacity(CORNER_STEPS * 4 + 4);
    let corners = [
        (half_x, half_y, 0.0),
        (-half_x, half_y, std::f64::consts::FRAC_PI_2),
        (-half_x, -half_y, std::f64::consts::PI),
        (half_x, -half_y, 3.0 * std::f64::consts::FRAC_PI_2),
    ];
    for (corner_x, corner_y, start) in corners {
        for index in 0..=CORNER_STEPS {
            let angle = start + std::f64::consts::FRAC_PI_2 * index as f64 / CORNER_STEPS as f64;
            points.push(Point {
                x: corner_x + radius * angle.cos(),
                y: corner_y + radius * angle.sin(),
            });
        }
    }
    points
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::artwork::geometry::Bounds;

    #[test]
    fn a_circle_pad_is_its_diameter() {
        let ring = pad_ring("circle", 2.0, 2.0, None, Point { x: 5.0, y: 5.0 }, 0.0);
        let bounds = Bounds::of_ring(&ring);
        assert!((bounds.width() - 2.0).abs() < 1.0e-9);
        assert!((bounds.height() - 2.0).abs() < 1.0e-9);
    }

    #[test]
    fn an_oval_pad_keeps_its_long_axis() {
        let ring = pad_ring("oval", 4.0, 1.0, None, Point { x: 0.0, y: 0.0 }, 0.0);
        let bounds = Bounds::of_ring(&ring);
        assert!((bounds.width() - 4.0).abs() < 1.0e-9);
        assert!((bounds.height() - 1.0).abs() < 1.0e-9);
        let vertical = pad_ring("oval", 1.0, 4.0, None, Point { x: 0.0, y: 0.0 }, 0.0);
        let bounds = Bounds::of_ring(&vertical);
        assert!((bounds.width() - 1.0).abs() < 1.0e-9);
        assert!((bounds.height() - 4.0).abs() < 1.0e-9);
    }

    #[test]
    fn a_roundrect_stays_inside_its_rectangle() {
        let ring = pad_ring(
            "roundrect",
            4.0,
            2.0,
            Some(0.25),
            Point { x: 0.0, y: 0.0 },
            0.0,
        );
        let bounds = Bounds::of_ring(&ring);
        assert!((bounds.width() - 4.0).abs() < 1.0e-9);
        assert!((bounds.height() - 2.0).abs() < 1.0e-9);
    }

    #[test]
    fn a_rotated_rect_swaps_its_extents() {
        let ring = pad_ring("rect", 4.0, 1.0, None, Point { x: 0.0, y: 0.0 }, 90.0);
        let bounds = Bounds::of_ring(&ring);
        assert!((bounds.width() - 1.0).abs() < 1.0e-9);
        assert!((bounds.height() - 4.0).abs() < 1.0e-9);
    }
}
