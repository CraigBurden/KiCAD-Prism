//! Pass 2: the placed-symbol field scan, a port of `_schematic_instance_fields`
//! and `_library_block_span` (semantic_index_service.py:372-435).
//!
//! The scan re-reads each schematic's raw text, outside its `(lib_symbols …)`
//! block, and keys every placed symbol's UUID to the `(property "Name" "Value")`
//! fields kicad-monkey leaves out of `design.json`. It is a byte scan, not a
//! parse: the helpers mirror `kicad_library_reader`'s regexes
//! (`kicad_library_reader.py:32-71`, `:208-215`).

use crate::{ProjectionError, ProjectionInput, SchematicModel};
use std::collections::BTreeMap;

/// Placed-symbol uuid → its fields as written in the schematic text.
pub(super) type SourceFields = BTreeMap<String, Fields>;

/// Name → value in first-insertion order, a later write replacing the value in
/// place: a Python `dict`. Today's code resolves casefold collisions by that
/// order (the later key wins), so a sorted map would not do.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct Fields(Vec<(String, String)>);

impl Fields {
    /// `fields[key] = value`.
    pub fn set(&mut self, key: String, value: String) {
        match self.0.iter_mut().find(|(name, _)| *name == key) {
            Some(entry) => entry.1 = value,
            None => self.0.push((key, value)),
        }
    }

    /// `fields.get(key)`.
    pub fn get(&self, key: &str) -> Option<&str> {
        self.0
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.as_str())
    }

    /// No entries.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// The entries in insertion order.
    pub fn iter(&self) -> impl Iterator<Item = (&String, &String)> {
        self.0.iter().map(|(key, value)| (key, value))
    }
}

/// Scan every schematic beside the project for placed symbols' fields.
///
/// Today's `_schematic_instance_fields` walks `project_file.parent.rglob("*.kicad_sch")`,
/// sorted, skipping the files `project_revision.is_generated` calls generated
/// (semantic_index_service.py:411-414). The bundle's source set is that
/// directory's files already selected by the revision key's name rules, so its
/// `.kicad_sch` paths stand in for the walk, in the same code point order.
pub(super) fn scan(
    input: &ProjectionInput<'_>,
    _schematic: &SchematicModel<'_>,
) -> Result<SourceFields, ProjectionError> {
    let mut fields = SourceFields::new();
    let project_dir = project_directory(input.project.path);
    for path in input.sources.paths() {
        if !path.ends_with(".kicad_sch") || !under_project_dir(&path, project_dir) {
            continue;
        }
        let Some(bytes) = input.sources.read(&path) else {
            continue;
        };
        scan_text(&String::from_utf8_lossy(&bytes), &mut fields);
    }
    Ok(fields)
}

/// The repository directory of the project file, `project_file.parent`.
fn project_directory(project_path: &str) -> &str {
    project_path
        .rfind('/')
        .map_or("", |index| &project_path[..index])
}

/// Whether `path` lies under `project_dir` (the root directory when empty).
fn under_project_dir(path: &str, project_dir: &str) -> bool {
    if project_dir.is_empty() {
        return true;
    }
    path.strip_prefix(project_dir)
        .is_some_and(|rest| rest.starts_with('/'))
}

/// Apply the scan to one schematic's text (semantic_index_service.py:416-434).
fn scan_text(text: &str, fields: &mut SourceFields) {
    let (library_start, library_end) = library_block_span(text);
    let mut search = 0;
    while let Some(start) = find_form_head(text, "symbol", search) {
        search = start + 1;
        if library_start <= start && start < library_end {
            continue;
        }
        let Some(end) = form_end(text, start) else {
            continue;
        };
        let block = &text[start..end];
        // Library definitions have no `lib_id`; only placed instances carry
        // the UUID and property values that belong to a BOM component.
        if !block.contains("(lib_id ") {
            continue;
        }
        let Some(uuid) = uuid_in(block) else {
            continue;
        };
        let properties = symbol_properties(block);
        if !properties.is_empty() {
            fields.entry(uuid).or_insert(properties);
        }
    }
}

/// A schematic's `(lib_symbols …)` as a half-open byte range, or `(0, 0)` when
/// it has none — `_library_block_span` (semantic_index_service.py:375-396).
fn library_block_span(text: &str) -> (usize, usize) {
    match find_form_head(text, "lib_symbols", 0) {
        Some(start) => match form_end(text, start) {
            Some(end) => (start, end),
            None => (0, 0),
        },
        None => (0, 0),
    }
}

