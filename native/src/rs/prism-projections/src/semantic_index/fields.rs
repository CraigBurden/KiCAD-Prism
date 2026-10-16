//! Pass 2: the placed-symbol field scan, a port of `_schematic_instance_fields`
//! and `_library_block_span` (semantic_index_service.py:372-435).

use crate::{ProjectionError, ProjectionInput, SchematicModel};
use std::collections::BTreeMap;

/// Placed-symbol uuid → its fields as written in the schematic text.
pub(super) type SourceFields = BTreeMap<String, BTreeMap<String, String>>;

/// Scan every reached schematic's text for placed symbols' fields.
pub(super) fn scan(
    _input: &ProjectionInput<'_>,
    _schematic: &SchematicModel<'_>,
) -> Result<SourceFields, ProjectionError> {
    Ok(SourceFields::new())
}
