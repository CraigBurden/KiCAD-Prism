//! STEP model resolution of `_resolve_model_step_bytes`
//! (`kicad_cruncher_cmd_pcb_svg.py:1776-1901`), restricted to the sources a
//! bundle has: `sources/` (repository and `${KIPRJMOD}` paths), the KiCad
//! stock libraries a caller names with `--model-dir VAR=dir`, and
//! `kicad-embed://` from the board's or the footprint's embedded files.
//!
//! Variable expansion follows Python's `os.path.expandvars` and Cruncher's
//! extra `${NAME}` rule, so a reference resolves exactly where today's
//! Cruncher resolves it.

use crate::Sources;
use prism_kicad_core::pcb::{
    PcbEmbeddedDataPresence, PcbEmbeddedFile, PcbEmbeddedFileOwner, PcbView,
};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// `os.path.expandvars` does not touch `$(NAME)`; only these characters form
/// a bare `$NAME`.
const EMBED_PREFIX: &str = "kicad-embed://";
const PRJ: &str = "\u{0}PRJ\u{0}";
const HOST: &str = "\u{0}HOST\u{0}";

/// Where a footprint's model bytes come from.
pub struct ModelSource<'a> {
    /// The board's parsed view, for embedded files and footprint scope.
    pub view: &'a PcbView<'a>,
    /// The model's owning footprint index.
    pub footprint_index: usize,
    /// The repository path of the board's directory (empty at the root).
    pub board_dir: &'a str,
    /// The repository path of the project file's directory, `${KIPRJMOD}`.
    pub project_dir: &'a str,
    /// The source set stage parse recorded.
    pub sources: &'a dyn Sources,
    /// `--model-dir VAR=dir`.
    pub model_dirs: &'a BTreeMap<String, PathBuf>,
}

/// The bytes of `reference`, or `None` when they cannot be resolved.
#[must_use]
pub fn step_bytes(source: &ModelSource<'_>, reference: &str) -> Option<Arc<[u8]>> {
    if let Some(name) = reference.strip_prefix(EMBED_PREFIX) {
        return embedded_bytes(source, name).map(Arc::from);
    }
    match expand(
        reference,
        source.project_dir,
        source.board_dir,
        source.model_dirs,
    ) {
        Expanded::Sources(path) => source.sources.read(&path),
        Expanded::Host(path) => read_host(&path).map(Arc::from),
        Expanded::Missing => None,
    }
}

/// Where an expanded reference points.
enum Expanded {
    /// A path under the source root, read through [`Sources`].
    Sources(String),
    /// A file under a `--model-dir`.
    Host(PathBuf),
    /// An absolute path no input covers, or a path that leaves the root.
    Missing,
}

/// Expand `raw` the way Cruncher does, then classify it.
fn expand(
    raw: &str,
    project_dir: &str,
    board_dir: &str,
    model_dirs: &BTreeMap<String, PathBuf>,
) -> Expanded {
    let mut text = raw.to_owned();
    let mut host: Option<PathBuf> = None;
    let mut cursor = 0;
    while let Some(at) = text[cursor..].find('$').map(|at| cursor + at) {
        match variable_at(&text, at) {
            Some((name, end)) => {
                if let Some(replacement) = substitute(name, model_dirs, &mut host) {
                    text.replace_range(at..end, &replacement);
                    cursor = at + replacement.len();
                } else {
                    cursor = end;
                }
            }
            None => cursor = at + 1,
        }
    }
    // Cruncher's `expanded.startswith("${")` rule: an undefined leading
    // variable becomes the empty string, so the rest decides the path.
    if let Some(rest) = text.strip_prefix("${")
        && let Some((name, after)) = rest.split_once('}')
    {
        let replacement = substitute(name, model_dirs, &mut host).unwrap_or_default();
        text = format!("{replacement}{after}");
    }
    if let Some(rest) = text.strip_prefix(PRJ) {
        return join(project_dir, rest);
    }
    if let Some(rest) = text.strip_prefix(HOST) {
        return match host {
            Some(base) => Expanded::Host(base.join(rest.trim_start_matches('/'))),
            None => Expanded::Missing,
        };
    }
    if text.starts_with('/') {
        return Expanded::Missing;
    }
    join(board_dir, &text)
}

