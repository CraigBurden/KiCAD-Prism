//! `models/assembly-hlr.json` (`prism.assembly_hlr.a0`), stage `models`
//! (ADR amendment C3 §3.1, cli-spec.md §5.2.4).
//!
//! For every footprint that names a 3D model, the hidden-line projection of
//! its first `.step`/`.stp` model: the silhouette (`outline`) and the visible
//! internal edges (`detail`), in KiCad's board frame in nanometres. A
//! footprint with no STEP model, no resolvable bytes or a failed projection
//! is listed with a `status`, never dropped.
//!
//! The projection is Geometer's `geometry.model_hlr_projection.a0` with the
//! option set `hlr_procedure` pins. The pose, the deduplication and the
//! back-side mirroring are Cruncher's (`kicad_cruncher_pcb_model_pose.py`,
//! `kicad_cruncher_pcb_svg_projection.py`), so the member reproduces today's
//! assembly outlines.

mod cache;
mod geometry;
pub mod pose;
pub mod resolve;

use crate::{Produced, Sources};
use cache::{Cache, Key};
use geometer_client::contracts::{
    HlrCurveMode, HlrOutlineAlgorithm, HlrProjectionOptionsA0, HlrViewSpec,
};
use geometer_client::{GeometerClient, GeometerClientError, ModelHlrProjectionRequest};
use geometry::EdgeSet;
use pose::{ModelPose, flat, local_pose};
use prism_kicad_contracts::generated::prism_assembly_hlr_a0::{
    AssemblyHlrA0, AssemblyHlrCurveMode, AssemblyHlrFootprint, AssemblyHlrModel,
    AssemblyHlrOptions, AssemblyHlrOutlineAlgorithm, AssemblyHlrPose, AssemblyHlrRotation3Deg,
    AssemblyHlrRuntime, AssemblyHlrScale3, AssemblyHlrStatus, AssemblyHlrVector3Nm, Count, Degrees,
    KiCadUuid, Nanometres, PointNm, Refdes, RepoPath, Sha256Hex, Side,
};
use prism_kicad_core::pcb::{PcbFootprint, PcbLimits, PcbModelReference, PcbView};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tokio::runtime::Runtime;

/// The member's archive path.
pub const MEMBER_PATH: &str = "models/assembly-hlr.json";
/// The member's schema id.
pub const SCHEMA: &str = "prism.assembly_hlr.a0";
/// The Geometer release this client is built against and `hlr_procedure`
/// names. `--geometer` must report it.
pub const GEOMETER_RELEASE: &str = "2026.9.19";
/// The C ABI generation of [`GEOMETER_RELEASE`].
pub const GEOMETER_C_ABI_GENERATION: u32 = 20_260_919;
/// The HLR option set token of the generator id's `hlr_procedure`.
pub const OPTIONS_TOKEN: &str = "assembly-hlr-a0";
/// `round_digits` and the sample count of the option set.
const ROUND_DIGITS: u32 = 3;
const SAMPLES_PER_CURVE: u32 = 24;

/// Why the producer could not finish.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HlrError {
    /// The board text or the bundle's own state is unusable: a defect.
    Internal(String),
    /// Geometer's process, protocol or framing failed. The stage fails and
    /// is retryable (cli-spec.md §5.2.4).
    Geometer(String),
}

impl HlrError {
    fn message(&self) -> &str {
        match self {
            Self::Internal(message) | Self::Geometer(message) => message,
        }
    }
}

impl std::fmt::Display for HlrError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.message())
    }
}

impl std::error::Error for HlrError {}

/// Why a Geometer runtime could not be used.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum GeometerError {
    /// The executable could not be started.
    Unavailable(String),
    /// It started but is not the pinned release and ABI.
    VersionMismatch {
        /// The release it reported.
        release: String,
        /// The C ABI generation it reported.
        c_abi_generation: u32,
    },
}

/// One persistent Geometer process for a whole stage.
pub struct GeometerSession {
    runtime: Runtime,
    client: Option<GeometerClient>,
    release: String,
}

impl GeometerSession {
    /// Start `executable` and check that it is `expected` release.
    pub fn connect(executable: &Path, expected: &str) -> Result<Self, GeometerError> {
        let runtime =
            Runtime::new().map_err(|error| GeometerError::Unavailable(error.to_string()))?;
        let client = runtime
            .block_on(GeometerClient::spawn(
                executable,
                "prism-kicad",
                env!("CARGO_PKG_VERSION"),
            ))
            .map_err(|error| GeometerError::Unavailable(error.to_string()))?;
        let welcome = client.welcome();
        if welcome.release_version != expected
            || welcome.c_abi_generation != GEOMETER_C_ABI_GENERATION
        {
            let error = GeometerError::VersionMismatch {
                release: welcome.release_version.clone(),
                c_abi_generation: welcome.c_abi_generation,
            };
            let _ = runtime.block_on(client.close());
            return Err(error);
        }
        let release = welcome.release_version.clone();
        Ok(Self {
            runtime,
            client: Some(client),
            release,
        })
    }

