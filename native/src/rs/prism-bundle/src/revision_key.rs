//! The pure layer of the design revision key (`prism.revision_key.a1`,
//! revision-key.md §4–§8): effective-config validation and canonical bytes,
//! selection of the source set from a listing, and the hashing preimage.
//!
//! It reads no file and runs no program. `prism-kicad revision-key` feeds it a
//! `git ls-tree` (or working-tree) listing; `bundle build --stage parse` feeds
//! it the files under the source root, by the same name rules.

use crate::generator::{hex, sha256_hex};
use crate::paths::{PathProblem, file_name, has_path_form, is_within};
use prism_kicad_contracts::generated::prism_revision_key_record_a1 as rk;
use sha2::{Digest, Sha256};

/// The effective configuration, as the revision-key contract generates it.
pub type EffectiveConfig = rk::RevisionKeyEffectiveConfigA1;

/// The effective-config schema id.
pub const CONFIG_SCHEMA: &str = "prism.revision_key.effective_config.a1";
/// The record schema id.
pub const RECORD_SCHEMA: &str = "prism.revision_key.record.a1";
/// The key's domain.
pub const KEY_DOMAIN: &str = "prism.revision_key.a1";

const AUTOSAVE_PREFIXES: [&str; 4] = ["_autosave-", "_autosave_", "~autosave-", "~autosave_"];
const MODEL_SUFFIXES: [&str; 15] = [
    ".step", ".stp", ".stpz", ".stepz", ".step.gz", ".stp.gz", ".wrl", ".wrz", ".vrml", ".x3d",
    ".igs", ".iges", ".idf", ".emn", ".wings",
];

/// Why a computation failed (revision-key.md §11). `project-absent` is an
/// outcome, not an error: see [`Selection::ProjectAbsent`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KeyError {
    /// `config-invalid`, `config-path-missing`, `unrepresentable-path`,
    /// `unsupported-entry` or `invalid-listing`.
    pub code: &'static str,
    /// What was wrong; never a host path.
    pub message: String,
}

fn key_error(code: &'static str, message: impl Into<String>) -> KeyError {
    KeyError {
        code,
        message: message.into(),
    }
}

fn invalid(message: impl Into<String>) -> KeyError {
    key_error("config-invalid", message)
}

fn ends_with_ascii_ci(path: &str, suffix: &str) -> bool {
    let name = file_name(path).as_bytes();
    name.len() >= suffix.len()
        && name[name.len() - suffix.len()..].eq_ignore_ascii_case(suffix.as_bytes())
}

/// A `RepoPath` is the `ArchivePath` character rule only: the control
/// character and length rules of bundle-format.md §5 apply to archive
/// members, not to the key (vector `hash-escaping`).
fn check_repo_path(field: &str, path: &str) -> Result<(), KeyError> {
    if has_path_form(path) {
        Ok(())
    } else {
        Err(invalid(format!(
            "{field} {path:?} {}",
            PathProblem::Form.describe()
        )))
    }
}

/// Validate an effective configuration (revision-key.md §4.1).
pub fn validate_config(config: &EffectiveConfig) -> Result<(), KeyError> {
    if config.schema != CONFIG_SCHEMA {
        return Err(invalid(format!("schema must be {CONFIG_SCHEMA}")));
    }
    let files = config_files(config);
    for (field, path, suffix) in files {
        if let Some(path) = path {
            check_config_file(field, path, suffix)?;
        }
    }
    for (index, dir) in config.excluded_dirs.iter().enumerate() {
        check_repo_path("excluded_dirs", dir)?;
        if index > 0 {
            check_excluded_order(&config.excluded_dirs[index - 1].0, dir)?;
        }
        check_excluded_files(dir, &files)?;
    }
    if config.zone_fills == Some(rk::RevisionKeyZoneFills::Refill) {
        return Err(invalid(
            "zone_fills is spelled only as \"saved\"; refill is its absence",
        ));
    }
    Ok(())
}

type ConfigFile<'a> = (&'static str, Option<&'a String>, &'static str);

fn config_files(config: &EffectiveConfig) -> [ConfigFile<'_>; 3] {
    [
        ("project_file", Some(&config.project_file.0), ".kicad_pro"),
        (
            "root_schematic",
            config.root_schematic.as_ref().map(|path| &path.0),
            ".kicad_sch",
        ),
        (
            "board",
            config.board.as_ref().map(|path| &path.0),
            ".kicad_pcb",
        ),
    ]
}

