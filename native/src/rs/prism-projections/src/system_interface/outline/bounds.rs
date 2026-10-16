//! kicad_monkey's `KiCadPcb.get_bounds()` and `Footprint.get_bounds()`, the
//! fallback `source: "items"` outline of `_board_outline` (ie:310-317).
//!
//! Everything here is a port of kicad_monkey 2026.9.7 (`km:` paths under
//! `.../site-packages/kicad_monkey/`), evaluation order included, over
//! `prism_kicad_core::PcbView`:
//!
//! - `KiCadPcb.get_bounds` (`km:kicad_pcb.py:980-1030`): footprints, then
//!   segments, vias, arcs, zones, and board graphics/texts;
//! - `Footprint.get_bounds` (`km:kicad_pcb_footprint.py:553-605`): every
//!   child's local box, its four corners rotated by `−at_angle`
//!   (`km:kicad_geometry.py` `rotate_point`) and translated by `(at_x, at_y)`;
//! - `Pad.get_bounds` (`km:kicad_pad.py:484-546`, custom primitives included),
//!   `Property.get_bounds` (`km:kicad_property.py:77-111`), the `Fp*`
//!   graphics/texts (`km:kicad_fp_*.py`), the `Gr*` shapes
//!   (`km:kicad_pcb_shape_bounds.py`), routing (`km:kicad_pcb_routing.py`),
//!   zones (`km:kicad_pcb_zone.py:398-414`) and `BoundingBox`
//!   (`km:kicad_geometry.py`).
//!
//! Board-level `gr_text` is the one case kicad_monkey does **not** bound by
//! polygon: `kicad_pcb_gr_text.GrText` inherits `ToPolyMixin.get_bounds`,
//! which renders the string through `kicad_text.KiCadTextRenderer` (FreeType
//! over the host font, here Arial). No pure-Rust, platform-independent port
//! exists, so this module uses the estimate of the other board `GrText`
//! implementation, `km:kicad_pcb_graphics.py:92-111`
//! (`len(text) × size_y × 0.6` by `size_y`, unrotated). See the crate report.

use crate::{BoardModel, ProjectionError};
use prism_kicad_core::{
    PcbFootprint, PcbFootprintProperty, PcbFootprintText, PcbFootprintTextBox, PcbGraphic,
    PcbGraphicKind, PcbPad, PcbPoint, PcbRoutingArc, PcbSegment, PcbVia, PcbZone, sexpr::Sexp,
};

const PI: f64 = std::f64::consts::PI;
/// `kicad_pcb_polygon_ops.DEFAULT_ERROR_MM`.
const DEFAULT_ERROR_MM: f64 = 0.005;
/// `kicad_property.KICAD_DEFAULT_TEXT_SIZE_MM` / `kicad_fp_text` font default.
const DEFAULT_TEXT_SIZE: f64 = 1.27;

/// `min_x, min_y, max_x, max_y` of the whole board, or `None` for an empty
/// box (kicad_monkey's `BoundingBox` starts `(∞, ∞, −∞, −∞)` and
/// `_board_outline` treats `max_x < min_x` as empty, ie:315-316).
pub(super) fn board_bounds(board: &BoardModel<'_>) -> Result<Option<[f64; 4]>, ProjectionError> {
    let mut bounds = Bounds::empty();
    // `for fp in self.footprints: bbox.merge(fp.get_bounds())`.
    for footprint in footprint_bounds(board)? {
        bounds.merge(Bounds::from_array(footprint));
    }
    for segment in board.view.segments() {
        bounds.merge(segment_box(&segment.map_err(board_error)?));
    }
    for via in board.view.vias() {
        bounds.merge(via_box(&via.map_err(board_error)?));
    }
    for arc in board.view.arcs() {
        bounds.merge(routing_arc_box(&arc.map_err(board_error)?));
    }
    for zone in board.view.zones() {
        bounds.merge(zone_box(&zone.map_err(board_error)?));
    }
    for graphic in board.view.graphics() {
        bounds.merge(board_graphic_box(&graphic.map_err(board_error)?));
    }
    // Board-level `gr_text`, the renderer fallback (module docs).
    for text in board_text_boxes(board)? {
        bounds.merge(text);
    }
    if bounds.max_x < bounds.min_x {
        Ok(None)
    } else {
        Ok(Some(bounds.into_array()))
    }
}

