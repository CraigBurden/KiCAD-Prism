//! The variant resolver, a port of kicad_monkey's `kicad_variants.py`
//! (`resolve_symbol` :408-478, `resolve_footprint` :481-521) with the helpers
//! `_instance_reference` (:325-355), `_symbol_base_fields` (:371-379),
//! `_footprint_base_fields` (:382-390), `_footprint_reference` (:393-398) and
//! `_select_symbol_instance_variant` (:295-322). Sheet- and footprint-instance
//! variant records the fork core does not expose are read from source text with
//! the fork's S-expression parser (`prism-kicad-core/src/sexpr.rs`).

use prism_kicad_core::{SchematicPlacedSymbol, SchematicSymbolInstanceVariant, sexpr::Sexp};
use serde_json::{Map, Value};

/// An ordered field map (raw KiCad field name → value). Insertion-ordered, as
/// today's `dict`.
pub(crate) type Fields = Map<String, Value>;

/// One `(variant …)` override record, the union of the fields the three
/// carriers expose (`kicad_variants.py:30-54`). `None` means the token was
/// absent ("same as base").
#[derive(Clone, Debug, Default, PartialEq)]
pub(crate) struct VariantRecord {
    pub name: String,
    pub dnp: Option<bool>,
    pub exclude_from_bom: Option<bool>,
    pub exclude_from_pos_files: Option<bool>,
    pub exclude_from_sim: Option<bool>,
    pub in_bom: Option<bool>,
    pub on_board: Option<bool>,
    pub in_pos_files: Option<bool>,
    pub fields: Vec<(String, String)>,
}

/// One `SchSheetInstance` (`kicad_sch_sheet.py:206-234`): an instance path and
/// its variant records inside a `(sheet …)` form.
#[derive(Clone, Debug, Default, PartialEq)]
pub(crate) struct SheetInstance {
    pub path: String,
    pub variants: Vec<VariantRecord>,
}

/// The resolved symbol state `EffectiveSymbolProperties`
/// (`kicad_variants.py:268-280`).
#[derive(Clone, Debug)]
pub(crate) struct ResolvedSymbol {
    pub reference: String,
    pub dnp: bool,
    pub exclude_from_sim: bool,
    pub in_bom: bool,
    pub on_board: bool,
    pub in_pos_files: bool,
    pub fields: Fields,
}

/// The resolved footprint state `EffectiveFootprintProperties`
/// (`kicad_variants.py:283-291`).
#[derive(Clone, Debug)]
pub(super) struct ResolvedFootprint {
    pub reference: String,
    pub dnp: bool,
    pub exclude_from_bom: bool,
    pub exclude_from_pos_files: bool,
    pub fields: Fields,
}

/// A footprint as the resolver reads it: the base fields and flags plus the
/// scanned `(variant …)` records.
#[derive(Clone, Debug)]
pub(crate) struct FootprintInput {
    pub uuid: String,
    pub reference: String,
    pub fields: Fields,
    pub dnp: bool,
    pub exclude_from_bom: bool,
    pub exclude_from_pos_files: bool,
    pub variants: Vec<VariantRecord>,
}

/// `_symbol_base_fields` (`kicad_variants.py:371-379`).
fn symbol_base_fields(symbol: &SchematicPlacedSymbol) -> Fields {
    let mut fields = Fields::new();
    for property in &symbol.properties {
        if !property.key.is_empty() {
            fields.insert(property.key.clone(), Value::String(property.value.clone()));
        }
    }
    fields
}

/// `_instance_reference` (`kicad_variants.py:325-355`), with `sheet_path`
/// always set.
fn instance_reference(symbol: &SchematicPlacedSymbol, sheet_path: &str) -> String {
    for instance in &symbol.instances {
        if instance.path == sheet_path && !instance.reference.is_empty() {
            return instance.reference.clone();
        }
    }
    if let Some(first) = symbol.instances.first()
        && !first.reference.is_empty()
    {
        return first.reference.clone();
    }
    for property in &symbol.properties {
        if property.key == "Reference" {
            return property.value.clone();
        }
    }
    String::new()
}

