//! The generator id's canonical bytes, its digest and the bundle key
//! (cli-spec.md §5.1.3–§5.1.4).
//!
//! The generator bytes are `schema` first, every other key in code point
//! order at every level, compact, ASCII only (`ensure_ascii`). [`canonical`]
//! recomputes them from any JSON value, so a reader holding the document as
//! data (the manifest's `generator`) does not depend on key order.

use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fmt::Write as _;

/// The bundle key's domain prefix.
pub const BUNDLE_KEY_DOMAIN: &str = "prism.bundle_key.a0";

/// Lowercase hex of `bytes`.
#[must_use]
pub fn hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

/// Lowercase hex SHA-256 of `bytes`.
#[must_use]
pub fn sha256_hex(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}

fn write_string(out: &mut String, text: &str) {
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
            ch if (' '..='\u{7f}').contains(&ch) => out.push(ch),
            ch => {
                let mut units = [0u16; 2];
                for unit in ch.encode_utf16(&mut units) {
                    let _ = write!(out, "\\u{unit:04x}");
                }
            }
        }
    }
    out.push('"');
}

fn write_value(out: &mut String, value: &Value, top: bool) {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            if top && let Some(at) = keys.iter().position(|key| *key == "schema") {
                let schema = keys.remove(at);
                keys.insert(0, schema);
            }
            out.push('{');
            for (index, key) in keys.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_string(out, key);
                out.push(':');
                write_value(out, &map[*key], false);
            }
            out.push('}');
        }
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_value(out, item, false);
            }
            out.push(']');
        }
        Value::String(text) => write_string(out, text),
        other => out.push_str(&other.to_string()),
    }
}

/// The canonical bytes of a generator document held as data.
#[must_use]
pub fn canonical(document: &Value) -> Vec<u8> {
    let mut out = String::new();
    write_value(&mut out, document, true);
    out.into_bytes()
}

/// `generator_digest`: SHA-256 hex of the generator bytes.
#[must_use]
pub fn digest(generator_bytes: &[u8]) -> String {
    sha256_hex(generator_bytes)
}

/// The bundle key of `revision_key` (64 lowercase hex) and the generator.
#[must_use]
pub fn bundle_key(revision_key: &str, generator_bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(BUNDLE_KEY_DOMAIN.as_bytes());
    hasher.update([0]);
    hasher.update(revision_key.as_bytes());
    hasher.update([0]);
    hasher.update(generator_bytes);
    hex(&hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXAMPLE: &str =
        include_str!("../../../../contracts/prism/examples/CliVersionA0.example.json");

    #[test]
    fn the_cli_spec_vectors_hold() {
        let document: Value = serde_json::from_str(EXAMPLE).unwrap();
        let bytes = canonical(&document);
        assert_eq!(bytes.len(), 1061);
        assert_eq!(
            digest(&bytes),
            "96ec6f85379966983bd1f9d9c78d8eba1b73a61ea9fad54c22189689c83b4add"
        );
        let vectors = [
            (
                "0000000000000000000000000000000000000000000000000000000000000000",
                "a770ec388a61b8a8ef2c01295535d9de7f95179d4a8022fabcd87fb61bbe5931",
            ),
            (
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "0b76554173eed259619144a418069ac2faa88e28fcd6dee63690c8a12d0e5d27",
            ),
            (
                "42e41c598a193d09f6917ee92b7c71e52e9e15a251a63b7a955ef41beb841f34",
                "e3a06226c5b2b6ea030d3cb9ad9f023738f9b37210f36528fbf7b8892349f05b",
            ),
        ];
        for (revision_key, expected) in vectors {
            assert_eq!(bundle_key(revision_key, &bytes), expected);
        }
        let mut bumped = document;
        bumped["kicad_version"] = Value::from("10.0.7");
        let bytes = canonical(&bumped);
        assert_eq!(
            digest(&bytes),
            "5e5139338678128c4351c31a18d02b771cadfcffa2b6374152c6d2d9319e3322"
        );
        assert_eq!(
            bundle_key(&"0".repeat(64), &bytes),
            "d55467222f57b0c2877280f44145ff8372cf22961529d78690e6450bb2418d80"
        );
    }

    #[test]
    fn canonical_ignores_input_key_order_and_escapes_like_python() {
        let shuffled: Value =
            serde_json::from_str(r#"{"b":{"y":1,"x":"é"},"schema":"s","a":[2,1]}"#).unwrap();
        assert_eq!(
            String::from_utf8(canonical(&shuffled)).unwrap(),
            "{\"schema\":\"s\",\"a\":[2,1],\"b\":{\"x\":\"\\u00e9\",\"y\":1}}"
        );
    }
}
