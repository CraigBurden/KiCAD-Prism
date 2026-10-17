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
//!
//! The port is split by concern: [`footprint`] (child boxes), [`graphics`]
//! (board shapes, routing and zones), [`arc`] (arc geometry and polygonising),
//! [`bezier`] (curve flattening) and [`text`] (the `gr_text` estimate).

mod arc;
mod bezier;
mod footprint;
mod graphics;
mod text;

use crate::{BoardModel, ProjectionError};
use prism_kicad_core::PcbPoint;

const PI: f64 = std::f64::consts::PI;
/// `kicad_pcb_polygon_ops.DEFAULT_ERROR_MM`.
const DEFAULT_ERROR_MM: f64 = 0.005;
const ZERO: PcbPoint = PcbPoint { x: 0.0, y: 0.0 };

/// `min_x, min_y, max_x, max_y` of the whole board, or `None` for an empty
/// box (kicad_monkey's `BoundingBox` starts `(∞, ∞, −∞, −∞)` and
/// `_board_outline` treats `max_x < min_x` as empty, ie:315-316).
pub(super) fn board_bounds(board: &BoardModel<'_>) -> Result<Option<[f64; 4]>, ProjectionError> {
    let mut bounds = Bounds::empty();
    // `for fp in self.footprints: bbox.merge(fp.get_bounds())`.
    for footprint in footprint::footprint_bounds(board)? {
        bounds.merge(Bounds::from_array(footprint));
    }
    for segment in board.view.decoded_segments() {
        let segment = segment
            .as_ref()
            .map_err(|error| board_error(error.clone()))?;
        bounds.merge(graphics::segment_box(segment));
    }
    for via in board.view.decoded_vias() {
        let via = via.as_ref().map_err(|error| board_error(error.clone()))?;
        bounds.merge(graphics::via_box(via));
    }
    for arc in board.view.decoded_arcs() {
        let arc = arc.as_ref().map_err(|error| board_error(error.clone()))?;
        bounds.merge(arc::routing_arc_box(arc));
    }
    for zone in board.view.decoded_zones() {
        let zone = zone.as_ref().map_err(|error| board_error(error.clone()))?;
        bounds.merge(graphics::zone_box(zone));
    }
    for graphic in board.view.decoded_graphics() {
        let graphic = graphic
            .as_ref()
            .map_err(|error| board_error(error.clone()))?;
        bounds.merge(graphics::board_graphic_box(graphic));
    }
    // Board-level `gr_text`, the renderer fallback (module docs).
    for text in text::board_text_boxes(board)? {
        bounds.merge(text);
    }
    if bounds.max_x < bounds.min_x {
        Ok(None)
    } else {
        Ok(Some(bounds.into_array()))
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

fn board_error(error: impl std::fmt::Display) -> ProjectionError {
    ProjectionError::new(format!(
        "projections/system-interface.json: the board could not be read: {error}"
    ))
}

#[cfg(test)]
mod tests {
    use super::board_bounds;
    use super::footprint::footprint_bounds;

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
            let board = crate::BoardModel::new(board_path, &text, &view);
            // Board box.
            let actual = board_bounds(&board).expect("board bounds");
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
            let actual = footprint_bounds(&board).expect("footprint bounds");
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
