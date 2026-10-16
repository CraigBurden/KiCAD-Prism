//! The symbol/footprint join by reference designator (occurrences.py:254-265).

use serde_json::{Value, json};
use std::collections::BTreeMap;

/// `references`: one entry per distinct reference that a symbol occurrence or a
/// footprint carries, sorted by `reference` in code point order. Each entry
/// keeps its symbol `kiidPath`s in hierarchy order and its footprint `uuid`s in
/// board order (occurrences.py:254-265).
pub(crate) fn build(symbols: &[Value], footprints: &[Value]) -> Vec<Value> {
    let mut grouped: BTreeMap<String, (Vec<String>, Vec<String>)> = BTreeMap::new();
    for symbol in symbols {
        let (Some(reference), Some(kiid_path)) = (reference_of(symbol), kiid_path_of(symbol))
        else {
            continue;
        };
        grouped
            .entry(reference.to_owned())
            .or_default()
            .0
            .push(kiid_path.to_owned());
    }
    for footprint in footprints {
        let (Some(reference), Some(uuid)) = (reference_of(footprint), uuid_of(footprint)) else {
            continue;
        };
        grouped
            .entry(reference.to_owned())
            .or_default()
            .1
            .push(uuid.to_owned());
    }
    grouped
        .into_iter()
        .map(|(reference, (symbols, footprints))| {
            json!({
                "reference": reference,
                "symbols": symbols,
                "footprints": footprints,
            })
        })
        .collect()
}

fn reference_of(value: &Value) -> Option<&str> {
    value.get("reference").and_then(Value::as_str)
}

fn kiid_path_of(value: &Value) -> Option<&str> {
    value.get("kiidPath").and_then(Value::as_str)
}

fn uuid_of(value: &Value) -> Option<&str> {
    value.get("uuid").and_then(Value::as_str)
}

#[cfg(test)]
mod tests {
    use super::build;
    use serde_json::json;

    /// Multi-unit symbols group under one reference, in symbol then footprint
    /// order; references sort in code point order (occurrences.py:265).
    #[test]
    fn groups_and_sorts() {
        let symbols = vec![
            json!({"reference": "R10", "kiidPath": "/a/10"}),
            json!({"reference": "R1", "kiidPath": "/a/1"}),
            json!({"reference": "R1", "kiidPath": "/a/1b"}),
            json!({"kiidPath": "/a/none"}),
        ];
        let footprints = vec![
            json!({"reference": "R1", "uuid": "u1"}),
            json!({"reference": "J9", "uuid": "j9"}),
            json!({"uuid": "no-ref"}),
        ];
        assert_eq!(
            build(&symbols, &footprints),
            vec![
                json!({"reference": "J9", "symbols": [], "footprints": ["j9"]}),
                json!({"reference": "R1", "symbols": ["/a/1", "/a/1b"], "footprints": ["u1"]}),
                json!({"reference": "R10", "symbols": ["/a/10"], "footprints": []}),
            ]
        );
    }
}
