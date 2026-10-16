//! `boardThicknessMm` and `boardOutlineMm`, a port of `_board_outline`,
//! `_outline_points` and `_arc_points` (interface_extractor.py:265-321), with
//! kicad_monkey's `KiCadPcb.get_bounds()` as the fallback for a board without
//! board-level Edge.Cuts graphics.
//!
//! `boardThicknessMm` is today's `_round(board.thickness)` (ie:458);
//! kicad_monkey's `board.thickness` defaults to 1.6 when `(general
//! (thickness …))` is missing (km `kicad_pcb.py:290`, `kicad_defaults.py:16`),
//! so a board without an authored thickness reports 1.6, not null.
//!
//! `boardOutlineMm` collects the board-level (`owner_kind == "board"`)
//! Edge.Cuts carriers (`ie:265-321`) and takes the board-frame extent of
//! their points. When it finds none, it falls back to the whole board's
//! items: [`bounds::board_bounds`], a port of `KiCadPcb.get_bounds()` with
//! `source: "items"`, or `None` for an empty box.
//!
//! The board frame is KiCad's frame with `y` negated (ie:320-321, `SB2`
//! §14.2): `minMm = [_round(min x), _round(min −y)]`.

mod bounds;

use crate::{BoardModel, ProjectionError};
use prism_kicad_core::{PcbGraphic, PcbGraphicKind, PcbPoint, PcbProfileOwner};
use serde_json::{Value, json};

use super::numbers::round4;

/// The member's name, for error messages.
const NAME: &str = "projections/system-interface.json";

/// `_round(board.thickness)`, or `None` when the board has none or it is 0
/// (interface_extractor.py:458).
pub(super) fn thickness(board: &BoardModel<'_>) -> Result<Option<f64>, ProjectionError> {
    let metadata = board.view.metadata().map_err(board_error)?;
    // `getattr(board, "thickness", None)` is falsy only for 0 (and −0).
    Ok(if metadata.thickness == 0.0 {
        None
    } else {
        Some(round4(metadata.thickness))
    })
}

/// `_board_outline(board)`: `{minMm, maxMm, source}` or `None`.
pub(super) fn outline(board: &BoardModel<'_>) -> Result<Option<Value>, ProjectionError> {
    let mut points: Vec<(f64, f64)> = Vec::new();
    for carrier in board.view.profile_primitives() {
        let carrier = carrier.map_err(board_error)?;
        if carrier.owner == PcbProfileOwner::Board {
            push_outline_points(&carrier.graphic, &mut points);
        }
    }
    let mut source = "edge_cuts";
    if points.is_empty() {
        let Some([min_x, min_y, max_x, max_y]) = bounds::board_bounds(board)? else {
            return Ok(None);
        };
        points.push((min_x, min_y));
        points.push((max_x, max_y));
        source = "items";
    }
    // `xs, ys = [x for x, _ in points], [-y for _, y in points]` (ie:320).
    let (mut min_x, mut min_y, mut max_x, mut max_y) = (
        f64::INFINITY,
        f64::INFINITY,
        f64::NEG_INFINITY,
        f64::NEG_INFINITY,
    );
    for (x, y) in points {
        min_x = min_x.min(x);
        max_x = max_x.max(x);
        let neg_y = -y;
        min_y = min_y.min(neg_y);
        max_y = max_y.max(neg_y);
    }
    Ok(Some(json!({
        "minMm": [round4(min_x), round4(min_y)],
        "maxMm": [round4(max_x), round4(max_y)],
        "source": source,
    })))
}

