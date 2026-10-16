//! `projections/project.json` (`prism.project.a0`), WP-P4.
//!
//! A faithful port of the golden producer `native/parity/prism_parity/capture/project.py`
//! (`produce` and its helpers, lines 50-649), which the committed goldens were
//! captured with. The normative rules are in
//! `native/contracts/prism/field-maps/project.md`: "Scanning", "Resolution
//! (normative)" and "Title-block expansion (normative)".
//!
//! One [`Producer`] walks the project's `.kicad_pro` (as JSON), the root
//! schematic and every sheet it reaches, the board, the project's two library
//! tables and every drawing sheet a reference resolves to. It emits one header
//! per schematic file and the board, and every path reference the files make.
//! S-expression files are parsed with the fork's own parser
//! (`prism_kicad_core::parse_with_limits`); every extra file is read through
//! [`Sources::read`], which makes it a bundle `sources/` member.

use crate::{Produced, ProducerWarning, ProjectionError, ProjectionInput, Sources, document};
use prism_kicad_contracts::generated::prism_project_a0::ProjectA0;
use prism_kicad_core::{Limits, Sexp, parse_with_limits};
use regex::Regex;
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet, HashSet, VecDeque};
use std::sync::LazyLock;

/// The member's schema id.
pub const SCHEMA: &str = "prism.project.a0";
const NAME: &str = "projections/project.json";

/// `kicad-embed://`, the embedded-file scheme (`project.py:142`).
const EMBED_PREFIX: &str = "kicad-embed://";
/// The project-directory marker KiCad's `${KIPRJMOD}` expands to (`project.py:143`).
const PRJ_MARKER: &str = "\u{0}PRJ\u{0}";
/// `LIB:` markers name a KiCad library variable (`project.py:157`).
const LIB_PREFIX: &str = "\u{0}LIB:";

/// `project.py:138`: `${NAME}`, `$(NAME)` or a bare `$NAME`, `NAME` one or more
/// of `[A-Za-z0-9_:]` (`field map`, Resolution step 2).
static VAR: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\$(?:\{([A-Za-z0-9_:]+)\}|\(([A-Za-z0-9_:]+)\)|([A-Za-z0-9_:]+))")
        .expect("the variable pattern is a fixed valid regex")
});
/// `project.py:140`: a URI scheme (`field map`, Classification 4.2).
static URI: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[A-Za-z][A-Za-z0-9+.-]*://").expect("the URI pattern is a fixed valid regex")
});
/// `project.py:141`: a Windows drive prefix.
static DRIVE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z]:/").expect("the drive pattern is a fixed valid regex"));
/// `project.py:144`: a project or library marker (`field map`, Resolution step 3).
static MARKER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new("\u{0}(?:PRJ|LIB:[A-Za-z0-9_:]+)\u{0}")
        .expect("the marker pattern is a fixed valid regex")
});
/// `project.py:148`: a KiCad library variable of any version (`env_vars.cpp`).
static LIBRARY_VAR: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^KICAD[0-9]+_(3DMODEL_DIR|SYMBOL_DIR|FOOTPRINT_DIR|TEMPLATE_DIR|3RD_PARTY)$")
        .expect("the library pattern is a fixed valid regex")
});
/// `project.py:47`: a canonical KiCad UUID (`KIID::AsString`).
static UUID: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
        .expect("the UUID pattern is a fixed valid regex")
});
/// `project.py:307`: `${NAME}`, `NAME` `[A-Za-z_][A-Za-z0-9_]*`, the text-path rule.
static CLOSURE_VAR: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
        .expect("the closure-variable pattern is a fixed valid regex")
});
/// `project.py:363`: `\$\{(.+?)\}`, the title-block expander.
static TB_VAR: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\$\{(.+?)\}").expect("the title-block pattern is a fixed valid regex")
});

/// `project.py:139`: variables whose value depends on the time or the checkout.
const NONDET: [&str; 5] = [
    "CURRENT_DATE",
    "CURRENT_TIME_HH_MM_SS",
    "CURRENT_TIME_LOCALE",
    "VCSHASH",
    "VCSSHORTHASH",
];

/// The two `.kicad_pro` drawing-sheet settings (`project.py:607-610`).
const DRAWING_POINTERS: [&str; 2] = [
    "/schematic/page_layout_descr_file",
    "/pcbnew/page_layout_descr_file",
];

/// `project.py:468-470`: net-class dimension key to contract field, in file order.
const NET_CLASS_FIELDS: [(&str, &str); 6] = [
    ("track_width", "trackWidthNm"),
    ("clearance", "clearanceNm"),
    ("diff_pair_width", "diffPairWidthNm"),
    ("diff_pair_gap", "diffPairGapNm"),
    ("via_diameter", "viaDiameterNm"),
    ("via_drill", "viaDrillNm"),
];

// --------------------------------------------------------------- reference types

/// Which setting or form holds a reference (`project.py` call sites;
/// `ProjectReferenceKind`).
#[derive(Clone, Copy, PartialEq, Eq)]
enum RefKind {
    SheetFile,
    FootprintLibrary,
    SymbolLibrary,
    Model3d,
    DrawingSheet,
    TextPath,
}

impl RefKind {
    /// The contract spelling (`ProjectReferenceKind`).
    fn as_str(self) -> &'static str {
        match self {
            Self::SheetFile => "sheet-file",
            Self::FootprintLibrary => "footprint-library",
            Self::SymbolLibrary => "symbol-library",
            Self::Model3d => "model-3d",
            Self::DrawingSheet => "drawing-sheet",
            Self::TextPath => "text-path",
        }
    }

    /// Whether `kicad-embed://` and `:alias:` forms apply (`project.py:233`, `:248`).
    fn is_embeddable(self) -> bool {
        matches!(self, Self::Model3d | Self::DrawingSheet)
    }
}

/// Which directory a relative path was joined to (`ProjectPathBase`).
#[derive(Clone, Copy)]
enum Base {
    ProjectVariable,
    ProjectDirectory,
    DocumentDirectory,
}

impl Base {
    fn as_str(self) -> &'static str {
        match self {
            Self::ProjectVariable => "project-variable",
            Self::ProjectDirectory => "project-directory",
            Self::DocumentDirectory => "document-directory",
        }
    }
}

/// One of KiCad's library directories (`ProjectKiCadLibrary`).
#[derive(Clone, Copy)]
enum Library {
    Model3d,
    Symbol,
    Footprint,
    Template,
    ThirdParty,
    UserTemplate,
}

impl Library {
    fn as_str(self) -> &'static str {
        match self {
            Self::Model3d => "model-3d",
            Self::Symbol => "symbol",
            Self::Footprint => "footprint",
            Self::Template => "template",
            Self::ThirdParty => "third-party",
            Self::UserTemplate => "user-template",
        }
    }
}

/// Why a reference could not be resolved (`ProjectUnresolvedReason`).
#[derive(Clone, Copy)]
enum Reason {
    UndefinedVariable,
    NondeterministicVariable,
    MisplacedVariable,
    VariableLoop,
    Uri,
    HomeRelative,
    Alias,
    EmbeddedMissing,
    OutsideLibraryRoot,
    EmptyPath,
    UnrepresentablePath,
}

