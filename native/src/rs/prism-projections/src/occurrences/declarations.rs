//! The variant declarations: the project registry then the board header
//! (occurrences.py:267-281).

use crate::ProjectionInput;
use serde_json::{Map, Value};

/// `variantDeclarations`: the `.kicad_pro` registry (`$.schematic.variants`) in
/// file order, then the board `(variants …)` block in file order; an entry is
/// kept when its name is non-empty, `< Default >` included, and a description is
/// present only when it is non-empty (occurrences.py:267-281, field map D7).
pub(crate) fn build(input: &ProjectionInput<'_>) -> Vec<Value> {
    let mut declarations = Vec::new();
    if let Ok(variants) = input.project.document.view().variants() {
        for variant in variants {
            if let Some(item) =
                declaration("project", &variant.name, variant.description.as_deref())
            {
                declarations.push(item);
            }
        }
    }
    if let Some(board) = input.board {
        for variant in board.view.variants() {
            let Ok(variant) = variant else {
                continue;
            };
            if let Some(item) = declaration("pcb", &variant.name, variant.description.as_deref()) {
                declarations.push(item);
            }
        }
    }
    declarations
}

/// One declaration, or `None` for an empty name (occurrences.py:269-280).
fn declaration(source: &str, name: &str, description: Option<&str>) -> Option<Value> {
    if name.is_empty() {
        return None;
    }
    let mut item = Map::new();
    item.insert("source".to_owned(), Value::String(source.to_owned()));
    item.insert("name".to_owned(), Value::String(name.to_owned()));
    if let Some(description) = description.filter(|description| !description.is_empty()) {
        item.insert(
            "description".to_owned(),
            Value::String(description.to_owned()),
        );
    }
    Some(Value::Object(item))
}

#[cfg(test)]
mod tests {
    use super::declaration;
    use serde_json::json;

    /// `< Default >` is kept, an empty name is dropped, and an empty description
    /// is absent (occurrences.py:270-280, D7).
    #[test]
    fn names_and_descriptions() {
        assert_eq!(
            declaration("project", "Lite", Some("Cost-reduced build")),
            Some(json!({"source": "project", "name": "Lite",
                        "description": "Cost-reduced build"}))
        );
        assert_eq!(
            declaration("pcb", "< Default >", Some("")),
            Some(json!({"source": "pcb", "name": "< Default >"}))
        );
        assert_eq!(declaration("project", "", Some("x")), None);
        assert_eq!(
            declaration("project", "Pro", None),
            Some(json!({"source": "project", "name": "Pro"}))
        );
    }
}
