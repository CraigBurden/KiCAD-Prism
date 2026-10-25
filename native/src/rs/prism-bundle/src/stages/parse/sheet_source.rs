//! Stage parse's top-level and sub-sheet lookup: KiCad's parent-relative path, a
//! letter-case-only mismatch, or an absent file (cli-spec.md §5.2.2).

use super::super::sheets::resolve;
use super::{ParseRun, member};
use crate::finding::Outcome;

impl ParseRun<'_> {
    /// The schematics the design starts from, as KiCad 10 opens a project
    /// (`SCH_EDIT_FRAME::OpenProjectFiles`): each sheet the project lists in
    /// `schematic.top_level_sheets` that is in the source set, in order, or
    /// `root` when none is. A listed sheet that is absent is skipped with a
    /// `top-level-sheet-missing` warning, as KiCad skips it. The core derives
    /// the same roots from the project file (`SchematicBundleIndex`).
    pub(super) fn top_level_roots(&mut self, project: &str, root: &str) -> Outcome<Vec<String>> {
        let listed = serde_json::from_str::<serde_json::Value>(project)
            .map(|document| prism_kicad_core::project_top_level_sheets(&document))
            .unwrap_or_default();
        let project_path = self.config.project_file.0.clone();
        let mut roots: Vec<String> = Vec::new();
        for sheet in &listed {
            let found = match resolve(&project_path, &sheet.filename) {
                Ok(resolved) => self.source_path(&project_path, &sheet.filename, resolved)?,
                Err(_) => None,
            };
            match found {
                Some(path) if !roots.contains(&path) => roots.push(path),
                Some(_) => {}
                None => self.warn(
                    "top-level-sheet-missing",
                    format!(
                        "{} lists the top-level sheet {:?}, which is not in the source set; KiCad skips it",
                        member(&project_path),
                        sheet.filename
                    ),
                )?,
            }
        }
        if roots.is_empty() {
            roots.push(root.to_owned());
        }
        Ok(roots)
    }

    /// `resolved` when it is in the source set, else the one path that differs
    /// from it in letter case only (with a `sheet-path-case` warning), else
    /// `None`.
    fn source_path(
        &mut self,
        parent: &str,
        reference: &str,
        resolved: String,
    ) -> Outcome<Option<String>> {
        if self.tree.exists(&resolved) {
            return Ok(Some(resolved));
        }
        let folded = resolved.to_lowercase();
        let matches: Vec<String> = self
            .tree
            .list("", &[".kicad_sch"])
            .into_iter()
            .filter(|candidate| candidate.to_lowercase() == folded)
            .collect();
        if let [actual] = matches.as_slice() {
            self.warn(
                "sheet-path-case",
                format!(
                    "{} references {reference:?}; read {} instead, which differs only in letter case",
                    member(parent),
                    member(actual)
                ),
            )?;
            return Ok(Some(actual.clone()));
        }
        Ok(None)
    }

    /// The source-set path of a sub-sheet `parent` references, or `None`.
    ///
    /// KiCad resolves a sheet file against the parent sheet's directory and,
    /// when the file is absent, reports it and loads the sheet empty
    /// (`SCH_IO_KICAD_SEXPR::loadHierarchy`); so does this, with a
    /// `sheet-missing` warning. Designs authored on Windows or macOS often
    /// differ from the file in letter case only: one case-insensitive match is
    /// read, with a `sheet-path-case` warning naming both spellings.
    pub(super) fn sheet_source(
        &mut self,
        parent: &str,
        reference: &str,
        resolved: String,
    ) -> Outcome<Option<String>> {
        if let Some(found) = self.source_path(parent, reference, resolved.clone())? {
            return Ok(Some(found));
        }
        self.warn(
            "sheet-missing",
            format!(
                "{} references {reference:?}, but {} is not in the source set; the sheet is empty, as KiCad loads it",
                member(parent),
                member(&resolved)
            ),
        )?;
        Ok(None)
    }
}
