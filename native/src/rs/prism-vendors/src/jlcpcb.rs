//! The JLCPCB vendor module.
//!
//! Ported from Cruncher 2026.9.7 (MIT): the tables are
//! `kicad_cruncher_cmd_bom.py`'s `_write_configured_bom_artifact` (`jlc-csv`,
//! `jlc-xlsx`), `kicad_cruncher_cmd_pnp.py`'s (`jlc-cpl`,
//! `jlc-cpl-xlsx`), and the shared rows, grouping, sorting and formatting are
//! `bom_pnp_model.py` (`jlc_bom_rows`, `jlc_cpl_rows`, `group_bom_components`,
//! `ordered_bom_lines`, `sort_placements`, `_format_decimal`,
//! `_jlc_layer_name`, `_normalize_degrees`).
//!
//! The configuration is `configs/jlcpcb.config.json`
//! (`prism.vendor.jlcpcb.config.a0`).

use crate::design::{Component, Design};
use crate::xlsx;
use crate::{Error, Excluded, Run, Vendor, VendorFile, VendorInput, VendorOutput};
use prism_kicad_contracts::generated::prism_cli_vendor_list_a0::{
    CliVendorOutputFormat, CliVendorOutputKind,
};
use prism_kicad_contracts::generated::prism_vendor_jlcpcb_config_a0::{
    VendorJlcpcbConfigA0, VendorJlcpcbPnpUnits,
};
use std::collections::BTreeMap;

/// The registered JLCPCB vendor.
pub const JLCPCB: Jlcpcb = Jlcpcb;

/// The JLCPCB BOM columns (`bom_pnp_model.py` `JLC_BOM_COLUMNS`).
pub const JLC_BOM_COLUMNS: [&str; 4] = ["Comment", "Designator", "Footprint", "JLCPCB Part #"];
/// The JLCPCB CPL columns (`bom_pnp_model.py` `JLC_CPL_COLUMNS`).
pub const JLC_CPL_COLUMNS: [&str; 5] = ["Designator", "Layer", "Mid X", "Mid Y", "Rotation"];

const OUTPUTS: [VendorOutput; 4] = [
    VendorOutput {
        kind: CliVendorOutputKind::Bom,
        format: CliVendorOutputFormat::Csv,
        version: "1.0.0",
    },
    VendorOutput {
        kind: CliVendorOutputKind::Bom,
        format: CliVendorOutputFormat::Xlsx,
        version: "1.0.0",
    },
    VendorOutput {
        kind: CliVendorOutputKind::Cpl,
        format: CliVendorOutputFormat::Csv,
        version: "1.0.0",
    },
    VendorOutput {
        kind: CliVendorOutputKind::Cpl,
        format: CliVendorOutputFormat::Xlsx,
        version: "1.0.0",
    },
];

/// The JLCPCB vendor.
pub struct Jlcpcb;

