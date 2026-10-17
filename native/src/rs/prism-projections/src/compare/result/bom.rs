//! The BOM tab (`/bom`): each revision's BOM rows from `occurrences`
//! (`field-maps/occurrences.md` "Design Comparison BOM rows"), diffed by
//! reference (`backend/app/services/bom_diff_service.py` `diff_boms`). The
//! columns are the head revision's `.prism.json` `bom.fields`, then every
//! column the rows carry (`backend/app/services/design_compare_bundle_inputs.py`
//! `revision_components`, `design_compare_occurrences.py` `bom_rows`).
//!
//! The canonical column texts come from the member's `bomFields`, never
//! re-picked from `properties`: `properties` is a code-point-ordered map and
//! the producer's name folding lets two names collide, so a re-pick would
//! depend on key order. The extras (properties that are not one of the
//! canonical labels) do come from `properties`, with `Reference` among them
//! (occurrences.md "Extras").

use std::collections::{BTreeMap, BTreeSet};

use super::{Options, Revision};
use prism_kicad_contracts::generated::prism_design_compare_result_a0 as dc;
use prism_kicad_contracts::generated::prism_occurrences_a0::{
    OccurrencesA0, OccurrencesBomFields, OccurrencesSymbol,
};

/// The 17 canonical BOM labels (`semantic_index_service._canonical_fields`).
/// `DNP` and `In BOM` are the occurrence's flags; the other 15 are
/// `bomFields`. A property named exactly one of these is not an extra.
const CANONICAL_LABELS: [&str; 17] = [
    "Value",
    "DNP",
    "In BOM",
    "Description",
    "Datasheet",
    "Manufacturer",
    "Manufacturer Part Number",
    "Vendor",
    "Vendor Part Number",
    "Footprint",
    "Mass (g)",
    "RQjC (C/W)",
    "RQjC_top (C/W)",
    "Temp_max (C)",
    "Temp_min (C)",
    "Power Dissipation (W)",
    "Rate",
];

/// `bomFields` keys and the canonical labels they fill
/// (`design_compare_bundle_inputs._BOM_FIELD_LABELS`).
const BOM_FIELD_LABELS: [(&str, &str); 15] = [
    ("value", "Value"),
    ("description", "Description"),
    ("datasheet", "Datasheet"),
    ("manufacturer", "Manufacturer"),
    ("manufacturerPartNumber", "Manufacturer Part Number"),
    ("vendor", "Vendor"),
    ("vendorPartNumber", "Vendor Part Number"),
    ("footprint", "Footprint"),
    ("mass", "Mass (g)"),
    ("rqjc", "RQjC (C/W)"),
    ("rqjcTop", "RQjC_top (C/W)"),
    ("tempMax", "Temp_max (C)"),
    ("tempMin", "Temp_min (C)"),
    ("powerDissipation", "Power Dissipation (W)"),
    ("rate", "Rate"),
];

/// `_bom_fields`'s raw flag names; they become the `DNP` / `In BOM` labels and
/// are never extras.
const RAW_FLAGS: [&str; 2] = ["kicad_dnp", "kicad_in_bom"];

/// The reference labels `diff_boms` never exposes as columns.
const CLI_REFERENCE_ALIASES: [&str; 3] = ["Refs", "Ref", "references"];

/// One BOM row, keyed by column name.
type Row = BTreeMap<String, String>;

/// One component occurrence, reduced to what the BOM reads.
struct Component {
    reference: String,
    /// `properties.Value`, today's preferred `Value` text.
    value: String,
    /// `properties.Footprint`, today's preferred `Footprint` text.
    footprint: String,
    /// The 17 canonical labels, the extras, and the folded `DNP` / `In BOM`.
    fields: BTreeMap<String, String>,
}

pub(super) fn build(base: &Revision, head: &Revision, options: Options) -> dc::DesignCompareBom {
    let base_rows = bom_rows(&components(&base.occurrences));
    let head_rows = bom_rows(&components(&head.occurrences));
    let (changes, summary, columns) = diff_boms(
        &base_rows,
        &head_rows,
        &fields(head),
        options.include_unchanged,
    );
    dc::DesignCompareBom {
        fields: columns,
        changes,
        summary,
    }
}

