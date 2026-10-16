//! The source set under `--source-root` (cli-spec.md §5.2.2, "Source
//! selection").
//!
//! The tree is walked without following links; a link or special file under
//! the root is `source-not-regular-file`. Files are selected by the revision
//! key's name rules ([`category_for_name`]), outside the effective config's
//! `excluded_dirs`; `.git` is never walked, as git never lists it. The
//! selected set is checked against the path rules (`source-path-invalid`),
//! for collisions under NFC and case folding (`source-path-collision`) and
//! against the source limits (exit 4) before any file is read.
//!
//! Reading goes through [`SourceTree::read`], which records every file read:
//! the bundle's `sources/` are exactly those files (bundle-format.md §2.2).

use crate::finding::{Failure, Outcome};
use crate::limits::{LimitName, Limits};
use crate::paths::{PathProblem, check_path, first_collision};
use crate::revision_key::{Category, category_for_name};
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

/// One selected file.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceInfo {
    /// Size from the directory walk.
    pub size: u64,
    /// The owner-execute bit.
    pub executable: bool,
    /// The name rule it matched.
    pub category: Category,
}

/// The selected files under one source root, and the ones read so far.
pub struct SourceTree {
    root: PathBuf,
    files: BTreeMap<String, SourceInfo>,
    read: RefCell<BTreeMap<String, Vec<u8>>>,
    failure: RefCell<Option<Failure>>,
    max_file_bytes: u64,
}

fn link_failure(relative: &[u8]) -> Failure {
    let text = String::from_utf8_lossy(relative);
    let failure = Failure::input(
        "source-not-regular-file",
        format!(
            "sources/{text} is a symbolic link or special file; only regular files are bundled"
        ),
    )
    .argument("source-root");
    if check_path(&text, usize::MAX).is_ok() {
        failure.at_path(format!("sources/{text}"))
    } else {
        failure
    }
}

fn walk_failure(error: &std::io::Error) -> Failure {
    Failure::input(
        "input-not-found",
        format!("the source root could not be listed: {error}"),
    )
    .argument("source-root")
}

struct Walk<'a> {
    excluded: &'a [String],
    found: Vec<(Vec<u8>, std::fs::Metadata, Category)>,
}

impl Walk<'_> {
    fn directory(&mut self, dir: &Path, prefix: &[u8]) -> Outcome<()> {
        let mut entries: Vec<std::fs::DirEntry> = std::fs::read_dir(dir)
            .map_err(|error| walk_failure(&error))?
            .collect::<Result<_, _>>()
            .map_err(|error| walk_failure(&error))?;
        entries.sort_by_key(std::fs::DirEntry::file_name);
        for entry in entries {
            let name = entry.file_name();
            let name = name.as_bytes();
            if name == b".git" {
                continue;
            }
            let mut relative = prefix.to_vec();
            if !relative.is_empty() {
                relative.push(b'/');
            }
            relative.extend_from_slice(name);
            if self
                .excluded
                .iter()
                .any(|excluded| excluded.as_bytes() == relative.as_slice())
            {
                continue;
            }
            let metadata =
                std::fs::symlink_metadata(entry.path()).map_err(|error| walk_failure(&error))?;
            let kind = metadata.file_type();
            if kind.is_dir() {
                self.directory(&entry.path(), &relative)?;
            } else if kind.is_file() {
                if let Some(category) = category_for_name(name, false) {
                    self.found.push((relative, metadata, category));
                }
            } else {
                return Err(link_failure(&relative));
            }
        }
        Ok(())
    }
}

fn path_failure(path: &[u8], problem: Option<PathProblem>, limits: &Limits) -> Failure {
    let text = String::from_utf8_lossy(path);
    match problem {
        Some(PathProblem::TooLong) => limits.exceeded(
            LimitName::MaxPathBytes,
            Some(u64::try_from(path.len()).unwrap_or(u64::MAX)),
            &format!("the length of source path {text:?}"),
        ),
        Some(problem) => Failure::input(
            "source-path-invalid",
            format!("source path {text:?} {}", problem.describe()),
        )
        .argument("source-root"),
        None => Failure::input(
            "source-path-invalid",
            format!("source path {text:?} is not valid UTF-8"),
        )
        .argument("source-root"),
    }
}

