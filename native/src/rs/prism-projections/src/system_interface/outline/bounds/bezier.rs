//! Bezier flattening for board `Curve` graphics: `bezier_bounds`,
//! `bezier_to_polyline` and `_subdivide_bezier`
//! (`km:kicad_pcb_shape_bounds.py:133-145`, `km:kicad_pcb_polygon_ops.py:567-625`).

use super::DEFAULT_ERROR_MM;
use super::graphics::bounds_from_points;
use prism_kicad_core::PcbPoint;

/// `bezier_bounds` (`km:kicad_pcb_shape_bounds.py:133-145`).
pub(super) fn bezier_bounds(points: &[PcbPoint], width: f64) -> super::Bounds {
    if points.len() != 4 {
        return bounds_from_points(points, width);
    }
    let polyline = bezier_to_polyline(points[0], points[1], points[2], points[3], DEFAULT_ERROR_MM);
    let polyline = if polyline.is_empty() {
        points.to_vec()
    } else {
        polyline
    };
    bounds_from_points(&polyline, width)
}

/// `bezier_to_polyline` (`km:kicad_pcb_polygon_ops.py:567-586`).
fn bezier_to_polyline(
    p0: PcbPoint,
    p1: PcbPoint,
    p2: PcbPoint,
    p3: PcbPoint,
    error: f64,
) -> Vec<PcbPoint> {
    let mut points = vec![p0];
    subdivide_bezier(p0, p1, p2, p3, error * error, &mut points);
    points.push(p3);
    points
}

/// `_subdivide_bezier` (`km:kicad_pcb_polygon_ops.py:589-625`).
fn subdivide_bezier(
    p0: PcbPoint,
    p1: PcbPoint,
    p2: PcbPoint,
    p3: PcbPoint,
    error_sq: f64,
    points: &mut Vec<PcbPoint>,
) {
    let dx = p3.x - p0.x;
    let dy = p3.y - p0.y;
    let len_sq = dx * dx + dy * dy;
    if len_sq < 1e-10 {
        return;
    }
    let d1 = ((p1.x - p0.x) * dy - (p1.y - p0.y) * dx).abs();
    let d2 = ((p2.x - p0.x) * dy - (p2.y - p0.y) * dx).abs();
    let max_d_sq = (d1 * d1).max(d2 * d2) / len_sq;
    if max_d_sq <= error_sq {
        return;
    }
    let m01 = midpoint(p0, p1);
    let m12 = midpoint(p1, p2);
    let m23 = midpoint(p2, p3);
    let m012 = midpoint(m01, m12);
    let m123 = midpoint(m12, m23);
    let mid = midpoint(m012, m123);
    subdivide_bezier(p0, m01, m012, mid, error_sq, points);
    points.push(mid);
    subdivide_bezier(mid, m123, m23, p3, error_sq, points);
}

fn midpoint(a: PcbPoint, b: PcbPoint) -> PcbPoint {
    PcbPoint {
        x: (a.x + b.x) / 2.0,
        y: (a.y + b.y) / 2.0,
    }
}
