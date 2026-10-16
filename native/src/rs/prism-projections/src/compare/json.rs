//! Small JSON-value helpers shared by the compare builders. Every millimetre
//! number is written through [`number`], which folds `-0` to `0` exactly as
//! ECMAScript `JSON.stringify` does (`ecad-diff.mjs:97-107`).

use serde_json::{Map, Value};

/// A `[x, y]` point in millimetres, today's `at`.
pub type Point = [f64; 2];

/// `value` as a JSON number, with `-0` normalised to `0`.
pub fn number(value: f64) -> Value {
    if value == 0.0 {
        Value::from(0.0)
    } else {
        Value::from(value)
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

/// Insert a millimetre point only when it is present.
pub fn set_opt_point(map: &mut Map<String, Value>, key: &str, value: Option<Point>) {
    if let Some(value) = value {
        set(map, key, point(value));
    }
}

/// Insert `key: value` as a JSON number only when `value` is present.
pub fn set_opt_number(map: &mut Map<String, Value>, key: &str, value: Option<f64>) {
    if let Some(value) = value {
        set(map, key, number(value));
    }
}

/// Insert `key: value` as a JSON flag only when `value` is present.
pub fn set_opt_bool(map: &mut Map<String, Value>, key: &str, value: Option<bool>) {
    if let Some(value) = value {
        set(map, key, Value::from(value));
    }
}

/// Insert a list of strings only when it is present.
pub fn set_opt_strings(map: &mut Map<String, Value>, key: &str, value: &Option<Vec<String>>) {
    if let Some(value) = value {
        set(map, key, strings(value));
    }
}
