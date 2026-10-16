//! The assembly diagnostics, a port of `_source_state_mismatches`
//! (semantic_index_variants.py:726-749) and the source and board diagnostics
//! (:535-643): the unsupported KiCad 11 variant tokens, the rule-area flags and
//! the schematic/footprint state mismatches.

use super::super::scan;
use super::{
    BOARD_UNSUPPORTED, ComponentState, FootprintState, Graph, SCHEMATIC_UNSUPPORTED, legacy_in_bom,
};
use crate::ProjectionInput;
use serde_json::{Map, Value, json};

/// `_source_state_mismatches` (semantic_index_variants.py:726-749).
pub(super) fn source_state_mismatches(
    components: &[(String, ComponentState)],
    footprints_by_reference: &[(String, Vec<FootprintState>)],
    variant_name: Option<&str>,
    diagnostics: &mut Vec<Value>,
) {
    for (reference, component) in components {
        let Some(group) = footprints_by_reference
            .iter()
            .find(|(candidate, _)| candidate == reference)
            .map(|(_, group)| group)
        else {
            continue;
        };
        if group.len() != 1 {
            continue;
        }
        let footprint = &group[0];
        if component.flags.dnp != footprint.flags.0
            || component.flags.exclude_from_bom != footprint.flags.1
        {
            let mut diagnostic = Map::new();
            diagnostic.insert("code".to_owned(), json!("source-state-mismatch"));
            diagnostic.insert("severity".to_owned(), json!("info"));
            diagnostic.insert("reference".to_owned(), json!(reference));
            diagnostic.insert(
                "message".to_owned(),
                json!("Schematic and footprint state disagree; neither side wins."),
            );
            if let Some(variant_name) = variant_name {
                diagnostic.insert("variant".to_owned(), json!(variant_name));
            }
            diagnostics.push(Value::Object(diagnostic));
        }
    }
}

/// `_read_text` (semantic_index_variants.py:564-568): decode a source, ignoring
/// invalid UTF-8 as today's `errors="ignore"`.
fn read_text(input: &ProjectionInput<'_>, path: &str) -> Option<String> {
    input
        .sources
        .read(path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
}

/// `_source_diagnostics` (semantic_index_variants.py:578-621).
pub(super) fn source_diagnostics(input: &ProjectionInput<'_>, graph: &Graph<'_>) -> Vec<Value> {
    let mut diagnostics = Vec::new();
    if legacy_in_bom(graph.version) && !graph.top_path.is_empty() {
        diagnostics.push(json!({
            "code": "legacy-in-bom-semantics",
            "severity": "info",
            "path": graph.top_path,
            "message": "Schematic version predates the positive in_bom record token.",
            "detail": {"version": graph.version},
        }));
    }
    for path in &graph.schematic_paths {
        let Some(text) = read_text(input, path) else {
            continue;
        };
        let tokens = scan::unsupported_tokens(&text, &SCHEMATIC_UNSUPPORTED);
        if !tokens.is_empty() {
            diagnostics.push(json!({
                "code": "unsupported-variant-token",
                "severity": "info",
                "path": path,
                "message": "KiCad 11 variant tokens were ignored.",
                "detail": {"tokens": tokens},
            }));
        }
        for detail in scan::rule_areas(&text) {
            let detail = detail
                .into_iter()
                .map(|(key, value)| (key.to_owned(), Value::Bool(value)))
                .collect::<Map<_, _>>();
            diagnostics.push(json!({
                "code": "rule-area-flags-unsupported",
                "severity": "warning",
                "path": path,
                "message": "Rule-area-driven exclusion is not resolved this release.",
                "detail": detail,
            }));
        }
    }
    diagnostics
}

/// `_board_diagnostics` (semantic_index_variants.py:624-643).
pub(super) fn board_diagnostics(input: &ProjectionInput<'_>) -> Vec<Value> {
    let Some(board) = input.board else {
        return Vec::new();
    };
    let tokens = scan::unsupported_tokens(board.text, &BOARD_UNSUPPORTED);
    if tokens.is_empty() {
        return Vec::new();
    }
    vec![json!({
        "code": "unsupported-variant-token",
        "severity": "info",
        "path": board.path,
        "message": "KiCad 11 variant tokens were ignored.",
        "detail": {"tokens": tokens},
    })]
}
