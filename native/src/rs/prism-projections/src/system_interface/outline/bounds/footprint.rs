//! `Footprint.get_bounds` (`km:kicad_pcb_footprint.py:553-605`) and every child
//! box it merges: pads (`km:kicad_pad.py:484-546`, custom primitives included),
//! properties (`km:kicad_property.py:77-111`), and the `Fp*` graphics, texts and
//! text boxes (`km:kicad_fp_*.py`).

use super::{Bounds, PI, ZERO, board_error};
use crate::{BoardModel, ProjectionError};
use prism_kicad_core::{
    PcbFootprint, PcbFootprintProperty, PcbFootprintText, PcbFootprintTextBox, PcbGraphic,
    PcbGraphicKind, PcbPad, PcbPoint,
};

/// `Footprint.get_bounds()` of every footprint in file order, as km's
/// `(min_x, min_y, max_x, max_y)`; an empty footprint is `(∞, ∞, −∞, −∞)`.
pub(super) fn footprint_bounds(board: &BoardModel<'_>) -> Result<Vec<[f64; 4]>, ProjectionError> {
    let children = FootprintChildren::scan(board)?;
    let mut result = Vec::new();
    for (index, footprint) in board.view.decoded_footprints().iter().enumerate() {
        let footprint = footprint
            .as_ref()
            .map_err(|error| board_error(error.clone()))?;
        result.push(footprint_box(footprint, &children, index).into_array());
    }
    Ok(result)
}

/// The footprint-local child collections bucketed once by `footprint_index`;
/// the memoized families borrow the view's decoded siblings, the one-shot text
/// families own theirs.
#[derive(Default)]
struct FootprintChildren<'v> {
    pads: Vec<Vec<&'v PcbPad>>,
    graphics: Vec<Vec<&'v PcbGraphic>>,
    texts: Vec<Vec<PcbFootprintText>>,
    text_boxes: Vec<Vec<PcbFootprintTextBox>>,
    properties: Vec<Vec<&'v PcbFootprintProperty>>,
}

