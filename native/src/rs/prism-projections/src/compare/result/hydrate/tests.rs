use super::super::VisualStatus;
use super::*;
use crate::compare::entry::build;
use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;
use serde_json::{Value, json};

fn entries(doc: &str, objects: Value) -> Vec<Entry> {
    build(
        &json!({
            "schema": "prism.board_objects.a0",
            "documents": [{"path": doc, "objects": objects, "reviewOnlyObjects": []}]
        }),
        "",
    )
    .unwrap()
}

fn target(
    side: VisualSide,
    status: VisualStatus,
    source_id: &str,
    document_path: Option<&str>,
    sheet_path: Option<&str>,
    role: VisualRole,
) -> VisualTarget {
    VisualTarget {
        side,
        status,
        source_id: source_id.to_owned(),
        parent_source_id: None,
        kind: None,
        document_path: document_path.map(str::to_owned),
        sheet_path: sheet_path.map(str::to_owned),
        at: None,
        role,
        reference: None,
        pin: None,
    }
}

fn review_change(
    reasons: Vec<dc::DesignCompareReason>,
    targets: Vec<VisualTarget>,
) -> ReviewChange {
    ReviewChange {
        change: dc::DesignCompareChange {
            id: "sch-net-changed-x".to_owned(),
            domain: dc::DesignCompareDomain::Schematic,
            kind: dc::DesignCompareChangeKind::Changed,
            category: dc::DesignCompareCategory::Nets,
            classification: dc::DesignCompareClassification::Primary,
            label: String::new(),
            object_kind: None,
            reference: None,
            net: None,
            semantic_id: None,
            page: None,
            reasons,
            fields: dc::RecordDesignCompareFieldDelta(Default::default()),
            details: dc::DesignCompareChangeDetails::default(),
            base: None,
            head: None,
        },
        visual_targets: targets,
    }
}

#[test]
fn a_target_takes_its_document_kind_parent_and_position_from_the_object() {
    let head = entries(
        "a.kicad_sch",
        json!([{
            "kind": "label", "uuid": "L1", "contentDigest": "d",
            "parentUuid": "S1", "at": {"xNm": 1000000, "yNm": 2000000}, "text": "/N"
        }]),
    );
    let mut change = review_change(
        vec![],
        vec![target(
            VisualSide::Comparison,
            VisualStatus::Modified,
            "L1",
            Some("/Sheet/"),
            None,
            VisualRole::Label,
        )],
    );
    super::build(&[], &head, std::slice::from_mut(&mut change));
    let hydrated = &change.visual_targets[0];
    assert_eq!(hydrated.document_path.as_deref(), Some("a.kicad_sch"));
    assert_eq!(hydrated.sheet_path.as_deref(), Some("/Sheet/"));
    assert_eq!(hydrated.kind.as_deref(), Some("label"));
    assert_eq!(hydrated.parent_source_id.as_deref(), Some("S1"));
    assert_eq!(
        hydrated.at.as_ref().map(|at| (at.x_nm.0, at.y_nm.0)),
        Some((1_000_000, 2_000_000))
    );
}

#[test]
fn a_target_whose_semantic_page_is_the_document_keeps_its_sheet_path() {
    let head = entries(
        "a.kicad_sch",
        json!([{
            "kind": "wire", "uuid": "W1", "contentDigest": "d", "at": {"xNm": 0, "yNm": 0}
        }]),
    );
    let mut change = review_change(
        vec![],
        vec![target(
            VisualSide::Comparison,
            VisualStatus::Modified,
            "W1",
            Some("a.kicad_sch"),
            Some("/Keep"),
            VisualRole::Wire,
        )],
    );
    super::build(&[], &head, std::slice::from_mut(&mut change));
    assert_eq!(
        change.visual_targets[0].sheet_path.as_deref(),
        Some("/Keep")
    );
}

#[test]
fn the_last_object_with_a_uuid_wins_the_index() {
    let base = entries(
        "a.kicad_sch",
        json!([
            {"kind": "label", "uuid": "L1", "contentDigest": "d", "text": "old"},
            {"kind": "wire", "uuid": "L1", "contentDigest": "d", "text": "new"}
        ]),
    );
    let mut change = review_change(
        vec![],
        vec![target(
            VisualSide::Reference,
            VisualStatus::Modified,
            "L1",
            Some("a.kicad_sch"),
            None,
            VisualRole::Label,
        )],
    );
    super::build(&base, &[], std::slice::from_mut(&mut change));
    assert_eq!(change.visual_targets[0].kind.as_deref(), Some("wire"));
}

