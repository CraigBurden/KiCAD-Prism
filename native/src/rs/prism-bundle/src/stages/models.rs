//! Stage `models` (cli-spec.md §5.2.4): check the backend's
//! `kicad-cli pcb export glb` output, canonicalize its wall-clock
//! `asset.extras.generated_at` and add it as `viewer/models/components.glb`.

use super::chain::{self, Input};
use super::{Built, Generator, MemberContent, MemberData, Reporter};
use crate::finding::{Failure, Outcome};
use crate::limits::Limits;
use crate::manifest::{
    ASSEMBLY_HLR_PATH, MODELS_PATH, REFILLED_PREFIX, Role, SOURCES_PREFIX, Stage, Status,
};
use crate::revision_key::EffectiveConfig;
pub use prism_projections::assembly_hlr::{
    GEOMETER_C_ABI_GENERATION, GEOMETER_RELEASE, GeometerError, GeometerSession, OPTIONS_TOKEN,
};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// The fixed time the GLB's `generated_at` is rewritten to: the zip writer's.
pub const FIXED_TIME: &str = "1980-01-01T00:00:00";
const GLB_MAGIC: &[u8; 4] = b"glTF";
const JSON_CHUNK: u32 = 0x4E4F_534A;
const KEY: &[u8] = b"\"generated_at\"";

fn invalid(message: &str) -> Failure {
    Failure::input(
        "models-glb-invalid",
        format!("--models-glb is not a glTF 2.0 binary KiCad wrote: {message}"),
    )
    .argument("models-glb")
    .at_path(MODELS_PATH)
}

fn u32_at(bytes: &[u8], at: usize) -> Option<u32> {
    bytes
        .get(at..at + 4)
        .map(|field| u32::from_le_bytes([field[0], field[1], field[2], field[3]]))
}

fn is_timestamp(value: &[u8]) -> bool {
    value.len() == 19
        && value.iter().enumerate().all(|(index, byte)| match index {
            4 | 7 => *byte == b'-',
            10 => *byte == b'T',
            13 | 16 => *byte == b':',
            _ => byte.is_ascii_digit(),
        })
}

/// The offset of the `generated_at` value inside `chunk`, if the key occurs.
fn generated_at(chunk: &[u8]) -> Result<Option<usize>, Failure> {
    let occurrences: Vec<usize> = chunk
        .windows(KEY.len())
        .enumerate()
        .filter(|(_, window)| *window == KEY)
        .map(|(at, _)| at)
        .collect();
    match occurrences.as_slice() {
        [] => Ok(None),
        [at] => {
            let mut cursor = at + KEY.len();
            let skip = |cursor: &mut usize| {
                while chunk.get(*cursor).is_some_and(u8::is_ascii_whitespace) {
                    *cursor += 1;
                }
            };
            skip(&mut cursor);
            if chunk.get(cursor) != Some(&b':') {
                return Err(invalid("generated_at is not a key"));
            }
            cursor += 1;
            skip(&mut cursor);
            let quoted = chunk.get(cursor) == Some(&b'"') && chunk.get(cursor + 20) == Some(&b'"');
            let value = chunk.get(cursor + 1..cursor + 20).unwrap_or_default();
            if !quoted || !is_timestamp(value) {
                return Err(invalid(
                    "asset.extras.generated_at is not of the form YYYY-MM-DDTHH:MM:SS",
                ));
            }
            Ok(Some(cursor + 1))
        }
        _ => Err(invalid("generated_at occurs more than once")),
    }
}

/// Check `bytes` as KiCad's component GLB and return its canonical form.
pub fn canonicalize(mut bytes: Vec<u8>) -> Outcome<Vec<u8>> {
    if bytes.len() < 20 || &bytes[..4] != GLB_MAGIC {
        return Err(invalid("no glTF magic"));
    }
    if u32_at(&bytes, 4) != Some(2) {
        return Err(invalid("not version 2"));
    }
    let declared = u32_at(&bytes, 8).and_then(|length| usize::try_from(length).ok());
    if declared != Some(bytes.len()) {
        return Err(invalid("the header length is not the file size"));
    }
    let chunk_length = u32_at(&bytes, 12)
        .and_then(|length| usize::try_from(length).ok())
        .unwrap_or(usize::MAX);
    if u32_at(&bytes, 16) != Some(JSON_CHUNK) || chunk_length > bytes.len() - 20 {
        return Err(invalid("the first chunk is not JSON"));
    }
    let chunk = &bytes[20..20 + chunk_length];
    let document: serde_json::Value =
        serde_json::from_slice(chunk).map_err(|_| invalid("the JSON chunk does not parse"))?;
    let extras = &document["asset"]["extras"];
    if let Some(name) = extras.get("source_pcb_file")
        && name != "components.glb"
    {
        return Err(Failure::precondition(
            "models-glb-name",
            "the GLB was not exported as components.glb",
        )
        .argument("models-glb"));
    }
    let found = generated_at(chunk)?;
    match (found, extras.get("generated_at")) {
        (Some(at), Some(_)) => {
            bytes[20 + at..20 + at + 19].copy_from_slice(FIXED_TIME.as_bytes());
        }
        (None, None) => {}
        _ => return Err(invalid("generated_at is not asset.extras.generated_at")),
    }
    Ok(bytes)
}

