//! Harness geometry numbers, frozen in SB2-40 (CONTRACTS_P2 §17.5, D-P2-35).
//!
//! A faithful port of `backend/app/services/systems/placement/harness_spec.py`;
//! the TypeScript twin is
//! `frontend/src/features/system-builder/placement/harness-spec.ts`. All three
//! equal `backend/tests/fixtures/system_builder/harness_spec.json`.

use serde_json::Value;

/// Straight exit leg along the end's outward axis.
pub const BOOT_MM: f64 = 10.0;
/// Mating face to cable exit when the housing has no model.
pub const HOUSING_DEPTH_MM: f64 = 8.0;
/// An N-end breakout rises this far along the mean outward normal.
pub const BREAKOUT_LIFT_MM: f64 = 10.0;
/// Adaptive sampling of the centripetal Catmull-Rom curve.
pub const CHORD_ERROR_MM: f64 = 0.2;
/// The Catmull-Rom alpha (centripetal: 0.5).
pub const CATMULL_ROM_ALPHA: f64 = 0.5;
/// `r_min = factor × bundle diameter`.
pub const MIN_BEND_RADIUS_FACTOR: f64 = 6.0;
/// How many times bend relaxation may move a waypoint.
pub const BEND_RELAX_ITERATIONS: usize = 8;
/// `bundle d = k · √Σ dᵢ²`.
pub const PACKING_FACTOR: f64 = 1.2;
/// Tube ring segments (drawing only).
pub const RING_SEGMENTS: u32 = 12;
/// Breakout blend length (drawing only).
pub const BREAKOUT_BLEND_MM: f64 = 5.0;
/// Estimated total = arc length × (1 + allowance).
pub const LENGTH_ALLOWANCE: f64 = 0.10;
/// SYS-V13 when the cut length differs by more.
pub const LENGTH_MISMATCH_TOLERANCE: f64 = 0.15;
/// How far a board's collision box grows.
pub const BOARD_COLLISION_MARGIN_MM: f64 = 1.0;
/// The gauge assumed when none is known.
pub const DEFAULT_GAUGE_AWG: &str = "24";

/// M22759/16 finished wire diameter, nominal (NASA NEPP AS22759/16 table,
/// inches × 25.4).
pub const WIRE_OD_MM: &[(&str, f64)] = &[
    ("24", 1.143),
    ("22", 1.3208),
    ("20", 1.524),
    ("18", 1.8034),
    ("16", 2.0066),
    ("14", 2.3622),
    ("12", 2.8956),
    ("10", 3.5306),
    ("8", 5.0546),
    ("6", 6.35),
    ("4", 7.9248),
    ("2", 9.8552),
    ("1", 10.9474),
    ("0", 12.1666),
    ("00", 13.8684),
];

/// A gauge as Python's `str(...).strip().upper().removesuffix("AWG").strip()`.
fn gauge_key(gauge: &Value) -> String {
    let text = match gauge {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    };
    let upper = text.trim().to_uppercase();
    let stripped = upper.strip_suffix("AWG").unwrap_or(&upper);
    stripped.trim().to_owned()
}

/// A wire's outside diameter and whether it is assumed: no gauge, or one
/// M22759/16 doesn't make, takes the default gauge's diameter (§17.5). Ports
/// `harness_spec.py:wire_od_mm`.
pub fn wire_od_mm(gauge: Option<&Value>) -> (f64, bool) {
    let Some(gauge) = gauge else {
        return (default_od(), true);
    };
    let key = gauge_key(gauge);
    match WIRE_OD_MM.iter().find(|(name, _)| *name == key) {
        Some((_, od)) => (*od, false),
        None => (default_od(), true),
    }
}

/// The default gauge's diameter.
fn default_od() -> f64 {
    WIRE_OD_MM
        .iter()
        .find(|(name, _)| *name == DEFAULT_GAUGE_AWG)
        .map_or(1.143, |(_, od)| *od)
}
