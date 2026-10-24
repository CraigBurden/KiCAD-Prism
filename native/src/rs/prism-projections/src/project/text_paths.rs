//! The `text-path` scan (`project.py:310-359`, `:519-629`).
//!
//! [`json_text_paths`] finds path-like strings in the `.kicad_pro` JSON;
//! [`sexpr_text_paths`] finds them in every scanned s-expression file, skipping
//! the atoms already listed under another kind ([`typed_atoms`]).
//! [`is_path_reference`] is the text-path rule (`project.py:310-323`); it is a
//! hand-written byte scanner, not a regex, so the PikeVM never runs per atom.

use prism_kicad_core::Sexp;
use serde_json::Value;
use std::borrow::Cow;
use std::collections::{BTreeSet, HashSet};

use super::sexpr::{
    as_list, child, find_byte, head_str, is_scalar_at, is_sheet_file_property, list_id,
};

/// The `${NAME}` match at `$` (`bytes[start] == b'$'`), `NAME` `[A-Za-z_]
/// [A-Za-z0-9_]*` (`project.py:307`). Returns `(name_start, name_end, end)`
/// where `end` is one past the closing `}`.
pub(super) fn closure_var_at(bytes: &[u8], start: usize) -> Option<(usize, usize, usize)> {
    if bytes.get(start + 1) != Some(&b'{') {
        return None;
    }
    let name_start = start + 2;
    let first = *bytes.get(name_start)?;
    if !(first.is_ascii_alphabetic() || first == b'_') {
        return None;
    }
    let mut end = name_start + 1;
    while let Some(&byte) = bytes.get(end) {
        if byte.is_ascii_alphanumeric() || byte == b'_' {
            end += 1;
        } else {
            break;
        }
    }
    (bytes.get(end) == Some(&b'}')).then_some((name_start, end, end + 1))
}

/// Whether `name` ends with `suffix`, ASCII case-insensitively.
fn ends_with_ascii_ignore_case(name: &[u8], suffix: &[u8]) -> bool {
    name.len() >= suffix.len() && name[name.len() - suffix.len()..].eq_ignore_ascii_case(suffix)
}

/// What the `${NAME}` walk found: the first match's range and whether any
/// match names the jobset output.
struct ClosureScan {
    first: Option<(usize, usize)>,
    jobs: bool,
}

/// Walk every `${NAME}` match (`project.py:310-323`).
fn scan_closure_vars(bytes: &[u8]) -> ClosureScan {
    let mut scan = ClosureScan {
        first: None,
        jobs: false,
    };
    let mut cursor = 0;
    while let Some(start) = find_byte(bytes, b'$', cursor) {
        match closure_var_at(bytes, start) {
            Some((name_start, name_end, end)) => {
                scan.first.get_or_insert((start, end));
                if bytes[name_start..name_end].eq_ignore_ascii_case(b"JOBSET_OUTPUT_WORK_PATH") {
                    scan.jobs = true;
                }
                cursor = end;
            }
            None => cursor = start + 1,
        }
    }
    scan
}

/// `project.py:310-323`: `closure_references.py:25-58`.
pub(super) fn is_path_reference(value: &str) -> bool {
    let bytes = value.as_bytes();
    let scan = scan_closure_vars(bytes);
    let Some((start, end)) = scan.first else {
        return false;
    };
    if scan.jobs {
        return false;
    }
    if bytes.contains(&b'/') || bytes.contains(&b'\\') {
        return true;
    }
    if start != value.len() - value.trim_start().len() || end != value.trim_end().len() {
        return false;
    }
    let name = &bytes[start + 2..end - 1];
    name.eq_ignore_ascii_case(b"KIPRJMOD")
        || ends_with_ascii_ignore_case(name, b"_DIR")
        || ends_with_ascii_ignore_case(name, b"_PATH")
}

/// `project.py:349-359`: every JSON string that is a path reference.
pub(super) fn json_text_paths(
    value: &Value,
    pointer: &str,
    skip: &BTreeSet<&str>,
    out: &mut Vec<(String, String)>,
) {
    match value {
        Value::Object(map) => {
            for (key, child) in map {
                let escaped = key.replace('~', "~0").replace('/', "~1");
                json_text_paths(child, &format!("{pointer}/{escaped}"), skip, out);
            }
        }
        Value::Array(items) => {
            for (index, child) in items.iter().enumerate() {
                json_text_paths(child, &format!("{pointer}/{index}"), skip, out);
            }
        }
        Value::String(text) if !skip.contains(pointer) && is_path_reference(text) => {
            out.push((pointer.to_owned(), text.clone()));
        }
        _ => {}
    }
}

