//! Arc geometry: `_calc_arc_center`, `_arc_sweep`, `_angle_on_sweep` and
//! `_normalize_angle` (`km:kicad_pcb_polygon_ops.py`), `arc_bounds`
//! (`km:kicad_pcb_shape_bounds.py:99-125`), and routing arcs through
//! `arc_to_polygon` / `oval_to_polygon` / `circle_to_polygon` /
//! `get_arc_segment_count` (`km:kicad_pcb_polygon_ops.py:123-457`).

use super::graphics::bounds_from_points;
use super::{Bounds, DEFAULT_ERROR_MM, PI};
use prism_kicad_core::{PcbPoint, PcbRoutingArc};

/// `arc_bounds` (`km:kicad_pcb_shape_bounds.py:99-125`).
pub(super) fn arc_bounds(start: PcbPoint, mid: PcbPoint, end: PcbPoint, width: f64) -> Bounds {
    let (center, radius) = calc_arc_center(start, mid, end);
    let Some(center) = center else {
        return bounds_from_points(&[start, end], width);
    };
    if radius <= 0.0 {
        return bounds_from_points(&[start, end], width);
    }
    let start_angle = libm::atan2(start.y - center.y, start.x - center.x);
    let mid_angle = libm::atan2(mid.y - center.y, mid.x - center.x);
    let end_angle = libm::atan2(end.y - center.y, end.x - center.x);
    let sweep = arc_sweep(start_angle, mid_angle, end_angle);
    let mut points = vec![start, end];
    for angle in [0.0, PI / 2.0, PI, 3.0 * PI / 2.0] {
        if angle_on_sweep(angle, start_angle, sweep) {
            points.push(polar(center, radius, angle));
        }
    }
    bounds_from_points(&points, width)
}

/// `_calc_arc_center` (`km:kicad_pcb_polygon_ops.py:672-701`). Uses
/// `math.sqrt`, distinct from `_arc_points`' `math.hypot`.
fn calc_arc_center(start: PcbPoint, mid: PcbPoint, end: PcbPoint) -> (Option<PcbPoint>, f64) {
    let (ax, ay) = (start.x, start.y);
    let (bx, by) = (mid.x, mid.y);
    let (cx, cy) = (end.x, end.y);
    let d = 2.0 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if d.abs() < 1e-10 {
        return (None, 0.0);
    }
    let ux = ((ax * ax + ay * ay) * (by - cy)
        + (bx * bx + by * by) * (cy - ay)
        + (cx * cx + cy * cy) * (ay - by))
        / d;
    let uy = ((ax * ax + ay * ay) * (cx - bx)
        + (bx * bx + by * by) * (ax - cx)
        + (cx * cx + cy * cy) * (bx - ax))
        / d;
    let radius = ((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy)).sqrt();
    (Some(PcbPoint { x: ux, y: uy }), radius)
}

/// `_arc_sweep` (`km:kicad_pcb_shape_bounds.py:73-83`).
fn arc_sweep(start_angle: f64, mid_angle: f64, end_angle: f64) -> f64 {
    let mut sweep = normalize_angle(end_angle - start_angle);
    let mid_offset = normalize_angle(mid_angle - start_angle);
    if sweep >= 0.0 {
        if mid_offset < 0.0 || mid_offset > sweep {
            sweep -= 2.0 * PI;
        }
    } else if mid_offset > 0.0 || mid_offset < sweep {
        sweep += 2.0 * PI;
    }
    sweep
}

/// `_angle_on_sweep` (`km:kicad_pcb_shape_bounds.py:86-96`).
fn angle_on_sweep(angle: f64, start_angle: f64, sweep: f64) -> bool {
    const EPS: f64 = 1e-10;
    let mut offset = normalize_angle(angle - start_angle);
    if sweep >= 0.0 {
        if offset < -EPS {
            offset += 2.0 * PI;
        }
        -EPS <= offset && offset <= sweep + EPS
    } else {
        if offset > EPS {
            offset -= 2.0 * PI;
        }
        sweep - EPS <= offset && offset <= EPS
    }
}

/// `_normalize_angle` (`km:kicad_pcb_polygon_ops.py:704-710`).
fn normalize_angle(angle: f64) -> f64 {
    let mut angle = angle;
    while angle > PI {
        angle -= 2.0 * PI;
    }
    while angle < -PI {
        angle += 2.0 * PI;
    }
    angle
}

/// `Arc.get_bounds` (`km:kicad_pcb_routing.py:446-460`): the outline of
/// `arc_to_polygon` (`km:kicad_pcb_polygon_ops.py:332-457`), whose winding
/// normalisation does not change the extent.
pub(super) fn routing_arc_box(arc: &PcbRoutingArc) -> Bounds {
    let width = arc.width.unwrap_or(0.0);
    if width <= 0.0 {
        return Bounds::empty();
    }
    let points = arc_to_polygon(arc.start, arc.mid, arc.end, width, DEFAULT_ERROR_MM);
    let mut bounds = Bounds::empty();
    for point in points {
        bounds.expand(point.x, point.y);
    }
    bounds
}

/// A point at `angle` on the circle of `radius` about `center`.
fn polar(center: PcbPoint, radius: f64, angle: f64) -> PcbPoint {
    PcbPoint {
        x: center.x + radius * libm::cos(angle),
        y: center.y + radius * libm::sin(angle),
    }
}

/// One rounded cap of a thick arc: `cap_segs - 1` interior points swept from
/// `cap_start` by `∓cap_delta` per step, counter-clockwise when `ccw`.
fn push_cap(
    points: &mut Vec<PcbPoint>,
    cap_center: PcbPoint,
    half_width: f64,
    cap_start: f64,
    cap_segs: i64,
    cap_delta: f64,
    ccw: bool,
) {
    for i in 1..cap_segs {
        let angle = if ccw {
            cap_start - (i as f64) * cap_delta
        } else {
            cap_start + (i as f64) * cap_delta
        };
        points.push(polar(cap_center, half_width, angle));
    }
}