/// `_outline_points(item)` (ie:290-302): the carried points of one board-level
/// Edge.Cuts graphic. A text carrier has none (the Python carrier list is
/// `gr_line`/`gr_arc`/`gr_rect`/`gr_circle`/`gr_poly`/`gr_curve` only).
fn push_outline_points(graphic: &PcbGraphic, points: &mut Vec<(f64, f64)>) {
    match graphic.kind {
        PcbGraphicKind::Line | PcbGraphicKind::Rect => {
            let start = graphic.start.unwrap_or(ZERO);
            let end = graphic.end.unwrap_or(ZERO);
            points.push((start.x, start.y));
            points.push((end.x, end.y));
        }
        PcbGraphicKind::Circle => {
            let center = graphic.center.unwrap_or(ZERO);
            let end = graphic.end.unwrap_or(ZERO);
            // `math.hypot(item.end_x - item.center_x, …)` (ie:296).
            let radius = libm::hypot(end.x - center.x, end.y - center.y);
            points.push((center.x - radius, center.y - radius));
            points.push((center.x + radius, center.y + radius));
        }
        PcbGraphicKind::Arc => {
            let start = graphic.start.unwrap_or(ZERO);
            let mid = graphic.mid.unwrap_or(ZERO);
            let end = graphic.end.unwrap_or(ZERO);
            arc_points(start, mid, end, points);
        }
        // `GrPoly`/`GrCurve`: `[(float(x), float(y)) for x, y in item.points]`.
        PcbGraphicKind::Poly | PcbGraphicKind::Curve => {
            points.extend(graphic.points.iter().map(|point| (point.x, point.y)));
        }
        PcbGraphicKind::Text | PcbGraphicKind::TextBox => {}
    }
}

const ZERO: PcbPoint = PcbPoint { x: 0.0, y: 0.0 };

/// `_arc_points(item)` (ie:265-288): the arc's ends and mid point plus every
/// quarter-axis crossing it sweeps through.
fn arc_points(start: PcbPoint, mid: PcbPoint, end: PcbPoint, points: &mut Vec<(f64, f64)>) {
    let (ax, ay) = (start.x, start.y);
    let (mx, my) = (mid.x, mid.y);
    let (bx, by) = (end.x, end.y);
    points.push((ax, ay));
    points.push((mx, my));
    points.push((bx, by));
    let d = 2.0 * (ax * (my - by) + mx * (by - ay) + bx * (ay - my));
    if d.abs() < 1e-12 {
        return; // collinear: a straight segment
    }
    let ux = ((ax * ax + ay * ay) * (my - by)
        + (mx * mx + my * my) * (by - ay)
        + (bx * bx + by * by) * (ay - my))
        / d;
    let uy = ((ax * ax + ay * ay) * (bx - mx)
        + (mx * mx + my * my) * (ax - bx)
        + (bx * bx + by * by) * (mx - ax))
        / d;
    // `math.hypot(ax - ux, ay - uy)` (ie:273).
    let radius = libm::hypot(ax - ux, ay - uy);
    let angle = |x: f64, y: f64| py_mod(libm::atan2(y - uy, x - ux), TAU);
    let mut start_angle = angle(ax, ay);
    let mid_angle = angle(mx, my);
    let end_angle = angle(bx, by);
    let mut sweep = py_mod(end_angle - start_angle, TAU);
    if py_mod(mid_angle - start_angle, TAU) > sweep {
        // The arc runs the other way round.
        start_angle = end_angle;
        sweep = TAU - sweep;
    }
    for quarter in 0..4 {
        let theta = (quarter as f64) * PI / 2.0;
        if py_mod(theta - start_angle, TAU) <= sweep {
            points.push((
                ux + radius * libm::cos(theta),
                uy + radius * libm::sin(theta),
            ));
        }
    }
}

/// Python's float `%`: the result takes the divisor's sign (CPython
/// `float_rem`, `Objects/floatobject.c`). `TAU` is positive, so the result is
/// in `[0, τ)`.
pub(super) fn py_mod(left: f64, right: f64) -> f64 {
    let remainder = left % right;
    if remainder != 0.0 {
        if (right < 0.0) != (remainder < 0.0) {
            remainder + right
        } else {
            remainder
        }
    } else {
        0.0_f64.copysign(right)
    }
}

const PI: f64 = std::f64::consts::PI;
const TAU: f64 = std::f64::consts::TAU;

