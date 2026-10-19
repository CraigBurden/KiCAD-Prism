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

use crate::natural;
use crate::placement::frames::{
    Confidence, ConnectorFrame, ConnectorGeometry, connector_frame, infer,
};
use crate::placement::mate::{mated, pad_names, pad_one_turns};
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

/// The window of A's pads called `name`, from the smallest of them; the pad
/// is taken to turn with its footprint (`frames.rs` reads rotation the same way).
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
    let a = geometry.rotation_deg.to_radians();
    let local_x = [a.cos(), a.sin(), 0.0];
    let local_y = [-a.sin(), a.cos(), 0.0];
    let long = if size[0] >= size[1] { local_x } else { local_y };
    let dot = |v: [f64; 3], w: [f64; 3]| v[0] * w[0] + v[1] * w[1] + v[2] * w[2];
    let (ux, uy) = (dot(long, frame.x_axis), dot(long, frame.y_axis));
    let norm = ux.hypot(uy);
    let u = if norm > 1e-9 {
        [ux / norm, uy / norm]
    } else {
        [1.0, 0.0]
    };
    Window {
        u,
        along: half(size[0].max(size[1])),
        across: half(size[0].min(size[1])),
    }
}

/// The mapping geometry gives, or `None` when it cannot decide: no pads, no
/// frame, or a frame inferred with confidence `low` (§8.4, source `unresolved`).
pub fn derive(a: &Side<'_>, b: &Side<'_>, quarter_turns: i32, flip: bool) -> Option<Mapping> {
    for side in [a, b] {
        if side.geometry.pads.is_empty() || infer(Some(side.geometry)).confidence == Confidence::Low
        {
            return None;
        }
    }
    let frame_a = connector_frame(Some(a.geometry), a.thickness_mm, None)?;
    let frame_b = connector_frame(Some(b.geometry), b.thickness_mm, None)?;
    let pads_a = pad_names(a.geometry, &frame_a);
    let pads_b = pad_names(b.geometry, &frame_b);
    let k =
        (pad_one_turns(a.geometry, &frame_a, b.geometry, &frame_b) + quarter_turns).rem_euclid(4);
    let placed: BTreeMap<&String, [f64; 2]> = pads_b
        .iter()
        .map(|(name, point)| {
            let y = if flip { -point[1] } else { point[1] };
            let moved = mated([point[0], y, 0.0], k, 0.0);
            (name, [moved[0], moved[1]])
        })
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
