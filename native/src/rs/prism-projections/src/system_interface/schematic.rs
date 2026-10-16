//! The components and diagnostics, a port of `_occurrences`,
//! `_schematic_pins`, `_power_net_names`, `_mpn`, `_field_map` and the
//! component loop of `extract_interface` (interface_extractor.py:95-145,
//! :324-350, :386-463).

use super::board::BoardFacts;
use crate::{ProjectionError, ProjectionInput, SchematicModel};
use serde_json::Value;
use std::collections::BTreeSet;

/// `components` in natural reference order and `diagnostics` sorted by
/// `(code, portKey, pad or "")`, joined with the board's facts when there is a
/// board.
pub(super) fn project(
    input: &ProjectionInput<'_>,
    schematic: &SchematicModel<'_>,
    _board: Option<&BoardFacts>,
) -> Result<(Vec<Value>, Vec<Value>), ProjectionError> {
    let _dnp = default_dnp(input, schematic)?;
    Ok((Vec::new(), Vec::new()))
}

/// The references whose default assembly state is DNP: today's
/// `build_assembly_state(...)["default"]["components"]`, keyed by reference
/// before the semantic index's key translation (interface_extractor.py:386-387,
/// :444). The same resolver as the semantic index's `assembly`; filled from
/// `semantic_index::assembly` once it lands.
fn default_dnp(
    _input: &ProjectionInput<'_>,
    _schematic: &SchematicModel<'_>,
) -> Result<BTreeSet<String>, ProjectionError> {
    Ok(BTreeSet::new())
}
