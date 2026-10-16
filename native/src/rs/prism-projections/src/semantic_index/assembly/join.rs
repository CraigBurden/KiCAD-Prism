//! The join onto the index's `componentUid`s, a port of
//! `_project_onto_components` (semantic_index_variants.py:948-1037) and its
//! helpers `_translate_component_keys` (:906-913) and `_occurrence_id_for_ref`
//! (:916-945).
//!
//! The state builder keys components by reference; the index publishes
//! `componentUid`. A reference that resolves to exactly one index component is
//! rewritten; a reference the index carries more than once keeps the reference
//! key and gets a `reference-collision` diagnostic naming every candidate.

use crate::semantic_index::string;
use serde_json::{Map, Value, json};
use std::collections::BTreeSet;

/// `_project_onto_components(block, components, schematic_placements)`
/// (semantic_index_variants.py:948-1037). The component/schematicRef mutations
/// (`fields` `DNP`/`In BOM`, `schematicRefs[].occurrenceId`) belong to the
/// components pass, which already produces them; this port applies only the
/// assembly-block changes.
pub(super) fn project(block: &mut Value, components: &[Value]) {
    let references = ReferenceIndex::build(components);
    translate_keys(block, &references);
    stamp_identity(block, &references);
    append_collisions(block, &references);
    stamp_diagnostics(block, &references);
}

/// The index components grouped by reference, with the ambiguous and unique
/// sets the join needs (`siv:963-976`).
struct ReferenceIndex<'a> {
    grouped: Vec<(String, Vec<&'a Value>)>,
    ambiguous: BTreeSet<String>,
    unique: Vec<(String, String)>,
}

impl<'a> ReferenceIndex<'a> {
    fn build(components: &'a [Value]) -> Self {
        let mut grouped: Vec<(String, Vec<&Value>)> = Vec::new();
        for component in components {
            let reference = string(component.get("reference"));
            if reference.is_empty() {
                continue;
            }
            if let Some(entry) = grouped
                .iter_mut()
                .find(|(candidate, _)| candidate == &reference)
            {
                entry.1.push(component);
            } else {
                grouped.push((reference, vec![component]));
            }
        }
        let ambiguous = grouped
            .iter()
            .filter(|(_, entries)| entries.len() > 1)
            .map(|(reference, _)| reference.clone())
            .collect();
        let unique = grouped
            .iter()
            .filter(|(_, entries)| entries.len() == 1)
            .map(|(reference, entries)| (reference.clone(), string(entries[0].get("componentUid"))))
            .collect();
        Self {
            grouped,
            ambiguous,
            unique,
        }
    }

    fn unique_uid(&self, reference: &str) -> Option<String> {
        self.unique
            .iter()
            .find(|(candidate, _)| candidate == reference)
            .map(|(_, uid)| uid.clone())
    }

    fn component_uids(&self, reference: &str) -> Vec<String> {
        self.grouped
            .iter()
            .find(|(candidate, _)| candidate == reference)
            .map(|(_, entries)| {
                entries
                    .iter()
                    .map(|entry| string(entry.get("componentUid")))
                    .collect()
            })
            .unwrap_or_default()
    }
}

/// `_translate_component_keys` over the default and every variant map
/// (`siv:978-985`).
fn translate_keys(block: &mut Value, references: &ReferenceIndex<'_>) {
    if let Some(default) = block.get_mut("default").and_then(Value::as_object_mut)
        && let Some(states) = default
            .get("components")
            .and_then(Value::as_object)
            .cloned()
    {
        default.insert(
            "components".to_owned(),
            Value::Object(translate(&states, references)),
        );
    }
    if let Some(variants) = block.get_mut("variants").and_then(Value::as_array_mut) {
        for variant in variants {
            let Some(object) = variant.as_object_mut() else {
                continue;
            };
            let Some(states) = object.get("components").and_then(Value::as_object).cloned() else {
                continue;
            };
            object.insert(
                "components".to_owned(),
                Value::Object(translate(&states, references)),
            );
        }
    }
}

/// Stamp `componentUid` on the default occurrences and footprints
/// (`siv:987-995`).
fn stamp_identity(block: &mut Value, references: &ReferenceIndex<'_>) {
    let Some(default) = block.get_mut("default").and_then(Value::as_object_mut) else {
        return;
    };
    if let Some(occurrences) = default
        .get_mut("occurrences")
        .and_then(Value::as_object_mut)
    {
        for entry in occurrences.values_mut() {
            let reference = string(entry.get("reference"));
            if let Some(uid) = references.unique_uid(&reference)
                && let Some(object) = entry.as_object_mut()
            {
                object.insert("componentUid".to_owned(), json!(uid));
            }
        }
    }
    if let Some(footprints) = default.get_mut("footprints").and_then(Value::as_object_mut) {
        for entry in footprints.values_mut() {
            let reference = string(entry.get("reference"));
            let uid = references
                .unique_uid(&reference)
                .map_or(Value::Null, |uid| json!(uid));
            if let Some(object) = entry.as_object_mut() {
                object.insert("componentUid".to_owned(), uid);
            }
        }
    }
}