fn check_config_file(field: &str, path: &str, suffix: &str) -> Result<(), KeyError> {
    check_repo_path(field, path)?;
    if ends_with_ascii_ci(path, suffix) {
        Ok(())
    } else {
        Err(invalid(format!(
            "{field} {path:?} does not end in {suffix}"
        )))
    }
}

fn check_excluded_order(previous: &str, dir: &str) -> Result<(), KeyError> {
    if previous.as_bytes() >= dir.as_bytes() {
        return Err(invalid(
            "excluded_dirs is not strictly increasing in UTF-8 byte order",
        ));
    }
    if is_within(dir, previous) {
        return Err(invalid(format!(
            "excluded_dirs {dir:?} lies under {previous:?}"
        )));
    }
    Ok(())
}

fn check_excluded_files(dir: &str, files: &[ConfigFile<'_>]) -> Result<(), KeyError> {
    let contained = files
        .iter()
        .find(|(_, path, _)| path.is_some_and(|path| is_within(path, dir)));
    match contained {
        Some((field, _, _)) => Err(invalid(format!(
            "excluded_dirs {dir:?} contains the {field}"
        ))),
        None => Ok(()),
    }
}

/// Parse and validate a config document (any formatting).
pub fn parse_config(bytes: &[u8]) -> Result<EffectiveConfig, KeyError> {
    let config: EffectiveConfig = serde_json::from_slice(bytes)
        .map_err(|error| invalid(format!("not a valid effective configuration: {error}")))?;
    let value: serde_json::Value = serde_json::from_slice(bytes)
        .map_err(|error| invalid(format!("not valid JSON: {error}")))?;
    crate::schema::validate(CONFIG_SCHEMA, &value)
        .map_err(|violation| invalid(violation.message))?;
    validate_config(&config)?;
    Ok(config)
}

/// The canonical config bytes (revision-key.md §4.2): compact JSON in
/// declaration order, which is `serde_json`'s struct order.
#[must_use]
pub fn canonical_config(config: &EffectiveConfig) -> Vec<u8> {
    serde_json::to_vec(config).unwrap_or_default()
}

/// `config_digest`.
#[must_use]
pub fn config_digest(config: &EffectiveConfig) -> String {
    sha256_hex(&canonical_config(config))
}

/// A source category (`RevisionKeySourceCategory`).
pub type Category = rk::RevisionKeySourceCategory;
/// An entry kind (`RevisionKeyEntryKind`).
pub type Kind = rk::RevisionKeyEntryKind;

/// The category the name rules give a non-gitlink entry named `name`
/// (revision-key.md §5.2), or `None` when it is not selected.
#[must_use]
pub fn category_for_name(name: &[u8], is_symlink: bool) -> Option<Category> {
    let lowered = String::from_utf8_lossy(&name.to_ascii_lowercase()).into_owned();
    if AUTOSAVE_PREFIXES
        .iter()
        .any(|prefix| lowered.starts_with(prefix))
    {
        return None;
    }
    NAME_RULES
        .iter()
        .find(|(rule, _)| rule.matches(&lowered))
        .map(|(_, category)| *category)
        .or_else(|| is_symlink.then_some(Category::Symlink))
}

/// How a name rule of revision-key.md §5.2 matches a lowered name.
enum NameRule {
    Equals(&'static [&'static str]),
    EndsWith(&'static [&'static str]),
}

impl NameRule {
    fn matches(&self, lowered: &str) -> bool {
        match self {
            Self::Equals(names) => names.contains(&lowered),
            Self::EndsWith(suffixes) => suffixes.iter().any(|suffix| lowered.ends_with(suffix)),
        }
    }
}

