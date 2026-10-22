//! Opening a design bundle and reading the members a prototype needs.
//!
//! The archive itself is `prism-bundle`'s: this module only selects the board
//! text (`refilled/<stem>.kicad_pcb` when present, else `sources/<path>`),
//! decodes members and turns every failure into one message a hand-run
//! prototype can print. Nothing here writes.

use std::fmt;
use std::fs::File;
use std::path::Path;

use prism_bundle::manifest::Manifest;
use prism_bundle::zip::FileSource;
use prism_bundle::{BundleReader, Limits, Work};
use serde::de::DeserializeOwned;

/// A prototype failure, with the message a person needs to fix the input.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LabError {
    /// What went wrong, without a host path when the failure came from a
    /// member check.
    pub message: String,
}

impl LabError {
    /// A failure with `message`.
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl fmt::Display for LabError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for LabError {}

/// One opened bundle, read-only.
pub struct Bundle {
    reader: BundleReader<FileSource>,
}

impl Bundle {
    /// Open `path` and validate its container, manifest and member listing.
    pub fn open(path: &Path) -> Result<Self, LabError> {
        let file = File::open(path).map_err(|error| {
            LabError::new(format!("{} could not be read: {error}", path.display()))
        })?;
        let source = FileSource::new(file).map_err(|error| {
            LabError::new(format!("{} could not be read: {error}", path.display()))
        })?;
        let limits = Limits::defaults(Work::Verify);
        let reader = BundleReader::open(source, &limits).map_err(|error| {
            LabError::new(format!(
                "{} is not a design bundle: {}",
                path.display(),
                error.failure("--in")
            ))
        })?;
        Ok(Self { reader })
    }

    /// The manifest (`bundle.json`).
    pub fn manifest(&self) -> &Manifest {
        self.reader.manifest()
    }

    /// The board's repository path, as the manifest's configuration names it.
    pub fn board_file(&self) -> Result<String, LabError> {
        self.manifest()
            .config
            .board
            .as_ref()
            .map(|board| board.0.clone())
            .ok_or_else(|| LabError::new("the bundle records no board file"))
    }

    /// The board's file name without its extension (`cynthion`).
    pub fn board_name(&self) -> Result<String, LabError> {
        let board = self.board_file()?;
        Path::new(&board)
            .file_stem()
            .and_then(|stem| stem.to_str())
            .map(str::to_owned)
            .ok_or_else(|| LabError::new(format!("the board path {board:?} has no file name")))
    }

    /// The board text: the refilled board when the board stage wrote one,
    /// else the source member.
    pub fn board_text(&self) -> Result<String, LabError> {
        let board = self.board_file()?;
        let name = Path::new(&board)
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| LabError::new(format!("the board path {board:?} has no file name")))?;
        let bytes = match self.member(&format!("refilled/{name}"))? {
            Some(bytes) => bytes,
            None => self.member(&format!("sources/{board}"))?.ok_or_else(|| {
                LabError::new("the bundle has neither a refilled board nor a source board")
            })?,
        };
        String::from_utf8(bytes)
            .map_err(|error| LabError::new(format!("the board file is not UTF-8: {error}")))
    }

    /// The checked bytes of member `path`, or `None` when it is absent.
    pub fn member(&self, path: &str) -> Result<Option<Vec<u8>>, LabError> {
        match self.reader.member(path) {
            None => Ok(None),
            Some(Ok(bytes)) => Ok(Some(bytes)),
            Some(Err(finding)) => Err(LabError::new(format!("{path} is invalid: {finding}"))),
        }
    }

    /// A JSON member decoded into its contract, or `None` when absent.
    pub fn json<T: DeserializeOwned>(&self, path: &str) -> Result<Option<T>, LabError> {
        let Some(bytes) = self.member(path)? else {
            return Ok(None);
        };
        serde_json::from_slice(&bytes)
            .map(Some)
            .map_err(|error| LabError::new(format!("{path} does not decode: {error}")))
    }

    /// A JSON member a prototype cannot work without.
    pub fn required_json<T: DeserializeOwned>(&self, path: &str) -> Result<T, LabError> {
        self.json(path)?
            .ok_or_else(|| LabError::new(format!("the bundle has no {path}")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_file_reports_the_path() {
        let error = match Bundle::open(Path::new("/nonexistent/board.prism")) {
            Ok(_) => panic!("the file does not exist"),
            Err(error) => error,
        };
        assert!(error.message.contains("/nonexistent/board.prism"));
    }
}
