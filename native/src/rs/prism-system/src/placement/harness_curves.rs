//! Harness curves: control polygons, centripetal Catmull-Rom, bend radius and
//! arc length (CONTRACTS_P2 §17.8; PLAN §7 items 4–6).
//!
//! Each segment of the harness tree (SB2-42) is one curve through its control
//! polygon. A faithful port of
//! `backend/app/services/systems/placement/harness_curves.py`; the TypeScript
//! twin is `frontend/src/features/system-builder/placement/harness-curves.ts`
//! and must produce the same samples (lengths agree within 0.01 mm, findings
//! exactly).

use crate::placement::harness_spec::{
    BEND_RELAX_ITERATIONS, BOOT_MM, CATMULL_ROM_ALPHA, CHORD_ERROR_MM, MIN_BEND_RADIUS_FACTOR,
};
use crate::placement::harness_topology::{HarnessNode, Topology};
use crate::placement::poses::clean;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Subdivision depth per span.
const MAX_DEPTH: usize = 12;
/// Always split a span at least this often (S-shaped spans have mid-points on
/// the chord).
const MIN_DEPTH: usize = 2;
/// Points closer than this are duplicates.
const DUPLICATE_MM: f64 = 1e-9;

/// The tightest bend that still violates the minimum radius.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TightBend {
    /// Where along the samples it is.
    pub at_mm: [f64; 3],
    /// Its radius.
    pub radius_mm: f64,
}

/// One segment's curve.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Curve {
    /// The control polygon after de-duplication and relaxation.
    pub control_mm: Vec<[f64; 3]>,
    /// The adaptive samples.
    pub samples_mm: Vec<[f64; 3]>,
    /// The arc length through the samples.
    pub length_mm: f64,
    /// The smallest bend radius, or `None` when straight.
    pub min_radius_mm: Option<f64>,
    /// The radius relaxation aims for.
    pub min_radius_allowed_mm: f64,
    /// The still-violating bend, when there is one.
    pub tight_bend: Option<TightBend>,
}

/// A curve plus the segment it belongs to.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentCurve {
    /// The segment's id.
    pub segment_id: String,
    /// The curve itself.
    #[serde(flatten)]
    pub curve: Curve,
}

/// The fixed points an end contributes to a curve.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurveEnd {
    /// The cable exit.
    pub exit_mm: [f64; 3],
    /// The unit outward axis.
    pub outward: [f64; 3],
    /// The leg point.
    pub leg_mm: [f64; 3],
}

