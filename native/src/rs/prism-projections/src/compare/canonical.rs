//! Canonical JSON for the identity signatures of `pair_unmatched`
//! (`ecad-diff.mjs:97-157`).
//!
//! The reference's `stable_json` sorts an object's keys with `localeCompare`
//! and then `JSON.stringify`s the result. That string is only ever used to
//! decide whether two signatures are equal, so any total order that is the
//! same on both sides gives the same partition (parity trap T6, amendment C2
//! §6). We use Rust's `str` order (code point order).

use serde_json::{Map, Value};
use std::fmt::Write as _;

/// A canonical, deterministic serialization of `value`: object keys in code
/// point order, arrays in order, scalars as compact JSON.
pub fn canonical(value: &Value) -> String {
    let mut out = String::new();
    write_value(value, &mut out);
    out
}

fn write_value(value: &Value, out: &mut String) {
    match value {
        Value::Object(map) => write_object(map, out),
        Value::Array(items) => write_array(items, out),
        Value::Null => out.push_str("null"),
        Value::Bool(flag) => out.push_str(if *flag { "true" } else { "false" }),
        Value::Number(number) => {
            if number.as_f64() == Some(0.0) {
                out.push_str("0.0");
            } else {
                out.push_str(&number.to_string());
            }
        }
        Value::String(text) => write_string(text, out),
    }
}

fn write_object(map: &Map<String, Value>, out: &mut String) {
    let mut keys: Vec<&String> = map.keys().collect();
    keys.sort();
    out.push('{');
    for (index, key) in keys.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        write_string(key, out);
        out.push(':');
        write_value(&map[*key], out);
    }
    out.push('}');
}

fn write_array(items: &[Value], out: &mut String) {
    out.push('[');
    for (index, item) in items.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        write_value(item, out);
    }
    out.push(']');
}

fn write_string(text: &str, out: &mut String) {
    out.push('"');
    for ch in text.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            control if (control as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", control as u32);
            }
            other => out.push(other),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn object_keys_are_sorted_and_scalars_are_compact() {
        let value = json!({"b": 1, "a": [true, null, "x\n"], "c": {"z": 1, "y": 2}});
        assert_eq!(
            canonical(&value),
            r#"{"a":[true,null,"x\n"],"b":1,"c":{"y":2,"z":1}}"#
        );
    }

    #[test]
    fn negative_zero_is_written_as_zero() {
        assert_eq!(canonical(&json!(-0.0)), "0.0");
        assert_eq!(canonical(&Value::from(0.0)), "0.0");
    }
}
