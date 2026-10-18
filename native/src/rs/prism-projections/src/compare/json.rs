//! Small JSON-value helpers shared by the compare builders. Every millimetre
//! number is written through [`number`], which folds `-0` to `0` exactly as
//! ECMAScript `JSON.stringify` does (`ecad-diff.mjs:97-107`).

use super::numbers::ecma_number;
use serde_json::{Map, Value};

/// A `[x, y]` point in millimetres, today's `at`.
pub type Point = [f64; 2];

/// `value` as a JSON number written as ECMAScript writes it (T3): `152`, not
/// `152.0`, and `-0` as `0`. `Value::from(f64)` would write `152.0`, which a
/// reader such as Python parses as a float where today's output gave an
/// integer (Design Comparison's document diff shows that type).
pub fn number(value: f64) -> Value {
    ecma_number(value)
        .parse::<serde_json::Number>()
        .map_or(Value::Null, Value::Number)
}

/// `value` with every number rewritten as [`number`] writes it. The member
/// writes review fields with Rust's float text (`1.0`); today's output is
/// `JSON.stringify`'s, which never writes a fractional zero.
pub fn ecma(value: Value) -> Value {
    match value {
        Value::Number(text) => text.as_f64().map_or(Value::Number(text), number),
        Value::Array(items) => Value::Array(items.into_iter().map(ecma).collect()),
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(key, item)| (key, ecma(item)))
                .collect(),
        ),
        other => other,
    }
}

/// `[x, y]` as a JSON array.
pub fn point(at: Point) -> Value {
    Value::Array(vec![number(at[0]), number(at[1])])
}

/// A list of strings as a JSON array.
pub fn strings(items: &[String]) -> Value {
    Value::Array(items.iter().map(|item| Value::from(item.clone())).collect())
}

/// A JSON object from `(key, value)` pairs.
pub fn object_of(entries: impl IntoIterator<Item = (&'static str, Value)>) -> Value {
    let mut map = Map::new();
    for (key, value) in entries {
        map.insert(key.to_owned(), value);
    }
    Value::Object(map)
}

/// Insert `value` at `key` in `map`.
pub fn set(map: &mut Map<String, Value>, key: &str, value: Value) {
    map.insert(key.to_owned(), value);
}

/// Insert `key: value` in `map` only when `value` is present.
pub fn set_opt_str(map: &mut Map<String, Value>, key: &str, value: &Option<String>) {
    if let Some(value) = value {
        set(map, key, Value::from(value.clone()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_are_written_as_ecmascript_writes_them() {
        assert_eq!(serde_json::to_string(&number(152.0)).unwrap(), "152");
        assert_eq!(serde_json::to_string(&number(-0.0)).unwrap(), "0");
        assert_eq!(serde_json::to_string(&number(23.81)).unwrap(), "23.81");
        assert_eq!(serde_json::to_string(&number(-1.5)).unwrap(), "-1.5");
    }

    #[test]
    fn member_numbers_lose_their_fractional_zero() {
        let member: Value =
            serde_json::from_str(r#"{"Unit":1.0,"Pads":[2.0,2.5],"Name":"R1"}"#).unwrap();
        assert_eq!(
            serde_json::to_string(&ecma(member)).unwrap(),
            r#"{"Unit":1,"Pads":[2,2.5],"Name":"R1"}"#
        );
    }
}
