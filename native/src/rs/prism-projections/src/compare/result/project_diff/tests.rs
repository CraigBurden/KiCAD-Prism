use super::*;
use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;

fn target(
    side: VisualSide,
    status: VisualStatus,
    source_id: &str,
    kind: Option<&str>,
    document_path: Option<&str>,
    sheet_path: Option<&str>,
    role: VisualRole,
) -> VisualTarget {
    VisualTarget {
        side,
        status,
        source_id: source_id.to_owned(),
        parent_source_id: None,
        kind: kind.map(str::to_owned),
        document_path: document_path.map(str::to_owned),
        sheet_path: sheet_path.map(str::to_owned),
        at: None,
        role,
        reference: None,
        pin: None,
    }
}

fn side(source_id: &str, document_path: &str) -> dc::DesignCompareChangeSide {
    dc::DesignCompareChangeSide {
        source_id: source_id.to_owned(),
        parent_source_id: None,
        document_path: document_path.to_owned(),
        layer: None,
        layers: Vec::new(),
        at: None,
        reference: None,
        net: None,
    }
}

fn change(
    id: &str,
    domain: dc::DesignCompareDomain,
    kind: dc::DesignCompareChangeKind,
    targets: Vec<VisualTarget>,
) -> ReviewChange {
    ReviewChange {
        change: dc::DesignCompareChange {
            id: id.to_owned(),
            domain,
            kind,
            category: dc::DesignCompareCategory::Nets,
            classification: dc::DesignCompareClassification::Primary,
            label: String::new(),
            object_kind: None,
            reference: None,
            net: None,
            semantic_id: None,
            page: None,
            reasons: Vec::new(),
            fields: dc::RecordDesignCompareFieldDelta(Default::default()),
            details: dc::DesignCompareChangeDetails::default(),
            base: None,
            head: None,
        },
        visual_targets: targets,
    }
}

fn files(base: &[&str], head: &[&str]) -> dc::DesignCompareFiles {
    let source = |path: &str| dc::DesignCompareSourceFile {
        path: path.to_owned(),
        filename: path.rsplit('/').next().unwrap_or(path).to_owned(),
    };
    dc::DesignCompareFiles {
        base: base.iter().map(|path| source(path)).collect(),
        head: head.iter().map(|path| source(path)).collect(),
    }
}

#[test]
fn a_board_change_uses_the_file_list_and_its_native_id() {
    let change = change(
        "pcb-changed-x",
        dc::DesignCompareDomain::Pcb,
        dc::DesignCompareChangeKind::Changed,
        vec![target(
            VisualSide::Comparison,
            VisualStatus::Modified,
            "u1",
            Some("footprint"),
            Some("board.kicad_pcb"),
            None,
            VisualRole::Footprint,
        )],
    );
    let bundle = build(&[], &[change], &files(&[], &["board.kicad_pcb"]));
    let document = &bundle.project.documents[0];
    assert_eq!(document.path, "board.kicad_pcb");
    assert_eq!(document.doc_type, dc::KiCadProjectDiffDocType::KicadPcb);
    assert_eq!(document.changes[0].id, "/u1");
    assert_eq!(document.changes[0].type_name, "PCB_FOOTPRINT");
    assert_eq!(
        document.changes[0].source_side,
        Some(dc::KiCadProjectDiffSourceSide::Comparison)
    );
    assert_eq!(bundle.navigation["pcb-changed-x"].change_id, "/u1");
}

#[test]
fn two_targets_of_one_change_become_an_item_and_its_children() {
    let change = change(
        "sch-net-changed-x",
        dc::DesignCompareDomain::Schematic,
        dc::DesignCompareChangeKind::Changed,
        vec![
            target(
                VisualSide::Comparison,
                VisualStatus::Modified,
                "u1",
                Some("label"),
                Some("a.kicad_sch"),
                None,
                VisualRole::Label,
            ),
            target(
                VisualSide::Comparison,
                VisualStatus::Modified,
                "u2",
                Some("label"),
                Some("a.kicad_sch"),
                None,
                VisualRole::Label,
            ),
        ],
    );
    let bundle = build(&[change], &[], &files(&[], &[]));
    let document = &bundle.project.documents[0];
    assert_eq!(document.changes.len(), 1);
    assert_eq!(document.changes[0].id, "/u1");
    assert_eq!(document.changes[0].children.len(), 1);
    assert_eq!(document.changes[0].children[0].id, "/u2");
    assert_eq!(document.changes[0].retain_reference, None);
    assert_eq!(document.changes[0].children[0].retain_reference, Some(true));
    assert_eq!(
        bundle.navigation["sch-net-changed-x"].change_ids.as_deref(),
        Some(["/u1".to_owned(), "/u2".to_owned()].as_slice())
    );
}

#[test]
fn a_sheet_prefix_becomes_the_kiid_path() {
    let change = change(
        "sch-net-changed-x",
        dc::DesignCompareDomain::Schematic,
        dc::DesignCompareChangeKind::Changed,
        vec![target(
            VisualSide::Reference,
            VisualStatus::Modified,
            "u1",
            Some("label"),
            Some("a.kicad_sch"),
            Some("/Sheet/"),
            VisualRole::Label,
        )],
    );
    let bundle = build(&[change], &[], &files(&[], &[]));
    assert_eq!(bundle.project.documents[0].changes[0].id, "/Sheet/u1");
}

