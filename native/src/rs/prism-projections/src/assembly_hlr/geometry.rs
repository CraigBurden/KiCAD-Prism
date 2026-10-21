//! The projected geometry of one model, in the shapes the member records.
//!
//! Cruncher's rules: round every coordinate to `round_digits` decimal places,
//! order each segment's endpoints, drop zero-length and duplicate segments and
//! duplicate arcs, then mirror a back-side view in X. The result is kept in
//! model-local millimetres so the cache can reuse it; the footprint transform
//! to KiCad's board frame and nanometres happens last.

use prism_kicad_contracts::generated::prism_assembly_hlr_a0::{
    AssemblyHlrArc, AssemblyHlrEdges, AssemblyHlrSegment, Degrees, Nanometres,
    NonNegativeNanometres, PointNm,
};
use serde::{Deserialize, Serialize};

/// One model-local segment in millimetres: `[x1, y1, x2, y2]`.
pub type Segment = [f64; 4];

/// One model-local arc, the fields Geometer returns.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Arc {
    /// Start point, mm.
    pub start: [f64; 2],
    /// End point, mm.
    pub end: [f64; 2],
    /// Centre point, mm.
    pub center: [f64; 2],
    /// Radius, mm.
    pub radius: f64,
    /// Angular extent, radians.
    pub extent_rad: f64,
    /// Counter-clockwise from start to end.
    pub ccw: bool,
    /// A full circle, whose start and end coincide.
    pub full_circle: bool,
}

/// One projected edge set, model-local millimetres.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct EdgeSet {
    /// The straight edges.
    pub segments: Vec<Segment>,
    /// The circular edges.
    pub arcs: Vec<Arc>,
}

impl EdgeSet {
    /// Round, order and deduplicate both families (`_dedupe_segments`,
    /// `_dedupe_arcs` in `kicad_cruncher_pcb_svg_projection.py`).
    #[must_use]
    pub fn dedupe(mut self, round_digits: u32) -> Self {
        self.segments = dedupe_segments(self.segments, round_digits);
        self.arcs = dedupe_arcs(self.arcs, round_digits);
        self
    }

    /// `_normalize_projected_geometry(flip_x = side == "bottom")`.
    #[must_use]
    pub fn mirror_x(mut self) -> Self {
        for segment in &mut self.segments {
            segment[0] = -segment[0];
            segment[2] = -segment[2];
        }
        for arc in &mut self.arcs {
            arc.start[0] = -arc.start[0];
            arc.end[0] = -arc.end[0];
            arc.center[0] = -arc.center[0];
            if !arc.full_circle {
                arc.ccw = !arc.ccw;
            }
        }
        self
    }
}

/// Python's `round(value, digits)` over decimal scaling, with round-half-even
/// as Python uses.
fn round(value: f64, digits: u32) -> f64 {
    let factor = 10_f64.powi(i32::try_from(digits).unwrap_or(i32::MAX));
    let scaled = (value * factor).round_ties_even() / factor;
    // Python's `round` never returns a negative zero.
    if scaled == 0.0 { 0.0 } else { scaled }
}

/// `_dedupe_segments` (`kicad_cruncher_pcb_svg_projection.py:227-249`).
fn dedupe_segments(segments: Vec<Segment>, round_digits: u32) -> Vec<Segment> {
    let mut deduped = Vec::with_capacity(segments.len());
    let mut seen = std::collections::HashSet::new();
    for [x1, y1, x2, y2] in segments {
        let (mut x1, mut y1) = (round(x1, round_digits), round(y1, round_digits));
        let (mut x2, mut y2) = (round(x2, round_digits), round(y2, round_digits));
        if x1 == x2 && y1 == y2 {
            continue;
        }
        if x1 > x2 || (x1 == x2 && y1 > y2) {
            std::mem::swap(&mut x1, &mut x2);
            std::mem::swap(&mut y1, &mut y2);
        }
        let key = (x1.to_bits(), y1.to_bits(), x2.to_bits(), y2.to_bits());
        if seen.insert(key) {
            deduped.push([x1, y1, x2, y2]);
        }
    }
    deduped
}

