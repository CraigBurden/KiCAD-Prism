//! `compare` (cli-spec.md §5.6): Design Comparison's object diff of two
//! bundles' `projections/board-objects.json`.
//!
//! Checks run in the spec's order: reader and manifest checks with the member
//! inflated (exit 3, `bundle-invalid`); the same generator id in canonical form
//! (exit 7, `generator-mismatch`); the same project anchor (exit 7,
//! `anchor-mismatch`); both members present (exit 7, `member-not-found`).
//! `-o` is written atomically and streamed (the document is never held as one
//! value); stdout carries the `CliCompareResultA0`, validated, after the
//! rename.

use crate::args::Args;
use crate::inputs;
use crate::output::{Diagnostic, Severity, Stderr};
use prism_bundle::finding::Finding;
use prism_bundle::limits::compare::{
    CompareError, Delta, Entries, anchor_directory, diff_entries, entries,
};
use prism_bundle::manifest::Status;
use prism_bundle::reader::BundleReader;
use prism_bundle::zip::FileSource;
use prism_bundle::{Failure, Limits, Outcome, generator, schema};
use serde_json::{Value, json};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

/// The one member `compare` reads (cli-spec.md §5.6).
const BOARD_OBJECTS: &str = "projections/board-objects.json";
/// The stdout document's schema id.
const RESULT_SCHEMA: &str = "prism.cli.compare_result.a0";

/// One side: an opened bundle with its member's entries, plus the identity
/// the result carries. The member's parsed JSON is dropped as soon as the
/// entries exist, so the two documents are never in memory together with the
/// diff.
struct Side {
    reader: BundleReader<FileSource>,
    entries: Option<Result<Entries, CompareError>>,
    anchor: String,
    generator: Vec<u8>,
    bundle_key: String,
}

/// Run `compare`; the process exit code.
pub fn run(args: &Args, stderr: &Stderr) -> Outcome<u8> {
    let limits = &args.limits;
    let mut base = open_side(argument(args, "base"), limits, "base")?;
    let mut head = open_side(argument(args, "head"), limits, "head")?;
    check_generator(&base, &head)?;
    check_anchor(&base, &head)?;
    require_member(&base, "base")?;
    require_member(&head, "head")?;
    let (Some(base_entries), Some(head_entries)) = (base.entries.take(), head.entries.take())
    else {
        return Err(Failure::internal("compare lost a member it required"));
    };
    let engine = |error: CompareError| {
        Failure::internal(format!("the compare engine failed: {}", error.message))
    };
    let mut delta = diff_entries(base_entries.map_err(engine)?, head_entries.map_err(engine)?);
    delta.set_bundle_keys(&base.bundle_key, &head.bundle_key);
    write_json(argument(args, "output"), &delta)?;
    emit_result(&delta, &base, &head, stderr)
}

fn argument<'a>(args: &'a Args, name: &str) -> &'a Path {
    Path::new(args.option(name).unwrap_or_default())
}

fn open_side(path: &Path, limits: &Limits, side: &'static str) -> Outcome<Side> {
    inputs::regular_file(path, side)?;
    let file = std::fs::File::open(path).map_err(|error| {
        Failure::input(
            "input-not-found",
            format!("--{side} could not be read: {error}"),
        )
        .argument(side)
    })?;
    let source = FileSource::new(file).map_err(|error| {
        Failure::input(
            "input-not-found",
            format!("--{side} could not be read: {error}"),
        )
        .argument(side)
    })?;
    let reader = BundleReader::open(source, limits).map_err(|error| error.failure(side))?;
    let generator = reader
        .manifest_read()
        .value
        .get("generator")
        .map(generator::canonical)
        .unwrap_or_default();
    let anchor = reader.manifest().config.project_file.as_str().to_owned();
    let entries = match reader.member(BOARD_OBJECTS) {
        None => None,
        Some(Ok(bytes)) => {
            let document = parse_member(&bytes, side)?;
            drop(bytes);
            Some(entries(&document, anchor_directory(&anchor)))
        }
        Some(Err(finding)) => return Err(member_invalid(finding, side)),
    };
    let bundle_key = reader
        .manifest()
        .bundle_key
        .as_ref()
        .map(|key| key.0.clone())
        .or_else(|| {
            reader
                .manifest()
                .revision_key
                .as_ref()
                .map(|key| generator::bundle_key(key.as_str(), &generator))
        })
        .unwrap_or_else(|| "0".repeat(64));
    Ok(Side {
        reader,
        entries,
        anchor,
        generator,
        bundle_key,
    })
}

fn parse_member(bytes: &[u8], side: &'static str) -> Outcome<Value> {
    serde_json::from_slice(bytes).map_err(|error| {
        Failure::input(
            "bundle-invalid",
            format!("{BOARD_OBJECTS} is not JSON: {error}"),
        )
        .argument(side)
    })
}

fn member_invalid(finding: Finding, side: &'static str) -> Failure {
    let mut failure = Failure::input(
        "bundle-invalid",
        format!("the bundle is invalid: {}", finding.message),
    )
    .argument(side);
    failure.finding.location = finding.location;
    failure
}

