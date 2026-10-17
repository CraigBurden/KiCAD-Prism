use super::*;
use crate::compare::diff;
use serde_json::json;

fn entries_at(path: &str, objects: Value) -> Vec<Entry> {
    let member = json!({
        "schema": "prism.board_objects.a0",
        "documents": [{"path": path, "objects": objects, "reviewOnlyObjects": []}]
    });
    crate::compare::entry::build(&member, "").unwrap()
}

fn entries(objects: Value) -> Vec<Entry> {
    entries_at("d.kicad_pcb", objects)
}

fn objects_of(objects: Value) -> Vec<ReviewChange> {
    let base = entries(json!([]));
    let head = entries(objects);
    let outcome = diff::outcome(&base, &head);
    super::build(&base, &head, &outcome)
}

fn added_footprint() -> Vec<ReviewChange> {
    objects_of(json!([{
        "kind": "footprint",
        "uuid": "003ddaae-0296-4d8e-9501-4055f79da70e",
        "contentDigest": "digest",
        "at": {"xNm": 141125000, "yNm": 87625000},
        "layer": "F.Cu",
        "refdes": "R1",
        "reviewFields": {"Position": "141.125, 87.625"}
    }]))
}

#[test]
fn an_added_footprint_gets_a_stable_id_and_taxonomy() {
    let changes = added_footprint();
    assert_eq!(changes.len(), 1);
    let change = &changes[0].change;
    assert_eq!(change.id, "pcb-added-414ed811e7d294fe1ade");
    assert_eq!(change.kind, dc::DesignCompareChangeKind::Added);
    assert_eq!(change.category, dc::DesignCompareCategory::Components);
    assert_eq!(
        change.classification,
        dc::DesignCompareClassification::Primary
    );
    assert_eq!(change.object_kind.as_deref(), Some("footprint"));
}

#[test]
fn an_added_footprint_carries_identity_and_its_head_side() {
    let changes = added_footprint();
    let change = &changes[0].change;
    assert_eq!(change.label, "R1");
    assert_eq!(change.reference.as_deref().map(String::as_str), Some("R1"));
    assert_eq!(
        change.semantic_id.as_deref(),
        Some(component_uid("R1").as_str())
    );
    assert_eq!(change.page.as_deref(), Some("d.kicad_pcb"));
    assert_eq!(change.reasons, vec![dc::DesignCompareReason::ObjectAdded]);
    assert!(change.base.is_none());
    let head = change.head.as_ref().unwrap();
    assert_eq!(head.at.as_ref().unwrap().x_nm.0, 141125000);
    assert_eq!(head.layers.len(), 1);
}

#[test]
fn an_added_footprint_has_one_component_target() {
    let changes = added_footprint();
    let targets = &changes[0].visual_targets;
    assert_eq!(targets.len(), 1);
    assert_eq!(targets[0].role, VisualRole::Component);
    assert_eq!(targets[0].status, VisualStatus::Added);
    assert_eq!(targets[0].side, VisualSide::Comparison);
}

#[test]
fn a_power_symbol_uses_its_value_then_its_library_for_the_net() {
    let value = entries_at(
        "d.kicad_sch",
        json!([{
            "kind": "symbol", "uuid": "p", "contentDigest": "d", "libId": "power:+3V3",
            "properties": [{"name": "Value", "value": "+3V3"}]
        }]),
    );
    assert!(is_power_symbol(&value[0]));
    assert_eq!(reference_of(&value[0], true), None);
    assert_eq!(net_of(&value[0], true), Some("+3V3"));
    let bare = entries_at(
        "d.kicad_sch",
        json!([{"kind": "symbol", "uuid": "p2", "contentDigest": "d", "libId": "power:GND"}]),
    );
    assert_eq!(net_of(&bare[0], true), Some("GND"));
    // A power symbol is connectivity, never a component.
    let facts = Facts::of(&value[0], &[]);
    assert_eq!(facts.category, dc::DesignCompareCategory::Nets);
    assert_eq!(role_for(&facts), VisualRole::Label);
}