#[test]
fn targets_of_one_change_span_two_documents() {
    let change = change(
        "sch-net-changed-x",
        dc::DesignCompareDomain::Schematic,
        dc::DesignCompareChangeKind::Changed,
        vec![
            target(
                VisualSide::Comparison,
                VisualStatus::Modified,
                "u1",
                Some("label"),
                Some("a.kicad_sch"),
                None,
                VisualRole::Label,
            ),
            target(
                VisualSide::Comparison,
                VisualStatus::Modified,
                "u2",
                Some("label"),
                Some("b.kicad_sch"),
                None,
                VisualRole::Label,
            ),
        ],
    );
    let bundle = build(&[change], &[], &files(&[], &[]));
    assert_eq!(bundle.project.documents.len(), 2);
    let navigation = &bundle.navigation["sch-net-changed-x"];
    assert_eq!(navigation.document_path, "a.kicad_sch");
    assert_eq!(navigation.documents.as_ref().map(Vec::len), Some(2));
}

#[test]
fn a_change_without_targets_falls_back_to_its_side() {
    let mut change = change(
        "sch-net-changed-x",
        dc::DesignCompareDomain::Schematic,
        dc::DesignCompareChangeKind::Added,
        Vec::new(),
    );
    change.change.head = Some(side("u9", "a.kicad_sch"));
    let bundle = build(&[change], &[], &files(&[], &[]));
    assert!(bundle.diagnostics.is_empty());
    let document = &bundle.project.documents[0];
    assert_eq!(document.changes[0].id, "/u9");
    assert_eq!(document.changes[0].type_name, "SCH_LINE");
}

#[test]
fn a_change_without_an_object_is_diagnosed() {
    let change = change(
        "sch-net-changed-x",
        dc::DesignCompareDomain::Schematic,
        dc::DesignCompareChangeKind::Changed,
        Vec::new(),
    );
    let bundle = build(&[change], &[], &files(&[], &[]));
    assert!(bundle.project.documents.is_empty());
    assert_eq!(bundle.diagnostics.len(), 1);
    assert_eq!(bundle.diagnostics[0].change_id, "sch-net-changed-x");
    assert_eq!(bundle.diagnostics[0].reason, "missing-source-id");
}

#[test]
fn an_unresolved_hierarchy_is_diagnosed() {
    let change = change(
        "sch-net-changed-x",
        dc::DesignCompareDomain::Schematic,
        dc::DesignCompareChangeKind::Changed,
        vec![target(
            VisualSide::Comparison,
            VisualStatus::Modified,
            "u1",
            None,
            Some("/Sheet/"),
            None,
            VisualRole::Other,
        )],
    );
    let bundle = build(&[change], &[], &files(&[], &[]));
    assert_eq!(
        bundle.diagnostics[0].reason,
        "unresolved-schematic-hierarchy"
    );
}

#[test]
fn an_object_kind_names_the_type_when_the_target_has_none() {
    let mut change = change(
        "pcb-changed-x",
        dc::DesignCompareDomain::Pcb,
        dc::DesignCompareChangeKind::Changed,
        vec![target(
            VisualSide::Comparison,
            VisualStatus::Modified,
            "u1",
            None,
            Some("board.kicad_pcb"),
            None,
            VisualRole::Other,
        )],
    );
    change.change.object_kind = Some("pad".to_owned());
    let bundle = build(&[], &[change], &files(&[], &["board.kicad_pcb"]));
    assert_eq!(bundle.project.documents[0].changes[0].type_name, "PCB_PAD");
}

#[test]
fn a_target_already_claimed_becomes_a_navigation_duplicate() {
    let first = change(
        "sch-net-changed-a",
        dc::DesignCompareDomain::Schematic,
        dc::DesignCompareChangeKind::Changed,
        vec![target(
            VisualSide::Comparison,
            VisualStatus::Modified,
            "u1",
            Some("label"),
            Some("a.kicad_sch"),
            None,
            VisualRole::Label,
        )],
    );
    let second = change(
        "sch-net-changed-b",
        dc::DesignCompareDomain::Schematic,
        dc::DesignCompareChangeKind::Changed,
        vec![target(
            VisualSide::Comparison,
            VisualStatus::Modified,
            "u1",
            Some("label"),
            Some("a.kicad_sch"),
            None,
            VisualRole::Label,
        )],
    );
    let bundle = build(&[first, second], &[], &files(&[], &[]));
    assert_eq!(bundle.project.documents[0].changes.len(), 1);
    assert_eq!(
        bundle.navigation["sch-net-changed-b"].change_ids.as_deref(),
        Some(["/u1".to_owned()].as_slice())
    );
}

#[test]
fn the_head_pcb_path_wins() {
    assert_eq!(
        first_pcb_path(&files(&["a.kicad_pcb"], &["b.kicad_pcb"])).as_deref(),
        Some("b.kicad_pcb")
    );
    assert_eq!(
        first_pcb_path(&files(&["a.kicad_pcb"], &[])).as_deref(),
        Some("a.kicad_pcb")
    );
}
