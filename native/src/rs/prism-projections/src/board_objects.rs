//! `projections/board-objects.json` (`prism.board_objects.a0`), WP-P2. The
//! rules for every field are in `native/contracts/prism/field-maps/board-objects.md`;
//! it replaces today's Node object index (`backend/design-compare-parser/ecad-parse.mjs`).
//!
//! Every `.kicad_sch`, `.kicad_pcb`, `.kicad_pro` and `.kicad_dru` of the
//! bundle's source set becomes one `documents[]` entry, keyed by its
//! repository-relative path and sorted by path. Each document is tokenized
//! once ([`tree`]); the same tree gives the objects, the file order and every
//! "as written" value, and [`digest`] gives each object's `contentDigest`.
//! Review-only settings objects come from [`review`]. A document that cannot
//! be read is left out with a warning (divergence 10).

mod blake2b;
mod board;
mod digest;
mod emit;
mod review;
mod schematic;

mod tree;
mod units;

use crate::{Produced, ProducerWarning, ProjectionError, ProjectionInput};
use prism_kicad_contracts::generated::prism_board_objects_a0::BoardObjectsA0;
use serde_json::{Value, json};

/// The member's schema id.
pub const SCHEMA: &str = "prism.board_objects.a0";
const NAME: &str = "projections/board-objects.json";

/// Build `projections/board-objects.json` from the single parse of the revision.
pub fn produce(input: &ProjectionInput<'_>) -> Result<Produced<BoardObjectsA0>, ProjectionError> {
    let mut warnings = Vec::new();
    let mut documents: Vec<Value> = Vec::new();
    for path in input.sources.paths() {
        let Some(kind) = DocumentKind::of(&path) else {
            continue;
        };
        let Some(bytes) = input.sources.read(&path) else {
            continue;
        };
        let Ok(text) = std::str::from_utf8(&bytes) else {
            warnings.push(unreadable(&path));
            continue;
        };
        let parts = match kind {
            DocumentKind::Schematic | DocumentKind::Board => {
                if tree::unbalanced(text).is_some() {
                    warnings.push(unreadable(&path));
                    continue;
                }
                let roots = tree::parse(text);
                let Some(root) = roots.into_iter().next() else {
                    warnings.push(unreadable(&path));
                    continue;
                };
                let board = matches!(kind, DocumentKind::Board);
                if board {
                    board::document(&path, &root, &mut warnings)
                } else {
                    schematic::document(&path, &root, &mut warnings)
                }
            }
            DocumentKind::Project => match review::project(&path, text, &mut warnings) {
                Some(review) => DocumentParts::review_only(review),
                None => {
                    warnings.push(unreadable(&path));
                    continue;
                }
            },
            DocumentKind::DesignRules => {
                if tree::unbalanced(text).is_some() {
                    warnings.push(unreadable(&path));
                    continue;
                }
                DocumentParts::review_only(review::design_rules(&path, text))
            }
        };
        documents.push(json!({
            "path": path,
            "objects": parts.objects,
            "reviewOnlyObjects": parts.review_only,
        }));
    }
    documents.sort_by(|left, right| {
        left["path"]
            .as_str()
            .unwrap_or_default()
            .cmp(right["path"].as_str().unwrap_or_default())
    });
    let value = json!({"schema": SCHEMA, "documents": documents});
    let document: BoardObjectsA0 = serde_json::from_value(value)
        .map_err(|error| ProjectionError::new(format!("{NAME}: {error}")))?;
    Ok(Produced { document, warnings })
}

/// One document's objects and review-only objects.
pub(crate) struct DocumentParts {
    pub objects: Vec<Value>,
    pub review_only: Vec<Value>,
}

impl DocumentParts {
    fn review_only(review_only: Vec<Value>) -> Self {
        Self {
            objects: Vec::new(),
            review_only,
        }
    }
}

/// The four parsed kinds (field map, "Inputs").
enum DocumentKind {
    Schematic,
    Board,
    Project,
    DesignRules,
}

impl DocumentKind {
    fn of(path: &str) -> Option<Self> {
        if path.ends_with(".kicad_sch") {
            Some(Self::Schematic)
        } else if path.ends_with(".kicad_pcb") {
            Some(Self::Board)
        } else if path.ends_with(".kicad_pro") {
            Some(Self::Project)
        } else if path.ends_with(".kicad_dru") {
            Some(Self::DesignRules)
        } else {
            None
        }
    }
}

fn unreadable(path: &str) -> ProducerWarning {
    ProducerWarning {
        code: "board-objects-unreadable-document".to_owned(),
        message: format!("{path} could not be read as a KiCad document"),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_empty_form_decodes() {
        crate::test_support::with_bare_project(|input| {
            let produced = super::produce(input).unwrap();
            let value = serde_json::to_value(&produced.document).unwrap();
            assert_eq!(value["schema"], super::SCHEMA);
            assert_eq!(value["documents"].as_array().unwrap().len(), 0);
        });
    }
}
