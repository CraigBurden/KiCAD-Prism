//! Connector mating frames: inference (CONTRACTS_P2 §15.1) and `F_c` (§14.4).
//!
//! A faithful port of `backend/app/services/systems/placement/frames.py`. Inputs
//! are one component's extractor v6 `geometry` and the board thickness; every
//! rule has a TypeScript twin in
//! `frontend/src/features/system-builder/placement/frames.ts`. Change all three
//! and the shared goldens together.

use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

/// The body centre may sit this far outside the pad box and still count as over
/// the pads (a vertical connector).
pub const OVER_PADS_MARGIN_MM: f64 = 1.0;
/// The body centre must be at least this far from the pad centroid for a
/// right-angle connector.
pub const OFF_PADS_MIN_MM: f64 = 0.5;
/// A footprint axis within this many degrees of a direction names it.
pub const AXIS_TOLERANCE_DEG: f64 = 20.0;
/// Principal axes within 5 % of each other: use the footprint's own x.
pub const SQUARE_TOLERANCE: f64 = 0.05;

/// The mating axis (§15.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum MatingAxis {
    /// Out of the board's front face.
    #[serde(rename = "top")]
    Top,
    /// Out of the board's back face.
    #[serde(rename = "bottom")]
    Bottom,
    /// Toward the footprint's +x.
    #[serde(rename = "+x")]
    PlusX,
    /// Toward the footprint's -x.
    #[serde(rename = "-x")]
    MinusX,
    /// Toward the footprint's +y.
    #[serde(rename = "+y")]
    PlusY,
    /// Toward the footprint's -y.
    #[serde(rename = "-y")]
    MinusY,
}

/// Which board face a component is mounted on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    /// The front face.
    Top,
    /// The back face.
    Bottom,
}

impl Side {
    /// `geometry["side"] == "top"` in the Python twin.
    pub(crate) fn is_top(self) -> bool {
        matches!(self, Self::Top)
    }
}

/// How sure the inference is; `low` leaves the axis unknown.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Confidence {
    /// A keyword and the geometry agree.
    High,
    /// Geometry only.
    Medium,
    /// No usable axis.
    Low,
}

/// One pad of the extractor v6 `geometry`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PadGeometry {
    /// The pad number/name; empty for mounting and alignment holes.
    pub pad: String,
    /// The pad centre in the board frame.
    pub position_mm: [f64; 2],
    /// The pad size in mm.
    #[serde(default)]
    pub size_mm: Option<[f64; 2]>,
    /// The pad shape (`circle`, `rect`, …).
    #[serde(default)]
    pub shape: Option<String>,
    /// Whether the pad is through-hole.
    #[serde(default)]
    pub tht: Option<bool>,
}

/// The footprint's own courtyard in its own frame (y up, before rotation).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Courtyard {
    /// The minimum corner.
    pub min_mm: [f64; 2],
    /// The maximum corner.
    pub max_mm: [f64; 2],
}

/// The component's 3D model reference.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelGeometry {
    /// The model path as the footprint stores it.
    pub path: String,
    /// The model offset.
    pub offset_mm: [f64; 3],
    /// The model rotation in degrees.
    pub rotation_deg: [f64; 3],
    /// The model scale.
    pub scale: [f64; 3],
}

/// One component's extractor v6 `geometry` (§14.6).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectorGeometry {
    /// The mounting side.
    pub side: Side,
    /// The footprint's position in the board frame.
    pub position_mm: [f64; 2],
    /// The footprint's rotation in degrees.
    pub rotation_deg: f64,
    /// The footprint name, when the extractor has one.
    #[serde(default)]
    pub footprint_name: Option<String>,
    /// The pads, in the extractor's order.
    pub pads: Vec<PadGeometry>,
    /// The courtyard, when the footprint has one.
    #[serde(default)]
    pub courtyard: Option<Courtyard>,
    /// The 3D model, when the footprint names one.
    #[serde(default)]
    pub model: Option<ModelGeometry>,
}

/// A confirmed or user-overridden mating axis for one end.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredFrame {
    /// The axis the record fixes.
    pub axis: MatingAxis,
    /// Quarter-turns about the mating axis; absent or null means none.
    #[serde(default)]
    pub quarter_turns: Option<i32>,
}

