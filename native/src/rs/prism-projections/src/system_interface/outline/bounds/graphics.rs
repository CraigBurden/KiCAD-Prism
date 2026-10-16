//! One board-level item's box: the `Gr*` shapes and routing
//! (`km:kicad_pcb_shape_bounds.py`, `km:kicad_pcb_routing.py`), zones
//! (`km:kicad_pcb_zone.py:398-414`) and the shared stroke margin
//! (`_bounds_from_points`, `km:kicad_pcb_shape_bounds.py:25-36`).

use super::arc::arc_bounds;
use super::bezier::bezier_bounds;
use super::{Bounds, ZERO};
use prism_kicad_core::{PcbGraphic, PcbGraphicKind, PcbPoint, PcbSegment, PcbVia, PcbZone};

/// `Segment.get_bounds` (`km:kicad_pcb_routing.py:99-109`).
pub(super) fn segment_box(segment: &PcbSegment) -> Bounds {
    let half = segment.width.unwrap_or(0.0) / 2.0;
    Bounds {
        min_x: segment.start_x.min(segment.end_x) - half,
        min_y: segment.start_y.min(segment.end_y) - half,
        max_x: segment.start_x.max(segment.end_x) + half,
        max_y: segment.start_y.max(segment.end_y) + half,
    }
}

/// `Via.get_bounds` (`km:kicad_pcb_routing.py:351-362`).
pub(super) fn via_box(via: &PcbVia) -> Bounds {
    let radius = via.size / 2.0;
    Bounds {
        min_x: via.at_x - radius,
        min_y: via.at_y - radius,
        max_x: via.at_x + radius,
        max_y: via.at_y + radius,
    }
}

/// `Zone.get_bounds` (`km:kicad_pcb_zone.py:398-414`): every outline point
/// and every filled-polygon point.
pub(super) fn zone_box(zone: &PcbZone) -> Bounds {
    let mut bounds = Bounds::empty();
    for polygon in &zone.polygons {
        for point in &polygon.points {
            bounds.expand(point.x, point.y);
        }
    }
    for filled in &zone.filled_polygons {
        for point in &filled.points {
            bounds.expand(point.x, point.y);
        }
    }
    bounds
}

/// One board graphic's box (`km:kicad_pcb_shape_bounds.py`).
pub(super) fn board_graphic_box(graphic: &PcbGraphic) -> Bounds {
    let width = graphic.stroke_width.unwrap_or(0.0);
    match graphic.kind {
        PcbGraphicKind::Line => {
            let start = graphic.start.unwrap_or(ZERO);
            let end = graphic.end.unwrap_or(ZERO);
            bounds_from_points(&[start, end], width)
        }
        PcbGraphicKind::Rect => {
            let start = graphic.start.unwrap_or(ZERO);
            let end = graphic.end.unwrap_or(ZERO);
            let (min_x, max_x) = (start.x.min(end.x), start.x.max(end.x));
            let (min_y, max_y) = (start.y.min(end.y), start.y.max(end.y));
            bounds_from_points(
                &[
                    PcbPoint { x: min_x, y: min_y },
                    PcbPoint { x: max_x, y: min_y },
                    PcbPoint { x: max_x, y: max_y },
                    PcbPoint { x: min_x, y: max_y },
                ],
                width,
            )
        }
        PcbGraphicKind::Circle => {
            let center = graphic.center.unwrap_or(ZERO);
            let end = graphic.end.unwrap_or(ZERO);
            // `circle_bounds`: `math.hypot` plus the stroke margin.
            let radius = libm::hypot(end.x - center.x, end.y - center.y) + stroke_margin(width);
            Bounds {
                min_x: center.x - radius,
                min_y: center.y - radius,
                max_x: center.x + radius,
                max_y: center.y + radius,
            }
        }
        PcbGraphicKind::Arc => {
            let start = graphic.start.unwrap_or(ZERO);
            let mid = graphic.mid.unwrap_or(ZERO);
            let end = graphic.end.unwrap_or(ZERO);
            arc_bounds(start, mid, end, width)
        }
        PcbGraphicKind::Poly => bounds_from_points(&graphic.points, width),
        PcbGraphicKind::Curve => bezier_bounds(&graphic.points, width),
        // `GrTextBox.get_bounds` (`km:kicad_pcb_graphics.py:1097-1112`).
        PcbGraphicKind::TextBox => {
            let half = width / 2.0;
            let start = graphic.start.unwrap_or(ZERO);
            let end = graphic.end.unwrap_or(ZERO);
            Bounds {
                min_x: start.x.min(end.x) - half,
                min_y: start.y.min(end.y) - half,
                max_x: start.x.max(end.x) + half,
                max_y: start.y.max(end.y) + half,
            }
        }
        // Board `gr_text` is handled by [`super::text::board_text_boxes`].
        PcbGraphicKind::Text => Bounds::empty(),
    }
}

/// `_bounds_from_points` (`km:kicad_pcb_shape_bounds.py:25-36`).
pub(super) fn bounds_from_points(points: &[PcbPoint], width: f64) -> Bounds {
    let mut bounds = Bounds::empty();
    for point in points {
        bounds.expand(point.x, point.y);
    }
    if !bounds.is_valid() {
        return bounds;
    }
    let margin = stroke_margin(width);
    if margin == 0.0 {
        return bounds;
    }
    bounds.expand_by(margin)
}

fn stroke_margin(width: f64) -> f64 {
    width.max(0.0) / 2.0
}

#[cfg(test)]
mod tests {
    use super::{Bounds, bounds_from_points};
    use prism_kicad_core::PcbPoint;

    #[test]
    fn bounds_from_points_applies_the_stroke_margin() {
        let points = [PcbPoint { x: 0.0, y: 0.0 }, PcbPoint { x: 2.0, y: 1.0 }];
        assert_eq!(
            bounds_from_points(&points, 0.2).into_array(),
            [-0.1, -0.1, 2.1, 1.1]
        );
        assert_eq!(
            bounds_from_points(&points, 0.0).into_array(),
            [0.0, 0.0, 2.0, 1.0]
        );
        assert!(!Bounds::empty().is_valid());
    }
}
