//! The board-frame transform, courtyard points and the `geometry` object, a
//! port of `_courtyard_points`, `_model` and `_footprint_geometry`
//! (interface_extractor.py:180-262).
//!
//! Every number goes through `_round` (`super::super::numbers::round4`, the
//! same as interface_extractor.py:168-170) at the point it is made, and every
//! transcendental call is `libm` (conventions.md §14; producer note 9,
//! field-maps/system-interface.md:181-183).

use super::super::numbers::{natural_cmp, round4};
use super::{Footprint, Pad};
use prism_kicad_core::{PcbGraphic, PcbGraphicKind, PcbPoint};
use serde_json::{Value, json};

/// The board frame of producer note 7 (interface_extractor.py:216-224):
/// `a = radians(angle)`, `c = cos(a)`, `s = sin(a)`, and for a footprint-local
/// point `(lx, ly)` at anchor `(fx, fy)`
///
/// ```text
/// x = (fx + lx*c) + ly*s
/// y = (fy - lx*s) + ly*c
/// [_round(x), _round(-y)]
/// ```
///
/// The additions and multiplications keep today's evaluation order, with no
/// fused multiply-add.
pub(super) struct BoardFrame {
    fx: f64,
    fy: f64,
    cos_a: f64,
    sin_a: f64,
}

impl BoardFrame {
    /// `math.radians(angle) = angle * (π / 180)`; `cos`/`sin` are `libm`.
    pub(super) fn new(fx: f64, fy: f64, angle: f64) -> Self {
        let radians = angle * (std::f64::consts::PI / 180.0);
        Self {
            fx,
            fy,
            cos_a: libm::cos(radians),
            sin_a: libm::sin(radians),
        }
    }

    /// One footprint-local point in the board frame, y up and `_round`ed.
    pub(super) fn point(&self, lx: f64, ly: f64) -> [f64; 2] {
        let x = self.fx + lx * self.cos_a + ly * self.sin_a;
        let y = self.fy - lx * self.sin_a + ly * self.cos_a;
        [round4(x), round4(-y)]
    }
}

/// `(x, y)` of a footprint-local point, `0.0` where the source omitted it
/// (kicad_monkey's `Fp*` defaults, e.g. `kicad_fp_line.py:43-52`).
fn point(option: Option<PcbPoint>) -> (f64, f64) {
    option.map_or((0.0, 0.0), |point| (point.x, point.y))
}

/// Append one courtyard item's footprint-local points (KiCad y down):
/// lines and rectangles use both ends, circles their centre ± `hypot` radius,
/// arcs start/mid/end, polygons every point
/// (`_courtyard_points`, interface_extractor.py:180-196). Items on another
/// kind are ignored, as are curves, which kicad_monkey does not parse into a
/// footprint graphic.
pub(super) fn courtyard_points(graphic: &PcbGraphic, points: &mut Vec<(f64, f64)>) {
    match graphic.kind {
        PcbGraphicKind::Line | PcbGraphicKind::Rect => {
            points.push(point(graphic.start));
            points.push(point(graphic.end));
        }
        PcbGraphicKind::Circle => {
            let (cx, cy) = point(graphic.center);
            let (ex, ey) = point(graphic.end);
            let radius = libm::hypot(ex - cx, ey - cy);
            points.push((cx - radius, cy - radius));
            points.push((cx + radius, cy + radius));
        }
        PcbGraphicKind::Arc => {
            points.push(point(graphic.start));
            points.push(point(graphic.mid));
            points.push(point(graphic.end));
        }
        PcbGraphicKind::Poly => {
            points.extend(graphic.points.iter().map(|point| (point.x, point.y)));
        }
        PcbGraphicKind::Curve | PcbGraphicKind::Text | PcbGraphicKind::TextBox => {}
    }
}

