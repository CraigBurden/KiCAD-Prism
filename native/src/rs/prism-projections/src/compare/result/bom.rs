//! The BOM tab (`/bom`): each revision's BOM rows from `occurrences`
//! (`field-maps/occurrences.md` "Design Comparison BOM rows"), diffed by
//! reference (`backend/app/services/bom_diff_service.py` `diff_boms`). The
//! columns are `Reference`, the head revision's `.prism.json` `bom.fields` (by
//! default `Reference`, `Value`, `Footprint`, `Datasheet`), then every
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
use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;
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

/// `_bom_fields`'s raw flag names; they become the `DNP` / `In BOM` labels and
/// are never extras.
const RAW_FLAGS: [&str; 2] = ["kicad_dnp", "kicad_in_bom"];

/// The reference labels `diff_boms` never exposes as columns.
const CLI_REFERENCE_ALIASES: [&str; 3] = ["Refs", "Ref", "references"];

/// The columns when the head revision's `.prism.json` names none
/// (`design_compare_service._comparison_bom_fields`).
const DEFAULT_COLUMNS: [&str; 4] = ["Reference", "Value", "Footprint", "Datasheet"];

/// One BOM row, keyed by column name. Every text borrows from the
/// `occurrences` member (or is a `'static` flag text); only the result owns
/// strings.
type Row<'a> = BTreeMap<&'a str, &'a str>;

/// One revision's BOM: the rows keyed by reference (the last row of a
/// multi-unit reference wins, as `diff_boms` keys them) and the column names
/// of every row, the replaced ones included.
struct Bom<'a> {
    rows: BTreeMap<&'a str, Row<'a>>,
    detected: BTreeSet<&'a str>,
}

pub(super) fn build(base: &Revision, head: &Revision, options: Options) -> dc::DesignCompareBom {
    let base_rows = bom_rows(&base.occurrences);
    let head_rows = bom_rows(&head.occurrences);
    let configured = fields(head);
    let configured: Vec<&str> = configured.iter().map(String::as_str).collect();
    let (changes, summary, columns) = diff_boms(
        &base_rows,
        &head_rows,
        &configured,
        options.include_unchanged,
    );
    dc::DesignCompareBom {
        fields: columns.into_iter().map(str::to_owned).collect(),
        changes,
        summary,
    }
}

/// The BOM columns configured by the head revision's `.prism.json`
/// `bom.fields` when it is a non-empty list of texts, else
/// [`DEFAULT_COLUMNS`] (`_comparison_bom_fields`). `diff_boms` prepends
/// `Reference` and appends every detected column.
pub(super) fn fields(head: &Revision) -> Vec<String> {
    columns_from_settings(head.prism_settings.as_ref())
}

fn columns_from_settings(settings: Option<&serde_json::Value>) -> Vec<String> {
    settings
        .and_then(|settings| settings.get("bom")?.get("fields")?.as_array())
        .map(|fields| {
            fields
                .iter()
                .filter_map(|field| field.as_str().map(str::to_owned))
                .collect::<Vec<_>>()
        })
        .filter(|fields| !fields.is_empty())
        .unwrap_or_else(|| DEFAULT_COLUMNS.map(str::to_owned).to_vec())
}

/// A power port or `PWR_FLAG`: lib id starting with `power:` after case
/// folding (`design_compare_occurrences.is_power_symbol`).
fn is_power_symbol(symbol: &OccurrencesSymbol) -> bool {
    symbol
        .lib_id
        .as_str()
        .get(..6)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("power:"))
}

/// The occurrence's BOM fields: the canonical labels from `bomFields` and the
/// folded flags, plus every property that is not a canonical label
/// (`design_compare_occurrences._bom_fields` over `_canonical_fields`).
fn symbol_fields(symbol: &OccurrencesSymbol) -> Row<'_> {
    let mut fields = Row::new();
    fields.insert("DNP", yes_no(symbol.dnp));
    fields.insert("In BOM", yes_no(!symbol.exclude_from_bom));
    for (label, value) in bom_field_values(&symbol.bom_fields) {
        fields.insert(label, value.unwrap_or(""));
    }
    for (key, value) in &symbol.properties.0 {
        let is_extra =
            !key.is_empty() && !is_canonical_label(key) && !RAW_FLAGS.contains(&key.as_str());
        if is_extra {
            fields.insert(key, value);
        }
    }
    fields
}

