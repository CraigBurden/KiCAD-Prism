//! The `text-path` scan (`project.py:310-359`, `:519-629`).
//!
//! [`json_text_paths`] finds path-like strings in the `.kicad_pro` JSON;
//! [`sexpr_text_paths`] finds them in every scanned s-expression file, skipping
//! the atoms already listed under another kind ([`typed_atoms`]).
//! [`is_path_reference`] is the text-path rule (`project.py:310-323`).

use prism_kicad_core::Sexp;
use regex::Regex;
use serde_json::Value;
use std::collections::{BTreeSet, HashSet};
use std::sync::LazyLock;

use super::sexpr::{
    as_list, child, children, head_str, is_scalar_at, is_sheet_file_property, list_id,
};

/// `project.py:307`: `${NAME}`, `NAME` `[A-Za-z_][A-Za-z0-9_]*`, the text-path rule.
static CLOSURE_VAR: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
        .expect("the closure-variable pattern is a fixed valid regex")
});

/// `project.py:310-323`: `closure_references.py:25-58`.
pub(super) fn is_path_reference(value: &str) -> bool {
    if !CLOSURE_VAR.is_match(value) {
        return false;
    }
    if CLOSURE_VAR.captures_iter(value).any(|captures| {
        captures.get(1).is_some_and(|group| {
            group
                .as_str()
                .eq_ignore_ascii_case("JOBSET_OUTPUT_WORK_PATH")
        })
    }) {
        return false;
    }
    if value.contains('/') || value.contains('\\') {
        return true;
    }
    let trimmed = value.trim();
    let Some(captures) = CLOSURE_VAR.captures(trimmed) else {
        return false;
    };
    if captures.get(0).map(|whole| whole.range()) != Some(0..trimmed.len()) {
        return false;
    }
    let name = captures
        .get(1)
        .map_or("", |group| group.as_str())
        .to_ascii_uppercase();
    name == "KIPRJMOD" || name.ends_with("_DIR") || name.ends_with("_PATH")
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
pub(super) struct Scanned {
    pub(super) path: String,
    pub(super) tree: Sexp,
    pub(super) kind: ScanKind,
}

/// `project.py:326-346`: string atoms that are path references, typed atoms
/// excluded.
pub(super) fn sexpr_text_paths(
    tree: &Sexp,
    typed: &HashSet<(usize, usize)>,
) -> Vec<(String, String)> {
    let mut found = Vec::new();
    walk_text_paths(tree, typed, &mut found);
    found
}

/// The recursive walk of `project.py:331-345`.
fn walk_text_paths(
    form: &Sexp,
    typed: &HashSet<(usize, usize)>,
    found: &mut Vec<(String, String)>,
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
        found.push((text_path_field(head, values, index, text), text.clone()));
    }
}

/// `project.py:339-342`: the `field` of one text-path atom.
fn text_path_field(head: Option<&str>, values: &[Sexp], index: usize, text: &str) -> String {
    if head == Some("property")
        && index == 2
        && let Some(Sexp::Atom(name) | Sexp::Quoted(name)) = values.get(1)
    {
        return name.clone();
    }
    head.map_or_else(|| text.to_owned(), str::to_owned)
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

/// `project.py:533-541`: the scalar value position of every `Sheetfile`
/// property.
fn schematic_typed_atoms(tree: &Sexp) -> HashSet<(usize, usize)> {
    let mut typed = HashSet::new();
    for sheet in children(tree, "sheet") {
        for property in children(sheet, "property") {
            if is_sheet_file_property(property) {
                typed.insert((list_id(property), 2));
            }
        }
    }
    typed
}

/// `project.py:565-572`: the path position of every footprint `model`.
fn board_typed_atoms(tree: &Sexp) -> HashSet<(usize, usize)> {
    let mut typed = HashSet::new();
    for footprint in children(tree, "footprint") {
        for model in children(footprint, "model") {
            if is_scalar_at(model, 1) {
                typed.insert((list_id(model), 1));
            }
        }
    }
    typed
}

/// `project.py:591-595`: the URI position of every `(lib …)` row's `(uri …)`.
fn library_typed_atoms(tree: &Sexp) -> HashSet<(usize, usize)> {
    let mut typed = HashSet::new();
    for lib in children(tree, "lib") {
        if let Some(uri) = child(lib, "uri")
            && as_list(uri).is_some_and(|values| values.len() > 1)
        {
            typed.insert((list_id(uri), 1));
        }
    }
    typed
}
