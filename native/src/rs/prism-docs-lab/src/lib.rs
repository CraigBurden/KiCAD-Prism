//! Shared pieces of Prism's documentation prototypes.
//!
//! `prism-docs-lab` holds the hand-run prototypes that judge a documentation
//! idea before it becomes product behaviour; it is not part of Release Studio
//! and ships in no image. Every prototype is one binary under `src/bin/`, and
//! the parts more than one prototype needs live here: opening a design bundle
//! and reading its members ([`bundle`]), KiCad's copper palette ([`palette`]),
//! the three looks a page is printed in ([`theme`]) and the deterministic HTML
//! page furniture ([`html`]). [`mech`] holds the mechanical outline's geometry,
//! Geometer session and A3 sheet.
//!
//! Prototypes read only what the bundle carries plus the local 3D-model
//! directories a caller names, write their files and never touch the network.

pub mod bundle;
pub mod html;
pub mod icd;
pub mod mech;
pub mod palette;
pub mod theme;

pub use bundle::{Bundle, LabError};

/// The look every prototype page shares: the ink-and-rule stylesheet, the
/// table treatment and the page shell. Prototype-specific rules follow it.
pub const LAB_CSS: &str = include_str!("assets/lab.css");
