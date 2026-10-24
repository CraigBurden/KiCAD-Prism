//! R2 track length (`contracts/prism/field-maps/route-metrics.md:36-44`):
//! today's `segment_length` (`backend/design-compare-parser/ecad-parse.mjs:1313-1347`),
//! operation for operation.
//!
//! A `segment` is the straight start-to-end distance; an `arc` is the circle
//! through start, mid and end, or the polyline start-mid-end when the three
//! points are collinear (`:1323-1326`). Coordinates are the fork's parsed
//! binary64 millimetres, matching today's parser tokens.
//!
//! `hypot` and `atan2` are the pure-Rust `libm` crate's (conventions.md §14),
//! so the totals are the same bits on every architecture. `%` on `f64` is the
//! truncating remainder (C `fmod`), exactly as JS's `%` (`:1340-1344`).

use libm::{atan2, hypot};
use prism_kicad_core::PcbPoint;

/// The collinearity threshold (`ecad-parse.mjs:1324`).
const DETERMINANT_EPSILON: f64 = 1e-12;

/// `distance(a, b)` (`ecad-parse.mjs:1313-1314`): the straight distance
/// between two points, in millimetres.
pub(super) fn distance(ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    hypot(bx - ax, by - ay)
}

/// A `segment` form's length (`ecad-parse.mjs:1316-1319`): the straight
/// start-to-end distance. The fork rejects a segment without a start or end
/// before this runs (field map D5), so both are always present.
pub(super) fn segment(segment: &prism_kicad_core::PcbSegment) -> f64 {
    distance(
        segment.start_x,
        segment.start_y,
        segment.end_x,
        segment.end_y,
    )
}

/// An `arc` form's length (`ecad-parse.mjs:1320-1347`): the circular arc
/// through `a` (start), `b` (mid) and `c` (end), or the polyline `a-b-c` when
/// the points are collinear.
pub(super) fn arc(a: PcbPoint, b: PcbPoint, c: PcbPoint) -> f64 {
    let determinant = 2.0 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if determinant.abs() < DETERMINANT_EPSILON {
        return distance(a.x, a.y, b.x, b.y) + distance(b.x, b.y, c.x, c.y);
    }
    let aa = a.x * a.x + a.y * a.y;
    let bb = b.x * b.x + b.y * b.y;
    let cc = c.x * c.x + c.y * c.y;
    let ux = (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / determinant;
    let uy = (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / determinant;
    let radius = hypot(a.x - ux, a.y - uy);
    // `tau = Math.PI * 2` (`:1339`); `angle(p) = atan2(p.y - uy, p.x - ux)`
    // (`:1338`); the sweep follows `:1340-1345` verbatim, truncating `%`.
    let tau = std::f64::consts::PI * 2.0;
    let start = atan2(a.y - uy, a.x - ux);
    let ccw = ((atan2(c.y - uy, c.x - ux) - start) % tau + tau) % tau;
    let mid_ccw = ((atan2(b.y - uy, b.x - ux) - start) % tau + tau) % tau;
    let sweep = if mid_ccw <= ccw + 1e-9 {
        ccw
    } else {
        tau - ccw
    };
    radius * sweep
}

#[cfg(test)]
mod tests {
    use super::*;

    fn point(x: f64, y: f64) -> PcbPoint {
        PcbPoint { x, y }
    }

    #[test]
    fn segment_is_the_straight_distance() {
        assert_eq!(distance(0.0, 0.0, 3.0, 4.0), 5.0);
    }

    #[test]
    fn a_degenerate_determinant_is_the_start_mid_end_polyline() {
        // Collinear points: `|det| < 1e-12`, so the length is
        // `hypot(b-a) + hypot(c-b)` (`ecad-parse.mjs:1323-1326`).
        let length = arc(point(0.0, 0.0), point(1.0, 0.0), point(2.0, 0.0));
        assert_eq!(length, 2.0);
        let reversed = arc(point(2.0, 0.0), point(1.0, 0.0), point(0.0, 0.0));
        assert_eq!(reversed, 2.0);
    }

    #[test]
    fn a_half_circle_has_radius_pi() {
        // Start (1, 0), mid (0, 1), end (-1, 0): the unit circle, clockwise in
        // KiCad's y-down frame, half a turn: length pi.
        let length = arc(point(1.0, 0.0), point(0.0, 1.0), point(-1.0, 0.0));
        assert!((length - std::f64::consts::PI).abs() < 1e-12);
    }
}