/// `arc_to_polygon` (`km:kicad_pcb_polygon_ops.py:332-457`).
fn arc_to_polygon(
    start: PcbPoint,
    mid: PcbPoint,
    end: PcbPoint,
    width: f64,
    error: f64,
) -> Vec<PcbPoint> {
    let (center, radius) = calc_arc_center(start, mid, end);
    let Some(center) = center else {
        return oval_to_polygon(start, end, width, error);
    };
    if radius <= 0.0 {
        return oval_to_polygon(start, end, width, error);
    }
    let start_angle = libm::atan2(start.y - center.y, start.x - center.x);
    let mid_angle = libm::atan2(mid.y - center.y, mid.x - center.x);
    let end_angle = libm::atan2(end.y - center.y, end.x - center.x);
    let arc_angle = arc_sweep(start_angle, mid_angle, end_angle);
    let half_width = width / 2.0;
    let outer_radius = radius + half_width;
    let inner_radius = radius - half_width;
    let arc_len_deg = (arc_angle * (180.0 / PI)).abs();
    let num_segs = get_arc_segment_count(outer_radius, error, arc_len_deg).max(8);
    let delta = arc_angle / (num_segs as f64);
    let cap_segs = (num_segs / 4).max(4);
    let cap_delta = PI / (cap_segs as f64);
    let ccw = arc_angle >= 0.0;
    let mut points = Vec::new();
    for i in 0..=num_segs {
        let angle = start_angle + (i as f64) * delta;
        points.push(polar(center, outer_radius, angle));
    }
    let end_cap_start = end_angle + if ccw { PI / 2.0 } else { -PI / 2.0 };
    push_cap(
        &mut points,
        polar(center, radius, end_angle),
        half_width,
        end_cap_start,
        cap_segs,
        cap_delta,
        ccw,
    );
    if inner_radius > 0.0 {
        for i in 0..=num_segs {
            let angle = start_angle + arc_angle - (i as f64) * delta;
            points.push(polar(center, inner_radius, angle));
        }
    } else {
        points.push(center);
    }
    let start_cap_start = start_angle + if ccw { -PI / 2.0 } else { PI / 2.0 };
    push_cap(
        &mut points,
        polar(center, radius, start_angle),
        half_width,
        start_cap_start,
        cap_segs,
        cap_delta,
        ccw,
    );
    points
}

/// `oval_to_polygon` (`km:kicad_pcb_polygon_ops.py:254-329`).
fn oval_to_polygon(start: PcbPoint, end: PcbPoint, width: f64, error: f64) -> Vec<PcbPoint> {
    if width <= 0.0 {
        return Vec::new();
    }
    let radius = width / 2.0;
    let num_segs = get_arc_segment_count(radius, error, 360.0).max(8);
    let num_segs = ((num_segs + 7) / 8) * 8;
    let half_segs = num_segs / 2;
    let delta = PI / (half_segs as f64);
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let seg_len = (dx * dx + dy * dy).sqrt();
    if seg_len < 1e-10 {
        return circle_to_polygon(start, radius, error);
    }
    let ux = dx / seg_len;
    let uy = dy / seg_len;
    let px = -uy;
    let py = ux;
    let mut points = Vec::new();
    for i in 0..=half_segs {
        let angle = -PI / 2.0 + (i as f64) * delta;
        let rx = libm::cos(angle);
        let ry = libm::sin(angle);
        points.push(PcbPoint {
            x: end.x + radius * (rx * ux + ry * px),
            y: end.y + radius * (rx * uy + ry * py),
        });
    }
    for i in 0..=half_segs {
        let angle = PI / 2.0 + (i as f64) * delta;
        let rx = libm::cos(angle);
        let ry = libm::sin(angle);
        points.push(PcbPoint {
            x: start.x + radius * (rx * ux + ry * px),
            y: start.y + radius * (rx * uy + ry * py),
        });
    }
    points
}

/// `circle_to_polygon` (`km:kicad_pcb_polygon_ops.py:212-251`).
fn circle_to_polygon(center: PcbPoint, radius: f64, error: f64) -> Vec<PcbPoint> {
    if radius <= 0.0 {
        return Vec::new();
    }
    let num_segs = get_arc_segment_count(radius, error, 360.0).max(8);
    let num_segs = ((num_segs + 7) / 8) * 8;
    let delta = 2.0 * PI / (num_segs as f64);
    let mut points = Vec::with_capacity(num_segs as usize);
    for i in 0..num_segs {
        let angle = delta / 2.0 + (i as f64) * delta;
        points.push(polar(center, radius, angle));
    }
    points
}

/// `get_arc_segment_count` (`km:kicad_pcb_polygon_ops.py:123-172`). Python's
/// `round()` ties to even, which `libm::rint` reproduces.
fn get_arc_segment_count(radius: f64, error: f64, arc_angle_deg: f64) -> i64 {
    let radius = radius.abs().max(1e-6);
    let error = error.abs().max(1e-6);
    let rel_error = error / radius;
    let cos_arg = (1.0 - rel_error).clamp(-1.0, 1.0);
    let mut arc_increment = (180.0 / PI) * libm::acos(cos_arg) * 2.0;
    arc_increment = arc_increment.min(360.0 / 8.0);
    if arc_increment <= 0.0 {
        return 8;
    }
    let seg_count = libm::rint(arc_angle_deg.abs() / arc_increment) as i64;
    seg_count.max(2)
}