/// The `reference-collision` diagnostics for ambiguous references not already
/// reported by the assembly state (`siv:1011-1030`).
fn append_collisions(block: &mut Value, references: &ReferenceIndex<'_>) {
    let diagnosed = block
        .get("diagnostics")
        .and_then(Value::as_array)
        .map(|diagnostics| {
            diagnostics
                .iter()
                .map(|diagnostic| {
                    (
                        string(diagnostic.get("code")),
                        string(diagnostic.get("reference")),
                    )
                })
                .collect::<BTreeSet<_>>()
        })
        .unwrap_or_default();
    let collisions = references
        .ambiguous
        .iter()
        .filter(|reference| {
            !diagnosed.contains(&("reference-collision".to_owned(), (*reference).clone()))
        })
        .map(|reference| {
            json!({
                "code": "reference-collision",
                "severity": "warning",
                "reference": reference,
                "message": "Several index components share this reference; no single join exists.",
                "detail": {"componentUids": references.component_uids(reference)},
            })
        })
        .collect::<Vec<_>>();
    if !collisions.is_empty()
        && let Some(diagnostics) = block.get_mut("diagnostics").and_then(Value::as_array_mut)
    {
        diagnostics.extend(collisions);
    }
}

/// Stamp `componentUid` on diagnostics with a unique reference
/// (`siv:1031-1037`).
fn stamp_diagnostics(block: &mut Value, references: &ReferenceIndex<'_>) {
    let Some(diagnostics) = block.get_mut("diagnostics").and_then(Value::as_array_mut) else {
        return;
    };
    for diagnostic in diagnostics.iter_mut() {
        let reference = string(diagnostic.get("reference"));
        if reference.is_empty() || references.ambiguous.contains(&reference) {
            continue;
        }
        if let Some(uid) = references.unique_uid(&reference)
            && let Some(object) = diagnostic.as_object_mut()
            && !object.contains_key("componentUid")
        {
            object.insert("componentUid".to_owned(), json!(uid));
        }
    }
}

/// `_translate_component_keys` (semantic_index_variants.py:906-913).
fn translate(states: &Map<String, Value>, references: &ReferenceIndex<'_>) -> Map<String, Value> {
    let mut translated = Map::new();
    for (reference, state) in states {
        let key = references
            .unique_uid(reference)
            .unwrap_or_else(|| reference.clone());
        translated.insert(key, state.clone());
    }
    translated
}

#[cfg(test)]
mod tests {
    use super::*;

    fn component(reference: &str, uid: &str) -> Value {
        json!({"reference": reference, "componentUid": uid})
    }

    /// Two index components share a reference: the reference key survives and a
    /// `reference-collision` diagnostic names every candidate
    /// (semantic_index_variants.py:1015-1030).
    #[test]
    fn ambiguous_reference_keeps_the_key_and_diagnoses() {
        let mut block = json!({
            "default": {"components": {"R1": {"dnp": true}}, "occurrences": {}, "footprints": {}},
            "variants": [{"name": "Lite", "components": {"R1": {"dnp": false}}}],
            "diagnostics": [],
        });
        let components = vec![component("R1", "cmp:a"), component("R1", "cmp:b")];
        project(&mut block, &components);
        assert_eq!(block["default"]["components"]["R1"], json!({"dnp": true}));
        assert_eq!(
            block["variants"][0]["components"]["R1"],
            json!({"dnp": false})
        );
        let diagnostics = block["diagnostics"].as_array().unwrap();
        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0]["code"], "reference-collision");
        assert_eq!(
            diagnostics[0]["detail"]["componentUids"],
            json!(["cmp:a", "cmp:b"])
        );
    }

    /// A unique reference rewrites the key and stamps the occurrence and
    /// footprint componentUid (semantic_index_variants.py:978-995).
    #[test]
    fn unique_reference_translates_and_stamps() {
        let mut block = json!({
            "default": {
                "components": {"R1": {"dnp": true}},
                "occurrences": {"p/r1": {"reference": "R1", "dnp": true}},
                "footprints": {"u1": {"reference": "R1", "dnp": true}},
            },
            "variants": [],
            "diagnostics": [],
        });
        project(&mut block, &[component("R1", "cmp:a")]);
        assert_eq!(
            block["default"]["components"]["cmp:a"],
            json!({"dnp": true})
        );
        assert_eq!(
            block["default"]["occurrences"]["p/r1"]["componentUid"],
            json!("cmp:a")
        );
        assert_eq!(
            block["default"]["footprints"]["u1"]["componentUid"],
            json!("cmp:a")
        );
    }

    /// A footprint reference with no unique index component gets an explicit
    /// `null` (`siv:992-995`).
    #[test]
    fn unknown_footprint_reference_gets_null_component_uid() {
        let mut block = json!({
            "default": {
                "components": {},
                "occurrences": {},
                "footprints": {"u9": {"reference": "J9"}},
            },
            "variants": [],
            "diagnostics": [],
        });
        project(&mut block, &[]);
        assert_eq!(
            block["default"]["footprints"]["u9"]["componentUid"],
            Value::Null
        );
    }
}
