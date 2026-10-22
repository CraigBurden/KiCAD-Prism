//! Geometer HLR for one connector: the persistent session, the STEP model
//! resolver and the per-model projection cache.
//!
//! The pose is `kicad_model_local_pose`'s (the model's own offset, rotation
//! and scale, the back-side flip and the board-thickness offset), so a view is
//! of the part in its footprint's frame, not of the board. Geometer's
//! `model_hlr_projection` takes the four view directions in one call and the
//! cache keeps each view under `(model sha256, pose, view)`; the mating-face
//! heuristic reads the model's 3D bounds against the pads' extent.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::bundle::{Bundle, LabError};
use geometer_client::contracts::{
    HlrCurveMode, HlrOutlineAlgorithm, HlrProjectionOptionsA0, HlrViewSpec,
};
use geometer_client::{GeometerClient, ModelBoundsRequest, ModelHlrProjectionRequest};
use prism_artwork::artwork::geometry::{Bounds, Point};
use prism_kicad_core::pcb::{
    PcbEmbeddedDataPresence, PcbEmbeddedFile, PcbEmbeddedFileOwner, PcbView,
};
use sha2::{Digest, Sha256};
use tokio::runtime::Runtime;

pub use super::pose::{ModelPose, Pose, local_pose};

/// `round_digits` and the sample count of the HLR option set.
const ROUND_DIGITS: u32 = 3;
const SAMPLES_PER_CURVE: u32 = 24;
/// The overhang a horizontal mating face needs, in millimetres.
const MIN_OVERHANG_MM: f64 = 0.5;

const EMBED_PREFIX: &str = "kicad-embed://";
const PRJ: &str = "\u{0}PRJ\u{0}";
const HOST: &str = "\u{0}HOST\u{0}";

/// One of the four views a sheet draws.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum ViewRole {
    /// Looking down the board normal.
    Top,
    /// The mating face, when the connector mates sideways.
    Front,
    /// The side, 90 degrees from the mating face.
    Side,
    /// A small isometric view.
    Iso,
}

impl ViewRole {
    /// The stable id used in markup and cache keys.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Top => "top",
            Self::Front => "front",
            Self::Side => "side",
            Self::Iso => "iso",
        }
    }

    /// The caption a sheet prints above the view.
    pub fn caption(self) -> &'static str {
        match self {
            Self::Top => "TOP",
            Self::Front => "FRONT",
            Self::Side => "SIDE",
            Self::Iso => "ISOMETRIC",
        }
    }
}

/// Which way a connector's mating face points, in its footprint's frame.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MatingFace {
    /// `+x`.
    PosX,
    /// `-x`.
    NegX,
    /// `+y`.
    PosY,
    /// `-y`.
    NegY,
    /// A vertical connector: the mating face is the top view.
    Top,
}

impl MatingFace {
    /// The direction the mating face looks along, `None` when it faces up.
    pub fn direction(self) -> Option<[f64; 3]> {
        match self {
            Self::PosX => Some([1.0, 0.0, 0.0]),
            Self::NegX => Some([-1.0, 0.0, 0.0]),
            Self::PosY => Some([0.0, 1.0, 0.0]),
            Self::NegY => Some([0.0, -1.0, 0.0]),
            Self::Top => None,
        }
    }

    /// `+x`, `-y`, … or `top`, for a caption.
    pub fn label(self) -> &'static str {
        match self {
            Self::PosX => "+x",
            Self::NegX => "\u{2212}x",
            Self::PosY => "+y",
            Self::NegY => "\u{2212}y",
            Self::Top => "top",
        }
    }

    /// The front view's direction and up vector.
    pub fn front(self) -> ([f64; 3], [f64; 3]) {
        let direction = self.direction().unwrap_or([0.0, 1.0, 0.0]);
        (direction, [0.0, 0.0, 1.0])
    }

    /// The side view's direction and up vector: the front turned 90 degrees.
    pub fn side(self) -> ([f64; 3], [f64; 3]) {
        let direction = match self {
            Self::PosX => [0.0, 1.0, 0.0],
            Self::NegX => [0.0, -1.0, 0.0],
            Self::PosY => [1.0, 0.0, 0.0],
            Self::NegY => [-1.0, 0.0, 0.0],
            Self::Top => [1.0, 0.0, 0.0],
        };
        (direction, [0.0, 0.0, 1.0])
    }
}

