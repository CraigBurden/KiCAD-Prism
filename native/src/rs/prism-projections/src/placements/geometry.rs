//! Graphics geometry for `placements`.
//!
//! Ports `placements_build.py:118-215`: `floormod`, the arc-extreme rule of
//! R8a (`arc_points`, `:124-147`), the characteristic points of one graphic
//! (`graphic_points`, `:150-176`), the point box (`bounds`, `:179-185`), and
//! KiCad's integer-nanometre `RotatePoint` (`eda_sin_cos`, `rotate_point`,
//! `:188-214`). Every transcendental call goes through the pure-Rust `libm`
//! crate, as the contract names (conventions §14).

use super::numbers::kiround;
use super::tree::{as_list, child, is_form, xy};
use prism_kicad_core::sexpr::Sexp;
use std::f64::consts::{PI, TAU};

/// The exact `EDA_ANGLE` sine/cosine at odd multiples of 45° (`M_SQRT1_2`,
/// `placements_build.py:37`).
const SQRT1_2: f64 = std::f64::consts::FRAC_1_SQRT_2;

/// Python's float `%` for a positive divisor (R8a step 3, `:118-121`).
pub(crate) fn floormod(a: f64, m: f64) -> f64 {
    let remainder = a % m;
    if remainder != 0.0 && (remainder < 0.0) != (m < 0.0) {
        remainder + m
    } else {
        remainder
    }
}

/// R8a: an arc's characteristic points, operation for operation
/// (`placements_build.py:124-147`).
pub(crate) fn arc_points(a: (f64, f64), m: (f64, f64), b: (f64, f64)) -> Vec<(f64, f64)> {
    let (ax, ay) = a;
    let (mx, my) = m;
    let (bx, by) = b;
    let mut points = vec![a, m, b];
    let d = 2.0 * (ax * (my - by) + mx * (by - ay) + bx * (ay - my));
    if d.abs() < 1e-12 {
        return points;
    }
    let ux = ((ax * ax + ay * ay) * (my - by)
        + (mx * mx + my * my) * (by - ay)
        + (bx * bx + by * by) * (ay - my))
        / d;
    let uy = ((ax * ax + ay * ay) * (bx - mx)
        + (mx * mx + my * my) * (ax - bx)
        + (bx * bx + by * by) * (mx - ax))
        / d;
    let radius = libm::hypot(ax - ux, ay - uy);
    let angle = |x: f64, y: f64| floormod(libm::atan2(y - uy, x - ux), TAU);
    let mut start = angle(ax, ay);
    let mid = angle(mx, my);
    let end = angle(bx, by);
    let mut sweep = floormod(end - start, TAU);
    if floormod(mid - start, TAU) > sweep {
        start = end;
        sweep = TAU - sweep;
    }
    for quarter in 0..4 {
        let theta = f64::from(quarter) * PI / 2.0;
        if floormod(theta - start, TAU) <= sweep {
            points.push((
                ux + radius * libm::cos(theta),
                uy + radius * libm::sin(theta),
            ));
        }
    }
    points
}

/// R8: the characteristic points of one graphic, in its written frame
/// (`placements_build.py:150-176`).
pub(crate) fn graphic_points(form: &Sexp, kind: &str) -> Vec<(f64, f64)> {
    match kind {
        "line" | "rect" => segment_points(form),
        "circle" => circle_points(form),
        "arc" => arc_points_of(form),
        "poly" | "curve" => poly_points(form, kind),
        _ => Vec::new(),
    }
}

/// A line's or rectangle's written `(start …)` and `(end …)`
/// (`placements_build.py:150-153`).
fn segment_points(form: &Sexp) -> Vec<(f64, f64)> {
    let mut out = Vec::new();
    for name in ["start", "end"] {
        if let Some(point) = xy(child(Some(form), name)) {
            out.push(point);
        }
    }
    out
}

/// A circle's bounding-box corners, from its centre and one end
/// (`placements_build.py:154-159`).
fn circle_points(form: &Sexp) -> Vec<(f64, f64)> {
    let (Some(centre), Some(end)) = (
        xy(child(Some(form), "center")),
        xy(child(Some(form), "end")),
    ) else {
        return Vec::new();
    };
    let radius = libm::hypot(end.0 - centre.0, end.1 - centre.1);
    vec![
        (centre.0 - radius, centre.1 - radius),
        (centre.0 + radius, centre.1 + radius),
    ]
}

/// An arc's characteristic points, from `(start …)`, `(mid …)` and `(end …)`
/// (`placements_build.py:160-163`).
fn arc_points_of(form: &Sexp) -> Vec<(f64, f64)> {
    let (Some(a), Some(m), Some(b)) = (
        xy(child(Some(form), "start")),
        xy(child(Some(form), "mid")),
        xy(child(Some(form), "end")),
    ) else {
        return Vec::new();
    };
    arc_points(a, m, b)
}

/// A polygon's or Bezier curve's `(pts …)`: every `(xy …)` element and, for a
/// polygon only, every `(arc …)` element (`placements_build.py:164-176`).
fn poly_points(form: &Sexp, kind: &str) -> Vec<(f64, f64)> {
    let Some(elements) = child(Some(form), "pts").and_then(as_list) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for element in elements.get(1..).unwrap_or_default() {
        if is_form(element, Some("xy")) {
            if let Some(point) = xy(Some(element)) {
                out.push(point);
            }
        } else if kind == "poly" && is_form(element, Some("arc")) {
            out.extend(arc_points_of(element));
        }
    }
    out
}

