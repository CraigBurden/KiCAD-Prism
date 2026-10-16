//! `projections/project.json` (`prism.project.a0`). Filled by WP-P4; until then
//! [`produce`] returns the contract's empty form for every project
//! (bundle-format.md §2.1). The interface is in the crate docs.

use crate::{Produced, ProjectionError, ProjectionInput, document};
use prism_kicad_contracts::generated::prism_project_a0::ProjectA0;
use serde_json::json;

/// The member's schema id.
pub const SCHEMA: &str = "prism.project.a0";
const NAME: &str = "projections/project.json";

/// Build `projections/project.json` from the single parse of the revision.
pub fn produce(input: &ProjectionInput<'_>) -> Result<Produced<ProjectA0>, ProjectionError> {
    let project_file = &input.config.project_file.0;
    let name = project_file.rsplit('/').next().unwrap_or(project_file);
    let project_name = name.rsplit_once('.').map_or(name, |(stem, _)| stem);
    document(
        NAME,
        json!({
            "schema": SCHEMA,
            "projectFile": project_file,
            "projectName": project_name,
            "textVariables": {},
            "netClasses": [],
            "documents": [],
            "references": [],
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