/// §15.1: the inferred axis, its confidence and the rules that fired.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Inference {
    /// The axis, `None` when [`Confidence::Low`].
    pub axis: Option<MatingAxis>,
    /// How sure the inference is.
    pub confidence: Confidence,
    /// The rule names, in the order they fired.
    pub reasons: Vec<String>,
}

/// `F_c` in the board frame (§14.4).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectorFrame {
    /// The mating axis.
    pub axis: MatingAxis,
    /// The quarter-turns applied about the mating axis.
    pub quarter_turns: i32,
    /// The frame origin: the pad centroid on the mounting surface.
    pub origin_mm: [f64; 3],
    /// The frame's x axis (the pad row's principal axis, pad 1 toward -x).
    pub x_axis: [f64; 3],
    /// The frame's y axis.
    pub y_axis: [f64; 3],
    /// The frame's z axis (the mating axis).
    pub z_axis: [f64; 3],
    /// Unit quaternion `[x, y, z, w]`, canonical `w ≥ 0`.
    pub rotation: [f64; 4],
}

/// Compile one of the twins' regexes. The workspace's `regex` has no
/// `unicode-case` feature; these patterns only fold ASCII, so Unicode mode is
/// off and the match is the same for every footprint name the extractor emits.
fn compile_pattern(pattern: &str) -> Option<Regex> {
    RegexBuilder::new(pattern)
        .case_insensitive(true)
        .unicode(false)
        .build()
        .ok()
}

/// `frames.py:_VERTICAL`.
fn vertical_pattern() -> Option<&'static Regex> {
    static CELL: OnceLock<Option<Regex>> = OnceLock::new();
    CELL.get_or_init(|| compile_pattern(r"_vertical(_|$)"))
        .as_ref()
}

/// `frames.py:_RIGHT_ANGLE`.
fn right_angle_pattern() -> Option<&'static Regex> {
    static CELL: OnceLock<Option<Regex>> = OnceLock::new();
    CELL.get_or_init(|| {
        compile_pattern(r"_(horizontal|rightangle|right_angle|angled)(_|$)|_RA(_|$)")
    })
    .as_ref()
}

/// Python's `round` (half to even) so both halves pick the same axis on exact
/// halves.
fn round_half_even(value: f64) -> f64 {
    let floor = value.floor();
    let diff = value - floor;
    if diff > 0.5 {
        floor + 1.0
    } else if diff < 0.5 || floor % 2.0 == 0.0 {
        floor
    } else {
        floor + 1.0
    }
}

/// `frames.py:_natural`: pad order is letters, then the trailing number, then
/// the pad string (`J2` before `J10`).
fn natural_key(pad: &str) -> (String, i64, String) {
    let head = pad.trim_end_matches(|c: char| c.is_ascii_digit());
    let tail = &pad[head.len()..];
    let number = tail.parse::<i64>().unwrap_or(-1);
    (head.to_owned(), number, pad.to_owned())
}

/// Board frame → the footprint's own frame (y up, before rotation).
///
/// Ports `frames.py:_footprint_point`.
pub fn footprint_point(geometry: &ConnectorGeometry, point: [f64; 2]) -> [f64; 2] {
    let a = geometry.rotation_deg.to_radians();
    let dx = point[0] - geometry.position_mm[0];
    let dy = point[1] - geometry.position_mm[1];
    [dx * a.cos() + dy * a.sin(), -dx * a.sin() + dy * a.cos()]
}

/// A footprint-frame direction in the board frame.
fn board_direction(geometry: &ConnectorGeometry, local: [f64; 2]) -> [f64; 3] {
    let a = geometry.rotation_deg.to_radians();
    [
        local[0] * a.cos() - local[1] * a.sin(),
        local[0] * a.sin() + local[1] * a.cos(),
        0.0,
    ]
}

/// How many distinct pad positions the geometry has.
fn distinct_pad_positions(geometry: &ConnectorGeometry) -> usize {
    let mut seen: Vec<[f64; 2]> = Vec::new();
    for pad in &geometry.pads {
        if !seen
            .iter()
            .any(|p| p[0] == pad.position_mm[0] && p[1] == pad.position_mm[1])
        {
            seen.push(pad.position_mm);
        }
    }
    seen.len()
}

