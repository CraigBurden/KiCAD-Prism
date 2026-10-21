//! The mate transform, connector bodies and stack-height clearance
//! (CONTRACTS_P2 §14.5, §14.8).
//!
//! Board B sits relative to board A as
//!
//! ```text
//! B = A · F_a · T(0, 0, h) · Rx(180°) · Rz(k · 90°) · F_b⁻¹
//! ```
//!
//! where `F_a`/`F_b` are the two connector frames (`frames::connector_frame`,
//! with any stored override and its quarter-turns applied), `k` puts pad 1 on
//! pad 1 and `h` is the link's stack height or the clearance fallback.
//!
//! A faithful port of `backend/app/services/systems/placement/mate.py`; the
//! TypeScript twin is
//! `frontend/src/features/system-builder/placement/mate.ts`.

use crate::placement::frames::{
    ConnectorFrame, ConnectorGeometry, StoredFrame, connector_frame, footprint_point,
};
use crate::placement::poses::{Bounds, Pose, canonical_rotation, clean, compose, rotate};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// A body without model bounds: courtyard × this.
pub const ASSUMED_BODY_HEIGHT_MM: f64 = 5.0;
/// An unknown stack sits visibly apart (§14.5).
pub const CLEARANCE_MARGIN_MM: f64 = 5.0;

/// `math.sqrt(0.5)`, as the Python twin computes it.
const S: f64 = std::f64::consts::FRAC_1_SQRT_2;

/// Quarter-turns about the mating axis, as quaternions (`mate.py:_QUARTER_TURNS`).
const QUARTER_TURNS: [[f64; 4]; 4] = [
    [0.0, 0.0, 0.0, 1.0],
    [0.0, 0.0, S, S],
    [0.0, 0.0, 1.0, 0.0],
    [0.0, 0.0, S, -S],
];

/// `Rx(180°)` (`mate.py:_FLIP_X`).
const FLIP_X: [f64; 4] = [1.0, 0.0, 0.0, 0.0];

/// One end of a B2B pair: extractor v6 geometry, the board thickness, the
/// stored mating record (None = the inference) and optional body bounds.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MateEnd {
    /// The connector's extractor v6 geometry.
    pub geometry: ConnectorGeometry,
    /// The board thickness in mm.
    #[serde(default)]
    pub thickness_mm: Option<f64>,
    /// The stored mating record; `None` means the inference.
    #[serde(default)]
    pub stored: Option<StoredFrame>,
    /// The body in the footprint's own frame, when known.
    #[serde(default)]
    pub body_mm: Option<Bounds>,
}

/// Which height the mate used.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HeightSource {
    /// The link's stack height.
    Link,
    /// The clearance fallback.
    Clearance,
}

/// B's board frame in A's board frame, for one B2B pair.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MateResult {
    /// B's board frame in A's board frame.
    pub pose: Pose,
    /// The quarter-turns that put pad 1 on pad 1.
    pub quarter_turns: i32,
    /// The stack height used.
    pub stack_height_mm: f64,
    /// Where that height came from.
    pub height_source: HeightSource,
}

/// How far placed board B is from where a pair's [`mate`] result puts it
/// (SYS-V11 input).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Residual {
    /// B's connector origin minus its mated position, on A's connector axes.
    pub offset_mm: [f64; 3],
    /// The length of the offset.
    pub distance_mm: f64,
    /// The offset across the mating plane.
    pub lateral_mm: f64,
    /// The rotation between the two, in degrees.
    pub angle_deg: f64,
}

/// `mate.py:_frame_pose`.
fn frame_pose(frame: &ConnectorFrame) -> Pose {
    Pose {
        translation_mm: frame.origin_mm,
        rotation: frame.rotation,
    }
}

/// The inverse pose. Ports `mate.py:inverse`.
pub fn inverse(pose: &Pose) -> Pose {
    let [x, y, z, w] = pose.rotation;
    let back = [-x, -y, -z, w];
    let moved = rotate(back, pose.translation_mm);
    Pose {
        translation_mm: [clean(-moved[0]), clean(-moved[1]), clean(-moved[2])],
        rotation: canonical_rotation(back),
    }
}

/// A board-frame point in the connector frame's coordinates. Ports
/// `mate.py:_local`.
pub fn local(frame: &ConnectorFrame, point: [f64; 3]) -> [f64; 3] {
    let d = [
        point[0] - frame.origin_mm[0],
        point[1] - frame.origin_mm[1],
        point[2] - frame.origin_mm[2],
    ];
    [
        d[0] * frame.x_axis[0] + d[1] * frame.x_axis[1] + d[2] * frame.x_axis[2],
        d[0] * frame.y_axis[0] + d[1] * frame.y_axis[1] + d[2] * frame.y_axis[2],
        d[0] * frame.z_axis[0] + d[1] * frame.z_axis[1] + d[2] * frame.z_axis[2],
    ]
}

