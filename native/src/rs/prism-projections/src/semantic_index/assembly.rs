//! Pass 6: `assembly`, a port of `assemble_semantic_index`
//! (semantic_index_variants.py:1040-1071): the catalog
//! (variant_catalog_service.py), the state (`build_assembly_state`,
//! semantic_index_variants.py:752-903) and the join onto the components
//! (`_project_onto_components`, :948-1037).

mod catalog;
mod join;
mod scan;
pub(crate) mod state;
pub(crate) mod variants;

use super::{Placements, State};
use crate::{ProjectionError, ProjectionInput, SchematicModel};
use serde_json::{Map, Value, json};

/// The contract's empty `assembly`.
pub(super) fn empty() -> Value {
    json!({
        "schema": "prism.assembly_state_a0",
        "catalog": [],
        "footprintInventory": [],
        "default": {"occurrences": {}, "components": {}, "footprints": {}},
        "variants": [],
        "diagnostics": [],
    })
}

/// Build `assembly` for the revision: the catalog, then the state, with the
/// catalog's diagnostics ahead of the resolver's, then the join onto the
/// index's `componentUid`s (`assemble_semantic_index`, :1040-1071).
pub(super) fn build(
    input: &ProjectionInput<'_>,
    schematic: &SchematicModel<'_>,
    state: &mut State,
    placements: &Placements,
) -> Result<Value, ProjectionError> {
    let catalog = catalog::discover(input)?;
    let mut value = state::build(input, schematic, &catalog.entries)?;
    let mut diagnostics = catalog.diagnostics;
    if let Some(existing) = value.get_mut("diagnostics").and_then(Value::as_array_mut) {
        diagnostics.append(existing);
    }
    value["diagnostics"] = Value::Array(diagnostics);
    join::project(&mut value, &mut state.components, placements);
    Ok(value)
}

/// `build_assembly_state(design)["default"]["components"]` with no catalog
/// (interface_extractor.py:386-387): the default state per reference, before
/// the join's key translation.
pub(crate) fn default_components(
    input: &ProjectionInput<'_>,
    schematic: &SchematicModel<'_>,
) -> Result<Map<String, Value>, ProjectionError> {
    let mut value = state::build(input, schematic, &[])?;
    Ok(match value["default"]["components"].take() {
        Value::Object(components) => components,
        _ => Map::new(),
    })
}
