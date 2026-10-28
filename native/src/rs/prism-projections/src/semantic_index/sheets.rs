//! Pass 1: sheet instances, buses and the source-uuid placements, a port of
//! `_schematic_semantic_projection` (semantic_index_service.py:567-718).
//!
//! Today's `design.schematic_instances()` walks the realized hierarchy in
//! pre-order; the fork's `SchematicBundleIndex::occurrences` is that same
//! walk (one [`SchematicOccurrence`] per reached sheet instance). Its
//! `human_address` is today's `sheet_path`, `occurrence_address` is
//! `sheet_instance_path` and `legacy_address` is `sheet_path_uuids`; the
//! per-instance `schematic` is the definition reached through `source_path`.
//! The root sheet's `sheet_name` is its file stem (semantic_index_service.py
//! `_string(getattr(instance, "sheet_name", ""))`, km's `schematic_instances`).

use super::{Placement, Placements, State, stable_uid};
use crate::{ProjectionError, ProjectionInput, SchematicModel};
use prism_kicad_core::{SchematicDefinition, SchematicLabelScope, SchematicOccurrence};
use serde_json::{Value, json};
use std::collections::HashMap;

/// Fill `state.sheet_instances`, `state.buses`, `indexes.sheetInstanceByPath`
/// and `indexes.busByUid`, and return every schematic item's placements.
pub(super) fn project(
    _input: &ProjectionInput<'_>,
    schematic: &SchematicModel<'_>,
    state: &mut State,
) -> Result<Placements, ProjectionError> {
    let placements = build_sheet_instances(schematic, state);
    fill_parent_pages(state);
    fill_sheet_indexes(state);
    Ok(placements)
}

/// One `sheetInstances` entry per realized occurrence, and the placements of
/// its source items (semantic_index_service.py:589-708).
fn build_sheet_instances(schematic: &SchematicModel<'_>, state: &mut State) -> Placements {
    let index = schematic.index;
    let mut placements = Placements::new();

    for occurrence in index.occurrences() {
        let sheet_path = nonempty(occurrence.human_address.as_str(), "/");
        // `sheet_instance_path or sheet_path_uuids or sheet_path or "/"`
        // (semantic_index_service.py:593-598).
        let instance_path = first_nonempty(&[
            occurrence.occurrence_address.as_str(),
            occurrence.legacy_address.as_str(),
            sheet_path,
        ])
        .unwrap_or("/")
        .to_owned();
        let page = occurrence.source_path.clone();
        // `parent_sheet_instance_path or parent_sheet_path_uuids or
        // parent_sheet_path` (semantic_index_service.py:603-607); empty on the
        // root, where today's code has no parent.
        let parent_path = occurrence
            .parent_index
            .and_then(|parent_index| index.occurrence(parent_index))
            .and_then(|parent| {
                first_nonempty(&[
                    parent.occurrence_address.as_str(),
                    parent.legacy_address.as_str(),
                    parent.human_address.as_str(),
                ])
            })
            .unwrap_or("");
        let sheet_symbol_uuid = occurrence.sheet_uuid.as_deref().unwrap_or("");

        let placement = Placement {
            sheet_instance_path: instance_path.clone(),
            sheet_path: sheet_path.to_owned(),
            page: page.clone(),
        };
        state.sheet_instances.push(json!({
            "sheetInstanceUid": stable_uid("sheet-instance", &[&instance_path, &page]),
            "sheetInstancePath": instance_path,
            "sheetPath": sheet_path,
            "page": page,
            "parentSheetInstancePath": optional(parent_path),
            "sheetSymbolUuid": optional(sheet_symbol_uuid),
            "sheetName": sheet_name(occurrence),
            "isTopLevel": occurrence.parent_index.is_none(),
            "parentPage": Value::Null,
        }));

        let Some(definition) = index.definition(&occurrence.source_path) else {
            continue;
        };
        remember_schematic_items(&mut placements, definition, &placement);
        append_buses(&mut placements, definition, &placement, state);
    }

    placements
}

