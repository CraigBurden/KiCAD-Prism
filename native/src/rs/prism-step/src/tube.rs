//! Tube meshes for harness bundles: rings perpendicular to the path using
//! parallel-transport frames (no twisting flips), with closed end caps.

use crate::assembly::Mesh;

/// Sides of a harness tube (CONTRACTS §18).
pub const DEFAULT_SIDES: usize = 16;

/// A tube of `radius_mm` along `samples_mm`, `sides` around its path.
///
/// The rings are perpendicular to the path; the frame is carried from one
/// sample to the next by the minimal rotation, so the tube does not flip. Both
/// ends are closed with a fan to the end point. An empty path, a non-positive
/// radius or fewer than three sides gives an empty mesh.
#[must_use]
pub fn tube(samples_mm: &[[f64; 3]], radius_mm: f64, sides: usize) -> Mesh {
    let name = "Tube".to_owned();
    let empty = || Mesh {
        name: name.clone(),
        ..Mesh::default()
    };
    if radius_mm <= 0.0 || sides < 3 {
        return empty();
    }
    let samples = distinct(samples_mm);
    if samples.len() < 2 {
        return empty();
    }
    let tangents = tangents(&samples);
    let frames = frames(&tangents);
    let mut positions = Vec::with_capacity(samples.len() * sides + 2);
    for (sample, (normal, binormal)) in samples.iter().zip(&frames) {
        for index in 0..sides {
            let angle = std::f64::consts::TAU * index as f64 / sides as f64;
            let (sin, cos) = angle.sin_cos();
            let mut point = [0.0; 3];
            for axis in 0..3 {
                point[axis] =
                    sample[axis] + radius_mm * (normal[axis] * cos + binormal[axis] * sin);
            }
            positions.push(point);
        }
    }
    let mut triangles = side_triangles(samples.len(), sides);
    let last = positions.len();
    positions.push(samples[0]);
    positions.push(*samples.last().unwrap_or(&samples[0]));
    cap_triangles(&mut triangles, samples.len(), sides, last);
    Mesh {
        name,
        positions,
        triangles,
        colour: None,
    }
}

/// The samples without consecutive duplicates.
fn distinct(samples: &[[f64; 3]]) -> Vec<[f64; 3]> {
    let mut out: Vec<[f64; 3]> = Vec::with_capacity(samples.len());
    for sample in samples {
        if out
            .last()
            .is_none_or(|last| distance(*last, *sample) > 1e-9)
        {
            out.push(*sample);
        }
    }
    out
}

fn distance(a: [f64; 3], b: [f64; 3]) -> f64 {
    ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt()
}

fn tangents(samples: &[[f64; 3]]) -> Vec<[f64; 3]> {
    let mut out = Vec::with_capacity(samples.len());
    let mut previous = [1.0, 0.0, 0.0];
    for index in 0..samples.len() {
        let before = index.saturating_sub(1);
        let after = (index + 1).min(samples.len() - 1);
        let tangent = unit(sub(samples[after], samples[before])).unwrap_or(previous);
        previous = tangent;
        out.push(tangent);
    }
    out
}

fn frames(tangents: &[[f64; 3]]) -> Vec<([f64; 3], [f64; 3])> {
    let mut out = Vec::with_capacity(tangents.len());
    let first = tangents.first().copied().unwrap_or([0.0, 0.0, 1.0]);
    let reference = if first[0].abs() < 0.9 {
        [1.0, 0.0, 0.0]
    } else {
        [0.0, 1.0, 0.0]
    };
    let mut normal = unit(cross(reference, first)).unwrap_or([0.0, 1.0, 0.0]);
    for (index, tangent) in tangents.iter().enumerate() {
        if let Some(previous) = index.checked_sub(1).and_then(|index| tangents.get(index)) {
            normal = transport(normal, *previous, *tangent);
        }
        normal = orthogonal(normal, *tangent);
        out.push((normal, cross(*tangent, normal)));
    }
    out
}

/// Carry `normal` from `from`'s frame to `to`'s by the minimal rotation.
fn transport(normal: [f64; 3], from: [f64; 3], to: [f64; 3]) -> [f64; 3] {
    let axis = cross(from, to);
    let sin = length(axis);
    if sin <= 1e-12 {
        return normal;
    }
    let axis = mul(axis, 1.0 / sin);
    rotate(normal, axis, sin.atan2(dot(from, to)))
}

fn side_triangles(rings: usize, sides: usize) -> Vec<[u32; 3]> {
    let mut triangles = Vec::with_capacity(rings.saturating_sub(1) * sides * 2);
    for ring in 0..rings.saturating_sub(1) {
        for side in 0..sides {
            let next = (side + 1) % sides;
            let a = (ring * sides + side) as u32;
            let b = (ring * sides + next) as u32;
            let c = ((ring + 1) * sides + next) as u32;
            let d = ((ring + 1) * sides + side) as u32;
            triangles.push([a, b, c]);
            triangles.push([a, c, d]);
        }
    }
    triangles
}

