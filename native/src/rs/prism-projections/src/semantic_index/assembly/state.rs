//! The assembly state builder, a port of `build_assembly_state`
//! (semantic_index_variants.py:752-903) and its occurrence walk
//! (`_OccurrenceState` :74, `_build_schematic_graph` :236-258,
//! `_ancestor_sheet_flags` :261-282, `_resolve_occurrence` :285-306,
//! `_occurrence_states` :309-351, `_variant_occurrence_states` :354-381).
//!
//! The projection groups live beside this module: [`components`] the component
//! projection (`_project_components` :384-457), [`footprints`] the footprint
//! projection (:460-498), [`wires`] the differential wires (:501-723),
//! [`diagnostics`] the state mismatch and source/board diagnostics (:726-749,
//! :535-643), and [`build`] the entry point and its default maps (:752-903).

mod build;
mod components;
mod diagnostics;
pub(crate) mod footprints;
mod wires;

pub(super) use build::build;

use super::variants::{self, Fields, VariantRecord};
use crate::{ProjectionInput, SchematicModel};
use prism_kicad_core::{
    SchematicBundleIndex, SchematicOccurrence, SchematicPlacedSymbol, SchematicSheet,
};
use serde_json::{Value, json};
use std::collections::HashMap;

/// `SCHEMA` (semantic_index_variants.py:42).
const SCHEMA: &str = "prism.assembly_state_a0";

/// `IN_BOM_POSITIVE_SINCE` (semantic_index_variants.py:55).
const IN_BOM_POSITIVE_SINCE: i64 = 20260306;

/// `FLAG_KEYS` (semantic_index_variants.py:44-50).
const FLAG_KEYS: [&str; 5] = [
    "dnp",
    "excludeFromBom",
    "excludeFromBoard",
    "excludeFromSim",
    "excludeFromPosFiles",
];

/// `FOOTPRINT_FLAG_KEYS` (semantic_index_variants.py:51).
const FOOTPRINT_FLAG_KEYS: [&str; 3] = ["dnp", "excludeFromBom", "excludeFromPosFiles"];

/// `_UNSUPPORTED_TOKENS[".kicad_sch"]` (semantic_index_variants.py:57-61).
const SCHEMATIC_UNSUPPORTED: [&str; 2] = ["symbol_override", "pin_map_override"];
/// `_UNSUPPORTED_TOKENS[".kicad_pcb"]` (semantic_index_variants.py:57-61).
const BOARD_UNSUPPORTED: [&str; 1] = ["exclude_from_sim"];

/// `kicad_defaults.KICAD_SCHEMATIC_FILE_VERSION`: today's default when the
/// `(version …)` form is absent.
const DEFAULT_SCHEMATIC_VERSION: i64 = IN_BOM_POSITIVE_SINCE;

/// The five effective flags of one occurrence or component (`siv:44-50`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Flags {
    pub(crate) dnp: bool,
    pub(crate) exclude_from_bom: bool,
    pub(crate) exclude_from_board: bool,
    pub(crate) exclude_from_sim: bool,
    pub(crate) exclude_from_pos_files: bool,
}

impl Flags {
    fn value(self, key: &str) -> bool {
        match key {
            "dnp" => self.dnp,
            "excludeFromBom" => self.exclude_from_bom,
            "excludeFromBoard" => self.exclude_from_board,
            "excludeFromSim" => self.exclude_from_sim,
            "excludeFromPosFiles" => self.exclude_from_pos_files,
            _ => false,
        }
    }
}

/// `_OccurrenceState` (semantic_index_variants.py:73-81).
#[derive(Clone, Debug)]
struct OccurrenceState {
    occurrence_id: String,
    reference: String,
    sheet_instance_path: String,
    sheet_order: usize,
    symbol_uuid: String,
    flags: Flags,
    fields: Fields,
}

/// `_ComponentState` (semantic_index_variants.py:93-97).
#[derive(Clone, Debug)]
struct ComponentState {
    flags: Flags,
    fields: Fields,
}

/// `_FootprintState` (semantic_index_variants.py:84-90).
#[derive(Clone, Debug)]
struct FootprintState {
    uuid: String,
    reference: String,
    flags: (bool, bool, bool),
    fields: Fields,
}

/// `_SchematicGraph` (semantic_index_variants.py:100-108): the realized
/// hierarchy, its source files and the root version.
pub(crate) struct Graph<'a> {
    index: &'a SchematicBundleIndex,
    occurrences: Vec<&'a SchematicOccurrence>,
    pub(crate) version: i64,
    top_path: String,
    schematic_paths: Vec<String>,
}

