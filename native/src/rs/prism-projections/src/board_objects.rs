//! `projections/board-objects.json` (`prism.board_objects.a0`), WP-P2. The
//! rules for every field are in `native/contracts/prism/field-maps/board-objects.md`;
//! it replaces today's Node object index (`backend/design-compare-parser/ecad-parse.mjs`).
//!
//! Every document of the project's own closure becomes one `documents[]`
//! entry, keyed by its repository-relative path and sorted by path: the
//! project file, the `.kicad_dru` beside it (absent is fine), the board, and
//! the schematics the root schematic reaches (`SchematicModel::bundle`).
//! Another project's files, and a schematic the design never reaches, are not
//! this project's documents (divergence D11). Each document is tokenized
//! once ([`tree`]); the same tokens give the objects, the file order and every
//! "as written" value, and [`digest`] gives each object's `contentDigest`.
//! The board is read one top-level item at a time, so it is never held as one
//! tree. Review-only settings objects come from [`review`]. A document that
//! cannot be read is left out with a warning (divergence 10).

mod blake2b;
mod board;
mod digest;
mod emit;
mod review;
mod schematic;

mod tree;
mod units;

use crate::{Produced, ProducerWarning, ProjectionError, ProjectionInput, SchematicModel};
use prism_kicad_contracts::generated::prism_board_objects_a0 as bo;
use prism_kicad_contracts::generated::prism_board_objects_a0::BoardObjectsA0;
use prism_kicad_contracts::generated::source_bundle_manifest::SourceKind;

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
    for path in project_documents(input.schematic, input) {
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

/// The project's documents, in code point order without duplicates: the
/// project file, the `.kicad_dru` beside it, the board, and the reached
/// schematics. The schematic model lists the reached schematics; without it,
/// `config.root_schematic` stands in alone (ADR amendment K2 §3.2).
fn project_documents(
    schematic: Option<&SchematicModel<'_>>,
    input: &ProjectionInput<'_>,
) -> Vec<String> {
    let mut paths: Vec<String> = vec![input.config.project_file.0.clone()];
    if let Some(rules) = design_rules_path(&input.config.project_file.0) {
        paths.push(rules);
    }
    if let Some(board) = &input.config.board {
        paths.push(board.0.clone());
    }
    match schematic {
        Some(model) => {
            for source in model.bundle.sources() {
                if source.kind() == SourceKind::Schematic {
                    paths.push(source.path().to_owned());
                }
            }
        }
        None => {
            if let Some(root) = &input.config.root_schematic {
                paths.push(root.0.clone());
            }
        }
    }
    paths.sort();
    paths.dedup();
    paths
}

/// The design-rules file beside the project file, the one `read_companions`
/// reads in stage parse (`<project dir>/<stem>.kicad_dru`).
fn design_rules_path(project_file: &str) -> Option<String> {
    let (dir, name) = project_file.rsplit_once('/').unwrap_or(("", project_file));
    let stem = name.strip_suffix(".kicad_pro")?;
    Some(if dir.is_empty() {
        format!("{stem}.kicad_dru")
    } else {
        format!("{dir}/{stem}.kicad_dru")
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
        DocumentKind::Board => {
            // A board with no text has no root and is left out with a warning;
            // one with text but no root list yields an empty document, as when
            // the first root was not a list.
            if tree::unbalanced(text).is_some() || text.trim().is_empty() {
                warnings.push(unreadable(path));
                return None;
            }
            Some(board::document(path, text, warnings))
        }
        DocumentKind::Schematic => {
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
            let parts = schematic::document(path, &root, warnings);
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
    use super::*;
    use crate::{ProjectModel, Sources};
    use prism_kicad_contracts::generated::prism_revision_key_effective_config_a1::RevisionKeyEffectiveConfigA1;
    use prism_kicad_core::ProjectDocument;
    use std::collections::BTreeMap;
    use std::sync::Arc;

    /// A source set that serves the bytes it holds.
    struct MapSources(BTreeMap<String, Vec<u8>>);

    impl Sources for MapSources {
        fn read(&self, path: &str) -> Option<Arc<[u8]>> {
            self.0.get(path).map(|bytes| Arc::from(bytes.as_slice()))
        }

        fn exists(&self, path: &str) -> bool {
            self.0.contains_key(path)
        }

        fn list(&self, _dir: &str, _suffixes: &[&str]) -> Vec<String> {
            Vec::new()
        }
    }

    #[test]
    fn the_empty_form_decodes() {
        crate::test_support::with_bare_project(|input| {
            let produced = super::produce(input).unwrap();
            let value = serde_json::to_value(&produced.document).unwrap();
            assert_eq!(value["schema"], super::SCHEMA);
            assert_eq!(value["documents"].as_array().unwrap().len(), 0);
        });
    }

    #[test]
    fn only_the_anchors_documents_are_emitted() {
        let config: RevisionKeyEffectiveConfigA1 = serde_json::from_value(serde_json::json!({
            "schema": "prism.revision_key.effective_config.a1",
            "project_file": "proj/a.kicad_pro",
            "root_schematic": "proj/a.kicad_sch",
            "board": "proj/a.kicad_pcb",
            "excluded_dirs": [],
        }))
        .unwrap();
        let board = b"(kicad_pcb (version 20240101))";
        let sources = MapSources(BTreeMap::from([
            ("proj/a.kicad_pro".to_owned(), b"{}".to_vec()),
            ("proj/a.kicad_pcb".to_owned(), board.to_vec()),
            (
                "proj/a.kicad_sch".to_owned(),
                b"(kicad_sch (version 20240101))".to_vec(),
            ),
            ("proj/b.kicad_pro".to_owned(), b"{}".to_vec()),
            ("proj/b.kicad_pcb".to_owned(), board.to_vec()),
            (
                "proj/b.kicad_sch".to_owned(),
                b"(kicad_sch (version 20240101))".to_vec(),
            ),
        ]));
        let text = "{}";
        let document = ProjectDocument::parse(text.to_owned(), Default::default()).unwrap();
        let project = ProjectModel {
            path: "proj/a.kicad_pro",
            text,
            document: &document,
        };
        let input = ProjectionInput {
            config: &config,
            revision_key: None,
            sources: &sources,
            project: &project,
            schematic: None,
            board: None,
            design: None,
        };
        let produced = super::produce(&input).unwrap();
        let paths: Vec<&str> = produced
            .document
            .documents
            .iter()
            .map(|document| document.path.0.as_str())
            .collect();
        assert_eq!(
            paths,
            ["proj/a.kicad_pcb", "proj/a.kicad_pro", "proj/a.kicad_sch"]
        );
    }
}
