//! `prism-kicad bundle build`: the three stages of cli-spec.md §5.2 over the
//! parser core and `prism-projections`.
//!
//! Each stage returns a [`Built`] bundle: the manifest, every member's bytes
//! in archive order, and which members this invocation wrote. Writing the
//! archive atomically (temp file, fsync, self-verify, rename) is the CLI's
//! job; [`Built::write`] streams the canonical zip into any writer.
//!
//! What is recorded and what is not follows bundle-format.md §3.2: a content
//! failure of the design gives a stage `failed` or `partial` in the manifest
//! (the CLI exits 9); everything else is a [`Failure`] and writes nothing.

pub mod board;
pub mod chain;
pub mod crosscheck;
mod design;
mod keys;
pub mod materialize;
pub mod models;
pub mod parse;
mod producers;
mod sexpr_check;

pub use sexpr_check::{BOARD_FORMAT, SCHEMATIC_FORMAT};
pub mod sources;
pub mod stackup;

use crate::finding::{Failure, Finding, Outcome};
use crate::limits::Limits;
use crate::manifest::{MANIFEST_PATH, Manifest, Role, Stage, a3, to_bytes};
use crate::zip::{WriteError, ZipWriter};
use std::collections::BTreeMap;
use std::io::Write;
use std::sync::Arc;

/// Where progress and findings go while a stage runs (stderr, in the CLI).
pub trait Reporter {
    /// An `info` progress line (`stage-started`, `sources-selected`, ...).
    fn info(&self, code: &str, message: &str);
    /// A `warning` line for a recorded warning.
    fn warning(&self, finding: &Finding);
    /// An `error` line for a recorded stage or member failure.
    fn error(&self, finding: &Finding);
}

/// A reporter that drops everything.
pub struct Silent;

impl Reporter for Silent {
    fn info(&self, _code: &str, _message: &str) {}
    fn warning(&self, _finding: &Finding) {}
    fn error(&self, _finding: &Finding) {}
}

/// The generator id the bundle records: the `prism-kicad version` document
/// and its canonical bytes.
#[derive(Clone, Debug)]
pub struct Generator {
    /// The document.
    pub document: a3::CliVersionA0,
    /// Its canonical bytes (cli-spec.md §5.1.3).
    pub bytes: Vec<u8>,
}

impl Generator {
    /// Wrap `document`, computing its canonical bytes.
    pub fn new(document: a3::CliVersionA0) -> Outcome<Self> {
        let value = serde_json::to_value(&document).map_err(|error| {
            Failure::internal(format!("the generator does not encode: {error}"))
        })?;
        let bytes = crate::generator::canonical(&value);
        Ok(Self { document, bytes })
    }
}

/// An entry copied unchanged from the `--in` archive: its compressed body,
/// encoding and the digest it was checked against when the input was loaded.
#[derive(Clone, Debug)]
pub struct Carried {
    /// Whether the body is deflated (method 8) rather than stored.
    pub deflated: bool,
    /// CRC-32 of the uncompressed bytes.
    pub crc: u32,
    /// Uncompressed size.
    pub size: u64,
    /// SHA-256 of the uncompressed bytes, as the input manifest records it.
    pub sha256: String,
    /// The compressed body, exactly as it appears in the input archive.
    pub body: Arc<[u8]>,
}

impl Carried {
    /// The member's uncompressed bytes. The input archive's reader checks
    /// verified them before [`Carried`] was built.
    #[must_use]
    pub fn decode(&self) -> Option<Arc<[u8]>> {
        let size = usize::try_from(self.size).ok()?;
        let bytes = if self.deflated {
            miniz_oxide::inflate::decompress_to_vec_with_limit(&self.body, size).ok()?
        } else {
            if self.body.len() != size {
                return None;
            }
            self.body.to_vec()
        };
        if bytes.len() != size || crate::zip::crc32(&bytes) != self.crc {
            return None;
        }
        Some(Arc::from(bytes))
    }
}

/// Where a member's content comes from.
#[derive(Clone, Debug)]
pub enum MemberContent {
    /// Uncompressed bytes this invocation produced or read.
    Bytes(Arc<[u8]>),
    /// An entry this invocation copies from `--in` without inflating it.
    Carried(Carried),
}

/// One member's content.
#[derive(Clone, Debug)]
pub struct MemberData {
    /// Archive path.
    pub path: String,
    /// Role.
    pub role: Role,
    /// Its bytes, or the compressed input entry it is copied from.
    pub content: MemberContent,
    /// `member_schema`, for structured members.
    pub schema: Option<String>,
    /// The key entry of a source member.
    pub source: Option<a3::BundleManifestSourceEntry>,
}

impl MemberData {
    /// Uncompressed bytes, when this invocation holds them.
    #[must_use]
    pub fn bytes(&self) -> Option<&Arc<[u8]>> {
        match &self.content {
            MemberContent::Bytes(bytes) => Some(bytes),
            MemberContent::Carried(_) => None,
        }
    }

