//! The footprint projection of the assembly state, a port of the footprint
//! inputs and states (semantic_index_variants.py:460-498). The `(variant …)`
//! records the fork core does not expose are scanned from the board text.

use super::super::variants::{self, FootprintInput};
use super::FootprintState;
use crate::{ProjectionError, ProjectionInput};
use prism_kicad_core::PcbFootprint;

/// The footprint inputs of one board, in board file order, with the `(variant …)`
/// records the fork core does not expose (`siv:470-498`).
pub(super) fn board_footprints(
    input: &ProjectionInput<'_>,
) -> Result<Vec<FootprintInput>, ProjectionError> {
    let Some(board) = input.board else {
        return Ok(Vec::new());
    };
    let view = board.view;
    let footprints = view
        .footprints()
        .collect::<Result<Vec<PcbFootprint>, _>>()
        .map_err(|error| ProjectionError::new(format!("assembly: {error}")))?;
    let mut properties: Vec<Vec<(String, String)>> = vec![Vec::new(); footprints.len()];
    for property in view.footprint_properties() {
        let property =
            property.map_err(|error| ProjectionError::new(format!("assembly: {error}")))?;
        if let Some(slot) = properties.get_mut(property.footprint_index) {
            slot.push((property.name, property.value));
        }
    }
    Ok(footprints
        .into_iter()
        .zip(properties)
        .map(|(footprint, properties)| {
            let uuid = footprint.uuid.clone().unwrap_or_default();
            let slice = board.text.get(footprint.source_range.clone()).unwrap_or("");
            let variants = variants::footprint_variants(slice);
            variants::footprint_input(uuid, &properties, &footprint.attributes, variants)
        })
        .collect())
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