/// `Footprint.get_bounds()` of every footprint in file order, as km's
/// `(min_x, min_y, max_x, max_y)`; an empty footprint is `(∞, ∞, −∞, −∞)`.
pub(super) fn footprint_bounds(board: &BoardModel<'_>) -> Result<Vec<[f64; 4]>, ProjectionError> {
    let children = FootprintChildren::scan(board)?;
    let mut result = Vec::new();
    for (index, footprint) in board.view.footprints().enumerate() {
        let footprint = footprint.map_err(board_error)?;
        result.push(footprint_box(&footprint, &children, index).into_array());
    }
    Ok(result)
}

/// The footprint-local child collections bucketed once by `footprint_index`.
#[derive(Default)]
struct FootprintChildren {
    pads: Vec<Vec<PcbPad>>,
    graphics: Vec<Vec<PcbGraphic>>,
    texts: Vec<Vec<PcbFootprintText>>,
    text_boxes: Vec<Vec<PcbFootprintTextBox>>,
    properties: Vec<Vec<PcbFootprintProperty>>,
}

impl FootprintChildren {
    fn scan(board: &BoardModel<'_>) -> Result<Self, ProjectionError> {
        let mut children = Self::default();
        for pad in board.view.pads() {
            let pad = pad.map_err(board_error)?;
            push_at(&mut children.pads, pad.footprint_index, pad);
        }
        for graphic in board.view.footprint_graphics() {
            let graphic = graphic.map_err(board_error)?;
            push_at(
                &mut children.graphics,
                graphic.footprint_index,
                graphic.graphic,
            );
        }
        for text in board.view.footprint_texts() {
            let text = text.map_err(board_error)?;
            push_at(&mut children.texts, text.footprint_index, text);
        }
        for text_box in board.view.footprint_text_boxes() {
            let text_box = text_box.map_err(board_error)?;
            push_at(&mut children.text_boxes, text_box.footprint_index, text_box);
        }
        for property in board.view.footprint_properties() {
            let property = property.map_err(board_error)?;
            push_at(&mut children.properties, property.footprint_index, property);
        }
        Ok(children)
    }
}

fn push_at<T>(slots: &mut Vec<Vec<T>>, index: usize, value: T) {
    if slots.len() <= index {
        slots.resize_with(index + 1, Vec::new);
    }
    slots[index].push(value);
}

/// `Footprint.get_bounds` (`km:kicad_pcb_footprint.py:553-605`).
fn footprint_box(footprint: &PcbFootprint, children: &FootprintChildren, index: usize) -> Bounds {
    let at_x = footprint.at_x.unwrap_or(0.0);
    let at_y = footprint.at_y.unwrap_or(0.0);
    let angle = footprint.angle.unwrap_or(0.0);
    let mut bounds = Bounds::empty();
    let mut transform = |local: Bounds| merge_local(&mut bounds, local, at_x, at_y, angle);
    if let Some(pads) = children.pads.get(index) {
        for pad in pads {
            transform(pad_box(pad));
        }
    }
    if let Some(graphics) = children.graphics.get(index) {
        for graphic in graphics {
            transform(fp_graphic_box(graphic));
        }
    }
    if let Some(texts) = children.texts.get(index) {
        for text in texts {
            transform(fp_text_box(text));
        }
    }
    if let Some(text_boxes) = children.text_boxes.get(index) {
        for text_box in text_boxes {
            transform(fp_text_box_box(text_box));
        }
    }
    if let Some(properties) = children.properties.get(index) {
        for property in properties {
            transform(property_box(property));
        }
    }
    bounds
}

