//! The sheet-instance and symbol-occurrence passes: `build`'s schematic block
//! (occurrences.py:164-229).

use super::{bom, property, records, support};
use crate::semantic_index::assembly::state::{
    Flags, Graph, SheetFlags, ancestor_sheet_flags, definition_version, fold_sheet_flags,
    legacy_in_bom, sheet_records, sheet_symbol,
};
use crate::semantic_index::assembly::variants::{self, SheetInstance, SymbolFlags};
use crate::{ProducerWarning, ProjectionInput, SchematicModel};
use prism_kicad_core::{SchematicOccurrence, SchematicPlacedSymbol, SchematicSymbolInstance};
use serde_json::{Map, Value, json};
use std::collections::HashMap;

/// The folded sheet-flag cache `state` scans through, one per revision.
type SheetCache = HashMap<String, Vec<Vec<SheetInstance>>>;

/// The per-occurrence context a symbol entry needs (occurrences.py:166-223).
struct SymbolContext<'a> {
    sheet_path: &'a str,
    document_path: &'a str,
    version: i64,
    project_stem: &'a str,
}

/// Every sheet instance in hierarchy order, with its folded DNP / BOM / board /
/// sim state and raw sheet-variant records, and every placed symbol occurrence
/// of those instances (occurrences.py:164-229).
pub(crate) fn project(
    input: &ProjectionInput<'_>,
    schematic: &SchematicModel<'_>,
    warnings: &mut Vec<ProducerWarning>,
) -> (Vec<Value>, Vec<Value>) {
    let graph = Graph::new(schematic);
    let project_stem = support::project_stem(input.project.path);
    let mut cache = SheetCache::new();
    let mut sheets = Vec::new();
    let mut symbols = Vec::new();
    for occurrence in schematic.index.occurrences() {
        let sheet_path = occurrence.occurrence_address.as_str();
        let ancestors = ancestor_sheet_flags(input, &graph, occurrence, None, &mut cache);
        let folded = fold_sheet_flags(empty_flags(), &ancestors);
        sheets.push(json!({
            "sheetPath": sheet_path,
            "dnp": folded.dnp,
            "excludeFromBom": folded.exclude_from_bom,
            "excludeFromBoard": folded.exclude_from_board,
            "excludeFromSim": folded.exclude_from_sim,
            "variants": sheet_variants(input, schematic, &graph, occurrence, &mut cache),
        }));
        let Some(definition) = schematic.index.definition(&occurrence.source_path) else {
            continue;
        };
        let context = SymbolContext {
            sheet_path,
            document_path: occurrence.source_path.as_str(),
            version: definition_version(definition),
            project_stem: &project_stem,
        };
        collect_symbols(
            &definition.symbols,
            &context,
            &ancestors,
            warnings,
            &mut symbols,
        );
    }
    (sheets, symbols)
}

/// The `(symbol …)` forms of one instance that carry a `lib_id`, skipping the
/// ones without a canonical UUID (occurrences.py:185-229).
fn collect_symbols(
    placed: &[SchematicPlacedSymbol],
    context: &SymbolContext<'_>,
    ancestors: &[SheetFlags],
    warnings: &mut Vec<ProducerWarning>,
    symbols: &mut Vec<Value>,
) {
    for symbol in placed {
        if symbol.lib_id.is_empty() {
            continue;
        }
        if !support::is_canonical_uuid(&symbol.uuid) {
            warnings.push(support::warning(
                "occurrences-symbol-without-uuid",
                format!("{} {}", context.document_path, symbol.lib_id),
            ));
            continue;
        }
        if let Some(entry) = symbol_entry(symbol, context, ancestors, warnings) {
            symbols.push(entry);
        }
    }
}