/// The BOM columns configured by the head revision's `.prism.json`
/// `bom.fields`, when it is a non-empty list of texts. An unconfigured project
/// contributes none: the columns are then the detected ones alone
/// (`diff_boms` prepends `Reference` and appends every detected field). The
/// C2-a bundle path reads no configured columns, so the result matches it.
pub(super) fn fields(head: &Revision) -> Vec<String> {
    columns_from_settings(head.prism_settings.as_ref())
}

fn columns_from_settings(settings: Option<&serde_json::Value>) -> Vec<String> {
    settings
        .and_then(|settings| settings.get("bom")?.get("fields")?.as_array().cloned())
        .map(|fields| {
            fields
                .iter()
                .filter_map(|field| field.as_str().map(str::to_owned))
                .collect::<Vec<_>>()
        })
        .filter(|fields| !fields.is_empty())
        .unwrap_or_default()
}

/// One component per symbol occurrence, in `occurrences` order
/// (`design_compare_bundle_inputs.revision_components`): power symbols and
/// occurrences without a reference are skipped.
fn components(occurrences: &OccurrencesA0) -> Vec<Component> {
    let mut components = Vec::new();
    for symbol in &occurrences.symbols {
        let reference = symbol.reference.as_ref().map_or("", |value| value.as_str());
        if reference.is_empty() || is_power_symbol(symbol) {
            continue;
        }
        components.push(Component {
            reference: reference.to_owned(),
            value: property(symbol, "Value"),
            footprint: property(symbol, "Footprint"),
            fields: symbol_fields(symbol),
        });
    }
    components
}

/// A power port or `PWR_FLAG`: lib id starting with `power:` after case
/// folding (`design_compare_occurrences.is_power_symbol`).
fn is_power_symbol(symbol: &OccurrencesSymbol) -> bool {
    symbol.lib_id.as_str().to_lowercase().starts_with("power:")
}

fn property(symbol: &OccurrencesSymbol, name: &str) -> String {
    symbol.properties.0.get(name).cloned().unwrap_or_default()
}

/// The occurrence's BOM fields: the canonical labels from `bomFields` and the
/// folded flags, plus every property that is not a canonical label
/// (`design_compare_occurrences._bom_fields` over `_canonical_fields`).
fn symbol_fields(symbol: &OccurrencesSymbol) -> BTreeMap<String, String> {
    let mut fields = BTreeMap::new();
    fields.insert("DNP".to_owned(), yes_no(symbol.dnp));
    fields.insert("In BOM".to_owned(), yes_no(!symbol.exclude_from_bom));
    let values = bom_field_values(&symbol.bom_fields);
    for (key, label) in BOM_FIELD_LABELS {
        let value = values.get(key).and_then(|value| *value).unwrap_or("");
        fields.insert(label.to_owned(), value.to_owned());
    }
    for (key, value) in &symbol.properties.0 {
        let is_extra =
            !key.is_empty() && !is_canonical_label(key) && !RAW_FLAGS.contains(&key.as_str());
        if is_extra {
            fields.insert(key.clone(), value.clone());
        }
    }
    fields
}

/// `bomFields` by its member key, for the label lookup above.
fn bom_field_values(bom_fields: &OccurrencesBomFields) -> BTreeMap<&'static str, Option<&str>> {
    let mut values = BTreeMap::new();
    values.insert("value", bom_fields.value.as_deref());
    values.insert("description", bom_fields.description.as_deref());
    values.insert("datasheet", bom_fields.datasheet.as_deref());
    values.insert("manufacturer", bom_fields.manufacturer.as_deref());
    values.insert(
        "manufacturerPartNumber",
        bom_fields.manufacturer_part_number.as_deref(),
    );
    values.insert("vendor", bom_fields.vendor.as_deref());
    values.insert("vendorPartNumber", bom_fields.vendor_part_number.as_deref());
    values.insert("footprint", bom_fields.footprint.as_deref());
    values.insert("mass", bom_fields.mass.as_deref());
    values.insert("rqjc", bom_fields.rqjc.as_deref());
    values.insert("rqjcTop", bom_fields.rqjc_top.as_deref());
    values.insert("tempMax", bom_fields.temp_max.as_deref());
    values.insert("tempMin", bom_fields.temp_min.as_deref());
    values.insert("powerDissipation", bom_fields.power_dissipation.as_deref());
    values.insert("rate", bom_fields.rate.as_deref());
    values
}

fn is_canonical_label(key: &str) -> bool {
    CANONICAL_LABELS.contains(&key)
}