/// `transform_and_expand` (`km:kicad_pcb_footprint.py:561-576`): the local
/// box's four corners, each rotated by `−angle` and translated.
fn merge_local(bounds: &mut Bounds, local: Bounds, at_x: f64, at_y: f64, angle: f64) {
    if !local.is_valid() {
        return;
    }
    let corners = [
        (local.min_x, local.min_y),
        (local.max_x, local.min_y),
        (local.max_x, local.max_y),
        (local.min_x, local.max_y),
    ];
    for (lx, ly) in corners {
        let (rx, ry) = if angle != 0.0 {
            rotate_point(lx, ly, -angle)
        } else {
            (lx, ly)
        };
        bounds.expand(rx + at_x, ry + at_y);
    }
}

/// `kicad_geometry.rotate_point(x, y, angle_deg)` around the origin.
fn rotate_point(x: f64, y: f64, angle_deg: f64) -> (f64, f64) {
    if angle_deg == 0.0 {
        return (x, y);
    }
    let radians = angle_deg * (PI / 180.0);
    let cos = libm::cos(radians);
    let sin = libm::sin(radians);
    (x * cos - y * sin, x * sin + y * cos)
}

/// `Pad.get_bounds` (`km:kicad_pad.py:484-546`).
fn pad_box(pad: &PcbPad) -> Bounds {
    let half_w = pad.size_x / 2.0;
    let half_h = pad.size_y / 2.0;
    let sized = || Bounds {
        min_x: pad.at_x - half_w,
        min_y: pad.at_y - half_h,
        max_x: pad.at_x + half_w,
        max_y: pad.at_y + half_h,
    };
    match pad.shape.as_str() {
        "circle" => {
            let radius = half_w;
            Bounds {
                min_x: pad.at_x - radius,
                min_y: pad.at_y - radius,
                max_x: pad.at_x + radius,
                max_y: pad.at_y + radius,
            }
        }
        "oval" => {
            let radius = half_w.max(half_h);
            Bounds {
                min_x: pad.at_x - radius,
                min_y: pad.at_y - radius,
                max_x: pad.at_x + radius,
                max_y: pad.at_y + radius,
            }
        }
        "custom" if !pad.custom_primitives.is_empty() => {
            let mut bounds = Bounds::empty();
            for primitive in &pad.custom_primitives {
                if primitive.kind != "gr_poly" || primitive.points.is_empty() {
                    continue;
                }
                let half = primitive.width.unwrap_or(0.0) / 2.0;
                for point in &primitive.points {
                    let (mut px, mut py) = (point.x, point.y);
                    if pad.angle != 0.0 {
                        (px, py) = rotate_point(px, py, -pad.angle);
                    }
                    let gx = px + pad.at_x;
                    let gy = py + pad.at_y;
                    bounds.expand(gx - half, gy - half);
                    bounds.expand(gx + half, gy + half);
                }
            }
            if bounds.is_valid() { bounds } else { sized() }
        }
        "trapezoid" => {
            let mut bounds = Bounds::empty();
            let mut point = |x: f64, y: f64| bounds.expand(x, y);
            trapezoid_points(pad, &mut point);
            bounds
        }
        _ => {
            let corners = [
                (-half_w, -half_h),
                (half_w, -half_h),
                (half_w, half_h),
                (-half_w, half_h),
            ];
            let mut bounds = Bounds::empty();
            for (x, y) in corners {
                let (rx, ry) = if pad.angle != 0.0 {
                    rotate_point(x, y, -pad.angle)
                } else {
                    (x, y)
                };
                bounds.expand(rx + pad.at_x, ry + pad.at_y);
            }
            bounds
        }
    }
}

/// `Pad._to_trapezoid_polygon(at_x, at_y)` (`km:kicad_pad.py:682-706`).
fn trapezoid_points(pad: &PcbPad, expand: &mut impl FnMut(f64, f64)) {
    let half_w = pad.size_x / 2.0;
    let half_h = pad.size_y / 2.0;
    let delta_x = pad.rect_delta_x.unwrap_or(0.0) / 2.0;
    let delta_y = pad.rect_delta_y.unwrap_or(0.0) / 2.0;
    let corners = [
        (-half_w - delta_y, half_h + delta_x),
        (half_w + delta_y, half_h - delta_x),
        (half_w - delta_y, -half_h + delta_x),
        (-half_w + delta_y, -half_h - delta_x),
    ];
    for (x, y) in corners {
        let (rx, ry) = if pad.angle != 0.0 {
            rotate_point(x, y, -pad.angle)
        } else {
            (x, y)
        };
        expand(rx + pad.at_x, ry + pad.at_y);
    }
}

