//! The field map's "Resolution (normative)" (`project.py:167-303`).
//!
//! [`Resolver`] expands a raw reference's variables in at most eight rounds
//! (`project.py:177-213`, `:185-209`), applies the misplaced-marker rule
//! (`project.py:225-274`) and classifies what is left into a
//! [`Target`](super::reference::Target) (`project.py:276-303`).

use std::collections::{BTreeMap, BTreeSet};

use crate::Sources;

use super::reference::{Base, EmbeddedLayer, Library, Reason, RefKind, Target, unresolved};
use super::sexpr::find_byte;

/// `kicad-embed://`, the embedded-file scheme (`project.py:142`).
const EMBED_PREFIX: &str = "kicad-embed://";
/// The project-directory marker KiCad's `${KIPRJMOD}` expands to (`project.py:143`).
const PRJ_MARKER: &str = "\u{0}PRJ\u{0}";
/// `LIB:` markers name a KiCad library variable (`project.py:157`).
const LIB_PREFIX: &str = "\u{0}LIB:";

/// `project.py:138`: `${NAME}`, `$(NAME)` or a bare `$NAME`, `NAME` one or more
/// of `[A-Za-z0-9_:]` (`field map`, Resolution step 2). Returns
/// `(name_start, name_end, end)` for the `$` at `bytes[start]`.
pub(super) fn var_at(bytes: &[u8], start: usize) -> Option<(usize, usize, usize)> {
    let next = *bytes.get(start + 1)?;
    let (name_start, terminator) = match next {
        b'{' => (start + 2, b'}'),
        b'(' => (start + 2, b')'),
        _ => (start + 1, 0),
    };
    let mut end = name_start;
    while let Some(&byte) = bytes.get(end) {
        if byte.is_ascii_alphanumeric() || byte == b'_' || byte == b':' {
            end += 1;
        } else {
            break;
        }
    }
    if end == name_start {
        return None;
    }
    if terminator != 0 {
        return (bytes.get(end) == Some(&terminator)).then_some((name_start, end, end + 1));
    }
    Some((name_start, end, end))
}

/// Whether `text` holds any `${NAME}` / `$(NAME)` / `$NAME` (`VAR.is_match`).
fn has_var(text: &str) -> bool {
    let bytes = text.as_bytes();
    let mut cursor = 0;
    while let Some(start) = find_byte(bytes, b'$', cursor) {
        if var_at(bytes, start).is_some() {
            return true;
        }
        cursor = start + 1;
    }
    false
}

/// `project.py:140`: a URI scheme `^[A-Za-z][A-Za-z0-9+.-]*://`
/// (`field map`, Classification 4.2).
pub(super) fn is_uri(text: &str) -> bool {
    let bytes = text.as_bytes();
    if !bytes.first().is_some_and(u8::is_ascii_alphabetic) {
        return false;
    }
    let mut end = 1;
    while let Some(&byte) = bytes.get(end) {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'.' | b'-') {
            end += 1;
        } else {
            break;
        }
    }
    bytes.get(end) == Some(&b':')
        && bytes.get(end + 1) == Some(&b'/')
        && bytes.get(end + 2) == Some(&b'/')
}

/// `project.py:141`: a Windows drive prefix `^[A-Za-z]:/`.
pub(super) fn is_drive(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'/'
}

/// `project.py:144`: a project or library marker, `\0(?:PRJ|LIB:[A-Za-z0-9_:]+)\0`.
/// Returns the end of the marker at the `\0` at `bytes[at]`, if any (a `\0` is
/// not a `\n`, so the marker rule is a direct byte scan).
pub(super) fn marker_at(bytes: &[u8], at: usize) -> Option<usize> {
    let rest = bytes.get(at..)?;
    if rest.starts_with(PRJ_MARKER.as_bytes()) {
        return Some(at + PRJ_MARKER.len());
    }
    if !rest.starts_with(LIB_PREFIX.as_bytes()) {
        return None;
    }
    let name_start = at + LIB_PREFIX.len();
    let mut end = name_start;
    while bytes.get(end).is_some_and(is_marker_char) {
        end += 1;
    }
    (end > name_start && bytes.get(end) == Some(&0)).then_some(end + 1)
}

/// `[A-Za-z0-9_:]` of a `LIB:` marker's name.
fn is_marker_char(byte: &u8) -> bool {
    byte.is_ascii_alphanumeric() || *byte == b'_' || *byte == b':'
}

