//! Artwork facades over the KiCad core (ADR amendment C3 §3.4).
//!
//! `prism-kicad stroke-text` and `prism-kicad drawing-sheet` expose the core's
//! NewStroke font and default worksheet without a process per string, so
//! Release Studio can stop importing Python `kicad_monkey` for sheet text and
//! frames. The module owns only the translation from the frozen contracts to
//! the core's types and back; the font, the worksheet and its variables stay
//! in `prism-kicad-core`.

pub mod artwork;
pub mod drawing_sheet;
pub mod stroke_text;

use std::fmt;

/// How a facade failure is reported.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ArtworkErrorKind {
    /// The request cannot be drawn as given.
    InvalidInput,
    /// The core's retained-output limit was hit.
    ResourceLimit,
    /// A defect: geometry outside the number range, or an unsupported op.
    Internal,
}

/// One facade failure, with the core's message when it came from the core.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtworkError {
    /// What kind of failure this is.
    pub kind: ArtworkErrorKind,
    /// The failure's message, without a host path.
    pub message: String,
}

impl ArtworkError {
    fn invalid(message: impl Into<String>) -> Self {
        Self {
            kind: ArtworkErrorKind::InvalidInput,
            message: message.into(),
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            kind: ArtworkErrorKind::Internal,
            message: message.into(),
        }
    }
}

impl fmt::Display for ArtworkError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for ArtworkError {}

pub use drawing_sheet::render as render_drawing_sheet;
pub use stroke_text::{metrics as stroke_font_metrics, render as render_stroke_text};