/// `Property.get_bounds` (`km:kicad_property.py:77-111`).
fn property_box(property: &PcbFootprintProperty) -> Bounds {
    let font_width = property.effects.font.size_x;
    let font_height = property.effects.font.size_y;
    let text = if property.value.is_empty() {
        "X"
    } else {
        property.value.as_str()
    };
    let text_width = (text.chars().count() as f64) * font_width * 0.7;
    centered_text_box(property.at, property.angle, text_width, font_height)
}

/// `kicad_fp_text.FpText.get_bounds` (`km:kicad_fp_text.py:89-122`).
fn fp_text_box(text: &PcbFootprintText) -> Bounds {
    let font_width = text.effects.font.size_x;
    let font_height = text.effects.font.size_y;
    let body = if text.text.is_empty() {
        "X"
    } else {
        text.text.as_str()
    };
    let text_width = (body.chars().count() as f64) * font_width * 0.7;
    centered_text_box(text.at, text.angle, text_width, font_height)
}

/// The shared centred text estimate (`text_width` by `font_height`, rotated by
/// `−angle` when non-zero).
fn centered_text_box(at: PcbPoint, angle: f64, text_width: f64, font_height: f64) -> Bounds {
    let half_w = text_width / 2.0;
    let half_h = font_height / 2.0;
    let corners = [
        (-half_w, -half_h),
        (half_w, -half_h),
        (half_w, half_h),
        (-half_w, half_h),
    ];
    let mut bounds = Bounds::empty();
    for (cx, cy) in corners {
        let (rx, ry) = if angle != 0.0 {
            rotate_point(cx, cy, -angle)
        } else {
            (cx, cy)
        };
        bounds.expand(at.x + rx, at.y + ry);
    }
    bounds
}

/// `kicad_fp_text_box.FpTextBox.get_bounds`
/// (`km:kicad_fp_text_box.py:208-232`).
fn fp_text_box_box(text_box: &PcbFootprintTextBox) -> Bounds {
    let half = text_box.stroke_width.unwrap_or(0.0) / 2.0;
    if !text_box.polygon_points.is_empty() {
        let mut bounds = Bounds::empty();
        for point in &text_box.polygon_points {
            bounds.expand(point.x - half, point.y - half);
            bounds.expand(point.x + half, point.y + half);
        }
        return bounds;
    }
    let min_x = text_box.start.x.min(text_box.end.x);
    let min_y = text_box.start.y.min(text_box.end.y);
    let max_x = text_box.start.x.max(text_box.end.x);
    let max_y = text_box.start.y.max(text_box.end.y);
    Bounds {
        min_x: min_x - half,
        min_y: min_y - half,
        max_x: max_x + half,
        max_y: max_y + half,
    }
}

/// One footprint graphic's local box (`km:kicad_fp_line.py:56-68` and the
/// sibling `Fp*` classes).
fn fp_graphic_box(graphic: &PcbGraphic) -> Bounds {
    let half = graphic.stroke_width.unwrap_or(0.0) / 2.0;
    match graphic.kind {
        PcbGraphicKind::Line | PcbGraphicKind::Rect => {
            let start = graphic.start.unwrap_or(ZERO);
            let end = graphic.end.unwrap_or(ZERO);
            Bounds {
                min_x: start.x.min(end.x) - half,
                min_y: start.y.min(end.y) - half,
                max_x: start.x.max(end.x) + half,
                max_y: start.y.max(end.y) + half,
            }
        }
        PcbGraphicKind::Circle => {
            let center = graphic.center.unwrap_or(ZERO);
            let end = graphic.end.unwrap_or(ZERO);
            // `FpCircle.radius` uses `math.sqrt`, not `math.hypot`.
            let dx = end.x - center.x;
            let dy = end.y - center.y;
            let radius = (dx * dx + dy * dy).sqrt();
            let radius = radius + half;
            Bounds {
                min_x: center.x - radius,
                min_y: center.y - radius,
                max_x: center.x + radius,
                max_y: center.y + radius,
            }
        }
        PcbGraphicKind::Arc => {
            // Conservative: all three points, each expanded by `±hw`
            // (`FpArc.from_sexp` defaults an absent point to the origin).
            let mut bounds = Bounds::empty();
            for point in [
                graphic.start.unwrap_or(ZERO),
                graphic.mid.unwrap_or(ZERO),
                graphic.end.unwrap_or(ZERO),
            ] {
                bounds.expand(point.x - half, point.y - half);
                bounds.expand(point.x + half, point.y + half);
            }
            bounds
        }
        PcbGraphicKind::Poly | PcbGraphicKind::Curve => {
            let mut bounds = Bounds::empty();
            for point in &graphic.points {
                bounds.expand(point.x - half, point.y - half);
                bounds.expand(point.x + half, point.y + half);
            }
            bounds
        }
        PcbGraphicKind::Text | PcbGraphicKind::TextBox => Bounds::empty(),
    }
}