/// The pads `F_c` is built from: the numbered ones, or every pad when none is
/// numbered (`frames.py:_frame_pads`).
fn frame_pads(geometry: &ConnectorGeometry) -> Vec<&PadGeometry> {
    let named: Vec<&PadGeometry> = geometry.pads.iter().filter(|p| !p.pad.is_empty()).collect();
    if named.is_empty() {
        geometry.pads.iter().collect()
    } else {
        named
    }
}

/// The centroid of [`frame_pads`] (`frames.py:_pad_centroid`).
fn pad_centroid(geometry: &ConnectorGeometry) -> Option<[f64; 2]> {
    let pads = frame_pads(geometry);
    if pads.is_empty() {
        return None;
    }
    let count = pads.len() as f64;
    let x = pads.iter().map(|p| p.position_mm[0]).sum::<f64>() / count;
    let y = pads.iter().map(|p| p.position_mm[1]).sum::<f64>() / count;
    Some([x, y])
}

/// The footprint axis within [`AXIS_TOLERANCE_DEG`] of direction `(x, y)`, if
/// any (`frames.py:_local_axis`).
fn local_axis(x: f64, y: f64) -> Option<MatingAxis> {
    let angle = y.atan2(x).to_degrees();
    let nearest = round_half_even(angle / 90.0) * 90.0;
    if (angle - nearest).abs() > AXIS_TOLERANCE_DEG {
        return None;
    }
    match nearest as i64 {
        0 => Some(MatingAxis::PlusX),
        90 => Some(MatingAxis::PlusY),
        180 | -180 => Some(MatingAxis::MinusX),
        -90 => Some(MatingAxis::MinusY),
        _ => None,
    }
}

/// Build an inference, dropping the axis when the confidence is `low`
/// (`frames.py:infer.result`).
fn inference(axis: Option<MatingAxis>, confidence: Confidence, reasons: &[&str]) -> Inference {
    Inference {
        axis: if confidence == Confidence::Low {
            None
        } else {
            axis
        },
        confidence,
        reasons: reasons.iter().map(|reason| (*reason).to_owned()).collect(),
    }
}

/// §15.1: `{axis, confidence, reasons}`; `axis` is `None` when confidence is
/// `low`. Ports `frames.py:infer`.
pub fn infer(geometry: Option<&ConnectorGeometry>) -> Inference {
    let Some(geometry) = geometry else {
        return inference(None, Confidence::Low, &["too_few_pads"]);
    };
    if distinct_pad_positions(geometry) < 2 {
        return inference(None, Confidence::Low, &["too_few_pads"]);
    }
    let vertical_side = if geometry.side.is_top() {
        MatingAxis::Top
    } else {
        MatingAxis::Bottom
    };
    let name = geometry.footprint_name.as_deref().unwrap_or("");
    let named_vertical = vertical_pattern().is_some_and(|re| re.is_match(name));
    let named_right_angle = right_angle_pattern().is_some_and(|re| re.is_match(name));
    let Some(courtyard) = geometry.courtyard.as_ref() else {
        return if named_vertical {
            inference(
                Some(vertical_side),
                Confidence::Medium,
                &["name_vertical", "no_courtyard"],
            )
        } else {
            inference(None, Confidence::Low, &["no_courtyard"])
        };
    };

    let (over, side_axis) = body_relation(geometry, courtyard);
    if named_vertical {
        return if over {
            inference(
                Some(vertical_side),
                Confidence::High,
                &["name_vertical", "body_over_pads"],
            )
        } else {
            inference(
                None,
                Confidence::Low,
                &["name_vertical", "name_conflicts_geometry"],
            )
        };
    }
    if named_right_angle {
        return match side_axis {
            Some(axis) => inference(
                Some(axis),
                Confidence::High,
                &["name_right_angle", "body_off_pads"],
            ),
            None => inference(
                None,
                Confidence::Low,
                &["name_right_angle", "name_conflicts_geometry"],
            ),
        };
    }
    if over {
        return inference(Some(vertical_side), Confidence::Medium, &["body_over_pads"]);
    }
    if let Some(axis) = side_axis {
        return inference(Some(axis), Confidence::Medium, &["body_off_pads"]);
    }
    inference(None, Confidence::Low, &["body_ambiguous"])
}

