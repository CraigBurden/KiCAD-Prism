//! The model pose of `kicad_cruncher_pcb_model_pose.py` (`kicad_model_local_pose`).
//!
//! The pose is the model-to-KiCad-3D-world transform *before* the footprint's
//! XY placement and Z rotation, so every instance of one model at one board
//! side shares it. All lengths are millimetres here; the member converts to
//! nanometres after the footprint transform.

/// The model's own offset, rotation and scale, as written in `(model …)`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ModelPose {
    /// `(offset x y z)`, mm (`(at …)` in inches converted by the core).
    pub offset: [f64; 3],
    /// `(rotate x y z)`, degrees.
    pub rotate: [f64; 3],
    /// `(scale x y z)`.
    pub scale: [f64; 3],
}

impl Default for ModelPose {
    fn default() -> Self {
        Self {
            offset: [0.0; 3],
            rotate: [0.0; 3],
            scale: [1.0; 3],
        }
    }
}

/// A local pose: the 4×4 row-major matrix and the board side it models.
#[derive(Clone, Debug, PartialEq)]
pub struct LocalPose {
    /// The model-to-3D-world transform, row-major.
    pub matrix: [[f64; 4]; 4],
    /// True when the footprint is on the board's back (`B.*`).
    pub bottom: bool,
}

/// `_BOARD_MODEL_Z_OFFSET_MM`.
const BOARD_MODEL_Z_OFFSET_MM: f64 = 0.05;

/// `kicad_model_local_pose` (`kicad_cruncher_pcb_model_pose.py:60-95`).
#[must_use]
pub fn local_pose(model: &ModelPose, bottom: bool, board_thickness_mm: f64) -> LocalPose {
    let offset_z = model.offset[2] + BOARD_MODEL_Z_OFFSET_MM + board_thickness_mm / 2.0;
    let mut matrix = identity();
    if bottom {
        matrix = multiply(matrix, rotation_x(std::f64::consts::PI));
    }
    matrix = multiply(
        matrix,
        translation(model.offset[0], model.offset[1], offset_z),
    );
    matrix = multiply(matrix, rotation_z(degrees_to_radians(-model.rotate[2])));
    matrix = multiply(matrix, rotation_y(degrees_to_radians(-model.rotate[1])));
    matrix = multiply(matrix, rotation_x(degrees_to_radians(-model.rotate[0])));
    matrix = multiply(matrix, scale(model.scale));
    LocalPose { matrix, bottom }
}

/// `numpy`-free degrees→radians, used only where the Python calls
/// `math.radians`.
fn degrees_to_radians(degrees: f64) -> f64 {
    degrees * std::f64::consts::PI / 180.0
}

/// `transform_model_local_world_to_board_world` in KiCad's board frame
/// (`kicad_cruncher_pcb_model_pose.py:101-116` plus `board_world_to_svg`'s Y
/// flip), millimetres.
#[must_use]
pub fn local_to_board(point: [f64; 2], position_mm: [f64; 2], rotation_deg: f64) -> [f64; 2] {
    let angle = degrees_to_radians(rotation_deg);
    let (sine, cosine) = (angle.sin(), angle.cos());
    [
        position_mm[0] + point[0] * cosine - point[1] * sine,
        position_mm[1] - point[0] * sine - point[1] * cosine,
    ]
}

/// The 16 matrix values in the row-major order Geometer's `model_transform`
/// takes.
#[must_use]
pub fn flat(matrix: &[[f64; 4]; 4]) -> [f64; 16] {
    let mut values = [0.0; 16];
    for (row, cells) in matrix.iter().enumerate() {
        values[row * 4..row * 4 + 4].copy_from_slice(cells);
    }
    values
}

fn identity() -> [[f64; 4]; 4] {
    [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
}

fn translation(x: f64, y: f64, z: f64) -> [[f64; 4]; 4] {
    [
        [1.0, 0.0, 0.0, x],
        [0.0, 1.0, 0.0, y],
        [0.0, 0.0, 1.0, z],
        [0.0, 0.0, 0.0, 1.0],
    ]
}

fn scale(values: [f64; 3]) -> [[f64; 4]; 4] {
    [
        [values[0], 0.0, 0.0, 0.0],
        [0.0, values[1], 0.0, 0.0],
        [0.0, 0.0, values[2], 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
}

fn rotation_x(angle: f64) -> [[f64; 4]; 4] {
    let (sine, cosine) = (angle.sin(), angle.cos());
    [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, cosine, -sine, 0.0],
        [0.0, sine, cosine, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
}

fn rotation_y(angle: f64) -> [[f64; 4]; 4] {
    let (sine, cosine) = (angle.sin(), angle.cos());
    [
        [cosine, 0.0, sine, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [-sine, 0.0, cosine, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
}

fn rotation_z(angle: f64) -> [[f64; 4]; 4] {
    let (sine, cosine) = (angle.sin(), angle.cos());
    [
        [cosine, -sine, 0.0, 0.0],
        [sine, cosine, 0.0, 0.0],
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identity_pose_places_the_model_at_the_board_centre() {
        let pose = local_pose(&ModelPose::default(), false, 1.6);
        let flat = flat(&pose.matrix);
        assert_eq!(flat[0], 1.0);
        assert_eq!(flat[5], 1.0);
        assert_eq!(flat[10], 1.0);
        assert!((flat[11] - (0.05 + 0.8)).abs() < 1e-12);
    }

    #[test]
    fn a_back_pose_flips_the_model_about_x() {
        let pose = local_pose(&ModelPose::default(), true, 1.6);
        let flat = flat(&pose.matrix);
        assert_eq!(flat[5], -1.0);
        assert_eq!(flat[10], -1.0);
        assert!((flat[11] + (0.05 + 0.8)).abs() < 1e-12);
    }

    #[test]
    fn the_board_transform_negates_y_and_follows_the_footprint_rotation() {
        // A -90 degree footprint at the origin maps local (1, 0) to board (0, 1).
        let point = local_to_board([1.0, 0.0], [0.0, 0.0], -90.0);
        assert!(point[0].abs() < 1e-12);
        assert!((point[1] - 1.0).abs() < 1e-12);
    }
}