fn yes_no(value: bool) -> String {
    if value {
        "Yes".to_owned()
    } else {
        "No".to_owned()
    }
}

/// The BOM rows KiCad puts in the BOM, sorted by reference
/// (`design_compare_occurrences.bom_rows`). A row carries every field the
/// occurrence has, with `Reference`, `Value` and `Footprint` preferred from
/// the component.
fn bom_rows(components: &[Component]) -> Vec<Row> {
    let mut rows: Vec<Row> = Vec::new();
    for component in components {
        let reference = component.reference.trim();
        if reference.is_empty() {
            continue;
        }
        let mut row: Row = component
            .fields
            .iter()
            .filter(|(key, _)| !key.is_empty())
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect();
        let in_bom = row
            .get("In BOM")
            .map_or("Yes", String::as_str)
            .trim()
            .to_lowercase();
        if in_bom == "no" {
            continue;
        }
        let value = preferred(&component.value, row.get("Value"));
        let footprint = preferred(&component.footprint, row.get("Footprint"));
        row.insert("Reference".to_owned(), reference.to_owned());
        row.insert("Value".to_owned(), value);
        row.insert("Footprint".to_owned(), footprint);
        rows.push(row);
    }
    rows.sort_by(|left, right| reference_of(left).cmp(reference_of(right)));
    rows
}

/// Today's `Value` / `Footprint`: the component's own text first, then the
/// field's, else empty (`bom_rows`).
fn preferred(component_value: &str, field_value: Option<&String>) -> String {
    if !component_value.is_empty() {
        component_value.to_owned()
    } else {
        field_value.cloned().unwrap_or_default()
    }
}

fn reference_of(row: &Row) -> &str {
    row.get("Reference").map_or("", String::as_str)
}

/// Diff the two sides by reference (`bom_diff_service.diff_boms`): rows are
/// keyed by reference, so the last row of a multi-unit reference wins; the
/// columns are `Reference`, the configured fields, then every detected field.
fn diff_boms(
    old_rows: &[Row],
    new_rows: &[Row],
    configured: &[String],
    include_unchanged: bool,
) -> (
    Vec<dc::DesignCompareBomRow>,
    dc::DesignCompareSummary,
    Vec<String>,
) {
    let old_map = row_map(old_rows);
    let new_map = row_map(new_rows);
    let mut references: BTreeSet<&str> = BTreeSet::new();
    references.extend(old_map.keys().map(String::as_str));
    references.extend(new_map.keys().map(String::as_str));
    let fields = columns(old_rows, new_rows, configured);

    let mut changes = Vec::new();
    let (mut added, mut removed, mut changed) = (0u64, 0u64, 0u64);
    for reference in references {
        let old = old_map.get(reference);
        let new = new_map.get(reference);
        match (old, new) {
            (None, Some(new)) => {
                added += 1;
                changes.push(row_change(
                    reference,
                    dc::DesignCompareBomStatus::Added,
                    None,
                    Some(snapshot(&fields, new)),
                    None,
                ));
            }
            (Some(old), None) => {
                removed += 1;
                changes.push(row_change(
                    reference,
                    dc::DesignCompareBomStatus::Removed,
                    Some(snapshot(&fields, old)),
                    None,
                    None,
                ));
            }
            (Some(old), Some(new)) => {
                let diffs = field_diffs(&fields, old, new);
                if !diffs.is_empty() {
                    changed += 1;
                    changes.push(row_change(
                        reference,
                        dc::DesignCompareBomStatus::Changed,
                        Some(snapshot(&fields, old)),
                        Some(snapshot(&fields, new)),
                        Some(dc::RecordDesignCompareBomFieldDiff(diffs)),
                    ));
                } else if include_unchanged {
                    changes.push(row_change(
                        reference,
                        dc::DesignCompareBomStatus::Unchanged,
                        Some(snapshot(&fields, old)),
                        Some(snapshot(&fields, new)),
                        None,
                    ));
                }
            }
            (None, None) => {}
        }
    }
    let summary = dc::DesignCompareSummary {
        added: dc::Count(added),
        removed: dc::Count(removed),
        changed: dc::Count(changed),
    };
    (changes, summary, fields)
}

/// `{reference: row}`; a duplicate reference keeps the last row.
fn row_map(rows: &[Row]) -> BTreeMap<String, Row> {
    let mut map = BTreeMap::new();
    for row in rows {
        let reference = reference_of(row).trim();
        if !reference.is_empty() {
            map.insert(reference.to_owned(), row.clone());
        }
    }
    map
}

