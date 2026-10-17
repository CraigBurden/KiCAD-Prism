//! Object changes of the Schematic and PCB tabs: one review change per
//! object the object diff added, removed or modified, with its
//! classification, label, semantic identity, sides and visual targets. Today's
//! code: `backend/app/services/design_compare_nodes.py` (`_node_change`,
//! `_hydrate_native_targets`).
//!
//! Skeleton: C2r step 4 fills it in.

use super::super::{CompareError, Delta};
use super::ReviewChange;

pub(super) fn build(_delta: &Delta) -> Result<Vec<ReviewChange>, CompareError> {
    Ok(Vec::new())
}