fn board_error(error: prism_kicad_core::Error) -> ProjectionError {
    ProjectionError::new(format!("{NAME}: the board could not be read: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{arc_points, py_mod};
    use prism_kicad_core::{PcbLimits, PcbPoint, PcbView};

    fn point(x: f64, y: f64) -> PcbPoint {
        PcbPoint { x, y }
    }

    #[test]
    fn py_mod_takes_the_divisors_sign() {
        let tau = std::f64::consts::TAU;
        assert_eq!(py_mod(-1.0, tau), tau - 1.0);
        assert_eq!(py_mod(1.0, tau), 1.0);
        assert_eq!(py_mod(tau, tau), 0.0);
        assert!(py_mod(-tau, tau).is_sign_positive());
        // `-0.0 % y` is `+0.0`; the sign follows the divisor.
        assert!(py_mod(-0.0, tau).is_sign_positive());
        assert!(py_mod(0.0, -tau).is_sign_negative());
    }

    #[test]
    fn arc_points_cover_a_crossing() {
        // A quarter circle from +x to +y (counter-clockwise): start (1,0),
        // mid (√2/2, √2/2), end (0,1); sweeps only θ=0 and θ=π/2.
        let start = point(1.0, 0.0);
        let mid = point(
            std::f64::consts::FRAC_1_SQRT_2,
            std::f64::consts::FRAC_1_SQRT_2,
        );
        let end = point(0.0, 1.0);
        let mut points = Vec::new();
        arc_points(start, mid, end, &mut points);
        // start, mid, end, then the 0 and π/2 crossings.
        assert_eq!(points.len(), 5);
        assert_eq!(points[0], (1.0, 0.0));
        assert_eq!(points[1], (mid.x, mid.y));
        assert_eq!(points[2], (0.0, 1.0));
        let near = |point: (f64, f64), x: f64, y: f64| {
            (point.0 - x).abs() < 1e-12 && (point.1 - y).abs() < 1e-12
        };
        assert!(points[3..].iter().any(|point| near(*point, 1.0, 0.0)));
        assert!(points[3..].iter().any(|point| near(*point, 0.0, 1.0)));
    }

    #[test]
    fn arc_points_span_three_quadrants() {
        // From (−1,0) through (0,−1) to (0,1): a sweep of 3π/2 that crosses
        // the θ=0, π/2, π and 3π/2 axes.
        let start = point(-1.0, 0.0);
        let mid = point(0.0, -1.0);
        let end = point(0.0, 1.0);
        let mut points = Vec::new();
        arc_points(start, mid, end, &mut points);
        assert_eq!(points.len(), 3 + 4);
        let near = |point: (f64, f64), x: f64, y: f64| {
            (point.0 - x).abs() < 1e-12 && (point.1 - y).abs() < 1e-12
        };
        for (x, y) in [(1.0, 0.0), (0.0, 1.0), (-1.0, 0.0)] {
            assert!(
                points.iter().any(|point| near(*point, x, y)),
                "missing crossing ({x}, {y})"
            );
        }
    }

    #[test]
    fn a_collinear_arc_is_a_segment() {
        let mut points = Vec::new();
        arc_points(
            point(0.0, 0.0),
            point(1.0, 0.0),
            point(2.0, 0.0),
            &mut points,
        );
        assert_eq!(points, [(0.0, 0.0), (1.0, 0.0), (2.0, 0.0)]);
    }

    #[test]
    fn a_circle_is_center_plus_minus_its_radius() {
        // `(gr_circle (center 1 2) (end 4 2))`: `math.hypot(3, 0)` = 3.
        let text = "(kicad_pcb (version 20240108) \
            (gr_circle (center 1 2) (end 4 2) (stroke (width 0.1) (type default)) \
            (fill no) (layer \"Edge.Cuts\")))";
        let view = PcbView::parse(text, PcbLimits::default()).unwrap();
        let graphic = view.graphics().next().unwrap().unwrap();
        let mut points = Vec::new();
        super::push_outline_points(&graphic, &mut points);
        assert_eq!(points, [(-2.0, -1.0), (4.0, 5.0)]);
    }

    #[test]
    fn a_zero_thickness_is_null() {
        let text = "(kicad_pcb (version 20240108) (general (thickness 0)))";
        let view = PcbView::parse(text, PcbLimits::default()).unwrap();
        let board = crate::BoardModel::new("board.kicad_pcb", text, &view);
        assert_eq!(super::thickness(&board).unwrap(), None);
    }

    #[test]
    fn a_missing_thickness_defaults_to_1_6() {
        let text = "(kicad_pcb (version 20240108) (general))";
        let view = PcbView::parse(text, PcbLimits::default()).unwrap();
        let board = crate::BoardModel::new("board.kicad_pcb", text, &view);
        assert_eq!(super::thickness(&board).unwrap(), Some(1.6));
    }
}