/// Rules N1, N2, S1–S8 and M, in order.
const NAME_RULES: [(NameRule, Category); 11] = [
    (
        NameRule::Equals(&["fp-lib-table", "sym-lib-table"]),
        Category::LibraryTable,
    ),
    (NameRule::Equals(&[".prism.json"]), Category::PrismSettings),
    (NameRule::EndsWith(&[".kicad_pro"]), Category::KicadProject),
    (
        NameRule::EndsWith(&[".kicad_sch"]),
        Category::KicadSchematic,
    ),
    (NameRule::EndsWith(&[".kicad_pcb"]), Category::KicadBoard),
    (
        NameRule::EndsWith(&[".kicad_dru"]),
        Category::KicadDesignRules,
    ),
    (
        NameRule::EndsWith(&[".kicad_wks"]),
        Category::KicadWorksheet,
    ),
    (
        NameRule::EndsWith(&[".kicad_jobset"]),
        Category::KicadJobset,
    ),
    (
        NameRule::EndsWith(&[".kicad_sym", ".lib", ".dcm"]),
        Category::SymbolLibrary,
    ),
    (NameRule::EndsWith(&[".kicad_mod"]), Category::Footprint),
    (NameRule::EndsWith(&MODEL_SUFFIXES), Category::Model3d),
];

/// One listing record: `<mode> <type> <id>\t<path>` (revision-key.md §3).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ListingRecord {
    /// Six octal digits.
    pub mode: String,
    /// `blob` or `commit`.
    pub kind: String,
    /// Lowercase hex object id.
    pub object_id: String,
    /// Raw path bytes.
    pub path: Vec<u8>,
}

/// A selected entry.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    /// UTF-8 repository path.
    pub path: String,
    /// Kind from mode and type.
    pub kind: Kind,
    /// Object id.
    pub object_id: String,
    /// Category; not hashed.
    pub category: Category,
}

impl Entry {
    /// The git mode and type of the entry.
    #[must_use]
    pub fn mode_and_type(&self) -> (&'static str, &'static str) {
        match self.kind {
            Kind::Regular => ("100644", "blob"),
            Kind::Executable => ("100755", "blob"),
            Kind::Symlink => ("120000", "blob"),
            Kind::Gitlink => ("160000", "commit"),
        }
    }
}

/// The object format of a repository.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ObjectFormat {
    /// 40-hex ids.
    Sha1,
    /// 64-hex ids.
    Sha256,
}

impl ObjectFormat {
    /// `sha1` or `sha256`.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Sha1 => "sha1",
            Self::Sha256 => "sha256",
        }
    }

    /// The format spelled `name`.
    #[must_use]
    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "sha1" => Some(Self::Sha1),
            "sha256" => Some(Self::Sha256),
            _ => None,
        }
    }

    fn id_length(self) -> usize {
        match self {
            Self::Sha1 => 40,
            Self::Sha256 => 64,
        }
    }

    /// The blob id git gives `bytes` without filters.
    #[must_use]
    pub fn blob_id(self, bytes: &[u8]) -> String {
        let header = format!("blob {}\0", bytes.len());
        match self {
            Self::Sha1 => {
                let mut hasher = sha1_smol::Sha1::new();
                hasher.update(header.as_bytes());
                hasher.update(bytes);
                hasher.digest().to_string()
            }
            Self::Sha256 => {
                let mut hasher = Sha256::new();
                hasher.update(header.as_bytes());
                hasher.update(bytes);
                hex(&hasher.finalize())
            }
        }
    }
}

/// The result of selection.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Selection {
    /// The source set, sorted by path bytes.
    Selected(Vec<Entry>),
    /// The anchor is not a project file of the listing (exit 10).
    ProjectAbsent,
}

fn kind_of(mode: &str, kind: &str) -> Option<Kind> {
    match (mode, kind) {
        ("100644", "blob") => Some(Kind::Regular),
        ("100755", "blob") => Some(Kind::Executable),
        ("120000", "blob") => Some(Kind::Symlink),
        ("160000", "commit") => Some(Kind::Gitlink),
        _ => None,
    }
}

