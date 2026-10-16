//! `projections/system-interface.json` (`prism.system_interface.v1`), WP-P5.
//!
//! The output of today's `interface_extractor.extract_interface`
//! (`EXTRACTOR_VERSION` 8), without the envelope keys `projectId`, `commit`
//! and `extractor`, which the System Builder reader adds (C4). Every rule, and
//! the digest's canonical text, is in
//! `native/contracts/prism/field-maps/system-interface.md`; the acceptance is
//! a byte-identical `digest` against `native/parity/goldens/<case>/system-interface.json`.
//!
//! The build reads each input once:
//!
//! - [`board`]: the board's pad nets by reference and pad, and each reference's
//!   footprint geometry (`_board_pad_nets`, `_board_geometry`);
//! - [`outline`]: `boardThicknessMm` and `boardOutlineMm`, with kicad_monkey's
//!   `KiCadPcb.get_bounds()` as the fallback (`_board_outline`);
//! - [`schematic`]: occurrences, the schematic netlist's pins, power nets,
//!   connector detection, the components and the diagnostics, joined with the
//!   board facts (`_occurrences`, `_schematic_pins`, `_power_net_names`, the
//!   component loop);
//! - [`canonical`]: the digest over the body.
//!
//! Numbers go through [`numbers::round4`] (`_round`) when they are made, so
//! the document holds exactly the floats today's payload holds.

mod board;
mod canonical;
mod detection;
mod numbers;
mod outline;
mod schematic;

use crate::{Produced, ProjectionError, ProjectionInput, document};
use prism_kicad_contracts::generated::prism_system_interface_v1::SystemInterfaceV1;
use serde_json::{Value, json};

/// The member's schema id.
pub const SCHEMA: &str = "prism.system_interface.v1";
const NAME: &str = "projections/system-interface.json";

/// Build `projections/system-interface.json` from the single parse of the revision.
pub fn produce(
    input: &ProjectionInput<'_>,
) -> Result<Produced<SystemInterfaceV1>, ProjectionError> {
    if input.schematic.is_none() && input.config.root_schematic.is_some() {
        return Err(ProjectionError::new(format!(
            "{NAME}: the schematic model could not be built"
        )));
    }
    // `hasPcb`: the configured board is a file (interface_extractor.py:380-382);
    // the bundle has a board model exactly then.
    let board = input.board;
    let facts = board.map(board::scan).transpose()?;
    let (thickness, outline) = match board {
        Some(board) => (outline::thickness(board)?, outline::outline(board)?),
        None => (None, None),
    };
    // A project without a schematic has no interface: zero components (the
    // field map's expected divergence; today's extractor raises).
    let (components, diagnostics) = match input.schematic {
        Some(schematic) => schematic::project(input, schematic, facts.as_ref())?,
        None => (Vec::new(), Vec::new()),
    };
    let mut body = json!({
        "schema": SCHEMA,
        "hasPcb": board.is_some(),
        "boardThicknessMm": thickness,
        "boardOutlineMm": outline,
        "components": components,
        "diagnostics": diagnostics,
    });
    check_numbers(&body)?;
    let digest = canonical::digest(&body);
    body["digest"] = Value::String(digest);
    document(NAME, body)
}

/// The field map's digest condition: every number is `0.0` or at least 1e-4 and
/// below 1e15 in magnitude, so Python's `repr` and [`crate::python::float`]
/// agree with no exponent form (field-maps/system-interface.md, "Digest").
fn check_numbers(value: &Value) -> Result<(), ProjectionError> {
    match value {
        Value::Number(number) => {
            let magnitude = number.as_f64().map_or(f64::NAN, f64::abs);
            if magnitude == 0.0 || (1e-4..1e15).contains(&magnitude) {
                Ok(())
            } else {
                Err(ProjectionError::new(format!(
                    "{NAME}: {number} is outside the digest's number range"
                )))
            }
        }
        Value::Array(items) => items.iter().try_for_each(check_numbers),
        Value::Object(map) => map.values().try_for_each(check_numbers),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_empty_form_decodes() {
        crate::test_support::with_bare_project(|input| {
            let produced = super::produce(input).unwrap();
            let value = serde_json::to_value(&produced.document).unwrap();
            assert_eq!(value["schema"], super::SCHEMA);
            assert_eq!(
                value["digest"],
                "sha256:078d43da554f61205b324187b389718ebb745b192fab985186952824f3f742c4"
            );
        });
    }
}
