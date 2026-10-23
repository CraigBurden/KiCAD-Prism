//! Canonical BOM fields: `_bom_fields` (occurrences.py:81-93) over
//! `semantic_index_service._canonical_fields` (`semantic_index_service.py:467-513`).

use crate::semantic_index::components::canonical_fields;
use crate::semantic_index::fields::Fields;
use serde_json::{Map, Value};

/// Canonical BOM label → `OccurrencesBomFields` field (`occurrences.py:38-54`).
/// `DNP` and `In BOM` are the occurrence's flags, and extras are not repeated
/// (field map, "Canonical BOM labels").
const BOM_FIELDS: [(&str, &str); 15] = [
    ("Value", "value"),
    ("Description", "description"),
    ("Datasheet", "datasheet"),
    ("Manufacturer", "manufacturer"),
    ("Manufacturer Part Number", "manufacturerPartNumber"),
    ("Vendor", "vendor"),
    ("Vendor Part Number", "vendorPartNumber"),
    ("Footprint", "footprint"),
    ("Mass (g)", "mass"),
    ("RQjC (C/W)", "rqjc"),
    ("RQjC_top (C/W)", "rqjcTop"),
    ("Temp_max (C)", "tempMax"),
    ("Temp_min (C)", "tempMin"),
    ("Power Dissipation (W)", "powerDissipation"),
    ("Rate", "rate"),
];

/// `_bom_fields(properties)` (occurrences.py:81-93): call `_canonical_fields`
/// with the occurrence's `parameters`, raw `Value` and `Footprint`, then keep
/// every non-empty canonical field under its contract name.
pub(crate) fn canonical(properties: &Fields) -> Value {
    let component = component_from(properties);
    let canonical = canonical_fields(&component, properties);
    let mut fields = Map::new();
    for (label, field) in BOM_FIELDS {
        if let Some(value) = canonical.get(label).filter(|value| !value.is_empty()) {
            fields.insert(field.to_owned(), Value::String(value.clone()));
        }
    }
    Value::Object(fields)
}

/// The `component` `_canonical_fields` reads its `value` and `footprint`
/// fallbacks from (`occurrences.py:86-92`); it passes no `description`, so
/// `Description` is the placed symbol's property only.
fn component_from(properties: &Fields) -> Value {
    let mut component = Map::new();
    if let Some(value) = properties.get("Value") {
        component.insert("value".to_owned(), Value::String(value.to_owned()));
    }
    if let Some(footprint) = properties.get("Footprint") {
        component.insert("footprint".to_owned(), Value::String(footprint.to_owned()));
    }
    Value::Object(component)
}

#[cfg(test)]
mod tests {
    use super::canonical;
    use crate::semantic_index::fields::Fields;
    use serde_json::json;

    fn fields(pairs: &[(&str, &str)]) -> Fields {
        let mut fields = Fields::default();
        for (key, value) in pairs {
            fields.set((*key).to_owned(), (*value).to_owned());
        }
        fields
    }

    /// Aliases resolve to their canonical field, and an absent or empty value
    /// omits the field (occurrences.py:93, field map "Canonical BOM labels").
    #[test]
    fn aliases_and_absence() {
        let value = canonical(&fields(&[
            ("Value", "10k"),
            ("MFR", "Acme"),
            ("MPN", "A-1"),
            ("Footprint", ""),
        ]));
        assert_eq!(
            value,
            json!({"value": "10k", "manufacturer": "Acme",
                   "manufacturerPartNumber": "A-1"})
        );
    }

    /// A present-but-empty field does not shadow a populated alias
    /// (`_canonical_fields.pick`).
    #[test]
    fn an_empty_alias_does_not_shadow_a_later_one() {
        let value = canonical(&fields(&[("Datasheet", ""), ("Data Sheet", "http://x")]));
        assert_eq!(value, json!({"datasheet": "http://x"}));
    }

    /// The later source-order key wins a casefold collision, matching
    /// `_canonical_fields` (`semantic_index_service.py:473-476`).
    #[test]
    fn a_later_source_order_key_wins_a_casefold_collision() {
        let value = canonical(&fields(&[
            ("Manufacturer_Part_Number", "SHORT"),
            ("Manufacturer Part Number", "LONG"),
        ]));
        assert_eq!(value, json!({"manufacturerPartNumber": "LONG"}));
    }
}
