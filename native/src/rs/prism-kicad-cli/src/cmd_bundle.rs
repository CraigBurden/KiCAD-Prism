//! `bundle verify` (cli-spec.md §5.3), `bundle extract` (§5.4) and `bundle
//! reuse` (§5.10).

use crate::args::Args;
use crate::cmd_build::stage_states;
use crate::inputs;
use prism_bundle::manifest::{Manifest, a3, finding_json, is_source_role, retype};
use prism_bundle::read_set;
use prism_bundle::reader::BundleReader;
use prism_bundle::revision_key::{EffectiveConfig, config_digest};
use prism_bundle::stages::Generator;
use prism_bundle::verify::{Depth, verify};
use prism_bundle::zip::FileSource;
use prism_bundle::{Failure, Outcome, generator};
use prism_kicad_contracts::generated::prism_cli_reuse_result_a0::{
    CliReuseCondition, CliReuseFailure, CliReuseResultA0, RepoPath, Sha256Hex,
};
use prism_kicad_contracts::generated::prism_revision_key_record_a1::RevisionKeyRecordA1;
use serde_json::{Value, json};
use std::path::Path;

fn open_file(path: &Path, argument: &'static str) -> Outcome<FileSource> {
    inputs::regular_file(path, argument)?;
    let unreadable = |error: std::io::Error| {
        Failure::input(
            "input-not-found",
            format!("the bundle could not be read: {error}"),
        )
        .argument(argument)
    };
    let file = std::fs::File::open(path).map_err(unreadable)?;
    FileSource::new(file).map_err(unreadable)
}

/// Run `bundle verify`; the document and whether the bundle is valid.
pub fn verify_command(args: &Args, generator: &Generator) -> Outcome<(Value, bool)> {
    let source = open_file(Path::new(&args.positional[0]), "bundle")?;
    let report = verify(&source, &args.limits, &generator.bytes, Depth::Full);
    let valid = report.valid();
    let mut document = json!({
        "schema": "prism.cli.verify_report.a0",
        "status": if valid { "valid" } else { "invalid" },
        "stages": report.manifest.as_ref().map(stage_states).unwrap_or_default(),
        "members_checked": report.members_checked,
        "findings": report.findings.iter().map(finding_json).collect::<Vec<_>>(),
    });
    if let Some(schema) = &report.manifest_schema {
        document["manifest_schema"] = schema.clone().into();
    }
    if let Some(matches) = report.generator_matches {
        document["generator_matches"] = matches.into();
    }
    Ok((document, valid))
}

/// Run `bundle extract`.
pub fn extract_command(args: &Args) -> Outcome<Value> {
    let source = open_file(Path::new(&args.positional[0]), "bundle")?;
    let reader =
        BundleReader::open(source, &args.limits).map_err(|error| error.failure("bundle"))?;
    let selected = prism_bundle::extract::select(&reader, &args.positional[1..])?;
    let output = Path::new(args.option("output").unwrap_or_default());
    let extracted = prism_bundle::extract::extract(&reader, &selected, output)?;
    Ok(json!({
        "schema": "prism.cli.extract_result.a0",
        "members": extracted
            .iter()
            .map(|member| json!({"path": member.path, "bytes": member.bytes, "sha256": member.sha256}))
            .collect::<Vec<_>>(),
    }))
}

/// Run `bundle reuse`: whether the bundle of `--in` serves the revision key
/// of `--key-record` (cli-spec.md §5.10). It reads the manifest only.
pub fn reuse_command(args: &Args, generator: &Generator) -> Outcome<Value> {
    let source = open_file(Path::new(args.option("in").unwrap_or_default()), "in")?;
    let reader = BundleReader::open(source, &args.limits).map_err(|error| error.failure("in"))?;
    let record = inputs::key_record(
        Path::new(args.option("key-record").unwrap_or_default()),
        &args.limits,
    )?;
    let manifest = reader.manifest();
    let written_by = generator::canonical(&reader.manifest_read().value["generator"]);
    let failure = reuse_failure(manifest, &written_by, generator, &record)?;
    let bundle_key = manifest.bundle_key.as_ref().map_or_else(
        || {
            let revision_key = manifest.revision_key.as_ref().map(|key| key.as_str());
            generator::bundle_key(revision_key.unwrap_or_default(), &written_by)
        },
        |key| key.0.clone(),
    );
    let result = CliReuseResultA0 {
        schema: "prism.cli.reuse_result.a0".to_owned(),
        holds: failure.is_none(),
        bundle_key: Sha256Hex(bundle_key),
        revision_key: Sha256Hex(record.revision_key.0.clone()),
        failure,
    };
    serde_json::to_value(&result)
        .map_err(|error| Failure::internal(format!("the reuse result does not serialize: {error}")))
}

/// The first condition of cli-spec.md §5.10 that fails, in order.
fn reuse_failure(
    manifest: &Manifest,
    written_by: &[u8],
    generator: &Generator,
    record: &RevisionKeyRecordA1,
) -> Outcome<Option<CliReuseFailure>> {
    let failed = |condition, message: &str| {
        Some(CliReuseFailure {
            condition,
            path: None,
            message: message.to_owned(),
        })
    };
    let config: EffectiveConfig = retype(&manifest.config).map_err(|error| {
        Failure::internal(format!("the manifest config does not retype: {error}"))
    })?;
    if config_digest(&config) != record.config_digest.0 {
        return Ok(failed(
            CliReuseCondition::Config,
            "the bundle was built with another effective configuration",
        ));
    }
    if written_by != generator.bytes.as_slice() {
        return Ok(failed(
            CliReuseCondition::Generator,
            "the bundle was written by another generator id",
        ));
    }
    let parse = &manifest.stages.parse;
    if parse
        .warnings
        .iter()
        .any(|warning| warning.code.0 == "model-unavailable")
    {
        return Ok(failed(
            CliReuseCondition::ModelUnavailable,
            "stage parse could not materialize a model the key lists",
        ));
    }
    let sources: Vec<&a3::BundleManifestSourceEntry> = manifest
        .members
        .iter()
        .filter(|member| is_source_role(member.role))
        .filter_map(|member| member.source.as_ref())
        .collect();
    let read_set = read_set::of_contract(&manifest.read_set);
    Ok(
        read_set::check_sources(&read_set, &sources, record).map(|mismatch| CliReuseFailure {
            condition: mismatch.condition,
            path: Some(RepoPath(mismatch.path)),
            message: mismatch.message,
        }),
    )
}
