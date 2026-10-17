//! The BOM tab (`/bom`): each revision's BOM rows from `occurrences`
//! (`field-maps/occurrences.md` "Design Comparison BOM rows"), diffed by
//! reference (`backend/app/services/bom_diff_service.py` `diff_boms`). The
//! columns are the head revision's `.prism.json` `bom.fields`, or today's
//! default (`design_compare_service.py` `_comparison_bom_fields`).
//!
//! Skeleton: C2r step 4 fills in the rows.

use super::{Options, Revision};
use prism_kicad_contracts::generated::prism_design_compare_result_a0 as dc;

const DEFAULT_FIELDS: [&str; 4] = ["Reference", "Value", "Footprint", "Datasheet"];

pub(super) fn build(_base: &Revision, head: &Revision, _options: Options) -> dc::DesignCompareBom {
    dc::DesignCompareBom {
        fields: fields(head),
        changes: Vec::new(),
        summary: dc::DesignCompareSummary {
            added: dc::Count(0),
            removed: dc::Count(0),
            changed: dc::Count(0),
        },
    }
}

/// The BOM columns: `bom.fields` of the head's `.prism.json` when it is a
/// non-empty list of texts, else today's default.
pub(super) fn fields(head: &Revision) -> Vec<String> {
    head.prism_settings
        .as_ref()
        .and_then(|settings| settings.get("bom")?.get("fields")?.as_array().cloned())
        .map(|fields| {
            fields
                .iter()
                .filter_map(|field| field.as_str().map(str::to_owned))
                .collect::<Vec<_>>()
        })
        .filter(|fields| !fields.is_empty())
        .unwrap_or_else(|| {
            DEFAULT_FIELDS
                .iter()
                .map(|field| (*field).to_owned())
                .collect()
        })
}