/// A model's overall extent after its pose, in the footprint's frame.
#[derive(Clone, Debug, PartialEq)]
pub struct ModelBounds {
    /// Minimum x, y and z.
    pub min: [f64; 3],
    /// Maximum x, y and z.
    pub max: [f64; 3],
}

impl ModelBounds {
    /// A bounds with no extent, which no model reports.
    pub fn is_empty(&self) -> bool {
        self.max[0] <= self.min[0] && self.max[1] <= self.min[1] && self.max[2] <= self.min[2]
    }

    /// Width, depth and height.
    pub fn size(&self) -> [f64; 3] {
        [
            (self.max[0] - self.min[0]).max(0.0),
            (self.max[1] - self.min[1]).max(0.0),
            (self.max[2] - self.min[2]).max(0.0),
        ]
    }
}

/// The mating-face heuristic: the side a connector hangs over, else the top.
///
/// `bounds` is the model's extent and `pads` the pads' extent, both in the
/// footprint's frame (the one the board file writes). A right-angle connector
/// overhangs the board edge it mates across, so the axis whose overhang is
/// most *asymmetric* decides the face: a body centred over its pads overhangs
/// equally on both sides and mates upwards, like a vertical header or a
/// mezzanine connector.
pub fn mating_face(bounds: &ModelBounds, pads: Bounds) -> MatingFace {
    if bounds.is_empty() || pads.is_empty() {
        return MatingFace::Top;
    }
    let positive_x = bounds.max[0] - pads.max_x;
    let negative_x = pads.min_x - bounds.min[0];
    let positive_y = bounds.max[1] - pads.max_y;
    let negative_y = pads.min_y - bounds.min[1];
    let net = [positive_x - negative_x, positive_y - negative_y];
    let axis = if net[0].abs() >= net[1].abs() { 0 } else { 1 };
    if net[axis].abs() <= MIN_OVERHANG_MM {
        return MatingFace::Top;
    }
    match (axis, net[axis] > 0.0) {
        (0, true) => MatingFace::PosX,
        (0, false) => MatingFace::NegX,
        (_, true) => MatingFace::PosY,
        (_, false) => MatingFace::NegY,
    }
}

/// One model-local arc, as Geometer returns it.
#[derive(Clone, Debug, PartialEq)]
pub struct ProjectedArc {
    /// Start point.
    pub start: [f64; 2],
    /// End point.
    pub end: [f64; 2],
    /// Centre point.
    pub center: [f64; 2],
    /// Radius.
    pub radius: f64,
    /// Angular extent in radians.
    pub extent_rad: f64,
    /// Counter-clockwise from start to end.
    pub ccw: bool,
    /// A full circle.
    pub full_circle: bool,
}

impl ProjectedArc {
    /// The arc as a polyline, sampled every few degrees.
    pub fn points(&self) -> Vec<Point> {
        let samples = if self.full_circle {
            SAMPLES_PER_CURVE as usize * 2
        } else {
            SAMPLES_PER_CURVE as usize
        };
        let start = (self.start[1] - self.center[1]).atan2(self.start[0] - self.center[0]);
        let extent = if self.full_circle {
            std::f64::consts::TAU
        } else {
            self.extent_rad
        };
        let sign = if self.ccw { 1.0 } else { -1.0 };
        (0..=samples)
            .map(|index| {
                let angle = start + sign * extent * index as f64 / samples as f64;
                Point {
                    x: self.center[0] + self.radius * angle.cos(),
                    y: self.center[1] + self.radius * angle.sin(),
                }
            })
            .collect()
    }
}

/// One view's projected edges, model-local millimetres.
#[derive(Clone, Debug)]
pub struct ProjectedView {
    /// Which view this is.
    pub role: ViewRole,
    /// The silhouette's straight edges, `[x1, y1, x2, y2]`.
    pub outline_segments: Vec<[f64; 4]>,
    /// The silhouette's circular edges.
    pub outline_arcs: Vec<ProjectedArc>,
    /// The visible detail's straight edges.
    pub detail_segments: Vec<[f64; 4]>,
    /// The visible detail's circular edges.
    pub detail_arcs: Vec<ProjectedArc>,
    /// The view's extent.
    pub bounds: Bounds,
}

