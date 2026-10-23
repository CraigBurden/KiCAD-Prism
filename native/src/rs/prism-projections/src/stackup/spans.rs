//! The board forms the stackup member reads, taken from the shared board view
//! instead of the whole parsed board tree.
//!
//! [`crate::BoardModel::tree`] owns the board's every token: on EDA-04903 it
//! keeps about 340 MiB alive. The stackup rules read four top-level forms
//! (`stackup_build.py:173-298`): `(general …)` for the thickness, `(layers …)`
//! for the table, `(setup (stackup …))` for the stackup and every `(via …)`
//! for `viaSpans`. The view already indexes those forms' exact source spans
//! (`prism_kicad_core::PcbView::top_level_forms`), so [`root`] rebuilds a
//! small `(kicad_pcb …)` from their text and parses only that. The results are
//! the same tokens the shared tree holds, because both go through
//! `prism_kicad_core::parse`.
//!
//! The member's own reader ([`super::read`]) is unchanged: it still walks one
//! `Sexp` root with the golden's helpers.

use super::NAME;
use crate::{BoardModel, ProjectionError};
use prism_kicad_core::Sexp;

/// The heads [`super::read::build`] reads.
pub(super) const BUILD_HEADS: [&str; 4] = ["general", "layers", "setup", "via"];

/// The heads [`super::read::copper_order`] reads.
pub(super) const COPPER_HEADS: [&str; 2] = ["layers", "setup"];

/// A `(kicad_pcb …)` root holding only the top-level `heads` of the board, in
/// source order.
///
/// The root is the same form the whole tree has, even for a board with none of
/// `heads`: the reader then finds nothing and keeps its own defaults.
pub(super) fn root(board: &BoardModel<'_>, heads: &[&str]) -> Result<Sexp, ProjectionError> {
    let source = board.view.source();
    let mut text = String::from("(kicad_pcb");
    for span in board.view.top_level_forms() {
        let Some(head) = span.head.as_deref() else {
            continue;
        };
        if !heads.contains(&head) {
            continue;
        }
        let form = span
            .text(source)
            .map_err(|error| ProjectionError::new(format!("{NAME}: {error}")))?;
        text.push(' ');
        text.push_str(form);
    }
    text.push(')');
    prism_kicad_core::parse(&text)
        .map_err(|error| ProjectionError::new(format!("{NAME}: the board does not parse: {error}")))
}
