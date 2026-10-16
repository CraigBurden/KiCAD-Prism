//! Pass 3: `components` from `design.json`, a port of the component loop
//! (semantic_index_service.py:879-910) with `_canonical_fields` and
//! `_resolve_dnp` (:438-513) and `REQUIRED_BOM_FIELDS` (:43-61).

use super::fields::{Fields, SourceFields};
use super::{State, stable_uid, string};
use serde_json::{Value, json};
use std::collections::BTreeMap;

/// The canonical fields `_canonical_fields` builds beyond the design's own
/// values; a parameter named exactly one of these is not repeated as an extra
/// (semantic_index_service.py:43-61, :493-513). It adds `In BOM` to today's
/// 16-name constant.
const REQUIRED_BOM_FIELDS: [&str; 17] = [
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

/// `_TRUTHY_FLAGS` (semantic_index_service.py:438).
const TRUTHY_FLAGS: [&str; 5] = ["1", "true", "yes", "y", "dnp"];

/// The `_canonical_fields` parameter lookups (`pick`), in the constant's order
/// (semantic_index_service.py:493-511): `(field, aliases)`. `Value`,
/// `Description` and `Footprint` additionally fall back to the component's own
/// value through `or_pick`.
const CANONICAL_PICKS: [(&str, &[&str]); 15] = [
    ("Value", &[]),
    ("Description", &[]),
    (
        "Datasheet",
        &["Data Sheet", "Datasheet URL", "Datasheet Link"],
    ),
    ("Manufacturer", &["MFR", "Mfr"]),
    (
        "Manufacturer Part Number",
        &["MPN", "Mfr Part", "Mfr Part Number"],
    ),
    ("Vendor", &["Supplier"]),
    (
        "Vendor Part Number",
        &["VPN", "Supplier Part Number", "Supplier PN"],
    ),
    ("Footprint", &[]),
    ("Mass (g)", &["Mass", "Weight (g)"]),
    ("RQjC (C/W)", &["RθJC (C/W)", "RthJC"]),
    ("RQjC_top (C/W)", &["RθJC_top (C/W)", "RthJC Top"]),
    ("Temp_max (C)", &["Max Temperature", "Tj Max"]),
    ("Temp_min (C)", &["Min Temperature", "Tj Min"]),
    ("Power Dissipation (W)", &["Power Dissipation", "Pd (W)"]),
    ("Rate", &["Rating"]),
];

/// Append every designated component of `design.json` to `state.components`
/// and fill `componentByReference`, `componentBySchematicUuid` and
/// `state.component_by_reference`.
pub(super) fn project(design: &Value, source_fields: &SourceFields, state: &mut State) {
    let components = design
        .get("components")
        .and_then(Value::as_array)
        .map_or(&[][..], Vec::as_slice);
    for raw in components {
        let reference = string(
            raw.get("designator")
                .filter(|value| truthy_json(value))
                .or_else(|| raw.get("reference")),
        );
        if reference.is_empty() {
            continue;
        }
        let symbol_uuid = string(raw.get("svg_id"));
        let parameters = merged_parameters(raw, source_fields.get(&symbol_uuid));
        let hierarchy = raw.get("hierarchy").filter(|value| truthy_json(value));
        let sheet_instance_path = {
            let value = string(hierarchy.and_then(|hierarchy| hierarchy.get("sheet_path")));
            if value.is_empty() {
                "/".to_owned()
            } else {
                value
            }
        };
        let page = string(hierarchy.and_then(|hierarchy| hierarchy.get("sheet")));
        let schematic_refs = if symbol_uuid.is_empty() {
            Vec::new()
        } else {
            vec![json!({
                "sheetInstancePath": sheet_instance_path,
                "page": page,
                "symbolUuid": symbol_uuid,
            })]
        };
        let entry = json!({
            "componentUid": stable_uid("cmp", &[reference.as_str(), symbol_uuid.as_str()]),
            "reference": reference.clone(),
            "value": string(raw.get("value")),
            "footprint": string(raw.get("footprint")),
            "libraryRef": string(raw.get("library_ref")),
            "fields": canonical_fields(raw, &parameters),
            "schematicRefs": schematic_refs,
            "pcbRefs": [],
            "webgpuRefs": [],
        });
        let component_index = state.components.len();
        state.components.push(entry);
        state
            .component_by_reference
            .insert(reference.clone(), component_index);
        state
            .indexes
            .component_by_reference
            .insert(reference, component_index);
        if !symbol_uuid.is_empty() {
            state
                .indexes
                .component_by_schematic_uuid
                .insert(symbol_uuid, component_index);
        }
    }
}

/// The component's parameters after `_string`, overlaid by the scanned
/// schematic fields (semantic_index_service.py:469-472, :884-887).
fn merged_parameters(component: &Value, overlay: Option<&Fields>) -> Fields {
    // `design.json` keeps the parameters' source order (serde_json's
    // `preserve_order`), today's dict order.
    let mut parameters = Fields::default();
    if let Some(object) = component.get("parameters").and_then(Value::as_object) {
        for (key, value) in object.iter().filter(|(key, _)| !key.is_empty()) {
            parameters.set(key.clone(), string(Some(value)));
        }
    }
    for (key, value) in overlay.into_iter().flat_map(Fields::iter) {
        parameters.set(key.clone(), value.clone());
    }
    parameters
}

/// `_canonical_fields` (semantic_index_service.py:467-513).
pub(crate) fn canonical_fields(component: &Value, parameters: &Fields) -> BTreeMap<String, String> {
    // In the parameters' order, so a later key wins a casefold collision.
    let casefolded = casefolded_parameters(parameters);
    let dnp = resolve_dnp(parameters, &casefolded);
    let in_bom = in_bom_value(&casefolded);
    let mut fields = BTreeMap::new();
    for (name, aliases) in CANONICAL_PICKS {
        let picked = pick(&casefolded, name, aliases);
        let value = match name {
            "Value" => or_pick(string(component.get("value")), picked),
            "Description" => or_pick(string(component.get("description")), picked),
            "Footprint" => or_pick(string(component.get("footprint")), picked),
            _ => picked,
        };
        fields.insert(name.to_owned(), value);
    }
    fields.insert("DNP".to_owned(), dnp);
    fields.insert("In BOM".to_owned(), in_bom.to_owned());
    for (key, value) in parameters.iter() {
        if !REQUIRED_BOM_FIELDS.contains(&key.as_str()) {
            fields.insert(key.clone(), value.clone());
        }
    }
    fields
}

/// `{re.sub(r"[^a-z0-9]", "", key.casefold()): value}` over the parameters
/// (semantic_index_service.py:474, :483), in their order.
fn casefolded_parameters(parameters: &Fields) -> BTreeMap<String, String> {
    parameters
        .iter()
        .map(|(key, value)| (folded_key(key), value.clone()))
        .collect()
}

/// The `pick(name, *aliases)` lookup (semantic_index_service.py:475-482): the
/// first candidate whose casefolded value is non-empty.
fn pick(casefolded: &BTreeMap<String, String>, name: &str, aliases: &[&str]) -> String {
    std::iter::once(name)
        .chain(aliases.iter().copied())
        .find_map(|candidate| {
            casefolded
                .get(&folded_key(candidate))
                .filter(|value| !value.is_empty())
                .cloned()
        })
        .unwrap_or_default()
}

/// `_canonical_fields`'s `In BOM` (semantic_index_service.py:504-509): a
/// non-empty, non-truthy `KiCadInBom` is `"No"`, everything else `"Yes"`.
fn in_bom_value(casefolded: &BTreeMap<String, String>) -> &'static str {
    let raw = casefolded
        .get("kicadinbom")
        .map_or("", String::as_str)
        .trim();
    if !raw.is_empty() && !is_truthy_flag(raw) {
        "No"
    } else {
        "Yes"
    }
}

