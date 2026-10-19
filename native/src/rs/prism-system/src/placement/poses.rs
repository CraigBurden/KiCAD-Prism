//! Poses and the default layout (CONTRACTS_P2 §14.1, §14.3).
//!
//! A pose is `{"translationMm": [x, y, z], "rotation": [x, y, z, w]}` and maps
//! an instance's own frame into its parent's as `T·R`. Matrices are 4×4,
//! column-major (WebGPU's layout), in mm.
//!
//! A faithful port of `backend/app/services/systems/placement/poses.py`; the
//! TypeScript twin is
//! `frontend/src/features/system-builder/placement/poses.ts`.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::error::Error;
use std::fmt;

/// The gap between bounding boxes in the default row.
pub const DEFAULT_GAP_MM: f64 = 20.0;

/// The identity pose.
pub const IDENTITY: Pose = Pose {
    translation_mm: [0.0, 0.0, 0.0],
    rotation: [0.0, 0.0, 0.0, 1.0],
};

/// A kilometre: anything further is a typo, not a placement.
pub const MAX_TRANSLATION_MM: f64 = 1_000_000.0;

/// The scale [`clean`] rounds at.
const CLEAN_SCALE: f64 = 1e9;

/// One pose: an instance's frame in its parent's, as `T·R`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pose {
    /// The translation in mm.
    pub translation_mm: [f64; 3],
    /// Unit quaternion `[x, y, z, w]`, canonical `w ≥ 0`.
    pub rotation: [f64; 4],
}

/// Where a placed pose came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PoseSource {
    /// Solved from driving mates.
    Auto,
    /// Kept from a manual move.
    Manual,
    /// The default row.
    Default,
}

/// A pose in its system's frame, with its source.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacedPose {
    /// The pose itself.
    #[serde(flatten)]
    pub pose: Pose,
    /// Where the pose came from.
    pub source: PoseSource,
}

/// An axis-aligned box: `{"minMm": [x, y, z], "maxMm": [x, y, z]}`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bounds {
    /// The minimum corner.
    pub min_mm: [f64; 3],
    /// The maximum corner.
    pub max_mm: [f64; 3],
}

/// Why [`pose_from`] refused its input (`poses.py:pose_from`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PoseError {
    /// The vectors were not 3 + 4 numbers.
    WrongShape,
    /// A value was NaN or infinite.
    NotFinite,
    /// A translation exceeded [`MAX_TRANSLATION_MM`].
    TranslationTooLarge,
    /// The rotation was the zero quaternion.
    ZeroRotation,
}

impl fmt::Display for PoseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::WrongShape => {
                f.write_str("translationMm takes 3 numbers and rotation 4 (x, y, z, w)")
            }
            Self::NotFinite => f.write_str("pose values must be finite"),
            Self::TranslationTooLarge => {
                write!(f, "translation is limited to ±{MAX_TRANSLATION_MM} mm")
            }
            Self::ZeroRotation => f.write_str("rotation must be a non-zero quaternion"),
        }
    }
}

impl Error for PoseError {}

/// Round away float noise (1e-9) and fold -0.0, so equal poses serialise
/// equally. Ports `poses.py:_clean`.
pub fn clean(value: f64) -> f64 {
    (value * CLEAN_SCALE).round() / CLEAN_SCALE + 0.0
}

/// §14.1: normalised, `w ≥ 0` (the first non-zero of w, x, y, z positive).
/// Ports `poses.py:canonical_rotation`.
pub fn canonical_rotation(q: [f64; 4]) -> [f64; 4] {
    let size = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt();
    let size = if size == 0.0 { 1.0 } else { size };
    let unit = [q[0] / size, q[1] / size, q[2] / size, q[3] / size];
    let leading = [unit[3], unit[0], unit[1], unit[2]]
        .into_iter()
        .find(|c| c.abs() > 1e-12)
        .unwrap_or(1.0);
    unit.map(|c| clean(if leading < 0.0 { -c } else { c }))
}

