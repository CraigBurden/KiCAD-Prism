//! The diff's classifiers and property deltas (`ecad-diff.mjs:32-46`,
//! `:188-336`).
//!
//! `same_index_fields` compares the index fields with the reference's
//! `?? null` folding (parity trap T7); the classifier order is the reference's
//! `CLASSIFIERS` order.

use super::entry::{Entry, Property};
use super::json::{self, Point};
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet};

/// The review fields whose change is not by itself a `properties-changed`
/// reason (`ecad-diff.mjs:48-57`).
const CLASSIFIED_REVIEW_FIELDS: [&str; 8] = [
    "Position",
    "Rotation",
    "Mirror",
    "Layer",
    "Net",
    "Reference",
    "Library",
    "DNP",
];

/// One delta of `changes[*].properties`. A review-field delta carries only
/// `name`, `from` and `to`; a property delta also carries its attributes
/// (`ecad-diff.mjs:238-279`, `:298-309`).
#[derive(Clone, Debug)]
pub struct MergedDelta {
    /// The property or review-field name.
    pub name: String,
    /// The base value.
    pub from: Option<Value>,
    /// The head value.
    pub to: Option<Value>,
    /// True when a property present on both sides only moved or was hidden.
    pub attributes_changed: bool,
    /// The base property's attributes.
    pub from_attributes: Option<Value>,
    /// The head property's attributes.
    pub to_attributes: Option<Value>,
}

/// The `CLASSIFIERS` reasons of a modified object, in report order
/// (`ecad-diff.mjs:32-46`, `:415-417`).
pub fn classify(before: &Entry, after: &Entry) -> Vec<&'static str> {
    let mut reasons = Vec::new();
    if !same_point(before.at, after.at) {
        reasons.push("moved");
    }
    if before.rotation.unwrap_or(0.0) != after.rotation.unwrap_or(0.0) {
        reasons.push("rotated");
    }
    if before.mirror != after.mirror {
        reasons.push("mirrored");
    }
    if before.layer != after.layer {
        reasons.push("layer-changed");
    }
    if before.net != after.net {
        reasons.push("net-changed");
    }
    if before.refdes != after.refdes {
        reasons.push("renamed");
    }
    if before.lib_id != after.lib_id {
        reasons.push("lib-changed");
    }
    if before.dnp.unwrap_or(false) != after.dnp.unwrap_or(false) {
        reasons.push("dnp-changed");
    }
    if before.kiid_paths.clone().unwrap_or_default() != after.kiid_paths.clone().unwrap_or_default()
    {
        reasons.push("re-pathed");
    }
    reasons
}

/// `same_index_fields` (`ecad-diff.mjs:188-192`): every `INDEX_FIELDS` entry
/// compares equal after the reference's `?? null`. `T4` documents why the
/// reference's key-order-sensitive `JSON.stringify` and our value equality
/// agree: both sides come from one producer.
pub fn same_index_fields(before: &Entry, after: &Entry) -> bool {
    same_identity_fields(before, after)
        && same_placement_fields(before, after)
        && same_flag_fields(before, after)
        && same_content_fields(before, after)
}

fn same_identity_fields(before: &Entry, after: &Entry) -> bool {
    before.kind == after.kind
        && before.parent_uuid == after.parent_uuid
        && before.at == after.at
        && before.rotation == after.rotation
        && before.mirror == after.mirror
}

fn same_placement_fields(before: &Entry, after: &Entry) -> bool {
    before.layer == after.layer
        && before.net == after.net
        && before.refdes == after.refdes
        && before.lib_id == after.lib_id
        && before.dnp == after.dnp
}

fn same_flag_fields(before: &Entry, after: &Entry) -> bool {
    before.in_bom == after.in_bom
        && before.on_board == after.on_board
        && before.kiid_paths == after.kiid_paths
        && before.instances == after.instances
        && before.properties == after.properties
}

fn same_content_fields(before: &Entry, after: &Entry) -> bool {
    before.number == after.number
        && before.text == after.text
        && before.name == after.name
        && before.review_fields == after.review_fields
        && before.review_only == after.review_only
}

/// `review_field_deltas` (`ecad-diff.mjs:298-309`), sorted by `name` (D2).
pub fn review_field_deltas(before: Option<&Entry>, after: Option<&Entry>) -> Vec<MergedDelta> {
    let empty = BTreeMap::new();
    let old = before.map_or(&empty, |entry| &entry.combined_review_fields);
    let new = after.map_or(&empty, |entry| &entry.combined_review_fields);
    let names: BTreeSet<&String> = old.keys().chain(new.keys()).collect();
    let mut deltas = Vec::new();
    for name in names {
        let from = old.get(name);
        let to = new.get(name);
        if option_value_eq(from, to) {
            continue;
        }
        deltas.push(MergedDelta {
            name: name.clone(),
            from: from.cloned(),
            to: to.cloned(),
            attributes_changed: false,
            from_attributes: None,
            to_attributes: None,
        });
    }
    deltas
}

/// `merged_property_deltas` (`ecad-diff.mjs:311-320`): review-field deltas and
/// property deltas merged by name (a property delta wins), sorted by name (D2).
pub fn merged_property_deltas(before: &Entry, after: &Entry) -> Vec<MergedDelta> {
    let mut by_name: BTreeMap<String, MergedDelta> = BTreeMap::new();
    for delta in review_field_deltas(Some(before), Some(after)) {
        by_name.insert(delta.name.clone(), delta);
    }
    for delta in property_deltas(before, after) {
        by_name.insert(delta.name.clone(), delta);
    }
    by_name.into_values().collect()
}

