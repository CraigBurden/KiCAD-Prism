//! `projections/system-interface.json` (`prism.system_interface.v1`). Filled by WP-P5; until then
//! [`produce`] returns the contract's empty form for every project
//! (bundle-format.md §2.1). The interface is in the crate docs.

use crate::{Produced, ProjectionError, ProjectionInput, document};
use prism_kicad_contracts::generated::prism_system_interface_v1::SystemInterfaceV1;
use serde_json::json;

/// The member's schema id.
pub const SCHEMA: &str = "prism.system_interface.v1";
const NAME: &str = "projections/system-interface.json";

/// The digest of the empty form: SHA-256 over Python's
/// `json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`
/// of the body without `digest` (field-maps/system-interface.md, "Digest").
const EMPTY_DIGEST: &str =
    "sha256:078d43da554f61205b324187b389718ebb745b192fab985186952824f3f742c4";

/// Build `projections/system-interface.json` from the single parse of the revision.
pub fn produce(
    input: &ProjectionInput<'_>,
) -> Result<Produced<SystemInterfaceV1>, ProjectionError> {
    let _ = input;
    document(
        NAME,
        json!({
            "schema": SCHEMA,
            "hasPcb": false,
            "boardThicknessMm": null,
            "boardOutlineMm": null,
            "components": [],
            "diagnostics": [],
            "digest": EMPTY_DIGEST,
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