/// Rotate `v` by quaternion `q`. Ports `poses.py:rotate`.
pub fn rotate(q: [f64; 4], v: [f64; 3]) -> [f64; 3] {
    let [x, y, z, w] = q;
    // v' = v + 2w(u × v) + 2u × (u × v), u = (x, y, z)
    let cx = y * v[2] - z * v[1];
    let cy = z * v[0] - x * v[2];
    let cz = x * v[1] - y * v[0];
    [
        v[0] + 2.0 * (w * cx + y * cz - z * cy),
        v[1] + 2.0 * (w * cy + z * cx - x * cz),
        v[2] + 2.0 * (w * cz + x * cy - y * cx),
    ]
}

/// Quaternion `a · b` (`poses.py:_multiply`).
fn multiply(a: [f64; 4], b: [f64; 4]) -> [f64; 4] {
    let [ax, ay, az, aw] = a;
    let [bx, by, bz, bw] = b;
    [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ]
}

/// `parent · child`: the child's frame expressed in the parent's parent.
/// Ports `poses.py:compose`.
pub fn compose(parent: &Pose, child: &Pose) -> Pose {
    let moved = rotate(parent.rotation, child.translation_mm);
    Pose {
        translation_mm: [
            clean(parent.translation_mm[0] + moved[0]),
            clean(parent.translation_mm[1] + moved[1]),
            clean(parent.translation_mm[2] + moved[2]),
        ],
        rotation: canonical_rotation(multiply(parent.rotation, child.rotation)),
    }
}

/// Column-major 4×4 of `T·R`. Ports `poses.py:matrix`.
pub fn matrix(pose: &Pose) -> [f64; 16] {
    let [x, y, z, w] = pose.rotation;
    let [tx, ty, tz] = pose.translation_mm;
    [
        1.0 - 2.0 * (y * y + z * z),
        2.0 * (x * y + z * w),
        2.0 * (x * z - y * w),
        0.0,
        2.0 * (x * y - z * w),
        1.0 - 2.0 * (x * x + z * z),
        2.0 * (y * z + x * w),
        0.0,
        2.0 * (x * z + y * w),
        2.0 * (y * z - x * w),
        1.0 - 2.0 * (x * x + y * y),
        0.0,
        tx,
        ty,
        tz,
        1.0,
    ]
    .map(clean)
}

/// The axis-aligned box around `bounds`' eight corners after `pose`. Ports
/// `poses.py:transform_bounds`.
pub fn transform_bounds(pose: &Pose, bounds: Option<&Bounds>) -> Option<Bounds> {
    let bounds = bounds?;
    let mut corners = [[0.0_f64; 3]; 8];
    for (i, corner) in corners.iter_mut().enumerate() {
        let point = [0usize, 1, 2].map(|k| {
            if (i >> k) & 1 == 1 {
                bounds.max_mm[k]
            } else {
                bounds.min_mm[k]
            }
        });
        *corner = rotate(pose.rotation, point);
    }
    let t = pose.translation_mm;
    let mut min_mm = [0.0_f64; 3];
    let mut max_mm = [0.0_f64; 3];
    for k in 0..3 {
        let mut low = f64::INFINITY;
        let mut high = f64::NEG_INFINITY;
        for corner in &corners {
            low = low.min(corner[k]);
            high = high.max(corner[k]);
        }
        min_mm[k] = clean(low + t[k]);
        max_mm[k] = clean(high + t[k]);
    }
    Some(Bounds { min_mm, max_mm })
}

/// The union of the known boxes. Ports `poses.py:union`.
pub fn union(boxes: &[Option<Bounds>]) -> Option<Bounds> {
    let mut present = boxes.iter().flatten();
    let first = present.next()?;
    let mut min_mm = first.min_mm;
    let mut max_mm = first.max_mm;
    for bounds in present {
        for k in 0..3 {
            min_mm[k] = min_mm[k].min(bounds.min_mm[k]);
            max_mm[k] = max_mm[k].max(bounds.max_mm[k]);
        }
    }
    Some(Bounds { min_mm, max_mm })
}

