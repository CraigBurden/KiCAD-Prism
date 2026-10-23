//! Findings, locations and the failures that are never recorded in a bundle
//! (cli-spec.md §4, §5.2.7, §8).
//!
//! A [`Finding`] is a code, a message and an optional location: the shape of
//! `CliFinding`. A [`Failure`] is a finding with the exit category it maps to
//! (usage, input, resource limit, timeout, output I/O, precondition,
//! internal). Content outcomes of the design (exit 9) are not failures: they
//! are recorded in the manifest's stage records instead.
//!
//! Messages never hold a host path: files are named by their bundle member
//! path (`sources/<RepoPath>`, `refilled/<name>`, a member path) and
//! arguments by their `CliArgument` name.

use crate::limits::LimitName;
use std::fmt;

/// Where a finding is (`CliLocation`). Every field is optional.
#[derive(Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
pub struct Location {
    /// The file, named by its bundle member path.
    pub path: Option<String>,
    /// One-based line.
    pub line: Option<u64>,
    /// One-based column in Unicode scalar values.
    pub column: Option<u64>,
    /// Zero-based byte offset.
    pub offset: Option<u64>,
    /// RFC 6901 JSON Pointer.
    pub pointer: Option<String>,
    /// UUID of the KiCad object.
    pub uuid: Option<String>,
}

impl Location {
    /// A location naming only a member path.
    #[must_use]
    pub fn path(path: impl Into<String>) -> Self {
        Self {
            path: Some(path.into()),
            ..Self::default()
        }
    }

    /// A location naming a member path and a JSON pointer.
    #[must_use]
    pub fn pointer(path: Option<String>, pointer: impl Into<String>) -> Self {
        Self {
            path,
            pointer: Some(pointer.into()),
            ..Self::default()
        }
    }

    /// A text position (line, column, byte offset) in `path`.
    #[must_use]
    pub fn text(path: impl Into<String>, line: u64, column: u64, offset: u64) -> Self {
        Self {
            path: Some(path.into()),
            line: Some(line.max(1)),
            column: Some(column.max(1)),
            offset: Some(offset),
            ..Self::default()
        }
    }

    /// The position of byte `offset` in `text` (one-based line and column,
    /// columns counted in Unicode scalar values).
    #[must_use]
    pub fn at_offset(path: impl Into<String>, text: &[u8], offset: usize) -> Self {
        let offset = offset.min(text.len());
        let before = &text[..offset];
        let line = before.iter().filter(|&&byte| byte == b'\n').count() + 1;
        let line_start = before
            .iter()
            .rposition(|&byte| byte == b'\n')
            .map_or(0, |at| at + 1);
        let column = String::from_utf8_lossy(&before[line_start..])
            .chars()
            .count()
            + 1;
        Self::text(path, wide(line), wide(column), wide(offset))
    }
}

fn wide(value: usize) -> u64 {
    u64::try_from(value).unwrap_or(u64::MAX)
}

/// A finding with a stable code (cli-spec.md §8), a message for people and an
/// optional location: `CliFinding`.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Finding {
    /// Stable kebab-case code.
    pub code: String,
    /// One-sentence explanation; never a host path, never empty.
    pub message: String,
    /// Where it is.
    pub location: Option<Location>,
}

impl Finding {
    /// A finding without a location.
    #[must_use]
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        let message = message.into();
        Self {
            code: code.to_owned(),
            message: if message.is_empty() {
                code.to_owned()
            } else {
                message
            },
            location: None,
        }
    }

    /// The same finding at `location`.
    #[must_use]
    pub fn at(mut self, location: Location) -> Self {
        self.location = Some(location);
        self
    }

    /// The same finding at member `path`.
    #[must_use]
    pub fn at_path(self, path: impl Into<String>) -> Self {
        self.at(Location::path(path))
    }

    /// The member path of the location, if any.
    #[must_use]
    pub fn path(&self) -> Option<&str> {
        self.location.as_ref().and_then(|at| at.path.as_deref())
    }
}

