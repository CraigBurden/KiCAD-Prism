//! Prism's design-bundle projections, one module per `projections/*.json`
//! member (ADR §6). Each producer reads the single parsed model and writes
//! its contract in `native/src/tsp/prism/`; the rules for every field are in
//! `native/contracts/prism/field-maps/`. WP-F2 declares every module once, so
//! the Wave 2 producers (P1–P5) each fill only their own file.

pub mod board_objects;
pub mod occurrences;
pub mod placements;
pub mod project;
pub mod route_metrics;
pub mod semantic_index;
pub mod stackup;
pub mod system_interface;
