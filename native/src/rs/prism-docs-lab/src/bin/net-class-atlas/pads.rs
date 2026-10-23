//! Pad facts: a parsed pad's shape in pad-local coordinates, ready to draw.
//!
//! Custom pads keep their authored primitives as rings; the anchor shape the
//! pad's `(options (anchor …))` names is drawn from the pad's own size.

use prism_artwork::artwork::geometry::Point;
use prism_kicad_core::PcbPad;

use super::model::{Pad, PadShape};

/// A board file stores a pad's angle in the board frame, already including its
/// footprint's rotation; the drawing turns pads inside the footprint's own
/// transform, so the footprint's angle comes off here.
pub fn pad_facts(pad: &PcbPad, footprint_angle: f64) -> Pad {
    let angle = pad.angle - footprint_angle;
    let (x, y) = copper_center(pad, angle);
    Pad {
        net: pad.net.name.clone().unwrap_or_default(),
        layers: pad.layers.clone(),
        x,
        y,
        angle,
        shape: pad_shape(pad),
    }
}

/// The pad's copper centre in the footprint's frame: its position plus the
/// drill-relative `(offset …)`, turned by the pad's angle within the footprint
/// (KiCad moves the copper by the offset, never the hole).
fn copper_center(pad: &PcbPad, relative_angle: f64) -> (f64, f64) {
    let offset = pad
        .drill
        .as_ref()
        .map_or(prism_kicad_core::PcbPoint { x: 0.0, y: 0.0 }, |drill| {
            drill.offset
        });
    let turned = prism_kicad_core::kicad_rotate(offset, relative_angle);
    (pad.at_x + turned.x, pad.at_y + turned.y)
}

fn pad_shape(pad: &PcbPad) -> PadShape {
    let width = pad.size_x.abs();
    let height = pad.size_y.abs();
    let chamfered = pad.chamfer_ratio.unwrap_or(0.0) > 0.0 && !pad.chamfer_corners.is_empty();
    match pad.shape.as_str() {
        "circle" => PadShape::Circle {
            diameter: width.min(height),
        },
        "oval" => PadShape::Oval { width, height },
        "rect" => PadShape::Rect { width, height },
        "roundrect" if !chamfered => PadShape::RoundRect {
            width,
            height,
            radius: pad.roundrect_rratio.unwrap_or(0.25) * width.min(height),
        },
        _ => PadShape::Outline {
            rings: pad
                .local_copper_rings()
                .into_iter()
                .map(|ring| ring.into_iter().map(Point::from).collect())
                .collect(),
        },
    }
}