impl ProjectedView {
    /// The view's extent, grown to include every edge.
    fn measured(
        role: ViewRole,
        outline_segments: Vec<[f64; 4]>,
        outline_arcs: Vec<ProjectedArc>,
        detail_segments: Vec<[f64; 4]>,
        detail_arcs: Vec<ProjectedArc>,
    ) -> Self {
        let mut bounds = Bounds::empty();
        for [x1, y1, x2, y2] in outline_segments.iter().chain(detail_segments.iter()) {
            bounds.include(Point { x: *x1, y: *y1 });
            bounds.include(Point { x: *x2, y: *y2 });
        }
        for arc in outline_arcs.iter().chain(detail_arcs.iter()) {
            for point in arc.points() {
                bounds.include(point);
            }
        }
        Self {
            role,
            outline_segments,
            outline_arcs,
            detail_segments,
            detail_arcs,
            bounds,
        }
    }
}

// ----------------------------------------------------------------- session

/// One persistent Geometer process for the whole run.
pub struct Session {
    runtime: Runtime,
    client: Option<GeometerClient>,
    release: String,
}

impl Session {
    /// Start `executable` and read its welcome.
    pub fn connect(executable: &Path) -> Result<Self, LabError> {
        let runtime = Runtime::new()
            .map_err(|error| LabError::new(format!("the async runtime failed: {error}")))?;
        let client = runtime
            .block_on(GeometerClient::spawn(
                executable,
                "prism-docs-lab",
                env!("CARGO_PKG_VERSION"),
            ))
            .map_err(|error| {
                LabError::new(format!(
                    "{} could not start Geometer: {error}",
                    executable.display()
                ))
            })?;
        let release = client.welcome().release_version.clone();
        Ok(Self {
            runtime,
            client: Some(client),
            release,
        })
    }

    /// The release version the runtime reported.
    pub fn release(&self) -> &str {
        &self.release
    }

    fn client(&self) -> &GeometerClient {
        self.client
            .as_ref()
            .expect("a connected session has a client")
    }

    /// Project `bytes` in the given views, mirroring u for a back-side part.
    fn project(
        &self,
        bytes: &[u8],
        matrix: [[f64; 4]; 4],
        plan: &[(ViewRole, [f64; 3], [f64; 3])],
        mirror_u: bool,
    ) -> Result<BTreeMap<ViewRole, ProjectedView>, LabError> {
        let mut flat = [0.0; 16];
        for (row, cells) in matrix.iter().enumerate() {
            flat[row * 4..row * 4 + 4].copy_from_slice(cells);
        }
        let options = HlrProjectionOptionsA0 {
            views: Some(
                plan.iter()
                    .map(|(role, direction, up)| HlrViewSpec {
                        id: role.as_str().to_owned(),
                        direction: *direction,
                        up: *up,
                    })
                    .collect(),
            ),
            output_outline: Some(true),
            output_detail: Some(true),
            output_bbox: None,
            model_transform: Some(flat),
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
                        model: bytes.to_vec(),
                        media_type: "application/step".to_owned(),
                        options,
                    }),
            )
            .map_err(|error| {
                LabError::new(format!("Geometer could not project a model: {error}"))
            })?;
        let mut views = BTreeMap::new();
        for (role, _, _) in plan {
            let Some(view) = result.views.iter().find(|view| view.id == role.as_str()) else {
                return Err(LabError::new(format!(
                    "Geometer returned no {} view",
                    role.as_str()
                )));
            };
            views.insert(*role, projected_view(*role, view, mirror_u));
        }
        Ok(views)
    }

    /// The model's 3D bounds after its pose.
    fn bounds(&self, bytes: &[u8], matrix: [[f64; 4]; 4]) -> Result<ModelBounds, LabError> {
        let mut flat = [0.0; 16];
        for (row, cells) in matrix.iter().enumerate() {
            flat[row * 4..row * 4 + 4].copy_from_slice(cells);
        }
        let result = self
            .runtime
            .block_on(self.client().model_bounds(ModelBoundsRequest {
                model: bytes.to_vec(),
                media_type: "application/step".to_owned(),
                options: geometer_client::contracts::ModelBoundsOptionsA0 {
                    format: None,
                    model_transform: Some(flat),
                },
            }))
            .map_err(|error| {
                LabError::new(format!("Geometer could not measure a model: {error}"))
            })?;
        let values = result.bounds;
        Ok(ModelBounds {
            min: values.min,
            max: values.max,
        })
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        if let Some(client) = self.client.take() {
            let _ = self.runtime.block_on(client.close());
        }
    }
}

