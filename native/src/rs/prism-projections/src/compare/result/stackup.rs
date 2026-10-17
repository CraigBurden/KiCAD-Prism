//! The Stackup tab (`/stackup`): both revisions' stackup forms and settings
//! (`field-maps/stackup.md` DC rules: sub-layers folded to forms) and whether
//! they differ (`backend/app/services/design_compare_artifacts.py` `_diff_stackup`).
//!
//! Skeleton: C2r step 4 fills it in.

use prism_kicad_contracts::generated::prism_design_compare_result_a0 as dc;
use prism_kicad_contracts::generated::prism_stackup_a0::StackupA0;

pub(super) fn build(_base: &StackupA0, _head: &StackupA0) -> dc::DesignCompareStackup {
    dc::DesignCompareStackup {
        present: false,
        changed: false,
        base: Vec::new(),
        head: Vec::new(),
        base_settings: settings(),
        head_settings: settings(),
    }
}

fn settings() -> dc::DesignCompareStackupSettings {
    dc::DesignCompareStackupSettings {
        copper_finish: None,
        dielectric_constraints: None,
    }
}
