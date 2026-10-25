//! Stage parse's sub-sheet lookup: KiCad's parent-relative path, a
//! letter-case-only mismatch, or an absent file (cli-spec.md §5.2.2).

use super::{ParseRun, member};
use crate::finding::Outcome;

impl ParseRun<'_> {
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
