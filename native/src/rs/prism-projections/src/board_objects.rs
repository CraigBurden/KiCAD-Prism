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
use prism_kicad_contracts::generated::prism_board_objects_a0 as bo;
use prism_kicad_contracts::generated::prism_board_objects_a0::BoardObjectsA0;

/// The member's schema id.
pub const SCHEMA: &str = "prism.board_objects.a0";

/// Build `projections/board-objects.json` from the single parse of the revision.
///
/// The documents are the generated contract types, built directly; the parse
/// stage serializes them once, so no `serde_json::Value` tree is ever made for
/// an object. Each `.kicad_sch`/`.kicad_pcb` tree is dropped as soon as its
/// document is emitted.
pub fn produce(input: &ProjectionInput<'_>) -> Result<Produced<BoardObjectsA0>, ProjectionError> {
    let mut warnings = Vec::new();
    let mut documents: Vec<bo::BoardObjectsDocument> = Vec::new();
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
        let parts = document(&path, text, kind, &mut warnings);
        let Some(parts) = parts else {
            continue;
        };
        documents.push(bo::BoardObjectsDocument {
            path: bo::RepoPath(path),
            objects: parts.objects,
            review_only_objects: parts.review_only,
        });
    }
    documents.sort_by(|left, right| left.path.0.cmp(&right.path.0));
    Ok(Produced {
        document: BoardObjectsA0 {
            schema: SCHEMA.to_owned(),
            documents,
        },
        warnings,
    })
}

/// One document's objects and review-only objects, or `None` when it cannot be
/// read (a warning is recorded).
fn document(
    path: &str,
    text: &str,
    kind: DocumentKind,
    warnings: &mut Vec<ProducerWarning>,
) -> Option<DocumentParts> {
    match kind {
        DocumentKind::Schematic | DocumentKind::Board => {
            if tree::unbalanced(text).is_some() {
                warnings.push(unreadable(path));
                return None;
            }
            let roots = tree::parse(text);
            let root = roots.into_iter().next();
            let Some(root) = root else {
                warnings.push(unreadable(path));
                return None;
            };
            let parts = if matches!(kind, DocumentKind::Board) {
                board::document(path, &root, warnings)
            } else {
                schematic::document(path, &root, warnings)
            };
            drop(root);
            Some(parts)
        }
        DocumentKind::Project => match review::project(path, text, warnings) {
            Some(review) => Some(DocumentParts::review_only(review)),
            None => {
                warnings.push(unreadable(path));
                None
            }
        },
        DocumentKind::DesignRules => {
            if tree::unbalanced(text).is_some() {
                warnings.push(unreadable(path));
                return None;
            }
            Some(DocumentParts::review_only(review::design_rules(path, text)))
        }
    }
}

/// One document's objects and review-only objects.
pub(crate) struct DocumentParts {
    pub objects: Vec<bo::BoardObjectsObject>,
    pub review_only: Vec<bo::BoardObjectsReviewOnlyObject>,
}

impl DocumentParts {
    fn review_only(review_only: Vec<bo::BoardObjectsReviewOnlyObject>) -> Self {
        Self {
            objects: Vec::new(),
            review_only,
        }
    }
}

/// The four parsed kinds (field map, "Inputs").
#[derive(Clone, Copy)]
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