fn projected_view(
    role: ViewRole,
    view: &geometer_client::contracts::HlrProjectedView,
    mirror_u: bool,
) -> ProjectedView {
    let mut outline_segments: Vec<[f64; 4]> = view.modes.outline.segments.clone();
    let mut detail_segments: Vec<[f64; 4]> = view.modes.detail.segments.clone();
    let mut outline_arcs: Vec<ProjectedArc> =
        view.modes.outline.arcs.iter().map(projected_arc).collect();
    let mut detail_arcs: Vec<ProjectedArc> =
        view.modes.detail.arcs.iter().map(projected_arc).collect();
    if mirror_u {
        for segment in outline_segments
            .iter_mut()
            .chain(detail_segments.iter_mut())
        {
            segment[0] = -segment[0];
            segment[2] = -segment[2];
        }
        for arc in outline_arcs.iter_mut().chain(detail_arcs.iter_mut()) {
            arc.start[0] = -arc.start[0];
            arc.end[0] = -arc.end[0];
            arc.center[0] = -arc.center[0];
            if !arc.full_circle {
                arc.ccw = !arc.ccw;
            }
        }
    }
    ProjectedView::measured(
        role,
        outline_segments,
        outline_arcs,
        detail_segments,
        detail_arcs,
    )
}

fn projected_arc(arc: &geometer_client::contracts::ProjectedArc) -> ProjectedArc {
    ProjectedArc {
        start: arc.start,
        end: arc.end,
        center: arc.center,
        radius: arc.radius,
        extent_rad: arc.extent_rad,
        ccw: arc.ccw,
        full_circle: arc.full_circle,
    }
}

// ------------------------------------------------------------------- cache

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
struct PoseKey {
    sha256: String,
    pose: Vec<u64>,
}

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
struct ViewKey {
    pose: PoseKey,
    role: ViewRole,
    plan: String,
}

/// The run's in-memory projection cache.
#[derive(Default)]
pub struct Cache {
    views: BTreeMap<ViewKey, ProjectedView>,
    bounds: BTreeMap<PoseKey, ModelBounds>,
}

impl Cache {
    /// A cache with nothing in it.
    pub fn new() -> Self {
        Self::default()
    }

    /// The model's bounds, measured once per model and pose.
    pub fn bounds(
        &mut self,
        session: &Session,
        bytes: &[u8],
        sha256: &str,
        pose: &Pose,
    ) -> Result<ModelBounds, LabError> {
        let key = PoseKey {
            sha256: sha256.to_owned(),
            pose: pose.bits(),
        };
        if let Some(bounds) = self.bounds.get(&key) {
            return Ok(bounds.clone());
        }
        let bounds = session.bounds(bytes, pose.matrix)?;
        self.bounds.insert(key, bounds.clone());
        Ok(bounds)
    }

    /// The four views, projecting only the ones the cache does not hold.
    pub fn views(
        &mut self,
        session: &Session,
        bytes: &[u8],
        sha256: &str,
        pose: &Pose,
        plan: &[(ViewRole, [f64; 3], [f64; 3])],
    ) -> Result<BTreeMap<ViewRole, ProjectedView>, LabError> {
        let plan_id = plan
            .iter()
            .map(|(role, direction, up)| {
                format!(
                    "{}:{:?}:{:?}",
                    role.as_str(),
                    direction.map(f64::to_bits),
                    up.map(f64::to_bits)
                )
            })
            .collect::<Vec<_>>()
            .join("|");
        let base = PoseKey {
            sha256: sha256.to_owned(),
            pose: pose.bits(),
        };
        let mut found = BTreeMap::new();
        let mut missing = Vec::new();
        for entry in plan {
            let key = ViewKey {
                pose: base.clone(),
                role: entry.0,
                plan: plan_id.clone(),
            };
            match self.views.get(&key) {
                Some(view) => {
                    found.insert(entry.0, view.clone());
                }
                None => missing.push(*entry),
            }
        }
        if !missing.is_empty() {
            let projected = session.project(bytes, pose.matrix, &missing, pose.mirror_u)?;
            for (role, view) in projected {
                let key = ViewKey {
                    pose: base.clone(),
                    role,
                    plan: plan_id.clone(),
                };
                self.views.insert(key, view.clone());
                found.insert(role, view);
            }
        }
        Ok(found)
    }
}

