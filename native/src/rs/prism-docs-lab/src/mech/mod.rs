//! The mechanical outline sheet: one A3 third-angle drawing of a board from a
//! design bundle.
//!
//! [`board`] reads the bundle without Geometer; [`geometer`] adds measured
//! part heights and the elevation silhouettes; [`layout`] chooses the scale
//! and the three view cells; [`sheet`] renders the SVGs, the HTML index and
//! the print page. Everything is deterministic: no clock, no environment and
//! no unordered iteration reaches the output.

pub mod board;
mod draw;
pub mod geometer;
pub mod layout;
pub mod sheet;
pub mod table;
mod tables;
mod views;

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use prism_artwork::artwork::geometry::Point;
use prism_kicad_core::{PcbLimits, PcbView};
use prism_projections::Sources;
use prism_projections::assembly_hlr::pose::{ModelPose, local_pose};
use prism_projections::assembly_hlr::resolve::{self, ModelSource};
use sha2::{Digest, Sha256};

use crate::bundle::{Bundle, LabError};

pub use board::{
    Board, DEFAULT_THICKNESS_MM, Edge, Height, HeightSource, HoleRow, Overhang, Part, Side,
};
pub use geometer::Geometer;

/// What one measurement pass did.
pub struct Measurement {
    /// The Geometer release, when a session ran.
    pub geometer: Option<String>,
    /// Models whose bounds were measured.
    pub measured: usize,
    /// Parts with a resolvable STEP model.
    pub models: usize,
    /// Geometer requests actually sent.
    pub requests: usize,
    /// Non-fatal failures, one line each.
    pub warnings: Vec<String>,
}

/// The source set a model reference may resolve through: the bundle's
/// `sources/` STEP files, held in memory so the session has no lifetime.
struct StepSources {
    files: BTreeMap<String, Arc<[u8]>>,
}

impl StepSources {
    fn load(bundle: &Bundle) -> Result<Self, LabError> {
        let mut files = BTreeMap::new();
        for member in &bundle.manifest().members {
            let path = member.path.0.as_str();
            let Some(rest) = path.strip_prefix("sources/") else {
                continue;
            };
            if !is_step(rest) {
                continue;
            }
            let Some(bytes) = bundle.member(path)? else {
                continue;
            };
            files.insert(rest.to_owned(), Arc::from(bytes));
        }
        Ok(Self { files })
    }
}

impl Sources for StepSources {
    fn read(&self, path: &str) -> Option<Arc<[u8]>> {
        self.files.get(path).cloned()
    }

    fn exists(&self, path: &str) -> bool {
        self.files.contains_key(path)
    }

    fn list(&self, dir: &str, suffixes: &[&str]) -> Vec<String> {
        let prefix = if dir.is_empty() {
            String::new()
        } else {
            format!("{}/", dir.trim_end_matches('/'))
        };
        self.files
            .keys()
            .filter(|path| path.starts_with(&prefix))
            .filter(|path| {
                suffixes.is_empty()
                    || suffixes.iter().any(|suffix| {
                        path.to_ascii_lowercase()
                            .ends_with(&suffix.to_ascii_lowercase())
                    })
            })
            .cloned()
            .collect()
    }
}

fn is_step(path: &str) -> bool {
    let lowered = path.to_ascii_lowercase();
    lowered.ends_with(".step") || lowered.ends_with(".stp")
}