    /// The runtime's release version, as its welcome reports it.
    #[must_use]
    pub fn release(&self) -> &str {
        &self.release
    }

    fn client(&self) -> &GeometerClient {
        self.client
            .as_ref()
            .expect("a connected Geometer session has a client")
    }

    fn project(
        &self,
        step: Vec<u8>,
        matrix: [f64; 16],
        bottom: bool,
    ) -> Result<ProjectedModel, HlrError> {
        let (id, direction) = if bottom {
            ("bottom", [0.0, 0.0, -1.0])
        } else {
            ("top", [0.0, 0.0, 1.0])
        };
        let request = HlrProjectionOptionsA0 {
            views: Some(vec![HlrViewSpec {
                id: id.to_owned(),
                direction,
                up: [0.0, 1.0, 0.0],
            }]),
            output_outline: Some(true),
            output_detail: Some(true),
            output_bbox: None,
            model_transform: Some(matrix),
            strip_root_placement: None,
            curve_mode: Some(HlrCurveMode::NativeArcs),
            samples_per_curve: Some(SAMPLES_PER_CURVE),
            round_digits: Some(ROUND_DIGITS),
            edge_v_sharp: None,
            edge_v_outline: None,
            edge_v_smooth: None,
            edge_v_sewn: None,
            edge_v_iso: None,
            edge_h_sharp: None,
            edge_h_outline: None,
            edge_h_smooth: None,
            edge_h_sewn: None,
            edge_h_iso: None,
            union_outline_polygons: Some(true),
            projection_algorithm: None,
            mesh_linear_deflection: None,
            mesh_angular_deflection: None,
            mesh_relative: None,
            mesh_deflection_mode: None,
            mesh_deflection_coefficient: None,
            outline_algorithm: Some(HlrOutlineAlgorithm::MeshShadow),
            hlr_angle_tolerance: None,
            fast: None,
        };
        let result = self
            .runtime
            .block_on(
                self.client()
                    .model_hlr_projection(ModelHlrProjectionRequest {
                        model: step,
                        media_type: "application/step".to_owned(),
                        options: request,
                    }),
            )
            .map_err(|error| match error {
                GeometerClientError::Operation { .. } => HlrError::Internal(error.to_string()),
                _ => HlrError::Geometer(error.to_string()),
            })?;
        let view = result
            .views
            .iter()
            .find(|view| view.id == id)
            .ok_or_else(|| HlrError::Internal(format!("Geometer returned no {id} view")))?;
        Ok(ProjectedModel {
            outline: projected(&view.modes.outline),
            detail: projected(&view.modes.detail),
        })
    }
}

impl Drop for GeometerSession {
    fn drop(&mut self) {
        if let Some(client) = self.client.take() {
            let _ = self.runtime.block_on(client.close());
        }
    }
}

/// One model's raw projected geometry, millimetres.
struct ProjectedModel {
    outline: EdgeSet,
    detail: EdgeSet,
}

fn projected(geometry: &geometer_client::contracts::ProjectedGeometry) -> EdgeSet {
    EdgeSet {
        segments: geometry.segments.clone(),
        arcs: geometry
            .arcs
            .iter()
            .map(|arc| geometry::Arc {
                start: arc.start,
                end: arc.end,
                center: arc.center,
                radius: arc.radius,
                extent_rad: arc.extent_rad,
                ccw: arc.ccw,
                full_circle: arc.full_circle,
            })
            .collect(),
    }
}

/// Everything stage `models` knows about the board.
pub struct AssemblyHlrRequest<'a> {
    /// The board file's repository path (the member's `documentPath`).
    pub document_path: &'a str,
    /// The board text, as the bundle holds it.
    pub board_text: &'a str,
    /// The board file's directory, a repository path (empty at the root).
    pub board_dir: &'a str,
    /// The project file's directory, a repository path (`${KIPRJMOD}`).
    pub project_dir: &'a str,
    /// The source set stage parse recorded.
    pub sources: &'a dyn Sources,
    /// `--model-dir VAR=dir`.
    pub model_dirs: &'a BTreeMap<String, PathBuf>,
    /// `--hlr-cache`.
    pub cache: Option<&'a Path>,
    /// The one Geometer process of the stage.
    pub geometer: &'a GeometerSession,
}