// ---------------------------------------------------------------- resolver

/// Where a footprint's model bytes come from.
pub struct ModelSource<'a> {
    /// The board's parsed view, for embedded files.
    pub view: &'a PcbView<'a>,
    /// The model's owning footprint index.
    pub footprint_index: usize,
    /// The board file's directory, a repository path.
    pub board_dir: &'a str,
    /// The project file's directory, a repository path (`${KIPRJMOD}`).
    pub project_dir: &'a str,
    /// The bundle, for `sources/` members.
    pub bundle: &'a Bundle,
    /// `--model-dir VAR=DIR`.
    pub model_dirs: &'a BTreeMap<String, PathBuf>,
}

/// The bytes of `reference`, or `None` when the bundle cannot supply them.
pub fn step_bytes(source: &ModelSource<'_>, reference: &str) -> Option<Vec<u8>> {
    if let Some(name) = reference.strip_prefix(EMBED_PREFIX) {
        return embedded_bytes(source, name);
    }
    match expand(
        reference,
        source.project_dir,
        source.board_dir,
        source.model_dirs,
    ) {
        Expanded::Sources(path) => source
            .bundle
            .member(&format!("sources/{path}"))
            .ok()
            .flatten(),
        Expanded::Host(path) => read_host(&path),
        Expanded::Missing => None,
    }
}

/// True when `path` names a STEP model.
pub fn is_step(path: &str) -> bool {
    let lowered = path.to_ascii_lowercase();
    lowered.ends_with(".step") || lowered.ends_with(".stp")
}

/// The lowercase hex SHA-256 of `bytes`.
pub fn sha256_hex(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

enum Expanded {
    Sources(String),
    Host(PathBuf),
    Missing,
}

/// Expand `${VAR}`, `$(VAR)` and `$VAR`, then classify the result.
///
/// `${VAR}` and `$VAR` follow Cruncher's `os.path.expandvars`; `$(VAR)` is
/// accepted as well because KiCad projects in the wild write it and the bundle
/// carries the file it names.
fn expand(
    raw: &str,
    project_dir: &str,
    board_dir: &str,
    model_dirs: &BTreeMap<String, PathBuf>,
) -> Expanded {
    let mut text = raw.to_owned();
    let mut host: Option<PathBuf> = None;
    let mut cursor = 0;
    while let Some(at) = text[cursor..].find('$').map(|at| cursor + at) {
        match variable_at(&text, at) {
            Some((name, end)) => {
                if let Some(replacement) = substitute(name, model_dirs, &mut host) {
                    text.replace_range(at..end, &replacement);
                    cursor = at + replacement.len();
                } else {
                    cursor = end;
                }
            }
            None => cursor = at + 1,
        }
    }
    if let Some(rest) = text.strip_prefix("${")
        && let Some((name, after)) = rest.split_once('}')
    {
        let replacement = substitute(name, model_dirs, &mut host).unwrap_or_default();
        text = format!("{replacement}{after}");
    }
    if let Some(rest) = text.strip_prefix(PRJ) {
        return join(project_dir, rest);
    }
    if let Some(rest) = text.strip_prefix(HOST) {
        return match host {
            Some(base) => Expanded::Host(base.join(rest.trim_start_matches('/'))),
            None => Expanded::Missing,
        };
    }
    if text.starts_with('/') {
        return Expanded::Missing;
    }
    join(board_dir, &text)
}

/// `$NAME`, `${NAME}` or `$(NAME)` at `at`.
fn variable_at(text: &str, at: usize) -> Option<(&str, usize)> {
    let bytes = text.as_bytes();
    let cursor = at + 1;
    let close = match *bytes.get(cursor)? {
        b'{' => b'}',
        b'(' => b')',
        _ => {
            let start = cursor;
            let mut end = start;
            while bytes
                .get(end)
                .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
            {
                end += 1;
            }
            if end == start {
                return None;
            }
            return Some((&text[start..end], end));
        }
    };
    let start = cursor + 1;
    let mut end = start;
    while bytes
        .get(end)
        .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
    {
        end += 1;
    }
    if end == start || bytes.get(end) != Some(&close) {
        return None;
    }
    Some((&text[start..end], end + 1))
}

fn substitute(
    name: &str,
    model_dirs: &BTreeMap<String, PathBuf>,
    host: &mut Option<PathBuf>,
) -> Option<String> {
    if name == "KIPRJMOD" {
        return Some(PRJ.to_owned());
    }
    let directory = model_dirs
        .get(name)
        .or_else(|| stock_fallback(name, model_dirs))?;
    *host = Some(directory.clone());
    Some(HOST.to_owned())
}

fn stock_major(name: &str) -> Option<u32> {
    name.strip_prefix("KICAD")?
        .strip_suffix("_3DMODEL_DIR")?
        .parse()
        .ok()
}

fn stock_fallback<'a>(
    name: &str,
    model_dirs: &'a BTreeMap<String, PathBuf>,
) -> Option<&'a PathBuf> {
    stock_major(name)?;
    model_dirs
        .iter()
        .filter_map(|(variable, directory)| stock_major(variable).map(|major| (major, directory)))
        .max_by_key(|(major, _)| *major)
        .map(|(_, directory)| directory)
}

