use super::*;
use dc::{BoardObjectsReviewScalar as Scalar, BoardObjectsReviewValue as Review};

fn value(review: Option<&Review>) -> dc::KiCadProjectDiffValue {
    diff_value(review)
}

fn number_type(number: f64) -> dc::KiCadProjectDiffValueType {
    value(Some(&Review::Variant1(number))).type_
}

/// The scalar's string, for the values these tests pass.
fn as_string(value: &dc::KiCadProjectDiffValue) -> Option<&str> {
    match value.v.as_ref()?.as_ref()? {
        dc::KiCadProjectDiffScalar::String(text) => Some(text),
        _ => None,
    }
}

#[test]
fn null_and_flags_and_text_keep_their_encoding() {
    let absent = value(None);
    assert_eq!(absent.type_, dc::KiCadProjectDiffValueType::Null);
    assert!(absent.v.as_ref().is_some_and(|value| value.is_none()));
    assert_eq!(
        value(Some(&Review::Variant2(true))).type_,
        dc::KiCadProjectDiffValueType::Bool
    );
    assert_eq!(
        value(Some(&Review::Variant0("J7".to_owned()))).type_,
        dc::KiCadProjectDiffValueType::String
    );
}

#[test]
fn a_number_is_int_when_it_is_integral_and_safe() {
    assert_eq!(number_type(0.0), dc::KiCadProjectDiffValueType::Int);
    assert_eq!(number_type(152.0), dc::KiCadProjectDiffValueType::Int);
    assert_eq!(number_type(-3.0), dc::KiCadProjectDiffValueType::Int);
    assert_eq!(number_type(152.5), dc::KiCadProjectDiffValueType::Double);
    assert_eq!(number_type(1e300), dc::KiCadProjectDiffValueType::Double);
}

#[test]
fn a_list_or_table_writes_its_display_text() {
    let strings = value(Some(&Review::Variant3(vec![
        "a".to_owned(),
        "b".to_owned(),
    ])));
    assert_eq!(strings.type_, dc::KiCadProjectDiffValueType::String);
    assert_eq!(as_string(&strings), Some("a, b"));
    let numbers = value(Some(&Review::Variant4(vec![1.0, 2.5])));
    assert_eq!(as_string(&numbers), Some("1, 2.5"));
    let mut table = std::collections::BTreeMap::new();
    table.insert("width".to_owned(), Scalar::Number(2.0));
    table.insert("hide".to_owned(), Scalar::Boolean(false));
    let table = value(Some(&Review::Variant5(dc::BoardObjectsReviewTable(table))));
    assert_eq!(table.type_, dc::KiCadProjectDiffValueType::String);
    assert_eq!(as_string(&table), Some("hide=false, width=2"));
}

fn change_with_fields(
    fields: Vec<(&str, Option<Review>, Option<Review>)>,
) -> dc::DesignCompareChange {
    let mut map = std::collections::BTreeMap::new();
    for (name, old, new) in fields {
        map.insert(name.to_owned(), dc::DesignCompareFieldDelta { old, new });
    }
    dc::DesignCompareChange {
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
        reasons: Vec::new(),
        fields: dc::RecordDesignCompareFieldDelta(map),
        details: dc::DesignCompareChangeDetails::default(),
        base: None,
        head: None,
    }
}

#[test]
fn property_deltas_are_sorted_and_keep_absent_sides_null() {
    let change = change_with_fields(vec![
        (
            "Net",
            Some(Review::Variant0("a".to_owned())),
            Some(Review::Variant0("b".to_owned())),
        ),
        ("Position", None, Some(Review::Variant1(2.0))),
    ]);
    let deltas = property_deltas(&change);
    let names: Vec<&str> = deltas.iter().map(|delta| delta.name.as_str()).collect();
    assert_eq!(names, ["Net", "Position"]);
    assert_eq!(
        deltas[0].before.type_,
        dc::KiCadProjectDiffValueType::String
    );
    assert_eq!(deltas[1].before.type_, dc::KiCadProjectDiffValueType::Null);
    assert_eq!(deltas[1].after.type_, dc::KiCadProjectDiffValueType::Int);
}