impl Vendor for Jlcpcb {
    fn id(&self) -> &'static str {
        "jlcpcb"
    }

    fn name(&self) -> &'static str {
        "JLCPCB"
    }

    fn outputs(&self) -> &'static [VendorOutput] {
        &OUTPUTS
    }

    fn config_schema(&self) -> &'static str {
        "prism.vendor.jlcpcb.config.a0"
    }

    fn run(
        &self,
        input: &VendorInput,
        config: &serde_json::Value,
        variant: Option<&str>,
    ) -> Result<Run, Error> {
        let config: VendorJlcpcbConfigA0 = serde_json::from_value(config.clone())
            .map_err(|error| Error::input(format!("the config does not encode: {error}")))?;
        if config.schema != "prism.vendor.jlcpcb.config.a0" {
            return Err(Error::input(format!(
                "the config schema is {}, not prism.vendor.jlcpcb.config.a0",
                config.schema
            )));
        }
        if matches!(config.pnp.units, VendorJlcpcbPnpUnits::Mils) {
            return Err(Error::input(
                "JLCPCB CPL output requires units mm because JLCPCB CPL uses mm",
            ));
        }
        let design = Design::build(
            &input.occurrences,
            &input.placements,
            input.board.as_ref(),
            variant,
        )?;
        let bom = bom_rows(&design, &config);
        let cpl = cpl_rows(&design);
        let files = vec![
            VendorFile {
                path: "bom.csv".to_string(),
                bytes: csv_bytes(&JLC_BOM_COLUMNS, &bom),
            },
            VendorFile {
                path: "bom.xlsx".to_string(),
                bytes: xlsx_bytes("JLC BOM", &JLC_BOM_COLUMNS, &bom)?,
            },
            VendorFile {
                path: "cpl.csv".to_string(),
                bytes: csv_bytes(&JLC_CPL_COLUMNS, &cpl),
            },
            VendorFile {
                path: "cpl.xlsx".to_string(),
                bytes: xlsx_bytes("JLC CPL", &JLC_CPL_COLUMNS, &cpl)?,
            },
        ];
        let mut rows = BTreeMap::new();
        rows.insert("bom".to_string(), bom.len() as u64);
        rows.insert("cpl".to_string(), cpl.len() as u64);
        Ok(Run {
            files,
            rows,
            excluded: excluded(&design, &config),
        })
    }
}

/// `jlc_bom_rows(ordered_bom_lines(lines, dnp_placement), include_dnp)`.
fn bom_rows(design: &Design, config: &VendorJlcpcbConfigA0) -> Vec<BTreeMap<String, String>> {
    let components: Vec<&Component> = design
        .components
        .iter()
        .filter(|component| component.in_bom)
        .filter(|component| config.bom.include_dnp || !component.dnp)
        .collect();
    let groups = group_components(&components, config);
    let mut rows = Vec::new();
    for line in groups {
        if line.dnp && !config.bom.include_dnp {
            continue;
        }
        let mut row = BTreeMap::new();
        row.insert("Comment".to_string(), line.comment());
        row.insert("Designator".to_string(), line.designators.join(", "));
        row.insert(
            "Footprint".to_string(),
            line.fields.get("footprint").cloned().unwrap_or_default(),
        );
        row.insert(
            "JLCPCB Part #".to_string(),
            line.fields
                .get("jlcpcb_part_number")
                .cloned()
                .unwrap_or_default(),
        );
        rows.push(row);
    }
    rows
}

/// One grouping bucket while components collapse into lines.
struct Bucket<'a> {
    key: Vec<String>,
    components: Vec<&'a Component>,
}

/// One grouped BOM line (`bom_pnp_model.py` `GroupedBomLine`).
struct BomLine {
    designators: Vec<String>,
    dnp: bool,
    fields: BTreeMap<String, String>,
}

impl BomLine {
    /// `_line_comment`: description, then value.
    fn comment(&self) -> String {
        for name in ["description", "value"] {
            if let Some(value) = self.fields.get(name).filter(|value| !value.is_empty()) {
                return value.clone();
            }
        }
        String::new()
    }
}

/// `group_bom_components` with the config's group fields and split policy.
fn group_components(components: &[&Component], config: &VendorJlcpcbConfigA0) -> Vec<BomLine> {
    let mut buckets: Vec<Bucket<'_>> = Vec::new();
    for component in components {
        let canonical = component.canonical_fields();
        let mut values: Vec<String> = config
            .bom
            .group_fields
            .iter()
            .map(|field| {
                canonical
                    .get(&normalize_bom_field(field))
                    .map(|value| casefold(value))
                    .unwrap_or_default()
            })
            .collect();
        if values.iter().all(String::is_empty) {
            values = vec![
                casefold(&component.value),
                casefold(&component.footprint),
                casefold(&component.description),
            ];
        }
        if config.bom.split_dnp {
            values.push(if component.dnp { "dnp" } else { "fitted" }.to_string());
        }
        match buckets.iter_mut().find(|bucket| bucket.key == values) {
            Some(bucket) => bucket.components.push(component),
            None => buckets.push(Bucket {
                key: values,
                components: vec![component],
            }),
        }
    }
    let mut lines: Vec<BomLine> = buckets
        .into_iter()
        .map(|bucket| {
            let mut designators: Vec<String> = bucket
                .components
                .iter()
                .map(|component| component.reference.clone())
                .collect();
            designators.sort_by_key(|left| designator_key(left));
            let mut fields = BTreeMap::new();
            for component in &bucket.components {
                for (name, value) in component.canonical_fields() {
                    if !value.is_empty() {
                        fields.entry(name).or_insert(value);
                    }
                }
            }
            BomLine {
                designators,
                dnp: bucket.components.iter().all(|component| component.dnp),
                fields,
            }
        })
        .collect();
    lines.sort_by(|left, right| {
        designator_key(&left.designators[0]).cmp(&designator_key(&right.designators[0]))
    });
    lines
}

