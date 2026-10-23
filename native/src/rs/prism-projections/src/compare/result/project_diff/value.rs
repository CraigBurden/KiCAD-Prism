//! The property deltas of one native change (`_property_deltas`, `_diff_value`,
//! `document_diff_service.py:86-114`).
//!
//! A value's `type` follows the KiCad property, not the JSON text (amendment
//! C2r §2 item 2): a number is `int` when it is finite, integral and below
//! `2^53`, `double` otherwise. A list or table is written as its display text;
//! no recorded pair carries one, but the encoding stays defined.

use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;

/// `_property_deltas`: the change's fields, in code point order.
pub(super) fn property_deltas(
    change: &dc::DesignCompareChange,
) -> Vec<dc::KiCadProjectDiffProperty> {
    change
        .fields
        .iter()
        .map(|(name, delta)| dc::KiCadProjectDiffProperty {
            name: name.clone(),
            before: diff_value(delta.old.as_ref()),
            after: diff_value(delta.new.as_ref()),
        })
        .collect()
}

/// `_diff_value`: absent is `null`, a flag is `bool`, text is `string`, a
/// number is `int` or `double`, anything else is its display text.
fn diff_value(value: Option<&dc::BoardObjectsReviewValue>) -> dc::KiCadProjectDiffValue {
    match value {
        None => dc::KiCadProjectDiffValue {
            type_: dc::KiCadProjectDiffValueType::Null,
            v: Some(None),
            label: None,
        },
        Some(dc::BoardObjectsReviewValue::Variant2(flag)) => scalar(
            dc::KiCadProjectDiffValueType::Bool,
            dc::KiCadProjectDiffScalar::Boolean(*flag),
        ),
        Some(dc::BoardObjectsReviewValue::Variant0(text)) => text_value(text),
        Some(dc::BoardObjectsReviewValue::Variant1(number)) => number_value(*number),
        Some(other) => text_value(&display(other)),
    }
}

fn text_value(text: &str) -> dc::KiCadProjectDiffValue {
    scalar(
        dc::KiCadProjectDiffValueType::String,
        dc::KiCadProjectDiffScalar::String(text.to_owned()),
    )
}

fn number_value(number: f64) -> dc::KiCadProjectDiffValue {
    let type_ = if is_integer(number) {
        dc::KiCadProjectDiffValueType::Int
    } else {
        dc::KiCadProjectDiffValueType::Double
    };
    scalar(type_, dc::KiCadProjectDiffScalar::Number(number))
}

fn scalar(
    type_: dc::KiCadProjectDiffValueType,
    value: dc::KiCadProjectDiffScalar,
) -> dc::KiCadProjectDiffValue {
    dc::KiCadProjectDiffValue {
        type_,
        v: Some(Some(value)),
        label: None,
    }
}

/// A number displays as an integer when it is one, so `2.0` reads `2`.
fn is_integer(number: f64) -> bool {
    number.is_finite() && number.fract() == 0.0 && number.abs() < 9_007_199_254_740_992.0
}

/// The display text of a value that has no scalar encoding.
fn display(value: &dc::BoardObjectsReviewValue) -> String {
    match value {
        dc::BoardObjectsReviewValue::Variant0(text) => text.clone(),
        dc::BoardObjectsReviewValue::Variant1(number) => number_text(*number),
        dc::BoardObjectsReviewValue::Variant2(flag) => flag.to_string(),
        dc::BoardObjectsReviewValue::Variant3(items) => items.join(", "),
        dc::BoardObjectsReviewValue::Variant4(items) => items
            .iter()
            .map(|item| number_text(*item))
            .collect::<Vec<_>>()
            .join(", "),
        dc::BoardObjectsReviewValue::Variant5(table) => display_table(table),
        dc::BoardObjectsReviewValue::Variant6(tables) => tables
            .iter()
            .map(display_table)
            .collect::<Vec<_>>()
            .join(", "),
    }
}

fn display_table(table: &dc::BoardObjectsReviewTable) -> String {
    table
        .iter()
        .map(|(key, value)| format!("{key}={}", display_scalar(value)))
        .collect::<Vec<_>>()
        .join(", ")
}

fn display_scalar(value: &dc::BoardObjectsReviewScalar) -> String {
    match value {
        dc::BoardObjectsReviewScalar::String(text) => text.clone(),
        dc::BoardObjectsReviewScalar::Number(number) => number_text(*number),
        dc::BoardObjectsReviewScalar::Boolean(flag) => flag.to_string(),
    }
}

fn number_text(number: f64) -> String {
    if is_integer(number) {
        format!("{}", number as i64)
    } else {
        format!("{number}")
    }
}

#[cfg(test)]
mod tests;
