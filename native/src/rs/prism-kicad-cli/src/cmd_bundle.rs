//! `bundle verify` (cli-spec.md §5.3) and `bundle extract` (§5.4).

use crate::args::Args;
use crate::cmd_build::stage_states;
use crate::inputs;
use prism_bundle::manifest::finding_json;
use prism_bundle::reader::BundleReader;
use prism_bundle::stages::Generator;
use prism_bundle::verify::{Depth, verify};
use prism_bundle::zip::FileSource;
use prism_bundle::{Failure, Outcome};
use serde_json::{Value, json};
use std::path::Path;

fn open_file(path: &Path) -> Outcome<FileSource> {
    inputs::regular_file(path, "bundle")?;
    let file = std::fs::File::open(path).map_err(|error| {
        Failure::input(
            "input-not-found",
            format!("the bundle could not be read: {error}"),
        )
        .argument("bundle")
    })?;
    FileSource::new(file).map_err(|error| {
        Failure::input(
            "input-not-found",
            format!("the bundle could not be read: {error}"),
        )
        .argument("bundle")
    })
}

/// Run `bundle verify`; the document and whether the bundle is valid.
pub fn verify_command(args: &Args, generator: &Generator) -> Outcome<(Value, bool)> {
    let source = open_file(Path::new(&args.positional[0]))?;
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
    let source = open_file(Path::new(&args.positional[0]))?;
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
