//! `prism-kicad bundle build` (cli-spec.md §5.2): run one stage, write `-o`
//! atomically, print `CliBuildResultA0` (exit 0 when the stage is complete,
//! 9 when it is recorded `failed` or `partial`) or `CliProjectAbsentA0`
//! (exit 10).

use crate::args::{Args, StageArg};
use crate::atomic::{self, InputGuard};
use crate::inputs;
use crate::output::Stderr;
use prism_bundle::generator::sha256_hex;
use prism_bundle::manifest::{MANIFEST_PATH, Status, stage_name, status_name};
use prism_bundle::reader::BundleReader;
use prism_bundle::revision_key::EffectiveConfig;
use prism_bundle::stages::board::{BoardRequest, Refilled};
use prism_bundle::stages::chain::{self, Input};
use prism_bundle::stages::models::{
    GEOMETER_C_ABI_GENERATION, GeometerError, GeometerSession, ModelsRequest,
};
use prism_bundle::stages::parse::{ParseOutcome, ParseRequest};
use prism_bundle::stages::{Built, Generator, Reporter, StageRecord};
use prism_bundle::zip::FileSource;
use prism_bundle::{Category, Failure, LimitName, Outcome};
use serde_json::{Value, json};
use std::path::Path;

/// The document and exit code of a build.
pub struct BuildOutcome {
    /// stdout.
    pub document: Value,
    /// 0, 9 or 10.
    pub exit: u8,
}

fn optional_config(args: &Args) -> Outcome<Option<EffectiveConfig>> {
    args.option("config")
        .map(|path| inputs::config(Path::new(path), &args.limits))
        .transpose()
}

fn stage_state(record: &StageRecord<'_>) -> Value {
    let mut value = json!({
        "stage": stage_name(record.stage),
        "status": status_name(record.status),
    });
    if let Some(error) = record.error {
        value["error"] = serde_json::to_value(error).unwrap_or_default();
    }
    if let Some(reason) = record.skip_reason {
        value["skip_reason"] = serde_json::to_value(reason).unwrap_or_default();
    }
    value["failed_members"] = serde_json::to_value(record.failed_members).unwrap_or_default();
    value
}

/// The three stage states of a manifest, in stage order.
pub fn stage_states(manifest: &prism_bundle::manifest::Manifest) -> Vec<Value> {
    StageRecord::all(manifest).iter().map(stage_state).collect()
}

fn digest(path: &str, bytes: &[u8]) -> Value {
    json!({"path": path, "bytes": bytes.len(), "sha256": sha256_hex(bytes)})
}

fn result_document(built: &Built, written: &atomic::Written) -> Value {
    let mut members = vec![digest(MANIFEST_PATH, &built.manifest_bytes)];
    for member in &built.members {
        if built.written.contains(&member.path) {
            members.push(json!({
                "path": member.path,
                "bytes": member.size(),
                "sha256": member.sha256(),
            }));
        }
    }
    members.sort_by(|a, b| a["path"].as_str().cmp(&b["path"].as_str()));
    let record = built.stage_record();
    json!({
        "schema": "prism.cli.build_result.a0",
        "stage": stage_name(built.stage),
        "stages": stage_states(&built.manifest),
        "archive_bytes": written.bytes,
        "archive_sha256": written.sha256,
        "written_members": members,
        "warnings": serde_json::to_value(record.warnings).unwrap_or_default(),
    })
}

fn load_input(args: &Args) -> Outcome<(Input, String)> {
    let path = Path::new(args.option("in").unwrap_or_default());
    inputs::regular_file(path, "in")?;
    let file = std::fs::File::open(path).map_err(|error| {
        Failure::input(
            "input-not-found",
            format!("--in could not be read: {error}"),
        )
        .argument("in")
    })?;
    let source = FileSource::new(file).map_err(|error| {
        Failure::input(
            "input-not-found",
            format!("--in could not be read: {error}"),
        )
        .argument("in")
    })?;
    let reader = BundleReader::open(source, &args.limits).map_err(|error| error.failure("in"))?;
    let input = chain::load(&reader)?;
    let digest = input.manifest_sha256.clone();
    Ok((input, digest))
}

fn finish(
    args: &Args,
    generator: &Generator,
    built: &Built,
    guard: Option<InputGuard<'_>>,
    stderr: &Stderr,
) -> Outcome<BuildOutcome> {
    let output = Path::new(args.option("output").unwrap_or_default());
    let written = atomic::write(built, output, guard, &args.limits, &generator.bytes)?;
    stderr.info(
        "archive-written",
        &format!("the archive is {} bytes", written.bytes),
    );
    let record = built.stage_record();
    stderr.info(
        "stage-finished",
        &format!(
            "stage {} is {}",
            stage_name(built.stage),
            status_name(record.status)
        ),
    );
    let exit = if record.status == Status::Complete {
        0
    } else {
        9
    };
    Ok(BuildOutcome {
        document: result_document(built, &written),
        exit,
    })
}

