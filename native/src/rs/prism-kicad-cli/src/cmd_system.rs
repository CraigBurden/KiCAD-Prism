//! `system build` (`docs/system-builder/CONTRACTS.md` §8.8): the system
//! bundle of a `prism.system.v2` document over its board occurrences'
//! design bundles, as `prism.system_bundle.a0`.
//!
//! Checks run in the contract's order: the document validates against its
//! schema (exit 3, `document-invalid`); each member passes the reader and
//! manifest checks (exit 3, `bundle-invalid`, the member's occurrence in the
//! message because `CliArgument` cannot spell `member:<occurrence>`);
//! every `--member` and `--absent` names a board occurrence (exit 7,
//! `occurrence-mismatch`); the members share one generator id (exit 7,
//! `generator-mismatch`); each member's stage `parse` holds the two
//! projections the build reads (exit 7, `member-not-found`); from 1c,
//! `--board-sub-ports` and each `--entry` validate against their schemas
//! (exit 3, `input-invalid`) and each `--entry` names an entry occurrence
//! (exit 7, `occurrence-mismatch`).
//!
//! The bundle is validated before the atomic rename; stdout carries the
//! `CliSystemResultA0` after it. The same inputs give byte-identical output.

use crate::args::{Args, SystemMemberArg};
use crate::inputs;
use crate::output::{Diagnostic, Severity, Stderr};
use crate::version;
use prism_bundle::manifest::{Manifest, Status};
use prism_bundle::reader::BundleReader;
use prism_bundle::zip::FileSource;
use prism_bundle::{Failure, LimitName, Limits, Outcome, generator, schema};
use prism_system::build;
use prism_system::entry;
use prism_system::input;
use prism_system::output::SystemBundle;
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

/// The document's schema id.
const SYSTEM_SCHEMA: &str = "prism.system.v2";
/// The system bundle's schema id.
const BUNDLE_SCHEMA: &str = "prism.system_bundle.a0";
/// The stdout document's schema id.
const RESULT_SCHEMA: &str = "prism.cli.system_result.a0";
/// The board-level sub-ports input (`CONTRACTS.md` §10.5).
const BOARD_SUB_PORTS_SCHEMA: &str = "prism.board_sub_ports.a0";
/// The published-entry payload input (`CONTRACTS.md` §12.2).
const ENTRY_SCHEMA: &str = "prism.system_entry.a0";
/// The projections a system build reads (`CONTRACTS.md` §8.1).
const INTERFACE: &str = "projections/system-interface.json";
/// The board's semantic facts.
const SEMANTIC: &str = "projections/semantic-index.json";

/// One opened member bundle.
struct Member {
    revision_key: String,
    reader: BundleReader<FileSource>,
}

/// A validated `--entry` payload read as a board.
struct LoadedEntry {
    board: input::Board,
    facts: input::EntryFacts,
    payload_sha256: String,
}

/// One entry in the system bundle key.
#[derive(serde::Serialize)]
struct EntryKey {
    payload: String,
    stage: String,
}

/// A failure about one member, so its message can name the occurrence.
struct MemberFailure {
    failure: Failure,
    occurrence: String,
}