impl Reason {
    fn as_str(self) -> &'static str {
        match self {
            Self::UndefinedVariable => "undefined-variable",
            Self::NondeterministicVariable => "nondeterministic-variable",
            Self::MisplacedVariable => "misplaced-variable",
            Self::VariableLoop => "variable-loop",
            Self::Uri => "uri",
            Self::HomeRelative => "home-relative",
            Self::Alias => "alias",
            Self::EmbeddedMissing => "embedded-missing",
            Self::OutsideLibraryRoot => "outside-library-root",
            Self::EmptyPath => "empty-path",
            Self::UnrepresentablePath => "unrepresentable-path",
        }
    }
}

/// Where a reference leads (`ProjectPathTarget`), before serialization.
enum Target {
    Repository {
        path: String,
        base: Base,
        in_sources: bool,
    },
    OutsideRepository {
        path: String,
        base: Base,
    },
    Absolute {
        path: String,
    },
    KiCadLibrary {
        variable: String,
        library: Library,
        relative_path: String,
    },
    Embedded {
        name: String,
        document_path: String,
        footprint_uuid: Option<String>,
        file_type: String,
    },
    Unresolved {
        reason: Reason,
        variable: Option<String>,
    },
}

impl Target {
    /// The contract JSON form (`project.py:160-164`, `:277-303`).
    fn to_value(&self) -> Value {
        match self {
            Self::Repository {
                path,
                base,
                in_sources,
            } => serde_json::json!({
                "kind": "repository",
                "path": path,
                "base": base.as_str(),
                "inSources": in_sources,
            }),
            Self::OutsideRepository { path, base } => serde_json::json!({
                "kind": "outside-repository",
                "path": path,
                "base": base.as_str(),
            }),
            Self::Absolute { path } => serde_json::json!({"kind": "absolute", "path": path}),
            Self::KiCadLibrary {
                variable,
                library,
                relative_path,
            } => serde_json::json!({
                "kind": "kicad-library",
                "variable": variable,
                "library": library.as_str(),
                "relativePath": relative_path,
            }),
            Self::Embedded {
                name,
                document_path,
                footprint_uuid,
                file_type,
            } => {
                let mut object = Map::new();
                object.insert("kind".to_owned(), "embedded".into());
                object.insert("name".to_owned(), name.clone().into());
                object.insert("documentPath".to_owned(), document_path.clone().into());
                if let Some(uuid) = footprint_uuid {
                    object.insert("footprintUuid".to_owned(), uuid.clone().into());
                }
                object.insert("fileType".to_owned(), file_type.clone().into());
                Value::Object(object)
            }
            Self::Unresolved { reason, variable } => {
                let mut object = Map::new();
                object.insert("kind".to_owned(), "unresolved".into());
                object.insert("reason".to_owned(), reason.as_str().into());
                if let Some(variable) = variable {
                    object.insert("variable".to_owned(), variable.clone().into());
                }
                Value::Object(object)
            }
        }
    }

    /// The embedded target's `footprintUuid`, else `None` (`project.py:577`).
    fn footprint_uuid(&self) -> Option<&str> {
        match self {
            Self::Embedded { footprint_uuid, .. } => footprint_uuid.as_deref(),
            _ => None,
        }
    }
}

/// An `unresolved` target (`project.py:160-164`).
fn unresolved(reason: Reason, variable: Option<String>) -> Target {
    Target::Unresolved { reason, variable }
}

/// One layer of the embedded-file lookup order (`project.py:236`).
struct EmbeddedLayer<'a> {
    document: &'a str,
    footprint_uuid: Option<&'a str>,
    files: &'a BTreeMap<String, String>,
}

// --------------------------------------------------------------- resolver

/// The field map's "Resolution (normative)", over repository segments
/// (`project.py:167-303`).
struct Resolver<'a> {
    project_name: &'a str,
    text_variables: &'a BTreeMap<String, String>,
    project_dir: &'a [String],
    sources: &'a BTreeSet<String>,
}

