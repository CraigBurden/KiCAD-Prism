//! Connectivity and structure changes of the Schematic tab: nets, buses and
//! sheet instances, from each revision's schematic view of the semantic index
//! (`field-maps/semantic-index.md` D7) and its components
//! (`field-maps/occurrences.md` "Design Comparison components"). Today's code:
//! `backend/app/services/design_compare_semantics.py` (`_connectivity_changes`,
//! `_semantic_structure_changes`, `_diff_nets`) and
//! `design_compare_net_pairing.py`.
//!
//! This is a Rust-native rebuild on the typed members: the schematic view is
//! derived by filtering the member, each revision's lookup tables are built
//! once and index into the member's vectors, and strings are allocated only for
//! the output. The change's `base`/`head` for a structure change are filled
//! from the revision's native entries (today's converter fallback); the
//! [`ReviewChange::visual_targets`] are pre-hydration (chunk 5 hydrates them).
//!
//! Submodules: [`input`] (the view and its lookup tables), [`pairing`] (net
//! pairing), [`nets`] (the net changes), [`structure`] (bus and sheet-instance
//! changes), [`fields`] (field-delta builders) and [`targets`] (the visual
//! targets and their dedupe).

mod fields;
mod input;
mod nets;
mod pairing;
mod structure;
mod targets;

#[cfg(test)]
mod tests;

use super::ReviewChange;
use super::Revision;
use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;

/// What a change does, from which sides are present.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Kind {
    /// Only the head has the object.
    Added,
    /// Only the base has the object.
    Removed,
    /// Both have it, and differ.
    Changed,
}

impl Kind {
    /// The kind of a change with the given sides present.
    pub(super) fn of(before: bool, after: bool) -> Self {
        match (before, after) {
            (false, _) => Self::Added,
            (_, false) => Self::Removed,
            _ => Self::Changed,
        }
    }

    /// The kind's id fragment.
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Added => "added",
            Self::Removed => "removed",
            Self::Changed => "changed",
        }
    }

    /// The kind as the contract's enum.
    pub(super) fn as_dc(self) -> dc::DesignCompareChangeKind {
        match self {
            Self::Added => dc::DesignCompareChangeKind::Added,
            Self::Removed => dc::DesignCompareChangeKind::Removed,
            Self::Changed => dc::DesignCompareChangeKind::Changed,
        }
    }
}

/// The Schematic tab's connectivity and structure changes for `base` against
/// `head`, nets first, then buses and sheet instances (`_connectivity_changes`).
pub(super) fn build(base: &Revision, head: &Revision) -> Vec<ReviewChange> {
    let base = input::View::new(base);
    let head = input::View::new(head);
    let mut changes = nets::diff(&base, &head);
    changes.extend(structure::diff(&base, &head));
    changes
}
