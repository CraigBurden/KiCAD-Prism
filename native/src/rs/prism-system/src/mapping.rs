//! B2B pin mappings derived from geometry (`docs/system-builder/CONTRACTS.md` §8.4).
//!
//! Each connector's frame comes from the kept frame maths with its board's
//! thickness. B's named pads are carried into A's frame by the mate transform
//! with `k = (padOneTurns + quarterTurns) mod 4`; with `flip`, B's frame is
//! first turned 180° about its x axis. An A pad maps to the closest B pad
//! whose centre lies inside the A pad's landing window, each B pad once. The
//! window is the A pad's rectangle, turned with its footprint, each half-side
//! at least 0.1 mm: mating series often pair long pads at different row
//! spacings, so matching centres sit apart along the pads but not across.
//!
//! [`drawn`] gives both connectors' pads in A's frame, as the B2B tab draws
//! them (stage 3c): A's own pads, and B's carried by the same transform.

use crate::natural;
use crate::placement::frames::{
    Confidence, ConnectorFrame, ConnectorGeometry, connector_frame, infer,
};
use crate::placement::mate::{local, mated, pad_names, pad_one_turns};
use std::collections::{BTreeMap, BTreeSet};

/// The smallest half-side of a landing window, in mm.
pub const MIN_LANDING_MM: f64 = 0.1;

/// One connector as the mapping reads it.
pub struct Side<'a> {
    /// Its footprint geometry.
    pub geometry: &'a ConnectorGeometry,
    /// Its board's thickness in mm.
    pub thickness_mm: Option<f64>,
}

/// A derived mapping: pairs by A pad, and each side's pads without a partner.
#[derive(Debug, Default, PartialEq)]
pub struct Mapping {
    /// `(a, b)` pairs, in natural order of `a`.
    pub pairs: Vec<(String, String)>,
    /// Side A pads without a partner, in natural order.
    pub unmapped_a: Vec<String>,
    /// Side B pads without a partner, in natural order.
    pub unmapped_b: Vec<String>,
}

/// A landing window in A's frame: the pad's long axis `u` (a unit vector in
/// the frame's xy plane) and the half-sides along and across it.
struct Window {
    u: [f64; 2],
    along: f64,
    across: f64,
}

impl Window {
    fn holds(&self, delta: [f64; 2]) -> bool {
        let along = delta[0] * self.u[0] + delta[1] * self.u[1];
        let across = -delta[0] * self.u[1] + delta[1] * self.u[0];
        along.abs() <= self.along + 1e-9 && across.abs() <= self.across + 1e-9
    }
}

/// A pad's long axis in the frame's xy plane (unit), for a pad of `size`
/// turned with its footprint (`frames.rs` reads rotation the same way).
fn long_axis(geometry: &ConnectorGeometry, frame: &ConnectorFrame, size: [f64; 2]) -> [f64; 2] {
    let a = geometry.rotation_deg.to_radians();
    let local_x = [a.cos(), a.sin(), 0.0];
    let local_y = [-a.sin(), a.cos(), 0.0];
    let long = if size[0] >= size[1] { local_x } else { local_y };
    let dot = |v: [f64; 3], w: [f64; 3]| v[0] * w[0] + v[1] * w[1] + v[2] * w[2];
    let (ux, uy) = (dot(long, frame.x_axis), dot(long, frame.y_axis));
    let norm = ux.hypot(uy);
    if norm > 1e-9 {
        [ux / norm, uy / norm]
    } else {
        [1.0, 0.0]
    }
}

/// The window of A's pads called `name`, from the smallest of them.
fn landing_window(geometry: &ConnectorGeometry, frame: &ConnectorFrame, name: &str) -> Window {
    let half = |dimension: f64| (0.5 * dimension).max(MIN_LANDING_MM);
    let smallest = geometry
        .pads
        .iter()
        .filter(|pad| pad.pad == name)
        .filter_map(|pad| pad.size_mm)
        .min_by(|x, y| (x[0] * x[1]).total_cmp(&(y[0] * y[1])));
    let Some(size) = smallest else {
        return Window {
            u: [1.0, 0.0],
            along: MIN_LANDING_MM,
            across: MIN_LANDING_MM,
        };
    };
    Window {
        u: long_axis(geometry, frame, size),
        along: half(size[0].max(size[1])),
        across: half(size[0].min(size[1])),
    }
}

/// One pad drawn in A's connector frame: its centre, its long axis's angle
/// from +x (degrees), and its full long and short sides, in mm.
#[derive(Clone, Debug, PartialEq)]
pub struct DrawnPad {
    /// The pad number.
    pub pad: String,
    /// The centre in A's frame.
    pub centre_mm: [f64; 2],
    /// The long axis's angle from A's +x, in degrees.
    pub angle_deg: f64,
    /// The long side.
    pub long_mm: f64,
    /// The short side.
    pub short_mm: f64,
}

