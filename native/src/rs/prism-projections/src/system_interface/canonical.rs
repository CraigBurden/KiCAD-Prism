//! The digest's canonical text, today's `canonical_digest`
//! (interface_extractor.py:42-44): Python's
//! `json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`,
//! then SHA-256 (field-maps/system-interface.md, "Digest").
//!
//! The workspace's `serde_json` has `preserve_order` and `arbitrary_precision`,
//! so its own writer gives neither sorted keys nor Python's float spelling;
//! this writer does both, over the same [`Value`] the member decodes from.

use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::fmt::Write as _;

/// `"sha256:" + hex(sha256(canonical(body)))`, where `body` is the member
/// without `digest` (`interface_digest`, interface_extractor.py:52-62).
pub(super) fn digest(body: &Value) -> String {
    let mut text = String::new();
    write_value(&mut text, body);
    let mut hex = String::with_capacity(7 + 64);
    hex.push_str("sha256:");
    for byte in Sha256::digest(text.as_bytes()) {
        let _ = write!(hex, "{byte:02x}");
    }
    hex
}

/// The canonical text itself (for tests and diagnosis).
#[cfg(test)]
pub(super) fn canonical(value: &Value) -> String {
    let mut text = String::new();
    write_value(&mut text, value);
    text
}

fn write_value(out: &mut String, value: &Value) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(flag) => out.push_str(if *flag { "true" } else { "false" }),
        // Every number in the body is a Python float from `_round` (the field
        // map: "there is no integer field"), written as `repr`.
        Value::Number(number) => {
            out.push_str(&crate::python::float(number.as_f64().unwrap_or(f64::NAN)));
        }
        Value::String(text) => write_string(out, text),
        Value::Array(items) => write_array(out, items),
        Value::Object(map) => write_object(out, map),
    }
}

/// A JSON array: its items, comma-separated, wrapped in `[]`.
fn write_array(out: &mut String, items: &[Value]) {
    out.push('[');
    for (position, item) in items.iter().enumerate() {
        if position > 0 {
            out.push(',');
        }
        write_value(out, item);
    }
    out.push(']');
}

/// A JSON object with `sort_keys=True`: code point order, which is byte order
/// in UTF-8.
fn write_object(out: &mut String, map: &Map<String, Value>) {
    let mut entries: Vec<_> = map.iter().collect();
    entries.sort_unstable_by(|left, right| left.0.cmp(right.0));
    out.push('{');
    for (position, (key, item)) in entries.into_iter().enumerate() {
        if position > 0 {
            out.push(',');
        }
        write_string(out, key);
        out.push(':');
        write_value(out, item);
    }
    out.push('}');
}

/// `ensure_ascii=False`: only `"`, `\` and U+0000-U+001F are escaped, with
/// Python's short forms and lower-case `\u00xx`.
fn write_string(out: &mut String, text: &str) {
    out.push('"');
    for character in text.chars() {
        match character {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            control if u32::from(control) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", u32::from(control));
            }
            other => out.push(other),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    use super::{canonical, digest};
    use serde_json::json;

    #[test]
    fn matches_python_json_dumps() {
        // python3 -c 'import json;print(json.dumps(v, sort_keys=True,
        //   separators=(",", ":"), ensure_ascii=False))'
        let value = json!({
            "b": [1.0, -90.0, 0.0001, 1.6, null, true, false],
            "a": "±\"\\\n\r\t\u{8}\u{c}\u{1}\u{7f}\u{2028}/",
            "A": {"z": 100.0, "y": []},
        });
        assert_eq!(
            canonical(&value),
            "{\"A\":{\"y\":[],\"z\":100.0},\"a\":\"±\\\"\\\\\\n\\r\\t\\b\\f\\u0001\u{7f}\u{2028}/\",\
             \"b\":[1.0,-90.0,0.0001,1.6,null,true,false]}"
        );
    }

    #[test]
    fn the_empty_form_digest() {
        let body = json!({
            "schema": "prism.system_interface.v1",
            "hasPcb": false,
            "boardThicknessMm": null,
            "boardOutlineMm": null,
            "components": [],
            "diagnostics": [],
        });
        assert_eq!(
            digest(&body),
            "sha256:078d43da554f61205b324187b389718ebb745b192fab985186952824f3f742c4"
        );
    }
}
