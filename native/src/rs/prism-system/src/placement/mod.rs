//! Placement maths for System Builder v2 (CONTRACTS_P2 §14–§15): connector
//! mating frames, poses and the default layout, and the mate transform with its
//! clearance fallback.
//!
//! These modules are faithful ports of the Python twins in
//! `backend/app/services/systems/placement/`:
//!
//! - [`frames`] ← `frames.py` (§14.4 `F_c`, §15.1 inference);
//! - [`poses`] ← `poses.py` (§14.1 poses, §14.3 default row);
//! - [`mate`] ← `mate.py` (§14.5 the mate transform and clearance).
//!
//! Every rule also has a TypeScript twin in
//! `frontend/src/features/system-builder/placement/`. Change all three and the
//! shared goldens (`backend/tests/fixtures/system_builder/placement_cases.json`)
//! together.

pub mod frames;
pub mod mate;
pub mod poses;
