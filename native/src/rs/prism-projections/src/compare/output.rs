//! How a matched, added or removed object relates the two sides.

/// How a change relates the two sides.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    /// Only in `--head`.
    Added,
    /// Only in `--base`.
    Removed,
    /// In both, content differs.
    Modified,
}