/// The offset of the next `(head` form opening at or after `from`, where the
/// head is followed by whitespace or `)` — `kicad_library_reader.form_starts`
/// (kicad_library_reader.py:59-62).
fn find_form_head(text: &str, head: &str, from: usize) -> Option<usize> {
    let bytes = text.as_bytes();
    let head = head.as_bytes();
    let mut index = from;
    while index < bytes.len() {
        if bytes[index] == b'(' {
            let after = index + 1 + head.len();
            if bytes[index + 1..].starts_with(head)
                && after < bytes.len()
                && (bytes[after] == b')' || bytes[after].is_ascii_whitespace())
            {
                return Some(index);
            }
        }
        index += 1;
    }
    None
}

/// The offset just past the form opening at `start`, or `None`
/// (`kicad_library_reader.form_end`, kicad_library_reader.py:35-56). Quoted
/// strings are consumed whole, so parentheses inside a value do not count.
fn form_end(text: &str, start: usize) -> Option<usize> {
    let bytes = text.as_bytes();
    let mut depth: i32 = 0;
    let mut index = start;
    while index < bytes.len() {
        match bytes[index] {
            b'(' => {
                depth += 1;
                index += 1;
            }
            b')' => {
                depth -= 1;
                if depth == 0 {
                    return Some(index + 1);
                }
                if depth < 0 {
                    return None;
                }
                index += 1;
            }
            b'"' => index = quoted_end(text, index)?,
            _ => index += 1,
        }
    }
    None
}

/// The offset just past the quoted string opening at `start` (which points at
/// its `"`), or `None` when it is unterminated.
fn quoted_end(text: &str, start: usize) -> Option<usize> {
    let bytes = text.as_bytes();
    let mut index = start + 1;
    while index < bytes.len() {
        match bytes[index] {
            b'\\' => index += 2,
            b'"' => return Some(index + 1),
            _ => index += 1,
        }
    }
    None
}

/// The raw contents of the quoted string opening at `start` (which points at
/// its `"`), and the offset just past its closing quote. Escapes are left in
/// place, as the regex captures them.
fn quoted_body(text: &str, start: usize) -> Option<(&str, usize)> {
    let end = quoted_end(text, start)?;
    Some((&text[start + 1..end - 1], end))
}

/// The UUID of the first `(uuid "…")` in a placed-symbol block
/// (semantic_index_service.py:410, :429-430).
fn uuid_in(block: &str) -> Option<String> {
    let bytes = block.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'(' && block[index + 1..].starts_with("uuid") {
            let mut cursor = index + 1 + "uuid".len();
            let whitespace = cursor;
            while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            if cursor > whitespace
                && bytes.get(cursor) == Some(&b'"')
                && let Some((body, end)) = quoted_body(block, cursor)
                && bytes.get(end) == Some(&b')')
            {
                return Some(body.to_owned());
            }
        }
        index += 1;
    }
    None
}

/// Every `(property "Name" "Value")` in a block, unescaped; a later duplicate
/// wins — `_PROPERTY` and `kicad_library_reader.symbol_properties`
/// (kicad_library_reader.py:208-215, :83).
fn symbol_properties(block: &str) -> Fields {
    let mut fields = Fields::default();
    let mut index = 0;
    while let Some(start) = find_form_head(block, "property", index) {
        match match_property(block, start) {
            Some((key, value, end)) => {
                let key = unescape(key);
                if !key.is_empty() {
                    fields.set(key, unescape(value));
                }
                index = end;
            }
            None => index = start + 1,
        }
    }
    fields
}

/// The `(property "Name" "Value")` opening at `start`, unescaped, and the
/// offset just past its value's closing quote.
fn match_property(block: &str, start: usize) -> Option<(&str, &str, usize)> {
    let bytes = block.as_bytes();
    let mut cursor = start + 1 + "property".len();
    let whitespace = cursor;
    while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
        cursor += 1;
    }
    if cursor == whitespace || bytes.get(cursor) != Some(&b'"') {
        return None;
    }
    let (key, after_key) = quoted_body(block, cursor)?;
    let mut value_quote = after_key;
    let whitespace = value_quote;
    while value_quote < bytes.len() && bytes[value_quote].is_ascii_whitespace() {
        value_quote += 1;
    }
    if value_quote == whitespace || bytes.get(value_quote) != Some(&b'"') {
        return None;
    }
    let (value, end) = quoted_body(block, value_quote)?;
    Some((key, value, end))
}

/// `kicad_library_reader._unescape` (kicad_library_reader.py:74-75): `\"` then
/// `\\`, in that order.
fn unescape(value: &str) -> String {
    value.replace("\\\"", "\"").replace("\\\\", "\\")
}