/// `_select_symbol_instance_variant` (`kicad_variants.py:295-322`), with
/// `sheet_path` always set: the first instance whose path matches, then the
/// first variant with that name under it.
pub(super) fn select_symbol_variant<'a>(
    symbol: &'a SchematicPlacedSymbol,
    variant_name: &str,
    sheet_path: &str,
) -> Option<&'a SchematicSymbolInstanceVariant> {
    for instance in &symbol.instances {
        if instance.path != sheet_path {
            continue;
        }
        for variant in &instance.variants {
            if variant.name == variant_name {
                return Some(variant);
            }
        }
        return None;
    }
    None
}

/// `_has_symbol_instance(symbol, sheet_path)` (`semantic_index_variants.py:138-142`).
pub(super) fn has_symbol_instance(symbol: &SchematicPlacedSymbol, sheet_path: &str) -> bool {
    symbol
        .instances
        .iter()
        .any(|instance| instance.path == sheet_path)
}

/// `resolve_symbol` (`kicad_variants.py:408-478`), including `_select_symbol_instance_variant`.
pub(crate) fn resolve_symbol(
    symbol: &SchematicPlacedSymbol,
    variant_name: Option<&str>,
    sheet_path: &str,
) -> ResolvedSymbol {
    let base_fields = symbol_base_fields(symbol);
    let base_reference = {
        let reference = instance_reference(symbol, sheet_path);
        if !reference.is_empty() {
            reference
        } else {
            base_fields
                .get("Reference")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned()
        }
    };
    let base = ResolvedSymbol {
        reference: base_reference,
        dnp: symbol.dnp,
        exclude_from_sim: symbol.exclude_from_sim,
        in_bom: symbol.in_bom,
        on_board: symbol.on_board,
        in_pos_files: symbol.in_pos_files,
        fields: base_fields,
    };
    let Some(variant_name) = variant_name else {
        return base;
    };
    let Some(variant) = select_symbol_variant(symbol, variant_name, sheet_path) else {
        return base;
    };

    let mut merged = base.fields.clone();
    for field in &variant.fields {
        merged.insert(field.name.clone(), Value::String(field.value.clone()));
    }
    ResolvedSymbol {
        reference: base.reference,
        dnp: variant.dnp.unwrap_or(base.dnp),
        exclude_from_sim: variant.exclude_from_sim.unwrap_or(base.exclude_from_sim),
        in_bom: variant.in_bom.unwrap_or(base.in_bom),
        on_board: variant.on_board.unwrap_or(base.on_board),
        in_pos_files: variant.in_pos_files.unwrap_or(base.in_pos_files),
        fields: merged,
    }
}

/// `_footprint_base_fields` (`kicad_variants.py:382-390`).
pub(super) fn footprint_base_fields(properties: &[(String, String)]) -> Fields {
    let mut fields = Fields::new();
    for (name, value) in properties {
        if !name.is_empty() {
            fields.insert(name.clone(), Value::String(value.clone()));
        }
    }
    fields
}

/// `_footprint_reference` (`kicad_variants.py:393-398`): the first `Reference` property.
pub(super) fn footprint_reference(properties: &[(String, String)]) -> String {
    for (name, value) in properties {
        if name == "Reference" {
            return value.clone();
        }
    }
    String::new()
}

/// `is_dnp` / `is_excluded_from_bom` / `is_excluded_from_pos_files`
/// (`kicad_pcb_footprint.py:410-420`).
pub(super) fn footprint_flags(attributes: &[String]) -> (bool, bool, bool) {
    let has = |name: &str| attributes.iter().any(|attribute| attribute == name);
    (
        has("dnp"),
        has("exclude_from_bom"),
        has("exclude_from_pos_files"),
    )
}

/// `resolve_footprint` (`kicad_variants.py:481-521`), including
/// `_footprint_select_variant` by exact name.
pub(super) fn resolve_footprint(
    footprint: &FootprintInput,
    variant_name: Option<&str>,
) -> ResolvedFootprint {
    let base = ResolvedFootprint {
        reference: footprint.reference.clone(),
        dnp: footprint.dnp,
        exclude_from_bom: footprint.exclude_from_bom,
        exclude_from_pos_files: footprint.exclude_from_pos_files,
        fields: footprint.fields.clone(),
    };
    let Some(variant_name) = variant_name else {
        return base;
    };
    let Some(variant) = footprint
        .variants
        .iter()
        .find(|record| record.name == variant_name)
    else {
        return base;
    };

    let mut merged = base.fields.clone();
    for (name, value) in &variant.fields {
        merged.insert(name.clone(), Value::String(value.clone()));
    }
    ResolvedFootprint {
        reference: base.reference,
        dnp: variant.dnp.unwrap_or(base.dnp),
        exclude_from_bom: variant.exclude_from_bom.unwrap_or(base.exclude_from_bom),
        exclude_from_pos_files: variant
            .exclude_from_pos_files
            .unwrap_or(base.exclude_from_pos_files),
        fields: merged,
    }
}

