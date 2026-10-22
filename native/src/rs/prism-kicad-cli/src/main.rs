//! `prism-kicad`, the command line of `native/contracts/prism/cli-spec.md`:
//! parse a KiCad revision once and write its design bundle, verify and
//! extract bundles, and compute design revision keys.
//!
//! Exactly one JSON document goes to stdout, chosen by the exit code (§3.1,
//! §4); stderr is JSON Lines. A panic is caught and reported as
//! `internal`/`panic` (exit 1); the timeout watchdog, the memory cap and the
//! signal handlers live in [`process`].

#![allow(
    clippy::result_large_err,
    reason = "prism_bundle::Failure is carried by value, as in prism-bundle"
)]

mod args;
mod atomic;
mod cmd_artwork;
mod cmd_build;
mod cmd_bundle;
mod cmd_compare;
mod cmd_revision_key;
mod cmd_vendor;
mod git;
mod inputs;
mod output;
#[allow(
    unsafe_code,
    reason = "the counting allocator, signal handlers, rlimit and _exit need libc (cli-spec.md §7.3-§7.4)"
)]
mod process;
mod version;

use args::{Args, Command};
use output::{Diagnostic, Severity, Stderr, error_document};
use prism_bundle::finding::LimitHit;
use prism_bundle::{Failure, LimitName};
use serde_json::Value;
use std::process::ExitCode;
use std::time::{Duration, Instant};

#[global_allocator]
static ALLOCATOR: process::CountingAllocator = process::CountingAllocator;

fn stage_of(args: &Args) -> Option<&'static str> {
    match (args.command, args.stage) {
        (Command::Build, Some(args::StageArg::Board)) => Some("board"),
        (Command::Build, Some(args::StageArg::Models)) => Some("models"),
        (Command::Build, _) => Some("parse"),
        _ => None,
    }
}

fn guard_documents(failure: &Failure, stage: Option<&str>) -> (Vec<u8>, Vec<u8>) {
    let stdout = prism_bundle::manifest::json_bytes(&error_document(failure, stage));
    let diagnostic = output::diagnostic_json(&Diagnostic {
        severity: Severity::Error,
        code: &failure.finding.code,
        message: &failure.finding.message,
        stage,
        argument: None,
        location: None,
        limit: failure.limit.as_ref(),
    });
    (stdout, prism_bundle::manifest::json_bytes(&diagnostic))
}

fn arm_guards(args: &Args, started: Instant) {
    let stage = stage_of(args);
    let memory = args.limits.get(LimitName::MaxMemoryBytes);
    let mut out_of_memory = Failure::limit(
        LimitName::MaxMemoryBytes,
        memory,
        None,
        format!("the heap would exceed max-memory-bytes {memory}"),
    );
    out_of_memory.limit = Some(LimitHit {
        name: LimitName::MaxMemoryBytes,
        limit: memory,
        observed: None,
    });
    let (stdout, stderr) = guard_documents(&out_of_memory, stage);
    process::arm_memory_cap(memory, stdout, stderr, args.threads);
    let timeout = args.limits.get(LimitName::TimeoutMs);
    let mut timed_out = Failure::new(
        prism_bundle::Category::Timeout,
        "timeout",
        format!("the command ran past timeout-ms {timeout}"),
    );
    timed_out.limit = Some(LimitHit {
        name: LimitName::TimeoutMs,
        limit: timeout,
        observed: None,
    });
    let (stdout, stderr) = guard_documents(&timed_out, stage);
    process::start_watchdog(started, Duration::from_millis(timeout), stdout, stderr);
}