/// §14.3 default poses: along +x in the given order, `gap_mm` between bounding
/// boxes.
///
/// Each box's minimum x sits `gap_mm` after the previous box's maximum (the
/// first at x = 0) and its minimum y on y = 0. An item without bounds takes an
/// empty slot at the cursor. Rotation is the identity. Ports
/// `poses.py:default_row`.
pub fn default_row(items: &[(String, Option<Bounds>)], gap_mm: f64) -> BTreeMap<String, Pose> {
    let mut poses = BTreeMap::new();
    let mut cursor = 0.0;
    for (key, bounds) in items {
        let (translation, width) = match bounds {
            None => ([cursor, 0.0, 0.0], 0.0),
            Some(bounds) => (
                [cursor - bounds.min_mm[0], -bounds.min_mm[1], 0.0],
                bounds.max_mm[0] - bounds.min_mm[0],
            ),
        };
        poses.insert(
            key.clone(),
            Pose {
                translation_mm: translation.map(clean),
                rotation: [0.0, 0.0, 0.0, 1.0],
            },
        );
        cursor += width + gap_mm;
    }
    poses
}

/// A pose from API or manifest input, canonical (§14.1); an error when it is
/// not one. Ports `poses.py:pose_from`.
pub fn pose_from(translation_mm: &[f64], rotation: &[f64]) -> Result<Pose, PoseError> {
    if translation_mm.len() != 3 || rotation.len() != 4 {
        return Err(PoseError::WrongShape);
    }
    let values = [
        translation_mm[0],
        translation_mm[1],
        translation_mm[2],
        rotation[0],
        rotation[1],
        rotation[2],
        rotation[3],
    ];
    if values.iter().any(|value| !value.is_finite()) {
        return Err(PoseError::NotFinite);
    }
    if values[..3]
        .iter()
        .any(|value| value.abs() > MAX_TRANSLATION_MM)
    {
        return Err(PoseError::TranslationTooLarge);
    }
    if (rotation[0] * rotation[0]
        + rotation[1] * rotation[1]
        + rotation[2] * rotation[2]
        + rotation[3] * rotation[3])
        .sqrt()
        < 1e-6
    {
        return Err(PoseError::ZeroRotation);
    }
    Ok(Pose {
        translation_mm: [clean(values[0]), clean(values[1]), clean(values[2])],
        rotation: canonical_rotation([values[3], values[4], values[5], values[6]]),
    })
}

/// Every member's pose in its system's frame, with its `source`.
///
/// `items` are the members in §14.3 order (label, then instance ID) with their
/// own-frame bounds; `stored` the poses kept for some of them. A stored pose
/// wins; the rest take their slot in the default row, which is laid out over
/// every member so moving one board never shifts the others. Ports
/// `poses.py:place`.
pub fn place(
    items: &[(String, Option<Bounds>)],
    stored: &BTreeMap<String, PlacedPose>,
    gap_mm: f64,
) -> BTreeMap<String, PlacedPose> {
    let defaults = default_row(items, gap_mm);
    let mut out = BTreeMap::new();
    for (key, _bounds) in items {
        let placed = match stored.get(key) {
            None => match defaults.get(key) {
                None => continue,
                Some(pose) => PlacedPose {
                    pose: *pose,
                    source: PoseSource::Default,
                },
            },
            Some(pose) => PlacedPose {
                pose: Pose {
                    translation_mm: pose.pose.translation_mm.map(clean),
                    rotation: canonical_rotation(pose.pose.rotation),
                },
                source: pose.source,
            },
        };
        out.insert(key.clone(), placed);
    }
    out
}
