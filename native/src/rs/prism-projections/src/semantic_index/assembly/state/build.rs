//! The assembly state entry point and its default maps, a port of
//! `build_assembly_state` (semantic_index_variants.py:752-903): the catalog's
//! variant names drive the per-variant occurrence states, component states and
//! footprints, which are diffed against the default maps.

use super::super::variants::{self, FootprintInput};
use super::components::project_components;
use super::diagnostics::{board_diagnostics, source_diagnostics, source_state_mismatches};
use super::footprints::{board_footprints, footprint_states};
use super::wires::{
    default_component_wire, default_footprint_wire, default_occurrence_wire,
    variant_component_wire, variant_footprint_wire, variant_occurrence_wire,
};
use super::{
    ComponentState, FootprintState, Graph, OccurrenceState, SCHEMA, occurrence_states,
    variant_occurrence_states,
};
use crate::{ProjectionError, ProjectionInput, SchematicModel};
use serde_json::{Map, Value, json};
use std::collections::HashMap;
use std::sync::Arc;

/// Build the pre-join assembly block `build_assembly_state` returns
/// (semantic_index_variants.py:752-903). Catalog diagnostics are prepended by
/// the caller (`assemble_semantic_index`, :1067-1069).
pub(crate) fn build(
    input: &ProjectionInput<'_>,
    schematic: &SchematicModel<'_>,
    catalog: &[Value],
) -> Result<Value, ProjectionError> {
    let graph = Graph::new(schematic);
    let mut cache: HashMap<String, Vec<Vec<variants::SheetInstance>>> = HashMap::new();

    let variant_names = catalog_variant_names(catalog);
    let (occurrences, occurrence_diagnostics) = occurrence_states(input, &graph, &mut cache);
    let mut diagnostics = source_diagnostics(input, &graph);
    diagnostics.extend(board_diagnostics(input));
    diagnostics.extend(occurrence_diagnostics);

    let components = project_components(&occurrences, None, &mut diagnostics);
    let footprint_inputs = board_footprints(input)?;
    let defaults = Defaults::new(&occurrences, &components, footprint_inputs);
    let (default_occurrences, default_components, default_footprints) = default_maps(&defaults);

    let (variants, alternate_diagnostics, mut mismatch_diagnostics) = variant_section(
        input,
        &graph,
        &mut cache,
        &variant_names,
        &defaults,
        &mut diagnostics,
    );
    push_duplicate_reference_diagnostics(&defaults, &mut diagnostics);
    diagnostics.extend(alternate_diagnostics);
    source_state_mismatches(
        &defaults.components,
        &defaults.groups.by_reference,
        None,
        &mut mismatch_diagnostics,
    );
    diagnostics.extend(mismatch_diagnostics);

    let footprint_inventory = defaults
        .footprints
        .iter()
        .map(|state| json!({"uuid": state.uuid, "reference": state.reference}))
        .collect::<Vec<_>>();

    Ok(json!({
        "schema": SCHEMA,
        "catalog": catalog,
        "footprintInventory": footprint_inventory,
        "default": {
            "occurrences": Value::Object(default_occurrences),
            "components": Value::Object(default_components),
            "footprints": Value::Object(default_footprints),
        },
        "variants": variants,
        "diagnostics": diagnostics,
    }))
}

/// The catalog's variant names, in catalog order (`siv:763-766`).
fn catalog_variant_names(catalog: &[Value]) -> Vec<String> {
    catalog
        .iter()
        .filter_map(|entry| entry.get("name").and_then(Value::as_str))
        .map(str::to_owned)
        .collect()
}

/// The default state the variant blocks diff against (`siv:791-811`): the
/// occurrence, component and footprint states, plus the footprints grouped by
/// reference.
struct Defaults {
    occurrences: Vec<(String, OccurrenceState)>,
    components: Vec<(String, ComponentState)>,
    footprint_inputs: Arc<[FootprintInput]>,
    footprints: Vec<FootprintState>,
    groups: FootprintGroups,
}

impl Defaults {
    fn new(
        occurrences: &[OccurrenceState],
        components: &[(String, ComponentState)],
        footprint_inputs: Arc<[FootprintInput]>,
    ) -> Self {
        let footprints = footprint_states(&footprint_inputs, None);
        let groups = FootprintGroups::new(&footprints);
        Self {
            occurrences: occurrences
                .iter()
                .map(|state| (state.occurrence_id.clone(), state.clone()))
                .collect(),
            components: components.to_vec(),
            footprint_inputs,
            footprints,
            groups,
        }
    }
}