/// `$NAME` or `${NAME}` at `at`; `None` for a lone `$`. Python's
/// `expandvars` has no `$(NAME)` form, so Cruncher does not expand that
/// spelling either.
fn variable_at(text: &str, at: usize) -> Option<(&str, usize)> {
    let bytes = text.as_bytes();
    let cursor = at + 1;
    match *bytes.get(cursor)? {
        b'(' => None,
        b'{' => {
            let start = cursor + 1;
            let mut end = start;
            while bytes
                .get(end)
                .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
            {
                end += 1;
            }
            if end == start || bytes.get(end) != Some(&b'}') {
                return None;
            }
            Some((&text[start..end], end + 1))
        }
        _ => {
            let start = cursor;
            let mut end = start;
            while bytes
                .get(end)
                .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
            {
                end += 1;
            }
            if end == start {
                return None;
            }
            Some((&text[start..end], end))
        }
    }
}

/// One variable's replacement, or `None` when the variable is undefined.
fn substitute(
    name: &str,
    model_dirs: &BTreeMap<String, PathBuf>,
    host: &mut Option<PathBuf>,
) -> Option<String> {
    if name == "KIPRJMOD" {
        return Some(PRJ.to_owned());
    }
    let directory = model_dirs
        .get(name)
        .or_else(|| stock_fallback(name, model_dirs))?;
    *host = Some(directory.clone());
    Some(HOST.to_owned())
}

/// The KiCad major of a `KICAD<major>_3DMODEL_DIR` name.
fn stock_major(name: &str) -> Option<u32> {
    name.strip_prefix("KICAD")?
        .strip_suffix("_3DMODEL_DIR")?
        .parse()
        .ok()
}

/// A `KICAD<major>_3DMODEL_DIR` that no `--model-dir` names resolves through
/// the newest stock library given, as kicad_monkey's model search does
/// (`kicad_library_extraction.py`, the "highest-install fallback") and as
/// KiCad does for a project saved by an older major: a KiCad 9 board's
/// `${KICAD9_3DMODEL_DIR}` parts come from KiCad 10's library.
fn stock_fallback<'a>(
    name: &str,
    model_dirs: &'a BTreeMap<String, PathBuf>,
) -> Option<&'a PathBuf> {
    stock_major(name)?;
    model_dirs
        .iter()
        .filter_map(|(variable, directory)| stock_major(variable).map(|major| (major, directory)))
        .max_by_key(|(major, _)| *major)
        .map(|(_, directory)| directory)
}

/// Join `rest` to repository base `base`, normalized; `Missing` when it
/// leaves the root.
fn join(base: &str, rest: &str) -> Expanded {
    let mut stack: Vec<&str> = Vec::new();
    for segment in base.split('/').chain(rest.split('/')) {
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            if stack.pop().is_none() {
                return Expanded::Missing;
            }
            continue;
        }
        stack.push(segment);
    }
    if stack.is_empty() {
        return Expanded::Missing;
    }
    Expanded::Sources(stack.join("/"))
}

