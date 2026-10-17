//! Document paths below the project directory (amendment C2 D1) in the
//! semantic index and occurrences `compare` reads. Their members carry
//! repository paths (`RepoPath`); today's comparison indexes a snapshot
//! flattened to the project directory (`design_compare_service._snapshot_commit`),
//! so every page it shows is project-relative, as the board objects' already are
//! here (`entry::strip_directory`). A project at the repository root is unchanged.

use super::super::entry::{anchor_directory, strip_directory};
use super::Revision;
use prism_kicad_contracts::generated::prism_occurrences_a0::OccurrencesA0;
use prism_kicad_contracts::generated::prism_semantic_index_a2::{
    SemanticIndexA2, SemanticIndexBus,
};

/// Make every document path `compare` reads from `revision`'s semantic index
/// and occurrences relative to its project directory.
pub(super) fn relative(revision: &mut Revision) {
    members(
        &revision.identity.project_file,
        &mut revision.semantic_index,
        &mut revision.occurrences,
    );
}

/// [`relative`] on the two members, for `project_file` (`config.project_file`).
fn members(project_file: &str, index: &mut SemanticIndexA2, occurrences: &mut OccurrencesA0) {
    let directory = anchor_directory(project_file);
    if directory.is_empty() {
        return;
    }
    let strip = |path: &mut String| *path = strip_directory(directory, path);
    for net in &mut index.nets {
        for reference in &mut net.schematic_refs {
            if let Some(page) = &mut reference.page {
                strip(&mut page.0);
            }
        }
    }
    for component in &mut index.components {
        for reference in &mut component.schematic_refs {
            strip(&mut reference.page);
        }
    }
    for instance in &mut index.sheet_instances {
        strip(&mut instance.page.0);
        if let Some(parent) = &mut instance.parent_page {
            strip(&mut parent.0);
        }
    }
    for bus in &mut index.buses {
        match bus {
            SemanticIndexBus::Wire(wire) => strip(&mut wire.page.0),
            SemanticIndexBus::Entry(entry) => strip(&mut entry.page.0),
            SemanticIndexBus::Alias(alias) => strip(&mut alias.page.0),
        }
    }
    for symbol in &mut occurrences.symbols {
        strip(&mut symbol.document_path.0);
    }
    for footprint in &mut occurrences.footprints {
        strip(&mut footprint.document_path.0);
    }
}

#[cfg(test)]
mod tests;