/// Both connectors' named pads in A's frame, in natural order of their pad.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Drawn {
    /// A's pads.
    pub a: Vec<DrawnPad>,
    /// B's pads, carried into A's frame by the mate transform.
    pub b: Vec<DrawnPad>,
}

/// Frames of both sides and the `k` of the mate transform, or `None` when the
/// geometry cannot decide (no pads, no frame, or a `low` confidence frame).
fn frames(
    a: &Side<'_>,
    b: &Side<'_>,
    quarter_turns: i32,
) -> Option<(ConnectorFrame, ConnectorFrame, i32)> {
    for side in [a, b] {
        if side.geometry.pads.is_empty() || infer(Some(side.geometry)).confidence == Confidence::Low
        {
            return None;
        }
    }
    let frame_a = connector_frame(Some(a.geometry), a.thickness_mm, None)?;
    let frame_b = connector_frame(Some(b.geometry), b.thickness_mm, None)?;
    let k =
        (pad_one_turns(a.geometry, &frame_a, b.geometry, &frame_b) + quarter_turns).rem_euclid(4);
    Some((frame_a, frame_b, k))
}

/// A vector in B's frame carried into A's: flipped over B's x axis first when
/// `flip`, then the mate transform's turn (linear at zero height).
fn carry(v: [f64; 2], k: i32, flip: bool) -> [f64; 2] {
    let y = if flip { -v[1] } else { v[1] };
    let moved = mated([v[0], y, 0.0], k, 0.0);
    [moved[0], moved[1]]
}

/// One side's named pads in its own frame, each then carried by `to_a`.
fn draw_side(
    geometry: &ConnectorGeometry,
    frame: &ConnectorFrame,
    to_a: impl Fn([f64; 2]) -> [f64; 2],
) -> Vec<DrawnPad> {
    let mut pads: Vec<DrawnPad> = geometry
        .pads
        .iter()
        .filter(|pad| !pad.pad.is_empty())
        .map(|pad| {
            let point = local(
                frame,
                [pad.position_mm[0], pad.position_mm[1], frame.origin_mm[2]],
            );
            let size = pad.size_mm.unwrap_or([0.0, 0.0]);
            let u = to_a(long_axis(geometry, frame, size));
            DrawnPad {
                pad: pad.pad.clone(),
                centre_mm: to_a([point[0], point[1]]),
                angle_deg: u[1].atan2(u[0]).to_degrees(),
                long_mm: size[0].max(size[1]),
                short_mm: size[0].min(size[1]),
            }
        })
        .collect();
    pads.sort_by(|x, y| natural::cmp(&x.pad, &y.pad));
    pads
}

/// Both connectors' pads as the mated pose puts them, seen in A's frame, or
/// `None` when the geometry cannot decide.
pub fn drawn(a: &Side<'_>, b: &Side<'_>, quarter_turns: i32, flip: bool) -> Option<Drawn> {
    let (frame_a, frame_b, k) = frames(a, b, quarter_turns)?;
    Some(Drawn {
        a: draw_side(a.geometry, &frame_a, |v| v),
        b: draw_side(b.geometry, &frame_b, |v| carry(v, k, flip)),
    })
}

/// The mapping geometry gives, or `None` when it cannot decide: no pads, no
/// frame, or a frame inferred with confidence `low` (§8.4, source `unresolved`).
pub fn derive(a: &Side<'_>, b: &Side<'_>, quarter_turns: i32, flip: bool) -> Option<Mapping> {
    let (frame_a, frame_b, k) = frames(a, b, quarter_turns)?;
    let pads_a = pad_names(a.geometry, &frame_a);
    let pads_b = pad_names(b.geometry, &frame_b);
    let placed: BTreeMap<&String, [f64; 2]> = pads_b
        .iter()
        .map(|(name, point)| (name, carry(*point, k, flip)))
        .collect();
    let mut names_a: Vec<String> = pads_a.keys().cloned().collect();
    natural::sort(&mut names_a);
    let mut taken: BTreeSet<&String> = BTreeSet::new();
    let mut mapping = Mapping::default();
    for name in &names_a {
        let here = pads_a[name];
        let window = landing_window(a.geometry, &frame_a, name);
        let best = placed
            .iter()
            .filter(|(other, _)| !taken.contains(*other))
            .filter(|(_, point)| window.holds([point[0] - here[0], point[1] - here[1]]))
            .map(|(other, point)| (*other, (point[0] - here[0]).hypot(point[1] - here[1])))
            .min_by(|x, y| x.1.total_cmp(&y.1).then_with(|| natural::cmp(x.0, y.0)));
        match best {
            Some((other, _)) => {
                taken.insert(other);
                mapping.pairs.push((name.clone(), other.clone()));
            }
            None => mapping.unmapped_a.push(name.clone()),
        }
    }
    mapping.unmapped_b = pads_b
        .keys()
        .filter(|name| !taken.contains(name))
        .cloned()
        .collect();
    natural::sort(&mut mapping.unmapped_b);
    Some(mapping)
}