/// `jlc_cpl_rows(sort_placements(...))`.
fn cpl_rows(design: &Design) -> Vec<BTreeMap<String, String>> {
    let mut placed: Vec<&Component> = design
        .components
        .iter()
        .filter(|component| {
            component.placement.is_some()
                && component.in_pos
                && !component.dnp
                && component.on_board
        })
        .collect();
    placed.sort_by(|left, right| {
        let left_layer = layer_rank(left);
        let right_layer = layer_rank(right);
        left_layer
            .cmp(&right_layer)
            .then_with(|| designator_key(&left.reference).cmp(&designator_key(&right.reference)))
    });
    let (origin_x, origin_y) = (
        design.aux_axis_origin_nm.x_nm.0,
        design.aux_axis_origin_nm.y_nm.0,
    );
    placed
        .into_iter()
        .filter_map(|component| {
            let placement = component.placement.as_ref()?;
            let x = (placement.position_nm.x_nm.0 - origin_x) as f64 / 1_000_000.0;
            let y = (origin_y - placement.position_nm.y_nm.0) as f64 / 1_000_000.0;
            let mut row = BTreeMap::new();
            row.insert("Designator".to_string(), component.reference.clone());
            row.insert(
                "Layer".to_string(),
                if placement.back { "Bottom" } else { "Top" }.to_string(),
            );
            row.insert("Mid X".to_string(), format_decimal(x, 4));
            row.insert("Mid Y".to_string(), format_decimal(y, 4));
            row.insert(
                "Rotation".to_string(),
                format_decimal(normalize_degrees(placement.rotation_deg), 2),
            );
            Some(row)
        })
        .collect()
}

fn layer_rank(component: &Component) -> u8 {
    match component.placement {
        Some(ref placement) if placement.back => 1,
        _ => 0,
    }
}

/// `_normalize_degrees`: modulo 360, 360 folded to 0.
fn normalize_degrees(value: f64) -> f64 {
    let normalized = value.rem_euclid(360.0);
    if (normalized - 360.0).abs() < 1e-9 {
        0.0
    } else {
        normalized
    }
}

/// `_format_decimal`: fixed precision, then trailing zeroes and dot removed.
fn format_decimal(value: f64, precision: usize) -> String {
    let text = format!("{value:.precision$}");
    if text.contains('.') {
        let text = text.trim_end_matches('0');
        text.trim_end_matches('.').to_string()
    } else {
        text
    }
}

/// The components the run left out, sorted by key.
fn excluded(design: &Design, config: &VendorJlcpcbConfigA0) -> Vec<Excluded> {
    let mut excluded = Vec::new();
    for component in &design.components {
        if !component.in_bom || (component.dnp && !config.bom.include_dnp) {
            excluded.push(Excluded {
                key: component.key.clone(),
                reference: Some(component.reference.clone()),
                code: "excluded-from-bom",
                message: format!(
                    "{} is not in the BOM (do not populate or excluded from the BOM)",
                    component.reference
                ),
            });
            continue;
        }
        if component.placement.is_none()
            || !component.in_pos
            || component.dnp
            || !component.on_board
        {
            excluded.push(Excluded {
                key: component.key.clone(),
                reference: Some(component.reference.clone()),
                code: "excluded-from-position",
                message: format!(
                    "{} is not in the position file (do not populate, off board or excluded from position files)",
                    component.reference
                ),
            });
        }
    }
    excluded.sort_by(|left, right| left.key.cmp(&right.key));
    excluded
}