/// The inputs of stage models.
pub struct ModelsRequest<'a> {
    /// The loaded `--in` bundle.
    pub input: &'a Input,
    /// `--models-glb` bytes.
    pub glb: Vec<u8>,
    /// `--models-tool`.
    pub tool: String,
    /// `--revision-key`, an assertion.
    pub revision_key: Option<&'a str>,
    /// `--config`, an assertion.
    pub config: Option<&'a EffectiveConfig>,
    /// This binary's generator.
    pub generator: &'a Generator,
    /// Limits.
    pub limits: &'a Limits,
    /// Diagnostics.
    pub reporter: &'a dyn Reporter,
    /// `--geometer`: one connected runtime for the stage. Without it the
    /// stage writes no assembly HLR member (cli-spec.md §5.2.4).
    pub geometer: Option<&'a GeometerSession>,
    /// `--model-dir VAR=dir`.
    pub model_dirs: &'a BTreeMap<String, PathBuf>,
    /// `--hlr-cache`.
    pub hlr_cache: Option<&'a Path>,
}

/// Run stage models.
pub fn run(mut request: ModelsRequest<'_>) -> Outcome<Built> {
    let input = request.input;
    chain::check(
        input,
        Stage::Models,
        request.generator,
        request.revision_key,
        request.config,
    )?;
    if !super::same_kicad_release(&request.tool, &request.generator.document.kicad_version.0) {
        return Err(Failure::precondition(
            "kicad-version-mismatch",
            format!(
                "--models-tool {} is not the major.minor of the generator's KiCad {}",
                request.tool, request.generator.document.kicad_version.0
            ),
        )
        .argument("models-tool"));
    }
    let glb = canonicalize(std::mem::take(&mut request.glb))?;
    request.limits.check(
        crate::limits::LimitName::MaxMemberBytes,
        u64::try_from(glb.len()).unwrap_or(u64::MAX),
        MODELS_PATH,
    )?;
    let mut members = chain::earlier_members(input, Stage::Models);
    let mut written = vec![MODELS_PATH.to_owned()];
    members.push(MemberData {
        path: MODELS_PATH.to_owned(),
        role: Role::ComponentModels,
        content: MemberContent::Bytes(std::sync::Arc::from(glb)),
        schema: None,
        source: None,
    });
    if let Some(geometer) = request.geometer
        && let Some(member) = assembly_hlr(&request, geometer)?
    {
        request.limits.check(
            crate::limits::LimitName::MaxMemberBytes,
            member.size(),
            ASSEMBLY_HLR_PATH,
        )?;
        written.push(ASSEMBLY_HLR_PATH.to_owned());
        members.push(member);
    }
    let mut manifest = input.manifest.clone();
    manifest.stages.models = crate::manifest::models_stage(Status::Complete, None);
    request
        .reporter
        .info("stage-finished", "stage models is complete");
    Ok(Built::assemble(Stage::Models, manifest, members, written))
}

