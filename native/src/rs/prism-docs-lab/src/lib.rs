//! Shared pieces of Prism's documentation prototypes.
//!
//! `prism-docs-lab` holds the hand-run prototypes that judge a documentation
//! idea before it becomes product behaviour; it is not part of Release Studio
//! and ships in no image. Every prototype is one binary under `src/bin/`, and
//! the parts more than one prototype needs live here: opening a design bundle
//! and reading its members ([`bundle`]), KiCad's layer palette ([`palette`])
//! and the deterministic HTML page furniture ([`html`]).
//!
//! Prototypes read only what the bundle already carries, write one
//! self-contained file and never touch the network.

pub mod bundle;
pub mod html;
pub mod palette;

pub use bundle::{Bundle, LabError};

/// The look every prototype page shares: the ink-and-rule palette, the table
/// treatment and the page shell. Prototype-specific rules follow it.
pub const LAB_CSS: &str = include_str!("assets/lab.css");