fn join(base: &str, rest: &str) -> Expanded {
    let mut stack: Vec<&str> = Vec::new();
    for segment in base.split('/').chain(rest.split('/')) {
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            if stack.pop().is_none() {
                return Expanded::Missing;
            }
            continue;
        }
        stack.push(segment);
    }
    if stack.is_empty() {
        return Expanded::Missing;
    }
    Expanded::Sources(stack.join("/"))
}

fn embedded_bytes(source: &ModelSource<'_>, name: &str) -> Option<Vec<u8>> {
    let wanted = name.to_ascii_lowercase();
    let files: Vec<PcbEmbeddedFile> = source
        .view
        .all_embedded_files()
        .filter_map(Result::ok)
        .filter(|file| file.data_presence == PcbEmbeddedDataPresence::Encoded)
        .collect();
    let footprint = files.iter().find(|file| {
        matches!(
            file.owner,
            PcbEmbeddedFileOwner::EmbeddedFootprint { footprint_index }
                if footprint_index == source.footprint_index
        ) && file.name.to_ascii_lowercase() == wanted
    });
    let found = footprint.or_else(|| {
        files.iter().find(|file| {
            file.owner == PcbEmbeddedFileOwner::Board && file.name.to_ascii_lowercase() == wanted
        })
    })?;
    source
        .view
        .decode_embedded_file(
            found,
            prism_kicad_core::pcb::PcbEmbeddedDecodeLimits::default(),
        )
        .ok()
        .flatten()
}

fn read_host(path: &Path) -> Option<Vec<u8>> {
    const MAXIMUM: u64 = 512 * 1024 * 1024;
    let metadata = std::fs::metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > MAXIMUM {
        return None;
    }
    std::fs::read(path).ok()
}

/// `_board_thickness_mm`: the stackup's thickness-bearing layers, else the
/// board metadata, else 1.6 mm.
pub fn board_thickness(view: &PcbView<'_>) -> f64 {
    let Some(stackup) = view.setup().ok().flatten().and_then(|setup| setup.stackup) else {
        return metadata_thickness(view);
    };
    let total: f64 = stackup
        .layers
        .iter()
        .filter(|layer| counts_towards_thickness(&layer.type_name))
        .map(|layer| layer.thickness)
        .sum();
    if total > 0.0 {
        return total;
    }
    metadata_thickness(view)
}

fn metadata_thickness(view: &PcbView<'_>) -> f64 {
    let thickness = view
        .metadata()
        .ok()
        .map(|meta| meta.thickness)
        .unwrap_or(0.0);
    if thickness > 0.0 { thickness } else { 1.6 }
}

