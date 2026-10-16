//! Board-level `gr_text` estimates. kicad_monkey renders these through
//! `kicad_text.KiCadTextRenderer` (FreeType over the host font), which has no
//! pure-Rust port, so [`board_text_boxes`] uses the posed estimate of the other
//! board `GrText` implementation, `km:kicad_pcb_graphics.py:92-111`.

use super::{Bounds, board_error};
use crate::{BoardModel, ProjectionError};
use prism_kicad_core::sexpr::Sexp;

/// `kicad_property.KICAD_DEFAULT_TEXT_SIZE_MM` / `kicad_fp_text` font default.
const DEFAULT_TEXT_SIZE: f64 = 1.27;

/// The board's `gr_text` estimates (module docs). kicad_monkey's
/// `KiCadPcb.get_bounds` routes these through the text renderer; the
/// posed estimate is `kicad_pcb_graphics.GrText.get_bounds`
/// (`km:kicad_pcb_graphics.py:92-111`).
pub(super) fn board_text_boxes(board: &BoardModel<'_>) -> Result<Vec<Bounds>, ProjectionError> {
    let Sexp::List(items) = board.tree().map_err(board_error)? else {
        return Ok(Vec::new());
    };
    let mut boxes = Vec::new();
    for item in items {
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
