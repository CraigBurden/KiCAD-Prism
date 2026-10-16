//! The stackup producer's derived aggregates.
//!
//! Ports `stackup_build.py:222-241` (`copperLayers`, rule 7; `stackThicknessNm`,
//! rule 8; `maskColors`) and the exact integer thickness sum of `:230-235`.

use super::records::Layer;
use super::tree::{py_list_repr, warning};
use crate::ProducerWarning;
use serde_json::{Map, Value, json};

/// `copperLayers` (`stackup_build.py:222-228`, rule 7).
pub(super) fn copper_layers(
    present: bool,
    layers: &[Layer],
    table_copper: &[String],
    warnings: &mut Vec<ProducerWarning>,
    board_path: &str,
) -> Vec<String> {
    if !present {
        return table_copper.to_vec();
    }
    let copper: Vec<String> = layers
        .iter()
        .filter(|layer| layer.kind == "copper")
        .map(|layer| layer.name.clone())
        .collect();
    if copper != table_copper {
        warnings.push(warning(
            board_path,
            "stackup-copper-mismatch",
            format!(
                "stackup copper {} differs from the layer table's {}",
                py_list_repr(&copper),
                py_list_repr(table_copper)
            ),
        ));
    }
    copper
}

/// `stackThicknessNm` (`stackup_build.py:230-235`, rule 8).
pub(super) fn stack_thickness(present: bool, layers: &[Layer]) -> Option<u64> {
    if !present {
        return None;
    }
    let physical: Vec<&Layer> = layers
        .iter()
        .filter(|layer| matches!(layer.kind, "copper" | "dielectric" | "soldermask"))
        .collect();
    if physical.is_empty() {
        return None;
    }
    sum_thickness(&physical)
}

/// `maskColors` (`stackup_build.py:237-241`).
pub(super) fn mask_colors(layers: &[Layer]) -> Map<String, Value> {
    let mut mask = Map::new();
    for (side, name) in [("front", "F.Mask"), ("back", "B.Mask")] {
        let entry = layers
            .iter()
            .find(|layer| layer.name == name && layer.sublayer == 0);
        if let Some(color) = entry.and_then(|entry| entry.color.as_ref()) {
            mask.insert(side.to_owned(), json!(color));
        }
    }
    mask
}

/// The exact integer sum of `thicknessNm` over `physical`, or `None` when any
/// entry has none (`stackup_build.py:230-235`, rule 8).
fn sum_thickness(physical: &[&Layer]) -> Option<u64> {
    let mut total = 0u64;
    for layer in physical {
        total = total.checked_add(layer.thickness_nm?)?;
    }
    Some(total)
}
