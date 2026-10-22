//! Stage parse's projection results: recorded in a fixed order, then kept as
//! documents for an in-memory parse or written as members (bundle-format.md
//! §3.1).

use super::super::Document;
use super::super::producers::ProjectionResult;
use super::{ParseRun, internal};
use crate::finding::Outcome;
use crate::manifest::PROJECTIONS;

impl ParseRun<'_> {
    /// Record each producer's result, in `PROJECTIONS` order (bundle-format.md
    /// §3.1): its warnings, the typed semantic index held aside for its
    /// `designKey`, or a failed member when it could not build.
    pub(super) fn record_projections(
        &mut self,
        results: Vec<Option<Result<ProjectionResult, String>>>,
    ) -> Outcome<()> {
        for ((path, schema), result) in PROJECTIONS.into_iter().zip(results) {
            let Some(result) = result else {
                continue;
            };
            if let Ok(ProjectionResult::Encoded {
                schema: declared,
                bytes,
                warnings,
            }) = result
            {
                for produced in warnings {
                    self.warn(&produced.code, produced.message)?;
                }
                if declared != schema {
                    return Err(internal(format!(
                        "the {path} producer wrote another schema"
                    )));
                }
                self.add_bytes(path, schema, bytes)?;
                continue;
            }
            let (declared, document, warnings) = match result {
                Ok(produced) => produced.into_parts(),
                Err(message) => {
                    self.fail_member(
                        path,
                        "projection-failed",
                        format!("{path} could not be built: {message}"),
                    )?;
                    continue;
                }
            };
            for produced in warnings {
                self.warn(&produced.code, produced.message)?;
            }
            match document {
                // Held until the read set is final and its `designKey` is set.
                Document::SemanticIndex(index) => self.pending_index = Some(index),
                _ if declared.as_deref() != Some(schema) => {
                    return Err(internal(format!(
                        "the {path} producer wrote another schema"
                    )));
                }
                document => {
                    if let Document::Json(value) = &document
                        && path == "projections/project.json"
                    {
                        self.read_references(value)?;
                    }
                    self.keep(path, schema, document)?;
                }
            }
        }
        Ok(())
    }

    /// A projection: kept as a document for an in-memory parse, else written
    /// as its member's bytes.
    pub(super) fn keep(&mut self, path: &str, schema: &str, document: Document) -> Outcome<()> {
        if self.request.in_memory {
            self.documents.insert(path.to_owned(), document);
            return Ok(());
        }
        match &document {
            Document::Json(value) => self.add_json(path, schema, value),
            Document::SemanticIndex(index) => self.add_json(path, schema, index),
            Document::BoardObjects(objects) => self.add_json(path, schema, objects),
        }
    }
}