/// `_resolve_model_step_bytes`: footprint-owned embedded files shadow the
/// board's (`_find_embedded_file`, `kicad_cruncher_cmd_pcb_svg.py:1840-1848`).
fn embedded_bytes(source: &ModelSource<'_>, name: &str) -> Option<Vec<u8>> {
    let wanted = name.to_ascii_lowercase();
    // Cruncher only finds a declaration with a payload: a footprint entry
    // that carries just a checksum defers to the board's copy.
    let files: Vec<PcbEmbeddedFile> = source
        .view
        .all_embedded_files()
        .filter_map(Result::ok)
        .filter(|file| file.data_presence == PcbEmbeddedDataPresence::Encoded)
        .collect();
    let footprint = files.iter().find(|file| {
        matches!(
            file.owner,
            PcbEmbeddedFileOwner::EmbeddedFootprint { footprint_index }
                if footprint_index == source.footprint_index
        ) && file.name.to_ascii_lowercase() == wanted
    });
    let found = footprint.or_else(|| {
        files.iter().find(|file| {
            file.owner == PcbEmbeddedFileOwner::Board && file.name.to_ascii_lowercase() == wanted
        })
    })?;
    source
        .view
        .decode_embedded_file(
            found,
            prism_kicad_core::pcb::PcbEmbeddedDecodeLimits::default(),
        )
        .ok()
        .flatten()
}

fn read_host(path: &Path) -> Option<Vec<u8>> {
    let maximum = 512 * 1024 * 1024;
    let metadata = std::fs::metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > maximum {
        return None;
    }
    std::fs::read(path).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dirs() -> BTreeMap<String, PathBuf> {
        BTreeMap::from([("KICAD10_3DMODEL_DIR".to_owned(), PathBuf::from("/models"))])
    }

    fn at(raw: &str, project_dir: &str) -> Expanded {
        expand(raw, project_dir, "", &dirs())
    }

    #[test]
    fn a_repository_path_is_relative_to_the_board() {
        match at("packages3D/x.step", "") {
            Expanded::Sources(path) => assert_eq!(path, "packages3D/x.step"),
            _ => panic!("expected a source path"),
        }
    }

    #[test]
    fn kiprjmod_is_repository_relative() {
        match at("${KIPRJMOD}/packages3D/x.step", "boards/usb") {
            Expanded::Sources(path) => assert_eq!(path, "boards/usb/packages3D/x.step"),
            _ => panic!("expected a source path"),
        }
    }

    #[test]
    fn a_directory_variable_is_a_host_path() {
        match at("${KICAD10_3DMODEL_DIR}/R.3dshapes/R.step", "") {
            Expanded::Host(path) => assert_eq!(path, PathBuf::from("/models/R.3dshapes/R.step")),
            _ => panic!("expected a host path"),
        }
    }

    #[test]
    fn an_older_stock_library_resolves_through_the_newest_given() {
        match at("${KICAD9_3DMODEL_DIR}/R.3dshapes/R.step", "") {
            Expanded::Host(path) => assert_eq!(path, PathBuf::from("/models/R.3dshapes/R.step")),
            _ => panic!("expected a host path"),
        }
        let both = BTreeMap::from([
            ("KICAD9_3DMODEL_DIR".to_owned(), PathBuf::from("/nine")),
            ("KICAD10_3DMODEL_DIR".to_owned(), PathBuf::from("/ten")),
        ]);
        match expand("${KICAD9_3DMODEL_DIR}/R.step", "", "", &both) {
            Expanded::Host(path) => assert_eq!(path, PathBuf::from("/nine/R.step")),
            _ => panic!("an explicitly given library wins"),
        }
        match expand("${KICAD8_3DMODEL_DIR}/R.step", "", "", &both) {
            Expanded::Host(path) => assert_eq!(path, PathBuf::from("/ten/R.step")),
            _ => panic!("the newest library is the fallback"),
        }
    }

    #[test]
    fn an_undefined_leading_variable_is_absolute_and_unavailable() {
        assert!(matches!(at("${HOME}/x.step", ""), Expanded::Missing));
    }

    #[test]
    fn the_parenthesised_form_is_not_a_variable() {
        match at("$(KIPRJMOD)/x.step", "") {
            Expanded::Sources(path) => assert_eq!(path, "$(KIPRJMOD)/x.step"),
            _ => panic!("expected a source path"),
        }
    }

    #[test]
    fn a_path_that_leaves_the_root_is_missing() {
        assert!(matches!(at("../x.step", ""), Expanded::Missing));
    }
}