/// Run `system build`; the process exit code.
pub fn run(args: &Args, stderr: &Stderr) -> Outcome<u8> {
    let (document, document_sha256) = read_document(args)?;
    let members = match open_members(args) {
        Ok(members) => members,
        Err(error) => return Ok(report_member(error, stderr)),
    };
    check_occurrences(&document, &members, &args.system_absent)?;
    let generator_bytes = match shared_generator(&members)? {
        Some(generator) => generator,
        None => version::generator()?.bytes,
    };
    let mut boards = match build_boards(&members, &generator_bytes) {
        Ok(boards) => boards,
        Err(error) => return Ok(report_member(error, stderr)),
    };
    // Check 6 (`CONTRACTS.md` §8.8): the 1c inputs validate first, then each
    // `--entry` names an entry occurrence.
    let board_sub_ports = read_board_sub_ports(args)?;
    let entries = read_entries(args, &document)?;
    let entry_keys: BTreeMap<String, EntryKey> = entries
        .iter()
        .map(|(occurrence, loaded)| {
            (
                occurrence.clone(),
                EntryKey {
                    payload: loaded.payload_sha256.clone(),
                    stage: loaded.facts.stage.clone(),
                },
            )
        })
        .collect();
    let entry_facts: BTreeMap<String, input::EntryFacts> = entries
        .into_iter()
        .map(|(occurrence, loaded)| {
            boards.insert(occurrence.clone(), loaded.board);
            (occurrence, loaded.facts)
        })
        .collect();
    let inputs = input::Members {
        boards,
        absent: args.system_absent.clone(),
        entries: entry_facts,
        board_sub_ports,
    };
    let bundle = build::build(&document, &inputs, document_sha256.clone());
    validate_bundle(&bundle)?;
    write_json(
        Path::new(args.option("output").unwrap_or_default()),
        &bundle,
    )?;
    let key = system_bundle_key(
        &document,
        &document_sha256,
        &generator_bytes,
        &inputs,
        &entry_keys,
    );
    emit_result(&key, &document_sha256, &bundle, stderr)
}

// ------------------------------------------------------------------ document

fn document_invalid(message: String) -> Failure {
    // `CliArgument` has no `document` value: the message names the option.
    Failure::input("document-invalid", format!("--document: {message}"))
}

/// Read, validate and canonicalize `--document`.
fn read_document(args: &Args) -> Outcome<(input::Document, String)> {
    let path = Path::new(args.option("document").unwrap_or_default());
    let bytes = inputs::read(path, "document", LimitName::MaxMemberBytes, &args.limits).map_err(
        |mut failure| {
            // `CliArgument` has no `document` value; the message names it.
            failure.argument = None;
            failure
        },
    )?;
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|error| document_invalid(format!("--document is not JSON: {error}")))?;
    schema::validate(SYSTEM_SCHEMA, &value).map_err(|violation| {
        document_invalid(format!(
            "--document breaks {SYSTEM_SCHEMA}: {}",
            violation.message
        ))
    })?;
    // Layout is presentation only (CONTRACTS §8.1): the digest leaves it out,
    // so moving a symbol or a pin reuses the system bundle.
    let mut hashed = value.clone();
    if let Some(object) = hashed.as_object_mut() {
        object.remove("layout");
    }
    let sha256 = generator::sha256_hex(&canonical_json(&hashed));
    let document: input::Document = serde_json::from_value(value).map_err(|error| {
        document_invalid(format!("--document does not fit its contract: {error}"))
    })?;
    Ok((document, sha256))
}

// ------------------------------------------------------------------- members

fn open_member(spec: &SystemMemberArg, limits: &Limits) -> Outcome<BundleReader<FileSource>> {
    let path = Path::new(&spec.bundle);
    inputs::regular_file(path, "member")?;
    let unreadable = |error: std::io::Error| {
        Failure::input(
            "input-not-found",
            format!("--member could not be read: {error}"),
        )
        .argument("member")
    };
    let file = std::fs::File::open(path).map_err(unreadable)?;
    let source = FileSource::new(file).map_err(unreadable)?;
    BundleReader::open(source, limits).map_err(|error| error.failure("member"))
}

fn open_members(args: &Args) -> Result<BTreeMap<String, Member>, MemberFailure> {
    let mut members = BTreeMap::new();
    for (occurrence, spec) in &args.system_members {
        let reader = open_member(spec, &args.limits).map_err(|failure| MemberFailure {
            failure,
            occurrence: occurrence.clone(),
        })?;
        members.insert(
            occurrence.clone(),
            Member {
                revision_key: spec.revision_key.clone(),
                reader,
            },
        );
    }
    Ok(members)
}