fn select_record(
    record: &ListingRecord,
    excluded: &[&[u8]],
    format: ObjectFormat,
) -> Result<Option<Entry>, KeyError> {
    let id_ok = record.object_id.len() == format.id_length()
        && record
            .object_id
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte));
    if !id_ok {
        return Err(key_error(
            "invalid-listing",
            "an object id has the wrong format",
        ));
    }
    let kind = kind_of(&record.mode, &record.kind).ok_or_else(|| {
        key_error(
            "unsupported-entry",
            format!(
                "mode {} type {} is not a supported entry",
                record.mode, record.kind
            ),
        )
    })?;
    let path = record.path.as_slice();
    if excluded
        .iter()
        .any(|dir| path == *dir || (path.starts_with(dir) && path.get(dir.len()) == Some(&b'/')))
    {
        return Ok(None);
    }
    let name = path.rsplit(|byte| *byte == b'/').next().unwrap_or(path);
    let category = if kind == Kind::Gitlink {
        Category::Gitlink
    } else {
        match category_for_name(name, kind == Kind::Symlink) {
            Some(category) => category,
            None => return Ok(None),
        }
    };
    let text = std::str::from_utf8(path)
        .ok()
        .filter(|text| has_path_form(text))
        .ok_or_else(|| {
            key_error(
                "unrepresentable-path",
                format!(
                    "the selected path {:?} is not a valid repository path",
                    String::from_utf8_lossy(path)
                ),
            )
        })?;
    Ok(Some(Entry {
        path: text.to_owned(),
        kind,
        object_id: record.object_id.clone(),
        category,
    }))
}

/// Select the source set of `listing` under `config` (revision-key.md §5.3).
pub fn select(
    listing: &[ListingRecord],
    config: &EffectiveConfig,
    format: ObjectFormat,
) -> Result<Selection, KeyError> {
    validate_config(config)?;
    let excluded: Vec<&[u8]> = config
        .excluded_dirs
        .iter()
        .map(|dir| dir.as_bytes())
        .collect();
    let mut seen = std::collections::BTreeSet::new();
    let mut selected = Vec::new();
    for record in listing {
        if !seen.insert(record.path.as_slice()) {
            return Err(key_error("invalid-listing", "the listing repeats a path"));
        }
        if let Some(entry) = select_record(record, &excluded, format)? {
            selected.push(entry);
        }
    }
    selected.sort_by(|a, b| a.path.as_bytes().cmp(b.path.as_bytes()));
    let blob = |path: &str| {
        selected
            .binary_search_by(|entry| entry.path.as_bytes().cmp(path.as_bytes()))
            .ok()
            .is_some_and(|at| selected[at].kind != Kind::Gitlink)
    };
    if !blob(&config.project_file) {
        return Ok(Selection::ProjectAbsent);
    }
    for (field, path) in [
        ("root_schematic", &config.root_schematic),
        ("board", &config.board),
    ] {
        if let Some(path) = path
            && !blob(path)
        {
            return Err(key_error(
                "config-path-missing",
                format!("{field} {:?} is not a selected file of the listing", path.0),
            ));
        }
    }
    Ok(Selection::Selected(selected))
}

/// The default config of revision-key.md §4.3 for `project_file`, given the
/// selected non-gitlink paths.
#[must_use]
pub fn default_config(
    project_file: &str,
    is_selected_file: impl Fn(&str) -> bool,
) -> EffectiveConfig {
    let dir = crate::paths::parent(project_file);
    let name = file_name(project_file);
    let stem = &name[..name.len().saturating_sub(".kicad_pro".len())];
    let sibling = |suffix: &str| {
        let path = crate::paths::join(dir, &format!("{stem}{suffix}"));
        is_selected_file(&path).then_some(rk::RepoPath(path))
    };
    EffectiveConfig {
        schema: CONFIG_SCHEMA.to_owned(),
        project_file: rk::RepoPath(project_file.to_owned()),
        root_schematic: sibling(".kicad_sch"),
        board: sibling(".kicad_pcb"),
        excluded_dirs: Vec::new(),
        zone_fills: None,
    }
}

/// The hashing preimage of revision-key.md §8.
#[must_use]
pub fn preimage(format: ObjectFormat, config: &EffectiveConfig, entries: &[Entry]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(KEY_DOMAIN.as_bytes());
    out.push(0);
    out.extend_from_slice(format!("object-format {}", format.as_str()).as_bytes());
    out.push(0);
    out.extend_from_slice(b"config ");
    out.extend_from_slice(&canonical_config(config));
    out.push(0);
    out.extend_from_slice(format!("entries {}", entries.len()).as_bytes());
    out.push(0);
    let mut sorted: Vec<&Entry> = entries.iter().collect();
    sorted.sort_by(|a, b| a.path.as_bytes().cmp(b.path.as_bytes()));
    for entry in sorted {
        let (mode, kind) = entry.mode_and_type();
        out.extend_from_slice(format!("{mode} {kind} {}\t", entry.object_id).as_bytes());
        out.extend_from_slice(entry.path.as_bytes());
        out.push(0);
    }
    out
}