fn counts_towards_thickness(type_name: &str) -> bool {
    let lowered = type_name.to_ascii_lowercase();
    lowered == "copper"
        || lowered == "core"
        || lowered == "prepreg"
        || lowered.contains("solder mask")
        || lowered == "soldermask"
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bounds(min: [f64; 3], max: [f64; 3]) -> ModelBounds {
        ModelBounds { min, max }
    }

    fn pads(min_x: f64, min_y: f64, max_x: f64, max_y: f64) -> Bounds {
        let mut bounds = Bounds::empty();
        bounds.include(Point { x: min_x, y: min_y });
        bounds.include(Point { x: max_x, y: max_y });
        bounds
    }

    #[test]
    fn the_largest_overhang_is_the_mating_face() {
        let model = bounds([-2.0, -2.0, 0.0], [6.0, 3.0, 2.0]);
        assert_eq!(
            mating_face(&model, pads(-1.0, -1.0, 4.0, 2.0)),
            MatingFace::PosX
        );
        let model = bounds([-2.0, -8.0, 0.0], [6.0, 3.0, 2.0]);
        assert_eq!(
            mating_face(&model, pads(-1.0, -1.0, 4.0, 2.0)),
            MatingFace::NegY
        );
    }

    #[test]
    fn a_tall_part_with_no_overhang_mates_upwards() {
        let model = bounds([-2.0, -2.0, 0.0], [2.0, 2.0, 9.0]);
        assert_eq!(
            mating_face(&model, pads(-2.0, -2.0, 2.0, 2.0)),
            MatingFace::Top
        );
    }

    #[test]
    fn a_body_centred_over_its_pads_mates_upwards() {
        let model = bounds([-6.0, -2.0, 0.0], [6.0, 2.0, 2.0]);
        assert_eq!(
            mating_face(&model, pads(-6.0, -2.0, 6.0, 2.0)),
            MatingFace::Top
        );
        let model = bounds([-2.0, -6.0, 0.0], [2.0, 6.0, 2.0]);
        assert_eq!(
            mating_face(&model, pads(-2.0, -6.0, 2.0, 6.0)),
            MatingFace::Top
        );
    }

    #[test]
    fn an_asymmetric_overhang_decides_even_on_a_short_axis() {
        // A body that hangs 2 mm past the pads on -y and only 0.5 mm on +y.
        let model = bounds([-6.0, -3.0, 0.0], [6.0, 2.5, 2.0]);
        assert_eq!(
            mating_face(&model, pads(-6.0, -1.0, 6.0, 2.0)),
            MatingFace::NegY
        );
    }

    #[test]
    fn the_side_view_turns_the_mating_face_ninety_degrees() {
        assert_eq!(MatingFace::PosX.side().0, [0.0, 1.0, 0.0]);
        assert_eq!(MatingFace::NegY.side().0, [-1.0, 0.0, 0.0]);
        assert_eq!(MatingFace::Top.front().0, [0.0, 1.0, 0.0]);
    }

    #[test]
    fn an_arc_is_sampled_from_its_start_through_its_extent() {
        let arc = ProjectedArc {
            start: [1.0, 0.0],
            end: [0.0, 1.0],
            center: [0.0, 0.0],
            radius: 1.0,
            extent_rad: std::f64::consts::FRAC_PI_2,
            ccw: true,
            full_circle: false,
        };
        let points = arc.points();
        assert!((points[0].x - 1.0).abs() < 1e-9);
        let last = points.last().expect("samples");
        assert!(last.x.abs() < 1e-9 && (last.y - 1.0).abs() < 1e-9);
    }

    #[test]
    fn a_repository_model_resolves_through_the_bundle() {
        assert!(is_step("a/b.step"));
        assert!(is_step("a/b.STP"));
        assert!(!is_step("a/b.wrl"));
        assert!(matches!(
            expand("${KIPRJMOD}/x.step", "boards", "", &BTreeMap::new()),
            Expanded::Sources(path) if path == "boards/x.step"
        ));
    }

    #[test]
    fn the_parenthesised_variable_is_expanded_too() {
        assert!(matches!(
            expand("$(KIPRJMOD)/x.step", "boards", "", &BTreeMap::new()),
            Expanded::Sources(path) if path == "boards/x.step"
        ));
    }
}