/// The minimum and maximum x and y over `points`, or `None` when empty
/// (`placements_build.py:179-185`).
pub(crate) fn point_bounds(points: &[(f64, f64)]) -> Option<((f64, f64), (f64, f64))> {
    let (first, rest) = points.split_first()?;
    let mut min = *first;
    let mut max = *first;
    for point in rest {
        min.0 = min.0.min(point.0);
        min.1 = min.1.min(point.1);
        max.0 = max.0.max(point.0);
        max.1 = max.1.max(point.1);
    }
    Some((min, max))
}

/// `EDA_ANGLE::Sin`/`Cos` for θ in [0, 360) (`placements_build.py:188-198`).
pub(crate) fn eda_sin_cos(theta: f64) -> (f64, f64) {
    match theta {
        0.0 => (0.0, 1.0),
        90.0 => (1.0, 0.0),
        180.0 => (0.0, -1.0),
        270.0 => (-1.0, 0.0),
        45.0 => (SQRT1_2, SQRT1_2),
        135.0 => (SQRT1_2, -SQRT1_2),
        225.0 => (-SQRT1_2, -SQRT1_2),
        315.0 => (-SQRT1_2, SQRT1_2),
        _ => {
            let radians = theta * PI / 180.0;
            (libm::sin(radians), libm::cos(radians))
        }
    }
}

/// KiCad's `RotatePoint` of an integer-nanometre point
/// (`placements_build.py:201-214`).
pub(crate) fn rotate_point(lx: i64, ly: i64, rotation: f64) -> (i64, i64) {
    let theta = floormod(rotation, 360.0);
    if theta == 0.0 {
        return (lx, ly);
    }
    if theta == 90.0 {
        return (ly, -lx);
    }
    if theta == 180.0 {
        return (-lx, -ly);
    }
    if theta == 270.0 {
        return (-ly, lx);
    }
    let (sin, cos) = eda_sin_cos(theta);
    (
        kiround(ly as f64 * sin + lx as f64 * cos),
        kiround(ly as f64 * cos - lx as f64 * sin),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn floormod_is_pythons_float_modulo() {
        assert_eq!(floormod(-90.0, 360.0), 270.0);
        assert_eq!(floormod(370.0, 360.0), 10.0);
        assert_eq!(floormod(0.0, TAU), 0.0);
        assert_eq!(floormod(TAU, TAU), 0.0);
        assert_eq!(floormod(-1.0, 360.0), 359.0);
    }

    #[test]
    fn rotate_point_is_exact_at_right_angles() {
        assert_eq!(rotate_point(100, 200, 0.0), (100, 200));
        assert_eq!(rotate_point(100, 200, 90.0), (200, -100));
        assert_eq!(rotate_point(100, 200, 180.0), (-100, -200));
        assert_eq!(rotate_point(100, 200, 270.0), (-200, 100));
        // Normalized into [0, 360) first.
        assert_eq!(rotate_point(100, 200, -90.0), (-200, 100));
        assert_eq!(rotate_point(100, 200, 450.0), (200, -100));
    }

    #[test]
    fn rotate_point_at_45_uses_the_exact_root_half() {
        // (ly·s + lx·c, ly·c − lx·s) with s = c = √½.
        assert_eq!(rotate_point(1000, 0, 45.0), (707, -707));
        assert_eq!(rotate_point(0, 1000, 45.0), (707, 707));
        assert_eq!(rotate_point(1000, 0, 225.0), (-707, 707));
    }

    #[test]
    fn rotate_point_at_a_non_multiple_of_45_uses_libm() {
        let theta = 30.0_f64;
        let radians = theta * PI / 180.0;
        let (sin, cos) = (libm::sin(radians), libm::cos(radians));
        let (lx, ly) = (1000_i64, 0_i64);
        let expected = (
            kiround(ly as f64 * sin + lx as f64 * cos),
            kiround(ly as f64 * cos - lx as f64 * sin),
        );
        assert_eq!(rotate_point(lx, ly, theta), expected);
        // A non-zero local y exercises both terms of each coordinate.
        let (lx, ly) = (300_i64, 400_i64);
        let expected = (
            kiround(ly as f64 * sin + lx as f64 * cos),
            kiround(ly as f64 * cos - lx as f64 * sin),
        );
        assert_eq!(rotate_point(lx, ly, theta), expected);
    }

    #[test]
    fn arc_points_adds_every_cardinal_extreme_it_sweeps_through() {
        // A semicircle of radius 1 about (0, 0): start (1, 0), mid (0, 1),
        // end (-1, 0), sweeping 180° through 90°. The three given points and
        // the three cardinal points it reaches (0°, 90°, 180°) are returned.
        let points = arc_points((1.0, 0.0), (0.0, 1.0), (-1.0, 0.0));
        assert_eq!(points.len(), 6);
        assert_eq!(points[0], (1.0, 0.0));
        assert_eq!(points[1], (0.0, 1.0));
        assert_eq!(points[2], (-1.0, 0.0));
        // The cardinal points sit on the circle to within libm's accuracy.
        let ((min_x, min_y), (max_x, max_y)) = point_bounds(&points).expect("non-empty");
        assert!((min_x + 1.0).abs() < 1e-9, "min x {min_x}");
        assert!(min_y.abs() < 1e-9, "min y {min_y}");
        assert!((max_x - 1.0).abs() < 1e-9, "max x {max_x}");
        assert!((max_y - 1.0).abs() < 1e-9, "max y {max_y}");
    }

    #[test]
    fn arc_points_stops_on_a_degenerate_arc() {
        // Collinear start/mid/end: d == 0, only the three given points remain.
        let points = arc_points((0.0, 0.0), (1.0, 0.0), (2.0, 0.0));
        assert_eq!(points, vec![(0.0, 0.0), (1.0, 0.0), (2.0, 0.0)]);
    }

    #[test]
    fn point_bounds_of_nothing_is_none() {
        assert!(point_bounds(&[]).is_none());
    }
}