const ZERO: PcbPoint = PcbPoint { x: 0.0, y: 0.0 };

/// `Segment.get_bounds` (`km:kicad_pcb_routing.py:99-109`).
fn segment_box(segment: &PcbSegment) -> Bounds {
    let half = segment.width.unwrap_or(0.0) / 2.0;
    Bounds {
        min_x: segment.start_x.min(segment.end_x) - half,
        min_y: segment.start_y.min(segment.end_y) - half,
        max_x: segment.start_x.max(segment.end_x) + half,
        max_y: segment.start_y.max(segment.end_y) + half,
    }
}

/// `Via.get_bounds` (`km:kicad_pcb_routing.py:351-362`).
fn via_box(via: &PcbVia) -> Bounds {
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
fn zone_box(zone: &PcbZone) -> Bounds {
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
fn board_graphic_box(graphic: &PcbGraphic) -> Bounds {
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
        // Board `gr_text` is handled by [`board_text_boxes`].
        PcbGraphicKind::Text => Bounds::empty(),
    }
}

/// `_bounds_from_points` (`km:kicad_pcb_shape_bounds.py:25-36`).
fn bounds_from_points(points: &[PcbPoint], width: f64) -> Bounds {
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

/// `arc_bounds` (`km:kicad_pcb_shape_bounds.py:99-125`).
fn arc_bounds(start: PcbPoint, mid: PcbPoint, end: PcbPoint, width: f64) -> Bounds {
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
            points.push(PcbPoint {
                x: center.x + radius * libm::cos(angle),
                y: center.y + radius * libm::sin(angle),
            });
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

/// `bezier_bounds` (`km:kicad_pcb_shape_bounds.py:133-145`).
fn bezier_bounds(points: &[PcbPoint], width: f64) -> Bounds {
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

/// `Arc.get_bounds` (`km:kicad_pcb_routing.py:446-460`): the outline of
/// `arc_to_polygon` (`km:kicad_pcb_polygon_ops.py:332-457`), whose winding
/// normalisation does not change the extent.
fn routing_arc_box(arc: &PcbRoutingArc) -> Bounds {
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
    let mut arc_angle = normalize_angle(end_angle - start_angle);
    let mid_offset = normalize_angle(mid_angle - start_angle);
    if arc_angle >= 0.0 {
        if mid_offset < 0.0 || mid_offset > arc_angle {
            arc_angle -= 2.0 * PI;
        }
    } else if mid_offset > 0.0 || mid_offset < arc_angle {
        arc_angle += 2.0 * PI;
    }
    let half_width = width / 2.0;
    let outer_radius = radius + half_width;
    let inner_radius = radius - half_width;
    let arc_len_deg = (arc_angle * (180.0 / PI)).abs();
    let num_segs = get_arc_segment_count(outer_radius, error, arc_len_deg).max(8);
    let delta = arc_angle / (num_segs as f64);
    let mut points = Vec::new();
    for i in 0..=num_segs {
        let angle = start_angle + (i as f64) * delta;
        points.push(PcbPoint {
            x: center.x + outer_radius * libm::cos(angle),
            y: center.y + outer_radius * libm::sin(angle),
        });
    }
    let end_cap_center = PcbPoint {
        x: center.x + radius * libm::cos(end_angle),
        y: center.y + radius * libm::sin(end_angle),
    };
    let cap_segs = (num_segs / 4).max(4);
    let cap_delta = PI / (cap_segs as f64);
    let cap_start = end_angle
        + if arc_angle >= 0.0 {
            PI / 2.0
        } else {
            -PI / 2.0
        };
    for i in 1..cap_segs {
        let angle = if arc_angle >= 0.0 {
            cap_start - (i as f64) * cap_delta
        } else {
            cap_start + (i as f64) * cap_delta
        };
        points.push(PcbPoint {
            x: end_cap_center.x + half_width * libm::cos(angle),
            y: end_cap_center.y + half_width * libm::sin(angle),
        });
    }
    if inner_radius > 0.0 {
        for i in 0..=num_segs {
            let angle = start_angle + arc_angle - (i as f64) * delta;
            points.push(PcbPoint {
                x: center.x + inner_radius * libm::cos(angle),
                y: center.y + inner_radius * libm::sin(angle),
            });
        }
    } else {
        points.push(center);
    }
    let start_cap_center = PcbPoint {
        x: center.x + radius * libm::cos(start_angle),
        y: center.y + radius * libm::sin(start_angle),
    };
    let cap_start = start_angle
        + if arc_angle >= 0.0 {
            -PI / 2.0
        } else {
            PI / 2.0
        };
    for i in 1..cap_segs {
        let angle = if arc_angle >= 0.0 {
            cap_start - (i as f64) * cap_delta
        } else {
            cap_start + (i as f64) * cap_delta
        };
        points.push(PcbPoint {
            x: start_cap_center.x + half_width * libm::cos(angle),
            y: start_cap_center.y + half_width * libm::sin(angle),
        });
    }
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
        points.push(PcbPoint {
            x: center.x + radius * libm::cos(angle),
            y: center.y + radius * libm::sin(angle),
        });
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

/// The board's `gr_text` estimates (module docs). kicad_monkey's
/// `KiCadPcb.get_bounds` routes these through the text renderer; the
/// posed estimate is `kicad_pcb_graphics.GrText.get_bounds`
/// (`km:kicad_pcb_graphics.py:92-111`).
fn board_text_boxes(board: &BoardModel<'_>) -> Result<Vec<Bounds>, ProjectionError> {
    let root = prism_kicad_core::sexpr::parse(board.text).map_err(board_error)?;
    let Sexp::List(items) = root else {
        return Ok(Vec::new());
    };
    let mut boxes = Vec::new();
    for item in &items {
        let Sexp::List(form) = item else { continue };
        if form.first().and_then(atom) != Some("gr_text") {
            continue;
        }
        if let Some(bounds) = gr_text_box(form) {
            boxes.push(bounds);
        }
    }
    Ok(boxes)
}

/// One `gr_text` form's estimate (`km:kicad_pcb_graphics.py:92-111`).
fn gr_text_box(form: &[Sexp]) -> Option<Bounds> {
    let text = form.get(1).and_then(string_value)?;
    let mut at_x = 0.0;
    let mut at_y = 0.0;
    let mut font_height = DEFAULT_TEXT_SIZE;
    for child in &form[2..] {
        let Sexp::List(fields) = child else { continue };
        match fields.first().and_then(atom) {
            Some("at") => {
                at_x = fields.get(1).and_then(number).unwrap_or(0.0);
                at_y = fields.get(2).and_then(number).unwrap_or(0.0);
            }
            Some("effects") => {
                if let Some(size_y) = effects_font_size_y(fields) {
                    font_height = size_y;
                }
            }
            _ => {}
        }
    }
    let char_width = font_height * 0.6;
    let text_width = (text.chars().count() as f64) * char_width;
    let half_w = text_width / 2.0;
    let half_h = font_height / 2.0;
    let mut bounds = Bounds::empty();
    for (cx, cy) in [
        (-half_w, -half_h),
        (half_w, -half_h),
        (half_w, half_h),
        (-half_w, half_h),
    ] {
        bounds.expand(at_x + cx, at_y + cy);
    }
    Some(bounds)
}

/// `size_y` out of `(effects (font (size height width)))`, defaulting to 1.27.
fn effects_font_size_y(effects: &[Sexp]) -> Option<f64> {
    for child in &effects[1..] {
        let Sexp::List(font) = child else { continue };
        if font.first().and_then(atom) != Some("font") {
            continue;
        }
        for field in &font[1..] {
            let Sexp::List(size) = field else { continue };
            if size.first().and_then(atom) == Some("size") {
                return Some(size.get(1).and_then(number).unwrap_or(DEFAULT_TEXT_SIZE));
            }
        }
    }
    None
}

fn atom(sexp: &Sexp) -> Option<&str> {
    match sexp {
        Sexp::Atom(value) => Some(value),
        _ => None,
    }
}

fn string_value(sexp: &Sexp) -> Option<&str> {
    match sexp {
        Sexp::Quoted(value) | Sexp::Atom(value) => Some(value),
        _ => None,
    }
}

fn number(sexp: &Sexp) -> Option<f64> {
    match sexp {
        Sexp::Float(value) => Some(*value),
        Sexp::Integer(value) => Some(*value as f64),
        _ => None,
    }
}

/// The mutable `BoundingBox` of `km:kicad_geometry.py`.
#[derive(Clone, Copy, Debug)]
struct Bounds {
    min_x: f64,
    min_y: f64,
    max_x: f64,
    max_y: f64,
}

impl Bounds {
    fn empty() -> Self {
        Self {
            min_x: f64::INFINITY,
            min_y: f64::INFINITY,
            max_x: f64::NEG_INFINITY,
            max_y: f64::NEG_INFINITY,
        }
    }

    fn is_valid(&self) -> bool {
        self.min_x <= self.max_x && self.min_y <= self.max_y
    }

    fn expand(&mut self, x: f64, y: f64) {
        if x < self.min_x {
            self.min_x = x;
        }
        if x > self.max_x {
            self.max_x = x;
        }
        if y < self.min_y {
            self.min_y = y;
        }
        if y > self.max_y {
            self.max_y = y;
        }
    }

    fn merge(&mut self, other: Self) {
        if !other.is_valid() {
            return;
        }
        if other.min_x < self.min_x {
            self.min_x = other.min_x;
        }
        if other.min_y < self.min_y {
            self.min_y = other.min_y;
        }
        if other.max_x > self.max_x {
            self.max_x = other.max_x;
        }
        if other.max_y > self.max_y {
            self.max_y = other.max_y;
        }
    }

    fn expand_by(&self, margin: f64) -> Self {
        Self {
            min_x: self.min_x - margin,
            min_y: self.min_y - margin,
            max_x: self.max_x + margin,
            max_y: self.max_y + margin,
        }
    }

    fn into_array(self) -> [f64; 4] {
        [self.min_x, self.min_y, self.max_x, self.max_y]
    }

    fn from_array(value: [f64; 4]) -> Self {
        Self {
            min_x: value[0],
            min_y: value[1],
            max_x: value[2],
            max_y: value[3],
        }
    }
}

fn board_error(error: prism_kicad_core::Error) -> ProjectionError {
    ProjectionError::new(format!(
        "projections/system-interface.json: the board could not be read: {error}"
    ))
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

    /// kicad_monkey's `get_bounds()` of every prepared board and footprint,
    /// bit for bit. Set `BOUNDS_ORACLE` to `expected.json`.
    #[test]
    #[ignore = "reads the kicad_monkey bounds oracle through BOUNDS_ORACLE"]
    fn bounds_oracle() {
        let path = std::env::var("BOUNDS_ORACLE")
            .expect("set BOUNDS_ORACLE to the kicad_monkey bounds oracle JSON");
        let oracle: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).expect("read the bounds oracle"))
                .expect("parse the bounds oracle");
        let entries = oracle.as_object().expect("oracle is an object");
        let mut mismatches = 0usize;
        for (board_path, entry) in entries {
            let case = entry["case"].as_str().unwrap_or(board_path.as_str());
            let text = match std::fs::read_to_string(board_path) {
                Ok(text) => text,
                Err(error) => {
                    println!("{case}: cannot read {board_path}: {error}");
                    mismatches += 1;
                    continue;
                }
            };
            let view = match prism_kicad_core::PcbView::parse(
                &text,
                prism_kicad_core::PcbLimits::default(),
            ) {
                Ok(view) => view,
                Err(error) => {
                    println!("{case}: cannot parse {board_path}: {error}");
                    mismatches += 1;
                    continue;
                }
            };
            let board = crate::BoardModel {
                path: board_path,
                text: &text,
                view: &view,
            };
            // Board box.
            let actual = super::board_bounds(&board).expect("board bounds");
            match expected_box(&entry["bounds"]) {
                None => {
                    if actual.is_some() {
                        println!("{case}: board golden is empty, member is {actual:?}");
                        mismatches += 1;
                    }
                }
                Some(golden) => match actual {
                    Some(actual) if bits_equal(actual, golden) => {}
                    other => {
                        println!("{case}: board golden {golden:?} member {other:?}");
                        mismatches += 1;
                    }
                },
            }
            // Footprint boxes.
            let actual = super::footprint_bounds(&board).expect("footprint bounds");
            let golden = entry["footprints"].as_array().expect("footprints array");
            if golden.len() != actual.len() {
                println!(
                    "{case}: {} footprints in the oracle, {} in the member",
                    golden.len(),
                    actual.len()
                );
                mismatches += 1;
            }
            for (index, golden) in golden.iter().enumerate() {
                let Some(actual) = actual.get(index) else {
                    break;
                };
                let Some(golden) = expected_box(golden) else {
                    continue;
                };
                if !bits_equal(*actual, golden) {
                    println!("{case}: footprint {index} golden {golden:?} member {actual:?}");
                    mismatches += 1;
                }
            }
        }
        println!("{mismatches} mismatched box(es)");
        assert_eq!(mismatches, 0, "kicad_monkey bounds oracle mismatches");
    }

    /// A `float.hex` box, or `None` for a `null` entry.
    fn expected_box(value: &serde_json::Value) -> Option<[f64; 4]> {
        let values = value.as_array()?;
        let mut boxed = [0.0; 4];
        for (slot, value) in boxed.iter_mut().zip(values) {
            *slot = parse_hex(value.as_str().expect("a float.hex string"));
        }
        Some(boxed)
    }

    fn bits_equal(left: [f64; 4], right: [f64; 4]) -> bool {
        left.iter()
            .zip(right.iter())
            .all(|(left, right)| left.to_bits() == right.to_bits())
    }

    /// Parse Python's `float.hex()` output (`0x1.<hex>p±<dec>`, `inf`, `nan`).
    fn parse_hex(text: &str) -> f64 {
        let text = text.trim();
        let (negative, rest) = match text.strip_prefix('-') {
            Some(rest) => (true, rest),
            None => (false, text.strip_prefix('+').unwrap_or(text)),
        };
        if rest == "inf" {
            return if negative {
                f64::NEG_INFINITY
            } else {
                f64::INFINITY
            };
        }
        if rest == "nan" {
            return f64::NAN;
        }
        let rest = rest
            .strip_prefix("0x")
            .or_else(|| rest.strip_prefix("0X"))
            .unwrap_or(rest);
        let (mantissa, exponent) = rest.split_once(['p', 'P']).unwrap_or((rest, "0"));
        let exponent: i32 = exponent.parse().expect("a binary exponent");
        let (integer, fraction) = mantissa.split_once('.').unwrap_or((mantissa, ""));
        let integer = u64::from_str_radix(integer, 16).expect("a hex integer part");
        let fraction = if fraction.is_empty() {
            0
        } else {
            u64::from_str_radix(fraction, 16).expect("hex fraction digits")
        };
        let width = mantissa
            .split_once('.')
            .map_or(0, |(_, fraction)| 4 * fraction.len() as u32);
        let significand = (integer << 52) | (fraction << (52 - width));
        let value = libm::ldexp(significand as f64, exponent - 52);
        if negative { -value } else { value }
    }
}