/// CSV bytes as Python's `csv` writer with `utf-8-sig` emits them: a UTF-8
/// BOM, CRLF line endings and minimal quoting.
fn csv_bytes(columns: &[&str], rows: &[BTreeMap<String, String>]) -> Vec<u8> {
    let mut text = String::from("\u{feff}");
    write_csv_row(&mut text, columns.iter().copied());
    for row in rows {
        write_csv_row(
            &mut text,
            columns
                .iter()
                .map(|column| row.get(*column).map(String::as_str).unwrap_or_default()),
        );
    }
    text.into_bytes()
}

fn write_csv_row<'a>(out: &mut String, values: impl Iterator<Item = &'a str>) {
    let mut first = true;
    for value in values {
        if !first {
            out.push(',');
        }
        first = false;
        let quote = value
            .chars()
            .any(|ch| matches!(ch, ',' | '"' | '\r' | '\n'));
        if quote {
            out.push('"');
            for ch in value.chars() {
                if ch == '"' {
                    out.push('"');
                }
                out.push(ch);
            }
            out.push('"');
        } else {
            out.push_str(value);
        }
    }
    out.push_str("\r\n");
}

fn xlsx_bytes(
    sheet: &str,
    columns: &[&str],
    rows: &[BTreeMap<String, String>],
) -> Result<Vec<u8>, Error> {
    let columns: Vec<String> = columns.iter().map(|column| (*column).to_string()).collect();
    let rows: Vec<Vec<String>> = rows
        .iter()
        .map(|row| {
            columns
                .iter()
                .map(|column| row.get(column).cloned().unwrap_or_default())
                .collect()
        })
        .collect();
    xlsx::table(sheet, &columns, &rows)
}

// -------------------------------------------------------------- sorting

/// `_normalize_name` + `_normalize_bom_field_name`.
fn normalize_bom_field(name: &str) -> String {
    let normalized = name.trim().to_lowercase().replace([' ', '-'], "_");
    match normalized.as_str() {
        "mfg" => "manufacturer".to_string(),
        "manufacturer_part" | "manufacturer_part_no" | "mpn" | "part_number" | "pn" => {
            "manufacturer_part_number".to_string()
        }
        "qty" => "quantity".to_string(),
        _ => normalized,
    }
}

/// Python's `str.casefold` for the ASCII designators and values here.
fn casefold(value: &str) -> String {
    value.to_lowercase()
}

/// `_tokenize_designator`'s natural-sort key.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Token {
    Number(u64),
    Text(String),
}

fn designator_key(designator: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut chars = designator.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch.is_ascii_digit() {
            let mut text = String::from(ch);
            while let Some(next) = chars.peek().copied().filter(char::is_ascii_digit) {
                text.push(next);
                chars.next();
            }
            tokens.push(Token::Number(text.parse().unwrap_or(u64::MAX)));
        } else if ch.is_ascii_alphabetic() {
            let mut text = String::from(ch);
            while let Some(next) = chars.peek().copied().filter(char::is_ascii_alphabetic) {
                text.push(next);
                chars.next();
            }
            tokens.push(Token::Text(text.to_lowercase()));
        } else {
            let mut text = String::from(ch);
            while let Some(next) = chars
                .peek()
                .copied()
                .filter(|next| !next.is_ascii_digit() && !next.is_ascii_alphabetic())
            {
                text.push(next);
                chars.next();
            }
            tokens.push(Token::Text(text.to_lowercase()));
        }
    }
    tokens
}
