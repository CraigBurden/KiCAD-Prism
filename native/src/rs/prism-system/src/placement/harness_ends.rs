//! Harness end poses and exit legs (CONTRACTS_P2 §17.6; PLAN §7 items 1–2).
//!
//! An end's mating housing meets its board connector face to face, like a B2B
//! mate whose stack is the board connector's body height `h`: the housing's
//! mating frame sits at `F_c · T(0, 0, h) · Rx(180°) · Rz(k·90°)`. The cable
//! leaves the housing's rear face and runs straight for the boot length along
//! the connector's outward axis to the **leg point**, where the curve starts
//! tangent to that axis.
//!
//! A faithful port of `backend/app/services/systems/placement/harness_ends.py`;
//! the TypeScript twin is
//! `frontend/src/features/system-builder/placement/harness-ends.ts`.

use crate::placement::frames::{ConnectorGeometry, StoredFrame, connector_frame};
use crate::placement::harness_spec::{BOOT_MM, HOUSING_DEPTH_MM};
use crate::placement::mate::{body_corners, box_in};
use crate::placement::poses::{Bounds, IDENTITY, Pose, canonical_rotation, clean, compose, rotate};
use serde::{Deserialize, Serialize};

const S: f64 = std::f64::consts::FRAC_1_SQRT_2;

/// Quarter-turns about the mating axis, as quaternions (`harness_ends.py:_QUARTER_TURNS`).
const QUARTER_TURNS: [[f64; 4]; 4] = [
    [0.0, 0.0, 0.0, 1.0],
    [0.0, 0.0, S, S],
    [0.0, 0.0, 1.0, 0.0],
    [0.0, 0.0, S, -S],
];

/// `Rx(180°)` (`harness_ends.py:_FLIP_X`).
const FLIP_X: [f64; 4] = [1.0, 0.0, 0.0, 0.0];

/// A catalog model alignment (§18.2).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alignment {
    /// The translation in the housing's mating frame.
    #[serde(default)]
    pub offset_mm: Option<[f64; 3]>,
    /// The `Rx`, `Ry`, `Rz` degrees, applied z then y then x.
    #[serde(default)]
    pub rotation_deg: Option<[f64; 3]>,
    /// The model scale.
    #[serde(default)]
    pub scale: Option<f64>,
}

/// An end's part model: its bounds in the STEP frame and its alignment into
/// the mating frame.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Housing {
    /// The model bounds, when the catalog has them.
    #[serde(default)]
    pub bounds_mm: Option<Bounds>,
    /// The alignment into the mating frame.
    #[serde(default)]
    pub alignment: Option<Alignment>,
}

/// One end's pose and cable exit (SB2-41).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EndPose {
    /// The housing's mating frame in the world.
    pub pose: Pose,
    /// The cable exit in the world.
    pub exit_mm: [f64; 3],
    /// The unit outward axis (away from the board).
    pub outward: [f64; 3],
    /// The leg point, one boot past the exit.
    pub leg_mm: [f64; 3],
    /// The housing depth used.
    pub depth_mm: f64,
    /// Whether a part model set the exit.
    pub modeled: bool,
    /// The connector body's height (`board_end` only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mating_plane_mm: Option<f64>,
}

/// A positive rotation of `degrees` about `axis` (`harness_ends.py:_axis_quaternion`).
fn axis_quaternion(axis: [f64; 3], degrees: f64) -> [f64; 4] {
    let half = degrees.to_radians() / 2.0;
    [
        axis[0] * half.sin(),
        axis[1] * half.sin(),
        axis[2] * half.sin(),
        half.cos(),
    ]
}

/// A catalog model alignment (§18.2) as a pose and a scale: `T(offset)·Rz·Ry·Rx`
/// and `S`. Ports `harness_ends.py:alignment_pose`.
pub fn alignment_pose(alignment: Option<&Alignment>) -> (Pose, f64) {
    let Some(alignment) = alignment else {
        return (IDENTITY, 1.0);
    };
    let rotation_deg = alignment.rotation_deg.unwrap_or([0.0, 0.0, 0.0]);
    let mut rotation = [0.0, 0.0, 0.0, 1.0];
    for (axis, degrees) in [
        ([0.0, 0.0, 1.0], rotation_deg[2]),
        ([0.0, 1.0, 0.0], rotation_deg[1]),
        ([1.0, 0.0, 0.0], rotation_deg[0]),
    ] {
        rotation = compose(
            &Pose {
                translation_mm: [0.0, 0.0, 0.0],
                rotation,
            },
            &Pose {
                translation_mm: [0.0, 0.0, 0.0],
                rotation: axis_quaternion(axis, degrees),
            },
        )
        .rotation;
    }
    let offset = alignment.offset_mm.unwrap_or([0.0, 0.0, 0.0]);
    let scale = match alignment.scale {
        Some(scale) if scale != 0.0 => scale,
        _ => 1.0,
    };
    (
        Pose {
            translation_mm: offset,
            rotation: canonical_rotation(rotation),
        },
        scale,
    )
}

