//! The assembly state builder, a port of `build_assembly_state`
//! (semantic_index_variants.py:752-903), its occurrence walk (`_OccurrenceState`
//! :74, `_build_schematic_graph` :236-258, `_ancestor_sheet_flags` :261-282,
//! `_resolve_occurrence` :285-306, `_occurrence_states` :309-351,
//! `_variant_occurrence_states` :354-381), the component projection
//! (`_project_components` :384-457), the footprint projection (:460-498), the
//! differential wires (:501-723), the state mismatch diagnostics (:726-749) and
//! the source/board diagnostics (:535-643).

use super::scan;
use super::variants::{self, Fields, FootprintInput, VariantRecord};
use crate::{ProjectionError, ProjectionInput, SchematicModel};
use prism_kicad_core::{
    PcbFootprint, SchematicBundleIndex, SchematicOccurrence, SchematicPlacedSymbol, SchematicSheet,
};
use serde_json::{Map, Value, json};
use std::collections::{BTreeSet, HashMap, HashSet};

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
struct Flags {
    dnp: bool,
    exclude_from_bom: bool,
    exclude_from_board: bool,
    exclude_from_sim: bool,
    exclude_from_pos_files: bool,
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
struct Graph<'a> {
    index: &'a SchematicBundleIndex,
    occurrences: Vec<&'a SchematicOccurrence>,
    version: i64,
    top_path: String,
    schematic_paths: Vec<String>,
}