/// `a - b`.
fn sub(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

/// The Euclidean distance.
fn dist(a: [f64; 3], b: [f64; 3]) -> f64 {
    let (dx, dy, dz) = (a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    (dx * dx + dy * dy + dz * dz).sqrt()
}

/// The linear interpolation `a→b` at `t` on the `ta–tb` interval.
fn lerp(a: [f64; 3], b: [f64; 3], ta: f64, tb: f64, t: f64) -> [f64; 3] {
    if tb == ta {
        return a;
    }
    let wa = (tb - t) / (tb - ta);
    let wb = (t - ta) / (tb - ta);
    [0usize, 1, 2].map(|k| wa * a[k] + wb * b[k])
}

/// Centripetal Catmull-Rom between `p1` and `p2` (Barry–Goldman), as
/// `u ∈ [0, 1] → point`. Ports `harness_curves.py:_span`.
fn span(p0: [f64; 3], p1: [f64; 3], p2: [f64; 3], p3: [f64; 3]) -> impl Fn(f64) -> [f64; 3] {
    let alpha = CATMULL_ROM_ALPHA;
    let t0 = 0.0;
    let t1 = t0 + dist(p0, p1).powf(alpha);
    let t2 = t1 + dist(p1, p2).powf(alpha);
    let t3 = t2 + dist(p2, p3).powf(alpha);
    move |u: f64| {
        let t = t1 + u * (t2 - t1);
        let a1 = lerp(p0, p1, t0, t1, t);
        let a2 = lerp(p1, p2, t1, t2, t);
        let a3 = lerp(p2, p3, t2, t3, t);
        let b1 = lerp(a1, a2, t0, t2, t);
        let b2 = lerp(a2, a3, t1, t3, t);
        lerp(b1, b2, t1, t2, t)
    }
}

/// The point's distance from the chord `a→b`.
fn off_chord(point: [f64; 3], a: [f64; 3], b: [f64; 3]) -> f64 {
    let ab = sub(b, a);
    let ap = sub(point, a);
    let length = (ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]).sqrt();
    if length < 1e-12 {
        return dist(point, a);
    }
    let cross = [
        ab[1] * ap[2] - ab[2] * ap[1],
        ab[2] * ap[0] - ab[0] * ap[2],
        ab[0] * ap[1] - ab[1] * ap[0],
    ];
    (cross[0] * cross[0] + cross[1] * cross[1] + cross[2] * cross[2]).sqrt() / length
}

/// Drop consecutive duplicates, keeping the last flag's conjunction.
fn dedupe(points: &[[f64; 3]], movable: &[bool]) -> (Vec<[f64; 3]>, Vec<bool>) {
    let mut out: Vec<[f64; 3]> = Vec::new();
    let mut flags: Vec<bool> = Vec::new();
    for (point, free) in points.iter().zip(movable) {
        if let Some(last) = out.last()
            && dist(*last, *point) < DUPLICATE_MM
        {
            if let Some(flag) = flags.last_mut() {
                *flag = *flag && *free;
            }
            continue;
        }
        out.push(*point);
        flags.push(*free);
    }
    (out, flags)
}

/// The samples collected so far and the span being split.
struct Sampling {
    samples: Vec<[f64; 3]>,
    spans: Vec<usize>,
    index: usize,
}

/// One recursive split step of [`sample`].
fn split_span<F: Fn(f64) -> [f64; 3]>(
    at: &F,
    u0: f64,
    u1: f64,
    a: [f64; 3],
    b: [f64; 3],
    depth: usize,
    state: &mut Sampling,
) {
    let um = (u0 + u1) / 2.0;
    let mid = at(um);
    if depth < MIN_DEPTH || (depth < MAX_DEPTH && off_chord(mid, a, b) > CHORD_ERROR_MM) {
        split_span(at, u0, um, a, mid, depth + 1, state);
        split_span(at, um, u1, mid, b, depth + 1, state);
    } else {
        state.samples.push(b);
        state.spans.push(state.index);
    }
}

/// Adaptive samples of the curve through `points` (chord error
/// [`CHORD_ERROR_MM`]) and, for each sample, the index of the span it ends.
/// Ports `harness_curves.py:sample`.
pub fn sample(points: &[[f64; 3]]) -> (Vec<[f64; 3]>, Vec<usize>) {
    if points.len() < 2 {
        return (points.to_vec(), vec![0; points.len()]);
    }
    let first = points[0];
    let last = points[points.len() - 1];
    let mut ext = Vec::with_capacity(points.len() + 2);
    ext.push(sub(
        [2.0 * first[0], 2.0 * first[1], 2.0 * first[2]],
        points[1],
    ));
    ext.extend_from_slice(points);
    ext.push(sub(
        [2.0 * last[0], 2.0 * last[1], 2.0 * last[2]],
        points[points.len() - 2],
    ));
    let mut state = Sampling {
        samples: vec![first],
        spans: vec![0],
        index: 0,
    };
    for i in 0..points.len() - 1 {
        let at = span(ext[i], ext[i + 1], ext[i + 2], ext[i + 3]);
        state.index = i;
        split_span(&at, 0.0, 1.0, points[i], points[i + 1], 0, &mut state);
    }
    (state.samples, state.spans)
}

/// The circumradius through three samples (`inf` when they are collinear).
fn radius(a: [f64; 3], b: [f64; 3], c: [f64; 3]) -> f64 {
    let ab = dist(a, b);
    let bc = dist(b, c);
    let ca = dist(c, a);
    let u = sub(b, a);
    let v = sub(c, a);
    let cross = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    ];
    let twice_area = (cross[0] * cross[0] + cross[1] * cross[1] + cross[2] * cross[2]).sqrt();
    if twice_area < 1e-12 {
        return f64::INFINITY;
    }
    ab * bc * ca / (2.0 * twice_area)
}

/// The smallest bend radius along the samples and the sample where it is
/// (`inf`, -1 when straight). Ports `harness_curves.py:tightest`.
pub fn tightest(samples: &[[f64; 3]]) -> (f64, i32) {
    let mut best = f64::INFINITY;
    let mut at = -1;
    for i in 1..samples.len().saturating_sub(1) {
        let r = radius(samples[i - 1], samples[i], samples[i + 1]);
        if r < best {
            best = r;
            at = i as i32;
        }
    }
    (best, at)
}

/// The movable control point nearest the tightest sample, ties to the earlier.
fn relax_target(candidates: &[usize], span_index: usize) -> Option<usize> {
    candidates.iter().copied().min_by_key(|i| {
        let near = i.abs_diff(span_index).min(i.abs_diff(span_index + 1));
        (near, *i)
    })
}