/// `_record` for the sheet symbol's records whose `path` is the parent's
/// (occurrences.py:171-180): a sheet's own variant records, unresolved.
fn sheet_variants(
    input: &ProjectionInput<'_>,
    schematic: &SchematicModel<'_>,
    graph: &Graph<'_>,
    occurrence: &SchematicOccurrence,
    cache: &mut SheetCache,
) -> Vec<Value> {
    let Some((_sheet, parent_source, sheet_index)) = sheet_symbol(graph, occurrence) else {
        return Vec::new();
    };
    let Some(parent) = occurrence
        .parent_index
        .and_then(|index| schematic.index.occurrence(index))
    else {
        return Vec::new();
    };
    let containing = parent.occurrence_address.as_str();
    let Some(instance) = sheet_records(input, cache, parent_source)
        .get(sheet_index)
        .and_then(|instances| {
            instances
                .iter()
                .find(|instance| instance.path == containing)
        })
    else {
        return Vec::new();
    };
    // The version gate is the parent schematic's (`siv:261-282`).
    let version = schematic
        .index
        .definition(parent_source)
        .map_or(graph.version, definition_version);
    let legacy = legacy_in_bom(version);
    instance
        .variants
        .iter()
        .map(|record| records::sheet_record(record, legacy))
        .collect()
}

/// One `OccurrencesSymbol` (occurrences.py:191-229).
fn symbol_entry(
    symbol: &SchematicPlacedSymbol,
    context: &SymbolContext<'_>,
    ancestors: &[SheetFlags],
    warnings: &mut Vec<ProducerWarning>,
) -> Option<Value> {
    let properties = property::ordered(&symbol.properties);
    let matched = matched_instance(symbol, context.sheet_path, context.project_stem);
    let (reference, unit, variants) = match matched {
        Some(instance) => (
            instance.reference.clone(),
            instance_unit(instance.unit, symbol.unit),
            symbol_variants(instance, context.version),
        ),
        None => (
            properties.get("Reference").unwrap_or("").to_owned(),
            symbol_unit(symbol.unit),
            Vec::new(),
        ),
    };
    let unit = u64::try_from(unit)
        .ok()
        .filter(|unit| *unit >= 1)
        .or_else(|| {
            warnings.push(support::warning(
                "occurrences-unit-invalid",
                format!("{}/{}", context.sheet_path, symbol.uuid),
            ));
            None
        })?;
    let resolved = variants::resolve_symbol(symbol, None, context.sheet_path);
    let own = variants::symbol_flags(&resolved, None, legacy_in_bom(context.version));
    let flags = fold_sheet_flags(own, ancestors);
    let mut entry = Map::new();
    entry.insert(
        "kiidPath".to_owned(),
        Value::String(format!("{}/{}", context.sheet_path, symbol.uuid)),
    );
    entry.insert(
        "sheetPath".to_owned(),
        Value::String(context.sheet_path.to_owned()),
    );
    entry.insert("symbolUuid".to_owned(), Value::String(symbol.uuid.clone()));
    entry.insert(
        "documentPath".to_owned(),
        Value::String(context.document_path.to_owned()),
    );
    entry.insert("libId".to_owned(), Value::String(symbol.lib_id.clone()));
    if !reference.is_empty() {
        entry.insert("reference".to_owned(), Value::String(reference));
    }
    entry.insert("instanceMatched".to_owned(), Value::Bool(matched.is_some()));
    entry.insert("unit".to_owned(), Value::from(unit));
    insert_flags(&mut entry, flags);
    entry.insert("properties".to_owned(), property::sorted_value(&properties));
    entry.insert("bomFields".to_owned(), bom::canonical(&properties));
    entry.insert("variants".to_owned(), Value::Array(variants));
    Some(Value::Object(entry))
}

/// The five effective flags (occurrences.py:219-223).
fn insert_flags(entry: &mut Map<String, Value>, flags: Flags) {
    entry.insert("dnp".to_owned(), Value::Bool(flags.dnp));
    entry.insert(
        "excludeFromBom".to_owned(),
        Value::Bool(flags.exclude_from_bom),
    );
    entry.insert(
        "excludeFromBoard".to_owned(),
        Value::Bool(flags.exclude_from_board),
    );
    entry.insert(
        "excludeFromSim".to_owned(),
        Value::Bool(flags.exclude_from_sim),
    );
    entry.insert(
        "excludeFromPosFiles".to_owned(),
        Value::Bool(flags.exclude_from_pos_files),
    );
}