impl<'a> Graph<'a> {
    fn new(schematic: &'a SchematicModel<'a>) -> Self {
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
fn definition_version(definition: &prism_kicad_core::SchematicDefinition) -> i64 {
    definition
        .version
        .as_deref()
        .and_then(|value| value.parse().ok())
        .unwrap_or(DEFAULT_SCHEMATIC_VERSION)
}

/// `_legacy_in_bom` (semantic_index_variants.py:111-112).
fn legacy_in_bom(version: i64) -> bool {
    version < IN_BOM_POSITIVE_SINCE
}

/// `_valid_reference` (semantic_index_variants.py:115-122).
fn valid_reference(reference: &str) -> bool {
    !reference.is_empty() && !reference.starts_with('#') && !reference.ends_with('?')
}

/// `_fold_sheet_flags` (semantic_index_variants.py:216-233).
fn fold_sheet_flags(flags: variants::SymbolFlags, ancestors: &[SheetFlags]) -> Flags {
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
struct SheetFlags {
    dnp: bool,
    exclude_from_bom: bool,
    exclude_from_board: bool,
    exclude_from_sim: bool,
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
fn sheet_symbol<'a>(
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
fn ancestor_sheet_flags(
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
fn sheet_records<'a>(
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

/// `_project_components` (semantic_index_variants.py:384-457).
fn project_components(
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

/// The footprint inputs of one board, in board file order, with the `(variant …)`
/// records the fork core does not expose (`siv:470-498`).
fn board_footprints(input: &ProjectionInput<'_>) -> Result<Vec<FootprintInput>, ProjectionError> {
    let Some(board) = input.board else {
        return Ok(Vec::new());
    };
    let view = board.view;
    let footprints = view
        .footprints()
        .collect::<Result<Vec<PcbFootprint>, _>>()
        .map_err(|error| ProjectionError::new(format!("assembly: {error}")))?;
    let mut properties: Vec<Vec<(String, String)>> = vec![Vec::new(); footprints.len()];
    for property in view.footprint_properties() {
        let property =
            property.map_err(|error| ProjectionError::new(format!("assembly: {error}")))?;
        if let Some(slot) = properties.get_mut(property.footprint_index) {
            slot.push((property.name, property.value));
        }
    }
    Ok(footprints
        .into_iter()
        .zip(properties)
        .map(|(footprint, properties)| {
            let uuid = footprint.uuid.clone().unwrap_or_default();
            let slice = board.text.get(footprint.source_range.clone()).unwrap_or("");
            let variants = variants::footprint_variants(slice);
            variants::footprint_input(uuid, &properties, &footprint.attributes, variants)
        })
        .collect())
}

/// `_footprint_state` (semantic_index_variants.py:470-491). Today's `order` is
/// carried but never read.
fn footprint_state(input: &FootprintInput, variant_name: Option<&str>) -> FootprintState {
    let record =
        variant_name.and_then(|name| variants::select_footprint_variant(&input.variants, name));
    let resolved = variants::resolve_footprint(input, record.map(|record| record.name.as_str()));
    FootprintState {
        uuid: input.uuid.clone(),
        reference: resolved.reference,
        flags: (
            resolved.dnp,
            resolved.exclude_from_bom,
            resolved.exclude_from_pos_files,
        ),
        fields: resolved.fields,
    }
}

/// `_footprint_states` (semantic_index_variants.py:494-498).
fn footprint_states(inputs: &[FootprintInput], variant_name: Option<&str>) -> Vec<FootprintState> {
    inputs
        .iter()
        .map(|input| footprint_state(input, variant_name))
        .collect()
}

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
fn default_occurrence_wire(state: &OccurrenceState) -> Option<Value> {
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
fn default_component_wire(state: &ComponentState) -> Option<Value> {
    let mut entry = Map::new();
    for key in FLAG_KEYS {
        if state.flags.value(key) {
            entry.insert(key.to_owned(), Value::Bool(true));
        }
    }
    (!entry.is_empty()).then(|| Value::Object(entry))
}

/// `_default_footprint_wire` (semantic_index_variants.py:659-664).
fn default_footprint_wire(state: &FootprintState) -> Option<Value> {
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
fn variant_occurrence_wire(
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
fn variant_component_wire(
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
fn variant_footprint_wire(default: &[FootprintState], variant: &[FootprintState]) -> Value {
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

/// `_source_state_mismatches` (semantic_index_variants.py:726-749).
fn source_state_mismatches(
    components: &[(String, ComponentState)],
    footprints_by_reference: &[(String, Vec<FootprintState>)],
    variant_name: Option<&str>,
    diagnostics: &mut Vec<Value>,
) {
    for (reference, component) in components {
        let Some(group) = footprints_by_reference
            .iter()
            .find(|(candidate, _)| candidate == reference)
            .map(|(_, group)| group)
        else {
            continue;
        };
        if group.len() != 1 {
            continue;
        }
        let footprint = &group[0];
        if component.flags.dnp != footprint.flags.0
            || component.flags.exclude_from_bom != footprint.flags.1
        {
            let mut diagnostic = Map::new();
            diagnostic.insert("code".to_owned(), json!("source-state-mismatch"));
            diagnostic.insert("severity".to_owned(), json!("info"));
            diagnostic.insert("reference".to_owned(), json!(reference));
            diagnostic.insert(
                "message".to_owned(),
                json!("Schematic and footprint state disagree; neither side wins."),
            );
            if let Some(variant_name) = variant_name {
                diagnostic.insert("variant".to_owned(), json!(variant_name));
            }
            diagnostics.push(Value::Object(diagnostic));
        }
    }
}

/// `_read_text` (semantic_index_variants.py:564-568): decode a source, ignoring
/// invalid UTF-8 as today's `errors="ignore"`.
fn read_text(input: &ProjectionInput<'_>, path: &str) -> Option<String> {
    input
        .sources
        .read(path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
}

/// `_source_diagnostics` (semantic_index_variants.py:578-621).
fn source_diagnostics(input: &ProjectionInput<'_>, graph: &Graph<'_>) -> Vec<Value> {
    let mut diagnostics = Vec::new();
    if legacy_in_bom(graph.version) && !graph.top_path.is_empty() {
        diagnostics.push(json!({
            "code": "legacy-in-bom-semantics",
            "severity": "info",
            "path": graph.top_path,
            "message": "Schematic version predates the positive in_bom record token.",
            "detail": {"version": graph.version},
        }));
    }
    for path in &graph.schematic_paths {
        let Some(text) = read_text(input, path) else {
            continue;
        };
        let tokens = scan::unsupported_tokens(&text, &SCHEMATIC_UNSUPPORTED);
        if !tokens.is_empty() {
            diagnostics.push(json!({
                "code": "unsupported-variant-token",
                "severity": "info",
                "path": path,
                "message": "KiCad 11 variant tokens were ignored.",
                "detail": {"tokens": tokens},
            }));
        }
        for detail in scan::rule_areas(&text) {
            let detail = detail
                .into_iter()
                .map(|(key, value)| (key.to_owned(), Value::Bool(value)))
                .collect::<Map<_, _>>();
            diagnostics.push(json!({
                "code": "rule-area-flags-unsupported",
                "severity": "warning",
                "path": path,
                "message": "Rule-area-driven exclusion is not resolved this release.",
                "detail": detail,
            }));
        }
    }
    diagnostics
}

/// `_board_diagnostics` (semantic_index_variants.py:624-643).
fn board_diagnostics(input: &ProjectionInput<'_>) -> Vec<Value> {
    let Some(board) = input.board else {
        return Vec::new();
    };
    let tokens = scan::unsupported_tokens(board.text, &BOARD_UNSUPPORTED);
    if tokens.is_empty() {
        return Vec::new();
    }
    vec![json!({
        "code": "unsupported-variant-token",
        "severity": "info",
        "path": board.path,
        "message": "KiCad 11 variant tokens were ignored.",
        "detail": {"tokens": tokens},
    })]
}

/// Build the pre-join assembly block `build_assembly_state` returns
/// (semantic_index_variants.py:752-903). Catalog diagnostics are prepended by
/// the caller (`assemble_semantic_index`, :1067-1069).
pub(super) fn build(
    input: &ProjectionInput<'_>,
    schematic: &SchematicModel<'_>,
    catalog: &[Value],
) -> Result<Value, ProjectionError> {
    let graph = Graph::new(schematic);
    let mut cache: HashMap<String, Vec<Vec<variants::SheetInstance>>> = HashMap::new();

    let variant_names = catalog
        .iter()
        .filter_map(|entry| entry.get("name").and_then(Value::as_str))
        .map(str::to_owned)
        .collect::<Vec<_>>();

    let (occurrences, occurrence_diagnostics) = occurrence_states(input, &graph, &mut cache);
    let mut diagnostics = source_diagnostics(input, &graph);
    diagnostics.extend(board_diagnostics(input));
    diagnostics.extend(occurrence_diagnostics);

    let components = project_components(&occurrences, None, &mut diagnostics);
    let footprint_inputs = board_footprints(input)?;
    let footprints = footprint_states(&footprint_inputs, None);
    let (default_occurrences, default_components, default_footprints) =
        default_maps(&occurrences, &components, &footprints);

    let footprints_by_reference = group_footprints_by_reference(&footprints);
    let duplicate_references = footprints_by_reference
        .iter()
        .filter(|(_, group)| group.len() > 1)
        .map(|(reference, _)| reference.clone())
        .collect::<Vec<_>>();
    let default_by_occurrence = occurrences
        .iter()
        .map(|state| (state.occurrence_id.clone(), state.clone()))
        .collect::<Vec<_>>();

    let mut variants = Vec::new();
    let mut alternate_diagnostics = Vec::new();
    let mut mismatch_diagnostics = Vec::new();
    for variant_name in &variant_names {
        let occurrence_states = variant_occurrence_states(input, &graph, variant_name, &mut cache);
        let state_list = occurrence_states
            .iter()
            .map(|(_, state)| state.clone())
            .collect::<Vec<_>>();
        let variant_components =
            project_components(&state_list, Some(variant_name), &mut diagnostics);
        let variant_footprints = footprint_states(&footprint_inputs, Some(variant_name));
        let variant_by_uuid = variant_footprints
            .iter()
            .map(|state| (state.uuid.clone(), state))
            .collect::<HashMap<_, _>>();

        variants.push(variant_entry(
            variant_name,
            &default_by_occurrence,
            &occurrence_states,
            &components,
            &variant_components,
            &footprints,
            &variant_footprints,
        ));
        alternate_diagnostics.extend(alternate_diagnostics_for(
            variant_name,
            &duplicate_references,
            &footprints_by_reference,
            &variant_by_uuid,
        ));
        source_state_mismatches(
            &variant_components,
            &group_footprints_by_reference(&variant_footprints),
            Some(variant_name),
            &mut mismatch_diagnostics,
        );
    }

    push_duplicate_reference_diagnostics(
        &duplicate_references,
        &footprints_by_reference,
        &mut diagnostics,
    );
    diagnostics.extend(alternate_diagnostics);
    source_state_mismatches(
        &components,
        &footprints_by_reference,
        None,
        &mut mismatch_diagnostics,
    );
    diagnostics.extend(mismatch_diagnostics);

    let footprint_inventory = footprints
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

/// The three differential default maps (`siv:791-806`).
fn default_maps(
    occurrences: &[OccurrenceState],
    components: &[(String, ComponentState)],
    footprints: &[FootprintState],
) -> (Map<String, Value>, Map<String, Value>, Map<String, Value>) {
    let mut default_occurrences = Map::new();
    for state in occurrences {
        if let Some(wire) = default_occurrence_wire(state) {
            default_occurrences.insert(state.occurrence_id.clone(), wire);
        }
    }
    let mut default_components = Map::new();
    for (reference, state) in components {
        if let Some(wire) = default_component_wire(state) {
            default_components.insert(reference.clone(), wire);
        }
    }
    let mut default_footprints = Map::new();
    for state in footprints {
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
fn push_duplicate_reference_diagnostics(
    duplicate_references: &[String],
    footprints_by_reference: &[(String, Vec<FootprintState>)],
    diagnostics: &mut Vec<Value>,
) {
    for reference in duplicate_references {
        let group = footprints_by_reference
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
