//! Reading the files arguments name (cli-spec.md §2.2, §4 exit 3): a missing
//! path is `input-not-found`, a directory, link or special file is
//! `input-not-regular-file`, a file over its size limit is exit 4. No message
//! names the host path; the argument is named instead.

use prism_bundle::reader::json_bounds;
use prism_bundle::revision_key::{self, EffectiveConfig};
use prism_bundle::{Failure, LimitName, Limits, Outcome};
use prism_kicad_contracts::generated::prism_revision_key_record_a1::RevisionKeyRecordA1;
use std::path::Path;

/// Check that `path` is a regular file and return its size.
pub fn regular_file(path: &Path, argument: &'static str) -> Outcome<u64> {
    match std::fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_file() => Ok(metadata.len()),
        Ok(_) => Err(Failure::input(
            "input-not-regular-file",
            format!("--{argument} is not a regular file"),
        )
        .argument(argument)),
        Err(_) => Err(
            Failure::input("input-not-found", format!("--{argument} does not exist"))
                .argument(argument),
        ),
    }
}

/// Read the file `argument` names, bounded by `limit`.
pub fn read(
    path: &Path,
    argument: &'static str,
    limit: LimitName,
    limits: &Limits,
) -> Outcome<Vec<u8>> {
    let size = regular_file(path, argument)?;
    limits
        .check(limit, size, &format!("the --{argument} file"))
        .map_err(|failure| failure.argument(argument))?;
    std::fs::read(path).map_err(|error| {
        Failure::input(
            "input-not-found",
            format!("--{argument} could not be read: {error}"),
        )
        .argument(argument)
    })
}

/// Read and validate `--config`.
pub fn config(path: &Path, limits: &Limits) -> Outcome<EffectiveConfig> {
    let bytes = read(path, "config", LimitName::MaxConfigBytes, limits)?;
    json_bounds(&bytes, limits, true, "--config").map_err(|failure| {
        let mut failure = failure.argument("config");
        failure.finding.location = None;
        failure
    })?;
    revision_key::parse_config(&bytes)
        .map_err(|error| Failure::input("config-invalid", error.message).argument("config"))
}

/// Read and validate `--key-record`.
pub fn key_record(path: &Path, limits: &Limits) -> Outcome<RevisionKeyRecordA1> {
    let bytes = read(path, "key-record", LimitName::MaxMemberBytes, limits)?;
    let invalid =
        |message: String| Failure::input("key-record-invalid", message).argument("key-record");
    json_bounds(&bytes, limits, false, "--key-record").map_err(|failure| {
        let mut failure = failure.argument("key-record");
        failure.finding.location = None;
        failure
    })?;
    let value: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|error| invalid(format!("--key-record is not JSON: {error}")))?;
    prism_bundle::schema::validate(revision_key::RECORD_SCHEMA, &value).map_err(|violation| {
        invalid(format!(
            "--key-record is not a revision-key record: {}",
            violation.message
        ))
    })?;
    let record: RevisionKeyRecordA1 = serde_json::from_value(value)
        .map_err(|error| invalid(format!("--key-record does not decode: {error}")))?;
    revision_key::validate_config(&record.config).map_err(|error| invalid(error.message))?;
    Ok(record)
}
