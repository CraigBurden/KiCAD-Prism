use super::super::VisualStatus;
use super::*;

fn change(visual_targets: Vec<VisualTarget>) -> ReviewChange {
    ReviewChange {
        change: dc::DesignCompareChange {
            id: "pcb-changed-x".to_owned(),
            domain: dc::DesignCompareDomain::Pcb,
            kind: dc::DesignCompareChangeKind::Changed,
            category: dc::DesignCompareCategory::Other,
            classification: dc::DesignCompareClassification::Primary,
            label: String::new(),
            object_kind: None,
            reference: None,
            net: None,
            semantic_id: None,
            page: None,
            reasons: vec![dc::DesignCompareReason::ContentChanged],
            fields: dc::RecordDesignCompareFieldDelta(Default::default()),
            details: dc::DesignCompareChangeDetails::default(),
            base: None,
            head: None,
        },
        visual_targets,
    }
}

fn visual(side: VisualSide, source_id: &str, role: VisualRole) -> VisualTarget {
    VisualTarget {
        side,
        status: VisualStatus::Modified,
        source_id: source_id.to_owned(),
        parent_source_id: None,
        kind: None,
        document_path: None,
        sheet_path: None,
        at: None,
        role,
        reference: None,
        pin: None,
    }
}

fn attached(targets: Vec<VisualTarget>) -> Option<Vec<dc::DesignCompareTarget>> {
    let mut changes = vec![change(targets)];
    attach(&mut changes);
    changes.swap_remove(0).change.details.targets
}

#[test]
fn every_role_becomes_its_target_role() {
    let roles = [
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
    for (role, expected) in roles {
        let targets = attached(vec![visual(VisualSide::Reference, "id", role)]).unwrap();
        assert_eq!(targets.len(), 1, "{role:?}");
        assert_eq!(targets[0].role, Some(expected), "{role:?}");
    }
}

#[test]
fn other_is_absent_and_kind_carries_the_native_kind() {
    let mut target = visual(VisualSide::Comparison, "id", VisualRole::Other);
    target.kind = Some("no_connect".to_owned());
    let targets = attached(vec![target]).unwrap();
    assert_eq!(targets[0].role, None);
    assert_eq!(targets[0].kind.as_deref(), Some("no-connect"));
}

#[test]
fn a_target_without_a_source_id_is_left_out() {
    let mut present = visual(VisualSide::Reference, "kept", VisualRole::Pad);
    present.document_path = Some("board.kicad_pcb".to_owned());
    let absent = visual(VisualSide::Comparison, "", VisualRole::Pad);
    assert!(attached(vec![absent]).is_none());
    let targets = attached(vec![
        present,
        visual(VisualSide::Comparison, "", VisualRole::Pad),
    ])
    .unwrap();
    assert_eq!(targets.len(), 1);
    assert_eq!(targets[0].source_id, "kept");
}

#[test]
fn empty_targets_leave_the_field_absent() {
    assert!(attached(Vec::new()).is_none());
}

#[test]
fn a_base_target_converts_its_side_and_optional_fields() {
    let mut target = visual(VisualSide::Reference, "base-id", VisualRole::Label);
    target.kind = Some("sheet_pin".to_owned());
    target.document_path = Some("sheet.kicad_sch".to_owned());
    target.sheet_path = Some("/root".to_owned());
    target.at = Some(dc::PointNm {
        x_nm: dc::Nanometres(1),
        y_nm: dc::Nanometres(2),
    });
    target.reference = Some("R1".to_owned());
    let targets = attached(vec![target]).unwrap();
    assert_eq!(targets[0].side, dc::DesignCompareSide::Base);
    assert_eq!(targets[0].source_id, "base-id");
    assert_eq!(targets[0].kind.as_deref(), Some("sheet-pin"));
    assert_eq!(targets[0].role, Some(dc::DesignCompareTargetRole::Label));
    assert_eq!(targets[0].document_path.as_deref(), Some("sheet.kicad_sch"));
    assert_eq!(targets[0].sheet_path.as_deref(), Some("/root"));
    assert_eq!(
        targets[0].reference.as_deref().map(String::as_str),
        Some("R1")
    );
    let at = targets[0].at.as_ref().unwrap();
    assert_eq!((at.x_nm.0, at.y_nm.0), (1, 2));
}

#[test]
fn a_head_target_converts_its_side_and_drops_empty_optionals() {
    let mut target = visual(VisualSide::Comparison, "head-id", VisualRole::Terminal);
    target.kind = Some(String::new());
    target.document_path = Some(String::new());
    target.sheet_path = Some(String::new());
    target.reference = Some(String::new());
    let targets = attached(vec![target]).unwrap();
    assert_eq!(targets[0].side, dc::DesignCompareSide::Head);
    assert_eq!(targets[0].source_id, "head-id");
    assert_eq!(targets[0].kind, None);
    assert_eq!(targets[0].role, Some(dc::DesignCompareTargetRole::Terminal));
    assert_eq!(targets[0].document_path, None);
    assert_eq!(targets[0].sheet_path, None);
    assert!(targets[0].at.is_none());
    assert_eq!(targets[0].reference, None);
}

#[test]
fn targets_keep_their_order() {
    let targets = attached(vec![
        visual(VisualSide::Reference, "first", VisualRole::Pad),
        visual(VisualSide::Comparison, "second", VisualRole::Pad),
    ])
    .unwrap();
    assert_eq!(targets.len(), 2);
    assert_eq!(targets[0].source_id, "first");
    assert_eq!(targets[1].source_id, "second");
}
