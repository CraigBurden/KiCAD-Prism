//! Archive and repository paths (bundle-format.md §5, conventions.md §8).
//!
//! `ArchivePath` and `RepoPath` share one character rule: `/`-separated,
//! relative, no empty, `.` or `..` segment, no `\` or `:`. On top of it every
//! writer and reader requires valid UTF-8 without C0 controls or U+007F, at
//! most `max-path-bytes` in all and 255 bytes per segment, and uniqueness
//! after NFC normalization and Unicode simple case folding.

use unicode_casefold::{Locale, UnicodeCaseFold, Variant};
use unicode_normalization::UnicodeNormalization;

/// The largest segment, `NAME_MAX` of Linux and macOS file systems.
pub const MAX_SEGMENT_BYTES: usize = 255;

/// Why a path is not a valid archive or repository path.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PathProblem {
    /// It breaks the `ArchivePath` character rule.
    Form,
    /// It holds a C0 control character or U+007F.
    Control,
    /// It is longer than `max-path-bytes`.
    TooLong,
    /// A segment is longer than 255 bytes.
    SegmentTooLong,
}

impl PathProblem {
    /// A short explanation.
    #[must_use]
    pub fn describe(self) -> &'static str {
        match self {
            Self::Form => {
                "is not a relative /-separated path without empty, '.' or '..' segments, '\\' or ':'"
            }
            Self::Control => "holds a control character",
            Self::TooLong => "is longer than max-path-bytes",
            Self::SegmentTooLong => "has a segment longer than 255 bytes",
        }
    }
}

/// Whether `path` follows the `ArchivePath`/`RepoPath` character rule only.
#[must_use]
pub fn has_path_form(path: &str) -> bool {
    !path.is_empty()
        && !path.contains(['\\', ':'])
        && path
            .split('/')
            .all(|segment| !segment.is_empty() && segment != "." && segment != "..")
}

/// Check every rule of bundle-format.md §5 except uniqueness.
pub fn check_path(path: &str, max_path_bytes: usize) -> Result<(), PathProblem> {
    if path
        .chars()
        .any(|ch| u32::from(ch) < 0x20 || u32::from(ch) == 0x7F)
    {
        return Err(PathProblem::Control);
    }
    if !has_path_form(path) {
        return Err(PathProblem::Form);
    }
    if path.len() > max_path_bytes {
        return Err(PathProblem::TooLong);
    }
    if path
        .split('/')
        .any(|segment| segment.len() > MAX_SEGMENT_BYTES)
    {
        return Err(PathProblem::SegmentTooLong);
    }
    Ok(())
}

/// The key two paths collide on: NFC, then simple case folding, then NFC.
#[must_use]
pub fn collision_key(path: &str) -> String {
    let composed: String = path.nfc().collect();
    let folded: String = composed
        .chars()
        .case_fold_with(Variant::Simple, Locale::NonTurkic)
        .collect();
    folded.nfc().collect()
}

/// The first pair of paths in `paths` that collide, by `collision_key`.
#[must_use]
pub fn first_collision<'a>(paths: impl IntoIterator<Item = &'a str>) -> Option<(&'a str, &'a str)> {
    let mut seen = std::collections::BTreeMap::new();
    for path in paths {
        if let Some(previous) = seen.insert(collision_key(path), path) {
            return Some((previous, path));
        }
    }
    None
}

/// The last segment of `path`.
#[must_use]
pub fn file_name(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

/// The directory of `path`, `""` at the root.
#[must_use]
pub fn parent(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(dir, _)| dir)
}

/// `dir` joined with `name`, with `""` as the root.
#[must_use]
pub fn join(dir: &str, name: &str) -> String {
    if dir.is_empty() {
        name.to_owned()
    } else {
        format!("{dir}/{name}")
    }
}

/// Whether `path` is `dir` or lies below it.
#[must_use]
pub fn is_within(path: &str, dir: &str) -> bool {
    path == dir
        || path
            .strip_prefix(dir)
            .is_some_and(|rest| rest.starts_with('/'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_character_rule_matches_check_member_name() {
        for good in [
            "a",
            "a/b",
            "...",
            ".x/..y",
            "sources/Café Board/x.kicad_sch",
        ] {
            assert_eq!(check_path(good, 4096), Ok(()), "{good}");
        }
        for bad in [
            "", "/a", "a/", "a//b", ".", "..", "a/../b", "a\\b", "c:x", "./a",
        ] {
            assert_eq!(check_path(bad, 4096), Err(PathProblem::Form), "{bad}");
        }
        assert_eq!(check_path("a\u{7f}", 4096), Err(PathProblem::Control));
        assert_eq!(check_path("a\tb", 4096), Err(PathProblem::Control));
        assert_eq!(check_path("abcd", 3), Err(PathProblem::TooLong));
        let long = "x".repeat(256);
        assert_eq!(check_path(&long, 4096), Err(PathProblem::SegmentTooLong));
    }

    #[test]
    fn collisions_fold_case_and_normalization() {
        assert_eq!(
            collision_key("Board.KICAD_PCB"),
            collision_key("board.kicad_pcb")
        );
        assert_eq!(collision_key("Cafe\u{301}"), collision_key("Caf\u{e9}"));
        assert_eq!(
            first_collision(["a/B.txt", "c", "a/b.TXT"]),
            Some(("a/B.txt", "a/b.TXT"))
        );
        assert_eq!(first_collision(["a", "b"]), None);
    }

    #[test]
    fn path_helpers() {
        assert_eq!(file_name("a/b/c.kicad_pcb"), "c.kicad_pcb");
        assert_eq!(parent("a/b/c"), "a/b");
        assert_eq!(parent("c"), "");
        assert_eq!(join("", "x"), "x");
        assert!(is_within("out/x", "out") && !is_within("outer/x", "out"));
    }
}