/// Whether a merged delta list is a `properties-changed` reason
/// (`ecad-diff.mjs:419-423`).
pub fn properties_changed(deltas: &[MergedDelta]) -> bool {
    deltas
        .iter()
        .any(|delta| delta.attributes_changed || !is_classified(&delta.name))
}

fn is_classified(name: &str) -> bool {
    CLASSIFIED_REVIEW_FIELDS.contains(&name)
}

fn property_deltas(before: &Entry, after: &Entry) -> Vec<MergedDelta> {
    let before_by_name = by_name(&before.properties);
    let after_by_name = by_name(&after.properties);
    let names: BTreeSet<&str> = before_by_name
        .keys()
        .chain(after_by_name.keys())
        .copied()
        .collect();
    let mut deltas = Vec::new();
    for name in names {
        let from = before_by_name.get(name).copied();
        let to = after_by_name.get(name).copied();
        if from == to {
            continue;
        }
        let from_attributes = from.map(attributes_value);
        let to_attributes = to.map(attributes_value);
        deltas.push(MergedDelta {
            name: name.to_owned(),
            from: from.map(|property| Value::from(property.value.clone())),
            to: to.map(|property| Value::from(property.value.clone())),
            attributes_changed: from.is_some() && to.is_some() && from_attributes != to_attributes,
            from_attributes,
            to_attributes,
        });
    }
    deltas
}

fn by_name(properties: &Option<Vec<Property>>) -> BTreeMap<&str, &Property> {
    let mut map = BTreeMap::new();
    if let Some(properties) = properties {
        for property in properties {
            map.insert(property.name.as_str(), property);
        }
    }
    map
}

fn attributes_value(property: &Property) -> Value {
    let mut map = Map::new();
    if let Some(at) = property.at {
        json::set(&mut map, "at", json::point(at));
    }
    if let Some(rotation) = property.rotation {
        json::set(&mut map, "rotation", json::number(rotation));
    }
    json::set(&mut map, "hide", Value::from(property.hide));
    if let Some(effects) = &property.effects {
        json::set(&mut map, "effects", effects.clone());
    }
    Value::Object(map)
}

fn option_value_eq(left: Option<&Value>, right: Option<&Value>) -> bool {
    match (left, right) {
        (None, None) => true,
        (Some(left), Some(right)) => left == right,
        _ => false,
    }
}

/// `same_point` (`ecad-diff.mjs:86-91`).
fn same_point(before: Option<Point>, after: Option<Point>) -> bool {
    match (before, after) {
        (Some(before), Some(after)) => before[0] == after[0] && before[1] == after[1],
        (None, None) => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compare::entry::build;
    use serde_json::json;

    fn entry(overrides: Value) -> Entry {
        let mut object = json!({
            "kind": "pad",
            "uuid": "u",
            "contentDigest": "d",
        });
        let map = object.as_object_mut().unwrap();
        for (key, value) in overrides.as_object().unwrap() {
            map.insert(key.clone(), value.clone());
        }
        let member = json!({
            "schema": "prism.board_objects.a0",
            "documents": [{"path": "d.kicad_pcb", "objects": [object], "reviewOnlyObjects": []}]
        });
        build(&member, "").unwrap().remove(0)
    }

    #[test]
    fn each_classifier_reason() {
        assert_eq!(
            classify(
                &entry(json!({})),
                &entry(json!({"at": {"xNm": 1000000, "yNm": 0}}))
            ),
            vec!["moved"]
        );
        assert_eq!(
            classify(&entry(json!({})), &entry(json!({"rotationDeg": 90.0}))),
            vec!["rotated"]
        );
        assert_eq!(
            classify(&entry(json!({})), &entry(json!({"mirror": "x"}))),
            vec!["mirrored"]
        );
        assert_eq!(
            classify(&entry(json!({})), &entry(json!({"layer": "F.Cu"}))),
            vec!["layer-changed"]
        );
        assert_eq!(
            classify(&entry(json!({})), &entry(json!({"net": "GND"}))),
            vec!["net-changed"]
        );
        assert_eq!(
            classify(&entry(json!({})), &entry(json!({"refdes": "J1"}))),
            vec!["renamed"]
        );
        assert_eq!(
            classify(&entry(json!({})), &entry(json!({"libId": "L:X"}))),
            vec!["lib-changed"]
        );
        assert_eq!(
            classify(&entry(json!({"dnp": false})), &entry(json!({"dnp": true}))),
            vec!["dnp-changed"]
        );
        assert_eq!(
            classify(
                &entry(json!({"footprintPath": "/a"})),
                &entry(json!({"footprintPath": "/b"}))
            ),
            vec!["re-pathed"]
        );
        // No classifier fires: the caller then uses `content-changed`.
        assert!(classify(&entry(json!({})), &entry(json!({"contentDigest": "e"}))).is_empty());
    }

    #[test]
    fn properties_changed_uses_the_reference_rule() {
        // A non-classified review-field name is a reason.
        let before = entry(json!({"refdes": "J1", "reviewFields": {"Pad number": "1"}}));
        let after = entry(json!({"refdes": "J1", "reviewFields": {"Pad number": "2"}}));
        let deltas = merged_property_deltas(&before, &after);
        assert!(properties_changed(&deltas));
        // A classified review field alone is not.
        let before = entry(json!({"net": "A"}));
        let after = entry(json!({"net": "B"}));
        let deltas = merged_property_deltas(&before, &after);
        assert!(!properties_changed(&deltas));
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].name, "Net");
    }
}
