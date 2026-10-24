//! The footprint projection of the assembly state, a port of the footprint
//! inputs and states (semantic_index_variants.py:460-498). The `(variant …)`
//! records the fork core does not expose are scanned from the board text.

use super::super::variants::{self, FootprintInput};
use super::FootprintState;
use crate::{ProjectionError, ProjectionInput};
use std::sync::Arc;

/// The footprint inputs of one board, in board file order, with the `(variant …)`
/// records the fork core does not expose (`siv:470-498`).
///
/// The result is built once and cached on [`crate::BoardModel`]: the semantic
/// index and `occurrences` both ask for it, and their producers run in
/// parallel on the same input.
pub(crate) fn board_footprints(
    input: &ProjectionInput<'_>,
) -> Result<Arc<[FootprintInput]>, ProjectionError> {
    let Some(board) = input.board else {
        return Ok(Arc::from(Vec::<FootprintInput>::new()));
    };
    board
        .assembly_footprints
        .get_or_init(|| decode(board))
        .as_ref()
        .map(Arc::clone)
        .map_err(|error| error.clone())
}

/// Decode the board's footprint inputs from the shared view.
fn decode(board: &crate::BoardModel<'_>) -> Result<Arc<[FootprintInput]>, ProjectionError> {
    let view = board.view;
    let footprints = view.decoded_footprints();
    let assembly_error =
        |error: &prism_kicad_core::Error| ProjectionError::new(format!("assembly: {error}"));
    let mut properties: Vec<Vec<(String, String)>> = vec![Vec::new(); footprints.len()];
    for property in view.decoded_footprint_properties() {
        let property = property.as_ref().map_err(assembly_error)?;
        if let Some(slot) = properties.get_mut(property.footprint_index) {
            slot.push((property.name.clone(), property.value.clone()));
        }
    }
    let mut inputs = Vec::with_capacity(footprints.len());
    for footprint in footprints {
        let footprint = footprint.as_ref().map_err(assembly_error)?;
        let uuid = footprint.uuid.as_deref().unwrap_or_default();
        let slice = board.text.get(footprint.source_range.clone()).unwrap_or("");
        let variants = variants::footprint_variants(slice);
        inputs.push(variants::footprint_input(
            uuid.to_owned(),
            properties.get(inputs.len()).map_or(&[], Vec::as_slice),
            &footprint.attributes,
            variants,
        ));
    }
    Ok(Arc::from(inputs))
}

/// `_footprint_state` (semantic_index_variants.py:470-491). Today's `order` is
/// carried but never read.
fn footprint_state(input: &FootprintInput, variant_name: Option<&str>) -> FootprintState {
    let record =
        variant_name.and_then(|name| variants::select_footprint_variant(&input.variants, name));
    let resolved = variants::resolve_footprint(input, record.map(|record| record.name.as_str()));
    FootprintState {
        uuid: input.uuid.clone(),
        reference: resolved.reference,
        flags: (
            resolved.dnp,
            resolved.exclude_from_bom,
            resolved.exclude_from_pos_files,
        ),
        fields: resolved.fields,
    }
}

/// `_footprint_states` (semantic_index_variants.py:494-498).
pub(super) fn footprint_states(
    inputs: &[FootprintInput],
    variant_name: Option<&str>,
) -> Vec<FootprintState> {
    inputs
        .iter()
        .map(|input| footprint_state(input, variant_name))
        .collect()
}