/// `_select_footprint_variant` (`semantic_index_variants.py:460-467`): the first
/// record whose name matches case-insensitively.
pub(super) fn select_footprint_variant<'a>(
    variants: &'a [VariantRecord],
    variant_name: &str,
) -> Option<&'a VariantRecord> {
    let folded = variant_name.to_lowercase();
    variants
        .iter()
        .find(|record| record.name.to_lowercase() == folded)
}

/// The symbol flags `_symbol_flags` (`semantic_index_variants.py:145-160`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct SymbolFlags {
    pub dnp: bool,
    pub exclude_from_bom: bool,
    pub exclude_from_board: bool,
    pub exclude_from_sim: bool,
    pub exclude_from_pos_files: bool,
}

/// `_symbol_flags(resolved, record, version)` (`semantic_index_variants.py:145-160`).
pub(crate) fn symbol_flags(
    resolved: &ResolvedSymbol,
    record: Option<&SchematicSymbolInstanceVariant>,
    legacy_in_bom: bool,
) -> SymbolFlags {
    let exclude_from_bom = match record.and_then(|record| record.in_bom) {
        None => !resolved.in_bom,
        Some(record_in_bom) => {
            if legacy_in_bom {
                record_in_bom
            } else {
                !resolved.in_bom
            }
        }
    };
    SymbolFlags {
        dnp: resolved.dnp,
        exclude_from_bom,
        exclude_from_board: !resolved.on_board,
        exclude_from_sim: resolved.exclude_from_sim,
        exclude_from_pos_files: !resolved.in_pos_files,
    }
}

// ---------------------------------------------------------------------------
// Source scanning for records the fork core does not expose.
// ---------------------------------------------------------------------------

/// The `(sheet …)` forms of one schematic source, in file order; each carries
/// its `(instances (project "…" (path "…" (variant …))))` records
/// (`kicad_sch_sheet.py:355-362`).
pub(super) fn sheet_instances(source: &str) -> Vec<Vec<SheetInstance>> {
    let Some(root) = parse_root(source) else {
        return Vec::new();
    };
    list(&root)
        .iter()
        .filter(|item| head(item) == Some("sheet"))
        .map(sheet_instances_of)
        .collect()
}

fn sheet_instances_of(sheet: &Sexp) -> Vec<SheetInstance> {
    let Some(instances) = child(sheet, "instances") else {
        return Vec::new();
    };
    let mut records = Vec::new();
    for project in children(instances, "project") {
        for path in children(project, "path") {
            let path_value = list(path).get(1).map(scalar).unwrap_or_default();
            let variants = children(path, "variant")
                .into_iter()
                .map(|variant| parse_variant(variant, false))
                .collect();
            records.push(SheetInstance {
                path: path_value,
                variants,
            });
        }
    }
    records
}

/// The direct `(variant …)` children of one `(footprint …)` form
/// (`kicad_pcb_footprint.py:294`, `kicad_pcb_other.py:524-559`). An empty
/// boolean token is true here (`_parse_yes_no_bool`, :37-43), unlike symbol and
/// sheet records.
pub(super) fn footprint_variants(source: &str) -> Vec<VariantRecord> {
    let Some(root) = parse_root(source) else {
        return Vec::new();
    };
    children(&root, "variant")
        .into_iter()
        .map(|variant| parse_variant(variant, true))
        .collect()
}