/// One segment's curve with bend-radius relaxation. Ports
/// `harness_curves.py:curve`.
///
/// `movable` marks the control points relaxation may move (waypoints; never
/// exits, legs, their tangent points or breakouts).
pub fn curve(points: &[[f64; 3]], movable: &[bool], diameter_mm: f64) -> Curve {
    let (mut control, free) = dedupe(points, movable);
    let allowed = MIN_BEND_RADIUS_FACTOR * diameter_mm;
    let (mut samples, mut spans) = sample(&control);
    let (mut tight, mut where_) = tightest(&samples);
    for _ in 0..BEND_RELAX_ITERATIONS {
        if tight >= allowed || where_ < 0 {
            break;
        }
        let span_index = spans[where_ as usize];
        let candidates: Vec<usize> = (1..control.len().saturating_sub(1))
            .filter(|i| free[*i])
            .collect();
        let Some(target) = relax_target(&candidates, span_index) else {
            break;
        };
        let mid = [0usize, 1, 2].map(|k| (control[target - 1][k] + control[target + 1][k]) / 2.0);
        control[target] = [0usize, 1, 2].map(|k| (control[target][k] + mid[k]) / 2.0);
        (samples, spans) = sample(&control);
        (tight, where_) = tightest(&samples);
    }
    let length = samples
        .windows(2)
        .map(|pair| dist(pair[0], pair[1]))
        .sum::<f64>();
    let tight_bend = if where_ >= 0 && tight < allowed {
        Some(TightBend {
            at_mm: samples[where_ as usize].map(clean),
            radius_mm: clean(tight),
        })
    } else {
        None
    };
    Curve {
        control_mm: control.iter().map(|p| p.map(clean)).collect(),
        samples_mm: samples.iter().map(|p| p.map(clean)).collect(),
        length_mm: clean(length),
        min_radius_mm: if tight.is_infinite() {
            None
        } else {
            Some(clean(tight))
        },
        min_radius_allowed_mm: clean(allowed),
        tight_bend,
    }
}

/// An end's fixed points from the exit outward: exit, half a boot, the leg
/// point, half a boot on. Ports `harness_curves.py:_head`.
fn head(end: &CurveEnd) -> Vec<[f64; 3]> {
    let half = BOOT_MM / 2.0;
    let exit = end.exit_mm;
    let out = end.outward;
    let leg = end.leg_mm;
    vec![
        exit,
        [0usize, 1, 2].map(|k| exit[k] + half * out[k]),
        leg,
        [0usize, 1, 2].map(|k| leg[k] + half * out[k]),
    ]
}

/// The points at one side of a segment: an end's head or the node position.
fn side_points(
    node: &str,
    ends: &BTreeMap<String, CurveEnd>,
    position: &BTreeMap<String, [f64; 3]>,
) -> Option<(Vec<[f64; 3]>, Vec<bool>)> {
    if let Some(end) = ends.get(node) {
        let points = head(end);
        let free = vec![false; points.len()];
        return Some((points, free));
    }
    let point = *position.get(node)?;
    Some((vec![point], vec![false]))
}

/// A curve per segment of `tree` (SB2-42's [`Topology`]). Ports
/// `harness_curves.py:harness_curves`.
///
/// `ends` maps end ID → its SB2-41 pose; `waypoints` maps segment ID → points
/// from its `from` node toward its `to` node, and `pinned` the waypoints
/// relaxation leaves where they are (SB2-45).
pub fn harness_curves(
    ends: &BTreeMap<String, CurveEnd>,
    tree: &Topology,
    waypoints: &BTreeMap<String, Vec<[f64; 3]>>,
    pinned: &BTreeMap<String, Vec<bool>>,
) -> Vec<SegmentCurve> {
    let position: BTreeMap<String, [f64; 3]> = tree
        .nodes
        .iter()
        .map(|node: &HarnessNode| (node.id.clone(), node.position_mm))
        .collect();
    let mut out = Vec::new();
    for segment in &tree.segments {
        let Some((head_points, head_free)) = side_points(&segment.from, ends, &position) else {
            continue;
        };
        let Some((mut tail, tail_free)) = side_points(&segment.to, ends, &position) else {
            continue;
        };
        let middle = waypoints.get(&segment.id).cloned().unwrap_or_default();
        let fixed = pinned.get(&segment.id).map(Vec::as_slice).unwrap_or(&[]);
        let mut points = head_points;
        points.extend_from_slice(&middle);
        tail.reverse();
        points.extend_from_slice(&tail);
        let mut movable = head_free;
        movable.extend((0..middle.len()).map(|i| !(i < fixed.len() && fixed[i])));
        movable.extend(tail_free.iter().rev().copied());
        out.push(SegmentCurve {
            segment_id: segment.id.clone(),
            curve: curve(&points, &movable, segment.diameter_mm),
        });
    }
    out
}
