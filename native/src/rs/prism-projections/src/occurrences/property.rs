//! The placed-symbol properties as written: `_symbol_properties`
//! (occurrences.py:70-78).

use crate::semantic_index::fields::Fields;
use prism_kicad_core::SchematicSymbolProperty;
use serde_json::Value;

/// `_symbol_properties(symbol)` (occurrences.py:70-78): each property's name
/// and text, an empty name skipped, and when a name repeats the last write
/// wins in place (a Python `dict`). The returned [`Fields`] keeps source
/// insertion order, which `_canonical_fields` needs for its casefold
/// collisions.
pub(crate) fn ordered(properties: &[SchematicSymbolProperty]) -> Fields {
    let mut fields = Fields::default();
    for property in properties {
        if property.key.is_empty() {
            continue;
        }
        fields.set(property.key.clone(), property.value.clone());
    }
    fields
}

/// The occurrence's `properties`: keys in code point order
/// (occurrences.py:224).
pub(crate) fn sorted_value(fields: &Fields) -> Value {
    super::support::string_object(
        fields
            .iter()
            .map(|(key, value)| (key.clone(), value.clone())),
    )
}

#[cfg(test)]
mod tests {
    use super::ordered;
    use prism_kicad_core::SchematicSymbolProperty;

    fn property(key: &str, value: &str) -> SchematicSymbolProperty {
        SchematicSymbolProperty {
            key: key.to_owned(),
            value: value.to_owned(),
            private: false,
        }
    }

    /// A later duplicate wins in its first position; an empty name is skipped
    /// (occurrences.py:75-77).
    #[test]
    fn duplicates_win_in_place_and_empty_names_are_skipped() {
        let fields = ordered(&[
            property("Value", "10k"),
            property("", "ignored"),
            property("MPN", "A"),
            property("Value", "22k"),
        ]);
        assert_eq!(fields.get("Value"), Some("22k"));
        assert_eq!(fields.get("MPN"), Some("A"));
        assert!(fields.get("").is_none());
        let keys: Vec<&str> = fields.iter().map(|(key, _)| key.as_str()).collect();
        assert_eq!(keys, ["Value", "MPN"]);
    }

    /// Text as written, including empty values (field map, `properties`).
    #[test]
    fn empty_values_are_kept() {
        let fields = ordered(&[property("Datasheet", "")]);
        assert_eq!(fields.get("Datasheet"), Some(""));
    }
}