/// The default footprints grouped by reference, with the references that
/// repeat (`siv:809-811`).
struct FootprintGroups {
    by_reference: Vec<(String, Vec<FootprintState>)>,
    duplicates: Vec<String>,
}

impl FootprintGroups {
    fn new(footprints: &[FootprintState]) -> Self {
        let by_reference = group_footprints_by_reference(footprints);
        let duplicates = by_reference
            .iter()
            .filter(|(_, group)| group.len() > 1)
            .map(|(reference, _)| reference.clone())
            .collect();
        Self {
            by_reference,
            duplicates,
        }
    }
}

/// The three differential default maps (`siv:791-806`).
fn default_maps(
    defaults: &Defaults,
) -> (Map<String, Value>, Map<String, Value>, Map<String, Value>) {
    let mut default_occurrences = Map::new();
    for (id, state) in &defaults.occurrences {
        if let Some(wire) = default_occurrence_wire(state) {
            default_occurrences.insert(id.clone(), wire);
        }
    }
    let mut default_components = Map::new();
    for (reference, state) in &defaults.components {
        if let Some(wire) = default_component_wire(state) {
            default_components.insert(reference.clone(), wire);
        }
    }
    let mut default_footprints = Map::new();
    for state in &defaults.footprints {
        if let Some(wire) = default_footprint_wire(state) {
            default_footprints.insert(state.uuid.clone(), wire);
        }
    }
    (default_occurrences, default_components, default_footprints)
}

/// Footprint states grouped by reference, in board order (`siv:809-811`).
fn group_footprints_by_reference(
    footprints: &[FootprintState],
) -> Vec<(String, Vec<FootprintState>)> {
    let mut grouped: Vec<(String, Vec<FootprintState>)> = Vec::new();
    for state in footprints {
        if let Some(entry) = grouped
            .iter_mut()
            .find(|(reference, _)| reference == &state.reference)
        {
            entry.1.push(state.clone());
        } else {
            grouped.push((state.reference.clone(), vec![state.clone()]));
        }
    }
    grouped
}

/// The per-variant blocks and their diagnostics (`siv:834-866`).
fn variant_section(
    input: &ProjectionInput<'_>,
    graph: &Graph<'_>,
    cache: &mut HashMap<String, Vec<Vec<variants::SheetInstance>>>,
    variant_names: &[String],
    defaults: &Defaults,
    diagnostics: &mut Vec<Value>,
) -> (Vec<Value>, Vec<Value>, Vec<Value>) {
    let mut variants = Vec::new();
    let mut alternate_diagnostics = Vec::new();
    let mut mismatch_diagnostics = Vec::new();
    for variant_name in variant_names {
        let occurrence_states = variant_occurrence_states(input, graph, variant_name, cache);
        let state_list = occurrence_states
            .iter()
            .map(|(_, state)| state.clone())
            .collect::<Vec<_>>();
        let variant_components = project_components(&state_list, Some(variant_name), diagnostics);
        let variant_footprints = footprint_states(&defaults.footprint_inputs, Some(variant_name));
        let variant_by_uuid = variant_footprints
            .iter()
            .map(|state| (state.uuid.clone(), state))
            .collect::<HashMap<_, _>>();

        variants.push(variant_entry(
            variant_name,
            &defaults.occurrences,
            &occurrence_states,
            &defaults.components,
            &variant_components,
            &defaults.footprints,
            &variant_footprints,
        ));
        alternate_diagnostics.extend(alternate_diagnostics_for(
            variant_name,
            &defaults.groups.duplicates,
            &defaults.groups.by_reference,
            &variant_by_uuid,
        ));
        source_state_mismatches(
            &variant_components,
            &group_footprints_by_reference(&variant_footprints),
            Some(variant_name),
            &mut mismatch_diagnostics,
        );
    }
    (variants, alternate_diagnostics, mismatch_diagnostics)
}

