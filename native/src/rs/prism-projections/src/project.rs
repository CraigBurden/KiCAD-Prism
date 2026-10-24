//! `projections/project.json` (`prism.project.a0`), WP-P4.
//!
//! A faithful port of the golden producer `native/parity/prism_parity/capture/project.py`
//! (`produce` and its helpers, lines 50-649), which the committed goldens were
//! captured with. The normative rules are in
//! `native/contracts/prism/field-maps/project.md`: "Scanning", "Resolution
//! (normative)" and "Title-block expansion (normative)".
//!
//! One `Producer` walks the project's `.kicad_pro` (as JSON), the root
//! schematic and every sheet it reaches, the board, the project's two library
//! tables and every drawing sheet a reference resolves to. It emits one header
//! per schematic file and the board, and every path reference the files make.
//! S-expression files are parsed with the fork's own parser
//! (`prism_kicad_core::parse_with_limits`); every extra file is read through
//! `Sources::read`, which makes it a bundle `sources/` member.
//!
//! The port is grouped by concern, one submodule per part of the field map:
//!
//! - [`reference`]: the target a reference resolves to and the contract enums;
//! - [`resolver`]: "Resolution (normative)";
//! - [`sexpr`]: the fork's `Sexp` accessors;
//! - [`title_block`]: "Title-block expansion (normative)";
//! - [`text_paths`]: the `text-path` scan;
//! - [`producer`]: the `produce` run over the whole project.

mod producer;
mod reference;
mod resolver;
mod sexpr;
mod text_paths;
mod title_block;

#[cfg(test)]
mod tests;

pub use producer::produce;

/// The member's schema id.
pub const SCHEMA: &str = "prism.project.a0";
const NAME: &str = "projections/project.json";