/// `bomFields` by canonical label (`_BOM_FIELD_LABELS`).
fn bom_field_values(bom_fields: &OccurrencesBomFields) -> [(&'static str, Option<&str>); 15] {
    let b = bom_fields;
    [
        ("Value", b.value.as_deref()),
        ("Description", b.description.as_deref()),
        ("Datasheet", b.datasheet.as_deref()),
        ("Manufacturer", b.manufacturer.as_deref()),
        (
            "Manufacturer Part Number",
            b.manufacturer_part_number.as_deref(),
        ),
        ("Vendor", b.vendor.as_deref()),
        ("Vendor Part Number", b.vendor_part_number.as_deref()),
        ("Footprint", b.footprint.as_deref()),
        ("Mass (g)", b.mass.as_deref()),
        ("RQjC (C/W)", b.rqjc.as_deref()),
        ("RQjC_top (C/W)", b.rqjc_top.as_deref()),
        ("Temp_max (C)", b.temp_max.as_deref()),
        ("Temp_min (C)", b.temp_min.as_deref()),
        ("Power Dissipation (W)", b.power_dissipation.as_deref()),
        ("Rate", b.rate.as_deref()),
    ]
}

fn is_canonical_label(key: &str) -> bool {
    CANONICAL_LABELS.contains(&key)
}

fn yes_no(value: bool) -> &'static str {
    if value { "Yes" } else { "No" }
}

/// The rows KiCad puts in the BOM (`design_compare_bundle_inputs.revision_components`,
/// `design_compare_occurrences.bom_rows`, then `diff_boms`' keying). A row
/// carries every field the occurrence has, with `Reference`, `Value` and
/// `Footprint` preferred from the component's own properties.
fn bom_rows(occurrences: &OccurrencesA0) -> Bom<'_> {
    let mut bom = Bom {
        rows: BTreeMap::new(),
        detected: BTreeSet::new(),
    };
    for symbol in &occurrences.symbols {
        if let Some((reference, row)) = bom_row(symbol) {
            bom.detected.extend(
                row.keys()
                    .copied()
                    .filter(|key| !key.is_empty() && !CLI_REFERENCE_ALIASES.contains(key)),
            );
            bom.rows.insert(reference, row);
        }
    }
    bom
}

fn bom_row(symbol: &OccurrencesSymbol) -> Option<(&str, Row<'_>)> {
    let reference = symbol.reference.as_ref().map_or("", |value| value.as_str());
    if reference.is_empty() || is_power_symbol(symbol) {
        return None;
    }
    let reference = reference.trim();
    if reference.is_empty() {
        return None;
    }
    let mut row = symbol_fields(symbol);
    let in_bom = row.get("In BOM").copied().unwrap_or("Yes").trim();
    if in_bom.eq_ignore_ascii_case("no") {
        return None;
    }
    let value = preferred(property(symbol, "Value"), row.get("Value").copied());
    let footprint = preferred(property(symbol, "Footprint"), row.get("Footprint").copied());
    row.insert("Reference", reference);
    row.insert("Value", value);
    row.insert("Footprint", footprint);
    Some((reference, row))
}

fn property<'a>(symbol: &'a OccurrencesSymbol, name: &str) -> &'a str {
    symbol.properties.0.get(name).map_or("", String::as_str)
}

/// Today's `Value` / `Footprint`: the component's own text first, then the
/// field's, else empty (`bom_rows`).
fn preferred<'a>(component_value: &'a str, field_value: Option<&'a str>) -> &'a str {
    if component_value.is_empty() {
        field_value.unwrap_or("")
    } else {
        component_value
    }
}