/// Measure every part that names a STEP model: its posed bounds and its
/// front and side silhouettes. Without a Geometer session the board is left
/// with every height unknown and no elevation geometry.
pub fn measure(
    board: &mut Board,
    bundle: &Bundle,
    geometer: Option<&mut Geometer>,
    model_dirs: &BTreeMap<String, PathBuf>,
) -> Result<Measurement, LabError> {
    let text = bundle.board_text()?;
    let view = PcbView::parse(&text, PcbLimits::default())
        .map_err(|error| LabError::new(format!("the board does not parse: {error}")))?;
    let sources = StepSources::load(bundle)?;
    let board_dir = parent(bundle.board_file()?);
    let project_dir = parent(bundle.manifest().config.project_file.0.clone());
    let mut measurement = Measurement {
        geometer: geometer
            .as_ref()
            .map(|session| session.release().to_owned()),
        measured: 0,
        models: 0,
        requests: 0,
        warnings: Vec::new(),
    };
    let Some(session) = geometer else {
        for part in &mut board.parts {
            part.height_note = "no Geometer runtime".to_owned();
        }
        return Ok(measurement);
    };
    for part in &mut board.parts {
        let Some(model) = part.model.clone() else {
            part.height_note = "no STEP model".to_owned();
            continue;
        };
        let source = ModelSource {
            view: &view,
            footprint_index: part.index,
            board_dir: &board_dir,
            project_dir: &project_dir,
            sources: &sources,
            model_dirs,
        };
        let Some(bytes) = resolve::step_bytes(&source, &model.path) else {
            part.height_note = "STEP model not found".to_owned();
            continue;
        };
        measurement.models += 1;
        let sha = hex(&Sha256::digest(&bytes));
        let pose = local_pose(
            &ModelPose {
                offset: model.offset,
                rotate: model.rotate,
                scale: model.scale,
            },
            part.side == Side::Bottom,
            board.thickness,
        );
        // Geometer projects in the world frame (x right, y up); the footprint
        // adds a rotation about z before the board's y flip, so the elevation
        // transform is that rotation followed by the local pose.
        let matrix = multiply(rotation_z(part.angle), pose.matrix);
        match session.measure(&sha, &matrix, &bytes) {
            Ok(extent) => {
                part.height = Some(height(extent, board.thickness));
                part.height_source = HeightSource::ModelBounds;
                part.height_note = String::new();
                measurement.measured += 1;
            }
            Err(error) => {
                part.height_note = format!("model bounds failed: {error}");
                measurement
                    .warnings
                    .push(format!("{}: model bounds failed: {error}", part.reference));
            }
        }
        match session.silhouettes(&sha, &matrix, &bytes) {
            Ok((front, side)) => {
                part.front_lines = front;
                part.side_lines = side;
            }
            Err(error) => {
                measurement
                    .warnings
                    .push(format!("{}: silhouette failed: {error}", part.reference));
            }
        }
    }
    measurement.requests = session.requests;
    Ok(measurement)
}

/// A rotation about z by `degrees`, in the world frame.
fn rotation_z(degrees: f64) -> [[f64; 4]; 4] {
    let (sin, cos) = degrees.to_radians().sin_cos();
    [
        [cos, -sin, 0.0, 0.0],
        [sin, cos, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
}

fn multiply(left: [[f64; 4]; 4], right: [[f64; 4]; 4]) -> [[f64; 4]; 4] {
    let mut out = [[0.0; 4]; 4];
    for (row, cells) in out.iter_mut().enumerate() {
        for (column, cell) in cells.iter_mut().enumerate() {
            *cell = (0..4)
                .map(|index| left[row][index] * right[index][column])
                .sum();
        }
    }
    out
}

fn height(extent: geometer::Extent3, thickness: f64) -> Height {
    let half = thickness / 2.0;
    Height {
        above: (extent.max_z() - half).max(0.0),
        below: (-extent.min_z() - half).max(0.0),
    }
}

fn parent(path: String) -> String {
    Path::new(&path)
        .parent()
        .and_then(|parent| parent.to_str())
        .unwrap_or("")
        .to_owned()
}

fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

/// The projected outline's extent in a view, for the elevation fit.
pub fn view_bounds(lines: &[Vec<Point>]) -> prism_artwork::artwork::geometry::Bounds {
    let mut bounds = prism_artwork::artwork::geometry::Bounds::empty();
    for point in lines.iter().flatten() {
        bounds.include(*point);
    }
    bounds
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_source_set_lists_and_reads_its_step_files() {
        let sources = StepSources {
            files: BTreeMap::from([
                ("a/packages3D/R.step".to_owned(), Arc::from(vec![1_u8])),
                ("a/packages3D/R.wrl".to_owned(), Arc::from(vec![2_u8])),
            ]),
        };
        assert!(sources.read("a/packages3D/R.step").is_some());
        assert!(sources.read("a/packages3D/Q.step").is_none());
        assert_eq!(
            sources.list("a", &["STEP"]),
            vec!["a/packages3D/R.step".to_owned()]
        );
        assert!(sources.exists("a/packages3D/R.wrl"));
    }

    #[test]
    fn heights_measure_from_the_posed_surfaces() {
        let height = height(
            geometer::Extent3 {
                min: [0.0, 0.0, -2.3],
                max: [10.0, 10.0, 6.1],
            },
            1.6,
        );
        assert!((height.above - 5.3).abs() < 1e-9);
        assert!((height.below - 1.5).abs() < 1e-9);
    }

    #[test]
    fn a_part_inside_the_board_has_no_height_span() {
        let part = Part {
            index: 0,
            reference: "R1".to_owned(),
            library: String::new(),
            side: Side::Top,
            mechanical: false,
            at: Point { x: 0.0, y: 0.0 },
            angle: 0.0,
            body: board::Body::Envelope(Vec::new()),
            body_bounds: prism_artwork::artwork::geometry::Bounds::empty(),
            courtyard: None,
            pad_bounds: None,
            overhang: None,
            model: None,
            fallback_height: None,
            height: None,
            height_source: HeightSource::Unknown,
            height_note: String::new(),
            front_lines: Vec::new(),
            side_lines: Vec::new(),
        };
        assert_eq!(part.height_span(), 0.0);
    }
}
