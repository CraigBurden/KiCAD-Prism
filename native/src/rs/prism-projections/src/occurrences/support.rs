//! Small shared helpers of the occurrences producer.

use crate::ProducerWarning;
use serde_json::{Map, Value};
use std::collections::BTreeMap;

/// The canonical `KiCadUuid` form: `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`,
/// the `UUID` regex the prototype applies (`occurrences.py:35`, `:188`,
/// `:237`).
pub(crate) fn is_canonical_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 36 {
        return false;
    }
    bytes.iter().enumerate().all(|(index, byte)| match index {
        8 | 13 | 18 | 23 => *byte == b'-',
        _ => byte.is_ascii_digit() || (b'a'..=b'f').contains(byte),
    })
}

/// `project_file.stem` for the anchor (`occurrences.py:160`): the file name
/// without a `.kicad_pro` suffix, matched as the bundle's `project_name`.
pub(crate) fn project_stem(path: &str) -> String {
    let filename = path.rsplit('/').next().unwrap_or(path);
    let suffix = ".kicad_pro";
    match filename.len().checked_sub(suffix.len()) {
        Some(cut) if filename[cut..].eq_ignore_ascii_case(suffix) => filename[..cut].to_owned(),
        _ => filename.to_owned(),
    }
}

/// A JSON object of string values, keys in code point order (`BTreeMap`).
pub(crate) fn string_object(entries: impl IntoIterator<Item = (String, String)>) -> Value {
    let sorted: BTreeMap<String, String> = entries.into_iter().collect();
    let object = sorted
        .into_iter()
        .map(|(key, value)| (key, Value::String(value)))
        .collect::<Map<String, Value>>();
    Value::Object(object)
}

/// A producer warning with a stable code from the field map.
pub(crate) fn warning(code: &str, message: String) -> ProducerWarning {
    ProducerWarning {
        code: code.to_owned(),
        message,
    }
}

#[cfg(test)]
mod tests {
    use super::{is_canonical_uuid, project_stem};

    /// The prototype's `UUID` regex (`occurrences.py:35`) accepts only the
    /// canonical lowercase form.
    #[test]
    fn uuid_validation_matches_the_prototype_regex() {
        assert!(is_canonical_uuid("ec3880bf-62c2-5c41-a50f-6381596c30ef"));
        assert!(!is_canonical_uuid(""));
        assert!(!is_canonical_uuid("EC3880BF-62C2-5C41-A50F-6381596C30EF"));
        assert!(!is_canonical_uuid("ec3880bf62c25c41a50f6381596c30ef"));
        assert!(!is_canonical_uuid("ec3880bf-62c2-5c41-a50f-6381596c30e"));
        assert!(!is_canonical_uuid("zc3880bf-62c2-5c41-a50f-6381596c30ef"));
    }

    /// `Path(project_file).stem` (`occurrences.py:160`).
    #[test]
    fn project_stem_is_the_anchor_file_name_without_suffix() {
        assert_eq!(
            project_stem("dir/variants_oracle.kicad_pro"),
            "variants_oracle"
        );
        assert_eq!(
            project_stem("USB-PD-Trigger-Board.kicad_pro"),
            "USB-PD-Trigger-Board"
        );
        assert_eq!(project_stem("demo.KICAD_PRO"), "demo");
        assert_eq!(project_stem("plain"), "plain");
    }
}