impl SourceTree {
    /// Walk `root` and select its source set.
    pub fn scan(root: &Path, excluded: &[String], limits: &Limits) -> Outcome<Self> {
        let mut walk = Walk {
            excluded,
            found: Vec::new(),
        };
        walk.directory(root, b"")?;
        let max_path = limits.get_usize(LimitName::MaxPathBytes);
        let mut files = BTreeMap::new();
        let mut total = 0u64;
        for (relative, metadata, category) in walk.found {
            let text = std::str::from_utf8(&relative)
                .map_err(|_| path_failure(&relative, None, limits))?;
            check_path(text, max_path)
                .map_err(|problem| path_failure(&relative, Some(problem), limits))?;
            limits
                .check(
                    LimitName::MaxSourceFileBytes,
                    metadata.len(),
                    &format!("sources/{text}"),
                )
                .map_err(|failure| failure.at_path(format!("sources/{text}")))?;
            total = total.saturating_add(metadata.len());
            let executable = metadata.permissions().mode() & 0o100 != 0;
            files.insert(
                text.to_owned(),
                SourceInfo {
                    size: metadata.len(),
                    executable,
                    category,
                },
            );
        }
        let count = u64::try_from(files.len()).unwrap_or(u64::MAX);
        limits.check(
            LimitName::MaxSourceFiles,
            count,
            "the number of selected source files",
        )?;
        limits.check(
            LimitName::MaxTotalSourceBytes,
            total,
            "the size of the selected sources",
        )?;
        if let Some((first, second)) = first_collision(files.keys().map(String::as_str)) {
            return Err(Failure::input(
                "source-path-collision",
                format!("sources/{first} and sources/{second} are equal after NFC normalization and case folding"),
            )
            .argument("source-root")
            .at_path(format!("sources/{second}")));
        }
        Ok(Self {
            root: root.to_path_buf(),
            files,
            read: RefCell::new(BTreeMap::new()),
            failure: RefCell::new(None),
            max_file_bytes: limits.get(LimitName::MaxSourceFileBytes),
        })
    }

    /// Whether `path` is in the source set.
    #[must_use]
    pub fn contains(&self, path: &str) -> bool {
        self.files.contains_key(path)
    }

    /// The selected file at `path`.
    #[must_use]
    pub fn info(&self, path: &str) -> Option<&SourceInfo> {
        self.files.get(path)
    }

    /// Every selected path, in code point order.
    pub fn selected(&self) -> impl Iterator<Item = (&String, &SourceInfo)> {
        self.files.iter()
    }

    /// Read `path`, recording it as a member. `None` when it is not in the
    /// source set.
    pub fn read(&self, path: &str) -> Outcome<Option<Vec<u8>>> {
        if let Some(bytes) = self.read.borrow().get(path) {
            return Ok(Some(bytes.clone()));
        }
        if !self.files.contains_key(path) {
            return Ok(None);
        }
        let host = self.root.join(path);
        let metadata =
            std::fs::symlink_metadata(&host).map_err(|error| read_failure(path, &error))?;
        if !metadata.file_type().is_file() {
            return Err(link_failure(path.as_bytes()));
        }
        if metadata.len() > self.max_file_bytes {
            return Err(Failure::limit(
                LimitName::MaxSourceFileBytes,
                self.max_file_bytes,
                Some(metadata.len()),
                format!(
                    "sources/{path} is {} bytes, over max-source-file-bytes {}",
                    metadata.len(),
                    self.max_file_bytes
                ),
            )
            .at_path(format!("sources/{path}")));
        }
        let bytes = std::fs::read(&host).map_err(|error| read_failure(path, &error))?;
        self.read
            .borrow_mut()
            .insert(path.to_owned(), bytes.clone());
        Ok(Some(bytes))
    }

    /// Every file read so far, by path.
    #[must_use]
    pub fn read_files(&self) -> BTreeMap<String, Vec<u8>> {
        self.read.borrow().clone()
    }

    /// The first failure a projection's read hit, if any.
    pub fn take_failure(&self) -> Option<Failure> {
        self.failure.borrow_mut().take()
    }
}

fn read_failure(path: &str, error: &std::io::Error) -> Failure {
    Failure::input(
        "input-not-found",
        format!("sources/{path} could not be read: {error}"),
    )
    .argument("source-root")
    .at_path(format!("sources/{path}"))
}

impl prism_projections::Sources for SourceTree {
    fn paths(&self) -> Vec<String> {
        self.files.keys().cloned().collect()
    }

    fn read(&self, path: &str) -> Option<Vec<u8>> {
        match SourceTree::read(self, path) {
            Ok(bytes) => bytes,
            Err(failure) => {
                self.failure.borrow_mut().get_or_insert(failure);
                None
            }
        }
    }
}
