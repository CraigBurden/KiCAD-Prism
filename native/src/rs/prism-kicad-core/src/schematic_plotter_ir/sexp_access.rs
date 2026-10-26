//! Reading values out of parsed schematic forms.

use super::model_error;
use crate::sexpr::{Error, Sexp};

pub(super) fn child<'a>(form: &'a Sexp, head: &str) -> Option<&'a Sexp> {
    list(form)?
        .iter()
        .find(|value| list(value).and_then(|values| values.first()).and_then(text) == Some(head))
}
pub(super) fn children<'a>(form: &'a Sexp, head: &str) -> impl Iterator<Item = &'a Sexp> {
    list(form).into_iter().flatten().filter(move |value| {
        list(value).and_then(|values| values.first()).and_then(text) == Some(head)
    })
}
pub(super) fn child_string(form: &Sexp, head: &str) -> Option<String> {
    child(form, head).and_then(|value| scalar_at(value, 1))
}
pub(super) fn list(form: &Sexp) -> Option<&[Sexp]> {
    if let Sexp::List(values) = form {
        Some(values)
    } else {
        None
    }
}
pub(super) fn text(value: &Sexp) -> Option<&str> {
    match value {
        Sexp::Atom(value) | Sexp::Quoted(value) => Some(value),
        _ => None,
    }
}
pub(super) fn scalar_at(form: &Sexp, index: usize) -> Option<String> {
    list(form)?.get(index).map(|value| match value {
        Sexp::Atom(value) | Sexp::Quoted(value) => value.to_string(),
        Sexp::Integer(value) => value.to_string(),
        Sexp::Float(value) => value.to_string(),
        Sexp::List(_) => String::new(),
    })
}
pub(super) fn value_at(form: &Sexp, index: usize) -> Option<String> {
    scalar_at(form, index)
}
/// KiCad 9's bare `private` flag right after a form's head, on a field or on a library
/// symbol's graphic or text. KiCad draws private items only in the symbol editor.
pub(super) fn is_private(form: &Sexp) -> bool {
    matches!(
        list(form).and_then(|values| values.get(1)),
        Some(Sexp::Atom(flag)) if &**flag == "private"
    )
}
/// A field's name, after the `private` flag when there is one.
pub(super) fn property_key(property: &Sexp) -> Option<String> {
    value_at(property, if is_private(property) { 2 } else { 1 })
}
/// A field's value, after the `private` flag when there is one.
pub(super) fn property_value(property: &Sexp) -> Option<String> {
    value_at(property, if is_private(property) { 3 } else { 2 })
}
pub(super) fn integer_at(form: &Sexp, index: usize) -> Option<i64> {
    match list(form)?.get(index)? {
        Sexp::Integer(value) => Some(*value),
        Sexp::Atom(value) | Sexp::Quoted(value) => value.parse().ok(),
        Sexp::Float(value) if value.fract() == 0.0 => Some(*value as i64),
        _ => None,
    }
}
pub(super) fn number_at(form: &Sexp, index: usize) -> Result<f64, Error> {
    let value = match list(form).and_then(|values| values.get(index)) {
        Some(Sexp::Integer(value)) => *value as f64,
        Some(Sexp::Float(value)) => *value,
        Some(Sexp::Atom(value)) | Some(Sexp::Quoted(value)) => value
            .parse()
            .map_err(|_| model_error("Expected finite number"))?,
        _ => return Err(model_error("Expected finite number")),
    };
    if value.is_finite() {
        Ok(value)
    } else {
        Err(model_error("Expected finite number"))
    }
}

/// `(body_style N)` (KiCad 10) or `(convert N)` (8 and 9); the later one wins.
pub(super) fn body_style(form: &Sexp) -> Result<u32, Error> {
    let Some(value) = list(form).and_then(|values| {
        values.iter().rev().find(|value| {
            matches!(
                list(value).and_then(|items| items.first()).and_then(text),
                Some("convert" | "body_style")
            )
        })
    }) else {
        return Ok(1);
    };
    scalar_at(value, 1)
        .and_then(|value| value.parse().ok())
        .ok_or_else(|| model_error("Expected schematic symbol integer"))
}

pub(super) fn child_u32(form: &Sexp, head: &str, default: u32) -> Result<u32, Error> {
    let Some(value) = child(form, head) else {
        return Ok(default);
    };
    scalar_at(value, 1)
        .and_then(|value| value.parse().ok())
        .ok_or_else(|| model_error("Expected schematic symbol integer"))
}

pub(super) fn child_yes(form: &Sexp, head: &str, default: bool) -> bool {
    child(form, head)
        .and_then(|value| scalar_at(value, 1))
        .map_or(default, |value| value == "yes")
}