/// Build `models/assembly-hlr.json`.
pub fn produce(request: AssemblyHlrRequest<'_>) -> Result<Produced<AssemblyHlrA0>, HlrError> {
    let view = PcbView::parse(request.board_text, PcbLimits::default()).map_err(|error| {
        // The byte count lets a failure be compared with the member's size in
        // the manifest: stage board parsed the same member before this ran.
        HlrError::Internal(format!(
            "assembly-hlr: the board does not parse ({} bytes): {error}",
            request.board_text.len()
        ))
    })?;
    let thickness = board_thickness(&view)?;
    let models = models_by_footprint(&view)?;
    let cache = request.cache.map(Cache::new);
    let mut footprints = Vec::new();
    for (index, footprint) in view.footprints().enumerate() {
        let Some(own) = models.get(&index) else {
            continue;
        };
        if own.is_empty() {
            continue;
        }
        let footprint = footprint.map_err(|error| {
            HlrError::Internal(format!(
                "assembly-hlr: a footprint does not decode: {error}"
            ))
        })?;
        footprints.push(footprint_row(
            &request,
            &view,
            footprint,
            index,
            own,
            thickness,
            cache.as_ref(),
        )?);
    }
    footprints.sort_by(|left, right| {
        (left.document_path.as_str(), left.uuid.as_str())
            .cmp(&(right.document_path.as_str(), right.uuid.as_str()))
    });
    Ok(Produced::new(AssemblyHlrA0 {
        schema: SCHEMA.to_owned(),
        options: options(),
        runtime: AssemblyHlrRuntime {
            geometer_version: request.geometer.release().to_owned(),
        },
        footprints,
    }))
}

/// Build one footprint's row.
fn footprint_row(
    request: &AssemblyHlrRequest<'_>,
    view: &PcbView<'_>,
    footprint: PcbFootprint,
    index: usize,
    models: &[PcbModelReference],
    thickness: f64,
    cache: Option<&Cache<'_>>,
) -> Result<AssemblyHlrFootprint, HlrError> {
    let bottom = footprint
        .layer
        .as_deref()
        .is_some_and(|layer| layer.starts_with("B."));
    let mut row = AssemblyHlrFootprint {
        document_path: RepoPath(request.document_path.to_owned()),
        uuid: KiCadUuid(footprint.uuid.clone().unwrap_or_default()),
        reference: footprint
            .reference
            .clone()
            .filter(|value| !value.is_empty())
            .and_then(|value| Refdes::try_from(value).ok()),
        side: if bottom { Side::Back } else { Side::Front },
        step_model: None,
        pose: None,
        outline: None,
        detail: None,
        status: None,
    };
    let Some(model) = models.iter().find(|model| is_step(&model.path)) else {
        row.status = Some(AssemblyHlrStatus::ModelNotStep);
        return Ok(row);
    };
    let reference = model.path.clone();
    let source = resolve::ModelSource {
        view,
        footprint_index: index,
        board_dir: request.board_dir,
        project_dir: request.project_dir,
        sources: request.sources,
        model_dirs: request.model_dirs,
    };
    let Some(bytes) = resolve::step_bytes(&source, &reference) else {
        row.step_model = Some(AssemblyHlrModel {
            reference,
            sha256: None,
        });
        row.status = Some(AssemblyHlrStatus::ModelUnavailable);
        return Ok(row);
    };
    let sha256 = hex(&Sha256::digest(&bytes));
    row.step_model = Some(AssemblyHlrModel {
        reference,
        sha256: Some(Sha256Hex(sha256.clone())),
    });
    let board_position = [
        footprint.at_x.unwrap_or_default(),
        footprint.at_y.unwrap_or_default(),
    ];
    let rotation = footprint.angle.unwrap_or_default();
    let Some((outline, detail)) =
        project_or_reuse(request, model, &bytes, &sha256, bottom, thickness, cache)?
    else {
        row.status = Some(AssemblyHlrStatus::ProjectionFailed);
        return Ok(row);
    };
    row.pose = Some(pose(model, board_position, rotation));
    row.outline = Some(geometry::to_edges(&outline, board_position, rotation));
    row.detail = Some(geometry::to_edges(&detail, board_position, rotation));
    Ok(row)
}

/// The pose the member records: the footprint placement and the model's own
/// offset, rotation and scale, as written.
fn pose(model: &PcbModelReference, position: [f64; 2], rotation: f64) -> AssemblyHlrPose {
    AssemblyHlrPose {
        position_nm: PointNm {
            x_nm: Nanometres(geometry::nm(position[0])),
            y_nm: Nanometres(geometry::nm(position[1])),
        },
        rotation_deg: Degrees(rotation),
        model_offset: AssemblyHlrVector3Nm {
            x_nm: Nanometres(geometry::nm(model.offset[0])),
            y_nm: Nanometres(geometry::nm(model.offset[1])),
            z_nm: Nanometres(geometry::nm(model.offset[2])),
        },
        model_rotation: AssemblyHlrRotation3Deg {
            x_deg: Degrees(model.rotate[0]),
            y_deg: Degrees(model.rotate[1]),
            z_deg: Degrees(model.rotate[2]),
        },
        model_scale: AssemblyHlrScale3 {
            x: model.scale[0],
            y: model.scale[1],
            z: model.scale[2],
        },
    }
}

