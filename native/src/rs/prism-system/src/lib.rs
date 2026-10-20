//! System Builder v2's system bundle: the derived state of a system — system
//! nets, B2B mappings, harness wiring, sub-port suggestions and findings —
//! computed over design bundles (ADR `docs/architecture/adr-system-builder-v2.md`
//! §3.3; the rules are `docs/system-builder/CONTRACTS.md` §8–§9).
//!
//! [`build::build`] is a pure function of the document and its boards'
//! design-bundle members ([`input`]); `prism-kicad system build` reads those
//! and writes its [`output::SystemBundle`]. Stage 1b computes connectivity and
//! stage 3a placement ([`arrangement`]); harness geometry and outputs join later.
//!
//! Every rule in [`placement`] has a Python twin in
//! `backend/app/services/systems/placement/` and a TypeScript twin in
//! `frontend/src/features/system-builder/placement/`, and all three replay the
//! shared goldens in `backend/tests/fixtures/system_builder/placement_cases.json`.

/// The system bundle's format, part of its key (CONTRACTS §8.1): bumped
/// whenever what the bundle holds changes, so stored bundles rebuild without
/// changing any design bundle's key. 1: stage 3a added `placement`; 2: stage 3c
/// added mates' drawn `pads`.
pub const SYSTEM_BUNDLE_FORMAT: u32 = 2;

pub mod arrangement;
pub mod build;
pub mod context;
pub mod entry;
pub mod findings;
pub mod input;
pub mod mapping;
pub mod natural;
pub mod nets;
pub mod output;
pub mod placement;
pub mod suggestions;
pub mod wiring;