impl<'a> Graph<'a> {
    pub(crate) fn new(schematic: &'a SchematicModel<'a>) -> Self {
        let index = schematic.index;
        let occurrences = index.occurrences().collect::<Vec<_>>();
        let mut schematic_paths: Vec<String> = Vec::new();
        for occurrence in &occurrences {
            if !schematic_paths.contains(&occurrence.source_path) {
                schematic_paths.push(occurrence.source_path.clone());
            }
        }
        let version = index
            .definition(schematic.root)
            .map_or(DEFAULT_SCHEMATIC_VERSION, definition_version);
        Graph {
            index,
            occurrences,
            version,
            top_path: schematic.root.to_owned(),
            schematic_paths,
        }
    }

    fn definition(&self, source_path: &str) -> Option<&'a prism_kicad_core::SchematicDefinition> {
        self.index.definition(source_path)
    }
}

/// `int(get_value(sexp, "version", KICAD_SCHEMATIC_FILE_VERSION))`
/// (kicad_sch_schematic.py:390; `kicad_defaults.py:5`).
pub(crate) fn definition_version(definition: &prism_kicad_core::SchematicDefinition) -> i64 {
    definition
        .version
        .as_deref()
        .and_then(|value| value.parse().ok())
        .unwrap_or(DEFAULT_SCHEMATIC_VERSION)
}

/// `_legacy_in_bom` (semantic_index_variants.py:111-112).
pub(crate) fn legacy_in_bom(version: i64) -> bool {
    version < IN_BOM_POSITIVE_SINCE
}

/// `_valid_reference` (semantic_index_variants.py:115-122).
fn valid_reference(reference: &str) -> bool {
    !reference.is_empty() && !reference.starts_with('#') && !reference.ends_with('?')
}

/// `_fold_sheet_flags` (semantic_index_variants.py:216-233).
pub(crate) fn fold_sheet_flags(flags: variants::SymbolFlags, ancestors: &[SheetFlags]) -> Flags {
    let mut folded = Flags {
        dnp: flags.dnp,
        exclude_from_bom: flags.exclude_from_bom,
        exclude_from_board: flags.exclude_from_board,
        exclude_from_sim: flags.exclude_from_sim,
        exclude_from_pos_files: flags.exclude_from_pos_files,
    };
    for sheet in ancestors {
        folded.dnp |= sheet.dnp;
        folded.exclude_from_bom |= sheet.exclude_from_bom;
        folded.exclude_from_board |= sheet.exclude_from_board;
        folded.exclude_from_sim |= sheet.exclude_from_sim;
    }
    folded
}

/// The four folded sheet flags `_sheet_flags` returns
/// (semantic_index_variants.py:176-213).
#[derive(Clone, Copy, Debug)]
pub(crate) struct SheetFlags {
    pub(crate) dnp: bool,
    pub(crate) exclude_from_bom: bool,
    pub(crate) exclude_from_board: bool,
    pub(crate) exclude_from_sim: bool,
}

/// `_select_sheet_variant` (semantic_index_variants.py:163-173).
fn select_sheet_variant<'a>(
    records: &'a [variants::SheetInstance],
    containing_path: &str,
    variant_name: &str,
) -> Option<&'a VariantRecord> {
    for instance in records {
        if instance.path != containing_path {
            continue;
        }
        return instance
            .variants
            .iter()
            .find(|record| record.name == variant_name);
    }
    None
}

/// `_sheet_flags` (semantic_index_variants.py:176-213).
fn sheet_flags(
    sheet: &SchematicSheet,
    records: &[variants::SheetInstance],
    containing_path: &str,
    variant_name: Option<&str>,
    version: i64,
) -> SheetFlags {
    let record = variant_name.and_then(|name| select_sheet_variant(records, containing_path, name));
    let mut dnp = sheet.dnp;
    let mut on_board = sheet.on_board;
    let mut exclude_from_sim = sheet.exclude_from_sim;
    let in_bom = sheet.in_bom;
    let exclude_from_bom = match record {
        Some(record) => {
            if let Some(value) = record.dnp {
                dnp = value;
            }
            if let Some(value) = record.on_board {
                on_board = value;
            }
            if let Some(value) = record.exclude_from_sim {
                exclude_from_sim = value;
            }
            match record.in_bom {
                Some(value) => {
                    if legacy_in_bom(version) {
                        value
                    } else {
                        !value
                    }
                }
                None => !in_bom,
            }
        }
        None => !in_bom,
    };
    SheetFlags {
        dnp,
        exclude_from_bom,
        exclude_from_board: !on_board,
        exclude_from_sim,
    }
}