/// Whether the courtyard's centre is over the pads, and when it is not, the
/// footprint axis it points along (`frames.py:infer`'s `over`/`side_axis`).
fn body_relation(
    geometry: &ConnectorGeometry,
    courtyard: &Courtyard,
) -> (bool, Option<MatingAxis>) {
    let local: Vec<[f64; 2]> = geometry
        .pads
        .iter()
        .map(|pad| footprint_point(geometry, pad.position_mm))
        .collect();
    let count = local.len() as f64;
    let centroid = (
        local.iter().map(|p| p[0]).sum::<f64>() / count,
        local.iter().map(|p| p[1]).sum::<f64>() / count,
    );
    let body = (
        (courtyard.min_mm[0] + courtyard.max_mm[0]) / 2.0,
        (courtyard.min_mm[1] + courtyard.max_mm[1]) / 2.0,
    );
    let min_x = local.iter().map(|p| p[0]).fold(f64::INFINITY, f64::min);
    let max_x = local.iter().map(|p| p[0]).fold(f64::NEG_INFINITY, f64::max);
    let min_y = local.iter().map(|p| p[1]).fold(f64::INFINITY, f64::min);
    let max_y = local.iter().map(|p| p[1]).fold(f64::NEG_INFINITY, f64::max);
    let over = min_x - OVER_PADS_MARGIN_MM <= body.0
        && body.0 <= max_x + OVER_PADS_MARGIN_MM
        && min_y - OVER_PADS_MARGIN_MM <= body.1
        && body.1 <= max_y + OVER_PADS_MARGIN_MM;
    let offset = (body.0 - centroid.0, body.1 - centroid.1);
    let side_axis = if !over && offset.0.hypot(offset.1) >= OFF_PADS_MIN_MM {
        local_axis(offset.0, offset.1)
    } else {
        None
    };
    (over, side_axis)
}

/// `frames.py:_normalize`.
fn normalize(v: [f64; 3]) -> [f64; 3] {
    let length = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    [v[0] / length, v[1] / length, v[2] / length]
}

