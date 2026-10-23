//! The fork's `Sexp` accessors, shared by the resolver, the title-block
//! expander, the `text-path` scan and the producer (`project.py:90-117`).

use prism_kicad_core::Sexp;
use std::collections::BTreeMap;

/// The next index of `byte` in `bytes` at or after `from` (`memchr`-style).
pub(super) fn find_byte(bytes: &[u8], byte: u8, from: usize) -> Option<usize> {
    bytes
        .get(from..)?
        .iter()
        .position(|&candidate| candidate == byte)
        .map(|index| index + from)
}

/// `project.py:47`: a canonical KiCad UUID (`KIID::AsString`),
/// `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`.
pub(super) fn is_canonical_uuid(text: &str) -> bool {
    let bytes = text.as_bytes();
    if bytes.len() != 36 {
        return false;
    }
    bytes.iter().enumerate().all(|(index, &byte)| {
        if matches!(index, 8 | 13 | 18 | 23) {
            byte == b'-'
        } else {
            byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)
        }
    })
}

/// A borrowed `Sexp` list, or `None` for a scalar.
pub(super) fn as_list(form: &Sexp) -> Option<&[Sexp]> {
    match form {
        Sexp::List(values) => Some(&values[..]),
        _ => None,
    }
}

/// `project.py:90-94`: the head token if it is a string.
pub(super) fn head_str(form: &Sexp) -> Option<&str> {
    match as_list(form)?.first()? {
        Sexp::Atom(value) | Sexp::Quoted(value) => Some(value),
        _ => None,
    }
}

/// `project.py:90-94`: the first child whose head is `head`.
pub(super) fn child<'a>(form: &'a Sexp, head: &str) -> Option<&'a Sexp> {
    as_list(form)?
        .iter()
        .skip(1)
        .find(|item| head_str(item) == Some(head))
}

/// `project.py:97-98`: every child whose head is `head`.
pub(super) fn children<'a>(form: &'a Sexp, head: &str) -> Vec<&'a Sexp> {
    as_list(form).map_or_else(Vec::new, |values| {
        values
            .iter()
            .skip(1)
            .filter(|item| head_str(item) == Some(head))
            .collect()
    })
}

/// `project.py:101-105`: the scalar at `index`, or `None`.
pub(super) fn atom(form: Option<&Sexp>, index: usize) -> Option<&Sexp> {
    let value = as_list(form?)?.get(index)?;
    (!matches!(value, Sexp::List(_))).then_some(value)
}

/// `project.py:108-112`: `str(value)`, or `None`.
pub(super) fn str_atom(form: Option<&Sexp>, index: usize) -> Option<String> {
    Some(scalar(atom(form, index)?))
}

/// `project.py:78-87` and fork `worksheet.rs:926-933`: a scalar as text.
pub(super) fn scalar(value: &Sexp) -> String {
    crate::python::token(value).unwrap_or_default()
}

/// `project.py:115-117`: a canonical UUID child, else `None`.
pub(super) fn uuid_of(form: &Sexp) -> Option<String> {
    let value = str_atom(child(form, "uuid"), 1)?;
    is_canonical_uuid(&value).then_some(value)
}

/// `project.py:426-437`: a `(embedded_files …)` map, name to file type.
pub(super) fn embedded_files(form: &Sexp) -> BTreeMap<String, String> {
    let mut files = BTreeMap::new();
    let Some(holder) = child(form, "embedded_files") else {
        return files;
    };
    for file in children(holder, "file") {
        let Some(name) = str_atom(child(file, "name"), 1) else {
            continue;
        };
        if name.is_empty() {
            continue;
        }
        let file_type = str_atom(child(file, "type"), 1).unwrap_or_default();
        let file_type = match file_type.as_str() {
            "model" | "worksheet" | "datasheet" | "font" => file_type,
            _ => "other".to_owned(),
        };
        files.insert(name, file_type);
    }
    files
}

/// A stable identity for one list node, for typed-atom tracking
/// (`project.py:519`, `:625-629`).
pub(super) fn list_id(form: &Sexp) -> usize {
    match form {
        Sexp::List(values) => values.as_ptr() as usize,
        _ => 0,
    }
}

/// Whether the scalar at `index` is present and not a list (`project.py:569`).
pub(super) fn is_scalar_at(form: &Sexp, index: usize) -> bool {
    as_list(form).is_some_and(|values| {
        values
            .get(index)
            .is_some_and(|v| !matches!(v, Sexp::List(_)))
    })
}

/// Whether `property` is a `(property "<name>" …)` with a scalar value and a
/// name in `names` (`project.py:536-540`, `:542-544`).
pub(super) fn is_named_property(property: &Sexp, names: &[&str]) -> bool {
    as_list(property).is_some_and(|values| values.len() >= 3)
        && scalar_at_is(property, 1, names)
        && is_scalar_at(property, 2)
}

/// Whether the scalar at `index` equals one of `names`, borrowing a string atom
/// instead of allocating its `str()`.
fn scalar_at_is(form: &Sexp, index: usize, names: &[&str]) -> bool {
    match atom(Some(form), index) {
        Some(Sexp::Atom(text) | Sexp::Quoted(text)) => names.contains(&text.as_ref()),
        Some(value @ (Sexp::Integer(_) | Sexp::Float(_))) => {
            names.contains(&scalar(value).as_str())
        }
        _ => false,
    }
}

/// `project.py:536-540`: a `Sheetfile` / `Sheet file` property with a scalar value.
pub(super) fn is_sheet_file_property(property: &Sexp) -> bool {
    is_named_property(property, &["Sheetfile", "Sheet file"])
}

/// `project.py:536-540`: the first `Sheetfile` property's value.
pub(super) fn sheet_file_value(sheet: &Sexp) -> Option<String> {
    let property = children(sheet, "property")
        .into_iter()
        .find(|property| is_sheet_file_property(property))?;
    str_atom(Some(property), 2)
}

/// `project.py:541-545`: the first `Sheetname` / `Sheet name` property, non-empty.
pub(super) fn sheet_name(sheet: &Sexp) -> Option<String> {
    let property = children(sheet, "property")
        .into_iter()
        .find(|property| is_named_property(property, &["Sheetname", "Sheet name"]))?;
    let value = str_atom(Some(property), 2)?;
    (!value.is_empty()).then_some(value)
}

/// `project.py:508-516`: a document's top-level `(property "N" "V")`.
pub(super) fn document_property(property: &Sexp) -> Option<(String, String)> {
    let name = match atom(Some(property), 1)? {
        Sexp::Atom(name) | Sexp::Quoted(name) if !name.is_empty() => name.to_string(),
        _ => return None,
    };
    let value = atom(Some(property), 2)?;
    Some((name, scalar(value)))
}