/// `models/assembly-hlr.json`, when the stage has a Geometer runtime.
fn assembly_hlr(
    request: &ModelsRequest<'_>,
    geometer: &GeometerSession,
) -> Outcome<Option<MemberData>> {
    let input = request.input;
    let Some(board) = input.manifest.config.board.as_ref() else {
        return Ok(None);
    };
    let board_path = board.as_str();
    let refilled = format!("{REFILLED_PREFIX}{}", crate::paths::file_name(board_path));
    let document = input
        .member(&refilled)
        .or_else(|| input.member(&format!("{SOURCES_PREFIX}{board_path}")))
        .ok_or_else(|| {
            Failure::internal("stage models has no board member for the assembly HLR")
        })?;
    let text = std::str::from_utf8(&document)
        .map_err(|_| Failure::internal("the board member is not UTF-8"))?;
    let project_dir = crate::paths::parent(input.manifest.config.project_file.as_str());
    let sources = BundleSources { input };
    let produced = prism_projections::assembly_hlr::produce(
        prism_projections::assembly_hlr::AssemblyHlrRequest {
            document_path: board_path,
            board_text: text,
            board_dir: crate::paths::parent(board_path),
            project_dir,
            sources: &sources,
            model_dirs: request.model_dirs,
            cache: request.hlr_cache,
            geometer,
        },
    )
    .map_err(|error| match error {
        prism_projections::assembly_hlr::HlrError::Geometer(message) => Failure::internal(format!(
            "Geometer failed while projecting an assembly model: {message}"
        )),
        prism_projections::assembly_hlr::HlrError::Internal(message) => Failure::internal(message),
    })?;
    let bytes = crate::manifest::json_bytes(&produced.document);
    Ok(Some(MemberData {
        path: ASSEMBLY_HLR_PATH.to_owned(),
        role: Role::AssemblyHlr,
        content: MemberContent::Bytes(std::sync::Arc::from(bytes)),
        schema: Some(prism_projections::assembly_hlr::SCHEMA.to_owned()),
        source: None,
    }))
}

/// The bundle's `sources/` members as the projection [`Sources`] the model
/// resolver reads.
struct BundleSources<'a> {
    input: &'a Input,
}

impl prism_projections::Sources for BundleSources<'_> {
    fn read(&self, path: &str) -> Option<std::sync::Arc<[u8]>> {
        self.input.member(&format!("{SOURCES_PREFIX}{path}"))
    }

    fn exists(&self, path: &str) -> bool {
        let member = format!("{SOURCES_PREFIX}{path}");
        self.input
            .members
            .iter()
            .any(|candidate| candidate.path == member)
    }

    fn list(&self, dir: &str, suffixes: &[&str]) -> Vec<String> {
        let prefix = if dir.is_empty() {
            SOURCES_PREFIX.to_owned()
        } else {
            format!("{SOURCES_PREFIX}{dir}/")
        };
        self.input
            .members
            .iter()
            .filter_map(|member| member.path.strip_prefix(&prefix))
            .filter(|path| {
                let name = path.rsplit('/').next().unwrap_or(path).to_ascii_lowercase();
                suffixes.is_empty() || suffixes.iter().any(|suffix| name.ends_with(suffix))
            })
            .map(str::to_owned)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn glb(json: &str) -> Vec<u8> {
        let mut chunk = json.as_bytes().to_vec();
        while !chunk.len().is_multiple_of(4) {
            chunk.push(b' ');
        }
        let length = 12 + 8 + chunk.len();
        let mut out = Vec::new();
        out.extend_from_slice(b"glTF");
        out.extend_from_slice(&2u32.to_le_bytes());
        out.extend_from_slice(&u32::try_from(length).unwrap().to_le_bytes());
        out.extend_from_slice(&u32::try_from(chunk.len()).unwrap().to_le_bytes());
        out.extend_from_slice(&JSON_CHUNK.to_le_bytes());
        out.extend_from_slice(&chunk);
        out
    }

    #[test]
    fn rewrites_only_the_timestamp() {
        let one = glb(
            r#"{"asset":{"extras":{"source_pcb_file":"components.glb","generated_at":"2026-10-16T06:32:25"}}}"#,
        );
        let two = glb(
            r#"{"asset":{"extras":{"source_pcb_file":"components.glb","generated_at":"2026-10-16T06:32:26"}}}"#,
        );
        let canonical = canonicalize(one.clone()).unwrap();
        assert_eq!(canonical.len(), one.len());
        assert_eq!(canonical, canonicalize(two).unwrap());
        assert!(String::from_utf8_lossy(&canonical).contains(FIXED_TIME));
    }

    #[test]
    fn rejects_other_names_and_forms() {
        let named = glb(r#"{"asset":{"extras":{"source_pcb_file":"x.glb"}}}"#);
        assert_eq!(
            canonicalize(named).unwrap_err().finding.code,
            "models-glb-name"
        );
        let odd = glb(r#"{"asset":{"extras":{"generated_at":"yesterday"}}}"#);
        assert_eq!(
            canonicalize(odd).unwrap_err().finding.code,
            "models-glb-invalid"
        );
        let mut short = glb("{}");
        short.push(0);
        assert_eq!(
            canonicalize(short).unwrap_err().finding.code,
            "models-glb-invalid"
        );
    }
}
