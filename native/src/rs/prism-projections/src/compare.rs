//! Design Comparison in Rust (ADR amendments C2 and C2r): `prism-kicad
//! compare`'s engine. [`result::build`] turns two revisions' projections into
//! the `prism.design_compare.result.a1` document, every tab except fabrication.
//!
//! The object diff at its core is the port of `diff_indexes` in
//! `backend/design-compare-parser/ecad-diff.mjs`: identity matching and
//! classification over the two `projections/board-objects.json` documents.
//! It is typed only (`diff::Outcome`) and read by the object tab; its output
//! is the comparison document above (C2r §4).
//!
//! Object keys and `documentPath` are project-relative: the anchor's
//! directory is stripped from every member `RepoPath` (decision D1). `changes`
//! and every property-delta list are sorted in code point order (decision D2,
//! divergence `compare-1`). The parity traps of amendment C2 §6 are
//! reproduced where the reference does not already agree with Rust:
//! `Math.round` half-toward-+∞ (T1), `Math.hypot` (T2), ECMAScript number
//! text (T3), UTF-16 sorts (T5) and absent-versus-`null` (T7); the identity
//! signatures of `stable_json` instead accept any total order that is the same
//! on both sides (T6).
//!
//! The engine never materialises today's millimetre entry as a separate step;
//! it rebuilds only the fields the diff reads, in one pass per side.

mod canonical;
mod classify;
mod diff;
mod entry;
mod json;
mod numbers;
mod output;
pub mod result;

pub use entry::{Entries, anchor_directory, entries};

use std::fmt;

/// Why the diff could not be built: a malformed `board-objects` member, or a
/// document that does not hold together. The CLI renders it as exit 1,
/// `internal`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CompareError {
    /// One sentence naming the cause; never a host path.
    pub message: String,
}

impl CompareError {
    /// An error with `message`.
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl fmt::Display for CompareError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for CompareError {}
