//! `projections/semantic-index.json` (`prism.semantic_index.a1`). Filled by WP-P1; until then
//! [`produce`] returns the contract's empty form for every project
//! (bundle-format.md §2.1). The interface is in the crate docs.

use crate::{Produced, ProjectionError, ProjectionInput, document};
use prism_kicad_contracts::generated::prism_semantic_index_a1::SemanticIndexA1;
use serde_json::json;

/// The member's schema id.
pub const SCHEMA: &str = "prism.semantic_index.a1";
const NAME: &str = "projections/semantic-index.json";

/// Build `projections/semantic-index.json` from the single parse of the revision.
pub fn produce(input: &ProjectionInput<'_>) -> Result<Produced<SemanticIndexA1>, ProjectionError> {
    // A build without `--revision-key` has no key; the all-zero key stands in
    // for it (local and test builds only, cli-spec.md §5.2.2).
    let key = input
        .revision_key
        .map_or_else(|| "0".repeat(64), str::to_owned);
    let empty_map = || json!({});
    document(
        NAME,
        json!({
            "schema": SCHEMA,
            "sourceRevisionKey": key,
            "components": [],
            "nets": [],
            "terminals": [],
            "sheetInstances": [],
            "buses": [],
            "indexes": {
                "componentByReference": empty_map(),
                "componentBySchematicUuid": empty_map(),
                "componentByPcbFootprintUuid": empty_map(),
                "terminalBySchematicPinUuid": empty_map(),
                "terminalByPcbPadUuid": empty_map(),
                "terminalByReferencePin": empty_map(),
                "netByName": empty_map(),
                "netByNetCode": empty_map(),
                "netBySchematicUuid": empty_map(),
                "netByPcbUuid": empty_map(),
                "sheetInstanceByPath": empty_map(),
                "busByUid": empty_map(),
            },
            "assembly": {
                "schema": "prism.assembly_state_a0",
                "catalog": [],
                "footprintInventory": [],
                "default": {"occurrences": {}, "components": {}, "footprints": {}},
                "variants": [],
                "diagnostics": [],
            },
        }),
    )
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