fn cap_triangles(triangles: &mut Vec<[u32; 3]>, rings: usize, sides: usize, last: usize) {
    let start_centre = last as u32;
    let end_centre = start_centre + 1;
    let end_ring = ((rings - 1) * sides) as u32;
    for side in 0..sides {
        let next = (side + 1) % sides;
        // The start cap faces -t: its ring runs clockwise seen from outside.
        triangles.push([start_centre, next as u32, side as u32]);
        // The end cap faces +t.
        triangles.push([end_centre, end_ring + side as u32, end_ring + next as u32]);
    }
}

fn orthogonal(vector: [f64; 3], axis: [f64; 3]) -> [f64; 3] {
    let projected = sub(vector, mul(axis, dot(vector, axis)));
    unit(projected).unwrap_or_else(|| {
        let reference = if axis[0].abs() < 0.9 {
            [1.0, 0.0, 0.0]
        } else {
            [0.0, 1.0, 0.0]
        };
        unit(cross(reference, axis)).unwrap_or([0.0, 1.0, 0.0])
    })
}

fn rotate(vector: [f64; 3], axis: [f64; 3], angle: f64) -> [f64; 3] {
    let (sin, cos) = angle.sin_cos();
    let cross = cross(axis, vector);
    let dot = dot(axis, vector);
    [
        vector[0] * cos + cross[0] * sin + axis[0] * dot * (1.0 - cos),
        vector[1] * cos + cross[1] * sin + axis[1] * dot * (1.0 - cos),
        vector[2] * cos + cross[2] * sin + axis[2] * dot * (1.0 - cos),
    ]
}

fn sub(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

fn mul(vector: [f64; 3], scale: f64) -> [f64; 3] {
    [vector[0] * scale, vector[1] * scale, vector[2] * scale]
}

fn dot(a: [f64; 3], b: [f64; 3]) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

fn cross(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn length(vector: [f64; 3]) -> f64 {
    dot(vector, vector).sqrt()
}

fn unit(vector: [f64; 3]) -> Option<[f64; 3]> {
    let length = length(vector);
    (length > 1e-12 && length.is_finite()).then(|| mul(vector, 1.0 / length))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn normal(a: [f64; 3], b: [f64; 3], c: [f64; 3]) -> [f64; 3] {
        cross(sub(b, a), sub(c, a))
    }

    #[test]
    fn a_straight_tube_has_rings_and_caps() {
        let mesh = tube(&[[0.0, 0.0, 0.0], [0.0, 0.0, 10.0]], 2.0, 16);
        assert_eq!(mesh.positions.len(), 2 * 16 + 2);
        assert_eq!(mesh.triangles.len(), 2 * 16 + 2 * 16);
        // Every triangle winds outward: side triangles point away from the
        // axis, the start cap down -z and the end cap up +z.
        for triangle in &mesh.triangles {
            let points = triangle.map(|index| mesh.positions[index as usize]);
            let normal = normal(points[0], points[1], points[2]);
            if normal[2].abs() > 0.5 {
                // A cap: the start cap faces -z, the end cap +z.
                assert!(
                    (normal[2] < 0.0) == (points[0][2] < 5.0),
                    "cap {triangle:?} faces the wrong way: {normal:?}"
                );
                continue;
            }
            let middle = [
                (points[0][0] + points[1][0] + points[2][0]) / 3.0,
                (points[0][1] + points[1][1] + points[2][1]) / 3.0,
            ];
            let radial = [middle[0], middle[1], 0.0];
            assert!(
                dot(normal, radial) > 0.0,
                "side triangle {triangle:?} winds inward: {normal:?}"
            );
        }
    }

    #[test]
    fn a_bent_path_keeps_its_rings_perpendicular() {
        let samples = [[0.0, 0.0, 0.0], [0.0, 0.0, 5.0], [5.0, 0.0, 5.0]];
        let mesh = tube(&samples, 1.0, 8);
        assert_eq!(mesh.positions.len(), 3 * 8 + 2);
        // Each ring lies in the plane through its sample, perpendicular to the
        // path's tangent there (the elbow's is the bisector of its segments).
        let tangents = [
            [0.0, 0.0, 1.0],
            [
                std::f64::consts::FRAC_1_SQRT_2,
                0.0,
                std::f64::consts::FRAC_1_SQRT_2,
            ],
            [1.0, 0.0, 0.0],
        ];
        for (ring, (sample, tangent)) in samples.iter().zip(tangents).enumerate() {
            for point in &mesh.positions[ring * 8..ring * 8 + 8] {
                let offset = sub(*point, *sample);
                assert!(dot(offset, tangent).abs() < 1e-9, "{point:?} off the ring");
                assert!((length(offset) - 1.0).abs() < 1e-9, "radius {point:?}");
            }
        }
    }

    #[test]
    fn degenerate_input_is_empty() {
        assert!(tube(&[], 1.0, 16).positions.is_empty());
        assert!(tube(&[[0.0; 3]], 1.0, 16).positions.is_empty());
        assert!(tube(&[[0.0; 3], [0.0; 3]], 1.0, 16).positions.is_empty());
        assert!(
            tube(&[[0.0; 3], [0.0, 0.0, 1.0]], 0.0, 16)
                .positions
                .is_empty()
        );
        assert!(
            tube(&[[0.0; 3], [0.0, 0.0, 1.0]], 1.0, 2)
                .positions
                .is_empty()
        );
    }
}