/// The columns: `Reference`, the configured fields, then every detected field
/// in code point order, deduplicated preserving the first occurrence.
fn columns(old_rows: &[Row], new_rows: &[Row], configured: &[String]) -> Vec<String> {
    let mut detected: BTreeSet<&str> = BTreeSet::new();
    for row in old_rows.iter().chain(new_rows) {
        for key in row.keys() {
            if !key.is_empty() && !CLI_REFERENCE_ALIASES.contains(&key.as_str()) {
                detected.insert(key);
            }
        }
    }
    let mut fields = Vec::new();
    let mut seen = BTreeSet::new();
    let ordered = std::iter::once("Reference".to_owned())
        .chain(configured.iter().cloned())
        .chain(detected.into_iter().map(str::to_owned));
    for field in ordered {
        if seen.insert(field.clone()) {
            fields.push(field);
        }
    }
    fields
}

/// A row's text for every column, absent columns as empty.
fn snapshot(fields: &[String], row: &Row) -> dc::RecordString {
    dc::RecordString(
        fields
            .iter()
            .map(|field| (field.clone(), row.get(field).cloned().unwrap_or_default()))
            .collect(),
    )
}

/// The columns that differ, with each side's text.
fn field_diffs(
    fields: &[String],
    old: &Row,
    new: &Row,
) -> BTreeMap<String, dc::DesignCompareBomFieldDiff> {
    let mut diffs = BTreeMap::new();
    for field in fields {
        let old_value = old.get(field).map_or("", String::as_str);
        let new_value = new.get(field).map_or("", String::as_str);
        if old_value != new_value {
            diffs.insert(
                field.clone(),
                dc::DesignCompareBomFieldDiff {
                    old: old_value.to_owned(),
                    new: new_value.to_owned(),
                },
            );
        }
    }
    diffs
}

