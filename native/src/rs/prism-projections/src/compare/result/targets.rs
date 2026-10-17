//! A review change's `details.targets`: its visual targets as the result
//! document carries them (field map, "Targets"). `compare` builds the same
//! targets for `projectDiff`; this module is the only place they enter the
//! document.

use super::objects::object_kind;
use super::{ReviewChange, VisualRole, VisualSide, VisualTarget};
use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;

/// Write every change's `details.targets` from its visual targets, in order and
/// entry for entry. A target with no source id is left out, and `targets`
/// itself is absent when the list is empty.
pub(super) fn attach(changes: &mut [ReviewChange]) {
    for change in changes {
        let targets: Vec<dc::DesignCompareTarget> =
            change.visual_targets.iter().filter_map(target_of).collect();
        change.change.details.targets = (!targets.is_empty()).then_some(targets);
    }
}

/// One visual target as the document carries it; `None` when it has no source
/// id.
fn target_of(target: &VisualTarget) -> Option<dc::DesignCompareTarget> {
    if target.source_id.is_empty() {
        return None;
    }
    Some(dc::DesignCompareTarget {
        side: match target.side {
            VisualSide::Reference => dc::DesignCompareSide::Base,
            VisualSide::Comparison => dc::DesignCompareSide::Head,
        },
        source_id: target.source_id.clone(),
        kind: target.kind.as_deref().and_then(object_kind),
        role: role_of(target.role),
        document_path: target.document_path.clone().filter(|text| !text.is_empty()),
        at: target.at.clone(),
        sheet_path: target.sheet_path.clone().filter(|text| !text.is_empty()),
        reference: target
            .reference
            .as_deref()
            .and_then(|text| text.parse().ok()),
    })
}

/// The target's drawing role; `Other`, a native kind with no role of its own,
/// is absent (its `kind` carries it).
fn role_of(role: VisualRole) -> Option<dc::DesignCompareTargetRole> {
    ROLES
        .iter()
        .find(|(visual, _)| *visual == role)
        .map(|(_, target)| *target)
}

/// Every `VisualRole` the document names, and its target role.
const ROLES: &[(VisualRole, dc::DesignCompareTargetRole)] = &[
    (
        VisualRole::Component,
        dc::DesignCompareTargetRole::Component,
    ),
    (VisualRole::Wire, dc::DesignCompareTargetRole::Wire),
    (VisualRole::Bus, dc::DesignCompareTargetRole::Bus),
    (VisualRole::BusEntry, dc::DesignCompareTargetRole::BusEntry),
    (VisualRole::Label, dc::DesignCompareTargetRole::Label),
    (VisualRole::Junction, dc::DesignCompareTargetRole::Junction),
    (VisualRole::Terminal, dc::DesignCompareTargetRole::Terminal),
    (VisualRole::Sheet, dc::DesignCompareTargetRole::Sheet),
    (VisualRole::SheetPin, dc::DesignCompareTargetRole::SheetPin),
    (VisualRole::Symbol, dc::DesignCompareTargetRole::Symbol),
    (
        VisualRole::NoConnect,
        dc::DesignCompareTargetRole::NoConnect,
    ),
    (VisualRole::Graphic, dc::DesignCompareTargetRole::Graphic),
    (
        VisualRole::Footprint,
        dc::DesignCompareTargetRole::Footprint,
    ),
    (VisualRole::Pad, dc::DesignCompareTargetRole::Pad),
    (VisualRole::Track, dc::DesignCompareTargetRole::Track),
    (VisualRole::Arc, dc::DesignCompareTargetRole::Arc),
    (VisualRole::Via, dc::DesignCompareTargetRole::Via),
    (VisualRole::Zone, dc::DesignCompareTargetRole::Zone),
    (
        VisualRole::FootprintGraphic,
        dc::DesignCompareTargetRole::FootprintGraphic,
    ),
    (
        VisualRole::FootprintText,
        dc::DesignCompareTargetRole::FootprintText,
    ),
    (VisualRole::Image, dc::DesignCompareTargetRole::Image),
    (VisualRole::Table, dc::DesignCompareTargetRole::Table),
    (VisualRole::Group, dc::DesignCompareTargetRole::Group),
    (VisualRole::NetClass, dc::DesignCompareTargetRole::NetClass),
    (
        VisualRole::NetClassAssignment,
        dc::DesignCompareTargetRole::NetClassAssignment,
    ),
];

#[cfg(test)]
mod tests;