    /// The input entry this member is copied from, if any.
    #[must_use]
    pub fn carried(&self) -> Option<&Carried> {
        match &self.content {
            MemberContent::Bytes(_) => None,
            MemberContent::Carried(carried) => Some(carried),
        }
    }

    /// Uncompressed size.
    #[must_use]
    pub fn size(&self) -> u64 {
        match &self.content {
            MemberContent::Bytes(bytes) => u64::try_from(bytes.len()).unwrap_or(u64::MAX),
            MemberContent::Carried(carried) => carried.size,
        }
    }

    /// SHA-256 of the uncompressed bytes.
    #[must_use]
    pub fn sha256(&self) -> String {
        match &self.content {
            MemberContent::Bytes(bytes) => crate::generator::sha256_hex(bytes),
            MemberContent::Carried(carried) => carried.sha256.clone(),
        }
    }

    /// The manifest record of this member.
    #[must_use]
    pub fn record(&self) -> a3::BundleManifestMember {
        a3::BundleManifestMember {
            path: a3::ArchivePath(self.path.clone()),
            role: self.role,
            stage: crate::manifest::role_stage(self.role),
            sha256: a3::Sha256Hex(self.sha256()),
            bytes: a3::ByteCount(self.size()),
            member_schema: self.schema.clone().map(a3::SchemaId),
            source: self.source.clone(),
        }
    }
}

/// A projection kept in memory by an in-memory parse (`ParseRequest::in_memory`)
/// instead of being serialized as a member.
#[derive(Clone, Debug)]
pub enum Document {
    /// A projection the stage builds as JSON (every one but the semantic index
    /// and the board objects).
    Json(serde_json::Value),
    /// The semantic index, typed, with its `designKey` set.
    SemanticIndex(Box<prism_kicad_contracts::generated::prism_semantic_index_a2::SemanticIndexA2>),
    /// The board objects, typed.
    BoardObjects(Box<prism_kicad_contracts::generated::prism_board_objects_a0::BoardObjectsA0>),
}

/// A bundle after one stage.
#[derive(Clone, Debug)]
pub struct Built {
    /// The stage this invocation ran.
    pub stage: Stage,
    /// The manifest.
    pub manifest: Manifest,
    /// `bundle.json` bytes.
    pub manifest_bytes: Vec<u8>,
    /// Every member other than `bundle.json`, in archive order.
    pub members: Vec<MemberData>,
    /// Paths this invocation wrote, besides `bundle.json`.
    pub written: Vec<String>,
    /// An in-memory parse's projections, by member path; they are not in
    /// `members` nor listed in the manifest. Empty for every other build.
    pub documents: BTreeMap<String, Document>,
}

impl Built {
    /// Assemble a bundle: sort the members, list them in the manifest and
    /// serialize it.
    pub fn assemble(
        stage: Stage,
        mut manifest: Manifest,
        mut members: Vec<MemberData>,
        mut written: Vec<String>,
    ) -> Self {
        members.sort_by(|a, b| a.path.cmp(&b.path));
        manifest.members = members.iter().map(MemberData::record).collect();
        written.sort();
        written.dedup();
        let manifest_bytes = to_bytes(&manifest);
        Self {
            stage,
            manifest,
            manifest_bytes,
            members,
            written,
            documents: BTreeMap::new(),
        }
    }

    /// Stream the canonical archive into `out`; return it and the archive
    /// size.
    pub fn write<W: Write>(&self, out: W, limits: &Limits) -> Outcome<(W, u64)> {
        let map = |error: WriteError| match error {
            WriteError::Io(error) => Failure::output(
                "output-write-failed",
                format!("the archive could not be written: {error}"),
            )
            .argument("output"),
            WriteError::Limit(failure) => *failure,
        };
        let mut writer = ZipWriter::new(out, limits);
        writer
            .add(MANIFEST_PATH, &self.manifest_bytes, limits)
            .map_err(map)?;
        for (member, prepared) in self.members.iter().zip(prepare_all(&self.members)) {
            match prepared {
                Prepared::Encoded(encoded) => {
                    let bytes = member
                        .bytes()
                        .ok_or_else(|| internal("an encoded member has no bytes"))?;
                    writer
                        .add_encoded(&member.path, bytes, &encoded, limits)
                        .map_err(map)?;
                }
                Prepared::Carried(carried) => writer
                    .add_copied(
                        &member.path,
                        carried.size,
                        carried.crc,
                        carried.deflated,
                        &carried.body,
                        limits,
                    )
                    .map_err(map)?,
            }
        }
        writer.finish(limits).map_err(map)
    }

    /// The record of this invocation's stage.
    #[must_use]
    pub fn stage_record(&self) -> StageRecord<'_> {
        StageRecord::of(&self.manifest, self.stage)
    }
}

