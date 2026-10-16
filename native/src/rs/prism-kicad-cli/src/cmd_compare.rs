//! `compare` (cli-spec.md §5.6): Design Comparison's object diff of two
//! bundles' `projections/board-objects.json`.
//!
//! Checks run in the spec's order: reader and manifest checks with the member
//! inflated (exit 3, `bundle-invalid`); the same generator id in canonical form
//! (exit 7, `generator-mismatch`); the same project anchor (exit 7,
//! `anchor-mismatch`); both members present (exit 7, `member-not-found`).
//! `-o` is written atomically; stdout carries the `CliCompareResultA0` after
//! the rename.

use crate::args::Args;
use crate::inputs;
use crate::output::{Diagnostic, Severity, Stderr};
use prism_bundle::finding::Finding;
use prism_bundle::limits::compare::{anchor_directory, diff};
use prism_bundle::manifest::{self, Status};
use prism_bundle::reader::BundleReader;
use prism_bundle::zip::FileSource;
use prism_bundle::{Failure, Limits, Outcome, generator, schema};
use prism_kicad_contracts::generated::prism_compare_object_delta_a0::CompareObjectDeltaA0;
use serde_json::{Value, json};
use std::io::Write;
use std::path::{Path, PathBuf};

/// The one member `compare` reads (cli-spec.md §5.6).
const BOARD_OBJECTS: &str = "projections/board-objects.json";
/// The `-o` document's schema id.
const DELTA_SCHEMA: &str = "prism.compare.object_delta.a0";
/// The stdout document's schema id.
const RESULT_SCHEMA: &str = "prism.cli.compare_result.a0";

/// One side: an opened bundle with its member read, plus the identity the
/// result carries.
struct Side {
    reader: BundleReader<FileSource>,
    document: Option<Value>,
    anchor: String,
    generator: Vec<u8>,
    bundle_key: String,
}

/// Run `compare`; the process exit code.
pub fn run(args: &Args, stderr: &Stderr) -> Outcome<u8> {
    let limits = &args.limits;
    let base = open_side(argument(args, "base"), limits, "base")?;
    let head = open_side(argument(args, "head"), limits, "head")?;
    check_generator(&base, &head)?;
    check_anchor(&base, &head)?;
    require_member(&base, "base")?;
    require_member(&head, "head")?;
    let (Some(base_document), Some(head_document)) = (&base.document, &head.document) else {
        return Err(Failure::internal("compare lost a member it required"));
    };
    let document = diff(
        base_document,
        anchor_directory(&base.anchor),
        head_document,
        anchor_directory(&head.anchor),
    )
    .map_err(|error| Failure::internal(format!("the compare engine failed: {}", error.message)))?;

    let mut value = serde_json::to_value(&document)
        .map_err(|error| Failure::internal(format!("the delta does not serialize: {error}")))?;
    value["base"]["bundleKey"] = Value::from(base.bundle_key.clone());
    value["head"]["bundleKey"] = Value::from(head.bundle_key.clone());
    validate(DELTA_SCHEMA, &value)?;
    write_json(argument(args, "output"), &value)?;
    emit_result(&document, &base, &head, stderr)
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
    let document = match reader.member(BOARD_OBJECTS) {
        None => None,
        Some(Ok(bytes)) => Some(parse_member(&bytes, side)?),
        Some(Err(finding)) => return Err(member_invalid(finding, side)),
    };
    let generator = reader
        .manifest_read()
        .value
        .get("generator")
        .map(generator::canonical)
        .unwrap_or_default();
    let anchor = reader.manifest().config.project_file.as_str().to_owned();
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
        document,
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
    if side.document.is_some() && listed && ready {
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
fn write_json(path: &Path, document: &Value) -> Outcome<()> {
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
    let bytes = manifest::json_bytes(document);
    let temp = dir.join(format!(".{name}.prism-kicad-{}.tmp", std::process::id()));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|error| output_failed(format!("the temp file could not be created: {error}")))?;
    crate::process::register_temp_file(Some(temp.clone()));
    let written = file.write_all(&bytes).and_then(|()| file.sync_all());
    drop(file);
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

fn emit_result(
    document: &CompareObjectDeltaA0,
    base: &Side,
    head: &Side,
    stderr: &Stderr,
) -> Outcome<u8> {
    let counts = &document.counts;
    let result = json!({
        "schema": RESULT_SCHEMA,
        "base": {"bundle_key": base.bundle_key, "objects": document.base.objects.0},
        "head": {"bundle_key": head.bundle_key, "objects": document.head.objects.0},
        "counts": {
            "added": counts.added.0,
            "removed": counts.removed.0,
            "modified": counts.modified.0,
            "unchanged": counts.unchanged.0,
            "ignored": counts.ignored.0,
            "base_objects": counts.base_objects.0,
            "head_objects": counts.head_objects.0,
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