/// Each `--member` and `--absent` names a board occurrence of the document.
fn check_occurrences(
    document: &input::Document,
    members: &BTreeMap<String, Member>,
    absent: &BTreeSet<String>,
) -> Outcome<()> {
    let is_board = |id: &str| {
        document
            .occurrences
            .iter()
            .any(|occurrence| occurrence.id == id && occurrence.source.kind == "board")
    };
    for (occurrence, option) in members
        .keys()
        .map(|key| (key, "member"))
        .chain(absent.iter().map(|key| (key, "absent")))
    {
        if !is_board(occurrence) {
            let failure = Failure::precondition(
                "occurrence-mismatch",
                format!(
                    "--{option} names {occurrence}, which is not a board occurrence of --document"
                ),
            );
            // `CliArgument` knows `member`; `absent` has no value there.
            return Err(if option == "member" {
                failure.argument("member")
            } else {
                failure
            });
        }
    }
    Ok(())
}

// ------------------------------------------------------------------- 1c inputs

/// Whether `occurrence` places a published entry.
fn is_entry(document: &input::Document, occurrence: &str) -> bool {
    document
        .occurrences
        .iter()
        .any(|candidate| candidate.id == occurrence && candidate.source.kind == "entry")
}

/// Read a `system build` input file. `CliArgument` has no `board-sub-ports` or
/// `entry` value, so the message names the option instead of the field.
fn read_input(path: &Path, option: &str, limits: &Limits) -> Outcome<Vec<u8>> {
    let size = match std::fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_file() => metadata.len(),
        Ok(_) => {
            return Err(Failure::input(
                "input-not-regular-file",
                format!("--{option} is not a regular file"),
            ));
        }
        Err(_) => {
            return Err(Failure::input(
                "input-not-found",
                format!("--{option} does not exist"),
            ));
        }
    };
    limits.check(
        LimitName::MaxMemberBytes,
        size,
        &format!("the --{option} file"),
    )?;
    std::fs::read(path).map_err(|error| {
        Failure::input(
            "input-not-found",
            format!("--{option} could not be read: {error}"),
        )
    })
}

fn input_invalid(message: String) -> Failure {
    Failure::input("input-invalid", message)
}

/// Read and validate `--board-sub-ports`; `None` when it was not given.
fn read_board_sub_ports(args: &Args) -> Outcome<Option<BTreeMap<String, input::BoardSubPortDef>>> {
    let Some(path) = args.system_board_sub_ports.as_deref() else {
        return Ok(None);
    };
    let bytes = read_input(Path::new(path), "board-sub-ports", &args.limits)?;
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|error| input_invalid(format!("--board-sub-ports is not JSON: {error}")))?;
    schema::validate(BOARD_SUB_PORTS_SCHEMA, &value).map_err(|violation| {
        input_invalid(format!(
            "--board-sub-ports breaks {BOARD_SUB_PORTS_SCHEMA}: {}",
            violation.message
        ))
    })?;
    let file: input::BoardSubPorts = serde_json::from_value(value).map_err(|error| {
        input_invalid(format!(
            "--board-sub-ports does not fit its contract: {error}"
        ))
    })?;
    Ok(Some(
        file.sub_ports
            .into_iter()
            .map(|definition| (definition.id.clone(), definition))
            .collect(),
    ))
}

fn entry_invalid(occurrence: &str, detail: String) -> Failure {
    input_invalid(format!("entry:{occurrence}: --entry {detail}"))
}

