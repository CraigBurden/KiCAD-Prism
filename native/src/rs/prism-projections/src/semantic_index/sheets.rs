//! Pass 1: sheet instances, buses and the source-uuid placements, a port of
//! `_schematic_semantic_projection` (semantic_index_service.py:567-718).

use super::{Placements, State};
use crate::{ProjectionError, ProjectionInput, SchematicModel};

/// Fill `state.sheet_instances`, `state.buses`, `indexes.sheetInstanceByPath`
/// and `indexes.busByUid`, and return every schematic item's placements.
pub(super) fn project(
    _input: &ProjectionInput<'_>,
    _schematic: &SchematicModel<'_>,
    _state: &mut State,
) -> Result<Placements, ProjectionError> {
    Ok(Placements::new())
}
