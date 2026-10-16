//! The component projection of the assembly state, a port of
//! `_project_components` (semantic_index_variants.py:384-457): the occurrence
//! states grouped by reference, the reference-collision and multi-unit-conflict
//! diagnostics, and the agreed component flags and fields.

use super::super::variants::Fields;
use super::{ComponentState, FLAG_KEYS, Flags, OccurrenceState};
use serde_json::{Map, Value, json};
use std::collections::{BTreeSet, HashSet};

/// `_project_components` (semantic_index_variants.py:384-457).
pub(super) fn project_components(
    occurrences: &[OccurrenceState],
    variant_name: Option<&str>,
    diagnostics: &mut Vec<Value>,
) -> Vec<(String, ComponentState)> {
    let mut components = Vec::new();
    for (reference, members) in group_by_reference(occurrences) {
        push_reference_collision(&reference, &members, variant_name, diagnostics);

        let first_sheet = members
            .iter()
            .map(|member| member.sheet_order)
            .min()
            .unwrap_or(0);
        let representative = members
            .iter()
            .filter(|member| member.sheet_order == first_sheet)
            .min_by(|left, right| left.symbol_uuid.cmp(&right.symbol_uuid))
            .copied()
            .expect("a grouped reference has at least one member");

        let mut detail = Map::new();
        let flags = component_flags(&members, representative, &mut detail);
        let fields = component_fields(&members, representative, &mut detail);
        if !detail.is_empty() {
            push_multi_unit_conflict(&reference, detail, variant_name, diagnostics);
        }
        components.push((reference, ComponentState { flags, fields }));
    }
    components
}

/// The occurrence states grouped by reference, in first-seen order
/// (`siv:391-393`).
fn group_by_reference(occurrences: &[OccurrenceState]) -> Vec<(String, Vec<&OccurrenceState>)> {
    let mut grouped: Vec<(String, Vec<&OccurrenceState>)> = Vec::new();
    for occurrence in occurrences {
        if let Some(entry) = grouped
            .iter_mut()
            .find(|(reference, _)| reference == &occurrence.reference)
        {
            entry.1.push(occurrence);
        } else {
            grouped.push((occurrence.reference.clone(), vec![occurrence]));
        }
    }
    grouped
}

/// `reference-collision` when a reference spans more than one sheet occurrence
/// (`siv:397-411`).
fn push_reference_collision(
    reference: &str,
    members: &[&OccurrenceState],
    variant_name: Option<&str>,
    diagnostics: &mut Vec<Value>,
) {
    let sheets: HashSet<&str> = members
        .iter()
        .map(|member| member.sheet_instance_path.as_str())
        .collect();
    if sheets.len() <= 1 {
        return;
    }
    let mut ids = members
        .iter()
        .map(|member| member.occurrence_id.clone())
        .collect::<Vec<_>>();
    ids.sort();
    let mut collision = Map::new();
    collision.insert("code".to_owned(), json!("reference-collision"));
    collision.insert("severity".to_owned(), json!("warning"));
    collision.insert("reference".to_owned(), json!(reference));
    collision.insert(
        "message".to_owned(),
        json!("One reference appears on more than one sheet occurrence."),
    );
    collision.insert("detail".to_owned(), json!({ "occurrenceIds": ids }));
    if let Some(variant_name) = variant_name {
        collision.insert("variant".to_owned(), json!(variant_name));
    }
    diagnostics.push(Value::Object(collision));
}

/// The component flags: agreement keeps the value, disagreement keeps the
/// representative's and records the per-occurrence values (`siv:419-427`).
fn component_flags(
    members: &[&OccurrenceState],
    representative: &OccurrenceState,
    detail: &mut Map<String, Value>,
) -> Flags {
    let mut flags = Flags {
        dnp: false,
        exclude_from_bom: false,
        exclude_from_board: false,
        exclude_from_sim: false,
        exclude_from_pos_files: false,
    };
    for key in FLAG_KEYS {
        let values = members
            .iter()
            .map(|member| {
                (
                    member.occurrence_id.clone(),
                    Value::Bool(member.flags.value(key)),
                )
            })
            .collect::<Map<_, _>>();
        let distinct: BTreeSet<bool> = values.values().filter_map(Value::as_bool).collect();
        let value = if distinct.len() == 1 {
            *distinct.iter().next().unwrap_or(&false)
        } else {
            detail.insert(key.to_owned(), Value::Object(values));
            representative.flags.value(key)
        };
        set_flag(&mut flags, key, value);
    }
    flags
}

/// The component fields: agreement keeps the value, disagreement keeps the
/// representative's and records the per-occurrence values (`siv:429-440`).
fn component_fields(
    members: &[&OccurrenceState],
    representative: &OccurrenceState,
    detail: &mut Map<String, Value>,
) -> Fields {
    let mut field_names = BTreeSet::new();
    for member in members {
        for name in member.fields.keys() {
            field_names.insert(name.clone());
        }
    }
    let mut fields = Fields::new();
    for name in field_names {
        let values = members
            .iter()
            .map(|member| {
                (
                    member.occurrence_id.clone(),
                    member
                        .fields
                        .get(&name)
                        .cloned()
                        .unwrap_or_else(|| Value::String(String::new())),
                )
            })
            .collect::<Map<_, _>>();
        let mut distinct = values.values();
        let first = distinct.next();
        if distinct.all(|value| Some(value) == first) {
            fields.insert(
                name,
                first
                    .cloned()
                    .unwrap_or_else(|| Value::String(String::new())),
            );
        } else {
            fields.insert(
                name.clone(),
                representative
                    .fields
                    .get(&name)
                    .cloned()
                    .unwrap_or_else(|| Value::String(String::new())),
            );
            detail.insert(name, Value::Object(values));
        }
    }
    fields
}

/// `multi-unit-conflict` when any flag or field disagreed (`siv:442-452`).
fn push_multi_unit_conflict(
    reference: &str,
    detail: Map<String, Value>,
    variant_name: Option<&str>,
    diagnostics: &mut Vec<Value>,
) {
    let mut conflict = Map::new();
    conflict.insert("code".to_owned(), json!("multi-unit-conflict"));
    conflict.insert("severity".to_owned(), json!("warning"));
    conflict.insert("reference".to_owned(), json!(reference));
    conflict.insert(
        "message".to_owned(),
        json!("Units disagree; the representative unit's value is used."),
    );
    conflict.insert("detail".to_owned(), Value::Object(detail));
    if let Some(variant_name) = variant_name {
        conflict.insert("variant".to_owned(), json!(variant_name));
    }
    diagnostics.push(Value::Object(conflict));
}

fn set_flag(flags: &mut Flags, key: &str, value: bool) {
    match key {
        "dnp" => flags.dnp = value,
        "excludeFromBom" => flags.exclude_from_bom = value,
        "excludeFromBoard" => flags.exclude_from_board = value,
        "excludeFromSim" => flags.exclude_from_sim = value,
        "excludeFromPosFiles" => flags.exclude_from_pos_files = value,
        _ => {}
    }
}
