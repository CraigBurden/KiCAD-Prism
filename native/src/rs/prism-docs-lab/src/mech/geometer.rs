//! One Geometer process for a prototype run: model bounds for heights and the
//! front and right-side hidden-line projections for the elevations.
//!
//! The session is opened once. Every request is cached by the model's SHA-256,
//! its pose matrix and the view id, so 36 resistors sharing one model and one
//! pose cost one projection. Failures are per part: a model Geometer rejects
//! leaves that part without a height, and the run still writes its sheets.

use std::collections::BTreeMap;
use std::path::Path;

use geometer_client::contracts::{
    HlrCurveMode, HlrOutlineAlgorithm, HlrProjectionOptionsA0, HlrViewSpec, ModelBoundsOptionsA0,
};
use geometer_client::{
    GeometerClient, GeometerClientError, ModelBoundsRequest, ModelHlrProjectionRequest,
};
use prism_artwork::artwork::geometry::Point;
use tokio::runtime::Runtime;

/// The release the bundle's assembly stage was built with.
pub const PINNED_RELEASE: &str = "2026.9.19";
/// The projection option set token; the front and side views match the
/// assembly stage's curve handling.
const SAMPLES_PER_CURVE: u32 = 24;
const ROUND_DIGITS: u32 = 3;

/// A model extent in Geometer's posed frame, millimetres.
#[derive(Clone, Copy, Debug)]
pub struct Extent3 {
    /// Minimum x, y, z.
    pub min: [f64; 3],
    /// Maximum x, y, z.
    pub max: [f64; 3],
}

impl Extent3 {
    /// Highest point.
    pub fn max_z(&self) -> f64 {
        self.max[2]
    }

    /// Lowest point.
    pub fn min_z(&self) -> f64 {
        self.min[2]
    }
}

type CacheKey = (String, Vec<u64>, String);

/// A model's outline in two views, as polylines in view millimetres.
pub type Silhouettes = (Vec<Vec<Point>>, Vec<Vec<Point>>);

/// The persistent Geometer session and its per-run cache.
pub struct Geometer {
    runtime: Runtime,
    client: Option<GeometerClient>,
    release: String,
    bounds: BTreeMap<(String, Vec<u64>), Extent3>,
    views: BTreeMap<CacheKey, Vec<Vec<Point>>>,
    /// Requests actually sent, for the summary line.
    pub requests: usize,
}

impl Geometer {
    /// Start `executable` and read its welcome.
    pub fn connect(executable: &Path) -> Result<Self, String> {
        let runtime = Runtime::new().map_err(|error| format!("no async runtime: {error}"))?;
        let client = runtime
            .block_on(GeometerClient::spawn(
                executable,
                "prism-docs-lab",
                env!("CARGO_PKG_VERSION"),
            ))
            .map_err(|error| format!("{} did not start: {error}", executable.display()))?;
        let release = client.welcome().release_version.clone();
        Ok(Self {
            runtime,
            client: Some(client),
            release,
            bounds: BTreeMap::new(),
            views: BTreeMap::new(),
            requests: 0,
        })
    }

    /// The runtime's release version, as its welcome reports it.
    pub fn release(&self) -> &str {
        &self.release
    }

    /// The posed extent of `bytes` under `matrix`.
    pub fn measure(
        &mut self,
        sha: &str,
        matrix: &[[f64; 4]; 4],
        bytes: &[u8],
    ) -> Result<Extent3, String> {
        let key = (sha.to_owned(), signature(matrix));
        if let Some(extent) = self.bounds.get(&key) {
            return Ok(*extent);
        }
        let request = ModelBoundsRequest {
            model: bytes.to_vec(),
            media_type: "application/step".to_owned(),
            options: ModelBoundsOptionsA0 {
                format: None,
                model_transform: Some(flat(matrix)),
            },
        };
        self.requests += 1;
        let client = self.client.as_ref().ok_or("the session is closed")?;
        let result = self
            .runtime
            .block_on(client.model_bounds(request))
            .map_err(describe)?;
        let extent = Extent3 {
            min: result.bounds.min,
            max: result.bounds.max,
        };
        self.bounds.insert(key, extent);
        Ok(extent)
    }