/// A point in `F_b` coordinates → `F_a` coordinates under
/// `T(0,0,h)·Rx(180°)·Rz(k·90°)`. Ports `mate.py:_mated`.
pub fn mated(point: [f64; 3], k: i32, h: f64) -> [f64; 3] {
    let (mut x, mut y) = (point[0], point[1]);
    for _ in 0..k.rem_euclid(4) {
        let (next_x, next_y) = (-y, x);
        x = next_x;
        y = next_y;
    }
    [x, -y, h - point[2]]
}

/// Named pads' centres in the frame (pads sharing a name collapse to their
/// centroid). Ports `mate.py:_pad_names`.
pub fn pad_names(
    geometry: &ConnectorGeometry,
    frame: &ConnectorFrame,
) -> BTreeMap<String, [f64; 2]> {
    let mut groups: BTreeMap<String, Vec<[f64; 3]>> = BTreeMap::new();
    for pad in &geometry.pads {
        if pad.pad.is_empty() {
            continue;
        }
        let point = [pad.position_mm[0], pad.position_mm[1], frame.origin_mm[2]];
        groups
            .entry(pad.pad.clone())
            .or_default()
            .push(local(frame, point));
    }
    groups
        .into_iter()
        .map(|(name, points)| {
            let count = points.len() as f64;
            let x = points.iter().map(|p| p[0]).sum::<f64>() / count;
            let y = points.iter().map(|p| p[1]).sum::<f64>() / count;
            (name, [x, y])
        })
        .collect()
}

/// §14.5 default `k`: the least summed distance between same-named pads, ties
/// to the lower k. The frames are the *unturned* ones. No common pad names: 0.
/// Ports `mate.py:pad_one_turns`.
pub fn pad_one_turns(
    geometry_a: &ConnectorGeometry,
    frame_a: &ConnectorFrame,
    geometry_b: &ConnectorGeometry,
    frame_b: &ConnectorFrame,
) -> i32 {
    let pads_a = pad_names(geometry_a, frame_a);
    let pads_b = pad_names(geometry_b, frame_b);
    let common: Vec<&String> = pads_a
        .keys()
        .filter(|name| pads_b.contains_key(*name))
        .collect();
    if common.is_empty() {
        return 0;
    }
    let mut best = 0;
    let mut best_sum = f64::INFINITY;
    for k in 0..4 {
        let mut total = 0.0;
        for name in &common {
            let pad_b = pads_b[*name];
            let pad_a = pads_a[*name];
            let moved = mated([pad_b[0], pad_b[1], 0.0], k, 0.0);
            total += (moved[0] - pad_a[0]).hypot(moved[1] - pad_a[1]);
        }
        if total < best_sum - 1e-6 {
            best = k;
            best_sum = total;
        }
    }
    best
}

/// The eight corners of a connector body in the board frame.
///
/// `bounds` is the body in the footprint's own frame (y up, before rotation, a
/// back footprint in its stored mirrored coordinates) with z measured outward
/// from the mounting surface. Without it: the courtyard (or, lacking one, the
/// pad centres) × [`ASSUMED_BODY_HEIGHT_MM`]. `None` when there is neither
/// bounds, nor a courtyard, nor a pad. Ports `mate.py:body_corners`.
pub fn body_corners(
    geometry: &ConnectorGeometry,
    thickness_mm: Option<f64>,
    bounds: Option<&Bounds>,
) -> Option<Vec<[f64; 3]>> {
    let (lo, hi) = if let Some(bounds) = bounds {
        (bounds.min_mm, bounds.max_mm)
    } else if let Some(courtyard) = geometry.courtyard.as_ref() {
        (
            [courtyard.min_mm[0], courtyard.min_mm[1], 0.0],
            [
                courtyard.max_mm[0],
                courtyard.max_mm[1],
                ASSUMED_BODY_HEIGHT_MM,
            ],
        )
    } else {
        let local: Vec<[f64; 2]> = geometry
            .pads
            .iter()
            .map(|pad| footprint_point(geometry, pad.position_mm))
            .collect();
        let min_x = local.iter().map(|p| p[0]).fold(f64::INFINITY, f64::min);
        let max_x = local.iter().map(|p| p[0]).fold(f64::NEG_INFINITY, f64::max);
        let min_y = local.iter().map(|p| p[1]).fold(f64::INFINITY, f64::min);
        let max_y = local.iter().map(|p| p[1]).fold(f64::NEG_INFINITY, f64::max);
        if !min_x.is_finite() || !min_y.is_finite() || !max_x.is_finite() || !max_y.is_finite() {
            return None;
        }
        ([min_x, min_y, 0.0], [max_x, max_y, ASSUMED_BODY_HEIGHT_MM])
    };
    let a = geometry.rotation_deg.to_radians();
    let [px, py] = geometry.position_mm;
    let half = thickness_mm.unwrap_or(0.0) / 2.0;
    let top = geometry.side == crate::placement::frames::Side::Top;
    let mut corners = Vec::with_capacity(8);
    for i in 0..8 {
        let coordinate = |k: usize| if (i >> k) & 1 == 1 { hi[k] } else { lo[k] };
        let (x, y, z) = (coordinate(0), coordinate(1), coordinate(2));
        corners.push([
            px + x * a.cos() - y * a.sin(),
            py + x * a.sin() + y * a.cos(),
            if top { half + z } else { -half - z },
        ]);
    }
    Some(corners)
}

