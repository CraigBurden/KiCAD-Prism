//! The reference target and the contract enums (`project.py:160-164`,
//! `:277-303`).
//!
//! [`Target`] is where a raw reference leads before serialization; [`RefKind`]
//! names the setting or form that held it. [`EmbeddedLayer`] is one layer of the
//! `kicad-embed://` lookup order (`project.py:236`).

use serde_json::{Map, Value};
use std::collections::BTreeMap;

/// Which setting or form holds a reference (`project.py` call sites;
/// `ProjectReferenceKind`).
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum RefKind {
    SheetFile,
    FootprintLibrary,
    SymbolLibrary,
    Model3d,
    DrawingSheet,
    TextPath,
}

impl RefKind {
    /// The contract spelling (`ProjectReferenceKind`).
    pub(super) fn as_str(self) -> &'static str {
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
    pub(super) fn is_embeddable(self) -> bool {
        matches!(self, Self::Model3d | Self::DrawingSheet)
    }
}

/// Which directory a relative path was joined to (`ProjectPathBase`).
#[derive(Clone, Copy)]
pub(super) enum Base {
    ProjectVariable,
    ProjectDirectory,
    DocumentDirectory,
}

impl Base {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::ProjectVariable => "project-variable",
            Self::ProjectDirectory => "project-directory",
            Self::DocumentDirectory => "document-directory",
        }
    }
}

/// One of KiCad's library directories (`ProjectKiCadLibrary`).
#[derive(Clone, Copy)]
pub(super) enum Library {
    Model3d,
    Symbol,
    Footprint,
    Template,
    ThirdParty,
    UserTemplate,
}

impl Library {
    pub(super) fn as_str(self) -> &'static str {
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
pub(super) enum Reason {
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

/// The contract spelling of each [`Reason`], in the order its variants are
/// declared. A plain table keeps the eleven-arm mapping out of one `match`
/// (`ProjectUnresolvedReason`).
const REASON_NAMES: [&str; 11] = [
    "undefined-variable",
    "nondeterministic-variable",
    "misplaced-variable",
    "variable-loop",
    "uri",
    "home-relative",
    "alias",
    "embedded-missing",
    "outside-library-root",
    "empty-path",
    "unrepresentable-path",
];

impl Reason {
    /// The contract spelling (`ProjectUnresolvedReason`).
    pub(super) fn as_str(self) -> &'static str {
        REASON_NAMES[self as usize]
    }
}

/// Where a reference leads (`ProjectPathTarget`), before serialization.
pub(super) enum Target {
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
    pub(super) fn to_value(&self) -> Value {
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
    pub(super) fn footprint_uuid(&self) -> Option<&str> {
        match self {
            Self::Embedded { footprint_uuid, .. } => footprint_uuid.as_deref(),
            _ => None,
        }
    }
}

/// An `unresolved` target (`project.py:160-164`).
pub(super) fn unresolved(reason: Reason, variable: Option<String>) -> Target {
    Target::Unresolved { reason, variable }
}

/// One layer of the embedded-file lookup order (`project.py:236`).
pub(super) struct EmbeddedLayer<'a> {
    pub(super) document: &'a str,
    pub(super) footprint_uuid: Option<&'a str>,
    pub(super) files: &'a BTreeMap<String, String>,
}
