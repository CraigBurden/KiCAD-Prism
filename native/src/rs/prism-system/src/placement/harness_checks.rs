//! Harness lengths and board collisions (CONTRACTS_P2 §17.10, SB2-46).
//!
//! From a routed harness ([`crate::placement::harness_route::route`]):
//!
//! - **Lengths.** The bundle is the curves' arc lengths plus each posed end's
//!   housing depth; a wire runs the segments that carry it plus its two ends'
//!   depths. Estimates add the service allowance (the harness's own, else
//!   [`LENGTH_ALLOWANCE`]).
//! - **Collisions.** Each board is an oriented box (its outline × thickness,
//!   `boundsMm` in its own frame) grown by [`BOARD_COLLISION_MARGIN_MM`]; each
//!   span between two samples is a capsule of the segment's bundle radius. A
//!   span closer to a box than that radius collides. The first [`BOOT_MM`] of
//!   arc from an end's exit is exempt against the board that end mates.
//!
//! Distances are exact to the search: the squared distance from a point moving
//! along a span to a box is convex, so a fixed golden-section search finds its
//! minimum the same way in both halves. Only squares and one square root are
//! used, never `hypot`, so the halves agree bit for bit.
//!
//! A faithful port of
//! `backend/app/services/systems/placement/harness_checks.py`; the TypeScript
//! twin is `frontend/src/features/system-builder/placement/harness-checks.ts`.

use crate::placement::harness_route::{Route, RoutedCurve};
use crate::placement::harness_spec::{BOARD_COLLISION_MARGIN_MM, BOOT_MM, LENGTH_ALLOWANCE};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

const SEARCH_STEPS: usize = 60;

/// A board as an oriented box: world matrix and box in the board's frame.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Board {
    /// The board's id (its occurrence path).
    pub id: String,
    /// Its rigid column-major world matrix in mm.
    pub matrix: [f64; 16],
    /// The box's minimum corner in the board's frame.
    pub min_mm: [f64; 3],
    /// The box's maximum corner in the board's frame.
    pub max_mm: [f64; 3],
}

/// One segment–board pair that collides.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Collision {
    /// The segment that collides.
    pub segment_id: String,
    /// The board it collides with.
    pub board: String,
    /// The least distance from the closest span to the box.
    pub distance_mm: f64,
    /// The segment's bundle radius.
    pub radius_mm: f64,
    /// The closest point of the closest span.
    pub at_mm: [f64; 3],
    /// The colliding span indices (span `i` joins samples `i` and `i+1`).
    pub spans: Vec<usize>,
}

/// One wire's routed length and estimate.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WireLength {
    /// The run plus its two ends' depths.
    pub length_mm: f64,
    /// The length with the allowance.
    pub estimated_mm: f64,
}

/// Bundle and per-wire lengths with the service allowance.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lengths {
    /// Every curve plus every posed end's depth.
    pub bundle_mm: f64,
    /// The bundle with the allowance.
    pub estimated_mm: f64,
    /// The allowance used, in percent.
    pub allowance_pct: f64,
    /// False when an end has no pose or a wire is unplaced.
    pub complete: bool,
    /// Each routed wire's lengths.
    pub wires: BTreeMap<String, WireLength>,
}

/// The squared distance from `p` to the box `lo`–`hi`.
fn box_distance2(p: [f64; 3], lo: [f64; 3], hi: [f64; 3]) -> f64 {
    let mut total = 0.0;
    for k in 0..3 {
        let d = if p[k] < lo[k] {
            lo[k] - p[k]
        } else if p[k] > hi[k] {
            p[k] - hi[k]
        } else {
            0.0
        };
        total += d * d;
    }
    total
}

/// `(distance, t)`: the least distance from the span `a→b` to the box
/// `lo`–`hi` (same frame) and where along the span (0…1) it is. Ports
/// `harness_checks.py:span_box_distance`.
pub fn span_box_distance(a: [f64; 3], b: [f64; 3], lo: [f64; 3], hi: [f64; 3]) -> (f64, f64) {
    let golden = (5.0_f64.sqrt() - 1.0) / 2.0;
    let f = |t: f64| box_distance2([0usize, 1, 2].map(|k| a[k] + t * (b[k] - a[k])), lo, hi);
    let mut left = 0.0;
    let mut right = 1.0;
    let mut x1 = right - golden * (right - left);
    let mut x2 = left + golden * (right - left);
    let mut f1 = f(x1);
    let mut f2 = f(x2);
    for _ in 0..SEARCH_STEPS {
        if f1 <= f2 {
            right = x2;
            x2 = x1;
            f2 = f1;
            x1 = right - golden * (right - left);
            f1 = f(x1);
        } else {
            left = x1;
            x1 = x2;
            f1 = f2;
            x2 = left + golden * (right - left);
            f2 = f(x2);
        }
    }
    let (mut best_t, mut best) = if f1 <= f2 { (x1, f1) } else { (x2, f2) };
    for t in [0.0, 1.0] {
        let value = f(t);
        if value < best {
            best_t = t;
            best = value;
        }
    }
    (best.sqrt(), best_t)
}

/// A world point in a rigid column-major matrix's frame: `Rᵀ(p − t)`. Ports
/// `harness_checks.py:_local`.
fn local(m: &[f64; 16], p: [f64; 3]) -> [f64; 3] {
    let d = [p[0] - m[12], p[1] - m[13], p[2] - m[14]];
    [0usize, 1, 2].map(|k| m[k * 4] * d[0] + m[k * 4 + 1] * d[1] + m[k * 4 + 2] * d[2])
}

/// The length of span `i`.
fn span_length(samples: &[[f64; 3]], i: usize) -> f64 {
    let a = samples[i];
    let b = samples[i + 1];
    let mut total = 0.0;
    for k in 0..3 {
        total += (b[k] - a[k]) * (b[k] - a[k]);
    }
    total.sqrt()
}