/// `_dedupe_arcs` (`kicad_cruncher_pcb_svg_projection.py:251-302`).
fn dedupe_arcs(arcs: Vec<Arc>, round_digits: u32) -> Vec<Arc> {
    let mut deduped = Vec::with_capacity(arcs.len());
    let mut seen = std::collections::HashSet::new();
    for arc in arcs {
        let start = [
            round(arc.start[0], round_digits),
            round(arc.start[1], round_digits),
        ];
        let end = [
            round(arc.end[0], round_digits),
            round(arc.end[1], round_digits),
        ];
        let center = [
            round(arc.center[0], round_digits),
            round(arc.center[1], round_digits),
        ];
        let radius = round(arc.radius, round_digits);
        let key: Vec<u64> = if arc.full_circle {
            vec![
                u64::from(u8::from(false)),
                center[0].to_bits(),
                center[1].to_bits(),
                radius.to_bits(),
            ]
        } else {
            vec![
                u64::from(u8::from(true)),
                start[0].to_bits(),
                start[1].to_bits(),
                end[0].to_bits(),
                end[1].to_bits(),
                center[0].to_bits(),
                center[1].to_bits(),
                radius.to_bits(),
                round(arc.extent_rad, round_digits.max(3)).to_bits(),
                u64::from(u8::from(arc.ccw)),
            ]
        };
        if seen.insert(key) {
            deduped.push(Arc {
                start,
                end,
                center,
                radius,
                extent_rad: arc.extent_rad,
                ccw: arc.ccw,
                full_circle: arc.full_circle,
            });
        }
    }
    deduped
}

/// Millimetres to nanometres, round half to even as Python's `round` does.
#[must_use]
pub fn nm(value: f64) -> i64 {
    (value * 1_000_000.0).round_ties_even() as i64
}

fn point(value: [f64; 2]) -> PointNm {
    PointNm {
        x_nm: Nanometres(nm(value[0])),
        y_nm: Nanometres(nm(value[1])),
    }
}

/// One local edge set in KiCad's board frame, after the footprint placement.
#[must_use]
pub fn to_edges(set: &EdgeSet, position_mm: [f64; 2], rotation_deg: f64) -> AssemblyHlrEdges {
    let at = |value: [f64; 2]| {
        point(super::pose::local_to_board(
            value,
            position_mm,
            rotation_deg,
        ))
    };
    AssemblyHlrEdges {
        segments: set
            .segments
            .iter()
            .map(|segment| AssemblyHlrSegment {
                start_nm: at([segment[0], segment[1]]),
                end_nm: at([segment[2], segment[3]]),
            })
            .collect(),
        arcs: set
            .arcs
            .iter()
            .map(|arc| AssemblyHlrArc {
                start_nm: at(arc.start),
                end_nm: at(arc.end),
                center_nm: at(arc.center),
                radius_nm: NonNegativeNanometres(u64::try_from(nm(arc.radius)).unwrap_or_default()),
                extent_deg: Degrees(arc.extent_rad * 180.0 / std::f64::consts::PI),
                ccw: arc.ccw,
                full_circle: arc.full_circle,
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segment(values: [f64; 4]) -> Segment {
        values
    }

    #[test]
    fn dedupe_orders_endpoints_and_drops_duplicates() {
        let set = EdgeSet {
            segments: vec![
                segment([1.0, 0.0, 0.0, 0.0]),
                segment([0.0, 0.0, 1.0, 0.0]),
                segment([2.0, 2.0, 2.0, 2.0]),
            ],
            arcs: Vec::new(),
        }
        .dedupe(3);
        assert_eq!(set.segments, vec![[0.0, 0.0, 1.0, 0.0]]);
    }

    #[test]
    fn a_back_view_mirrors_x_and_inverts_the_arc_direction() {
        let set = EdgeSet {
            segments: vec![segment([1.0, 2.0, 3.0, 4.0])],
            arcs: vec![Arc {
                start: [1.0, 2.0],
                end: [3.0, 4.0],
                center: [2.0, 3.0],
                radius: 1.0,
                extent_rad: 1.0,
                ccw: true,
                full_circle: false,
            }],
        }
        .mirror_x();
        assert_eq!(set.segments[0], [-1.0, 2.0, -3.0, 4.0]);
        assert_eq!(set.arcs[0].center, [-2.0, 3.0]);
        assert!(!set.arcs[0].ccw);
    }

    #[test]
    fn nanometres_are_rounded_half_to_even() {
        assert_eq!(nm(0.000_000_5), 0);
        assert_eq!(nm(0.000_001_5), 2);
        assert_eq!(nm(-0.0000001), 0);
    }
}