/// The kind of tree a scanned file holds, for typed-atom tracking.
#[derive(Clone, Copy)]
pub(super) enum ScanKind {
    Schematic,
    Board,
    Library,
    DrawingSheet,
}

/// One parsed file that is scanned for `text-path` (`project.py:519`).
///
/// The tree is borrowed from the parse stage when it exposes one (the board's
/// shared tree) and owned only for the files this producer parses itself.
pub(super) struct Scanned<'a> {
    pub(super) path: String,
    pub(super) tree: Cow<'a, Sexp>,
    pub(super) kind: ScanKind,
}

/// `project.py:326-346`: string atoms that are path references, typed atoms
/// excluded. The `field` and `raw` borrow from `tree`.
pub(super) fn sexpr_text_paths<'t>(
    tree: &'t Sexp,
    typed: &HashSet<(usize, usize)>,
) -> Vec<(&'t str, &'t str)> {
    let mut found = Vec::new();
    walk_text_paths(tree, typed, &mut found);
    found
}

/// The recursive walk of `project.py:331-345`.
fn walk_text_paths<'t>(
    form: &'t Sexp,
    typed: &HashSet<(usize, usize)>,
    found: &mut Vec<(&'t str, &'t str)>,
) {
    let Some(values) = as_list(form) else {
        return;
    };
    if values.is_empty() {
        return;
    }
    let head = head_str(form);
    let id = list_id(form);
    for (index, item) in values.iter().enumerate() {
        if matches!(item, Sexp::List(_)) {
            walk_text_paths(item, typed, found);
            continue;
        }
        let (Sexp::Atom(text) | Sexp::Quoted(text)) = item else {
            continue;
        };
        if typed.contains(&(id, index)) || !is_path_reference(text) {
            continue;
        }
        found.push((text_path_field(head, values, index, text), text));
    }
}

/// `project.py:339-342`: the `field` of one text-path atom, borrowed from the
/// tree.
fn text_path_field<'t>(
    head: Option<&'t str>,
    values: &'t [Sexp],
    index: usize,
    text: &'t str,
) -> &'t str {
    if head == Some("property")
        && index == 2
        && let Some(Sexp::Atom(name) | Sexp::Quoted(name)) = values.get(1)
    {
        return name;
    }
    head.unwrap_or(text)
}

/// `project.py:519`, `:533-541`, `:565-572`, `:591-595`: the positions already
/// listed under another kind.
pub(super) fn typed_atoms(tree: &Sexp, kind: ScanKind) -> HashSet<(usize, usize)> {
    match kind {
        ScanKind::Schematic => schematic_typed_atoms(tree),
        ScanKind::Board => board_typed_atoms(tree),
        ScanKind::Library => library_typed_atoms(tree),
        ScanKind::DrawingSheet => HashSet::new(),
    }
}

/// Iterate the children of `form` whose head is `head`, without collecting a
/// `Vec` (`children`, inlined).
fn for_each_child<'t>(form: &'t Sexp, head: &str, mut visit: impl FnMut(&'t Sexp)) {
    let Some(values) = as_list(form) else {
        return;
    };
    for item in values.iter().skip(1) {
        if head_str(item) == Some(head) {
            visit(item);
        }
    }
}

/// `project.py:533-541`: the scalar value position of every `Sheetfile`
/// property.
fn schematic_typed_atoms(tree: &Sexp) -> HashSet<(usize, usize)> {
    let mut typed = HashSet::new();
    for_each_child(tree, "sheet", |sheet| {
        for_each_child(sheet, "property", |property| {
            if is_sheet_file_property(property) {
                typed.insert((list_id(property), 2));
            }
        });
    });
    typed
}

/// `project.py:565-572`: the path position of every footprint `model`.
fn board_typed_atoms(tree: &Sexp) -> HashSet<(usize, usize)> {
    let mut typed = HashSet::new();
    for_each_child(tree, "footprint", |footprint| {
        for_each_child(footprint, "model", |model| {
            if is_scalar_at(model, 1) {
                typed.insert((list_id(model), 1));
            }
        });
    });
    typed
}

/// `project.py:591-595`: the URI position of every `(lib …)` row's `(uri …)`.
fn library_typed_atoms(tree: &Sexp) -> HashSet<(usize, usize)> {
    let mut typed = HashSet::new();
    for_each_child(tree, "lib", |lib| {
        if let Some(uri) = child(lib, "uri")
            && as_list(uri).is_some_and(|values| values.len() > 1)
        {
            typed.insert((list_id(uri), 1));
        }
    });
    typed
}
