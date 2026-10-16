//! One raw `(variant …)` record as `OccurrencesVariantRecord`: `_record`
//! (occurrences.py:96-129).

use super::support::string_object;
use crate::semantic_index::assembly::variants::VariantRecord;
use prism_kicad_core::SchematicSymbolInstanceVariant;
use serde_json::{Map, Value};

/// `name`, plus `dnp` when the record sets it (`occurrences.py:101-103`).
fn base(name: &str, dnp: Option<bool>) -> Map<String, Value> {
    let mut out = Map::new();
    out.insert("name".to_owned(), Value::String(name.to_owned()));
    if let Some(dnp) = dnp {
        out.insert("dnp".to_owned(), Value::Bool(dnp));
    }
    out
}

/// The record's `fields`, keys in code point order (`occurrences.py:128`).
fn with_fields(
    mut out: Map<String, Value>,
    fields: impl IntoIterator<Item = (String, String)>,
) -> Value {
    out.insert("fields".to_owned(), string_object(fields));
    Value::Object(out)
}

/// `_record(r, holder="sheet", version=…)` (occurrences.py:96-129): a sheet
/// symbol's record. `excludeFromBom` reads `(in_bom …)` through the file
/// version's polarity (`siv:145-153`); sheets never carry `excludeFromPosFiles`.
pub(crate) fn sheet_record(record: &VariantRecord, legacy_in_bom: bool) -> Value {
    let mut out = base(&record.name, record.dnp);
    if let Some(in_bom) = record.in_bom {
        out.insert(
            "excludeFromBom".to_owned(),
            Value::Bool(if legacy_in_bom { in_bom } else { !in_bom }),
        );
    }
    if let Some(on_board) = record.on_board {
        out.insert("excludeFromBoard".to_owned(), Value::Bool(!on_board));
    }
    if let Some(exclude_from_sim) = record.exclude_from_sim {
        out.insert("excludeFromSim".to_owned(), Value::Bool(exclude_from_sim));
    }
    with_fields(out, record.fields.iter().cloned())
}

/// `_record(r, holder="symbol", version=…)` (occurrences.py:96-129): a symbol
/// instance record. `in_bom` is positive logic from `20260306` and the excluded
/// flag before it (`siv:145-153`); `in_pos_files` is inverted.
pub(crate) fn symbol_record(record: &SchematicSymbolInstanceVariant, legacy_in_bom: bool) -> Value {
    let mut out = base(&record.name, record.dnp);
    if let Some(in_bom) = record.in_bom {
        out.insert(
            "excludeFromBom".to_owned(),
            Value::Bool(if legacy_in_bom { in_bom } else { !in_bom }),
        );
    }
    if let Some(on_board) = record.on_board {
        out.insert("excludeFromBoard".to_owned(), Value::Bool(!on_board));
    }
    if let Some(exclude_from_sim) = record.exclude_from_sim {
        out.insert("excludeFromSim".to_owned(), Value::Bool(exclude_from_sim));
    }
    if let Some(in_pos_files) = record.in_pos_files {
        out.insert("excludeFromPosFiles".to_owned(), Value::Bool(!in_pos_files));
    }
    with_fields(
        out,
        record
            .fields
            .iter()
            .map(|field| (field.name.clone(), field.value.clone())),
    )
}

/// `_record(r, holder="footprint")` (occurrences.py:96-129): a footprint
/// record, whose tokens are already exclusion flags.
pub(crate) fn footprint_record(record: &VariantRecord) -> Value {
    let mut out = base(&record.name, record.dnp);
    if let Some(exclude_from_bom) = record.exclude_from_bom {
        out.insert("excludeFromBom".to_owned(), Value::Bool(exclude_from_bom));
    }
    if let Some(exclude_from_pos_files) = record.exclude_from_pos_files {
        out.insert(
            "excludeFromPosFiles".to_owned(),
            Value::Bool(exclude_from_pos_files),
        );
    }
    with_fields(out, record.fields.iter().cloned())
}

#[cfg(test)]
mod tests {
    use super::{VariantRecord, footprint_record, sheet_record, symbol_record};
    use prism_kicad_core::{SchematicSymbolInstanceVariant, SchematicSymbolVariantField};
    use serde_json::json;

    fn sheet_payload(record: &VariantRecord, legacy: bool) -> serde_json::Value {
        sheet_record(record, legacy)
    }

    /// The sheet `in_bom` polarity gate (`siv:145-153`, occurrences.py:116).
    #[test]
    fn sheet_in_bom_is_read_by_the_file_version() {
        let mut record = VariantRecord {
            name: "Lite".to_owned(),
            ..VariantRecord::default()
        };
        record.in_bom = Some(true);
        record.on_board = Some(false);
        record.exclude_from_sim = Some(true);
        assert_eq!(
            sheet_payload(&record, true),
            json!({"name": "Lite", "excludeFromBom": true, "excludeFromBoard": true,
                   "excludeFromSim": true, "fields": {}})
        );
        assert_eq!(
            sheet_payload(&record, false),
            json!({"name": "Lite", "excludeFromBom": false, "excludeFromBoard": true,
                   "excludeFromSim": true, "fields": {}})
        );
    }

    /// A sheet record never carries position-file state (occurrences.py:112-122).
    #[test]
    fn sheet_records_have_no_position_files_field() {
        let record = VariantRecord {
            name: "Pro".to_owned(),
            in_pos_files: Some(false),
            ..VariantRecord::default()
        };
        let value = sheet_payload(&record, false);
        assert!(value.get("excludeFromPosFiles").is_none());
    }

    /// The symbol record gates `in_bom` and inverts `in_pos_files`
    /// (occurrences.py:121).
    #[test]
    fn symbol_record_shapes_all_flags() {
        let record = SchematicSymbolInstanceVariant {
            name: "Lite".to_owned(),
            dnp: Some(true),
            exclude_from_sim: Some(true),
            in_bom: Some(true),
            on_board: Some(false),
            in_pos_files: Some(false),
            fields: vec![SchematicSymbolVariantField {
                name: "MPN".to_owned(),
                value: "A-LITE".to_owned(),
            }],
        };
        assert_eq!(
            symbol_record(&record, true),
            json!({"name": "Lite", "dnp": true, "excludeFromBom": true,
                   "excludeFromBoard": true, "excludeFromSim": true,
                   "excludeFromPosFiles": true,
                   "fields": {"MPN": "A-LITE"}})
        );
        assert_eq!(
            symbol_record(&record, false),
            json!({"name": "Lite", "dnp": true, "excludeFromBom": false,
                   "excludeFromBoard": true, "excludeFromSim": true,
                   "excludeFromPosFiles": true,
                   "fields": {"MPN": "A-LITE"}})
        );
    }

    /// The footprint record uses the exclusion tokens directly and sorts fields
    /// (occurrences.py:104-111, :128).
    #[test]
    fn footprint_record_sorts_fields_and_uses_exclusion_tokens() {
        let record = VariantRecord {
            name: "Lite".to_owned(),
            dnp: Some(false),
            exclude_from_bom: Some(true),
            exclude_from_pos_files: Some(true),
            fields: vec![
                ("Value".to_owned(), "10k".to_owned()),
                ("MPN".to_owned(), "A".to_owned()),
            ],
            ..VariantRecord::default()
        };
        assert_eq!(
            footprint_record(&record),
            json!({"name": "Lite", "dnp": false, "excludeFromBom": true,
                   "excludeFromPosFiles": true,
                   "fields": {"MPN": "A", "Value": "10k"}})
        );
    }
}