#[test]
fn a_modified_pad_numbers_its_label_and_compacts_its_fields() {
    let labels = |kind: &str, reference: Option<&str>, number: Option<&str>| {
        numbered_label(kind, reference, number)
    };
    assert_eq!(
        labels("pad", Some("J7"), Some("17")).as_deref(),
        Some("J7 pad 17")
    );
    assert_eq!(
        labels("pin", Some("J7"), Some("2")).as_deref(),
        Some("J7 pin 2")
    );
    assert_eq!(labels("pad", Some("J7"), Some("")), None);
    assert_eq!(
        footprint_label("footprint_text", Some("J1"), None).as_deref(),
        Some("J1 · footprint text")
    );
    assert_eq!(
        sheet_pin_label("sheet_pin", Some("CLK")).as_deref(),
        Some("Sheet pin CLK")
    );
    assert_eq!(
        named_label("no_connect", None).as_deref(),
        Some("No-connect marker")
    );
}

#[test]
fn attributes_drop_falsy_values_and_keep_the_empty_table() {
    let table = |value: Value| {
        let attributes = attributes_field(&Some(value)).unwrap();
        crate::compare::json::ecma(serde_json::to_value(attributes).unwrap())
    };
    assert_eq!(
        table(json!({"rotation": 90, "hide": true, "effects": {}})),
        json!({"rotation": 90, "hide": true})
    );
    // A table that compacts to nothing stays as `{}`.
    assert_eq!(
        table(json!({"rotation": 0, "hide": false, "effects": {}})),
        json!({})
    );
    assert!(attributes_field(&None).is_none());
}

#[test]
fn a_nested_attribute_is_written_as_its_canonical_text() {
    // `BoardObjectsReviewTable` holds scalars; the contract writes any
    // other shape as its canonical JSON text.
    let attributes = attributes_field(&Some(json!({"at": [1, 2], "hide": true}))).unwrap();
    assert_eq!(
        crate::compare::json::ecma(serde_json::to_value(attributes).unwrap()),
        json!({"at": "[1,2]", "hide": true})
    );
}

#[test]
fn a_review_change_points_at_its_kiid_path() {
    assert_eq!(sheet_path(Some("/a/b/u1"), "u1").as_deref(), Some("/a/b"));
    assert_eq!(sheet_path(Some("/u1"), "u1").as_deref(), Some("/"));
    assert_eq!(sheet_path(Some("/a/b/other"), "u1"), None);
    assert_eq!(sheet_path(None, "u1"), None);
}

#[test]
fn layer_names_are_normalized_and_deduplicated() {
    let entry = entries(json!([{
        "kind": "via", "uuid": "v", "contentDigest": "d",
        "layer": "F.Cu", "layers": ["F.Cu", "B.Cu", " "]
    }]));
    assert_eq!(item_layers(Some(&entry[0])), vec!["B.Cu", "F.Cu"]);
    assert!(item_layers(None).is_empty());
}

#[test]
fn the_roles_cover_the_frontend_list_and_unknown_kinds_fall_through() {
    assert_eq!(role_by_name("sheet_pin"), VisualRole::SheetPin);
    assert_eq!(role_by_name("no_connect"), VisualRole::NoConnect);
    assert_eq!(role_by_name("board_constraint"), VisualRole::Other);
}

#[test]
fn zeros_fold_the_way_python_folds_them() {
    assert!(is_falsy(&json!(null)));
    assert!(is_falsy(&json!(false)));
    assert!(is_falsy(&json!(0)));
    assert!(is_falsy(&json!(0.0)));
    assert!(is_falsy(&json!("")));
    assert!(is_falsy(&json!([])));
    assert!(is_falsy(&json!({})));
    assert!(!is_falsy(&json!(true)));
    assert!(!is_falsy(&json!(1)));
    assert!(!is_falsy(&json!("x")));
}
