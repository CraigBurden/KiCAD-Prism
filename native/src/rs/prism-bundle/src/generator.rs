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

/// The short escapes of Python's `json.dumps`.
const SHORT_ESCAPES: [(char, &str); 7] = [
    ('"', "\\\""),
    ('\\', "\\\\"),
    ('\n', "\\n"),
    ('\r', "\\r"),
    ('\t', "\\t"),
    ('\u{8}', "\\b"),
    ('\u{c}', "\\f"),
];

fn write_char(out: &mut String, ch: char) {
    if let Some((_, escape)) = SHORT_ESCAPES.iter().find(|(special, _)| *special == ch) {
        out.push_str(escape);
    } else if (' '..='\u{7f}').contains(&ch) {
        out.push(ch);
    } else {
        let mut units = [0u16; 2];
        for unit in ch.encode_utf16(&mut units) {
            let _ = write!(out, "\\u{unit:04x}");
        }
    }
}

fn write_string(out: &mut String, text: &str) {
    out.push('"');
    for ch in text.chars() {
        write_char(out, ch);
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
        assert_eq!(bytes.len(), 1122);
        assert_eq!(
            digest(&bytes),
            "1a6ffda3f76c88df1164335693cfa2745795410a854b392a89521d4b2636039f"
        );
        let vectors = [
            (
                "0000000000000000000000000000000000000000000000000000000000000000",
                "81229c05c5c91007bfd1a199775bfcac1c90854e85008cfad7f038bbc9083ae7",
            ),
            (
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "e9074daa0134b271d17739777c484b91b733b2d83d5e3d8e5fb46b65488af3ab",
            ),
            (
                "42e41c598a193d09f6917ee92b7c71e52e9e15a251a63b7a955ef41beb841f34",
                "227367f0a2f9c13ebaf8839d158675f46fabb7ae7c1f755fb4aeae04863ea5bb",
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
            "2142d2323ce564010b7583ab5dd0029dd2ac2cf43af718dfc0045dbf28fe7de7"
        );
        assert_eq!(
            bundle_key(&"0".repeat(64), &bytes),
            "b6807733907b826a7b11db1d99ab08420f6f43879b5aea77953046458af8b354"
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