/// One model's deduped, mirrored edge sets, from the cache or Geometer.
/// `None` means Geometer rejected this model (`projection-failed`).
fn project_or_reuse(
    request: &AssemblyHlrRequest<'_>,
    model: &PcbModelReference,
    bytes: &[u8],
    sha256: &str,
    bottom: bool,
    thickness: f64,
    cache: Option<&Cache<'_>>,
) -> Result<Option<(EdgeSet, EdgeSet)>, HlrError> {
    let local = local_pose(
        &ModelPose {
            offset: model.offset,
            rotate: model.rotate,
            scale: model.scale,
        },
        bottom,
        thickness,
    );
    let key = Key {
        model_sha256: sha256.to_owned(),
        pose_signature: local
            .matrix
            .iter()
            .flat_map(|row| row.iter())
            .map(|value| value.to_bits())
            .collect(),
        runtime: request.geometer.release().to_owned(),
        options: OPTIONS_TOKEN.to_owned(),
    };
    if let Some(geometry) = cache.and_then(|cache| cache.load(&key)) {
        return Ok(Some(geometry));
    }
    let projected = match request
        .geometer
        .project(bytes.to_vec(), flat(&local.matrix), bottom)
    {
        Ok(projected) => projected,
        Err(HlrError::Internal(_)) => return Ok(None),
        Err(error) => return Err(error),
    };
    let outline = finish(projected.outline, bottom);
    let detail = finish(projected.detail, bottom);
    if let Some(cache) = cache {
        cache.store(&key, &outline, &detail);
    }
    Ok(Some((outline, detail)))
}

fn finish(set: EdgeSet, bottom: bool) -> EdgeSet {
    let set = set.dedupe(ROUND_DIGITS);
    if bottom { set.mirror_x() } else { set }
}

fn is_step(path: &str) -> bool {
    let lowered = path.to_ascii_lowercase();
    lowered.ends_with(".step") || lowered.ends_with(".stp")
}

fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

fn models_by_footprint(
    view: &PcbView<'_>,
) -> Result<BTreeMap<usize, Vec<PcbModelReference>>, HlrError> {
    let mut map: BTreeMap<usize, Vec<PcbModelReference>> = BTreeMap::new();
    for model in view.models() {
        let model = model.map_err(|error| {
            HlrError::Internal(format!("assembly-hlr: a model does not decode: {error}"))
        })?;
        map.entry(model.footprint_index).or_default().push(model);
    }
    Ok(map)
}

/// `_board_thickness_mm` (`kicad_cruncher_pcb_model_pose.py:190-207`): the
/// stackup's copper, dielectric and solder-mask layers, else the general
/// thickness, else 1.6 mm.
fn board_thickness(view: &PcbView<'_>) -> Result<f64, HlrError> {
    let setup = view.setup().map_err(|error| {
        HlrError::Internal(format!(
            "assembly-hlr: the board setup does not decode: {error}"
        ))
    })?;
    if let Some(stackup) = setup.and_then(|setup| setup.stackup) {
        let total: f64 = stackup
            .layers
            .iter()
            .filter(|layer| counts_towards_thickness(&layer.type_name))
            .map(|layer| layer.thickness)
            .sum();
        if total > 0.0 {
            return Ok(total);
        }
    }
    let thickness = view
        .metadata()
        .map_err(|error| {
            HlrError::Internal(format!(
                "assembly-hlr: the board metadata does not decode: {error}"
            ))
        })?
        .thickness;
    Ok(if thickness > 0.0 { thickness } else { 1.6 })
}

/// `StackupLayer.get_item_type`'s three thickness-bearing families.
fn counts_towards_thickness(type_name: &str) -> bool {
    let lowered = type_name.to_ascii_lowercase();
    lowered == "copper"
        || lowered == "core"
        || lowered == "prepreg"
        || lowered.contains("solder mask")
        || lowered == "soldermask"
}

/// The fixed HLR option set (`hlr_procedure`'s `assembly-hlr-a0`).
fn options() -> AssemblyHlrOptions {
    AssemblyHlrOptions {
        projection_algorithm: None,
        outline_algorithm: AssemblyHlrOutlineAlgorithm::MeshShadow,
        curve_mode: AssemblyHlrCurveMode::NativeArcs,
        samples_per_curve: Count(u64::from(SAMPLES_PER_CURVE)),
        round_digits: Count(u64::from(ROUND_DIGITS)),
        include_visible: true,
        include_outline: true,
        union_polygons: true,
        mesh_linear_deflection: None,
        mesh_angular_deflection: None,
        mesh_relative: None,
        hlr_angle_tolerance: None,
        edge_flags: None,
    }
}