/// Read and validate each `--entry` payload, then check it names an entry
/// occurrence (`CONTRACTS.md` §8.8 check 6, §12.2).
fn read_entries(args: &Args, document: &input::Document) -> Outcome<BTreeMap<String, LoadedEntry>> {
    let mut loaded = BTreeMap::new();
    for (occurrence, spec) in &args.system_entries {
        let bytes = read_input(Path::new(&spec.payload), "entry", &args.limits)?;
        let value: Value = serde_json::from_slice(&bytes)
            .map_err(|error| entry_invalid(occurrence, format!("is not JSON: {error}")))?;
        schema::validate(ENTRY_SCHEMA, &value).map_err(|violation| {
            entry_invalid(
                occurrence,
                format!("breaks {ENTRY_SCHEMA}: {}", violation.message),
            )
        })?;
        let (board, facts) = entry::board(&value, &spec.stage);
        loaded.insert(
            occurrence.clone(),
            LoadedEntry {
                board,
                facts,
                payload_sha256: generator::sha256_hex(&canonical_json(&value)),
            },
        );
    }
    for occurrence in loaded.keys() {
        if !is_entry(document, occurrence) {
            return Err(Failure::precondition(
                "occurrence-mismatch",
                format!(
                    "--entry names {occurrence}, which is not an entry occurrence of --document"
                ),
            ));
        }
    }
    Ok(loaded)
}

/// All members share one generator id, byte for byte in canonical form.
fn shared_generator(members: &BTreeMap<String, Member>) -> Outcome<Option<Vec<u8>>> {
    let mut shared: Option<Vec<u8>> = None;
    for member in members.values() {
        let generator = member
            .reader
            .manifest_read()
            .value
            .get("generator")
            .map(generator::canonical)
            .unwrap_or_default();
        match &shared {
            Some(first) if *first != generator => {
                return Err(Failure::precondition(
                    "generator-mismatch",
                    "the member bundles were written by different generator ids",
                ));
            }
            Some(_) => {}
            None => shared = Some(generator),
        }
    }
    Ok(shared)
}

// -------------------------------------------------------------------- boards

fn build_boards(
    members: &BTreeMap<String, Member>,
    generator_bytes: &[u8],
) -> Result<BTreeMap<String, input::Board>, MemberFailure> {
    let mut boards = BTreeMap::new();
    for (occurrence, member) in members.iter() {
        let board = read_board(member, generator_bytes).map_err(|failure| MemberFailure {
            failure,
            occurrence: occurrence.clone(),
        })?;
        boards.insert(occurrence.clone(), board);
    }
    Ok(boards)
}

fn read_board(member: &Member, generator_bytes: &[u8]) -> Outcome<input::Board> {
    let interface_bytes = require_member(&member.reader, INTERFACE)?;
    let semantic_bytes = require_member(&member.reader, SEMANTIC)?;
    let interface: input::SystemInterface = serde_json::from_slice(&interface_bytes)
        .map_err(|error| member_invalid(INTERFACE, &error))?;
    let semantic: Value = serde_json::from_slice(&semantic_bytes)
        .map_err(|error| member_invalid(SEMANTIC, &error))?;
    Ok(input::Board {
        revision_key: member.revision_key.clone(),
        bundle_key: member_bundle_key(member.reader.manifest(), generator_bytes)?,
        interface,
        semantic: input::SemanticFacts::from_value(&semantic),
    })
}

/// A member holds `path` in stage `parse`: `complete`, or `partial` without
/// it among `failed_members` (`CONTRACTS.md` §8.8 check 5).
fn require_member(reader: &BundleReader<FileSource>, path: &str) -> Outcome<Vec<u8>> {
    let parse = &reader.manifest().stages.parse;
    let failed = parse
        .failed_members
        .iter()
        .any(|failed| failed.path.as_str() == path);
    let ready = match parse.status {
        Status::Complete => true,
        Status::Partial => !failed,
        _ => false,
    };
    let listed = reader.index().entry(path).is_some();
    if !(ready && listed) {
        return Err(Failure::precondition(
            "member-not-found",
            format!("the member bundle has no {path}"),
        )
        .argument("member"));
    }
    match reader.member(path) {
        Some(Ok(bytes)) => Ok(bytes),
        Some(Err(finding)) => {
            let mut failure = Failure::input(
                "bundle-invalid",
                format!("the bundle is invalid: {}", finding.message),
            )
            .argument("member");
            failure.finding.location = finding.location;
            Err(failure)
        }
        None => Err(Failure::precondition(
            "member-not-found",
            format!("the member bundle has no {path}"),
        )
        .argument("member")),
    }
}

