//! Connectivity and structure changes of the Schematic tab: nets, buses,
//! sheets and their terminals, from each revision's schematic view of the
//! semantic index (`field-maps/semantic-index.md` D7) and its components
//! (`field-maps/occurrences.md` "Design Comparison components"). Today's code:
//! `backend/app/services/design_compare_semantics.py` (`_connectivity_changes`,
//! `_semantic_structure_changes`, `_diff_nets`) and
//! `design_compare_net_pairing.py`.
//!
//! Skeleton: C2r step 4 fills it in.

use super::{ReviewChange, Revision};

pub(super) fn build(_base: &Revision, _head: &Revision) -> Vec<ReviewChange> {
    Vec::new()
}