fn parse(args: &Args, generator: &Generator, stderr: &Stderr) -> Outcome<BuildOutcome> {
    let config = optional_config(args)?;
    let key_record = args
        .option("key-record")
        .map(|path| inputs::key_record(Path::new(path), &args.limits))
        .transpose()?;
    let request = ParseRequest {
        project: Path::new(&args.positional[0]),
        source_root: args.option("source-root").map(Path::new),
        config,
        revision_key: args.option("revision-key").map(str::to_owned),
        key_record,
        upgraded: args.upgraded.clone(),
        generator,
        limits: &args.limits,
        reporter: stderr,
        projections: None,
        in_memory: false,
    };
    match prism_bundle::stages::parse::run(&request)? {
        ParseOutcome::ProjectAbsent(project_file) => Ok(BuildOutcome {
            document: json!({
                "schema": "prism.cli.project_absent.a0",
                "code": "project-absent",
                "command": "bundle build",
                "project_file": project_file,
            }),
            exit: 10,
        }),
        ParseOutcome::Built(built) => finish(args, generator, &built, None, stderr),
    }
}

fn board(args: &Args, generator: &Generator, stderr: &Stderr) -> Outcome<BuildOutcome> {
    let (input, digest) = load_input(args)?;
    let config = optional_config(args)?;
    let refilled = match (args.option("refilled-board"), args.option("refill-tool")) {
        (Some(path), Some(tool)) => Some(Refilled {
            bytes: inputs::read(
                Path::new(path),
                "refilled-board",
                LimitName::MaxSourceFileBytes,
                &args.limits,
            )?,
            tool: tool.to_owned(),
        }),
        _ => None,
    };
    let built = prism_bundle::stages::board::run(&BoardRequest {
        input: &input,
        refilled,
        revision_key: args.option("revision-key"),
        config: config.as_ref(),
        generator,
        limits: &args.limits,
        reporter: stderr,
    })?;
    let guard = InputGuard {
        path: Path::new(args.option("in").unwrap_or_default()),
        manifest_sha256: &digest,
    };
    finish(args, generator, &built, Some(guard), stderr)
}

/// Connect the `--geometer` runtime for stage models, mapping its two
/// failures to the codes of cli-spec.md §5.2.4 and §8.
fn geometer(args: &Args, generator: &Generator) -> Outcome<Option<GeometerSession>> {
    let Some(executable) = args.option("geometer") else {
        return Ok(None);
    };
    let expected = &generator.document.hlr_procedure.geometer_version.0;
    GeometerSession::connect(Path::new(executable), expected)
        .map(Some)
        .map_err(|error| match error {
            GeometerError::Unavailable(message) => Failure::new(
                Category::Internal,
                "geometer-unavailable",
                format!("--geometer could not be started: {message}"),
            )
            .argument("geometer"),
            GeometerError::VersionMismatch {
                release,
                c_abi_generation,
            } => Failure::precondition(
                "geometer-version-mismatch",
                format!(
                    "--geometer reports Geometer {release} / C ABI {c_abi_generation}; the generator needs {expected} / C ABI {}",
                    GEOMETER_C_ABI_GENERATION
                ),
            )
            .argument("geometer"),
        })
}

fn models(args: &Args, generator: &Generator, stderr: &Stderr) -> Outcome<BuildOutcome> {
    let (input, digest) = load_input(args)?;
    let config = optional_config(args)?;
    let glb = inputs::read(
        Path::new(args.option("models-glb").unwrap_or_default()),
        "models-glb",
        LimitName::MaxModelsGlbBytes,
        &args.limits,
    )?;
    let geometer = geometer(args, generator)?;
    let model_dirs = args
        .model_dirs
        .iter()
        .map(|(name, directory)| (name.clone(), Path::new(directory).to_path_buf()))
        .collect();
    let built = prism_bundle::stages::models::run(ModelsRequest {
        input: &input,
        glb,
        tool: args.option("models-tool").unwrap_or_default().to_owned(),
        revision_key: args.option("revision-key"),
        config: config.as_ref(),
        generator,
        limits: &args.limits,
        reporter: stderr,
        geometer: geometer.as_ref(),
        model_dirs: &model_dirs,
        hlr_cache: args.option("hlr-cache").map(Path::new),
    })?;
    let guard = InputGuard {
        path: Path::new(args.option("in").unwrap_or_default()),
        manifest_sha256: &digest,
    };
    finish(args, generator, &built, Some(guard), stderr)
}

/// Run `bundle build`.
pub fn run(args: &Args, generator: &Generator, stderr: &Stderr) -> Outcome<BuildOutcome> {
    stderr.info("stage-started", "the stage started");
    match args.stage {
        Some(StageArg::Board) => board(args, generator, stderr),
        Some(StageArg::Models) => models(args, generator, stderr),
        _ => parse(args, generator, stderr),
    }
}