/// Write `document` after checking it against its schema; return `exit`.
fn emit(document: &Value, exit: u8, stderr: &Stderr, stage: Option<&str>) -> u8 {
    let schema = document
        .get("schema")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if let Err(violation) = prism_bundle::schema::validate(schema, document) {
        let failure = Failure::internal(format!(
            "the {schema} document breaks its schema: {}",
            violation.message
        ));
        return fail(&failure, stderr, stage);
    }
    let ordered = match output::in_declaration_order(document) {
        Ok(ordered) => ordered,
        Err(message) => {
            return fail(
                &Failure::internal(format!("the {schema} document does not decode: {message}")),
                stderr,
                stage,
            );
        }
    };
    if output::stdout(&ordered) {
        exit
    } else {
        stdout_failed(stderr)
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

fn fail(failure: &Failure, stderr: &Stderr, stage: Option<&str>) -> u8 {
    stderr.failure(failure);
    let document = error_document(failure, stage);
    if output::stdout(&document) {
        failure.category.exit_code()
    } else {
        stdout_failed(stderr)
    }
}

fn dispatch(args: &Args, stderr: &Stderr) -> Result<(Value, u8), Failure> {
    let generator = version::generator()?;
    match args.command {
        Command::Build => {
            let outcome = cmd_build::run(args, &generator, stderr)?;
            Ok((outcome.document, outcome.exit))
        }
        Command::Verify => {
            let (document, valid) = cmd_bundle::verify_command(args, &generator)?;
            Ok((document, if valid { 0 } else { 8 }))
        }
        Command::Extract => Ok((cmd_bundle::extract_command(args)?, 0)),
        Command::Reuse => Ok((cmd_bundle::reuse_command(args, &generator)?, 0)),
        Command::RevisionKey => match cmd_revision_key::run(args)? {
            cmd_revision_key::KeyOutcome::Record(record) => Ok((record, 0)),
            cmd_revision_key::KeyOutcome::Absent(document) => Ok((document, 10)),
        },
        Command::VendorList | Command::VendorRun => cmd_vendor::run(args, stderr),
        Command::Artwork | Command::StrokeText | Command::DrawingSheet => cmd_artwork::any(args),
        Command::Version | Command::Help | Command::Compare => {
            Err(Failure::internal("not a dispatched command"))
        }
    }
}

fn version_command(stderr: &Stderr) -> u8 {
    match version::generator() {
        Ok(generator) => {
            let mut bytes = generator.bytes.clone();
            bytes.push(b'\n');
            if !process::take_stdout() {
                return 0;
            }
            use std::io::Write;
            let mut out = std::io::stdout().lock();
            if out.write_all(&bytes).and_then(|()| out.flush()).is_ok() {
                0
            } else {
                stdout_failed(stderr)
            }
        }
        Err(failure) => fail(&failure, stderr, None),
    }
}

fn run(argv: &[String], started: Instant) -> u8 {
    let args = match args::parse(argv) {
        Ok(args) => args,
        Err(failure) => return fail(&failure, &Stderr::new(false, 10_000), None),
    };
    let stderr = Stderr::new(args.quiet, args.limits.get(LimitName::MaxDiagnosticLines));
    let stage = stage_of(&args);
    stderr.set_stage(stage);
    arm_guards(&args, started);
    match args.command {
        Command::Help => {
            print!("{}", args::HELP);
            0
        }
        Command::Version => version_command(&stderr),
        Command::Compare => match cmd_compare::run(&args, &stderr) {
            Ok(exit) => exit,
            Err(failure) => fail(&failure, &stderr, stage),
        },
        _ => match dispatch(&args, &stderr) {
            Ok((document, exit)) => emit(&document, exit, &stderr, stage),
            Err(failure) => fail(&failure, &stderr, stage),
        },
    }
}

fn arguments() -> Result<Vec<String>, Failure> {
    std::env::args_os()
        .skip(1)
        .map(|argument| {
            argument
                .into_string()
                .map_err(|_| Failure::usage("usage", "every argument must be valid UTF-8"))
        })
        .collect()
}

fn main() -> ExitCode {
    let started = Instant::now();
    std::panic::set_hook(Box::new(|_| {}));
    process::install_signal_handlers();
    let argv = match arguments() {
        Ok(argv) => argv,
        Err(failure) => return ExitCode::from(fail(&failure, &Stderr::new(false, 10_000), None)),
    };
    let code = match std::panic::catch_unwind(|| run(&argv, started)) {
        Ok(code) => code,
        Err(payload) => {
            let detail = payload
                .downcast_ref::<&str>()
                .map(|text| (*text).to_owned())
                .or_else(|| payload.downcast_ref::<String>().cloned())
                .unwrap_or_else(|| "a panic".to_owned());
            let mut failure = Failure::internal(format!("prism-kicad panicked: {detail}"));
            failure.finding.code = "panic".to_owned();
            fail(&failure, &Stderr::new(false, 10_000), None)
        }
    };
    ExitCode::from(code)
}
