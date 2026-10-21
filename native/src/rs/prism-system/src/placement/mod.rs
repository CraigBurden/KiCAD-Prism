//! Placement maths for System Builder v2 (CONTRACTS_P2 §14–§15): connector
//! mating frames, poses and the default layout, and the mate transform with its
//! clearance fallback.
//!
//! These modules are faithful ports of the Python twins in
//! `backend/app/services/systems/placement/`:
//!
//! - [`frames`] ← `frames.py` (§14.4 `F_c`, §15.1 inference);
//! - [`poses`] ← `poses.py` (§14.1 poses, §14.3 default row);
//! - [`mate`] ← `mate.py` (§14.5 the mate transform and clearance);
//! - [`solve`] ← `solve.ts` (the tree solve: driving mates and mate checks);
//! - [`harness_spec`] ← `harness_spec.py` (§17.5 frozen numbers);
//! - [`harness_ends`] ← `harness_ends.py` (§17.6 end poses and exit legs);
//! - [`harness_topology`] ← `harness_topology.py` (§17.7 runs and breakouts);
//! - [`harness_curves`] ← `harness_curves.py` (§17.8 curves and bend radius);
//! - [`harness_nodes`] ← `harness_nodes.py` (§17.9 stored breakouts and waypoints);
//! - [`harness_route`] ← `harness_route.py` (§17.10 one harness in the world);
//! - [`harness_checks`] ← `harness_checks.py` (§17.10 lengths and collisions).
//!
//! Every rule also has a TypeScript twin in
//! `frontend/src/features/system-builder/placement/`. Change all three and the
//! shared goldens (`backend/tests/fixtures/system_builder/placement_cases.json`)
//! together.

pub mod frames;
pub mod harness_checks;
pub mod harness_curves;
pub mod harness_ends;
pub mod harness_nodes;
pub mod harness_route;
pub mod harness_spec;
pub mod harness_topology;
pub mod mate;
pub mod poses;
pub mod solve;
