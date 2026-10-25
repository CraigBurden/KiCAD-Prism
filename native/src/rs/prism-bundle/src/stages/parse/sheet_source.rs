//! Stage parse's sub-sheet lookup: KiCad's parent-relative path, a
//! letter-case-only mismatch, or an absent file (cli-spec.md §5.2.2).

use super::super::sheets::resolve;
use super::{ParseRun, member};
use crate::finding::Outcome;

impl ParseRun<'_> {
    /// KiCad 10 projects list their top-level sheets (`schematic.top_level_sheets`)
    /// and KiCad loads every one (`SCH_EDIT_FRAME::OpenProjectFiles`). The bundle
    /// reads one root schematic, so each other listed sheet gets a
    /// `top-level-sheet-unread` warning rather than being dropped silently.
    pub(super) fn warn_unread_top_level_sheets(&mut self, project: &str) -> Outcome<()> {
        let Ok(document) = serde_json::from_str::<serde_json::Value>(project) else {
            return Ok(());
        };
        let Some(sheets) = document
            .pointer("/schematic/top_level_sheets")
            .and_then(serde_json::Value::as_array)
        else {
            return Ok(());
        };
        let project_path = self.config.project_file.0.clone();
        let root = self
            .config
            .root_schematic
            .as_ref()
            .map(|root| root.0.clone());
        for name in sheets
            .iter()
            .filter_map(|sheet| sheet.get("filename")?.as_str())
        {
            let listed = resolve(&project_path, name).ok();
            if listed.is_some() && listed == root {
                continue;
            }
            let read = root
                .as_deref()
                .map_or_else(|| "no schematic".to_owned(), member);
            self.warn(
                "top-level-sheet-unread",
                format!(
                    "{} lists the top-level sheet {name:?}, which is not read; the design is {read} and the sheets below it",
                    member(&project_path)
                ),
            )?;
        }
        Ok(())
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