/// `frames.py:_cross`.
fn cross(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

/// `frames.py:_dot`.
fn dot(a: [f64; 3], b: [f64; 3]) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/// The pad `F_c` orients pad 1 from: the pad named `1`, else the first in
/// natural order, else the first pad. Ports `frames.py:_pad_one`.
pub fn pad_one(geometry: &ConnectorGeometry) -> Option<&PadGeometry> {
    let named: Vec<&PadGeometry> = geometry
        .pads
        .iter()
        .filter(|pad| !pad.pad.is_empty())
        .collect();
    if let Some(one) = named.iter().find(|pad| pad.pad == "1") {
        return Some(one);
    }
    named
        .into_iter()
        .min_by_key(|pad| natural_key(&pad.pad))
        .or_else(|| geometry.pads.first())
}

/// The largest eigenvector of the pad-centre covariance, or the footprint's +x
/// for square arrays (`frames.py:_principal_axis`).
fn principal_axis(geometry: &ConnectorGeometry) -> Option<[f64; 3]> {
    let [cx, cy] = pad_centroid(geometry)?;
    let pads = frame_pads(geometry);
    let count = pads.len() as f64;
    let sxx = pads
        .iter()
        .map(|p| (p.position_mm[0] - cx) * (p.position_mm[0] - cx))
        .sum::<f64>()
        / count;
    let syy = pads
        .iter()
        .map(|p| (p.position_mm[1] - cy) * (p.position_mm[1] - cy))
        .sum::<f64>()
        / count;
    let sxy = pads
        .iter()
        .map(|p| (p.position_mm[0] - cx) * (p.position_mm[1] - cy))
        .sum::<f64>()
        / count;
    let half_trace = (sxx + syy) / 2.0;
    let det = sxx * syy - sxy * sxy;
    let spread = (half_trace * half_trace - det).max(0.0).sqrt();
    let large = half_trace + spread;
    let small = half_trace - spread;
    if large <= 1e-12 || large - small <= SQUARE_TOLERANCE * large {
        return Some(board_direction(geometry, [1.0, 0.0]));
    }
    if sxy.abs() > 1e-12 {
        return Some(normalize([large - syy, sxy, 0.0]));
    }
    Some(if sxx >= syy {
        [1.0, 0.0, 0.0]
    } else {
        [0.0, 1.0, 0.0]
    })
}

/// The mating direction of an axis in the board frame (`frames.py:_mating_axis`).
fn mating_axis(geometry: &ConnectorGeometry, axis: MatingAxis) -> [f64; 3] {
    match axis {
        MatingAxis::Top => [0.0, 0.0, 1.0],
        MatingAxis::Bottom => [0.0, 0.0, -1.0],
        MatingAxis::PlusX => normalize(board_direction(geometry, [1.0, 0.0])),
        MatingAxis::MinusX => normalize(board_direction(geometry, [-1.0, 0.0])),
        MatingAxis::PlusY => normalize(board_direction(geometry, [0.0, 1.0])),
        MatingAxis::MinusY => normalize(board_direction(geometry, [0.0, -1.0])),
    }
}

/// Rotation matrix with these columns → unit quaternion `[x, y, z, w]`,
/// canonical `w ≥ 0`. Ports `frames.py:quaternion`.
pub fn quaternion(x_axis: [f64; 3], y_axis: [f64; 3], z_axis: [f64; 3]) -> [f64; 4] {
    let [m00, m10, m20] = x_axis;
    let [m01, m11, m21] = y_axis;
    let [m02, m12, m22] = z_axis;
    let trace = m00 + m11 + m22;
    let q = if trace > 0.0 {
        let s = (trace + 1.0).sqrt() * 2.0;
        [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]
    } else if m00 > m11 && m00 > m22 {
        let s = (1.0 + m00 - m11 - m22).sqrt() * 2.0;
        [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
    } else if m11 > m22 {
        let s = (1.0 + m11 - m00 - m22).sqrt() * 2.0;
        [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]
    } else {
        let s = (1.0 + m22 - m00 - m11).sqrt() * 2.0;
        [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
    };
    let q = normalize4(q);
    let leading = [q[3], q[0], q[1], q[2]]
        .into_iter()
        .find(|c| c.abs() > 1e-12)
        .unwrap_or(1.0);
    if leading < 0.0 {
        [-q[0], -q[1], -q[2], -q[3]]
    } else {
        q
    }
}

/// `frames.py:_normalize` for a quaternion.
fn normalize4(q: [f64; 4]) -> [f64; 4] {
    let length = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt();
    [q[0] / length, q[1] / length, q[2] / length, q[3] / length]
}

/// `F_c` in the board frame, or `None` when no axis is known (a `low`
/// inference and nothing stored). Ports `frames.py:connector_frame`.
///
/// `stored` is a confirmed/override record `{axis, quarterTurns}`; it replaces
/// the inferred axis.
pub fn connector_frame(
    geometry: Option<&ConnectorGeometry>,
    thickness_mm: Option<f64>,
    stored: Option<&StoredFrame>,
) -> Option<ConnectorFrame> {
    let geometry = geometry?;
    if geometry.pads.is_empty() {
        return None;
    }
    let axis = match stored {
        Some(stored) => stored.axis,
        None => infer(Some(geometry)).axis?,
    };
    let turns = stored.map_or(0, |stored| stored.quarter_turns.unwrap_or(0).rem_euclid(4));
    let [cx, cy] = pad_centroid(geometry)?;
    let half = thickness_mm.unwrap_or(0.0) / 2.0;
    let origin = [cx, cy, if geometry.side.is_top() { half } else { -half }];
    let z = mating_axis(geometry, axis);
    let principal = principal_axis(geometry)?;
    let along = dot(principal, z);
    let mut x = [
        principal[0] - along * z[0],
        principal[1] - along * z[1],
        principal[2] - along * z[2],
    ];
    if dot(x, x).sqrt() < 1e-9 {
        // Pads run along the mating direction.
        x = [-z[1], z[0], 0.0];
    }
    x = normalize(x);
    let [pad_x, pad_y] = pad_one(geometry)?.position_mm;
    if dot([pad_x - cx, pad_y - cy, 0.0], x) > 1e-9 {
        x = [-x[0], -x[1], -x[2]];
    }
    let mut y = cross(z, x);
    for _ in 0..turns {
        // Quarter-turns about z: x → y.
        let next_x = y;
        let next_y = [-x[0], -x[1], -x[2]];
        x = next_x;
        y = next_y;
    }
    Some(ConnectorFrame {
        axis,
        quarter_turns: turns,
        origin_mm: origin,
        x_axis: x,
        y_axis: y,
        z_axis: z,
        rotation: quaternion(x, y, z),
    })
}
