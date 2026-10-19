//! System Builder v2's system bundle: the derived state of a system — system
//! nets, B2B mappings, harness wiring, sub-port suggestions and findings —
//! computed over design bundles (ADR `docs/architecture/adr-system-builder-v2.md`
//! §3.3; the rules are `docs/system-builder/CONTRACTS.md` §8–§9).
//!
//! [`build::build`] is a pure function of the document and its boards'
//! design-bundle members ([`input`]); `prism-kicad system build` reads those
//! and writes its [`output::SystemBundle`]. Stage 1b computes connectivity;
//! geometry and outputs join in later stages.
//!
//! Every rule in [`placement`] has a Python twin in
//! `backend/app/services/systems/placement/` and a TypeScript twin in
//! `frontend/src/features/system-builder/placement/`, and all three replay the
//! shared goldens in `backend/tests/fixtures/system_builder/placement_cases.json`.

pub mod build;
pub mod context;
pub mod findings;
pub mod input;
pub mod mapping;
pub mod natural;
pub mod nets;
pub mod output;
pub mod placement;
pub mod suggestions;
pub mod wiring;
