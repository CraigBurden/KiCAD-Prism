//! `projections/board-objects.json` (`prism.board_objects.a0`). Filled by WP-P2; until then
//! [`produce`] returns the contract's empty form for every project
//! (bundle-format.md §2.1). The interface is in the crate docs.

use crate::{Produced, ProjectionError, ProjectionInput, document};
use prism_kicad_contracts::generated::prism_board_objects_a0::BoardObjectsA0;
use serde_json::json;

/// The member's schema id.
pub const SCHEMA: &str = "prism.board_objects.a0";
const NAME: &str = "projections/board-objects.json";

/// Build `projections/board-objects.json` from the single parse of the revision.
pub fn produce(input: &ProjectionInput<'_>) -> Result<Produced<BoardObjectsA0>, ProjectionError> {
    let _ = input;
    document(NAME, json!({"schema": SCHEMA, "documents": []}))
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_empty_form_decodes() {
        crate::test_support::with_bare_project(|input| {
            let produced = super::produce(input).unwrap();
            let value = serde_json::to_value(&produced.document).unwrap();
            assert_eq!(value["schema"], super::SCHEMA);
        });
    }
}