/// The corners' box in the connector frame (`mate.py:_box_in`).
pub(crate) fn box_in(frame: &ConnectorFrame, corners: &[[f64; 3]]) -> Option<([f64; 3], [f64; 3])> {
    let first = corners.first()?;
    let mut lo = local(frame, *first);
    let mut hi = lo;
    for corner in &corners[1..] {
        let point = local(frame, *corner);
        for k in 0..3 {
            lo[k] = lo[k].min(point[k]);
            hi[k] = hi[k].max(point[k]);
        }
    }
    Some((lo, hi))
}

/// §14.5 fallback `h`: the least separation at which the two bodies' boxes
/// (each an oriented box in its own connector frame) stop overlapping, plus
/// [`CLEARANCE_MARGIN_MM`]. Boxes whose footprints don't overlap across the
/// mating plane never meet: 0 + margin. Ports `mate.py:clearance_height`.
pub fn clearance_height(
    frame_a: &ConnectorFrame,
    corners_a: &[[f64; 3]],
    frame_b: &ConnectorFrame,
    corners_b: &[[f64; 3]],
    k: i32,
) -> Option<f64> {
    let (lo_a, hi_a) = box_in(frame_a, corners_a)?;
    let (lo_b, hi_b) = box_in(frame_b, corners_b)?;
    let moved: Vec<[f64; 3]> = [lo_b[0], hi_b[0]]
        .into_iter()
        .flat_map(|x| {
            [lo_b[1], hi_b[1]]
                .into_iter()
                .map(move |y| mated([x, y, 0.0], k, 0.0))
        })
        .collect();
    let mut overlap = true;
    for i in 0..2 {
        let min = moved.iter().map(|p| p[i]).fold(f64::INFINITY, f64::min);
        let max = moved.iter().map(|p| p[i]).fold(f64::NEG_INFINITY, f64::max);
        overlap &= min < hi_a[i] - 1e-9 && max > lo_a[i] + 1e-9;
    }
    let touching = if overlap { hi_a[2] + hi_b[2] } else { 0.0 };
    Some(clean(touching.max(0.0) + CLEARANCE_MARGIN_MM))
}

/// The stored record with its quarter-turns removed (`mate.py:_unturned`).
fn unturned(stored: Option<&StoredFrame>) -> Option<StoredFrame> {
    stored.map(|stored| StoredFrame {
        axis: stored.axis,
        quarter_turns: Some(0),
    })
}

/// B's board frame in A's board frame for one B2B pair, or `None` when either
/// connector frame is unknown. Ports `mate.py:mate`; [`mate_oriented`] with no
/// extra turns, no flip and no offset.
pub fn mate(a: &MateEnd, b: &MateEnd, stack_height_mm: Option<f64>) -> Option<MateResult> {
    mate_oriented(a, b, stack_height_mm, &Orientation::default())
}

/// A system mate's orientation and offset (CONTRACTS §2.4, §8.9).
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Orientation {
    /// Quarter turns added to the pad-1-on-pad-1 turns.
    pub quarter_turns: i32,
    /// B mates on its frame turned 180° about its x axis.
    pub flip: bool,
    /// Applied in A's connector frame before the joint (spacers, a tilted fit).
    pub offset: Option<Pose>,
}

/// B's connector frame turned 180° about its own x axis: y and z reversed.
fn flipped(frame: &ConnectorFrame) -> ConnectorFrame {
    ConnectorFrame {
        y_axis: frame.y_axis.map(|v| -v),
        z_axis: frame.z_axis.map(|v| -v),
        rotation: canonical_rotation(multiply_rotations(frame.rotation, FLIP_X)),
        ..frame.clone()
    }
}

fn multiply_rotations(a: [f64; 4], b: [f64; 4]) -> [f64; 4] {
    compose(
        &Pose {
            translation_mm: [0.0; 3],
            rotation: a,
        },
        &Pose {
            translation_mm: [0.0; 3],
            rotation: b,
        },
    )
    .rotation
}