/// The `courtyard` object: the footprint-frame (y up) extent of the local
/// points, or `null` without any (interface_extractor.py:237-242). `min`/`max`
/// run before `_round`, as today.
fn courtyard(points: &[(f64, f64)]) -> Value {
    let mut xs = points.iter().map(|(x, _y)| *x);
    let mut ys = points.iter().map(|(_x, y)| -*y);
    let (Some(first_x), Some(first_y)) = (xs.next(), ys.next()) else {
        return Value::Null;
    };
    let mut min_x = first_x;
    let mut max_x = first_x;
    let mut min_y = first_y;
    let mut max_y = first_y;
    for x in xs {
        min_x = min_x.min(x);
        max_x = max_x.max(x);
    }
    for y in ys {
        min_y = min_y.min(y);
        max_y = max_y.max(y);
    }
    json!({
        "minMm": [round4(min_x), round4(min_y)],
        "maxMm": [round4(max_x), round4(max_y)],
    })
}

/// `_model` (interface_extractor.py:199-210): the first model in file order,
/// `null` without one.
///
/// Today's guard skips a model only when `model.to_sexp()` carries a
/// `["hide"]` element. kicad_monkey's `Model.to_sexp()` never emits `hide`
/// (`kicad_model.py:58-63`), so no model is ever skipped — a footprint whose
/// first model is `(hide)`/`(hide yes)` still yields that model, and the
/// golden `rs-cynthion` U1 confirms it. The field map's "first model without
/// `(hide)`" (field-maps/system-interface.md:122) describes intent, not
/// behaviour; P5 reproduces the behaviour.
fn model(footprint: &Footprint<'_>) -> Value {
    let Some(model) = footprint.model.as_ref() else {
        return Value::Null;
    };
    json!({
        "path": model.path,
        "offsetMm": [
            round4(model.offset[0]),
            round4(model.offset[1]),
            round4(model.offset[2]),
        ],
        "rotationDeg": [
            round4(model.rotate[0]),
            round4(model.rotate[1]),
            round4(model.rotate[2]),
        ],
        "scale": [
            round4(model.scale[0]),
            round4(model.scale[1]),
            round4(model.scale[2]),
        ],
    })
}

/// One pad's `SystemInterfacePad` (interface_extractor.py:226-236): its number
/// in board-frame millimetres, its size in the pad frame, its shape and
/// whether it is a through hole. `pad_type`/`shape` are kicad_monkey's enum
/// names lower-cased (`kicad_base.py:93-99`, `kicad_pad.py:451`); the core's
/// tokens are already those spellings.
fn pad_geometry(frame: &BoardFrame, pad: &Pad<'_>) -> Value {
    let kind = pad.kind.to_ascii_lowercase();
    json!({
        "pad": pad.number,
        "positionMm": frame.point(pad.at_x, pad.at_y),
        "sizeMm": [round4(pad.size_x), round4(pad.size_y)],
        "shape": pad.shape.to_ascii_lowercase(),
        "tht": kind == "thru_hole" || kind == "np_thru_hole",
    })
}

/// `_footprint_geometry` (interface_extractor.py:213-252): one placed
/// footprint's v6 geometry, every number `_round`ed and pads stably sorted by
/// `_natural` pad number.
pub(super) fn footprint_geometry(footprint: &Footprint<'_>) -> Value {
    let frame = BoardFrame::new(footprint.at_x, footprint.at_y, footprint.angle);
    // Stable `_natural` sort: equal pad numbers keep file order (Python's
    // `list.sort`, interface_extractor.py:236).
    let mut ordered: Vec<&Pad<'_>> = footprint.pads.iter().collect();
    ordered.sort_by(|left, right| natural_cmp(left.number, right.number));
    let pads: Vec<Value> = ordered
        .iter()
        .map(|pad| pad_geometry(&frame, pad))
        .collect();
    let side = if footprint.layer.unwrap_or("").starts_with("B.") {
        "bottom"
    } else {
        "top"
    };
    json!({
        "side": side,
        "positionMm": [round4(footprint.at_x), round4(-footprint.at_y)],
        "rotationDeg": round4(footprint.angle),
        "footprintName": footprint.library_link.rsplit(':').next().unwrap_or(""),
        "pads": pads,
        "courtyard": courtyard(&footprint.courtyard),
        "model": model(footprint),
    })
}