/// How many spans lie (at least partly) within the first boot of arc from the
/// start (or the end). Ports `harness_checks.py:_exempt`.
pub fn exempt(samples: &[[f64; 3]], from_start: bool) -> usize {
    let count = samples.len().saturating_sub(1);
    let mut arc = 0.0;
    for n in 0..count {
        let i = if from_start { n } else { count - 1 - n };
        if arc >= BOOT_MM {
            return n;
        }
        arc += span_length(samples, i);
    }
    count
}

/// The spans exempt against each board that an end mates.
fn exemptions(routed: &Route, curve: &RoutedCurve) -> BTreeMap<String, BTreeSet<usize>> {
    let count = curve.curve.samples_mm.len().saturating_sub(1);
    let mut spans = BTreeMap::new();
    if let Some(end) = routed.ends.get(&curve.from) {
        spans
            .entry(end.occurrence.clone())
            .or_insert_with(BTreeSet::new)
            .extend(0..exempt(&curve.curve.samples_mm, true));
    }
    if let Some(end) = routed.ends.get(&curve.to) {
        spans
            .entry(end.occurrence.clone())
            .or_insert_with(BTreeSet::new)
            .extend(count.saturating_sub(exempt(&curve.curve.samples_mm, false))..count);
    }
    spans
}

/// One curve against one board: the colliding spans and the closest one.
fn curve_board_collision(
    curve: &RoutedCurve,
    board: &Board,
    lo: [f64; 3],
    hi: [f64; 3],
    skip: Option<&BTreeSet<usize>>,
) -> Option<(Vec<usize>, f64, usize, f64)> {
    let samples = &curve.curve.samples_mm;
    let count = samples.len().saturating_sub(1);
    let radius = curve.diameter_mm / 2.0;
    let points: Vec<[f64; 3]> = samples.iter().map(|p| local(&board.matrix, *p)).collect();
    let mut spans = Vec::new();
    let mut best: Option<(f64, usize, f64)> = None;
    for i in 0..count {
        if skip.is_some_and(|skip| skip.contains(&i)) {
            continue;
        }
        let (distance, t) = span_box_distance(points[i], points[i + 1], lo, hi);
        if distance < radius {
            spans.push(i);
            if best.is_none_or(|(closest, _, _)| distance < closest) {
                best = Some((distance, i, t));
            }
        }
    }
    best.map(|(distance, i, t)| (spans, distance, i, t))
}

/// Every segment–board pair that collides, in curve then board order. Ports
/// `harness_checks.py:collisions`.
pub fn collisions(routed: &Route, boards: &[Board]) -> Vec<Collision> {
    let margin = BOARD_COLLISION_MARGIN_MM;
    let boxes: Vec<(&Board, [f64; 3], [f64; 3])> = boards
        .iter()
        .map(|board| {
            (
                board,
                [0usize, 1, 2].map(|k| board.min_mm[k] - margin),
                [0usize, 1, 2].map(|k| board.max_mm[k] + margin),
            )
        })
        .collect();
    let mut out = Vec::new();
    for curve in &routed.curves {
        let radius = curve.diameter_mm / 2.0;
        if radius <= 0.0 || curve.curve.samples_mm.len() < 2 {
            continue;
        }
        let exempt = exemptions(routed, curve);
        for (board, lo, hi) in &boxes {
            let Some((spans, distance, i, t)) =
                curve_board_collision(curve, board, *lo, *hi, exempt.get(&board.id))
            else {
                continue;
            };
            let a = curve.curve.samples_mm[i];
            let b = curve.curve.samples_mm[i + 1];
            out.push(Collision {
                segment_id: curve.segment_id.clone(),
                board: board.id.clone(),
                distance_mm: distance,
                radius_mm: radius,
                at_mm: [0usize, 1, 2].map(|k| a[k] + t * (b[k] - a[k])),
                spans,
            });
        }
    }
    out
}

/// `{bundleMm, estimatedMm, allowancePct, complete, wires: {wireId: …}}`.
/// `complete` is false when an end has no pose or a wire is unplaced: the
/// numbers then cover only what is routed. Ports `harness_checks.py:lengths`.
pub fn lengths(routed: &Route, allowance_pct: Option<f64>) -> Lengths {
    let allowance = allowance_pct.map_or(LENGTH_ALLOWANCE, |pct| pct / 100.0);
    let depth: BTreeMap<&str, f64> = routed
        .ends
        .iter()
        .map(|(id, end)| (id.as_str(), end.pose.depth_mm))
        .collect();
    let mut bundle = routed
        .curves
        .iter()
        .map(|curve| curve.curve.length_mm)
        .sum::<f64>();
    bundle += depth.values().sum::<f64>();
    let mut run: BTreeMap<&str, f64> = BTreeMap::new();
    for curve in &routed.curves {
        for wire in &curve.wires {
            *run.entry(wire.as_str()).or_insert(0.0) += curve.curve.length_mm;
        }
    }
    let mut wires = BTreeMap::new();
    for wire in &routed.wires {
        let Some(length) = run.get(wire.id.as_str()) else {
            continue;
        };
        let (Some(from), Some(to)) = (depth.get(wire.from.as_str()), depth.get(wire.to.as_str()))
        else {
            continue;
        };
        let value = length + from + to;
        wires.insert(
            wire.id.clone(),
            WireLength {
                length_mm: value,
                estimated_mm: value * (1.0 + allowance),
            },
        );
    }
    Lengths {
        bundle_mm: bundle,
        estimated_mm: bundle * (1.0 + allowance),
        allowance_pct: allowance * 100.0,
        complete: routed.unplaced.is_empty(),
        wires,
    }
}