fn row_change(
    reference: &str,
    status: dc::DesignCompareBomStatus,
    old: Option<dc::RecordString>,
    new: Option<dc::RecordString>,
    diffs: Option<dc::RecordDesignCompareBomFieldDiff>,
) -> dc::DesignCompareBomRow {
    dc::DesignCompareBomRow {
        ref_: reference
            .parse()
            .expect("a BOM reference is non-empty and non-blank"),
        status,
        old,
        new,
        diffs,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn symbol(
        properties: serde_json::Value,
        bom_fields: serde_json::Value,
        dnp: bool,
        exclude_from_bom: bool,
    ) -> OccurrencesSymbol {
        serde_json::from_value(json!({
            "kiidPath": "/root/uuid",
            "sheetPath": "/root",
            "symbolUuid": "uuid",
            "documentPath": "board.kicad_sch",
            "libId": "Device:R",
            "reference": "R1",
            "instanceMatched": true,
            "unit": 1,
            "dnp": dnp,
            "excludeFromBom": exclude_from_bom,
            "excludeFromBoard": false,
            "excludeFromSim": false,
            "excludeFromPosFiles": false,
            "properties": properties,
            "bomFields": bom_fields,
            "variants": []
        }))
        .unwrap()
    }

    fn row(reference: &str, value: &str) -> Row {
        BTreeMap::from([
            ("Reference".to_owned(), reference.to_owned()),
            ("Value".to_owned(), value.to_owned()),
        ])
    }

    #[test]
    fn canonical_text_comes_from_bom_fields_and_extras_from_properties() {
        let symbol = symbol(
            json!({
                "Value": "R_old",
                "Reference": "R1",
                "DNP": "ignored",
                "Custom": "c",
                "kicad_dnp": "ignored"
            }),
            json!({"value": "R_new", "datasheet": "ds"}),
            true,
            false,
        );
        let fields = symbol_fields(&symbol);
        // The 15 canonical labels are present, taken from `bomFields`.
        for (_, label) in BOM_FIELD_LABELS {
            assert!(fields.contains_key(label), "missing {label}");
        }
        assert_eq!(fields["Value"], "R_new");
        assert_eq!(fields["Datasheet"], "ds");
        assert_eq!(fields["DNP"], "Yes");
        assert_eq!(fields["In BOM"], "Yes");
        // Extras come from `properties`, `Reference` included; a canonical
        // label and the raw flags do not.
        assert_eq!(fields["Custom"], "c");
        assert_eq!(fields["Reference"], "R1");
        assert!(!fields.contains_key("kicad_dnp"));
    }

    #[test]
    fn bom_rows_filters_out_of_bom_components_and_prefers_the_component_text() {
        let components = vec![
            Component {
                reference: "R1".to_owned(),
                value: "v1".to_owned(),
                footprint: "f1".to_owned(),
                fields: BTreeMap::from([
                    ("In BOM".to_owned(), "Yes".to_owned()),
                    ("Value".to_owned(), "field".to_owned()),
                    ("Footprint".to_owned(), "field".to_owned()),
                ]),
            },
            Component {
                reference: "R2".to_owned(),
                value: String::new(),
                footprint: String::new(),
                fields: BTreeMap::from([("In BOM".to_owned(), "No".to_owned())]),
            },
            Component {
                reference: " R3 ".to_owned(),
                value: String::new(),
                footprint: String::new(),
                fields: BTreeMap::from([
                    ("In BOM".to_owned(), "Yes".to_owned()),
                    ("Value".to_owned(), "fallback".to_owned()),
                    ("Footprint".to_owned(), "fallback".to_owned()),
                ]),
            },
        ];
        let rows = bom_rows(&components);
        assert_eq!(rows.len(), 2);
        assert_eq!(reference_of(&rows[0]), "R1");
        assert_eq!(rows[0]["Value"], "v1");
        assert_eq!(rows[0]["Footprint"], "f1");
        assert_eq!(reference_of(&rows[1]), "R3");
        assert_eq!(rows[1]["Value"], "fallback");
        assert_eq!(rows[1]["Footprint"], "fallback");
    }

    #[test]
    fn diff_boms_reports_added_removed_and_the_detected_columns() {
        let old = vec![row("R1", "a"), row("R2", "b")];
        let new = vec![row("R1", "a"), row("R3", "c")];
        let (changes, summary, fields) = diff_boms(&old, &new, &[], false);
        // `Reference` first, then every detected column in code point order.
        assert_eq!(fields, vec!["Reference", "Value"]);
        assert_eq!(summary.added.0, 1);
        assert_eq!(summary.removed.0, 1);
        assert_eq!(summary.changed.0, 0);
        assert_eq!(changes.len(), 2);
        assert_eq!(changes[0].ref_, "R2".parse().unwrap());
        assert_eq!(changes[0].status, dc::DesignCompareBomStatus::Removed);
        assert!(changes[0].new.is_none());
        assert_eq!(changes[0].old.as_ref().unwrap().0["Value"], "b");
        assert_eq!(changes[1].ref_, "R3".parse().unwrap());
        assert_eq!(changes[1].status, dc::DesignCompareBomStatus::Added);
        assert!(changes[1].old.is_none());
        assert_eq!(changes[1].new.as_ref().unwrap().0["Value"], "c");
    }

    #[test]
    fn diff_boms_reports_changed_and_optionally_unchanged() {
        let old = vec![row("R1", "a"), row("R9", "z")];
        let new = vec![row("R1", "b"), row("R9", "z")];
        let (changes, summary, _) = diff_boms(&old, &new, &[], false);
        assert_eq!(summary.changed.0, 1);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].status, dc::DesignCompareBomStatus::Changed);
        let diffs = changes[0].diffs.as_ref().unwrap().0.clone();
        assert_eq!(diffs["Value"].old, "a");
        assert_eq!(diffs["Value"].new, "b");

        let (changes, summary, _) = diff_boms(&old, &new, &[], true);
        assert_eq!(summary.changed.0, 1);
        assert_eq!(changes.len(), 2);
        assert_eq!(changes[0].status, dc::DesignCompareBomStatus::Changed);
        assert_eq!(changes[1].status, dc::DesignCompareBomStatus::Unchanged);
        assert!(changes[1].diffs.is_none());
    }

    #[test]
    fn configured_fields_only_when_the_project_names_them() {
        assert_eq!(columns_from_settings(None), Vec::<String>::new());
        assert_eq!(
            columns_from_settings(Some(&json!({"bom": {}}))),
            Vec::<String>::new()
        );
        assert_eq!(
            columns_from_settings(Some(&json!({"bom": {"fields": ["Reference", "Value"]}}))),
            vec!["Reference", "Value"]
        );
    }
}