/// One entry of `variants` (`siv:834-848`).
fn variant_entry(
    name: &str,
    default_by_occurrence: &[(String, OccurrenceState)],
    occurrence_states: &[(String, OccurrenceState)],
    components: &[(String, ComponentState)],
    variant_components: &[(String, ComponentState)],
    footprints: &[FootprintState],
    variant_footprints: &[FootprintState],
) -> Value {
    json!({
        "name": name,
        "occurrences": variant_occurrence_wire(default_by_occurrence, occurrence_states),
        "components": variant_component_wire(components, variant_components),
        "footprints": variant_footprint_wire(footprints, variant_footprints),
    })
}

/// `alternate-footprints-both-populated` for one variant (`siv:850-866`).
fn alternate_diagnostics_for(
    variant_name: &str,
    duplicate_references: &[String],
    footprints_by_reference: &[(String, Vec<FootprintState>)],
    variant_by_uuid: &HashMap<String, &FootprintState>,
) -> Vec<Value> {
    let mut diagnostics = Vec::new();
    for reference in duplicate_references {
        let group = footprints_by_reference
            .iter()
            .find(|(candidate, _)| candidate == reference)
            .map(|(_, group)| group)
            .expect("duplicate reference has a group");
        let populated = group
            .iter()
            .filter(|state| {
                variant_by_uuid
                    .get(&state.uuid)
                    .is_none_or(|variant| !variant.flags.0)
            })
            .map(|state| state.uuid.clone())
            .collect::<Vec<_>>();
        if populated.len() > 1 {
            diagnostics.push(json!({
                "code": "alternate-footprints-both-populated",
                "severity": "info",
                "variant": variant_name,
                "reference": reference,
                "message": "More than one alternate footprint is populated.",
                "footprintUuids": populated,
            }));
        }
    }
    diagnostics
}

/// `duplicate-reference-footprints` (`siv:878-888`).
fn push_duplicate_reference_diagnostics(defaults: &Defaults, diagnostics: &mut Vec<Value>) {
    for reference in &defaults.groups.duplicates {
        let group = defaults
            .groups
            .by_reference
            .iter()
            .find(|(candidate, _)| candidate == reference)
            .map(|(_, group)| group)
            .expect("duplicate reference has a group");
        diagnostics.push(json!({
            "code": "duplicate-reference-footprints",
            "severity": "warning",
            "reference": reference,
            "message": "Several footprints share this reference; models stay visible.",
            "footprintUuids": group.iter().map(|state| state.uuid.clone()).collect::<Vec<_>>(),
        }));
    }
}

/// `physical_visibility` (semantic_index_variants.py:519-532): packet-2.6
/// classification from `(footprint uuid, effective dnp)` pairs, in insertion
/// order. No Rust consumer reads it yet; the frontend derives it from the
/// assembly maps (`dvr:150`).
#[allow(
    dead_code,
    reason = "packet-2.6 classifier the frontend derives from the assembly maps; no Rust consumer yet"
)]
fn physical_visibility(
    footprints_by_reference: &[(String, Vec<(String, bool)>)],
) -> Vec<(String, &'static str)> {
    let mut visibility = Vec::new();
    for (reference, footprints) in footprints_by_reference {
        let class = if footprints.is_empty() {
            "absent"
        } else if footprints.len() == 1 {
            if footprints[0].1 { "hidden" } else { "visible" }
        } else {
            "ambiguous"
        };
        visibility.push((reference.clone(), class));
    }
    visibility
}

#[cfg(test)]
mod tests {
    use super::physical_visibility;

    /// `physical_visibility` (semantic_index_variants.py:519-532) over the four
    /// packet-2.6 classes.
    #[test]
    fn physical_visibility_covers_all_four_classes() {
        let visibility = physical_visibility(&[
            ("absent".to_owned(), Vec::new()),
            ("visible".to_owned(), vec![("u1".to_owned(), false)]),
            ("hidden".to_owned(), vec![("u2".to_owned(), true)]),
            (
                "ambiguous".to_owned(),
                vec![("u3".to_owned(), false), ("u4".to_owned(), false)],
            ),
        ]);
        assert_eq!(
            visibility,
            vec![
                ("absent".to_owned(), "absent"),
                ("visible".to_owned(), "visible"),
                ("hidden".to_owned(), "hidden"),
                ("ambiguous".to_owned(), "ambiguous"),
            ]
        );
    }
}