/// `project.py:148`: a KiCad library variable of any version, anchored at both
/// ends (`env_vars.cpp`). Returns the directory suffix.
pub(super) fn versioned_library(name: &str) -> Option<&str> {
    let bytes = name.as_bytes();
    if !bytes.starts_with(b"KICAD") {
        return None;
    }
    let mut end = 5;
    let digits_start = end;
    while bytes.get(end).is_some_and(u8::is_ascii_digit) {
        end += 1;
    }
    if end == digits_start || bytes.get(end) != Some(&b'_') {
        return None;
    }
    match &name[end + 1..] {
        suffix
        @ ("3DMODEL_DIR" | "SYMBOL_DIR" | "FOOTPRINT_DIR" | "TEMPLATE_DIR" | "3RD_PARTY") => {
            Some(suffix)
        }
        _ => None,
    }
}

/// `project.py:139`: variables whose value depends on the time or the checkout.
const NONDET: [&str; 5] = [
    "CURRENT_DATE",
    "CURRENT_TIME_HH_MM_SS",
    "CURRENT_TIME_LOCALE",
    "VCSHASH",
    "VCSSHORTHASH",
];

/// The field map's "Resolution (normative)", over repository segments
/// (`project.py:167-303`).
pub(super) struct Resolver<'a> {
    pub(super) project_name: &'a str,
    pub(super) text_variables: &'a BTreeMap<String, String>,
    pub(super) project_dir: &'a [String],
    pub(super) sources: &'a dyn Sources,
}