/// B's board frame in A's board frame for one system mate:
///
/// ```text
/// B = A · F_a · O · T(0, 0, h) · Rx(180°) · Rz(k · 90°) · F_b'⁻¹
/// ```
///
/// with `k = (padOneTurns + quarterTurns) mod 4` (as the B2B mapping uses it),
/// `F_b'` B's frame turned 180° about its x axis when `flip`, and `O` the
/// offset. The clearance fallback measures B's body in `F_b'`.
pub fn mate_oriented(
    a: &MateEnd,
    b: &MateEnd,
    stack_height_mm: Option<f64>,
    orientation: &Orientation,
) -> Option<MateResult> {
    let frame_a = connector_frame(Some(&a.geometry), a.thickness_mm, a.stored.as_ref())?;
    let mut frame_b = connector_frame(Some(&b.geometry), b.thickness_mm, b.stored.as_ref())?;
    let unturned_a = unturned(a.stored.as_ref());
    let unturned_b = unturned(b.stored.as_ref());
    let k = pad_one_turns(
        &a.geometry,
        &connector_frame(Some(&a.geometry), a.thickness_mm, unturned_a.as_ref())?,
        &b.geometry,
        &connector_frame(Some(&b.geometry), b.thickness_mm, unturned_b.as_ref())?,
    ) + orientation.quarter_turns;
    if orientation.flip {
        frame_b = flipped(&frame_b);
    }
    let (h, height_source) = match stack_height_mm {
        Some(h) => (h, HeightSource::Link),
        None => {
            let corners_a = body_corners(&a.geometry, a.thickness_mm, a.body_mm.as_ref())?;
            let corners_b = body_corners(&b.geometry, b.thickness_mm, b.body_mm.as_ref())?;
            let h = clearance_height(&frame_a, &corners_a, &frame_b, &corners_b, k)?;
            (h, HeightSource::Clearance)
        }
    };
    let joint = Pose {
        translation_mm: [0.0, 0.0, h],
        rotation: canonical_rotation(FLIP_X),
    };
    let quarter = Pose {
        translation_mm: [0.0, 0.0, 0.0],
        rotation: QUARTER_TURNS[k.rem_euclid(4) as usize],
    };
    let mut joint = compose(&joint, &quarter);
    if let Some(offset) = orientation.offset.as_ref() {
        joint = compose(offset, &joint);
    }
    let pose = compose(
        &compose(&frame_pose(&frame_a), &joint),
        &inverse(&frame_pose(&frame_b)),
    );
    Some(MateResult {
        pose,
        quarter_turns: k.rem_euclid(4),
        stack_height_mm: clean(h),
        height_source,
    })
}

/// How far placed board B is from where pair (a, b)'s [`mate`] result puts it
/// (SYS-V11 input).
///
/// `offset_mm` is B's connector origin minus its mated position, on A's
/// connector axes (x, y across the mating plane; z along the mating axis,
/// positive = further apart); `lateral_mm` its x-y length; `angle_deg` the
/// rotation between the two. `None` when either connector frame is unknown.
/// Ports `mate.py:residual`.
pub fn residual(
    a_world: &Pose,
    b_world: &Pose,
    a: &MateEnd,
    b: &MateEnd,
    mated: &MateResult,
) -> Option<Residual> {
    let frame_a = connector_frame(Some(&a.geometry), a.thickness_mm, a.stored.as_ref())?;
    let frame_b = frame_pose(&connector_frame(
        Some(&b.geometry),
        b.thickness_mm,
        b.stored.as_ref(),
    )?);
    let expected = compose(&compose(a_world, &mated.pose), &frame_b);
    let actual = compose(b_world, &frame_b);
    let world_a = compose(a_world, &frame_pose(&frame_a));
    let delta = [
        actual.translation_mm[0] - expected.translation_mm[0],
        actual.translation_mm[1] - expected.translation_mm[1],
        actual.translation_mm[2] - expected.translation_mm[2],
    ];
    let offset = rotate(
        [
            -world_a.rotation[0],
            -world_a.rotation[1],
            -world_a.rotation[2],
            world_a.rotation[3],
        ],
        delta,
    );
    let turn = compose(
        &inverse(&Pose {
            translation_mm: [0.0, 0.0, 0.0],
            rotation: expected.rotation,
        }),
        &Pose {
            translation_mm: [0.0, 0.0, 0.0],
            rotation: actual.rotation,
        },
    )
    .rotation;
    let angle = 2.0
        * (turn[0] * turn[0] + turn[1] * turn[1] + turn[2] * turn[2])
            .sqrt()
            .atan2(turn[3].abs());
    Some(Residual {
        offset_mm: [clean(offset[0]), clean(offset[1]), clean(offset[2])],
        distance_mm: clean(
            (delta[0] * delta[0] + delta[1] * delta[1] + delta[2] * delta[2]).sqrt(),
        ),
        lateral_mm: clean(offset[0].hypot(offset[1])),
        angle_deg: clean(angle.to_degrees()),
    })
}