#[test]
fn a_target_without_a_uuid_object_is_left_alone() {
    let base = entries("a.kicad_sch", json!([]));
    let mut change = review_change(
        vec![],
        vec![target(
            VisualSide::Comparison,
            VisualStatus::Modified,
            "missing",
            Some("/Sheet/"),
            None,
            VisualRole::Terminal,
        )],
    );
    super::build(&base, &[], std::slice::from_mut(&mut change));
    assert_eq!(
        change.visual_targets[0].document_path.as_deref(),
        Some("/Sheet/")
    );
    assert_eq!(change.visual_targets[0].kind, None);
}

fn labels(side: VisualSide, at: i64) -> VisualTarget {
    let mut target = target(
        side,
        VisualStatus::Modified,
        "L",
        Some("a.kicad_sch"),
        None,
        VisualRole::Label,
    );
    target.at = Some(dc::PointNm {
        x_nm: dc::Nanometres(at),
        y_nm: dc::Nanometres(0),
    });
    target
}

#[test]
fn a_label_count_change_pairs_the_nearest_added_label() {
    let mut old = labels(VisualSide::Reference, 0);
    old.source_id = "old".to_owned();
    let mut far = labels(VisualSide::Comparison, 10_000_000);
    far.source_id = "far".to_owned();
    let mut near = labels(VisualSide::Comparison, 1_000_000);
    near.source_id = "near".to_owned();
    let mut change = review_change(
        vec![dc::DesignCompareReason::LabelCountChanged],
        vec![old, far, near],
    );
    super::build(&[], &[], std::slice::from_mut(&mut change));
    let ids: Vec<&str> = change
        .visual_targets
        .iter()
        .map(|target| target.source_id.as_str())
        .collect();
    assert_eq!(ids, ["far"]);
}

#[test]
fn a_label_pair_ties_on_the_source_id() {
    let mut change = review_change(
        vec![dc::DesignCompareReason::LabelCountChanged],
        vec![
            {
                let mut old = labels(VisualSide::Reference, 0);
                old.source_id = "old".to_owned();
                old
            },
            {
                let mut z = labels(VisualSide::Comparison, -5_000_000);
                z.source_id = "z".to_owned();
                z
            },
            {
                let mut a = labels(VisualSide::Comparison, 5_000_000);
                a.source_id = "a".to_owned();
                a
            },
        ],
    );
    super::build(&[], &[], std::slice::from_mut(&mut change));
    let ids: Vec<&str> = change
        .visual_targets
        .iter()
        .map(|target| target.source_id.as_str())
        .collect();
    // `a` (the smaller id) wins the tie; `z` survives.
    assert_eq!(ids, ["z"]);
}

#[test]
fn a_label_pair_needs_a_shared_or_unknown_page() {
    let mut old = labels(VisualSide::Reference, 0);
    old.source_id = "old".to_owned();
    old.document_path = Some("one.kicad_sch".to_owned());
    let mut added = labels(VisualSide::Comparison, 1);
    added.source_id = "added".to_owned();
    added.document_path = Some("two.kicad_sch".to_owned());
    let mut change = review_change(
        vec![dc::DesignCompareReason::LabelCountChanged],
        vec![old, added],
    );
    super::build(&[], &[], std::slice::from_mut(&mut change));
    assert_eq!(change.visual_targets.len(), 2);
}

#[test]
fn a_label_pair_uses_each_added_label_once() {
    let mut old_one = labels(VisualSide::Reference, 0);
    old_one.source_id = "o1".to_owned();
    let mut old_two = labels(VisualSide::Reference, 2);
    old_two.source_id = "o2".to_owned();
    let mut added = labels(VisualSide::Comparison, 1);
    added.source_id = "a1".to_owned();
    let mut change = review_change(
        vec![dc::DesignCompareReason::LabelCountChanged],
        vec![old_one, old_two, added],
    );
    super::build(&[], &[], std::slice::from_mut(&mut change));
    // `o1` takes `a1`; `o2` has no candidate and stays.
    let ids: Vec<&str> = change
        .visual_targets
        .iter()
        .map(|target| target.source_id.as_str())
        .collect();
    assert_eq!(ids, ["o2"]);
}
