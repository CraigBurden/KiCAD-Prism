//! The board footprint pass (occurrences.py:231-252).

use super::{records, support};
use crate::semantic_index::assembly::state::footprints as state_footprints;
use crate::{ProducerWarning, ProjectionError, ProjectionInput};
use serde_json::{Map, Value};

/// Every `(footprint …)` of the board, in file order, with its designator,
/// assembly attributes and raw variant records (occurrences.py:231-252).
/// A footprint whose `uuid` is not a canonical `KiCadUuid` is skipped and
/// reported once (`occurrences-footprint-without-uuid`).
pub(crate) fn project(
    input: &ProjectionInput<'_>,
    warnings: &mut Vec<ProducerWarning>,
) -> Result<Vec<Value>, ProjectionError> {
    let Some(board) = input.board else {
        return Ok(Vec::new());
    };
    let mut footprints = Vec::new();
    let board_footprints = state_footprints::board_footprints(input)?;
    for footprint in board_footprints.iter() {
        if !support::is_canonical_uuid(&footprint.uuid) {
            warnings.push(support::warning(
                "occurrences-footprint-without-uuid",
                format!("{} {:?}", board.path, footprint.uuid),
            ));
            continue;
        }
        let mut entry = Map::new();
        entry.insert("uuid".to_owned(), Value::String(footprint.uuid.clone()));
        entry.insert(
            "documentPath".to_owned(),
            Value::String(board.path.to_owned()),
        );
        if !footprint.reference.is_empty() {
            entry.insert(
                "reference".to_owned(),
                Value::String(footprint.reference.clone()),
            );
        }
        entry.insert("dnp".to_owned(), Value::Bool(footprint.dnp));
        entry.insert(
            "excludeFromBom".to_owned(),
            Value::Bool(footprint.exclude_from_bom),
        );
        entry.insert(
            "excludeFromPosFiles".to_owned(),
            Value::Bool(footprint.exclude_from_pos_files),
        );
        entry.insert(
            "variants".to_owned(),
            Value::Array(
                footprint
                    .variants
                    .iter()
                    .map(records::footprint_record)
                    .collect(),
            ),
        );
        footprints.push(Value::Object(entry));
    }
    Ok(footprints)
}
