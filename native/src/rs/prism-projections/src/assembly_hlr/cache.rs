//! The HLR projection cache of cli-spec.md §5.2.4 and amendment C3 §3.1.
//!
//! One entry per (STEP bytes' SHA-256, the model pose's rotation and scale,
//! the HLR option set, the runtime version). A footprint's own translation
//! and rotation on the board are *not* in the key: they are applied to the
//! cached model-local geometry, so moving or rotating a part on the board
//! reuses its projection (the entry is transformed, not recomputed).
//!
//! The local pose's own X/Y/Z translation stays in the key because Geometer
//! rounds the projected coordinates to `round_digits` after the transform: a
//! reused entry with another model offset would land on a different grid.
//! That is the same reason Cruncher's own cache keys on `pose.signature`.
//!
//! Entries are JSON files under `--hlr-cache`, written through a temporary
//! file and `rename(2)`. A cache that cannot be read or written is ignored:
//! it never fails the stage.

use super::geometry::EdgeSet;
use sha2::Digest;
use std::path::{Path, PathBuf};

/// The key of one entry.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Key {
    /// SHA-256 of the STEP bytes.
    pub model_sha256: String,
    /// The local pose matrix, nine significant decimal places (Cruncher's
    /// `KiCadModelPose.signature`).
    pub pose_signature: Vec<u64>,
    /// The runtime's release version.
    pub runtime: String,
    /// The HLR option set token.
    pub options: String,
}

impl Key {
    /// A stable file name.
    #[must_use]
    pub fn digest(&self) -> String {
        let mut material = String::from("prism.assembly_hlr.cache.a0\u{0}");
        material.push_str(&self.model_sha256);
        material.push('\u{0}');
        for value in &self.pose_signature {
            material.push_str(&format!("{value:016x}"));
        }
        material.push('\u{0}');
        material.push_str(&self.runtime);
        material.push('\u{0}');
        material.push_str(&self.options);
        hex(&sha2::Sha256::digest(material.as_bytes()))
    }
}

fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

/// A cache directory.
pub struct Cache<'a> {
    directory: &'a Path,
}

impl<'a> Cache<'a> {
    /// A cache under `directory`.
    #[must_use]
    pub fn new(directory: &'a Path) -> Self {
        Self { directory }
    }

    /// The entry's geometry, when a readable entry exists.
    #[must_use]
    pub fn load(&self, key: &Key) -> Option<(EdgeSet, EdgeSet)> {
        let path = self.path(key);
        let bytes = std::fs::read(path).ok()?;
        serde_json::from_slice(&bytes).ok()
    }

    /// Store `outline` and `detail` for `key`, atomically and best effort.
    pub fn store(&self, key: &Key, outline: &EdgeSet, detail: &EdgeSet) {
        let Some(entry) = serde_json::to_vec(&(outline, detail)).ok() else {
            return;
        };
        if std::fs::create_dir_all(self.directory).is_err() {
            return;
        }
        let path = self.path(key);
        let temporary = temporary_path(&path);
        let Ok(mut file) = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
        else {
            return;
        };
        use std::io::Write as _;
        if file.write_all(&entry).is_err() || file.sync_all().is_err() {
            let _ = std::fs::remove_file(&temporary);
            return;
        }
        if std::fs::rename(&temporary, &path).is_err() {
            let _ = std::fs::remove_file(&temporary);
        }
    }

    fn path(&self, key: &Key) -> PathBuf {
        self.directory.join(format!("{}.json", key.digest()))
    }
}

fn temporary_path(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("entry");
    path.with_file_name(format!(
        ".{name}.{}.{}.tmp",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|value| value.subsec_nanos())
            .unwrap_or_default()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key() -> Key {
        Key {
            model_sha256: "a".repeat(64),
            pose_signature: vec![1, 2, 3],
            runtime: "2026.9.19".to_owned(),
            options: "assembly-hlr-a0".to_owned(),
        }
    }

    #[test]
    fn the_digest_is_stable_and_distinguishes_poses() {
        let one = key();
        let mut two = key();
        assert_eq!(one.digest(), two.digest());
        two.pose_signature[0] = 4;
        assert_ne!(one.digest(), two.digest());
    }

    #[test]
    fn an_entry_round_trips_and_a_missing_one_is_none() {
        let directory = std::env::temp_dir().join(format!(
            "prism-hlr-cache-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = std::fs::remove_dir_all(&directory);
        let cache = Cache::new(&directory);
        assert_eq!(cache.load(&key()), None);
        let outline = EdgeSet {
            segments: vec![[0.0, 0.0, 1.0, 0.0]],
            arcs: Vec::new(),
        };
        cache.store(&key(), &outline, &EdgeSet::default());
        let (loaded, detail) = cache.load(&key()).expect("entry");
        assert_eq!(loaded, outline);
        assert_eq!(detail, EdgeSet::default());
        let _ = std::fs::remove_dir_all(&directory);
    }
}