/// Diff the two sides by reference (`bom_diff_service.diff_boms`); the
/// columns are `Reference`, the configured fields, then every detected field.
#[allow(
    clippy::type_complexity,
    reason = "the three parts of the tab, borrowed until the caller owns them"
)]
fn diff_boms<'a>(
    old: &Bom<'a>,
    new: &Bom<'a>,
    configured: &[&'a str],
    include_unchanged: bool,
) -> (
    Vec<dc::DesignCompareBomRow>,
    dc::DesignCompareSummary,
    Vec<&'a str>,
) {
    let fields = columns(old, new, configured);
    let (old_rows, new_rows) = (&old.rows, &new.rows);
    let mut references: BTreeSet<&str> = old_rows.keys().copied().collect();
    references.extend(new_rows.keys().copied());

    let mut changes = Vec::new();
    let (mut added, mut removed, mut changed) = (0u64, 0u64, 0u64);
    for reference in references {
        let change = match (old_rows.get(reference), new_rows.get(reference)) {
            (None, Some(new)) => {
                added += 1;
                Some((dc::DesignCompareBomStatus::Added, None, Some(new), None))
            }
            (Some(old), None) => {
                removed += 1;
                Some((dc::DesignCompareBomStatus::Removed, Some(old), None, None))
            }
            (Some(old), Some(new)) => {
                let diffs = field_diffs(&fields, old, new);
                if !diffs.is_empty() {
                    changed += 1;
                    Some((
                        dc::DesignCompareBomStatus::Changed,
                        Some(old),
                        Some(new),
                        Some(dc::RecordDesignCompareBomFieldDiff(diffs)),
                    ))
                } else if include_unchanged {
                    Some((
                        dc::DesignCompareBomStatus::Unchanged,
                        Some(old),
                        Some(new),
                        None,
                    ))
                } else {
                    None
                }
            }
            (None, None) => None,
        };
        if let Some((status, old, new, diffs)) = change {
            changes.push(dc::DesignCompareBomRow {
                ref_: reference
                    .parse()
                    .expect("a BOM reference is non-empty and non-blank"),
                status,
                old: old.map(|row| snapshot(&fields, row)),
                new: new.map(|row| snapshot(&fields, row)),
                diffs,
            });
        }
    }
    let summary = dc::DesignCompareSummary {
        added: dc::Count(added),
        removed: dc::Count(removed),
        changed: dc::Count(changed),
    };
    (changes, summary, fields)
}

/// The columns: `Reference`, the configured fields, then every detected field
/// in code point order, deduplicated preserving the first occurrence.
fn columns<'a>(old: &Bom<'a>, new: &Bom<'a>, configured: &[&'a str]) -> Vec<&'a str> {
    let detected = old.detected.union(&new.detected).copied();
    let mut seen = BTreeSet::new();
    std::iter::once("Reference")
        .chain(configured.iter().copied())
        .chain(detected)
        .filter(|field| seen.insert(*field))
        .collect()
}

/// A row's text for every column, absent columns as empty.
fn snapshot(fields: &[&str], row: &Row<'_>) -> dc::RecordString {
    dc::RecordString(
        fields
            .iter()
            .map(|field| {
                (
                    (*field).to_owned(),
                    row.get(field).copied().unwrap_or("").to_owned(),
                )
            })
            .collect(),
    )
}