fn member_invalid(path: &str, error: &serde_json::Error) -> Failure {
    Failure::input(
        "bundle-invalid",
        format!("{path} does not fit its contract: {error}"),
    )
    .argument("member")
}

/// The bundle key as `compare` computes a side's: the manifest's, else the
/// one its revision key and generator imply (cli-spec.md §5.6).
fn member_bundle_key(manifest: &Manifest, generator_bytes: &[u8]) -> Outcome<String> {
    manifest
        .bundle_key
        .as_ref()
        .map(|key| key.0.clone())
        .or_else(|| {
            manifest
                .revision_key
                .as_ref()
                .map(|key| generator::bundle_key(key.as_str(), generator_bytes))
        })
        .ok_or_else(|| Failure::internal("a member bundle records no bundle key"))
}

// -------------------------------------------------------------------- output

fn validate_bundle(bundle: &SystemBundle) -> Outcome<()> {
    let value = serde_json::to_value(bundle).map_err(|error| {
        Failure::internal(format!("the system bundle does not encode: {error}"))
    })?;
    schema::validate(BUNDLE_SCHEMA, &value).map_err(|violation| {
        Failure::internal(format!(
            "the {BUNDLE_SCHEMA} document breaks its schema: {}",
            violation.message
        ))
    })
}

/// The key of `CONTRACTS.md` §8.1: SHA-256 over the canonical JSON of the
/// document digest, the generator digest, each member's bundle key, the
/// absent occurrences, the pending ones, the board-level sub-ports and the
/// published entries.
fn system_bundle_key(
    document: &input::Document,
    document_sha256: &str,
    generator_bytes: &[u8],
    members: &input::Members,
    entry_keys: &BTreeMap<String, EntryKey>,
) -> String {
    let member_keys: BTreeMap<&str, &str> = members
        .boards
        .iter()
        .filter(|(occurrence, _)| !entry_keys.contains_key(occurrence.as_str()))
        .map(|(occurrence, board)| (occurrence.as_str(), board.bundle_key.as_str()))
        .collect();
    let board_sub_ports: BTreeMap<&str, i32> = members
        .board_sub_ports
        .as_ref()
        .map(|definitions| {
            definitions
                .iter()
                .map(|(id, definition)| (id.as_str(), definition.version))
                .collect()
        })
        .unwrap_or_default();
    let mut pending: Vec<&str> = document
        .occurrences
        .iter()
        .filter(|occurrence| {
            occurrence.source.kind == "board"
                && !members.boards.contains_key(&occurrence.id)
                && !members.absent.contains(&occurrence.id)
        })
        .map(|occurrence| occurrence.id.as_str())
        .collect();
    pending.sort_unstable();
    let absent: Vec<&str> = members.absent.iter().map(String::as_str).collect();
    let value = json!({
        "absent": absent,
        "boardSubPorts": board_sub_ports,
        "documentSha256": document_sha256,
        "entries": entry_keys,
        "format": prism_system::SYSTEM_BUNDLE_FORMAT,
        "generator": generator::digest(generator_bytes),
        "members": member_keys,
        "pending": pending,
    });
    generator::sha256_hex(&canonical_json(&value))
}

