//! The `produce` run over the whole project (`project.py:443-649`).
//!
//! `Producer` walks the project file, the root schematic and every sheet it
//! reaches, the board, the project's two library tables and every drawing sheet
//! a reference resolves to, then sorts and serializes the document
//! (`project.py:631-649`). [`produce`] is the member's entry point.

use crate::{
    BoardModel, Produced, ProducerWarning, ProjectionError, ProjectionInput, Sources, document,
};
use prism_kicad_contracts::generated::prism_project_a0::ProjectA0;
use prism_kicad_core::sheet_file;
use prism_kicad_core::{Limits, Sexp, parse_with_limits};
use serde_json::{Map, Value};
use std::borrow::Cow;
use std::collections::{BTreeMap, BTreeSet, VecDeque};

use super::reference::{EmbeddedLayer, RefKind, Target};
use super::resolver::{Resolver, normalize, segments};
use super::sexpr::{
    atom, child, children, document_property, embedded_files, is_scalar_at, scalar,
    sheet_file_value, sheet_name, str_atom, uuid_of,
};
use super::text_paths::{ScanKind, Scanned, json_text_paths, sexpr_text_paths, typed_atoms};
use super::title_block::{TitleBlock, expanded_block};
use super::{NAME, SCHEMA};

/// `project.py:607-610`: the two `.kicad_pro` drawing-sheet settings.
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
    board_model: Option<&'a BoardModel<'a>>,
    /// The top-level sheets the core realized (several in a KiCad 10
    /// multi-root project); empty without a schematic model.
    top_level: Vec<String>,
    project_file: String,
    project_dir: Vec<String>,
    stem: String,
    project_name: String,
    text_variables: BTreeMap<String, String>,
    pro: Value,
    warnings: Vec<ProducerWarning>,
    documents: Vec<Value>,
    references: Vec<Value>,
    scanned: Vec<Scanned<'a>>,
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
            board_model: input.board,
            top_level: input.schematic.map_or_else(Vec::new, |model| {
                model
                    .index
                    .occurrences()
                    .filter(|occurrence| occurrence.parent_index.is_none())
                    .map(|occurrence| occurrence.source_path.clone())
                    .collect()
            }),
            project_dir: dir_segments(&project_file),
            project_name: stem.clone(),
            stem,
            project_file,
            text_variables,
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

    /// `project.py:557-582`: the board's tree. The parse stage already owns a
    /// tree for the board it read (shared through [`BoardModel::tree`]); reuse
    /// it when it is this path, otherwise parse once here. Wrapped so the error
    /// text stays the producer's own.
    fn board_tree(&self, board: &str) -> Result<Cow<'a, Sexp>, ProjectionError> {
        if let Some(model) = self.board_model
            && model.path == board
        {
            return model.tree().map(Cow::Borrowed).map_err(|error| {
                ProjectionError::new(format!("{NAME}: {board} does not parse: {error}"))
            });
        }
        self.read_sexpr(board).map(Cow::Owned)
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
            sources: self.sources,
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
        let (variables, mut target) = self.resolve_parts(raw, kind, document_path, stack);
        if kind == RefKind::SheetFile {
            target = self.sheet_case_match(target);
        }
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

    /// A sheet file that differs from a source-set schematic only in letter
    /// case is that schematic, by KiCad's sheet file rule as the core and stage
    /// parse read it ([`sheet_file::locate`], `sheet-path-case`, cli-spec
    /// §5.2.2), or the target as is.
    fn sheet_case_match(&self, target: Target) -> Target {
        let Target::Repository {
            path,
            base,
            in_sources: false,
        } = &target
        else {
            return target;
        };
        let found = sheet_file::locate(path, false, || self.sources.list("", &[".kicad_sch"]));
        match found {
            Some((actual, _)) => Target::Repository {
                path: actual,
                base: *base,
                in_sources: true,
            },
            None => target,
        }
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

    /// `project.py:521-555`: the root schematic, the other top-level sheets of a
    /// KiCad 10 multi-root project, and every sheet they reach.
    fn scan_schematics(&mut self) -> Result<(), ProjectionError> {
        let root = self.repo(&format!("{}.kicad_sch", self.stem));
        if !self.sources.exists(&root) {
            return Ok(());
        }
        let mut queue = VecDeque::from([root.clone()]);
        let mut seen = BTreeSet::from([root.clone()]);
        for top in &self.top_level {
            if seen.insert(top.clone()) {
                queue.push_back(top.clone());
            }
        }
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
                tree: Cow::Owned(tree),
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
        if !self.sources.exists(&board) {
            return Ok(());
        }
        let tree = self.board_tree(&board)?;
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
            if !self.sources.exists(&table_path) {
                continue;
            }
            let tree = self.read_sexpr(&table_path)?;
            let mut names: BTreeSet<String> = BTreeSet::new();
            for lib in children(&tree, "lib") {
                self.library_reference(&table_path, kind, lib, &mut names);
            }
            self.scanned.push(Scanned {
                path: table_path,
                tree: Cow::Owned(tree),
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
                    tree: Cow::Owned(tree),
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
                if seen.insert((entry.path.clone(), field.to_owned(), value.to_owned())) {
                    let extra = RefExtra {
                        field: Some(field),
                        ..RefExtra::default()
                    };
                    self.add_ref(
                        RefKind::TextPath,
                        entry.path.as_str(),
                        Some(value),
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