/// The columns that differ, with each side's text.
fn field_diffs(
    fields: &[&str],
    old: &Row<'_>,
    new: &Row<'_>,
) -> BTreeMap<String, dc::DesignCompareBomFieldDiff> {
    let mut diffs = BTreeMap::new();
    for field in fields {
        let old_value = old.get(field).copied().unwrap_or("");
        let new_value = new.get(field).copied().unwrap_or("");
        if old_value != new_value {
            diffs.insert(
                (*field).to_owned(),
                dc::DesignCompareBomFieldDiff {
                    old: old_value.to_owned(),
                    new: new_value.to_owned(),
                },
            );
        }
    }
    diffs
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn symbol(
        reference: &str,
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
            "reference": reference,
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

    fn occurrences(symbols: Vec<OccurrencesSymbol>) -> OccurrencesA0 {
        let mut document: OccurrencesA0 = serde_json::from_value(json!({
            "schema": "prism.occurrences.a0",
            "sheets": [],
            "symbols": [],
            "footprints": [],
            "references": [],
            "variantDeclarations": []
        }))
        .unwrap();
        document.symbols = symbols;
        document
    }

    fn bom<'a>(rows: &[(&'a str, &'a str)]) -> Bom<'a> {
        let mut bom = Bom {
            rows: BTreeMap::new(),
            detected: BTreeSet::new(),
        };
        for (reference, value) in rows {
            let row = Row::from([("Reference", *reference), ("Value", *value)]);
            bom.detected.extend(row.keys().copied());
            bom.rows.insert(reference, row);
        }
        bom
    }

    #[test]
    fn canonical_text_comes_from_bom_fields_and_extras_from_properties() {
        let symbol = symbol(
            "R1",
            json!({"Value": "R_old", "Reference": "R1", "DNP": "ignored", "Custom": "c", "kicad_dnp": "ignored"}),
            json!({"value": "R_new", "datasheet": "ds"}),
            true,
            false,
        );
        let fields = symbol_fields(&symbol);
        // The 15 canonical labels are present, taken from `bomFields`.
        for (label, _) in bom_field_values(&symbol.bom_fields) {
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
    fn bom_rows_filter_out_of_bom_parts_and_prefer_the_component_text() {
        let document = occurrences(vec![
            symbol(
                "R1",
                json!({"Value": "v1", "Footprint": "f1"}),
                json!({"value": "field", "footprint": "field"}),
                false,
                false,
            ),
            symbol("R2", json!({}), json!({}), false, true),
            symbol(
                " R3 ",
                json!({}),
                json!({"value": "fallback", "footprint": "fallback"}),
                false,
                false,
            ),
        ]);
        let bom = bom_rows(&document);
        assert_eq!(
            bom.rows.keys().copied().collect::<Vec<_>>(),
            vec!["R1", "R3"]
        );
        assert_eq!(bom.rows["R1"]["Value"], "v1");
        assert_eq!(bom.rows["R1"]["Footprint"], "f1");
        assert_eq!(bom.rows["R3"]["Reference"], "R3");
        assert_eq!(bom.rows["R3"]["Value"], "fallback");
    }

    #[test]
    fn a_replaced_unit_still_contributes_its_columns() {
        let document = occurrences(vec![
            symbol("U1", json!({"Only A": "x"}), json!({}), false, false),
            symbol("U1", json!({}), json!({}), false, false),
        ]);
        let bom = bom_rows(&document);
        assert!(!bom.rows["U1"].contains_key("Only A"));
        assert!(bom.detected.contains("Only A"));
    }

    #[test]
    fn diff_boms_reports_added_removed_and_the_detected_columns() {
        let old = bom(&[("R1", "a"), ("R2", "b")]);
        let new = bom(&[("R1", "a"), ("R3", "c")]);
        let (changes, summary, fields) = diff_boms(&old, &new, &[], false);
        // `Reference` first, then every detected column in code point order.
        assert_eq!(fields, vec!["Reference", "Value"]);
        assert_eq!(
            (summary.added.0, summary.removed.0, summary.changed.0),
            (1, 1, 0)
        );
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
        let old = bom(&[("R1", "a"), ("R9", "z")]);
        let new = bom(&[("R1", "b"), ("R9", "z")]);
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
        assert_eq!(changes[1].status, dc::DesignCompareBomStatus::Unchanged);
        assert!(changes[1].diffs.is_none());
    }

    #[test]
    fn configured_columns_come_first_and_default_when_unset() {
        let defaults: Vec<String> = DEFAULT_COLUMNS.map(str::to_owned).to_vec();
        assert_eq!(columns_from_settings(None), defaults);
        assert_eq!(columns_from_settings(Some(&json!({"bom": {}}))), defaults);
        assert_eq!(
            columns_from_settings(Some(&json!({"bom": {"fields": []}}))),
            defaults
        );
        assert_eq!(
            columns_from_settings(Some(&json!({"bom": {"fields": ["MPN", "Value"]}}))),
            vec!["MPN", "Value"]
        );
        let old = bom(&[("R1", "a")]);
        let (_, _, fields) = diff_boms(&old, &old, &["Value", "Footprint", "Datasheet"], false);
        assert_eq!(fields, vec!["Reference", "Value", "Footprint", "Datasheet"]);
    }
}