impl<'v> FootprintChildren<'v> {
    fn scan(board: &'v BoardModel<'_>) -> Result<Self, ProjectionError> {
        let view = board.view;
        let mut children = Self::default();
        for pad in view.decoded_pads() {
            let pad = pad.as_ref().map_err(|error| board_error(error.clone()))?;
            push_at(&mut children.pads, pad.footprint_index, pad);
        }
        for graphic in view.decoded_footprint_graphics() {
            let graphic = graphic
                .as_ref()
                .map_err(|error| board_error(error.clone()))?;
            push_at(
                &mut children.graphics,
                graphic.footprint_index,
                &graphic.graphic,
            );
        }
        for text in view.footprint_texts() {
            let text = text.map_err(board_error)?;
            push_at(&mut children.texts, text.footprint_index, text);
        }
        for text_box in view.footprint_text_boxes() {
            let text_box = text_box.map_err(board_error)?;
            push_at(&mut children.text_boxes, text_box.footprint_index, text_box);
        }
        for property in view.decoded_footprint_properties() {
            let property = property
                .as_ref()
                .map_err(|error| board_error(error.clone()))?;
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
fn footprint_box(
    footprint: &PcbFootprint,
    children: &FootprintChildren<'_>,
    index: usize,
) -> Bounds {
    let at_x = footprint.at_x.unwrap_or(0.0);
    let at_y = footprint.at_y.unwrap_or(0.0);
    let angle = footprint.angle.unwrap_or(0.0);
    let mut bounds = Bounds::empty();
    merge_children(
        children.pads.get(index).map(Vec::as_slice),
        &mut bounds,
        at_x,
        at_y,
        angle,
        |pad: &&PcbPad| pad_box(pad),
    );
    merge_children(
        children.graphics.get(index).map(Vec::as_slice),
        &mut bounds,
        at_x,
        at_y,
        angle,
        |graphic: &&PcbGraphic| fp_graphic_box(graphic),
    );
    merge_children(
        children.texts.get(index).map(Vec::as_slice),
        &mut bounds,
        at_x,
        at_y,
        angle,
        |text: &PcbFootprintText| fp_text_box(text),
    );
    merge_children(
        children.text_boxes.get(index).map(Vec::as_slice),
        &mut bounds,
        at_x,
        at_y,
        angle,
        |text_box: &PcbFootprintTextBox| fp_text_box_box(text_box),
    );
    merge_children(
        children.properties.get(index).map(Vec::as_slice),
        &mut bounds,
        at_x,
        at_y,
        angle,
        |property: &&PcbFootprintProperty| property_box(property),
    );
    bounds
}

/// Merge one child collection's local boxes into `bounds`, each rotated into the
/// parent frame (`transform_and_expand`, `km:kicad_pcb_footprint.py:561-576`).
fn merge_children<T>(
    items: Option<&[T]>,
    bounds: &mut Bounds,
    at_x: f64,
    at_y: f64,
    angle: f64,
    child_box: fn(&T) -> Bounds,
) {
    let Some(items) = items else {
        return;
    };
    for item in items {
        merge_local(bounds, child_box(item), at_x, at_y, angle);
    }
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

/// The `± half_w` × `± half_h` axis-aligned box about `(at_x, at_y)`.
fn centered_box(at_x: f64, at_y: f64, half_w: f64, half_h: f64) -> Bounds {
    Bounds {
        min_x: at_x - half_w,
        min_y: at_y - half_h,
        max_x: at_x + half_w,
        max_y: at_y + half_h,
    }
}

/// The extent of `corners`, each rotated by `−angle` and translated by
/// `(at_x, at_y)`; a zero angle is the identity.
fn rotated_corners(at_x: f64, at_y: f64, angle: f64, corners: &[(f64, f64)]) -> Bounds {
    let mut bounds = Bounds::empty();
    for &(x, y) in corners {
        let (rx, ry) = if angle != 0.0 {
            rotate_point(x, y, -angle)
        } else {
            (x, y)
        };
        bounds.expand(rx + at_x, ry + at_y);
    }
    bounds
}

/// `Pad.get_bounds` (`km:kicad_pad.py:484-546`).
fn pad_box(pad: &PcbPad) -> Bounds {
    let half_w = pad.size_x / 2.0;
    let half_h = pad.size_y / 2.0;
    match pad.shape.as_str() {
        "circle" => centered_box(pad.at_x, pad.at_y, half_w, half_w),
        "oval" => {
            let radius = half_w.max(half_h);
            centered_box(pad.at_x, pad.at_y, radius, radius)
        }
        "custom" if !pad.custom_primitives.is_empty() => custom_pad_box(pad, half_w, half_h),
        "trapezoid" => trapezoid_box(pad),
        _ => rotated_corners(
            pad.at_x,
            pad.at_y,
            pad.angle,
            &[
                (-half_w, -half_h),
                (half_w, -half_h),
                (half_w, half_h),
                (-half_w, half_h),
            ],
        ),
    }
}

/// The custom-primitive branch of `Pad.get_bounds` (`km:kicad_pad.py:484-546`):
/// every `gr_poly` primitive's points, each rotated by `−pad.angle` and expanded
/// by half the primitive's stroke width. Falls back to the pad's own extents
/// when no polygon point is seen.
fn custom_pad_box(pad: &PcbPad, half_w: f64, half_h: f64) -> Bounds {
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
    if bounds.is_valid() {
        bounds
    } else {
        centered_box(pad.at_x, pad.at_y, half_w, half_h)
    }
}

/// `Pad._to_trapezoid_polygon(at_x, at_y)` (`km:kicad_pad.py:682-706`).
fn trapezoid_box(pad: &PcbPad) -> Bounds {
    let half_w = pad.size_x / 2.0;
    let half_h = pad.size_y / 2.0;
    let delta_x = pad.rect_delta_x.unwrap_or(0.0) / 2.0;
    let delta_y = pad.rect_delta_y.unwrap_or(0.0) / 2.0;
    rotated_corners(
        pad.at_x,
        pad.at_y,
        pad.angle,
        &[
            (-half_w - delta_y, half_h + delta_x),
            (half_w + delta_y, half_h - delta_x),
            (half_w - delta_y, -half_h + delta_x),
            (-half_w + delta_y, -half_h - delta_x),
        ],
    )
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
    rotated_corners(
        at.x,
        at.y,
        angle,
        &[
            (-half_w, -half_h),
            (half_w, -half_h),
            (half_w, half_h),
            (-half_w, half_h),
        ],
    )
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