    /// The front and right-side silhouette polylines of `bytes` under `matrix`.
    pub fn silhouettes(
        &mut self,
        sha: &str,
        matrix: &[[f64; 4]; 4],
        bytes: &[u8],
    ) -> Result<Silhouettes, String> {
        let signature = signature(matrix);
        let front = (sha.to_owned(), signature.clone(), "front".to_owned());
        let side = (sha.to_owned(), signature.clone(), "side".to_owned());
        if let (Some(front), Some(side)) = (self.views.get(&front), self.views.get(&side)) {
            return Ok((front.clone(), side.clone()));
        }
        let options = options(matrix);
        self.requests += 1;
        let client = self.client.as_ref().ok_or("the session is closed")?;
        let result = self
            .runtime
            .block_on(client.model_hlr_projection(ModelHlrProjectionRequest {
                model: bytes.to_vec(),
                media_type: "application/step".to_owned(),
                options,
            }))
            .map_err(describe)?;
        let mut front = Vec::new();
        let mut side = Vec::new();
        for view in &result.views {
            let lines = polylines(&view.modes.outline);
            match view.id.as_str() {
                "front" => front = lines,
                "side" => side = lines,
                _ => {}
            }
        }
        if front.is_empty() && side.is_empty() {
            return Err("Geometer returned no front or side view".to_owned());
        }
        self.views.insert(
            (sha.to_owned(), signature.clone(), "front".to_owned()),
            front.clone(),
        );
        self.views
            .insert((sha.to_owned(), signature, "side".to_owned()), side.clone());
        Ok((front, side))
    }
}

impl Drop for Geometer {
    fn drop(&mut self) {
        if let Some(client) = self.client.take() {
            let _ = self.runtime.block_on(client.close());
        }
    }
}

fn describe(error: GeometerClientError) -> String {
    error.to_string()
}

fn signature(matrix: &[[f64; 4]; 4]) -> Vec<u64> {
    flat(matrix).iter().map(|value| value.to_bits()).collect()
}

/// Geometer's row-major 16-value transform.
pub fn flat(matrix: &[[f64; 4]; 4]) -> [f64; 16] {
    let mut values = [0.0; 16];
    for (row, cells) in matrix.iter().enumerate() {
        values[row * 4..row * 4 + 4].copy_from_slice(cells);
    }
    values
}

/// The front and side option set: the silhouette only, native arcs, the same
/// rounding as the assembly stage.
fn options(matrix: &[[f64; 4]; 4]) -> HlrProjectionOptionsA0 {
    HlrProjectionOptionsA0 {
        views: Some(vec![
            HlrViewSpec {
                id: "front".to_owned(),
                direction: [0.0, 1.0, 0.0],
                up: [0.0, 0.0, 1.0],
            },
            HlrViewSpec {
                id: "side".to_owned(),
                direction: [-1.0, 0.0, 0.0],
                up: [0.0, 0.0, 1.0],
            },
        ]),
        output_outline: Some(true),
        output_detail: Some(false),
        output_bbox: None,
        model_transform: Some(flat(matrix)),
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
    }
}

fn polylines(geometry: &geometer_client::contracts::ProjectedGeometry) -> Vec<Vec<Point>> {
    let mut lines = Vec::new();
    for segment in &geometry.segments {
        lines.push(vec![
            Point {
                x: segment[0],
                y: segment[1],
            },
            Point {
                x: segment[2],
                y: segment[3],
            },
        ]);
    }
    for arc in &geometry.arcs {
        let line = arc_polyline(arc);
        if line.len() >= 2 {
            lines.push(line);
        }
    }
    lines
}

fn arc_polyline(arc: &geometer_client::contracts::ProjectedArc) -> Vec<Point> {
    let center = Point {
        x: arc.center[0],
        y: arc.center[1],
    };
    let start = (arc.start[1] - center.y).atan2(arc.start[0] - center.x);
    let sweep = if arc.full_circle {
        std::f64::consts::TAU
    } else {
        arc.extent_rad.abs().min(std::f64::consts::TAU)
    };
    let direction = if arc.ccw { 1.0 } else { -1.0 };
    let count = if arc.full_circle {
        64
    } else {
        ((sweep / std::f64::consts::TAU) * 64.0).ceil().max(6.0) as usize
    };
    (0..=count)
        .map(|index| {
            let angle = start + direction * sweep * index as f64 / count as f64;
            Point {
                x: center.x + arc.radius * angle.cos(),
                y: center.y + arc.radius * angle.sin(),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_matrix_flattens_row_major() {
        let matrix = [[1.0, 2.0, 3.0, 4.0], [5.0; 4], [6.0; 4], [7.0; 4]];
        assert_eq!(flat(&matrix)[0], 1.0);
        assert_eq!(flat(&matrix)[4], 5.0);
        assert_eq!(flat(&matrix)[15], 7.0);
    }

    #[test]
    fn a_signature_is_stable_for_the_same_matrix() {
        let matrix = [[1.0, 0.0, 0.0, 0.0], [0.0; 4], [0.0; 4], [0.0; 4]];
        assert_eq!(signature(&matrix), signature(&matrix.clone()));
        assert_ne!(signature(&matrix), signature(&[[2.0; 4]; 4]));
    }
}
