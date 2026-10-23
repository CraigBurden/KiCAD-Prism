//! The S-expression tree helpers of the golden producer.
//!
//! Ports `placements_build.py:76-113`: `is_form`/`child`/`children` walk the
//! fork parser's [`Sexp`] tree the way the Python walks kicad_monkey's lists,
//! and `number`/`xy`/`xyz`/`layer_of` read the same atoms and numbers. The
//! Python spells a token with `str(...)`; [`py_str`] reproduces that for the
//! atom and number variants so a quoted and a bare token give the same string.

use prism_kicad_core::sexpr::Sexp;

/// The list contents of `item`, or `None` for an atom or number.
pub(crate) fn as_list(item: &Sexp) -> Option<&[Sexp]> {
    match item {
        Sexp::List(values) => Some(&values[..]),
        _ => None,
    }
}

/// Python `str(item)` for the variants a form head or scalar can hold.
pub(crate) fn py_str(item: &Sexp) -> String {
    match item {
        Sexp::Atom(value) | Sexp::Quoted(value) => value.to_string(),
        Sexp::Integer(value) => value.to_string(),
        Sexp::Float(value) => crate::python::float(*value),
        Sexp::List(values) => {
            let inner = values.iter().map(py_repr).collect::<Vec<_>>().join(", ");
            format!("[{inner}]")
        }
    }
}

/// Python `repr(item)`; used only in the diagnostic messages.
pub(crate) fn py_repr_str(value: &str) -> String {
    let mut out = String::from("'");
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

fn py_repr(item: &Sexp) -> String {
    match item {
        Sexp::Atom(value) | Sexp::Quoted(value) => py_repr_str(value),
        _ => py_str(item),
    }
}

/// `is_form`: `item` is a non-empty list whose head is `head` when given
/// (`placements_build.py:76-77`).
pub(crate) fn is_form(item: &Sexp, head: Option<&str>) -> bool {
    match as_list(item) {
        Some(values) => !values.is_empty() && head.is_none_or(|head| py_str(&values[0]) == head),
        None => false,
    }
}

/// The first child form with head `head` (`placements_build.py:80-86`).
pub(crate) fn child<'a>(form: Option<&'a Sexp>, head: &str) -> Option<&'a Sexp> {
    as_list(form?)?
        .get(1..)?
        .iter()
        .find(|item| is_form(item, Some(head)))
}

/// Every child form with head `head`, in order (`placements_build.py:89-90`).
pub(crate) fn children<'a>(form: &'a Sexp, head: &str) -> Vec<&'a Sexp> {
    as_list(form)
        .and_then(|values| values.get(1..))
        .map(|values| {
            values
                .iter()
                .filter(|item| is_form(item, Some(head)))
                .collect()
        })
        .unwrap_or_default()
}

/// The decoded head of a form, or `None` (`str(form[0])`).
pub(crate) fn head(item: &Sexp) -> Option<String> {
    as_list(item)?.first().map(py_str)
}

/// A numeric leaf as a float, or `default` (`placements_build.py:93-94`).
pub(crate) fn number(item: &Sexp, default: f64) -> f64 {
    match item {
        Sexp::Integer(value) => *value as f64,
        Sexp::Float(value) => *value,
        _ => default,
    }
}

/// The `(x y)` of a point form, or `None` (`placements_build.py:97-100`).
pub(crate) fn xy(form: Option<&Sexp>) -> Option<(f64, f64)> {
    let values = as_list(form?)?;
    if values.len() < 3 {
        return None;
    }
    Some((number(&values[1], 0.0), number(&values[2], 0.0)))
}

/// The `(xyz x y z)` of a form, defaulting each coordinate
/// (`placements_build.py:103-107`).
pub(crate) fn xyz(form: Option<&Sexp>, default: f64) -> [f64; 3] {
    let Some(values) = child(form, "xyz").and_then(as_list) else {
        return [default; 3];
    };
    let mut out = [default; 3];
    for (index, slot) in out.iter_mut().enumerate() {
        if let Some(item) = values.get(index + 1) {
            *slot = number(item, default);
        }
    }
    out
}

/// The `(layer "...")` name of a form, or `None` (`placements_build.py:110-112`).
pub(crate) fn layer_of(form: &Sexp) -> Option<String> {
    let values = as_list(child(Some(form), "layer")?)?;
    (values.len() > 1).then(|| py_str(&values[1]))
}