impl fmt::Display for Finding {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

/// Why a command failed; each category has one exit code (cli-spec.md §4).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Category {
    /// Exit 1: a defect.
    Internal,
    /// Exit 2: bad arguments.
    Usage,
    /// Exit 3: an input file cannot be used.
    Input,
    /// Exit 4: a resource limit was exceeded.
    ResourceLimit,
    /// Exit 5: `timeout-ms` elapsed.
    Timeout,
    /// Exit 6: an output could not be written.
    OutputIo,
    /// Exit 7: the inputs do not fit together.
    Precondition,
}

impl Category {
    /// The process exit code.
    #[must_use]
    pub fn exit_code(self) -> u8 {
        match self {
            Self::Internal => 1,
            Self::Usage => 2,
            Self::Input => 3,
            Self::ResourceLimit => 4,
            Self::Timeout => 5,
            Self::OutputIo => 6,
            Self::Precondition => 7,
        }
    }

    /// `CliErrorCategory` spelling.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Internal => "internal",
            Self::Usage => "usage",
            Self::Input => "input",
            Self::ResourceLimit => "resource-limit",
            Self::Timeout => "timeout",
            Self::OutputIo => "output-io",
            Self::Precondition => "precondition",
        }
    }
}

/// The limit a resource-limit or timeout failure hit (`CliLimitHit`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LimitHit {
    /// Which limit.
    pub name: LimitName,
    /// Its value for this invocation.
    pub limit: u64,
    /// The deterministic observed size or count, when known up front.
    pub observed: Option<u64>,
}

/// A failure that leaves `-o` unchanged and is never recorded in a bundle.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Failure {
    /// Exit category.
    pub category: Category,
    /// Code, message and location.
    pub finding: Finding,
    /// The `CliArgument` the failure is about.
    pub argument: Option<&'static str>,
    /// The limit hit, for `resource-limit` and `timeout`.
    pub limit: Option<LimitHit>,
}

impl Failure {
    /// A failure of `category`.
    #[must_use]
    pub fn new(category: Category, code: &str, message: impl Into<String>) -> Self {
        Self {
            category,
            finding: Finding::new(code, message),
            argument: None,
            limit: None,
        }
    }

    /// Exit 1.
    #[must_use]
    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(Category::Internal, "internal-error", message)
    }

    /// Exit 2, code `usage` unless given.
    #[must_use]
    pub fn usage(code: &str, message: impl Into<String>) -> Self {
        Self::new(Category::Usage, code, message)
    }

    /// Exit 3.
    #[must_use]
    pub fn input(code: &str, message: impl Into<String>) -> Self {
        Self::new(Category::Input, code, message)
    }

    /// Exit 6.
    #[must_use]
    pub fn output(code: &str, message: impl Into<String>) -> Self {
        Self::new(Category::OutputIo, code, message)
    }

    /// Exit 7.
    #[must_use]
    pub fn precondition(code: &str, message: impl Into<String>) -> Self {
        Self::new(Category::Precondition, code, message)
    }

    /// Exit 4, `limit-exceeded`, for `name` at `limit`.
    #[must_use]
    pub fn limit(name: LimitName, limit: u64, observed: Option<u64>, message: String) -> Self {
        let mut failure = Self::new(Category::ResourceLimit, "limit-exceeded", message);
        failure.limit = Some(LimitHit {
            name,
            limit,
            observed,
        });
        failure
    }

    /// The same failure about argument `argument`.
    #[must_use]
    pub fn argument(mut self, argument: &'static str) -> Self {
        self.argument = Some(argument);
        self
    }

    /// The same failure at `location`.
    #[must_use]
    pub fn at(mut self, location: Location) -> Self {
        self.finding.location = Some(location);
        self
    }

    /// The same failure at member path `path`.
    #[must_use]
    pub fn at_path(self, path: impl Into<String>) -> Self {
        self.at(Location::path(path))
    }
}

impl fmt::Display for Failure {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{} ({})", self.finding, self.category.as_str())
    }
}

impl std::error::Error for Failure {}

/// Result of every fallible bundle operation.
pub type Outcome<T> = Result<T, Failure>;