impl Resolver<'_> {
    /// `project.py:177-213`: expand variables in at most 8 rounds.
    fn expand(&self, raw: &str) -> (String, BTreeSet<String>, Option<Target>) {
        let mut text = raw.replace('\\', "/");
        let mut used = BTreeSet::new();
        for _ in 0..8 {
            if !VAR.is_match(&text) {
                return (text, used, None);
            }
            let (next, failure) = self.expand_once(&text, &mut used);
            text = next;
            if let Some(target) = failure {
                return (text, used, Some(target));
            }
        }
        if VAR.is_match(&text) {
            return (text, used, Some(unresolved(Reason::VariableLoop, None)));
        }
        (text, used, None)
    }

    /// One expansion round (`project.py:185-209`).
    fn expand_once(&self, text: &str, used: &mut BTreeSet<String>) -> (String, Option<Target>) {
        let mut out = String::new();
        let mut last = 0;
        let mut failure = None;
        for captures in VAR.captures_iter(text) {
            let Some(whole) = captures.get(0) else {
                continue;
            };
            out.push_str(&text[last..whole.start()]);
            last = whole.end();
            if failure.is_some() {
                out.push_str(whole.as_str());
                continue;
            }
            let name = captures
                .get(1)
                .or_else(|| captures.get(2))
                .or_else(|| captures.get(3))
                .map_or("", |group| group.as_str());
            match self.substitute(name, used) {
                Ok(value) => out.push_str(&value),
                Err(target) => {
                    failure = Some(target);
                    out.push_str(whole.as_str());
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
        if self.sources.contains(path) {
            return true;
        }
        let prefix = format!("{path}/");
        self.sources
            .iter()
            .any(|source| source.starts_with(&prefix))
    }

    /// `project.py:221-274`: resolve one raw reference.
    fn resolve(
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
        if URI.is_match(text) {
            return unresolved(Reason::Uri, None);
        }
        if text.starts_with('~') {
            return unresolved(Reason::HomeRelative, None);
        }
        if let Some(rest) = text.strip_prefix(':')
            && kind.is_embeddable()
        {
            return self.alias(rest);
        }
        if let Some(rest) = text.strip_prefix(LIB_PREFIX) {
            return self.library_marker(rest);
        }
        if let Some(rest) = text.strip_prefix(PRJ_MARKER) {
            return self.join(self.project_dir, rest, Base::ProjectVariable);
        }
        if text.starts_with('/') || DRIVE.is_match(text) {
            return absolute(text);
        }
        if kind == RefKind::SheetFile {
            let parent = document_path.rsplit_once('/').map_or("", |(dir, _)| dir);
            return self.join(&segments(parent), text, Base::DocumentDirectory);
        }
        self.join(self.project_dir, text, Base::ProjectDirectory)
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
    let markers: Vec<_> = MARKER.find_iter(text).collect();
    if markers.is_empty() || (markers[0].start() == 0 && markers.len() == 1) {
        return None;
    }
    let bad = if markers[0].start() == 0 {
        markers[1].as_str()
    } else {
        markers[0].as_str()
    };
    if bad == PRJ_MARKER {
        Some("KIPRJMOD")
    } else {
        Some(&bad[LIB_PREFIX.len()..bad.len() - 1])
    }
}

/// `project.py:147-153`: a KiCad library variable's directory.
fn library_of(name: &str) -> Option<Library> {
    if let Some(captures) = LIBRARY_VAR.captures(name) {
        return match captures.get(1).map(|group| group.as_str()) {
            Some("3DMODEL_DIR") => Some(Library::Model3d),
            Some("SYMBOL_DIR") => Some(Library::Symbol),
            Some("FOOTPRINT_DIR") => Some(Library::Footprint),
            Some("TEMPLATE_DIR") => Some(Library::Template),
            Some("3RD_PARTY") => Some(Library::ThirdParty),
            _ => None,
        };
    }
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
    let drive = if DRIVE.is_match(text) { &text[..2] } else { "" };
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

/// `project.py:120-134`: join `rest` to `base` lexically.
fn normalize(base: &[String], rest: &str) -> Vec<String> {
    let mut stack: Vec<String> = base.to_vec();
    for segment in rest.split('/') {
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
fn segments(path: &str) -> Vec<String> {
    if path.is_empty() {
        Vec::new()
    } else {
        path.split('/').map(str::to_owned).collect()
    }
}

// --------------------------------------------------------------- sexpr helpers

/// A borrowed `Sexp` list, or `None` for a scalar.
fn as_list(form: &Sexp) -> Option<&[Sexp]> {
    match form {
        Sexp::List(values) => Some(values.as_slice()),
        _ => None,
    }
}

/// `project.py:90-94`: the head token if it is a string.
fn head_str(form: &Sexp) -> Option<&str> {
    match as_list(form)?.first()? {
        Sexp::Atom(value) | Sexp::Quoted(value) => Some(value),
        _ => None,
    }
}

/// `project.py:90-94`: the first child whose head is `head`.
fn child<'a>(form: &'a Sexp, head: &str) -> Option<&'a Sexp> {
    as_list(form)?
        .iter()
        .skip(1)
        .find(|item| head_str(item) == Some(head))
}

/// `project.py:97-98`: every child whose head is `head`.
fn children<'a>(form: &'a Sexp, head: &str) -> Vec<&'a Sexp> {
    as_list(form).map_or_else(Vec::new, |values| {
        values
            .iter()
            .skip(1)
            .filter(|item| head_str(item) == Some(head))
            .collect()
    })
}

/// `project.py:101-105`: the scalar at `index`, or `None`.
fn atom(form: Option<&Sexp>, index: usize) -> Option<&Sexp> {
    let value = as_list(form?)?.get(index)?;
    (!matches!(value, Sexp::List(_))).then_some(value)
}

/// `project.py:108-112`: `str(value)`, or `None`.
fn str_atom(form: Option<&Sexp>, index: usize) -> Option<String> {
    Some(scalar(atom(form, index)?))
}

/// `project.py:78-87` and fork `worksheet.rs:926-933`: a scalar as text.
fn scalar(value: &Sexp) -> String {
    match value {
        Sexp::Atom(value) | Sexp::Quoted(value) => value.clone(),
        Sexp::Integer(value) => value.to_string(),
        Sexp::Float(value) => value.to_string(),
        Sexp::List(_) => String::new(),
    }
}

/// `project.py:115-117`: a canonical UUID child, else `None`.
fn uuid_of(form: &Sexp) -> Option<String> {
    let value = str_atom(child(form, "uuid"), 1)?;
    UUID.is_match(&value).then_some(value)
}

/// `project.py:426-437`: a `(embedded_files …)` map, name to file type.
fn embedded_files(form: &Sexp) -> BTreeMap<String, String> {
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
fn list_id(form: &Sexp) -> usize {
    match form {
        Sexp::List(values) => values.as_ptr() as usize,
        _ => 0,
    }
}

// --------------------------------------------------------------- title block

/// `project.py:385-398`: a `(title_block …)` as written.
struct TitleBlock {
    title: Option<String>,
    date: Option<String>,
    rev: Option<String>,
    company: Option<String>,
    comments: Vec<(i64, String)>,
}

impl TitleBlock {
    /// `project.py:385-398`: read a title block, or `None` when absent.
    fn read(form: Option<&Sexp>) -> Option<Self> {
        let form = form?;
        let mut block = Self {
            title: None,
            date: None,
            rev: None,
            company: None,
            comments: Vec::new(),
        };
        for (key, slot) in [
            ("title", &mut block.title),
            ("date", &mut block.date),
            ("rev", &mut block.rev),
            ("company", &mut block.company),
        ] {
            if let Some(value) = str_atom(child(form, key), 1)
                && !value.is_empty()
            {
                *slot = Some(value);
            }
        }
        let mut comments: BTreeMap<i64, String> = BTreeMap::new();
        for comment in children(form, "comment") {
            let Some(number) = comment_number(comment) else {
                continue;
            };
            if let Some(value) = str_atom(Some(comment), 2) {
                comments.insert(number, value);
            }
        }
        block.comments = comments
            .into_iter()
            .filter(|(_, text)| !text.is_empty())
            .collect();
        Some(block)
    }

    /// `project.py:387-397`: the raw contract fields.
    fn to_value(&self) -> Value {
        let mut object = Map::new();
        for (key, value) in [
            ("title", &self.title),
            ("date", &self.date),
            ("rev", &self.rev),
            ("company", &self.company),
        ] {
            if let Some(value) = value {
                object.insert(key.to_owned(), value.clone().into());
            }
        }
        let comments = self
            .comments
            .iter()
            .map(|(number, text)| serde_json::json!({"number": number, "text": text}))
            .collect();
        object.insert("comments".to_owned(), Value::Array(comments));
        Value::Object(object)
    }
}

/// `project.py:395`: a comment's number when it is an integer in 1..=9.
fn comment_number(comment: &Sexp) -> Option<i64> {
    let values = as_list(comment)?;
    if values.len() < 3 {
        return None;
    }
    let Sexp::Integer(number) = values[1] else {
        return None;
    };
    if !(1..=9).contains(&number) || matches!(values[2], Sexp::List(_)) {
        return None;
    }
    Some(number)
}

/// `project.py:401-423`: a title block with its variables expanded.
fn expanded_block(
    block: &TitleBlock,
    properties: &BTreeMap<String, String>,
    text_variables: &BTreeMap<String, String>,
    project_name: &str,
    filename: &str,
) -> Value {
    let mut variables: BTreeMap<String, String> = BTreeMap::new();
    variables.insert("TITLE".to_owned(), block.title.clone().unwrap_or_default());
    variables.insert(
        "ISSUE_DATE".to_owned(),
        block.date.clone().unwrap_or_default(),
    );
    variables.insert("REVISION".to_owned(), block.rev.clone().unwrap_or_default());
    variables.insert(
        "COMPANY".to_owned(),
        block.company.clone().unwrap_or_default(),
    );
    let by_number: BTreeMap<i64, &String> = block
        .comments
        .iter()
        .map(|(number, text)| (*number, text))
        .collect();
    for number in 1..=9 {
        let value = by_number.get(&number).map_or("", |text| text.as_str());
        variables.insert(format!("COMMENT{number}"), value.to_owned());
    }
    variables.extend(properties.iter().map(|(k, v)| (k.clone(), v.clone())));
    variables.extend(text_variables.iter().map(|(k, v)| (k.clone(), v.clone())));
    if !project_name.is_empty() {
        variables.insert("PROJECTNAME".to_owned(), project_name.to_owned());
    }
    variables.insert("FILENAME".to_owned(), filename.to_owned());

    let mut object = Map::new();
    for (key, value) in [
        ("title", &block.title),
        ("date", &block.date),
        ("rev", &block.rev),
        ("company", &block.company),
    ] {
        if let Some(value) = value {
            let expanded = tb_expand(value, &variables);
            if !expanded.is_empty() {
                object.insert(key.to_owned(), expanded.into());
            }
        }
    }
    let comments = block
        .comments
        .iter()
        .filter_map(|(number, text)| {
            let expanded = tb_expand(text, &variables);
            (!expanded.is_empty()).then(|| serde_json::json!({"number": number, "text": expanded}))
        })
        .collect();
    object.insert("comments".to_owned(), Value::Array(comments));
    Value::Object(object)
}

/// `project.py:366-383`: `kicad_text_variables.py:51-71` (depth 10).
fn tb_expand(text: &str, variables: &BTreeMap<String, String>) -> String {
    if text.is_empty() || !text.contains("${") {
        return text.to_owned();
    }
    expand_title(text, variables, 0)
}

/// One recursively substituted pass (`project.py:369-378`).
fn expand_title(text: &str, variables: &BTreeMap<String, String>, depth: u8) -> String {
    let mut out = String::new();
    let mut last = 0;
    for captures in TB_VAR.captures_iter(text) {
        let Some(whole) = captures.get(0) else {
            continue;
        };
        out.push_str(&text[last..whole.start()]);
        last = whole.end();
        let name = captures.get(1).map_or("", |group| group.as_str());
        match variables.get(name) {
            Some(value) if depth >= 10 => out.push_str(value),
            Some(value) => out.push_str(&expand_title(value, variables, depth + 1)),
            None => out.push_str(whole.as_str()),
        }
    }
    out.push_str(&text[last..]);
    out
}

// --------------------------------------------------------------- text paths

/// `project.py:310-323`: `closure_references.py:25-58`.
fn is_path_reference(value: &str) -> bool {
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
fn json_text_paths(
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
enum ScanKind {
    Schematic,
    Board,
    Library,
    DrawingSheet,
}

/// One parsed file that is scanned for `text-path` (`project.py:519`).
struct Scanned {
    path: String,
    tree: Sexp,
    kind: ScanKind,
}

/// `project.py:326-346`: string atoms that are path references, typed atoms
/// excluded.
fn sexpr_text_paths(tree: &Sexp, typed: &HashSet<(usize, usize)>) -> Vec<(String, String)> {
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
fn typed_atoms(tree: &Sexp, kind: ScanKind) -> HashSet<(usize, usize)> {
    let mut typed = HashSet::new();
    match kind {
        ScanKind::Schematic => {
            for sheet in children(tree, "sheet") {
                for property in children(sheet, "property") {
                    if is_sheet_file_property(property) {
                        typed.insert((list_id(property), 2));
                    }
                }
            }
        }
        ScanKind::Board => {
            for footprint in children(tree, "footprint") {
                for model in children(footprint, "model") {
                    if is_scalar_at(model, 1) {
                        typed.insert((list_id(model), 1));
                    }
                }
            }
        }
        ScanKind::Library => {
            for lib in children(tree, "lib") {
                if let Some(uri) = child(lib, "uri")
                    && as_list(uri).is_some_and(|values| values.len() > 1)
                {
                    typed.insert((list_id(uri), 1));
                }
            }
        }
        ScanKind::DrawingSheet => {}
    }
    typed
}

/// `project.py:536-540`: a `Sheetfile` / `Sheet file` property with a scalar value.
fn is_sheet_file_property(property: &Sexp) -> bool {
    is_named_property(property, &["Sheetfile", "Sheet file"])
}

/// Whether `property` is a `(property "<name>" …)` with a scalar value and a
/// name in `names` (`project.py:536-540`, `:542-544`).
fn is_named_property(property: &Sexp, names: &[&str]) -> bool {
    as_list(property).is_some_and(|values| values.len() >= 3)
        && matches!(str_atom(Some(property), 1).as_deref(), Some(name) if names.contains(&name))
        && is_scalar_at(property, 2)
}

/// `project.py:536-540`: the first `Sheetfile` property's value.
fn sheet_file_value(sheet: &Sexp) -> Option<String> {
    let property = children(sheet, "property")
        .into_iter()
        .find(|property| is_sheet_file_property(property))?;
    str_atom(Some(property), 2)
}

/// Whether the scalar at `index` is present and not a list (`project.py:569`).
fn is_scalar_at(form: &Sexp, index: usize) -> bool {
    as_list(form).is_some_and(|values| {
        values
            .get(index)
            .is_some_and(|v| !matches!(v, Sexp::List(_)))
    })
}

// --------------------------------------------------------------- producer

/// One extracted reference's extra fields.
#[derive(Clone, Copy, Default)]
struct RefExtra<'a> {
    sheet_uuid: Option<&'a str>,
    sheet_name: Option<&'a str>,
    library_name: Option<&'a str>,
    field: Option<&'a str>,
}

/// The state of one `produce` run (`project.py:443-649`).
struct Producer<'a> {
    sources: &'a dyn Sources,
    project_file: String,
    project_dir: Vec<String>,
    stem: String,
    project_name: String,
    text_variables: BTreeMap<String, String>,
    source_set: BTreeSet<String>,
    pro: Value,
    warnings: Vec<ProducerWarning>,
    documents: Vec<Value>,
    references: Vec<Value>,
    scanned: Vec<Scanned>,
    root_embedded: BTreeMap<String, String>,
    board_embedded: BTreeMap<String, String>,
}

impl<'a> Producer<'a> {
    /// `project.py:443-460`: set up the run from the configuration and the project file.
    fn new(input: &'a ProjectionInput<'a>, pro: Value) -> Self {
        let project_file = input.config.project_file.0.clone();
        let text_variables = read_text_variables(&pro);
        let stem = project_stem(&project_file);
        Self {
            sources: input.sources,
            project_dir: dir_segments(&project_file),
            project_name: stem.clone(),
            stem,
            project_file,
            text_variables,
            source_set: input.sources.paths().into_iter().collect(),
            pro,
            warnings: Vec::new(),
            documents: Vec::new(),
            references: Vec::new(),
            scanned: Vec::new(),
            root_embedded: BTreeMap::new(),
            board_embedded: BTreeMap::new(),
        }
    }

    /// `project.py:443-649`: the whole member.
    fn build(&mut self) -> Result<(Value, Vec<ProducerWarning>), ProjectionError> {
        self.scan_schematics()?;
        self.scan_board()?;
        self.scan_library_tables()?;
        self.scan_drawing_sheets()?;
        self.scan_text_paths()?;
        let document = self.finish();
        Ok((document, std::mem::take(&mut self.warnings)))
    }

    /// `project.py:451-452`: a project-relative path as a repository path.
    fn repo(&self, project_relative: &str) -> String {
        normalize(&self.project_dir, project_relative).join("/")
    }

    /// `project.py:454-455`: read and parse one file in the source set.
    fn read_sexpr(&self, path: &str) -> Result<Sexp, ProjectionError> {
        let bytes = self.sources.read(path).ok_or_else(|| {
            ProjectionError::new(format!("{NAME}: {path} is not in the source set"))
        })?;
        let text = std::str::from_utf8(&bytes).map_err(|error| {
            ProjectionError::new(format!("{NAME}: {path} is not UTF-8: {error}"))
        })?;
        parse_with_limits(text, Limits::default()).map_err(|error| {
            ProjectionError::new(format!("{NAME}: {path} does not parse: {error}"))
        })
    }

    /// Resolve one reference from the producer's configuration.
    fn resolve_parts(
        &self,
        raw: &str,
        kind: RefKind,
        document_path: &str,
        stack: &[EmbeddedLayer<'_>],
    ) -> (Vec<String>, Target) {
        let resolver = Resolver {
            project_name: &self.project_name,
            text_variables: &self.text_variables,
            project_dir: &self.project_dir,
            sources: &self.source_set,
        };
        resolver.resolve(raw, kind, document_path, stack)
    }

    /// `project.py:483-495`: resolve and record one reference.
    fn add_ref(
        &mut self,
        kind: RefKind,
        document_path: &str,
        raw: Option<&str>,
        extra: RefExtra<'_>,
        stack: &[EmbeddedLayer<'_>],
    ) -> Option<Target> {
        let raw = raw.filter(|raw| !raw.is_empty())?;
        let (variables, target) = self.resolve_parts(raw, kind, document_path, stack);
        self.references.push(build_reference(
            kind,
            document_path,
            raw,
            &variables,
            &target,
            &extra,
        ));
        Some(target)
    }

    /// `project.py:497-517`: one document header.
    fn header(&self, tree: &Sexp, path: &str, kind: &str) -> Value {
        let mut document = Map::new();
        document.insert("path".to_owned(), path.into());
        document.insert("kind".to_owned(), kind.into());
        if let Some(Sexp::Integer(version)) = atom(child(tree, "version"), 1)
            && *version >= 1
        {
            document.insert("formatVersion".to_owned(), (*version).into());
        }
        if let Some(generator) = str_atom(child(tree, "generator"), 1) {
            document.insert("generator".to_owned(), generator.into());
        }
        if let Some(version) = str_atom(child(tree, "generator_version"), 1) {
            document.insert("generatorVersion".to_owned(), version.into());
        }
        let mut properties = BTreeMap::new();
        for property in children(tree, "property") {
            if let Some((name, value)) = document_property(property) {
                properties.insert(name, value);
            }
        }
        if let Some(block) = TitleBlock::read(child(tree, "title_block")) {
            document.insert("titleBlock".to_owned(), block.to_value());
            let filename = path.rsplit('/').next().unwrap_or(path);
            document.insert(
                "expandedTitleBlock".to_owned(),
                expanded_block(
                    &block,
                    &properties,
                    &self.text_variables,
                    &self.project_name,
                    filename,
                ),
            );
        }
        document.insert(
            "properties".to_owned(),
            Value::Object(
                properties
                    .into_iter()
                    .map(|(key, value)| (key, Value::String(value)))
                    .collect(),
            ),
        );
        Value::Object(document)
    }

    /// `project.py:521-555`: the root schematic and every sheet it reaches.
    fn scan_schematics(&mut self) -> Result<(), ProjectionError> {
        let root = self.repo(&format!("{}.kicad_sch", self.stem));
        if !self.source_set.contains(&root) {
            return Ok(());
        }
        let mut queue = VecDeque::from([root.clone()]);
        let mut seen = BTreeSet::from([root.clone()]);
        while let Some(path) = queue.pop_front() {
            let tree = self.read_sexpr(&path)?;
            if path == root {
                self.root_embedded = embedded_files(&tree);
            }
            let kind = if path == root {
                "root-schematic"
            } else {
                "schematic"
            };
            let document = self.header(&tree, &path, kind);
            self.documents.push(document);
            for sheet in children(&tree, "sheet") {
                if let Some(child_path) = self.sheet_reference(sheet, &path)
                    && seen.insert(child_path.clone())
                {
                    queue.push_back(child_path);
                }
            }
            self.scanned.push(Scanned {
                path,
                tree,
                kind: ScanKind::Schematic,
            });
        }
        Ok(())
    }

    /// `project.py:533-554`: one `(sheet …)`'s `sheet-file` reference, returning
    /// the reached child when it is in the sources.
    fn sheet_reference(&mut self, sheet: &Sexp, path: &str) -> Option<String> {
        let sheet_uuid = uuid_of(sheet);
        let file_value = sheet_file_value(sheet);
        let name = sheet_name(sheet);
        let Some(sheet_uuid) = sheet_uuid else {
            self.warnings
                .push(warning("project-sheet-without-uuid", path.to_owned()));
            return None;
        };
        let extra = RefExtra {
            sheet_uuid: Some(&sheet_uuid),
            sheet_name: name.as_deref(),
            ..RefExtra::default()
        };
        let target = self.add_ref(RefKind::SheetFile, path, file_value.as_deref(), extra, &[]);
        match target {
            Some(Target::Repository {
                path,
                in_sources: true,
                ..
            }) => Some(path),
            _ => None,
        }
    }

    /// `project.py:557-582`: the board and its `model-3d` references.
    fn scan_board(&mut self) -> Result<(), ProjectionError> {
        let board = self.repo(&format!("{}.kicad_pcb", self.stem));
        if !self.source_set.contains(&board) {
            return Ok(());
        }
        let tree = self.read_sexpr(&board)?;
        let document = self.header(&tree, &board, "board");
        self.documents.push(document);
        self.board_embedded = embedded_files(&tree);
        let mut model_keys: BTreeSet<(String, Option<String>)> = BTreeSet::new();
        for footprint in children(&tree, "footprint") {
            let footprint_uuid = uuid_of(footprint);
            let own = embedded_files(footprint);
            for model in children(footprint, "model") {
                self.model_reference(
                    &board,
                    model,
                    footprint_uuid.as_deref(),
                    &own,
                    &mut model_keys,
                );
            }
        }
        self.scanned.push(Scanned {
            path: board,
            tree,
            kind: ScanKind::Board,
        });
        Ok(())
    }

    /// `project.py:568-581`: one `(model …)` reference, deduplicated.
    fn model_reference(
        &mut self,
        board: &str,
        model: &Sexp,
        footprint_uuid: Option<&str>,
        own: &BTreeMap<String, String>,
        model_keys: &mut BTreeSet<(String, Option<String>)>,
    ) {
        if !is_scalar_at(model, 1) {
            return;
        }
        let Some(value) = atom(Some(model), 1) else {
            return;
        };
        let raw = scalar(value);
        if raw.is_empty() {
            return;
        }
        let (variables, target) = {
            let stack = [
                EmbeddedLayer {
                    document: board,
                    footprint_uuid,
                    files: own,
                },
                EmbeddedLayer {
                    document: board,
                    footprint_uuid: None,
                    files: &self.board_embedded,
                },
            ];
            self.resolve_parts(&raw, RefKind::Model3d, board, &stack)
        };
        if !model_keys.insert((raw.clone(), target.footprint_uuid().map(str::to_owned))) {
            return;
        }
        self.references.push(build_reference(
            RefKind::Model3d,
            board,
            &raw,
            &variables,
            &target,
            &RefExtra::default(),
        ));
    }

    /// `project.py:584-605`: the project's two library tables.
    fn scan_library_tables(&mut self) -> Result<(), ProjectionError> {
        for (name, kind) in [
            ("fp-lib-table", RefKind::FootprintLibrary),
            ("sym-lib-table", RefKind::SymbolLibrary),
        ] {
            let table_path = self.repo(name);
            if !self.source_set.contains(&table_path) {
                continue;
            }
            let tree = self.read_sexpr(&table_path)?;
            let mut names: BTreeSet<String> = BTreeSet::new();
            for lib in children(&tree, "lib") {
                self.library_reference(&table_path, kind, lib, &mut names);
            }
            self.scanned.push(Scanned {
                path: table_path,
                tree,
                kind: ScanKind::Library,
            });
        }
        Ok(())
    }

    /// `project.py:591-604`: one `(lib …)` row.
    fn library_reference(
        &mut self,
        table_path: &str,
        kind: RefKind,
        lib: &Sexp,
        names: &mut BTreeSet<String>,
    ) {
        let name = str_atom(child(lib, "name"), 1).filter(|value| !value.is_empty());
        let uri = str_atom(child(lib, "uri"), 1).filter(|value| !value.is_empty());
        let (Some(name), Some(uri)) = (name, uri) else {
            self.warnings.push(warning(
                "project-library-row-invalid",
                table_path.to_owned(),
            ));
            return;
        };
        if !names.insert(name.clone()) {
            self.warnings.push(warning(
                "project-library-name-duplicate",
                format!("{table_path}: {name}"),
            ));
            return;
        }
        let extra = RefExtra {
            library_name: Some(&name),
            ..RefExtra::default()
        };
        self.add_ref(kind, table_path, Some(&uri), extra, &[]);
    }

    /// `project.py:607-618`: the two `.kicad_pro` drawing-sheet settings.
    fn scan_drawing_sheets(&mut self) -> Result<(), ProjectionError> {
        for pointer in DRAWING_POINTERS {
            let Some(value) = drawing_setting(&self.pro, pointer).map(str::to_owned) else {
                continue;
            };
            let root = self.repo(&format!("{}.kicad_sch", self.stem));
            let board = self.repo(&format!("{}.kicad_pcb", self.stem));
            let (document, files) = if pointer.starts_with("/schematic") {
                (root.as_str(), self.root_embedded.clone())
            } else {
                (board.as_str(), self.board_embedded.clone())
            };
            let stack = [EmbeddedLayer {
                document,
                footprint_uuid: None,
                files: &files,
            }];
            let extra = RefExtra {
                field: Some(pointer),
                ..RefExtra::default()
            };
            let project_file = self.project_file.clone();
            let target = self.add_ref(
                RefKind::DrawingSheet,
                project_file.as_str(),
                Some(&value),
                extra,
                &stack,
            );
            if let Some(Target::Repository {
                path,
                in_sources: true,
                ..
            }) = target
            {
                let tree = self.read_sexpr(&path)?;
                self.scanned.push(Scanned {
                    path,
                    tree,
                    kind: ScanKind::DrawingSheet,
                });
            }
        }
        Ok(())
    }

    /// `project.py:620-629`: every `text-path` reference.
    fn scan_text_paths(&mut self) -> Result<(), ProjectionError> {
        let mut seen: BTreeSet<(String, String, String)> = BTreeSet::new();
        let skip: BTreeSet<&str> = DRAWING_POINTERS.into_iter().collect();
        let mut found = Vec::new();
        json_text_paths(&self.pro, "", &skip, &mut found);
        for (pointer, value) in found {
            let project_file = self.project_file.clone();
            if seen.insert((project_file.clone(), pointer.clone(), value.clone())) {
                let extra = RefExtra {
                    field: Some(&pointer),
                    ..RefExtra::default()
                };
                self.add_ref(
                    RefKind::TextPath,
                    project_file.as_str(),
                    Some(&value),
                    extra,
                    &[],
                );
            }
        }
        let scanned = std::mem::take(&mut self.scanned);
        for entry in &scanned {
            let typed = typed_atoms(&entry.tree, entry.kind);
            for (field, value) in sexpr_text_paths(&entry.tree, &typed) {
                if seen.insert((entry.path.clone(), field.clone(), value.clone())) {
                    let extra = RefExtra {
                        field: Some(&field),
                        ..RefExtra::default()
                    };
                    self.add_ref(
                        RefKind::TextPath,
                        entry.path.as_str(),
                        Some(&value),
                        extra,
                        &[],
                    );
                }
            }
        }
        Ok(())
    }

    /// `project.py:631-649`: sort references and documents, build the document.
    fn finish(&mut self) -> Value {
        self.references.sort_by_cached_key(ref_key);
        self.documents.sort_by_cached_key(document_path);
        let mut root = Map::new();
        root.insert("schema".to_owned(), SCHEMA.into());
        root.insert("projectFile".to_owned(), self.project_file.clone().into());
        root.insert("projectName".to_owned(), self.project_name.clone().into());
        root.insert(
            "textVariables".to_owned(),
            Value::Object(
                self.text_variables
                    .iter()
                    .map(|(key, value)| (key.clone(), Value::String(value.clone())))
                    .collect(),
            ),
        );
        let (net_classes, warnings) = read_net_classes(&self.pro);
        self.warnings.extend(warnings);
        root.insert("netClasses".to_owned(), Value::Array(net_classes));
        root.insert(
            "documents".to_owned(),
            Value::Array(std::mem::take(&mut self.documents)),
        );
        root.insert(
            "references".to_owned(),
            Value::Array(std::mem::take(&mut self.references)),
        );
        Value::Object(root)
    }
}

/// `project.py:508-516`: a document's top-level `(property "N" "V")`.
fn document_property(property: &Sexp) -> Option<(String, String)> {
    let name = match atom(Some(property), 1)? {
        Sexp::Atom(name) | Sexp::Quoted(name) if !name.is_empty() => name.clone(),
        _ => return None,
    };
    let value = atom(Some(property), 2)?;
    Some((name, scalar(value)))
}

/// `project.py:541-545`: the first `Sheetname` / `Sheet name` property, non-empty.
fn sheet_name(sheet: &Sexp) -> Option<String> {
    let property = children(sheet, "property")
        .into_iter()
        .find(|property| is_named_property(property, &["Sheetname", "Sheet name"]))?;
    let value = str_atom(Some(property), 2)?;
    (!value.is_empty()).then_some(value)
}

/// `project.py:612-614`: a drawing-sheet setting, when it is a non-empty string.
fn drawing_setting<'a>(pro: &'a Value, pointer: &str) -> Option<&'a str> {
    let (section, key) = pointer.trim_start_matches('/').split_once('/')?;
    pro.get(section)?
        .as_object()?
        .get(key)?
        .as_str()
        .filter(|value| !value.is_empty())
}

/// `project.py:483-495`: one reference as JSON.
fn build_reference(
    kind: RefKind,
    document_path: &str,
    raw: &str,
    variables: &[String],
    target: &Target,
    extra: &RefExtra<'_>,
) -> Value {
    let mut object = Map::new();
    object.insert("kind".to_owned(), kind.as_str().into());
    object.insert("documentPath".to_owned(), document_path.into());
    for (key, value) in [
        ("sheetUuid", extra.sheet_uuid),
        ("sheetName", extra.sheet_name),
        ("libraryName", extra.library_name),
        ("field", extra.field),
    ] {
        if let Some(value) = value {
            object.insert(key.to_owned(), value.into());
        }
    }
    object.insert("raw".to_owned(), raw.into());
    object.insert(
        "variables".to_owned(),
        Value::Array(variables.iter().cloned().map(Value::String).collect()),
    );
    object.insert("target".to_owned(), target.to_value());
    Value::Object(object)
}

/// `project.py:634-637`: the reference sort key.
#[allow(
    clippy::type_complexity,
    reason = "the key is the field map's documented tuple, spelled out"
)]
fn ref_key(
    reference: &Value,
) -> (
    String,
    String,
    String,
    (u8, String),
    (u8, String),
    (u8, String),
    (u8, String),
) {
    let target = &reference["target"];
    let footprint_uuid = if target["kind"] == "embedded" {
        target.get("footprintUuid").and_then(Value::as_str)
    } else {
        None
    };
    (
        string_field(reference, "documentPath"),
        string_field(reference, "kind"),
        string_field(reference, "raw"),
        absent_first(reference.get("sheetUuid").and_then(Value::as_str)),
        absent_first(reference.get("field").and_then(Value::as_str)),
        absent_first(reference.get("libraryName").and_then(Value::as_str)),
        absent_first(footprint_uuid),
    )
}

/// `project.py:631-632`: absent sorts before present.
fn absent_first(value: Option<&str>) -> (u8, String) {
    value.map_or((0, String::new()), |value| (1, value.to_owned()))
}

/// One string field of a reference, or the empty string when absent.
fn string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned()
}

/// One document's `path`.
fn document_path(document: &Value) -> String {
    string_field(document, "path")
}

/// `project.py:458`: the project's `text_variables`, values through
/// `project_string` (`project.py:78-87`).
fn read_text_variables(pro: &Value) -> BTreeMap<String, String> {
    let Some(Value::Object(variables)) = pro.get("text_variables") else {
        return BTreeMap::new();
    };
    variables
        .iter()
        .map(|(key, value)| (key.clone(), project_string(value)))
        .collect()
}

/// `project.py:463-478`: the `.kicad_pro` net classes and their warnings.
fn read_net_classes(pro: &Value) -> (Vec<Value>, Vec<ProducerWarning>) {
    let mut classes = Vec::new();
    let mut warnings = Vec::new();
    let Some(list) = pro
        .get("net_settings")
        .and_then(|settings| settings.get("classes"))
        .and_then(Value::as_array)
    else {
        return (classes, warnings);
    };
    for class in list {
        let Value::Object(class) = class else {
            continue;
        };
        let name = project_string(class.get("name").unwrap_or(&Value::Null));
        let mut entry = Map::new();
        entry.insert("name".to_owned(), name.clone().into());
        for (key, field) in NET_CLASS_FIELDS {
            let Some(value) = class.get(key).and_then(Value::as_f64) else {
                continue;
            };
            let nanometres = nanometres(value);
            if (0..1 << 53).contains(&nanometres) {
                entry.insert(field.to_owned(), nanometres.into());
            } else {
                warnings.push(warning(
                    "project-net-class-value-invalid",
                    format!("{name}.{key}"),
                ));
            }
        }
        classes.push(Value::Object(entry));
    }
    (classes, warnings)
}

/// `project.py:78-87`: the fork's `project_string` (`project.rs:945-952`).
fn project_string(value: &Value) -> String {
    match value {
        Value::Null | Value::Bool(false) => String::new(),
        Value::Bool(true) => "true".to_owned(),
        Value::String(value) => value.clone(),
        Value::Number(number) if number.as_f64() == Some(0.0) => String::new(),
        other => other.to_string(),
    }
}

/// `project.py:72-75`: `conventions.md §6`, half away from zero.
fn nanometres(value_mm: f64) -> i64 {
    (value_mm * 1e6).round() as i64
}

/// `project.py:449`: the `.kicad_pro` name without its `.kicad_pro` suffix.
fn project_stem(project_file: &str) -> String {
    let name = project_file.rsplit('/').next().unwrap_or(project_file);
    let cut = name.len().saturating_sub(".kicad_pro".len());
    name.get(..cut).unwrap_or_default().to_owned()
}

/// `project.py:448`: the project directory's repository segments.
fn dir_segments(project_file: &str) -> Vec<String> {
    project_file
        .rsplit_once('/')
        .map_or_else(Vec::new, |(dir, _)| segments(dir))
}

/// A producer warning (`project.py:462`).
fn warning(code: &str, message: String) -> ProducerWarning {
    ProducerWarning {
        code: code.to_owned(),
        message,
    }
}

/// Build `projections/project.json` from the single parse of the revision.
pub fn produce(input: &ProjectionInput<'_>) -> Result<Produced<ProjectA0>, ProjectionError> {
    let pro: Value = serde_json::from_str(input.project.text).map_err(|error| {
        ProjectionError::new(format!(
            "{NAME}: the project file is not valid JSON: {error}"
        ))
    })?;
    // `config.root_schematic`/`board` are the effective configuration's values;
    // the producer falls back to KiCad's `<stem>` pairing only when unset.
    let mut producer = Producer::new(input, pro);
    let (value, warnings) = producer.build()?;
    let mut produced = document(NAME, value)?;
    produced.warnings = warnings;
    Ok(produced)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn variables(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
            .collect()
    }

    fn sources(paths: &[&str]) -> BTreeSet<String> {
        paths.iter().map(|path| (*path).to_owned()).collect()
    }

    fn target(
        raw: &str,
        kind: RefKind,
        project_dir: &[&str],
        text_variables: &BTreeMap<String, String>,
        sources_set: &BTreeSet<String>,
    ) -> (Vec<String>, Target) {
        let project_dir: Vec<String> = project_dir.iter().map(|s| (*s).to_owned()).collect();
        let resolver = Resolver {
            project_name: "demo",
            text_variables,
            project_dir: &project_dir,
            sources: sources_set,
        };
        resolver.resolve(raw, kind, "demo.kicad_sch", &[])
    }

    fn is_reason(target: &Target, reason: Reason) -> bool {
        matches!(target, Target::Unresolved { reason: actual, .. } if actual.as_str() == reason.as_str())
    }

    #[test]
    fn embedded_without_a_match_is_embedded_missing() {
        let (_, target) = target(
            "kicad-embed://missing.stp",
            RefKind::Model3d,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        assert!(is_reason(&target, Reason::EmbeddedMissing));
    }

    #[test]
    fn embedded_outside_the_embeddable_kinds_is_a_uri() {
        let (_, target) = target(
            "kicad-embed://missing.stp",
            RefKind::SheetFile,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        assert!(is_reason(&target, Reason::Uri));
    }

    #[test]
    fn a_home_relative_path_is_home_relative() {
        let (_, target) = target(
            "~/kicad/models/D_SOD-123.step",
            RefKind::Model3d,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        assert!(is_reason(&target, Reason::HomeRelative));
    }

    #[test]
    fn a_uri_is_a_uri() {
        let (_, target) = target(
            "https://example.com/a.step",
            RefKind::Model3d,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        assert!(is_reason(&target, Reason::Uri));
    }

    #[test]
    fn an_alias_of_a_library_variable_is_a_kicad_library() {
        let (variables, target) = target(
            ":KICAD9_3DMODEL_DIR:Package_TO_SOT_SMD.3dshapes/SOT-23.step",
            RefKind::Model3d,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        assert!(variables.is_empty());
        match target {
            Target::KiCadLibrary {
                variable,
                library,
                relative_path,
            } => {
                assert_eq!(variable, "KICAD9_3DMODEL_DIR");
                assert_eq!(library.as_str(), "model-3d");
                assert_eq!(relative_path, "Package_TO_SOT_SMD.3dshapes/SOT-23.step");
            }
            _ => panic!("expected a kicad-library target"),
        }
    }

    #[test]
    fn an_unknown_alias_is_an_alias() {
        let (_, target) = target(
            ":NotALibrary:foo.step",
            RefKind::Model3d,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        assert!(is_reason(&target, Reason::Alias));
    }

    #[test]
    fn climbing_above_the_repository_is_outside_repository() {
        let (variables, target) = target(
            "${KIPRJMOD}/../shared-models/SOT-23.step",
            RefKind::Model3d,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        assert_eq!(variables, ["KIPRJMOD"]);
        match target {
            Target::OutsideRepository { path, base } => {
                assert_eq!(path, "../shared-models/SOT-23.step");
                assert_eq!(base.as_str(), "project-variable");
            }
            _ => panic!("expected an outside-repository target"),
        }
    }

    #[test]
    fn a_text_variable_cycle_is_a_variable_loop() {
        let text_variables = variables(&[("A", "${B}"), ("B", "${A}")]);
        let (_, target) = target(
            "${A}/x.step",
            RefKind::Model3d,
            &[],
            &text_variables,
            &BTreeSet::new(),
        );
        assert!(is_reason(&target, Reason::VariableLoop));
    }

    #[test]
    fn a_marker_that_does_not_start_the_text_is_misplaced() {
        let (variables, target) = target(
            "prefix${KIPRJMOD}/x.step",
            RefKind::Model3d,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        assert_eq!(variables, ["KIPRJMOD"]);
        match target {
            Target::Unresolved { reason, variable } => {
                assert_eq!(reason.as_str(), "misplaced-variable");
                assert_eq!(variable.as_deref(), Some("KIPRJMOD"));
            }
            _ => panic!("expected an unresolved target"),
        }
    }

    #[test]
    fn a_nondeterministic_variable_names_the_variable() {
        let (_, target) = target(
            "${CURRENT_DATE}/x.step",
            RefKind::Model3d,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        match target {
            Target::Unresolved { reason, variable } => {
                assert_eq!(reason.as_str(), "nondeterministic-variable");
                assert_eq!(variable.as_deref(), Some("CURRENT_DATE"));
            }
            _ => panic!("expected an unresolved target"),
        }
    }

    #[test]
    fn an_undefined_variable_names_the_variable() {
        let (variables, target) = target(
            "${TEAM_LIBS}/Team.pretty",
            RefKind::FootprintLibrary,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        assert!(variables.is_empty());
        match target {
            Target::Unresolved { reason, variable } => {
                assert_eq!(reason.as_str(), "undefined-variable");
                assert_eq!(variable.as_deref(), Some("TEAM_LIBS"));
            }
            _ => panic!("expected an unresolved target"),
        }
    }

    #[test]
    fn a_resolved_repository_path_reports_in_sources() {
        let sources_set = sources(&["packages3D/796638-2.step"]);
        let (variables, target) = target(
            "${KIPRJMOD}/packages3D/796638-2.step",
            RefKind::Model3d,
            &[],
            &BTreeMap::new(),
            &sources_set,
        );
        assert_eq!(variables, ["KIPRJMOD"]);
        match target {
            Target::Repository {
                path,
                base,
                in_sources,
            } => {
                assert_eq!(path, "packages3D/796638-2.step");
                assert_eq!(base.as_str(), "project-variable");
                assert!(in_sources);
            }
            _ => panic!("expected a repository target"),
        }
    }

    #[test]
    fn a_directory_target_is_in_sources_for_a_file_below_it() {
        let sources_set = sources(&["PrismFixture.pretty/Conn.kicad_mod"]);
        let (_, target) = target(
            "${KIPRJMOD}/PrismFixture.pretty",
            RefKind::FootprintLibrary,
            &[],
            &BTreeMap::new(),
            &sources_set,
        );
        match target {
            Target::Repository { in_sources, .. } => assert!(in_sources),
            _ => panic!("expected a repository target"),
        }
    }

    #[test]
    fn a_sheet_file_joins_the_document_directory() {
        let resolver = Resolver {
            project_name: "demo",
            text_variables: &BTreeMap::new(),
            project_dir: &[],
            sources: &sources(&["Subsheets/child.kicad_sch"]),
        };
        let (_, target) = resolver.resolve(
            "Subsheets/child.kicad_sch",
            RefKind::SheetFile,
            "Subsheets/parent.kicad_sch",
            &[],
        );
        match target {
            Target::Repository { path, base, .. } => {
                assert_eq!(path, "Subsheets/Subsheets/child.kicad_sch");
                assert_eq!(base.as_str(), "document-directory");
            }
            _ => panic!("expected a repository target"),
        }
    }

    #[test]
    fn an_absolute_path_is_normalized() {
        let (_, target) = target(
            "/opt/libs/../libs/Host.pretty",
            RefKind::FootprintLibrary,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        match target {
            Target::Absolute { path } => assert_eq!(path, "/opt/libs/Host.pretty"),
            _ => panic!("expected an absolute target"),
        }
    }

    #[test]
    fn a_library_path_climbing_above_its_root_is_outside_library_root() {
        let (_, target) = target(
            "${KICAD9_3DMODEL_DIR}/../extra.step",
            RefKind::Model3d,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        assert!(is_reason(&target, Reason::OutsideLibraryRoot));
    }

    #[test]
    fn a_project_marker_alone_is_an_empty_path() {
        let (_, target) = target(
            "${KIPRJMOD}",
            RefKind::FootprintLibrary,
            &[],
            &BTreeMap::new(),
            &BTreeSet::new(),
        );
        assert!(is_reason(&target, Reason::EmptyPath));
    }

    #[test]
    fn a_text_variable_is_used_before_a_library_variable() {
        let text_variables = variables(&[("KICAD9_3DMODEL_DIR", "custom")]);
        let (variables, target) = target(
            "${KICAD9_3DMODEL_DIR}/x.step",
            RefKind::Model3d,
            &[],
            &text_variables,
            &BTreeSet::new(),
        );
        assert_eq!(variables, ["KICAD9_3DMODEL_DIR"]);
        match target {
            Target::Repository { path, .. } => assert_eq!(path, "custom/x.step"),
            _ => panic!("expected a repository target"),
        }
    }

    #[test]
    fn an_embedded_file_matches_the_lookup_order() {
        let files = BTreeMap::from([("BSL308PE.stp".to_owned(), "model".to_owned())]);
        let stack = [EmbeddedLayer {
            document: "board.kicad_pcb",
            footprint_uuid: Some("8ea1ed23-3f8f-42ce-8c56-16f2acc6ed03"),
            files: &files,
        }];
        let resolver = Resolver {
            project_name: "demo",
            text_variables: &BTreeMap::new(),
            project_dir: &[],
            sources: &BTreeSet::new(),
        };
        let (_, target) = resolver.resolve(
            "kicad-embed://BSL308PE.stp",
            RefKind::Model3d,
            "board.kicad_pcb",
            &stack,
        );
        match target {
            Target::Embedded {
                name,
                document_path,
                footprint_uuid,
                file_type,
            } => {
                assert_eq!(name, "BSL308PE.stp");
                assert_eq!(document_path, "board.kicad_pcb");
                assert_eq!(
                    footprint_uuid.as_deref(),
                    Some("8ea1ed23-3f8f-42ce-8c56-16f2acc6ed03")
                );
                assert_eq!(file_type, "model");
            }
            _ => panic!("expected an embedded target"),
        }
    }

    #[test]
    fn only_known_shapes_are_path_references() {
        assert!(is_path_reference("${KIPRJMOD}/a.step"));
        assert!(is_path_reference("${MY_DIR}"));
        assert!(is_path_reference("${MY_PATH}"));
        assert!(!is_path_reference("${MY_VARIABLE}"));
        assert!(!is_path_reference("${JOBSET_OUTPUT_WORK_PATH}/x"));
        assert!(!is_path_reference("plain text"));
    }

    #[test]
    fn title_block_expansion_is_recursive_and_bounded() {
        let variables = variables(&[("A", "${B}"), ("B", "value")]);
        assert_eq!(tb_expand("${A}", &variables), "value");
        assert_eq!(tb_expand("${#}", &variables), "${#}");
        assert_eq!(tb_expand("plain", &variables), "plain");
    }

    #[test]
    fn normalize_drops_dots_and_cancels_dot_dot() {
        assert_eq!(normalize(&[], "a/./b/../c"), ["a", "c"]);
        assert_eq!(normalize(&["x".to_owned()], "../y"), ["y"]);
        assert_eq!(normalize(&[], "../../y"), ["..", "..", "y"]);
    }
}