/// The cable exit in the housing's mating frame, the housing depth, and
/// whether a model gave it. Ports `harness_ends.py:_rear_face`.
fn rear_face(housing: Option<&Housing>) -> ([f64; 3], f64, bool) {
    let Some(bounds) = housing.and_then(|housing| housing.bounds_mm.as_ref()) else {
        return ([0.0, 0.0, -HOUSING_DEPTH_MM], HOUSING_DEPTH_MM, false);
    };
    let (pose, scale) = alignment_pose(housing.and_then(|housing| housing.alignment.as_ref()));
    let lo = bounds.min_mm;
    let hi = bounds.max_mm;
    let mut corners = [[0.0_f64; 3]; 8];
    for (i, corner) in corners.iter_mut().enumerate() {
        let point = [0usize, 1, 2].map(|k| if (i >> k) & 1 == 1 { hi[k] } else { lo[k] } * scale);
        let moved = rotate(pose.rotation, point);
        *corner = [0usize, 1, 2].map(|k| moved[k] + pose.translation_mm[k]);
    }
    let mut low = [0.0_f64; 3];
    let mut high = [0.0_f64; 3];
    for k in 0..3 {
        low[k] = corners
            .iter()
            .map(|corner| corner[k])
            .fold(f64::INFINITY, f64::min);
        high[k] = corners
            .iter()
            .map(|corner| corner[k])
            .fold(f64::NEG_INFINITY, f64::max);
    }
    // A model aligned inside out never puts the exit in front of the mating face.
    let back = if 0.0 < low[2] { 0.0 } else { low[2] };
    (
        [(low[0] + high[0]) / 2.0, (low[1] + high[1]) / 2.0, back],
        -back,
        true,
    )
}

/// An end from its connector's frame in the world (`F_c` composed with the
/// board's pose). Ports `harness_ends.py:end_pose`.
pub fn end_pose(connector_world: &Pose, quarter_turns: i32, housing: Option<&Housing>) -> EndPose {
    let turn = QUARTER_TURNS[quarter_turns.rem_euclid(4) as usize];
    let flip = compose(
        &Pose {
            translation_mm: [0.0, 0.0, 0.0],
            rotation: FLIP_X,
        },
        &Pose {
            translation_mm: [0.0, 0.0, 0.0],
            rotation: turn,
        },
    );
    let pose = compose(connector_world, &flip);
    let (exit_local, depth, modeled) = rear_face(housing);
    let exit_world = compose(
        &pose,
        &Pose {
            translation_mm: exit_local,
            rotation: [0.0, 0.0, 0.0, 1.0],
        },
    )
    .translation_mm;
    let outward = rotate(pose.rotation, [0.0, 0.0, -1.0]);
    let leg = [0usize, 1, 2].map(|k| exit_world[k] + BOOT_MM * outward[k]);
    EndPose {
        pose,
        exit_mm: exit_world.map(clean),
        outward: outward.map(clean),
        leg_mm: leg.map(clean),
        depth_mm: clean(depth),
        modeled,
        mating_plane_mm: None,
    }
}

/// [`end_pose`] for a harness end mated to a board connector, or `None`
/// without a frame (details needed). Ports `harness_ends.py:board_end`.
///
/// The housing meets the top of the connector's body along its mating axis:
/// `body_mm` (§14.8, the connector's model bounds) or the courtyard × 5 mm.
/// `matingPlaneMm` in the result is that height.
pub fn board_end(
    board_world: &Pose,
    geometry: Option<&ConnectorGeometry>,
    thickness_mm: Option<f64>,
    stored: Option<&StoredFrame>,
    quarter_turns: i32,
    housing: Option<&Housing>,
    body_mm: Option<&Bounds>,
) -> Option<EndPose> {
    let geometry = geometry?;
    let frame = connector_frame(Some(geometry), thickness_mm, stored)?;
    let corners = body_corners(geometry, thickness_mm, body_mm)?;
    let height = box_in(&frame, &corners)?.1[2].max(0.0);
    let connector = compose(
        board_world,
        &Pose {
            translation_mm: frame.origin_mm,
            rotation: frame.rotation,
        },
    );
    let connector = compose(
        &connector,
        &Pose {
            translation_mm: [0.0, 0.0, height],
            rotation: [0.0, 0.0, 0.0, 1.0],
        },
    );
    let mut pose = end_pose(&connector, quarter_turns, housing);
    pose.mating_plane_mm = Some(clean(height));
    Some(pose)
}