/// The sheet symbol that placed `occurrence`, with the parent's source path and
/// the sheet's index in it: today's `instance.sheet_symbol`.
pub(crate) fn sheet_symbol<'a>(
    graph: &'a Graph<'a>,
    occurrence: &SchematicOccurrence,
) -> Option<(&'a SchematicSheet, &'a str, usize)> {
    let parent = graph.index.occurrence(occurrence.parent_index?)?;
    let sheet_index = occurrence.parent_sheet_index?;
    let definition = graph.definition(&parent.source_path)?;
    let sheet = definition.sheets.get(sheet_index)?;
    Some((sheet, parent.source_path.as_str(), sheet_index))
}

/// `_ancestor_sheet_flags` (semantic_index_variants.py:261-282): fold the sheet
/// symbols from `occurrence` up to the root.
pub(crate) fn ancestor_sheet_flags(
    input: &ProjectionInput<'_>,
    graph: &Graph<'_>,
    occurrence: &SchematicOccurrence,
    variant_name: Option<&str>,
    cache: &mut HashMap<String, Vec<Vec<variants::SheetInstance>>>,
) -> Vec<SheetFlags> {
    let mut folded = Vec::new();
    let mut node = Some(occurrence);
    while let Some(current) = node {
        if let Some((sheet, parent_source, sheet_index)) = sheet_symbol(graph, current) {
            let records = sheet_records(input, cache, parent_source);
            let records = records.get(sheet_index).map_or(&[][..], Vec::as_slice);
            // `containing_path` is the parent's instance path, and the version
            // gate is the parent schematic's (`siv:261-282`).
            let parent = current
                .parent_index
                .and_then(|parent_index| graph.index.occurrence(parent_index));
            let containing_path = parent.map_or("", |parent| parent.occurrence_address.as_str());
            let version = parent
                .and_then(|parent| graph.definition(&parent.source_path))
                .map_or(graph.version, definition_version);
            folded.push(sheet_flags(
                sheet,
                records,
                containing_path,
                variant_name,
                version,
            ));
        }
        node = current
            .parent_index
            .and_then(|parent_index| graph.index.occurrence(parent_index));
    }
    folded
}

/// Cached `sheet_instances` scan of one source (semantic_index_variants.py uses
/// `sheet.instances`, which the fork core does not expose).
pub(crate) fn sheet_records<'a>(
    input: &ProjectionInput<'_>,
    cache: &'a mut HashMap<String, Vec<Vec<variants::SheetInstance>>>,
    source_path: &str,
) -> &'a [Vec<variants::SheetInstance>] {
    if !cache.contains_key(source_path) {
        let records = input
            .sources
            .read(source_path)
            .map(|bytes| variants::sheet_instances(&String::from_utf8_lossy(&bytes)))
            .unwrap_or_default();
        cache.insert(source_path.to_owned(), records);
    }
    cache.get(source_path).map_or(&[][..], Vec::as_slice)
}

/// `_resolve_occurrence` (semantic_index_variants.py:285-306).
fn resolve_occurrence(
    symbol: &SchematicPlacedSymbol,
    sheet_path: &str,
    variant_name: Option<&str>,
    version: i64,
) -> (String, Flags, Fields) {
    let has_instance = variants::has_symbol_instance(symbol, sheet_path);
    let resolved = if has_instance {
        variants::resolve_symbol(symbol, variant_name, sheet_path)
    } else {
        // The pinned resolver otherwise borrows another occurrence's reference.
        let mut cleared = symbol.clone();
        cleared.instances.clear();
        variants::resolve_symbol(&cleared, variant_name, sheet_path)
    };
    let record = if has_instance {
        variant_name.and_then(|name| variants::select_symbol_variant(symbol, name, sheet_path))
    } else {
        None
    };
    let (reference, flags) = (
        resolved.reference.clone(),
        variants::symbol_flags(&resolved, record, legacy_in_bom(version)),
    );
    let mut fields = resolved.fields;
    fields.insert("Reference".to_owned(), Value::String(reference.clone()));
    let flags = Flags {
        dnp: flags.dnp,
        exclude_from_bom: flags.exclude_from_bom,
        exclude_from_board: flags.exclude_from_board,
        exclude_from_sim: flags.exclude_from_sim,
        exclude_from_pos_files: flags.exclude_from_pos_files,
    };
    (reference, flags, fields)
}