/// `parentPage` after every instance, from the instance-path → page map
/// (semantic_index_service.py:710-716).
fn fill_parent_pages(state: &mut State) {
    let pages_by_instance = state
        .sheet_instances
        .iter()
        .filter_map(|item| {
            let instance_path = item.get("sheetInstancePath")?.as_str()?;
            let page = item.get("page")?.as_str()?;
            Some((instance_path.to_owned(), page.to_owned()))
        })
        .collect::<HashMap<_, _>>();
    for item in &mut state.sheet_instances {
        let parent_path = item
            .get("parentSheetInstancePath")
            .and_then(Value::as_str)
            .unwrap_or("");
        let parent_page = pages_by_instance
            .get(parent_path)
            .map_or(Value::Null, |page| Value::String(page.clone()));
        if let Some(object) = item.as_object_mut() {
            object.insert("parentPage".to_owned(), parent_page);
        }
    }
}

/// `indexes.sheetInstanceByPath` and `indexes.busByUid`
/// (semantic_index_service.py:867-874).
fn fill_sheet_indexes(state: &mut State) {
    for (index, item) in state.sheet_instances.iter().enumerate() {
        if let Some(path) = item.get("sheetInstancePath").and_then(Value::as_str)
            && !path.is_empty()
        {
            state
                .indexes
                .sheet_instance_by_path
                .insert(path.to_owned(), index);
        }
    }
    for (index, bus) in state.buses.iter().enumerate() {
        if let Some(uid) = bus.get("busUid").and_then(Value::as_str)
            && !uid.is_empty()
        {
            state.indexes.bus_by_uid.insert(uid.to_owned(), index);
        }
    }
}

/// `_string(value) or fallback` for the one non-null default today uses.
fn nonempty<'a>(value: &'a str, fallback: &'a str) -> &'a str {
    if value.is_empty() { fallback } else { value }
}

/// The first present, non-empty candidate, as today's `a or b or c`.
fn first_nonempty<'a>(values: &[&'a str]) -> Option<&'a str> {
    values.iter().copied().find(|value| !value.is_empty())
}

/// Today's `value or None`: `""` becomes `null`, anything else the string.
fn optional(value: &str) -> Value {
    if value.is_empty() {
        Value::Null
    } else {
        Value::String(value.to_owned())
    }
}

/// The root instance's `sheet_name` is its schematic file's stem; every other
/// instance carries the sheet symbol's name
/// (`design_json/schematic_instances.rs:91-105`, km's `schematic_instances()`).
fn sheet_name(occurrence: &SchematicOccurrence) -> String {
    if occurrence.is_root_schematic() {
        source_stem(&occurrence.source_path, occurrence.index)
    } else {
        occurrence.sheet_name.clone()
    }
}

fn source_stem(path: &str, index: usize) -> String {
    let filename = path.rsplit('/').next().unwrap_or(path);
    filename
        .strip_suffix(".kicad_sch")
        .filter(|value| !value.is_empty())
        .map_or_else(|| format!("sheet_{index}"), str::to_owned)
}

/// The wires, junctions, labels, global and hierarchical labels and symbols
/// whose uuids enter the placements map, then each symbol's pins
/// (semantic_index_service.py:634-645).
fn remember_schematic_items(
    placements: &mut Placements,
    definition: &SchematicDefinition,
    placement: &Placement,
) {
    for wire in &definition.wires {
        remember(placements, &wire.uuid, placement);
    }
    for junction in &definition.junctions {
        remember(placements, &junction.uuid, placement);
    }
    for scope in [
        SchematicLabelScope::Local,
        SchematicLabelScope::Global,
        SchematicLabelScope::Hierarchical,
    ] {
        for label in definition
            .labels
            .iter()
            .filter(|label| label.scope == scope)
        {
            remember(placements, &label.uuid, placement);
        }
    }
    for symbol in &definition.symbols {
        remember(placements, &symbol.uuid, placement);
        for pin in &symbol.pins {
            remember(placements, &pin.uuid, placement);
        }
    }
}

/// `remember(source_uuid, placement)` (semantic_index_service.py:583-588): a
/// non-empty uuid collects the placement once, in first-seen order.
fn remember(placements: &mut Placements, source_uuid: &str, placement: &Placement) {
    if source_uuid.is_empty() {
        return;
    }
    let rows = placements.entry(source_uuid.to_owned()).or_default();
    if !rows.iter().any(|row| row == placement) {
        rows.push(placement.clone());
    }
}