/// `_matched_instance(symbol, sheet_path, project_stem)` (occurrences.py:132-144):
/// the record whose `path` is the sheet path; the project named after the anchor
/// wins, else the first in file order. No suffix matching, no first-instance
/// fallback.
fn matched_instance<'a>(
    symbol: &'a SchematicPlacedSymbol,
    sheet_path: &str,
    project_stem: &str,
) -> Option<&'a SchematicSymbolInstance> {
    let mut fallback = None;
    for instance in &symbol.instances {
        if instance.path != sheet_path {
            continue;
        }
        if instance.project.as_ref() == project_stem {
            return Some(instance);
        }
        if fallback.is_none() {
            fallback = Some(instance);
        }
    }
    fallback
}

/// `int(matched.unit or symbol.unit or 1)` (occurrences.py:195).
fn instance_unit(matched_unit: i64, symbol_unit: i64) -> i64 {
    if matched_unit != 0 {
        matched_unit
    } else {
        unit_or_one(symbol_unit)
    }
}

/// `int(symbol.unit or 1)` when no instance matched (occurrences.py:199).
fn symbol_unit(unit: i64) -> i64 {
    unit_or_one(unit)
}

fn unit_or_one(unit: i64) -> i64 {
    if unit != 0 { unit } else { 1 }
}

/// The matched instance's records, unresolved, in file order
/// (occurrences.py:196).
fn symbol_variants(instance: &SchematicSymbolInstance, version: i64) -> Vec<Value> {
    let legacy = legacy_in_bom(version);
    instance
        .variants
        .iter()
        .map(|record| records::symbol_record(record, legacy))
        .collect()
}

/// `{flag: False for flag in SHEET_FLAGS}` (occurrences.py:169); the symbol's
/// own position-file flag is never folded from a sheet (packet N6).
fn empty_flags() -> SymbolFlags {
    SymbolFlags {
        dnp: false,
        exclude_from_bom: false,
        exclude_from_board: false,
        exclude_from_sim: false,
        exclude_from_pos_files: false,
    }
}

#[cfg(test)]
mod tests {
    use super::{instance_unit, symbol_unit};
    use crate::semantic_index::assembly::state::{
        Flags, SheetFlags, fold_sheet_flags, legacy_in_bom,
    };
    use crate::semantic_index::assembly::variants::SymbolFlags;

    fn flags(dnp: bool, pos: bool) -> SymbolFlags {
        SymbolFlags {
            dnp,
            exclude_from_bom: false,
            exclude_from_board: false,
            exclude_from_sim: false,
            exclude_from_pos_files: pos,
        }
    }

    /// `_fold_sheet_flags` ORs ancestor sheet state onto dnp/bom/board/sim but
    /// never position files (occurrences.py:216-233, packet N6).
    #[test]
    fn the_sheet_fold_never_touches_position_files() {
        let ancestors = [SheetFlags {
            dnp: true,
            exclude_from_bom: true,
            exclude_from_board: false,
            exclude_from_sim: false,
        }];
        let folded: Flags = fold_sheet_flags(flags(false, true), &ancestors);
        assert!(folded.dnp);
        assert!(folded.exclude_from_bom);
        assert!(folded.exclude_from_pos_files);
        let own = fold_sheet_flags(flags(false, false), &[]);
        assert!(!own.dnp && !own.exclude_from_bom && !own.exclude_from_pos_files);
    }

    /// No instance matched falls back to the form's unit, or 1
    /// (occurrences.py:195-199).
    #[test]
    fn unit_fallbacks() {
        assert_eq!(instance_unit(0, 4), 4);
        assert_eq!(instance_unit(3, 4), 3);
        assert_eq!(instance_unit(0, 0), 1);
        assert_eq!(symbol_unit(0), 1);
        assert_eq!(symbol_unit(2), 2);
    }

    /// `_legacy_in_bom` flips at `IN_BOM_POSITIVE_SINCE` (`siv:111-112`).
    #[test]
    fn legacy_gate_boundary() {
        assert!(legacy_in_bom(20260305));
        assert!(!legacy_in_bom(20260306));
    }
}