/// `_occurrence_states` (semantic_index_variants.py:309-351).
fn occurrence_states(
    input: &ProjectionInput<'_>,
    graph: &Graph<'_>,
    cache: &mut HashMap<String, Vec<Vec<variants::SheetInstance>>>,
) -> (Vec<OccurrenceState>, Vec<Value>) {
    let mut occurrences = Vec::new();
    let mut diagnostics = Vec::new();
    for (order, instance) in graph.occurrences.iter().enumerate() {
        let sheet_path = if instance.occurrence_address.is_empty() {
            "/".to_owned()
        } else {
            instance.occurrence_address.clone()
        };
        let ancestors = ancestor_sheet_flags(input, graph, instance, None, cache);
        let definition = graph.definition(&instance.source_path);
        let Some(definition) = definition else {
            continue;
        };
        let version = definition_version(definition);
        for symbol in &definition.symbols {
            let (reference, flags, fields) = resolve_occurrence(symbol, &sheet_path, None, version);
            if !valid_reference(&reference) {
                continue;
            }
            let occurrence_id = format!("{sheet_path}/{}", symbol.uuid);
            if !variants::has_symbol_instance(symbol, &sheet_path) {
                diagnostics.push(json!({
                    "code": "occurrence-instance-missing",
                    "severity": "warning",
                    "reference": reference,
                    "occurrenceId": occurrence_id,
                    "message": "No symbol instance matches this sheet path; base attributes used.",
                }));
            }
            occurrences.push(OccurrenceState {
                occurrence_id,
                reference,
                sheet_instance_path: sheet_path.clone(),
                sheet_order: order,
                symbol_uuid: symbol.uuid.clone(),
                flags: fold_sheet_flags(
                    variants::SymbolFlags {
                        dnp: flags.dnp,
                        exclude_from_bom: flags.exclude_from_bom,
                        exclude_from_board: flags.exclude_from_board,
                        exclude_from_sim: flags.exclude_from_sim,
                        exclude_from_pos_files: flags.exclude_from_pos_files,
                    },
                    &ancestors,
                ),
                fields,
            });
        }
    }
    (occurrences, diagnostics)
}

/// `_variant_occurrence_states` (semantic_index_variants.py:354-381).
fn variant_occurrence_states(
    input: &ProjectionInput<'_>,
    graph: &Graph<'_>,
    variant_name: &str,
    cache: &mut HashMap<String, Vec<Vec<variants::SheetInstance>>>,
) -> Vec<(String, OccurrenceState)> {
    let mut states: Vec<(String, OccurrenceState)> = Vec::new();
    for (order, instance) in graph.occurrences.iter().enumerate() {
        let sheet_path = if instance.occurrence_address.is_empty() {
            "/".to_owned()
        } else {
            instance.occurrence_address.clone()
        };
        let ancestors = ancestor_sheet_flags(input, graph, instance, Some(variant_name), cache);
        let Some(definition) = graph.definition(&instance.source_path) else {
            continue;
        };
        let version = definition_version(definition);
        for symbol in &definition.symbols {
            let (reference, flags, fields) =
                resolve_occurrence(symbol, &sheet_path, Some(variant_name), version);
            if !valid_reference(&reference) {
                continue;
            }
            let occurrence_id = format!("{sheet_path}/{}", symbol.uuid);
            let state = OccurrenceState {
                occurrence_id: occurrence_id.clone(),
                reference,
                sheet_instance_path: sheet_path.clone(),
                sheet_order: order,
                symbol_uuid: symbol.uuid.clone(),
                flags: fold_sheet_flags(
                    variants::SymbolFlags {
                        dnp: flags.dnp,
                        exclude_from_bom: flags.exclude_from_bom,
                        exclude_from_board: flags.exclude_from_board,
                        exclude_from_sim: flags.exclude_from_sim,
                        exclude_from_pos_files: flags.exclude_from_pos_files,
                    },
                    &ancestors,
                ),
                fields,
            };
            if let Some(existing) = states.iter_mut().find(|(id, _)| id == &occurrence_id) {
                existing.1 = state;
            } else {
                states.push((occurrence_id, state));
            }
        }
    }
    states
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `_legacy_in_bom` (semantic_index_variants.py:111-112) flips exactly at
    /// `IN_BOM_POSITIVE_SINCE`.
    #[test]
    fn legacy_in_bom_flips_at_the_positive_token_version() {
        assert!(legacy_in_bom(IN_BOM_POSITIVE_SINCE - 1));
        assert!(legacy_in_bom(IN_BOM_POSITIVE_SINCE - 100));
        assert!(!legacy_in_bom(IN_BOM_POSITIVE_SINCE));
        assert!(!legacy_in_bom(IN_BOM_POSITIVE_SINCE + 1));
    }

    /// `_valid_reference` (semantic_index_variants.py:115-122): virtual power
    /// symbols and unannotated references have no component.
    #[test]
    fn valid_reference_rejects_virtual_and_unannotated() {
        assert!(!valid_reference(""));
        assert!(!valid_reference("#PWR01"));
        assert!(!valid_reference("R1?"));
        assert!(valid_reference("R1"));
        assert!(valid_reference("U1A"));
    }
}