impl Resolver<'_> {
    /// `project.py:177-213`: expand variables in at most 8 rounds.
    fn expand(&self, raw: &str) -> (String, BTreeSet<String>, Option<Target>) {
        let mut text = raw.replace('\\', "/");
        let mut used = BTreeSet::new();
        for _ in 0..8 {
            if !has_var(&text) {
                return (text, used, None);
            }
            let (next, failure) = self.expand_once(&text, &mut used);
            text = next;
            if let Some(target) = failure {
                return (text, used, Some(target));
            }
        }
        if has_var(&text) {
            return (text, used, Some(unresolved(Reason::VariableLoop, None)));
        }
        (text, used, None)
    }

    /// One expansion round (`project.py:185-209`).
    fn expand_once(&self, text: &str, used: &mut BTreeSet<String>) -> (String, Option<Target>) {
        let mut out = String::with_capacity(text.len());
        let mut last = 0;
        let mut failure = None;
        let bytes = text.as_bytes();
        let mut cursor = 0;
        while let Some(start) = find_byte(bytes, b'$', cursor) {
            let Some((name_start, name_end, end)) = var_at(bytes, start) else {
                cursor = start + 1;
                continue;
            };
            out.push_str(&text[last..start]);
            last = end;
            cursor = end;
            if failure.is_some() {
                out.push_str(&text[start..end]);
                continue;
            }
            let name = &text[name_start..name_end];
            match self.substitute(name, used) {
                Ok(value) => out.push_str(&value),
                Err(target) => {
                    failure = Some(target);
                    out.push_str(&text[start..end]);
                }
            }
        }
        out.push_str(&text[last..]);
        (out, failure)
    }

    /// One variable's replacement (`project.py:190-206`).
    fn substitute(&self, name: &str, used: &mut BTreeSet<String>) -> Result<String, Target> {
        if name == "PROJECTNAME" {
            used.insert(name.to_owned());
            return Ok(self.project_name.to_owned());
        }
        if NONDET.contains(&name) {
            return Err(unresolved(
                Reason::NondeterministicVariable,
                Some(name.to_owned()),
            ));
        }
        if let Some(value) = self.text_variables.get(name) {
            used.insert(name.to_owned());
            return Ok(value.replace('\\', "/"));
        }
        if name == "KIPRJMOD" {
            used.insert(name.to_owned());
            return Ok(PRJ_MARKER.to_owned());
        }
        if library_of(name).is_some() {
            used.insert(name.to_owned());
            return Ok(format!("{LIB_PREFIX}{name}\u{0}"));
        }
        Err(unresolved(Reason::UndefinedVariable, Some(name.to_owned())))
    }

    /// `project.py:215-219`: whether the materialized source set holds `path`
    /// or a file below it.
    fn in_sources(&self, path: &str) -> bool {
        self.sources.exists(path) || !self.sources.list(path, &[]).is_empty()
    }

    /// `project.py:221-274`: resolve one raw reference.
    pub(super) fn resolve(
        &self,
        raw: &str,
        kind: RefKind,
        document_path: &str,
        embedded_stack: &[EmbeddedLayer<'_>],
    ) -> (Vec<String>, Target) {
        let (expanded, used, failure) = self.expand(raw);
        let variables: Vec<String> = used.into_iter().collect();
        if let Some(target) = failure {
            return (variables, target);
        }
        let target = self.classify(&expanded, kind, document_path, embedded_stack);
        (variables, target)
    }

    /// `project.py:225-274`: the misplaced-marker test, then classification.
    fn classify(
        &self,
        text: &str,
        kind: RefKind,
        document_path: &str,
        embedded_stack: &[EmbeddedLayer<'_>],
    ) -> Target {
        if let Some(name) = misplaced_marker(text) {
            return unresolved(Reason::MisplacedVariable, Some(name.to_owned()));
        }
        if let Some(rest) = text.strip_prefix(EMBED_PREFIX) {
            return self.embedded(rest, kind, embedded_stack);
        }
        if is_uri(text) {
            return unresolved(Reason::Uri, None);
        }
        if text.starts_with('~') {
            return unresolved(Reason::HomeRelative, None);
        }
        if let Some(target) = self.alias_reference(text, kind) {
            return target;
        }
        if let Some(rest) = text.strip_prefix(LIB_PREFIX) {
            return self.library_marker(rest);
        }
        if let Some(rest) = text.strip_prefix(PRJ_MARKER) {
            return self.join(self.project_dir, rest, Base::ProjectVariable);
        }
        if is_absolute_form(text) {
            return absolute(text);
        }
        if kind == RefKind::SheetFile {
            let parent = document_path.rsplit_once('/').map_or("", |(dir, _)| dir);
            return self.join(&segments(parent), text, Base::DocumentDirectory);
        }
        self.join(self.project_dir, text, Base::ProjectDirectory)
    }

    /// `project.py:248-253`: the KiCad 5 `:<alias>:<path>` form, for the
    /// embeddable kinds only.
    fn alias_reference(&self, text: &str, kind: RefKind) -> Option<Target> {
        let rest = text.strip_prefix(':')?;
        kind.is_embeddable().then(|| self.alias(rest))
    }

    /// `project.py:232-243`: `kicad-embed://<name>` lookup.
    fn embedded(&self, name: &str, kind: RefKind, embedded_stack: &[EmbeddedLayer<'_>]) -> Target {
        if !kind.is_embeddable() {
            return unresolved(Reason::Uri, None);
        }
        for layer in embedded_stack {
            if let Some(file_type) = layer.files.get(name) {
                return Target::Embedded {
                    name: name.to_owned(),
                    document_path: layer.document.to_owned(),
                    footprint_uuid: layer.footprint_uuid.map(str::to_owned),
                    file_type: file_type.clone(),
                };
            }
        }
        unresolved(Reason::EmbeddedMissing, None)
    }

    /// `project.py:248-253`: the KiCad 5 `:<alias>:<path>` form.
    fn alias(&self, rest: &str) -> Target {
        let (alias, path) = rest.split_once(':').unwrap_or((rest, ""));
        if path.is_empty() {
            return unresolved(Reason::Alias, None);
        }
        match library_of(alias) {
            Some(library) => self.library_path(alias, library, path),
            None => unresolved(Reason::Alias, None),
        }
    }

    /// `project.py:254-257`: a `LIB:` marker carries name and relative path.
    fn library_marker(&self, rest: &str) -> Target {
        let Some(end) = rest.find('\u{0}') else {
            return unresolved(Reason::UnrepresentablePath, None);
        };
        let name = &rest[..end];
        let path = &rest[end + 1..];
        match library_of(name) {
            Some(library) => self.library_path(name, library, path),
            // Unreachable for a marker this producer writes; keep it total.
            None => unresolved(Reason::UnrepresentablePath, None),
        }
    }

    /// `project.py:276-292`: a path below a KiCad library directory.
    fn library_path(&self, variable: &str, library: Library, rest: &str) -> Target {
        let mut stack: Vec<&str> = Vec::new();
        for segment in rest.split('/') {
            if segment.is_empty() || segment == "." {
                continue;
            }
            if segment == ".." {
                if stack.pop().is_none() {
                    return unresolved(Reason::OutsideLibraryRoot, None);
                }
                continue;
            }
            stack.push(segment);
        }
        if stack.is_empty() {
            return unresolved(Reason::EmptyPath, None);
        }
        if stack.iter().any(|segment| segment.contains(':')) {
            return unresolved(Reason::UnrepresentablePath, None);
        }
        Target::KiCadLibrary {
            variable: variable.to_owned(),
            library,
            relative_path: stack.join("/"),
        }
    }

    /// `project.py:294-303`: join `rest` to `base` and normalize.
    fn join(&self, base: &[String], rest: &str, base_kind: Base) -> Target {
        let stack = normalize(base, rest);
        if stack.is_empty() {
            return unresolved(Reason::EmptyPath, None);
        }
        if stack.iter().any(|segment| segment.contains(':')) {
            return unresolved(Reason::UnrepresentablePath, None);
        }
        let path = stack.join("/");
        if stack[0] == ".." {
            return Target::OutsideRepository {
                path,
                base: base_kind,
            };
        }
        let in_sources = self.in_sources(&path);
        Target::Repository {
            path,
            base: base_kind,
            in_sources,
        }
    }
}

/// `project.py:228-231`: the first marker not at position 0, when any marker is
/// misplaced.
fn misplaced_marker(text: &str) -> Option<&str> {
    let bytes = text.as_bytes();
    let mut first: Option<(usize, usize)> = None;
    let mut second: Option<(usize, usize)> = None;
    let mut count = 0usize;
    let mut cursor = 0;
    while let Some(at) = find_byte(bytes, 0, cursor) {
        match marker_at(bytes, at) {
            Some(end) => {
                count += 1;
                if first.is_none() {
                    first = Some((at, end));
                } else if second.is_none() {
                    second = Some((at, end));
                }
                cursor = end;
            }
            None => cursor = at + 1,
        }
    }
    let (first_start, first_end) = first?;
    if first_start == 0 && count == 1 {
        return None;
    }
    let (start, end) = if first_start == 0 {
        second?
    } else {
        (first_start, first_end)
    };
    let bad = &text[start..end];
    if bad == PRJ_MARKER {
        Some("KIPRJMOD")
    } else {
        Some(&bad[LIB_PREFIX.len()..bad.len() - 1])
    }
}

/// `project.py:147-153`: a KiCad library variable's directory.
fn library_of(name: &str) -> Option<Library> {
    if let Some(suffix) = versioned_library(name) {
        return library_dir(suffix);
    }
    legacy_library(name)
}

/// `project.py:148`: the versioned `KICAD<n>_<DIR>` variable names.
fn library_dir(name: &str) -> Option<Library> {
    match name {
        "3DMODEL_DIR" => Some(Library::Model3d),
        "SYMBOL_DIR" => Some(Library::Symbol),
        "FOOTPRINT_DIR" => Some(Library::Footprint),
        "TEMPLATE_DIR" => Some(Library::Template),
        "3RD_PARTY" => Some(Library::ThirdParty),
        _ => None,
    }
}

/// `project.py:150-153`: the legacy (pre-versioned) library variable names.
fn legacy_library(name: &str) -> Option<Library> {
    match name {
        "KISYS3DMOD" => Some(Library::Model3d),
        "KICAD_SYMBOL_DIR" => Some(Library::Symbol),
        "KISYSMOD" => Some(Library::Footprint),
        "KICAD_PTEMPLATES" => Some(Library::Template),
        "KICAD_USER_TEMPLATE_DIR" => Some(Library::UserTemplate),
        _ => None,
    }
}

/// `project.py:260-271`: absolute-path normalization.
fn absolute(text: &str) -> Target {
    let drive = if is_drive(text) { &text[..2] } else { "" };
    let mut stack: Vec<&str> = Vec::new();
    for segment in text[drive.len()..].split('/') {
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            stack.pop();
            continue;
        }
        stack.push(segment);
    }
    Target::Absolute {
        path: format!("{drive}/{}", stack.join("/")),
    }
}

/// `project.py:225-274`: a `/`-rooted or drive-prefixed path. Split out so the
/// classification order stays one branch per test.
fn is_absolute_form(text: &str) -> bool {
    text.starts_with('/') || is_drive(text)
}

/// `project.py:120-134`: join `rest` to `base` lexically. `\` separates segments
/// as `/` does: KiCad turns it into `/` in a sheet file name (`SCH_SHEET::SetFileName`),
/// and the core and the parse stage resolve it the same way.
pub(super) fn normalize(base: &[String], rest: &str) -> Vec<String> {
    let mut stack: Vec<String> = base.to_vec();
    for segment in rest.split(['/', '\\']) {
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            match stack.last() {
                Some(last) if last != ".." => {
                    stack.pop();
                }
                _ => stack.push("..".to_owned()),
            }
        } else {
            stack.push(segment.to_owned());
        }
    }
    stack
}

/// `/`-separated repository segments, empty for the empty string.
pub(super) fn segments(path: &str) -> Vec<String> {
    if path.is_empty() {
        Vec::new()
    } else {
        path.split('/').map(str::to_owned).collect()
    }
}