/// A member ready to write: encoded from its bytes, or copied from `--in`.
enum Prepared<'a> {
    /// Deflated now, on this thread or another.
    Encoded(crate::zip::Encoded<'a>),
    /// Copied from the input archive's compressed body.
    Carried(&'a Carried),
}

/// Every member ready for the archive, in `members` order. Deflate is most of
/// a write, and members are independent, so they are encoded on up to eight
/// threads; carried members need no work. The archive is still written in
/// member order.
fn prepare_all(members: &[MemberData]) -> Vec<Prepared<'_>> {
    use std::sync::atomic::{AtomicUsize, Ordering};
    let jobs: Vec<usize> = members
        .iter()
        .enumerate()
        .filter(|(_, member)| member.bytes().is_some())
        .map(|(index, _)| index)
        .collect();
    let workers = std::thread::available_parallelism()
        .map_or(1, std::num::NonZero::get)
        .clamp(1, 8)
        .min(jobs.len().max(1));
    let next = AtomicUsize::new(0);
    let encoded: Vec<(usize, crate::zip::Encoded<'_>)> = std::thread::scope(|scope| {
        let handles: Vec<_> = (0..workers)
            .map(|_| {
                scope.spawn(|| {
                    let mut done = Vec::new();
                    loop {
                        let job = next.fetch_add(1, Ordering::Relaxed);
                        let Some(&index) = jobs.get(job) else {
                            break done;
                        };
                        let member = &members[index];
                        let bytes = member
                            .bytes()
                            .unwrap_or_else(|| unreachable!("a job names an encoded member"));
                        done.push((index, crate::zip::encode_member(bytes)));
                    }
                })
            })
            .collect();
        handles
            .into_iter()
            .flat_map(|handle| {
                handle
                    .join()
                    .unwrap_or_else(|panic| std::panic::resume_unwind(panic))
            })
            .collect()
    });
    let mut prepared: Vec<Option<Prepared<'_>>> = members.iter().map(|_| None).collect();
    for (index, encoded) in encoded {
        prepared[index] = Some(Prepared::Encoded(encoded));
    }
    prepared
        .into_iter()
        .zip(members)
        .map(|(ready, member)| match ready {
            Some(ready) => ready,
            None => Prepared::Carried(member.carried().unwrap_or_else(|| {
                unreachable!("a member without bytes is copied from the input archive")
            })),
        })
        .collect()
}

/// The shared fields of one stage record.
#[derive(Clone, Copy, Debug)]
pub struct StageRecord<'a> {
    /// The stage.
    pub stage: Stage,
    /// Its status.
    pub status: a3::BundleManifestStageStatus,
    /// Its content error.
    pub error: Option<&'a a3::CliFinding>,
    /// Its skip reason.
    pub skip_reason: Option<a3::BundleManifestSkipReason>,
    /// Its warnings.
    pub warnings: &'a [a3::Warning],
    /// Its failed members.
    pub failed_members: &'a [a3::BundleManifestMemberFailure],
}

impl<'a> StageRecord<'a> {
    /// The record of `stage` in `manifest`.
    #[must_use]
    pub fn of(manifest: &'a Manifest, stage: Stage) -> Self {
        let stages = &manifest.stages;
        match stage {
            Stage::Parse => Self {
                stage,
                status: stages.parse.status,
                error: stages.parse.error.as_ref(),
                skip_reason: None,
                warnings: &stages.parse.warnings,
                failed_members: &stages.parse.failed_members,
            },
            Stage::Board => Self {
                stage,
                status: stages.board.status,
                error: stages.board.error.as_ref(),
                skip_reason: stages.board.skip_reason,
                warnings: &stages.board.warnings,
                failed_members: &stages.board.failed_members,
            },
            Stage::Models => Self {
                stage,
                status: stages.models.status,
                error: stages.models.error.as_ref(),
                skip_reason: stages.models.skip_reason,
                warnings: &stages.models.warnings,
                failed_members: &stages.models.failed_members,
            },
        }
    }

    /// The three records of `manifest`, in stage order.
    #[must_use]
    pub fn all(manifest: &'a Manifest) -> [Self; 3] {
        [
            Self::of(manifest, Stage::Parse),
            Self::of(manifest, Stage::Board),
            Self::of(manifest, Stage::Models),
        ]
    }
}

/// Whether a KiCad that produced an input (`--refill-tool`, `--models-tool`)
/// may serve a generator pinned at `kicad_version`: the same major.minor,
/// any patch release (cli-spec.md §5.2.3, decisions.md "KiCad patch
/// releases").
#[must_use]
pub fn same_kicad_release(tool: &str, kicad_version: &str) -> bool {
    let minor = |version: &str| {
        let mut parts = version.split('.');
        (
            parts.next().map(str::to_owned),
            parts.next().map(str::to_owned),
        )
    };
    minor(tool) == minor(kicad_version)
}

pub(crate) fn internal(error: impl std::fmt::Display) -> Failure {
    Failure::internal(error.to_string())
}

#[cfg(test)]
mod tests {
    #[test]
    fn patch_releases_serve_the_pinned_kicad() {
        assert!(super::same_kicad_release("10.0.6", "10.0.6"));
        assert!(super::same_kicad_release("10.0.7", "10.0.6"));
        assert!(!super::same_kicad_release("10.1.0", "10.0.6"));
        assert!(!super::same_kicad_release("11.0.0", "10.0.6"));
    }
}
