//! The stackup producer's tree, token and diagnostic helpers.
//!
//! Ports the prototype's helpers of `stackup_build.py:35-81`: the form walkers
//! (`is_form`, `child`, `value`, `second`), the `str`/`text`/`nm`/`float`
//! conversions, the `kind_of` rule (rule 3) and the repr formatting the
//! warning messages use. All operate on the fork's owned [`Sexp`] tree; a form
//! is any [`Sexp::List`].

use super::NAME;
use crate::{ProducerWarning, ProjectionError};
use prism_kicad_core::Sexp;

/// `is_form` (`stackup_build.py:41-42`): a non-empty list whose head token is
/// `head`.
pub(super) fn is_form(item: &Sexp, head: &str) -> bool {
    match item {
        Sexp::List(items) => matches!(
            items.first(),
            Some(Sexp::Atom(value) | Sexp::Quoted(value)) if value.as_ref() == head
        ),
        _ => false,
    }
}

/// The elements of a list form, or an empty slice for a scalar (`form[1:]`,
/// which is what every helper scans).
pub(super) fn form_children(item: &Sexp) -> &[Sexp] {
    match item {
        Sexp::List(items) => items,
        _ => &[],
    }
}

/// `child` (`stackup_build.py:45-51`): the first child form headed `head`.
pub(super) fn child<'a, I>(items: I, head: &str) -> Option<&'a Sexp>
where
    I: IntoIterator<Item = &'a Sexp>,
{
    items.into_iter().find(|item| is_form(item, head))
}

/// `value` (`stackup_build.py:54-56`): the second element of the first child
/// form headed `head`.
pub(super) fn value<'a, I>(items: I, head: &str) -> Option<&'a Sexp>
where
    I: IntoIterator<Item = &'a Sexp>,
{
    child(items, head).and_then(second)
}

/// The second element of a form (`found[1]`).
fn second(form: &Sexp) -> Option<&Sexp> {
    match form {
        Sexp::List(items) => items.get(1),
        _ => None,
    }
}

/// `str(token)` (Python's `str` of a kicad_monkey token); `None` for a form.
pub(super) fn py_str(raw: &Sexp) -> Option<String> {
    crate::python::token(raw)
}

/// `text` (`stackup_build.py:59-65`): a token as a string, `None` for a form
/// or an empty token (rule 4: empty strings are absent).
pub(super) fn text(raw: &Sexp) -> Option<String> {
    py_str(raw).filter(|value| !value.is_empty())
}

/// `nm` (`stackup_build.py:35-38`): conventions.md §6, round half away from
/// zero of the binary64 product mm × 1e6. `f64::round` rounds ties away from
/// zero, which is Python's `ROUND_HALF_UP` on the exact product.
pub(super) fn nm(value_mm: f64) -> i64 {
    (value_mm * 1e6).round() as i64
}

/// The numeric value of a token (`float(value_mm)`).
pub(super) fn as_f64(raw: &Sexp) -> Result<f64, ProjectionError> {
    match raw {
        Sexp::Float(value) => Ok(*value),
        Sexp::Integer(value) => Ok(*value as f64),
        Sexp::Atom(value) | Sexp::Quoted(value) => value
            .parse::<f64>()
            .map_err(|_| ProjectionError::new(format!("{NAME}: {value:?} is not a number"))),
        Sexp::List(_) => Err(ProjectionError::new(format!(
            "{NAME}: a list is not a number"
        ))),
    }
}

/// The integer value of a token (`int(row[0])`).
pub(super) fn as_u64(raw: &Sexp) -> Result<u64, ProjectionError> {
    match raw {
        Sexp::Integer(value) => non_negative(*value, "ordinal"),
        Sexp::Float(value) => non_negative(*value as i64, "ordinal"),
        Sexp::Atom(value) | Sexp::Quoted(value) => value
            .parse::<u64>()
            .map_err(|_| ProjectionError::new(format!("{NAME}: {value:?} is not an ordinal"))),
        Sexp::List(_) => Err(ProjectionError::new(format!(
            "{NAME}: a list is not an ordinal"
        ))),
    }
}

/// A nanometre value that must be non-negative (`NonNegativeNanometres`).
pub(super) fn non_negative(value: i64, what: &str) -> Result<u64, ProjectionError> {
    u64::try_from(value)
        .map_err(|_| ProjectionError::new(format!("{NAME}: {what} {value} nm is negative")))
}

/// `kind_of` (`stackup_build.py:68-81`): rule 3, the entry's kind from its
/// name alone. The name sets are disjoint, so the order of the arms is free.
pub(super) fn kind_of(name: &str) -> &'static str {
    match name {
        "F.Mask" | "B.Mask" => "soldermask",
        "F.Paste" | "B.Paste" => "paste",
        "F.SilkS" | "B.SilkS" => "silkscreen",
        _ if name.ends_with(".Cu") => "copper",
        _ if name.starts_with("dielectric") => "dielectric",
        _ => "other",
    }
}

/// `_yes` (`stackup_build.py:146-147`): the child's text is exactly `yes`.
pub(super) fn yes<'a, I>(items: I, head: &str) -> bool
where
    I: IntoIterator<Item = &'a Sexp>,
{
    value(items, head).and_then(text).as_deref() == Some("yes")
}

/// Python `repr` of a string token, for the warning messages the prototype
/// formats with `{name!r}`.
pub(super) fn py_repr(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('\'');
    for character in value.chars() {
        match character {
            '\\' => out.push_str("\\\\"),
            '\'' => out.push_str("\\'"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            _ => out.push(character),
        }
    }
    out.push('\'');
    out
}

/// Python `repr` of a list of strings (`f"{copper}"`).
pub(super) fn py_list_repr(values: &[String]) -> String {
    let parts: Vec<String> = values.iter().map(|value| py_repr(value)).collect();
    format!("[{}]", parts.join(", "))
}

/// A producer warning naming the board by its repository path.
pub(super) fn warning(board_path: &str, code: &str, message: String) -> ProducerWarning {
    ProducerWarning {
        code: code.to_owned(),
        message: format!("{board_path}: {message}"),
    }
}