/// `_resolve_dnp` (semantic_index_service.py:441-464).
fn resolve_dnp(parameters: &Fields, casefolded: &BTreeMap<String, String>) -> String {
    let explicit = casefolded.get("kicaddnp").map_or("", String::as_str).trim();
    if !explicit.is_empty() {
        return yes_no(is_truthy_flag(explicit)).to_owned();
    }
    if parameters
        .get("dnp")
        .is_some_and(|value| value.trim().is_empty())
    {
        return "Yes".to_owned();
    }
    for alias in ["DNP", "Do Not Populate", "Do Not Fit"] {
        let value = casefolded
            .get(&folded_key(alias))
            .map_or("", String::as_str)
            .trim();
        if !value.is_empty() {
            return yes_no(is_truthy_flag(value)).to_owned();
        }
    }
    "No".to_owned()
}

/// Python truthiness of a `design.json` value, for the `a or b` forms
/// (semantic_index_service.py:880, :888).
fn truthy_json(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(flag) => *flag,
        Value::Number(number) => number.as_f64().is_some_and(|number| number != 0.0),
        Value::String(text) => !text.is_empty(),
        Value::Array(items) => !items.is_empty(),
        Value::Object(object) => !object.is_empty(),
    }
}

/// `re.sub(r"[^a-z0-9]", "", key.casefold())` (semantic_index_service.py:474, :483).
fn folded_key(key: &str) -> String {
    casefold(key)
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .collect()
}

