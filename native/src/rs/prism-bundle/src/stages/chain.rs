//! Chaining stages through `--in` (cli-spec.md §5.2.1): load the earlier
//! archive with every reader check, check that it fits this invocation, and
//! drop what a re-run replaces.

use super::{Carried, Generator, MemberContent, MemberData, internal};
use crate::finding::{Failure, Outcome};
use crate::generator::{canonical, sha256_hex};
use crate::manifest::{Manifest, Stage, Status, a3, role_stage};
use crate::reader::{BundleReader, verified_body};
use crate::revision_key::{EffectiveConfig, canonical_config};
use crate::zip::ReadAt;
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

/// The bundle a later stage builds on.
#[derive(Clone, Debug)]
pub struct Input {
    /// Its manifest.
    pub manifest: Manifest,
    /// SHA-256 of its `bundle.json`, compared again before the rename.
    pub manifest_sha256: String,
    /// Every member, checked and kept compressed; a stage inflates only the
    /// members it reads.
    pub members: Vec<MemberData>,
    /// Members inflated on demand, so a repeated read of one input is paid once.
    decoded: Arc<Mutex<BTreeMap<String, Arc<[u8]>>>>,
}

impl Input {
    /// An input from members that are already in memory (tests, in-process
    /// builds).
    #[must_use]
    pub fn new(manifest: Manifest, manifest_sha256: String, members: Vec<MemberData>) -> Self {
        Self {
            manifest,
            manifest_sha256,
            members,
            decoded: Arc::new(Mutex::new(BTreeMap::new())),
        }
    }

    /// The bytes of member `path`, inflating it on first use.
    #[must_use]
    pub fn member(&self, path: &str) -> Option<Arc<[u8]>> {
        let member = self.members.iter().find(|member| member.path == path)?;
        match &member.content {
            MemberContent::Bytes(bytes) => Some(bytes.clone()),
            MemberContent::Carried(carried) => {
                if let Some(bytes) = self
                    .decoded
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner)
                    .get(path)
                {
                    return Some(bytes.clone());
                }
                let bytes = carried.decode()?;
                self.decoded
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner)
                    .insert(path.to_owned(), bytes.clone());
                Some(bytes)
            }
        }
    }
}

/// Read and check every member of `reader` (bundle-format.md §9 step 6),
/// keeping each one compressed: the stage's write copies it into the new
/// archive without inflating or re-encoding it.
pub fn load<R: ReadAt>(reader: &BundleReader<R>) -> Outcome<Input> {
    let manifest = reader.manifest().clone();
    let mut members = Vec::with_capacity(manifest.members.len());
    for record in &manifest.members {
        let entry = reader
            .index()
            .entry(&record.path)
            .ok_or_else(|| internal("a listed member is not in the archive"))?;
        let body = match verified_body(reader.source(), reader.index(), entry, record) {
            Ok(body) => body,
            Err(finding) => {
                let mut failure = Failure::input(
                    "bundle-invalid",
                    format!("the input bundle is invalid: {}", finding.message),
                )
                .argument("in");
                failure.finding.location = finding.location;
                return Err(failure);
            }
        };
        members.push(MemberData {
            path: record.path.0.clone(),
            role: record.role,
            content: MemberContent::Carried(Carried {
                deflated: entry.is_deflated(),
                crc: entry.crc,
                size: entry.size,
                sha256: record.sha256.0.clone(),
                body: Arc::from(body),
            }),
            schema: record.member_schema.as_ref().map(|schema| schema.0.clone()),
            source: record.source.clone(),
        });
    }
    Ok(Input::new(
        manifest,
        sha256_hex(&reader.manifest_read().bytes),
        members,
    ))
}

fn status(manifest: &Manifest, stage: Stage) -> Status {
    match stage {
        Stage::Parse => manifest.stages.parse.status,
        Stage::Board => manifest.stages.board.status,
        Stage::Models => manifest.stages.models.status,
    }
}

/// Checks 3–5 of cli-spec.md §5.2.1.
pub fn check(
    input: &Input,
    stage: Stage,
    generator: &Generator,
    revision_key: Option<&str>,
    config: Option<&EffectiveConfig>,
) -> Outcome<()> {
    let recorded = serde_json::to_value(&input.manifest.generator).map_err(internal)?;
    if canonical(&recorded) != generator.bytes {
        return Err(Failure::precondition(
            "generator-mismatch",
            "the input bundle was written by another generator id",
        )
        .argument("in"));
    }
    let name = crate::manifest::stage_name(stage);
    if status(&input.manifest, stage) == Status::Skipped {
        return Err(Failure::precondition(
            "stage-not-applicable",
            format!("stage {name} is skipped in the input bundle"),
        )
        .argument("stage"));
    }
    let ready = match stage {
        Stage::Parse => false,
        Stage::Board => matches!(
            input.manifest.stages.parse.status,
            Status::Complete | Status::Partial
        ),
        Stage::Models => input.manifest.stages.board.status == Status::Complete,
    };
    if !ready {
        return Err(Failure::precondition(
            "stage-order",
            format!("the input bundle's earlier stages do not allow stage {name}"),
        )
        .argument("stage"));
    }
    if let Some(key) = revision_key
        && input
            .manifest
            .revision_key
            .as_ref()
            .map(|recorded| recorded.0.as_str())
            != Some(key)
    {
        return Err(Failure::precondition(
            "revision-key-mismatch",
            "--revision-key differs from the input bundle's",
        )
        .argument("revision-key"));
    }
    if let Some(config) = config {
        let recorded: EffectiveConfig =
            crate::manifest::retype(&input.manifest.config).map_err(internal)?;
        if canonical_config(&recorded) != canonical_config(config) {
            return Err(Failure::precondition(
                "config-mismatch",
                "--config differs from the input bundle's",
            )
            .argument("config"));
        }
    }
    Ok(())
}

/// The members a run of `stage` keeps: those of earlier stages.
#[must_use]
pub fn earlier_members(input: &Input, stage: Stage) -> Vec<MemberData> {
    let order = |stage: Stage| match stage {
        Stage::Parse => 0,
        Stage::Board => 1,
        Stage::Models => 2,
    };
    input
        .members
        .iter()
        .filter(|member| order(role_stage(member.role)) < order(stage))
        .cloned()
        .collect()
}

/// A models record reset to `pending`.
#[must_use]
pub fn pending_models() -> a3::BundleManifestModelsStage {
    crate::manifest::models_stage(Status::Pending, None)
}
