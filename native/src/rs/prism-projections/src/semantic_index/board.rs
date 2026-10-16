//! Pass 5: the board, a port of semantic_index_service.py:1025-1127
//! (`_property_map`, `_net_table`, `_net_name`, `_net_code` at :516-554).

use super::State;
use super::reconcile::SplitNetClaims;
use crate::{BoardModel, ProjectionError};

/// Attach footprints, pads, tracks, arcs, vias and zones to the index.
pub(super) fn project(
    _board: &BoardModel<'_>,
    _state: &mut State,
    _claims: &mut SplitNetClaims,
) -> Result<(), ProjectionError> {
    Ok(())
}