fn parse_variant(variant: &Sexp, empty_bool_is_true: bool) -> VariantRecord {
    let bool_value = |name: &str| -> Option<bool> {
        let element = child(variant, name)?;
        let values = list(element);
        match values.get(1) {
            Some(value) => Some(scalar(value) == "yes"),
            None if empty_bool_is_true => Some(true),
            None => None,
        }
    };
    let fields = children(variant, "field")
        .into_iter()
        .map(|field| {
            (
                child_scalar(field, "name").unwrap_or_default(),
                child_scalar(field, "value").unwrap_or_default(),
            )
        })
        .collect();
    VariantRecord {
        name: child_scalar(variant, "name").unwrap_or_default(),
        dnp: bool_value("dnp"),
        exclude_from_bom: bool_value("exclude_from_bom"),
        exclude_from_pos_files: bool_value("exclude_from_pos_files"),
        exclude_from_sim: bool_value("exclude_from_sim"),
        in_bom: bool_value("in_bom"),
        on_board: bool_value("on_board"),
        in_pos_files: bool_value("in_pos_files"),
        fields,
    }
}

/// Parse a complete form; `None` when the text is not one balanced expression.
fn parse_root(source: &str) -> Option<Sexp> {
    prism_kicad_core::sexpr::parse(source).ok()
}

fn list(sexp: &Sexp) -> &[Sexp] {
    match sexp {
        Sexp::List(items) => items,
        _ => &[],
    }
}

fn head(sexp: &Sexp) -> Option<&str> {
    match list(sexp).first() {
        Some(Sexp::Atom(atom)) => Some(atom.as_ref()),
        _ => None,
    }
}

fn child<'a>(sexp: &'a Sexp, name: &str) -> Option<&'a Sexp> {
    list(sexp)
        .iter()
        .skip(1)
        .find(|item| head(item) == Some(name))
}

/// The first scalar value of the child form `(name …)`.
fn child_scalar(sexp: &Sexp, name: &str) -> Option<String> {
    child(sexp, name)
        .and_then(|element| list(element).get(1))
        .map(scalar)
}

fn children<'a>(sexp: &'a Sexp, name: &str) -> Vec<&'a Sexp> {
    list(sexp)
        .iter()
        .skip(1)
        .filter(|item| head(item) == Some(name))
        .collect()
}

/// The decoded string value of a scalar token.
fn scalar(sexp: &Sexp) -> String {
    match sexp {
        Sexp::Quoted(value) | Sexp::Atom(value) => value.to_string(),
        Sexp::Integer(value) => value.to_string(),
        Sexp::Float(value) => value.to_string(),
        Sexp::List(_) => String::new(),
    }
}

/// Build a [`FootprintInput`] from the fork's footprint view fields
/// (`kicad_pcb_footprint.py:258-392`): base fields and reference from the
/// property list, flags from `attr`.
pub(super) fn footprint_input(
    uuid: String,
    properties: &[(String, String)],
    attributes: &[String],
    variants: Vec<VariantRecord>,
) -> FootprintInput {
    let (dnp, exclude_from_bom, exclude_from_pos_files) = footprint_flags(attributes);
    FootprintInput {
        uuid,
        reference: footprint_reference(properties),
        fields: footprint_base_fields(properties),
        dnp,
        exclude_from_bom,
        exclude_from_pos_files,
        variants,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_sheet_instance_variants() {
        let source = "(kicad_sch (sheet (instances (project \"p\" \
            (path \"/root/u\" (page \"2\") (variant (name \"Lite\") (dnp yes)) \
            (variant (name \"Pro\") (in_bom no)))))))";
        let sheets = sheet_instances(source);
        assert_eq!(sheets.len(), 1);
        let records = &sheets[0];
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].path, "/root/u");
        assert_eq!(records[0].variants.len(), 2);
        assert_eq!(records[0].variants[0].name, "Lite");
        assert_eq!(records[0].variants[0].dnp, Some(true));
        assert_eq!(records[0].variants[0].in_bom, None);
        assert_eq!(records[0].variants[1].in_bom, Some(false));
    }

    #[test]
    fn parses_footprint_variants_with_empty_boolean_true() {
        let source = "(footprint \"L:R\" (variant (name \"LITE\") (dnp) \
            (exclude_from_bom no) (field (name \"MPN\") (value \"x\"))))";
        let variants = footprint_variants(source);
        assert_eq!(variants.len(), 1);
        assert_eq!(variants[0].name, "LITE");
        assert_eq!(variants[0].dnp, Some(true));
        assert_eq!(variants[0].exclude_from_bom, Some(false));
        assert_eq!(variants[0].fields, vec![("MPN".to_owned(), "x".to_owned())]);
    }
}
