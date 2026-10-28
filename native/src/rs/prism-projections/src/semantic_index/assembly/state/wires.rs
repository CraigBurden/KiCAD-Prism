//! The differential wires of the assembly state, a port of the default wires
//! and the variant diffs (semantic_index_variants.py:501-723): each variant
//! wire names only the occurrences, components and footprints whose effective
//! flags or fields differ from the default.

use super::super::variants::Fields;
use super::{
    ComponentState, FLAG_KEYS, FOOTPRINT_FLAG_KEYS, Flags, FootprintState, OccurrenceState,
};
use serde_json::{Map, Value, json};

/// `_differential_flags` (semantic_index_variants.py:501-508).
fn differential_flags(default: &Flags, variant: &Flags, keys: &[&str]) -> Map<String, Value> {
    let mut out = Map::new();
    for key in keys {
        let value = variant.value(key);
        if value != default.value(key) {
            out.insert((*key).to_owned(), Value::Bool(value));
        }
    }
    out
}

/// `_differential_fields` (semantic_index_variants.py:511-516).
fn differential_fields(default: &Fields, variant: &Fields) -> Map<String, Value> {
    let mut out = Map::new();
    for (name, value) in variant {
        if default.get(name) != Some(value) {
            out.insert(name.clone(), value.clone());
        }
    }
    out
}

/// `_default_occurrence_wire` (semantic_index_variants.py:646-651).
pub(super) fn default_occurrence_wire(state: &OccurrenceState) -> Option<Value> {
    let mut entry = Map::new();
    entry.insert("reference".to_owned(), json!(state.reference));
    for key in FLAG_KEYS {
        if state.flags.value(key) {
            entry.insert(key.to_owned(), Value::Bool(true));
        }
    }
    (entry.len() > 1).then(|| Value::Object(entry))
}

/// `_default_component_wire` (semantic_index_variants.py:654-656).
pub(super) fn default_component_wire(state: &ComponentState) -> Option<Value> {
    let mut entry = Map::new();
    for key in FLAG_KEYS {
        if state.flags.value(key) {
            entry.insert(key.to_owned(), Value::Bool(true));
        }
    }
    (!entry.is_empty()).then(|| Value::Object(entry))
}

/// `_default_footprint_wire` (semantic_index_variants.py:659-664).
pub(super) fn default_footprint_wire(state: &FootprintState) -> Option<Value> {
    let mut entry = Map::new();
    entry.insert("reference".to_owned(), json!(state.reference));
    let (dnp, exclude_from_bom, exclude_from_pos_files) = state.flags;
    for (key, value) in [
        ("dnp", dnp),
        ("excludeFromBom", exclude_from_bom),
        ("excludeFromPosFiles", exclude_from_pos_files),
    ] {
        if value {
            entry.insert(key.to_owned(), Value::Bool(true));
        }
    }
    (entry.len() > 1).then(|| Value::Object(entry))
}

/// `_variant_occurrence_wire` (semantic_index_variants.py:667-683).
pub(super) fn variant_occurrence_wire(
    default: &[(String, OccurrenceState)],
    variant: &[(String, OccurrenceState)],
) -> Value {
    let mut wire = Map::new();
    for (id, state) in variant {
        let Some(default_state) = default
            .iter()
            .find(|(candidate, _)| candidate == id)
            .map(|(_, state)| state)
        else {
            continue;
        };
        let flags = differential_flags(&default_state.flags, &state.flags, &FLAG_KEYS);
        let fields = differential_fields(&default_state.fields, &state.fields);
        if flags.is_empty() && fields.is_empty() {
            continue;
        }
        let mut entry = flags;
        if !fields.is_empty() {
            entry.insert("fields".to_owned(), Value::Object(fields));
        }
        wire.insert(id.clone(), Value::Object(entry));
    }
    Value::Object(wire)
}

/// `_variant_component_wire` (semantic_index_variants.py:686-702).
pub(super) fn variant_component_wire(
    default: &[(String, ComponentState)],
    variant: &[(String, ComponentState)],
) -> Value {
    let mut wire = Map::new();
    for (reference, state) in variant {
        let Some(default_state) = default
            .iter()
            .find(|(candidate, _)| candidate == reference)
            .map(|(_, state)| state)
        else {
            continue;
        };
        let flags = differential_flags(&default_state.flags, &state.flags, &FLAG_KEYS);
        let fields = differential_fields(&default_state.fields, &state.fields);
        if flags.is_empty() && fields.is_empty() {
            continue;
        }
        let mut entry = flags;
        if !fields.is_empty() {
            entry.insert("fields".to_owned(), Value::Object(fields));
        }
        wire.insert(reference.clone(), Value::Object(entry));
    }
    Value::Object(wire)
}

/// `_variant_footprint_wire` (semantic_index_variants.py:705-723).
pub(super) fn variant_footprint_wire(
    default: &[FootprintState],
    variant: &[FootprintState],
) -> Value {
    let mut wire = Map::new();
    for state in variant {
        let Some(default_state) = default
            .iter()
            .find(|candidate| candidate.uuid == state.uuid)
        else {
            continue;
        };
        let flags = differential_flags(
            &footprint_flags_to_flags(default_state.flags),
            &footprint_flags_to_flags(state.flags),
            &FOOTPRINT_FLAG_KEYS,
        );
        let fields = differential_fields(&default_state.fields, &state.fields);
        if flags.is_empty() && fields.is_empty() {
            continue;
        }
        let mut entry = flags;
        if !fields.is_empty() {
            entry.insert("fields".to_owned(), Value::Object(fields));
        }
        wire.insert(state.uuid.clone(), Value::Object(entry));
    }
    Value::Object(wire)
}

/// Present a footprint's three flags through the shared differential helper.
fn footprint_flags_to_flags(
    (dnp, exclude_from_bom, exclude_from_pos_files): (bool, bool, bool),
) -> Flags {
    Flags {
        dnp,
        exclude_from_bom,
        exclude_from_board: false,
        exclude_from_sim: false,
        exclude_from_pos_files,
    }
}