fn check_generator(base: &Side, head: &Side) -> Outcome<()> {
    if base.generator == head.generator {
        Ok(())
    } else {
        Err(Failure::precondition(
            "generator-mismatch",
            "--base and --head were written by different generator ids",
        ))
    }
}

fn check_anchor(base: &Side, head: &Side) -> Outcome<()> {
    // Object keys and `documentPath` are relative to the anchor's directory
    // (D1), so that directory is the comparable anchor: two projects in one
    // directory share a key space. (`rs-synthetic`/`rs-usb-pd` of the parity
    // harness are two anchors in one directory and do compare; a different
    // directory means incomparable keys.)
    if anchor_directory(&base.anchor) == anchor_directory(&head.anchor) {
        Ok(())
    } else {
        Err(Failure::precondition(
            "anchor-mismatch",
            "--base and --head are of project files in different directories",
        ))
    }
}

fn require_member(side: &Side, name: &'static str) -> Outcome<()> {
    let parse = &side.reader.manifest().stages.parse;
    let failed = parse
        .failed_members
        .iter()
        .any(|member| member.path.as_str() == BOARD_OBJECTS);
    let ready = match parse.status {
        Status::Complete => true,
        Status::Partial => !failed,
        _ => false,
    };
    let listed = side.reader.index().entry(BOARD_OBJECTS).is_some();
    if side.entries.is_some() && listed && ready {
        Ok(())
    } else {
        Err(Failure::precondition(
            "member-not-found",
            format!("--{name} has no {BOARD_OBJECTS}"),
        )
        .argument(name))
    }
}

fn validate(schema_id: &str, document: &Value) -> Outcome<()> {
    schema::validate(schema_id, document).map_err(|violation| {
        Failure::internal(format!(
            "the {schema_id} document breaks its schema: {}",
            violation.message
        ))
    })
}

fn output_failed(message: impl Into<String>) -> Failure {
    Failure::output("output-write-failed", message).argument("output")
}

/// Write `document` to `-o` atomically: a hidden exclusive temp file in the
/// same directory, fsynced, then renamed (cli-spec.md §5.2.5, without the
/// self-verify).
fn write_json(path: &Path, document: &Delta) -> Outcome<()> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| output_failed("-o does not name a file"))?;
    let dir = match path.parent() {
        Some(dir) if !dir.as_os_str().is_empty() => dir.to_path_buf(),
        _ => PathBuf::from("."),
    };
    if !dir.is_dir() {
        return Err(output_failed("-o's directory does not exist"));
    }
    let temp = dir.join(format!(".{name}.prism-kicad-{}.tmp", std::process::id()));
    let file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|error| output_failed(format!("the temp file could not be created: {error}")))?;
    crate::process::register_temp_file(Some(temp.clone()));
    // Streamed: the document is several times its inputs and is never held
    // as one value (`compare::Delta`). Compact, with one trailing LF.
    let mut writer = BufWriter::new(file);
    let written = serde_json::to_writer(&mut writer, document)
        .map_err(std::io::Error::other)
        .and_then(|()| writer.write_all(b"\n"))
        .and_then(|()| writer.into_inner().map_err(|error| error.into_error()))
        .and_then(|file| file.sync_all());
    if let Err(error) = written {
        cleanup(&temp);
        return Err(output_failed(format!(
            "the delta could not be written: {error}"
        )));
    }
    if let Err(error) = std::fs::rename(&temp, path) {
        cleanup(&temp);
        return Err(output_failed(format!(
            "the delta could not be renamed into place: {error}"
        )));
    }
    crate::process::register_temp_file(None);
    if let Ok(directory) = std::fs::File::open(&dir) {
        let _ = directory.sync_all();
    }
    Ok(())
}

fn cleanup(temp: &Path) {
    let _ = std::fs::remove_file(temp);
    crate::process::register_temp_file(None);
}

fn emit_result(delta: &Delta, base: &Side, head: &Side, stderr: &Stderr) -> Outcome<u8> {
    let counts = delta.counts();
    let (base_objects, head_objects) = delta.objects();
    let result = json!({
        "schema": RESULT_SCHEMA,
        "base": {"bundle_key": base.bundle_key, "objects": base_objects},
        "head": {"bundle_key": head.bundle_key, "objects": head_objects},
        "counts": {
            "added": counts["added"],
            "removed": counts["removed"],
            "modified": counts["modified"],
            "unchanged": counts["unchanged"],
            "ignored": counts["ignored"],
            "base_objects": counts["baseObjects"],
            "head_objects": counts["headObjects"],
        },
    });
    validate(RESULT_SCHEMA, &result)?;
    if crate::output::stdout(&result) {
        Ok(0)
    } else {
        stderr.emit(&Diagnostic {
            severity: Severity::Error,
            code: "stdout-write-failed",
            message: "stdout could not be written",
            stage: None,
            argument: None,
            location: None,
            limit: None,
        });
        Ok(6)
    }
}
