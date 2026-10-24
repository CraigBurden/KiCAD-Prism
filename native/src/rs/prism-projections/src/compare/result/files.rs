//! The file list (`/files`): each revision's `.kicad_sch`, `.kicad_pcb` and
//! `.kicad_pro` sources under the project directory, relative to it, without
//! the files KiCad or Prism generated
//! (`backend/app/services/project_revision.py` `is_generated`).

use super::{Revision, project_dir};
use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;

const SUFFIXES: [&str; 3] = [".kicad_sch", ".kicad_pcb", ".kicad_pro"];
const GENERATED_DIRS: [&str; 6] = [
    ".cache",
    ".kicad-prism",
    "archive",
    "autosave",
    "backup",
    "backups",
];

pub(super) fn build(base: &Revision, head: &Revision) -> dc::DesignCompareFiles {
    dc::DesignCompareFiles {
        base: list(base),
        head: list(head),
    }
}

fn list(revision: &Revision) -> Vec<dc::DesignCompareSourceFile> {
    let dir = project_dir(&revision.identity.project_file);
    let mut files: Vec<_> = revision
        .sources
        .iter()
        .filter_map(|path| relative(dir, path))
        .filter(|path| SUFFIXES.iter().any(|suffix| path.ends_with(suffix)) && !is_generated(path))
        .map(|path| dc::DesignCompareSourceFile {
            filename: path.rsplit('/').next().unwrap_or(path).to_owned(),
            path: path.to_owned(),
        })
        .collect();
    files.sort_by(|a, b| a.path.cmp(&b.path));
    files
}

fn relative<'a>(dir: &str, path: &'a str) -> Option<&'a str> {
    if dir.is_empty() {
        Some(path)
    } else {
        path.strip_prefix(dir)?.strip_prefix('/')
    }
}

/// `is_generated` for a KiCad design file: a backup or generated directory,
/// a lock, backup or hidden-resource name, an autosave, or a fetched part.
fn is_generated(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    let mut parts: Vec<&str> = lower.split('/').collect();
    let name = parts.pop().unwrap_or_default();
    parts.iter().any(|part| {
        part.ends_with("-backups") || GENERATED_DIRS.contains(part) || *part == "remotelibrary"
    }) || name.starts_with('~')
        || name.starts_with("._")
        || name.starts_with("_autosave-")
        || name.starts_with("_autosave_")
        || name.contains("-backup-")
        || name.ends_with(".bak")
        || name.ends_with(".lck")
}

#[cfg(test)]
mod tests {
    use super::{is_generated, relative};

    #[test]
    fn generated_files_are_not_listed() {
        for path in [
            "board-backups/board.kicad_pcb",
            "backups/board.kicad_pcb",
            "_autosave-board.kicad_pcb",
            "~board.kicad_sch",
            "board-backup-2024.kicad_pcb",
            "RemoteLibrary/part.kicad_sch",
        ] {
            assert!(is_generated(path), "{path}");
        }
        for path in [
            "board.kicad_pcb",
            "sheets/power.kicad_sch",
            "archive_board.kicad_pcb",
        ] {
            assert!(!is_generated(path), "{path}");
        }
    }

    #[test]
    fn paths_are_relative_to_the_project_directory() {
        assert_eq!(
            relative("hw/obc", "hw/obc/obc.kicad_sch"),
            Some("obc.kicad_sch")
        );
        assert_eq!(relative("hw/obc", "hw/power/power.kicad_sch"), None);
        assert_eq!(relative("", "obc.kicad_sch"), Some("obc.kicad_sch"));
    }
}