/// The bus wires, bus entries and bus aliases of one instance
/// (semantic_index_service.py:647-708), appended in that order.
fn append_buses(
    placements: &mut Placements,
    definition: &SchematicDefinition,
    placement: &Placement,
    state: &mut State,
) {
    for bus in &definition.buses {
        let source_uuid = bus.uuid.clone();
        remember(placements, &source_uuid, placement);
        state.buses.push(json!({
            "kind": "bus",
            "busUid": bus_uid("bus", placement, &source_uuid),
            "sourceUuid": source_uuid,
            "sheetInstancePath": placement.sheet_instance_path,
            "sheetPath": placement.sheet_path,
            "page": placement.page,
            "points": bus
                .points
                .iter()
                .map(|point| json!([point.x_mm(), point.y_mm()]))
                .collect::<Vec<_>>(),
            "at": Value::Null,
            "size": Value::Null,
        }));
    }
    for entry in &definition.bus_entries {
        let source_uuid = entry.uuid.clone();
        remember(placements, &source_uuid, placement);
        state.buses.push(json!({
            "kind": "bus_entry",
            "busUid": bus_uid("bus_entry", placement, &source_uuid),
            "sourceUuid": source_uuid,
            "sheetInstancePath": placement.sheet_instance_path,
            "sheetPath": placement.sheet_path,
            "page": placement.page,
            "points": Vec::<Value>::new(),
            "at": [entry.at.x_mm(), entry.at.y_mm()],
            "size": [entry.size.x_mm(), entry.size.y_mm()],
        }));
    }
    for alias in &definition.bus_aliases {
        let name = alias.name.clone();
        let mut members = alias
            .members
            .iter()
            .filter(|member| !member.is_empty())
            .cloned()
            .collect::<Vec<_>>();
        members.sort();
        state.buses.push(json!({
            "kind": "bus_alias",
            "busUid": stable_uid("bus-alias", &[&placement.sheet_instance_path, &name]),
            "name": name,
            "members": members,
            "sheetInstancePath": placement.sheet_instance_path,
            "sheetPath": placement.sheet_path,
            "page": placement.page,
        }));
    }
}

/// `_stable_uid("bus", kind, instance_path, source_uuid)`
/// (semantic_index_service.py:656-661).
fn bus_uid(kind: &str, placement: &Placement, source_uuid: &str) -> String {
    stable_uid("bus", &[kind, &placement.sheet_instance_path, source_uuid])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn placement() -> Placement {
        Placement {
            sheet_instance_path: "/root".to_owned(),
            sheet_path: "/".to_owned(),
            page: "demo.kicad_sch".to_owned(),
        }
    }

    #[test]
    fn source_stem_names_the_root_sheet() {
        // km's root `sheet_name` is the schematic file stem (golden root
        // names, e.g. `variants_oracle`, `cynthion`).
        assert_eq!(source_stem("a/b/demo.kicad_sch", 1), "demo");
        assert_eq!(source_stem("demo.kicad_sch", 2), "demo");
        assert_eq!(source_stem(".kicad_sch", 3), "sheet_3");
        assert_eq!(source_stem("board.kicad_pcb", 4), "sheet_4");
    }

    #[test]
    fn first_nonempty_matches_python_or_chains() {
        // `sheet_instance_path or … or "/"` (semantic_index_service.py:593-598).
        assert_eq!(first_nonempty(&["", "b", "c"]), Some("b"));
        assert_eq!(first_nonempty(&["a", "b"]), Some("a"));
        assert_eq!(first_nonempty(&["", ""]), None);
    }

    #[test]
    fn optional_turns_empty_into_null() {
        // `parent_path or None`, `sheet_symbol_uuid or None`
        // (semantic_index_service.py:624-625).
        assert_eq!(optional(""), Value::Null);
        assert_eq!(optional("/root"), Value::String("/root".to_owned()));
    }

    #[test]
    fn bus_uid_matches_today() {
        // Vectors from `_stable_uid("bus", kind, instance_path, source_uuid)`
        // and `_stable_uid("bus-alias", instance_path, name)`.
        assert_eq!(
            bus_uid("bus", &placement(), "aaaa"),
            "bus:d6870b5acf8cf8fed799"
        );
        let instance = Placement {
            sheet_instance_path: "/root/a".to_owned(),
            sheet_path: "/A/".to_owned(),
            page: "a.kicad_sch".to_owned(),
        };
        assert_eq!(
            bus_uid("bus_entry", &instance, "bbbb"),
            "bus:b0ec04cbcf906e1b9091"
        );
        assert_eq!(
            stable_uid("bus-alias", &["/root", "JTAG"]),
            "bus-alias:cda0a0f2a1a9de33e6fb"
        );
    }
}
