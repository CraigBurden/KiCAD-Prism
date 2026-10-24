//! Connector candidates, a port of `connector_detection.classify`
//! (backend/app/services/systems/connector_detection.py:42-65). The rule order
//! is frozen in `docs/system-builder/CONTRACTS.md` §4.1: an explicit field wins
//! in both directions, then the reference prefix, then the library nickname
//! (which skips KiCad's test-point symbols).

use std::collections::BTreeMap;

/// `REFERENCE_PREFIXES` (connector_detection.py:16): v1.10, `J` only.
const REFERENCE_PREFIXES: [&str; 1] = ["J"];
/// `_PORT_FIELD` (connector_detection.py:17).
const PORT_FIELD: &str = "prismport";
/// `_SYSTEM_FIELD` (connector_detection.py:18).
const SYSTEM_FIELD: &str = "system";
/// `_TRUE` (connector_detection.py:19).
const TRUE: [&str; 4] = ["true", "yes", "1", "port"];
/// `_FALSE` (connector_detection.py:20).
const FALSE: [&str; 3] = ["false", "no", "0"];

/// Python `str.casefold()` restricted to the characters connector detection
/// folds. Only ASCII survives `_fold`'s `[^a-z0-9]` filter, and Rust's
/// `to_lowercase` agrees with `casefold` on every character that folds into
/// ASCII (e.g. U+212A KELVIN SIGN → `k`).
fn casefold(text: &str) -> String {
    text.chars().flat_map(char::to_lowercase).collect()
}

/// `_fold(name)` (connector_detection.py:23-24):
/// `re.sub(r"[^a-z0-9]", "", name.casefold())`.
fn fold(name: &str) -> String {
    casefold(name)
        .chars()
        .filter(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
        .collect()
}

/// `reference_prefix(reference)` (connector_detection.py:27-29):
/// `re.match(r"[A-Za-z]+", reference)`, upper-cased.
fn reference_prefix(reference: &str) -> String {
    reference
        .chars()
        .take_while(char::is_ascii_alphabetic)
        .collect::<String>()
        .to_uppercase()
}

/// `_library(identifier)` (connector_detection.py:32-33): the part before the
/// first `:`, or `""` without one.
fn library(identifier: &str) -> &str {
    identifier
        .split_once(':')
        .map_or("", |(nickname, _name)| nickname)
}

/// `_is_test_point(lib_id)` (connector_detection.py:36-39): the name after the
/// last `:` casefolds to `testpoint…`.
fn is_test_point(lib_id: &str) -> bool {
    let name = lib_id.rsplit_once(':').map_or(lib_id, |(_head, tail)| tail);
    casefold(name).starts_with("testpoint")
}

/// `classify(reference, lib_id, footprint, fields)` (connector_detection.py:42-65):
/// `(candidate, reason)`, reason one of `field`, `refdes`, `library`, `none`.
pub(super) fn classify(
    reference: &str,
    lib_id: &str,
    footprint: &str,
    fields: &BTreeMap<String, String>,
) -> (bool, &'static str) {
    let mut folded = BTreeMap::new();
    for (key, value) in fields {
        folded.insert(fold(key), value.trim().to_lowercase());
    }
    let explicit = folded.get(PORT_FIELD).map_or("", String::as_str);
    if TRUE.contains(&explicit) {
        return (true, "field");
    }
    if FALSE.contains(&explicit) {
        return (false, "field");
    }
    if folded.get(SYSTEM_FIELD).map(String::as_str) == Some("connector") {
        return (true, "field");
    }
    if REFERENCE_PREFIXES.contains(&reference_prefix(reference).as_str()) {
        return (true, "refdes");
    }
    if is_test_point(lib_id) {
        return (false, "none");
    }
    for identifier in [lib_id, footprint] {
        if casefold(library(identifier)).starts_with("connector") {
            return (true, "library");
        }
    }
    (false, "none")
}

#[cfg(test)]
mod tests {
    use super::classify;
    use std::collections::BTreeMap;

    fn fields(rows: &[(&str, &str)]) -> BTreeMap<String, String> {
        rows.iter()
            .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
            .collect()
    }

    #[test]
    fn an_explicit_port_field_wins_in_both_directions() {
        // `explicit in _TRUE` / `_FALSE` (connector_detection.py:51-55).
        for value in ["true", "yes", "1", "port", " TRUE ", "Yes"] {
            assert_eq!(
                classify("R1", "Device:R", "", &fields(&[("prismport", value)])),
                (true, "field"),
                "{value}"
            );
        }
        for value in ["false", "no", "0", "No"] {
            assert_eq!(
                classify("J1", "Device:R", "", &fields(&[("prismport", value)])),
                (false, "field"),
                "{value}"
            );
        }
        // The folded key reaches the same field: `_fold("Prism Port")`.
        assert_eq!(
            classify("R1", "Device:R", "", &fields(&[("Prism Port", "PORT")])),
            (true, "field")
        );
    }

    #[test]
    fn the_system_field_marks_a_connector() {
        // `folded.get(_SYSTEM_FIELD) == "connector"` (connector_detection.py:56-57).
        assert_eq!(
            classify("R1", "Device:R", "", &fields(&[("System", "Connector")])),
            (true, "field")
        );
    }

    #[test]
    fn the_reference_prefix_decides_next() {
        // `reference_prefix(reference) in REFERENCE_PREFIXES` (:58-59).
        assert_eq!(
            classify("J9", "Device:R", "", &BTreeMap::new()),
            (true, "refdes")
        );
        assert_eq!(
            classify("j9", "Device:R", "", &BTreeMap::new()),
            (true, "refdes")
        );
        assert_eq!(
            classify("R1", "Device:R", "", &BTreeMap::new()),
            (false, "none")
        );
    }

    #[test]
    fn a_test_point_is_never_a_candidate() {
        // `_is_test_point(lib_id)` (:36-39, :60-61): the last name segment.
        assert_eq!(
            classify(
                "TP1",
                "Connector:TestPoint_2Pads",
                "TestPoint:TestPoint_Pad",
                &BTreeMap::new()
            ),
            (false, "none")
        );
        // The `Connector` library rule would have matched: the test-point rule
        // comes first.
        assert_eq!(
            classify("TP1", "Connector:TestPoint", "", &BTreeMap::new()),
            (false, "none")
        );
    }

    #[test]
    fn the_library_nickname_matches_lib_id_then_footprint() {
        // `for identifier in (lib_id, footprint)` (:62-64).
        assert_eq!(
            classify("P1", "Connector_Generic:Conn_01x02", "", &BTreeMap::new()),
            (true, "library")
        );
        assert_eq!(
            classify("P1", "Device:R", "Connector_Library:Conn", &BTreeMap::new()),
            (true, "library")
        );
        // No library nickname at all: another rule applies.
        assert_eq!(
            classify("P1", "Bar", "Baz", &BTreeMap::new()),
            (false, "none")
        );
    }
}
