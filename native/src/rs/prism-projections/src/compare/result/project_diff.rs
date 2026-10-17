//! ecad-viewer's input (`/projectDiff`, `kicad-project-diff-v1.tsp`): the
//! native changes of both tabs per document, and the navigation from each
//! change id. Today's code: `backend/app/services/document_diff_service.py`
//! (`build_project_diff`).
//!
//! Skeleton: C2r step 4 fills it in.

use super::ReviewChange;
use prism_kicad_contracts::generated::prism_design_compare_result_a0 as dc;

pub(super) fn build(
    _schematic: &[ReviewChange],
    _pcb: &[ReviewChange],
    _files: &dc::DesignCompareFiles,
) -> dc::KiCadProjectDiffBundleV1 {
    dc::KiCadProjectDiffBundleV1 {
        schema: "prism.kicad_project_diff_v1".to_owned(),
        provider: "prism-semantic".to_owned(),
        project: dc::KiCadProjectDiffProject {
            documents: Vec::new(),
        },
        navigation: dc::RecordKiCadProjectDiffNavigation(Default::default()),
        diagnostics: Vec::new(),
    }
}