/// `value.casefold() in _TRUTHY_FLAGS` (semantic_index_service.py:454, :462).
fn is_truthy_flag(value: &str) -> bool {
    TRUTHY_FLAGS.contains(&casefold(value).as_str())
}

/// Python's `str.casefold()` as far as it can reach ASCII: Unicode lowercase,
/// plus the full foldings that lowercase lacks and that end in ASCII letters
/// (`ß`, `ẞ`, long `ſ` and the Latin ligatures). Other non-ASCII results never
/// survive `[^a-z0-9]` or match a flag, so they need no folding here.
fn casefold(text: &str) -> String {
    let mut folded = String::with_capacity(text.len());
    for character in text.chars() {
        match character {
            'ß' | 'ẞ' => folded.push_str("ss"),
            'ſ' => folded.push('s'),
            'ﬀ' => folded.push_str("ff"),
            'ﬁ' => folded.push_str("fi"),
            'ﬂ' => folded.push_str("fl"),
            'ﬃ' => folded.push_str("ffi"),
            'ﬄ' => folded.push_str("ffl"),
            'ﬅ' | 'ﬆ' => folded.push_str("st"),
            other => folded.extend(other.to_lowercase()),
        }
    }
    folded
}

/// `"Yes"`/`"No"` for a truthy flag.
fn yes_no(flag: bool) -> &'static str {
    if flag { "Yes" } else { "No" }
}

/// `base or picked` after `_string` (semantic_index_service.py:494, :503).
fn or_pick(base: String, picked: String) -> String {
    if base.is_empty() { picked } else { base }
}

#[cfg(test)]
mod order_tests {
    use super::{Fields, canonical_fields, folded_key, merged_parameters};
    use serde_json::json;

    #[test]
    fn a_later_key_wins_a_casefold_collision_in_source_order() {
        // Source order puts the space-separated key last, the reverse of code
        // point order: today's dict keeps it, so its value wins.
        let component = json!({"parameters": {
            "Manufacturer_Part_Number": "SHORT",
            "Manufacturer Part Number": "LONG",
        }});
        let parameters = merged_parameters(&component, None);
        let fields = canonical_fields(&component, &parameters);
        assert_eq!(fields["Manufacturer Part Number"], "LONG");
    }

    #[test]
    fn the_overlay_updates_in_place_and_appends_new_keys() {
        let component = json!({"parameters": {"MPN": "A", "Value": "10k"}});
        let mut overlay = Fields::default();
        overlay.set("Mfr Part".to_owned(), "C".to_owned());
        overlay.set("MPN".to_owned(), "B".to_owned());
        let parameters = merged_parameters(&component, Some(&overlay));
        let keys: Vec<_> = parameters.iter().map(|(key, _)| key.as_str()).collect();
        assert_eq!(keys, ["MPN", "Value", "Mfr Part"]);
        assert_eq!(parameters.get("MPN"), Some("B"));
    }

    #[test]
    fn folding_matches_python_casefold() {
        assert_eq!(folded_key("Maß (g)"), "massg");
        assert_eq!(folded_key("RθJC (C/W)"), "rjccw");
        assert_eq!(folded_key("\u{212a}icad_DNP"), "kicaddnp");
    }
}