/// The revision key of a selection.
#[must_use]
pub fn revision_key(format: ObjectFormat, config: &EffectiveConfig, entries: &[Entry]) -> String {
    sha256_hex(&preimage(format, config, entries))
}

fn counts(entries: &[Entry]) -> rk::RevisionKeyCounts {
    let count = |category: Category| {
        rk::Count(
            u64::try_from(
                entries
                    .iter()
                    .filter(|entry| entry.category == category)
                    .count(),
            )
            .unwrap_or(0),
        )
    };
    rk::RevisionKeyCounts {
        kicad_project: count(Category::KicadProject),
        kicad_schematic: count(Category::KicadSchematic),
        kicad_board: count(Category::KicadBoard),
        kicad_design_rules: count(Category::KicadDesignRules),
        kicad_worksheet: count(Category::KicadWorksheet),
        kicad_jobset: count(Category::KicadJobset),
        library_table: count(Category::LibraryTable),
        symbol_library: count(Category::SymbolLibrary),
        footprint: count(Category::Footprint),
        model_3d: count(Category::Model3d),
        prism_settings: count(Category::PrismSettings),
        symlink: count(Category::Symlink),
        gitlink: count(Category::Gitlink),
        total: rk::Count(u64::try_from(entries.len()).unwrap_or(0)),
    }
}

/// Where a key came from.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum KeySource {
    /// A commit, by its full id.
    Commit(String),
    /// The working tree.
    Worktree,
}

/// A record warning (`lfs-filter-unavailable`).
pub type RecordWarning = (String, String);

/// Build the `RevisionKeyRecordA1` of a selection.
pub fn record(
    format: ObjectFormat,
    source: &KeySource,
    config: &EffectiveConfig,
    entries: &[Entry],
    warnings: &[RecordWarning],
) -> Result<rk::RevisionKeyRecordA1, KeyError> {
    let mut sorted = entries.to_vec();
    sorted.sort_by(|a, b| a.path.as_bytes().cmp(b.path.as_bytes()));
    let mut warnings: Vec<RecordWarning> = warnings.to_vec();
    warnings.sort();
    warnings.dedup();
    let document = serde_json::json!({
        "schema": RECORD_SCHEMA,
        "revision_key": revision_key(format, config, &sorted),
        "object_format": format.as_str(),
        "source": match source {
            KeySource::Commit(commit) => serde_json::json!({"kind": "commit", "commit": commit}),
            KeySource::Worktree => serde_json::json!({"kind": "worktree"}),
        },
        "config": config,
        "config_digest": config_digest(config),
        "entries": sorted.iter().map(|entry| serde_json::json!({
            "path": entry.path,
            "kind": entry.kind,
            "object_id": entry.object_id,
            "category": entry.category,
        })).collect::<Vec<_>>(),
        "counts": counts(&sorted),
        "warnings": warnings.iter().map(|(code, message)| serde_json::json!({
            "code": code, "message": message,
        })).collect::<Vec<_>>(),
    });
    serde_json::from_value(document).map_err(|error| {
        key_error(
            "invalid-listing",
            format!("record does not encode: {error}"),
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blob_ids_match_git() {
        // `printf 'hello\n' | git hash-object --stdin`
        assert_eq!(
            ObjectFormat::Sha1.blob_id(b"hello\n"),
            "ce013625030ba8dba906f756967f9e9ca394464a"
        );
        assert_eq!(
            ObjectFormat::Sha1.blob_id(b""),
            "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"
        );
        let big = vec![b'x'; 1000];
        assert_eq!(ObjectFormat::Sha1.blob_id(&big).len(), 40);
    }

    #[test]
    fn name_rules() {
        assert_eq!(
            category_for_name(b"Board.KICAD_PCB", false),
            Some(Category::KicadBoard)
        );
        assert_eq!(category_for_name(b"_autosave-x.kicad_sch", false), None);
        assert_eq!(category_for_name(b"m.STEP", false), Some(Category::Model3d));
        assert_eq!(
            category_for_name(b"a.step.gz", false),
            Some(Category::Model3d)
        );
        assert_eq!(category_for_name(b"README.md", false), None);
        assert_eq!(category_for_name(b"link", true), Some(Category::Symlink));
        assert_eq!(
            category_for_name(b"fp-lib-table", false),
            Some(Category::LibraryTable)
        );
    }
}
