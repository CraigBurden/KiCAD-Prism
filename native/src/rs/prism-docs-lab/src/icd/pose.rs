//! The model pose: `kicad_model_local_pose`'s offset, rotation, scale and
//! board-side flip, as a row-major matrix Geometer takes.
//!
//! The pose maps the model into the footprint's frame *before* the footprint's
//! own placement, so every instance of one model at one board side shares it.

/// `_BOARD_MODEL_Z_OFFSET_MM`.
const BOARD_MODEL_Z_OFFSET_MM: f64 = 0.05;

/// The model's own offset, rotation and scale, as the board writes them.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ModelPose {
    /// `(offset x y z)`, millimetres.
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

/// The matrix handed to Geometer, and whether the part is seen from below.
#[derive(Clone, Debug, PartialEq)]
pub struct Pose {
    /// Model-to-footprint-frame transform, row-major.
    pub matrix: [[f64; 4]; 4],
    /// True when the footprint is on the board's back: views mirror u.
    pub mirror_u: bool,
}

impl Pose {
    /// The matrix values in the order Geometer's `model_transform` takes.
    pub fn flat(&self) -> [f64; 16] {
        let mut values = [0.0; 16];
        for (row, cells) in self.matrix.iter().enumerate() {
            values[row * 4..row * 4 + 4].copy_from_slice(cells);
        }
        values
    }

    /// The pose as bits, for the cache key.
    pub fn bits(&self) -> Vec<u64> {
        let mut bits: Vec<u64> = self
            .matrix
            .iter()
            .flat_map(|row| row.iter())
            .map(|value| value.to_bits())
            .collect();
        bits.push(u64::from(self.mirror_u));
        bits
    }
}

/// `kicad_model_local_pose`: the model-to-3D-world transform before the
/// footprint's placement.
pub fn local_pose(model: &ModelPose, bottom: bool, board_thickness_mm: f64) -> Pose {
    let offset_z = model.offset[2] + BOARD_MODEL_Z_OFFSET_MM + board_thickness_mm / 2.0;
    let mut matrix = identity();
    if bottom {
        matrix = multiply(matrix, rotation_x(std::f64::consts::PI));
    }
    matrix = multiply(
        matrix,
        translation(model.offset[0], model.offset[1], offset_z),
    );
    matrix = multiply(matrix, rotation_z(radians(-model.rotate[2])));
    matrix = multiply(matrix, rotation_y(radians(-model.rotate[1])));
    matrix = multiply(matrix, rotation_x(radians(-model.rotate[0])));
    matrix = multiply(matrix, scale(model.scale));
    Pose {
        matrix,
        mirror_u: bottom,
    }
}

fn radians(degrees: f64) -> f64 {
    degrees * std::f64::consts::PI / 180.0
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
    let (sine, cosine) = angle.sin_cos();
    [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, cosine, -sine, 0.0],
        [0.0, sine, cosine, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
}

fn rotation_y(angle: f64) -> [[f64; 4]; 4] {
    let (sine, cosine) = angle.sin_cos();
    [
        [cosine, 0.0, sine, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [-sine, 0.0, cosine, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
}

fn rotation_z(angle: f64) -> [[f64; 4]; 4] {
    let (sine, cosine) = angle.sin_cos();
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
