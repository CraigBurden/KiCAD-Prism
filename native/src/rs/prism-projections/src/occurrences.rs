//! `projections/occurrences.json` (`prism.occurrences.a0`), WP-P2.
//!
//! A port of the W0 prototype producer `build`
//! (`native/parity/prism_parity/capture/occurrences.py:150-292`) and its
//! helpers (`:59-149`), which the committed goldens
//! `native/parity/goldens/<case>/occurrences.json` were produced by. The
//! normative rules are `native/contracts/prism/field-maps/occurrences.md`.
//!
//! The assembly view of one revision in its default state:
//!
//! - [`schematic`]: every sheet instance in hierarchy order with its folded
//!   DNP / BOM / board / sim state and its raw sheet-variant records, then every
//!   placed symbol occurrence with its reference, unit, folded flags, written
//!   properties, canonical BOM fields and raw symbol-variant records;
//! - [`footprints`]: every board footprint with its designator, assembly
//!   attributes and raw variant records;
//! - [`references`]: the join of symbols and footprints by reference designator;
//! - [`declarations`]: the project and board variant registry entries.
//!
//! The heavy lifting is shared with the semantic index: the sheet graph, the
//! ancestor fold (`semantic_index/assembly/state.rs`), the pinned symbol
//! resolver (`semantic_index/assembly/variants.rs`), the placed-symbol fields
//! (`semantic_index/fields.rs`) and `_canonical_fields`
//! (`semantic_index/components.rs`) are called, not re-ported.

mod bom;
mod declarations;
mod footprints;
mod property;
mod records;
mod references;
mod schematic;
mod support;

use crate::{Produced, ProjectionError, ProjectionInput, document};
use prism_kicad_contracts::generated::prism_occurrences_a0::OccurrencesA0;
use serde_json::json;

/// The member's schema id.
pub const SCHEMA: &str = "prism.occurrences.a0";
const NAME: &str = "projections/occurrences.json";

/// Build `projections/occurrences.json` from the single parse of the revision.
pub fn produce(input: &ProjectionInput<'_>) -> Result<Produced<OccurrencesA0>, ProjectionError> {
    // A configured root schematic the model lacks is a build failure, as for
    // the semantic index (`semantic_index.rs`): `design.json` failed too.
    if input.schematic.is_none() && input.config.root_schematic.is_some() {
        return Err(ProjectionError::new(format!(
            "{NAME}: the schematic model could not be built"
        )));
    }
    let mut warnings = Vec::new();
    let (sheets, symbols) = match input.schematic {
        Some(schematic) => schematic::project(input, schematic, &mut warnings),
        None => (Vec::new(), Vec::new()),
    };
    let footprints = footprints::project(input, &mut warnings)?;
    let references = references::build(&symbols, &footprints);
    let variant_declarations = declarations::build(input);
    let value = json!({
        "schema": SCHEMA,
        "sheets": sheets,
        "symbols": symbols,
        "footprints": footprints,
        "references": references,
        "variantDeclarations": variant_declarations,
    });
    let mut produced = document(NAME, value)?;
    produced.warnings = warnings;
    Ok(produced)
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_empty_form_decodes() {
        crate::test_support::with_bare_project(|input| {
            let produced = super::produce(input).unwrap();
            let value = serde_json::to_value(&produced.document).unwrap();
            assert_eq!(value["schema"], super::SCHEMA);
            assert!(value["sheets"].as_array().unwrap().is_empty());
            assert!(value["symbols"].as_array().unwrap().is_empty());
            assert!(value["footprints"].as_array().unwrap().is_empty());
            assert!(value["references"].as_array().unwrap().is_empty());
            assert!(value["variantDeclarations"].as_array().unwrap().is_empty());
        });
    }
}