fn emit_result(
    key: &str,
    document_sha256: &str,
    bundle: &SystemBundle,
    stderr: &Stderr,
) -> Outcome<u8> {
    let count = |len: usize| u64::try_from(len).unwrap_or(u64::MAX);
    let findings = |severity: &str| {
        count(
            bundle
                .findings
                .iter()
                .filter(|finding| finding.severity == severity && !finding.waived)
                .count(),
        )
    };
    let result = json!({
        "schema": RESULT_SCHEMA,
        "system_bundle_key": key,
        "document_sha256": document_sha256,
        "counts": {
            "ready_occurrences": count(bundle.occurrences.iter().filter(|occurrence| occurrence.state == "ready").count()),
            "pending_occurrences": count(bundle.occurrences.iter().filter(|occurrence| occurrence.state == "pending").count()),
            "nets": count(bundle.nets.len()),
            "mates": count(bundle.mates.len()),
            "links": count(bundle.links.len()),
            "suggestions": count(bundle.suggestions.len()),
            "errors": findings("error"),
            "warnings": findings("warning"),
        },
    });
    schema::validate(RESULT_SCHEMA, &result).map_err(|violation| {
        Failure::internal(format!(
            "the {RESULT_SCHEMA} document breaks its schema: {}",
            violation.message
        ))
    })?;
    if crate::output::stdout(&result) {
        Ok(0)
    } else {
        Ok(stdout_failed(stderr))
    }
}

fn stdout_failed(stderr: &Stderr) -> u8 {
    stderr.emit(&Diagnostic {
        severity: Severity::Error,
        code: "stdout-write-failed",
        message: "stdout could not be written",
        stage: None,
        argument: None,
        location: None,
        limit: None,
    });
    6
}

/// Report `error` about one member. `CliArgument` names the option (`member`);
/// the occurrence prefixes the message, since the enum cannot spell
/// `member:<occurrence>`.
fn report_member(mut error: MemberFailure, stderr: &Stderr) -> u8 {
    error.failure.finding.message = format!(
        "member:{}: {}",
        error.occurrence, error.failure.finding.message
    );
    stderr.emit(&Diagnostic {
        severity: Severity::Error,
        code: &error.failure.finding.code,
        message: &error.failure.finding.message,
        stage: None,
        argument: error.failure.argument,
        location: error.failure.finding.location.as_ref(),
        limit: error.failure.limit.as_ref(),
    });
    let document = crate::output::error_document(&error.failure, None);
    if crate::output::stdout(&document) {
        error.failure.category.exit_code()
    } else {
        stdout_failed(stderr)
    }
}

// ----------------------------------------------------------------- atomic out

fn output_failed(message: impl Into<String>) -> Failure {
    Failure::output("output-write-failed", message).argument("output")
}

/// Write `bundle` to `-o` atomically: a hidden exclusive temp file in the same
/// directory, fsynced, then renamed (cli-spec.md §5.2.5). The document is
/// streamed, compact, with one trailing LF.
fn write_json(path: &Path, bundle: &SystemBundle) -> Outcome<()> {
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
    let mut writer = BufWriter::new(file);
    let written = serde_json::to_writer(&mut writer, bundle)
        .map_err(std::io::Error::other)
        .and_then(|()| writer.write_all(b"\n"))
        .and_then(|()| writer.into_inner().map_err(|error| error.into_error()))
        .and_then(|file| file.sync_all());
    if let Err(error) = written {
        cleanup(&temp);
        return Err(output_failed(format!(
            "the system bundle could not be written: {error}"
        )));
    }
    if let Err(error) = std::fs::rename(&temp, path) {
        cleanup(&temp);
        return Err(output_failed(format!(
            "the system bundle could not be renamed into place: {error}"
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

// ------------------------------------------------------------------ canonical

/// `value` as canonical JSON: keys sorted in code point order at every level,
/// compact, UTF-8.
fn canonical_json(value: &Value) -> Vec<u8> {
    let mut out = String::new();
    write_canonical(&mut out, value);
    out.into_bytes()
}

fn write_canonical(out: &mut String, value: &Value) {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            out.push('{');
            for (index, key) in keys.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                push_json(out, &Value::String((*key).clone()));
                out.push(':');
                write_canonical(out, &map[*key]);
            }
            out.push('}');
        }
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_canonical(out, item);
            }
            out.push(']');
        }
        scalar => push_json(out, scalar),
    }
}

fn push_json(out: &mut String, value: &Value) {
    match serde_json::to_string(value) {
        Ok(text) => out.push_str(&text),
        Err(_) => out.push_str("null"),
    }
}
